import { test, expect } from './fixtures.mjs';
import {
  createActorViaAPI,
  updateActorData,
  deleteActor,
  clickDamageButton,
  getLastChatMessage,
  clearChatMessages,
  dismissNotifications,
} from './helpers.mjs';

/**
 * Issue #172. A battle suit's modifiers and an iconic weapon's damage
 * multiplier bonus have to reach the actor that owns the item.
 */

const ACTOR_NAME = 'E2E Iconic Modifiers';
const SUIT_NAME = 'E2E Modifier Suit';
const WEAPON_NAME = 'E2E Iconic Weapon';

/** Add an item to the actor and return its id. */
function addItem(page, itemData) {
  return page.evaluate(async ({ name, itemData }) => {
    const actor = game.actors.find(a => a.name === name);
    const [item] = await actor.createEmbeddedDocuments('Item', [itemData]);
    return item.id;
  }, { name: ACTOR_NAME, itemData });
}

function updateItem(page, itemId, update) {
  return page.evaluate(async ({ name, itemId, update }) => {
    await game.actors.find(a => a.name === name).items.get(itemId).update(update);
  }, { name: ACTOR_NAME, itemId, update });
}

/** The actor's Melee, Agility, and rank as its sheet would show them. */
function stats(page) {
  return page.evaluate((name) => {
    const system = game.actors.find(a => a.name === name).system;
    return { mle: system.abilities.mle.value, agl: system.abilities.agl.value, rank: system.attributes.rank.value };
  }, ACTOR_NAME);
}

/** How many of the actor's effects belong to a battle suit. */
function suitEffectCount(page, itemId) {
  return page.evaluate(({ name, itemId }) =>
    game.actors.find(a => a.name === name).effects
      .filter(e => e.flags?.['marvel-multiverse']?.battleSuitId === itemId).length,
  { name: ACTOR_NAME, itemId });
}

function suit(abilityModifiers, extra = {}) {
  return { name: SUIT_NAME, type: 'battleSuit', system: { abilityModifiers, ...extra } };
}

function iconicWeapon(weaponData) {
  return { name: WEAPON_NAME, type: 'iconicItem', system: { weaponData: { isWeapon: true, ...weaponData } } };
}

/** Open the sheet on the gear tab and wait for a row of the given kind. */
async function openGear(page, row = '.mm-actor-iconic-item') {
  await page.evaluate(async (name) => {
    await game.actors.find(a => a.name === name).sheet.render(true);
  }, ACTOR_NAME);
  const sheet = page.locator('.sheet.actor').last();
  await sheet.locator('.sheet-tabs a[data-tab="gear"]').click();
  await expect(sheet.locator(row)).toBeVisible();
  return sheet;
}

/** The modes of the attack controls on the iconic item's row, in order. */
function attackModes(sheet) {
  return sheet.locator('.mm-actor-iconic-item a.mm-iconic-attack')
    .evaluateAll(els => els.map(el => el.dataset.weaponMode));
}

/** Click an attack control, then Damage, and return the damage card with the Marvel die rolled. */
async function attack(page, sheet, mode) {
  await sheet.locator(`a.mm-iconic-attack[data-weapon-mode="${mode}"]`).click({ timeout: 10000 });
  await expect.poll(() => page.evaluate(() => game.messages.contents.filter(m => m.rolls.length).length)).toBe(1);
  const die = await page.evaluate(() => {
    const rolled = game.messages.contents.filter(m => m.rolls.length);
    return rolled[rolled.length - 1].rolls[0].terms[0].rolls[1].dice[0].total;
  });
  await clickDamageButton(page);
  const msg = await getLastChatMessage(page);
  return { content: msg.content, die };
}

/** Assert the card used this multiplier and ability score, in its breakdown and in its total. */
function expectDamage({ content, die }, multiplier, abilityValue) {
  expect(content).toContain(`× Multiplier ${multiplier})`);
  const dealt = /Deals <b[^>]*>(\d+)( Fantastic)?/.exec(content);
  expect(dealt).not.toBeNull();
  expect(Number(dealt[1])).toBe((die * multiplier + abilityValue) * (dealt[2] ? 2 : 1));
}

