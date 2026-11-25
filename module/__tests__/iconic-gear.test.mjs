/* eslint-env jest */
import { jest } from '@jest/globals';
import { battleSuitChanges, syncBattleSuitEffect, iconicWeaponAttacks } from '../helpers/iconic-gear.mjs';

const suitSystem = (abilityModifiers = {}, extra = {}) => ({
    equipped: true,
    rankIncrease: 0,
    abilityModifiers: { melee: 0, agility: 0, resilience: 0, vigilance: 0, ego: 0, logic: 0, ...abilityModifiers },
    ...extra,
});

describe('battleSuitChanges', () => {
    test('each modifier that is not zero adds to its ability, including a negative one', () => {
        expect(battleSuitChanges(suitSystem({ melee: 5, agility: -2 }))).toEqual([
            { key: 'system.abilities.mle.value', mode: 2, value: '5' },
            { key: 'system.abilities.agl.value', mode: 2, value: '-2' },
        ]);
    });

    test('a rank increase adds to rank', () => {
        expect(battleSuitChanges(suitSystem({}, { rankIncrease: 3 }))).toEqual([
            { key: 'system.attributes.rank.value', mode: 2, value: '3' },
        ]);
    });

    test('a suit with no modifiers makes no changes', () => {
        expect(battleSuitChanges(suitSystem())).toEqual([]);
    });
});

describe('syncBattleSuitEffect', () => {
    const effectFor = (itemId, id = 'e1') => ({
        id,
        flags: { 'marvel-multiverse': { battleSuitId: itemId } },
        update: jest.fn(),
    });
    const actorWith = (...effects) => ({ effects, deleteEmbeddedDocuments: jest.fn() });
    const suit = (system) => ({ id: 'suit1', name: 'Test Suit', img: 'suit.svg', system });

    beforeEach(() => {
        globalThis.ActiveEffect = { create: jest.fn() };
    });

    test('an equipped suit with no effect yet gets one, tied to the suit', async () => {
        const actor = actorWith();
        await syncBattleSuitEffect(actor, suit(suitSystem({ melee: 2 })));
        expect(ActiveEffect.create).toHaveBeenCalledTimes(1);
        const [data, options] = ActiveEffect.create.mock.calls[0];
        expect(data.changes).toEqual([{ key: 'system.abilities.mle.value', mode: 2, value: '2' }]);
        expect(data.flags['marvel-multiverse'].battleSuitId).toBe('suit1');
        expect(options.parent).toBe(actor);
    });

    test('an equipped suit that has an effect updates it and creates no second one', async () => {
        const effect = effectFor('suit1');
        const actor = actorWith(effect);
        await syncBattleSuitEffect(actor, suit(suitSystem({ melee: 5 })));
        expect(effect.update).toHaveBeenCalledTimes(1);
        expect(effect.update.mock.calls[0][0].changes).toEqual([{ key: 'system.abilities.mle.value', mode: 2, value: '5' }]);
        expect(ActiveEffect.create).not.toHaveBeenCalled();
        expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
    });

    test('a suit that is not equipped loses its effect', async () => {
        const actor = actorWith(effectFor('suit1'));
        await syncBattleSuitEffect(actor, suit(suitSystem({ melee: 5 }, { equipped: false })));
        expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['e1']);
        expect(ActiveEffect.create).not.toHaveBeenCalled();
    });

    test('an equipped suit whose modifiers were all cleared loses its effect', async () => {
        const actor = actorWith(effectFor('suit1'));
        await syncBattleSuitEffect(actor, suit(suitSystem()));
        expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['e1']);
    });

    test('the effect of another suit is left alone', async () => {
        const other = effectFor('suit2', 'e2');
        const actor = actorWith(other);
        await syncBattleSuitEffect(actor, suit(suitSystem({ melee: 5 }, { equipped: false })));
        expect(actor.deleteEmbeddedDocuments).not.toHaveBeenCalled();
        expect(other.update).not.toHaveBeenCalled();
    });

    test('a duplicate effect for the same suit is removed and the first is kept', async () => {
        const first = effectFor('suit1', 'e1');
        const actor = actorWith(first, effectFor('suit1', 'e2'));
        await syncBattleSuitEffect(actor, suit(suitSystem({ melee: 5 })));
        expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['e2']);
        expect(first.update).toHaveBeenCalledTimes(1);
    });
});

describe('iconicWeaponAttacks', () => {
    const weapon = (weaponData) => ({
        weaponData: { isWeapon: true, meleeRange: '', rangedRange: '', meleeDamageMultiplierBonus: 0, rangedDamageMultiplierBonus: 0, ...weaponData },
    });

    test('an item with a melee and a ranged bonus has both attacks, each on its own ability', () => {
        const attacks = iconicWeaponAttacks(weapon({ meleeRange: 'Reach', rangedRange: '10', meleeDamageMultiplierBonus: 1, rangedDamageMultiplierBonus: 2 }));
        expect(attacks).toEqual([
            { mode: 'melee', ability: 'mle', range: 'Reach', bonus: 1 },
            { mode: 'ranged', ability: 'agl', range: '10', bonus: 2 },
        ]);
    });

    test('an attack with no range and no bonus is left out', () => {
        const attacks = iconicWeaponAttacks(weapon({ rangedRange: '5', rangedDamageMultiplierBonus: 1 }));
        expect(attacks.map(a => a.mode)).toEqual(['ranged']);
    });

    test('an attack with a range and no bonus is still listed', () => {
        const attacks = iconicWeaponAttacks(weapon({ meleeRange: 'Reach' }));
        expect(attacks).toEqual([{ mode: 'melee', ability: 'mle', range: 'Reach', bonus: 0 }]);
    });

    test('an item that does not function as a weapon has no attacks', () => {
        expect(iconicWeaponAttacks(weapon({ isWeapon: false, meleeRange: 'Reach', meleeDamageMultiplierBonus: 2 }))).toEqual([]);
    });

    test('an item with no weapon data has no attacks', () => {
        expect(iconicWeaponAttacks({})).toEqual([]);
        expect(iconicWeaponAttacks(undefined)).toEqual([]);
    });
});
