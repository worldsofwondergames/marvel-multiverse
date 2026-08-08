import { test, expect } from './fixtures.mjs';
import {
  evaluateWhenReady,
  dismissNotifications,
  deleteActor,
  goToBiographyTab,
} from './helpers.mjs';

/**
 * The Biography tab is split into three sub-tabs — Details, Background and
 * Advancement. The Advancement sub-tab holds the schooling chart: a pure
 * tracker of ten checkboxes bound straight to `system.schooling.boxes.boxN`,
 * with a badge once all ten are checked.
 *
 * Actors are created through the API rather than the `createActor` UI helper,
 * matching the pattern in headquarters.spec.mjs.
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

/** Navigate to Biography, then to one of its sub-tabs. */
async function goToSubtab(sheet, subtab) {
  await goToBiographyTab(sheet);
  await sheet.locator(`.mm-subtabs a[data-tab="${subtab}"]`).click();
  await sheet.page().waitForTimeout(300);
}

/**
 * Check one box and wait for the submit-driven re-render, then hand back a
 * fresh sheet locator already back on the Advancement sub-tab — the old DOM is
 * replaced by the render and the sub-tab selection resets.
 */
async function checkBox(page, sheet, index) {
  await sheet.locator(`input[name="system.schooling.boxes.box${index}"]`).check();
  await page.waitForTimeout(600);
  const refreshed = page.locator('.sheet.actor').last();
  await goToSubtab(refreshed, 'advancement');
  return refreshed;
}

test.describe('Biography sub-tabs', () => {
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

  test('shows three sub-tabs labelled Details, Background and Advancement', async ({ foundryPage: page }) => {
    const sheet = await openSheet(page);
    await goToBiographyTab(sheet);

    const items = sheet.locator('.mm-subtabs .item');
    await expect(items).toHaveCount(3);
    // Rendered uppercase by text-transform, matching the primary tab strip.
    expect(await items.allInnerTexts()).toEqual(['DETAILS', 'BACKGROUND', 'ADVANCEMENT']);
    expect(await items.evaluateAll(els => els.map(e => e.dataset.tab)))
      .toEqual(['details', 'background', 'advancement']);
  });

  test('sub-tab labels are white against the red strip', async ({ foundryPage: page }) => {
    const sheet = await openSheet(page);
    await goToBiographyTab(sheet);

    const item = sheet.locator('.mm-subtabs .item').first();
    await expect(item).toBeVisible();
    expect(await item.evaluate(el => getComputedStyle(el).color)).toBe('rgb(255, 255, 255)');
  });

  test('Details opens first and holds the field boxes including Source', async ({ foundryPage: page }) => {
    const sheet = await openSheet(page);
    await goToBiographyTab(sheet);

    const details = sheet.locator('.mm-bio-body .tab[data-tab="details"]');
    await expect(details).toBeVisible();
    await expect(details.locator('select[name="system.source"]')).toBeVisible();
    await expect(details.locator('input[name="system.realname"]')).toBeVisible();

    // Advancement exists but is not the open sub-tab.
    await expect(sheet.locator('.mm-subtabs a[data-tab="advancement"]')).toBeVisible();
    await expect(sheet.locator('.mm-bio-body .tab[data-tab="advancement"]')).toBeHidden();
  });

  test('Background holds the History, Personality and Features editors', async ({ foundryPage: page }) => {
    const sheet = await openSheet(page);
    await goToSubtab(sheet, 'background');

    const background = sheet.locator('.mm-bio-body .tab[data-tab="background"]');
    await expect(background).toBeVisible();
    expect(await background.locator('h3').allInnerTexts()).toEqual([
      'History', 'Personality', 'Features',
    ]);
    // Source moved to Details, so it must not also be here.
    await expect(background.locator('select[name="system.source"]')).toHaveCount(0);
  });
});

test.describe('Advancement chart', () => {
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

  test('is headed "Advancement"', async ({ foundryPage: page }) => {
    const sheet = await openSheet(page);
    await goToSubtab(sheet, 'advancement');
    await expect(sheet.locator('.mm-schooling-block h3')).toHaveText('Advancement');
  });

  test('renders ten unchecked boxes on a new character', async ({ foundryPage: page }) => {
    const sheet = await openSheet(page);
    await goToSubtab(sheet, 'advancement');

    const block = sheet.locator('.mm-schooling-block');
    await expect(block).toBeVisible();

    const boxes = block.locator('.mm-schooling-box input[type="checkbox"]');
    await expect(boxes).toHaveCount(10);
    for (let i = 0; i < 10; i++) {
      await expect(boxes.nth(i)).not.toBeChecked();
    }

    // Assert the grid is present before asserting the badge is absent, so a
    // renamed block cannot make the absence check pass vacuously.
    await expect(block.locator('.mm-schooling-grid')).toBeVisible();
    await expect(block.locator('.mm-schooling-ready')).toHaveCount(0);
  });

  test('the ten boxes are labelled five ability, four power, one trait', async ({ foundryPage: page }) => {
    const sheet = await openSheet(page);
    await goToSubtab(sheet, 'advancement');

    const labels = await sheet.locator('.mm-schooling-box .mm-schooling-reward').allInnerTexts();
    expect(labels).toEqual([
      'Ability point', 'Ability point', 'Ability point', 'Ability point', 'Ability point',
      'Power', 'Power', 'Power', 'Power', 'Trait',
    ]);
  });

  test('reward text is white against the red container background', async ({ foundryPage: page }) => {
    const sheet = await openSheet(page);
    await goToSubtab(sheet, 'advancement');

    const reward = sheet.locator('.mm-schooling-box .mm-schooling-reward').first();
    await expect(reward).toBeVisible();
    expect(await reward.evaluate(el => getComputedStyle(el).color)).toBe('rgb(255, 255, 255)');
  });

  test('a checked box persists to the actor and survives a reopen', async ({ foundryPage: page }) => {
    const sheet = await openSheet(page);
    await goToSubtab(sheet, 'advancement');

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
    await goToSubtab(reopened, 'advancement');
    await expect(reopened.locator('input[name="system.schooling.boxes.box2"]')).toBeChecked();
  });

  test('shows the ready-to-advance badge only when all ten are checked', async ({ foundryPage: page }) => {
    let sheet = await openSheet(page);
    await goToSubtab(sheet, 'advancement');

    for (let i = 0; i < 9; i++) {
      sheet = await checkBox(page, sheet, i);
    }
    // Nine checked: the grid is there, the badge is not.
    await expect(sheet.locator('.mm-schooling-grid')).toBeVisible();
    await expect(sheet.locator('.mm-schooling-ready')).toHaveCount(0);

    sheet = await checkBox(page, sheet, 9);
    await expect(sheet.locator('.mm-schooling-ready')).toBeVisible();
  });
});
