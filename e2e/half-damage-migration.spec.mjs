import { test, expect } from './fixtures.mjs';
import { createActorViaAPI, dismissNotifications } from './helpers.mjs';

/**
 * A compendium edit never reaches a power already owned by an actor, so the
 * twelve half-damage powers kept dealing full damage on every character that
 * imported them before `damageScale` existed. A pass on world load repairs
 * them.
 *
 * Driven through a real page reload rather than by calling the migration
 * directly: the point at issue is that it runs on startup at all.
 */
const HERO = 'E2E Migration Hero';

/** Invented prose, so no published sentence is stored in this repo. */
const HALF = 'Every target the strike reaches takes half regular damage from the impact.';
const FULL = 'Every target the strike reaches is knocked flat and takes damage as usual.';

async function powerScales(page) {
  return page.evaluate((name) => {
    const actor = game.actors.find((a) => a.name === name);
    if (!actor) throw new Error(`Actor "${name}" not found`);
    const byName = {};
    for (const item of actor.items) byName[item.name] = item.system.damageScale;
    return byName;
  }, HERO);
}

test.describe('half-damage powers already owned by a character', () => {
  test.afterEach(async ({ foundryPage: page }) => {
    await page.evaluate(async (name) => {
      const stale = game.actors.filter((a) => a.name === name);
      if (stale.length) await Actor.deleteDocuments(stale.map((a) => a.id));
    }, HERO);
  });

  test('a reload scales the half-damage power and leaves the others alone', async ({ foundryPage: page }) => {
    await page.waitForFunction(() => window.game?.ready === true, { timeout: 60_000 });
    await dismissNotifications(page);
    await createActorViaAPI(page, HERO);

    await page.evaluate(async ({ name, half, full }) => {
      const actor = game.actors.find((a) => a.name === name);
      await actor.createEmbeddedDocuments('Item', [
        { name: 'E2E Halving Power', type: 'power', system: { effect: half, damageScale: 1 } },
        { name: 'E2E Ordinary Power', type: 'power', system: { effect: full, damageScale: 1 } },
        // Deliberately set by a GM: the pass must not reclaim it.
        { name: 'E2E Quartered Power', type: 'power', system: { effect: half, damageScale: 0.25 } },
      ]);
      // Send the world back to before the repair ran.
      await game.settings.set('marvel-multiverse', 'migrationVersion', 0);
    }, { name: HERO, half: HALF, full: FULL });

    const before = await powerScales(page);
    // Presence first: if the fixture were not built, the assertions after the
    // reload would be comparing nothing against nothing.
    expect(before['E2E Halving Power']).toBe(1);
    expect(before['E2E Ordinary Power']).toBe(1);
    expect(before['E2E Quartered Power']).toBe(0.25);

    await page.reload();
    await page.waitForFunction(() => window.game?.ready === true, { timeout: 60_000 });
    await page.waitForFunction(
      () => game.settings.get('marvel-multiverse', 'migrationVersion') > 0,
      { timeout: 30_000 },
    );

    const after = await powerScales(page);
    expect(after['E2E Halving Power']).toBe(0.5);
    // A power with no such rule keeps full damage.
    expect(after['E2E Ordinary Power']).toBe(1);
    // A scale a GM chose is not overwritten.
    expect(after['E2E Quartered Power']).toBe(0.25);
  });

  /**
   * Once the pass has run, a GM must be able to put a power back to full damage
   * and have it stay there. Without the recorded version the pass would run on
   * every load and reclaim it, since a scale of 1 is exactly what it looks for.
   */
  test('a power set back to full damage after the pass is not reclaimed', async ({ foundryPage: page }) => {
    await page.waitForFunction(() => window.game?.ready === true, { timeout: 60_000 });
    await createActorViaAPI(page, HERO);
    await page.evaluate(async ({ name, half }) => {
      const actor = game.actors.find((a) => a.name === name);
      await actor.createEmbeddedDocuments('Item', [
        { name: 'E2E Halving Power', type: 'power', system: { effect: half, damageScale: 1 } },
      ]);
      await game.settings.set('marvel-multiverse', 'migrationVersion', 0);
    }, { name: HERO, half: HALF });

    await page.reload();
    await page.waitForFunction(() => window.game?.ready === true, { timeout: 60_000 });
    await page.waitForFunction(
      () => game.settings.get('marvel-multiverse', 'migrationVersion') > 0,
      { timeout: 30_000 },
    );
    // The pass has run and taken effect, which is what makes the reversal below
    // a deliberate override rather than an untouched default.
    expect((await powerScales(page))['E2E Halving Power']).toBe(0.5);

    await page.evaluate(async (name) => {
      const actor = game.actors.find((a) => a.name === name);
      const item = actor.items.find((i) => i.name === 'E2E Halving Power');
      await item.update({ 'system.damageScale': 1 });
    }, HERO);
    expect((await powerScales(page))['E2E Halving Power']).toBe(1);

    await page.reload();
    await page.waitForFunction(() => window.game?.ready === true, { timeout: 60_000 });
    await page.waitForTimeout(2500);
    expect((await powerScales(page))['E2E Halving Power']).toBe(1);
  });
});
