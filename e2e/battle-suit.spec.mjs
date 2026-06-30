import { test, expect } from './fixtures.mjs';
import { dismissNotifications, createActorViaAPI, deleteActor } from './helpers.mjs';

const BATTLE_SUIT_NAME = 'E2E Test Battle Suit';
const POWER_NAME = 'E2E Test Suit Power';
const RESTRICTION_NAME = 'E2E Test Suit Restriction';
const ICONIC_ITEM_NAME = 'E2E Test Integrated Weapon';
const ACTOR_NAME = 'E2E Battle Suit Actor';

async function deleteItem(page, name) {
  await page.evaluate(async (name) => {
    const item = game.items.find(i => i.name === name);
    if (item) await item.delete();
  }, name);
  await page.waitForTimeout(500);
}

async function createBattleSuitViaAPI(page, name) {
  await page.evaluate(async (name) => {
    await Item.create({ name, type: 'battleSuit' });
  }, name);
  await page.waitForTimeout(500);
}

async function createPowerViaAPI(page, name) {
  await page.evaluate(async (name) => {
    await Item.create({
      name,
      type: 'power',
      system: { powerSet: 'Basic' },
    });
  }, name);
  await page.waitForTimeout(500);
}

async function createRestrictionViaAPI(page, name, kind = 'access') {
  await page.evaluate(async ({ name, kind }) => {
    await Item.create({
      name,
      type: 'restriction',
      system: { kind, description: `${name} description` },
    });
  }, { name, kind });
  await page.waitForTimeout(500);
}

