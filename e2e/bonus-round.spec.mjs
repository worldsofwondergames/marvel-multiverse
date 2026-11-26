import { test, expect } from './fixtures.mjs';
import {
  createActorViaAPI,
  createCombat,
  addToCombat,
  deleteCombat,
  deleteActor,
  dismissNotifications,
} from './helpers.mjs';

/**
 * Issue #194. Combatants with a Fantastic initiative result act in a bonus
 * round before round 1.
 */

const TOP = 'E2E Bonus Top';
const MIDDLE = 'E2E Bonus Middle';
const BOTTOM = 'E2E Bonus Bottom';
const ACTORS = [TOP, MIDDLE, BOTTOM];
const INITIATIVE = { [TOP]: 20, [MIDDLE]: 15, [BOTTOM]: 10 };

/** Give each combatant its fixed initiative, and a Fantastic mark to the named ones. */
function setOrder(page, fantastic) {
  return page.evaluate(async ({ initiative, fantastic }) => {
    await game.combat.updateEmbeddedDocuments('Combatant', game.combat.combatants.map(c => ({
      _id: c.id,
      initiative: initiative[c.actor.name],
      'flags.marvel-multiverse.fantasticInitiative': fantastic.includes(c.actor.name),
    })));
  }, { initiative: INITIATIVE, fantastic });
}

/** Whose turn it is, the stored round, and whether the combat is in its bonus round. */
function state(page) {
  return page.evaluate(() => ({
    turn: game.combat.combatant?.actor.name ?? null,
    round: game.combat.round,
    bonus: game.combat.inBonusRound,
  }));
}

const call = (page, method) => page.evaluate((m) => game.combat[m](), method);

/** The tracker row for an actor. */
async function row(page, name) {
  const id = await page.evaluate((n) => game.combat.combatants.find(c => c.actor.name === n).id, name);
  return page.locator(`#combat li.combatant[data-combatant-id="${id}"]`);
}

/**
 * Make every die roll its lowest or a middle face. The lowest face of the
 * Marvel die is the M, and Foundry maps a draw near 1 to the lowest face.
 */
function forceDice(page, fantastic) {
  return page.evaluate((value) => {
    window.__e2eRandomUniform ??= CONFIG.Dice.randomUniform;
    CONFIG.Dice.randomUniform = () => value;
  }, fantastic ? 0.999 : 0.5);
}

function marks(page) {
  return page.evaluate(() => Object.fromEntries(
    game.combat.combatants.map(c => [c.actor.name, c.hasFantasticInitiative])));
}

