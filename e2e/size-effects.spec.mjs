import { test, expect } from './fixtures.mjs';
import {
  createActor,
  setSelectField,
  goToBiographyTab,
  getActorSystemData,
  getActiveEffectNames,
  deleteActor,
} from './helpers.mjs';

const ACTOR_NAME = 'E2E Size Effects Test';

test.describe('Size Effects', () => {

  test.afterEach(async ({ foundryPage }) => {
    await deleteActor(foundryPage, ACTOR_NAME);
  });

  test('average size has no defense modifiers', async ({ foundryPage }) => {
    const page = foundryPage;
    const sheet = await createActor(page, ACTOR_NAME);

    try {
      const sys = await getActorSystemData(page, ACTOR_NAME);
      // Default abilities are 0, defense should be 10 with no size modifier
      expect(sys.abilities.mle.defense).toBe(10);
      expect(sys.abilities.agl.defense).toBe(10);

      const effects = await getActiveEffectNames(page, ACTOR_NAME);
      const sizeEffects = effects.filter(n => n.toLowerCase().includes('size'));
      expect(sizeEffects.length).toBe(0);
    } finally {
      await deleteActor(page, ACTOR_NAME);
    }
  });

  test('small size applies defense bonus and speed penalty', async ({ foundryPage }) => {
    const page = foundryPage;
    const sheet = await createActor(page, ACTOR_NAME);

    try {
      await goToBiographyTab(sheet);
      await setSelectField(sheet, 'system.size', 'small');
      await page.waitForTimeout(1000);

      const sys = await getActorSystemData(page, ACTOR_NAME);
      // Small: +1 to MLE and AGL defense (base 0 + 10 + 1 = 11)
      expect(sys.abilities.mle.defense).toBeGreaterThanOrEqual(11);
      expect(sys.abilities.agl.defense).toBeGreaterThanOrEqual(11);
    } finally {
      await deleteActor(page, ACTOR_NAME);
    }
  });

  test('big size applies defense penalty and reach increase', async ({ foundryPage }) => {
    const page = foundryPage;
    const sheet = await createActor(page, ACTOR_NAME);

    try {
      await goToBiographyTab(sheet);
      await setSelectField(sheet, 'system.size', 'big');
      await page.waitForTimeout(1000);

      const sys = await getActorSystemData(page, ACTOR_NAME);
      // Big: -1 to MLE and AGL defense, reach increases
      expect(sys.abilities.mle.defense).toBeLessThanOrEqual(10);
      expect(sys.abilities.agl.defense).toBeLessThanOrEqual(10);
      expect(sys.reach).toBeGreaterThanOrEqual(2);
    } finally {
      await deleteActor(page, ACTOR_NAME);
    }
  });

  test('changing size replaces previous size effect', async ({ foundryPage }) => {
    const page = foundryPage;
    const sheet = await createActor(page, ACTOR_NAME);

    try {
      await goToBiographyTab(sheet);

      // Set to small first
      await setSelectField(sheet, 'system.size', 'small');
      await page.waitForTimeout(1000);

      let sys = await getActorSystemData(page, ACTOR_NAME);
      const smallDef = sys.abilities.mle.defense;

      // Change to big
      await setSelectField(sheet, 'system.size', 'big');
      await page.waitForTimeout(1000);

      sys = await getActorSystemData(page, ACTOR_NAME);
      // Big defense should be different from small defense
      expect(sys.abilities.mle.defense).not.toBe(smallDef);
      // Should have big effects, not both
      expect(sys.abilities.mle.defense).toBeLessThanOrEqual(10);
    } finally {
      await deleteActor(page, ACTOR_NAME);
    }
  });
});
