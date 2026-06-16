import { test, expect } from './fixtures.mjs';

test.describe('FoundryVTT Marvel Multiverse - Smoke Tests', () => {

  test('game is ready and loaded', async ({ foundryPage }) => {
    const isReady = await foundryPage.evaluate(() => window.game?.ready);
    expect(isReady).toBe(true);
  });

  test('correct game system is active', async ({ foundryPage }) => {
    const systemId = await foundryPage.evaluate(() => window.game?.system?.id);
    expect(systemId).toBe('marvel-multiverse');
  });

  test('sidebar tabs are rendered', async ({ foundryPage }) => {
    await expect(foundryPage.locator('#sidebar-tabs')).toBeVisible();
  });

});
