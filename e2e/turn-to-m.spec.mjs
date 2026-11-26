import { test, expect } from './fixtures.mjs';
import {
  createActorViaAPI,
  createCombat,
  addToCombat,
  deleteCombat,
  deleteActor,
  dismissNotifications,
  triggerAbilityRoll,
} from './helpers.mjs';

/**
 * Issue #146. A 6M6 initiative roll lets the combatant turn their Marvel die
 * to an M on one action check during the bonus round.
 */

const TOP = 'E2E Turn Top';
const MIDDLE = 'E2E Turn Middle';
const ACTORS = [TOP, MIDDLE];
const INITIATIVE = { [TOP]: 20, [MIDDLE]: 15 };

/**
 * Make the dice show the given faces in order, over and over. 'M' is the
 * lowest face of the Marvel die.
 */
function forceDice(page, faces) {
  return page.evaluate((draws) => {
    window.__e2eRandomUniform ??= CONFIG.Dice.randomUniform;
    let i = 0;
    CONFIG.Dice.randomUniform = () => draws[i++ % draws.length];
  }, faces.map(face => 1 - ((face === 'M' ? 1 : face) - 0.5) / 6));
}

/** Give every combatant a Fantastic initiative result, and the privilege to the named ones. */
function setMarks(page, privileged) {
  return page.evaluate(async ({ initiative, privileged }) => {
    await game.combat.updateEmbeddedDocuments('Combatant', game.combat.combatants.map(c => ({
      _id: c.id,
      initiative: initiative[c.actor.name],
      'flags.marvel-multiverse.fantasticInitiative': true,
      'flags.marvel-multiverse.turnToM': privileged.includes(c.actor.name),
    })));
  }, { initiative: INITIATIVE, privileged });
}

function privileges(page) {
  return page.evaluate(() => Object.fromEntries(
    game.combat.combatants.map(c => [c.actor.name, c.canTurnMarvelDie])));
}

const rollInitiative = (page, name) => page.evaluate(async (n) => {
  await game.combat.rollInitiative(game.combat.combatants.find(c => c.actor.name === n).id);
}, name);

const call = (page, method) => page.evaluate((m) => game.combat[m](), method);

/** Roll a Melee check for an actor and return its card. Every die shows 3 unless faces are given. */
async function rollCheck(page, name, faces = [3]) {
  await forceDice(page, faces);
  await triggerAbilityRoll(page, name, 'mle');
  const id = await page.evaluate(() => game.messages.contents.at(-1).id);
  return { id, button: page.locator(`#chat [data-message-id="${id}"] button.mm-turn-to-m`) };
}

const rollState = (page, id) => page.evaluate((messageId) => {
  const roll = game.messages.get(messageId).rolls[0];
  return { total: roll.total, fantastic: roll.isFantastic };
}, id);

