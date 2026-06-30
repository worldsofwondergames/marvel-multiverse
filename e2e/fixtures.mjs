import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  foundryPage: [async ({ browser }, use) => {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      baseURL: 'http://localhost:30000',
    });
    const page = await context.newPage();
    await joinAsGamemaster(page);
    await use(page);
    await context.close();
  }, { scope: 'worker' }],

  _autoCleanup: [async ({ foundryPage }, use, testInfo) => {
    await ensureSession(foundryPage);
    await use();
    if (testInfo.status !== testInfo.expectedStatus) {
      const screenshot = await foundryPage.screenshot();
      await testInfo.attach('failure-screenshot', {
        body: screenshot,
        contentType: 'image/png',
      });
    }
    await cleanupUIState(foundryPage);
  }, { auto: true }],
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
  await page.waitForFunction(() => {
    return window.game?.ready === true;
  }, { timeout: 60_000 });
}

async function ensureSession(page) {
  try {
    const isReady = await page.evaluate(() => window.game?.ready === true);
    if (isReady && page.url().includes('/game')) return;
  } catch {
    // page in bad state
  }
  await joinAsGamemaster(page);
}

async function cleanupUIState(page) {
  await page.evaluate(async () => {
    Object.values(ui.windows).forEach(w => w.close());
    document.querySelectorAll('#notifications li.notification').forEach(n => n.remove());
    document.querySelectorAll('dialog[open]').forEach(d => d.close());
    if (game.combat) await game.combat.delete();
    game.user.targets.forEach(t => t.setTarget(false));
    const ids = game.messages.contents.map(m => m.id);
    if (ids.length) await ChatMessage.deleteDocuments(ids);
    ui.sidebar?.activateTab?.('chat');
  });
  await page.waitForTimeout(300);
}

export { expect };
