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
