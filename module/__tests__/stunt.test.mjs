/* eslint-env jest */
import MarvelMultiverseStunt from '../data/stunt.mjs';

describe('MarvelMultiverseStunt — defineSchema', () => {
  let schema;

  beforeAll(() => {
    schema = MarvelMultiverseStunt.defineSchema();
  });

  test('schema includes prerequisite string field', () => {
    expect(schema.prerequisite).toBeDefined();
  });

  test('schema includes duration string field', () => {
    expect(schema.duration).toBeDefined();
  });

  test('schema includes effect string field', () => {
    expect(schema.effect).toBeDefined();
  });

  test('schema includes learned boolean field, defaulting false', () => {
    expect(schema.learned).toBeDefined();
    expect(schema.learned.options.initial).toBe(false);
  });

  test('schema includes power string field, blank by default', () => {
    expect(schema.power).toBeDefined();
    expect(schema.power.options.blank).toBe(true);
  });
});
