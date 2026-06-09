/* eslint-env jest */
import { jest } from '@jest/globals';
import { MarvelDie } from '../dice/dietype/marvel-die.mjs';

describe('MarvelDie — static properties', () => {
    test('DENOMINATION is "m"', () => {
        expect(MarvelDie.DENOMINATION).toBe('m');
    });
});

describe('MarvelDie — constructor', () => {
    test('forces faces to 6 regardless of termData', () => {
        const die = new MarvelDie({ number: 2, faces: 4 });
        expect(die.faces).toBe(6);
    });

    test('preserves termData.number', () => {
        const die = new MarvelDie({ number: 3 });
        expect(die.number).toBe(3);
    });

    test('works with empty termData object', () => {
        expect(() => new MarvelDie({})).not.toThrow();
    });
});

describe('MarvelDie — getResultCSS', () => {
    test('always includes base classes ["marvel-roll", "die", "d6"]', () => {
        const die = new MarvelDie({});
        const css = die.getResultCSS({ result: 3 });
        expect(css).toContain('marvel-roll');
        expect(css).toContain('die');
        expect(css).toContain('d6');
        expect(css).toHaveLength(3);
    });

    test('result 1 → adds "fantastic"', () => {
        expect(new MarvelDie({}).getResultCSS({ result: 1 })).toContain('fantastic');
    });

    test('result 1 → does not add "max"', () => {
        expect(new MarvelDie({}).getResultCSS({ result: 1 })).not.toContain('max');
    });

    test('result 2 → neither "fantastic" nor "max"', () => {
        const css = new MarvelDie({}).getResultCSS({ result: 2 });
        expect(css).not.toContain('fantastic');
        expect(css).not.toContain('max');
    });

    test('result 5 → neither "fantastic" nor "max"', () => {
        const css = new MarvelDie({}).getResultCSS({ result: 5 });
        expect(css).not.toContain('fantastic');
        expect(css).not.toContain('max');
    });

    test('result 6 → adds "max"', () => {
        expect(new MarvelDie({}).getResultCSS({ result: 6 })).toContain('max');
    });

    test('result 6 → does not add "fantastic"', () => {
        expect(new MarvelDie({}).getResultCSS({ result: 6 })).not.toContain('fantastic');
    });

    test('discarded: true → adds "discarded"', () => {
        expect(new MarvelDie({}).getResultCSS({ result: 3, discarded: true })).toContain('discarded');
    });

    test('discarded: false → no "discarded"', () => {
        expect(new MarvelDie({}).getResultCSS({ result: 3, discarded: false })).not.toContain('discarded');
    });

    test('discarded: undefined → no "discarded"', () => {
        expect(new MarvelDie({}).getResultCSS({ result: 4 })).not.toContain('discarded');
    });
});

describe('MarvelDie — getResultLabel', () => {
    test('result 1 → returns "m"', () => {
        expect(new MarvelDie({}).getResultLabel({ result: 1 })).toBe('m');
    });

    test('result 2 → returns "2"', () => {
        expect(new MarvelDie({}).getResultLabel({ result: 2 })).toBe('2');
    });

    test('result 6 → returns "6"', () => {
        expect(new MarvelDie({}).getResultLabel({ result: 6 })).toBe('6');
    });

    test('result 4 → returns "4"', () => {
        expect(new MarvelDie({}).getResultLabel({ result: 4 })).toBe('4');
    });
});

describe('MarvelDie — roll', () => {
    afterEach(() => jest.restoreAllMocks());

    test('minimize: true → result is 1 and count is set to 6', () => {
        const die = new MarvelDie({ number: 1 });
        const result = die.roll({ minimize: true });
        expect(result.result).toBe(1);
        expect(die.results[die.results.length - 1].count).toBe(6);
    });

    test('maximize: true → result is 6 and count is NOT set', () => {
        const die = new MarvelDie({ number: 1 });
        const result = die.roll({ maximize: true });
        expect(result.result).toBe(6);
        expect(die.results[die.results.length - 1].count).toBeUndefined();
    });

    test('non-1 result does not set count', () => {
        jest.spyOn(Math, 'random').mockReturnValue(0.5); // ceil(0.5 × 6) = 3
        const die = new MarvelDie({ number: 1 });
        die.roll();
        expect(die.results[die.results.length - 1].count).toBeUndefined();
    });

    test('minimize passes through to super (returns minimum value 1)', () => {
        const die = new MarvelDie({ number: 1 });
        expect(die.roll({ minimize: true }).result).toBe(1);
    });

    test('maximize passes through to super (returns maximum value 6)', () => {
        const die = new MarvelDie({ number: 1 });
        expect(die.roll({ maximize: true }).result).toBe(6);
    });
});

describe('MarvelDie — total getter', () => {
    afterEach(() => jest.restoreAllMocks());

    test('result 1 with no count set → total returns 6', () => {
        const die = new MarvelDie({});
        die.results = [{ result: 1, active: true }];
        expect(die.total).toBe(6);
    });

    test('result 3 → total returns 3 unchanged', () => {
        jest.spyOn(Math, 'random').mockReturnValue(0.5); // ceil(0.5 × 6) = 3
        const die = new MarvelDie({ number: 1 });
        die.roll();
        expect(die.total).toBe(3);
    });

    test('result 6 → total returns 6', () => {
        const die = new MarvelDie({ number: 1 });
        die.roll({ maximize: true });
        expect(die.total).toBe(6);
    });

    test('minimize roll → count=6 set, total=6', () => {
        const die = new MarvelDie({ number: 1 });
        die.roll({ minimize: true }); // result=1, count=6
        expect(die.total).toBe(6);
    });
});
