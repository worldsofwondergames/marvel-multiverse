/* eslint-env jest */
import { MarvelMultiverseActor } from '../documents/actor.mjs';
import { MarvelMultiverseRoll } from '../dice/roll.mjs';

function makeActor(overrides = {}) {
    return new MarvelMultiverseActor({
        name: 'Test Hero',
        flags: {},
        system: {
            abilities: {
                mle: { value: 3 },
                agl: { value: 5 },
                res: { value: 2 },
                vig: { value: 4 },
                ego: { value: 1 },
                log: { value: 2 },
            },
            attributes: { rank: { value: 3 }, init: { value: 0 } },
        },
        ...overrides,
    });
}

describe('MarvelMultiverseActor — getRollData', () => {
    test('copies each ability to the top level', () => {
        const actor = makeActor();
        const data = actor.getRollData();
        expect(data.mle).toEqual({ value: 3 });
        expect(data.agl).toEqual({ value: 5 });
        expect(data.vig).toEqual({ value: 4 });
    });

    test('exposes rank at the top level', () => {
        const actor = makeActor();
        expect(actor.getRollData().rank).toBe(3);
    });

    test('rank reflects actor rank value', () => {
        const actor = makeActor({ system: { abilities: {}, attributes: { rank: { value: 6 }, init: { value: 0 } } } });
        expect(actor.getRollData().rank).toBe(6);
    });

    test('ability objects are deep-cloned, not the same reference', () => {
        const actor = makeActor();
        const mle = actor.system.abilities.mle;
        const data = actor.getRollData();
        expect(data.mle).not.toBe(mle);
        expect(data.mle).toEqual(mle);
    });

    test('mutating returned data does not affect actor abilities', () => {
        const actor = makeActor();
        const data = actor.getRollData();
        data.mle.value = 999;
        expect(actor.system.abilities.mle.value).toBe(3);
    });

    test('works when abilities object is empty', () => {
        const actor = makeActor({ system: { abilities: {}, attributes: { rank: { value: 1 }, init: { value: 0 } } } });
        expect(() => actor.getRollData()).not.toThrow();
        expect(actor.getRollData().rank).toBe(1);
    });

    test('does not throw when abilities is null', () => {
        const actor = makeActor({
            system: { abilities: null, attributes: { rank: { value: 1 }, init: { value: 0 } } },
        });
        expect(() => actor.getRollData()).not.toThrow();
    });
});

describe('MarvelMultiverseActor — prepareDerivedData', () => {
    test('does not throw when flags.MarvelMultiverse is absent', () => {
        const actor = makeActor({ flags: {} });
        expect(() => actor.prepareDerivedData()).not.toThrow();
    });

    test('does not throw when flags.MarvelMultiverse is present', () => {
        const actor = makeActor({ flags: { MarvelMultiverse: { someFlag: true } } });
        expect(() => actor.prepareDerivedData()).not.toThrow();
    });

    test('does not throw when flags is completely empty object', () => {
        const actor = makeActor({ flags: {} });
        expect(() => actor.prepareDerivedData()).not.toThrow();
    });
});

describe('MarvelMultiverseActor — getInitiativeRoll', () => {
    test('returns a MarvelMultiverseRoll', () => {
        const actor = makeActor();
        const roll = actor.getInitiativeRoll();
        expect(roll).toBeInstanceOf(MarvelMultiverseRoll);
    });

    test('roll formula is the d616 pool {1d6,1dm,1d6}', () => {
        const actor = makeActor();
        const roll = actor.getInitiativeRoll();
        expect(roll.formula).toBe('{1d6,1dm,1d6}');
    });

    test('roll data includes abilities from getRollData', () => {
        const actor = makeActor();
        const roll = actor.getInitiativeRoll();
        expect(roll.data.mle).toEqual({ value: 3 });
        expect(roll.data.rank).toBe(3);
    });

    test('options are forwarded to the roll', () => {
        const actor = makeActor();
        const roll = actor.getInitiativeRoll({ edgeMode: MarvelMultiverseRoll.EDGE_MODE.EDGE });
        expect(roll.options.edgeMode).toBe(MarvelMultiverseRoll.EDGE_MODE.EDGE);
    });

    test('returns a clone of _cachedInitiativeRoll when set', () => {
        const actor = makeActor();
        const cached = new MarvelMultiverseRoll('{1d6,1dm,1d6}', {}, { configured: true });
        actor._cachedInitiativeRoll = cached;
        const returned = actor.getInitiativeRoll();
        expect(returned).not.toBe(cached);
        expect(returned.formula).toBe(cached.formula);
    });

    test('clone from cache is a distinct object (mutating it does not affect cache)', () => {
        const actor = makeActor();
        const cached = new MarvelMultiverseRoll('{1d6,1dm,1d6}', {}, { configured: true });
        actor._cachedInitiativeRoll = cached;
        const clone = actor.getInitiativeRoll();
        clone.formula = 'mutated';
        expect(cached.formula).toBe('{1d6,1dm,1d6}');
    });

    test('returns cached formula when _cachedInitiativeRoll has a unique formula', () => {
        const actor = makeActor();
        const cached = new MarvelMultiverseRoll('unique-cached-formula', {}, { configured: true });
        actor._cachedInitiativeRoll = cached;
        expect(actor.getInitiativeRoll().formula).toBe('unique-cached-formula');
    });
});
