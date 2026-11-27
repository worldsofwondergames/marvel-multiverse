/**
 * A shield thrown with a Shield Bearer power returns at the start of the
 * character's next turn. Until then the character cannot use other Shield
 * Bearer powers or get any benefit from the shield.
 */
export const SHIELD_POWER_SET = "Shield Bearer";

/** The status an actor has while their shield is away. */
export const SHIELD_THROWN = "shieldThrown";

/** Whether an item is a power in the Shield Bearer power set. */
export function isShieldBearerPower(item) {
  if (item?.type !== "power") return false;
  return (item.system?.powerSets ?? []).some((set) => set?.name === SHIELD_POWER_SET);
}

/**
 * Whether using a power throws the shield. Every Shield Bearer power that
 * throws it says in its effect that the shield bounces back to the character.
 */
export function throwsShield(item) {
  return isShieldBearerPower(item) && /bounces\s+back\s+to\s+the\s+character/i.test(item.system?.effect ?? "");
}

/**
 * Whether a power cannot be used because the shield is away. The power that
 * threw the shield stays usable, so its attack can be rolled and paid for.
 *
 * @param {object} state
 * @param {boolean} state.thrown    Whether the actor's shield is away.
 * @param {string} state.thrownBy   The id of the power that threw it.
 * @param {object} state.item       The power being used.
 */
export function shieldRefusesPower({ thrown, thrownBy, item }) {
  return !!thrown && isShieldBearerPower(item) && item.id !== thrownBy;
}
