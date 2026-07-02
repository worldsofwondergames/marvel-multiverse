import { test, expect } from './fixtures.mjs';
import {
  createActorViaAPI,
  updateActorData,
  createActiveEffect,
  deleteActor,
  createScene,
  activateScene,
  placeToken,
  deleteScene,
  createCombat,
  addToCombat,
  deleteCombat,
  getLastChatMessage,
  clearChatMessages,
  dismissNotifications,
} from './helpers.mjs';

const ACTOR_A = 'E2E Condition Actor A';
const ACTOR_B = 'E2E Condition Actor B';
const SCENE_NAME = 'E2E Condition Scene';

test.describe('Condition Automation', () => {

  test.beforeEach(async ({ foundryPage }) => {
    await clearChatMessages(foundryPage);
    await dismissNotifications(foundryPage);
  });

  test.afterEach(async ({ foundryPage }) => {
    await deleteCombat(foundryPage);
    await deleteActor(foundryPage, ACTOR_A);
    await deleteActor(foundryPage, ACTOR_B);
    await deleteScene(foundryPage, SCENE_NAME);
  });

  test('asleep status sets all defenses to 10', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_A);
    await updateActorData(page, ACTOR_A, {
      'system.abilities.mle.value': 5,
      'system.abilities.agl.value': 4,
      'system.abilities.res.value': 3,
      'system.abilities.vig.value': 2,
      'system.abilities.log.value': 3,
      'system.abilities.ego.value': 4,
    });

    const beforeDefenses = await page.evaluate((name) => {
      const actor = game.actors.find(a => a.name === name);
      return Object.fromEntries(
        Object.entries(actor.system.abilities).map(([k, v]) => [k, v.defense])
      );
    }, ACTOR_A);

    expect(beforeDefenses.mle).toBeGreaterThan(10);

    await page.evaluate(async (name) => {
      const actor = game.actors.find(a => a.name === name);
      await actor.toggleStatusEffect('asleep', { active: true });
    }, ACTOR_A);

    const afterDefenses = await page.evaluate((name) => {
      const actor = game.actors.find(a => a.name === name);
      return Object.fromEntries(
        Object.entries(actor.system.abilities).map(([k, v]) => [k, v.defense])
      );
    }, ACTOR_A);

    for (const [key, def] of Object.entries(afterDefenses)) {
      expect(def, `${key} defense should be 10 when asleep`).toBe(10);
    }
  });

  test('exhausted status appears in status effects list', async ({ foundryPage }) => {
    const page = foundryPage;

    const hasExhausted = await page.evaluate(() => {
      return CONFIG.statusEffects.some(s => s.id === 'exhausted');
    });
    expect(hasExhausted).toBe(true);

    const hasOldExhaustion = await page.evaluate(() => {
      return CONFIG.statusEffects.some(s => s.id === 'exhaustion');
    });
    expect(hasOldExhaustion).toBe(false);
  });

  test('asleep status appears in status effects list', async ({ foundryPage }) => {
    const page = foundryPage;

    const hasAsleep = await page.evaluate(() => {
      return CONFIG.statusEffects.some(s => s.id === 'asleep');
    });
    expect(hasAsleep).toBe(true);
  });

  test('ablaze deals 5 HP damage at end of turn', async ({ foundryPage }) => {
    const page = foundryPage;

    await createActorViaAPI(page, ACTOR_A);
    await updateActorData(page, ACTOR_A, {
      'system.abilities.res.value': 3,
      'system.abilities.vig.value': 2,
    });
    await createActorViaAPI(page, ACTOR_B);
    await updateActorData(page, ACTOR_B, {
      'system.abilities.vig.value': 2,
    });

    await page.evaluate(async (name) => {
      const actor = game.actors.find(a => a.name === name);
      await actor.toggleStatusEffect('ablaze', { active: true });
    }, ACTOR_A);

    const healthBefore = await page.evaluate((name) => {
      return game.actors.find(a => a.name === name).system.health.value;
    }, ACTOR_A);

    await createScene(page, SCENE_NAME);
    await activateScene(page, SCENE_NAME);
    await placeToken(page, ACTOR_A, 200, 200);
    await placeToken(page, ACTOR_B, 400, 200);

    await createCombat(page);
    await addToCombat(page, ACTOR_A);
    await addToCombat(page, ACTOR_B);

    await page.evaluate(async () => {
      await game.combat.rollAll();
      await game.combat.startCombat();
    });
    await page.waitForTimeout(2000);

    await page.evaluate(async (name) => {
      const actorA = game.actors.find(a => a.name === name);
      if (game.combat.combatant?.actorId !== actorA.id) {
        await game.combat.nextTurn();
      }
    }, ACTOR_A);
    await page.waitForTimeout(1000);
    await clearChatMessages(page);

    await page.evaluate(async () => {
      await game.combat.nextTurn();
    });
    await page.waitForTimeout(2000);

    const healthAfter = await page.evaluate((name) => {
      return game.actors.find(a => a.name === name).system.health.value;
    }, ACTOR_A);

    expect(healthAfter).toBe(healthBefore - 5);
  });

  test('multiple damage conditions stack', async ({ foundryPage }) => {
    const page = foundryPage;

    await createActorViaAPI(page, ACTOR_A);
    await updateActorData(page, ACTOR_A, {
      'system.abilities.res.value': 3,
      'system.abilities.vig.value': 2,
    });
    await createActorViaAPI(page, ACTOR_B);
    await updateActorData(page, ACTOR_B, {
      'system.abilities.vig.value': 2,
    });

    await page.evaluate(async (name) => {
      const actor = game.actors.find(a => a.name === name);
      await actor.toggleStatusEffect('ablaze', { active: true });
      await actor.toggleStatusEffect('corroding', { active: true });
    }, ACTOR_A);

    const healthBefore = await page.evaluate((name) => {
      return game.actors.find(a => a.name === name).system.health.value;
    }, ACTOR_A);

    await createScene(page, SCENE_NAME);
    await activateScene(page, SCENE_NAME);
    await placeToken(page, ACTOR_A, 200, 200);
    await placeToken(page, ACTOR_B, 400, 200);

    await createCombat(page);
    await addToCombat(page, ACTOR_A);
    await addToCombat(page, ACTOR_B);

    await page.evaluate(async () => {
      await game.combat.rollAll();
      await game.combat.startCombat();
    });
    await page.waitForTimeout(2000);

    await page.evaluate(async (name) => {
      const actorA = game.actors.find(a => a.name === name);
      if (game.combat.combatant?.actorId !== actorA.id) {
        await game.combat.nextTurn();
      }
    }, ACTOR_A);
    await page.waitForTimeout(1000);
    await clearChatMessages(page);

    await page.evaluate(async () => {
      await game.combat.nextTurn();
    });
    await page.waitForTimeout(2000);

    const healthAfter = await page.evaluate((name) => {
      return game.actors.find(a => a.name === name).system.health.value;
    }, ACTOR_A);

    expect(healthAfter).toBe(healthBefore - 10);
  });

  test('condition DR reduces condition damage', async ({ foundryPage }) => {
    const page = foundryPage;

    await createActorViaAPI(page, ACTOR_A);
    await updateActorData(page, ACTOR_A, {
      'system.abilities.res.value': 3,
      'system.abilities.vig.value': 2,
    });
    await createActiveEffect(page, ACTOR_A, {
      name: 'Sturdy 1',
      changes: [{ key: 'system.healthDamageReduction', mode: 2, value: '1' }],
    });
    await createActorViaAPI(page, ACTOR_B);
    await updateActorData(page, ACTOR_B, {
      'system.abilities.vig.value': 2,
    });

    await page.evaluate(async (name) => {
      const actor = game.actors.find(a => a.name === name);
      await actor.toggleStatusEffect('ablaze', { active: true });
    }, ACTOR_A);

    const healthBefore = await page.evaluate((name) => {
      return game.actors.find(a => a.name === name).system.health.value;
    }, ACTOR_A);

    await createScene(page, SCENE_NAME);
    await activateScene(page, SCENE_NAME);
    await placeToken(page, ACTOR_A, 200, 200);
    await placeToken(page, ACTOR_B, 400, 200);

    await createCombat(page);
    await addToCombat(page, ACTOR_A);
    await addToCombat(page, ACTOR_B);

    await page.evaluate(async () => {
      await game.combat.rollAll();
      await game.combat.startCombat();
    });
    await page.waitForTimeout(2000);

    await page.evaluate(async (name) => {
      const actorA = game.actors.find(a => a.name === name);
      if (game.combat.combatant?.actorId !== actorA.id) {
        await game.combat.nextTurn();
      }
    }, ACTOR_A);
    await page.waitForTimeout(1000);
    await clearChatMessages(page);

    await page.evaluate(async () => {
      await game.combat.nextTurn();
    });
    await page.waitForTimeout(2000);

    const healthAfter = await page.evaluate((name) => {
      return game.actors.find(a => a.name === name).system.health.value;
    }, ACTOR_A);

    // Sturdy 1 = condition DR 5, ablaze damage 5, net damage 0
    expect(healthAfter).toBe(healthBefore);
  });

  test('poisoned auto-rolls Resilience check at start of turn', async ({ foundryPage }) => {
    const page = foundryPage;

    await createActorViaAPI(page, ACTOR_A);
    await updateActorData(page, ACTOR_A, {
      'system.abilities.res.value': 3,
      'system.abilities.vig.value': 2,
    });
    await createActorViaAPI(page, ACTOR_B);
    await updateActorData(page, ACTOR_B, {
      'system.abilities.vig.value': 2,
    });

    await page.evaluate(async (name) => {
      const actor = game.actors.find(a => a.name === name);
      await actor.toggleStatusEffect('poisoned', { active: true });
    }, ACTOR_A);

    await createScene(page, SCENE_NAME);
    await activateScene(page, SCENE_NAME);
    await placeToken(page, ACTOR_A, 200, 200);
    await placeToken(page, ACTOR_B, 400, 200);

    await createCombat(page);
    await addToCombat(page, ACTOR_A);
    await addToCombat(page, ACTOR_B);

    await page.evaluate(async () => {
      await game.combat.rollAll();
      await game.combat.startCombat();
    });
    await page.waitForTimeout(2000);

    await page.evaluate(async (name) => {
      const actorA = game.actors.find(a => a.name === name);
      if (game.combat.combatant?.actorId !== actorA.id) {
        await game.combat.nextTurn();
      }
    }, ACTOR_A);
    await page.waitForTimeout(3000);

    // Check that a poison check chat message was posted (details are in flavor)
    const flavors = await page.evaluate(() => {
      return game.messages.contents.map(m => m.flavor);
    });

    const poisonMsg = flavors.find(f => f && f.includes('Poison Check'));
    expect(poisonMsg).toBeDefined();
    expect(poisonMsg).toContain('Resilience');
    expect(poisonMsg).toContain('TN 18');
  });

  test('condition effects config has all expected conditions', async ({ foundryPage }) => {
    const page = foundryPage;

    const conditions = await page.evaluate(() => {
      return Object.keys(CONFIG.MARVEL_MULTIVERSE.conditionEffects);
    });

    expect(conditions).toContain('ablaze');
    expect(conditions).toContain('asleep');
    expect(conditions).toContain('bleeding');
    expect(conditions).toContain('corroding');
    expect(conditions).toContain('exhausted');
    expect(conditions).toContain('infected');
    expect(conditions).toContain('poisoned');
  });
});
