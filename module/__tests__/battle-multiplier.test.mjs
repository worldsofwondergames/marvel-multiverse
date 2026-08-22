/* eslint-env jest */
import MarvelMultiverseCharacter from '../data/character.mjs';
import MarvelMultiverseNPC from '../data/npc.mjs';

function ability(value = 0) {
    return { value, defense: 0, noncom: 0, damageMultiplier: 0, edge: false, label: '' };
}

function movementSlot(value = 0) {
    return { value, noncom: value, active: true, calc: '', noncomMultiplier: 1, label: '' };
}

function baseData({ res = 3, vig = 3 } = {}) {
    return {
        attributes: { rank: { value: 1 }, init: { value: 0, edge: false, trouble: false } },
        abilities: {
            mle: ability(0), agl: ability(0), res: ability(res), vig: ability(vig),
            ego: ability(0), log: ability(0),
        },
        health: { value: 0, max: 0, bonus: 0 },
        focus: { value: 0, max: 0, bonus: 0 },
        healthDamageReduction: 0,
        focusDamageReduction: 0,
        movement: {
            run: movementSlot(5), climb: movementSlot(0), swim: movementSlot(0), jump: movementSlot(0),
            flight: movementSlot(0), glide: movementSlot(0), swingline: movementSlot(0), levitation: movementSlot(0),
        },
    };
}

describe('Battle Multiplier — Health/Focus scaling', () => {
    afterEach(() => {
        global.gameSettingsGetMock.mockReset();
    });

    test('Character: defaults to x30 when the setting is unregistered', () => {
        global.gameSettingsGetMock.mockImplementation(() => undefined);
        const character = new MarvelMultiverseCharacter(baseData({ res: 3, vig: 3 }));
        character.prepareDerivedData();
        expect(character.health.max).toBe(90);
        expect(character.focus.max).toBe(90);
    });

    test('Character: scales Health and Focus with a configured multiplier', () => {
        global.gameSettingsGetMock.mockImplementation((mod, key) => (key === 'battleMultiplier' ? 10 : undefined));
        const character = new MarvelMultiverseCharacter(baseData({ res: 3, vig: 3 }));
        character.prepareDerivedData();
        expect(character.health.max).toBe(30);
        expect(character.focus.max).toBe(30);
    });

    test('NPC: scales Health and Focus with a configured multiplier', () => {
        global.gameSettingsGetMock.mockImplementation((mod, key) => (key === 'battleMultiplier' ? 100 : undefined));
        const npc = new MarvelMultiverseNPC(baseData({ res: 2, vig: 2 }));
        npc.prepareDerivedData();
        expect(npc.health.max).toBe(200);
        expect(npc.focus.max).toBe(200);
    });
});
