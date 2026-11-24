import { test, expect } from './fixtures.mjs';
import {
  createActorViaAPI,
  updateActorData,
  getActorSystemData,
  createActiveEffect,
  deleteActor,
  createScene,
  activateScene,
  deleteScene,
  triggerAbilityRoll,
  clickDamageButton,
  getLastChatMessage,
  clearChatMessages,
  dismissNotifications,
} from './helpers.mjs';

/**
 * Weapon damage multiplier bonuses. Upstream issue mjording/marvel-multiverse#93
 * and issue #177: the bonus on a weapon was stored and never applied.
 */

const ACTOR_NAME = 'E2E Weapon DM Test';
const SCENE_NAME = 'E2E Weapon DM Scene';
const WEAPON_NAME = 'E2E Blade';

/**
 * Create a rank 2 character with Melee 3 that owns a weapon with the given
 * stored bonus.
 */
async function createArmedActor(page, bonus) {
  await createActorViaAPI(page, ACTOR_NAME);
  await updateActorData(page, ACTOR_NAME, {
    'system.attributes.rank.value': 2,
    'system.abilities.mle.value': 3,
  });
  await page.evaluate(async ({ actorName, weaponName, bonus }) => {
    const actor = game.actors.find(a => a.name === actorName);
    await actor.createEmbeddedDocuments('Item', [{
      name: weaponName,
      type: 'weapon',
      system: { ability: 'mle', attack: true, damageMultiplierBonus: bonus, attackTarget: 'mle', damageType: 'health' },
    }]);
  }, { actorName: ACTOR_NAME, weaponName: WEAPON_NAME, bonus });
}

function meleeEffect(value) {
  return {
    name: `Melee +${value}`,
    changes: [{ key: 'system.abilities.mle.damageMultiplier', mode: 2, value: String(value) }],
  };
}

/** The Marvel die of the newest roll message, counting M as 6 the way damage does. */
function lastMarvelDie(page) {
  return page.evaluate(() => {
    const rolled = game.messages.contents.filter(m => m.rolls.length);
    return rolled[rolled.length - 1].rolls[0].terms[0].rolls[1].dice[0].total;
  });
}

/**
 * Attack with the weapon, click Damage, and return the damage card's text with
 * the Marvel die that was rolled.
 */
async function attackWithWeapon(page) {
  await page.evaluate(({ actorName, weaponName }) => {
    const actor = game.actors.find(a => a.name === actorName);
    return actor.items.getName(weaponName).roll();
  }, { actorName: ACTOR_NAME, weaponName: WEAPON_NAME });
  await expect.poll(() => page.evaluate(() => game.messages.contents.filter(m => m.rolls.length).length)).toBe(1);
  const die = await lastMarvelDie(page);
  await clickDamageButton(page);
  const msg = await getLastChatMessage(page);
  return { content: msg.content, die };
}

/** Assert the card used this multiplier, both in its breakdown and in its total. */
function expectMultiplier({ content, die }, multiplier, abilityValue = 3) {
  expect(content).toContain(`× Multiplier ${multiplier})`);
  const dealt = /Deals <b[^>]*>(\d+)( Fantastic)?/.exec(content);
  expect(dealt).not.toBeNull();
  const total = (die * multiplier + abilityValue) * (dealt[2] ? 2 : 1);
  expect(Number(dealt[1])).toBe(total);
}

