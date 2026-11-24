import { test, expect } from './fixtures.mjs';
import { createActorViaAPI, deleteActor, clearChatMessages } from './helpers.mjs';

/**
 * For issue #178, clicking an item's name on the actor sheet expands it in
 * place, and a separate control posts it to chat.
 */

const ACTOR_NAME = 'E2E Item Summary';
const POWER = {
  name: 'E2E Summary Power',
  type: 'power',
  system: {
    powerSet: 'Basic',
    action: 'Standard',
    description: '<p>A burst of test flavor.</p>',
    effect: '<p>The target makes an Ego check to resist.</p>',
  },
};
const TRAIT = {
  name: 'E2E Summary Trait',
  type: 'trait',
  system: { description: '<p>Always carries a spare test.</p>' },
};

/** Create the actor with one power and one trait and open its sheet. */
async function setup(page) {
  await createActorViaAPI(page, ACTOR_NAME);
  const ids = await page.evaluate(async ({ name, power, trait }) => {
    const actor = game.actors.find(a => a.name === name);
    // The created documents do not always come back in the order given.
    await actor.createEmbeddedDocuments('Item', [power, trait]);
    await actor.sheet.render(true);
    return { powerId: actor.items.getName(power.name).id, traitId: actor.items.getName(trait.name).id };
  }, { name: ACTOR_NAME, power: POWER, trait: TRAIT });
  const sheet = page.locator('.sheet.actor').last();
  await sheet.locator(`.item[data-item-id="${ids.powerId}"]`).waitFor();
  return { sheet, ...ids };
}

const row = (sheet, id) => sheet.locator(`.item[data-item-id="${id}"]`);
const summary = (sheet, id) => sheet.locator(`.mm-item-summary[data-summary-item-id="${id}"]`);
const messageCount = (page) => page.evaluate(() => game.messages.size);

/** A field of an item on the test actor, as plain text. */
function itemText(page, itemId, field) {
  return page.evaluate(({ name, itemId, field }) => {
    const item = game.actors.find(a => a.name === name).items.get(itemId);
    const el = document.createElement('div');
    el.innerHTML = item.system[field];
    return el.textContent.trim();
  }, { name: ACTOR_NAME, itemId, field });
}

test.describe('Expanding items on the actor sheet', () => {

  test.beforeEach(async ({ foundryPage }) => {
    await clearChatMessages(foundryPage);
  });

  test.afterEach(async ({ foundryPage }) => {
    await deleteActor(foundryPage, ACTOR_NAME);
  });

  test('clicking a name shows the item text and posts nothing to chat', async ({ foundryPage: page }) => {
    const { sheet, traitId } = await setup(page);

    await row(sheet, traitId).locator('.item-expand').click();

    await expect(summary(sheet, traitId)).toContainText(await itemText(page, traitId, 'description'));
    expect(await messageCount(page)).toBe(0);
  });

  test('a power summary shows its effect and its action', async ({ foundryPage: page }) => {
    const { sheet, powerId } = await setup(page);

    await row(sheet, powerId).locator('.item-expand').click();

    await expect(summary(sheet, powerId)).toContainText(await itemText(page, powerId, 'effect'));
    const action = await page.evaluate(({ name, id }) =>
      game.actors.find(a => a.name === name).items.get(id).system.action,
    { name: ACTOR_NAME, id: powerId });
    await expect(summary(sheet, powerId).locator('[data-meta="action"]')).toContainText(action);
  });

  test('the chat control posts the item card', async ({ foundryPage: page }) => {
    const { sheet, traitId } = await setup(page);

    await row(sheet, traitId).locator('.item-chat').click();

    await expect.poll(() => messageCount(page)).toBe(1);
    const flagged = await page.evaluate(() => game.messages.contents[0].getFlag('marvel-multiverse', 'itemId'));
    expect(flagged).toBe(traitId);
  });

  test('an expanded row stays expanded when the actor updates', async ({ foundryPage: page }) => {
    const { sheet, traitId } = await setup(page);
    await row(sheet, traitId).locator('.item-expand').click();
    await expect(summary(sheet, traitId)).toHaveCount(1);

    await page.evaluate(async (name) => {
      const actor = game.actors.find(a => a.name === name);
      await actor.update({ 'system.karma.value': actor.system.karma.value + 1 });
    }, ACTOR_NAME);
    await expect(sheet.locator('input[name="system.karma.value"]')).toHaveValue('1');

    await expect(summary(sheet, traitId)).toHaveCount(1);
  });

  test('a second click on the name removes the summary', async ({ foundryPage: page }) => {
    const { sheet, traitId } = await setup(page);
    const name = row(sheet, traitId).locator('.item-expand');

    await name.click();
    await expect(summary(sheet, traitId)).toHaveCount(1);

    await name.click();
    await expect(summary(sheet, traitId)).toHaveCount(0);
  });

  test('a roll link in the summary rolls with the power behind it', async ({ foundryPage: page }) => {
    const { sheet, powerId } = await setup(page);
    await row(sheet, powerId).locator('.item-expand').click();

    await summary(sheet, powerId).locator('a.mm-roll-link').click();

    await expect.poll(() => page.evaluate(() => game.messages.contents.filter(m => m.rolls.length).length)).toBe(1);
    // The flavor names the power only when the link found it among this actor's items.
    const flavor = await page.evaluate(() => game.messages.contents.find(m => m.rolls.length).flavor);
    expect(flavor).toContain(POWER.name);
  });
});
