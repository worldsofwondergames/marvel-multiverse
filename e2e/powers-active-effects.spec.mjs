import { test, expect } from './fixtures.mjs';
import {
  createActor,
  setNumericField,
  dragCompendiumItem,
  goToAbilitiesTab,
  getActorSystemData,
  deleteActor,
} from './helpers.mjs';

const ACTOR_NAME = 'E2E Powers AE Test';

test.describe('Powers with Active Effects', () => {

  test.afterEach(async ({ foundryPage }) => {
    await deleteActor(foundryPage, ACTOR_NAME);
  });

  test('power with DM active effect increases damage multiplier above rank', async ({ foundryPage }) => {
    const page = foundryPage;
    const sheet = await createActor(page, ACTOR_NAME);

    try {
      await setNumericField(sheet, 'system.attributes.rank.value', 3);

      let sys = await getActorSystemData(page, ACTOR_NAME);
      expect(sys.abilities.mle.damageMultiplier).toBe(3);

      // Manually create a power-like AE that boosts MLE DM (simulates Mighty)
      await page.evaluate(async (name) => {
        const actor = game.actors.find(a => a.name === name);
        await actor.createEmbeddedDocuments('ActiveEffect', [{
          name: 'Mighty 1 Bonus',
          changes: [{
            key: 'system.abilities.mle.damageMultiplier',
            mode: 2,
            value: '1',
          }],
        }]);
      }, ACTOR_NAME);
      await page.waitForTimeout(1000);

      sys = await getActorSystemData(page, ACTOR_NAME);
      expect(sys.abilities.mle.damageMultiplier).toBe(4);
    } finally {
      await deleteActor(page, ACTOR_NAME);
    }
  });

  test('adding multiple powers accumulates correct items', async ({ foundryPage }) => {
    const page = foundryPage;
    const sheet = await createActor(page, ACTOR_NAME);

    try {
      await setNumericField(sheet, 'system.attributes.rank.value', 4);

      await dragCompendiumItem(page, 'powers', 'Evasion', sheet);
      await dragCompendiumItem(page, 'powers', 'Combat Trickery', sheet);
      await dragCompendiumItem(page, 'powers', 'Mighty 1', sheet);
      await page.waitForTimeout(1000);

      const powers = await page.evaluate((name) => {
        const actor = game.actors.find(a => a.name === name);
        return actor.items.filter(i => i.type === 'power').map(i => i.name).sort();
      }, ACTOR_NAME);

      expect(powers).toContain('Evasion');
      expect(powers).toContain('Combat Trickery');
      expect(powers).toContain('Mighty 1');
    } finally {
      await deleteActor(page, ACTOR_NAME);
    }
  });
});
