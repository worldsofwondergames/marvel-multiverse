/**
 * The arithmetic and permission rules behind the damage chat card's Take Damage
 * button (issue #131).
 *
 * These are pure functions on purpose. The chat message class around them needs
 * a live Foundry to exercise, but the rules that decide who was hit, how much
 * they take, and who is allowed to apply it are the parts worth testing, and
 * they do not need one.
 */

/**
 * Whether an attack roll beat a target's defense.
 *
 * A Fantastic roll doubles damage on a hit; it does not bypass the defense
 * check. Only an ultimate Fantastic (6 M 6) auto-succeeds regardless of the
 * target number, and that is a narrower case than `isFantastic` reports.
 * `_enrichAttackTargets` draws the Hit/Miss list from this and the damage
 * card decides who gets a button from the same call, so the two can never
 * disagree about what a hit is.
 *
 * @param {{total?: number}} attackRoll
 * @param {number} ac  The target's defense against the attacking ability.
 * @returns {boolean}
 */
export function isTargetHit(attackRoll, ac) {
  return Number(attackRoll?.total) >= Number(ac);
}

/**
 * Damage after the target's damage reduction is taken off the attacker's
 * multiplier.
 *
 * Rulebook: once DR meets or exceeds the multiplier the attack "does no damage
 * at all, not even from the attacker's Ability score bonus", so a zeroed
 * multiplier returns 0 rather than the bare ability score. Clamping the
 * multiplier first also stops DR above it from producing negative damage.
 *
 * A power that deals a fraction of regular damage passes it as `scale` — 0.5
 * for text reading "take half regular damage". Scale and the Fantastic doubling
 * are multiplied together and rounded **once**, at the end. Rounding the half
 * first and doubling that would overshoot regular damage on an odd total: for
 * 11, ceil(5.5) × 2 is 12, while ceil(11 × 0.5 × 2) is 11, which is what a
 * Fantastic on a half-damage power is meant to deal.
 *
 * Marvel Multiverse rounds up. The core rulebook works this through for
 * movement — a Run Speed of 5 gives a Climb Speed of 3, not 2 — and no rule in
 * the books rounds down.
 *
 * @param {object} args
 * @param {number} args.marvelDieTotal
 * @param {number} args.damageMultiplier   The attacker's multiplier for the ability used.
 * @param {number} [args.damageReduction]  The target's DR for this damage type.
 * @param {number} args.abilityValue       The attacker's score in the ability used.
 * @param {boolean} [args.fantastic]
 * @param {number} [args.scale]            Fraction of regular damage the power deals.
 * @returns {{amount: number, effectiveMultiplier: number}}
 */
export function computeDamage({
  marvelDieTotal,
  damageMultiplier,
  damageReduction = 0,
  abilityValue,
  fantastic = false,
  scale = 1,
}) {
  const effectiveMultiplier = Math.max(0, damageMultiplier - damageReduction);
  const regular =
    effectiveMultiplier === 0
      ? 0
      : marvelDieTotal * effectiveMultiplier + abilityValue;
  const amount = Math.ceil(regular * scale * (fantastic ? 2 : 1));
  return { amount, effectiveMultiplier };
}

/**
 * The actor field a damage type comes out of. Only `focus` diverts; everything
 * else, including an attack that named no damage type, comes off Health.
 * @param {string} damageType
 * @returns {string}
 */
export function damageValuePath(damageType) {
  return damageType === "focus" ? "system.focus.value" : "system.health.value";
}

/**
 * The DR field a damage type is reduced by, matching damageValuePath.
 * @param {string} damageType
 * @returns {string}
 */
export function damageReductionPath(damageType) {
  return damageType === "focus"
    ? "focusDamageReduction"
    : "healthDamageReduction";
}

/**
 * Whether this user may apply damage to this actor. The damage message is sent
 * to everyone, so the button has to be removed per viewer at render time rather
 * than left out when the message is built.
 * @param {User} user
 * @param {Actor} actor
 * @returns {boolean}
 */
export function canApplyDamage(user, actor) {
  if (!user || !actor) return false;
  if (user.isGM) return true;
  return actor.testUserPermission?.(user, "OWNER") === true;
}

/**
 * The applied list after a target's damage has been taken.
 *
 * A list rather than a keyed object because actor uuids contain a period
 * ("Actor.4kNqW..."), and Foundry expands periods in a flag key into nested
 * objects — a uuid used as a key would silently become a tree of one-character
 * levels.
 *
 * @param {string[]} applied  The existing list, if any.
 * @param {string} uuid
 * @returns {string[]}  A new list; the input is not modified.
 */
export function withApplied(applied, uuid) {
  const list = Array.isArray(applied) ? applied : [];
  if (list.includes(uuid)) return [...list];
  return [...list, uuid];
}
