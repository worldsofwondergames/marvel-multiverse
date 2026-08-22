/* eslint-env jest */
import { stuntEligible } from '../helpers/stunts.mjs';

describe('stuntEligible', () => {
  test('matches when prerequisite exactly names an owned power', () => {
    expect(stuntEligible('Mighty', ['Mighty'])).toBe(true);
  });

  test('matches case-insensitively', () => {
    expect(stuntEligible('mighty', ['Mighty'])).toBe(true);
  });

  test('matches a compound prerequisite containing an owned power name', () => {
    expect(stuntEligible('Clobber and Iconic Item', ['Clobber'])).toBe(true);
  });

  test('does not match when no owned power appears in the prerequisite', () => {
    expect(stuntEligible('Mighty', ['Agility Master'])).toBe(false);
  });

  test('does not match a category-style prerequisite with no power name overlap', () => {
    expect(
      stuntEligible('A power that splits attacks in two', ['Mighty'])
    ).toBe(false);
  });

  test('returns false for a blank prerequisite', () => {
    expect(stuntEligible('', ['Mighty'])).toBe(false);
  });

  test('returns false when the actor has no powers', () => {
    expect(stuntEligible('Mighty', [])).toBe(false);
  });
});
