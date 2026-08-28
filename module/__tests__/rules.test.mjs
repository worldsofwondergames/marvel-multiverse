/* eslint-env jest */
import { jest } from '@jest/globals';
import MarvelMultiverseActorBase from '../data/actor-base.mjs';

function makeActor({ rank = 1, abilities = {}, run = 5, movementOverrides = {}, effects = null, dmgBonuses = {}, healthDR = 0, focusDR = 0, healthBonus = 0, focusBonus = 0, items = [] } = {}) {
    const ability = (value = 0) => ({ value, defense: 0, noncom: 0, damageMultiplier: 0, edge: false, label: '' });
    const movement = (value = 0, calc = '', noncomMultiplier = 1) => ({ value, noncom: value, active: true, calc, noncomMultiplier, label: '' });
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
        health: { value: 0, max: 0, bonus: healthBonus },
        focus: { value: 0, max: 0, bonus: focusBonus },
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
    if (effects || items.length > 0) {
        instance.parent = { items, effects: effects ?? [], allApplicableEffects: function* () { if (effects) yield* effects; } };
    }
    instance.prepareDerivedData();
    return instance;
}

describe('Rules: Ability Defense', () => {
    test('defense = ability value + 10', () => {
        const actor = makeActor({ abilities: { mle: 2 } });
        expect(actor.abilities.mle.defense).toBe(12);
    });

    test('Nightjar agility 7 → defense 17', () => {
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
            movementOverrides: { flight: { value: 10, noncom: 0, active: true, noncomMultiplier: 1, calc: 'half', label: '' } },
        });
        expect(actor.movement.flight.value).toBe(5);
    });

    test('"double" doubles movement value', () => {
        const actor = makeActor({
            movementOverrides: { flight: { value: 5, noncom: 0, active: true, noncomMultiplier: 1, calc: 'double', label: '' } },
        });
        expect(actor.movement.flight.value).toBe(10);
    });

    test('"triple" triples movement value', () => {
        const actor = makeActor({
            movementOverrides: { flight: { value: 4, noncom: 0, active: true, noncomMultiplier: 1, calc: 'triple', label: '' } },
        });
        expect(actor.movement.flight.value).toBe(12);
    });

    test('"runspeed" sets value equal to run speed', () => {
        const actor = makeActor({
            run: 8,
            movementOverrides: { flight: { value: 0, noncom: 0, active: true, noncomMultiplier: 1, calc: 'runspeed', label: '' } },
        });
        expect(actor.movement.flight.value).toBe(8);
    });

    test('"rank" multiplies value by rank', () => {
        const actor = makeActor({
            rank: 3,
            movementOverrides: { flight: { value: 2, noncom: 0, active: true, noncomMultiplier: 1, calc: 'rank', label: '' } },
        });
        expect(actor.movement.flight.value).toBe(6);
    });

    test('"rank" with value 0 uses 1 as base, then multiplies by rank', () => {
        const actor = makeActor({
            rank: 3,
            movementOverrides: { flight: { value: 0, noncom: 0, active: true, noncomMultiplier: 1, calc: 'rank', label: '' } },
        });
        expect(actor.movement.flight.value).toBe(3);
    });

    test('"runspeed-rank" sets value to base run speed × rank', () => {
        const actor = makeActor({
            run: 5, rank: 4,
            movementOverrides: { flight: { value: 0, noncom: 0, active: true, noncomMultiplier: 1, calc: 'runspeed-rank', label: '' } },
        });
        expect(actor.movement.flight.value).toBe(20);
    });
});

describe('Rules: Movement Auto-Activation', () => {
    test('movement type with calc mode is automatically activated', () => {
        const actor = makeActor({
            movementOverrides: {
                flight: { value: 0, noncom: 0, active: false, noncomMultiplier: 1, calc: 'runspeed', label: '' },
            },
        });
        expect(actor.movement.flight.active).toBe(true);
    });

    test('movement type without calc mode stays inactive', () => {
        const actor = makeActor({
            movementOverrides: {
                flight: { value: 0, noncom: 0, active: false, noncomMultiplier: 1, calc: '', label: '' },
            },
        });
        expect(actor.movement.flight.active).toBe(false);
    });
});

