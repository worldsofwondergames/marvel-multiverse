import { test, expect } from './fixtures.mjs';
import {
  createActorViaAPI,
  updateActorData,
  getActorSystemData,
  createCombat,
  addToCombat,
  deleteCombat,
  deleteActor,
} from './helpers.mjs';

const ACTOR_1 = 'E2E Initiative Test 1';
const ACTOR_2 = 'E2E Initiative Test 2';

test.describe('Combat & Initiative', () => {

  test.afterEach(async ({ foundryPage }) => {
    await deleteCombat(foundryPage);
    await deleteActor(foundryPage, ACTOR_1);
    await deleteActor(foundryPage, ACTOR_2);
  });

  test('rolling initiative creates a d616 roll with Vigilance modifier', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_1);
    await updateActorData(page, ACTOR_1, {
      'system.abilities.vig.value': 4,
    });

    await createCombat(page);
    await addToCombat(page, ACTOR_1);

    // Roll initiative for the combatant
    const initValue = await page.evaluate(async (name) => {
      const actor = game.actors.find(a => a.name === name);
      const combatant = game.combat.combatants.find(c => c.actorId === actor.id);
      await combatant.rollInitiative();
      return combatant.initiative;
    }, ACTOR_1);

    // Initiative should be a number (d616 total + vig modifier)
    expect(typeof initValue).toBe('number');
    // d616 range is 4-18 (min non-M: 1+2+1=4, max: 6+6+6=18)
    // plus Vigilance 4, so range is 8-22
    expect(initValue).toBeGreaterThanOrEqual(8);
    expect(initValue).toBeLessThanOrEqual(22);
  });

  test('multiple combatants can roll initiative', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_1);
    await createActorViaAPI(page, ACTOR_2);
    await updateActorData(page, ACTOR_1, {
      'system.abilities.vig.value': 2,
    });
    await updateActorData(page, ACTOR_2, {
      'system.abilities.vig.value': 5,
    });

    await createCombat(page);
    await addToCombat(page, ACTOR_1);
    await addToCombat(page, ACTOR_2);

    // Roll initiative for all
    await page.evaluate(async () => {
      await game.combat.rollAll();
    });
    await page.waitForTimeout(2000);

    const initiatives = await page.evaluate(() => {
      return game.combat.combatants.map(c => ({
        name: c.actor.name,
        initiative: c.initiative,
      }));
    });

    expect(initiatives.length).toBe(2);
    for (const c of initiatives) {
      expect(typeof c.initiative).toBe('number');
      expect(c.initiative).toBeGreaterThanOrEqual(4);
    }
  });

  test('initiative includes Vigilance bonus in final value', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_1);
    await updateActorData(page, ACTOR_1, {
      'system.abilities.vig.value': 7,
    });

    await createCombat(page);
    await addToCombat(page, ACTOR_1);

    // Roll initiative multiple times to verify the bonus
    const results = await page.evaluate(async (name) => {
      const actor = game.actors.find(a => a.name === name);
      const combatant = game.combat.combatants.find(c => c.actorId === actor.id);
      const values = [];
      for (let i = 0; i < 10; i++) {
        await combatant.rollInitiative();
        values.push(combatant.initiative);
      }
      return values;
    }, ACTOR_1);

    // With vig=7, minimum initiative = 4 (min d616) + 7 = 11
    for (const val of results) {
      expect(val).toBeGreaterThanOrEqual(11);
    }
  });
});
