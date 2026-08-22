/**
 * Whether a d616 roll is an ultimate Fantastic (6M6) result on an Initiative
 * check -- the Marvel die shows a Fantastic success and both d6 dice show 6.
 *
 * @param {{isFantastic: boolean, dice: {total: number}[]}} roll
 * @param {string} flavor
 * @returns {boolean}
 */
export function isUltimateFantasticInitiative(roll, flavor) {
  if (!flavor || !flavor.includes("Initiative")) return false;
  if (!roll?.isFantastic) return false;
  const dice = roll.dice ?? [];
  return dice[0]?.total === 6 && dice[2]?.total === 6;
}