test.describe('Bonus round (Issue #194)', () => {

  test.beforeEach(async ({ foundryPage: page }) => {
    await dismissNotifications(page);
    for (const name of ACTORS) await createActorViaAPI(page, name);
    await createCombat(page);
    for (const name of ACTORS) await addToCombat(page, name);
    await page.evaluate(() => {
      ui.sidebar.expand();
      ui.sidebar.activateTab('combat');
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

  test('an initiative roll marks the combatant when it is Fantastic and clears the mark when it is not', async ({ foundryPage: page }) => {
    const rollFor = (name) => page.evaluate(async (n) => {
      await game.combat.rollInitiative(game.combat.combatants.find(c => c.actor.name === n).id);
    }, name);

    await forceDice(page, true);
    await rollFor(TOP);
    expect(await marks(page)).toEqual({ [TOP]: true, [MIDDLE]: false, [BOTTOM]: false });

    await forceDice(page, false);
    await rollFor(MIDDLE);
    await rollFor(TOP);
    expect(await marks(page)).toEqual({ [TOP]: false, [MIDDLE]: false, [BOTTOM]: false });
  });

  test('adding an edge to an initiative roll from its chat card marks the combatant when the new result is Fantastic', async ({ foundryPage: page }) => {
    await forceDice(page, false);
    const messageId = await page.evaluate(async (n) => {
      await game.combat.rollInitiative(game.combat.combatants.find(c => c.actor.name === n).id);
      ui.sidebar.activateTab('chat');
      return game.messages.contents.at(-1).id;
    }, TOP);
    expect(await marks(page)).toEqual({ [TOP]: false, [MIDDLE]: false, [BOTTOM]: false });

    await forceDice(page, true);
    await page.locator(`#chat [data-message-id="${messageId}"] button.retroEdgeMode[data-retro-action="edge"][data-index="1"]`)
      .click({ timeout: 10000 });
    await expect.poll(() => marks(page)).toEqual({ [TOP]: true, [MIDDLE]: false, [BOTTOM]: false });
  });

  test('side initiative in Big Fight mode marks every combatant on a side that rolled a Fantastic result', async ({ foundryPage: page }) => {
    await page.locator('.mm-big-fight-toggle').click();
    await expect(page.locator('.mm-big-fight-roll-initiative')).toBeVisible();

    await forceDice(page, true);
    await page.locator('.mm-big-fight-roll-initiative').click();
    await expect.poll(() => marks(page)).toEqual({ [TOP]: true, [MIDDLE]: true, [BOTTOM]: true });

    await forceDice(page, false);
    await page.locator('.mm-big-fight-roll-initiative').click();
    await expect.poll(() => marks(page)).toEqual({ [TOP]: false, [MIDDLE]: false, [BOTTOM]: false });
  });

  test('the encounter starts on the Fantastic combatant, then round 1 starts at the top of the order', async ({ foundryPage: page }) => {
    await setOrder(page, [MIDDLE]);
    await call(page, 'startCombat');
    expect(await state(page)).toEqual({ turn: MIDDLE, round: 1, bonus: true });

    await call(page, 'nextTurn');
    expect(await state(page)).toEqual({ turn: TOP, round: 2, bonus: false });

    await call(page, 'nextTurn');
    expect(await state(page)).toEqual({ turn: MIDDLE, round: 2, bonus: false });
  });

  test('an encounter with no Fantastic result starts at the top with no bonus round', async ({ foundryPage: page }) => {
    await setOrder(page, [MIDDLE]);
    await setOrder(page, []);
    await call(page, 'startCombat');
    expect(await state(page)).toEqual({ turn: TOP, round: 1, bonus: false });

    await call(page, 'nextTurn');
    expect(await state(page)).toEqual({ turn: MIDDLE, round: 1, bonus: false });
  });

  test('two Fantastic combatants act in initiative order, and Previous Turn moves back between them', async ({ foundryPage: page }) => {
    await setOrder(page, [TOP, BOTTOM]);
    await call(page, 'startCombat');
    expect(await state(page)).toEqual({ turn: TOP, round: 1, bonus: true });

    await call(page, 'nextTurn');
    expect(await state(page)).toEqual({ turn: BOTTOM, round: 1, bonus: true });

    await call(page, 'previousTurn');
    expect(await state(page)).toEqual({ turn: TOP, round: 1, bonus: true });
  });

  test('Previous Round from round 1 goes back to the last turn of the bonus round', async ({ foundryPage: page }) => {
    await setOrder(page, [TOP, MIDDLE]);
    await call(page, 'startCombat');
    await call(page, 'nextRound');
    expect(await state(page)).toEqual({ turn: TOP, round: 2, bonus: false });

    await call(page, 'previousRound');
    expect(await state(page)).toEqual({ turn: MIDDLE, round: 1, bonus: true });
  });

  test('the tracker heading names the bonus round and numbers the rounds after it from 1', async ({ foundryPage: page }) => {
    const text = await page.evaluate(() => ({
      bonus: game.i18n.localize('MARVEL_MULTIVERSE.BonusRound.Title'),
      round1: game.i18n.format('COMBAT.Round', { round: 1 }),
      round2: game.i18n.format('COMBAT.Round', { round: 2 }),
    }));
    const title = page.locator('#combat .encounter-title');

    await setOrder(page, [MIDDLE]);
    await call(page, 'startCombat');
    await expect(title).toHaveText(text.bonus);

    await call(page, 'nextTurn');
    await expect(title).toHaveText(text.round1);

    await call(page, 'nextRound');
    await expect(title).toHaveText(text.round2);
  });

  test('combatants who sit out the bonus round are dimmed until it ends', async ({ foundryPage: page }) => {
    await setOrder(page, [MIDDLE]);
    await call(page, 'startCombat');
    const opacity = async (name) => (await row(page, name)).evaluate(el => getComputedStyle(el).opacity);

    await expect.poll(() => opacity(TOP)).not.toBe('1');
    expect(await opacity(MIDDLE)).toBe('1');
    expect(await opacity(BOTTOM)).toBe(await opacity(TOP));

    await call(page, 'nextTurn');
    await expect.poll(() => opacity(TOP)).toBe('1');
    expect(await opacity(BOTTOM)).toBe('1');
  });

  test('a star marks the combatant with a Fantastic result and follows the mark', async ({ foundryPage: page }) => {
    await setOrder(page, [MIDDLE]);
    await expect((await row(page, MIDDLE)).locator('.mm-fantastic-initiative')).toHaveCount(1);
    await expect((await row(page, TOP)).locator('.mm-fantastic-initiative')).toHaveCount(0);

    await setOrder(page, [TOP]);
    await expect((await row(page, TOP)).locator('.mm-fantastic-initiative')).toHaveCount(1);
    await expect((await row(page, MIDDLE)).locator('.mm-fantastic-initiative')).toHaveCount(0);
  });

  test('the Narrator can clear and set the mark from the combatant menu, which changes who acts in the bonus round', async ({ foundryPage: page }) => {
    const labels = await page.evaluate(() => ({
      mark: game.i18n.localize('MARVEL_MULTIVERSE.BonusRound.MarkFantastic'),
      clear: game.i18n.localize('MARVEL_MULTIVERSE.BonusRound.ClearFantastic'),
    }));
    await setOrder(page, [MIDDLE]);

    await (await row(page, MIDDLE)).click({ button: 'right' });
    await page.locator('#context-menu').getByText(labels.clear, { exact: true }).click();
    await expect.poll(() => marks(page)).toEqual({ [TOP]: false, [MIDDLE]: false, [BOTTOM]: false });

    await (await row(page, BOTTOM)).click({ button: 'right' });
    await page.locator('#context-menu').getByText(labels.mark, { exact: true }).click();
    await expect.poll(() => marks(page)).toEqual({ [TOP]: false, [MIDDLE]: false, [BOTTOM]: true });

    await call(page, 'startCombat');
    expect(await state(page)).toEqual({ turn: BOTTOM, round: 1, bonus: true });
  });

  test('resetting initiative clears the marks', async ({ foundryPage: page }) => {
    await setOrder(page, [TOP, MIDDLE]);
    expect(await marks(page)).toEqual({ [TOP]: true, [MIDDLE]: true, [BOTTOM]: false });
    await call(page, 'resetAll');
    expect(await marks(page)).toEqual({ [TOP]: false, [MIDDLE]: false, [BOTTOM]: false });
  });
});
