import { test, expect } from './fixtures.mjs';
import {
  createActorViaAPI,
  updateActorData,
  deleteActor,
  dismissNotifications,
} from './helpers.mjs';

/**
 * Regression tests for upstream issue mjording/marvel-multiverse#89:
 * Power items could not be opened on character sheets — clicking them
 * produced errors instead of rendering the item sheet.
 */

const ACTOR_NAME = 'E2E Power Sheet Test';

test.describe('Power Item Sheet (Issue #89)', () => {

  test.afterEach(async ({ foundryPage }) => {
    await deleteActor(foundryPage, ACTOR_NAME);
  });

  test('power item can be created on a character', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME);

    const powerName = await page.evaluate(async (actorName) => {
      const actor = game.actors.find(a => a.name === actorName);
      const [power] = await actor.createEmbeddedDocuments('Item', [{
        name: 'Test Flight',
        type: 'power',
        system: { description: 'Can fly through the air.' },
      }]);
      return power.name;
    }, ACTOR_NAME);

    expect(powerName).toBe('Test Flight');
  });

  test('power item sheet renders without error', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME);

    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.evaluate(async (actorName) => {
      const actor = game.actors.find(a => a.name === actorName);
      const [power] = await actor.createEmbeddedDocuments('Item', [{
        name: 'Test Telepathy',
        type: 'power',
        system: { description: 'Read minds.' },
      }]);
      power.sheet.render(true);
    }, ACTOR_NAME);
    await page.waitForTimeout(2000);

    const sheetVisible = await page.evaluate(() => {
      return Object.values(ui.windows).some(w =>
        w instanceof ItemSheet && w.item?.name === 'Test Telepathy'
      );
    });
    expect(sheetVisible).toBe(true);

    const sheetErrors = errors.filter(e =>
      e.includes('power') || e.includes('sheet') || e.includes('render') || e.includes('template')
    );
    expect(sheetErrors).toHaveLength(0);

    await page.evaluate(() => {
      const sheet = Object.values(ui.windows).find(w =>
        w instanceof ItemSheet && w.item?.name === 'Test Telepathy'
      );
      if (sheet) sheet.close();
    });
  });

  test('power item on NPC renders its sheet', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME, 'npc');

    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.evaluate(async (actorName) => {
      const actor = game.actors.find(a => a.name === actorName);
      const [power] = await actor.createEmbeddedDocuments('Item', [{
        name: 'NPC Super Strength',
        type: 'power',
        system: { description: 'Enhanced physical power.' },
      }]);
      power.sheet.render(true);
    }, ACTOR_NAME);
    await page.waitForTimeout(2000);

    const sheetVisible = await page.evaluate(() => {
      return Object.values(ui.windows).some(w =>
        w instanceof ItemSheet && w.item?.name === 'NPC Super Strength'
      );
    });
    expect(sheetVisible).toBe(true);

    const sheetErrors = errors.filter(e =>
      e.includes('power') || e.includes('sheet') || e.includes('render')
    );
    expect(sheetErrors).toHaveLength(0);

    await page.evaluate(() => {
      const sheet = Object.values(ui.windows).find(w =>
        w instanceof ItemSheet && w.item?.name === 'NPC Super Strength'
      );
      if (sheet) sheet.close();
    });
  });

  test('weapon item sheet renders without error', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME);

    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.evaluate(async (actorName) => {
      const actor = game.actors.find(a => a.name === actorName);
      const [weapon] = await actor.createEmbeddedDocuments('Item', [{
        name: 'Test Blaster',
        type: 'weapon',
        system: {
          description: 'A ranged weapon.',
          attackTarget: 'agl',
          damageType: 'health',
        },
      }]);
      weapon.sheet.render(true);
    }, ACTOR_NAME);
    await page.waitForTimeout(2000);

    const sheetVisible = await page.evaluate(() => {
      return Object.values(ui.windows).some(w =>
        w instanceof ItemSheet && w.item?.name === 'Test Blaster'
      );
    });
    expect(sheetVisible).toBe(true);

    const sheetErrors = errors.filter(e =>
      e.includes('weapon') || e.includes('sheet') || e.includes('render')
    );
    expect(sheetErrors).toHaveLength(0);

    await page.evaluate(() => {
      const sheet = Object.values(ui.windows).find(w =>
        w instanceof ItemSheet && w.item?.name === 'Test Blaster'
      );
      if (sheet) sheet.close();
    });
  });

  test('trait item sheet renders without error', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME);

    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.evaluate(async (actorName) => {
      const actor = game.actors.find(a => a.name === actorName);
      const [trait] = await actor.createEmbeddedDocuments('Item', [{
        name: 'Test Brave',
        type: 'trait',
        system: { description: 'Fearless in battle.' },
      }]);
      trait.sheet.render(true);
    }, ACTOR_NAME);
    await page.waitForTimeout(2000);

    const sheetVisible = await page.evaluate(() => {
      return Object.values(ui.windows).some(w =>
        w instanceof ItemSheet && w.item?.name === 'Test Brave'
      );
    });
    expect(sheetVisible).toBe(true);

    await page.evaluate(() => {
      const sheet = Object.values(ui.windows).find(w =>
        w instanceof ItemSheet && w.item?.name === 'Test Brave'
      );
      if (sheet) sheet.close();
    });
  });

  test('multiple item types can be opened sequentially', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME);

    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.evaluate(async (actorName) => {
      const actor = game.actors.find(a => a.name === actorName);
      await actor.createEmbeddedDocuments('Item', [
        { name: 'Seq Power', type: 'power', system: { description: 'A power.' } },
        { name: 'Seq Weapon', type: 'weapon', system: { description: 'A weapon.', attackTarget: 'mle' } },
        { name: 'Seq Tag', type: 'tag', system: { description: 'A tag.' } },
      ]);
    }, ACTOR_NAME);
    await page.waitForTimeout(1000);

    for (const itemName of ['Seq Power', 'Seq Weapon', 'Seq Tag']) {
      await page.evaluate(async (name) => {
        const item = game.items?.find(i => i.name === name)
          ?? game.actors.contents.flatMap(a => a.items.contents).find(i => i.name === name);
        if (item) item.sheet.render(true);
      }, itemName);
      await page.waitForTimeout(1500);

      const visible = await page.evaluate((name) => {
        return Object.values(ui.windows).some(w =>
          w instanceof ItemSheet && w.item?.name === name
        );
      }, itemName);
      expect(visible, `${itemName} sheet should be visible`).toBe(true);

      await page.evaluate((name) => {
        const sheet = Object.values(ui.windows).find(w =>
          w instanceof ItemSheet && w.item?.name === name
        );
        if (sheet) sheet.close();
      }, itemName);
      await page.waitForTimeout(500);
    }

    const sheetErrors = errors.filter(e =>
      e.includes('sheet') || e.includes('render') || e.includes('template')
    );
    expect(sheetErrors).toHaveLength(0);
  });
});
