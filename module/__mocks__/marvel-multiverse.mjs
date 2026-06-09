/* eslint-env jest */
import { MARVEL_MULTIVERSE } from '../config.mjs';

/**
 * Marvel Multiverse system-specific mock setup.
 * Extends the generic Foundry mocks (foundry.mjs) with system config.
 */
global.CONFIG.MARVEL_MULTIVERSE = MARVEL_MULTIVERSE;
