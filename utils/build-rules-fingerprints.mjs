/**
 * Builds the fingerprint file that no-marvel-ip.test.mjs uses to spot rules
 * prose copied out of marvel-multiverse-data.
 *
 * The system repo must not contain the published text, so it stores hashes
 * instead. A hash lets the test recognise a phrase it is given without holding
 * the phrase itself.
 *
 * Run this when the data module's compendium text changes:
 *   node utils/build-rules-fingerprints.mjs
 *
 * It needs marvel-multiverse-data checked out beside the system. The test
 * skips itself when the fingerprint file is absent, so a fresh clone without
 * the data module still runs green.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..");
const OUT = path.join(REPO_ROOT, "module", "__tests__", "fixtures", "rules-prose.hashes");

/** Where the data module usually is, relative to the system. */
const DATA_MODULE = path.resolve(REPO_ROOT, "..", "..", "modules", "marvel-multiverse-data");
const SOURCE = path.join(DATA_MODULE, "compendium-items.md");

/**
 * How many consecutive words make a fingerprint.
 *
 * Long enough that ordinary rules vocabulary does not collide. "The character
 * makes an Ego check against the target's Logic defense" is eleven words and
 * is the sort of sentence any implementation would write, so the window has to
 * sit above that to avoid flagging our own test fixtures.
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

/** The prose lines of the compendium export, without its scaffolding. */
function prose(markdown) {
  return markdown
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (!t) return false;
      if (t.startsWith("#")) return false;      // section and item headings
      if (t.startsWith(">")) return false;      // the generated-file note
      if (t.startsWith("---")) return false;
      if (/^- \*\*(ID|Tags|Source|Power Sets?|Prerequisites?):\*\*/.test(t)) return false;
      return true;
    })
    .join("\n");
}

function build() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`Cannot find ${SOURCE}. Check out marvel-multiverse-data beside the system.`);
    process.exit(1);
  }
  const hashes = fingerprints(prose(fs.readFileSync(SOURCE, "utf8")));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, [...hashes].sort().join("\n") + "\n", "utf8");
  console.log(`${hashes.size} fingerprints -> ${path.relative(REPO_ROOT, OUT)}`);
}

// Only build when run directly. The test imports fingerprints() from here, and
// an import must not rewrite the file the test is about to read.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build();
}
