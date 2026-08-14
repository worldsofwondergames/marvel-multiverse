/**
 * One-time repairs to world data.
 *
 * A compendium edit reaches nothing that has already been imported: an owned
 * item is an independent copy taken at the moment it was added to an actor.
 * When a field is added to the schema and backfilled in the compendium, every
 * copy already sitting on a character keeps the old value, so the world needs
 * its own pass.
 */

/**
 * Powers whose rules text says targets take half damage.
 *
 * Matched on the rule rather than on a list of power names: the system repo
 * carries no content, and a name list here would both duplicate the compendium
 * and go stale the moment content is added.
 */
const HALF_DAMAGE_RULE = /half\s+regular\s+damage/i;

/** The scale such a power should carry. */
export const HALF_DAMAGE_SCALE = 0.5;

/**
 * Whether one item still needs the half-damage scale applied.
 *
 * A value other than 1 is left alone, so a deliberate choice by a GM — or a
 * later correction — is never overwritten by this running again.
 *
 * @param {object} item  An item document or anything with `type` and `system`.
 * @returns {boolean}
 */
export function needsHalfDamageScale(item) {
  if (item?.type !== "power") return false;
  const scale = item?.system?.damageScale;
  if (scale !== undefined && scale !== null && scale !== 1) return false;
  return HALF_DAMAGE_RULE.test(item?.system?.effect ?? "");
}

/**
 * The updates required to bring a collection of items in line.
 *
 * Returns update payloads rather than applying them, so the decision of what
 * to change is testable without a database behind it.
 *
 * @param {Iterable<object>} items
 * @returns {Array<{_id: string, "system.damageScale": number}>}
 */
export function collectHalfDamageUpdates(items) {
  const updates = [];
  for (const item of items ?? []) {
    if (!needsHalfDamageScale(item)) continue;
    updates.push({ _id: item.id ?? item._id, "system.damageScale": HALF_DAMAGE_SCALE });
  }
  return updates;
}

/**
 * The fields that decide whether and how a power rolls as an attack.
 *
 * `formula` is deliberately absent: it holds the dice rather than the attack
 * configuration, it showed no drift, and it is the field a GM is most likely to
 * have altered on purpose.
 */
export const POWER_ATTACK_FIELDS = [
  "ability",
  "attack",
  "attackTarget",
  "attackKind",
  "damageType",
  "damageScale",
];

/**
 * Bring owned powers back in line with the compendium they came from.
 *
 * Powers imported before the attack fields were populated carry an empty
 * `ability` and `attack: false`, and a power in that state does not roll at
 * all — `Item#roll` needs both a formula and an ability. That is why powers
 * whose scale was corrected still dealt full damage: they were never rolled as
 * powers, so nothing carried the scale onto the message.
 *
 * The reference values win outright. That is a deliberate choice: these fields
 * describe what the published power is, not how one character uses it.
 *
 * @param {Iterable<object>} items
 * @param {Map<string, object>} referenceByName  Power name -> reference system data.
 * @returns {Array<object>}  Update payloads, one per item that differs.
 */
export function collectPowerSyncUpdates(items, referenceByName) {
  const updates = [];
  for (const item of items ?? []) {
    if (item?.type !== "power") continue;
    const reference = referenceByName?.get?.(item.name);
    if (!reference) continue;

    const update = {};
    for (const field of POWER_ATTACK_FIELDS) {
      const target = reference[field];
      // A field the reference does not define is not a reason to blank the
      // owned copy.
      if (target === undefined) continue;
      if (item.system?.[field] === target) continue;
      update[`system.${field}`] = target;
    }
    if (Object.keys(update).length === 0) continue;
    updates.push({ _id: item.id ?? item._id, ...update });
  }
  return updates;
}
