import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:30000';
const WORLD_ID = 'marvel-616';

export default async function globalSetup() {
  cleanPreviousResults();

  const browser = await chromium.launch();
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();

  await launchWorld(page, browser);
  await browser.close();
}

function cleanPreviousResults() {
  const dirs = ['test-results', 'playwright-report'];
  for (const dir of dirs) {
    const fullPath = path.resolve(dir);
    if (fs.existsSync(fullPath)) {
      fs.rmSync(fullPath, { recursive: true, force: true });
      console.log(`Cleaned up ${dir}/`);
    }
  }
}

async function dismissTourOverlay(page) {
  const overlay = page.locator('.tour-overlay');
  if (await overlay.count() > 0) {
    console.log('Tour overlay detected — removing it.');
    await page.evaluate(() => {
      document.querySelectorAll('.tour-overlay, .tour-step, .tour-fadeout, .tour-center-step')
        .forEach(el => el.remove());
    });
    await page.waitForTimeout(500);
  }
}

async function launchWorld(page, browser) {
  await page.goto(`${BASE_URL}/setup`, { waitUntil: 'networkidle' });

  const currentUrl = page.url();
  if (currentUrl.includes('/join') || currentUrl.includes('/game')) {
    console.log('World already running, skipping launch.');
    return;
  }

  const worldItem = page.locator(`li.package.world[data-package-id="${WORLD_ID}"]`);
  const worldExists = await worldItem.count();
  if (worldExists === 0) {
    await browser.close();
    throw new Error(
      `World "${WORLD_ID}" not found on the setup page. ` +
      `Available worlds must include "${WORLD_ID}" to run the e2e test suite.`
    );
  }

  console.log(`Launching world: ${WORLD_ID}`);
  await dismissTourOverlay(page);

  await worldItem.hover();
  const launchButton = worldItem.locator('a[data-action="worldLaunch"]');
  await launchButton.click({ timeout: 10_000 });

  // FoundryVTT may show a compatibility warning dialog — dismiss it
  try {
    const yesButton = page.locator('button[data-action="yes"]');
    await yesButton.waitFor({ state: 'visible', timeout: 5000 });
    await yesButton.click();
  } catch {
    // No warning dialog appeared
  }

  await page.waitForURL('**/join', { timeout: 60_000 });
  await page.waitForLoadState('networkidle');
  console.log('World launched successfully.');
}
