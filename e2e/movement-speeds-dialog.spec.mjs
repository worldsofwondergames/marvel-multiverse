import { test, expect } from './fixtures.mjs';
import { createActorViaAPI, deleteActor, getActorSystemData } from './helpers.mjs';

const ACTOR_NAME = 'E2E Movement Dialog';

/** Create a character with Run Speed 5 and open its sheet. */
async function openSheet(page) {
  await createActorViaAPI(page, ACTOR_NAME);
  await page.evaluate(async (name) => {
    await game.actors.find(a => a.name === name).sheet.render(true);
  }, ACTOR_NAME);
  const sheet = page.locator('.sheet.actor').last();
  // A sheet that is still rendering drops the re-render an update asks for,
  // so wait for the first render before a test changes the actor.
  await expect(sheetSpeed(sheet, 'run')).toHaveText('5');
  return sheet;
}

async function openDialog(page, sheet) {
  await sheet.locator('.mm-speed-config').click();
  const dialog = page.locator('.mm-movement-dialog');
  await expect(dialog).toBeVisible();
  return dialog;
}

function row(dialog, key) {
  return dialog.locator(`.mm-movement-row[data-key="${key}"]`);
}

async function save(dialog) {
  await dialog.locator('button[data-button="save"]').click();
  await expect(dialog).toHaveCount(0);
}

function storedMovement(page) {
  return page.evaluate((name) =>
    game.actors.find(a => a.name === name).system._source.movement,
  ACTOR_NAME);
}

/** The speed printed for a movement mode in the sheet's Speed block. */
function sheetSpeed(sheet, key) {
  return sheet.locator(`.mm-speed-fields [data-movement="${key}"] span`).nth(1);
}

