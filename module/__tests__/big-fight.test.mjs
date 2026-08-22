/* eslint-env jest */
// module/__tests__/big-fight.test.mjs
import {
  isBigFightEnabled,
  combatantSideFromDisposition,
  findGroup,
  liveMembers,
  pooledResource,
  groupAttackBonus,
  applyAttackBonusToFormula,
  bestVigilanceBySide,
  needsInitiativeReroll,
} from '../../marvel-multiverse.mjs';

import * as twin from '../helpers/big-fight.mjs';

describe('isBigFightEnabled', () => {
  test('false when there is no flag', () => {
    expect(isBigFightEnabled(null)).toBe(false);
  });
  test('false when enabled is not exactly true', () => {
    expect(isBigFightEnabled({ enabled: 'yes' })).toBe(false);
  });
  test('true when enabled is true', () => {
    expect(isBigFightEnabled({ enabled: true })).toBe(true);
  });
});

describe('combatantSideFromDisposition', () => {
  const HOSTILE = -1;
  test('hostile tokens are foes', () => {
    expect(combatantSideFromDisposition(-1, HOSTILE)).toBe('foe');
  });
  test('friendly tokens are heroes', () => {
    expect(combatantSideFromDisposition(1, HOSTILE)).toBe('hero');
  });
  test('neutral tokens default to hero', () => {
    expect(combatantSideFromDisposition(0, HOSTILE)).toBe('hero');
  });
});

describe('findGroup', () => {
  const groups = [
    { id: 'g1', memberCombatantIds: ['c1', 'c2'] },
    { id: 'g2', memberCombatantIds: ['c3'] },
  ];
  test('finds the group containing a combatant', () => {
    expect(findGroup(groups, 'c3')?.id).toBe('g2');
  });
  test('returns null when no group contains the combatant', () => {
    expect(findGroup(groups, 'c9')).toBeNull();
  });
  test('returns null when there are no groups yet', () => {
    expect(findGroup(undefined, 'c1')).toBeNull();
  });
});

describe('liveMembers and pooledResource', () => {
  const group = { id: 'g1', memberCombatantIds: ['c1', 'c2', 'c3'] };
  const combatantsById = {
    c1: { id: 'c1', health: { value: 10, max: 10, destroyed: false } },
    c2: { id: 'c2', health: { value: 0, max: 10, destroyed: true } },
    c3: { id: 'c3', health: { value: 4, max: 10, destroyed: false } },
  };

  test('liveMembers excludes destroyed members', () => {
    expect(liveMembers(group, combatantsById).map((m) => m.id)).toEqual(['c1', 'c3']);
  });

  test('liveMembers returns nothing for a null group', () => {
    expect(liveMembers(null, combatantsById)).toEqual([]);
  });

  test('pooledResource sums only live members', () => {
    expect(pooledResource(group, combatantsById, 'health')).toEqual({ value: 14, max: 20 });
  });

  test('a member missing from combatantsById is treated as gone, not zero-filled', () => {
    const withMissing = { id: 'g2', memberCombatantIds: ['c1', 'missing'] };
    expect(pooledResource(withMissing, combatantsById, 'health')).toEqual({ value: 10, max: 10 });
  });
});

describe('groupAttackBonus', () => {
  const combatantsById = {
    c1: { id: 'c1', health: { destroyed: false } },
    c2: { id: 'c2', health: { destroyed: false } },
    c3: { id: 'c3', health: { destroyed: true } },
  };

  test('a solo (ungrouped) attacker gets no bonus', () => {
    expect(groupAttackBonus(null, combatantsById)).toBe(0);
  });

  test('a live group of 2 gets +1', () => {
    const group = { memberCombatantIds: ['c1', 'c2'] };
    expect(groupAttackBonus(group, combatantsById)).toBe(1);
  });

  test('a destroyed member no longer counts toward the bonus', () => {
    const group = { memberCombatantIds: ['c1', 'c3'] };
    expect(groupAttackBonus(group, combatantsById)).toBe(0);
  });
});

describe('applyAttackBonusToFormula', () => {
  test('a zero bonus leaves the formula untouched', () => {
    expect(applyAttackBonusToFormula('{1d6,1dm,1d6} + 4', 0)).toBe('{1d6,1dm,1d6} + 4');
  });
  test('a positive bonus is appended', () => {
    expect(applyAttackBonusToFormula('{1d6,1dm,1d6} + 4', 2)).toBe('{1d6,1dm,1d6} + 4 + 2');
  });
});

describe('bestVigilanceBySide', () => {
  test('picks the highest Vigilance per side, ignoring the other side', () => {
    const combatants = [
      { side: 'hero', vigilance: 3 },
      { side: 'hero', vigilance: 6 },
      { side: 'foe', vigilance: 5 },
    ];
    expect(bestVigilanceBySide(combatants)).toEqual({ hero: 6, foe: 5 });
  });

  test('a side with no combatants defaults to 0', () => {
    expect(bestVigilanceBySide([{ side: 'hero', vigilance: 2 }])).toEqual({ hero: 2, foe: 0 });
  });
});

describe('needsInitiativeReroll', () => {
  test('a tie needs a reroll', () => {
    expect(needsInitiativeReroll(11, 11)).toBe(true);
  });
  test('any difference does not', () => {
    expect(needsInitiativeReroll(12, 11)).toBe(false);
  });
});

describe('module/helpers/big-fight.mjs twin matches the shipping monolith', () => {
  test('every exported function is the same implementation', () => {
    expect(Object.keys(twin).sort()).toEqual([
      'applyAttackBonusToFormula',
      'bestVigilanceBySide',
      'combatantSideFromDisposition',
      'findGroup',
      'groupAttackBonus',
      'isBigFightEnabled',
      'liveMembers',
      'needsInitiativeReroll',
      'pooledResource',
    ]);
    expect(twin.groupAttackBonus({ memberCombatantIds: ['c1', 'c2'] }, {
      c1: { health: { destroyed: false } },
      c2: { health: { destroyed: false } },
    })).toBe(1);
  });
});
