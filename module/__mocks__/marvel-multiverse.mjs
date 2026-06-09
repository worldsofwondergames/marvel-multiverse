/* eslint-env jest */
import { MARVEL_MULTIVERSE } from '../config.mjs';
import { MarvelMultiverseRoll } from '../dice/roll.mjs';

/**
 * Marvel Multiverse system-specific mock setup.
 * Extends the generic Foundry mocks (foundry.mjs) with system config.
 */
global.CONFIG.MARVEL_MULTIVERSE = MARVEL_MULTIVERSE;
global.CONFIG.Dice = { MarvelMultiverseRoll };
