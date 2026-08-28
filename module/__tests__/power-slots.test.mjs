/* eslint-env jest */
import { powerSlotCost, sumPowerSlots, calculatePowerValue } from '../helpers/power-slots.mjs';

describe('powerSlotCost', () => {
  test.each([
    ['Mighty 1', 1],
    ['Mighty 3', 3],
    ['Elemental Protection 4', 4],
  ])('a rank suffix is the slot cost: %s', (name, expected) => {
    expect(powerSlotCost(name)).toBe(expected);
  });

  test('an unranked power costs one slot', () => {
    expect(powerSlotCost('Unranked Power')).toBe(1);
  });

  test('a digit that is part of a word is not a rank', () => {
    expect(powerSlotCost('Iron Will2')).toBe(1);
  });

  test('a missing name costs one slot rather than throwing', () => {
    expect(powerSlotCost(undefined)).toBe(1);
  });
});

describe('sumPowerSlots', () => {
  test('ranks are added, not counted', () => {
    expect(sumPowerSlots([{ name: 'Mighty 3' }, { name: 'Unranked Power' }])).toBe(4);
  });

  test('an empty list occupies nothing', () => {
    expect(sumPowerSlots([])).toBe(0);
  });

  test('an absent list occupies nothing', () => {
    expect(sumPowerSlots(undefined)).toBe(0);
  });
});

describe('calculatePowerValue', () => {
  const restriction = { kind: 'access', name: 'R', description: '' };

  test('a ranked power contributes its rank', () => {
    expect(calculatePowerValue([{ name: 'Mighty 3' }], [])).toBe(3);
  });

  test('restrictions come off the summed ranks, not the power count', () => {
    expect(calculatePowerValue([{ name: 'Mighty 3' }, { name: 'Unranked Power' }], [restriction])).toBe(3);
  });

  test('nothing at all is worth 0', () => {
    expect(calculatePowerValue([], [])).toBe(0);
  });

  test('restrictions alone are worth 1', () => {
    expect(calculatePowerValue([], [restriction])).toBe(1);
  });

  test('restrictions cannot push the value below 1', () => {
    expect(calculatePowerValue([{ name: 'Mighty 2' }], [restriction, restriction, restriction])).toBe(1);
  });
});
