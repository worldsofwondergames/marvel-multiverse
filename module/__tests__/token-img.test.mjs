/* eslint-env jest */

describe('_getTokenImg — wildcard token fallback', () => {
    function _getTokenImg(actor) {
        const activeToken = actor?.getActiveTokens?.()?.[0];
        if (activeToken?.document?.texture?.src) return activeToken.document.texture.src;
        const protoSrc = actor?.prototypeToken?.texture?.src;
        if (protoSrc && !protoSrc.includes("*")) return protoSrc;
        return actor?.img || "";
    }

    test('returns active token image when available', () => {
        const actor = {
            getActiveTokens: () => [{ document: { texture: { src: 'tokens/angel-scene.png' } } }],
            prototypeToken: { texture: { src: 'tokens/angel-*.png' } },
            img: 'actors/angel.png',
        };
        expect(_getTokenImg(actor)).toBe('tokens/angel-scene.png');
    });

    test('returns prototype token src when no active token and no wildcard', () => {
        const actor = {
            getActiveTokens: () => [],
            prototypeToken: { texture: { src: 'tokens/cyclops.png' } },
            img: 'actors/cyclops.png',
        };
        expect(_getTokenImg(actor)).toBe('tokens/cyclops.png');
    });

    test('skips wildcard prototype token and returns actor img', () => {
        const actor = {
            getActiveTokens: () => [],
            prototypeToken: { texture: { src: 'tokens/angel-*.png' } },
            img: 'actors/angel.png',
        };
        expect(_getTokenImg(actor)).toBe('actors/angel.png');
    });

    test('skips wildcard with path glob and returns actor img', () => {
        const actor = {
            getActiveTokens: () => [],
            prototypeToken: { texture: { src: 'tokens/variants/*.webp' } },
            img: 'actors/beast.png',
        };
        expect(_getTokenImg(actor)).toBe('actors/beast.png');
    });

    test('returns empty string when actor has no images at all', () => {
        const actor = {
            getActiveTokens: () => [],
            prototypeToken: { texture: { src: null } },
            img: null,
        };
        expect(_getTokenImg(actor)).toBe('');
    });

    test('returns empty string for null actor', () => {
        expect(_getTokenImg(null)).toBe('');
    });

    test('returns empty string for undefined actor', () => {
        expect(_getTokenImg(undefined)).toBe('');
    });

    test('handles actor without getActiveTokens method', () => {
        const actor = {
            prototypeToken: { texture: { src: 'tokens/storm.png' } },
            img: 'actors/storm.png',
        };
        expect(_getTokenImg(actor)).toBe('tokens/storm.png');
    });

    test('falls back to actor img when active token has no texture', () => {
        const actor = {
            getActiveTokens: () => [{ document: { texture: { src: null } } }],
            prototypeToken: { texture: { src: 'tokens/wildcard-*.png' } },
            img: 'actors/wolverine.png',
        };
        expect(_getTokenImg(actor)).toBe('actors/wolverine.png');
    });
});
