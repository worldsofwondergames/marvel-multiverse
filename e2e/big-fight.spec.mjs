import { test, expect } from './fixtures.mjs';
import { createActorViaAPI, createCombat, addToCombat, deleteCombat, deleteActor } from './helpers.mjs';

const HERO = 'E2E Big Fight Hero';

test.describe('Big Fight toggle', () => {
  test.afterEach(async ({ foundryPage }) => {
    await deleteCombat(foundryPage);
    await deleteActor(foundryPage, HERO);
  });

  test('toggling Big Fight persists across rounds and reverts cleanly when disabled', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, HERO);
    await createCombat(page);
    await addToCombat(page, HERO);

    // The combat tracker renders into the sidebar regardless of which tab is
    // active, but the toggle button only becomes clickable once the sidebar
    // is expanded and the Combat tab is the one showing.
    await page.evaluate(() => {
      ui.sidebar.expand();
      ui.sidebar.activateTab('combat');
    });

    await page.locator('.mm-big-fight-toggle').click();
    await expect(page.locator('.mm-big-fight-toggle.-enabled')).toBeVisible();

    const enabledAfterRound = await page.evaluate(async () => {
      await game.combat.nextRound();
      return game.combat.getFlag('marvel-multiverse', 'bigFight')?.enabled;
    });
    expect(enabledAfterRound).toBe(true);

    await page.locator('.mm-big-fight-toggle.-enabled').click();
    await expect(page.locator('.mm-big-fight-toggle:not(.-enabled)')).toBeVisible();

    const stillHasData = await page.evaluate(() => game.combat.getFlag('marvel-multiverse', 'bigFight'));
    expect(stillHasData.enabled).toBe(false);
  });
});
