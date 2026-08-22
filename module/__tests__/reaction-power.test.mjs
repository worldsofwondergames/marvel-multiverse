/* eslint-env jest */
import { _isReactionPower } from '../documents/item.mjs';

/**
 * Action is free text in the data module. Of the nine distinct values used by
 * the 407 powers there, five name a reaction and four don't.
 */
describe('_isReactionPower', () => {
  test('recognises a plain reaction', () => {
    expect(_isReactionPower('Reaction')).toBe(true);
  });

  test('recognises reaction as one of several options', () => {
    for (const a of [
      'Standard or Reaction',
      'Standard or reaction',
      'Standard, movement or reaction',
      'Standard, movement, or reaction',
    ]) {
      expect(_isReactionPower(a)).toBe(true);
    }
  });

  test('ignores case and surrounding space', () => {
    expect(_isReactionPower('  reaction ')).toBe(true);
  });

  test('rejects the other actions that occur', () => {
    for (const a of ['Standard', 'Movement', 'Both standard and movement', 'Standard or movement']) {
      expect(_isReactionPower(a)).toBe(false);
    }
  });

  test('treats a missing action as not a reaction', () => {
    expect(_isReactionPower(undefined)).toBe(false);
    expect(_isReactionPower(null)).toBe(false);
    expect(_isReactionPower('')).toBe(false);
  });
});
