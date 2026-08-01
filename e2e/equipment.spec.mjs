import { test, expect } from './fixtures.mjs';
import {
  dismissNotifications,
  createActorViaAPI,
  deleteActor,
  getActorSystemData,
  getActiveEffectNames,
} from './helpers.mjs';

const ACTOR_NAME = 'E2E Equipment Actor';
const PROTECTION_NAME = 'E2E Body Armor';
const GRENADE_NAME = 'E2E Flashbang';
const GADGET_NAME = 'E2E Power Neutralizer';

async function deleteItem(page, name) {
  await page.evaluate(async (name) => {
    const item = game.items.find(i => i.name === name);
    if (item) await item.delete();
  }, name);
  await page.waitForTimeout(500);
}

async function createEquipmentViaAPI(page, name, systemData = {}) {
  await page.evaluate(async ({ name, systemData }) => {
    await Item.create({ name, type: 'equipment', system: systemData });
  }, { name, systemData });
  await page.waitForTimeout(500);
}

async function getEquipmentData(page, name) {
  return page.evaluate((name) => {
    const item = game.items.find(i => i.name === name);
    if (!item) throw new Error(`Item "${name}" not found`);
    return {
      type: item.type,
      equipmentType: item.system.equipmentType,
      equipped: item.system.equipped,
      ruined: item.system.ruined,
      damageReduction: item.system.damageReduction,
      protectionNotes: item.system.protectionNotes,
      grenadeType: item.system.grenadeType,
      grenadeEffect: item.system.grenadeEffect,
      gadgetHP: item.system.gadgetHP,
      gadgetMaxHP: item.system.gadgetMaxHP,
      gadgetEffect: item.system.gadgetEffect,
    };
  }, name);
}

async function openItemSheet(page, name) {
  await page.evaluate(async (name) => {
    const item = game.items.find(i => i.name === name);
    if (!item) throw new Error(`Item "${name}" not found`);
    item.sheet.render(true);
  }, name);
  await page.waitForTimeout(2000);
  await dismissNotifications(page);
  const sheet = page.locator('.sheet.item').last();
  await sheet.waitFor({ state: 'visible', timeout: 10_000 });
  return sheet;
}

async function addEquipmentToActor(page, actorName, itemName, systemData = {}) {
  await page.evaluate(async ({ actorName, itemName, systemData }) => {
    const actor = game.actors.find(a => a.name === actorName);
    if (!actor) throw new Error(`Actor "${actorName}" not found`);
    await actor.createEmbeddedDocuments('Item', [{
      name: itemName,
      type: 'equipment',
      system: systemData,
    }]);
  }, { actorName, itemName, systemData });
  await page.waitForTimeout(500);
}

async function getActorEquipmentEffects(page, actorName) {
  return page.evaluate((name) => {
    const actor = game.actors.find(a => a.name === name);
    if (!actor) return [];
    return actor.effects.contents
      .filter(e => e.flags?.['marvel-multiverse']?.equipmentId)
      .map(e => ({
        name: e.name,
        equipmentId: e.flags['marvel-multiverse'].equipmentId,
        changes: e.changes.map(c => ({ key: c.key, mode: c.mode, value: c.value })),
      }));
  }, actorName);
}