test.describe('Movement Speeds dialog', () => {

  test.afterEach(async ({ foundryPage }) => {
    await deleteActor(foundryPage, ACTOR_NAME);
  });

  test('a Climb speed set in the dialog is stored and shown after the sheet reopens', async ({ foundryPage: page }) => {
    const sheet = await openSheet(page);
    await expect(sheetSpeed(sheet, 'climb')).toHaveText('3');

    const dialog = await openDialog(page, sheet);
    await row(dialog, 'climb').locator('select[name="calc"]').selectOption('custom');
    await row(dialog, 'climb').locator('input[name="spaces"]').fill('5');
    await save(dialog);

    await expect.poll(async () => (await storedMovement(page)).climb.override).toBe(5);
    expect((await getActorSystemData(page, ACTOR_NAME)).movement.climb.value).toBe(5);

    await page.evaluate(async (name) => {
      const actor = game.actors.find(a => a.name === name);
      await actor.sheet.close();
      await actor.sheet.render(true);
    }, ACTOR_NAME);
    await expect(sheetSpeed(sheet, 'climb')).toHaveText('5');
    // Swim was left on Half Run.
    await expect(sheetSpeed(sheet, 'swim')).toHaveText('3');
  });

  test('switching Climb back to Half Run returns it to half of Run', async ({ foundryPage: page }) => {
    const sheet = await openSheet(page);
    await page.evaluate((name) =>
      game.actors.find(a => a.name === name).update({ 'system.movement.climb.override': 5 }),
    ACTOR_NAME);
    await expect(sheetSpeed(sheet, 'climb')).toHaveText('5');

    const dialog = await openDialog(page, sheet);
    await expect(row(dialog, 'climb').locator('select[name="calc"]')).toHaveValue('custom');
    await row(dialog, 'climb').locator('select[name="calc"]').selectOption('half');
    await save(dialog);

    await expect.poll(async () => (await storedMovement(page)).climb.override).toBeNull();
    await expect(sheetSpeed(sheet, 'climb')).toHaveText('3');
  });

  test('a Half Run speed in the dialog follows the Run Speed typed there', async ({ foundryPage: page }) => {
    const sheet = await openSheet(page);
    const dialog = await openDialog(page, sheet);
    const climb = row(dialog, 'climb').locator('input[name="spaces"]');
    await expect(climb).toHaveValue('3');

    await row(dialog, 'run').locator('input[name="spaces"]').fill('8');
    await expect(climb).toHaveValue('4');
    await save(dialog);

    await expect.poll(async () => (await storedMovement(page)).run.value).toBe(8);
    await expect(sheetSpeed(sheet, 'climb')).toHaveText('4');
  });

  test('showing Flight with a speed adds it to the sheet', async ({ foundryPage: page }) => {
    const sheet = await openSheet(page);
    await expect(sheetSpeed(sheet, 'run')).toHaveText('5');
    await expect(sheetSpeed(sheet, 'flight')).toHaveCount(0);

    const dialog = await openDialog(page, sheet);
    await row(dialog, 'flight').locator('input[name="active"]').check();
    await row(dialog, 'flight').locator('input[name="spaces"]').fill('10');
    await save(dialog);

    await expect(sheetSpeed(sheet, 'flight')).toHaveText('10');
    const stored = await storedMovement(page);
    expect(stored.flight.active).toBe(true);
    expect(stored.flight.override).toBe(10);
  });

  test('with five speeds checked the unchecked boxes are disabled until one is unchecked', async ({ foundryPage: page }) => {
    const sheet = await openSheet(page);
    const dialog = await openDialog(page, sheet);
    const box = (key) => row(dialog, key).locator('input[name="active"]');

    // Run, Climb, Swim, and Jump start checked, so Glide can still be checked.
    await expect(box('glide')).toBeEnabled();
    await box('flight').check();
    await expect(box('glide')).toBeDisabled();
    await expect(box('levitation')).toBeDisabled();
    await expect(box('flight')).toBeEnabled();

    await box('swim').uncheck();
    await expect(box('glide')).toBeEnabled();
    await box('glide').check();
    // Swim is now unchecked and disabled, and must still be saved as hidden.
    await expect(box('swim')).toBeDisabled();
    await save(dialog);

    await expect.poll(async () => (await storedMovement(page)).glide.active).toBe(true);
    expect((await storedMovement(page)).swim.active).toBe(false);
    await expect(sheetSpeed(sheet, 'glide')).toHaveCount(1);
    await expect(sheetSpeed(sheet, 'swim')).toHaveCount(0);
  });

  test('a speed set by a power is read-only and is not written on save', async ({ foundryPage: page }) => {
    const sheet = await openSheet(page);
    await page.evaluate(async (name) => {
      const actor = game.actors.find(a => a.name === name);
      await actor.update({ 'system.attributes.rank.value': 3 });
      await actor.createEmbeddedDocuments('ActiveEffect', [{
        name: 'Flight Effect',
        changes: [{ key: 'system.movement.flight.calc', mode: 5, value: 'runspeed-rank' }],
      }]);
    }, ACTOR_NAME);
    // Run 5 times rank 3.
    await expect(sheetSpeed(sheet, 'flight')).toHaveText('15');

    const dialog = await openDialog(page, sheet);
    const flight = row(dialog, 'flight');
    await expect(flight.locator('input[name="spaces"]')).toHaveValue('15');
    await expect(flight.locator('input[name="spaces"]')).toHaveJSProperty('readOnly', true);
    await expect(flight.locator('select[name="calc"]')).toBeDisabled();
    await expect(flight.locator('input[name="active"]')).toBeDisabled();
    // An editable row beside it, so the checks above are not true of every row.
    await expect(row(dialog, 'glide').locator('input[name="spaces"]')).toHaveJSProperty('readOnly', false);

    await row(dialog, 'glide').locator('input[name="spaces"]').fill('4');
    await save(dialog);

    await expect.poll(async () => (await storedMovement(page)).glide.override).toBe(4);
    const stored = await storedMovement(page);
    expect(stored.flight.override).toBeNull();
    expect(stored.flight.active).toBe(false);
  });
});
