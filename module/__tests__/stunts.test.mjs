/* eslint-env jest */
import { stuntEligible } from '../helpers/stunts.mjs';

describe('stuntEligible', () => {
  test('matches when an owned power name equals the prerequisite', () => {
    expect(stuntEligible('Shield Bash', ['Shield Bash'])).toBe(true);
  });

  test('matches case-insensitively', () => {
    expect(stuntEligible('shield bash', ['Shield Bash'])).toBe(true);
  });

  test('matches when an owned power name is part of a compound prerequisite', () => {
    expect(stuntEligible('Clobber and Iconic Item', ['Clobber'])).toBe(true);
  });

  test('does not match when no owned power name appears in the prerequisite', () => {
    expect(stuntEligible('Shield Bash', ['Mighty 1', 'Flight 1'])).toBe(false);
  });

  test('does not match a category-based prerequisite with no corresponding power', () => {
    expect(stuntEligible('A power that splits attacks in two, halving the damage', ['Mighty 1'])).toBe(false);
  });

  test('does not match a blank prerequisite', () => {
    expect(stuntEligible('', ['Shield Bash'])).toBe(false);
  });

  test('does not match when the actor has no powers', () => {
    expect(stuntEligible('Shield Bash', [])).toBe(false);
  });
});