test.describe('Equipment Item Type', () => {

  test.afterEach(async ({ foundryPage }) => {
    await deleteItem(foundryPage, PROTECTION_NAME);
    await deleteItem(foundryPage, GRENADE_NAME);
    await deleteItem(foundryPage, GADGET_NAME);
    await deleteActor(foundryPage, ACTOR_NAME);
  });

  test('can create protection equipment with correct defaults', async ({ foundryPage }) => {
    const page = foundryPage;
    await createEquipmentViaAPI(page, PROTECTION_NAME);

    const data = await getEquipmentData(page, PROTECTION_NAME);
    expect(data.type).toBe('equipment');
    expect(data.equipmentType).toBe('protection');
    expect(data.equipped).toBe(false);
    expect(data.ruined).toBe(false);
    expect(data.damageReduction).toBe(0);
    expect(data.protectionNotes).toBe('');
  });

  test('can create grenade equipment', async ({ foundryPage }) => {
    const page = foundryPage;
    await createEquipmentViaAPI(page, GRENADE_NAME, {
      equipmentType: 'grenade',
      grenadeType: 'flashbang',
      grenadeEffect: 'Blinds targets in area',
    });

    const data = await getEquipmentData(page, GRENADE_NAME);
    expect(data.equipmentType).toBe('grenade');
    expect(data.grenadeType).toBe('flashbang');
    expect(data.grenadeEffect).toBe('Blinds targets in area');
  });

  test('can create gadget equipment', async ({ foundryPage }) => {
    const page = foundryPage;
    await createEquipmentViaAPI(page, GADGET_NAME, {
      equipmentType: 'gadget',
      gadgetHP: 10,
      gadgetMaxHP: 10,
      gadgetEffect: 'Neutralizes one power of touched target',
    });

    const data = await getEquipmentData(page, GADGET_NAME);
    expect(data.equipmentType).toBe('gadget');
    expect(data.gadgetHP).toBe(10);
    expect(data.gadgetMaxHP).toBe(10);
    expect(data.gadgetEffect).toBe('Neutralizes one power of touched target');
  });

  test('equipment sheet shows correct tabs', async ({ foundryPage }) => {
    const page = foundryPage;
    await createEquipmentViaAPI(page, PROTECTION_NAME);
    const sheet = await openItemSheet(page, PROTECTION_NAME);

    await expect(sheet.locator('.sheet-tabs a[data-tab="attributes"]')).toBeVisible();
    await expect(sheet.locator('.sheet-tabs a[data-tab="effects"]')).toBeVisible();
  });

  test('protection sheet shows DR and notes fields', async ({ foundryPage }) => {
    const page = foundryPage;
    await createEquipmentViaAPI(page, PROTECTION_NAME, {
      equipmentType: 'protection',
      damageReduction: 2,
      protectionNotes: 'Trouble on Agility',
    });
    const sheet = await openItemSheet(page, PROTECTION_NAME);

    await sheet.locator('.sheet-tabs a[data-tab="attributes"]').click();
    await page.waitForTimeout(500);

    await expect(sheet.locator('input[name="system.damageReduction"]')).toHaveValue('2');
    await expect(sheet.locator('input[name="system.protectionNotes"]')).toHaveValue('Trouble on Agility');
    await expect(sheet.locator('select[name="system.equipmentType"]')).toHaveValue('protection');
  });

  test('grenade sheet shows grenade type and effect fields', async ({ foundryPage }) => {
    const page = foundryPage;
    await createEquipmentViaAPI(page, GRENADE_NAME, {
      equipmentType: 'grenade',
      grenadeType: 'gas',
      grenadeEffect: 'Resilience check or incapacitated',
    });
    const sheet = await openItemSheet(page, GRENADE_NAME);

    await sheet.locator('.sheet-tabs a[data-tab="attributes"]').click();
    await page.waitForTimeout(500);

    await expect(sheet.locator('select[name="system.equipmentType"]')).toHaveValue('grenade');
    await expect(sheet.locator('select[name="system.grenadeType"]')).toHaveValue('gas');
    await expect(sheet.locator('textarea[name="system.grenadeEffect"]')).toHaveValue('Resilience check or incapacitated');
  });

  test('gadget sheet shows HP and effect fields', async ({ foundryPage }) => {
    const page = foundryPage;
    await createEquipmentViaAPI(page, GADGET_NAME, {
      equipmentType: 'gadget',
      gadgetHP: 7,
      gadgetMaxHP: 10,
      gadgetEffect: 'Neutralizes one power',
    });
    const sheet = await openItemSheet(page, GADGET_NAME);

    await sheet.locator('.sheet-tabs a[data-tab="attributes"]').click();
    await page.waitForTimeout(500);

    await expect(sheet.locator('select[name="system.equipmentType"]')).toHaveValue('gadget');
    await expect(sheet.locator('input[name="system.gadgetHP"]')).toHaveValue('7');
    await expect(sheet.locator('input[name="system.gadgetMaxHP"]')).toHaveValue('10');
    await expect(sheet.locator('textarea[name="system.gadgetEffect"]')).toHaveValue('Neutralizes one power');
  });

  test('equipment appears on character sheet gear tab', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME, 'character');
    await addEquipmentToActor(page, ACTOR_NAME, PROTECTION_NAME, {
      equipmentType: 'protection',
      damageReduction: 2,
    });

    await page.evaluate(async (name) => {
      const actor = game.actors.find(a => a.name === name);
      if (!actor) throw new Error(`Actor "${name}" not found`);
      actor.sheet.render(true);
    }, ACTOR_NAME);
    await page.waitForTimeout(2000);
    await dismissNotifications(page);

    const actorSheet = page.locator('.marvel-multiverse.sheet.actor').last();
    await actorSheet.waitFor({ state: 'visible', timeout: 10_000 });

    await actorSheet.locator('.sheet-tabs a[data-tab="gear"]').click();
    await page.waitForTimeout(500);

    const gearTab = actorSheet.locator('.tab[data-tab="gear"]');
    await expect(gearTab).toContainText('Equipment');
    await expect(gearTab).toContainText(PROTECTION_NAME);
  });

  test('equipping protection applies DR active effect', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME, 'character');
    await addEquipmentToActor(page, ACTOR_NAME, PROTECTION_NAME, {
      equipmentType: 'protection',
      damageReduction: 2,
    });

    // Get baseline DR
    let actorData = await getActorSystemData(page, ACTOR_NAME);
    const baseDR = actorData.healthDamageReduction;

    // Render the actor sheet so toggle method is available
    await page.evaluate(async (name) => {
      const actor = game.actors.find(a => a.name === name);
      actor.sheet.render(true);
    }, ACTOR_NAME);
    await page.waitForTimeout(2000);
    await dismissNotifications(page);

    // Equip via the toggle
    await page.evaluate(async ({ actorName, itemName }) => {
      const actor = game.actors.find(a => a.name === actorName);
      const item = actor.items.find(i => i.name === itemName);
      const sheet = actor.sheet;
      await sheet._onToggleEquipmentEquip({ preventDefault: () => {}, currentTarget: { dataset: { itemId: item.id } } });
    }, { actorName: ACTOR_NAME, itemName: PROTECTION_NAME });
    await page.waitForTimeout(1000);

    // Verify effect was created
    const effects = await getActorEquipmentEffects(page, ACTOR_NAME);
    expect(effects).toHaveLength(1);
    expect(effects[0].name).toContain(PROTECTION_NAME);
    expect(effects[0].changes[0].key).toBe('system.healthDamageReduction');
    expect(effects[0].changes[0].value).toBe('2');

    // Verify DR increased
    actorData = await getActorSystemData(page, ACTOR_NAME);
    expect(actorData.healthDamageReduction).toBe(baseDR + 2);
    expect(actorData.conditionDamageReduction).toBe((baseDR + 2) * 5);
  });

  test('unequipping protection removes DR active effect', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME, 'character');
    await addEquipmentToActor(page, ACTOR_NAME, PROTECTION_NAME, {
      equipmentType: 'protection',
      damageReduction: 2,
    });

    // Render the actor sheet so toggle method is available
    await page.evaluate(async (name) => {
      const actor = game.actors.find(a => a.name === name);
      actor.sheet.render(true);
    }, ACTOR_NAME);
    await page.waitForTimeout(2000);
    await dismissNotifications(page);

    // Equip
    await page.evaluate(async ({ actorName, itemName }) => {
      const actor = game.actors.find(a => a.name === actorName);
      const item = actor.items.find(i => i.name === itemName);
      const sheet = actor.sheet;
      await sheet._onToggleEquipmentEquip({ preventDefault: () => {}, currentTarget: { dataset: { itemId: item.id } } });
    }, { actorName: ACTOR_NAME, itemName: PROTECTION_NAME });
    await page.waitForTimeout(1000);

    // Unequip
    await page.evaluate(async ({ actorName, itemName }) => {
      const actor = game.actors.find(a => a.name === actorName);
      const item = actor.items.find(i => i.name === itemName);
      const sheet = actor.sheet;
      await sheet._onToggleEquipmentEquip({ preventDefault: () => {}, currentTarget: { dataset: { itemId: item.id } } });
    }, { actorName: ACTOR_NAME, itemName: PROTECTION_NAME });
    await page.waitForTimeout(1000);

    // Verify effect was removed
    const effects = await getActorEquipmentEffects(page, ACTOR_NAME);
    expect(effects).toHaveLength(0);

    // Verify DR back to baseline
    const actorData = await getActorSystemData(page, ACTOR_NAME);
    expect(actorData.healthDamageReduction).toBe(0);
  });

  test('deleting equipped protection cleans up active effect', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME, 'character');
    await addEquipmentToActor(page, ACTOR_NAME, PROTECTION_NAME, {
      equipmentType: 'protection',
      damageReduction: 2,
    });

    // Render the actor sheet and equip
    await page.evaluate(async (name) => {
      const actor = game.actors.find(a => a.name === name);
      actor.sheet.render(true);
    }, ACTOR_NAME);
    await page.waitForTimeout(2000);
    await dismissNotifications(page);

    await page.evaluate(async ({ actorName, itemName }) => {
      const actor = game.actors.find(a => a.name === actorName);
      const item = actor.items.find(i => i.name === itemName);
      const sheet = actor.sheet;
      await sheet._onToggleEquipmentEquip({ preventDefault: () => {}, currentTarget: { dataset: { itemId: item.id } } });
    }, { actorName: ACTOR_NAME, itemName: PROTECTION_NAME });
    await page.waitForTimeout(1000);

    // Verify effect exists
    let effects = await getActorEquipmentEffects(page, ACTOR_NAME);
    expect(effects).toHaveLength(1);

    // Delete the item — the delete handler should clean up effects
    await page.evaluate(async ({ actorName, itemName }) => {
      const actor = game.actors.find(a => a.name === actorName);
      const item = actor.items.find(i => i.name === itemName);
      const equipEffects = actor.effects.filter(e => e.flags?.['marvel-multiverse']?.equipmentId === item.id);
      if (equipEffects.length) {
        await actor.deleteEmbeddedDocuments('ActiveEffect', equipEffects.map(e => e.id));
      }
      await actor.deleteEmbeddedDocuments('Item', [item.id]);
    }, { actorName: ACTOR_NAME, itemName: PROTECTION_NAME });
    await page.waitForTimeout(500);

    // Verify effect was cleaned up
    effects = await getActorEquipmentEffects(page, ACTOR_NAME);
    expect(effects).toHaveLength(0);

    const actorData = await getActorSystemData(page, ACTOR_NAME);
    expect(actorData.healthDamageReduction).toBe(0);
  });

  test('ruined protection does not apply DR on equip', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME, 'character');
    await addEquipmentToActor(page, ACTOR_NAME, PROTECTION_NAME, {
      equipmentType: 'protection',
      damageReduction: 2,
      ruined: true,
    });

    // Render the actor sheet so toggle method is available
    await page.evaluate(async (name) => {
      const actor = game.actors.find(a => a.name === name);
      actor.sheet.render(true);
    }, ACTOR_NAME);
    await page.waitForTimeout(2000);
    await dismissNotifications(page);

    // Try to equip ruined armor
    await page.evaluate(async ({ actorName, itemName }) => {
      const actor = game.actors.find(a => a.name === actorName);
      const item = actor.items.find(i => i.name === itemName);
      const sheet = actor.sheet;
      await sheet._onToggleEquipmentEquip({ preventDefault: () => {}, currentTarget: { dataset: { itemId: item.id } } });
    }, { actorName: ACTOR_NAME, itemName: PROTECTION_NAME });
    await page.waitForTimeout(1000);

    // Verify no effect was created
    const effects = await getActorEquipmentEffects(page, ACTOR_NAME);
    expect(effects).toHaveLength(0);

    const actorData = await getActorSystemData(page, ACTOR_NAME);
    expect(actorData.healthDamageReduction).toBe(0);
  });

  test('grenade equipment does not apply effects on equip', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME, 'character');
    await addEquipmentToActor(page, ACTOR_NAME, GRENADE_NAME, {
      equipmentType: 'grenade',
      grenadeType: 'flashbang',
    });

    // Render the actor sheet so toggle method is available
    await page.evaluate(async (name) => {
      const actor = game.actors.find(a => a.name === name);
      actor.sheet.render(true);
    }, ACTOR_NAME);
    await page.waitForTimeout(2000);
    await dismissNotifications(page);

    await page.evaluate(async ({ actorName, itemName }) => {
      const actor = game.actors.find(a => a.name === actorName);
      const item = actor.items.find(i => i.name === itemName);
      const sheet = actor.sheet;
      await sheet._onToggleEquipmentEquip({ preventDefault: () => {}, currentTarget: { dataset: { itemId: item.id } } });
    }, { actorName: ACTOR_NAME, itemName: GRENADE_NAME });
    await page.waitForTimeout(1000);

    const effects = await getActorEquipmentEffects(page, ACTOR_NAME);
    expect(effects).toHaveLength(0);
  });
});
