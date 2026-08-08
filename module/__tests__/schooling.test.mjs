/* eslint-env jest */
import enLang from '../../lang/en.json';

// `module/__mocks__/marvel-multiverse.mjs` assigns module/config.mjs onto
// global.CONFIG.MARVEL_MULTIVERSE, so the config is readable here as it is at runtime.

describe('schoolingChart config', () => {
  test('declares exactly ten boxes', () => {
    expect(CONFIG.MARVEL_MULTIVERSE.schoolingChart).toHaveLength(10);
  });

  test('matches the printed chart: five ability, four power, one trait', () => {
    const keys = CONFIG.MARVEL_MULTIVERSE.schoolingChart.map(b => b.key);
    expect(keys).toEqual([
      'ability', 'ability', 'ability', 'ability', 'ability',
      'power', 'power', 'power', 'power', 'trait',
    ]);
  });

  test('every box label resolves to a string in lang/en.json', () => {
    for (const box of CONFIG.MARVEL_MULTIVERSE.schoolingChart) {
      const value = box.label
        .split('.')
        .reduce((node, segment) => node?.[segment], { MARVEL_MULTIVERSE: enLang.MARVEL_MULTIVERSE });
      expect(typeof value).toBe('string');
    }
  });

  test('lang/en.json defines the section title and ready badge', () => {
    expect(typeof enLang.MARVEL_MULTIVERSE.Schooling.Title).toBe('string');
    expect(typeof enLang.MARVEL_MULTIVERSE.Schooling.ReadyToAdvance).toBe('string');
  });
});