describe('Rules: Non-Combat Movement Speed', () => {
    test('noncom defaults to combat value when noncomMultiplier is 1', () => {
        const actor = makeActor({ run: 5 });
        expect(actor.movement.run.noncom).toBe(5);
    });

    test('noncom = value × noncomMultiplier (3× for Speed Run)', () => {
        const actor = makeActor({
            run: 5, rank: 4,
            movementOverrides: {
                run: { value: 5, noncom: 0, active: true, noncomMultiplier: 3, calc: 'runspeed-rank', label: '' },
            },
        });
        expect(actor.movement.run.value).toBe(20);
        expect(actor.movement.run.noncom).toBe(60);
    });

    test('noncom = value × noncomMultiplier (3× for Flight)', () => {
        const actor = makeActor({
            run: 5, rank: 4,
            movementOverrides: {
                flight: { value: 0, noncom: 0, active: true, noncomMultiplier: 3, calc: 'runspeed-rank', label: '' },
            },
        });
        expect(actor.movement.flight.value).toBe(20);
        expect(actor.movement.flight.noncom).toBe(60);
    });

    test('noncom for climb/jump/swim defaults to combat value (half run speed)', () => {
        const actor = makeActor({ run: 5 });
        expect(actor.movement.climb.value).toBe(3);
        expect(actor.movement.climb.noncom).toBe(3);
    });

    test('noncom with multiplier 2 doubles non-combat speed', () => {
        const actor = makeActor({
            movementOverrides: {
                flight: { value: 10, noncom: 0, active: true, noncomMultiplier: 2, calc: '', label: '' },
            },
        });
        expect(actor.movement.flight.value).toBe(10);
        expect(actor.movement.flight.noncom).toBe(20);
    });

    test('noncom applies after calc mode (half + 3× multiplier)', () => {
        const actor = makeActor({
            movementOverrides: {
                flight: { value: 10, noncom: 0, active: true, noncomMultiplier: 3, calc: 'half', label: '' },
            },
        });
        expect(actor.movement.flight.value).toBe(5);
        expect(actor.movement.flight.noncom).toBe(15);
    });
});

