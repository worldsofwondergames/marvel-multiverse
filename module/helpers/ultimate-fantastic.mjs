/**
 * Whether the Marvel die term of a d616 roll shows its Fantastic (M) face.
 *
 * DiceTerm has no singular `.result` property -- only `.total` (which
 * MarvelDie maps a raw 6 to as well as the M face, making it ambiguous) and
 * `.results`, an array of individual roll results. This reads the raw face
 * of the active result directly.
 *
 * @param {{results: {result: number, active?: boolean}[]}} marvelDieTerm
 * @returns {boolean}
 */
function marvelDieIsFantastic(marvelDieTerm) {
  const results = marvelDieTerm?.results ?? [];
  const active = results.find((r) => r.active) ?? results[results.length - 1];
  return active?.result === 1;
}

/**
 * Whether a d616 roll is an ultimate Fantastic (6M6) result. The Marvel die
 * shows its Fantastic face and both d6 dice show 6.
 *
 * @param {{dice: object[]}} roll
 * @returns {boolean}
 */
export function isUltimateFantastic(roll) {
  const dice = roll?.dice ?? [];
  if (dice.length < 3) return false;
  return marvelDieIsFantastic(dice[1]) && dice[0]?.total === 6 && dice[2]?.total === 6;
}

/**
 * Whether a d616 roll is an ultimate Fantastic (6M6) result on an Initiative
 * check.
 *
 * @param {{dice: object[]}} roll
 * @param {string} flavor
 * @returns {boolean}
 */
export function isUltimateFantasticInitiative(roll, flavor) {
  if (!flavor || !flavor.includes("Initiative")) return false;
  return isUltimateFantastic(roll);
}

/**
 * Turn the Marvel die of an evaluated d616 roll to its M face. The M counts
 * as 6, so the total rises by the difference between 6 and the face shown.
 *
 * @param {{dice: object[], total: number}} roll
 * @returns {boolean}  False when the Marvel die already shows an M.
 */
export function turnMarvelDieToM(roll) {
  const active = roll?.dice?.[1]?.results.find((r) => r.active);
  if (!active || active.result === 1) return false;
  roll._total = roll.total - active.result + 6;
  active.result = 1;
  active.count = 6;
  return true;
}
