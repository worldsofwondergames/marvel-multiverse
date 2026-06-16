import { test, expect } from './fixtures.mjs';
import {
  createActorViaAPI,
  updateActorData,
  createActiveEffect,
  deleteActor,
  createScene,
  activateScene,
  placeToken,
  targetToken,
  clearTargets,
  deleteScene,
  triggerAbilityRoll,
  clickDamageButton,
  getLastChatMessage,
  clearChatMessages,
  dismissNotifications,
} from './helpers.mjs';

const ATTACKER = 'E2E Attacker';
const DEFENDER = 'E2E Defender';
const SCENE_NAME = 'E2E Damage Scene';

test.describe('Damage Calculation', () => {

  test.beforeEach(async ({ foundryPage }) => {
    await clearChatMessages(foundryPage);
    await dismissNotifications(foundryPage);
  });

  test.afterEach(async ({ foundryPage }) => {
    await clearTargets(foundryPage);
    await deleteActor(foundryPage, ATTACKER);
    await deleteActor(foundryPage, DEFENDER);
    await deleteScene(foundryPage, SCENE_NAME);
  });

  test('damage button produces formula breakdown in chat', async ({ foundryPage }) => {
    const page = foundryPage;

    await createActorViaAPI(page, ATTACKER);
    await updateActorData(page, ATTACKER, {
      'system.abilities.mle.value': 5,
      'system.attributes.rank.value': 3,
    });

    // Scene is required — damage handler accesses canvas.tokens
    await createScene(page, SCENE_NAME);
    await activateScene(page, SCENE_NAME);

    await triggerAbilityRoll(page, ATTACKER, 'mle');
    await clickDamageButton(page);

    const msg = await getLastChatMessage(page);
    expect(msg).not.toBeNull();
    const combined = msg.content.toLowerCase();
    // Should contain damage output with multiplier and ability reference
    expect(combined).toContain('damage');
    expect(combined).toContain('multiplier');
  });

  test('damage with targeted token shows per-target damage', async ({ foundryPage }) => {
    const page = foundryPage;

    await createActorViaAPI(page, ATTACKER);
    await updateActorData(page, ATTACKER, {
      'system.abilities.mle.value': 3,
      'system.attributes.rank.value': 2,
    });

    await createActorViaAPI(page, DEFENDER);
    await updateActorData(page, DEFENDER, {
      'system.abilities.mle.value': 1,
    });

    await createScene(page, SCENE_NAME);
    await activateScene(page, SCENE_NAME);
    await placeToken(page, ATTACKER, 200, 200);
    await placeToken(page, DEFENDER, 400, 200);
    await targetToken(page, DEFENDER);

    await triggerAbilityRoll(page, ATTACKER, 'mle');
    await clickDamageButton(page);

    const msg = await getLastChatMessage(page);
    expect(msg).not.toBeNull();
    // Target name should appear in damage output
    expect(msg.content).toContain(DEFENDER);
    expect(msg.content.toLowerCase()).toContain('damage');
  });

  test('damage reduction reduces multiplier in output', async ({ foundryPage }) => {
    const page = foundryPage;

    await createActorViaAPI(page, ATTACKER);
    await updateActorData(page, ATTACKER, {
      'system.abilities.mle.value': 4,
      'system.attributes.rank.value': 3,
    });

    await createActorViaAPI(page, DEFENDER);
    await createActiveEffect(page, DEFENDER, {
      name: 'Sturdy 2',
      changes: [{ key: 'system.healthDamageReduction', mode: 2, value: '2' }],
    });

    await createScene(page, SCENE_NAME);
    await activateScene(page, SCENE_NAME);
    await placeToken(page, ATTACKER, 200, 200);
    await placeToken(page, DEFENDER, 400, 200);
    await targetToken(page, DEFENDER);

    await triggerAbilityRoll(page, ATTACKER, 'mle');
    await clickDamageButton(page);

    const msg = await getLastChatMessage(page);
    expect(msg).not.toBeNull();
    // Should show DR subtraction in the breakdown
    expect(msg.content).toContain('DR');
    expect(msg.content).toContain(DEFENDER);
  });

  test('focus damage type uses focusDamageReduction', async ({ foundryPage }) => {
    const page = foundryPage;

    await createActorViaAPI(page, ATTACKER);
    await updateActorData(page, ATTACKER, {
      'system.abilities.ego.value': 3,
      'system.attributes.rank.value': 2,
    });

    await createActorViaAPI(page, DEFENDER);
    await createActiveEffect(page, DEFENDER, {
      name: 'Mental Shield',
      changes: [{ key: 'system.focusDamageReduction', mode: 2, value: '1' }],
    });

    await createScene(page, SCENE_NAME);
    await activateScene(page, SCENE_NAME);
    await placeToken(page, ATTACKER, 200, 200);
    await placeToken(page, DEFENDER, 400, 200);
    await targetToken(page, DEFENDER);

    // Trigger an Ego roll with focus damage type
    await page.evaluate(async ({ actorName }) => {
      const actor = game.actors.find(a => a.name === actorName);
      const roll = new CONFIG.Dice.MarvelMultiverseRoll(
        '{1d6,1dm,1d6}+@abilities.ego.value',
        actor.getRollData(),
      );
      const speaker = ChatMessage.getSpeaker({ actor });
      const flavor = '[ability] Ego [damageType] focus';
      await roll.toMessage({ speaker, flavor, rollMode: 'publicroll' });
    }, { actorName: ATTACKER });
    await page.waitForTimeout(2000);

    await clickDamageButton(page);

    const msg = await getLastChatMessage(page);
    expect(msg).not.toBeNull();
    expect(msg.content).toContain(DEFENDER);
    expect(msg.content.toLowerCase()).toContain('focus');
  });
});
