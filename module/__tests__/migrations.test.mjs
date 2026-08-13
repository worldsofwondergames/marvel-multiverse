/* eslint-env jest */
/**
 * A compendium edit does not reach an item already owned by an actor, so a
 * schema field backfilled in the compendium needs a pass over the world too.
 *
 * Imported from the shipping monolith, since that is the only file
 * `system.json` loads. The last block runs the same cases through the twin.
 */
import { collectHalfDamageUpdates, needsHalfDamageScale } from '../../marvel-multiverse.mjs';
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
});
