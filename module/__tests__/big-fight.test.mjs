/* eslint-env jest */
// module/__tests__/big-fight.test.mjs
import {
  isBigFightEnabled,
  combatantSideFromDisposition,
  findGroup,
  liveMembers,
  pooledResource,
  distributePooledHealthDelta,
  distributePooledFocusDelta,
  groupAttackBonus,
  applyAttackBonusToFormula,
  bestVigilanceBySide,
  needsInitiativeReroll,
  nextInRangeValue,
  groupBestVigilance,
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

describe('distributePooledHealthDelta', () => {
  test('healing tops up the first live member before spilling to the next', () => {
    const group = { memberCombatantIds: ['c1', 'c2'] };
    const byId = {
      c1: { id: 'c1', health: { value: 5, max: 10, destroyed: false } },
      c2: { id: 'c2', health: { value: 5, max: 10, destroyed: false } },
    };
    expect(distributePooledHealthDelta(group, byId, 20)).toEqual([
      { id: 'c1', value: 10 },
      { id: 'c2', value: 10 },
    ]);
  });

  test('damage drains the first live member to 0 before spilling to the next', () => {
    const group = { memberCombatantIds: ['c1', 'c2'] };
    const byId = {
      c1: { id: 'c1', health: { value: 10, max: 10, destroyed: false } },
      c2: { id: 'c2', health: { value: 5, max: 10, destroyed: false } },
    };
    expect(distributePooledHealthDelta(group, byId, 0)).toEqual([
      { id: 'c1', value: 0 },
      { id: 'c2', value: 0 },
    ]);
  });

  test('a partial reduction comes entirely from the first live member when it can absorb it', () => {
    const group = { memberCombatantIds: ['c1', 'c2'] };
    const byId = {
      c1: { id: 'c1', health: { value: 10, max: 10, destroyed: false } },
      c2: { id: 'c2', health: { value: 5, max: 10, destroyed: false } },
    };
    expect(distributePooledHealthDelta(group, byId, 10)).toEqual([{ id: 'c1', value: 5 }]);
  });

  test('a member already at max is skipped and the rest spills to the next', () => {
    const group = { memberCombatantIds: ['c1', 'c2'] };
    const byId = {
      c1: { id: 'c1', health: { value: 10, max: 10, destroyed: false } },
      c2: { id: 'c2', health: { value: 5, max: 10, destroyed: false } },
    };
    expect(distributePooledHealthDelta(group, byId, 20)).toEqual([{ id: 'c2', value: 10 }]);
  });

  test('a destroyed member is skipped entirely, not zero-filled', () => {
    const group = { memberCombatantIds: ['c1', 'c2'] };
    const byId = {
      c1: { id: 'c1', health: { value: 0, max: 10, destroyed: true } },
      c2: { id: 'c2', health: { value: 5, max: 10, destroyed: false } },
    };
    expect(distributePooledHealthDelta(group, byId, 10)).toEqual([{ id: 'c2', value: 10 }]);
  });

  test('a typed value equal to the current pool total produces no updates', () => {
    const group = { memberCombatantIds: ['c1', 'c2'] };
    const byId = {
      c1: { id: 'c1', health: { value: 10, max: 10, destroyed: false } },
      c2: { id: 'c2', health: { value: 5, max: 10, destroyed: false } },
    };
    expect(distributePooledHealthDelta(group, byId, 15)).toEqual([]);
  });

  test('a typed value beyond the pool max discards the unusable remainder', () => {
    const group = { memberCombatantIds: ['c1', 'c2'] };
    const byId = {
      c1: { id: 'c1', health: { value: 5, max: 10, destroyed: false } },
      c2: { id: 'c2', health: { value: 5, max: 10, destroyed: false } },
    };
    expect(distributePooledHealthDelta(group, byId, 999)).toEqual([
      { id: 'c1', value: 10 },
      { id: 'c2', value: 10 },
    ]);
  });

  test('no live members produces no updates', () => {
    const group = { memberCombatantIds: ['c1'] };
    const byId = { c1: { id: 'c1', health: { value: 0, max: 10, destroyed: true } } };
    expect(distributePooledHealthDelta(group, byId, 5)).toEqual([]);
  });
});

describe('distributePooledFocusDelta', () => {
  test('damage drains the first live member to 0 before spilling to the next', () => {
    const group = { memberCombatantIds: ['c1', 'c2'] };
    const byId = {
      c1: { id: 'c1', focus: { value: 10, max: 10, destroyed: false } },
      c2: { id: 'c2', focus: { value: 5, max: 10, destroyed: false } },
    };
    expect(distributePooledFocusDelta(group, byId, 0)).toEqual([
      { id: 'c1', value: 0 },
      { id: 'c2', value: 0 },
    ]);
  });

  test('healing tops up the first live member before spilling to the next', () => {
    const group = { memberCombatantIds: ['c1', 'c2'] };
    const byId = {
      c1: { id: 'c1', focus: { value: 5, max: 10, destroyed: false } },
      c2: { id: 'c2', focus: { value: 5, max: 10, destroyed: false } },
    };
    expect(distributePooledFocusDelta(group, byId, 20)).toEqual([
      { id: 'c1', value: 10 },
      { id: 'c2', value: 10 },
    ]);
  });

  test('a member dropped out by Health is skipped for Focus too, not zero-filled', () => {
    // liveMembers gates on Health, not Focus -- a foe is out of the fight
    // once its Health is gone, regardless of how much Focus it has left.
    const group = { memberCombatantIds: ['c1', 'c2'] };
    const byId = {
      c1: { id: 'c1', health: { destroyed: true }, focus: { value: 8, max: 10, destroyed: false } },
      c2: { id: 'c2', health: { destroyed: false }, focus: { value: 5, max: 10, destroyed: false } },
    };
    expect(distributePooledFocusDelta(group, byId, 10)).toEqual([{ id: 'c2', value: 10 }]);
  });

  test('reading Focus does not touch a member\'s Health', () => {
    const group = { memberCombatantIds: ['c1'] };
    const byId = {
      c1: { id: 'c1', health: { value: 7, max: 10, destroyed: false }, focus: { value: 5, max: 10, destroyed: false } },
    };
    expect(distributePooledFocusDelta(group, byId, 10)).toEqual([{ id: 'c1', value: 10 }]);
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

describe('groupBestVigilance', () => {
  test('picks the highest Vigilance among the group\'s own members', () => {
    const group = { memberCombatantIds: ['c1', 'c2', 'c3'] };
    const byId = {
      c1: { vigilance: 2 },
      c2: { vigilance: 5 },
      c3: { vigilance: 3 },
    };
    expect(groupBestVigilance(group, byId)).toBe(5);
  });

  test('ignores a combatant outside the group even if higher', () => {
    const group = { memberCombatantIds: ['c1'] };
    const byId = { c1: { vigilance: 2 }, c9: { vigilance: 9 } };
    expect(groupBestVigilance(group, byId)).toBe(2);
  });

  test('no group is 0', () => {
    expect(groupBestVigilance(null, {})).toBe(0);
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

describe('pooled resource shrinks as members are destroyed one at a time', () => {
  test('the pool drops immediately when a member flips to destroyed, without needing to remove it from the group', () => {
    const group = { memberCombatantIds: ['c1', 'c2'] };
    const before = {
      c1: { health: { value: 5, max: 10, destroyed: false } },
      c2: { health: { value: 5, max: 10, destroyed: false } },
    };
    expect(pooledResource(group, before, 'health')).toEqual({ value: 10, max: 20 });

    const afterOneDrops = {
      c1: { health: { value: 5, max: 10, destroyed: false } },
      c2: { health: { value: 0, max: 10, destroyed: true } },
    };
    expect(pooledResource(group, afterOneDrops, 'health')).toEqual({ value: 5, max: 10 });
  });
});

describe('in-range marker', () => {
  test('nextInRangeValue flips an unset marker to true', () => {
    expect(nextInRangeValue(undefined)).toBe(true);
  });
  test('nextInRangeValue flips true to false', () => {
    expect(nextInRangeValue(true)).toBe(false);
  });
  test('nextInRangeValue flips false to true', () => {
    expect(nextInRangeValue(false)).toBe(true);
  });
});

describe('the twin agrees with the shipping monolith', () => {
  test('exports the same 14 function names', () => {
    expect(Object.keys(twin).sort()).toEqual([
      'applyAttackBonusToFormula',
      'bestVigilanceBySide',
      'combatantSideFromDisposition',
      'distributePooledFocusDelta',
      'distributePooledHealthDelta',
      'findGroup',
      'groupAttackBonus',
      'groupBestVigilance',
      'groupDamageTargetsByGroup',
      'isBigFightEnabled',
      'liveMembers',
      'needsInitiativeReroll',
      'nextInRangeValue',
      'pooledResource',
    ]);
  });

  test.each([null, { enabled: false }, { enabled: true }])(
    'isBigFightEnabled matches for %o',
    (bigFight) => {
      expect(twin.isBigFightEnabled(bigFight)).toBe(isBigFightEnabled(bigFight));
    }
  );

  test.each([
    [-1, -1],
    [1, -1],
    [0, -1],
  ])('combatantSideFromDisposition matches for disposition %i hostile %i', (d, h) => {
    expect(twin.combatantSideFromDisposition(d, h)).toBe(combatantSideFromDisposition(d, h));
  });

  test('findGroup matches with mixed live and destroyed members', () => {
    const groups = [
      { id: 'g1', memberCombatantIds: ['c1', 'c2'] },
      { id: 'g2', memberCombatantIds: ['c3'] },
    ];
    expect(twin.findGroup(groups, 'c3')).toEqual(findGroup(groups, 'c3'));
  });

  test('liveMembers matches with mixed live and destroyed members', () => {
    const group = { id: 'g1', memberCombatantIds: ['c1', 'c2', 'c3'] };
    const combatantsById = {
      c1: { id: 'c1', health: { value: 10, max: 10, destroyed: false } },
      c2: { id: 'c2', health: { value: 0, max: 10, destroyed: true } },
      c3: { id: 'c3', health: { value: 4, max: 10, destroyed: false } },
    };
    expect(twin.liveMembers(group, combatantsById)).toEqual(liveMembers(group, combatantsById));
  });

  test('pooledResource matches with mixed live and destroyed members', () => {
    const group = { id: 'g1', memberCombatantIds: ['c1', 'c2', 'c3'] };
    const combatantsById = {
      c1: { id: 'c1', health: { value: 10, max: 10, destroyed: false } },
      c2: { id: 'c2', health: { value: 0, max: 10, destroyed: true } },
      c3: { id: 'c3', health: { value: 4, max: 10, destroyed: false } },
    };
    expect(twin.pooledResource(group, combatantsById, 'health')).toEqual(
      pooledResource(group, combatantsById, 'health')
    );
  });

  test('distributePooledHealthDelta matches for a partial reduction', () => {
    const group = { memberCombatantIds: ['c1', 'c2'] };
    const combatantsById = {
      c1: { id: 'c1', health: { value: 10, max: 10, destroyed: false } },
      c2: { id: 'c2', health: { value: 5, max: 10, destroyed: false } },
    };
    expect(twin.distributePooledHealthDelta(group, combatantsById, 10)).toEqual(
      distributePooledHealthDelta(group, combatantsById, 10)
    );
  });

  test('distributePooledFocusDelta matches for a partial reduction', () => {
    const group = { memberCombatantIds: ['c1', 'c2'] };
    const combatantsById = {
      c1: { id: 'c1', focus: { value: 10, max: 10, destroyed: false } },
      c2: { id: 'c2', focus: { value: 5, max: 10, destroyed: false } },
    };
    expect(twin.distributePooledFocusDelta(group, combatantsById, 10)).toEqual(
      distributePooledFocusDelta(group, combatantsById, 10)
    );
  });

  test('groupAttackBonus matches with live group of 2', () => {
    const group = { memberCombatantIds: ['c1', 'c2'] };
    const combatantsById = {
      c1: { id: 'c1', health: { destroyed: false } },
      c2: { id: 'c2', health: { destroyed: false } },
    };
    expect(twin.groupAttackBonus(group, combatantsById)).toBe(
      groupAttackBonus(group, combatantsById)
    );
  });

  test('groupBestVigilance matches for a group of 3 with mixed Vigilance', () => {
    const group = { memberCombatantIds: ['c1', 'c2', 'c3'] };
    const combatantsById = { c1: { vigilance: 2 }, c2: { vigilance: 5 }, c3: { vigilance: 3 } };
    expect(twin.groupBestVigilance(group, combatantsById)).toBe(
      groupBestVigilance(group, combatantsById)
    );
  });

  test.each([
    ['{1d6,1dm,1d6} + 4', 0],
    ['{1d6,1dm,1d6} + 4', 2],
  ])('applyAttackBonusToFormula matches for %s with bonus %i', (formula, bonus) => {
    expect(twin.applyAttackBonusToFormula(formula, bonus)).toBe(
      applyAttackBonusToFormula(formula, bonus)
    );
  });

  test('bestVigilanceBySide matches with mixed hero and foe list', () => {
    const combatants = [
      { side: 'hero', vigilance: 3 },
      { side: 'hero', vigilance: 6 },
      { side: 'foe', vigilance: 5 },
    ];
    expect(twin.bestVigilanceBySide(combatants)).toEqual(bestVigilanceBySide(combatants));
  });

  test.each([
    [11, 11],
    [12, 11],
  ])('needsInitiativeReroll matches for heroTotal %i foeTotal %i', (h, f) => {
    expect(twin.needsInitiativeReroll(h, f)).toBe(needsInitiativeReroll(h, f));
  });

  test.each([undefined, true, false])('nextInRangeValue matches for %o', (current) => {
    expect(twin.nextInRangeValue(current)).toBe(nextInRangeValue(current));
  });
});
