import { test, expect } from './fixtures.mjs';
import { evaluateWhenReady, dismissNotifications, deleteActor } from './helpers.mjs';

/**
 * Issue #125 — spending a power's Focus cost from the sheet or its chat card.
 *
 * The rulebook caps a single spend at five times rank, so every fixture below
 * sets rank deliberately rather than relying on the default.
 */
const HERO = 'E2E Activate Hero';

/** Create the actor at a given rank and Focus, plus one power. */
async function setup(page, { rank = 3, focus = 100, cost = '10 Focus', name = 'E2E Activate Power' } = {}) {
  return evaluateWhenReady(page, async ({ hero, rank, focus, cost, name }) => {
    const stale = game.actors.filter(a => a.name === hero);
    if (stale.length) await Actor.deleteDocuments(stale.map(a => a.id));
    const actor = await Actor.create({ name: hero, type: 'character' });
    await actor.update({
      'system.attributes.rank.value': rank,
      'system.focus.value': focus,
    });
    const [item] = await actor.createEmbeddedDocuments('Item', [
      { name, type: 'power', system: { cost, description: '<p>Probe.</p>' } },
    ]);
    return { itemId: item.id, focus: actor.system.focus.value };
  }, { hero: HERO, rank, focus, cost, name });
}

/** Run the activation routine the sheet control calls, and report the outcome. */
async function activate(page, itemId) {
  return evaluateWhenReady(page, async ({ hero, itemId }) => {
    const actor = game.actors.find(a => a.name === hero);
    const item = actor.items.get(itemId);
    const before = new Set(game.messages.contents.map(m => m.id));

    const sheet = actor.sheet;
    await sheet._render(true);
    await new Promise(r => setTimeout(r, 400));
    const root = sheet.element?.[0] ?? sheet.element;
    const button = root?.querySelector(`.power-activate[data-item-id="${item.id}"]`);
    if (button) button.click();
    await new Promise(r => setTimeout(r, 700));

    const created = game.messages.contents.filter(m => !before.has(m.id));
    const out = {
      hadControl: !!button,
      focus: actor.system.focus.value,
      messages: created.map(m => ({ content: m.content, flavor: m.flavor, whisper: m.whisper })),
      dialogOpen: !!document.querySelector('.dialog .window-content, dialog.application'),
    };
    await sheet.close();
    return out;
  }, { hero: HERO, itemId });
}

test.describe('Activating a power', () => {
  test.beforeEach(async ({ foundryPage }) => {
    await dismissNotifications(foundryPage);
  });

  test.afterEach(async ({ foundryPage }) => {
    await evaluateWhenReady(foundryPage, () => {
      document.querySelectorAll('.dialog').forEach(d => d.remove());
    });
    await deleteActor(foundryPage, HERO);
  });

  test('a flat cost is deducted and announced without a prompt', async ({ foundryPage: page }) => {
    const { itemId } = await setup(page, { rank: 3, focus: 100, cost: '10 Focus' });
    const r = await activate(page, itemId);

    expect(r.hadControl).toBe(true);
    expect(r.focus).toBe(90);
    expect(r.messages).toHaveLength(1);
    expect(r.messages[0].content).toContain('10 Focus');
    expect(r.messages[0].flavor).toContain('E2E Activate Power');
    expect(r.dialogOpen).toBe(false);
  });

  test('the message is public regardless of roll mode', async ({ foundryPage: page }) => {
    const { itemId } = await setup(page, { rank: 3, focus: 100, cost: '10 Focus' });
    await evaluateWhenReady(page, async () => {
      await game.settings.set('core', 'rollMode', 'gmroll');
    });
    const r = await activate(page, itemId);
    await evaluateWhenReady(page, async () => {
      await game.settings.set('core', 'rollMode', 'publicroll');
    });

    expect(r.messages).toHaveLength(1);
    // A whispered message carries recipients; a public one carries none.
    expect(r.messages[0].whisper).toEqual([]);
  });

  test('no control appears when the cost cannot be worked out', async ({ foundryPage: page }) => {
    const { itemId } = await setup(page, { cost: 'Varies' });
    const r = await activate(page, itemId);

    expect(r.hadControl).toBe(false);
    expect(r.focus).toBe(100);
    expect(r.messages).toHaveLength(0);
  });

  test('no control appears when the power has no cost', async ({ foundryPage: page }) => {
    const { itemId } = await setup(page, { cost: '' });
    const r = await activate(page, itemId);

    expect(r.hadControl).toBe(false);
    expect(r.focus).toBe(100);
  });

  test('a cost above five times rank is refused rather than deducted', async ({ foundryPage: page }) => {
    // Rank 1 caps a single spend at 5, so a 25 Focus power cannot be paid.
    const { itemId } = await setup(page, { rank: 1, focus: 100, cost: '25 Focus' });
    const r = await activate(page, itemId);

    expect(r.hadControl).toBe(true); // the cost parses, so the control shows
    expect(r.focus).toBe(100); // but nothing is spent
    expect(r.messages).toHaveLength(0);
  });

  test('a variable cost opens a prompt and deducts nothing until answered', async ({ foundryPage: page }) => {
    const { itemId } = await setup(page, { rank: 6, focus: 100, cost: '5 or more Focus' });
    const r = await activate(page, itemId);

    expect(r.hadControl).toBe(true);
    expect(r.dialogOpen).toBe(true);
    expect(r.focus).toBe(100);
    expect(r.messages).toHaveLength(0);
  });

  test('the chat card carries an Activate button that spends the same cost', async ({ foundryPage: page }) => {
    const { itemId } = await setup(page, { rank: 3, focus: 100, cost: '10 Focus' });

    const r = await evaluateWhenReady(page, async ({ hero, itemId }) => {
      const actor = game.actors.find(a => a.name === hero);
      const item = actor.items.get(itemId);
      await item.roll();
      await new Promise(res => setTimeout(res, 900));

      const card = game.messages.contents.filter(m => !m.rolls?.length).pop();
      const el = document.querySelector(`[data-message-id="${card.id}"]`);
      const button = el?.querySelector('button.mm-activate-power');
      const focusBefore = actor.system.focus.value;
      if (button) button.click();
      await new Promise(res => setTimeout(res, 900));

      return {
        hadButton: !!button,
        focusBefore,
        focusAfter: actor.system.focus.value,
      };
    }, { hero: HERO, itemId });

    expect(r.hadButton).toBe(true);
    expect(r.focusBefore).toBe(100);
    expect(r.focusAfter).toBe(90);
  });
});

