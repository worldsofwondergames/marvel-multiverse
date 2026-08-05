/* eslint-env jest */
import MarvelMultiverseEquipment from '../data/equipment.mjs';

describe('MarvelMultiverseEquipment — defineSchema', () => {
  let schema;

  beforeAll(() => {
    schema = MarvelMultiverseEquipment.defineSchema();
  });

  test('schema includes equipmentType field', () => {
    expect(schema.equipmentType).toBeDefined();
  });

  test('schema includes equipped field', () => {
    expect(schema.equipped).toBeDefined();
  });

  test('schema includes ruined field', () => {
    expect(schema.ruined).toBeDefined();
  });

  test('schema includes damageReduction field', () => {
    expect(schema.damageReduction).toBeDefined();
  });

  test('schema includes protectionNotes field', () => {
    expect(schema.protectionNotes).toBeDefined();
  });

  test('schema includes grenadeType field', () => {
    expect(schema.grenadeType).toBeDefined();
  });

  test('schema includes grenadeEffect field', () => {
    expect(schema.grenadeEffect).toBeDefined();
  });

  test('schema includes gadgetHP field', () => {
    expect(schema.gadgetHP).toBeDefined();
  });

  test('schema includes gadgetMaxHP field', () => {
    expect(schema.gadgetMaxHP).toBeDefined();
  });

  test('schema includes gadgetEffect field', () => {
    expect(schema.gadgetEffect).toBeDefined();
  });

  test('schema inherits description from base', () => {
    expect(schema.description).toBeDefined();
  });

  test('schema inherits quantity from base', () => {
    expect(schema.quantity).toBeDefined();
  });

  test('schema inherits ability from base', () => {
    expect(schema.ability).toBeDefined();
  });

  test('schema includes source field', () => {
    expect(schema.source).toBeDefined();
  });
});

describe('MarvelMultiverseEquipment — constructor data assignment', () => {
  test('accepts protection data', () => {
    const equipment = new MarvelMultiverseEquipment({
      equipmentType: 'protection',
      equipped: true,
      damageReduction: 2,
      protectionNotes: 'Trouble on Agility',
    });
    expect(equipment.equipmentType).toBe('protection');
    expect(equipment.equipped).toBe(true);
    expect(equipment.damageReduction).toBe(2);
    expect(equipment.protectionNotes).toBe('Trouble on Agility');
  });

  test('accepts grenade data', () => {
    const equipment = new MarvelMultiverseEquipment({
      equipmentType: 'grenade',
      grenadeType: 'flashbang',
      grenadeEffect: 'Blinds targets in area',
    });
    expect(equipment.equipmentType).toBe('grenade');
    expect(equipment.grenadeType).toBe('flashbang');
    expect(equipment.grenadeEffect).toBe('Blinds targets in area');
  });

  test('accepts gadget data', () => {
    const equipment = new MarvelMultiverseEquipment({
      equipmentType: 'gadget',
      gadgetHP: 7,
      gadgetMaxHP: 10,
      gadgetEffect: 'Neutralizes one power',
    });
    expect(equipment.equipmentType).toBe('gadget');
    expect(equipment.gadgetHP).toBe(7);
    expect(equipment.gadgetMaxHP).toBe(10);
    expect(equipment.gadgetEffect).toBe('Neutralizes one power');
  });

  test('ruined protection retains data', () => {
    const equipment = new MarvelMultiverseEquipment({
      equipmentType: 'protection',
      equipped: true,
      ruined: true,
      damageReduction: 2,
    });
    expect(equipment.ruined).toBe(true);
    expect(equipment.equipped).toBe(true);
    expect(equipment.damageReduction).toBe(2);
  });

  test('accepts device data', () => {
    const equipment = new MarvelMultiverseEquipment({
      equipmentType: 'device',
      gadgetEffect: 'Blocks telepathic intrusion',
      gadgetHP: 5,
      gadgetMaxHP: 5,
    });
    expect(equipment.equipmentType).toBe('device');
    expect(equipment.gadgetEffect).toBe('Blocks telepathic intrusion');
    expect(equipment.gadgetHP).toBe(5);
  });

  test('accepts material data', () => {
    const equipment = new MarvelMultiverseEquipment({
      equipmentType: 'material',
      protectionNotes: 'Virtually indestructible',
    });
    expect(equipment.equipmentType).toBe('material');
    expect(equipment.protectionNotes).toBe('Virtually indestructible');
  });

  test('accepts source field', () => {
    const equipment = new MarvelMultiverseEquipment({
      equipmentType: 'protection',
      source: 'vanguard-expansion',
    });
    expect(equipment.source).toBe('vanguard-expansion');
  });
});
