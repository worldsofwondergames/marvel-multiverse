/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
    testRunner: 'jest',
    jest: {
        enableFindRelatedTests: false,
        projectType: 'custom',
        config: {
            setupFiles: [
                '<rootDir>/module/__mocks__/setup.mjs',
                '<rootDir>/module/__mocks__/foundry.mjs',
                '<rootDir>/module/__mocks__/marvel-multiverse.mjs',
            ],
            testMatch: [
                '**/__tests__/**/*.test.mjs',
                '**/__tests__/**/*.test.js',
            ],
            transform: {},
            testPathIgnorePatterns: ['/node_modules/', '/.history/'],
        },
    },
    mutate: [
        'module/data/actor-base.mjs',
        'module/data/npc.mjs',
        'module/dice/dietype/marvel-die.mjs',
        'module/dice/roll.mjs',
        'module/documents/actor.mjs',
        'module/documents/item.mjs',
    ],
    reporters: ['clear-text', 'progress', 'html'],
    coverageAnalysis: 'off',
    timeoutMS: 30000,
};

