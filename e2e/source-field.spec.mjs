import { test, expect } from './fixtures.mjs';
import { dismissNotifications, goToBiographyTab } from './helpers.mjs';

/**
 * Issue #181. Source is a text field that suggests the registered sources and
 * accepts any other text. A registered source is stored by its key.
 */

const ITEM_NAME = 'E2E Source Item';
const OTHER_ITEM_NAME = 'E2E Source Other Item';
const ACTOR_NAME = 'E2E Source Actor';
const TEST_KEY = 'e2eSourceBook';
const TEST_LABEL = 'E2E Source Book';

/** Create a world document, open its sheet, and return the sheet. */
async function openWith(page, documentName, data) {
  const appId = await page.evaluate(async ({ documentName, data }) => {
    const doc = await CONFIG[documentName].documentClass.create(data);
    await doc.sheet._render(true);
    return doc.sheet.appId;
  }, { documentName, data });
  const sheet = page.locator(`.app[data-appid="${appId}"]`);
  // The character sheet has the field on its Biography tab.
  if (data.type === 'character') await goToBiographyTab(sheet);
  await expect(sheet.locator('input[name="system.source"]')).toBeVisible();
  return sheet;
}

const openItem = (page, system = {}) => openWith(page, 'Item', { name: ITEM_NAME, type: 'trait', system });

function storedSource(page, documentName, name) {
  return page.evaluate(({ documentName, name }) =>
    game.collections.get(documentName).find(d => d.name === name).system.source, { documentName, name });
}

/** Type into the Source field and leave it, which saves the sheet. */
async function typeSource(sheet, text) {
  const input = sheet.locator('input[name="system.source"]');
  await input.fill(text);
  await input.press('Tab');
}

/** A registered source whose key differs from its label. */
function registeredSource(page) {
  return page.evaluate(() => {
    const [key, source] = Object.entries(CONFIG.MARVEL_MULTIVERSE.sources).find(([k, s]) => k !== s.label);
    return { key, label: source.label };
  });
}

test.describe('Source is free text with suggestions (Issue #181)', () => {

  test.beforeEach(async ({ foundryPage: page }) => {
    await dismissNotifications(page);
  });

  test.afterEach(async ({ foundryPage: page }) => {
    await page.evaluate(async ({ names, key }) => {
      delete CONFIG.MARVEL_MULTIVERSE.sources[key];
      for (const collection of [game.items, game.actors]) {
        for (const doc of collection.filter(d => names.includes(d.name))) {
          await doc.sheet.close();
          await doc.delete();
        }
      }
    }, { names: [ITEM_NAME, OTHER_ITEM_NAME, ACTOR_NAME], key: TEST_KEY });
  });

  test('text typed into the field is stored on the item and shown after the sheet re-renders', async ({ foundryPage: page }) => {
    const sheet = await openItem(page);
    await typeSource(sheet, 'My Own Zine');
    await expect.poll(() => storedSource(page, 'Item', ITEM_NAME)).toBe('My Own Zine');
    await expect(sheet.locator('input[name="system.source"]')).toHaveValue('My Own Zine');
  });

  test('typing the label of a registered source stores its key and shows its label', async ({ foundryPage: page }) => {
    const { key, label } = await registeredSource(page);
    const sheet = await openItem(page);
    await typeSource(sheet, label);
    await expect.poll(() => storedSource(page, 'Item', ITEM_NAME)).toBe(key);
    await expect(sheet.locator('input[name="system.source"]')).toHaveValue(label);
  });

  test('an item keeps an unregistered source when another field is edited', async ({ foundryPage: page }) => {
    const sheet = await openItem(page, { source: 'Unlisted Book' });
    const name = sheet.locator('input[name="name"]');
    await name.fill(OTHER_ITEM_NAME);
    await name.press('Tab');
    await expect.poll(() => page.evaluate((n) => game.items.filter(i => i.name === n).length, OTHER_ITEM_NAME)).toBe(1);
    expect(await storedSource(page, 'Item', OTHER_ITEM_NAME)).toBe('Unlisted Book');
  });

  test('the field suggests the sources in the registry, including one added by a module', async ({ foundryPage: page }) => {
    await page.evaluate(({ key, label }) => { CONFIG.MARVEL_MULTIVERSE.sources[key] = { label }; }, { key: TEST_KEY, label: TEST_LABEL });
    const sheet = await openItem(page);
    const suggestions = await sheet.locator('input[name="system.source"]')
      .evaluate(input => [...input.list.options].map(o => o.value));
    const labels = await page.evaluate(() => Object.values(CONFIG.MARVEL_MULTIVERSE.sources).map(s => s.label));
    expect(labels).toContain(TEST_LABEL);
    expect(suggestions).toEqual(labels);
  });

  for (const type of ['character', 'headquarters']) {
    test(`the ${type} sheet stores the key of a registered source and keeps typed text`, async ({ foundryPage: page }) => {
      const { key, label } = await registeredSource(page);
      const sheet = await openWith(page, 'Actor', { name: ACTOR_NAME, type });
      await typeSource(sheet, label);
      await expect.poll(() => storedSource(page, 'Actor', ACTOR_NAME)).toBe(key);
      await expect(sheet.locator('input[name="system.source"]')).toHaveValue(label);

      await typeSource(sheet, 'My Own Zine');
      await expect.poll(() => storedSource(page, 'Actor', ACTOR_NAME)).toBe('My Own Zine');
    });
  }

  test('the item directory can filter by a typed source', async ({ foundryPage: page }) => {
    const ids = await page.evaluate(async ({ zine, other }) => {
      const a = await Item.create({ name: zine, type: 'trait', system: { source: 'E2E Typed Zine' } });
      const b = await Item.create({ name: other, type: 'trait', system: { source: 'core' } });
      const wasExpanded = ui.sidebar.expanded;
      ui.sidebar.expand();
      ui.sidebar.changeTab('items', 'primary');
      await ui.items.render({ force: true });
      return { zine: a.id, other: b.id, wasExpanded };
    }, { zine: ITEM_NAME, other: OTHER_ITEM_NAME });

    const directory = page.locator('#items');
    const entry = (id) => directory.locator(`.directory-item[data-entry-id="${id}"]`);
    await expect(entry(ids.zine)).toBeVisible();
    await expect(entry(ids.other)).toBeVisible();

    await directory.locator('.mm-filter-toggle').click();
    await directory.locator('[data-group="source"] .mm-filter-group-header').click();
    await directory.locator('.mm-filter-checkbox[data-filter="source"][value="E2E Typed Zine"]').check({ timeout: 10000 });
    await expect(entry(ids.other)).toBeHidden();
    await expect(entry(ids.zine)).toBeVisible();

    await directory.locator('.mm-filter-clear').click();
    await expect(entry(ids.other)).toBeVisible();
    if (!ids.wasExpanded) await page.evaluate(() => ui.sidebar.collapse());
  });
});
