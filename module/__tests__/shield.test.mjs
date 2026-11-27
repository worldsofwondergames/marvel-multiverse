/* eslint-env jest */
import MarvelMultiverseActorBase from '../data/actor-base.mjs';
import MarvelMultiverseNPC from '../data/npc.mjs';
import {
    SHIELD_POWER_SET,
    SHIELD_THROWN,
    isShieldBearerPower,
    shieldRefusesPower,
    throwsShield,
} from '../helpers/shield.mjs';

const RETURN_TEXT = '<p>The enemy takes regular damage. The shield then bounces back to the character.</p>';

function power({ id = 'p1', sets = [SHIELD_POWER_SET], effect = '', type = 'power' } = {}) {
    return { id, type, system: { powerSets: sets.map((name) => ({ name })), effect } };
}

describe('isShieldBearerPower', () => {
    test('a power counts when any of its power sets is Shield Bearer', () => {
        expect(isShieldBearerPower(power())).toBe(true);
        expect(isShieldBearerPower(power({ sets: ['Martial Arts', SHIELD_POWER_SET] }))).toBe(true);
        expect(isShieldBearerPower(power({ sets: ['Martial Arts'] }))).toBe(false);
    });

    test('an item that is not a power does not count', () => {
        expect(isShieldBearerPower(power({ type: 'weapon' }))).toBe(false);
    });
});

describe('throwsShield', () => {
    test('a Shield Bearer power throws the shield when its effect says the shield bounces back', () => {
        expect(throwsShield(power({ effect: RETURN_TEXT }))).toBe(true);
        expect(throwsShield(power({ effect: '<p>The attack has trouble.</p>' }))).toBe(false);
    });

    test('the same text on a power outside the set does not count', () => {
        expect(throwsShield(power({ sets: ['Ranged Weapons'], effect: RETURN_TEXT }))).toBe(false);
    });
});

describe('shieldRefusesPower', () => {
    const state = (over) => ({ thrown: true, thrownBy: 'thrower', item: power({ id: 'other' }), ...over });

    test('another Shield Bearer power is refused while the shield is away', () => {
        expect(shieldRefusesPower(state())).toBe(true);
    });

    test('the power that threw the shield stays usable', () => {
        expect(shieldRefusesPower(state({ item: power({ id: 'thrower' }) }))).toBe(false);
    });

    test('nothing is refused while the character has the shield', () => {
        expect(shieldRefusesPower(state({ thrown: false }))).toBe(false);
    });

    test('a power outside the set is never refused', () => {
        expect(shieldRefusesPower(state({ item: power({ id: 'other', sets: ['Martial Arts'] }) }))).toBe(false);
    });
});

describe('Health Damage Reduction while the shield is away', () => {
    const ability = () => ({ value: 0, defense: 0, noncom: 0, damageMultiplier: 0, edge: false, label: '' });
    const movement = () => ({ value: 0, noncom: 0, active: true, calc: '', noncomMultiplier: 1, label: '' });
    const reduction = (value, parent) => ({
        disabled: false,
        parent,
        changes: [{ key: 'system.healthDamageReduction', value: String(value), mode: 2 }],
    });

    /** The Health DR of an actor with a shield power (DR 3) and another power (DR 1). */
    function healthDR(Model, statuses) {
        const effects = [reduction(3, power()), reduction(1, power({ sets: ['Basic'] }))];
        const names = ['run', 'climb', 'swim', 'jump', 'flight', 'glide', 'swingline', 'levitation'];
        const instance = new Model({
            attributes: { rank: { value: 1 }, init: { value: 0, edge: false, trouble: false } },
            abilities: Object.fromEntries(['mle', 'agl', 'res', 'vig', 'ego', 'log'].map((key) => [key, ability()])),
            health: { value: 0, max: 0, bonus: 0 },
            focus: { value: 0, max: 0, bonus: 0 },
            healthDamageReduction: 0,
            focusDamageReduction: 0,
            movement: Object.fromEntries(names.map((name) => [name, movement()])),
        });
        instance.parent = {
            items: [],
            effects,
            statuses: new Set(statuses),
            allApplicableEffects: function* () { yield* effects; },
        };
        instance.prepareDerivedData();
        return instance.healthDamageReduction;
    }

    for (const [label, Model] of [['character', MarvelMultiverseActorBase], ['npc', MarvelMultiverseNPC]]) {
        test(`a ${label} loses the Shield Bearer reduction and keeps the rest`, () => {
            expect(healthDR(Model, [])).toBe(3);
            expect(healthDR(Model, [SHIELD_THROWN])).toBe(1);
        });
    }
});
