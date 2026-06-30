/* eslint-env jest */
import MarvelMultiverseIconicItem from '../data/iconic-item.mjs';

describe('MarvelMultiverseIconicItem — defineSchema', () => {
  let schema;

  beforeAll(() => {
    schema = MarvelMultiverseIconicItem.defineSchema();
  });

  test('schema includes restrictions array field', () => {
    expect(schema.restrictions).toBeDefined();
  });

  test('schema includes powers array field', () => {
    expect(schema.powers).toBeDefined();
  });

  test('schema includes origin field', () => {
    expect(schema.origin).toBeDefined();
  });

  test('schema includes ownershipMode field', () => {
    expect(schema.ownershipMode).toBeDefined();
  });

  test('schema includes weaponData field', () => {
    expect(schema.weaponData).toBeDefined();
  });
});

describe('MarvelMultiverseIconicItem — powerValue', () => {
  function makeIconicItem(powers = [], restrictions = []) {
    const item = new MarvelMultiverseIconicItem({ powers, restrictions });
    return item;
  }

  test('returns 0 when no powers and no restrictions', () => {
    const item = makeIconicItem([], []);
    expect(item.powerValue).toBe(0);
  });

  test('returns power count when no restrictions', () => {
    const item = makeIconicItem(
      [{ id: '1', name: 'A', img: '' }, { id: '2', name: 'B', img: '' }],
      []
    );
    expect(item.powerValue).toBe(2);
  });

  test('returns powers minus restrictions', () => {
    const item = makeIconicItem(
      [{ id: '1', name: 'A', img: '' }, { id: '2', name: 'B', img: '' }, { id: '3', name: 'C', img: '' }],
      [{ kind: 'access', name: 'R1', description: '' }]
    );
    expect(item.powerValue).toBe(2);
  });

  test('returns 1 when restrictions exceed powers (minimum PV is 1)', () => {
    const item = makeIconicItem(
      [{ id: '1', name: 'A', img: '' }],
      [
        { kind: 'access', name: 'R1', description: '' },
        { kind: 'obvious', name: 'R2', description: '' },
        { kind: 'use', name: 'R3', description: '' },
      ]
    );
    expect(item.powerValue).toBe(1);
  });

  test('returns 1 when only restrictions exist (minimum PV is 1)', () => {
    const item = makeIconicItem(
      [],
      [{ kind: 'access', name: 'R1', description: '' }]
    );
    expect(item.powerValue).toBe(1);
  });

  test('returns 1 when powers equal restrictions', () => {
    const item = makeIconicItem(
      [{ id: '1', name: 'A', img: '' }],
      [{ kind: 'access', name: 'R1', description: '' }]
    );
    expect(item.powerValue).toBe(1);
  });
});
