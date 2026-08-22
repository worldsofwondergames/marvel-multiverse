/* eslint-env jest */
import { isUltimateFantasticInitiative } from '../helpers/ultimate-fantastic.mjs';

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
