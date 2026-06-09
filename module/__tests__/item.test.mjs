/* eslint-env jest */
import { jest } from '@jest/globals';
import { MarvelMultiverseItem } from '../documents/item.mjs';
import { MarvelMultiverseRoll } from '../dice/roll.mjs';

function makeItem(overrides = {}) {
    return new MarvelMultiverseItem({
        name: 'Test Power',
        type: 'power',
        formula: '1d6',
        system: {
            ability: 'mle',
            formula: '1d6',
            description: 'A test power.',
            damageType: null,
            attack: false,
            effect: '',
        },
        ...overrides,
    });
}

describe('MarvelMultiverseItem — prepareDerivedData edge cases', () => {
    test('ability set, formula present → appends @ability.value', () => {
        const item = makeItem({ formula: '2d6', system: { ability: 'agl', formula: '2d6', description: '', damageType: null, attack: false, effect: '' } });
        item.prepareDerivedData();
        expect(item.formula).toBe('2d6 + @agl.value');
    });

    test('ability set, formula is empty string → cleared to empty string', () => {
        const item = makeItem({ formula: '', system: { ability: 'mle', formula: '', description: '', damageType: null, attack: false, effect: '' } });
        item.prepareDerivedData();
        expect(item.formula).toBe('');
    });

    test('ability is empty string (falsy) → formula cleared', () => {
        const item = makeItem({ formula: '1d6', system: { ability: '', formula: '1d6', description: '', damageType: null, attack: false, effect: '' } });
        item.prepareDerivedData();
        expect(item.formula).toBe('');
    });

    test('ability is null → formula cleared', () => {
        const item = makeItem({ formula: '1d6', system: { ability: null, formula: '1d6', description: '', damageType: null, attack: false, effect: '' } });
        item.prepareDerivedData();
        expect(item.formula).toBe('');
    });

    test('ability is undefined → formula cleared', () => {
        const item = makeItem({ formula: '1d6', system: { formula: '1d6', description: '', damageType: null, attack: false, effect: '' } });
        item.prepareDerivedData();
        expect(item.formula).toBe('');
    });

    test('prepareData() calls prepareDerivedData() (integration)', () => {
        const item = makeItem({ formula: '3d6', system: { ability: 'vig', formula: '3d6', description: '', damageType: null, attack: false, effect: '' } });
        item.prepareData();
        expect(item.formula).toBe('3d6 + @vig.value');
    });
});

describe('MarvelMultiverseItem — getRollData', () => {
    test('returns system data when no parent actor', () => {
        const item = makeItem();
        const data = item.getRollData();
        expect(data.ability).toBe('mle');
        expect(data.actor).toBeUndefined();
    });

    test('actor property is absent when item.actor is null', () => {
        const item = makeItem();
        item.actor = null;
        expect(item.getRollData().actor).toBeUndefined();
    });

    test('includes actor.getRollData() result when parent actor is present', () => {
        const item = makeItem();
        item.actor = { getRollData: () => ({ rank: 4, mle: { value: 7 } }) };
        const data = item.getRollData();
        expect(data.actor).toEqual({ rank: 4, mle: { value: 7 } });
    });

    test('actor data does not overwrite item system data', () => {
        const item = makeItem();
        item.actor = { getRollData: () => ({ ability: 'agl' }) };
        const data = item.getRollData();
        // item.system.ability is 'mle'; actor roll data is nested under data.actor
        expect(data.ability).toBe('mle');
        expect(data.actor.ability).toBe('agl');
    });
});

describe('MarvelMultiverseItem — roll', () => {
    let createSpy;

    beforeEach(() => {
        jest.clearAllMocks();
        createSpy = jest.spyOn(ChatMessage, 'create').mockImplementation(() => {});
        // item.roll() calls roll.toMessage() without await; mock it to prevent
        // the unhandled rejection from isFantastic on a roll with empty dice.
        jest.spyOn(MarvelMultiverseRoll.prototype, 'toMessage').mockResolvedValue({});
    });

    afterEach(() => jest.restoreAllMocks());

    test('always creates a chat message', async () => {
        await makeItem().roll();
        expect(createSpy).toHaveBeenCalledTimes(1);
    });

    test('chat message includes item name in content', async () => {
        const item = makeItem({ name: 'Web Shot' });
        await item.roll();
        const [args] = createSpy.mock.calls[0];
        expect(args.content).toContain('');
    });

    test('label includes ability and item type', async () => {
        const item = makeItem({ type: 'power', system: { ability: 'mle', formula: '', description: '', damageType: null, attack: false, effect: '' } });
        await item.roll();
        const [args] = createSpy.mock.calls[0];
        expect(args.flavor).toContain('Melee');
        expect(args.flavor).toContain('power');
    });

    test('label includes damageType when set', async () => {
        const item = makeItem({ system: { ability: 'mle', formula: '', description: '', damageType: 'energy', attack: false, effect: '' } });
        await item.roll();
        const [args] = createSpy.mock.calls[0];
        expect(args.flavor).toContain('energy');
    });

    test('label omits damageType when null', async () => {
        const item = makeItem({ system: { ability: 'mle', formula: '', description: '', damageType: null, attack: false, effect: '' } });
        await item.roll();
        const [args] = createSpy.mock.calls[0];
        expect(args.flavor).not.toContain('damagetype');
    });

    test('returns undefined when system.formula is empty', async () => {
        const item = makeItem({ system: { ability: 'mle', formula: '', description: '', damageType: null, attack: false, effect: '' } });
        const result = await item.roll();
        expect(result).toBeUndefined();
    });

    test('returns undefined when system.ability is absent', async () => {
        const item = makeItem({ system: { ability: null, formula: '1d6', description: '', damageType: null, attack: false, effect: '' } });
        const result = await item.roll();
        expect(result).toBeUndefined();
    });

    test('returns a MarvelMultiverseRoll when formula and ability are both set', async () => {
        const item = makeItem();
        const result = await item.roll();
        expect(result).toBeInstanceOf(MarvelMultiverseRoll);
    });

    test('fires rollAttack and calcDamage hooks when system.attack is true', async () => {
        const item = makeItem({ system: { ability: 'mle', formula: '1d6', description: '', damageType: null, attack: true, effect: '' } });
        await item.roll();
        expect(global.hooksCallAllMock).toHaveBeenCalledWith('marvel-multiverse.rollAttack', item, expect.anything());
        expect(global.hooksCallAllMock).toHaveBeenCalledWith('marvel-multiverse.calcDamage', item, expect.anything());
    });

    test('does not fire hooks when system.attack is false', async () => {
        await makeItem().roll();
        expect(global.hooksCallAllMock).not.toHaveBeenCalled();
    });

    test('effect text appears in content when effect is set', async () => {
        const item = makeItem({ system: { ability: 'mle', formula: '', description: 'Desc', damageType: null, attack: false, effect: 'Web you up' } });
        await item.roll();
        const [args] = createSpy.mock.calls[0];
        expect(args.content).toContain('Web you up');
    });

    test('content has empty effect div when effect is absent', async () => {
        const item = makeItem({ system: { ability: 'mle', formula: '', description: 'Desc', damageType: null, attack: false, effect: '' } });
        await item.roll();
        const [args] = createSpy.mock.calls[0];
        expect(args.content).toContain('<div></div>');
    });
});
