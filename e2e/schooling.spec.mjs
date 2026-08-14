import { test, expect } from './fixtures.mjs';
import {
  evaluateWhenReady,
  dismissNotifications,
  deleteActor,
  goToBiographyTab,
} from './helpers.mjs';

/**
 * Behaviour of the Biography tab's sub-tabs and the Advancement chart.
 *
 * Deliberately absent: assertions that a hardcoded label rendered. Those pass
 * for any template that happens to contain the string and prove nothing. What
 * is tested here is conditional display (which panel is shown), data binding
 * (DOM built from config, checkbox bound to the schema path), persistence, and
 * the two computed styles that only a real browser can confirm.
 *
 * Actors are created through the API rather than the `createActor` UI helper,
 * matching the pattern in headquarters.spec.mjs.
 */
const HERO = 'E2E Schooling Hero';

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

async function goToSubtab(sheet, subtab) {
  await goToBiographyTab(sheet);
  await sheet.locator(`.mm-subtabs a[data-tab="${subtab}"]`).click();
  await sheet.page().waitForTimeout(300);
}

const panel = (sheet, name) => sheet.locator(`.mm-bio-body .tab[data-tab="${name}"]`);

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

  test('opens on Details with the other panels hidden', async ({ foundryPage: page }) => {
    const sheet = await openSheet(page);
    await goToBiographyTab(sheet);

    await expect(panel(sheet, 'details')).toBeVisible();
    await expect(panel(sheet, 'background')).toBeHidden();
    await expect(panel(sheet, 'advancement')).toBeHidden();
  });

  test('clicking a sub-tab swaps which panel is visible', async ({ foundryPage: page }) => {
    const sheet = await openSheet(page);

    await goToSubtab(sheet, 'background');
    await expect(panel(sheet, 'background')).toBeVisible();
    await expect(panel(sheet, 'details')).toBeHidden();
    await expect(panel(sheet, 'advancement')).toBeHidden();

    await goToSubtab(sheet, 'advancement');
    await expect(panel(sheet, 'advancement')).toBeVisible();
    await expect(panel(sheet, 'background')).toBeHidden();
    await expect(panel(sheet, 'details')).toBeHidden();

    await goToSubtab(sheet, 'details');
    await expect(panel(sheet, 'details')).toBeVisible();
    await expect(panel(sheet, 'advancement')).toBeHidden();
  });

  test('Source moved to Details and is no longer duplicated on Background', async ({ foundryPage: page }) => {
    // Source was relocated out of the biography partial. Both halves of that
    // move must hold, so the presence check and the absence check are paired.
    const sheet = await openSheet(page);
    await goToBiographyTab(sheet);
    await expect(panel(sheet, 'details').locator('select[name="system.source"]')).toBeVisible();

    await goToSubtab(sheet, 'background');
    await expect(panel(sheet, 'background')).toBeVisible();
    await expect(panel(sheet, 'background').locator('select[name="system.source"]')).toHaveCount(0);
  });

  test('every sub-tab label renders white on the red strip, active or not', async ({ foundryPage: page }) => {
    // Only a browser resolves the cascade. Checking every label, not just the
    // first: the first is always the active one, whose rule sets white
    // separately, so testing it alone would miss the inactive-tab colour.
    const sheet = await openSheet(page);
    await goToBiographyTab(sheet);

    const items = sheet.locator('.mm-subtabs .item');
    await expect(items.first()).toBeVisible();
    const colours = await items.evaluateAll(els => els.map(e => getComputedStyle(e).color));
    expect(colours.length).toBeGreaterThan(1);
    expect(colours).toEqual(colours.map(() => 'rgb(255, 255, 255)'));
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

  test('renders one checkbox per configured chart entry, in config order', async ({ foundryPage: page }) => {
    // Compares the rendered DOM against the live config rather than against
    // hardcoded strings, so it fails if the map in getData breaks or drifts
    // out of order — not merely if someone edits a label.
    const sheet = await openSheet(page);
    await goToSubtab(sheet, 'advancement');

    const expected = await page.evaluate(() =>
      CONFIG.MARVEL_MULTIVERSE.schoolingChart.map(r => game.i18n.localize(r.label))
    );
    expect(expected.length).toBeGreaterThan(0);

    const rendered = await sheet.locator('.mm-schooling-box .mm-schooling-reward').allInnerTexts();
    expect(rendered).toEqual(expected);

    const names = await sheet
      .locator('.mm-schooling-box input[type="checkbox"]')
      .evaluateAll(els => els.map(e => e.name));
    expect(names).toEqual(expected.map((_, i) => `system.schooling.boxes.box${i}`));
  });

  test('reward text renders white on the red container', async ({ foundryPage: page }) => {
    const sheet = await openSheet(page);
    await goToSubtab(sheet, 'advancement');

    const reward = sheet.locator('.mm-schooling-box .mm-schooling-reward').first();
    await expect(reward).toBeVisible();
    expect(await reward.evaluate(el => getComputedStyle(el).color)).toBe('rgb(255, 255, 255)');
  });

  test('checking a box writes that box only, and it survives a reopen', async ({ foundryPage: page }) => {
    const sheet = await openSheet(page);
    await goToSubtab(sheet, 'advancement');

    await sheet.locator('input[name="system.schooling.boxes.box2"]').check();
    await page.waitForTimeout(800);

    const stored = await evaluateWhenReady(page, (name) => {
      const actor = game.actors.find(a => a.name === name);
      if (!actor) throw new Error(`Actor "${name}" not found`);
      return Object.entries(actor.system.schooling.boxes)
        .filter(([, v]) => v === true)
        .map(([k]) => k);
    }, HERO);
    // Exactly the clicked box flipped — a binding that wrote the whole object
    // or the wrong index shows up here.
    expect(stored).toEqual(['box2']);

    await evaluateWhenReady(page, (name) => {
      game.actors.find(a => a.name === name)?.sheet?.close();
    }, HERO);
    await page.waitForTimeout(500);

    const reopened = await openSheet(page);
    await goToSubtab(reopened, 'advancement');
    await expect(reopened.locator('input[name="system.schooling.boxes.box2"]')).toBeChecked();
    await expect(reopened.locator('input[name="system.schooling.boxes.box3"]')).not.toBeChecked();
  });
});
