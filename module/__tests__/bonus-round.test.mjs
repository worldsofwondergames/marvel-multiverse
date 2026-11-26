/* eslint-env jest */
import { nextBonusTurn, previousBonusTurn, shownRound } from '../helpers/bonus-round.mjs';

/** A turn order from a string. F is a Fantastic result, D a defeated Fantastic one, and anything else is neither. */
const order = (marks) => [...marks].map((m) => ({ fantastic: m === 'F' || m === 'D', defeated: m === 'D' }));

describe('nextBonusTurn', () => {
    test('the first bonus turn is the highest combatant with a Fantastic result', () => {
        expect(nextBonusTurn(order('-F-F'), -1, false)).toBe(1);
    });

    test('the next bonus turn passes over combatants without a Fantastic result', () => {
        expect(nextBonusTurn(order('F--F-'), 0, false)).toBe(3);
    });

    test('there is no bonus turn after the last Fantastic combatant', () => {
        expect(nextBonusTurn(order('F--F-'), 3, false)).toBeNull();
    });

    test('there is no bonus turn when nobody has a Fantastic result', () => {
        expect(nextBonusTurn(order('---'), -1, false)).toBeNull();
    });

    test('a defeated combatant is passed over only when defeated combatants are skipped', () => {
        expect(nextBonusTurn(order('DF'), -1, true)).toBe(1);
        expect(nextBonusTurn(order('DF'), -1, false)).toBe(0);
    });
});

describe('previousBonusTurn', () => {
    test('the previous bonus turn passes over combatants without a Fantastic result', () => {
        expect(previousBonusTurn(order('F--F-'), 3, false)).toBe(0);
    });

    test('there is no bonus turn before the first Fantastic combatant', () => {
        expect(previousBonusTurn(order('-F-F'), 1, false)).toBeNull();
    });

    test('from past the end of the order it gives the last Fantastic combatant', () => {
        expect(previousBonusTurn(order('F-F-'), 4, false)).toBe(2);
    });

    test('a defeated combatant is passed over only when defeated combatants are skipped', () => {
        expect(previousBonusTurn(order('FD-'), 2, true)).toBe(0);
        expect(previousBonusTurn(order('FD-'), 2, false)).toBe(1);
    });
});

describe('shownRound', () => {
    test('an encounter with a bonus round shows its stored round 2 as round 1', () => {
        expect(shownRound(2, true)).toBe(1);
        expect(shownRound(5, true)).toBe(4);
    });

    test('an encounter without a bonus round shows the stored round', () => {
        expect(shownRound(2, false)).toBe(2);
    });
});
