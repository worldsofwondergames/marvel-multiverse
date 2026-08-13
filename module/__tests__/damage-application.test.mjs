/* eslint-env jest */
/**
 * Issue #131 — the rules behind the damage card's Take Damage button.
 *
 * Imported from the shipping monolith, not the `module/**` twin, because the
 * monolith is the only file `system.json` loads. The last block re-runs the
 * same cases through the twin so the two copies cannot drift apart unnoticed.
 */
import {
  canApplyDamage,
  computeDamage,
  damageReductionPath,
  damageValuePath,
  isTargetHit,
  withApplied,
} from '../../marvel-multiverse.mjs';

import * as twin from '../helpers/damage-application.mjs';

describe('hit classification', () => {
  test('a total that reaches the defense hits', () => {
    expect(isTargetHit({ isFantastic: false, total: 14 }, 14)).toBe(true);
  });

  test('a total one under the defense misses', () => {
    expect(isTargetHit({ isFantastic: false, total: 13 }, 14)).toBe(false);
  });

  // A Fantastic result hits whatever the number says, so the comparison must
  // not be the only thing consulted.
  test('a Fantastic roll under the defense still hits', () => {
    expect(isTargetHit({ isFantastic: true, total: 3 }, 20)).toBe(true);
  });
});

describe('damage arithmetic', () => {
  test('damage is the Marvel die times the multiplier plus the ability score', () => {
    expect(
      computeDamage({
        marvelDieTotal: 4,
        damageMultiplier: 3,
        abilityValue: 2,
      }).amount
    ).toBe(14);
  });

  test('the target damage reduction comes off the multiplier, not the total', () => {
    // (4 × (3 − 1)) + 2 = 10, not (4 × 3) + 2 − 1 = 13.
    expect(
      computeDamage({
        marvelDieTotal: 4,
        damageMultiplier: 3,
        damageReduction: 1,
        abilityValue: 2,
      }).amount
    ).toBe(10);
  });

  // Rulebook: DR at or above the multiplier means no damage at all, "not even
  // from the attacker's Ability score bonus".
  test('damage reduction meeting the multiplier deals nothing, not the ability score', () => {
    expect(
      computeDamage({
        marvelDieTotal: 6,
        damageMultiplier: 2,
        damageReduction: 2,
        abilityValue: 5,
      }).amount
    ).toBe(0);
  });

  test('damage reduction above the multiplier does not go negative', () => {
    expect(
      computeDamage({
        marvelDieTotal: 6,
        damageMultiplier: 2,
        damageReduction: 9,
        abilityValue: 5,
      })
    ).toEqual({ amount: 0, effectiveMultiplier: 0 });
  });

  test('a Fantastic attack doubles the total after the ability score is added', () => {
    // ((4 × 3) + 2) × 2 = 28. Doubling before the score would give 26.
    expect(
      computeDamage({
        marvelDieTotal: 4,
        damageMultiplier: 3,
        abilityValue: 2,
        fantastic: true,
      }).amount
    ).toBe(28);
  });
});

describe('which pool the damage comes out of', () => {
  test('focus damage is taken from Focus', () => {
    expect(damageValuePath('focus')).toBe('system.focus.value');
    expect(damageReductionPath('focus')).toBe('focusDamageReduction');
  });

  test('health damage is taken from Health', () => {
    expect(damageValuePath('health')).toBe('system.health.value');
    expect(damageReductionPath('health')).toBe('healthDamageReduction');
  });

  // An attack whose flavor named no damage type still has to hit something.
  test('an unnamed damage type falls back to Health', () => {
    expect(damageValuePath(undefined)).toBe('system.health.value');
    expect(damageReductionPath(undefined)).toBe('healthDamageReduction');
  });
});

describe('who may apply damage', () => {
  /** An actor that answers OWNER for exactly one user. */
  function actorOwnedBy(ownerId) {
    return {
      testUserPermission: (user, level) =>
        level === 'OWNER' && user?.id === ownerId,
    };
  }

  test('a GM may apply damage to an actor they do not own', () => {
    expect(canApplyDamage({ id: 'gm', isGM: true }, actorOwnedBy('player'))).toBe(true);
  });

  test('a player may apply damage to an actor they own', () => {
    expect(canApplyDamage({ id: 'player', isGM: false }, actorOwnedBy('player'))).toBe(true);
  });

  test('a player may not apply damage to somebody else’s actor', () => {
    expect(canApplyDamage({ id: 'other', isGM: false }, actorOwnedBy('player'))).toBe(false);
  });

  test('a target that no longer resolves is not applicable', () => {
    expect(canApplyDamage({ id: 'gm', isGM: true }, null)).toBe(false);
  });
});

describe('recording that damage was taken', () => {
  test('the first application records the uuid', () => {
    expect(withApplied([], 'Actor.abc')).toEqual(['Actor.abc']);
  });

  test('applying one target leaves the others in place', () => {
    expect(withApplied(['Actor.abc'], 'Actor.def')).toEqual(['Actor.abc', 'Actor.def']);
  });

  test('a repeated application does not record the uuid twice', () => {
    expect(withApplied(['Actor.abc'], 'Actor.abc')).toEqual(['Actor.abc']);
  });

  // setFlag diffs against the stored value, so mutating the array in place
  // would leave nothing for it to see and the write would be dropped.
  test('the existing list is not modified', () => {
    const existing = ['Actor.abc'];
    withApplied(existing, 'Actor.def');
    expect(existing).toEqual(['Actor.abc']);
  });

  test('a message with no applied list yet is handled', () => {
    expect(withApplied(undefined, 'Actor.abc')).toEqual(['Actor.abc']);
  });
});

/**
 * `module/documents/chat-message.mjs` imports the twin, the monolith carries
 * its own copy, and only the monolith runs. Compare what the two produce so a
 * change to one alone shows up here rather than in play.
 */
describe('the twin agrees with the shipping monolith', () => {
  const DAMAGE_CASES = [
    { marvelDieTotal: 4, damageMultiplier: 3, damageReduction: 0, abilityValue: 2, fantastic: false },
    { marvelDieTotal: 4, damageMultiplier: 3, damageReduction: 1, abilityValue: 2, fantastic: true },
    { marvelDieTotal: 6, damageMultiplier: 2, damageReduction: 9, abilityValue: 5, fantastic: false },
  ];

  test.each(DAMAGE_CASES)('computeDamage matches for %o', (args) => {
    expect(twin.computeDamage(args)).toEqual(computeDamage(args));
  });

  test.each([
    [{ isFantastic: false, total: 14 }, 14],
    [{ isFantastic: false, total: 13 }, 14],
    [{ isFantastic: true, total: 3 }, 20],
  ])('isTargetHit matches for %o against %i', (roll, ac) => {
    expect(twin.isTargetHit(roll, ac)).toBe(isTargetHit(roll, ac));
  });

  test.each(['focus', 'health', undefined])('damage paths match for %s', (type) => {
    expect(twin.damageValuePath(type)).toBe(damageValuePath(type));
    expect(twin.damageReductionPath(type)).toBe(damageReductionPath(type));
  });
});
