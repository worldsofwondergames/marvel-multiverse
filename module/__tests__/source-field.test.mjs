/* eslint-env jest */
import { sourceLabel, sourceValue, sourceFilterOptions } from '../helpers/sources.mjs';

const REGISTRY = {
    core: { label: 'Core Rulebook' },
    coreModified: { label: 'Core Rulebook (Modified)' },
    homebrew: { label: 'Homebrew' },
    testBook: { label: 'A Test Book' },
};

beforeEach(() => {
    globalThis.CONFIG = { MARVEL_MULTIVERSE: { sources: structuredClone(REGISTRY) } };
});

describe('sourceLabel and sourceValue', () => {
    test.each(Object.keys(REGISTRY))('the label of %s converts back to its key', (key) => {
        expect(sourceLabel(key)).toBe(REGISTRY[key].label);
        expect(sourceValue(sourceLabel(key))).toBe(key);
    });

    test('a label typed in another case, with spaces around it, gives the key', () => {
        expect(sourceValue('  core rulebook (MODIFIED) ')).toBe('coreModified');
    });

    test('text that is not a registered label is stored as typed, without the spaces around it', () => {
        expect(sourceValue(' My Own Zine ')).toBe('My Own Zine');
        expect(sourceLabel('My Own Zine')).toBe('My Own Zine');
    });

    test('an entry added to the registry later is used', () => {
        CONFIG.MARVEL_MULTIVERSE.sources.late = { label: 'Late Arrival' };
        expect(sourceLabel('late')).toBe('Late Arrival');
        expect(sourceValue('late arrival')).toBe('late');
    });

    test('a stored value that names a built-in object property is shown as itself', () => {
        expect(sourceLabel('constructor')).toBe('constructor');
    });

    test('no source is an empty string both ways', () => {
        expect(sourceLabel(undefined)).toBe('');
        expect(sourceValue(undefined)).toBe('');
        expect(sourceValue('   ')).toBe('');
    });
});

describe('sourceFilterOptions', () => {
    const item = (source) => ({ system: { source } });

    test('lists the registry in its own order, then the other sources in use in alphabetical order', () => {
        const options = sourceFilterOptions([item('Zebra Zine'), item('core'), item('Apple Annual')], []);
        expect(Object.keys(options)).toEqual(['core', 'coreModified', 'homebrew', 'testBook', 'Apple Annual', 'Zebra Zine']);
    });

    test('items with no source add nothing', () => {
        const options = sourceFilterOptions([item(''), item(undefined), {}], []);
        expect(Object.keys(options)).toEqual(Object.keys(REGISTRY));
    });

    test('a registered source shows its label and a typed one shows itself', () => {
        const options = sourceFilterOptions([item('Zebra Zine')], []);
        expect(options.testBook.label).toBe('A Test Book');
        expect(options['Zebra Zine'].label).toBe('Zebra Zine');
    });

    test('only the selected sources are checked', () => {
        const options = sourceFilterOptions([item('Zebra Zine'), item('Apple Annual')], ['homebrew', 'Zebra Zine']);
        expect(Object.entries(options).filter(([, o]) => o.checked).map(([k]) => k)).toEqual(['homebrew', 'Zebra Zine']);
    });
});
