import { test, expect } from './fixtures.mjs';
import { evaluateWhenReady, dismissNotifications, deleteActor } from './helpers.mjs';

/**
 * Issue #116 — a power's Action, Trigger, Duration and Cost were stored on the
 * item but never reached the chat card. Each line must appear when the field
 * has a value and be omitted entirely when it does not, which is conditional
 * display and only observable by actually rolling the power.
 */
const HERO = 'E2E Chat Meta Hero';

/** Roll one power on the actor and return the resulting chat card HTML. */
async function rollPowerAndReadCard(page, powerData) {
  return evaluateWhenReady(page, async ({ name, power }) => {
    const actor = game.actors.find(a => a.name === name);
    const before = new Set(game.messages.contents.map(m => m.id));

    const [item] = await actor.createEmbeddedDocuments('Item', [
      { name: 'E2E Probe Power', type: 'power', system: power },
    ]);
    await item.roll();
    await new Promise(r => setTimeout(r, 400));

    const created = game.messages.contents.filter(m => !before.has(m.id));
    const card = created.find(m => !m.rolls?.length);
    const roll = created.find(m => m.rolls?.length);
    await item.delete();
    // The four meta lines are part of the card's flavor text, above the
    // ability row. The roll message reuses the same flavor without them.
    return card
      ? { flavor: card.flavor, content: card.content, rollFlavor: roll?.flavor ?? null }
      : null;
  }, { name: HERO, power: powerData });
}

/** Which of the four meta rows a chunk of HTML carries, in render order. */
const metaRows = (html) => [...String(html ?? '').matchAll(/data-meta="([a-z]+)"/g)].map(m => m[1]);

test.describe('Power chat card meta lines', () => {
  test.beforeEach(async ({ foundryPage }) => {
    await dismissNotifications(foundryPage);
    await evaluateWhenReady(foundryPage, async (name) => {
      const stale = game.actors.filter(a => a.name === name);
      if (stale.length) await Actor.deleteDocuments(stale.map(a => a.id));
      await Actor.create({ name, type: 'character' });
    }, HERO);
  });

  test.afterEach(async ({ foundryPage }) => {
    await deleteActor(foundryPage, HERO);
  });

  test('shows all four lines when the power sets all four', async ({ foundryPage: page }) => {
    const card = await rollPowerAndReadCard(page, {
      description: '<p>Probe description.</p>',
      action: 'Standard',
      trigger: 'On a hit',
      duration: '1 round',
      cost: '10 Focus',
    });
    expect(card).not.toBeNull();
    expect(metaRows(card.flavor)).toEqual(['action', 'trigger', 'duration', 'cost']);
    for (const value of ['Standard', 'On a hit', '1 round', '10 Focus']) {
      expect(card.flavor).toContain(value);
    }
  });

  test('omits every line when the power sets none of them', async ({ foundryPage: page }) => {
    const card = await rollPowerAndReadCard(page, {
      description: '<p>Probe description.</p>',
    });
    expect(card).not.toBeNull();
    // The description proves the card rendered, so an empty meta list is a real
    // result rather than a card that failed to appear.
    expect(card.content).toContain('Probe description.');
    expect(metaRows(card.flavor)).toEqual([]);
  });

  test('shows only the fields that have values', async ({ foundryPage: page }) => {
    const card = await rollPowerAndReadCard(page, {
      description: '<p>Probe description.</p>',
      cost: '5 Focus',
    });
    expect(card).not.toBeNull();
    expect(metaRows(card.flavor)).toEqual(['cost']);
    expect(card.flavor).toContain('5 Focus');
  });

  test('an emptied description leaves no empty element behind', async ({ foundryPage: page }) => {
    const card = await rollPowerAndReadCard(page, {
      description: '<p></p>',
      cost: '5 Focus',
    });
    expect(card).not.toBeNull();
    // Cost proves the card rendered; the description block must be absent.
    expect(metaRows(card.flavor)).toEqual(['cost']);
    expect(card.content).not.toContain('mm-chat-description');
  });

  test('the roll message does not repeat the meta block', async ({ foundryPage: page }) => {
    const card = await rollPowerAndReadCard(page, {
      description: '<p>Probe description.</p>',
      formula: '{1d6,1dm,1d6}',
      ability: 'mle',
      cost: '5 Focus',
    });
    expect(card).not.toBeNull();
    expect(card.rollFlavor).not.toBeNull();
    // The roll's flavor carries the power name, so an empty meta list here is a
    // real result rather than a flavor that failed to build.
    expect(card.rollFlavor).toContain('mm-roll-power-name');
    expect(metaRows(card.rollFlavor)).toEqual([]);
  });
});

