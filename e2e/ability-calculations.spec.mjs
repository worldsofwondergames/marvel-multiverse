import { test, expect } from './fixtures.mjs';
import {
  createActorViaAPI,
  updateActorData,
  getActorSystemData,
  deleteActor,
} from './helpers.mjs';

const ACTOR_NAME = 'E2E Ability Calc Test';

test.describe('Ability Calculations', () => {

  test.afterEach(async ({ foundryPage }) => {
    await deleteActor(foundryPage, ACTOR_NAME);
  });

  test('defense score equals ability value + 10 for all six abilities', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME);
    await updateActorData(page, ACTOR_NAME, {
      'system.abilities.mle.value': 2,
      'system.abilities.agl.value': 5,
      'system.abilities.res.value': 3,
      'system.abilities.vig.value': 4,
      'system.abilities.ego.value': 1,
      'system.abilities.log.value': 6,
    });

    const sys = await getActorSystemData(page, ACTOR_NAME);
    expect(sys.abilities.mle.defense).toBe(12);
    expect(sys.abilities.agl.defense).toBe(15);
    expect(sys.abilities.res.defense).toBe(13);
    expect(sys.abilities.vig.defense).toBe(14);
    expect(sys.abilities.ego.defense).toBe(11);
    expect(sys.abilities.log.defense).toBe(16);
  });

  test('defense score is 10 when ability is 0', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME);

    const sys = await getActorSystemData(page, ACTOR_NAME);
    for (const key of ['mle', 'agl', 'res', 'vig', 'ego', 'log']) {
      expect(sys.abilities[key].defense, `${key} defense`).toBe(10);
    }
  });

  test('negative ability value: defense is 7 when ability is -3', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME);
    await updateActorData(page, ACTOR_NAME, {
      'system.abilities.mle.value': -3,
    });

    const sys = await getActorSystemData(page, ACTOR_NAME);
    expect(sys.abilities.mle.defense).toBe(7);
  });

  test('damage multiplier equals rank for each ability', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME);
    await updateActorData(page, ACTOR_NAME, {
      'system.attributes.rank.value': 4,
    });

    const sys = await getActorSystemData(page, ACTOR_NAME);
    for (const key of ['mle', 'agl', 'res', 'vig', 'ego', 'log']) {
      expect(sys.abilities[key].damageMultiplier, `${key} DM`).toBe(4);
    }
  });

  test('damage multiplier updates when rank changes', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME);
    await updateActorData(page, ACTOR_NAME, {
      'system.attributes.rank.value': 2,
    });

    let sys = await getActorSystemData(page, ACTOR_NAME);
    expect(sys.abilities.mle.damageMultiplier).toBe(2);

    await updateActorData(page, ACTOR_NAME, {
      'system.attributes.rank.value': 5,
    });

    sys = await getActorSystemData(page, ACTOR_NAME);
    expect(sys.abilities.mle.damageMultiplier).toBe(5);
  });

  test('non-combat check equals ability value', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME);
    await updateActorData(page, ACTOR_NAME, {
      'system.abilities.log.value': 5,
      'system.abilities.mle.value': 3,
    });

    const sys = await getActorSystemData(page, ACTOR_NAME);
    expect(sys.abilities.log.noncom).toBe(5);
    expect(sys.abilities.mle.noncom).toBe(3);
  });

  test('initiative value equals Vigilance', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME);
    await updateActorData(page, ACTOR_NAME, {
      'system.abilities.vig.value': 3,
    });

    const sys = await getActorSystemData(page, ACTOR_NAME);
    expect(sys.attributes.init.value).toBe(3);
  });
});
