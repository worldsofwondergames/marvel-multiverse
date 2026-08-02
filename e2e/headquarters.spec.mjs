import { test, expect } from './fixtures.mjs';
import { evaluateWhenReady, dismissNotifications, deleteActor } from './helpers.mjs';

/**
 * The headquarters DATA MODEL has unit coverage; the SHEET had none. Everything
 * below drives `MarvelMultiverseHeadquartersSheet` directly — member drops, the
 * character/NPC restriction, duplicate rejection, the hqTag/hqTrait allow-list,
 * incompatible-tag rejection, member removal, and the alphabetical ordering the
 * sheet applies before rendering.
 */

const HQ = 'E2E Avengers Mansion';
const HERO = 'E2E HQ Hero';
const SIDEKICK = 'E2E HQ Sidekick';
const GOON = 'E2E HQ Goon';
const VEHICLE = 'E2E HQ Quinjet';

/** Open the HQ sheet and return the live sheet application via its actor. */
async function openHqSheet(page) {
  await evaluateWhenReady(page, async (name) => {
    const actor = game.actors.find(a => a.name === name);
    await actor.sheet._render(true);
  }, HQ);
}

async function closeHqSheet(page) {
  await evaluateWhenReady(page, (name) => {
    const actor = game.actors.find(a => a.name === name);
    actor?.sheet?.close();
  }, HQ);
}

/**
 * Invoke a sheet method the way the UI would, and report any warning Foundry
 * raised, so rejection paths can be told apart from silent no-ops.
 */
async function callOnSheet(page, method, arg) {
  return evaluateWhenReady(page, async ({ name, method, arg }) => {
    const actor = game.actors.find(a => a.name === name);
    const sheet = actor.sheet;
    const warnings = [];
    const original = ui.notifications.warn;
    ui.notifications.warn = (msg) => { warnings.push(String(msg)); return 0; };
    try {
      if (method === '_onDropActor') {
        const dropped = game.actors.find(a => a.name === arg);
        await sheet._onDropActor({ preventDefault() {} }, { type: 'Actor', uuid: dropped.uuid });
      } else if (method === '_onDropItemCreate') {
        await sheet._onDropItemCreate(arg);
      } else if (method === '_onMemberDelete') {
        await sheet._onMemberDelete({ preventDefault() {}, currentTarget: { dataset: { index: String(arg) } } });
      }
    } finally {
      ui.notifications.warn = original;
    }
    return {
      warnings,
      members: foundry.utils.deepClone(actor.system.members),
      itemNames: actor.items.map(i => i.name),
      itemTypes: actor.items.map(i => i.type),
    };
  }, { name: HQ, method, arg });
}

/** What the sheet hands the template, after its own preparation step. */
async function sheetContext(page) {
  return evaluateWhenReady(page, async (name) => {
    const actor = game.actors.find(a => a.name === name);
    const context = await actor.sheet.getData();
    return {
      hqTags: context.hqTags.map(i => i.name),
      hqTraits: context.hqTraits.map(i => i.name),
      members: context.members.map(m => ({ name: m.name, rank: m.rank })),
      traitCount: context.system.traitCount,
      healthMax: context.system.health.max,
      teamRank: context.system.teamRank,
      traitSlots: context.system.traitSlots,
      status: context.system.health.status,
    };
  }, HQ);
}

