/* eslint-env jest */
// module/__tests__/big-fight-initiative.test.mjs
import { bestVigilanceBySide, needsInitiativeReroll } from '../../marvel-multiverse.mjs';

describe('side initiative selection', () => {
  test('a mixed-side combat picks the best Vigilance per side', () => {
    const combatants = [
      { side: 'hero', vigilance: 4 },
      { side: 'hero', vigilance: 7 },
      { side: 'foe', vigilance: 2 },
      { side: 'foe', vigilance: 6 },
      { side: 'foe', vigilance: 1 },
    ];
    expect(bestVigilanceBySide(combatants)).toEqual({ hero: 7, foe: 6 });
  });

  test('a solo-side encounter never reroll-loops forever by definition — a 0 vs 0 tie still needs one', () => {
    expect(needsInitiativeReroll(0, 0)).toBe(true);
  });
});
