import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:30000';

export default async function globalSetup() {
  cleanPreviousResults();
  await verifyFoundryRunning();
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

async function verifyFoundryRunning() {
  try {
    const res = await fetch(BASE_URL, { redirect: 'manual' });
    const location = res.headers.get('location') || '';
    if (res.status === 302 && (location.includes('/join') || location.includes('/game'))) {
      console.log('Foundry is running with a world active.');
      return;
    }
    if (res.ok || res.status === 302) {
      console.log('Foundry is running (world may need to be launched manually).');
      return;
    }
    throw new Error(`Foundry responded with unexpected status ${res.status}`);
  } catch (err) {
    if (err.cause?.code === 'ECONNREFUSED') {
      throw new Error(
        `Foundry is not running at ${BASE_URL}. Start Foundry and launch the marvel-616 world before running E2E tests.`
      );
    }
    throw err;
  }
}
