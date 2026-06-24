import { test, expect } from './fixtures.mjs';
import {
  createActorViaAPI,
  updateActorData,
  getActorSystemData,
  createActiveEffect,
  deleteActor,
  createScene,
  activateScene,
  placeToken,
  targetToken,
  clearTargets,
  deleteScene,
  clickDamageButton,
  getLastChatMessage,
  clearChatMessages,
  dismissNotifications,
} from './helpers.mjs';

/**
 * Regression tests for upstream issues mjording/marvel-multiverse#91 and #89:
 * NPC damage was not being calculated, and clicking the damage button
 * for NPC rolls produced errors.
 */

const NPC_NAME = 'E2E NPC Damage Test';
const DEFENDER_NAME = 'E2E NPC Damage Defender';
const SCENE_NAME = 'E2E NPC Damage Scene';

async function triggerNpcAbilityRoll(page, actorName, abilityKey) {
  await page.evaluate(async ({ actorName, abilityKey }) => {
    const actor = game.actors.find(a => a.name === actorName);
    if (!actor) throw new Error(`Actor "${actorName}" not found`);
    const ability = actor.system.abilities[abilityKey];
    if (!ability) throw new Error(`Ability "${abilityKey}" not found`);
    const abilityLabels = { mle: 'Melee', agl: 'Agility', res: 'Resilience', vig: 'Vigilance', ego: 'Ego', log: 'Logic' };
    const label = abilityLabels[abilityKey] || abilityKey;
    const roll = new CONFIG.Dice.MarvelMultiverseRoll(
      `{1d6,1dm,1d6}+@abilities.${abilityKey}.value`,
      actor.getRollData(),
    );
    const speaker = ChatMessage.getSpeaker({ actor });
    const flavor = `[ability] ${label}`;
    await roll.toMessage({ speaker, flavor, rollMode: 'publicroll' });
  }, { actorName, abilityKey });
  await page.waitForTimeout(2000);
}

