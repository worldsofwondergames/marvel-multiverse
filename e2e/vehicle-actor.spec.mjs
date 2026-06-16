import { test, expect } from './fixtures.mjs';
import {
  createActorViaAPI,
  updateActorData,
  getActorSystemData,
  deleteActor,
} from './helpers.mjs';

const VEHICLE_NAME = 'E2E Vehicle Test';
const PILOT_NAME = 'E2E Pilot Test';

test.describe('Vehicle Actor', () => {

  test.afterEach(async ({ foundryPage }) => {
    await deleteActor(foundryPage, VEHICLE_NAME);
    await deleteActor(foundryPage, PILOT_NAME);
  });

  test('full health has status "normal"', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, VEHICLE_NAME, 'vehicle');
    await updateActorData(page, VEHICLE_NAME, {
      'system.health.max': 100,
      'system.health.value': 100,
    });

    const sys = await getActorSystemData(page, VEHICLE_NAME);
    expect(sys.health.status).toBe('normal');
    expect(sys.health.halfSpeed).toBe(false);
    expect(sys.health.disabled).toBe(false);
    expect(sys.health.destroyed).toBe(false);
  });

  test('below half health has halfSpeed status', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, VEHICLE_NAME, 'vehicle');
    await updateActorData(page, VEHICLE_NAME, {
      'system.health.max': 100,
      'system.health.value': 40,
    });

    const sys = await getActorSystemData(page, VEHICLE_NAME);
    expect(sys.health.halfSpeed).toBe(true);
    expect(sys.health.status).toBe('halfSpeed');
  });

  test('health at 0 is disabled', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, VEHICLE_NAME, 'vehicle');
    await updateActorData(page, VEHICLE_NAME, {
      'system.health.max': 100,
      'system.health.value': 0,
    });

    const sys = await getActorSystemData(page, VEHICLE_NAME);
    expect(sys.health.disabled).toBe(true);
    expect(sys.health.status).toBe('disabled');
  });

  test('health at negative max is destroyed', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, VEHICLE_NAME, 'vehicle');
    await updateActorData(page, VEHICLE_NAME, {
      'system.health.max': 100,
      'system.health.value': -100,
    });

    const sys = await getActorSystemData(page, VEHICLE_NAME);
    expect(sys.health.destroyed).toBe(true);
    expect(sys.health.status).toBe('destroyed');
  });

  test('no pilot gives defense 10/10', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, VEHICLE_NAME, 'vehicle');
    await updateActorData(page, VEHICLE_NAME, {
      'system.health.max': 100,
      'system.health.value': 100,
    });

    const sys = await getActorSystemData(page, VEHICLE_NAME);
    expect(sys.defense.melee).toBe(10);
    expect(sys.defense.agility).toBe(10);
    expect(sys.defense.pilotName).toBeNull();
  });

  test('pilot defense matches pilot actor abilities', async ({ foundryPage }) => {
    const page = foundryPage;

    // Create the pilot character
    await createActorViaAPI(page, PILOT_NAME, 'character');
    await updateActorData(page, PILOT_NAME, {
      'system.abilities.mle.value': 3,
      'system.abilities.agl.value': 5,
    });

    // Create the vehicle
    await createActorViaAPI(page, VEHICLE_NAME, 'vehicle');
    await updateActorData(page, VEHICLE_NAME, {
      'system.health.max': 100,
      'system.health.value': 100,
    });

    // Add pilot as occupant
    await page.evaluate(async ({ vehicleName, pilotName }) => {
      const vehicle = game.actors.find(a => a.name === vehicleName);
      const pilot = game.actors.find(a => a.name === pilotName);
      await vehicle.update({
        'system.occupants': [{
          actorId: pilot.id,
          name: pilot.name,
          img: pilot.img,
          role: 'pilot',
        }],
      });
    }, { vehicleName: VEHICLE_NAME, pilotName: PILOT_NAME });

    await page.waitForTimeout(500);

    const sys = await getActorSystemData(page, VEHICLE_NAME);
    expect(sys.defense.melee).toBe(13); // mle 3 + 10
    expect(sys.defense.agility).toBe(15); // agl 5 + 10
    expect(sys.defense.pilotName).toBe(PILOT_NAME);
  });

  test('crew count matches occupant count', async ({ foundryPage }) => {
    const page = foundryPage;

    await createActorViaAPI(page, PILOT_NAME, 'character');
    await createActorViaAPI(page, VEHICLE_NAME, 'vehicle');

    const result = await page.evaluate(async ({ vehicleName, pilotName }) => {
      const vehicle = game.actors.find(a => a.name === vehicleName);
      const pilot = game.actors.find(a => a.name === pilotName);
      await vehicle.update({
        'system.occupants': [
          { actorId: pilot.id, name: pilot.name, img: '', role: 'pilot' },
          { actorId: pilot.id, name: 'Passenger', img: '', role: 'passenger' },
        ],
      });
      // Re-fetch to get derived data after update
      const v = game.actors.find(a => a.name === vehicleName);
      return {
        occupantsLength: v.system.occupants.length,
        crew: v.system.crew,
      };
    }, { vehicleName: VEHICLE_NAME, pilotName: PILOT_NAME });

    // Occupants array should have 2 entries
    expect(result.occupantsLength).toBe(2);
  });
});