test.describe('Weapon Damage Multiplier (Issue #93)', () => {

  test.beforeEach(async ({ foundryPage }) => {
    await clearChatMessages(foundryPage);
    await dismissNotifications(foundryPage);
  });

  test.afterEach(async ({ foundryPage }) => {
    await deleteActor(foundryPage, ACTOR_NAME);
    await deleteScene(foundryPage, SCENE_NAME);
  });

  test('an attack with a +2 weapon adds 2 to the multiplier', async ({ foundryPage: page }) => {
    await createArmedActor(page, '+2');

    expectMultiplier(await attackWithWeapon(page), 4);
  });

  test('a higher effect bonus is used and the weapon is not added', async ({ foundryPage: page }) => {
    await createArmedActor(page, '+2');
    await createActiveEffect(page, ACTOR_NAME, meleeEffect(3));

    expectMultiplier(await attackWithWeapon(page), 5);
  });

  test('a lower effect bonus is not added to the weapon', async ({ foundryPage: page }) => {
    await createArmedActor(page, '+2');
    await createActiveEffect(page, ACTOR_NAME, meleeEffect(1));

    expectMultiplier(await attackWithWeapon(page), 4);
  });

  test('an ability roll made without the weapon ignores its bonus', async ({ foundryPage: page }) => {
    await createArmedActor(page, '+2');
    await createActiveEffect(page, ACTOR_NAME, meleeEffect(1));

    await triggerAbilityRoll(page, ACTOR_NAME, 'mle');
    const die = await lastMarvelDie(page);
    await clickDamageButton(page);
    const msg = await getLastChatMessage(page);

    expectMultiplier({ content: msg.content, die }, 3);
  });

  test('the weapon row on the sheet shows the bonus stored on the weapon', async ({ foundryPage: page }) => {
    await createArmedActor(page, '+2');
    await page.evaluate(async ({ actorName, weaponName }) => {
      const actor = game.actors.find(a => a.name === actorName);
      await actor.items.getName(weaponName).update({ 'system.damageMultiplierBonus': '+3' });
      await actor.sheet.render(true);
    }, { actorName: ACTOR_NAME, weaponName: WEAPON_NAME });

    const sheet = page.locator('.sheet.actor').last();
    await sheet.locator('.sheet-tabs a[data-tab="gear"]').click();
    await expect(sheet.locator('.mm-weapon-bonus')).toHaveText(/\+3$/);
  });

  test('AE from weapon increases actor damage multiplier', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME);
    await updateActorData(page, ACTOR_NAME, {
      'system.attributes.rank.value': 3,
      'system.abilities.mle.value': 5,
    });

    let sys = await getActorSystemData(page, ACTOR_NAME);
    expect(sys.abilities.mle.damageMultiplier).toBe(3);

    await createActiveEffect(page, ACTOR_NAME, {
      name: 'Mighty Weapon Bonus',
      changes: [{
        key: 'system.abilities.mle.damageMultiplier',
        mode: 2,
        value: '2',
      }],
    });

    sys = await getActorSystemData(page, ACTOR_NAME);
    expect(sys.abilities.mle.damageMultiplier).toBe(5);
  });

  test('damage output reflects increased multiplier from weapon AE', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME);
    await updateActorData(page, ACTOR_NAME, {
      'system.attributes.rank.value': 3,
      'system.abilities.mle.value': 4,
    });

    await createActiveEffect(page, ACTOR_NAME, {
      name: 'Mighty 2',
      changes: [{
        key: 'system.abilities.mle.damageMultiplier',
        mode: 2,
        value: '2',
      }],
    });

    const sys = await getActorSystemData(page, ACTOR_NAME);
    expect(sys.abilities.mle.damageMultiplier).toBe(5);

    await createScene(page, SCENE_NAME);
    await activateScene(page, SCENE_NAME);

    await triggerAbilityRoll(page, ACTOR_NAME, 'mle');
    await clickDamageButton(page);

    const msg = await getLastChatMessage(page);
    expect(msg).not.toBeNull();
    expect(msg.content.toLowerCase()).toContain('damage');
    expect(msg.content).toContain('5');
  });

  test('multiple weapon AE bonuses on same ability use highest only', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME);
    await updateActorData(page, ACTOR_NAME, {
      'system.attributes.rank.value': 2,
    });

    await createActiveEffect(page, ACTOR_NAME, {
      name: 'Weapon Mighty 3',
      changes: [{
        key: 'system.abilities.mle.damageMultiplier',
        mode: 2,
        value: '3',
      }],
    });

    await createActiveEffect(page, ACTOR_NAME, {
      name: 'Weapon Mighty 1',
      changes: [{
        key: 'system.abilities.mle.damageMultiplier',
        mode: 2,
        value: '1',
      }],
    });

    const sys = await getActorSystemData(page, ACTOR_NAME);
    expect(sys.abilities.mle.damageMultiplier).toBe(5);
  });
});