test.describe('NPC Damage Calculation (Issues #91, #89)', () => {

  test.beforeEach(async ({ foundryPage }) => {
    await clearChatMessages(foundryPage);
    await dismissNotifications(foundryPage);
  });

  test.afterEach(async ({ foundryPage }) => {
    await clearTargets(foundryPage);
    await deleteActor(foundryPage, NPC_NAME);
    await deleteActor(foundryPage, DEFENDER_NAME);
    await deleteScene(foundryPage, SCENE_NAME);
  });

  test('NPC ability roll produces chat message with ability flavor', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, NPC_NAME, 'npc');
    await updateActorData(page, NPC_NAME, {
      'system.abilities.mle.value': 5,
      'system.attributes.rank.value': 4,
    });

    await createScene(page, SCENE_NAME);
    await activateScene(page, SCENE_NAME);

    await triggerNpcAbilityRoll(page, NPC_NAME, 'mle');

    const msg = await getLastChatMessage(page);
    expect(msg).not.toBeNull();
    expect(msg.flavor).toContain('Melee');
  });

  test('NPC damage button produces damage output without error', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, NPC_NAME, 'npc');
    await updateActorData(page, NPC_NAME, {
      'system.abilities.mle.value': 5,
      'system.attributes.rank.value': 4,
    });

    await createScene(page, SCENE_NAME);
    await activateScene(page, SCENE_NAME);

    await triggerNpcAbilityRoll(page, NPC_NAME, 'mle');

    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await clickDamageButton(page);

    const msg = await getLastChatMessage(page);
    expect(msg).not.toBeNull();
    expect(msg.content.toLowerCase()).toContain('damage');

    const relevantErrors = errors.filter(e =>
      e.includes('damage') || e.includes('actor') || e.includes('null')
    );
    expect(relevantErrors).toHaveLength(0);
  });

  test('NPC damage output uses correct damage multiplier (rank-based)', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, NPC_NAME, 'npc');
    await updateActorData(page, NPC_NAME, {
      'system.abilities.mle.value': 3,
      'system.attributes.rank.value': 5,
    });

    const sys = await getActorSystemData(page, NPC_NAME);
    expect(sys.abilities.mle.damageMultiplier).toBe(5);

    await createScene(page, SCENE_NAME);
    await activateScene(page, SCENE_NAME);

    await triggerNpcAbilityRoll(page, NPC_NAME, 'mle');
    await clickDamageButton(page);

    const msg = await getLastChatMessage(page);
    expect(msg).not.toBeNull();
    expect(msg.content.toLowerCase()).toContain('damage');
    expect(msg.content.toLowerCase()).toContain('multiplier');
  });

  test('NPC damage against targeted token shows target name and DR', async ({ foundryPage }) => {
    const page = foundryPage;

    await createActorViaAPI(page, NPC_NAME, 'npc');
    await updateActorData(page, NPC_NAME, {
      'system.abilities.mle.value': 4,
      'system.attributes.rank.value': 3,
    });

    await createActorViaAPI(page, DEFENDER_NAME);
    await createActiveEffect(page, DEFENDER_NAME, {
      name: 'Armor 2',
      changes: [{ key: 'system.healthDamageReduction', mode: 2, value: '2' }],
    });

    await createScene(page, SCENE_NAME);
    await activateScene(page, SCENE_NAME);
    await placeToken(page, NPC_NAME, 200, 200);
    await placeToken(page, DEFENDER_NAME, 400, 200);
    await targetToken(page, DEFENDER_NAME);

    await triggerNpcAbilityRoll(page, NPC_NAME, 'mle');
    await clickDamageButton(page);

    const msg = await getLastChatMessage(page);
    expect(msg).not.toBeNull();
    expect(msg.content).toContain(DEFENDER_NAME);
    expect(msg.content).toContain('DR');
  });

  test('NPC focus damage uses focusDamageReduction on target', async ({ foundryPage }) => {
    const page = foundryPage;

    await createActorViaAPI(page, NPC_NAME, 'npc');
    await updateActorData(page, NPC_NAME, {
      'system.abilities.ego.value': 4,
      'system.attributes.rank.value': 2,
    });

    await createActorViaAPI(page, DEFENDER_NAME);
    await createActiveEffect(page, DEFENDER_NAME, {
      name: 'Mental Shield 1',
      changes: [{ key: 'system.focusDamageReduction', mode: 2, value: '1' }],
    });

    await createScene(page, SCENE_NAME);
    await activateScene(page, SCENE_NAME);
    await placeToken(page, NPC_NAME, 200, 200);
    await placeToken(page, DEFENDER_NAME, 400, 200);
    await targetToken(page, DEFENDER_NAME);

    await page.evaluate(async ({ actorName }) => {
      const actor = game.actors.find(a => a.name === actorName);
      const roll = new CONFIG.Dice.MarvelMultiverseRoll(
        '{1d6,1dm,1d6}+@abilities.ego.value',
        actor.getRollData(),
      );
      const speaker = ChatMessage.getSpeaker({ actor });
      const flavor = '[ability] Ego [damageType] focus';
      await roll.toMessage({ speaker, flavor, rollMode: 'publicroll' });
    }, { actorName: NPC_NAME });
    await page.waitForTimeout(2000);

    await clickDamageButton(page);

    const msg = await getLastChatMessage(page);
    expect(msg).not.toBeNull();
    expect(msg.content).toContain(DEFENDER_NAME);
    expect(msg.content.toLowerCase()).toContain('focus');
  });

  test('NPC with AE DM bonus reflects in damage multiplier', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, NPC_NAME, 'npc');
    await updateActorData(page, NPC_NAME, {
      'system.attributes.rank.value': 3,
    });

    await createActiveEffect(page, NPC_NAME, {
      name: 'Mighty 2',
      changes: [{
        key: 'system.abilities.mle.damageMultiplier',
        mode: 2,
        value: '2',
      }],
    });

    const sys = await getActorSystemData(page, NPC_NAME);
    expect(sys.abilities.mle.damageMultiplier).toBe(5);
  });
});
