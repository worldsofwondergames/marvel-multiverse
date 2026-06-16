/* eslint-env jest */
import { MARVEL_MULTIVERSE } from '../config.mjs';

describe('Mutant Reputation Config', () => {
    test('mutantReputationLevels has all five levels', () => {
        expect(Object.keys(MARVEL_MULTIVERSE.mutantReputationLevels)).toEqual([
            'beloved', 'liked', 'neutral', 'feared', 'hated',
        ]);
    });

    test('each level has a label and effect', () => {
        for (const [key, rep] of Object.entries(MARVEL_MULTIVERSE.mutantReputationLevels)) {
            expect(rep).toHaveProperty('label');
            expect(rep).toHaveProperty('effect');
            expect(typeof rep.label).toBe('string');
            expect(typeof rep.effect).toBe('string');
        }
    });

    test('Beloved grants Double Edge', () => {
        expect(MARVEL_MULTIVERSE.mutantReputationLevels.beloved.effect).toBe('Double Edge');
    });

    test('Liked grants Edge', () => {
        expect(MARVEL_MULTIVERSE.mutantReputationLevels.liked.effect).toBe('Edge');
    });

    test('Neutral has no effect', () => {
        expect(MARVEL_MULTIVERSE.mutantReputationLevels.neutral.effect).toBe('No effect');
    });

    test('Feared grants Trouble', () => {
        expect(MARVEL_MULTIVERSE.mutantReputationLevels.feared.effect).toBe('Trouble');
    });

    test('Hated grants Double Trouble', () => {
        expect(MARVEL_MULTIVERSE.mutantReputationLevels.hated.effect).toBe('Double Trouble');
    });
});

describe('Mutant Reputation — roll notice logic', () => {
    function getReputationNotice(abilityKey, actorReputation, worldReputation, enabled) {
        if (abilityKey !== 'ego' || !enabled) return null;
        const repKey = actorReputation !== 'world' ? actorReputation : worldReputation;
        const repConfig = MARVEL_MULTIVERSE.mutantReputationLevels[repKey];
        if (!repConfig || repKey === 'neutral') return null;
        return `Mutant Reputation (${repConfig.label}): ${repConfig.effect}`;
    }

    test('Ego roll with Feared world reputation shows Trouble notice', () => {
        const notice = getReputationNotice('ego', 'world', 'feared', true);
        expect(notice).toBe('Mutant Reputation (Feared): Trouble');
    });

    test('Ego roll with Beloved world reputation shows Double Edge notice', () => {
        const notice = getReputationNotice('ego', 'world', 'beloved', true);
        expect(notice).toBe('Mutant Reputation (Beloved): Double Edge');
    });

    test('non-Ego roll returns null even when reputation is active', () => {
        const notice = getReputationNotice('mle', 'world', 'feared', true);
        expect(notice).toBeNull();
    });

    test('Ego roll with Neutral reputation returns null', () => {
        const notice = getReputationNotice('ego', 'world', 'neutral', true);
        expect(notice).toBeNull();
    });

    test('Ego roll with system disabled returns null', () => {
        const notice = getReputationNotice('ego', 'world', 'feared', false);
        expect(notice).toBeNull();
    });

    test('per-actor override takes precedence over world setting', () => {
        const notice = getReputationNotice('ego', 'liked', 'hated', true);
        expect(notice).toBe('Mutant Reputation (Liked): Edge');
    });

    test('per-actor set to "world" defers to world setting', () => {
        const notice = getReputationNotice('ego', 'world', 'hated', true);
        expect(notice).toBe('Mutant Reputation (Hated): Double Trouble');
    });

    test('per-actor override of neutral suppresses notice', () => {
        const notice = getReputationNotice('ego', 'neutral', 'feared', true);
        expect(notice).toBeNull();
    });
});
