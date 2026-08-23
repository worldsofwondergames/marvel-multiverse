/**
 * The pure arithmetic and lookups behind Big Fight mode (issue #75): side
 * initiative, foe grouping, pooled Health/Focus, and the group attack bonus.
 *
 * Every function here is pure — no Foundry Document is touched. The glue that
 * adapts a real Combat/Combatant into the plain shapes these take. That glue is mirrored in
 * marvel-multiverse.mjs next to the other combat hooks, the same split
 * damage-application.mjs uses for computeDamage/isTargetHit.
 */

/** @param {{enabled?: boolean}|null} bigFight */
export function isBigFightEnabled(bigFight) {
  return bigFight?.enabled === true;
}

/**
 * Foundry token disposition only distinguishes hostile from everything else
 * for this feature's purposes — neutral and secret tokens act with the
 * heroes' side rather than blocking on a third turn phase the rules don't
 * define.
 * @param {number} disposition
 * @param {number} hostileValue  CONST.TOKEN_DISPOSITIONS.HOSTILE, passed in
 *   so this file never needs a live Foundry CONST to be testable.
 * @returns {"hero"|"foe"}
 */
export function combatantSideFromDisposition(disposition, hostileValue) {
  return disposition === hostileValue ? "foe" : "hero";
}

/**
 * @param {Array<{id: string, memberCombatantIds: string[]}>|undefined} groups
 * @param {string} combatantId
 * @returns {object|null}
 */
export function findGroup(groups, combatantId) {
  return (groups ?? []).find((g) => g.memberCombatantIds.includes(combatantId)) ?? null;
}

/**
 * @param {{memberCombatantIds: string[]}|null} group
 * @param {Record<string, {health?: {destroyed?: boolean}}>} combatantsById
 * @returns {object[]}
 */
export function liveMembers(group, combatantsById) {
  if (!group) return [];
  return group.memberCombatantIds
    .map((id) => combatantsById[id])
    .filter((c) => c && c.health?.destroyed !== true);
}

/**
 * @param {object|null} group
 * @param {Record<string, object>} combatantsById
 * @param {"health"|"focus"} resource
 * @returns {{value: number, max: number}}
 */
export function pooledResource(group, combatantsById, resource) {
  return liveMembers(group, combatantsById).reduce(
    (acc, c) => ({
      value: acc.value + (c[resource]?.value ?? 0),
      max: acc.max + (c[resource]?.max ?? 0),
    }),
    { value: 0, max: 0 }
  );
}

/**
 * "+1 per additional foe beyond the first" — a live group of `n` members
 * grants `n - 1`. A destroyed member stops counting toward its own group's
 * bonus the moment it drops, same round.
 * @param {object|null} group
 * @param {Record<string, object>} combatantsById
 * @returns {number}
 */
export function groupAttackBonus(group, combatantsById) {
  if (!group) return 0;
  return Math.max(0, liveMembers(group, combatantsById).length - 1);
}

/**
 * @param {string} formula
 * @param {number} bonus
 * @returns {string}
 */
export function applyAttackBonusToFormula(formula, bonus) {
  return bonus ? `${formula} + ${bonus}` : formula;
}

/**
 * @param {Array<{side: "hero"|"foe", vigilance: number}>} combatants
 * @returns {{hero: number, foe: number}}
 */
export function bestVigilanceBySide(combatants) {
  const totals = { hero: 0, foe: 0 };
  for (const c of combatants) {
    if (c.vigilance > totals[c.side]) totals[c.side] = c.vigilance;
  }
  return totals;
}

/**
 * Ties are re-rolled once rather than settled by house rule, since the book
 * does not say who goes first on a tie.
 * @param {number} heroTotal
 * @param {number} foeTotal
 * @returns {boolean}
 */
export function needsInitiativeReroll(heroTotal, foeTotal) {
  return heroTotal === foeTotal;
}

/**
 * @param {boolean|undefined} current
 * @returns {boolean}
 */
export function nextInRangeValue(current) {
  return current !== true;
}

/**
 * Buckets declared damage targets by the Big Fight group they belong to, so
 * the damage card can print "Rival Gang: 2 hit, 1 missed" instead of three
 * unassociated lines. Consecutive targets sharing a group merge into one
 * bucket; a target with no group (or grouping disabled) gets a bucket of one,
 * preserving today's per-target line for anyone not in Big Fight mode.
 * @param {Array<{uuid: string, combatantId?: string}>} targets
 * @param {Array<{id: string, memberCombatantIds: string[]}>} groups
 * @returns {Array<{group: object|null, targets: object[]}>}
 */
export function groupDamageTargetsByGroup(targets, groups) {
  const buckets = [];
  for (const target of targets) {
    const group = target.combatantId ? findGroup(groups, target.combatantId) : null;
    const last = buckets.at(-1);
    if (group && last?.group?.id === group.id) {
      last.targets.push(target);
    } else {
      buckets.push({ group, targets: [target] });
    }
  }
  return buckets;
}
