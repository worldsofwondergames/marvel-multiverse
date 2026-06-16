import { test, expect } from './fixtures.mjs';
import {
  createActorViaAPI,
  updateActorData,
  getActorSystemData,
  createActiveEffect,
  deleteActor,
} from './helpers.mjs';

const ACTOR_NAME = 'E2E DM Stacking Test';

test.describe('Damage Multiplier & DR Stacking Rules', () => {

  test.afterEach(async ({ foundryPage }) => {
    await deleteActor(foundryPage, ACTOR_NAME);
  });

  test('single AE DM bonus adds to rank', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME);
    await updateActorData(page, ACTOR_NAME, {
      'system.attributes.rank.value': 3,
    });

    await createActiveEffect(page, ACTOR_NAME, {
      name: 'Mighty 2',
      changes: [{
        key: 'system.abilities.mle.damageMultiplier',
        mode: 2,
        value: '2',
      }],
    });

    const sys = await getActorSystemData(page, ACTOR_NAME);
    expect(sys.abilities.mle.damageMultiplier).toBe(5);
  });

  test('two AE DM bonuses on same ability use highest only', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME);
    await updateActorData(page, ACTOR_NAME, {
      'system.attributes.rank.value': 3,
    });

    await createActiveEffect(page, ACTOR_NAME, {
      name: 'Mighty 2',
      changes: [{
        key: 'system.abilities.mle.damageMultiplier',
        mode: 2,
        value: '2',
      }],
    });

    await createActiveEffect(page, ACTOR_NAME, {
      name: 'Bonus DM 1',
      changes: [{
        key: 'system.abilities.mle.damageMultiplier',
        mode: 2,
        value: '1',
      }],
    });

    const sys = await getActorSystemData(page, ACTOR_NAME);
    // Highest only: rank 3 + max(2,1) = 5, not 3+2+1=6
    expect(sys.abilities.mle.damageMultiplier).toBe(5);
  });

  test('DM bonuses on different abilities are independent', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME);
    await updateActorData(page, ACTOR_NAME, {
      'system.attributes.rank.value': 3,
    });

    await createActiveEffect(page, ACTOR_NAME, {
      name: 'Mighty 2',
      changes: [{
        key: 'system.abilities.mle.damageMultiplier',
        mode: 2,
        value: '2',
      }],
    });

    await createActiveEffect(page, ACTOR_NAME, {
      name: 'Agility DM',
      changes: [{
        key: 'system.abilities.agl.damageMultiplier',
        mode: 2,
        value: '1',
      }],
    });

    const sys = await getActorSystemData(page, ACTOR_NAME);
    expect(sys.abilities.mle.damageMultiplier).toBe(5);
    expect(sys.abilities.agl.damageMultiplier).toBe(4);
  });

  test('disabled AE does not contribute to DM', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME);
    await updateActorData(page, ACTOR_NAME, {
      'system.attributes.rank.value': 3,
    });

    await createActiveEffect(page, ACTOR_NAME, {
      name: 'Active Bonus',
      changes: [{
        key: 'system.abilities.mle.damageMultiplier',
        mode: 2,
        value: '2',
      }],
    });

    await createActiveEffect(page, ACTOR_NAME, {
      name: 'Disabled Bonus',
      disabled: true,
      changes: [{
        key: 'system.abilities.mle.damageMultiplier',
        mode: 2,
        value: '5',
      }],
    });

    const sys = await getActorSystemData(page, ACTOR_NAME);
    // Only active AE counts: rank 3 + 2 = 5 (not 3 + 5)
    expect(sys.abilities.mle.damageMultiplier).toBe(5);
  });

  test('health DR: two sources use highest only', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME);

    await createActiveEffect(page, ACTOR_NAME, {
      name: 'Armor 3',
      changes: [{
        key: 'system.healthDamageReduction',
        mode: 2,
        value: '3',
      }],
    });

    await createActiveEffect(page, ACTOR_NAME, {
      name: 'Shield 2',
      changes: [{
        key: 'system.healthDamageReduction',
        mode: 2,
        value: '2',
      }],
    });

    const sys = await getActorSystemData(page, ACTOR_NAME);
    expect(sys.healthDamageReduction).toBe(3);
  });

  test('focus DR: two sources use highest only', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME);

    await createActiveEffect(page, ACTOR_NAME, {
      name: 'Mental Shield 4',
      changes: [{
        key: 'system.focusDamageReduction',
        mode: 2,
        value: '4',
      }],
    });

    await createActiveEffect(page, ACTOR_NAME, {
      name: 'Willpower 2',
      changes: [{
        key: 'system.focusDamageReduction',
        mode: 2,
        value: '2',
      }],
    });

    const sys = await getActorSystemData(page, ACTOR_NAME);
    expect(sys.focusDamageReduction).toBe(4);
  });
});
