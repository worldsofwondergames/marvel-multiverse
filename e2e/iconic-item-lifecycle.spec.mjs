import { test, expect } from './fixtures.mjs';
import { dismissNotifications } from './helpers.mjs';

const ITEM_NAME = 'E2E Lifecycle Shield';
const POWER_PREFIX = 'E2E Power';
const RESTRICTION_PREFIX = 'E2E Restriction';

async function deleteItem(page, name) {
  await page.evaluate(async (name) => {
    const item = game.items.find(i => i.name === name);
    if (item) await item.delete();
  }, name);
  await page.waitForTimeout(500);
}

async function deleteItemsByPrefix(page, prefix) {
  await page.evaluate(async (prefix) => {
    const items = game.items.filter(i => i.name.startsWith(prefix));
    for (const item of items) await item.delete();
  }, prefix);
  await page.waitForTimeout(500);
}

async function createIconicItem(page, name) {
  await page.evaluate(async (name) => {
    await Item.create({ name, type: 'iconicItem' });
  }, name);
  await page.waitForTimeout(500);
}

async function createPower(page, name) {
  await page.evaluate(async (name) => {
    await Item.create({
      name,
      type: 'power',
      system: { powerSet: 'Iconic Items' },
    });
  }, name);
  await page.waitForTimeout(500);
}

async function createRestriction(page, name, kind = 'access') {
  await page.evaluate(async ({ name, kind }) => {
    await Item.create({
      name,
      type: 'restriction',
      system: { kind, description: `${name} description` },
    });
  }, { name, kind });
  await page.waitForTimeout(500);
}

