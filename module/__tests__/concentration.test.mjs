/* eslint-env jest */
import {
  _isConcentrationPower,
  _concentrationLimit,
  _checkConcentration,
  CONCENTRATION_BREAKERS,
} from '../documents/item.mjs';

/**
 * 125 of the 407 powers in the data module have duration "Concentration" — the
 * second-largest group after Instant.
 */
describe('_isConcentrationPower', () => {
  test('recognises the duration the data module uses', () => {
    expect(_isConcentrationPower({ duration: 'Concentration' })).toBe(true);
  });

  test('ignores case and surrounding space', () => {
    expect(_isConcentrationPower({ duration: '  concentration ' })).toBe(true);
  });

  test('rejects the other durations that occur', () => {
    for (const d of ['Instant', 'Permanent', '1 round', '1 round per rank', 'Varies', 'Instant + 1 round']) {
      expect(_isConcentrationPower({ duration: d })).toBe(false);
    }
  });

  test('treats a missing duration as not concentration', () => {
    expect(_isConcentrationPower({})).toBe(false);
    expect(_isConcentrationPower(undefined)).toBe(false);
    expect(_isConcentrationPower({ duration: '' })).toBe(false);
  });
});

describe('_concentrationLimit', () => {
  test('is one per rank', () => {
    expect(_concentrationLimit({ system: { attributes: { rank: { value: 4 } } } })).toBe(4);
    expect(_concentrationLimit({ system: { attributes: { rank: { value: 1 } } } })).toBe(1);
  });

  test('treats a missing actor or rank as zero rather than throwing', () => {
    expect(_concentrationLimit(undefined)).toBe(0);
    expect(_concentrationLimit({})).toBe(0);
    expect(_concentrationLimit({ system: {} })).toBe(0);
  });
});

describe('_checkConcentration', () => {
  test('allows a new power while below the limit', () => {
    expect(_checkConcentration({ held: ['a'], itemId: 'b', limit: 3 })).toEqual({ ok: true });
  });

  test('refuses a power already being concentrated on', () => {
    // The rulebook is explicit: the powers must be separate.
    expect(_checkConcentration({ held: ['a', 'b'], itemId: 'a', limit: 5 }))
      .toEqual({ ok: false, reason: 'duplicate' });
  });

  test('refuses once the held count reaches the limit', () => {
    expect(_checkConcentration({ held: ['a', 'b'], itemId: 'c', limit: 2 }))
      .toEqual({ ok: false, reason: 'limit' });
  });

  test('reports a duplicate even when the limit is also reached', () => {
    // Duplicate is the more specific reason, so it wins.
    expect(_checkConcentration({ held: ['a', 'b'], itemId: 'a', limit: 2 }))
      .toEqual({ ok: false, reason: 'duplicate' });
  });

  test('refuses everything at rank zero', () => {
    expect(_checkConcentration({ held: [], itemId: 'a', limit: 0 }))
      .toEqual({ ok: false, reason: 'limit' });
  });

  test('defaults to refusing when called with nothing', () => {
    expect(_checkConcentration({}).ok).toBe(false);
  });
});

describe('CONCENTRATION_BREAKERS', () => {
  test('lists only the conditions that can be detected from actor state', () => {
    // Blinded, deafened and paralyzed break concentration only when the power
    // requires sight, hearing or a Melee/Agility check, and the power schema
    // records none of that. Knockback is not a condition at all.
    expect([...CONCENTRATION_BREAKERS].sort())
      .toEqual(['demoralized', 'prone', 'stunned', 'unconscious']);
  });
});
