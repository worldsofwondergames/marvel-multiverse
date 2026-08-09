/* eslint-env jest */
/**
 * `ActorDirectoryFilter._matchesFilters` decides which actors the sidebar shows.
 * It had no coverage of any kind despite being ~420 lines of predicate logic.
 *
 * These tests state the filter contract — given this population and this filter
 * state, exactly these actors match — rather than asserting the shape of the
 * code. Each case names the actors it expects by name, so a predicate that
 * silently starts matching everything (or nothing) fails.
 */
import { ActorDirectoryFilter } from '../sidebar/mm-actor-directory.mjs';

/** Minimal actor stand-in: `_matchesFilters` only reads `type`, `system`, `items`. */
function actor(name, { type = 'character', items = [], ...system } = {}) {
  return { name, type, system, items };
}

const NIGHTJAR = actor('Nightjar', {
  attributes: { rank: { value: 4 } },
  size: 'average',
  abilities: { mle: { value: 5 }, agl: { value: 7 }, res: { value: 3 }, vig: { value: 4 }, ego: { value: 2 }, log: { value: 5 } },
  teams: 'Vanguard, City Herald',
  movement: { run: { active: true }, climb: { active: true }, flight: { active: false } },
  defaultElement: 'kinetic',
  healthDamageReduction: 2,
  focusDamageReduction: 0,
  health: { max: 90 },
  focus: { max: 120 },
  karma: { max: 4 },
  items: [
    { type: 'origin', name: 'High-Tech' },
    { type: 'occupation', name: 'Journalist' },
    { type: 'tag', name: 'Enhanced Reflexes' },
    { type: 'trait', name: 'Surface Climbing' },
    { type: 'power', system: { powerSet: 'Spider-Powers, Agility' } },
  ],
});

const TITAN = actor('Titan', {
  attributes: { rank: { value: 6 } },
  size: 'big',
  abilities: { mle: { value: 9 }, agl: { value: 2 }, res: { value: 9 }, vig: { value: 3 }, ego: { value: 1 }, log: { value: 1 } },
  teams: 'Vanguard',
  movement: { run: { active: true }, climb: { active: false }, flight: { active: false } },
  defaultElement: 'kinetic',
  healthDamageReduction: 6,
  focusDamageReduction: 1,
  health: { max: 270 },
  focus: { max: 90 },
  karma: { max: 2 },
  items: [
    { type: 'origin', name: 'Weird Science' },
    { type: 'occupation', name: 'Scientist' },
    { type: 'power', system: { powerSet: 'Super-Strength' } },
  ],
});

const THUG = actor('Street Thug', {
  type: 'npc',
  attributes: { rank: { value: 1 } },
  size: 'average',
  abilities: { mle: { value: 2 }, agl: { value: 1 }, res: { value: 1 }, vig: { value: 1 }, ego: { value: 0 }, log: { value: 0 } },
  teams: '',
  movement: { run: { active: true }, climb: { active: false }, flight: { active: false } },
  defaultElement: 'kinetic',
  healthDamageReduction: 0,
  focusDamageReduction: 0,
  health: { max: 30 },
  focus: { max: 30 },
  karma: { max: 0 },
  items: [],
});

const KESTREL = actor('Kestrel', {
  attributes: { rank: { value: 3 } },
  size: 'average',
  abilities: { mle: { value: 4 }, agl: { value: 5 }, res: { value: 3 }, vig: { value: 5 }, ego: { value: 3 }, log: { value: 3 } },
  teams: 'Vanguard',
  movement: { run: { active: true }, climb: { active: false }, flight: { active: true } },
  defaultElement: 'air',
  healthDamageReduction: 1,
  focusDamageReduction: 0,
  health: { max: 90 },
  focus: { max: 150 },
  karma: { max: 3 },
  items: [
    { type: 'origin', name: 'High-Tech' },
    { type: 'tag', name: 'Enhanced Reflexes' },
    { type: 'power', system: { powerSet: 'Flight' } },
  ],
});

const POPULATION = [NIGHTJAR, TITAN, THUG, KESTREL];

/** Apply `state` on top of the defaults and return the matching actor names. */
function matching(state) {
  ActorDirectoryFilter.init();
  Object.assign(ActorDirectoryFilter._filterState, state);
  return POPULATION.filter((a) => ActorDirectoryFilter._matchesFilters(a)).map((a) => a.name);
}

