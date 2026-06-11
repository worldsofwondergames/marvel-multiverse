/* eslint-env jest */
// Tests for the modifier stacking rules from the core rulebook
// (marvel-multiverse-data/.claude/mm-rpg-combat.md).
//
// Rules under test:
//  - "Stacking Damage Multipliers": bonuses to damage multipliers DO NOT stack;
//    the largest takes effect.
//  - "Damage Reduction": damage reduction DOES NOT stack; the largest takes
//    effect. It lowers the damage multiplier, and if the multiplier is reduced
//    to less than 1, the attack does no damage at all — not even the ability
//    score bonus.
//  - "Fantastic Damage": a Fantastic success doubles the total damage.
import { ChatMessageMarvel } from '../documents/chat-message.mjs';

const calc = (opts) => ChatMessageMarvel.calculateDamage(opts);

describe('Damage Multiplier bonuses DO NOT stack (largest applies)', () => {
    // Rulebook example: She-Hulk has a club granting +1 to her Melee damage
    // multiplier and Mighty 4 granting +4. Only the larger (+4) applies.
    test('She-Hulk: club +1 and Mighty +4 → only +4 applies', () => {
        const withBonuses = calc({
            marvelDieTotal: 6,
            baseMultiplier: 4,
            multiplierBonuses: [1, 4],
            abilityValue: 0,
        });
        const withLargestOnly = calc({
            marvelDieTotal: 6,
            baseMultiplier: 4,
            multiplierBonuses: [4],
            abilityValue: 0,
        });
        expect(withBonuses).toBe(withLargestOnly);
        // base 4 + bonus 4 = 8; 6 × 8 + 0 = 48
        expect(withBonuses).toBe(48);
    });

    test('multiple bonuses never add together', () => {
        const result = calc({
            marvelDieTotal: 6,
            baseMultiplier: 2,
            multiplierBonuses: [1, 2, 3],
            abilityValue: 1,
        });
        // largest bonus 3, NOT 1+2+3=6: effective multiplier 2 + 3 = 5
        // 6 × 5 + 1 = 31  (if it stacked it would be 6 × 8 + 1 = 49)
        expect(result).toBe(31);
    });

    test('no bonuses → base multiplier only', () => {
        // Spider-Man (rank 5, Agility 5): 6 × 5 + 5 = 35
        expect(
            calc({ marvelDieTotal: 6, baseMultiplier: 5, abilityValue: 5 })
        ).toBe(35);
    });
});

describe('Damage Reduction DOES NOT stack (largest applies)', () => {
    // Rulebook example: Spider-Man's Melee damage is (dMarvel×4)+3.
    // Iron Man's Sturdy 2 reduces the multiplier by 2 → (dMarvel×2)+3.
    test('Spider-Man vs Iron Man Sturdy 2: multiplier 4 − 2 = 2', () => {
        const dmg = calc({
            marvelDieTotal: 6,
            baseMultiplier: 4,
            damageReductions: [2],
            abilityValue: 3,
        });
        // 6 × 2 + 3 = 15
        expect(dmg).toBe(15);
    });

    test('multiple reductions never add together (largest applies)', () => {
        const result = calc({
            marvelDieTotal: 6,
            baseMultiplier: 5,
            damageReductions: [1, 2],
            abilityValue: 3,
        });
        // largest reduction 2, NOT 1+2=3: effective multiplier 5 − 2 = 3
        // 6 × 3 + 3 = 21
        expect(result).toBe(21);
    });
});

describe('Damage Reduction below 1 → no damage at all', () => {
    // Rulebook example: Iron Man's Hulkbuster Sturdy 4 reduces Spider-Man's
    // ×4 multiplier to 0, so the punch does no damage at all.
    test('Sturdy 4 reduces multiplier 4 → 0: no damage, not even ability bonus', () => {
        const dmg = calc({
            marvelDieTotal: 6,
            baseMultiplier: 4,
            damageReductions: [4],
            abilityValue: 3,
        });
        expect(dmg).toBe(0);
    });

    test('reduction exceeding multiplier (negative) → still 0, never negative', () => {
        const dmg = calc({
            marvelDieTotal: 6,
            baseMultiplier: 2,
            damageReductions: [4],
            abilityValue: 3,
        });
        // multiplier 2 − 4 = −2, which is less than 1 → 0 damage
        expect(dmg).toBe(0);
    });

    test('multiplier reduced to exactly 1 → damage still gets through', () => {
        const dmg = calc({
            marvelDieTotal: 6,
            baseMultiplier: 3,
            damageReductions: [2],
            abilityValue: 3,
        });
        // multiplier 3 − 2 = 1: 6 × 1 + 3 = 9
        expect(dmg).toBe(9);
    });

    test('negative reduction case is never doubled into negative by fantastic', () => {
        const dmg = calc({
            marvelDieTotal: 6,
            baseMultiplier: 1,
            damageReductions: [3],
            abilityValue: 5,
            fantastic: true,
        });
        // multiplier 1 − 3 = −2 → 0; 0 × 2 = 0
        expect(dmg).toBe(0);
    });
});

describe('Fantastic Damage doubles the total', () => {
    test('fantastic success doubles a normal hit', () => {
        const normal = calc({ marvelDieTotal: 6, baseMultiplier: 4, abilityValue: 3 });
        const fantastic = calc({
            marvelDieTotal: 6,
            baseMultiplier: 4,
            abilityValue: 3,
            fantastic: true,
        });
        expect(normal).toBe(27); // 6 × 4 + 3
        expect(fantastic).toBe(54); // (6 × 4 + 3) × 2
    });

    test('Spider-Man Fantastic vs Sturdy 2: (dMarvel×4)+6 doubled', () => {
        // Rulebook: a Fantastic success makes his damage (dMarvel×4)+6.
        // With Sturdy 2 the multiplier is 4 − 2 = 2: (6 × 2 + 3) × 2 = 30
        const dmg = calc({
            marvelDieTotal: 6,
            baseMultiplier: 4,
            damageReductions: [2],
            abilityValue: 3,
            fantastic: true,
        });
        expect(dmg).toBe(30);
    });
});
