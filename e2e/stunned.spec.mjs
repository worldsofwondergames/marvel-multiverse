import { test, expect } from './fixtures.mjs';
import {
  createActorViaAPI,
  deleteActor,
  dismissNotifications,
  createScene,
  activateScene,
  placeToken,
  deleteScene,
} from './helpers.mjs';

/**
 * Issue #143. A stunned character has trouble on action checks and cannot
 * move, and attacks against them have an edge.
 */

const HERO = 'E2E Stunned Hero';
const FOE = 'E2E Stunned Foe';
const OTHER = 'E2E Stunned Other';
const SCENE = 'E2E Stunned Scene';
const ACTORS = [HERO, FOE, OTHER];

const MLE_FORMULA = '{1d6,1dm,1d6}+@abilities.mle.value';

/**
 * How a test makes its check. Each one runs the system's own roll code: the
 * ability name on the sheet, an attack row on the sheet, or a power posted to
 * chat.
 */
const SHEET_ROLLS = {
  ability: { rollType: 'ability', abilityKey: 'mle' },
  attack: { formula: MLE_FORMULA, label: 'mle', abilityKey: 'mle' },
};

/** Put the stunned condition on a world actor, or take it off. */
const stunActor = (page, name, active) => page.evaluate(async ({ name, active }) => {
  await game.actors.find(a => a.name === name).toggleStatusEffect('stunned', { active });
}, { name, active });

/** Put the stunned condition on the actor of a token on the canvas, or take it off. */
const stunToken = (page, name, active) => page.evaluate(async ({ name, active }) => {
  const token = canvas.tokens.placeables.find(t => t.name === name);
  await token.actor.toggleStatusEffect('stunned', { active });
}, { name, active });

/** Target exactly the named tokens. */
const target = (page, names) => page.evaluate((names) => {
  game.user.targets.forEach(t => t.setTarget(false));
  for (const name of names) {
    canvas.tokens.placeables.find(t => t.name === name).setTarget(true, { releaseOthers: false });
  }
}, names);

/** Make a check and return the edge mode and stunned notes of its chat card. */
function roll(page, name, how) {
  return page.evaluate(async ({ name, how, dataset, formula }) => {
    const before = new Set(game.messages.map(m => m.id));
    const actor = game.actors.find(a => a.name === name);
    if (how === 'power') {
      const [item] = await actor.createEmbeddedDocuments('Item', [{
        name: 'E2E Stunned Strike',
        type: 'power',
        system: { ability: 'mle', formula, attack: true },
      }]);
      await item.roll();
      await item.delete();
    } else {
      await actor.sheet._onRoll({
        preventDefault() {},
        currentTarget: { dataset, closest: () => null },
      });
    }
    // The sheet does not wait for its chat card, so wait for it here.
    let card;
    for (let i = 0; i < 100 && !card; i++) {
      card = game.messages.contents.findLast(m => !before.has(m.id) && m.rolls.length);
      if (!card) await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!card) throw new Error('The check posted no roll to chat');
    const flavor = new DOMParser().parseFromString(card.flavor, 'text/html');
    return {
      mode: card.rolls[0].options.edgeMode,
      notes: [...flavor.querySelectorAll('.mm-roll-note')].map(n => n.className.replace('mm-roll-note ', '')),
    };
  }, { name, how, dataset: SHEET_ROLLS[how], formula: MLE_FORMULA });
}

const TROUBLE = { mode: -1, notes: ['-stunned'] };
const EDGE = { mode: 1, notes: ['-target-stunned'] };
const NORMAL = { mode: 0, notes: [] };

async function cleanUp(page) {
  await page.evaluate(() => game.user.targets.forEach(t => t.setTarget(false)));
  await deleteScene(page, SCENE);
  for (const name of ACTORS) await deleteActor(page, name);
}

