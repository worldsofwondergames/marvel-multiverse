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

  test('lang/en.json defines the section title and ready badge', () => {
    expect(typeof enLang.MARVEL_MULTIVERSE.Schooling.Title).toBe('string');
    expect(typeof enLang.MARVEL_MULTIVERSE.Schooling.ReadyToAdvance).toBe('string');
  });
});

/** Build a boxes object with the first `n` boxes checked. */
function boxesWithChecked(n) {
  return Object.fromEntries(
    Array.from({ length: 10 }, (_, i) => [`box${i}`, i < n])
  );
}

/**
 * The mocked TypeDataModel does not apply schema defaults, so every field the
 * base class touches must be supplied explicitly. `prepareDerivedData` chains
 * to `MarvelMultiverseActorBase`, which reads abilities, rank, health, focus,
 * and movement — an incomplete fixture throws there rather than in the code
 * under test.
 */
function makeCharacter(checkedCount) {
  const ability = () => ({ value: 2, defense: 0, noncom: 0, damageMultiplier: 0 });
  const instance = new MarvelMultiverseCharacter({
    abilities: {
      mle: ability(), agl: ability(), res: ability(),
      vig: ability(), ego: ability(), log: ability(),
    },
    attributes: { rank: { value: 1 }, init: { value: 0 } },
    health: { value: 0, max: 0, bonus: 0 },
    focus: { value: 0, max: 0, bonus: 0 },
    healthDamageReduction: 0,
    focusDamageReduction: 0,
    movement: {
      run: { value: 10, calc: "", noncomMultiplier: 1 },
      climb: { value: 0, calc: "", noncomMultiplier: 1 },
      jump: { value: 0, calc: "", noncomMultiplier: 1 },
      swim: { value: 0, calc: "", noncomMultiplier: 1 },
    },
    schooling: { boxes: boxesWithChecked(checkedCount) },
  });
  instance.prepareDerivedData();
  return instance;
}

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
});

describe('character schooling derived values', () => {
  test('completed counts the checked boxes', () => {
    expect(makeCharacter(0).schooling.completed).toBe(0);
    expect(makeCharacter(3).schooling.completed).toBe(3);
    expect(makeCharacter(10).schooling.completed).toBe(10);
  });

  test('readyToAdvance is false at nine boxes and true at ten', () => {
    expect(makeCharacter(9).schooling.readyToAdvance).toBe(false);
    expect(makeCharacter(10).schooling.readyToAdvance).toBe(true);
  });

  test('chains to the base class, which computes Health, Focus and defenses', () => {
    // The character model had no prepareDerivedData before the schooling chart
    // was added, so nothing else covers the super call. Dropping it silently
    // strips every derived value on the base class -- the exact failure that
    // once disabled all Active Effects in this system.
    const character = makeCharacter(0);
    expect(character.health.max).toBe(60); // res 2 * 30
    expect(character.focus.max).toBe(60); // vig 2 * 30
    expect(character.abilities.mle.defense).toBe(12); // value 2 + 10
  });

  test('re-preparing does not inflate the count', () => {
    // Guards the derived values being written to `schooling` rather than to
    // `schooling.boxes`, where Object.values would start counting its own output.
    const character = makeCharacter(4);
    character.prepareDerivedData();
    character.prepareDerivedData();
    expect(character.schooling.completed).toBe(4);
  });
});
