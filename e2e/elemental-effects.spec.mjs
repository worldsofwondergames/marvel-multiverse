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
  getLastChatMessage,
  clearChatMessages,
  dismissNotifications,
} from './helpers.mjs';

const ATTACKER = 'E2E Element Attacker';
const DEFENDER = 'E2E Element Defender';
const SCENE_NAME = 'E2E Element Scene';

test.describe('Elemental Fantastic Effects', () => {

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

  test('fire element Fantastic applies ablaze status to target', async ({ foundryPage }) => {
    const page = foundryPage;

    await createActorViaAPI(page, ATTACKER);
    await updateActorData(page, ATTACKER, {
      'system.abilities.ego.value': 4,
      'system.attributes.rank.value': 3,
    });

    await createActorViaAPI(page, DEFENDER);

    await createScene(page, SCENE_NAME);
    await activateScene(page, SCENE_NAME);
    await placeToken(page, ATTACKER, 200, 200);
    await placeToken(page, DEFENDER, 400, 200);
    await targetToken(page, DEFENDER);

    // Trigger a Fantastic roll with fire element, then click damage
    // We simulate the damage handler directly since we can't control dice
    const result = await page.evaluate(async ({ attackerName, defenderName }) => {
      const attacker = game.actors.find(a => a.name === attackerName);
      const defender = game.actors.find(a => a.name === defenderName);

      // Simulate what _handleDamageChatButton does for a Fantastic elemental attack
      const elementConfig = CONFIG.MARVEL_MULTIVERSE.elements.fire;
      if (elementConfig?.statusId) {
        await defender.toggleStatusEffect(elementConfig.statusId, { active: true });
      }

      const hasAblaze = defender.statuses?.has('ablaze') ?? false;
      return { hasAblaze, fantasticEffect: elementConfig.fantasticEffect };
    }, { attackerName: ATTACKER, defenderName: DEFENDER });

    expect(result.hasAblaze).toBe(true);
    expect(result.fantasticEffect).toContain('ablaze');
  });

  test('chemical element Fantastic applies corroding status', async ({ foundryPage }) => {
    const page = foundryPage;

    await createActorViaAPI(page, ATTACKER);
    await createActorViaAPI(page, DEFENDER);

    const result = await page.evaluate(async (defenderName) => {
      const defender = game.actors.find(a => a.name === defenderName);
      const elementConfig = CONFIG.MARVEL_MULTIVERSE.elements.chemical;
      if (elementConfig?.statusId) {
        await defender.toggleStatusEffect(elementConfig.statusId, { active: true });
      }
      return {
        hasCorroding: defender.statuses?.has('corroding') ?? false,
        fantasticEffect: elementConfig.fantasticEffect,
      };
    }, DEFENDER);

    expect(result.hasCorroding).toBe(true);
    expect(result.fantasticEffect.toLowerCase()).toContain('corroding');
  });

  test('toxin element Fantastic applies poisoned status', async ({ foundryPage }) => {
    const page = foundryPage;

    await createActorViaAPI(page, ATTACKER);
    await createActorViaAPI(page, DEFENDER);

    const result = await page.evaluate(async (defenderName) => {
      const defender = game.actors.find(a => a.name === defenderName);
      const elementConfig = CONFIG.MARVEL_MULTIVERSE.elements.toxin;
      if (elementConfig?.statusId) {
        await defender.toggleStatusEffect(elementConfig.statusId, { active: true });
      }
      return {
        hasPoisoned: defender.statuses?.has('poisoned') ?? false,
        fantasticEffect: elementConfig.fantasticEffect,
      };
    }, DEFENDER);

    expect(result.hasPoisoned).toBe(true);
    expect(result.fantasticEffect.toLowerCase()).toContain('poisoned');
  });

  test('all elements have correct status mappings in config', async ({ foundryPage }) => {
    const page = foundryPage;

    const elements = await page.evaluate(() => {
      const elems = CONFIG.MARVEL_MULTIVERSE.elements;
      return Object.entries(elems).map(([key, config]) => ({
        key,
        label: config.label,
        statusId: config.statusId ?? null,
        fantasticEffect: config.fantasticEffect,
      }));
    });

    const expectedMappings = {
      air: 'prone',
      chemical: 'corroding',
      earth: 'exhausted',
      electricity: 'stunned',
      energy: 'blinded',
      fire: 'ablaze',
      force: 'encumbered',
      ice: 'paralyzed',
      iron: 'restrained',
      sound: 'deafened',
      swarm: 'frightened',
      toxin: 'poisoned',
      water: 'surprised',
    };

    for (const [key, expectedStatus] of Object.entries(expectedMappings)) {
      const elem = elements.find(e => e.key === key);
      expect(elem).toBeDefined();
      expect(elem.statusId).toBe(expectedStatus);
    }

    // Hellfire has no statusId (splits damage instead)
    const hellfire = elements.find(e => e.key === 'hellfire');
    expect(hellfire).toBeDefined();
    expect(hellfire.statusId).toBeNull();
  });

  test('condition DR value is shown when target has health DR', async ({ foundryPage }) => {
    const page = foundryPage;

    await createActorViaAPI(page, DEFENDER);
    await createActiveEffect(page, DEFENDER, {
      name: 'Sturdy 2',
      changes: [{ key: 'system.healthDamageReduction', mode: 2, value: '2' }],
    });

    const result = await page.evaluate(async (defenderName) => {
      const defender = game.actors.find(a => a.name === defenderName);
      return {
        healthDR: defender.system.healthDamageReduction,
        conditionDR: defender.system.conditionDamageReduction,
      };
    }, DEFENDER);

    // conditionDamageReduction = healthDamageReduction × 5
    expect(result.healthDR).toBe(2);
    expect(result.conditionDR).toBe(10);
  });
});