describe('Rulebook: Speed Powers Do Not Stack', () => {
    test('Speed Run + Flight: flight uses base run speed, not boosted run', () => {
        const actor = makeActor({
            run: 5, rank: 4,
            movementOverrides: {
                run: { value: 5, noncom: 5, active: true, noncomMultiplier: 1, calc: 'runspeed-rank', label: '' },
                flight: { value: 0, noncom: 0, active: true, noncomMultiplier: 1, calc: 'runspeed-rank', label: '' },
            },
        });
        expect(actor.movement.run.value).toBe(20);
        expect(actor.movement.flight.value).toBe(20);
    });

    test('climb/swim/jump derive from boosted run speed when no power override', () => {
        const actor = makeActor({
            run: 5, rank: 4,
            movementOverrides: {
                run: { value: 5, noncom: 5, active: true, noncomMultiplier: 1, calc: 'runspeed-rank', label: '' },
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
                run: { value: 5, noncom: 5, active: true, noncomMultiplier: 1, calc: 'runspeed-rank', label: '' },
                swim: { value: 0, noncom: 0, active: true, noncomMultiplier: 1, calc: 'runspeed-rank', label: '' },
            },
        });
        expect(actor.movement.run.value).toBe(20);
        expect(actor.movement.swim.value).toBe(20);
        expect(actor.movement.climb.value).toBe(10);
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

describe('Config: Power Sets', () => {
    test('iconicItems power set is registered', () => {
        expect(CONFIG.MARVEL_MULTIVERSE.powersets.iconicItems).toBeDefined();
        expect(CONFIG.MARVEL_MULTIVERSE.powersets.iconicItems.label).toBe("Iconic Items");
    });

    test('reverseSetList maps "Iconic Items" back to "iconicItems"', () => {
        expect(CONFIG.MARVEL_MULTIVERSE.reverseSetList["Iconic Items"]).toBe("iconicItems");
    });
});

describe('Config: Iconic Item Config', () => {
    test('restrictionKinds has all five kinds', () => {
        const kinds = Object.keys(CONFIG.MARVEL_MULTIVERSE.restrictionKinds);
        expect(kinds).toEqual(["access", "challenging", "obvious", "unattached", "use"]);
    });

    test('ownershipModes has owned and borrowed', () => {
        const modes = Object.keys(CONFIG.MARVEL_MULTIVERSE.ownershipModes);
        expect(modes).toEqual(["owned", "borrowed"]);
    });

    test('specialEffectTypes has blunt, sharp, and elemental', () => {
        const types = Object.keys(CONFIG.MARVEL_MULTIVERSE.specialEffectTypes);
        expect(types).toEqual(["blunt", "sharp", "elemental"]);
    });
});

describe('Rulebook: Run Speed Includes Agility Bonus (KNOWN GAP)', () => {
    // Rules: "A character's base Run Speed is 5 spaces per round.
    //         To that, add +1 for every 5 points they have in Agility."
    test('agility < 5: run speed stays at base 5', () => {
        const actor = makeActor({ abilities: { agl: 3 } });
        // No agility bonus applies — base 5 is correct
        expect(actor.movement.run.value).toBe(5);
    });

    test.failing('agility 5: run speed should be 6 (5 base + 1 bonus)', () => {
        const actor = makeActor({ abilities: { agl: 5 } });
        // MISSING: prepareDerivedData does not add floor(agl/5) to run speed
        expect(actor.movement.run.value).toBe(6);
    });

    test.failing('agility 7 (Nightjar): run speed should be 6', () => {
        const actor = makeActor({ abilities: { agl: 7 } });
        expect(actor.movement.run.value).toBe(6);
    });
});

describe('Rulebook: Health Max Derived Calculation', () => {
    test('health max = resilience × 30 (res 3 → 90)', () => {
        const actor = makeActor({ abilities: { res: 3 } });
        expect(actor.health.max).toBe(90);
    });

    test('health max = resilience × 30 (res 7 → 210)', () => {
        const actor = makeActor({ abilities: { res: 7 } });
        expect(actor.health.max).toBe(210);
    });

    test('health max minimum is 10 when resilience is 0', () => {
        const actor = makeActor({ abilities: { res: 0 } });
        expect(actor.health.max).toBe(10);
    });

    test('health bonus adds to health max', () => {
        const actor = makeActor({ abilities: { res: 2 }, healthBonus: 15 });
        expect(actor.health.max).toBe(75);
    });

    test('health max minimum 10 still applies with bonus', () => {
        const actor = makeActor({ abilities: { res: 0 }, healthBonus: 0 });
        expect(actor.health.max).toBe(10);
    });
});

describe('Rulebook: Focus Max Derived Calculation', () => {
    test('focus max = vigilance × 30 (vig 4 → 120)', () => {
        const actor = makeActor({ abilities: { vig: 4 } });
        expect(actor.focus.max).toBe(120);
    });

    test('focus max = vigilance × 30 (vig 8 → 240)', () => {
        const actor = makeActor({ abilities: { vig: 8 } });
        expect(actor.focus.max).toBe(240);
    });

    test('focus max minimum is 10 when vigilance is 0', () => {
        const actor = makeActor({ abilities: { vig: 0 } });
        expect(actor.focus.max).toBe(10);
    });

    test('focus bonus adds to focus max', () => {
        const actor = makeActor({ abilities: { vig: 3 }, focusBonus: 10 });
        expect(actor.focus.max).toBe(100);
    });

    test('focus max minimum 10 still applies with bonus', () => {
        const actor = makeActor({ abilities: { vig: 0 }, focusBonus: 0 });
        expect(actor.focus.max).toBe(10);
    });

    test('a bonus that clears the floor is not raised to it', () => {
        const actor = makeActor({ abilities: { vig: 0 }, focusBonus: 25 });
        expect(actor.focus.max).toBe(25);
    });
});

describe('Rulebook: Condition Damage Reduction', () => {
    test('condition DR = health DR × 5 (DR 3 → 15)', () => {
        const actor = makeActor({ healthDR: 3 });
        expect(actor.conditionDamageReduction).toBe(15);
    });

    test('condition DR = health DR × 5 (DR 2 → 10)', () => {
        const actor = makeActor({ healthDR: 2 });
        expect(actor.conditionDamageReduction).toBe(10);
    });

    test('condition DR is 0 when no health DR', () => {
        const actor = makeActor();
        expect(actor.conditionDamageReduction).toBe(0);
    });

    test('condition DR uses non-stacking health DR from effects', () => {
        function makeEffect(key, value, mode = 2) {
            return { disabled: false, changes: [{ key, value: String(value), mode }] };
        }
        const actor = makeActor({
            effects: [
                makeEffect('system.healthDamageReduction', 4),
                makeEffect('system.healthDamageReduction', 2),
            ],
        });
        expect(actor.healthDamageReduction).toBe(4);
        expect(actor.conditionDamageReduction).toBe(20);
    });
});

describe('Rulebook: Brawling Defense Promotion', () => {
    test('without Brawling, agility defense is independent of melee', () => {
        const actor = makeActor({ abilities: { mle: 6, agl: 2 } });
        expect(actor.abilities.mle.defense).toBe(16);
        expect(actor.abilities.agl.defense).toBe(12);
    });

    test('with Brawling, agility defense equals melee defense when melee is higher', () => {
        const actor = makeActor({
            abilities: { mle: 6, agl: 2 },
            items: [{ type: 'power', name: 'Brawling' }],
        });
        expect(actor.abilities.mle.defense).toBe(16);
        expect(actor.abilities.agl.defense).toBe(16);
    });

    test('with Brawling, agility defense unchanged when already higher than melee', () => {
        const actor = makeActor({
            abilities: { mle: 2, agl: 6 },
            items: [{ type: 'power', name: 'Brawling' }],
        });
        expect(actor.abilities.mle.defense).toBe(12);
        expect(actor.abilities.agl.defense).toBe(16);
    });

    test('with Brawling, equal defenses remain unchanged', () => {
        const actor = makeActor({
            abilities: { mle: 4, agl: 4 },
            items: [{ type: 'power', name: 'Brawling' }],
        });
        expect(actor.abilities.mle.defense).toBe(14);
        expect(actor.abilities.agl.defense).toBe(14);
    });
});
