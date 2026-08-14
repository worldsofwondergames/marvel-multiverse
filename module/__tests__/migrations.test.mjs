/* eslint-env jest */
/**
 * A compendium edit does not reach an item already owned by an actor, so a
 * schema field backfilled in the compendium needs a pass over the world too.
 *
 * Imported from the shipping monolith, since that is the only file
 * `system.json` loads. The last block runs the same cases through the twin.
 */
import {
  collectHalfDamageUpdates,
  collectPowerSyncUpdates,
  needsHalfDamageScale,
  powerRollsFromItsText,
} from '../../marvel-multiverse.mjs';
import * as twin from '../helpers/migrations.mjs';

/** Invented prose, so no published sentence is stored in this repo. */
const HALF = 'Every target the strike reaches takes half regular damage from the impact.';
const FULL = 'Every target the strike reaches is knocked flat and takes damage as usual.';

/** An owned power item as the collections hand it over. */
function power(effect, { damageScale = 1, id = 'abc123', type = 'power' } = {}) {
  return { id, type, system: { effect, damageScale } };
}

describe('deciding which powers still need the half-damage scale', () => {
  test('a power whose text says half regular damage is picked up', () => {
    expect(needsHalfDamageScale(power(HALF))).toBe(true);
  });

  test('a power whose text says nothing of the sort is left alone', () => {
    expect(needsHalfDamageScale(power(FULL))).toBe(false);
  });

  // Running twice must not undo a correction, so anything already off the
  // default is treated as deliberate.
  test('a power already scaled is left alone', () => {
    expect(needsHalfDamageScale(power(HALF, { damageScale: 0.5 }))).toBe(false);
  });

  test('a deliberate scale other than a half is left alone', () => {
    expect(needsHalfDamageScale(power(HALF, { damageScale: 0.25 }))).toBe(false);
  });

  // The field did not exist before this change, so items imported earlier have
  // no value at all rather than the default.
  test('a power predating the field is picked up', () => {
    expect(needsHalfDamageScale({ id: 'x', type: 'power', system: { effect: HALF } })).toBe(true);
  });

  test('an item that is not a power is left alone', () => {
    expect(needsHalfDamageScale(power(HALF, { type: 'weapon' }))).toBe(false);
  });

  test('a power with no effect text at all is left alone', () => {
    expect(needsHalfDamageScale({ id: 'x', type: 'power', system: {} })).toBe(false);
  });

  test('the match ignores case and extra spacing', () => {
    expect(needsHalfDamageScale(power('They take  HALF   Regular  Damage here.'))).toBe(true);
  });
});

describe('the updates the pass produces', () => {
  test('only the matching items are updated, and to a half', () => {
    const items = [
      power(HALF, { id: 'one' }),
      power(FULL, { id: 'two' }),
      power(HALF, { id: 'three', damageScale: 0.5 }),
    ];
    expect(collectHalfDamageUpdates(items)).toEqual([
      { _id: 'one', 'system.damageScale': 0.5 },
    ]);
  });

  test('a collection needing nothing produces no updates', () => {
    expect(collectHalfDamageUpdates([power(FULL)])).toEqual([]);
  });

  // updateEmbeddedDocuments is only called when there is something to change,
  // so an empty world must not produce a write.
  test('no items produces no updates', () => {
    expect(collectHalfDamageUpdates([])).toEqual([]);
    expect(collectHalfDamageUpdates(undefined)).toEqual([]);
  });

  test('an item carrying _id rather than id is still identified', () => {
    const raw = { _id: 'raw1', type: 'power', system: { effect: HALF, damageScale: 1 } };
    expect(collectHalfDamageUpdates([raw])).toEqual([
      { _id: 'raw1', 'system.damageScale': 0.5 },
    ]);
  });
});

/**
 * A power imported before the attack fields were populated has no ability and
 * `attack: false`, and such a power cannot be rolled at all — which is why
 * correcting its damage scale changed nothing in play.
 */
