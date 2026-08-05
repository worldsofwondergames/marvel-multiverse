/* eslint-env jest */
/**
 * `MARVEL_MULTIVERSE.sources` is an open registry, not a fixed list.
 *
 * The system ships only generic entries. Named sourcebooks are content rather
 * than mechanics, and are supplied by content modules that merge their own
 * entries in during `init`, the same way `namedTeamManeuvers` is populated.
 *
 * These tests pin what the system offers on its own, with no content module
 * installed. If a sourcebook name ever lands back in the system, this fails.
 *
 * Both trees are checked: `system.json` loads only `marvel-multiverse.mjs`, so
 * asserting on the `module/` twin alone would not prove anything about what
 * ships.
 */
import { MARVEL_MULTIVERSE as shipping } from '../../marvel-multiverse.mjs';
import { MARVEL_MULTIVERSE as twin } from '../config.mjs';

const EXPECTED = {
  core: 'Core Rulebook',
  coreModified: 'Core Rulebook (Modified)',
  homebrew: 'Homebrew',
};

const TREES = [
  ['shipping monolith', shipping],
  ['module twin', twin],
];

describe.each(TREES)('MARVEL_MULTIVERSE.sources — %s', (_name, config) => {
  test('exposes exactly the three generic sources', () => {
    expect(Object.keys(config.sources).sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  test('each source carries its expected label', () => {
    for (const [key, label] of Object.entries(EXPECTED)) {
      expect(config.sources[key]).toEqual({ label });
    }
  });

  test('carries no named sourcebook, which is content and belongs in a module', () => {
    const labels = Object.values(config.sources).map((s) => s.label).join(' | ');
    const keys = Object.keys(config.sources).join(' | ');
    for (const term of ['X-Men', 'Spider-Verse', 'Avengers', 'Hydra', 'Kang', 'Expansion']) {
      expect(labels).not.toContain(term);
    }
    for (const term of ['xmen', 'spiderverse', 'avengers', 'Hydra', 'Kang']) {
      expect(keys).not.toContain(term);
    }
  });
});

describe('MARVEL_MULTIVERSE.sources — parity', () => {
  test('both trees define the same sources', () => {
    expect(twin.sources).toEqual(shipping.sources);
  });

  test('the registry stays extensible so a content module can merge entries in', () => {
    // Guards the contract content modules rely on: a plain, writable object.
    // Object.freeze() here would silently break them at init.
    expect(Object.isFrozen(shipping.sources)).toBe(false);
    expect(Object.isExtensible(shipping.sources)).toBe(true);
  });
});
