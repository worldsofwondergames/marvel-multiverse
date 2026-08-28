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
 * Whether a d616 roll is an ultimate Fantastic (6M6) result on an Initiative
 * check -- the Marvel die shows its Fantastic face and both d6 dice show 6.
 *
 * @param {{dice: object[]}} roll
 * @param {string} flavor
 * @returns {boolean}
 */
export function isUltimateFantasticInitiative(roll, flavor) {
  if (!flavor || !flavor.includes("Initiative")) return false;
  const dice = roll?.dice ?? [];
  if (dice.length < 3) return false;
  return marvelDieIsFantastic(dice[1]) && dice[0]?.total === 6 && dice[2]?.total === 6;
}
