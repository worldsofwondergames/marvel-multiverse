/* eslint-env jest */
import { isVillainous } from '../helpers/villainous.mjs';

describe('isVillainous', () => {
  test('true when the actor owns a Villainous tag item', () => {
    expect(isVillainous([{ type: 'tag', name: 'Villainous' }])).toBe(true);
  });

  test('false when the actor owns no items', () => {
    expect(isVillainous([])).toBe(false);
  });

  test('false when a tag item has a different name', () => {
    expect(isVillainous([{ type: 'tag', name: 'Heroic' }])).toBe(false);
  });

  test('false when a non-tag item happens to be named Villainous', () => {
    expect(isVillainous([{ type: 'trait', name: 'Villainous' }])).toBe(false);
  });

  test('true when the Villainous tag is among other items', () => {
    const items = [
      { type: 'trait', name: 'Combat Expert' },
      { type: 'tag', name: 'Villainous' },
      { type: 'power', name: 'Mighty' },
    ];
    expect(isVillainous(items)).toBe(true);
  });
});
