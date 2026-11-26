/* eslint-env jest */
import { stunnedEdgeMode } from '../helpers/stunned.mjs';

describe('stunnedEdgeMode', () => {
    test('a stunned character has trouble on a normal check', () => {
        expect(stunnedEdgeMode(0, { stunned: true })).toBe(-1);
    });

    test('an attack against a stunned target has an edge', () => {
        expect(stunnedEdgeMode(0, { targetStunned: true })).toBe(1);
    });

    test('the mode is unchanged when nobody is stunned', () => {
        expect(stunnedEdgeMode(1)).toBe(1);
        expect(stunnedEdgeMode(-1)).toBe(-1);
    });

    test('being stunned cancels an edge the character already had', () => {
        expect(stunnedEdgeMode(1, { stunned: true })).toBe(0);
    });

    test('a stunned target cancels trouble the attacker already had', () => {
        expect(stunnedEdgeMode(-1, { targetStunned: true })).toBe(0);
    });

    test('a stunned attacker against a stunned target rolls normally', () => {
        expect(stunnedEdgeMode(0, { stunned: true, targetStunned: true })).toBe(0);
    });

    test('the result never goes past one edge or one trouble', () => {
        expect(stunnedEdgeMode(1, { targetStunned: true })).toBe(1);
        expect(stunnedEdgeMode(-1, { stunned: true })).toBe(-1);
    });
});
