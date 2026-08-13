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
  forceHit,
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
    await forceHit(page, DEFENDER, 'mle');

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
    await forceHit(page, DEFENDER, 'mle');

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
    await forceHit(page, DEFENDER, 'ego');

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
      const messageData = { speaker, flavor, rollMode: 'publicroll' };
      const targets = Array.from(game.user.targets)
        .map((token) => ({
          name: token.name,
          img: token.document?.texture?.src ?? token.actor?.img ?? '',
          ac: token.actor?.system?.abilities?.ego?.defense ?? null,
          uuid: token.actor?.uuid ?? '',
        }))
        .filter((t) => t.ac !== null);
      if (targets.length) messageData['flags.marvel-multiverse.targets'] = targets;
      await roll.toMessage(messageData, { rollMode: 'publicroll' });
    }, { actorName: ATTACKER });
    await page.waitForTimeout(2000);

    await clickDamageButton(page);

    const msg = await getLastChatMessage(page);
    expect(msg).not.toBeNull();
    expect(msg.content).toContain(DEFENDER);
    expect(msg.content.toLowerCase()).toContain('focus');
  });

  /**
   * The damage handler prints its own inputs under the total:
   *
   *   <b>NAME</b> takes <b>5 damage</b>
   *   ((Marvel Die 4 × (Multiplier - DR) 0) + Melee 5)<br><span>Multiplier 2 − DR 2 = 0</span>
   *
   * With no DR the middle term reads "× Multiplier 2)" instead. Parsing these
   * out lets us check the arithmetic against a random die, which substring
   * assertions on "damage"/"multiplier" cannot do.
   */
  function parseDamageBreakdown(content) {
    return {
      damage: Number(/takes <b[^>]*>\s*(-?\d+)/.exec(content)?.[1]),
      marvelDie: Number(/Marvel Die\s+(-?\d+)/.exec(content)?.[1]),
      effectiveMultiplier: Number(
        /×\s*(?:\(Multiplier - DR\)|Multiplier)\s*(-?\d+)\)/.exec(content)?.[1],
      ),
      abilityScore: Number(/\+\s*\w+\s+(-?\d+)\)/.exec(content)?.[1]),
      fantastic: /Fantastic/.test(content),
    };
  }

  /** Read an actor's melee damage multiplier and health DR as the system derives them. */
  async function readCombatStats(page, actorName) {
    return page.evaluate((name) => {
      const actor = game.actors.find(a => a.name === name);
      return {
        damageMultiplier: actor.system.abilities.mle.damageMultiplier,
        healthDR: actor.system.healthDamageReduction,
      };
    }, actorName);
  }

  test('printed damage equals MarvelDie x effective multiplier + ability score', async ({ foundryPage }) => {
    const page = foundryPage;

    await createActorViaAPI(page, ATTACKER);
    await updateActorData(page, ATTACKER, {
      'system.abilities.mle.value': 5,
      'system.attributes.rank.value': 3,
    });
    await createActorViaAPI(page, DEFENDER);
    await forceHit(page, DEFENDER, 'mle');

    await createScene(page, SCENE_NAME);
    await activateScene(page, SCENE_NAME);
    await placeToken(page, ATTACKER, 200, 200);
    await placeToken(page, DEFENDER, 400, 200);
    await targetToken(page, DEFENDER);

    await triggerAbilityRoll(page, ATTACKER, 'mle');
    await clickDamageButton(page);

    const msg = await getLastChatMessage(page);
    expect(msg).not.toBeNull();

    const b = parseDamageBreakdown(msg.content);
    expect(Number.isNaN(b.damage)).toBe(false);
    expect(Number.isNaN(b.marvelDie)).toBe(false);
    expect(Number.isNaN(b.effectiveMultiplier)).toBe(false);
    expect(Number.isNaN(b.abilityScore)).toBe(false);

    const base = b.marvelDie * b.effectiveMultiplier + b.abilityScore;
    expect(b.damage).toBe(b.fantastic ? base * 2 : base);
  });

  /**
   * Rulebook: when DR meets or exceeds the damage multiplier the attack "does no
   * damage at all, not even from the attacker's Ability score bonus". Melee is 5
   * throughout, so a total of 0 cannot come from the ability score being added.
   */
  test('DR equal to the damage multiplier deals no damage', async ({ foundryPage }) => {
    const page = foundryPage;

    await createActorViaAPI(page, ATTACKER);
    await updateActorData(page, ATTACKER, {
      'system.abilities.mle.value': 5,
      'system.attributes.rank.value': 2,
    });
    await createActorViaAPI(page, DEFENDER);

    // Derive the DR from the attacker's actual multiplier rather than assuming
    // how rank maps to it, so the DR == DM relationship holds either way.
    const { damageMultiplier } = await readCombatStats(page, ATTACKER);
    await createActiveEffect(page, DEFENDER, {
      name: 'Matched DR',
      changes: [{ key: 'system.healthDamageReduction', mode: 2, value: String(damageMultiplier) }],
    });
    await forceHit(page, DEFENDER, 'mle');

    const defender = await readCombatStats(page, DEFENDER);
    expect(defender.healthDR).toBe(damageMultiplier);

    await createScene(page, SCENE_NAME);
    await activateScene(page, SCENE_NAME);
    await placeToken(page, ATTACKER, 200, 200);
    await placeToken(page, DEFENDER, 400, 200);
    await targetToken(page, DEFENDER);

    await triggerAbilityRoll(page, ATTACKER, 'mle');
    await clickDamageButton(page);

    const msg = await getLastChatMessage(page);
    expect(msg).not.toBeNull();

    const b = parseDamageBreakdown(msg.content);
    expect(b.abilityScore).toBe(5);
    expect(b.effectiveMultiplier).toBe(0);
    expect(b.damage).toBe(0);
  });

  /** Same rule, with DR overshooting rather than matching the multiplier. */
  test('DR above the damage multiplier deals no damage', async ({ foundryPage }) => {
    const page = foundryPage;

    await createActorViaAPI(page, ATTACKER);
    await updateActorData(page, ATTACKER, {
      'system.abilities.mle.value': 5,
      'system.attributes.rank.value': 2,
    });
    await createActorViaAPI(page, DEFENDER);

    const { damageMultiplier } = await readCombatStats(page, ATTACKER);
    await createActiveEffect(page, DEFENDER, {
      name: 'Overwhelming DR',
      changes: [{ key: 'system.healthDamageReduction', mode: 2, value: String(damageMultiplier + 2) }],
    });
    await forceHit(page, DEFENDER, 'mle');

    await createScene(page, SCENE_NAME);
    await activateScene(page, SCENE_NAME);
    await placeToken(page, ATTACKER, 200, 200);
    await placeToken(page, DEFENDER, 400, 200);
    await targetToken(page, DEFENDER);

    await triggerAbilityRoll(page, ATTACKER, 'mle');
    await clickDamageButton(page);

    const msg = await getLastChatMessage(page);
    expect(msg).not.toBeNull();

    const b = parseDamageBreakdown(msg.content);
    expect(b.abilityScore).toBe(5);
    expect(b.effectiveMultiplier).toBe(0);
    expect(b.damage).toBe(0);
  });
});
