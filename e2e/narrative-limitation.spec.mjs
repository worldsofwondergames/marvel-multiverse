import { test, expect } from './fixtures.mjs';
import { createActorViaAPI, deleteActor, dismissNotifications } from './helpers.mjs';

/**
 * Issue #142. A Narrative Limitation is an item with a name, a description,
 * and a source. Characters and NPCs list theirs after their powers.
 */

const ACTOR = 'E2E Limitation Actor';
const WORLD_ITEM = 'E2E Limitation World Item';
const TYPE = 'narrativeLimitation';

const SECTION = '.mm-narrative-limitations';

/** Add limitations to the actor straight through the API. */
const addLimitations = (page, entries) => page.evaluate(async ({ actorName, entries, type }) => {
  const actor = game.actors.find(a => a.name === actorName);
  await actor.createEmbeddedDocuments('Item', entries.map(e => ({ ...e, type })));
}, { actorName: ACTOR, entries, type: TYPE });

/** Open the actor's sheet and return a locator for it. */
async function openSheet(page) {
  const id = await page.evaluate(async (name) => {
    const actor = game.actors.find(a => a.name === name);
    await actor.sheet._render(true);
    return actor.sheet.id;
  }, ACTOR);
  return page.locator(`#${id}`);
}

/** The names the actor's limitations have, straight from the document. */
const limitationNames = (page) => page.evaluate(({ name, type }) =>
  game.actors.find(a => a.name === name).items.filter(i => i.type === type).map(i => i.name),
{ name: ACTOR, type: TYPE });

async function cleanUp(page) {
  await deleteActor(page, ACTOR);
  await page.evaluate(async (name) => {
    const doomed = game.items.filter(i => i.name === name);
    if (doomed.length) await Item.deleteDocuments(doomed.map(i => i.id));
  }, WORLD_ITEM);
}

test.describe('Narrative Limitation item type (Issue #142)', () => {
  test.beforeEach(async ({ foundryPage: page }) => {
    await dismissNotifications(page);
    await cleanUp(page);
  });

  test.afterEach(async ({ foundryPage: page }) => {
    await cleanUp(page);
  });

  test('a limitation keeps its description and source, and edits on its sheet are saved', async ({ foundryPage: page }) => {
    const item = await page.evaluate(async ({ name, type }) => {
      const created = await Item.create({
        name, type, system: { description: '<p>Only at night.</p>', source: 'Homebrew' },
      });
      await created.sheet._render(true);
      return { id: created.id, sheetId: created.sheet.id, template: created.sheet.template, system: { ...created.system } };
    }, { name: WORLD_ITEM, type: TYPE });

    expect(item.system.description).toBe('<p>Only at night.</p>');
    expect(item.system.source).toBe('Homebrew');
    expect(item.template).toContain(`item-${TYPE}-sheet.hbs`);

    const sheet = page.locator(`#${item.sheetId}`);
    const source = sheet.locator('[name="system.source"]');
    await expect(source).toHaveValue('Homebrew');
    await source.fill('Other');
    await source.blur();
    await expect.poll(() => page.evaluate((id) => game.items.get(id).system.source, item.id)).toBe('Other');
  });

  for (const actorType of ['character', 'npc']) {
    test(`a ${actorType} sheet lists its limitations by name and hides the section when there are none`, async ({ foundryPage: page }) => {
      await createActorViaAPI(page, ACTOR, actorType);
      await addLimitations(page, [{ name: 'Zeta Limit' }, { name: 'Alpha Limit' }]);
      const sheet = await openSheet(page);

      const rows = sheet.locator(`${SECTION} .mm-item .item-name`);
      await expect(rows).toHaveText(['Alpha Limit', 'Zeta Limit']);

      await sheet.locator(`${SECTION} .mm-item`).first().locator('.item-delete').click();
      await expect(rows).toHaveText(['Zeta Limit']);
      await sheet.locator(`${SECTION} .mm-item`).first().locator('.item-delete').click();
      await expect(sheet.locator('.mm-item-list').first()).toBeAttached();
      await expect(sheet.locator(SECTION)).toHaveCount(0);
      expect(await limitationNames(page)).toEqual([]);
    });

    test(`dropping a limitation on a ${actorType} sheet adds it, and the add control makes another`, async ({ foundryPage: page }) => {
      await createActorViaAPI(page, ACTOR, actorType);
      const sheet = await openSheet(page);
      await page.evaluate(async ({ actorName, name, type }) => {
        const item = await Item.create({ name, type });
        const actor = game.actors.find(a => a.name === actorName);
        await actor.sheet._onDropItem(new DragEvent('drop'), { type: 'Item', uuid: item.uuid });
      }, { actorName: ACTOR, name: WORLD_ITEM, type: TYPE });

      await expect(sheet.locator(`${SECTION} .mm-item .item-name`)).toHaveText([WORLD_ITEM]);

      await sheet.locator(`${SECTION} .item-create`).click();
      await expect(sheet.locator(`${SECTION} .mm-item`)).toHaveCount(2);
      const typeLabel = await page.evaluate((type) => game.i18n.localize(`TYPES.Item.${type}`), TYPE);
      const added = (await limitationNames(page)).filter(n => n !== WORLD_ITEM);
      expect(added).toEqual([await page.evaluate((label) => game.i18n.format('DOCUMENT.New', { type: label }), typeLabel)]);
    });
  }

  test('a limitation row expands to its description and posts it to chat', async ({ foundryPage: page }) => {
    await createActorViaAPI(page, ACTOR);
    await addLimitations(page, [{ name: 'Night Only', system: { description: '<p>Only at night.</p>' } }]);
    const sheet = await openSheet(page);
    const row = sheet.locator(`${SECTION} .mm-item`);

    await row.locator('.item-expand').click();
    await expect(sheet.locator(`${SECTION} .mm-chat-description`)).toHaveText('Only at night.');

    const before = await page.evaluate(() => game.messages.size);
    await row.locator('.item-chat').click();
    await expect.poll(() => page.evaluate(() => game.messages.size)).toBe(before + 1);
    const card = await page.evaluate(() => game.messages.contents.at(-1).content);
    expect(card).toContain('Only at night.');
  });

  test('the type is registered with its data model and a label', async ({ foundryPage: page }) => {
    const labels = await page.evaluate((type) => ({
      inTypes: game.documentTypes.Item.includes(type),
      model: CONFIG.Item.dataModels[type]?.name,
      label: game.i18n.localize(`TYPES.Item.${type}`),
      key: `TYPES.Item.${type}`,
    }), TYPE);
    expect(labels.inTypes).toBe(true);
    expect(labels.model).toBe('MarvelMultiverseNarrativeLimitation');
    expect(labels.label).not.toBe(labels.key);
  });
});
