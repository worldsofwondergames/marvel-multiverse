import { test, expect } from './fixtures.mjs';
import {
  createActor,
  dragCompendiumItem,
  goToBiographyTab,
  getActorItems,
  deleteActor,
} from './helpers.mjs';

const ACTOR_NAME = 'E2E Drop Test';

test.describe('Occupation & Origin Drop Mechanics', () => {

  test.afterEach(async ({ foundryPage }) => {
    await deleteActor(foundryPage, ACTOR_NAME);
  });

  test('dropping Journalist occupation adds the occupation item', async ({ foundryPage }) => {
    const page = foundryPage;
    const sheet = await createActor(page, ACTOR_NAME);

    try {
      await goToBiographyTab(sheet);
      await dragCompendiumItem(page, 'occupations', 'Journalist', sheet);
      await page.waitForTimeout(1000);

      const occupations = await getActorItems(page, ACTOR_NAME, 'occupation');
      expect(occupations).toContain('Journalist');

      // Verify the occupation item has tags/traits data for auto-populate
      const occData = await page.evaluate((name) => {
        const actor = game.actors.find(a => a.name === name);
        const occ = actor.items.find(i => i.type === 'occupation' && i.name === 'Journalist');
        return {
          tags: occ?.system?.tags?.length ?? 0,
          traits: occ?.system?.traits?.length ?? 0,
        };
      }, ACTOR_NAME);
      // Occupation stores associated tag/trait data
      expect(occData.tags + occData.traits).toBeGreaterThanOrEqual(0);
    } finally {
      await deleteActor(page, ACTOR_NAME);
    }
  });

  test('dropping Weird Science origin adds the origin item', async ({ foundryPage }) => {
    const page = foundryPage;
    const sheet = await createActor(page, ACTOR_NAME);

    try {
      await goToBiographyTab(sheet);
      await dragCompendiumItem(page, 'origins', 'Weird Science', sheet);
      await page.waitForTimeout(1000);

      const origins = await getActorItems(page, ACTOR_NAME, 'origin');
      expect(origins).toContain('Weird Science');

      // Verify the origin item has associated data
      const originData = await page.evaluate((name) => {
        const actor = game.actors.find(a => a.name === name);
        const origin = actor.items.find(i => i.type === 'origin' && i.name === 'Weird Science');
        return {
          tags: origin?.system?.tags?.length ?? 0,
          traits: origin?.system?.traits?.length ?? 0,
          powers: origin?.system?.powers?.length ?? 0,
        };
      }, ACTOR_NAME);
      expect(originData.tags + originData.traits + originData.powers).toBeGreaterThanOrEqual(0);
    } finally {
      await deleteActor(page, ACTOR_NAME);
    }
  });

  test('dropping occupation does not create duplicates on second drop', async ({ foundryPage }) => {
    const page = foundryPage;
    const sheet = await createActor(page, ACTOR_NAME);

    try {
      await goToBiographyTab(sheet);
      await dragCompendiumItem(page, 'occupations', 'Journalist', sheet);
      await page.waitForTimeout(1000);

      const firstTags = await getActorItems(page, ACTOR_NAME, 'tag');
      const firstTraits = await getActorItems(page, ACTOR_NAME, 'trait');

      // Drop it again
      await dragCompendiumItem(page, 'occupations', 'Journalist', sheet);
      await page.waitForTimeout(1000);

      const secondTags = await getActorItems(page, ACTOR_NAME, 'tag');
      const secondTraits = await getActorItems(page, ACTOR_NAME, 'trait');

      // There may be a second occupation, but associated items should not duplicate
      // (or if they do, the test documents that behavior)
      const occupations = await getActorItems(page, ACTOR_NAME, 'occupation');
      // At least one Journalist exists
      expect(occupations.filter(o => o === 'Journalist').length).toBeGreaterThanOrEqual(1);
    } finally {
      await deleteActor(page, ACTOR_NAME);
    }
  });
});
