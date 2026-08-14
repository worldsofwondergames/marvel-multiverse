/**
 * Hashing for the rules-prose scan in no-marvel-ip.test.mjs.
 *
 * The system repo must not contain published rules text, so it stores hashes of
 * it instead. A hash lets the test recognise a phrase it is given without
 * holding the phrase itself.
 *
 * Only the hashing is here. Reading a compendium and writing the fingerprint
 * file is the content module's job, because the text is there and this repo
 * has to build with no content module present. Nothing in this file knows
 * where the text comes from.
 */
import crypto from "node:crypto";

/**
 * How many consecutive words make a fingerprint.
 *
 * Long enough that ordinary rules vocabulary does not collide. A sentence like
 * "the character makes an Ego check against the target's Logic defense" is
 * eleven words and is the sort of thing any implementation would write, so the
 * window sits above that to avoid flagging our own test fixtures.
 */
export const WINDOW = 12;

/** Enough hash to make an accidental match vanishingly unlikely. */
const HASH_CHARS = 12;

/**
 * Strip markup and punctuation so wording is compared, not formatting.
 *
 * Entities have to be resolved rather than stripped as text. Left alone,
 * `&mdash;` becomes the word "mdash" and shifts every following word out of
 * alignment, which is enough for copied prose to slip past the scan. The
 * apostrophe entities matter for the opposite reason: turning them into spaces
 * would split "character's" into two words.
 */
export function normalise(text) {
  return String(text ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:rsquo|lsquo|apos|#39|#8217);/gi, "'")
    .replace(/&(?:#\d+|#x[0-9a-f]+|[a-z]+);/gi, " ")
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^a-z0-9']+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Every WINDOW-word run in the text, hashed. */
export function fingerprints(text, window = WINDOW) {
  const words = normalise(text).split(" ").filter(Boolean);
  const out = new Set();
  for (let i = 0; i + window <= words.length; i++) {
    const run = words.slice(i, i + window).join(" ");
    out.add(crypto.createHash("sha1").update(run).digest("hex").slice(0, HASH_CHARS));
  }
  return out;
}
