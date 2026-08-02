/* eslint-env jest */
import MarvelMultiverseHeadquarters from '../data/headquarters.mjs';
import MarvelMultiverseHqTag from '../data/hq-tag.mjs';
import MarvelMultiverseHqTrait from '../data/hq-trait.mjs';

// ─── HQ Tag ──────────────────────────────────────────────────────────────────

describe('MarvelMultiverseHqTag', () => {
  test('has description and incompatible fields', () => {
    const tag = new MarvelMultiverseHqTag({
      description: 'Located in a major city',
      incompatible: 'Isolated Location',
    });
    expect(tag.description).toBe('Located in a major city');
    expect(tag.incompatible).toBe('Isolated Location');
  });

  test('incompatible defaults to empty string', () => {
    const tag = new MarvelMultiverseHqTag({ description: 'Some tag' });
    expect(tag.incompatible).toBeUndefined();
  });
});

// ─── HQ Trait ────────────────────────────────────────────────────────────────

describe('MarvelMultiverseHqTrait', () => {
  test('has description, downtimeActivity, and maxCount fields', () => {
    const trait = new MarvelMultiverseHqTrait({
      description: 'A well-stocked lab',
      downtimeActivity: 'Edge on gadget hacking',
      maxCount: 0,
    });
    expect(trait.description).toBe('A well-stocked lab');
    expect(trait.downtimeActivity).toBe('Edge on gadget hacking');
    expect(trait.maxCount).toBe(0);
  });

  test('maxCount can be set for stackable traits', () => {
    const trait = new MarvelMultiverseHqTrait({
      description: 'Active security',
      downtimeActivity: 'Raise TN by +2',
      maxCount: 3,
    });
    expect(trait.maxCount).toBe(3);
  });
});

// ─── Headquarters ─────────────────────────────────────────────────────────────

function makeHQ({ healthValue = 10, members = [], traitItems = [] } = {}) {
  const instance = new MarvelMultiverseHeadquarters({
    health: { value: healthValue, max: 0 },
    members,
    description: '',
    notes: '',
    source: '',
  });
  instance.parent = {
    items: traitItems.map(t => ({ type: 'hqTrait', ...t })),
  };
  instance.prepareDerivedData();
  return instance;
}

describe('MarvelMultiverseHeadquarters — Health & Status', () => {
  test('health.max = 2 × trait count', () => {
    const hq = makeHQ({
      healthValue: 12,
      traitItems: [{ name: 'Lab' }, { name: 'Kitchen' }, { name: 'Armory' },
        { name: 'Garage' }, { name: 'Hangar' }, { name: 'Library' }],
    });
    expect(hq.health.max).toBe(12);
    expect(hq.traitCount).toBe(6);
  });

  test('operational when health > max / 2', () => {
    const hq = makeHQ({
      healthValue: 10,
      traitItems: [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }, { name: 'E' }, { name: 'F' }],
    });
    expect(hq.health.status).toBe('operational');
    expect(hq.health.damaged).toBe(false);
    expect(hq.health.destroyed).toBe(false);
  });

  test('damaged when health > 0 and <= max / 2', () => {
    const hq = makeHQ({
      healthValue: 5,
      traitItems: Array.from({ length: 6 }, (_, i) => ({ name: `T${i}` })),
    });
    expect(hq.health.max).toBe(12);
    expect(hq.health.damaged).toBe(true);
    expect(hq.health.status).toBe('damaged');
  });

  test('damaged boundary: exactly half is damaged', () => {
    const hq = makeHQ({
      healthValue: 6,
      traitItems: Array.from({ length: 6 }, (_, i) => ({ name: `T${i}` })),
    });
    expect(hq.health.max).toBe(12);
    expect(hq.health.damaged).toBe(true);
  });

  test('destroyed when health <= 0', () => {
    const hq = makeHQ({
      healthValue: 0,
      traitItems: Array.from({ length: 3 }, (_, i) => ({ name: `T${i}` })),
    });
    expect(hq.health.destroyed).toBe(true);
    expect(hq.health.status).toBe('destroyed');
  });

  test('not destroyed when max is 0 (no traits)', () => {
    const hq = makeHQ({ healthValue: 0, traitItems: [] });
    expect(hq.health.destroyed).toBe(false);
  });

  test('trait slots = teamRank × 3', () => {
    const hq = makeHQ();
    expect(hq.traitSlots).toBe(3);
  });
});

describe('MarvelMultiverseHeadquarters — Team Rank', () => {
  test('defaults to 1 when no members', () => {
    const hq = makeHQ();
    expect(hq.teamRank).toBe(1);
  });

  test('calculates average rank rounded up', () => {
    game.actors = {
      get: (id) => {
        const ranks = { a1: 3, a2: 4, a3: 5 };
        return ranks[id] ? { system: { attributes: { rank: { value: ranks[id] } } } } : null;
      },
    };

    const hq = makeHQ({
      members: [
        { actorId: 'a1', name: 'Hero A', img: '' },
        { actorId: 'a2', name: 'Hero B', img: '' },
        { actorId: 'a3', name: 'Hero C', img: '' },
      ],
    });

    expect(hq.teamRank).toBe(4);
    game.actors = undefined;
  });

  test('uses top 6 ranks when more than 6 members', () => {
    game.actors = {
      get: (id) => {
        const ranks = { a1: 3, a2: 3, a3: 3, a4: 4, a5: 4, a6: 5, a7: 5 };
        return ranks[id] ? { system: { attributes: { rank: { value: ranks[id] } } } } : null;
      },
    };

    const hq = makeHQ({
      members: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'].map(id => ({ actorId: id, name: id, img: '' })),
    });

    // Top 6: 5, 5, 4, 4, 3, 3 = 24 / 6 = 4
    expect(hq.teamRank).toBe(4);
    game.actors = undefined;
  });

  test('skips members whose actors are not found', () => {
    game.actors = {
      get: (id) => {
        if (id === 'a1') return { system: { attributes: { rank: { value: 3 } } } };
        return null;
      },
    };

    const hq = makeHQ({
      members: [
        { actorId: 'a1', name: 'Found', img: '' },
        { actorId: 'a2', name: 'Missing', img: '' },
      ],
    });

    expect(hq.teamRank).toBe(3);
    game.actors = undefined;
  });

  test('trait slots update with team rank', () => {
    game.actors = {
      get: (id) => ({ system: { attributes: { rank: { value: 6 } } } }),
    };

    const hq = makeHQ({
      members: [{ actorId: 'a1', name: 'Rank 6 Hero', img: '' }],
    });

    expect(hq.teamRank).toBe(6);
    expect(hq.traitSlots).toBe(18);
    game.actors = undefined;
  });
});
