/* eslint-env jest */
import MarvelMultiverseBattleSuit from '../data/battle-suit.mjs';

describe('MarvelMultiverseBattleSuit — defineSchema', () => {
  let schema;

  beforeAll(() => {
    schema = MarvelMultiverseBattleSuit.defineSchema();
  });

  test('schema includes origin field', () => {
    expect(schema.origin).toBeDefined();
  });

  test('schema includes restrictions array field', () => {
    expect(schema.restrictions).toBeDefined();
  });

  test('schema includes powers array field', () => {
    expect(schema.powers).toBeDefined();
  });

  test('schema includes abilityModifiers field', () => {
    expect(schema.abilityModifiers).toBeDefined();
  });

  test('schema includes rankIncrease field', () => {
    expect(schema.rankIncrease).toBeDefined();
  });

  test('schema includes additionalTraits field', () => {
    expect(schema.additionalTraits).toBeDefined();
  });

  test('schema includes notes field', () => {
    expect(schema.notes).toBeDefined();
  });

  test('schema includes integratedIconicItems field', () => {
    expect(schema.integratedIconicItems).toBeDefined();
  });

  test('schema includes equipped field', () => {
    expect(schema.equipped).toBeDefined();
  });
});

describe('MarvelMultiverseBattleSuit — powerValue', () => {
  function makeBattleSuit(powers = [], restrictions = []) {
    return new MarvelMultiverseBattleSuit({ powers, restrictions });
  }

  test('returns 0 when no powers and no restrictions', () => {
    const suit = makeBattleSuit([], []);
    expect(suit.powerValue).toBe(0);
  });

  test('returns power count when no restrictions', () => {
    const suit = makeBattleSuit(
      [{ id: '1', name: 'A', img: '' }, { id: '2', name: 'B', img: '' }],
      []
    );
    expect(suit.powerValue).toBe(2);
  });

  test('returns powers minus restrictions', () => {
    const suit = makeBattleSuit(
      [{ id: '1', name: 'A', img: '' }, { id: '2', name: 'B', img: '' }, { id: '3', name: 'C', img: '' }],
      [{ kind: 'access', name: 'R1', description: '' }]
    );
    expect(suit.powerValue).toBe(2);
  });

  test('returns 1 when restrictions exceed powers (minimum PV is 1)', () => {
    const suit = makeBattleSuit(
      [{ id: '1', name: 'A', img: '' }],
      [
        { kind: 'access', name: 'R1', description: '' },
        { kind: 'obvious', name: 'R2', description: '' },
        { kind: 'use', name: 'R3', description: '' },
      ]
    );
    expect(suit.powerValue).toBe(1);
  });

  test('returns 1 when powers equal restrictions', () => {
    const suit = makeBattleSuit(
      [{ id: '1', name: 'A', img: '' }],
      [{ kind: 'access', name: 'R1', description: '' }]
    );
    expect(suit.powerValue).toBe(1);
  });

  test('a ranked power counts as its rank', () => {
    const suit = makeBattleSuit([{ id: '1', name: 'Mighty 3', img: '' }], []);
    expect(suit.powerValue).toBe(3);
  });

  test('ranked and unranked powers are summed', () => {
    const suit = makeBattleSuit(
      [{ id: '1', name: 'Mighty 3', img: '' }, { id: '2', name: 'Unranked Power', img: '' }],
      []
    );
    expect(suit.powerValue).toBe(4);
  });

  test('a restriction comes off the summed ranks', () => {
    const suit = makeBattleSuit(
      [{ id: '1', name: 'Mighty 3', img: '' }, { id: '2', name: 'Unranked Power', img: '' }],
      [{ kind: 'access', name: 'R1', description: '' }]
    );
    expect(suit.powerValue).toBe(3);
  });
});
