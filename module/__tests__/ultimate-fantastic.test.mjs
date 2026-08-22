/* eslint-env jest */
import { isUltimateFantasticInitiative } from '../helpers/ultimate-fantastic.mjs';

function roll({ isFantastic = false, d1 = 0, d2 = 0 } = {}) {
    return { isFantastic, dice: [{ total: d1 }, {}, { total: d2 }] };
}

describe('isUltimateFantasticInitiative', () => {
    test('true for a 6M6 result on an Initiative roll', () => {
        expect(isUltimateFantasticInitiative(roll({ isFantastic: true, d1: 6, d2: 6 }), 'Initiative Roll')).toBe(true);
    });

    test('false when the flavor is not an Initiative roll', () => {
        expect(isUltimateFantasticInitiative(roll({ isFantastic: true, d1: 6, d2: 6 }), 'Melee Attack')).toBe(false);
    });

    test('false when the Marvel die is not a Fantastic result', () => {
        expect(isUltimateFantasticInitiative(roll({ isFantastic: false, d1: 6, d2: 6 }), 'Initiative Roll')).toBe(false);
    });

    test('false when only one d6 shows a 6 (Fantastic, not Ultimate Fantastic)', () => {
        expect(isUltimateFantasticInitiative(roll({ isFantastic: true, d1: 6, d2: 3 }), 'Initiative Roll')).toBe(false);
    });

    test('false when neither d6 shows a 6', () => {
        expect(isUltimateFantasticInitiative(roll({ isFantastic: true, d1: 2, d2: 4 }), 'Initiative Roll')).toBe(false);
    });

    test('false without throwing when the roll is missing', () => {
        expect(isUltimateFantasticInitiative(null, 'Initiative Roll')).toBe(false);
    });

    test('false without throwing when the flavor is missing', () => {
        expect(isUltimateFantasticInitiative(roll({ isFantastic: true, d1: 6, d2: 6 }), undefined)).toBe(false);
    });
});