test.describe('Iconic item modifiers reach the actor (Issue #172)', () => {

  test.beforeEach(async ({ foundryPage: page }) => {
    await clearChatMessages(page);
    await dismissNotifications(page);
    await createActorViaAPI(page, ACTOR_NAME);
    await updateActorData(page, ACTOR_NAME, {
      'system.attributes.rank.value': 2,
      'system.abilities.mle.value': 3,
      'system.abilities.agl.value': 1,
    });
  });

  test.afterEach(async ({ foundryPage: page }) => {
    await deleteActor(page, ACTOR_NAME);
  });

  test('editing an equipped suit changes the actor to match', async ({ foundryPage: page }) => {
    const id = await addItem(page, suit({ melee: 2 }, { rankIncrease: 1 }));
    await updateItem(page, id, { 'system.equipped': true });
    await expect.poll(() => stats(page)).toEqual({ mle: 5, agl: 1, rank: 3 });

    await updateItem(page, id, { 'system.abilityModifiers.melee': 4, 'system.abilityModifiers.agility': -1, 'system.rankIncrease': 2 });
    await expect.poll(() => stats(page)).toEqual({ mle: 7, agl: 0, rank: 4 });
    expect(await suitEffectCount(page, id)).toBe(1);
  });

  test('clearing an equipped suit\'s modifiers puts the actor back', async ({ foundryPage: page }) => {
    const id = await addItem(page, suit({ melee: 2 }));
    await updateItem(page, id, { 'system.equipped': true });
    await expect.poll(() => stats(page)).toEqual({ mle: 5, agl: 1, rank: 2 });

    await updateItem(page, id, { 'system.abilityModifiers.melee': 0 });
    await expect.poll(() => stats(page)).toEqual({ mle: 3, agl: 1, rank: 2 });
    expect(await suitEffectCount(page, id)).toBe(0);
  });

  test('a suit added as equipped applies its modifiers', async ({ foundryPage: page }) => {
    await addItem(page, suit({ agility: 3 }, { equipped: true }));
    await expect.poll(() => stats(page)).toEqual({ mle: 3, agl: 4, rank: 2 });
  });

  test('a suit added as equipped comes off when the actor already wears one', async ({ foundryPage: page }) => {
    await addItem(page, suit({ melee: 2 }, { equipped: true }));
    await expect.poll(() => stats(page)).toEqual({ mle: 5, agl: 1, rank: 2 });

    const second = await addItem(page, { ...suit({ agility: 3 }, { equipped: true }), name: 'E2E Second Suit' });
    const equipped = await page.evaluate(({ name, id }) =>
      game.actors.find(a => a.name === name).items.get(id).system.equipped, { name: ACTOR_NAME, id: second });
    expect(equipped).toBe(false);
    expect(await stats(page)).toEqual({ mle: 5, agl: 1, rank: 2 });
  });

  test('clicking the equip toggle on the sheet applies the suit, and clicking again takes it off', async ({ foundryPage: page }) => {
    await addItem(page, suit({ melee: 2 }, { rankIncrease: 1 }));
    const sheet = await openGear(page, '.mm-actor-battlesuit');

    await sheet.locator('.battlesuit-equip-toggle').click({ timeout: 10000 });
    await expect.poll(() => stats(page)).toEqual({ mle: 5, agl: 1, rank: 3 });

    await sheet.locator('.battlesuit-equip-toggle').click({ timeout: 10000 });
    await expect.poll(() => stats(page)).toEqual({ mle: 3, agl: 1, rank: 2 });
  });

  test('the ownership select on the row of an iconic item can be used', async ({ foundryPage: page }) => {
    const id = await addItem(page, iconicWeapon({ meleeRange: 'Reach' }));
    const sheet = await openGear(page);
    // Choosing an option by script works on a covered select, so first check
    // that a click would reach it.
    await sheet.locator('.iconic-ownership-toggle').click({ trial: true, timeout: 10000 });
    await sheet.locator('.iconic-ownership-toggle').selectOption('borrowed');
    await expect.poll(() => page.evaluate(({ name, id }) =>
      game.actors.find(a => a.name === name).items.get(id).system.ownershipMode, { name: ACTOR_NAME, id })).toBe('borrowed');
  });

  test('the row offers an attack for each mode the item has, and none when it is not a weapon', async ({ foundryPage: page }) => {
    const id = await addItem(page, iconicWeapon({ meleeRange: 'Reach', meleeDamageMultiplierBonus: 2 }));
    const sheet = await openGear(page);
    await expect.poll(() => attackModes(sheet)).toEqual(['melee']);

    await updateItem(page, id, { 'system.weaponData.rangedRange': '10' });
    await expect.poll(() => attackModes(sheet)).toEqual(['melee', 'ranged']);

    await updateItem(page, id, { 'system.weaponData.isWeapon': false });
    await expect.poll(() => attackModes(sheet)).toEqual([]);
  });

  test('the row shows the bonus stored on the item', async ({ foundryPage: page }) => {
    const id = await addItem(page, iconicWeapon({ meleeRange: 'Reach', meleeDamageMultiplierBonus: 2 }));
    const sheet = await openGear(page);
    const info = sheet.locator('.mm-iconic-attack-info[data-weapon-mode="melee"]');
    await expect(info).toContainText('+2');

    await updateItem(page, id, { 'system.weaponData.meleeDamageMultiplierBonus': 3 });
    await expect(info).toContainText('+3');
  });

  test('a melee attack adds the melee bonus to the multiplier and uses Melee', async ({ foundryPage: page }) => {
    await addItem(page, iconicWeapon({ meleeRange: 'Reach', rangedRange: '10', meleeDamageMultiplierBonus: 2, rangedDamageMultiplierBonus: 3 }));
    const sheet = await openGear(page);
    expectDamage(await attack(page, sheet, 'melee'), 4, 3);
  });

  test('a ranged attack adds the ranged bonus to the multiplier and uses Agility', async ({ foundryPage: page }) => {
    await addItem(page, iconicWeapon({ meleeRange: 'Reach', rangedRange: '10', meleeDamageMultiplierBonus: 2, rangedDamageMultiplierBonus: 3 }));
    const sheet = await openGear(page);
    expectDamage(await attack(page, sheet, 'ranged'), 5, 1);
  });
});
