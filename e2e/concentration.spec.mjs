import { test, expect } from './fixtures.mjs';
import { evaluateWhenReady, dismissNotifications, deleteActor } from './helpers.mjs';

/**
 * Issue #126 — tracking which powers a character is concentrating on.
 *
 * The rank limit, the ban on concentrating twice on one power, and the
 * conditions that break it all come from the core rulebook's "Breaking
 * Concentration". Maintaining a concentration is free unless the power states a
 * recurring cost, which only 7 of the 125 concentration powers do.
 */
const HERO = 'E2E Concentration Hero';

/** Build a character at a chosen rank with a set of powers. */
async function setup(page, { rank = 3, focus = 100, powers = [] } = {}) {
  return evaluateWhenReady(page, async ({ hero, rank, focus, powers }) => {
    const stale = game.actors.filter(a => a.name === hero);
    if (stale.length) await Actor.deleteDocuments(stale.map(a => a.id));
    const actor = await Actor.create({ name: hero, type: 'character' });
    await actor.update({
      'system.attributes.rank.value': rank,
      'system.focus.value': focus,
    });
    const created = await actor.createEmbeddedDocuments('Item', powers.map(p => ({
      name: p.name,
      type: 'power',
      system: { cost: p.cost, duration: p.duration },
    })));
    return {
      ids: Object.fromEntries(created.map(i => [i.name, i.id])),
      concentrating: [...(actor.system.concentrating ?? [])],
    };
  }, { hero: HERO, rank, focus, powers });
}

/** Activate a power through the sheet control and report the result. */
async function activate(page, itemId) {
  return evaluateWhenReady(page, async ({ hero, itemId }) => {
    const actor = game.actors.find(a => a.name === hero);
    const sheet = actor.sheet;
    await sheet._render(true);
    await new Promise(r => setTimeout(r, 400));
    const root = sheet.element?.[0] ?? sheet.element;
    root?.querySelector(`.power-activate[data-item-id="${itemId}"]`)?.click();
    await new Promise(r => setTimeout(r, 700));

    // A cost that is not a flat number opens the spend prompt first. Accept the
    // prefilled amount so the activation completes.
    const prompt = document.querySelector('.mm-dialog');
    if (prompt) {
      prompt.querySelector('.dialog-buttons button')?.click();
      await new Promise(r => setTimeout(r, 700));
      document.querySelectorAll('.mm-dialog').forEach(d => d.remove());
    }

    const out = {
      concentrating: [...(actor.system.concentrating ?? [])],
      focus: actor.system.focus.value,
      hasEndControl: !!root?.querySelector(`.power-end-concentration[data-item-id="${itemId}"]`),
    };
    await sheet.close();
    return out;
  }, { hero: HERO, itemId });
}

