import { test, expect } from './fixtures.mjs';
import { dismissNotifications } from './helpers.mjs';

const RESTRICTION_NAME = 'E2E Test Restriction';
const ICONIC_ITEM_NAME = 'E2E Test Shield (Restriction)';

async function deleteItem(page, name) {
  await page.evaluate(async (name) => {
    const item = game.items.find(i => i.name === name);
    if (item) await item.delete();
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

async function getIconicItemData(page, name) {
  return page.evaluate((name) => {
    const item = game.items.find(i => i.name === name);
    if (!item) throw new Error(`Item "${name}" not found`);
    return {
      restrictions: item.system.restrictions ?? [],
      powers: item.system.powers ?? [],
      powerValue: item.system.powerValue,
    };
  }, name);
}

test.describe('Restriction Item Type', () => {

  test.afterEach(async ({ foundryPage }) => {
    await deleteItem(foundryPage, RESTRICTION_NAME);
    await deleteItem(foundryPage, ICONIC_ITEM_NAME);
  });

  test('can create a restriction item via API', async ({ foundryPage }) => {
    const page = foundryPage;
    await createRestrictionViaAPI(page, RESTRICTION_NAME, 'obvious');

    const data = await page.evaluate((name) => {
      const item = game.items.find(i => i.name === name);
      if (!item) throw new Error(`Item "${name}" not found`);
      return {
        type: item.type,
        kind: item.system.kind,
        description: item.system.description,
      };
    }, RESTRICTION_NAME);

    expect(data.type).toBe('restriction');
    expect(data.kind).toBe('obvious');
    expect(data.description).toContain('description');
  });

  test('restriction item sheet opens and shows kind selector', async ({ foundryPage }) => {
    const page = foundryPage;
    await createRestrictionViaAPI(page, RESTRICTION_NAME, 'use');
    const sheet = await openItemSheet(page, RESTRICTION_NAME);

    const kindSelect = sheet.locator('select[name="system.kind"]');
    await expect(kindSelect).toBeVisible();
    await expect(kindSelect).toHaveValue('use');
  });

  test('dropping a restriction onto an iconic item adds it', async ({ foundryPage }) => {
    const page = foundryPage;
    await createIconicItemViaAPI(page, ICONIC_ITEM_NAME);
    await createRestrictionViaAPI(page, RESTRICTION_NAME, 'challenging');

    const sheet = await openItemSheet(page, ICONIC_ITEM_NAME);

    await sheet.locator('.sheet-tabs a[data-tab="restrictions"]').click();
    await page.waitForTimeout(500);

    const added = await page.evaluate(async ({ iconicName, restrictionName }) => {
      const iconic = game.items.find(i => i.name === iconicName);
      const restriction = game.items.find(i => i.name === restrictionName);
      if (!iconic || !restriction) throw new Error('Items not found');

      const itemSheet = iconic.sheet;
      if (!itemSheet) throw new Error('Iconic item sheet not rendered');

      const dropData = {
        type: 'Item',
        uuid: restriction.uuid,
      };
      const dt = new DataTransfer();
      dt.setData('text/plain', JSON.stringify(dropData));
      const event = new DragEvent('drop', { dataTransfer: dt, bubbles: true });

      await itemSheet._onDrop(event);

      const updated = game.items.find(i => i.name === iconicName);
      return updated.system.restrictions;
    }, { iconicName: ICONIC_ITEM_NAME, restrictionName: RESTRICTION_NAME });

    expect(added).toHaveLength(1);
    expect(added[0].name).toBe(RESTRICTION_NAME);
    expect(added[0].kind).toBe('challenging');
    expect(added[0].description).toContain('description');
  });

  test('duplicate restriction drops are rejected', async ({ foundryPage }) => {
    const page = foundryPage;
    await createIconicItemViaAPI(page, ICONIC_ITEM_NAME);
    await createRestrictionViaAPI(page, RESTRICTION_NAME);

    const sheet = await openItemSheet(page, ICONIC_ITEM_NAME);

    await page.evaluate(async ({ iconicName, restrictionName }) => {
      const iconic = game.items.find(i => i.name === iconicName);
      const restriction = game.items.find(i => i.name === restrictionName);

      const itemSheet = iconic.sheet;
      const dropData = { type: 'Item', uuid: restriction.uuid };
      const dt = new DataTransfer();
      dt.setData('text/plain', JSON.stringify(dropData));
      const event = new DragEvent('drop', { dataTransfer: dt, bubbles: true });

      // Drop twice
      await itemSheet._onDrop(event);
      const dt2 = new DataTransfer();
      dt2.setData('text/plain', JSON.stringify(dropData));
      const event2 = new DragEvent('drop', { dataTransfer: dt2, bubbles: true });
      await itemSheet._onDrop(event2);
    }, { iconicName: ICONIC_ITEM_NAME, restrictionName: RESTRICTION_NAME });
    await page.waitForTimeout(500);

    const data = await getIconicItemData(page, ICONIC_ITEM_NAME);
    expect(data.restrictions).toHaveLength(1);
  });

  test('power value updates when restriction is dropped', async ({ foundryPage }) => {
    const page = foundryPage;
    await createIconicItemViaAPI(page, ICONIC_ITEM_NAME);

    // Add 2 powers first
    await page.evaluate(async (name) => {
      const item = game.items.find(i => i.name === name);
      await item.update({
        'system.powers': [
          { id: '1', name: 'Power A', img: '' },
          { id: '2', name: 'Power B', img: '' },
        ],
      });
    }, ICONIC_ITEM_NAME);
    await page.waitForTimeout(500);

    let data = await getIconicItemData(page, ICONIC_ITEM_NAME);
    expect(data.powerValue).toBe(2);

    // Drop a restriction
    await createRestrictionViaAPI(page, RESTRICTION_NAME, 'access');
    const sheet = await openItemSheet(page, ICONIC_ITEM_NAME);

    await page.evaluate(async ({ iconicName, restrictionName }) => {
      const iconic = game.items.find(i => i.name === iconicName);
      const restriction = game.items.find(i => i.name === restrictionName);
      const itemSheet = iconic.sheet;
      const dropData = { type: 'Item', uuid: restriction.uuid };
      const dt = new DataTransfer();
      dt.setData('text/plain', JSON.stringify(dropData));
      const event = new DragEvent('drop', { dataTransfer: dt, bubbles: true });
      await itemSheet._onDrop(event);
    }, { iconicName: ICONIC_ITEM_NAME, restrictionName: RESTRICTION_NAME });
    await page.waitForTimeout(500);

    data = await getIconicItemData(page, ICONIC_ITEM_NAME);
    expect(data.restrictions).toHaveLength(1);
    // PV = max(1, 2 powers - 1 restriction) = 1
    expect(data.powerValue).toBe(1);
  });

  test('manual and dropped restrictions coexist', async ({ foundryPage }) => {
    const page = foundryPage;
    await createIconicItemViaAPI(page, ICONIC_ITEM_NAME);
    await createRestrictionViaAPI(page, RESTRICTION_NAME, 'obvious');

    // Add a manual restriction first
    await page.evaluate(async (name) => {
      const item = game.items.find(i => i.name === name);
      await item.update({
        'system.restrictions': [
          { kind: 'access', name: 'Carried', description: 'Must be carried' },
        ],
      });
    }, ICONIC_ITEM_NAME);
    await page.waitForTimeout(500);

    // Drop a restriction
    const sheet = await openItemSheet(page, ICONIC_ITEM_NAME);
    await page.evaluate(async ({ iconicName, restrictionName }) => {
      const iconic = game.items.find(i => i.name === iconicName);
      const restriction = game.items.find(i => i.name === restrictionName);
      const itemSheet = iconic.sheet;
      const dropData = { type: 'Item', uuid: restriction.uuid };
      const dt = new DataTransfer();
      dt.setData('text/plain', JSON.stringify(dropData));
      const event = new DragEvent('drop', { dataTransfer: dt, bubbles: true });
      await itemSheet._onDrop(event);
    }, { iconicName: ICONIC_ITEM_NAME, restrictionName: RESTRICTION_NAME });
    await page.waitForTimeout(500);

    const data = await getIconicItemData(page, ICONIC_ITEM_NAME);
    expect(data.restrictions).toHaveLength(2);
    expect(data.restrictions[0].name).toBe('Carried');
    expect(data.restrictions[1].name).toBe(RESTRICTION_NAME);
  });
});
