/* eslint-env jest */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

/**
 * Marvel IP belongs in the marvel-multiverse-data module, not in the system.
 *
 * `sources.test.mjs` checks the `sources` registry, but only that object. IP has
 * repeatedly arrived by other routes instead — character names in test
 * fixtures, a sourcebook title in a code comment — and each time it took a
 * manual read to notice. This scans the tracked source text so the build fails
 * instead.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');

/**
 * Character names, character-specific gear, and sourcebook titles.
 *
 * Deliberately excluded:
 * - "Spider-Powers" is a power-set label the rulebook defines and content
 *   modules key off. Removing it is a separate decision, not a scan finding.
 * - "Marvel" alone: the system is named for the game, and README.md carries the
 *   required "not associated with Marvel Entertainment" disclaimer.
 */
const IP_TERMS = [
  'Avengers', 'X-Men', 'Spider-Verse', 'Fantastic Four', 'Guardians of the Galaxy',
  'Spider-Man', 'Iron Man', 'Captain America', 'Thor', 'Hulk', 'Black Widow',
  'Hawkeye', 'Wolverine', 'Magneto', 'Doctor Strange', 'Black Panther',
  'Daredevil', 'Deadpool', 'Thanos', 'Loki', 'Venom', 'Jean Grey', 'Professor X',
  'Doctor Doom', 'Ultron', 'Galactus', 'Kang', 'Hydra', 'S.H.I.E.L.D',
  'Wakanda', 'Asgard', 'Latveria', 'Oscorp', 'Daily Bugle',
  'Unibeam', 'Web-Shooter', 'Wall-Crawling', 'Phoenix Force', 'Celestial Seed',
  'Mutant Growth Hormone', 'Carrion Virus', 'Transmode Virus',
];

/**
 * Files exempt from the scan, with a reason for each. Nothing is excluded
 * merely because it currently fails.
 */
const EXEMPT = new Set([
  // Records shipped releases, including sourcebook support added in the past.
  'CHANGELOG.md',
  // States the game the system implements and the required legal disclaimer.
  'README.md',
  // Both of these tests necessarily contain the terms they check for.
  'module/__tests__/no-marvel-ip.test.mjs',
  'module/__tests__/sources.test.mjs',
]);

/** Tracked text files, via git so untracked scratch files are never scanned. */
function trackedTextFiles() {
  const out = execFileSync('git', ['ls-files'], { cwd: REPO_ROOT, encoding: 'utf8' });
  return out
    .split('\n')
    .map((f) => f.trim())
    .filter(Boolean)
    .filter((f) => /\.(mjs|js|json|hbs|scss|css|md|html)$/.test(f))
    .filter((f) => !EXEMPT.has(f))
    .filter((f) => f !== 'package-lock.json')
    .filter((f) => !f.startsWith('css/')); // generated from src/scss
}

describe('the system repo carries no Marvel IP', () => {
  test('git ls-files returns a populated file list', () => {
    // Without this the scan below would pass by scanning nothing at all.
    const files = trackedTextFiles();
    expect(files.length).toBeGreaterThan(50);
    expect(files).toContain('marvel-multiverse.mjs');
  });

  test('no tracked source file mentions a Marvel character, place or sourcebook', () => {
    const hits = [];
    for (const file of trackedTextFiles()) {
      const text = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');
      const lines = text.split('\n');
      lines.forEach((line, i) => {
        for (const term of IP_TERMS) {
          if (line.includes(term)) hits.push(`${file}:${i + 1}  ${term}  ${line.trim().slice(0, 80)}`);
        }
      });
    }
    expect(hits).toEqual([]);
  });
});

/**
 * The term list above catches names. It does not catch rules prose, which is
 * how six test fixtures ended up holding published sentences copied out of the
 * compendium while the roll-link patterns were worked out.
 *
 * Comparing against the data module directly is not an option, because the
 * system must build without it. Instead the repo stores hashes of every
 * twelve-word run in the compendium text. A hash recognises a phrase without
 * containing it, so the check ships no published text.
 *
 * Regenerate after the compendium changes:
 *   node utils/build-rules-fingerprints.mjs
 */
describe('the system repo carries no copied rules prose', () => {
  const FINGERPRINTS = path.join(HERE, 'fixtures', 'rules-prose.hashes');
  const haveFingerprints = fs.existsSync(FINGERPRINTS);

  // Files whose whole job is handling this text, plus the generator itself.
  const PROSE_EXEMPT = new Set([
    'module/__tests__/no-marvel-ip.test.mjs',
    'utils/build-rules-fingerprints.mjs',
  ]);

  test('the fingerprint file is present and populated', () => {
    // A missing or empty file would make the scan below pass by checking
    // nothing, which is the failure mode this whole test exists to avoid.
    expect(haveFingerprints).toBe(true);
    const count = fs.readFileSync(FINGERPRINTS, 'utf8').split('\n').filter(Boolean).length;
    expect(count).toBeGreaterThan(10_000);
  });

  test('no tracked source file repeats twelve consecutive words of compendium text', async () => {
    const { fingerprints } = await import('../../utils/build-rules-fingerprints.mjs');
    const known = new Set(fs.readFileSync(FINGERPRINTS, 'utf8').split('\n').filter(Boolean));

    const hits = [];
    for (const file of trackedTextFiles()) {
      if (PROSE_EXEMPT.has(file)) continue;
      const text = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');
      for (const hash of fingerprints(text)) {
        if (known.has(hash)) hits.push(`${file}  matches compendium prose (${hash})`);
      }
    }
    expect(hits).toEqual([]);
  });

  test('twelve words fingerprint, eleven do not', async () => {
    // The window is what keeps ordinary rules vocabulary from matching. Shrink
    // it and common phrasing starts tripping the scan; grow it and real copied
    // sentences slip through.
    //
    // Twelve is written out rather than read from WINDOW. Building the input
    // from the constant under test would move both sides together and the
    // assertion could never fail.
    const { fingerprints } = await import('../../utils/build-rules-fingerprints.mjs');
    const words = Array.from({ length: 13 }, (_, i) => `word${i}`);

    expect(fingerprints(words.slice(0, 11).join(' ')).size).toBe(0);
    expect(fingerprints(words.slice(0, 12).join(' ')).size).toBe(1);
    expect(fingerprints(words.join(' ')).size).toBe(2);
  });

  test('formatting and punctuation do not hide a match', async () => {
    // Text reaches this scan as HTML in some files and plain prose in others,
    // so the same sentence has to fingerprint identically either way.
    const { fingerprints } = await import('../../utils/build-rules-fingerprints.mjs');
    const plain = 'one two three four five six seven eight nine ten eleven twelve';
    const marked = '<p>One, two &mdash; three four five; six "seven" eight nine ten eleven twelve!</p>';

    expect([...fingerprints(marked)]).toEqual([...fingerprints(plain)]);
  });
});