test.describe('Concentration', () => {
  test.beforeEach(async ({ foundryPage }) => {
    await dismissNotifications(foundryPage);
  });

  test.afterEach(async ({ foundryPage }) => {
    await evaluateWhenReady(foundryPage, () => {
      document.querySelectorAll('.mm-dialog').forEach(d => d.remove());
    });
    await deleteActor(foundryPage, HERO);
  });

  test('activating a Concentration power records it', async ({ foundryPage: page }) => {
    const { ids } = await setup(page, {
      powers: [{ name: 'Hold It', cost: '5 Focus', duration: 'Concentration' }],
    });
    const r = await activate(page, ids['Hold It']);

    expect(r.concentrating).toEqual([ids['Hold It']]);
    expect(r.focus).toBe(95);
  });

  test('activating a non-Concentration power records nothing', async ({ foundryPage: page }) => {
    const { ids } = await setup(page, {
      powers: [{ name: 'Quick Hit', cost: '5 Focus', duration: 'Instant' }],
    });
    const r = await activate(page, ids['Quick Hit']);

    // Focus still moved, so the activation ran and the empty list is a result.
    expect(r.focus).toBe(95);
    expect(r.concentrating).toEqual([]);
  });

  test('the rank limit refuses a further power and spends nothing', async ({ foundryPage: page }) => {
    const { ids } = await setup(page, {
      rank: 2,
      powers: [
        { name: 'One', cost: '5 Focus', duration: 'Concentration' },
        { name: 'Two', cost: '5 Focus', duration: 'Concentration' },
        { name: 'Three', cost: '5 Focus', duration: 'Concentration' },
      ],
    });
    await activate(page, ids.One);
    const second = await activate(page, ids.Two);
    expect(second.concentrating).toHaveLength(2);
    expect(second.focus).toBe(90);

    // Rank 2 allows two. The third is refused, and its cost is not taken.
    const third = await activate(page, ids.Three);
    expect(third.concentrating).toHaveLength(2);
    expect(third.concentrating).not.toContain(ids.Three);
    expect(third.focus).toBe(90);
  });

  test('the same power cannot be concentrated on twice', async ({ foundryPage: page }) => {
    const { ids } = await setup(page, {
      rank: 4,
      powers: [{ name: 'Hold It', cost: '5 Focus', duration: 'Concentration' }],
    });
    const first = await activate(page, ids['Hold It']);
    expect(first.concentrating).toEqual([ids['Hold It']]);
    expect(first.focus).toBe(95);

    const again = await activate(page, ids['Hold It']);
    expect(again.concentrating).toEqual([ids['Hold It']]);
    expect(again.focus).toBe(95); // refused, so nothing further was spent
  });

  test('the end control appears only while concentrating, and frees a slot', async ({ foundryPage: page }) => {
    const { ids } = await setup(page, {
      rank: 1,
      powers: [
        { name: 'Hold It', cost: '5 Focus', duration: 'Concentration' },
        { name: 'Other', cost: '5 Focus', duration: 'Concentration' },
      ],
    });

    const before = await evaluateWhenReady(page, async ({ hero, itemId }) => {
      const actor = game.actors.find(a => a.name === hero);
      await actor.sheet._render(true);
      await new Promise(r => setTimeout(r, 400));
      const root = actor.sheet.element?.[0] ?? actor.sheet.element;
      const out = {
        activate: !!root.querySelector(`.power-activate[data-item-id="${itemId}"]`),
        end: !!root.querySelector(`.power-end-concentration[data-item-id="${itemId}"]`),
      };
      await actor.sheet.close();
      return out;
    }, { hero: HERO, itemId: ids['Hold It'] });
    // The activate control proves the row rendered, so the absent end control
    // is a real result rather than a row that failed to appear.
    expect(before.activate).toBe(true);
    expect(before.end).toBe(false);

    const started = await activate(page, ids['Hold It']);
    expect(started.hasEndControl).toBe(true);

    // Rank 1, so the second power is refused while the first is held.
    const blocked = await activate(page, ids.Other);
    expect(blocked.concentrating).toEqual([ids['Hold It']]);

    const ended = await evaluateWhenReady(page, async ({ hero, itemId }) => {
      const actor = game.actors.find(a => a.name === hero);
      await actor.sheet._render(true);
      await new Promise(r => setTimeout(r, 400));
      const root = actor.sheet.element?.[0] ?? actor.sheet.element;
      root.querySelector(`.power-end-concentration[data-item-id="${itemId}"]`)?.click();
      await new Promise(r => setTimeout(r, 600));
      await actor.sheet.close();
      return [...(actor.system.concentrating ?? [])];
    }, { hero: HERO, itemId: ids['Hold It'] });
    expect(ended).toEqual([]);

    // The slot is free again.
    const after = await activate(page, ids.Other);
    expect(after.concentrating).toEqual([ids.Other]);
  });

  test('a breaking condition ends every concentration held', async ({ foundryPage: page }) => {
    const { ids } = await setup(page, {
      rank: 3,
      powers: [
        { name: 'One', cost: '5 Focus', duration: 'Concentration' },
        { name: 'Two', cost: '5 Focus', duration: 'Concentration' },
      ],
    });
    await activate(page, ids.One);
    const held = await activate(page, ids.Two);
    expect(held.concentrating).toHaveLength(2);

    const after = await evaluateWhenReady(page, async ({ hero }) => {
      const actor = game.actors.find(a => a.name === hero);
      await actor.toggleStatusEffect('stunned', { active: true });
      await new Promise(r => setTimeout(r, 800));
      const out = [...(actor.system.concentrating ?? [])];
      await actor.toggleStatusEffect('stunned', { active: false });
      return out;
    }, { hero: HERO });

    expect(after).toEqual([]);
  });

  test('a condition that does not break concentration leaves it alone', async ({ foundryPage: page }) => {
    const { ids } = await setup(page, {
      rank: 3,
      powers: [{ name: 'One', cost: '5 Focus', duration: 'Concentration' }],
    });
    await activate(page, ids.One);

    const after = await evaluateWhenReady(page, async ({ hero }) => {
      const actor = game.actors.find(a => a.name === hero);
      // Blinded breaks concentration only for powers needing line of sight,
      // which the data does not record, so it is deliberately not automated.
      await actor.toggleStatusEffect('blinded', { active: true });
      await new Promise(r => setTimeout(r, 800));
      const out = [...(actor.system.concentrating ?? [])];
      await actor.toggleStatusEffect('blinded', { active: false });
      return out;
    }, { hero: HERO });

    expect(after).toEqual([ids.One]);
  });
});