beforeEach(() => ActorDirectoryFilter.init());

describe('no active filters', () => {
  test('matches every actor', () => {
    expect(matching({})).toEqual(['Nightjar', 'Titan', 'Street Thug', 'Kestrel']);
  });

  test('_hasActiveFilters is false so the directory is left alone', () => {
    expect(ActorDirectoryFilter._hasActiveFilters()).toBe(false);
  });
});

describe('single filters select the right subset', () => {
  test('actor type', () => {
    expect(matching({ actorType: ['npc'] })).toEqual(['Street Thug']);
  });

  test('size', () => {
    expect(matching({ size: ['big'] })).toEqual(['Titan']);
  });

  test('rank >=', () => {
    expect(matching({ rank: { op: '>=', value: 4 } })).toEqual(['Nightjar', 'Titan']);
  });

  test('rank <=', () => {
    expect(matching({ rank: { op: '<=', value: 3 } })).toEqual(['Street Thug', 'Kestrel']);
  });

  test('rank exact', () => {
    expect(matching({ rank: { op: '=', value: 6 } })).toEqual(['Titan']);
  });

  test('origin item by name', () => {
    expect(matching({ origins: ['High-Tech'] })).toEqual(['Nightjar', 'Kestrel']);
  });

  test('occupation item by name', () => {
    expect(matching({ occupations: ['Scientist'] })).toEqual(['Titan']);
  });

  test('tag item by name', () => {
    expect(matching({ tags: ['Enhanced Reflexes'] })).toEqual(['Nightjar', 'Kestrel']);
  });

  test('trait item by name', () => {
    expect(matching({ traits: ['Surface Climbing'] })).toEqual(['Nightjar']);
  });

  test('element', () => {
    expect(matching({ elements: ['air'] })).toEqual(['Kestrel']);
  });

  test('health DR >=', () => {
    expect(matching({ healthDR: { op: '>=', value: 2 } })).toEqual(['Nightjar', 'Titan']);
  });

  test('focus max >=', () => {
    expect(matching({ focusMax: { op: '>=', value: 120 } })).toEqual(['Nightjar', 'Kestrel']);
  });

  test('karma max >=', () => {
    expect(matching({ karmaMax: { op: '>=', value: 3 } })).toEqual(['Nightjar', 'Kestrel']);
  });
});

describe('power set filtering splits the comma-separated field', () => {
  test('matches a set listed second in the string', () => {
    // Nightjar's power carries "Spider-Powers, Agility" in one field.
    expect(matching({ powerSets: ['Agility'] })).toEqual(['Nightjar']);
  });

  test('matches a set listed first', () => {
    expect(matching({ powerSets: ['Spider-Powers'] })).toEqual(['Nightjar']);
  });

  test('does not substring-match a longer set name', () => {
    expect(matching({ powerSets: ['Flight'] })).toEqual(['Kestrel']);
  });

  test('several selected sets match any of them', () => {
    expect(matching({ powerSets: ['Flight', 'Super-Strength'] })).toEqual(['Titan', 'Kestrel']);
  });
});

describe('team filtering', () => {
  test('is a case-insensitive substring match', () => {
    expect(matching({ teams: 'vanguard' })).toEqual(['Nightjar', 'Titan', 'Kestrel']);
  });

  test('matches a team that is not first in the list', () => {
    expect(matching({ teams: 'City Herald' })).toEqual(['Nightjar']);
  });

  test('whitespace-only input is not treated as a filter', () => {
    expect(matching({ teams: '   ' })).toEqual(['Nightjar', 'Titan', 'Street Thug', 'Kestrel']);
  });
});

describe('ability filters', () => {
  test('single ability threshold', () => {
    expect(matching({ abilities: { ...ActorDirectoryFilter._filterState.abilities, agl: { op: '>=', value: 5 } } }))
      .toEqual(['Nightjar', 'Kestrel']);
  });

  test('two ability thresholds must both hold under AND', () => {
    expect(matching({
      abilities: {
        ...ActorDirectoryFilter._filterState.abilities,
        mle: { op: '>=', value: 4 },
        agl: { op: '>=', value: 5 },
      },
    })).toEqual(['Nightjar', 'Kestrel']);
  });

  test('a zero threshold is a real filter, not an empty one', () => {
    // `0` is falsy; the code must test against null, or this silently matches all.
    expect(matching({
      abilities: { ...ActorDirectoryFilter._filterState.abilities, ego: { op: '<=', value: 0 } },
    })).toEqual(['Street Thug']);
  });
});

