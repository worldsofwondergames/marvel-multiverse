/**
 * Rank X characters are past the numbered ranks. For one that chooses to be
 * fallible, the rules give ability scores of 20 (so defenses of 30), a damage
 * multiplier of 10, and 100 Focus spent at once.
 * The damage multiplier of an ordinary character is their rank, so 10 also
 * stands in wherever a Rank X character needs a rank number.
 */
export const RANK_X = { rank: 10, ability: 20, focusAtOnce: 100 };

/** Whether an actor's system data is marked Rank X. */
export function isRankX(system) {
  return system?.attributes?.rank?.x === true;
}

/** Whether a Rank X actor is using the fallible numbers. */
export function isFallible(system) {
  return isRankX(system) && system.attributes.rank.fallible === true;
}

/**
 * The most Focus a character may spend at once, which is five times their
 * rank. A Rank X character has no limit unless they are fallible.
 */
export function maxFocusSpend(system) {
  if (isFallible(system)) return RANK_X.focusAtOnce;
  if (isRankX(system)) return Infinity;
  return Number(system?.attributes?.rank?.value ?? 0) * 5;
}

/**
 * How many powers a character may concentrate on at once. It is one per
 * rank, and any number at Rank X.
 */
export function concentrationLimit(system) {
  if (isRankX(system)) return Infinity;
  return Number(system?.attributes?.rank?.value ?? 0);
}

/**
 * Read the Rank field of a submitted actor sheet. "X" marks the actor Rank X,
 * a whole number sets an ordinary rank, and anything else leaves the rank as
 * it was.
 *
 * @param {object} formData  The flat form data, changed in place.
 * @returns {boolean}  False when the field held text that was not understood,
 *                     so the sheet can put the real rank back on screen.
 */
export function applyRankInput(formData) {
  const key = "system.attributes.rank.value";
  if (!(key in formData)) return true;
  const text = String(formData[key]).trim();
  if (/^x$/i.test(text)) {
    formData["system.attributes.rank.x"] = true;
    delete formData[key];
    return true;
  }
  const value = Number(text);
  if (text === "" || !Number.isInteger(value)) {
    delete formData[key];
    return false;
  }
  formData[key] = value;
  formData["system.attributes.rank.x"] = false;
  formData["system.attributes.rank.fallible"] = false;
  return true;
}

/**
 * When an update turns the fallible numbers on, save the ability scores and
 * set each one to the fallible score in the same update. When an update turns
 * them off, put the saved scores back.
 *
 * @param {object} system   The actor's stored system data.
 * @param {object} changed  The update, as passed to `_preUpdate`.
 */
export function applyFallibleChange(system, changed) {
  const rank = changed.system?.attributes?.rank;
  // A headquarters or vehicle has no rank, so this comes before the rank is read.
  if (typeof rank?.fallible !== "boolean") return;
  if (rank.fallible === system.attributes.rank.fallible) return;
  const keys = Object.keys(system.abilities);
  const saved = system.attributes.rank.savedScores;
  if (rank.fallible) {
    rank.savedScores = Object.fromEntries(keys.map((key) => [key, system.abilities[key].value]));
  }
  changed.system.abilities ??= {};
  for (const key of keys) {
    const value = rank.fallible ? RANK_X.ability : saved[key];
    if (value !== undefined) (changed.system.abilities[key] ??= {}).value = value;
  }
}