async function createIconicItemViaAPI(page, name) {
  await page.evaluate(async (name) => {
    await Item.create({ name, type: 'iconicItem' });
  }, name);
  await page.waitForTimeout(500);
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

async function getBattleSuitData(page, name) {
  return page.evaluate((name) => {
    const item = game.items.find(i => i.name === name);
    if (!item) throw new Error(`Item "${name}" not found`);
    return {
      type: item.type,
      origin: item.system.origin,
      restrictions: item.system.restrictions ?? [],
      powers: item.system.powers ?? [],
      abilityModifiers: item.system.abilityModifiers,
      rankIncrease: item.system.rankIncrease,
      additionalTraits: item.system.additionalTraits ?? [],
      integratedIconicItems: item.system.integratedIconicItems ?? [],
      powerValue: item.system.powerValue,
    };
  }, name);
}

test.describe('Battle Suit Item Type', () => {

  test.afterEach(async ({ foundryPage }) => {
    await deleteItem(foundryPage, BATTLE_SUIT_NAME);
    await deleteItem(foundryPage, POWER_NAME);
    await deleteItem(foundryPage, RESTRICTION_NAME);
    await deleteItem(foundryPage, ICONIC_ITEM_NAME);
    await deleteActor(foundryPage, ACTOR_NAME);
  });

  test('can create a battle suit via API with correct defaults', async ({ foundryPage }) => {
    const page = foundryPage;
    await createBattleSuitViaAPI(page, BATTLE_SUIT_NAME);

    const data = await getBattleSuitData(page, BATTLE_SUIT_NAME);
    expect(data.type).toBe('battleSuit');
    expect(data.origin).toBe('High-Tech: Battle Suit');
    expect(data.powers).toEqual([]);
    expect(data.restrictions).toEqual([]);
    expect(data.rankIncrease).toBe(0);
    expect(data.additionalTraits).toEqual([]);
    expect(data.integratedIconicItems).toEqual([]);
    expect(data.abilityModifiers.melee).toBe(0);
    expect(data.abilityModifiers.agility).toBe(0);
    expect(data.abilityModifiers.resilience).toBe(0);
    expect(data.abilityModifiers.vigilance).toBe(0);
    expect(data.abilityModifiers.ego).toBe(0);
    expect(data.abilityModifiers.logic).toBe(0);
  });

  test('power value is 0 with no powers or restrictions', async ({ foundryPage }) => {
    const page = foundryPage;
    await createBattleSuitViaAPI(page, BATTLE_SUIT_NAME);

    const data = await getBattleSuitData(page, BATTLE_SUIT_NAME);
    expect(data.powerValue).toBe(0);
  });

  test('battle suit sheet opens with correct tabs', async ({ foundryPage }) => {
    const page = foundryPage;
    await createBattleSuitViaAPI(page, BATTLE_SUIT_NAME);
    const sheet = await openItemSheet(page, BATTLE_SUIT_NAME);

    await expect(sheet.locator('.sheet-tabs a[data-tab="description"]')).toBeVisible();
    await expect(sheet.locator('.sheet-tabs a[data-tab="powers"]')).toBeVisible();
    await expect(sheet.locator('.sheet-tabs a[data-tab="restrictions"]')).toBeVisible();
    await expect(sheet.locator('.sheet-tabs a[data-tab="modifiers"]')).toBeVisible();
    await expect(sheet.locator('.sheet-tabs a[data-tab="details"]')).toBeVisible();
  });

  test('dropping a power onto battle suit adds it', async ({ foundryPage }) => {
    const page = foundryPage;
    await createBattleSuitViaAPI(page, BATTLE_SUIT_NAME);
    await createPowerViaAPI(page, POWER_NAME);

    const sheet = await openItemSheet(page, BATTLE_SUIT_NAME);

    const added = await page.evaluate(async ({ suitName, powerName }) => {
      const suit = game.items.find(i => i.name === suitName);
      const power = game.items.find(i => i.name === powerName);
      if (!suit || !power) throw new Error('Items not found');

      const itemSheet = suit.sheet;
      const dropData = { type: 'Item', uuid: power.uuid };
      const dt = new DataTransfer();
      dt.setData('text/plain', JSON.stringify(dropData));
      const event = new DragEvent('drop', { dataTransfer: dt, bubbles: true });
      await itemSheet._onDrop(event);

      const updated = game.items.find(i => i.name === suitName);
      return updated.system.powers.map(p => p.name);
    }, { suitName: BATTLE_SUIT_NAME, powerName: POWER_NAME });

    expect(added).toContain(POWER_NAME);
  });

  test('dropping a restriction onto battle suit adds it', async ({ foundryPage }) => {
    const page = foundryPage;
    await createBattleSuitViaAPI(page, BATTLE_SUIT_NAME);
    await createRestrictionViaAPI(page, RESTRICTION_NAME, 'obvious');

    const sheet = await openItemSheet(page, BATTLE_SUIT_NAME);

    const added = await page.evaluate(async ({ suitName, restrictionName }) => {
      const suit = game.items.find(i => i.name === suitName);
      const restriction = game.items.find(i => i.name === restrictionName);
      if (!suit || !restriction) throw new Error('Items not found');

      const itemSheet = suit.sheet;
      const dropData = { type: 'Item', uuid: restriction.uuid };
      const dt = new DataTransfer();
      dt.setData('text/plain', JSON.stringify(dropData));
      const event = new DragEvent('drop', { dataTransfer: dt, bubbles: true });
      await itemSheet._onDrop(event);

      const updated = game.items.find(i => i.name === suitName);
      return updated.system.restrictions;
    }, { suitName: BATTLE_SUIT_NAME, restrictionName: RESTRICTION_NAME });

    expect(added).toHaveLength(1);
    expect(added[0].name).toBe(RESTRICTION_NAME);
    expect(added[0].kind).toBe('obvious');
  });

  test('dropping an iconic item onto battle suit integrates it', async ({ foundryPage }) => {
    const page = foundryPage;
    await createBattleSuitViaAPI(page, BATTLE_SUIT_NAME);
    await createIconicItemViaAPI(page, ICONIC_ITEM_NAME);

    const sheet = await openItemSheet(page, BATTLE_SUIT_NAME);

    const added = await page.evaluate(async ({ suitName, iconicName }) => {
      const suit = game.items.find(i => i.name === suitName);
      const iconic = game.items.find(i => i.name === iconicName);
      if (!suit || !iconic) throw new Error('Items not found');

      const itemSheet = suit.sheet;
      const dropData = { type: 'Item', uuid: iconic.uuid };
      const dt = new DataTransfer();
      dt.setData('text/plain', JSON.stringify(dropData));
      const event = new DragEvent('drop', { dataTransfer: dt, bubbles: true });
      await itemSheet._onDrop(event);

      const updated = game.items.find(i => i.name === suitName);
      return updated.system.integratedIconicItems.map(ii => ii.name);
    }, { suitName: BATTLE_SUIT_NAME, iconicName: ICONIC_ITEM_NAME });

    expect(added).toContain(ICONIC_ITEM_NAME);
  });

  test('power value calculates from powers minus restrictions', async ({ foundryPage }) => {
    const page = foundryPage;
    await createBattleSuitViaAPI(page, BATTLE_SUIT_NAME);

    await page.evaluate(async (name) => {
      const item = game.items.find(i => i.name === name);
      await item.update({
        'system.powers': [
          { id: '1', name: 'Power A', img: '' },
          { id: '2', name: 'Power B', img: '' },
          { id: '3', name: 'Power C', img: '' },
        ],
        'system.restrictions': [
          { kind: 'access', name: 'Worn', description: '' },
        ],
      });
    }, BATTLE_SUIT_NAME);
    await page.waitForTimeout(500);

    const data = await getBattleSuitData(page, BATTLE_SUIT_NAME);
    expect(data.powerValue).toBe(2);
  });

  test('power value minimum is 1 when restrictions exceed powers', async ({ foundryPage }) => {
    const page = foundryPage;
    await createBattleSuitViaAPI(page, BATTLE_SUIT_NAME);

    await page.evaluate(async (name) => {
      const item = game.items.find(i => i.name === name);
      await item.update({
        'system.powers': [{ id: '1', name: 'Power A', img: '' }],
        'system.restrictions': [
          { kind: 'access', name: 'Worn', description: '' },
          { kind: 'obvious', name: 'Flashy', description: '' },
          { kind: 'use', name: 'Tech Reliance', description: '' },
        ],
      });
    }, BATTLE_SUIT_NAME);
    await page.waitForTimeout(500);

    const data = await getBattleSuitData(page, BATTLE_SUIT_NAME);
    expect(data.powerValue).toBe(1);
  });

  test('can set ability modifiers and rank increase', async ({ foundryPage }) => {
    const page = foundryPage;
    await createBattleSuitViaAPI(page, BATTLE_SUIT_NAME);

    await page.evaluate(async (name) => {
      const item = game.items.find(i => i.name === name);
      await item.update({
        'system.abilityModifiers.melee': 3,
        'system.abilityModifiers.agility': 2,
        'system.abilityModifiers.resilience': 4,
        'system.abilityModifiers.vigilance': 1,
        'system.abilityModifiers.ego': 0,
        'system.abilityModifiers.logic': 2,
        'system.rankIncrease': 2,
      });
    }, BATTLE_SUIT_NAME);
    await page.waitForTimeout(500);

    const data = await getBattleSuitData(page, BATTLE_SUIT_NAME);
    expect(data.abilityModifiers.melee).toBe(3);
    expect(data.abilityModifiers.agility).toBe(2);
    expect(data.abilityModifiers.resilience).toBe(4);
    expect(data.abilityModifiers.vigilance).toBe(1);
    expect(data.abilityModifiers.ego).toBe(0);
    expect(data.abilityModifiers.logic).toBe(2);
    expect(data.rankIncrease).toBe(2);
  });

  test('can add and remove additional traits', async ({ foundryPage }) => {
    const page = foundryPage;
    await createBattleSuitViaAPI(page, BATTLE_SUIT_NAME);

    await page.evaluate(async (name) => {
      const item = game.items.find(i => i.name === name);
      await item.update({
        'system.additionalTraits': ['Big', 'Presence', 'Fearless'],
      });
    }, BATTLE_SUIT_NAME);
    await page.waitForTimeout(500);

    let data = await getBattleSuitData(page, BATTLE_SUIT_NAME);
    expect(data.additionalTraits).toEqual(['Big', 'Presence', 'Fearless']);

    // Remove middle trait
    await page.evaluate(async (name) => {
      const item = game.items.find(i => i.name === name);
      const traits = [...item.system.additionalTraits];
      traits.splice(1, 1);
      await item.update({ 'system.additionalTraits': traits });
    }, BATTLE_SUIT_NAME);
    await page.waitForTimeout(500);

    data = await getBattleSuitData(page, BATTLE_SUIT_NAME);
    expect(data.additionalTraits).toEqual(['Big', 'Fearless']);
  });

  test('duplicate power drops are rejected', async ({ foundryPage }) => {
    const page = foundryPage;
    await createBattleSuitViaAPI(page, BATTLE_SUIT_NAME);
    await createPowerViaAPI(page, POWER_NAME);

    const sheet = await openItemSheet(page, BATTLE_SUIT_NAME);

    await page.evaluate(async ({ suitName, powerName }) => {
      const suit = game.items.find(i => i.name === suitName);
      const power = game.items.find(i => i.name === powerName);
      const itemSheet = suit.sheet;

      const dropData = { type: 'Item', uuid: power.uuid };
      const dt1 = new DataTransfer();
      dt1.setData('text/plain', JSON.stringify(dropData));
      const event1 = new DragEvent('drop', { dataTransfer: dt1, bubbles: true });
      await itemSheet._onDrop(event1);

      const dt2 = new DataTransfer();
      dt2.setData('text/plain', JSON.stringify(dropData));
      const event2 = new DragEvent('drop', { dataTransfer: dt2, bubbles: true });
      await itemSheet._onDrop(event2);
    }, { suitName: BATTLE_SUIT_NAME, powerName: POWER_NAME });
    await page.waitForTimeout(500);

    const data = await getBattleSuitData(page, BATTLE_SUIT_NAME);
    expect(data.powers).toHaveLength(1);
  });

  test('sheet tabs render correct content', async ({ foundryPage }) => {
    const page = foundryPage;
    await createBattleSuitViaAPI(page, BATTLE_SUIT_NAME);

    // Pre-populate data so we can verify it renders
    await page.evaluate(async (name) => {
      const item = game.items.find(i => i.name === name);
      await item.update({
        'system.powers': [{ id: '1', name: 'Repulsors', img: '' }],
        'system.restrictions': [{ kind: 'access', name: 'Worn', description: 'Must be worn' }],
        'system.abilityModifiers.melee': 3,
        'system.rankIncrease': 2,
        'system.additionalTraits': ['Big', 'Fearless'],
        'system.integratedIconicItems': [{ id: 'x', name: 'Unibeam', img: '' }],
      });
    }, BATTLE_SUIT_NAME);
    await page.waitForTimeout(500);

    const sheet = await openItemSheet(page, BATTLE_SUIT_NAME);

    // Header: origin input and power value
    await expect(sheet.locator('input[name="system.origin"]')).toHaveValue('High-Tech: Battle Suit');
    await expect(sheet.locator('.plain-text')).toContainText('1');

    // Powers tab
    await sheet.locator('.sheet-tabs a[data-tab="powers"]').click();
    await page.waitForTimeout(500);
    await expect(sheet.locator('.mm-battlesuit-powers-drop-zone')).toBeVisible();
    await expect(sheet.locator('.mm-battlesuit-powers-drop-zone')).toContainText('Repulsors');
    await expect(sheet.locator('.mm-battlesuit-iconic-drop-zone')).toBeVisible();
    await expect(sheet.locator('.mm-battlesuit-iconic-drop-zone')).toContainText('Unibeam');

    // Restrictions tab
    await sheet.locator('.sheet-tabs a[data-tab="restrictions"]').click();
    await page.waitForTimeout(500);
    await expect(sheet.locator('.mm-battlesuit-restrictions-drop-zone')).toBeVisible();
    await expect(sheet.locator('.mm-battlesuit-restrictions-drop-zone')).toContainText('Worn');
    await expect(sheet.locator('.battlesuit-restriction-add')).toBeVisible();

    // Modifiers tab
    await sheet.locator('.sheet-tabs a[data-tab="modifiers"]').click();
    await page.waitForTimeout(500);
    await expect(sheet.locator('input[name="system.rankIncrease"]')).toHaveValue('2');
    await expect(sheet.locator('input[name="system.abilityModifiers.melee"]')).toHaveValue('3');
    await expect(sheet.locator('input[name="system.abilityModifiers.agility"]')).toHaveValue('0');
    await expect(sheet.locator('.battlesuit-trait-input')).toBeVisible();
    const modifiersTab = sheet.locator('.tab[data-tab="modifiers"]');
    await expect(modifiersTab).toContainText('Big');
    await expect(modifiersTab).toContainText('Fearless');

    // Details tab
    await sheet.locator('.sheet-tabs a[data-tab="details"]').click();
    await page.waitForTimeout(500);
    const detailsTab = sheet.locator('.tab[data-tab="details"]');
    await expect(detailsTab).toContainText('Tech Reliance');
    await expect(detailsTab).toContainText('Worn');
  });

  test('dropped items render in sheet UI', async ({ foundryPage }) => {
    const page = foundryPage;
    await createBattleSuitViaAPI(page, BATTLE_SUIT_NAME);
    await createPowerViaAPI(page, POWER_NAME);
    await createRestrictionViaAPI(page, RESTRICTION_NAME, 'obvious');
    await createIconicItemViaAPI(page, ICONIC_ITEM_NAME);

    const sheet = await openItemSheet(page, BATTLE_SUIT_NAME);

    // Drop all three item types
    await page.evaluate(async ({ suitName, powerName, restrictionName, iconicName }) => {
      const suit = game.items.find(i => i.name === suitName);
      const power = game.items.find(i => i.name === powerName);
      const restriction = game.items.find(i => i.name === restrictionName);
      const iconic = game.items.find(i => i.name === iconicName);
      const itemSheet = suit.sheet;

      for (const item of [power, restriction, iconic]) {
        const dt = new DataTransfer();
        dt.setData('text/plain', JSON.stringify({ type: 'Item', uuid: item.uuid }));
        const event = new DragEvent('drop', { dataTransfer: dt, bubbles: true });
        await itemSheet._onDrop(event);
      }
    }, { suitName: BATTLE_SUIT_NAME, powerName: POWER_NAME, restrictionName: RESTRICTION_NAME, iconicName: ICONIC_ITEM_NAME });
    await page.waitForTimeout(1000);

    // Re-open sheet to see rendered content
    await page.evaluate(async (name) => {
      const item = game.items.find(i => i.name === name);
      item.sheet.render(true);
    }, BATTLE_SUIT_NAME);
    await page.waitForTimeout(2000);
    const refreshedSheet = page.locator('.sheet.item').last();

    // Verify power appears in Powers tab
    await refreshedSheet.locator('.sheet-tabs a[data-tab="powers"]').click();
    await page.waitForTimeout(500);
    await expect(refreshedSheet.locator('.mm-battlesuit-powers-drop-zone')).toContainText(POWER_NAME);
    await expect(refreshedSheet.locator('.mm-battlesuit-iconic-drop-zone')).toContainText(ICONIC_ITEM_NAME);

    // Verify restriction appears in Restrictions tab
    await refreshedSheet.locator('.sheet-tabs a[data-tab="restrictions"]').click();
    await page.waitForTimeout(500);
    await expect(refreshedSheet.locator('.mm-battlesuit-restrictions-drop-zone')).toContainText(RESTRICTION_NAME);
  });

  test('battle suit appears on character sheet items tab', async ({ foundryPage }) => {
    const page = foundryPage;

    // Create a character and add a battle suit as an owned item
    await createActorViaAPI(page, ACTOR_NAME, 'character');

    await page.evaluate(async ({ actorName, suitName }) => {
      const actor = game.actors.find(a => a.name === actorName);
      if (!actor) throw new Error(`Actor "${actorName}" not found`);
      await actor.createEmbeddedDocuments('Item', [{
        name: suitName,
        type: 'battleSuit',
      }]);
    }, { actorName: ACTOR_NAME, suitName: BATTLE_SUIT_NAME });
    await page.waitForTimeout(500);

    // Open the actor sheet
    await page.evaluate(async (name) => {
      const actor = game.actors.find(a => a.name === name);
      actor.sheet.render(true);
    }, ACTOR_NAME);
    await page.waitForTimeout(2000);
    await dismissNotifications(page);

    const actorSheet = page.locator('.sheet.actor').last();
    await actorSheet.waitFor({ state: 'visible', timeout: 10_000 });

    // Navigate to Gear & Weapons tab
    await actorSheet.locator('.sheet-tabs a[data-tab="gear"]').click();
    await page.waitForTimeout(500);

    // Verify the battle suit name appears under the Battle Suits header
    const itemsTab = actorSheet.locator('.tab[data-tab="gear"]');
    await expect(itemsTab).toContainText('Battle Suits');
    await expect(itemsTab).toContainText(BATTLE_SUIT_NAME);
  });
});
