/* eslint-env jest */
import {
    RANK_X,
    applyFallibleChange,
    applyRankInput,
    concentrationLimit,
    isFallible,
    maxFocusSpend,
} from '../helpers/rank-x.mjs';

const RANK = 'system.attributes.rank.value';
const X = 'system.attributes.rank.x';
const FALLIBLE = 'system.attributes.rank.fallible';

function system({ value = 3, x = false, fallible = false, savedScores = {} } = {}) {
    return {
        attributes: { rank: { value, x, fallible, savedScores } },
        abilities: { mle: { value: 4 }, agl: { value: 2 } },
    };
}

describe('maxFocusSpend', () => {
    test('an ordinary character may spend five times their rank', () => {
        expect(maxFocusSpend(system({ value: 3 }))).toBe(15);
    });

    test('a Rank X character has no limit', () => {
        expect(maxFocusSpend(system({ x: true }))).toBe(Infinity);
    });

    test('a fallible Rank X character is limited to the fallible amount', () => {
        expect(maxFocusSpend(system({ x: true, fallible: true }))).toBe(RANK_X.focusAtOnce);
    });
});

describe('concentrationLimit', () => {
    test('an ordinary character concentrates on one power per rank', () => {
        expect(concentrationLimit(system({ value: 4 }))).toBe(4);
    });

    test('a Rank X character has no limit', () => {
        expect(concentrationLimit(system({ value: 4, x: true }))).toBe(Infinity);
    });
});

describe('isFallible', () => {
    test('the fallible mark counts only on a Rank X character', () => {
        expect(isFallible(system({ x: true, fallible: true }))).toBe(true);
        expect(isFallible(system({ x: false, fallible: true }))).toBe(false);
        expect(isFallible(system({ x: true, fallible: false }))).toBe(false);
    });
});

describe('applyRankInput', () => {
    test('an X in either case marks the actor Rank X and leaves the number alone', () => {
        for (const text of ['X', ' x ']) {
            const formData = { [RANK]: text };
            expect(applyRankInput(formData)).toBe(true);
            expect(formData).toEqual({ [X]: true });
        }
    });

    test('a whole number sets the rank and clears Rank X and the fallible mark', () => {
        const formData = { [RANK]: '4' };
        expect(applyRankInput(formData)).toBe(true);
        expect(formData).toEqual({ [RANK]: 4, [X]: false, [FALLIBLE]: false });
    });

    test('anything else leaves the rank as it was and reports the text as not understood', () => {
        for (const text of ['', 'high', '2.5']) {
            const formData = { [RANK]: text, other: 1 };
            expect(applyRankInput(formData)).toBe(false);
            expect(formData).toEqual({ other: 1 });
        }
    });

    test('a form without the Rank field is not changed', () => {
        const formData = { other: 1 };
        expect(applyRankInput(formData)).toBe(true);
        expect(formData).toEqual({ other: 1 });
    });
});

describe('applyFallibleChange', () => {
    const set = (fallible) => ({ system: { attributes: { rank: { fallible } } } });

    test('turning the fallible numbers on sets every ability score and saves the old ones', () => {
        const changed = set(true);
        applyFallibleChange(system({ x: true }), changed);
        expect(changed.system.abilities).toEqual({
            mle: { value: RANK_X.ability },
            agl: { value: RANK_X.ability },
        });
        expect(changed.system.attributes.rank.savedScores).toEqual({ mle: 4, agl: 2 });
    });

    test('it replaces a score submitted in the same update and keeps the other fields', () => {
        const changed = set(true);
        changed.system.abilities = { mle: { value: 4, edge: true } };
        applyFallibleChange(system({ x: true }), changed);
        expect(changed.system.abilities.mle).toEqual({ value: RANK_X.ability, edge: true });
    });

    test('turning the fallible numbers off puts the saved scores back', () => {
        const changed = set(false);
        applyFallibleChange(system({ x: true, fallible: true, savedScores: { mle: 7, agl: 9 } }), changed);
        expect(changed.system.abilities).toEqual({ mle: { value: 7 }, agl: { value: 9 } });
        expect(changed.system.attributes.rank).toEqual({ fallible: false });
    });

    test('a score that was never saved is left as it is', () => {
        const changed = set(false);
        applyFallibleChange(system({ x: true, fallible: true, savedScores: { agl: 9 } }), changed);
        expect(changed.system.abilities).toEqual({ agl: { value: 9 } });
    });

    test('an update that does not switch the fallible numbers leaves the scores alone', () => {
        const cases = [
            [system({ x: true, fallible: true, savedScores: { mle: 7, agl: 9 } }), set(true)],
            [system({ x: true, savedScores: { mle: 7, agl: 9 } }), set(false)],
            [system({ x: true, fallible: true, savedScores: { mle: 7, agl: 9 } }), { name: 'New name' }],
            // A headquarters or vehicle has no rank at all.
            [{ health: { value: 5 } }, { system: { health: { value: 4 } } }],
        ];
        for (const [current, changed] of cases) {
            applyFallibleChange(current, changed);
            expect(changed.system?.abilities).toBeUndefined();
            expect(changed.system?.attributes?.rank.savedScores).toBeUndefined();
        }
    });
});
