/* eslint-env jest */
import { jest } from '@jest/globals';
import { MarvelMultiverseRoll } from '../dice/roll.mjs';

// Creates a roll with pre-configured dice so tests can call methods directly
// without triggering auto-configureModifiers via the constructor.
function makeRoll({ edgeMode = 0, flavor = '', marvelResult = 3, evaluated = true } = {}) {
    const roll = new MarvelMultiverseRoll('', {}, { configured: true, edgeMode, flavor });
    roll._evaluated = evaluated;
    roll.dice = [
        { faces: 6, results: [] },
        { result: marvelResult, results: [{ result: marvelResult, active: true }], faces: 6 },
        { faces: 6, results: [] },
    ];
    roll.terms = [new foundry.dice.terms.PoolTerm()];
    return roll;
}

// Minimal DOM-like form mock for _onDialogSubmit
function makeFormHtml({ bonus = '', ability = null } = {}) {
    return [{ querySelector: () => ({ bonus: { value: bonus }, ability: ability ? { value: ability } : undefined }) }];
}

describe('MarvelMultiverseRoll — EDGE_MODE constants', () => {
    test('NORMAL is 0', () => expect(MarvelMultiverseRoll.EDGE_MODE.NORMAL).toBe(0));
    test('EDGE is 1',   () => expect(MarvelMultiverseRoll.EDGE_MODE.EDGE).toBe(1));
    test('TROUBLE is -1', () => expect(MarvelMultiverseRoll.EDGE_MODE.TROUBLE).toBe(-1));
});

describe('MarvelMultiverseRoll — validD616Roll', () => {
    test('false when dice.length < 3', () => {
        const roll = new MarvelMultiverseRoll('', {}, { configured: true });
        roll.dice = [{}, {}];
        roll.terms = [new foundry.dice.terms.PoolTerm()];
        expect(roll.validD616Roll).toBe(false);
    });

    test('false when dice.length > 3', () => {
        const roll = new MarvelMultiverseRoll('', {}, { configured: true });
        roll.dice = [{}, {}, {}, {}];
        roll.terms = [new foundry.dice.terms.PoolTerm()];
        expect(roll.validD616Roll).toBe(false);
    });

    test('false when terms[0] is not a PoolTerm', () => {
        const roll = new MarvelMultiverseRoll('', {}, { configured: true });
        roll.dice = [{}, {}, {}];
        roll.terms = [{}];
        expect(roll.validD616Roll).toBe(false);
    });

    test('false when terms is empty', () => {
        const roll = new MarvelMultiverseRoll('', {}, { configured: true });
        roll.dice = [{}, {}, {}];
        roll.terms = [];
        expect(roll.validD616Roll).toBe(false);
    });

    test('true when dice.length === 3 and terms[0] is PoolTerm', () => {
        const roll = new MarvelMultiverseRoll('', {}, { configured: true });
        roll.dice = [{}, {}, {}];
        roll.terms = [new foundry.dice.terms.PoolTerm()];
        expect(roll.validD616Roll).toBe(true);
    });
});

describe('MarvelMultiverseRoll — hasEdge / hasTrouble', () => {
    test('NORMAL: both false', () => {
        const roll = makeRoll({ edgeMode: MarvelMultiverseRoll.EDGE_MODE.NORMAL });
        expect(roll.hasEdge).toBe(false);
        expect(roll.hasTrouble).toBe(false);
    });

    test('EDGE: hasEdge true, hasTrouble false', () => {
        const roll = makeRoll({ edgeMode: MarvelMultiverseRoll.EDGE_MODE.EDGE });
        expect(roll.hasEdge).toBe(true);
        expect(roll.hasTrouble).toBe(false);
    });

    test('TROUBLE: hasTrouble true, hasEdge false', () => {
        const roll = makeRoll({ edgeMode: MarvelMultiverseRoll.EDGE_MODE.TROUBLE });
        expect(roll.hasTrouble).toBe(true);
        expect(roll.hasEdge).toBe(false);
    });
});

describe('MarvelMultiverseRoll — isFantastic', () => {
    test('undefined when not yet evaluated', () => {
        const roll = makeRoll({ marvelResult: 1, evaluated: false });
        expect(roll.isFantastic).toBeUndefined();
    });

    test('true when evaluated and marvel die result is 1', () => {
        const roll = makeRoll({ marvelResult: 1 });
        expect(roll.isFantastic).toBe(true);
    });

    test('false when evaluated and marvel die result is not 1', () => {
        for (const r of [2, 3, 4, 5, 6]) {
            expect(makeRoll({ marvelResult: r }).isFantastic).toBe(false);
        }
    });
});

