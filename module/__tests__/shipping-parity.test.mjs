/* eslint-env jest */
/**
 * `system.json` loads only `marvel-multiverse.mjs`. Every other test in this
 * directory imports the `module/**` twins, which Foundry never executes — so a
 * twin can drift from the shipping file and its unit tests keep passing while
 * the real behaviour changes underneath.
 *
 * That is not hypothetical: before this file existed, every twin data model was
 * missing `source`, the actor models were missing `defaultWeaponType`, and
 * power/tag/trait were missing `detail`. Eleven models' worth of schema tests
 * were validating shapes that do not ship.
 *
 * These tests import BOTH trees and compare what the code actually produces —
 * schema field names and their declared defaults — rather than comparing source
 * text, so reformatting the monolith cannot break them.
 */
import * as shipping from '../../marvel-multiverse.mjs';

import ActorBase from '../data/actor-base.mjs';
import Character from '../data/character.mjs';
import Npc from '../data/npc.mjs';
import ItemBase from '../data/item-base.mjs';
import Item from '../data/item.mjs';
import Power from '../data/power.mjs';
import Stunt from '../data/stunt.mjs';
import Tag from '../data/tag.mjs';
import Trait from '../data/trait.mjs';
import Weapon from '../data/weapon.mjs';
import Occupation from '../data/occupation.mjs';
import Origin from '../data/origin.mjs';

/**
 * Twins that the monolith re-exports via its `models` barrel, so both versions
 * can be instantiated and compared in the same process.
 */
const PAIRED_MODELS = [
  ['MarvelMultiverseActorBase', ActorBase],
  ['MarvelMultiverseCharacter', Character],
  ['MarvelMultiverseNPC', Npc],
  ['MarvelMultiverseItemBase', ItemBase],
  ['MarvelMultiverseItem', Item],
  ['MarvelMultiversePower', Power],
  ['MarvelMultiverseStunt', Stunt],
  ['MarvelMultiverseTag', Tag],
  ['MarvelMultiverseTrait', Trait],
  ['MarvelMultiverseWeapon', Weapon],
  ['MarvelMultiverseOccupation', Occupation],
  ['MarvelMultiverseOrigin', Origin],
];

/**
 * Field name -> the constraints the field was declared with. The mock field
 * classes retain `.options`, so this compares what each tree actually declares
 * (default value, bounds, integer/blank/required flags) rather than just the
 * field names.
 */
function schemaShape(ModelClass) {
  const schema = ModelClass.defineSchema();
  const shape = {};
  for (const [key, field] of Object.entries(schema)) {
    const o = field?.options ?? {};
    shape[key] = {
      kind: field?.constructor?.name ?? 'unknown',
      initial: o.initial ?? null,
      min: o.min ?? null,
      max: o.max ?? null,
      integer: o.integer ?? false,
      blank: o.blank ?? false,
      required: o.required ?? false,
      nullable: o.nullable ?? null,
      choices: o.choices ?? null,
    };
  }
  return shape;
}

describe('shipping monolith is importable', () => {
  test('marvel-multiverse.mjs evaluates under the test mocks', () => {
    // If this breaks, every parity test below is silently skipped, so assert it
    // separately rather than letting an import error read as unrelated failures.
    expect(typeof shipping.models).toBe('object');
    expect(shipping.MarvelMultiverseActor).toBeInstanceOf(Function);
  });

  test('every paired twin resolves to a class in the shipping barrel', () => {
    const missing = PAIRED_MODELS
      .filter(([name]) => typeof shipping.models[name] !== 'function')
      .map(([name]) => name);
    expect(missing).toEqual([]);
  });
});

describe('data model schemas match the shipping monolith', () => {
  test.each(PAIRED_MODELS)('%s declares the same fields in both trees', (name, Twin) => {
    const Shipping = shipping.models[name];
    const twinFields = Object.keys(schemaShape(Twin)).sort();
    const shippingFields = Object.keys(schemaShape(Shipping)).sort();
    expect(twinFields).toEqual(shippingFields);
  });

  test.each(PAIRED_MODELS)('%s declares the same field defaults in both trees', (name, Twin) => {
    const Shipping = shipping.models[name];
    expect(schemaShape(Twin)).toEqual(schemaShape(Shipping));
  });
});

/**
 * Method-level drift. The twins are missing whole methods the shipping sheets
 * and documents have — equipment equip/unequip handling, `_preCreate` hooks, the
 * chat-card target handlers. Those are real features with no unit coverage at
 * all, because the class Jest imports does not contain them.
 *
 * Marked failing rather than deleted: the assertion is what we want to be true,
 * and it should start passing as the twins are brought back in line (or as the
 * twins are retired in favour of testing the monolith directly).
 */
describe('class method parity', () => {
  /** Twins whose method list already matches the shipping class. */
  const ALIGNED = [['MarvelMultiverseItemSheet', '../sheets/item-sheet.mjs']];

  /** Twins missing methods the shipping class defines. */
  const DRIFTED = [
    ['MarvelMultiverseActor', '../documents/actor.mjs'],
    ['ChatMessageMarvel', '../documents/chat-message.mjs'],
    ['MarvelMultiverseCharacterSheet', '../sheets/character-sheet.mjs'],
    ['MarvelMultiverseNPCSheet', '../sheets/npc-sheet.mjs'],
  ];

  function ownMethods(cls) {
    return Object.getOwnPropertyNames(cls.prototype)
      .filter((n) => n !== 'constructor')
      .sort();
  }

  async function compare(name, twinPath) {
    const twinModule = await import(twinPath);
    const Twin = twinModule[name] ?? twinModule.default;
    expect(ownMethods(Twin)).toEqual(ownMethods(shipping[name]));
  }

  // Method names align here, but several bodies still differ — that is a
  // behavioural difference this file cannot see, and is covered by e2e instead.
  test.each(ALIGNED)('%s exposes the same methods in both trees', compare);

  test.failing.each(DRIFTED)('%s exposes the same methods in both trees', compare);
});
