import { test, expect } from './fixtures.mjs';
import {
  createActorViaAPI,
  updateActorData,
  getActorSystemData,
  deleteActor,
} from './helpers.mjs';

const ACTOR_NAME = 'E2E NPC Test';

test.describe('NPC Actor Calculations', () => {

  test.afterEach(async ({ foundryPage }) => {
    await deleteActor(foundryPage, ACTOR_NAME);
  });

  test('NPC defense = ability + 10', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME, 'npc');
    await updateActorData(page, ACTOR_NAME, {
      'system.abilities.mle.value': 4,
      'system.abilities.agl.value': 6,
      'system.abilities.res.value': 2,
      'system.abilities.vig.value': 3,
      'system.abilities.ego.value': 1,
      'system.abilities.log.value': 5,
    });

    const sys = await getActorSystemData(page, ACTOR_NAME);
    expect(sys.abilities.mle.defense).toBe(14);
    expect(sys.abilities.agl.defense).toBe(16);
    expect(sys.abilities.res.defense).toBe(12);
    expect(sys.abilities.vig.defense).toBe(13);
    expect(sys.abilities.ego.defense).toBe(11);
    expect(sys.abilities.log.defense).toBe(15);
  });

  test('NPC damage multiplier = rank', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME, 'npc');
    await updateActorData(page, ACTOR_NAME, {
      'system.attributes.rank.value': 5,
    });

    const sys = await getActorSystemData(page, ACTOR_NAME);
    for (const key of ['mle', 'agl', 'res', 'vig', 'ego', 'log']) {
      expect(sys.abilities[key].damageMultiplier, `${key} DM`).toBe(5);
    }
  });

  test('NPC movement: climb/swim/jump = ceil(run/2)', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME, 'npc');

    const sys = await getActorSystemData(page, ACTOR_NAME);
    const expectedHalf = Math.ceil(sys.movement.run.value / 2);
    expect(sys.movement.climb.value).toBe(expectedHalf);
    expect(sys.movement.swim.value).toBe(expectedHalf);
    expect(sys.movement.jump.value).toBe(expectedHalf);
  });

  test('NPC initiative = Vigilance', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME, 'npc');
    await updateActorData(page, ACTOR_NAME, {
      'system.abilities.vig.value': 5,
    });

    const sys = await getActorSystemData(page, ACTOR_NAME);
    expect(sys.attributes.init.value).toBe(5);
  });

  // Regression guard for #92: the NPC sheet's getData() read
  // context.system.teamManeuver, which only exists on the character data model,
  // so opening any NPC sheet threw and rendered nothing. Every other NPC test
  // here goes through the API and never renders, which is how an entire actor
  // type stayed broken without a red test.
  test('NPC sheet renders without throwing', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME, 'npc');

    const result = await page.evaluate(async (name) => {
      const actor = game.actors.find(a => a.name === name);
      if (!actor) return { error: `Actor "${name}" not found`, rendered: false };

      // ApplicationV1 swallows render errors through Hooks.onError, so a
      // try/catch alone can report success while nothing reached the DOM.
      // Capture both: any thrown error, and whether the app element exists.
      let error = null;
      try {
        await actor.sheet.render(true);
      } catch (err) {
        error = `${err.name}: ${err.message}`;
      }
      await new Promise(r => setTimeout(r, 500));

      const el = actor.sheet.element instanceof HTMLElement
        ? actor.sheet.element
        : actor.sheet.element?.[0] ?? null;
      const rendered = el instanceof Node && document.body.contains(el);

      try { await actor.sheet.close(); } catch { /* nothing to close */ }
      return { error, rendered };
    }, ACTOR_NAME);

    expect(result.error).toBeNull();
    expect(result.rendered).toBe(true);
  });
});
