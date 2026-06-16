import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  foundryPage: async ({ page }, use) => {
    await joinAsGamemaster(page);
    await use(page);
  },
});

async function joinAsGamemaster(page) {
  await page.goto('/join');
  await page.waitForLoadState('networkidle');

  // If we're already in the game (e.g. session persisted), we're done
  if (page.url().includes('/game')) {
    await waitForGameReady(page);
    return;
  }

  await page.waitForSelector('select[name="userid"]', { timeout: 15_000 });

  const gmOption = page.locator('select[name="userid"] option').filter({ hasText: 'Gamemaster' });
  const gmOptionCount = await gmOption.count();
  if (gmOptionCount === 0) {
    throw new Error('Gamemaster user not found in the user selection dropdown.');
  }

  const gmValue = await gmOption.getAttribute('value');
  const isDisabled = await gmOption.evaluate(el => el.disabled);

  if (isDisabled) {
    await page.evaluate((val) => {
      const select = document.querySelector('select[name="userid"]');
      const option = select.querySelector(`option[value="${val}"]`);
      if (option) option.disabled = false;
      select.value = val;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }, gmValue);
  } else {
    await page.selectOption('select[name="userid"]', gmValue);
  }

  const joinButton = page.locator('button[name="join"]');
  await joinButton.click();

  await page.waitForURL('**/game', { timeout: 60_000 });
  await waitForGameReady(page);
}

async function waitForGameReady(page) {
  // Wait for FoundryVTT's game object to be fully initialized
  await page.waitForFunction(() => {
    return window.game?.ready === true;
  }, { timeout: 60_000 });
}

export { expect };