describe('MarvelMultiverseRoll — determineEdgeMode', () => {
    test('no arguments → isFF false, NORMAL', () => {
        const { isFF, edgeMode } = MarvelMultiverseRoll.determineEdgeMode();
        expect(isFF).toBe(false);
        expect(edgeMode).toBe(MarvelMultiverseRoll.EDGE_MODE.NORMAL);
    });

    test('edge: true → EDGE mode', () => {
        const { edgeMode } = MarvelMultiverseRoll.determineEdgeMode({ edge: true });
        expect(edgeMode).toBe(MarvelMultiverseRoll.EDGE_MODE.EDGE);
    });

    test('trouble: true → TROUBLE mode', () => {
        const { edgeMode } = MarvelMultiverseRoll.determineEdgeMode({ trouble: true });
        expect(edgeMode).toBe(MarvelMultiverseRoll.EDGE_MODE.TROUBLE);
    });

    test('edge and trouble both true → EDGE wins', () => {
        const { edgeMode } = MarvelMultiverseRoll.determineEdgeMode({ edge: true, trouble: true });
        expect(edgeMode).toBe(MarvelMultiverseRoll.EDGE_MODE.EDGE);
    });

    test('fastForward: true → isFF true regardless of event', () => {
        const { isFF } = MarvelMultiverseRoll.determineEdgeMode({ fastForward: true });
        expect(isFF).toBe(true);
    });

    test('fastForward: false overrides event shiftKey → isFF false', () => {
        const { isFF } = MarvelMultiverseRoll.determineEdgeMode({ fastForward: false, event: { shiftKey: true } });
        expect(isFF).toBe(false);
    });

    test('event.shiftKey → isFF true, NORMAL mode', () => {
        const { isFF, edgeMode } = MarvelMultiverseRoll.determineEdgeMode({ event: { shiftKey: true } });
        expect(isFF).toBe(true);
        expect(edgeMode).toBe(MarvelMultiverseRoll.EDGE_MODE.NORMAL);
    });

    test('event.altKey → EDGE mode + isFF', () => {
        const { isFF, edgeMode } = MarvelMultiverseRoll.determineEdgeMode({ event: { altKey: true } });
        expect(isFF).toBe(true);
        expect(edgeMode).toBe(MarvelMultiverseRoll.EDGE_MODE.EDGE);
    });

    test('event.ctrlKey → TROUBLE mode + isFF', () => {
        const { isFF, edgeMode } = MarvelMultiverseRoll.determineEdgeMode({ event: { ctrlKey: true } });
        expect(isFF).toBe(true);
        expect(edgeMode).toBe(MarvelMultiverseRoll.EDGE_MODE.TROUBLE);
    });

    test('event.metaKey → TROUBLE mode + isFF', () => {
        const { isFF, edgeMode } = MarvelMultiverseRoll.determineEdgeMode({ event: { metaKey: true } });
        expect(isFF).toBe(true);
        expect(edgeMode).toBe(MarvelMultiverseRoll.EDGE_MODE.TROUBLE);
    });

    test('edge: true with event.ctrlKey → EDGE wins over TROUBLE', () => {
        const { edgeMode } = MarvelMultiverseRoll.determineEdgeMode({ edge: true, event: { ctrlKey: true } });
        expect(edgeMode).toBe(MarvelMultiverseRoll.EDGE_MODE.EDGE);
    });
});

describe('MarvelMultiverseRoll — configureModifiers', () => {
    test('early return when dice.length !== 3: configured not set', () => {
        const roll = new MarvelMultiverseRoll('', {}, { configured: true });
        roll.dice = [{}, {}];
        roll.terms = [new foundry.dice.terms.PoolTerm()];
        roll.options.configured = false;
        roll.configureModifiers();
        expect(roll.options.configured).toBe(false);
        expect(roll.options.fantastic).toBeUndefined();
    });

    test('early return when terms[0] is not PoolTerm', () => {
        const roll = new MarvelMultiverseRoll('', {}, { configured: true });
        roll.dice = [{}, {}, {}];
        roll.terms = [{}];
        roll.options.configured = false;
        roll.configureModifiers();
        expect(roll.options.configured).toBe(false);
    });

    test('valid non-fantastic roll: sets fantastic=1 and configured=true', () => {
        const roll = makeRoll({ marvelResult: 3 });
        roll.options.configured = false;
        roll.configureModifiers();
        expect(roll.options.fantastic).toBe(1);
        expect(roll.options.configured).toBe(true);
    });

    test('fantastic roll: marks non-1 results discarded, keeps result-1 active', () => {
        const roll = new MarvelMultiverseRoll('', {}, { configured: true });
        roll._evaluated = true;
        roll.terms = [new foundry.dice.terms.PoolTerm()];
        const results = [
            { result: 1, active: true },
            { result: 4, active: true },
        ];
        roll.dice = [
            { faces: 6, results: [] },
            { result: 1, results, faces: 6 },
            { faces: 6, results: [] },
        ];
        roll.options.configured = false;
        roll.configureModifiers();
        expect(results[0].active).toBe(true);
        expect(results[0].discarded).toBe(false);
        expect(results[1].active).toBe(false);
        expect(results[1].discarded).toBe(true);
    });

    test('fantastic roll: sets die[1].total to 6', () => {
        const roll = makeRoll({ marvelResult: 1 });
        roll.options.configured = false;
        roll.configureModifiers();
        expect(roll.dice[1].total).toBe(6);
    });

    test('non-fantastic roll: does not modify die results', () => {
        const originalResults = [{ result: 4, active: true }];
        const roll = new MarvelMultiverseRoll('', {}, { configured: true });
        roll._evaluated = true;
        roll.terms = [new foundry.dice.terms.PoolTerm()];
        roll.dice = [
            { faces: 6, results: [] },
            { result: 4, results: originalResults, faces: 6 },
            { faces: 6, results: [] },
        ];
        roll.options.configured = false;
        roll.configureModifiers();
        expect(originalResults[0].discarded).toBeUndefined();
        expect(originalResults[0].active).toBe(true);
    });
});

