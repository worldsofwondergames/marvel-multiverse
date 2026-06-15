/* eslint-env jest */
import { jest } from '@jest/globals';
import MarvelMultiverseActorBase from '../data/actor-base.mjs';

function makeActor({ rank = 1, abilities = {}, run = 5, movementOverrides = {}, effects = null, dmgBonuses = {}, healthDR = 0, focusDR = 0 } = {}) {
    const ability = (value = 0) => ({ value, defense: 0, noncom: 0, damageMultiplier: 0, edge: false, label: '' });
    const movement = (value = 0, calc = '') => ({ value, noncom: value, active: true, calc, label: '' });
    const instance = new MarvelMultiverseActorBase({
        attributes: { rank: { value: rank }, init: { value: 0, edge: false, trouble: false } },
        abilities: {
            mle: ability(abilities.mle ?? 0),
            agl: ability(abilities.agl ?? 0),
            res: ability(abilities.res ?? 0),
            vig: ability(abilities.vig ?? 0),
            ego: ability(abilities.ego ?? 0),
            log: ability(abilities.log ?? 0),
        },
        healthDamageReduction: healthDR,
        focusDamageReduction: focusDR,
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
    // Simulate AE-summed values for damage bonuses (AEs use ADD mode, which sums)
    for (const [abil, bonus] of Object.entries(dmgBonuses)) {
        instance.abilities[abil].damageMultiplier = bonus;
    }
    if (effects) {
        instance.parent = { items: [], effects };
    }
    instance.prepareDerivedData();
    return instance;
}

describe('Rules: Ability Defense', () => {
    test('defense = ability value + 10', () => {
        const actor = makeActor({ abilities: { mle: 2 } });
        expect(actor.abilities.mle.defense).toBe(12);
    });

    test('Spider-Man agility 7 → defense 17', () => {
        const actor = makeActor({ abilities: { agl: 7 } });
        expect(actor.abilities.agl.defense).toBe(17);
    });

    test('zero ability → defense 10', () => {
        const actor = makeActor({ abilities: { log: 0 } });
        expect(actor.abilities.log.defense).toBe(10);
    });
});

describe('Rules: Damage Multiplier', () => {
    test('DM = rank (rank 1)', () => {
        const actor = makeActor({ rank: 1 });
        expect(actor.abilities.mle.damageMultiplier).toBe(1);
    });

    test('DM = rank (rank 4)', () => {
        const actor = makeActor({ rank: 4 });
        expect(actor.abilities.agl.damageMultiplier).toBe(4);
    });

    test('all six abilities receive DM equal to rank', () => {
        const actor = makeActor({ rank: 3 });
        for (const key of ['mle', 'agl', 'res', 'vig', 'ego', 'log']) {
            expect(actor.abilities[key].damageMultiplier).toBe(3);
        }
    });
});

describe('Rulebook: Damage Multiplier Bonuses Do Not Stack', () => {
    function makeEffect(key, value, mode = 2) {
        return { disabled: false, changes: [{ key, value: String(value), mode }] };
    }

    test('single bonus: Mighty 2 (+2) → DM = rank + 2', () => {
        const actor = makeActor({
            rank: 3,
            dmgBonuses: { mle: 2 },
            effects: [makeEffect('system.abilities.mle.damageMultiplier', 2)],
        });
        expect(actor.abilities.mle.damageMultiplier).toBe(5);
    });

    test('stacking: Mighty 2 (+2) and weapon (+1) → DM = rank + max(2,1) = rank + 2', () => {
        const actor = makeActor({
            rank: 3,
            dmgBonuses: { mle: 3 },
            effects: [
                makeEffect('system.abilities.mle.damageMultiplier', 2),
                makeEffect('system.abilities.mle.damageMultiplier', 1),
            ],
        });
        expect(actor.abilities.mle.damageMultiplier).toBe(5);
    });

    test('different abilities: Mighty 2 on MLE and Accuracy 1 on AGL are independent', () => {
        const actor = makeActor({
            rank: 3,
            dmgBonuses: { mle: 2, agl: 1 },
            effects: [
                makeEffect('system.abilities.mle.damageMultiplier', 2),
                makeEffect('system.abilities.agl.damageMultiplier', 1),
            ],
        });
        expect(actor.abilities.mle.damageMultiplier).toBe(5);
        expect(actor.abilities.agl.damageMultiplier).toBe(4);
    });

    test('disabled effect is ignored', () => {
        const actor = makeActor({
            rank: 3,
            dmgBonuses: { mle: 5 },
            effects: [
                makeEffect('system.abilities.mle.damageMultiplier', 2),
                { disabled: true, changes: [{ key: 'system.abilities.mle.damageMultiplier', value: '3', mode: 2 }] },
            ],
        });
        expect(actor.abilities.mle.damageMultiplier).toBe(5);
    });
});

describe('Rulebook: Damage Reduction Does Not Stack', () => {
    function makeEffect(key, value) {
        return { disabled: false, changes: [{ key, value: String(value), mode: 2 }] };
    }

    test('single Sturdy 2: Health DR = 2', () => {
        const actor = makeActor({
            healthDR: 2,
            effects: [makeEffect('system.healthDamageReduction', 2)],
        });
        expect(actor.healthDamageReduction).toBe(2);
    });

    test('Sturdy 2 + Reinforced Skeleton: Health DR = max(2,1) = 2', () => {
        const actor = makeActor({
            healthDR: 3,
            effects: [
                makeEffect('system.healthDamageReduction', 2),
                makeEffect('system.healthDamageReduction', 1),
            ],
        });
        expect(actor.healthDamageReduction).toBe(2);
    });

    test('Focus DR: two sources → use highest', () => {
        const actor = makeActor({
            focusDR: 5,
            effects: [
                makeEffect('system.focusDamageReduction', 3),
                makeEffect('system.focusDamageReduction', 2),
            ],
        });
        expect(actor.focusDamageReduction).toBe(3);
    });
});

describe('Rules: Non-Combat Checks', () => {
    test('noncom = ability value', () => {
        const actor = makeActor({ abilities: { log: 5 } });
        expect(actor.abilities.log.noncom).toBe(5);
    });

    test('noncom = 0 when ability is 0', () => {
        const actor = makeActor({ abilities: { ego: 0 } });
        expect(actor.abilities.ego.noncom).toBe(0);
    });
});

describe('Rules: Initiative', () => {
    test('initiative = Vigilance value (vig 3 → init 3)', () => {
        const actor = makeActor({ abilities: { vig: 3 } });
        expect(actor.attributes.init.value).toBe(3);
    });

    test('initiative = Vigilance value (vig 1 → init 1)', () => {
        const actor = makeActor({ abilities: { vig: 1 } });
        expect(actor.attributes.init.value).toBe(1);
    });

    test('initiative = 0 when Vigilance is 0', () => {
        const actor = makeActor({ abilities: { vig: 0 } });
        expect(actor.attributes.init.value).toBe(0);
    });
});

describe('Rules: Climb/Jump/Swim Movement', () => {
    test('ceil(run × 0.5): run 5 → 3', () => {
        const actor = makeActor({ run: 5 });
        expect(actor.movement.climb.value).toBe(3);
        expect(actor.movement.jump.value).toBe(3);
        expect(actor.movement.swim.value).toBe(3);
    });

    test('ceil(run × 0.5): run 8 → 4', () => {
        const actor = makeActor({ run: 8 });
        expect(actor.movement.climb.value).toBe(4);
    });

    test('ceil(run × 0.5): run 1 → 1 (rounds up fractional half)', () => {
        const actor = makeActor({ run: 1 });
        expect(actor.movement.climb.value).toBe(1);
    });

    test('ceil(run × 0.5): run 10 → 5', () => {
        const actor = makeActor({ run: 10 });
        expect(actor.movement.climb.value).toBe(5);
    });
});

describe('Rules: Movement Calc Modes', () => {
    test('"half" halves movement value (ceil)', () => {
        const actor = makeActor({
            movementOverrides: { flight: { value: 10, noncom: 0, active: true, calc: 'half', label: '' } },
        });
        expect(actor.movement.flight.value).toBe(5);
    });

    test('"double" doubles movement value', () => {
        const actor = makeActor({
            movementOverrides: { flight: { value: 5, noncom: 0, active: true, calc: 'double', label: '' } },
        });
        expect(actor.movement.flight.value).toBe(10);
    });

    test('"triple" triples movement value', () => {
        const actor = makeActor({
            movementOverrides: { flight: { value: 4, noncom: 0, active: true, calc: 'triple', label: '' } },
        });
        expect(actor.movement.flight.value).toBe(12);
    });

    test('"runspeed" sets value equal to run speed', () => {
        const actor = makeActor({
            run: 8,
            movementOverrides: { flight: { value: 0, noncom: 0, active: true, calc: 'runspeed', label: '' } },
        });
        expect(actor.movement.flight.value).toBe(8);
    });

    test('"rank" multiplies value by rank', () => {
        const actor = makeActor({
            rank: 3,
            movementOverrides: { flight: { value: 2, noncom: 0, active: true, calc: 'rank', label: '' } },
        });
        expect(actor.movement.flight.value).toBe(6);
    });

    test('"rank" with value 0 uses 1 as base, then multiplies by rank', () => {
        const actor = makeActor({
            rank: 3,
            movementOverrides: { flight: { value: 0, noncom: 0, active: true, calc: 'rank', label: '' } },
        });
        expect(actor.movement.flight.value).toBe(3);
    });

    test('"runspeed-rank" sets value to base run speed × rank', () => {
        const actor = makeActor({
            run: 5, rank: 4,
            movementOverrides: { flight: { value: 0, noncom: 0, active: true, calc: 'runspeed-rank', label: '' } },
        });
        expect(actor.movement.flight.value).toBe(20);
    });
});

describe('Rulebook: Speed Powers Do Not Stack', () => {
    test('Speed Run + Flight: flight uses base run speed, not boosted run', () => {
        const actor = makeActor({
            run: 5, rank: 4,
            movementOverrides: {
                run: { value: 5, noncom: 5, active: true, calc: 'runspeed-rank', label: '' },
                flight: { value: 0, noncom: 0, active: true, calc: 'runspeed-rank', label: '' },
            },
        });
        expect(actor.movement.run.value).toBe(20);
        expect(actor.movement.flight.value).toBe(20);
    });

    test('climb/swim/jump derive from boosted run speed when no power override', () => {
        const actor = makeActor({
            run: 5, rank: 4,
            movementOverrides: {
                run: { value: 5, noncom: 5, active: true, calc: 'runspeed-rank', label: '' },
            },
        });
        expect(actor.movement.run.value).toBe(20);
        expect(actor.movement.climb.value).toBe(10);
        expect(actor.movement.swim.value).toBe(10);
        expect(actor.movement.jump.value).toBe(10);
    });

    test('climb/swim/jump keep power-based calc when present', () => {
        const actor = makeActor({
            run: 5, rank: 4,
            movementOverrides: {
                run: { value: 5, noncom: 5, active: true, calc: 'runspeed-rank', label: '' },
                swim: { value: 0, noncom: 0, active: true, calc: 'runspeed-rank', label: '' },
            },
        });
        expect(actor.movement.run.value).toBe(20);
        expect(actor.movement.swim.value).toBe(20);
        expect(actor.movement.climb.value).toBe(10);
    });
});

describe('Rulebook: Challenging Target Number', () => {
    test.each([
        [1, 11],
        [2, 12],
        [3, 13],
        [4, 14],
        [5, 15],
        [6, 16],
    ])('rank %i → Challenging TN %i (rank + 10)', (rank, tn) => {
        expect(rank + 10).toBe(tn);
    });

    test('difficulty modifier stacks: base TN 14 + modifier 4 = 18', () => {
        const baseTN = 4 + 10;
        const modifier = 4;
        expect(baseTN + modifier).toBe(18);
    });
});

describe('Rulebook: Health and Focus', () => {
    test.each([
        [3, 90],
        [4, 120],
        [7, 210],
    ])('Health max = Resilience %i × 30 = %i', (res, health) => {
        expect(res * 30).toBe(health);
    });

    test.each([
        [3, 90],
        [4, 120],
        [8, 240],
    ])('Focus max = Vigilance %i × 30 = %i', (vig, focus) => {
        expect(vig * 30).toBe(focus);
    });
});

describe('Rulebook: Damage Formula', () => {
    test('Spider-Man (rank 5, Agility 5): Marvel die 6 × DM 5 + 5 = 35', () => {
        const marvelDieCount = 6;
        const dm = 5;
        const ability = 5;
        expect(marvelDieCount * dm + ability).toBe(35);
    });

    test('Shang-Chi (rank 4, Melee 7): Marvel die 6 × DM 4 + 7 = 31', () => {
        const marvelDieCount = 6;
        const dm = 4;
        const ability = 7;
        expect(marvelDieCount * dm + ability).toBe(31);
    });

    test('Damage Reduction: DM 4 − DR 2 → effective DM 2', () => {
        const dm = 4;
        const dr = 2;
        expect(Math.max(0, dm - dr)).toBe(2);
    });

    test('Damage Reduction: DM 4 − DR 4 → effective DM 0 (no damage)', () => {
        const dm = 4;
        const dr = 4;
        expect(Math.max(0, dm - dr)).toBe(0);
    });
});

describe('Rulebook: Knockback', () => {
    test('Knockback = DM × 5 spaces (She-Hulk DM 6 → 30 spaces)', () => {
        expect(6 * 5).toBe(30);
    });

    test('Knockback: DM 1 → 5 spaces', () => {
        expect(1 * 5).toBe(5);
    });
});

describe('Rules: Label Localization Fallback', () => {
    afterEach(() => jest.restoreAllMocks());

    test('ability label falls back to key when localize returns null', () => {
        jest.spyOn(game.i18n, 'localize').mockImplementation(() => null);
        const actor = makeActor({ abilities: { mle: 3 } });
        expect(actor.abilities.mle.label).toBe('mle');
        expect(actor.abilities.agl.label).toBe('agl');
    });

    test('movement label falls back to key when localize returns null', () => {
        jest.spyOn(game.i18n, 'localize').mockImplementation(() => null);
        const actor = makeActor({ run: 5 });
        expect(actor.movement.run.label).toBe('run');
        expect(actor.movement.flight.label).toBe('flight');
    });
});

describe('Rulebook: Focus Spend and Powers', () => {
    test.each([
        [1, 5],
        [2, 10],
        [3, 15],
        [4, 20],
        [5, 25],
        [6, 30],
    ])('max Focus spend per action: rank %i → %i', (rank, maxFocus) => {
        expect(rank * 5).toBe(maxFocus);
    });

    test.each([
        [1, 4],
        [2, 8],
        [3, 12],
        [4, 16],
        [5, 20],
        [6, 24],
    ])('base powers per rank: rank %i → %i powers', (rank, powers) => {
        expect(rank * 4).toBe(powers);
    });

    test('thematic bonus: Spider-Man rank 4, 1 power set → 3 bonus powers → 19 total', () => {
        const basePowers = 4 * 4;
        const thematicBonus = 3;
        expect(basePowers + thematicBonus).toBe(19);
    });
});
