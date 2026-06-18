import { test, expect } from './fixtures.mjs';
import {
  createActor,
  goToAbilitiesTab,
  deleteActor,
  dismissNotifications,
} from './helpers.mjs';

const ACTOR_NAME = 'Trait Wrapping Test';

test.describe('Trait wrapping layout (#45)', () => {
  test.afterEach(async ({ foundryPage }) => {
    await deleteActor(foundryPage, ACTOR_NAME);
  });

  test('edit and delete icons stay at the top when trait name wraps', async ({ foundryPage }) => {
    const page = foundryPage;
    const sheet = await createActor(page, ACTOR_NAME);
    await goToAbilitiesTab(sheet);

    // Add a trait with a very long name that will force wrapping
    await page.evaluate(async (actorName) => {
      const actor = game.actors.find(a => a.name === actorName);
      await actor.createEmbeddedDocuments('Item', [{
        name: 'Extraordinarily Long Trait Name That Should Definitely Wrap',
        type: 'trait',
      }]);
    }, ACTOR_NAME);
    await page.waitForTimeout(1000);
    await dismissNotifications(page);

    // Find the trait row on the abilities tab
    const traitItem = sheet.locator('.mm-item').filter({
      hasText: 'Extraordinarily Long Trait Name',
    });
    await expect(traitItem).toBeVisible({ timeout: 5000 });

    // Get bounding boxes for the name and the controls
    const nameBox = await traitItem.locator('.mm-item-name').boundingBox();
    const controlsBox = await traitItem.locator('.item-controls').boundingBox();
    const rowBox = await traitItem.boundingBox();

    // Controls should be at the top-right of the row, not wrapped below the name
    const controlsOffsetFromTop = controlsBox.y - rowBox.y;
    expect(controlsOffsetFromTop).toBeLessThan(5);

    // Controls should be to the right of the name, not below it
    expect(controlsBox.x).toBeGreaterThan(nameBox.x + nameBox.width - 1);

    // Name should wrap (be taller than a single line)
    expect(nameBox.height).toBeGreaterThan(controlsBox.height);
  });

  test('short trait names display correctly on one line', async ({ foundryPage }) => {
    const page = foundryPage;
    const sheet = await createActor(page, ACTOR_NAME);
    await goToAbilitiesTab(sheet);

    await page.evaluate(async (actorName) => {
      const actor = game.actors.find(a => a.name === actorName);
      await actor.createEmbeddedDocuments('Item', [{
        name: 'Weird',
        type: 'trait',
      }]);
    }, ACTOR_NAME);
    await page.waitForTimeout(1000);
    await dismissNotifications(page);

    const traitItem = sheet.locator('.mm-item').filter({ hasText: 'Weird' });
    await expect(traitItem).toBeVisible({ timeout: 5000 });

    const controlsBox = await traitItem.locator('.item-controls').boundingBox();
    const nameBox = await traitItem.locator('.mm-item-name').boundingBox();
    const rowBox = await traitItem.boundingBox();

    // Controls should be at the top of the row
    expect(controlsBox.y - rowBox.y).toBeLessThan(5);

    // Controls should be to the right of the name
    expect(controlsBox.x).toBeGreaterThan(nameBox.x + nameBox.width - 1);

    // Edit and delete buttons should both be visible
    await expect(traitItem.locator('.item-edit')).toBeVisible();
    await expect(traitItem.locator('.item-delete')).toBeVisible();
  });
});