async function openSheet(page, name) {
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

async function closeAllSheets(page) {
  await page.evaluate(() => {
    Object.values(ui.windows).forEach(w => w.close());
  });
  await page.waitForTimeout(500);
}

async function getItemData(page, name) {
  return page.evaluate((name) => {
    const item = game.items.find(i => i.name === name);
    if (!item) throw new Error(`Item "${name}" not found`);
    return {
      powers: item.system.powers ?? [],
      restrictions: item.system.restrictions ?? [],
      powerValue: item.system.powerValue,
    };
  }, name);
}

async function addPowerViaAPI(page, iconicName, powerRef) {
  await page.evaluate(async ({ iconicName, powerRef }) => {
    const item = game.items.find(i => i.name === iconicName);
    const powers = [...item.system.powers];
    powers.push(powerRef);
    await item.update({ 'system.powers': powers });
  }, { iconicName, powerRef });
  await page.waitForTimeout(500);
}

async function addRestrictionViaAPI(page, iconicName, restriction) {
  await page.evaluate(async ({ iconicName, restriction }) => {
    const item = game.items.find(i => i.name === iconicName);
    const restrictions = [...item.system.restrictions];
    restrictions.push(restriction);
    await item.update({ 'system.restrictions': restrictions });
  }, { iconicName, restriction });
  await page.waitForTimeout(500);
}

async function dropItemOnSheet(page, iconicName, droppedItemName) {
  return page.evaluate(async ({ iconicName, droppedItemName }) => {
    const iconic = game.items.find(i => i.name === iconicName);
    const dropped = game.items.find(i => i.name === droppedItemName);
    if (!iconic || !dropped) throw new Error('Items not found');

    const itemSheet = iconic.sheet;
    if (!itemSheet) throw new Error('Sheet not rendered');

    const dropData = { type: 'Item', uuid: dropped.uuid };
    const dt = new DataTransfer();
    dt.setData('text/plain', JSON.stringify(dropData));
    const event = new DragEvent('drop', { dataTransfer: dt, bubbles: true });
    await itemSheet._onDrop(event);

    const updated = game.items.find(i => i.name === iconicName);
    return {
      powers: updated.system.powers ?? [],
      restrictions: updated.system.restrictions ?? [],
      powerValue: updated.system.powerValue,
    };
  }, { iconicName, droppedItemName });
}

async function getLastNotification(page) {
  return page.evaluate(() => {
    const el = document.querySelector('#notifications li.notification:last-child');
    return el ? el.textContent.trim() : null;
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe('Iconic Item Lifecycle', () => {

  test.afterEach(async ({ foundryPage }) => {
    await closeAllSheets(foundryPage);
    await deleteItem(foundryPage, ITEM_NAME);
    await deleteItemsByPrefix(foundryPage, POWER_PREFIX);
    await deleteItemsByPrefix(foundryPage, RESTRICTION_PREFIX);
  });

  // ── Build & Power Value ──────────────────────────────────────────────

  test('newly created iconic item has power value 0', async ({ foundryPage }) => {
    const page = foundryPage;
    await createIconicItem(page, ITEM_NAME);

    const data = await getItemData(page, ITEM_NAME);
    expect(data.powers).toHaveLength(0);
    expect(data.restrictions).toHaveLength(0);
    expect(data.powerValue).toBe(0);
  });

  test('adding first power sets power value to 1', async ({ foundryPage }) => {
    const page = foundryPage;
    await createIconicItem(page, ITEM_NAME);
    await addPowerViaAPI(page, ITEM_NAME, { id: 'p1', name: `${POWER_PREFIX} A`, img: '' });

    const data = await getItemData(page, ITEM_NAME);
    expect(data.powers).toHaveLength(1);
    expect(data.powerValue).toBe(1);
  });

  test('power value tracks added and removed powers', async ({ foundryPage }) => {
    const page = foundryPage;
    await createIconicItem(page, ITEM_NAME);

    await addPowerViaAPI(page, ITEM_NAME, { id: 'p1', name: `${POWER_PREFIX} A`, img: '' });
    expect((await getItemData(page, ITEM_NAME)).powerValue).toBe(1);

    await addPowerViaAPI(page, ITEM_NAME, { id: 'p2', name: `${POWER_PREFIX} B`, img: '' });
    expect((await getItemData(page, ITEM_NAME)).powerValue).toBe(2);

    await addPowerViaAPI(page, ITEM_NAME, { id: 'p3', name: `${POWER_PREFIX} C`, img: '' });
    expect((await getItemData(page, ITEM_NAME)).powerValue).toBe(3);

    // Remove middle power → PV = 2
    await page.evaluate(async (name) => {
      const item = game.items.find(i => i.name === name);
      const powers = [...item.system.powers];
      powers.splice(1, 1);
      await item.update({ 'system.powers': powers });
    }, ITEM_NAME);
    await page.waitForTimeout(500);

    const data = await getItemData(page, ITEM_NAME);
    expect(data.powers).toHaveLength(2);
    expect(data.powerValue).toBe(2);
  });

  test('adding restriction reduces power value', async ({ foundryPage }) => {
    const page = foundryPage;
    await createIconicItem(page, ITEM_NAME);

    // 3 powers, PV = 3
    await page.evaluate(async (name) => {
      const item = game.items.find(i => i.name === name);
      await item.update({
        'system.powers': [
          { id: 'p1', name: 'A', img: '' },
          { id: 'p2', name: 'B', img: '' },
          { id: 'p3', name: 'C', img: '' },
        ],
      });
    }, ITEM_NAME);
    await page.waitForTimeout(500);
    expect((await getItemData(page, ITEM_NAME)).powerValue).toBe(3);

    // Add 1 restriction → PV = max(1, 3-1) = 2
    await addRestrictionViaAPI(page, ITEM_NAME, { kind: 'access', name: 'R1', description: '' });
    expect((await getItemData(page, ITEM_NAME)).powerValue).toBe(2);

    // Add 2nd restriction → PV = max(1, 3-2) = 1
    await addRestrictionViaAPI(page, ITEM_NAME, { kind: 'obvious', name: 'R2', description: '' });
    expect((await getItemData(page, ITEM_NAME)).powerValue).toBe(1);
  });

  test('removing restriction increases power value', async ({ foundryPage }) => {
    const page = foundryPage;
    await createIconicItem(page, ITEM_NAME);

    await page.evaluate(async (name) => {
      const item = game.items.find(i => i.name === name);
      await item.update({
        'system.powers': [
          { id: 'p1', name: 'A', img: '' },
          { id: 'p2', name: 'B', img: '' },
          { id: 'p3', name: 'C', img: '' },
        ],
        'system.restrictions': [
          { kind: 'access', name: 'R1', description: '' },
          { kind: 'obvious', name: 'R2', description: '' },
        ],
      });
    }, ITEM_NAME);
    await page.waitForTimeout(500);
    expect((await getItemData(page, ITEM_NAME)).powerValue).toBe(1);

    // Remove one restriction → PV = max(1, 3-1) = 2
    await page.evaluate(async (name) => {
      const item = game.items.find(i => i.name === name);
      const restrictions = [...item.system.restrictions];
      restrictions.splice(0, 1);
      await item.update({ 'system.restrictions': restrictions });
    }, ITEM_NAME);
    await page.waitForTimeout(500);

    const data = await getItemData(page, ITEM_NAME);
    expect(data.restrictions).toHaveLength(1);
    expect(data.powerValue).toBe(2);
  });

  test('power value minimum is 1 even when restrictions exceed powers', async ({ foundryPage }) => {
    const page = foundryPage;
    await createIconicItem(page, ITEM_NAME);

    await page.evaluate(async (name) => {
      const item = game.items.find(i => i.name === name);
      await item.update({
        'system.powers': [{ id: 'p1', name: 'A', img: '' }],
        'system.restrictions': [
          { kind: 'access', name: 'R1', description: '' },
          { kind: 'obvious', name: 'R2', description: '' },
          { kind: 'use', name: 'R3', description: '' },
        ],
      });
    }, ITEM_NAME);
    await page.waitForTimeout(500);

    expect((await getItemData(page, ITEM_NAME)).powerValue).toBe(1);
  });

  test('power value is 1 when only restrictions exist', async ({ foundryPage }) => {
    const page = foundryPage;
    await createIconicItem(page, ITEM_NAME);

    await addRestrictionViaAPI(page, ITEM_NAME, { kind: 'access', name: 'R1', description: '' });

    const data = await getItemData(page, ITEM_NAME);
    expect(data.powers).toHaveLength(0);
    expect(data.restrictions).toHaveLength(1);
    expect(data.powerValue).toBe(1);
  });

  // ── Drop Powers onto Sheet ───────────────────────────────────────────

  test('dropping a power onto the sheet adds it and updates power value', async ({ foundryPage }) => {
    const page = foundryPage;
    await createIconicItem(page, ITEM_NAME);
    await createPower(page, `${POWER_PREFIX} Drop1`);
    await createPower(page, `${POWER_PREFIX} Drop2`);

    await openSheet(page, ITEM_NAME);

    let result = await dropItemOnSheet(page, ITEM_NAME, `${POWER_PREFIX} Drop1`);
    expect(result.powers).toHaveLength(1);
    expect(result.powerValue).toBe(1);

    await page.waitForTimeout(500);
    result = await dropItemOnSheet(page, ITEM_NAME, `${POWER_PREFIX} Drop2`);
    expect(result.powers).toHaveLength(2);
    expect(result.powerValue).toBe(2);
  });

  test('dropping duplicate power is rejected', async ({ foundryPage }) => {
    const page = foundryPage;
    await createIconicItem(page, ITEM_NAME);
    await createPower(page, `${POWER_PREFIX} Dup`);

    await openSheet(page, ITEM_NAME);

    await dropItemOnSheet(page, ITEM_NAME, `${POWER_PREFIX} Dup`);
    await page.waitForTimeout(500);
    await dropItemOnSheet(page, ITEM_NAME, `${POWER_PREFIX} Dup`);
    await page.waitForTimeout(500);

    const data = await getItemData(page, ITEM_NAME);
    expect(data.powers).toHaveLength(1);
  });

  test('removing a power from the sheet via API updates power value', async ({ foundryPage }) => {
    const page = foundryPage;
    await createIconicItem(page, ITEM_NAME);

    await page.evaluate(async (name) => {
      const item = game.items.find(i => i.name === name);
      await item.update({
        'system.powers': [
          { id: 'p1', name: 'A', img: '' },
          { id: 'p2', name: 'B', img: '' },
        ],
      });
    }, ITEM_NAME);
    await page.waitForTimeout(500);
    expect((await getItemData(page, ITEM_NAME)).powerValue).toBe(2);

    // Remove via clicking (simulated via API since button click needs index)
    await page.evaluate(async (name) => {
      const item = game.items.find(i => i.name === name);
      const powers = [...item.system.powers];
      powers.splice(0, 1);
      await item.update({ 'system.powers': powers });
    }, ITEM_NAME);
    await page.waitForTimeout(500);

    const data = await getItemData(page, ITEM_NAME);
    expect(data.powers).toHaveLength(1);
    expect(data.powerValue).toBe(1);
  });

  // ── Restriction Rules Enforcement ────────────────────────────────────

  test('max 3 restrictions enforced on drop', async ({ foundryPage }) => {
    const page = foundryPage;
    await createIconicItem(page, ITEM_NAME);

    // Pre-populate with 3 restrictions via API
    await page.evaluate(async (name) => {
      const item = game.items.find(i => i.name === name);
      await item.update({
        'system.restrictions': [
          { kind: 'access', name: 'R1', description: '' },
          { kind: 'obvious', name: 'R2', description: '' },
          { kind: 'use', name: 'R3', description: '' },
        ],
      });
    }, ITEM_NAME);
    await page.waitForTimeout(500);

    // Create a 4th restriction and try to drop it
    await createRestriction(page, `${RESTRICTION_PREFIX} Fourth`, 'challenging');
    await openSheet(page, ITEM_NAME);

    const result = await dropItemOnSheet(page, ITEM_NAME, `${RESTRICTION_PREFIX} Fourth`);
    expect(result.restrictions).toHaveLength(3);
  });

  test('max 3 restrictions enforced on manual add button', async ({ foundryPage }) => {
    const page = foundryPage;
    await createIconicItem(page, ITEM_NAME);

    // Pre-populate 3 restrictions
    await page.evaluate(async (name) => {
      const item = game.items.find(i => i.name === name);
      await item.update({
        'system.restrictions': [
          { kind: 'access', name: 'R1', description: '' },
          { kind: 'obvious', name: 'R2', description: '' },
          { kind: 'use', name: 'R3', description: '' },
        ],
      });
    }, ITEM_NAME);
    await page.waitForTimeout(500);

    const sheet = await openSheet(page, ITEM_NAME);
    await sheet.locator('.sheet-tabs a[data-tab="restrictions"]').click();
    await page.waitForTimeout(500);

    // Click the add button
    const addBtn = sheet.locator('.iconic-restriction-add');
    if (await addBtn.count() > 0) {
      await addBtn.click();
      await page.waitForTimeout(500);
    }

    const data = await getItemData(page, ITEM_NAME);
    expect(data.restrictions).toHaveLength(3);
  });

  test('one-per-kind enforced on drop: duplicate access rejected', async ({ foundryPage }) => {
    const page = foundryPage;
    await createIconicItem(page, ITEM_NAME);

    // Add an access restriction
    await addRestrictionViaAPI(page, ITEM_NAME, { kind: 'access', name: 'Carried', description: 'Must carry' });

    // Drop another access restriction
    await createRestriction(page, `${RESTRICTION_PREFIX} Access2`, 'access');
    await openSheet(page, ITEM_NAME);

    const result = await dropItemOnSheet(page, ITEM_NAME, `${RESTRICTION_PREFIX} Access2`);
    expect(result.restrictions).toHaveLength(1);
    expect(result.restrictions[0].name).toBe('Carried');
  });

  test('one-per-kind enforced on drop: duplicate challenging rejected', async ({ foundryPage }) => {
    const page = foundryPage;
    await createIconicItem(page, ITEM_NAME);

    await addRestrictionViaAPI(page, ITEM_NAME, { kind: 'challenging', name: 'Berserker', description: '' });

    await createRestriction(page, `${RESTRICTION_PREFIX} Challenging2`, 'challenging');
    await openSheet(page, ITEM_NAME);

    const result = await dropItemOnSheet(page, ITEM_NAME, `${RESTRICTION_PREFIX} Challenging2`);
    expect(result.restrictions).toHaveLength(1);
  });

  test('one-per-kind enforced on drop: duplicate unattached rejected', async ({ foundryPage }) => {
    const page = foundryPage;
    await createIconicItem(page, ITEM_NAME);

    await addRestrictionViaAPI(page, ITEM_NAME, { kind: 'unattached', name: 'Worn', description: '' });

    await createRestriction(page, `${RESTRICTION_PREFIX} Unattached2`, 'unattached');
    await openSheet(page, ITEM_NAME);

    const result = await dropItemOnSheet(page, ITEM_NAME, `${RESTRICTION_PREFIX} Unattached2`);
    expect(result.restrictions).toHaveLength(1);
  });

  test('one-per-kind enforced on drop: duplicate use rejected', async ({ foundryPage }) => {
    const page = foundryPage;
    await createIconicItem(page, ITEM_NAME);

    await addRestrictionViaAPI(page, ITEM_NAME, { kind: 'use', name: 'Once per hour', description: '' });

    await createRestriction(page, `${RESTRICTION_PREFIX} Use2`, 'use');
    await openSheet(page, ITEM_NAME);

    const result = await dropItemOnSheet(page, ITEM_NAME, `${RESTRICTION_PREFIX} Use2`);
    expect(result.restrictions).toHaveLength(1);
  });

  test('obvious restrictions can appear multiple times', async ({ foundryPage }) => {
    const page = foundryPage;
    await createIconicItem(page, ITEM_NAME);

    await addRestrictionViaAPI(page, ITEM_NAME, { kind: 'obvious', name: 'Flashy', description: '' });

    await createRestriction(page, `${RESTRICTION_PREFIX} Obvious2`, 'obvious');
    await openSheet(page, ITEM_NAME);

    const result = await dropItemOnSheet(page, ITEM_NAME, `${RESTRICTION_PREFIX} Obvious2`);
    expect(result.restrictions).toHaveLength(2);
    expect(result.restrictions[0].kind).toBe('obvious');
    expect(result.restrictions[1].kind).toBe('obvious');
  });

  test('duplicate restriction name rejected on drop', async ({ foundryPage }) => {
    const page = foundryPage;
    await createIconicItem(page, ITEM_NAME);

    await createRestriction(page, `${RESTRICTION_PREFIX} SameName`, 'access');
    await openSheet(page, ITEM_NAME);

    await dropItemOnSheet(page, ITEM_NAME, `${RESTRICTION_PREFIX} SameName`);
    await page.waitForTimeout(500);

    // Drop same-named restriction again
    await dropItemOnSheet(page, ITEM_NAME, `${RESTRICTION_PREFIX} SameName`);
    await page.waitForTimeout(500);

    const data = await getItemData(page, ITEM_NAME);
    expect(data.restrictions).toHaveLength(1);
  });

  // ── Drop Restrictions & Power Value Integration ──────────────────────

  test('dropping restriction onto item with powers updates power value correctly', async ({ foundryPage }) => {
    const page = foundryPage;
    await createIconicItem(page, ITEM_NAME);

    // Add 4 powers
    await page.evaluate(async (name) => {
      const item = game.items.find(i => i.name === name);
      await item.update({
        'system.powers': [
          { id: 'p1', name: 'Shield 1', img: '' },
          { id: 'p2', name: 'Stackable', img: '' },
          { id: 'p3', name: 'Reduced Focus', img: '' },
          { id: 'p4', name: 'Weapon', img: '' },
        ],
      });
    }, ITEM_NAME);
    await page.waitForTimeout(500);
    expect((await getItemData(page, ITEM_NAME)).powerValue).toBe(4);

    // Drop restrictions one at a time, verifying PV after each
    await createRestriction(page, `${RESTRICTION_PREFIX} Carried`, 'unattached');
    await openSheet(page, ITEM_NAME);

    let result = await dropItemOnSheet(page, ITEM_NAME, `${RESTRICTION_PREFIX} Carried`);
    expect(result.powerValue).toBe(3); // 4-1

    await createRestriction(page, `${RESTRICTION_PREFIX} Flashy`, 'obvious');
    await page.waitForTimeout(500);
    result = await dropItemOnSheet(page, ITEM_NAME, `${RESTRICTION_PREFIX} Flashy`);
    expect(result.powerValue).toBe(2); // 4-2

    await createRestriction(page, `${RESTRICTION_PREFIX} PowerReq`, 'access');
    await page.waitForTimeout(500);
    result = await dropItemOnSheet(page, ITEM_NAME, `${RESTRICTION_PREFIX} PowerReq`);
    expect(result.powerValue).toBe(1); // max(1, 4-3)
  });

  // ── Full Captain America's Shield Scenario ───────────────────────────

  test('captain america shield scenario: 4 powers, 3 restrictions, PV = 1', async ({ foundryPage }) => {
    const page = foundryPage;
    await createIconicItem(page, ITEM_NAME);

    // Build the full shield
    await page.evaluate(async (name) => {
      const item = game.items.find(i => i.name === name);
      await item.update({
        'system.ownershipMode': 'owned',
        'system.powers': [
          { id: 'p1', name: 'Reduced Focus', img: '' },
          { id: 'p2', name: 'Shield 1', img: '' },
          { id: 'p3', name: 'Stackable', img: '' },
          { id: 'p4', name: 'Weapon', img: '' },
        ],
        'system.restrictions': [
          { kind: 'unattached', name: 'Carried', description: 'Must be carried' },
          { kind: 'obvious', name: 'Flashy', description: 'Gives trouble when sneaking' },
          { kind: 'access', name: 'Requires Shield 1', description: 'Must have Shield 1 power' },
        ],
        'system.weaponData.isWeapon': true,
      });
    }, ITEM_NAME);
    await page.waitForTimeout(500);

    const data = await getItemData(page, ITEM_NAME);
    expect(data.powers).toHaveLength(4);
    expect(data.restrictions).toHaveLength(3);
    expect(data.powerValue).toBe(1); // max(1, 4-3) = 1
  });

  // ── Mixed Add/Remove Lifecycle ───────────────────────────────────────

  test('full lifecycle: add powers, add restrictions, remove some, verify at each step', async ({ foundryPage }) => {
    const page = foundryPage;
    await createIconicItem(page, ITEM_NAME);

    // Step 1: empty, PV = 0
    expect((await getItemData(page, ITEM_NAME)).powerValue).toBe(0);

    // Step 2: add 1 power, PV = 1
    await addPowerViaAPI(page, ITEM_NAME, { id: 'p1', name: 'Power Alpha', img: '' });
    expect((await getItemData(page, ITEM_NAME)).powerValue).toBe(1);

    // Step 3: add 2nd power, PV = 2
    await addPowerViaAPI(page, ITEM_NAME, { id: 'p2', name: 'Power Beta', img: '' });
    expect((await getItemData(page, ITEM_NAME)).powerValue).toBe(2);

    // Step 4: add 3rd power, PV = 3
    await addPowerViaAPI(page, ITEM_NAME, { id: 'p3', name: 'Power Gamma', img: '' });
    expect((await getItemData(page, ITEM_NAME)).powerValue).toBe(3);

    // Step 5: add restriction, PV = 2
    await addRestrictionViaAPI(page, ITEM_NAME, { kind: 'access', name: 'Species Required', description: '' });
    expect((await getItemData(page, ITEM_NAME)).powerValue).toBe(2);

    // Step 6: add 2nd restriction, PV = 1
    await addRestrictionViaAPI(page, ITEM_NAME, { kind: 'unattached', name: 'Carried', description: '' });
    expect((await getItemData(page, ITEM_NAME)).powerValue).toBe(1);

    // Step 7: add 4th power, PV = 2
    await addPowerViaAPI(page, ITEM_NAME, { id: 'p4', name: 'Power Delta', img: '' });
    expect((await getItemData(page, ITEM_NAME)).powerValue).toBe(2);

    // Step 8: remove a power (index 1), PV = 1
    await page.evaluate(async (name) => {
      const item = game.items.find(i => i.name === name);
      const powers = [...item.system.powers];
      powers.splice(1, 1);
      await item.update({ 'system.powers': powers });
    }, ITEM_NAME);
    await page.waitForTimeout(500);
    expect((await getItemData(page, ITEM_NAME)).powerValue).toBe(1);

    // Step 9: remove a restriction (index 0), PV = 2
    await page.evaluate(async (name) => {
      const item = game.items.find(i => i.name === name);
      const restrictions = [...item.system.restrictions];
      restrictions.splice(0, 1);
      await item.update({ 'system.restrictions': restrictions });
    }, ITEM_NAME);
    await page.waitForTimeout(500);
    expect((await getItemData(page, ITEM_NAME)).powerValue).toBe(2);

    // Step 10: remove all restrictions, PV = 3
    await page.evaluate(async (name) => {
      const item = game.items.find(i => i.name === name);
      await item.update({ 'system.restrictions': [] });
    }, ITEM_NAME);
    await page.waitForTimeout(500);

    const finalData = await getItemData(page, ITEM_NAME);
    expect(finalData.powers).toHaveLength(3);
    expect(finalData.restrictions).toHaveLength(0);
    expect(finalData.powerValue).toBe(3);
  });

  // ── All 5 Restriction Kinds ──────────────────────────────────────────

  test('all five restriction kinds can be added one each', async ({ foundryPage }) => {
    const page = foundryPage;
    await createIconicItem(page, ITEM_NAME);

    const kinds = ['access', 'challenging', 'obvious', 'unattached', 'use'];
    for (const kind of kinds) {
      await createRestriction(page, `${RESTRICTION_PREFIX} ${kind}`, kind);
    }

    await openSheet(page, ITEM_NAME);

    // Drop first 3 (the max)
    let result;
    result = await dropItemOnSheet(page, ITEM_NAME, `${RESTRICTION_PREFIX} access`);
    expect(result.restrictions).toHaveLength(1);
    await page.waitForTimeout(300);

    result = await dropItemOnSheet(page, ITEM_NAME, `${RESTRICTION_PREFIX} challenging`);
    expect(result.restrictions).toHaveLength(2);
    await page.waitForTimeout(300);

    result = await dropItemOnSheet(page, ITEM_NAME, `${RESTRICTION_PREFIX} obvious`);
    expect(result.restrictions).toHaveLength(3);
    await page.waitForTimeout(300);

    // 4th should be rejected (max 3)
    result = await dropItemOnSheet(page, ITEM_NAME, `${RESTRICTION_PREFIX} unattached`);
    expect(result.restrictions).toHaveLength(3);

    // 5th should also be rejected
    result = await dropItemOnSheet(page, ITEM_NAME, `${RESTRICTION_PREFIX} use`);
    expect(result.restrictions).toHaveLength(3);
  });

  // ── One-per-kind via API bypass still stores (data layer) ────────────

  test('API bypass: setting restrictions directly ignores UI validation', async ({ foundryPage }) => {
    const page = foundryPage;
    await createIconicItem(page, ITEM_NAME);

    // Directly set 2 access restrictions via API (bypasses UI validation)
    await page.evaluate(async (name) => {
      const item = game.items.find(i => i.name === name);
      await item.update({
        'system.restrictions': [
          { kind: 'access', name: 'R1', description: '' },
          { kind: 'access', name: 'R2', description: '' },
        ],
      });
    }, ITEM_NAME);
    await page.waitForTimeout(500);

    const data = await getItemData(page, ITEM_NAME);
    expect(data.restrictions).toHaveLength(2);
  });
});
