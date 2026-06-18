/* eslint-env jest */
import MarvelMultiverseRestriction from '../data/restriction.mjs';

describe('MarvelMultiverseRestriction — defineSchema', () => {
  let schema;

  beforeAll(() => {
    schema = MarvelMultiverseRestriction.defineSchema();
  });

  test('schema includes kind field', () => {
    expect(schema.kind).toBeDefined();
  });

  test('schema includes description field from base', () => {
    expect(schema.description).toBeDefined();
  });

  test('schema includes ability field from base', () => {
    expect(schema.ability).toBeDefined();
  });
});
