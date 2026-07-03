/* eslint-env jest */
import MarvelMultiverseActorBase from '../data/actor-base.mjs';

describe('MarvelMultiverseActorBase — alternate form schema', () => {
  let schema;

  beforeAll(() => {
    schema = MarvelMultiverseActorBase.defineSchema();
  });

  test('schema includes alternateForms array field', () => {
    expect(schema.alternateForms).toBeDefined();
  });

  test('schema includes primaryFormIds array field', () => {
    expect(schema.primaryFormIds).toBeDefined();
  });
});

describe('alternateFormTypes config enum', () => {
  test('config includes cosmetic, powerDown, powerSwap', () => {
    const types = CONFIG.MARVEL_MULTIVERSE.alternateFormTypes;
    expect(types).toBeDefined();
    expect(types.cosmetic).toBeDefined();
    expect(types.powerDown).toBeDefined();
    expect(types.powerSwap).toBeDefined();
  });

  test('config has exactly three form types', () => {
    const types = CONFIG.MARVEL_MULTIVERSE.alternateFormTypes;
    expect(Object.keys(types)).toHaveLength(3);
  });
});