/**
 * Upkeep for the 7 concentration powers that charge every turn or round. The
 * other 118 are free to maintain and must never prompt.
 */
test.describe('Concentration upkeep', () => {
  test.beforeEach(async ({ foundryPage }) => {
    await dismissNotifications(foundryPage);
  });

  test.afterEach(async ({ foundryPage }) => {
    await evaluateWhenReady(foundryPage, async () => {
      document.querySelectorAll('.mm-dialog').forEach(d => d.remove());
      if (game.combat) await game.combat.delete();
    });
    await deleteActor(foundryPage, HERO);
  });

  /** Put the actor in combat and advance to its turn, returning the dialog state. */
  async function takeTurn(page, { answer = null } = {}) {
    return evaluateWhenReady(page, async ({ hero, answer }) => {
      const actor = game.actors.find(a => a.name === hero);
      if (game.combat) await game.combat.delete();
      const combat = await Combat.create({});
      await combat.createEmbeddedDocuments('Combatant', [{ actorId: actor.id, hidden: false }]);
      await combat.startCombat();
      await new Promise(r => setTimeout(r, 1200));

      const dialog = document.querySelector('.mm-dialog');
      const label = dialog?.querySelector('label')?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
      const buttons = dialog
        ? [...dialog.querySelectorAll('.dialog-buttons button')].map(b => b.textContent.trim())
        : [];

      if (dialog && answer) {
        const wanted = answer === 'keep' ? 0 : 1;
        dialog.querySelectorAll('.dialog-buttons button')[wanted]?.click();
        await new Promise(r => setTimeout(r, 800));
      }
      document.querySelectorAll('.mm-dialog').forEach(d => d.remove());
      await combat.delete();
      return {
        prompted: !!dialog,
        label,
        buttons,
        focus: actor.system.focus.value,
        concentrating: [...(actor.system.concentrating ?? [])],
      };
    }, { hero: HERO, answer });
  }

  test('a recurring cost prompts at the start of the turn', async ({ foundryPage: page }) => {
    const { ids } = await setup(page, {
      powers: [{ name: 'Lucky Me', cost: '5 Focus per turn', duration: 'Concentration' }],
    });
    await activate(page, ids['Lucky Me']);

    const r = await takeTurn(page);
    expect(r.prompted).toBe(true);
    expect(r.label).toContain('Lucky Me');
    expect(r.label).toContain('per turn');
  });

  test('choosing to maintain spends the cost again and keeps it held', async ({ foundryPage: page }) => {
    const { ids } = await setup(page, {
      focus: 100,
      powers: [{ name: 'Lucky Me', cost: '5 Focus per turn', duration: 'Concentration' }],
    });
    const started = await activate(page, ids['Lucky Me']);
    expect(started.focus).toBe(95); // the activation itself

    const r = await takeTurn(page, { answer: 'keep' });
    expect(r.focus).toBe(90); // one turn's upkeep on top
    expect(r.concentrating).toEqual([ids['Lucky Me']]);
  });

  test('declining ends that concentration and spends nothing', async ({ foundryPage: page }) => {
    const { ids } = await setup(page, {
      focus: 100,
      powers: [{ name: 'Lucky Me', cost: '5 Focus per turn', duration: 'Concentration' }],
    });
    await activate(page, ids['Lucky Me']);

    const r = await takeTurn(page, { answer: 'drop' });
    expect(r.focus).toBe(95); // unchanged from the activation
    expect(r.concentrating).toEqual([]);
  });

  test('a flat-cost concentration is free to maintain and never prompts', async ({ foundryPage: page }) => {
    const { ids } = await setup(page, {
      focus: 100,
      powers: [{ name: 'Steady', cost: '10 Focus', duration: 'Concentration' }],
    });
    const started = await activate(page, ids.Steady);
    expect(started.concentrating).toEqual([ids.Steady]);

    const r = await takeTurn(page);
    expect(r.prompted).toBe(false);
    // Still held and still paid for once, so the absent prompt is a real result.
    expect(r.concentrating).toEqual([ids.Steady]);
    expect(r.focus).toBe(90);
  });
});

/**
 * The token HUD marker, and what ending an encounter does. The marker reflects
 * "holding at least one power", so it appears with the first and clears with
 * the last, and clearing it by hand drops everything.
 */
