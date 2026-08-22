/* eslint-env jest */
/**
 * `ItemDirectoryFilter._matchesFilters` decides which world items the sidebar
 * shows. Mirrors `actor-directory-filter.test.mjs`: each case names the items
 * it expects by name, so a predicate that silently starts matching everything
 * (or nothing) fails.
 */
import { ItemDirectoryFilter } from '../sidebar/mm-item-directory.mjs';

globalThis.CONFIG = {
  MARVEL_MULTIVERSE: {
    sources: {
      core: { label: "Core Rulebook" },
      coreModified: { label: "Core Rulebook (Modified)" },
      homebrew: { label: "Homebrew" },
    },
    equipmentTypes: {
      protection: "MARVEL_MULTIVERSE.Equipment.Protection",
      grenade: "MARVEL_MULTIVERSE.Equipment.Grenade.label",
      gadget: "MARVEL_MULTIVERSE.Equipment.Gadget",
      device: "MARVEL_MULTIVERSE.Equipment.Device",
      material: "MARVEL_MULTIVERSE.Equipment.Material",
    },
  },
};

/** Minimal item stand-in: `_matchesFilters` only reads `type`, `name`, `system`. */
function item(name, type, system = {}) {
  return { name, type, system };
}

const WEB_SHOOTERS = item('Web Shooters', 'weapon', { source: 'core' });
const SPIDER_SENSE = item('Spider-Sense', 'power', {
  source: 'core',
  powerSet: 'Spider-Powers, Agility',
  duration: 'Passive',
});
const ICE_BLAST = item('Ice Blast', 'power', {
  source: 'core',
  powerSet: 'Ice',
  duration: 'Instant',
});
const WALL_CRAWLING = item('Wall-Crawling', 'trait', { source: 'core' });
const WEBBED_UP = item('Webbed Up', 'tag', { source: 'homebrew' });
const IRON_ARMOR = item('Iron Man Armor', 'battleSuit', {
  source: 'coreModified',
  additionalTraits: ['Powered Armor'],
});
const GRAPPLING_GUN = item('Grappling Gun', 'equipment', { source: 'core', equipmentType: 'gadget' });
const FIRST_AID_KIT = item('First Aid Kit', 'equipment', { source: 'homebrew', equipmentType: 'device' });

const POPULATION = [
  WEB_SHOOTERS, SPIDER_SENSE, ICE_BLAST, WALL_CRAWLING, WEBBED_UP, IRON_ARMOR, GRAPPLING_GUN, FIRST_AID_KIT,
];

/** Apply `state` on top of the defaults and return the matching item names. */
function matching(state) {
  ItemDirectoryFilter.init();
  Object.assign(ItemDirectoryFilter._filterState, state);
  return POPULATION.filter((i) => ItemDirectoryFilter._matchesFilters(i)).map((i) => i.name);
}

beforeEach(() => ItemDirectoryFilter.init());

describe('no active filters', () => {
  test('matches every item', () => {
    expect(matching({})).toEqual([
      'Web Shooters', 'Spider-Sense', 'Ice Blast', 'Wall-Crawling', 'Webbed Up',
      'Iron Man Armor', 'Grappling Gun', 'First Aid Kit',
    ]);
  });

  test('_hasActiveFilters is false so the directory is left alone', () => {
    expect(ItemDirectoryFilter._hasActiveFilters()).toBe(false);
  });

  test('_hasActiveFilters is true once a filter is engaged', () => {
    ItemDirectoryFilter._filterState.tags = ['Webbed Up'];
    expect(ItemDirectoryFilter._hasActiveFilters()).toBe(true);
  });
});

describe('single filters select the right subset', () => {
  test('item type is a single value, not a list', () => {
    expect(matching({ itemType: 'weapon' })).toEqual(['Web Shooters']);
  });

  test('an empty item type applies no type filter', () => {
    expect(matching({ itemType: '' })).toEqual(POPULATION.map((i) => i.name));
  });

  test('source', () => {
    expect(matching({ source: ['homebrew'] })).toEqual(['Webbed Up', 'First Aid Kit']);
  });
});

describe('power set filtering only matches power items', () => {
  test('matches a set listed second in the comma-separated field', () => {
    expect(matching({ powerSets: ['Agility'] })).toEqual(['Spider-Sense']);
  });

  test('matches a set listed first', () => {
    expect(matching({ powerSets: ['Spider-Powers'] })).toEqual(['Spider-Sense']);
  });

  test('several selected sets match any of them', () => {
    expect(matching({ powerSets: ['Ice', 'Spider-Powers'] })).toEqual(['Spider-Sense', 'Ice Blast']);
  });

  test('an unmatched power set matches nothing', () => {
    expect(matching({ powerSets: ['Invisibility'] })).toEqual([]);
  });

  test('a non-power item never matches, even by coincidental text', () => {
    const decoy = { name: 'Decoy', type: 'trait', system: { powerSet: 'Ice' } };
    ItemDirectoryFilter.init();
    ItemDirectoryFilter._filterState.powerSets = ['Ice'];
    expect(ItemDirectoryFilter._matchesFilters(decoy)).toBe(false);
  });
});

