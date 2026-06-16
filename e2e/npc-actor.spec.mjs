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
});