test.describe('Concentration marker', () => {
  test.beforeEach(async ({ foundryPage }) => {
    await dismissNotifications(foundryPage);
  });

  test.afterEach(async ({ foundryPage }) => {
    await evaluateWhenReady(foundryPage, async () => {
      document.querySelectorAll('.mm-dialog').forEach(d => d.remove());
      if (game.combat) await game.combat.delete();
    });
    await deleteActor(foundryPage, HERO);
  });

  const statuses = (page) => evaluateWhenReady(page, ({ hero }) => {
    const actor = game.actors.find(a => a.name === hero);
    return {
      marker: actor.statuses.has('concentrating'),
      concentrating: [...(actor.system.concentrating ?? [])],
    };
  }, { hero: HERO });

  test('the marker is applied with the first power and cleared with the last', async ({ foundryPage: page }) => {
    const { ids } = await setup(page, {
      rank: 3,
      powers: [
        { name: 'One', cost: '5 Focus', duration: 'Concentration' },
        { name: 'Two', cost: '5 Focus', duration: 'Concentration' },
      ],
    });

    const before = await statuses(page);
    expect(before.concentrating).toEqual([]);
    expect(before.marker).toBe(false);

    await activate(page, ids.One);
    const one = await statuses(page);
    expect(one.marker).toBe(true);

    await activate(page, ids.Two);
    const two = await statuses(page);
    // Still one marker for two held powers.
    expect(two.concentrating).toHaveLength(2);
    expect(two.marker).toBe(true);

    // Ending only the first leaves the marker, because one is still held.
    await evaluateWhenReady(page, async ({ hero, itemId }) => {
      const actor = game.actors.find(a => a.name === hero);
      await actor.sheet._render(true);
      await new Promise(r => setTimeout(r, 400));
      const root = actor.sheet.element?.[0] ?? actor.sheet.element;
      root.querySelector(`.power-end-concentration[data-item-id="${itemId}"]`)?.click();
      await new Promise(r => setTimeout(r, 600));
      await actor.sheet.close();
    }, { hero: HERO, itemId: ids.One });
    const partial = await statuses(page);
    expect(partial.concentrating).toEqual([ids.Two]);
    expect(partial.marker).toBe(true);

    // Ending the last one clears it.
    await evaluateWhenReady(page, async ({ hero, itemId }) => {
      const actor = game.actors.find(a => a.name === hero);
      await actor.sheet._render(true);
      await new Promise(r => setTimeout(r, 400));
      const root = actor.sheet.element?.[0] ?? actor.sheet.element;
      root.querySelector(`.power-end-concentration[data-item-id="${itemId}"]`)?.click();
      await new Promise(r => setTimeout(r, 600));
      await actor.sheet.close();
    }, { hero: HERO, itemId: ids.Two });
    const cleared = await statuses(page);
    expect(cleared.concentrating).toEqual([]);
    expect(cleared.marker).toBe(false);
  });

  test('clearing the marker by hand ends every power held', async ({ foundryPage: page }) => {
    const { ids } = await setup(page, {
      rank: 3,
      powers: [
        { name: 'One', cost: '5 Focus', duration: 'Concentration' },
        { name: 'Two', cost: '5 Focus', duration: 'Concentration' },
      ],
    });
    await activate(page, ids.One);
    await activate(page, ids.Two);
    const held = await statuses(page);
    expect(held.concentrating).toHaveLength(2);
    expect(held.marker).toBe(true);

    await evaluateWhenReady(page, async ({ hero }) => {
      const actor = game.actors.find(a => a.name === hero);
      await actor.toggleStatusEffect('concentrating', { active: false });
      await new Promise(r => setTimeout(r, 900));
    }, { hero: HERO });

    const after = await statuses(page);
    expect(after.concentrating).toEqual([]);
    expect(after.marker).toBe(false);
  });

  test('ending the encounter ends concentration', async ({ foundryPage: page }) => {
    const { ids } = await setup(page, {
      rank: 3,
      powers: [{ name: 'One', cost: '5 Focus', duration: 'Concentration' }],
    });
    await activate(page, ids.One);

    const after = await evaluateWhenReady(page, async ({ hero }) => {
      const actor = game.actors.find(a => a.name === hero);
      const combat = await Combat.create({});
      await combat.createEmbeddedDocuments('Combatant', [{ actorId: actor.id, hidden: false }]);
      await combat.startCombat();
      await new Promise(r => setTimeout(r, 700));
      const during = [...(actor.system.concentrating ?? [])];

      await combat.delete();
      await new Promise(r => setTimeout(r, 900));
      return {
        during,
        after: [...(actor.system.concentrating ?? [])],
        marker: actor.statuses.has('concentrating'),
      };
    }, { hero: HERO });

    // Held while the encounter ran, so the empty list afterwards is a result.
    expect(after.during).toEqual([ids.One]);
    expect(after.after).toEqual([]);
    expect(after.marker).toBe(false);
  });
});