test.describe('Turn the Marvel die to an M (Issue #146)', () => {

  test.beforeEach(async ({ foundryPage: page }) => {
    await dismissNotifications(page);
    for (const name of ACTORS) await createActorViaAPI(page, name);
    await createCombat(page);
    for (const name of ACTORS) await addToCombat(page, name);
    await page.evaluate(() => {
      ui.sidebar.expand();
      ui.sidebar.activateTab('chat');
    });
  });

  test.afterEach(async ({ foundryPage: page }) => {
    await page.evaluate(() => {
      if (window.__e2eRandomUniform) CONFIG.Dice.randomUniform = window.__e2eRandomUniform;
      delete window.__e2eRandomUniform;
    });
    await deleteCombat(page);
    for (const name of ACTORS) await deleteActor(page, name);
  });

  test('a 6M6 initiative roll grants the privilege and a lesser Fantastic roll takes it away', async ({ foundryPage: page }) => {
    await forceDice(page, [6, 'M', 6]);
    await rollInitiative(page, TOP);
    expect(await privileges(page)).toEqual({ [TOP]: true, [MIDDLE]: false });

    await forceDice(page, [5, 'M', 6]);
    await rollInitiative(page, TOP);
    expect(await privileges(page)).toEqual({ [TOP]: false, [MIDDLE]: false });
  });

  test('an edge added from the initiative chat card grants the privilege when it makes the roll 6M6', async ({ foundryPage: page }) => {
    await forceDice(page, [5, 'M', 6]);
    await rollInitiative(page, TOP);
    const messageId = await page.evaluate(() => game.messages.contents.findLast(m => m.rolls.length).id);
    expect(await privileges(page)).toEqual({ [TOP]: false, [MIDDLE]: false });

    await forceDice(page, [6]);
    await page.locator(`#chat [data-message-id="${messageId}"] button.retroEdgeMode[data-retro-action="edge"][data-index="0"]`)
      .click({ timeout: 10000 });
    await expect.poll(() => privileges(page)).toEqual({ [TOP]: true, [MIDDLE]: false });
  });

  test('side initiative in Big Fight mode grants the privilege to a side that rolled 6M6', async ({ foundryPage: page }) => {
    await page.evaluate(() => ui.sidebar.activateTab('combat'));
    await page.locator('.mm-big-fight-toggle').click();
    await expect(page.locator('.mm-big-fight-roll-initiative')).toBeVisible();

    await forceDice(page, [6, 'M', 6]);
    await page.locator('.mm-big-fight-roll-initiative').click();
    await expect.poll(() => privileges(page)).toEqual({ [TOP]: true, [MIDDLE]: true });

    await forceDice(page, [5, 'M', 6]);
    await page.locator('.mm-big-fight-roll-initiative').click();
    await expect.poll(() => privileges(page)).toEqual({ [TOP]: false, [MIDDLE]: false });
  });

  test('the button turns the Marvel die on the card to an M, raises the total, and is used up for every card', async ({ foundryPage: page }) => {
    await setMarks(page, [TOP]);
    await call(page, 'startCombat');
    const first = await rollCheck(page, TOP);
    const second = await rollCheck(page, TOP);
    await expect(first.button).toHaveCount(1);
    await expect(second.button).toHaveCount(1);
    const before = await rollState(page, first.id);
    expect(before.fantastic).toBe(false);

    await first.button.click();
    await expect.poll(() => rollState(page, first.id)).toEqual({ total: before.total + 3, fantastic: true });
    await expect(page.locator(`#chat [data-message-id="${first.id}"] .dice-total`)).toHaveText(String(before.total + 3));
    await expect(page.locator(`#chat [data-message-id="${first.id}"] li.roll.marvel-roll.fantastic`)).toHaveCount(1);
    await expect(first.button).toHaveCount(0);
    await expect(second.button).toHaveCount(0);
    expect(await privileges(page)).toEqual({ [TOP]: false, [MIDDLE]: false });
    expect((await rollState(page, second.id)).fantastic).toBe(false);
  });

  test('a combatant without the privilege gets no button', async ({ foundryPage: page }) => {
    await setMarks(page, [TOP]);
    await call(page, 'startCombat');
    const top = await rollCheck(page, TOP);
    const middle = await rollCheck(page, MIDDLE);
    await expect(top.button).toHaveCount(1);
    await expect(middle.button).toHaveCount(0);
  });

  test('clearing the Fantastic initiative mark takes the privilege away', async ({ foundryPage: page }) => {
    await setMarks(page, [TOP]);
    expect(await privileges(page)).toEqual({ [TOP]: true, [MIDDLE]: false });
    await page.evaluate((name) => game.combat.combatants.find(c => c.actor.name === name)
      .setFlag('marvel-multiverse', 'fantasticInitiative', false), TOP);
    expect(await privileges(page)).toEqual({ [TOP]: false, [MIDDLE]: false });
  });

  test('a check whose Marvel die already shows an M gets no button', async ({ foundryPage: page }) => {
    await setMarks(page, [TOP]);
    await call(page, 'startCombat');
    const plain = await rollCheck(page, TOP);
    const fantastic = await rollCheck(page, TOP, [3, 'M', 3]);
    await expect(plain.button).toHaveCount(1);
    await expect(fantastic.button).toHaveCount(0);
  });

  test('the button is offered only while the bonus round runs, and only on checks rolled in it', async ({ foundryPage: page }) => {
    await setMarks(page, [TOP]);
    await call(page, 'startCombat');
    const during = await rollCheck(page, TOP);
    await expect(during.button).toHaveCount(1);

    await call(page, 'nextRound');
    await expect(during.button).toHaveCount(0);
    const after = await rollCheck(page, TOP);

    await call(page, 'previousRound');
    await expect(during.button).toHaveCount(1);
    await expect(after.button).toHaveCount(0);
  });

  test('a roll that is not a d616 check is not recorded as a bonus round check', async ({ foundryPage: page }) => {
    await setMarks(page, [TOP]);
    await call(page, 'startCombat');
    const check = await rollCheck(page, TOP);
    const plainId = await page.evaluate(async (name) => {
      const actor = game.actors.find(a => a.name === name);
      const roll = new Roll('1d6');
      const message = await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }) });
      return message.id;
    }, TOP);

    const recorded = (id) => page.evaluate(
      (messageId) => game.messages.get(messageId).getFlag('marvel-multiverse', 'bonusRoundCombat') ?? null, id);
    expect(await recorded(check.id)).toBe(await page.evaluate(() => game.combat.id));
    expect(await recorded(plainId)).toBeNull();
  });

  test('resetting initiative takes the privilege away', async ({ foundryPage: page }) => {
    await setMarks(page, [TOP]);
    const stored = () => page.evaluate((name) => game.combat.combatants
      .find(c => c.actor.name === name).getFlag('marvel-multiverse', 'turnToM'), TOP);
    expect(await stored()).toBe(true);
    await call(page, 'resetAll');
    expect(await stored()).toBe(false);
  });
});

