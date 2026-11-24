import { test, expect } from './fixtures.mjs';
import { createActorViaAPI, deleteActor } from './helpers.mjs';

const ACTOR_NAME = 'E2E Repeatable Items';
const REPEATABLE = { name: 'E2E Repeatable Trait', type: 'trait', system: { multiple: true, detail: 'Police' } };
const POWER = { name: 'E2E Single Power', type: 'power', system: {} };
const WEAPON = { name: 'E2E Sidearm', type: 'weapon', system: {} };

/** Create an actor and wait for its sheet, since drops go through the sheet. */
async function openSheet(page, type = 'character') {
  await createActorViaAPI(page, ACTOR_NAME, type);
  await page.evaluate(async (name) => {
    await game.actors.find(a => a.name === name).sheet.render(true);
  }, ACTOR_NAME);
  const sheet = page.locator('.sheet.actor').last();
  await expect(sheet).toBeVisible();
  return sheet;
}

/**
 * Hand item data to the sheet the way a drop does. The call is not awaited in
 * the page, because a repeatable item waits on its dialog.
 */
async function drop(page, itemData) {
  await page.evaluate(({ name, itemData }) => {
    game.actors.find(a => a.name === name).sheet._onDropItemCreate(itemData);
  }, { name: ACTOR_NAME, itemData });
}

/** The details of the actor's items with a name, sorted. */
function ownedDetails(page, itemName) {
  return page.evaluate(({ name, itemName }) =>
    game.actors.find(a => a.name === name).items
      .filter(i => i.name === itemName)
      .map(i => i.system.detail ?? '')
      .sort(),
  { name: ACTOR_NAME, itemName });
}

function warning(page, text) {
  return page.locator('#notifications li.notification.warning', { hasText: text });
}

test.describe('Adding more than one copy of an item', () => {

  test.afterEach(async ({ foundryPage }) => {
    await deleteActor(foundryPage, ACTOR_NAME);
  });

  test('a repeatable trait dropped twice with different details leaves two items', async ({ foundryPage: page }) => {
    await openSheet(page);
    await drop(page, REPEATABLE);
    await expect.poll(() => ownedDetails(page, REPEATABLE.name)).toEqual(['Police']);

    await drop(page, REPEATABLE);
    const dialog = page.locator('.mm-item-detail-dialog');
    await expect(dialog.locator('input[name="detail"]')).toHaveValue('Police');
    await dialog.locator('input[name="detail"]').fill('Press');
    await dialog.locator('button[data-button="add"]').click();

    await expect.poll(() => ownedDetails(page, REPEATABLE.name)).toEqual(['Police', 'Press']);
  });

  test('a repeatable trait with a detail the actor has is refused with a warning', async ({ foundryPage: page }) => {
    await openSheet(page);
    await drop(page, REPEATABLE);
    await expect.poll(() => ownedDetails(page, REPEATABLE.name)).toEqual(['Police']);

    await drop(page, REPEATABLE);
    const dialog = page.locator('.mm-item-detail-dialog');
    await expect(dialog).toBeVisible();
    await dialog.locator('button[data-button="add"]').click();

    await expect(warning(page, REPEATABLE.name)).toBeVisible();
    expect(await ownedDetails(page, REPEATABLE.name)).toEqual(['Police']);
  });

  test('canceling the detail prompt adds nothing', async ({ foundryPage: page }) => {
    await openSheet(page);
    await drop(page, REPEATABLE);
    await expect.poll(() => ownedDetails(page, REPEATABLE.name)).toEqual(['Police']);

    await drop(page, REPEATABLE);
    const dialog = page.locator('.mm-item-detail-dialog');
    await dialog.locator('input[name="detail"]').fill('Press');
    await dialog.locator('button[data-button="cancel"]').click();
    await expect(dialog).toHaveCount(0);

    // A later drop still works, and by then the canceled one would have been added.
    await drop(page, WEAPON);
    await expect.poll(() => ownedDetails(page, WEAPON.name)).toHaveLength(1);
    expect(await ownedDetails(page, REPEATABLE.name)).toEqual(['Police']);
  });

  test('the same power dropped twice leaves one and shows a warning', async ({ foundryPage: page }) => {
    await openSheet(page);
    await drop(page, POWER);
    await expect.poll(() => ownedDetails(page, POWER.name)).toHaveLength(1);
    await expect(warning(page, POWER.name)).toHaveCount(0);

    await drop(page, POWER);
    await expect(warning(page, POWER.name)).toBeVisible();
    expect(await ownedDetails(page, POWER.name)).toHaveLength(1);
  });

  test('the same weapon dropped twice leaves two', async ({ foundryPage: page }) => {
    await openSheet(page);
    await drop(page, WEAPON);
    await expect.poll(() => ownedDetails(page, WEAPON.name)).toHaveLength(1);
    await drop(page, WEAPON);
    await expect.poll(() => ownedDetails(page, WEAPON.name)).toHaveLength(2);
  });

  test('an NPC can be given the same weapon twice, and one copy of a power', async ({ foundryPage: page }) => {
    await openSheet(page, 'npc');
    await drop(page, WEAPON);
    await expect.poll(() => ownedDetails(page, WEAPON.name)).toHaveLength(1);
    await drop(page, WEAPON);
    await expect.poll(() => ownedDetails(page, WEAPON.name)).toHaveLength(2);

    await drop(page, POWER);
    await expect.poll(() => ownedDetails(page, POWER.name)).toHaveLength(1);
    await drop(page, POWER);
    await expect(warning(page, POWER.name)).toBeVisible();
    expect(await ownedDetails(page, POWER.name)).toHaveLength(1);
  });

  test('an origin adds a repeatable trait it lists, and skips a detail the actor has', async ({ foundryPage: page }) => {
    await openSheet(page);
    const listed = { name: REPEATABLE.name, type: 'trait', system: { multiple: true, detail: '' } };
    const origin = { name: 'E2E Origin', type: 'origin', system: { traits: [listed], tags: [], powers: [] } };
    await page.evaluate(() => game.settings.set('marvel-multiverse', 'autoPopulateOrigin', true));

    await drop(page, origin);
    await expect.poll(() => ownedDetails(page, REPEATABLE.name)).toEqual(['']);

    // A second origin listing the same trait and detail adds the origin only.
    await drop(page, { ...origin, name: 'E2E Second Origin' });
    await expect.poll(() => ownedDetails(page, 'E2E Second Origin')).toHaveLength(1);
    expect(await ownedDetails(page, REPEATABLE.name)).toEqual(['']);
  });
});