test.describe('Power chat card layout', () => {
  test.beforeEach(async ({ foundryPage }) => {
    await dismissNotifications(foundryPage);
    await evaluateWhenReady(foundryPage, async (name) => {
      const stale = game.actors.filter(a => a.name === name);
      if (stale.length) await Actor.deleteDocuments(stale.map(a => a.id));
      await Actor.create({ name, type: 'character' });
    }, HERO);
  });

  test.afterEach(async ({ foundryPage }) => {
    await deleteActor(foundryPage, HERO);
  });

  /** Render a fully-populated power and measure the rendered card. */
  async function measureCard(page) {
    return evaluateWhenReady(page, async (name) => {
      const actor = game.actors.find(a => a.name === name);
      const [item] = await actor.createEmbeddedDocuments('Item', [{
        name: 'E2E Layout Power',
        type: 'power',
        system: {
          ability: 'mle',
          description: '<p>Flavour sentence.</p>',
          effect: '<p>Mechanical effect.</p>',
          action: 'Reaction',
          trigger: 'The character makes an attack.',
          duration: 'Instant',
          cost: '5 Focus',
        },
      }]);
      const before = new Set(game.messages.contents.map(m => m.id));
      await item.roll();
      await new Promise(r => setTimeout(r, 1200));

      const card = game.messages.contents.filter(m => !before.has(m.id)).find(m => !m.rolls?.length);
      const li = card ? document.querySelector(`[data-message-id="${card.id}"]`) : null;
      if (!li) { await item.delete(); return null; }

      const rows = [...li.querySelectorAll('.mm-chat-meta-row')];
      const meta = li.querySelector('.mm-chat-meta');
      const desc = li.querySelector('.mm-chat-description');
      const eff = li.querySelector('.mm-chat-effect');
      const powerLine = li.querySelector('.mm-roll-flavor div div');
      // Order of the flavor's direct children identifies what sits where.
      const flavorOrder = [...li.querySelectorAll('.mm-roll-flavor > div > div')]
        .map(d => d.className || 'power-line');

      // The ability row sits between the meta block and the description, so the
      // gap that meets the description is measured from whatever the flavor's
      // last row is, not from the meta block itself.
      const flavorRows = [...li.querySelectorAll('.mm-roll-flavor > div > div')];
      const lastFlavorRow = flavorRows[flavorRows.length - 1];

      const nameEl = li.querySelector('.mm-roll-power-name');
      const abilityRow = flavorRows[flavorRows.length - 1];
      const left = (el) => Math.round(el.getBoundingClientRect().left);

      const result = {
        rowCount: rows.length,
        flavorOrder,
        powerFontSize: getComputedStyle(powerLine).fontSize,
        rowFontSizes: [...new Set(rows.map(r => getComputedStyle(r).fontSize))],
        metaBottom: Math.round(meta.getBoundingClientRect().bottom),
        headerToDescription: Math.round(desc.getBoundingClientRect().top - lastFlavorRow.getBoundingClientRect().bottom),
        descriptionToEffect: Math.round(eff.getBoundingClientRect().top - desc.getBoundingClientRect().bottom),
        // Every line on the card should share one left edge.
        leftEdges: [nameEl, rows[0], abilityRow, desc, eff].map(left),
        nameStyle: {
          color: getComputedStyle(nameEl).color,
          weight: getComputedStyle(nameEl).fontWeight,
          transform: getComputedStyle(nameEl).textTransform,
          text: nameEl.textContent,
        },
        effectFontStyle: getComputedStyle(eff).fontStyle,
        descriptionFontStyle: getComputedStyle(desc).fontStyle,
      };
      await item.delete();
      return result;
    }, HERO);
  }

  test('the meta block sits between the power name and the ability row', async ({ foundryPage: page }) => {
    const m = await measureCard(page);
    expect(m).not.toBeNull();
    expect(m.rowCount).toBe(4);
    // The name, then the meta block, then the ability/type/element row.
    expect(m.flavorOrder[0]).toBe('mm-roll-power-name');
    expect(m.flavorOrder[1]).toBe('mm-chat-meta');
  });

  test('every meta row matches the power line font size', async ({ foundryPage: page }) => {
    const m = await measureCard(page);
    expect(m).not.toBeNull();
    // One distinct size across all four rows, equal to the line above them.
    expect(m.rowFontSizes).toEqual([m.powerFontSize]);
  });

  test('the gap below the header block equals the description-to-effect gap', async ({ foundryPage: page }) => {
    const m = await measureCard(page);
    expect(m).not.toBeNull();
    expect(m.descriptionToEffect).toBeGreaterThan(0);
    expect(m.headerToDescription).toBe(m.descriptionToEffect);
  });

  test('every line shares one left edge', async ({ foundryPage: page }) => {
    const m = await measureCard(page);
    expect(m).not.toBeNull();
    // name, meta row, ability row, description, effect
    expect(m.leftEdges).toHaveLength(5);
    expect(m.leftEdges).toEqual(m.leftEdges.map(() => m.leftEdges[0]));
  });

  test('the power name is bold, deep red and uppercased', async ({ foundryPage: page }) => {
    const m = await measureCard(page);
    expect(m).not.toBeNull();
    expect(m.nameStyle.color).toBe('rgb(139, 5, 2)'); // $mm-secondary-red
    expect(Number(m.nameStyle.weight)).toBeGreaterThanOrEqual(700);
    expect(m.nameStyle.transform).toBe('uppercase');
    // Uppercasing is presentational, so the underlying text keeps its casing
    // and carries no "Power:" label.
    expect(m.nameStyle.text).toBe('E2E Layout Power');
  });

  test('the effect is italic and the description is not', async ({ foundryPage: page }) => {
    const m = await measureCard(page);
    expect(m).not.toBeNull();
    expect(m.effectFontStyle).toBe('italic');
    expect(m.descriptionFontStyle).toBe('normal');
  });
});