describe('movement filtering requires every selected type', () => {
  test('one type', () => {
    expect(matching({ movementTypes: ['flight'] })).toEqual(['Kestrel']);
  });

  test('two types match only actors with both active', () => {
    expect(matching({ movementTypes: ['run', 'climb'] })).toEqual(['Nightjar']);
  });
});

describe('AND vs OR across filter groups', () => {
  test('AND requires every group to hold', () => {
    expect(matching({ actorType: ['character'], rank: { op: '>=', value: 4 } }))
      .toEqual(['Nightjar', 'Titan']);
  });

  test('OR admits an actor matching only one group', () => {
    expect(matching({ logic: 'or', actorType: ['npc'], rank: { op: '>=', value: 6 } }))
      .toEqual(['Titan', 'Street Thug']);
  });

  test('AND on the same criteria excludes both', () => {
    expect(matching({ logic: 'and', actorType: ['npc'], rank: { op: '>=', value: 6 } })).toEqual([]);
  });
});

describe('active filter counting drives the badge and the early-out', () => {
  test('counts one per engaged group', () => {
    ActorDirectoryFilter.init();
    Object.assign(ActorDirectoryFilter._filterState, {
      actorType: ['npc'],
      size: ['big'],
      teams: 'Vanguard',
    });
    expect(ActorDirectoryFilter._countActiveFilters()).toBe(3);
  });

  test('counts each ability threshold separately', () => {
    ActorDirectoryFilter.init();
    ActorDirectoryFilter._filterState.abilities.mle = { op: '>=', value: 3 };
    ActorDirectoryFilter._filterState.abilities.agl = { op: '>=', value: 3 };
    expect(ActorDirectoryFilter._countActiveFilters()).toBe(2);
  });

  test('a rank of 0 counts as active', () => {
    ActorDirectoryFilter.init();
    ActorDirectoryFilter._filterState.rank = { op: '=', value: 0 };
    expect(ActorDirectoryFilter._countActiveFilters()).toBe(1);
    expect(ActorDirectoryFilter._hasActiveFilters()).toBe(true);
  });

  test('empty arrays and blank text count as inactive', () => {
    ActorDirectoryFilter.init();
    Object.assign(ActorDirectoryFilter._filterState, { actorType: [], tags: [], teams: '  ' });
    expect(ActorDirectoryFilter._countActiveFilters()).toBe(0);
  });
});

describe('_evalNumeric', () => {
  test.each([
    ['=', 5, 5, true],
    ['=', 5, 4, false],
    ['>=', 5, 5, true],
    ['>=', 4, 5, false],
    ['<=', 4, 5, true],
    ['<=', 6, 5, false],
  ])('%s %i vs %i -> %s', (op, actual, target, expected) => {
    expect(ActorDirectoryFilter._evalNumeric(actual, op, target)).toBe(expected);
  });

  test('an unrecognised operator matches everything rather than nothing', () => {
    // Documented so a future change to strict-reject is a deliberate decision:
    // today a malformed op silently disables the filter instead of hiding all.
    expect(ActorDirectoryFilter._evalNumeric(1, '!=', 99)).toBe(true);
  });
});

describe('actors missing the fields a filter reads', () => {
  const BLANK = { name: 'Blank', type: 'character', system: {}, items: [] };

  test('an absent ability is treated as 0', () => {
    ActorDirectoryFilter.init();
    ActorDirectoryFilter._filterState.abilities.mle = { op: '<=', value: 0 };
    expect(ActorDirectoryFilter._matchesFilters(BLANK)).toBe(true);
  });

  test('an absent rank matches no rank filter, including <=', () => {
    // rank has no `?? 0` fallback, so undefined fails every comparison. An actor
    // with no rank is invisible whenever a rank filter is engaged.
    ActorDirectoryFilter.init();
    ActorDirectoryFilter._filterState.rank = { op: '<=', value: 10 };
    expect(ActorDirectoryFilter._matchesFilters(BLANK)).toBe(false);
  });

  test('an absent teams field does not match a team filter', () => {
    ActorDirectoryFilter.init();
    ActorDirectoryFilter._filterState.teams = 'Vanguard';
    expect(ActorDirectoryFilter._matchesFilters(BLANK)).toBe(false);
  });
});
