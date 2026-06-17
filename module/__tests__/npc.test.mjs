/* eslint-env jest */
import { jest } from '@jest/globals';
import MarvelMultiverseNPC from '../data/npc.mjs';

function makeNPC({ rank = 1, abilities = {}, run = 5, movementOverrides = {} } = {}) {
    const ability = (value = 0) => ({ value, defense: 0, noncom: 0, damageMultiplier: 0, edge: false, label: '' });
    const movement = (value = 0, calc = '', noncomMultiplier = 1) => ({ value, noncom: value, active: true, calc, noncomMultiplier, label: '' });
    const instance = new MarvelMultiverseNPC({
        attributes: { rank: { value: rank }, init: { value: 0, edge: false, trouble: false } },
        abilities: {
            mle: ability(abilities.mle ?? 0),
            agl: ability(abilities.agl ?? 0),
            res: ability(abilities.res ?? 0),
            vig: ability(abilities.vig ?? 0),
            ego: ability(abilities.ego ?? 0),
            log: ability(abilities.log ?? 0),
        },
        movement: {
            run: movement(run),
            climb: movement(0),
            swim: movement(0),
            jump: movement(0),
            flight: movement(0),
            glide: movement(0),
            swingline: movement(0),
            levitation: movement(0),
            ...movementOverrides,
        },
    });
    instance.prepareDerivedData();
    return instance;
}

describe('MarvelMultiverseNPC — Ability Defense', () => {
    test('defense = ability value + 10', () => {
        const npc = makeNPC({ abilities: { mle: 4 } });
        expect(npc.abilities.mle.defense).toBe(14);
    });

    test('zero ability → defense 10', () => {
        const npc = makeNPC({ abilities: { ego: 0 } });
        expect(npc.abilities.ego.defense).toBe(10);
    });

    test('all six abilities get defense calculated', () => {
        const npc = makeNPC({ abilities: { mle: 1, agl: 2, res: 3, vig: 4, ego: 5, log: 6 } });
        expect(npc.abilities.mle.defense).toBe(11);
        expect(npc.abilities.agl.defense).toBe(12);
        expect(npc.abilities.res.defense).toBe(13);
        expect(npc.abilities.vig.defense).toBe(14);
        expect(npc.abilities.ego.defense).toBe(15);
        expect(npc.abilities.log.defense).toBe(16);
    });
});

describe('MarvelMultiverseNPC — Damage Multiplier', () => {
    test('DM = rank for all abilities (rank 2)', () => {
        const npc = makeNPC({ rank: 2 });
        for (const key of ['mle', 'agl', 'res', 'vig', 'ego', 'log']) {
            expect(npc.abilities[key].damageMultiplier).toBe(2);
        }
    });

    test('DM = rank 5', () => {
        const npc = makeNPC({ rank: 5 });
        expect(npc.abilities.mle.damageMultiplier).toBe(5);
    });
});

describe('MarvelMultiverseNPC — Non-Combat Checks', () => {
    test('noncom = ability value', () => {
        const npc = makeNPC({ abilities: { log: 8 } });
        expect(npc.abilities.log.noncom).toBe(8);
    });

    test('noncom = 0 when ability is 0', () => {
        const npc = makeNPC({ abilities: { res: 0 } });
        expect(npc.abilities.res.noncom).toBe(0);
    });
});

describe('MarvelMultiverseNPC — Initiative', () => {
    test('initiative = Vigilance value', () => {
        const npc = makeNPC({ abilities: { vig: 5 } });
        expect(npc.attributes.init.value).toBe(5);
    });

    test('initiative = 0 when Vigilance is 0', () => {
        const npc = makeNPC({ abilities: { vig: 0 } });
        expect(npc.attributes.init.value).toBe(0);
    });
});

describe('MarvelMultiverseNPC — Climb/Jump/Swim Movement', () => {
    test('ceil(run × 0.5): run 6 → 3', () => {
        const npc = makeNPC({ run: 6 });
        expect(npc.movement.climb.value).toBe(3);
        expect(npc.movement.jump.value).toBe(3);
        expect(npc.movement.swim.value).toBe(3);
    });

    test('ceil(run × 0.5): run 7 → 4 (rounds up)', () => {
        const npc = makeNPC({ run: 7 });
        expect(npc.movement.climb.value).toBe(4);
    });

    test('ceil(run × 0.5): run 1 → 1', () => {
        const npc = makeNPC({ run: 1 });
        expect(npc.movement.climb.value).toBe(1);
    });
});

