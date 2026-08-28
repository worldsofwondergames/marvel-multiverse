/* eslint-env jest */
// module/__tests__/big-fight-damage-card.test.mjs
import { groupDamageTargetsByGroup } from '../../marvel-multiverse.mjs';
import * as twin from '../helpers/big-fight.mjs';

describe('groupDamageTargetsByGroup', () => {
  const groups = [{ id: 'g1', name: 'Rival Gang', memberCombatantIds: ['c1', 'c2'] }];

  test('targets sharing a group are bucketed together, in declared order', () => {
    const targets = [
      { uuid: 'Actor.1', combatantId: 'c1' },
      { uuid: 'Actor.2', combatantId: 'c2' },
    ];
    const result = groupDamageTargetsByGroup(targets, groups);
    expect(result).toEqual([{ group: groups[0], targets }]);
  });

  test('a target with no group gets its own bucket', () => {
    const targets = [{ uuid: 'Actor.3', combatantId: 'c9' }];
    expect(groupDamageTargetsByGroup(targets, groups)).toEqual([{ group: null, targets }]);
  });

  test('mixed grouped and ungrouped targets stay in declared order across buckets', () => {
    const targets = [
      { uuid: 'Actor.3', combatantId: 'c9' },
      { uuid: 'Actor.1', combatantId: 'c1' },
      { uuid: 'Actor.2', combatantId: 'c2' },
    ];
    const result = groupDamageTargetsByGroup(targets, groups);
    expect(result).toEqual([
      { group: null, targets: [targets[0]] },
      { group: groups[0], targets: [targets[1], targets[2]] },
    ]);
  });

  test('two ungrouped targets each get their own bucket rather than merging', () => {
    const targets = [
      { uuid: 'Actor.9', combatantId: 'c9' },
      { uuid: 'Actor.8', combatantId: 'c8' },
    ];
    expect(groupDamageTargetsByGroup(targets, groups)).toEqual([
      { group: null, targets: [targets[0]] },
      { group: null, targets: [targets[1]] },
    ]);
  });

  test('non-consecutive targets from the same group do not merge across an intervening bucket', () => {
    const targets = [
      { uuid: 'Actor.1', combatantId: 'c1' },
      { uuid: 'Actor.3', combatantId: 'c9' },
      { uuid: 'Actor.2', combatantId: 'c2' },
    ];
    expect(groupDamageTargetsByGroup(targets, groups)).toEqual([
      { group: groups[0], targets: [targets[0]] },
      { group: null, targets: [targets[1]] },
      { group: groups[0], targets: [targets[2]] },
    ]);
  });

  test('twin matches the shipping implementation', () => {
    expect(twin.groupDamageTargetsByGroup(
      [{ uuid: 'Actor.1', combatantId: 'c1' }],
      groups
    )).toEqual([{ group: groups[0], targets: [{ uuid: 'Actor.1', combatantId: 'c1' }] }]);
  });
});
