/**
 * Whether an actor owns a Villainous tag item, gating access to Sinister Plot
 * Points.
 *
 * @param {{type: string, name: string}[]} items
 * @returns {boolean}
 */
export function isVillainous(items) {
  return (items ?? []).some((i) => i.type === "tag" && i.name === "Villainous");
}
