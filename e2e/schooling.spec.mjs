import { test, expect } from './fixtures.mjs';
import {
  evaluateWhenReady,
  dismissNotifications,
  deleteActor,
  goToBiographyTab,
} from './helpers.mjs';

/**
 * The schooling chart is a pure tracker: ten checkboxes bound straight to
 * `system.schooling.boxes.boxN`, a completion count, and a badge at ten. There
 * is no custom write path, so these tests exercise the stock form submit.
 *
 * Actors are created through the API rather than the `createActor` UI helper,
 * which still targets the v13 sidebar/dialog markup and times out on v14. This
 * matches the pattern in headquarters.spec.mjs.
 */
const HERO = 'E2E Schooling Hero';

/** Open the character sheet and return a locator for it. */
async function openSheet(page) {
  await evaluateWhenReady(page, async (name) => {
    const actor = game.actors.find(a => a.name === name);
    await actor.sheet._render(true);
  }, HERO);
  await page.waitForTimeout(500);
  const sheet = page.locator('.sheet.actor').last();
  await sheet.locator('input[name="system.attributes.rank.value"]').waitFor({
    state: 'attached',
    timeout: 10_000,
  });
  return sheet;
}

/**
 * Check one box and wait for the submit-driven re-render, then hand back a
 * fresh sheet locator — the old DOM is replaced by the render.
 */
async function checkBox(page, sheet, index) {
  await sheet.locator(`input[name="system.schooling.boxes.box${index}"]`).check();
  await page.waitForTimeout(600);
  const refreshed = page.locator('.sheet.actor').last();
  await goToBiographyTab(refreshed);
  return refreshed;
}

test.describe('Schooling Advancement Chart', () => {
  test.beforeEach(async ({ foundryPage }) => {
    await dismissNotifications(foundryPage);
    await evaluateWhenReady(foundryPage, async (name) => {
      const stale = game.actors.filter(a => a.name === name);
      if (stale.length) await Actor.deleteDocuments(stale.map(a => a.id));
      await Actor.create({ name, type: 'character' });
    }, HERO);
  });

  test.afterEach(async ({ foundryPage }) => {
    await deleteActor(foundryPage, HERO);
  });

  test('renders ten unchecked boxes at 0 / 10 on a new character', async ({ foundryPage: page }) => {
    const sheet = await openSheet(page);
    await goToBiographyTab(sheet);

    const block = sheet.locator('.mm-schooling-block');
    await expect(block).toBeVisible();

    const boxes = block.locator('.mm-schooling-box input[type="checkbox"]');
    await expect(boxes).toHaveCount(10);
    for (let i = 0; i < 10; i++) {
      await expect(boxes.nth(i)).not.toBeChecked();
    }

    await expect(block.locator('.mm-schooling-progress')).toHaveText('0 / 10');
    // Assert the badge's container is present before asserting the badge is absent,
    // so a renamed block cannot make this pass vacuously.
    await expect(block.locator('.mm-schooling-footer')).toBeVisible();
    await expect(block.locator('.mm-schooling-ready')).toHaveCount(0);
  });

  test('the ten boxes are labelled five ability, four power, one trait', async ({ foundryPage: page }) => {
    const sheet = await openSheet(page);
    await goToBiographyTab(sheet);

    const labels = await sheet.locator('.mm-schooling-box .mm-schooling-reward').allInnerTexts();
    expect(labels).toEqual([
      'Ability point', 'Ability point', 'Ability point', 'Ability point', 'Ability point',
      'Power', 'Power', 'Power', 'Power', 'Trait',
    ]);
  });

  test('a checked box persists to the actor and survives a reopen', async ({ foundryPage: page }) => {
    const sheet = await openSheet(page);
    await goToBiographyTab(sheet);

    await checkBox(page, sheet, 2);

    // Read the document directly: getActorSystemData returns a whitelisted
    // subset that does not carry `schooling`.
    const schooling = await evaluateWhenReady(page, (name) => {
      const actor = game.actors.find(a => a.name === name);
      if (!actor) throw new Error(`Actor "${name}" not found`);
      return {
        box2: actor.system.schooling.boxes.box2,
        completed: actor.system.schooling.completed,
      };
    }, HERO);
    expect(schooling.box2).toBe(true);
    expect(schooling.completed).toBe(1);

    await evaluateWhenReady(page, (name) => {
      game.actors.find(a => a.name === name)?.sheet?.close();
    }, HERO);
    await page.waitForTimeout(500);

    const reopened = await openSheet(page);
    await goToBiographyTab(reopened);
    await expect(reopened.locator('input[name="system.schooling.boxes.box2"]')).toBeChecked();
    await expect(reopened.locator('.mm-schooling-progress')).toHaveText('1 / 10');
  });

  test('shows the ready-to-advance badge only when all ten are checked', async ({ foundryPage: page }) => {
    let sheet = await openSheet(page);
    await goToBiographyTab(sheet);

    for (let i = 0; i < 9; i++) {
      sheet = await checkBox(page, sheet, i);
    }
    await expect(sheet.locator('.mm-schooling-progress')).toHaveText('9 / 10');
    await expect(sheet.locator('.mm-schooling-ready')).toHaveCount(0);

    sheet = await checkBox(page, sheet, 9);
    await expect(sheet.locator('.mm-schooling-progress')).toHaveText('10 / 10');
    await expect(sheet.locator('.mm-schooling-ready')).toBeVisible();
  });
});
