/* eslint-env jest */
import { jest } from '@jest/globals';
import { MARVEL_MULTIVERSE } from '../config.mjs';
import { MarvelMultiverseActor } from '../documents/actor.mjs';
import { MarvelMultiverseItem } from '../documents/item.mjs';
import { MarvelDie } from '../dice/dietype/marvel-die.mjs';

describe('Config', () => {
    test('MARVEL_MULTIVERSE has all six abilities', () => {
        expect(Object.keys(MARVEL_MULTIVERSE.abilities)).toEqual(['mle', 'agl', 'res', 'vig', 'ego', 'log']);
    });

    test('damageAbility maps abbreviations to names', () => {
        expect(MARVEL_MULTIVERSE.damageAbility.mle).toBe('Melee');
        expect(MARVEL_MULTIVERSE.damageAbility.agl).toBe('Agility');
        expect(MARVEL_MULTIVERSE.damageAbility.ego).toBe('Ego');
        expect(MARVEL_MULTIVERSE.damageAbility.log).toBe('Logic');
    });

    test('CONFIG.MARVEL_MULTIVERSE is populated by the system mock', () => {
        expect(global.CONFIG.MARVEL_MULTIVERSE).toBeDefined();
        expect(global.CONFIG.MARVEL_MULTIVERSE.abilities).toBeDefined();
    });
});

describe('MarvelMultiverseActor', () => {
    test('can be instantiated with minimal data', () => {
        const actor = new MarvelMultiverseActor({
            name: 'Spider-Man',
            flags: {},
            system: { abilities: {}, attributes: { rank: { value: 3 } } },
        });
        expect(actor.name).toBe('Spider-Man');
    });

    test('getRollData includes abilities and rank', () => {
        const actor = new MarvelMultiverseActor({
            name: 'Thor',
            flags: {},
            system: {
                abilities: {
                    mle: { value: 14 },
                    vig: { value: 12 },
                },
                attributes: { rank: { value: 5 } },
            },
        });
        const data = actor.getRollData();
        expect(data.mle).toEqual({ value: 14 });
        expect(data.vig).toEqual({ value: 12 });
        expect(data.rank).toBe(5);
    });
});

describe('MarvelMultiverseItem', () => {
    test('can be instantiated', () => {
        const item = new MarvelMultiverseItem({ name: 'Web-Shooters', type: 'power', system: {} });
        expect(item.name).toBe('Web-Shooters');
        expect(item.type).toBe('power');
    });

    test('prepareData appends ability to formula', () => {
        const item = new MarvelMultiverseItem({
            name: 'Repulsor Blast',
            type: 'power',
            formula: '1d10',
            system: { ability: 'agl' },
        });
        item.prepareData();
        expect(item.formula).toBe('1d10 + @agl.value');
    });

    test('prepareData clears formula when no ability is set', () => {
        const item = new MarvelMultiverseItem({
            name: 'Shield',
            type: 'power',
            formula: '1d6',
            system: { ability: null },
        });
        item.prepareData();
        expect(item.formula).toBe('');
    });
});

describe('MarvelDie', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('always has 6 faces regardless of constructor input', () => {
        const die = new MarvelDie({ faces: 20 });
        expect(die.faces).toBe(6);
    });

    test('rolling a 1 sets count to 6 (fantastic result)', () => {
        jest.spyOn(Math, 'random').mockReturnValueOnce(0.1); // ceil(0.6) = 1
        const die = new MarvelDie({});
        die.roll();
        expect(die.results[0].result).toBe(1);
        expect(die.results[0].count).toBe(6);
    });

    test('total returns 6 for a fantastic (1) result', () => {
        jest.spyOn(Math, 'random').mockReturnValueOnce(0.1); // ceil(0.6) = 1
        const die = new MarvelDie({});
        die.roll();
        expect(die.total).toBe(6);
    });

    test('non-1 roll is unmodified', () => {
        jest.spyOn(Math, 'random').mockReturnValueOnce(0.5); // ceil(3.0) = 3
        const die = new MarvelDie({});
        die.roll();
        expect(die.results[0].result).toBe(3);
        expect(die.results[0].count).toBeUndefined();
        expect(die.total).toBe(3);
    });

    test('getResultLabel returns "m" for 1 and the number string otherwise', () => {
        const die = new MarvelDie({});
        expect(die.getResultLabel({ result: 1 })).toBe('m');
        expect(die.getResultLabel({ result: 3 })).toBe('3');
        expect(die.getResultLabel({ result: 6 })).toBe('6');
    });

    test('getResultCSS marks result 1 as fantastic', () => {
        const die = new MarvelDie({});
        const css = die.getResultCSS({ result: 1 });
        expect(css).toContain('fantastic');
        expect(css).not.toContain('max');
    });

    test('getResultCSS marks result 6 as max', () => {
        const die = new MarvelDie({});
        const css = die.getResultCSS({ result: 6 });
        expect(css).toContain('max');
        expect(css).not.toContain('fantastic');
    });
});