/**
 * The prompt shown for a variable cost. Its bounds are computed from the power's
 * cost text and the character's rank, so the label is checked against those live
 * values rather than against a fixed string.
 */
test.describe('Focus spend prompt', () => {
  test.beforeEach(async ({ foundryPage }) => {
    await dismissNotifications(foundryPage);
  });

  test.afterEach(async ({ foundryPage }) => {
    await evaluateWhenReady(foundryPage, () => {
      document.querySelectorAll('.mm-dialog').forEach(d => d.remove());
    });
    await deleteActor(foundryPage, HERO);
  });

  /** Open the prompt and drive its stepper, reporting what the input holds. */
  async function openPromptAndStep(page, itemId, { minusClicks = 0, plusClicks = 0 } = {}) {
    return evaluateWhenReady(page, async ({ hero, itemId, minusClicks, plusClicks }) => {
      const actor = game.actors.find(a => a.name === hero);
      const item = actor.items.get(itemId);

      const sheet = actor.sheet;
      await sheet._render(true);
      await new Promise(r => setTimeout(r, 400));
      const sheetRoot = sheet.element?.[0] ?? sheet.element;
      sheetRoot?.querySelector(`.power-activate[data-item-id="${item.id}"]`)?.click();
      await new Promise(r => setTimeout(r, 700));

      const dialog = document.querySelector('.mm-dialog');
      if (!dialog) { await sheet.close(); return null; }

      const input = dialog.querySelector('input[name="amount"]');
      const label = dialog.querySelector('label');
      const start = Number(input.value);

      for (let i = 0; i < minusClicks; i++) dialog.querySelector('button.minus').click();
      for (let i = 0; i < plusClicks; i++) dialog.querySelector('button.plus').click();

      const out = {
        start,
        value: Number(input.value),
        inputMin: Number(input.min),
        inputMax: Number(input.max),
        labelText: label.textContent.replace(/\s+/g, ' ').trim(),
        boldText: label.querySelector('b')?.textContent ?? null,
        labelCount: dialog.querySelectorAll('.mm-spend-group label').length,
        hasStepper: !!dialog.querySelector('.mm-quantity'),
        // Recomputed from live data, so the expectation cannot drift from it.
        rank: actor.system.attributes.rank.value,
        costText: item.system.cost,
        powerName: item.name,
      };
      dialog.remove();
      await sheet.close();
      return out;
    }, { hero: HERO, itemId, minusClicks, plusClicks });
  }

  test('the stepper starts at the floor and will not go below it', async ({ foundryPage: page }) => {
    const { itemId } = await setup(page, { rank: 3, cost: '5 or more Focus' });
    const r = await openPromptAndStep(page, itemId, { minusClicks: 4 });

    expect(r).not.toBeNull();
    expect(r.hasStepper).toBe(true);
    expect(r.start).toBe(5);
    expect(r.value).toBe(5); // four decrements, still clamped at the floor
  });

  test('the stepper increments and stops at five times rank', async ({ foundryPage: page }) => {
    // Rank 3 caps a single spend at 15, from a floor of 5.
    const { itemId } = await setup(page, { rank: 3, cost: '5 or more Focus' });
    const r = await openPromptAndStep(page, itemId, { plusClicks: 3 });
    expect(r.value).toBe(8);

    const r2 = await openPromptAndStep(page, itemId, { plusClicks: 40 });
    expect(r2.value).toBe(15);
    expect(r2.value).toBe(r2.rank * 5);
  });

  test('the label is one line pairing the bold power name with its live bounds', async ({ foundryPage: page }) => {
    const { itemId } = await setup(page, { rank: 4, cost: '10 or more Focus', name: 'E2E Bound Power' });
    const r = await openPromptAndStep(page, itemId);

    expect(r).not.toBeNull();
    // One label, not a separate name paragraph and instruction.
    expect(r.labelCount).toBe(1);
    expect(r.boldText).toBe(r.powerName);

    // Bounds come from the cost text and the rank, so they are derived here too.
    const floor = Number(r.costText.match(/\d+/)[0]);
    expect(r.labelText).toBe(`${r.powerName} - Focus to spend (min ${floor}, max ${r.rank * 5})`);
    expect(r.inputMin).toBe(floor);
    expect(r.inputMax).toBe(r.rank * 5);
  });
});