test.describe('who may turn the Marvel die (Issue #146)', () => {
  const PLAYER = 'E2E Turn Player';

  const button = (page, id) => page.locator(`#chat [data-message-id="${id}"] button.mm-turn-to-m`);

  test.afterEach(async ({ foundryPage: page }) => {
    await page.evaluate(async (name) => {
      CONFIG.Dice.randomUniform = window.__e2eRandomUniform ?? CONFIG.Dice.randomUniform;
      delete window.__e2eRandomUniform;
      const users = game.users.filter(u => u.name === name);
      if (users.length) await User.deleteDocuments(users.map(u => u.id));
    }, PLAYER);
    await deleteCombat(page);
    for (const name of ACTORS) await deleteActor(page, name);
  });

  test('a player gets the button only on their own card for a combatant they own, and can use it', async ({ foundryPage: page, browser }) => {
    await dismissNotifications(page);
    for (const name of ACTORS) await createActorViaAPI(page, name);
    await createCombat(page);
    for (const name of ACTORS) await addToCombat(page, name);

    // The player owns the first actor and can only see the second.
    await page.evaluate(async ({ name, owned, seen }) => {
      const stale = game.users.filter(u => u.name === name);
      if (stale.length) await User.deleteDocuments(stale.map(u => u.id));
      const user = await User.create({ name, role: CONST.USER_ROLES.PLAYER });
      await game.actors.find(a => a.name === owned).update({ [`ownership.${user.id}`]: 3 });
      await game.actors.find(a => a.name === seen).update({ [`ownership.${user.id}`]: 2 });
      ui.sidebar.expand();
      ui.sidebar.activateTab('chat');
    }, { name: PLAYER, owned: TOP, seen: MIDDLE });
    await setMarks(page, ACTORS);
    await call(page, 'startCombat');

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
      await playerPage.waitForFunction(() => window.game?.ready === true, { timeout: 60_000 });
      await playerPage.evaluate(() => {
        ui.sidebar.expand();
        ui.sidebar.activateTab('chat');
      });

      const own = (await rollCheck(playerPage, TOP)).id;
      const notOwned = (await rollCheck(playerPage, MIDDLE)).id;
      const byNarrator = (await rollCheck(page, TOP)).id;

      await expect(button(playerPage, own)).toHaveCount(1);
      await expect(button(playerPage, notOwned)).toHaveCount(0);
      await expect(button(playerPage, byNarrator)).toHaveCount(0);
      for (const id of [own, notOwned, byNarrator]) await expect(button(page, id)).toHaveCount(1);

      await button(playerPage, own).click();
      await expect.poll(() => rollState(page, own)).toMatchObject({ fantastic: true });
      await expect.poll(() => privileges(page)).toEqual({ [TOP]: false, [MIDDLE]: true });
    } finally {
      await context.close();
    }
  });
});
