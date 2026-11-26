/* eslint-env jest */
import { isUltimateFantasticInitiative, turnMarvelDieToM } from '../helpers/ultimate-fantastic.mjs';

function d6(total) {
    return { total };
}

function marvelDie(result, { active = true } = {}) {
    return { results: [{ result, active }] };
}

function roll({ marvelResult = 4, marvelActive = true, d1 = 0, d2 = 0 } = {}) {
    return { dice: [d6(d1), marvelDie(marvelResult, { active: marvelActive }), d6(d2)] };
}

describe('isUltimateFantasticInitiative', () => {
    test('true for a 6M6 result on an Initiative roll', () => {
        expect(isUltimateFantasticInitiative(roll({ marvelResult: 1, d1: 6, d2: 6 }), 'Initiative Roll')).toBe(true);
    });

    test('false when the flavor is not an Initiative roll', () => {
        expect(isUltimateFantasticInitiative(roll({ marvelResult: 1, d1: 6, d2: 6 }), 'Melee Attack')).toBe(false);
    });

    test('false when the Marvel die shows a plain 6, not the M face', () => {
        // MarvelDie#total maps both the M face and a raw 6 to the number 6, so
        // this must be checked against the raw face result, not roll.total.
        expect(isUltimateFantasticInitiative(roll({ marvelResult: 6, d1: 6, d2: 6 }), 'Initiative Roll')).toBe(false);
    });

    test('false when only one d6 shows a 6 (Fantastic, not Ultimate Fantastic)', () => {
        expect(isUltimateFantasticInitiative(roll({ marvelResult: 1, d1: 6, d2: 3 }), 'Initiative Roll')).toBe(false);
    });

    test('false when neither d6 shows a 6', () => {
        expect(isUltimateFantasticInitiative(roll({ marvelResult: 1, d1: 2, d2: 4 }), 'Initiative Roll')).toBe(false);
    });

    test('false without throwing when the roll is missing', () => {
        expect(isUltimateFantasticInitiative(null, 'Initiative Roll')).toBe(false);
    });

    test('false without throwing when the flavor is missing', () => {
        expect(isUltimateFantasticInitiative(roll({ marvelResult: 1, d1: 6, d2: 6 }), undefined)).toBe(false);
    });

    test('false without throwing when dice are missing', () => {
        expect(isUltimateFantasticInitiative({}, 'Initiative Roll')).toBe(false);
    });
});

describe('turnMarvelDieToM', () => {
    /** A roll whose total is the three faces shown plus 4, with the M counted as 6. */
    function evaluated(results) {
        const active = results.find((r) => r.active);
        return {
            dice: [d6(2), { results }, d6(5)],
            _total: 2 + (active.result === 1 ? 6 : active.result) + 5 + 4,
            get total() { return this._total; },
        };
    }

    test('the Marvel die shows its M face and the total rises by 6 less the face it showed', () => {
        const r = evaluated([{ result: 3, active: true }]);
        expect(turnMarvelDieToM(r)).toBe(true);
        expect(r.dice[1].results).toEqual([{ result: 1, count: 6, active: true }]);
        expect(r.total).toBe(17);
    });

    test('a Marvel die that already shows an M is left alone', () => {
        const r = evaluated([{ result: 1, count: 6, active: true }]);
        expect(turnMarvelDieToM(r)).toBe(false);
        expect(r.total).toBe(17);
    });

    test('after an edge on the Marvel die only the kept result is turned', () => {
        const r = evaluated([{ result: 4, active: true }, { result: 2, active: false, discarded: true }]);
        expect(turnMarvelDieToM(r)).toBe(true);
        expect(r.dice[1].results[0].result).toBe(1);
        expect(r.dice[1].results[1]).toEqual({ result: 2, active: false, discarded: true });
        expect(r.total).toBe(17);

        const keptLast = evaluated([{ result: 2, active: false, discarded: true }, { result: 4, active: true }]);
        expect(turnMarvelDieToM(keptLast)).toBe(true);
        expect(keptLast.dice[1].results[0]).toEqual({ result: 2, active: false, discarded: true });
        expect(keptLast.dice[1].results[1].result).toBe(1);
    });

    test('a roll with no Marvel die is left alone', () => {
        const r = { dice: [d6(4)], _total: 4, get total() { return this._total; } };
        expect(turnMarvelDieToM(r)).toBe(false);
        expect(r.total).toBe(4);
    });
});
