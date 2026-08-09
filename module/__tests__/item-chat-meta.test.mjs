/* eslint-env jest */
import { _buildItemMeta, _hasContent } from '../documents/item.mjs';

/** Labels present in the produced block, in render order. */
function labelsOf(html) {
  return [...html.matchAll(/data-meta="([a-z]+)"/g)].map(m => m[1]);
}

describe('_hasContent', () => {
  test('an emptied ProseMirror body counts as no content', () => {
    // The editor stores `<p></p>` when cleared: non-empty as a string, but it
    // renders as nothing, which is what produced the stray empty div.
    expect(_hasContent('<p></p>')).toBe(false);
    expect(_hasContent('<p>   </p>')).toBe(false);
  });

  test('missing and blank values count as no content', () => {
    expect(_hasContent(undefined)).toBe(false);
    expect(_hasContent(null)).toBe(false);
    expect(_hasContent('')).toBe(false);
    expect(_hasContent('   ')).toBe(false);
  });

  test('text counts as content', () => {
    expect(_hasContent('<p>Hurl a car.</p>')).toBe(true);
    expect(_hasContent('plain')).toBe(true);
  });

  test('an image-only body counts as content', () => {
    expect(_hasContent('<p><img src="x.png"></p>')).toBe(true);
  });
});

describe('_buildItemMeta', () => {
  const full = { action: 'Standard', trigger: 'On hit', duration: '1 round', cost: '10 Focus' };

  test('renders the four rows in the order the item sheet lists them', () => {
    expect(labelsOf(_buildItemMeta(full))).toEqual(['action', 'trigger', 'duration', 'cost']);
  });

  test('carries each value through', () => {
    const html = _buildItemMeta(full);
    for (const value of Object.values(full)) expect(html).toContain(value);
  });

  test('produces nothing at all when none of the four are set', () => {
    // Not an empty wrapper -- the block must vanish entirely.
    expect(_buildItemMeta({})).toBe('');
    expect(_buildItemMeta({ action: '', trigger: '', duration: '', cost: '' })).toBe('');
    expect(_buildItemMeta(undefined)).toBe('');
  });

  test('a set field renders while the unset ones are skipped', () => {
    const html = _buildItemMeta({ cost: '5 Focus' });
    expect(labelsOf(html)).toEqual(['cost']);
    expect(html).toContain('5 Focus');
  });

  test('each field can appear on its own', () => {
    expect(labelsOf(_buildItemMeta({ action: 'Standard' }))).toEqual(['action']);
    expect(labelsOf(_buildItemMeta({ trigger: 'On hit' }))).toEqual(['trigger']);
    expect(labelsOf(_buildItemMeta({ duration: '1 round' }))).toEqual(['duration']);
    expect(labelsOf(_buildItemMeta({ cost: '10 Focus' }))).toEqual(['cost']);
  });

  test('a whitespace-only value is treated as unset', () => {
    expect(labelsOf(_buildItemMeta({ action: '   ', cost: '5 Focus' }))).toEqual(['cost']);
  });

  // No test for value trimming: HTML collapses whitespace, so a value with
  // stray spaces renders identically either way. Removing the trim from the
  // emitter fails nothing, which makes such a test unprovable by definition.

  test('item types without these fields produce nothing', () => {
    // roll() is shared by every item type; a weapon has no action/trigger/etc.
    expect(_buildItemMeta({ damage: 3, weaponType: 'Blunt' })).toBe('');
  });
});