/**
 * Dialogs the system opens should look like the system, not like Foundry's
 * default parchment. Only a browser resolves the cascade, and `classes` has to
 * reach the Dialog's *options* argument to apply at all — passing it in the
 * data argument silently does nothing.
 */
test.describe('System dialog styling', () => {
  /** Open a system dialog and report the colours the browser actually resolves. */
  async function readDialogStyles(page) {
    return evaluateWhenReady(page, async () => {
      const d = new Dialog(
        {
          title: 'Style probe',
          content: '<form><p>Body text</p><div class="form-group"><label>A label</label><input type="number" value="5"/></div></form>',
          buttons: { ok: { label: 'OK', callback: () => {} } },
        },
        { classes: ['dialog', 'marvel-multiverse', 'mm-dialog'] }
      );
      d.render(true);
      await new Promise(res => setTimeout(res, 1200));
      const root = document.querySelector('.mm-dialog');
      if (!root) return null;

      const cs = (sel) => { const el = root.querySelector(sel); return el ? getComputedStyle(el) : null; };
      // Sum of the RGB channels: a rough lightness, enough to tell dark text
      // from light without pulling in a colour library.
      const lightness = (css) => (String(css).match(/[0-9]+/g) ?? []).slice(0, 3).reduce((a, b) => a + Number(b), 0);

      const out = {
        rootClass: root.className,
        headerBg: cs('.window-header')?.backgroundColor,
        titleColor: cs('.window-title')?.color,
        bodyBg: cs('.window-content')?.backgroundColor,
        btnBg: cs('button')?.backgroundColor,
        btnColor: cs('button')?.color,
        bodyLightness: lightness(cs('.window-content').backgroundColor),
        textLightness: ['p', 'label', '.window-content'].map((sel) => {
          const el = root.querySelector(sel);
          return el ? lightness(getComputedStyle(el).color) : null;
        }),
      };
      await d.close();
      return out;
    });
  }

  test('a system dialog uses the system palette, not the Foundry default', async ({ foundryPage: page }) => {
    const r = await readDialogStyles(page);
    expect(r).not.toBeNull();
    expect(r.headerBg).toBe('rgb(139, 5, 2)'); // $mm-secondary-red
    expect(r.titleColor).toBe('rgb(255, 255, 255)');
    expect(r.bodyBg).toBe('rgb(255, 242, 236)'); // $mm-input-bg
    expect(r.btnBg).toBe('rgb(228, 29, 24)'); // $mm-primary-red
    expect(r.btnColor).toBe('rgb(255, 255, 255)');

    // Passing `classes` replaces Foundry's defaults rather than adding to them,
    // so the stock "dialog" class has to be listed or other styling drops out.
    expect(r.rootClass).toContain('dialog');
  });

  test('body text is dark against the light dialog background', async ({ foundryPage: page }) => {
    const r = await readDialogStyles(page);
    expect(r).not.toBeNull();
    // The body is near-white, so text anywhere near white would be unreadable.
    expect(r.bodyLightness).toBeGreaterThan(600);
    for (const text of r.textLightness) {
      expect(text).not.toBeNull();
      expect(text).toBeLessThan(200);
    }
  });
});
