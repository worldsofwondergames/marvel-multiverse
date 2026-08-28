/**
 * How many power slots a power occupies.
 *
 * Ranked powers are named with their rank as a trailing number -- "Mighty 3",
 * "Elemental Protection 2". Taking rank N requires ranks 1 through N-1, so a
 * rank-N power occupies N slots. 71 of the 407 powers in the compendium are
 * named this way; everything else occupies one.
 *
 * @param {string} name  A power's name.
 * @returns {number}     Slots occupied, at least 1.
 */
export function powerSlotCost(name) {
  const rank = String(name ?? "").match(/\s+(\d+)$/);
  return rank ? Number(rank[1]) : 1;
}

/**
 * Total slots occupied by a list of powers.
 *
 * @param {Array<{name: string}>} powers  Powers, or the name-bearing snapshots
 *                                        an iconic item or battle suit stores.
 * @returns {number}
 */
export function sumPowerSlots(powers) {
  return (powers ?? []).reduce((total, power) => total + powerSlotCost(power?.name), 0);
}

/**
 * An iconic item's or battle suit's power value.
 *
 * Restrictions buy powers back, one slot each, and an item that carries
 * anything at all is worth at least 1.
 *
 * @param {Array<{name: string}>} powers
 * @param {Array<object>} restrictions
 * @returns {number}
 */
export function calculatePowerValue(powers, restrictions) {
  const slots = sumPowerSlots(powers);
  const restrictionsCount = restrictions?.length ?? 0;
  if (slots === 0 && restrictionsCount === 0) return 0;
  return Math.max(1, slots - restrictionsCount);
}