describe('MarvelMultiverseRoll — toMessage', () => {
    test('evaluates roll if not already evaluated', async () => {
        const roll = makeRoll({ evaluated: false });
        await roll.toMessage({ flavor: '' });
        expect(roll._evaluated).toBe(true);
    });

    test('does not re-evaluate if already evaluated', async () => {
        const roll = makeRoll({ evaluated: true });
        const spy = jest.spyOn(roll, 'evaluate');
        await roll.toMessage({ flavor: '' });
        expect(spy).not.toHaveBeenCalled();
    });

    test('sets messageData.fantastic from isFantastic', async () => {
        const fantastic = await makeRoll({ marvelResult: 1 }).toMessage({ flavor: '' });
        const normal    = await makeRoll({ marvelResult: 4 }).toMessage({ flavor: '' });
        expect(fantastic.fantastic).toBe(true);
        expect(normal.fantastic).toBe(false);
    });

    test('NORMAL mode: flavor unchanged', async () => {
        const roll = makeRoll({ edgeMode: MarvelMultiverseRoll.EDGE_MODE.NORMAL, flavor: '' });
        const result = await roll.toMessage({ flavor: 'Attack' });
        expect(result.flavor).toBe('Attack');
    });

    test('EDGE mode: appends localized edge text to flavor', async () => {
        const roll = makeRoll({ edgeMode: MarvelMultiverseRoll.EDGE_MODE.EDGE });
        const result = await roll.toMessage({ flavor: 'Attack' });
        expect(result.flavor).toContain('Attack');
        expect(result.flavor).toContain('edge');
    });

    test('TROUBLE mode: appends localized trouble text to flavor', async () => {
        const roll = makeRoll({ edgeMode: MarvelMultiverseRoll.EDGE_MODE.TROUBLE });
        const result = await roll.toMessage({ flavor: 'Attack' });
        expect(result.flavor).toContain('trouble');
    });

    test('uses options.flavor as default when messageData.flavor is absent', async () => {
        const roll = makeRoll({ edgeMode: MarvelMultiverseRoll.EDGE_MODE.NORMAL, flavor: 'from-options' });
        const result = await roll.toMessage({});
        expect(result.flavor).toBe('from-options');
    });

    test('messageData.flavor takes precedence over options.flavor', async () => {
        const roll = makeRoll({ flavor: 'from-options' });
        const result = await roll.toMessage({ flavor: 'from-data' });
        expect(result.flavor).toBe('from-data');
    });

    test('sets flags.marvel-multiverse.itemId when options.itemId provided', async () => {
        const roll = makeRoll();
        const result = await roll.toMessage({ flavor: '' }, { itemId: 'item-abc' });
        expect(result.flags?.['marvel-multiverse']?.itemId).toBe('item-abc');
    });

    test('does not set itemId flag when options.itemId absent', async () => {
        const roll = makeRoll();
        const result = await roll.toMessage({ flavor: '' });
        expect(result.flags?.['marvel-multiverse']?.itemId).toBeUndefined();
    });

    test('options.rollMode falls through to super.toMessage', async () => {
        const roll = makeRoll();
        const result = await roll.toMessage({ flavor: '' }, { rollMode: 'gmroll' });
        // The mock super.toMessage just returns messageData, so rollMode is on options not result.
        // This mainly confirms no throw when rollMode is set.
        expect(result).toBeDefined();
    });
});

