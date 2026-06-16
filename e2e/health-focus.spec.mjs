import { test, expect } from './fixtures.mjs';
import {
  createActorViaAPI,
  updateActorData,
  getActorSystemData,
  createActiveEffect,
  deleteActor,
} from './helpers.mjs';

const ACTOR_NAME = 'E2E Health Focus Test';

test.describe('Health & Focus Calculations', () => {

  test.afterEach(async ({ foundryPage }) => {
    await deleteActor(foundryPage, ACTOR_NAME);
  });

  test('health max = resilience * 30', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME);
    await updateActorData(page, ACTOR_NAME, {
      'system.abilities.res.value': 3,
    });

    const sys = await getActorSystemData(page, ACTOR_NAME);
    expect(sys.health.max).toBe(90);
  });

  test('health max minimum is 10 when resilience is 0', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME);

    const sys = await getActorSystemData(page, ACTOR_NAME);
    expect(sys.health.max).toBe(10);
  });

  test('focus max = vigilance * 30', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME);
    await updateActorData(page, ACTOR_NAME, {
      'system.abilities.vig.value': 4,
    });

    const sys = await getActorSystemData(page, ACTOR_NAME);
    expect(sys.focus.max).toBe(120);
  });

  test('focus max is 0 when vigilance is 0', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME);

    const sys = await getActorSystemData(page, ACTOR_NAME);
    expect(sys.focus.max).toBe(0);
  });

  test('condition damage reduction = health DR * 5', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME);

    await createActiveEffect(page, ACTOR_NAME, {
      name: 'Test DR',
      changes: [{
        key: 'system.healthDamageReduction',
        mode: 2,
        value: '3',
      }],
    });

    const sys = await getActorSystemData(page, ACTOR_NAME);
    expect(sys.healthDamageReduction).toBe(3);
    expect(sys.conditionDamageReduction).toBe(15);
  });
});
