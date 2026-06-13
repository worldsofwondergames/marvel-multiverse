/* eslint-env jest */
import MarvelMultiverseVehicle from '../data/vehicle.mjs';

function makeVehicle({ healthValue = 100, healthMax = 100, safetyHarness = false, speed = {}, occupants = [] } = {}) {
  const speedField = (value = 0, active = false) => ({ value, active });
  const instance = new MarvelMultiverseVehicle({
    health: { value: healthValue, max: healthMax },
    safetyHarness,
    speed: {
      run: speedField(),
      flight: speedField(),
      climb: speedField(),
      swim: speedField(),
      ...speed,
    },
    occupants,
  });
  instance.prepareDerivedData();
  return instance;
}

// ─── Health Status ────────────────────────────────────────────────────────────

describe('MarvelMultiverseVehicle — Health Status Flags', () => {
  test('normal: full health, no flags set', () => {
    const v = makeVehicle({ healthValue: 100, healthMax: 100 });
    expect(v.health.halfSpeed).toBe(false);
    expect(v.health.disabled).toBe(false);
    expect(v.health.destroyed).toBe(false);
    expect(v.health.status).toBe('normal');
  });

  test('halfSpeed: health > 0 and < maxHealth / 2', () => {
    const v = makeVehicle({ healthValue: 40, healthMax: 100 });
    expect(v.health.halfSpeed).toBe(true);
    expect(v.health.status).toBe('halfSpeed');
  });

  test('halfSpeed boundary: exactly half is NOT halfSpeed', () => {
    const v = makeVehicle({ healthValue: 50, healthMax: 100 });
    expect(v.health.halfSpeed).toBe(false);
  });

  test('disabled: health exactly 0', () => {
    const v = makeVehicle({ healthValue: 0, healthMax: 100 });
    expect(v.health.disabled).toBe(true);
    expect(v.health.halfSpeed).toBe(false);
    expect(v.health.status).toBe('disabled');
  });

  test('disabled: health below 0 (not yet destroyed)', () => {
    const v = makeVehicle({ healthValue: -50, healthMax: 100 });
    expect(v.health.disabled).toBe(true);
    expect(v.health.destroyed).toBe(false);
    expect(v.health.status).toBe('disabled');
  });

  test('destroyed: health <= -(maxHealth)', () => {
    const v = makeVehicle({ healthValue: -100, healthMax: 100 });
    expect(v.health.destroyed).toBe(true);
    expect(v.health.status).toBe('destroyed');
  });

  test('destroyed takes priority over disabled in status', () => {
    const v = makeVehicle({ healthValue: -200, healthMax: 100 });
    expect(v.health.status).toBe('destroyed');
  });

  test('not destroyed when maxHealth is 0', () => {
    const v = makeVehicle({ healthValue: 0, healthMax: 0 });
    expect(v.health.destroyed).toBe(false);
  });
});

// ─── Defense ─────────────────────────────────────────────────────────────────

describe('MarvelMultiverseVehicle — Defense', () => {
  test('defaults to TN 10 when no occupants', () => {
    const v = makeVehicle();
    expect(v.defense).toEqual({ melee: 10, agility: 10, pilotName: null });
  });

  test('defaults to TN 10 when no pilot occupant', () => {
    const v = makeVehicle({ occupants: [{ actorId: 'a1', name: 'Bob', img: '', role: 'passenger' }] });
    expect(v.defense).toEqual({ melee: 10, agility: 10, pilotName: null });
  });

  test('uses pilot actor defense scores when pilot found in game.actors', () => {
    const mockActor = {
      name: 'Cyclops',
      system: { abilities: { mle: { defense: 14 }, agl: { defense: 16 } } },
    };
    game.actors = { get: (id) => id === 'pilot-id' ? mockActor : null };

    const v = makeVehicle({ occupants: [{ actorId: 'pilot-id', name: 'Cyclops', img: '', role: 'pilot' }] });
    expect(v.defense).toEqual({ melee: 14, agility: 16, pilotName: 'Cyclops' });

    game.actors = undefined;
  });

  test('falls back to TN 10 when pilot actorId not found in game.actors', () => {
    game.actors = { get: () => null };
    const v = makeVehicle({ occupants: [{ actorId: 'missing-id', name: 'Ghost', img: '', role: 'pilot' }] });
    expect(v.defense).toEqual({ melee: 10, agility: 10, pilotName: null });
    game.actors = undefined;
  });
});