test.describe('Headquarters sheet', () => {
  test.beforeEach(async ({ foundryPage }) => {
    await dismissNotifications(foundryPage);
    await evaluateWhenReady(foundryPage, async ({ hq, hero, sidekick, goon, vehicle }) => {
      for (const name of [hq, hero, sidekick, goon, vehicle]) {
        const stale = game.actors.filter(a => a.name === name);
        if (stale.length) await Actor.deleteDocuments(stale.map(a => a.id));
      }
      await Actor.create({ name: hq, type: 'headquarters' });
      const h = await Actor.create({ name: hero, type: 'character' });
      await h.update({ 'system.attributes.rank.value': 5 });
      const s = await Actor.create({ name: sidekick, type: 'character' });
      await s.update({ 'system.attributes.rank.value': 3 });
      const g = await Actor.create({ name: goon, type: 'npc' });
      await g.update({ 'system.attributes.rank.value': 1 });
      await Actor.create({ name: vehicle, type: 'vehicle' });
    }, { hq: HQ, hero: HERO, sidekick: SIDEKICK, goon: GOON, vehicle: VEHICLE });
    await openHqSheet(foundryPage);
  });

  test.afterEach(async ({ foundryPage }) => {
    await closeHqSheet(foundryPage);
    for (const name of [HQ, HERO, SIDEKICK, GOON, VEHICLE]) {
      await deleteActor(foundryPage, name);
    }
  });

  test('renders from the headquarters template', async ({ foundryPage }) => {
    const info = await evaluateWhenReady(foundryPage, (name) => {
      const app = Object.values(ui.windows).find(w => w.actor?.name === name);
      return { rendered: !!app, template: app?.template ?? null, html: app?.element?.[0]?.innerHTML?.length ?? 0 };
    }, HQ);
    expect(info.rendered).toBe(true);
    expect(info.template).toContain('actor-headquarters-sheet.hbs');
    expect(info.html).toBeGreaterThan(0);
  });

  test.describe('team members', () => {
    test('dropping a character adds it as a member', async ({ foundryPage }) => {
      const r = await callOnSheet(foundryPage, '_onDropActor', HERO);
      expect(r.warnings).toEqual([]);
      expect(r.members).toHaveLength(1);
      expect(r.members[0].name).toBe(HERO);
    });

    test('dropping an NPC is allowed', async ({ foundryPage }) => {
      const r = await callOnSheet(foundryPage, '_onDropActor', GOON);
      expect(r.warnings).toEqual([]);
      expect(r.members.map(m => m.name)).toEqual([GOON]);
    });

    test('dropping a vehicle is rejected with a warning', async ({ foundryPage }) => {
      const r = await callOnSheet(foundryPage, '_onDropActor', VEHICLE);
      expect(r.members).toHaveLength(0);
      expect(r.warnings.join(' ')).toContain('characters and NPCs');
    });

    test('dropping the same actor twice is rejected, leaving one member', async ({ foundryPage }) => {
      await callOnSheet(foundryPage, '_onDropActor', HERO);
      const r = await callOnSheet(foundryPage, '_onDropActor', HERO);
      expect(r.members).toHaveLength(1);
      expect(r.warnings).toHaveLength(1);
    });

    test('removing a member drops only that entry', async ({ foundryPage }) => {
      await callOnSheet(foundryPage, '_onDropActor', HERO);
      await callOnSheet(foundryPage, '_onDropActor', SIDEKICK);
      const r = await callOnSheet(foundryPage, '_onMemberDelete', 0);
      expect(r.members.map(m => m.name)).toEqual([SIDEKICK]);
    });

    test('member rows resolve the live actor rank', async ({ foundryPage }) => {
      await callOnSheet(foundryPage, '_onDropActor', HERO);
      await callOnSheet(foundryPage, '_onDropActor', SIDEKICK);
      const ctx = await sheetContext(foundryPage);
      expect(ctx.members).toEqual([
        { name: HERO, rank: 5 },
        { name: SIDEKICK, rank: 3 },
      ]);
    });

    test('team rank is the rounded-up mean of member ranks', async ({ foundryPage }) => {
      // Ranks 5 and 3 average to 4 exactly; adding rank 1 gives 3 exactly.
      await callOnSheet(foundryPage, '_onDropActor', HERO);
      await callOnSheet(foundryPage, '_onDropActor', SIDEKICK);
      expect((await sheetContext(foundryPage)).teamRank).toBe(4);

      await callOnSheet(foundryPage, '_onDropActor', GOON);
      const ctx = await sheetContext(foundryPage);
      expect(ctx.teamRank).toBe(3);
      expect(ctx.traitSlots).toBe(9);
    });

    test('deleting a member actor refreshes team rank and trait slots', async ({ foundryPage }) => {
      await callOnSheet(foundryPage, '_onDropActor', HERO);
      await callOnSheet(foundryPage, '_onDropActor', GOON);
      expect((await sheetContext(foundryPage)).teamRank).toBe(3);

      await deleteActor(foundryPage, GOON);

      const ctx = await sheetContext(foundryPage);
      expect(ctx.teamRank).toBe(5);
      expect(ctx.traitSlots).toBe(15);
      // The stored entry survives, falling back to the name captured at drop time.
      expect(ctx.members.map(m => m.name)).toContain(GOON);
    });

    test('changing a member rank refreshes team rank', async ({ foundryPage }) => {
      await callOnSheet(foundryPage, '_onDropActor', HERO);
      await callOnSheet(foundryPage, '_onDropActor', SIDEKICK);
      expect((await sheetContext(foundryPage)).teamRank).toBe(4);

      await evaluateWhenReady(foundryPage, async (name) => {
        await game.actors.find(a => a.name === name).update({ 'system.attributes.rank.value': 1 });
      }, SIDEKICK);

      const ctx = await sheetContext(foundryPage);
      expect(ctx.teamRank).toBe(3);
      expect(ctx.traitSlots).toBe(9);
    });

    test('an unrelated actor changing rank leaves the team rank alone', async ({ foundryPage }) => {
      await callOnSheet(foundryPage, '_onDropActor', HERO);
      expect((await sheetContext(foundryPage)).teamRank).toBe(5);

      await evaluateWhenReady(foundryPage, async (name) => {
        await game.actors.find(a => a.name === name).update({ 'system.attributes.rank.value': 6 });
      }, GOON);

      expect((await sheetContext(foundryPage)).teamRank).toBe(5);
    });
  });

  test.describe('tags and traits', () => {
    test('accepts an hqTrait and recomputes health from the trait count', async ({ foundryPage }) => {
      const r = await callOnSheet(foundryPage, '_onDropItemCreate', {
        name: 'Infirmary', type: 'hqTrait', system: { description: 'Heals the team.' },
      });
      expect(r.warnings).toEqual([]);
      expect(r.itemTypes).toEqual(['hqTrait']);

      const ctx = await sheetContext(foundryPage);
      expect(ctx.traitCount).toBe(1);
      expect(ctx.healthMax).toBe(2);
    });

    test('health max tracks each additional trait', async ({ foundryPage }) => {
      for (const name of ['Infirmary', 'Hangar', 'Vault']) {
        await callOnSheet(foundryPage, '_onDropItemCreate', { name, type: 'hqTrait', system: {} });
      }
      const ctx = await sheetContext(foundryPage);
      expect(ctx.traitCount).toBe(3);
      expect(ctx.healthMax).toBe(6);
    });

    test('rejects an item type the headquarters cannot hold', async ({ foundryPage }) => {
      const r = await callOnSheet(foundryPage, '_onDropItemCreate', {
        name: 'Web-Shooters', type: 'weapon', system: {},
      });
      expect(r.itemNames).toEqual([]);
      expect(r.warnings.join(' ')).toContain('cannot hold');
    });

    test('rejects a tag the existing tags declare incompatible', async ({ foundryPage }) => {
      await callOnSheet(foundryPage, '_onDropItemCreate', {
        name: 'Secret', type: 'hqTag', system: { incompatible: 'Public' },
      });
      const r = await callOnSheet(foundryPage, '_onDropItemCreate', {
        name: 'Public', type: 'hqTag', system: { incompatible: '' },
      });
      expect(r.itemNames).toEqual(['Secret']);
      expect(r.warnings).toHaveLength(1);
    });

    test('rejects a tag that declares the existing tag incompatible', async ({ foundryPage }) => {
      // The check runs in both directions, so order of arrival must not matter.
      await callOnSheet(foundryPage, '_onDropItemCreate', {
        name: 'Public', type: 'hqTag', system: { incompatible: '' },
      });
      const r = await callOnSheet(foundryPage, '_onDropItemCreate', {
        name: 'Secret', type: 'hqTag', system: { incompatible: 'Public' },
      });
      expect(r.itemNames).toEqual(['Public']);
      expect(r.warnings).toHaveLength(1);
    });

    test('accepts a tag whose incompatible list names something absent', async ({ foundryPage }) => {
      await callOnSheet(foundryPage, '_onDropItemCreate', {
        name: 'Mobile', type: 'hqTag', system: { incompatible: 'Subterranean' },
      });
      const r = await callOnSheet(foundryPage, '_onDropItemCreate', {
        name: 'Orbital', type: 'hqTag', system: { incompatible: '' },
      });
      expect(r.warnings).toEqual([]);
      expect(r.itemNames.sort()).toEqual(['Mobile', 'Orbital']);
    });

    test('the incompatible list is comma-separated, not one whole string', async ({ foundryPage }) => {
      await callOnSheet(foundryPage, '_onDropItemCreate', {
        name: 'Fortified', type: 'hqTag', system: { incompatible: 'Fragile, Exposed' },
      });
      const r = await callOnSheet(foundryPage, '_onDropItemCreate', {
        name: 'Exposed', type: 'hqTag', system: { incompatible: '' },
      });
      expect(r.itemNames).toEqual(['Fortified']);
      expect(r.warnings).toHaveLength(1);
    });

    test('sorts tags and traits alphabetically for the template', async ({ foundryPage }) => {
      for (const name of ['Zeta Wing', 'Armoury', 'Medbay']) {
        await callOnSheet(foundryPage, '_onDropItemCreate', { name, type: 'hqTrait', system: {} });
      }
      for (const name of ['Wired', 'Anchored']) {
        await callOnSheet(foundryPage, '_onDropItemCreate', { name, type: 'hqTag', system: { incompatible: '' } });
      }
      const ctx = await sheetContext(foundryPage);
      expect(ctx.hqTraits).toEqual(['Armoury', 'Medbay', 'Zeta Wing']);
      expect(ctx.hqTags).toEqual(['Anchored', 'Wired']);
    });
  });

  test.describe('health status', () => {
    async function setHealth(page, value) {
      await evaluateWhenReady(page, async ({ name, value }) => {
        const actor = game.actors.find(a => a.name === name);
        await actor.update({ 'system.health.value': value });
      }, { name: HQ, value });
    }

    test('operational above half health', async ({ foundryPage }) => {
      for (const name of ['A', 'B', 'C']) {
        await callOnSheet(foundryPage, '_onDropItemCreate', { name, type: 'hqTrait', system: {} });
      }
      await setHealth(foundryPage, 5); // max 6
      expect((await sheetContext(foundryPage)).status).toBe('operational');
    });

    test('damaged at exactly half health', async ({ foundryPage }) => {
      for (const name of ['A', 'B', 'C']) {
        await callOnSheet(foundryPage, '_onDropItemCreate', { name, type: 'hqTrait', system: {} });
      }
      await setHealth(foundryPage, 3); // max 6
      expect((await sheetContext(foundryPage)).status).toBe('damaged');
    });

    test('destroyed at zero health', async ({ foundryPage }) => {
      await callOnSheet(foundryPage, '_onDropItemCreate', { name: 'A', type: 'hqTrait', system: {} });
      await setHealth(foundryPage, 0);
      expect((await sheetContext(foundryPage)).status).toBe('destroyed');
    });

    test('a trait-less headquarters is operational, not destroyed', async ({ foundryPage }) => {
      // max is 0 here, and the guards require max > 0 before reporting damage.
      await setHealth(foundryPage, 0);
      const ctx = await sheetContext(foundryPage);
      expect(ctx.healthMax).toBe(0);
      expect(ctx.status).toBe('operational');
    });
  });
});
