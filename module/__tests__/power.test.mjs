/* eslint-env jest */
import MarvelMultiversePower from '../data/power.mjs';

describe('MarvelMultiversePower — defineSchema', () => {
  let schema;

  beforeAll(() => {
    schema = MarvelMultiversePower.defineSchema();
  });

  test('schema includes powerSet string field', () => {
    expect(schema.powerSet).toBeDefined();
  });

  test('schema includes powerSets array field', () => {
    expect(schema.powerSets).toBeDefined();
  });

  test('schema includes prerequisites field', () => {
    expect(schema.prerequisites).toBeDefined();
  });

  test('schema includes action field', () => {
    expect(schema.action).toBeDefined();
  });

  test('schema includes effect field', () => {
    expect(schema.effect).toBeDefined();
  });
});

describe('MarvelMultiversePower — migrateData', () => {
  test('migrates legacy powerSet string to powerSets array', () => {
    const source = { powerSet: 'Super-Strength, Telepathy' };
    const result = MarvelMultiversePower.migrateData(source);
    expect(result.powerSets).toEqual([
      { id: null, name: 'Super-Strength', img: null },
      { id: null, name: 'Telepathy', img: null },
    ]);
  });

  test('migrates single powerSet value', () => {
    const source = { powerSet: 'Basic' };
    const result = MarvelMultiversePower.migrateData(source);
    expect(result.powerSets).toEqual([
      { id: null, name: 'Basic', img: null },
    ]);
  });

  test('does not overwrite existing powerSets array', () => {
    const existing = [{ id: 'abc', name: 'Magic', img: 'magic.png' }];
    const source = { powerSet: 'Basic', powerSets: existing };
    const result = MarvelMultiversePower.migrateData(source);
    expect(result.powerSets).toBe(existing);
  });

  test('handles empty powerSet string', () => {
    const source = { powerSet: '' };
    const result = MarvelMultiversePower.migrateData(source);
    expect(result.powerSets).toBeUndefined();
  });

  test('handles powerSet with extra whitespace', () => {
    const source = { powerSet: '  Spider-Powers ,  Martial Arts  ' };
    const result = MarvelMultiversePower.migrateData(source);
    expect(result.powerSets).toEqual([
      { id: null, name: 'Spider-Powers', img: null },
      { id: null, name: 'Martial Arts', img: null },
    ]);
  });

  test('handles powerSet with trailing comma', () => {
    const source = { powerSet: 'Telekinesis,' };
    const result = MarvelMultiversePower.migrateData(source);
    expect(result.powerSets).toEqual([
      { id: null, name: 'Telekinesis', img: null },
    ]);
  });

  test('migrates attackAbility to ability', () => {
    const source = { attackAbility: 'mle' };
    const result = MarvelMultiversePower.migrateData(source);
    expect(result.ability).toBe('mle');
    expect(result.attackAbility).toBeUndefined();
  });
});
