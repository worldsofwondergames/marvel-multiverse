/* eslint-env jest */
import { _parseFocusCost, _maxFocusSpend } from '../documents/item.mjs';

/**
 * Cost is free text on the power. These shapes are the ones that actually occur
 * across the 407 powers in marvel-multiverse-data: 194 flat, 24 "or more",
 * 10 per turn or per round, and 6 that name no number at all.
 */
describe('_parseFocusCost', () => {
  test('reads a flat cost', () => {
    expect(_parseFocusCost('10 Focus')).toEqual({ kind: 'flat', amount: 10, period: null });
    expect(_parseFocusCost('5 Focus')).toEqual({ kind: 'flat', amount: 5, period: null });
    expect(_parseFocusCost('25 Focus')).toEqual({ kind: 'flat', amount: 25, period: null });
  });

  test('reads an open-ended cost as variable, keeping the floor', () => {
    expect(_parseFocusCost('5 or more Focus')).toEqual({ kind: 'variable', amount: 5, period: null });
    expect(_parseFocusCost('20 or more Focus')).toEqual({ kind: 'variable', amount: 20, period: null });
  });

  test('reads a recurring cost and which period it repeats on', () => {
    expect(_parseFocusCost('5 Focus per turn')).toEqual({ kind: 'recurring', amount: 5, period: 'turn' });
    expect(_parseFocusCost('15 Focus per round')).toEqual({ kind: 'recurring', amount: 15, period: 'round' });
  });

  test('returns null when the cost names no Focus', () => {
    // These are real cost strings. Neither can be computed, so no control.
    expect(_parseFocusCost('Varies')).toBeNull();
    expect(_parseFocusCost("Same as the character's Elemental Protection power")).toBeNull();
  });

  test('returns null for missing or empty text', () => {
    expect(_parseFocusCost(undefined)).toBeNull();
    expect(_parseFocusCost(null)).toBeNull();
    expect(_parseFocusCost('')).toBeNull();
    expect(_parseFocusCost('   ')).toBeNull();
  });

  test('returns null rather than guessing at unrecognised wording', () => {
    // Deducting a guessed amount is worse than leaving it to the player.
    expect(_parseFocusCost('Focus')).toBeNull();
    expect(_parseFocusCost('some Focus')).toBeNull();
    expect(_parseFocusCost('5 Focus per fortnight')).toBeNull();
    expect(_parseFocusCost('5 Focus and a trait')).toBeNull();
  });

  test('is not case sensitive and tolerates surrounding space', () => {
    expect(_parseFocusCost('  10 FOCUS  ')).toEqual({ kind: 'flat', amount: 10, period: null });
    expect(_parseFocusCost('5 Or More focus')).toEqual({ kind: 'variable', amount: 5, period: null });
  });
});

describe('_maxFocusSpend', () => {
  test('is five times rank, per the rulebook', () => {
    expect(_maxFocusSpend({ system: { attributes: { rank: { value: 1 } } } })).toBe(5);
    expect(_maxFocusSpend({ system: { attributes: { rank: { value: 3 } } } })).toBe(15);
    expect(_maxFocusSpend({ system: { attributes: { rank: { value: 6 } } } })).toBe(30);
  });

  test('treats a missing actor or rank as zero rather than throwing', () => {
    expect(_maxFocusSpend(undefined)).toBe(0);
    expect(_maxFocusSpend({})).toBe(0);
    expect(_maxFocusSpend({ system: {} })).toBe(0);
  });
});
