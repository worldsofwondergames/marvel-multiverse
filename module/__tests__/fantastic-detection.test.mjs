/* eslint-env jest */
import { MarvelDie } from '../dice/dietype/marvel-die.mjs';

describe('Fantastic detection — discarded results excluded', () => {
    test('a discarded Fantastic result has both "fantastic" and "discarded" CSS classes', () => {
        const die = new MarvelDie({});
        const css = die.getResultCSS({ result: 1, discarded: true });
        expect(css).toContain('fantastic');
        expect(css).toContain('discarded');
    });

    test('an active Fantastic result has "fantastic" but not "discarded"', () => {
        const die = new MarvelDie({});
        const css = die.getResultCSS({ result: 1, discarded: false });
        expect(css).toContain('fantastic');
        expect(css).not.toContain('discarded');
    });

    test('an active Fantastic result without discarded field has "fantastic" only', () => {
        const die = new MarvelDie({});
        const css = die.getResultCSS({ result: 1 });
        expect(css).toContain('fantastic');
        expect(css).not.toContain('discarded');
    });

    function isActiveFantastic(cssClasses) {
        return cssClasses.includes('fantastic') && !cssClasses.includes('discarded');
    }

    test('active Fantastic passes the :not(.discarded) check', () => {
        const die = new MarvelDie({});
        const css = die.getResultCSS({ result: 1, discarded: false });
        expect(isActiveFantastic(css)).toBe(true);
    });

    test('discarded Fantastic fails the :not(.discarded) check', () => {
        const die = new MarvelDie({});
        const css = die.getResultCSS({ result: 1, discarded: true });
        expect(isActiveFantastic(css)).toBe(false);
    });

    test('non-Fantastic result 4 fails the Fantastic check entirely', () => {
        const die = new MarvelDie({});
        const css = die.getResultCSS({ result: 4 });
        expect(isActiveFantastic(css)).toBe(false);
    });

    test('trouble reroll scenario: old Fantastic discarded, new result 4 kept', () => {
        const die = new MarvelDie({});
        const oldCss = die.getResultCSS({ result: 1, discarded: true });
        const newCss = die.getResultCSS({ result: 4, discarded: false });

        expect(isActiveFantastic(oldCss)).toBe(false);
        expect(isActiveFantastic(newCss)).toBe(false);
        expect(newCss).not.toContain('fantastic');
    });

    test('edge reroll scenario: old result 3 discarded, new Fantastic kept', () => {
        const die = new MarvelDie({});
        const oldCss = die.getResultCSS({ result: 3, discarded: true });
        const newCss = die.getResultCSS({ result: 1, discarded: false });

        expect(isActiveFantastic(oldCss)).toBe(false);
        expect(isActiveFantastic(newCss)).toBe(true);
    });
});
