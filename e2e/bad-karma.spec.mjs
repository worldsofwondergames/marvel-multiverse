import { test, expect } from './fixtures.mjs';
import {
  createActorViaAPI,
  deleteActor,
  dismissNotifications,
  getGameSetting,
  setGameSetting,
} from './helpers.mjs';

/**
 * Issue #182. With the Bad Karma setting on, a character with the Weird trait
 * can hold a Karma total below 0. Everyone else is held at 0.
 */

const ACTOR_NAME = 'E2E Bad Karma';

function setKarma(page, value) {
  return page.evaluate(async ({ name, value }) => {
    await game.actors.find(a => a.name === name).update({ 'system.karma.value': value });
  }, { name: ACTOR_NAME, value });
}

function karma(page) {
  return page.evaluate((name) => game.actors.find(a => a.name === name).system.karma.value, ACTOR_NAME);
}

/** Give the actor the Weird trait and return the item's id. */
function addWeird(page) {
  return page.evaluate(async (name) => {
    const actor = game.actors.find(a => a.name === name);
    const [item] = await actor.createEmbeddedDocuments('Item', [{ name: 'Weird', type: 'trait' }]);
    return item.id;
  }, ACTOR_NAME);
}

async function openSheet(page) {
  await page.evaluate(async (name) => {
    await game.actors.find(a => a.name === name).sheet._render(true);
  }, ACTOR_NAME);
  const sheet = page.locator('.sheet.actor').last();
  await expect(sheet.locator('input[name="system.karma.value"]')).toBeVisible();
  return sheet;
}

/** The Karma block's fill and the text colors of its number and label. */
function karmaColors(sheet) {
  return sheet.locator('.mm-karma-block').evaluate((block) => ({
    fill: getComputedStyle(block, '::before').backgroundColor,
    number: getComputedStyle(block.querySelector('input[name="system.karma.value"]')).color,
    label: getComputedStyle(block.querySelector('.mm-label')).color,
  }));
}

const WHITE = 'rgb(255, 255, 255)';
const BAD_FILL = 'rgb(139, 5, 2)';

test.describe('Bad Karma (Issue #182)', () => {
  let settingBefore;

  test.beforeEach(async ({ foundryPage: page }) => {
    await dismissNotifications(page);
    settingBefore = await getGameSetting(page, 'badKarmaEnabled');
    await setGameSetting(page, 'badKarmaEnabled', true);
    await createActorViaAPI(page, ACTOR_NAME);
    await setKarma(page, 3);
  });

  test.afterEach(async ({ foundryPage: page }) => {
    await deleteActor(page, ACTOR_NAME);
    await setGameSetting(page, 'badKarmaEnabled', settingBefore);
  });

  test('a character without the Weird trait is held at 0', async ({ foundryPage: page }) => {
    await setKarma(page, -2);
    expect(await karma(page)).toBe(0);
  });

  test('a character with the Weird trait can go below 0', async ({ foundryPage: page }) => {
    await addWeird(page);
    await setKarma(page, -2);
    expect(await karma(page)).toBe(-2);
  });

  test('a character with the Weird trait is held at 0 when the setting is off', async ({ foundryPage: page }) => {
    await addWeird(page);
    await setGameSetting(page, 'badKarmaEnabled', false);
    await setKarma(page, -2);
    expect(await karma(page)).toBe(0);
  });

  test('a total below 0 stays when the trait is removed, until Karma is edited again', async ({ foundryPage: page }) => {
    const id = await addWeird(page);
    await setKarma(page, -2);
    await page.evaluate(async ({ name, id }) => {
      await game.actors.find(a => a.name === name).deleteEmbeddedDocuments('Item', [id]);
    }, { name: ACTOR_NAME, id });
    expect(await karma(page)).toBe(-2);

    await setKarma(page, -1);
    expect(await karma(page)).toBe(0);
  });

  test('typing a total below 0 on the sheet turns the Karma block dark red with white text, and 0 turns it back', async ({ foundryPage: page }) => {
    await addWeird(page);
    const sheet = await openSheet(page);
    const normal = await karmaColors(sheet);
    const input = sheet.locator('input[name="system.karma.value"]');

    await input.fill('-3');
    await input.press('Tab');
    await expect.poll(() => karma(page)).toBe(-3);
    await expect.poll(() => karmaColors(sheet)).toEqual({ fill: BAD_FILL, number: WHITE, label: WHITE });

    await input.fill('0');
    await input.press('Tab');
    await expect.poll(() => karma(page)).toBe(0);
    await expect.poll(() => karmaColors(sheet)).toEqual(normal);
  });

  test('typing a total below 0 on the sheet of a character without the trait shows 0', async ({ foundryPage: page }) => {
    const sheet = await openSheet(page);
    const input = sheet.locator('input[name="system.karma.value"]');
    await input.fill('-3');
    await input.press('Tab');
    await expect(input).toHaveValue('0');
    expect(await karma(page)).toBe(0);
  });
});
