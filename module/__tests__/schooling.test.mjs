/* eslint-env jest */
import enLang from '../../lang/en.json';
import MarvelMultiverseCharacter from '../data/character.mjs';
import MarvelMultiverseNPC from '../data/npc.mjs';

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

  test('lang/en.json defines the section title', () => {
    expect(enLang.MARVEL_MULTIVERSE.Schooling.Title).toBe('Advancement');
  });
});

describe('character schooling schema', () => {
  test('declares ten boolean boxes defaulting to false', () => {
    const boxes = MarvelMultiverseCharacter.defineSchema().schooling.fields.boxes.fields;
    expect(Object.keys(boxes).sort()).toEqual(
      Array.from({ length: 10 }, (_, i) => `box${i}`).sort()
    );
    for (const field of Object.values(boxes)) {
      expect(field.options.initial).toBe(false);
    }
  });

  test('is not present on the NPC schema', () => {
    expect(MarvelMultiverseNPC.defineSchema().schooling).toBeUndefined();
  });

  test('schooling holds exactly one field, boxes', () => {
    const schooling = MarvelMultiverseCharacter.defineSchema().schooling;
    expect(Object.keys(schooling.fields)).toEqual(['boxes']);
  });
});