describe('MarvelMultiverseNPC — Movement Calc Modes', () => {
    test('"half" halves flight value', () => {
        const npc = makeNPC({ movementOverrides: { flight: { value: 8, noncom: 0, active: true, noncomMultiplier: 1, calc: 'half', label: '' } } });
        expect(npc.movement.flight.value).toBe(4);
    });

    test('"double" doubles flight value', () => {
        const npc = makeNPC({ movementOverrides: { flight: { value: 6, noncom: 0, active: true, noncomMultiplier: 1, calc: 'double', label: '' } } });
        expect(npc.movement.flight.value).toBe(12);
    });

    test('"triple" triples flight value', () => {
        const npc = makeNPC({ movementOverrides: { flight: { value: 3, noncom: 0, active: true, noncomMultiplier: 1, calc: 'triple', label: '' } } });
        expect(npc.movement.flight.value).toBe(9);
    });

    test('"runspeed" sets flight to run speed', () => {
        const npc = makeNPC({ run: 10, movementOverrides: { flight: { value: 0, noncom: 0, active: true, noncomMultiplier: 1, calc: 'runspeed', label: '' } } });
        expect(npc.movement.flight.value).toBe(10);
    });

    test('"rank" multiplies value by rank (value > 0)', () => {
        const npc = makeNPC({ rank: 4, movementOverrides: { flight: { value: 3, noncom: 0, active: true, noncomMultiplier: 1, calc: 'rank', label: '' } } });
        expect(npc.movement.flight.value).toBe(12);
    });

    test('"rank" uses 1 when value is 0', () => {
        const npc = makeNPC({ rank: 4, movementOverrides: { flight: { value: 0, noncom: 0, active: true, noncomMultiplier: 1, calc: 'rank', label: '' } } });
        expect(npc.movement.flight.value).toBe(4);
    });
});

describe('MarvelMultiverseNPC — Movement Auto-Activation', () => {
    test('movement type with calc mode is automatically activated', () => {
        const npc = makeNPC({
            movementOverrides: {
                flight: { value: 0, noncom: 0, active: false, noncomMultiplier: 1, calc: 'runspeed', label: '' },
            },
        });
        expect(npc.movement.flight.active).toBe(true);
    });

    test('movement type without calc mode stays inactive', () => {
        const npc = makeNPC({
            movementOverrides: {
                flight: { value: 0, noncom: 0, active: false, noncomMultiplier: 1, calc: '', label: '' },
            },
        });
        expect(npc.movement.flight.active).toBe(false);
    });
});

describe('MarvelMultiverseNPC — Non-Combat Movement Speed', () => {
    test('noncom defaults to combat value when noncomMultiplier is 1', () => {
        const npc = makeNPC({ run: 6 });
        expect(npc.movement.run.noncom).toBe(6);
    });

    test('noncom = value × noncomMultiplier (3× for Speed Run)', () => {
        const npc = makeNPC({
            run: 5, rank: 3,
            movementOverrides: {
                run: { value: 5, noncom: 0, active: true, noncomMultiplier: 3, calc: 'runspeed-rank', label: '' },
            },
        });
        expect(npc.movement.run.value).toBe(15);
        expect(npc.movement.run.noncom).toBe(45);
    });

    test('noncom = value × noncomMultiplier (3× for Flight)', () => {
        const npc = makeNPC({
            run: 5, rank: 4,
            movementOverrides: {
                flight: { value: 0, noncom: 0, active: true, noncomMultiplier: 3, calc: 'runspeed-rank', label: '' },
            },
        });
        expect(npc.movement.flight.value).toBe(20);
        expect(npc.movement.flight.noncom).toBe(60);
    });

    test('noncom for climb defaults to combat value', () => {
        const npc = makeNPC({ run: 6 });
        expect(npc.movement.climb.value).toBe(3);
        expect(npc.movement.climb.noncom).toBe(3);
    });

    test('noncom applies after calc mode (triple + 2× multiplier)', () => {
        const npc = makeNPC({
            movementOverrides: {
                flight: { value: 3, noncom: 0, active: true, noncomMultiplier: 2, calc: 'triple', label: '' },
            },
        });
        expect(npc.movement.flight.value).toBe(9);
        expect(npc.movement.flight.noncom).toBe(18);
    });
});

describe('MarvelMultiverseNPC — Label Localization Fallback', () => {
    afterEach(() => jest.restoreAllMocks());

    test('ability label falls back to key when localize returns null', () => {
        jest.spyOn(game.i18n, 'localize').mockImplementation(() => null);
        const npc = makeNPC({ abilities: { mle: 3 } });
        expect(npc.abilities.mle.label).toBe('mle');
        expect(npc.abilities.log.label).toBe('log');
    });

    test('movement label falls back to key when localize returns null', () => {
        jest.spyOn(game.i18n, 'localize').mockImplementation(() => null);
        const npc = makeNPC({ run: 5 });
        expect(npc.movement.run.label).toBe('run');
        expect(npc.movement.swim.label).toBe('swim');
    });
});
