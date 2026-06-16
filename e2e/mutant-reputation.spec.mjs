import { test, expect } from './fixtures.mjs';
import {
  createActor,
  setNumericField,
  getActorSystemData,
  getGameSetting,
  setGameSetting,
  getLastChatMessage,
  updateActorData,
  deleteActor,
  dismissNotifications,
} from './helpers.mjs';

const ACTOR_NAME = 'E2E Reputation Test';

test.describe('Mutant Reputation System', () => {

  test.afterEach(async ({ foundryPage }) => {
    await deleteActor(foundryPage, ACTOR_NAME);
    // Reset settings to defaults
    await setGameSetting(foundryPage, 'mutantReputationEnabled', false);
  });

  test('mutant reputation setting is accessible', async ({ foundryPage }) => {
    const page = foundryPage;
    const enabled = await getGameSetting(page, 'mutantReputationEnabled');
    expect(typeof enabled).toBe('boolean');
  });

  test('enabling reputation with Feared shows Trouble notice on Ego roll', async ({ foundryPage }) => {
    const page = foundryPage;
    const sheet = await createActor(page, ACTOR_NAME);

    try {
      await setNumericField(sheet, 'system.abilities.ego.value', 2);

      await setGameSetting(page, 'mutantReputationEnabled', true);
      await setGameSetting(page, 'mutantReputationLevel', 'feared');

      // Trigger an Ego roll via the sheet
      await dismissNotifications(page);
      const rollable = sheet.locator('.rollable[data-ability-key="ego"]').first();
      await rollable.click();
      await page.waitForTimeout(3000);

      // Check if a roll dialog appeared and submit it, or if it went straight to chat
      const dialogSubmit = page.locator('dialog button[type="submit"], dialog button.dialog-button');
      if (await dialogSubmit.count() > 0) {
        await dialogSubmit.first().click();
        await page.waitForTimeout(2000);
      }

      const msg = await getLastChatMessage(page);
      expect(msg).not.toBeNull();
      // The flavor or content should mention reputation
      const combined = (msg.flavor + msg.content).toLowerCase();
      expect(combined).toContain('reputation');
    } finally {
      await deleteActor(page, ACTOR_NAME);
    }
  });

  test('reputation has no effect on non-Ego rolls', async ({ foundryPage }) => {
    const page = foundryPage;
    const sheet = await createActor(page, ACTOR_NAME);

    try {
      await setNumericField(sheet, 'system.abilities.mle.value', 3);

      await setGameSetting(page, 'mutantReputationEnabled', true);
      await setGameSetting(page, 'mutantReputationLevel', 'feared');

      // Trigger a Melee roll
      await dismissNotifications(page);
      const rollable = sheet.locator('.rollable[data-ability-key="mle"]').first();
      await rollable.click();
      await page.waitForTimeout(3000);

      const dialogSubmit = page.locator('dialog button[type="submit"], dialog button.dialog-button');
      if (await dialogSubmit.count() > 0) {
        await dialogSubmit.first().click();
        await page.waitForTimeout(2000);
      }

      const msg = await getLastChatMessage(page);
      expect(msg).not.toBeNull();
      const combined = (msg.flavor + msg.content).toLowerCase();
      expect(combined).not.toContain('reputation');
    } finally {
      await deleteActor(page, ACTOR_NAME);
    }
  });

  test('per-actor override takes precedence over world setting', async ({ foundryPage }) => {
    const page = foundryPage;
    const sheet = await createActor(page, ACTOR_NAME);

    try {
      await setNumericField(sheet, 'system.abilities.ego.value', 2);

      await setGameSetting(page, 'mutantReputationEnabled', true);
      await setGameSetting(page, 'mutantReputationLevel', 'feared');
      await updateActorData(page, ACTOR_NAME, {
        'system.mutantReputation': 'liked',
      });

      await dismissNotifications(page);
      const rollable = sheet.locator('.rollable[data-ability-key="ego"]').first();
      await rollable.click();
      await page.waitForTimeout(3000);

      const dialogSubmit = page.locator('dialog button[type="submit"], dialog button.dialog-button');
      if (await dialogSubmit.count() > 0) {
        await dialogSubmit.first().click();
        await page.waitForTimeout(2000);
      }

      const msg = await getLastChatMessage(page);
      expect(msg).not.toBeNull();
      const combined = (msg.flavor + msg.content).toLowerCase();
      // Should show liked, not feared
      expect(combined).toContain('liked');
    } finally {
      await deleteActor(page, ACTOR_NAME);
    }
  });

  test('actor set to "world" defers to world setting', async ({ foundryPage }) => {
    const page = foundryPage;
    const sheet = await createActor(page, ACTOR_NAME);

    try {
      await setNumericField(sheet, 'system.abilities.ego.value', 2);

      await setGameSetting(page, 'mutantReputationEnabled', true);
      await setGameSetting(page, 'mutantReputationLevel', 'hated');
      await updateActorData(page, ACTOR_NAME, {
        'system.mutantReputation': 'world',
      });

      await dismissNotifications(page);
      const rollable = sheet.locator('.rollable[data-ability-key="ego"]').first();
      await rollable.click();
      await page.waitForTimeout(3000);

      const dialogSubmit = page.locator('dialog button[type="submit"], dialog button.dialog-button');
      if (await dialogSubmit.count() > 0) {
        await dialogSubmit.first().click();
        await page.waitForTimeout(2000);
      }

      const msg = await getLastChatMessage(page);
      expect(msg).not.toBeNull();
      const combined = (msg.flavor + msg.content).toLowerCase();
      expect(combined).toContain('hated');
    } finally {
      await deleteActor(page, ACTOR_NAME);
    }
  });
});