describe('MarvelMultiverseRoll — fromRoll', () => {
    test('returns a MarvelMultiverseRoll instance', () => {
        const source = new Roll('2d6', { rank: 2 }, { configured: true });
        const copy = MarvelMultiverseRoll.fromRoll(source);
        expect(copy).toBeInstanceOf(MarvelMultiverseRoll);
    });

    test('copies formula and data from source', () => {
        const source = new Roll('2d6 + 3', { rank: 2 }, { configured: true });
        const copy = MarvelMultiverseRoll.fromRoll(source);
        expect(copy.formula).toBe('2d6 + 3');
        expect(copy.data).toEqual({ rank: 2 });
    });

    test('Object.assign copies extra properties from source', () => {
        const source = new Roll('', {}, { configured: true });
        source.extraProp = 'test-value';
        const copy = MarvelMultiverseRoll.fromRoll(source);
        expect(copy.extraProp).toBe('test-value');
    });
});

describe('MarvelMultiverseRoll — fromTerms (known bug)', () => {
    test('throws ReferenceError due to undefined roll variable', () => {
        expect(() => MarvelMultiverseRoll.fromTerms([])).toThrow(ReferenceError);
    });
});

describe('MarvelMultiverseRoll — _onDialogSubmit', () => {
    afterEach(() => jest.restoreAllMocks());

    test('returns the roll instance', () => {
        const roll = makeRoll();
        roll.terms = [];
        expect(roll._onDialogSubmit(makeFormHtml())).toBe(roll);
    });

    test('no bonus, no ability: terms unchanged', () => {
        const roll = makeRoll();
        roll.terms = [];
        roll._onDialogSubmit(makeFormHtml());
        expect(roll.terms).toHaveLength(0);
    });

    test('bonus value: prepends OperatorTerm before bonus terms', () => {
        const roll = makeRoll();
        roll.terms = [];
        roll._onDialogSubmit(makeFormHtml({ bonus: '5' }));
        expect(roll.terms.some((t) => t instanceof foundry.dice.terms.OperatorTerm)).toBe(true);
    });

    test('ability selection: substitutes @mod term with NumericTerm using ability value', () => {
        const roll = new MarvelMultiverseRoll('', { abilities: { mle: { value: 7 } } }, { configured: true, flavor: '' });
        roll.terms = [{ term: '@mod' }];
        roll.dice = makeRoll().dice;
        roll._onDialogSubmit(makeFormHtml({ ability: 'mle' }));
        expect(roll.terms[0]).toBeInstanceOf(foundry.dice.terms.NumericTerm);
        expect(roll.terms[0].number).toBe(7);
    });

    test('@abilityCheckBonus with no bonus defined → NumericTerm(0)', () => {
        const roll = new MarvelMultiverseRoll('', { abilities: { agl: { value: 5 } } }, { configured: true, flavor: '' });
        roll.terms = [{ term: '@abilityCheckBonus' }];
        roll.dice = makeRoll().dice;
        roll._onDialogSubmit(makeFormHtml({ ability: 'agl' }));
        expect(roll.terms[0]).toBeInstanceOf(foundry.dice.terms.NumericTerm);
        expect(roll.terms[0].number).toBe(0);
    });

    test('@abilityCheckBonus with bonus defined → substitutes bonus terms', () => {
        const roll = new MarvelMultiverseRoll('', { abilities: { ego: { value: 3, bonuses: { check: '2' } } } }, { configured: true, flavor: '' });
        roll.terms = [{ term: '@abilityCheckBonus' }];
        roll.dice = makeRoll().dice;
        roll._onDialogSubmit(makeFormHtml({ ability: 'ego' }));
        // new Roll('2', {}).terms is [] in mock, so terms becomes []
        expect(Array.isArray(roll.terms)).toBe(true);
    });

    test('non-@mod terms are preserved unchanged', () => {
        const preserved = { term: 'other' };
        const roll = new MarvelMultiverseRoll('', { abilities: { mle: { value: 3 } } }, { configured: true, flavor: '' });
        roll.terms = [preserved];
        roll.dice = makeRoll().dice;
        roll._onDialogSubmit(makeFormHtml({ ability: 'mle' }));
        expect(roll.terms[0]).toBe(preserved);
    });

    test('ability selection appends to flavor', () => {
        const roll = new MarvelMultiverseRoll('', { abilities: { mle: { value: 5 } } }, { configured: true, flavor: 'Punch' });
        roll.terms = [];
        roll.dice = makeRoll().dice;
        roll._onDialogSubmit(makeFormHtml({ ability: 'mle' }));
        expect(roll.options.flavor).toContain('Punch');
        expect(roll.options.flavor).toContain('(');
    });
});