describe('bringing owned powers back in line with the compendium', () => {
  const REFERENCE = new Map([
    ['Stomping Power', {
      ability: 'mle',
      attack: true,
      attackTarget: 'agl',
      attackKind: 'melee',
      damageType: 'health',
      damageScale: 0.5,
    }],
  ]);

  /** An owned copy as it was imported before those fields existed. */
  function stale(overrides = {}) {
    return {
      id: 'own1',
      type: 'power',
      name: 'Stomping Power',
      system: {
        ability: '',
        attack: false,
        attackTarget: '',
        attackKind: '',
        damageType: 'health',
        damageScale: 0.5,
        ...overrides,
      },
    };
  }

  test('the fields that differ are updated and the rest left out', () => {
    expect(collectPowerSyncUpdates([stale()], REFERENCE)).toEqual([
      {
        _id: 'own1',
        'system.ability': 'mle',
        'system.attack': true,
        'system.attackTarget': 'agl',
        'system.attackKind': 'melee',
      },
    ]);
  });

  // Restoring the ability is the whole point: Item#roll needs one, so without
  // it the power never rolls and never carries its scale.
  test('an empty ability is restored', () => {
    const [update] = collectPowerSyncUpdates([stale()], REFERENCE);
    expect(update['system.ability']).toBe('mle');
  });

  test('a power already matching produces no update', () => {
    const current = stale({
      ability: 'mle',
      attack: true,
      attackTarget: 'agl',
      attackKind: 'melee',
    });
    expect(collectPowerSyncUpdates([current], REFERENCE)).toEqual([]);
  });

  // The reference wins outright, which is what was chosen over filling blanks.
  test('a differing value is overwritten, not preserved', () => {
    const customised = stale({ ability: 'ego', attack: true, attackTarget: 'agl', attackKind: 'melee' });
    expect(collectPowerSyncUpdates([customised], REFERENCE)).toEqual([
      { _id: 'own1', 'system.ability': 'mle' },
    ]);
  });

  test('a power absent from the reference is left alone', () => {
    const unknown = { ...stale(), name: 'Not In Any Compendium' };
    expect(collectPowerSyncUpdates([unknown], REFERENCE)).toEqual([]);
  });

  test('an item that is not a power is left alone', () => {
    expect(collectPowerSyncUpdates([{ ...stale(), type: 'weapon' }], REFERENCE)).toEqual([]);
  });

  // A reference that omits a field must not blank the owned value.
  test('a field the reference does not define is not cleared', () => {
    const sparse = new Map([['Stomping Power', { ability: 'mle' }]]);
    expect(collectPowerSyncUpdates([stale()], sparse)).toEqual([
      { _id: 'own1', 'system.ability': 'mle' },
    ]);
  });

  test('no reference at all produces no updates', () => {
    expect(collectPowerSyncUpdates([stale()], new Map())).toEqual([]);
    expect(collectPowerSyncUpdates([stale()], undefined)).toEqual([]);
  });
});

describe('the twin agrees with the shipping monolith', () => {
  const CASES = [
    power(HALF),
    power(FULL),
    power(HALF, { damageScale: 0.5 }),
    power(HALF, { type: 'weapon' }),
    { id: 'x', type: 'power', system: { effect: HALF } },
  ];

  test.each(CASES)('needsHalfDamageScale matches for %o', (item) => {
    expect(twin.needsHalfDamageScale(item)).toBe(needsHalfDamageScale(item));
  });

  test('collectHalfDamageUpdates matches', () => {
    expect(twin.collectHalfDamageUpdates(CASES)).toEqual(collectHalfDamageUpdates(CASES));
  });

  test('collectPowerSyncUpdates matches', () => {
    const reference = new Map([['Stomping Power', { ability: 'mle', attack: true }]]);
    const items = [
      { id: 'a', type: 'power', name: 'Stomping Power', system: { ability: '', attack: false } },
      { id: 'b', type: 'power', name: 'Unknown Power', system: { ability: '', attack: false } },
      { id: 'c', type: 'weapon', name: 'Stomping Power', system: { ability: '', attack: false } },
    ];
    expect(twin.collectPowerSyncUpdates(items, reference)).toEqual(
      collectPowerSyncUpdates(items, reference)
    );
  });

  test('both trees sync the same fields', () => {
    expect(twin.POWER_ATTACK_FIELDS).toEqual([
      'ability',
      'attack',
      'attackTarget',
      'attackKind',
      'damageType',
      'damageScale',
    ]);
  });
});

/**
 * Nearly every attack power is written as an instruction to make a check, and
 * that phrase becomes the link used to roll it. Rolling again when the power
 * itself is clicked would put two attacks in the log for one action.
 */
describe('whether a power is rolled by the link in its own text', () => {
  test('text naming a check means the link does the rolling', () => {
    expect(powerRollsFromItsText({ effect: '<p>The character makes a Melee check.</p>' })).toBe(true);
  });

  test('text describing a bonus is not an instruction to roll', () => {
    expect(
      powerRollsFromItsText({ effect: '<p>They gain an edge on all close attacks this round.</p>' })
    ).toBe(false);
  });

  test('a power with no effect text rolls on its own', () => {
    expect(powerRollsFromItsText({ effect: '' })).toBe(false);
    expect(powerRollsFromItsText({})).toBe(false);
    expect(powerRollsFromItsText(undefined)).toBe(false);
  });

  // Markup sits between the words in stored rich text.
  test('the check is found through surrounding markup', () => {
    expect(
      powerRollsFromItsText({ effect: '<p>The character <em>makes</em> a <b>Melee</b> check.</p>' })
    ).toBe(true);
  });

  // The pattern is global; test() would advance lastIndex and make a second
  // call on the same text miss.
  test('asking twice about the same text gives the same answer', () => {
    const system = { effect: '<p>The character makes a Melee check.</p>' };
    expect(powerRollsFromItsText(system)).toBe(true);
    expect(powerRollsFromItsText(system)).toBe(true);
  });
});
