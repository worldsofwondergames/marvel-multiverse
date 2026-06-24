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
 * Regression tests for upstream issue mjording/marvel-multiverse#93:
 * Weapon damage multiplier bonuses were not being applied to damage output.
 */

const ACTOR_NAME = 'E2E Weapon DM Test';
const SCENE_NAME = 'E2E Weapon DM Scene';

test.describe('Weapon Damage Multiplier (Issue #93)', () => {

  test.beforeEach(async ({ foundryPage }) => {
    await clearChatMessages(foundryPage);
    await dismissNotifications(foundryPage);
  });

  test.afterEach(async ({ foundryPage }) => {
    await deleteActor(foundryPage, ACTOR_NAME);
    await deleteScene(foundryPage, SCENE_NAME);
  });

  test('weapon damageMultiplierBonus stored on item', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME);
    await updateActorData(page, ACTOR_NAME, {
      'system.attributes.rank.value': 3,
      'system.abilities.mle.value': 5,
    });

    const weaponId = await page.evaluate(async (actorName) => {
      const actor = game.actors.find(a => a.name === actorName);
      const [weapon] = await actor.createEmbeddedDocuments('Item', [{
        name: 'Test Mighty Sword',
        type: 'weapon',
        system: {
          damageMultiplierBonus: '2',
          attackTarget: 'mle',
          damageType: 'health',
        },
      }]);
      return weapon.id;
    }, ACTOR_NAME);

    const bonus = await page.evaluate(({ actorName, weaponId }) => {
      const actor = game.actors.find(a => a.name === actorName);
      const weapon = actor.items.get(weaponId);
      return weapon.system.damageMultiplierBonus;
    }, { actorName: ACTOR_NAME, weaponId });

    expect(bonus).toBe('2');
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

  test('weapon attackMultiplier field is persisted', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME);

    const multiplier = await page.evaluate(async (actorName) => {
      const actor = game.actors.find(a => a.name === actorName);
      const [weapon] = await actor.createEmbeddedDocuments('Item', [{
        name: 'Heavy Blaster',
        type: 'weapon',
        system: {
          attackMultiplier: 3,
          attackTarget: 'agl',
          damageType: 'health',
        },
      }]);
      return weapon.system.attackMultiplier;
    }, ACTOR_NAME);

    expect(multiplier).toBe(3);
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
