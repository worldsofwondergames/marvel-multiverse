/**
 * Shared helper functions for FoundryVTT e2e tests.
 */

/**
 * Wait for the FoundryVTT game object to be fully initialized.
 */
export async function waitForGameReady(page) {
  await page.waitForFunction(() => window.game?.ready === true, { timeout: 60_000 });
}

/**
 * Dismiss any FoundryVTT notification banners that block pointer events.
 */
export async function dismissNotifications(page) {
  await page.evaluate(() => {
    document.querySelectorAll('#notifications li.notification').forEach(n => n.remove());
  });
  await page.waitForTimeout(300);
}

/**
 * Create a new actor via the Actors sidebar tab.
 * Returns the actor sheet locator.
 */
export async function createActor(page, name, type = 'character') {
  // Click the Actors tab in the sidebar (v13 uses <button> elements)
  await dismissNotifications(page);
  const actorsTab = page.locator('#sidebar-tabs button[data-tab="actors"]');
  await actorsTab.click({ timeout: 10_000 });
  await page.waitForTimeout(1000);

  // Click "Create Actor"
  await dismissNotifications(page);
  const createBtn = page.locator('#actors button.create-entry[data-action="createEntry"]');
  await createBtn.waitFor({ state: 'visible', timeout: 10_000 });
  await createBtn.click();
  await page.waitForTimeout(2000);

  // Fill in the dialog (v13 uses <dialog> elements)
  const nameInput = page.locator('dialog input[name="name"]');
  await nameInput.waitFor({ state: 'attached', timeout: 10_000 });
  await nameInput.click();
  await nameInput.pressSequentially(name, { delay: 30 });

  const typeSelect = page.locator('dialog select[name="type"]');
  if (await typeSelect.count() > 0) {
    await typeSelect.selectOption(type);
  }

  // Wait for the submit button to become enabled
  const submitBtn = page.locator('dialog button[type="submit"]');
  await submitBtn.waitFor({ state: 'visible', timeout: 5_000 });
  await page.waitForFunction(() => {
    const btn = document.querySelector('dialog button[type="submit"]');
    return btn && !btn.disabled;
  }, { timeout: 5_000 });
  await submitBtn.click();

  // Wait for the character sheet to appear
  await page.waitForTimeout(3000);

  // Dismiss any notification banners that block interaction
  await dismissNotifications(page);

  // Find the sheet — it's the window containing inputs with system.abilities fields
  const sheet = page.locator('.sheet.actor').last();
  await sheet.locator('input[name="system.attributes.rank.value"]').waitFor({ state: 'attached', timeout: 10_000 });
  return sheet;
}

/**
 * Set a numeric input field on the character sheet and trigger an update.
 */
export async function setNumericField(sheet, fieldName, value) {
  const page = sheet.page();
  await dismissNotifications(page);
  const input = sheet.locator(`input[name="${fieldName}"]`);
  await input.click({ clickCount: 3 });
  await input.fill(String(value));
  await input.press('Tab');
  await page.waitForTimeout(800);
}

/**
 * Set a text input field on the character sheet.
 */
export async function setTextField(sheet, fieldName, value) {
  const input = sheet.locator(`input[name="${fieldName}"]`);
  await input.click({ clickCount: 3 });
  await input.fill(value);
  await input.press('Tab');
  await sheet.page().waitForTimeout(800);
}

/**
 * Select an option from a dropdown on the character sheet.
 */
export async function setSelectField(sheet, fieldName, value) {
  const select = sheet.locator(`select[name="${fieldName}"]`);
  await select.selectOption(value);
  await sheet.page().waitForTimeout(800);
}

/**
 * Drop a compendium item onto the currently open character sheet
 * by using FoundryVTT's API to find the item and call the sheet's drop handler.
 *
 * Searches the marvel-multiverse-data module's combined items pack,
 * falling back to the system's own packs if not found.
 */
export async function dragCompendiumItem(page, packName, itemName, sheet) {
  await page.evaluate(async ({ packName, itemName }) => {
    // Primary source: the module's combined items pack
    const modulePack = game.packs.get('marvel-multiverse-data.marvel-multiverse-items');
    // Fallback: the system's per-type packs
    const systemPack = game.packs.get(`marvel-multiverse.${packName}`);

    let item = null;

    for (const pack of [modulePack, systemPack].filter(Boolean)) {
      const index = await pack.getIndex({ fields: ['name', 'type'] });
      const entry = index.find(e => e.name === itemName);
      if (entry) {
        item = await pack.getDocument(entry._id);
        break;
      }
    }

    if (!item) {
      throw new Error(`Item "${itemName}" not found in any compendium pack.`);
    }

    const itemData = item.toObject();

    const actorSheet = Object.values(ui.windows).find(w => w instanceof ActorSheet);
    if (!actorSheet) throw new Error('No actor sheet is currently open');

    await actorSheet._onDropItemCreate(itemData);
  }, { packName, itemName });

  await page.waitForTimeout(500);
}

/**
 * Navigate to the Biography tab on the character sheet.
 */
export async function goToBiographyTab(sheet) {
  await sheet.locator('.sheet-tabs a[data-tab="biography"]').click();
  await sheet.page().waitForTimeout(500);
}

/**
 * Navigate to the Abilities tab on the character sheet.
 */
export async function goToAbilitiesTab(sheet) {
  await sheet.locator('.sheet-tabs a[data-tab="abilities"]').click();
  await sheet.page().waitForTimeout(500);
}

/**
 * Close the character sheet.
 */
export async function closeSheet(sheet) {
  await sheet.locator('button[data-action="close"]').click();
  await sheet.page().waitForTimeout(500);
}

/**
 * Delete an actor by name to clean up after tests.
 */
export async function deleteActor(page, actorName) {
  await page.evaluate(async (name) => {
    const actor = game.actors.find(a => a.name === name);
    if (actor) await actor.delete();
  }, actorName);
  await page.waitForTimeout(500);
}

/**
 * Get all item names of a given type on the actor.
 */
export async function getActorItems(page, actorName, itemType) {
  return page.evaluate(({ actorName, itemType }) => {
    const actor = game.actors.find(a => a.name === actorName);
    if (!actor) return [];
    return actor.items.filter(i => i.type === itemType).map(i => i.name).sort();
  }, { actorName, itemType });
}
