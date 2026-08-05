import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Every source file Foundry can load or Jest can import.
 * Excludes marvel-multiverse-compiled.mjs (generated), __mocks__ (deliberately
 * emulates old shapes), and e2e specs (they drive Foundry, they are not loaded by it).
 */
function sourceFiles() {
  const files = [path.join(ROOT, 'marvel-multiverse.mjs')];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '__mocks__' || entry.name === '__tests__') continue;
        walk(full);
      } else if (entry.name.endsWith('.mjs')) {
        files.push(full);
      }
    }
  };
  walk(path.join(ROOT, 'module'));
  return files;
}

/** Report matches as "relative/path.mjs:<line>: <trimmed source line>". */
function findMatches(pattern) {
  const hits = [];
  for (const file of sourceFiles()) {
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      if (pattern.test(line)) {
        hits.push(`${path.relative(ROOT, file)}:${i + 1}: ${line.trim()}`);
      }
    });
  }
  return hits;
}

describe('FoundryVTT v14 removed APIs', () => {
  test('sourceFiles() finds both the monolith and the module twins', () => {
    const rel = sourceFiles().map((f) => path.relative(ROOT, f).replace(/\\/g, '/'));
    expect(rel).toContain('marvel-multiverse.mjs');
    expect(rel).toContain('module/documents/chat-message.mjs');
    expect(rel.length).toBeGreaterThan(20);
  });

  test('CONFIG.ActiveEffect.legacyTransferral is not referenced (removed in v14)', () => {
    expect(findMatches(/legacyTransferral/)).toEqual([]);
  });

  test('ChatMessage#user is not used (removed in v14, use #author)', () => {
    expect(findMatches(/\bthis\.user\b/)).toEqual([]);
  });

  // Only ActiveEffect dropped `icon`. Dialog buttons and context-menu entries
  // still take an `icon` key holding an <i> tag, so match image-valued icons
  // only — those are the ActiveEffect ones.
  test('ActiveEffect#icon is not used (removed in v14, use #img)', () => {
    expect(findMatches(/^\s*icon:(?!\s*['"`]\s*<i[\s>])/)).toEqual([]);
  });

  test('Math.clamped is not used (removed in v14, use Math.clamp)', () => {
    expect(findMatches(/Math\.clamped\b/)).toEqual([]);
  });

  test('ActiveEffect#label is not used (removed in v14, use #name)', () => {
    expect(findMatches(/\beffect\.label\b/)).toEqual([]);
  });

  test('prepareBaseData() overrides call super.prepareBaseData() (v14 runs _clearData() there; skipping it breaks applyActiveEffects())', () => {
    const violations = [];
    for (const file of sourceFiles()) {
      const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
      lines.forEach((line, i) => {
        if (!/^\s*prepareBaseData\s*\(\s*\)\s*\{/.test(line)) return;
        // Brace-match from the opening line to find the end of the method body.
        let depth = 0;
        let end = i;
        for (let j = i; j < lines.length; j++) {
          for (const ch of lines[j]) {
            if (ch === '{') depth++;
            else if (ch === '}') depth--;
          }
          end = j;
          if (depth === 0) break;
        }
        const body = lines.slice(i, end + 1).join('\n');
        if (!/super\.prepareBaseData\s*\(\s*\)\s*;/.test(body)) {
          violations.push(`${path.relative(ROOT, file)}:${i + 1}: prepareBaseData() override does not call super.prepareBaseData()`);
        }
      });
    }
    expect(violations).toEqual([]);
  });
});

/**
 * These still work on v14 — Foundry only logs a deprecation warning — but the
 * bare globals are removed in v15. Each pattern uses a `(?<![.\w])` lookbehind
 * so the namespaced replacement and our own `MarvelMultiverse*Sheet` class names
 * don't trip it.
 */
describe('FoundryVTT v15 removed APIs', () => {
  test('bare Actors/Items collection globals are not used (use foundry.documents.collections.*)', () => {
    expect(findMatches(/(?<![.\w])(?:Actors|Items)\s*\./)).toEqual([]);
  });

  test('bare ActorSheet/ItemSheet globals are not used (use foundry.appv1.sheets.*)', () => {
    expect(findMatches(/(?<![.\w])(?:ActorSheet|ItemSheet)\b/)).toEqual([]);
  });

  test('bare renderTemplate/loadTemplates are not used (use foundry.applications.handlebars.*)', () => {
    expect(findMatches(/(?<![.\w])(?:renderTemplate|loadTemplates)\s*\(/)).toEqual([]);
  });
});
