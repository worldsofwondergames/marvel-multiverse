/**
 * Whether an actor's owned powers satisfy a stunt's free-text prerequisite.
 *
 * Prerequisites are not power references -- several are compound ("Clobber and
 * Iconic Item") or a category ("A power that splits attacks in two") rather
 * than a single named power. A case-insensitive substring match against the
 * actor's power names catches the simple, single-power cases; compound and
 * category prerequisites will not match unless one of the actor's power names
 * happens to appear in the text, which is the correct, conservative outcome --
 * callers fall back to asking the GM/player to confirm instead.
 *
 * @param {string} prerequisite
 * @param {string[]} powerNames
 * @returns {boolean}
 */
export function stuntEligible(prerequisite, powerNames) {
  const text = String(prerequisite ?? "").trim().toLowerCase();
  if (!text) return false;
  return (powerNames ?? []).some((name) => {
    const n = String(name ?? "").trim().toLowerCase();
    return n && text.includes(n);
  });
}