describe('duration filtering only matches power items', () => {
  test('matches the power with that duration', () => {
    expect(matching({ duration: ['Instant'] })).toEqual(['Ice Blast']);
  });

  test('several selected durations match any of them', () => {
    expect(matching({ duration: ['Instant', 'Passive'] })).toEqual(['Spider-Sense', 'Ice Blast']);
  });

  test('a non-power item never matches a duration filter, even by coincidental text', () => {
    const decoy = { name: 'Decoy', type: 'trait', system: { duration: 'Instant' } };
    ItemDirectoryFilter.init();
    ItemDirectoryFilter._filterState.duration = ['Instant'];
    expect(ItemDirectoryFilter._matchesFilters(decoy)).toBe(false);
  });
});

describe('equipment type filtering only matches equipment items', () => {
  test('matches the equipment with that type', () => {
    expect(matching({ equipmentType: ['gadget'] })).toEqual(['Grappling Gun']);
  });

  test('several selected types match any of them', () => {
    expect(matching({ equipmentType: ['gadget', 'device'] })).toEqual(['Grappling Gun', 'First Aid Kit']);
  });

  test('an unmatched equipment type matches nothing', () => {
    expect(matching({ equipmentType: ['protection'] })).toEqual([]);
  });

  test('a non-equipment item never matches, even by coincidental text', () => {
    const decoy = { name: 'Decoy', type: 'trait', system: { equipmentType: 'gadget' } };
    ItemDirectoryFilter.init();
    ItemDirectoryFilter._filterState.equipmentType = ['gadget'];
    expect(ItemDirectoryFilter._matchesFilters(decoy)).toBe(false);
  });
});

describe('tags filtering only matches tag items', () => {
  test('matches the tag item by name', () => {
    expect(matching({ tags: ['Webbed Up'] })).toEqual(['Webbed Up']);
  });

  test('does not match a same-named power or trait', () => {
    expect(matching({ tags: ['Wall-Crawling'] })).toEqual([]);
  });
});

describe('traits filtering also reads battleSuit additionalTraits', () => {
  test('matches the trait item itself', () => {
    expect(matching({ traits: ['Wall-Crawling'] })).toEqual(['Wall-Crawling']);
  });

  test('matches a battleSuit carrying the trait as free text', () => {
    expect(matching({ traits: ['Powered Armor'] })).toEqual(['Iron Man Armor']);
  });
});

describe('AND vs OR across filter groups', () => {
  test('AND requires every group to hold', () => {
    expect(matching({ itemType: 'battleSuit', source: ['coreModified'] })).toEqual(['Iron Man Armor']);
  });

  test('AND on criteria that do not overlap excludes everything', () => {
    expect(matching({ itemType: 'tag', source: ['core'] })).toEqual([]);
  });

  test('OR admits an item matching only one group', () => {
    expect(matching({ logic: 'or', itemType: 'tag', source: ['core'] }))
      .toEqual(['Web Shooters', 'Spider-Sense', 'Ice Blast', 'Wall-Crawling', 'Webbed Up', 'Grappling Gun']);
  });
});

describe('active filter counting drives the badge and the early-out', () => {
  test('counts one per engaged group', () => {
    ItemDirectoryFilter.init();
    Object.assign(ItemDirectoryFilter._filterState, {
      itemType: 'weapon',
      source: ['core'],
      tags: ['Webbed Up'],
    });
    expect(ItemDirectoryFilter._countActiveFilters()).toBe(3);
  });

  test('empty arrays and an empty item type count as inactive', () => {
    ItemDirectoryFilter.init();
    Object.assign(ItemDirectoryFilter._filterState, { itemType: '', tags: [], traits: [] });
    expect(ItemDirectoryFilter._countActiveFilters()).toBe(0);
  });

  test('a traits filter counts on its own', () => {
    ItemDirectoryFilter.init();
    ItemDirectoryFilter._filterState.traits = ['Wall-Crawling'];
    expect(ItemDirectoryFilter._countActiveFilters()).toBe(1);
  });

  test('a powerSets filter counts on its own', () => {
    ItemDirectoryFilter.init();
    ItemDirectoryFilter._filterState.powerSets = ['Ice'];
    expect(ItemDirectoryFilter._countActiveFilters()).toBe(1);
  });

  test('a duration filter counts on its own', () => {
    ItemDirectoryFilter.init();
    ItemDirectoryFilter._filterState.duration = ['Instant'];
    expect(ItemDirectoryFilter._countActiveFilters()).toBe(1);
  });

  test('an equipmentType filter counts on its own', () => {
    ItemDirectoryFilter.init();
    ItemDirectoryFilter._filterState.equipmentType = ['gadget'];
    expect(ItemDirectoryFilter._countActiveFilters()).toBe(1);
  });
});

describe('items missing the fields a filter reads', () => {
  const BLANK = { name: 'Blank', type: 'item', system: {} };

  test('an absent source matches no source filter', () => {
    ItemDirectoryFilter.init();
    ItemDirectoryFilter._filterState.source = ['core'];
    expect(ItemDirectoryFilter._matchesFilters(BLANK)).toBe(false);
  });

  test('an equipment item with no equipmentType does not match a type filter', () => {
    ItemDirectoryFilter.init();
    ItemDirectoryFilter._filterState.equipmentType = ['gadget'];
    const bareEquipment = { name: 'Bare Equipment', type: 'equipment', system: {} };
    expect(ItemDirectoryFilter._matchesFilters(bareEquipment)).toBe(false);
  });

  test('a power item with no powerSet does not match a power set filter', () => {
    ItemDirectoryFilter.init();
    ItemDirectoryFilter._filterState.powerSets = ['Ice'];
    const barePower = { name: 'Bare Power', type: 'power', system: {} };
    expect(ItemDirectoryFilter._matchesFilters(barePower)).toBe(false);
  });
});
