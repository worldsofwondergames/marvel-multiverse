import { test, expect } from './fixtures.mjs';
import {
  createActorViaAPI,
  updateActorData,
  getActorSystemData,
  deleteActor,
} from './helpers.mjs';

const ACTOR_NAME = 'E2E Movement Test';

test.describe('Movement Speed Calculations', () => {

  test.afterEach(async ({ foundryPage }) => {
    await deleteActor(foundryPage, ACTOR_NAME);
  });

  test('default run speed is 5', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME);

    const sys = await getActorSystemData(page, ACTOR_NAME);
    expect(sys.movement.run.value).toBe(5);
  });

  test('climb, swim, jump default to ceil(run/2)', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME);

    let sys = await getActorSystemData(page, ACTOR_NAME);
    // run=5 → ceil(5/2) = 3
    expect(sys.movement.climb.value).toBe(3);
    expect(sys.movement.swim.value).toBe(3);
    expect(sys.movement.jump.value).toBe(3);

    await updateActorData(page, ACTOR_NAME, {
      'system.movement.run.value': 7,
    });

    sys = await getActorSystemData(page, ACTOR_NAME);
    // run=7 → ceil(7/2) = 4
    expect(sys.movement.climb.value).toBe(4);
    expect(sys.movement.swim.value).toBe(4);
    expect(sys.movement.jump.value).toBe(4);
  });

  test('calc mode "double" doubles the value', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME);
    await updateActorData(page, ACTOR_NAME, {
      'system.movement.flight.value': 5,
      'system.movement.flight.calc': 'double',
      'system.movement.flight.active': true,
    });

    const sys = await getActorSystemData(page, ACTOR_NAME);
    expect(sys.movement.flight.value).toBe(10);
  });

  test('calc mode "runspeed-rank" = run * rank', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME);
    await updateActorData(page, ACTOR_NAME, {
      'system.attributes.rank.value': 4,
      'system.movement.flight.value': 5,
      'system.movement.flight.calc': 'runspeed-rank',
      'system.movement.flight.active': true,
    });

    const sys = await getActorSystemData(page, ACTOR_NAME);
    // run=5, rank=4 → 5*4 = 20
    expect(sys.movement.flight.value).toBe(20);
  });

  test('calc mode "rank" with value 0 uses 1 as base', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME);
    await updateActorData(page, ACTOR_NAME, {
      'system.attributes.rank.value': 3,
      'system.movement.flight.value': 0,
      'system.movement.flight.calc': 'rank',
      'system.movement.flight.active': true,
    });

    const sys = await getActorSystemData(page, ACTOR_NAME);
    // value=0 → base=1, rank=3 → 1*3 = 3
    expect(sys.movement.flight.value).toBe(3);
  });

  test('climb/swim/jump derive from final run speed after calc', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME);
    await updateActorData(page, ACTOR_NAME, {
      'system.movement.run.value': 5,
      'system.movement.run.calc': 'double',
    });

    const sys = await getActorSystemData(page, ACTOR_NAME);
    // run=5 doubled=10, climb/swim/jump = ceil(10/2) = 5
    expect(sys.movement.run.value).toBe(10);
    expect(sys.movement.climb.value).toBe(5);
    expect(sys.movement.swim.value).toBe(5);
    expect(sys.movement.jump.value).toBe(5);
  });

  test('power calc on swim overrides default half-run', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME);
    await updateActorData(page, ACTOR_NAME, {
      'system.attributes.rank.value': 4,
      'system.movement.swim.value': 5,
      'system.movement.swim.calc': 'runspeed-rank',
      'system.movement.swim.active': true,
    });

    const sys = await getActorSystemData(page, ACTOR_NAME);
    // swim has its own calc: runspeed-rank → run(5) * rank(4) = 20
    expect(sys.movement.swim.value).toBe(20);
  });
});