test.describe('Stunned condition (Issue #143)', () => {
  test.beforeEach(async ({ foundryPage: page }) => {
    await dismissNotifications(page);
    await cleanUp(page);
  });

  test.afterEach(async ({ foundryPage: page }) => {
    await cleanUp(page);
  });

  for (const type of ['character', 'npc']) {
    for (const kind of Object.keys(SHEET_ROLLS)) {
      test(`a stunned ${type} has trouble on an ${kind} roll from the sheet until the condition ends`, async ({ foundryPage: page }) => {
        await createActorViaAPI(page, HERO, type);
        await stunActor(page, HERO, true);
        expect(await roll(page, HERO, kind)).toEqual(TROUBLE);

        await stunActor(page, HERO, false);
        expect(await roll(page, HERO, kind)).toEqual(NORMAL);
      });
    }
  }

  test('a stunned character has trouble on a power rolled to chat until the condition ends', async ({ foundryPage: page }) => {
    await createActorViaAPI(page, HERO);
    await stunActor(page, HERO, true);
    expect(await roll(page, HERO, 'power')).toEqual(TROUBLE);

    await stunActor(page, HERO, false);
    expect(await roll(page, HERO, 'power')).toEqual(NORMAL);
  });

  test('being stunned cancels an edge the ability already had', async ({ foundryPage: page }) => {
    await createActorViaAPI(page, HERO);
    await page.evaluate(async (name) => {
      await game.actors.find(a => a.name === name).update({ 'system.abilities.mle.edge': true });
    }, HERO);
    expect(await roll(page, HERO, 'attack')).toEqual({ mode: 1, notes: [] });

    await stunActor(page, HERO, true);
    expect(await roll(page, HERO, 'attack')).toEqual({ mode: 0, notes: ['-stunned'] });
  });

  test.describe('with tokens on a scene', () => {
    test.beforeEach(async ({ foundryPage: page }) => {
      for (const name of ACTORS) await createActorViaAPI(page, name);
      await createScene(page, SCENE);
      await activateScene(page, SCENE);
      await placeToken(page, FOE, 300, 300);
      await placeToken(page, OTHER, 500, 300);
      await expect.poll(() => page.evaluate(() => canvas.tokens.placeables.length)).toBe(2);
    });

    test('an attack against a stunned target has an edge until the condition ends', async ({ foundryPage: page }) => {
      await stunToken(page, FOE, true);
      await target(page, [FOE]);
      expect(await roll(page, HERO, 'attack')).toEqual(EDGE);
      expect(await roll(page, HERO, 'ability')).toEqual(EDGE);
      expect(await roll(page, HERO, 'power')).toEqual(EDGE);

      await stunToken(page, FOE, false);
      expect(await roll(page, HERO, 'attack')).toEqual(NORMAL);
    });

    test('an attack against two targets has the edge only when both are stunned', async ({ foundryPage: page }) => {
      await stunToken(page, FOE, true);
      await stunToken(page, OTHER, true);
      await target(page, [FOE, OTHER]);
      expect(await roll(page, HERO, 'attack')).toEqual(EDGE);

      await stunToken(page, OTHER, false);
      expect(await roll(page, HERO, 'attack')).toEqual(NORMAL);
    });

    test('a stunned attacker against a stunned target rolls normally', async ({ foundryPage: page }) => {
      await stunToken(page, FOE, true);
      await stunActor(page, HERO, true);
      await target(page, [FOE]);
      expect(await roll(page, HERO, 'attack')).toEqual({ mode: 0, notes: ['-stunned', '-target-stunned'] });
    });

    test('a player cannot move a stunned token, and the Narrator can', async ({ foundryPage: page, browser }) => {
      const PLAYER = 'E2E Stunned Player';
      const xOf = () => page.evaluate((name) => game.scenes.active.tokens.find(t => t.name === name).x, FOE);
      const moveTo = (p, x) => p.evaluate(async ({ name, x }) => {
        await canvas.tokens.placeables.find(t => t.name === name).document.update({ x });
      }, { name: FOE, x });

      await page.evaluate(async ({ player, owned }) => {
        const stale = game.users.filter(u => u.name === player);
        if (stale.length) await User.deleteDocuments(stale.map(u => u.id));
        const user = await User.create({ name: player, role: CONST.USER_ROLES.PLAYER });
        await game.actors.find(a => a.name === owned).update({ [`ownership.${user.id}`]: 3 });
      }, { player: PLAYER, owned: FOE });

      const context = await browser.newContext({
        viewport: { width: 1600, height: 900 },
        baseURL: 'http://localhost:30000',
      });
      const playerPage = await context.newPage();
      try {
        await playerPage.goto('/join');
        await playerPage.waitForSelector('select[name="userid"]', { timeout: 30_000 });
        await playerPage.selectOption('select[name="userid"]', { label: PLAYER });
        await playerPage.locator('button[name="join"]').click();
        await playerPage.waitForURL('**/game', { timeout: 60_000 });
        await playerPage.waitForFunction(
          () => window.game?.ready === true && canvas?.ready === true && canvas.tokens.placeables.length === 2,
          { timeout: 60_000 },
        );

        // The player can move the token while it is not stunned.
        await moveTo(playerPage, 400);
        await expect.poll(xOf).toBe(400);

        await stunToken(page, FOE, true);
        await playerPage.waitForFunction(
          (name) => canvas.tokens.placeables.find(t => t.name === name).actor.statuses.has('stunned'), FOE);
        await moveTo(playerPage, 600);
        await expect(playerPage.locator('#notifications .notification.warning')).toContainText(FOE);
        expect(await xOf()).toBe(400);

        await moveTo(page, 700);
        await expect.poll(xOf).toBe(700);
      } finally {
        await context.close();
        await page.evaluate(async (player) => {
          const users = game.users.filter(u => u.name === player);
          if (users.length) await User.deleteDocuments(users.map(u => u.id));
        }, PLAYER);
      }
    });
  });
});
