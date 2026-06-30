import { test, expect } from './fixtures.mjs';
import { dismissNotifications } from './helpers.mjs';

const ICONIC_ITEM_NAME = 'E2E Test Shield';
const POWER_NAME = 'E2E Test Power';

async function deleteItem(page, name) {
  await page.evaluate(async (name) => {
    const item = game.items.find(i => i.name === name);
    if (item) await item.delete();
  }, name);
  await page.waitForTimeout(500);
}

async function createIconicItemViaAPI(page, name) {
  await page.evaluate(async (name) => {
    await Item.create({ name, type: 'iconicItem' });
  }, name);
  await page.waitForTimeout(500);
}

async function createPowerViaAPI(page, name) {
  await page.evaluate(async (name) => {
    await Item.create({
      name,
      type: 'power',
      system: { powerSet: 'Iconic Items' },
    });
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

async function getIconicItemData(page, name) {
  return page.evaluate((name) => {
    const item = game.items.find(i => i.name === name);
    if (!item) throw new Error(`Item "${name}" not found`);
    return {
      type: item.type,
      origin: item.system.origin,
      ownershipMode: item.system.ownershipMode,
      restrictions: item.system.restrictions ?? [],
      powers: item.system.powers ?? [],
      isIntelligent: item.system.isIntelligent,
      specialEffectType: item.system.specialEffectType,
      weaponData: {
        isWeapon: item.system.weaponData?.isWeapon ?? false,
      },
    };
  }, name);
}

test.describe('Iconic Item Type', () => {

  test.afterEach(async ({ foundryPage }) => {
    await deleteItem(foundryPage, ICONIC_ITEM_NAME);
    await deleteItem(foundryPage, POWER_NAME);
  });

  test('can create an iconic item via API', async ({ foundryPage }) => {
    const page = foundryPage;
    await createIconicItemViaAPI(page, ICONIC_ITEM_NAME);

    const data = await getIconicItemData(page, ICONIC_ITEM_NAME);
    expect(data.type).toBe('iconicItem');
    expect(data.ownershipMode).toBe('owned');
    expect(data.powers).toEqual([]);
    expect(data.restrictions).toEqual([]);
    expect(data.isIntelligent).toBe(false);
    expect(data.weaponData.isWeapon).toBe(false);
  });

  test('power value is 0 with no powers or restrictions', async ({ foundryPage }) => {
    const page = foundryPage;
    await createIconicItemViaAPI(page, ICONIC_ITEM_NAME);

    const pv = await page.evaluate((name) => {
      const item = game.items.find(i => i.name === name);
      return item.system.powerValue;
    }, ICONIC_ITEM_NAME);
    expect(pv).toBe(0);
  });

  test('iconic item sheet opens with correct tabs', async ({ foundryPage }) => {
    const page = foundryPage;
    await createIconicItemViaAPI(page, ICONIC_ITEM_NAME);
    const sheet = await openItemSheet(page, ICONIC_ITEM_NAME);

    await expect(sheet.locator('.sheet-tabs a[data-tab="description"]')).toBeVisible();
    await expect(sheet.locator('.sheet-tabs a[data-tab="powers"]')).toBeVisible();
    await expect(sheet.locator('.sheet-tabs a[data-tab="restrictions"]')).toBeVisible();
    await expect(sheet.locator('.sheet-tabs a[data-tab="details"]')).toBeVisible();
  });

  test('can add a power to an iconic item via API', async ({ foundryPage }) => {
    const page = foundryPage;
    await createIconicItemViaAPI(page, ICONIC_ITEM_NAME);
    await createPowerViaAPI(page, POWER_NAME);

    await page.evaluate(async ({ iconicName, powerName }) => {
      const iconic = game.items.find(i => i.name === iconicName);
      const power = game.items.find(i => i.name === powerName);
      if (!iconic || !power) throw new Error('Items not found');
      const powers = [...iconic.system.powers];
      powers.push({ id: power.id, name: power.name, img: power.img });
      await iconic.update({ 'system.powers': powers });
    }, { iconicName: ICONIC_ITEM_NAME, powerName: POWER_NAME });
    await page.waitForTimeout(500);

    const data = await getIconicItemData(page, ICONIC_ITEM_NAME);
    expect(data.powers).toHaveLength(1);
    expect(data.powers[0].name).toBe(POWER_NAME);
  });

  test('power value calculates from powers minus restrictions', async ({ foundryPage }) => {
    const page = foundryPage;
    await createIconicItemViaAPI(page, ICONIC_ITEM_NAME);

    // Add 3 powers and 1 restriction: PV = max(1, 3-1) = 2
    await page.evaluate(async (name) => {
      const item = game.items.find(i => i.name === name);
      await item.update({
        'system.powers': [
          { id: '1', name: 'Power A', img: '' },
          { id: '2', name: 'Power B', img: '' },
          { id: '3', name: 'Power C', img: '' },
        ],
        'system.restrictions': [
          { kind: 'access', name: 'Carried', description: '' },
        ],
      });
    }, ICONIC_ITEM_NAME);
    await page.waitForTimeout(500);

    const pv = await page.evaluate((name) => {
      const item = game.items.find(i => i.name === name);
      return item.system.powerValue;
    }, ICONIC_ITEM_NAME);
    expect(pv).toBe(2);
  });

  test('power value minimum is 1 when restrictions exceed powers', async ({ foundryPage }) => {
    const page = foundryPage;
    await createIconicItemViaAPI(page, ICONIC_ITEM_NAME);

    await page.evaluate(async (name) => {
      const item = game.items.find(i => i.name === name);
      await item.update({
        'system.powers': [{ id: '1', name: 'Power A', img: '' }],
        'system.restrictions': [
          { kind: 'access', name: 'R1', description: '' },
          { kind: 'obvious', name: 'R2', description: '' },
          { kind: 'use', name: 'R3', description: '' },
        ],
      });
    }, ICONIC_ITEM_NAME);
    await page.waitForTimeout(500);

    const pv = await page.evaluate((name) => {
      const item = game.items.find(i => i.name === name);
      return item.system.powerValue;
    }, ICONIC_ITEM_NAME);
    expect(pv).toBe(1);
  });

  test('dropping a power onto iconic item sheet adds it', async ({ foundryPage }) => {
    const page = foundryPage;
    await createIconicItemViaAPI(page, ICONIC_ITEM_NAME);
    await createPowerViaAPI(page, POWER_NAME);

    const sheet = await openItemSheet(page, ICONIC_ITEM_NAME);

    // Navigate to Powers tab
    await sheet.locator('.sheet-tabs a[data-tab="powers"]').click();
    await page.waitForTimeout(500);

    // Simulate drop via the item sheet's _onDrop (the way FoundryVTT fires it)
    const added = await page.evaluate(async ({ iconicName, powerName }) => {
      const iconic = game.items.find(i => i.name === iconicName);
      const power = game.items.find(i => i.name === powerName);
      if (!iconic || !power) throw new Error('Items not found');

      const itemSheet = iconic.sheet;
      if (!itemSheet) throw new Error('Iconic item sheet not rendered');

      // Build drop data the way FoundryVTT does
      const dropData = {
        type: 'Item',
        uuid: power.uuid,
      };

      // Create a synthetic drop event
      const dt = new DataTransfer();
      dt.setData('text/plain', JSON.stringify(dropData));
      const event = new DragEvent('drop', { dataTransfer: dt, bubbles: true });

      // Call the sheet's _onDrop handler directly
      await itemSheet._onDrop(event);

      // Check if the power was added
      const updated = game.items.find(i => i.name === iconicName);
      return updated.system.powers.map(p => p.name);
    }, { iconicName: ICONIC_ITEM_NAME, powerName: POWER_NAME });

    expect(added).toContain(POWER_NAME);
  });

  test('can add and remove restrictions', async ({ foundryPage }) => {
    const page = foundryPage;
    await createIconicItemViaAPI(page, ICONIC_ITEM_NAME);

    // Add restrictions via API
    await page.evaluate(async (name) => {
      const item = game.items.find(i => i.name === name);
      await item.update({
        'system.restrictions': [
          { kind: 'access', name: 'Carried', description: 'Must be carried' },
          { kind: 'obvious', name: 'Flashy', description: 'Very obvious' },
        ],
      });
    }, ICONIC_ITEM_NAME);
    await page.waitForTimeout(500);

    let data = await getIconicItemData(page, ICONIC_ITEM_NAME);
    expect(data.restrictions).toHaveLength(2);
    expect(data.restrictions[0].kind).toBe('access');
    expect(data.restrictions[1].kind).toBe('obvious');

    // Remove first restriction
    await page.evaluate(async (name) => {
      const item = game.items.find(i => i.name === name);
      const restrictions = [...item.system.restrictions];
      restrictions.splice(0, 1);
      await item.update({ 'system.restrictions': restrictions });
    }, ICONIC_ITEM_NAME);
    await page.waitForTimeout(500);

    data = await getIconicItemData(page, ICONIC_ITEM_NAME);
    expect(data.restrictions).toHaveLength(1);
    expect(data.restrictions[0].kind).toBe('obvious');
  });

  test('can set weapon data fields', async ({ foundryPage }) => {
    const page = foundryPage;
    await createIconicItemViaAPI(page, ICONIC_ITEM_NAME);

    await page.evaluate(async (name) => {
      const item = game.items.find(i => i.name === name);
      await item.update({
        'system.weaponData.isWeapon': true,
        'system.weaponData.meleeRange': 'Reach',
        'system.weaponData.rangedRange': '10',
        'system.weaponData.meleeDamageMultiplierBonus': 2,
        'system.weaponData.rangedDamageMultiplierBonus': 0,
      });
    }, ICONIC_ITEM_NAME);
    await page.waitForTimeout(500);

    const data = await page.evaluate((name) => {
      const item = game.items.find(i => i.name === name);
      return item.system.weaponData;
    }, ICONIC_ITEM_NAME);

    expect(data.isWeapon).toBe(true);
    expect(data.meleeRange).toBe('Reach');
    expect(data.rangedRange).toBe('10');
    expect(data.meleeDamageMultiplierBonus).toBe(2);
  });
});
