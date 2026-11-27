import { test, expect } from './fixtures.mjs';
import { createActorViaAPI, deleteActor, dismissNotifications } from './helpers.mjs';

/**
 * Issue #140. A Rank X character shows an X for its rank and a dash for Health
 * and Focus, has no limit on the Focus spent at once or the powers concentrated
 * on, and can switch to the weaker "fallible" numbers the rules give.
 */

const ACTOR = 'E2E Rank X Actor';
const HQ = 'E2E Rank X Base';

// The numbers the rules give for a fallible Rank X character.
const FALLIBLE = { ability: 20, defense: 30, damageMultiplier: 10, focusAtOnce: 100 };

const RANK_INPUT = '[name="system.attributes.rank.value"]';
const FALLIBLE_TOGGLE = '[name="system.attributes.rank.fallible"]';
const STAT_INPUTS = '[name="system.health.value"], [name="system.focus.value"]';
const STAT_DASHES = '.mm-rank-x-stat';
const STAT_RESETS = '.mm-stat-reset';

/** Update the test actor and return nothing. */
const update = (page, data) => page.evaluate(async ({ name, data }) => {
  await game.actors.find(a => a.name === name).update(data);
}, { name: ACTOR, data });

/** The parts of the actor a Rank X change touches. */
const state = (page) => page.evaluate((name) => {
  const actor = game.actors.find(a => a.name === name);
  const s = actor.system;
  return {
    x: s.attributes.rank.x,
    fallible: s.attributes.rank.fallible,
    storedRank: actor._source.system.attributes.rank.value,
    damageMultiplier: s.abilities.mle.damageMultiplier,
    scores: Object.values(s.abilities).map(a => a.value),
    defenses: Object.values(s.abilities).map(a => a.defense),
    healthMax: s.health.max,
    battleMultiplier: game.settings.get('marvel-multiverse', 'battleMultiplier'),
    focus: s.focus.value,
    concentrating: (s.concentrating ?? []).length,
    // The chat cards posted when this actor activated a power.
    activations: game.messages.filter(m => m.speaker.actor === actor.id && m.content.includes('mm-power-activated')).length,
  };
}, ACTOR);

async function openSheet(page, name = ACTOR) {
  const id = await page.evaluate(async (n) => {
    const actor = game.actors.find(a => a.name === n);
    await actor.sheet._render(true);
    return actor.sheet.id;
  }, name);
  return page.locator(`#${id}`);
}

/** Type into the Rank field and leave it, which submits the sheet. */
async function typeRank(sheet, text) {
  const input = sheet.locator(RANK_INPUT);
  await input.fill(text);
  await input.blur();
}

/** Give the actor powers and return their ids by name. */
const addPowers = (page, powers) => page.evaluate(async ({ name, powers }) => {
  const actor = game.actors.find(a => a.name === name);
  const created = await actor.createEmbeddedDocuments('Item', powers.map(p => ({
    name: p.name, type: 'power', system: { cost: p.cost, duration: p.duration ?? '' },
  })));
  return Object.fromEntries(created.map(i => [i.name, i.id]));
}, { name: ACTOR, powers });

/** Click a power's activate control on the open sheet. */
async function activate(page, sheet, itemId) {
  await sheet.locator(`.power-activate[data-item-id="${itemId}"]`).click();
  await page.waitForTimeout(700);
}

async function cleanUp(page) {
  await page.evaluate(() => document.querySelectorAll('.mm-dialog').forEach(d => d.remove()));
  await deleteActor(page, ACTOR);
  await deleteActor(page, HQ);
}

test.describe('Rank X (Issue #140)', () => {
  test.beforeEach(async ({ foundryPage: page }) => {
    await dismissNotifications(page);
    await cleanUp(page);
  });

  test.afterEach(async ({ foundryPage: page }) => {
    await cleanUp(page);
  });

  for (const type of ['character', 'npc']) {
    test(`typing X in the Rank field makes a ${type} Rank X, and a number makes it ordinary again`, async ({ foundryPage: page }) => {
      await createActorViaAPI(page, ACTOR, type);
      await update(page, { 'system.attributes.rank.value': 3 });
      const sheet = await openSheet(page);
      await expect(sheet.locator(RANK_INPUT)).toHaveValue('3');
      expect(await state(page)).toMatchObject({ x: false, damageMultiplier: 3 });
      // An ordinary rank shows Health and Focus as numbers. Only the character
      // sheet has buttons that reset them.
      const resets = type === 'character' ? 2 : 0;
      await expect(sheet.locator(STAT_INPUTS)).toHaveCount(2);
      await expect(sheet.locator(STAT_RESETS)).toHaveCount(resets);

      await typeRank(sheet, 'x');
      await expect.poll(async () => (await state(page)).x).toBe(true);
      await expect(sheet.locator(RANK_INPUT)).toHaveValue('X');
      // Health and Focus are unlimited at Rank X, so each shows a dash.
      await expect(sheet.locator(STAT_DASHES)).toHaveCount(2);
      await expect(sheet.locator(STAT_INPUTS)).toHaveCount(0);
      await expect(sheet.locator(STAT_RESETS)).toHaveCount(0);
      expect(await state(page)).toMatchObject({ storedRank: 3, damageMultiplier: FALLIBLE.damageMultiplier });

      // Text that is neither X nor a whole number leaves the rank as it was.
      await typeRank(sheet, 'high');
      await expect(sheet.locator(RANK_INPUT)).toHaveValue('X');
      expect(await state(page)).toMatchObject({ x: true, storedRank: 3 });

      await typeRank(sheet, '4');
      await expect.poll(async () => (await state(page)).x).toBe(false);
      await expect(sheet.locator(RANK_INPUT)).toHaveValue('4');
      expect(await state(page)).toMatchObject({ storedRank: 4, damageMultiplier: 4 });
      await expect(sheet.locator(STAT_INPUTS)).toHaveCount(2);
      await expect(sheet.locator(STAT_DASHES)).toHaveCount(0);
      await expect(sheet.locator(STAT_RESETS)).toHaveCount(resets);
    });

    test(`the Fallible toggle shows on a Rank X ${type} only, sets the fallible numbers, and puts the old scores back`, async ({ foundryPage: page }) => {
      await createActorViaAPI(page, ACTOR, type);
      await update(page, { 'system.attributes.rank.x': true });
      const keys = await page.evaluate((name) => Object.keys(game.actors.find(a => a.name === name).system.abilities), ACTOR);
      const before = keys.map((_, i) => 3 + i);
      await update(page, Object.fromEntries(keys.map((k, i) => [`system.abilities.${k}.value`, before[i]])));
      expect((await state(page)).scores).toEqual(before);
      const sheet = await openSheet(page);

      await sheet.locator(FALLIBLE_TOGGLE).check();
      await expect.poll(async () => (await state(page)).fallible).toBe(true);
      const fallible = await state(page);
      expect(fallible.scores).toEqual(Array(6).fill(FALLIBLE.ability));
      expect(fallible.defenses).toEqual(Array(6).fill(FALLIBLE.defense));
      expect(fallible.healthMax).toBe(FALLIBLE.ability * fallible.battleMultiplier);

      // The scores are a starting point, so a later edit is kept.
      const melee = sheet.locator('[name="system.abilities.mle.value"]');
      await melee.fill('25');
      await melee.blur();
      await expect.poll(async () => (await state(page)).scores[0]).toBe(25);
      expect((await state(page)).fallible).toBe(true);

      // Turning the toggle off puts back the scores from before it was on.
      await sheet.locator(FALLIBLE_TOGGLE).uncheck();
      await expect.poll(async () => (await state(page)).fallible).toBe(false);
      expect((await state(page)).scores).toEqual(before);

      // Leaving Rank X while fallible turns the toggle off as well.
      await sheet.locator(FALLIBLE_TOGGLE).check();
      await expect.poll(async () => (await state(page)).scores).toEqual(Array(6).fill(FALLIBLE.ability));
      await typeRank(sheet, '3');
      await expect.poll(async () => (await state(page)).x).toBe(false);
      await expect(sheet.locator(RANK_INPUT)).toHaveValue('3');
      await expect(sheet.locator(FALLIBLE_TOGGLE)).toHaveCount(0);
      expect(await state(page)).toMatchObject({ fallible: false, scores: before });
    });
  }

  test('a Rank X character spends any amount of Focus at once, and a fallible one no more than 100', async ({ foundryPage: page }) => {
    await createActorViaAPI(page, ACTOR);
    await update(page, { 'system.attributes.rank.value': 1, 'system.focus.bonus': 1000 });
    await update(page, { 'system.focus.value': 400 });
    const ids = await addPowers(page, [
      { name: 'Small', cost: '5 Focus' }, { name: 'Big', cost: '150 Focus' }, { name: 'Even', cost: '100 Focus' },
    ]);
    const sheet = await openSheet(page);

    // An ordinary Rank 1 character pays for the small power and is refused the big one.
    await activate(page, sheet, ids.Small);
    await expect.poll(async () => (await state(page)).activations).toBe(1);
    await activate(page, sheet, ids.Big);
    expect(await state(page)).toMatchObject({ activations: 1, focus: 395 });

    // Focus is unlimited at Rank X, so the power activates and nothing is taken.
    await update(page, { 'system.attributes.rank.x': true });
    await activate(page, sheet, ids.Big);
    await expect.poll(async () => (await state(page)).activations).toBe(2);
    expect((await state(page)).focus).toBe(395);

    await update(page, { 'system.attributes.rank.fallible': true });
    await activate(page, sheet, ids.Big);
    expect((await state(page)).activations).toBe(2);
    await activate(page, sheet, ids.Even);
    await expect.poll(async () => (await state(page)).activations).toBe(3);
    expect((await state(page)).focus).toBe(395);
  });

  test('a Rank X character is not asked to pay to keep concentrating', async ({ foundryPage: page }) => {
    await createActorViaAPI(page, ACTOR);
    await update(page, { 'system.attributes.rank.value': 1, 'system.focus.bonus': 1000 });
    await update(page, { 'system.focus.value': 400 });
    const ids = await addPowers(page, [{ name: 'Costly', cost: '5 Focus per turn', duration: 'Concentration' }]);
    const sheet = await openSheet(page);
    // A recurring cost asks how much to spend before the power starts.
    await activate(page, sheet, ids.Costly);
    await page.locator('.mm-dialog button', { hasText: 'Spend' }).click();
    await expect.poll(async () => (await state(page)).concentrating).toBe(1);

    /** Start a combat on the actor's turn and report whether upkeep was asked for. */
    const takeTurn = () => page.evaluate(async (name) => {
      const actor = game.actors.find(a => a.name === name);
      const combat = await Combat.create({});
      await combat.createEmbeddedDocuments('Combatant', [{ actorId: actor.id, hidden: false }]);
      await combat.startCombat();
      await new Promise(r => setTimeout(r, 1200));
      const asked = [...document.querySelectorAll('.mm-dialog label')].some(l => l.textContent.includes('Costly'));
      document.querySelectorAll('.mm-dialog').forEach(d => d.remove());
      // Detach the combatant first, so ending the combat does not end the concentration.
      await combat.deleteEmbeddedDocuments('Combatant', combat.combatants.map(c => c.id));
      await combat.delete();
      return asked;
    }, ACTOR);

    expect(await takeTurn()).toBe(true);
    await update(page, { 'system.attributes.rank.x': true });
    expect((await state(page)).concentrating).toBe(1);
    expect(await takeTurn()).toBe(false);
    expect(await state(page)).toMatchObject({ concentrating: 1, focus: 395 });
  });

  test('the Focus prompt gives a Rank X character no maximum, and a fallible one 100', async ({ foundryPage: page }) => {
    await createActorViaAPI(page, ACTOR);
    await update(page, { 'system.attributes.rank.x': true, 'system.focus.bonus': 1000 });
    await update(page, { 'system.focus.value': 400 });
    const ids = await addPowers(page, [{ name: 'Open', cost: '5 or more Focus' }]);
    const sheet = await openSheet(page);

    const prompt = async (plusClicks) => {
      await activate(page, sheet, ids.Open);
      const out = await page.evaluate((clicks) => {
        const dialog = document.querySelector('.mm-dialog');
        const input = dialog.querySelector('input[name="amount"]');
        for (let i = 0; i < clicks; i++) dialog.querySelector('button.plus').click();
        const result = {
          label: dialog.querySelector('label').textContent.replace(/\s+/g, ' ').trim(),
          max: input.getAttribute('max'),
          value: Number(input.value),
        };
        dialog.remove();
        return result;
      }, plusClicks);
      return out;
    };

    // 200 steps passes both the Rank 10 stand-in (50) and the fallible 100.
    expect(await prompt(200)).toEqual({ label: 'Open - Focus to spend (min 5)', max: null, value: 205 });

    await update(page, { 'system.attributes.rank.fallible': true });
    expect(await prompt(200)).toEqual({
      label: `Open - Focus to spend (min 5, max ${FALLIBLE.focusAtOnce})`,
      max: String(FALLIBLE.focusAtOnce),
      value: FALLIBLE.focusAtOnce,
    });
  });

  test('a Rank X character concentrates on more powers than an ordinary rank allows', async ({ foundryPage: page }) => {
    await createActorViaAPI(page, ACTOR);
    await update(page, { 'system.attributes.rank.value': 1, 'system.focus.bonus': 1000 });
    await update(page, { 'system.focus.value': 400 });
    const ids = await addPowers(page, [
      { name: 'One', cost: '5 Focus', duration: 'Concentration' },
      { name: 'Two', cost: '5 Focus', duration: 'Concentration' },
    ]);
    const sheet = await openSheet(page);

    await activate(page, sheet, ids.One);
    await expect.poll(async () => (await state(page)).concentrating).toBe(1);
    // Rank 1 holds one power, so the second is refused.
    await activate(page, sheet, ids.Two);
    expect((await state(page)).concentrating).toBe(1);

    // Eleven powers is one more than the rank number that stands in for X.
    const more = await addPowers(page, Array.from({ length: 9 }, (_, i) => (
      { name: `More ${i}`, cost: '5 Focus', duration: 'Concentration' })));
    await update(page, { 'system.attributes.rank.x': true });
    for (const id of [ids.Two, ...Object.values(more)]) await activate(page, sheet, id);
    await expect.poll(async () => (await state(page)).concentrating).toBe(11);
  });

  test('a headquarters lists a Rank X member with an X', async ({ foundryPage: page }) => {
    await createActorViaAPI(page, ACTOR);
    await update(page, { 'system.attributes.rank.value': 2 });
    await createActorViaAPI(page, HQ, 'headquarters');
    const memberRank = () => page.evaluate(async ({ hq, member }) => {
      const base = game.actors.find(a => a.name === hq);
      const context = await base.sheet.getData();
      return context.members.find(m => m.name === member).rank;
    }, { hq: HQ, member: ACTOR });
    await page.evaluate(async ({ hq, member }) => {
      const base = game.actors.find(a => a.name === hq);
      const actor = game.actors.find(a => a.name === member);
      await base.sheet._onDropActor({ preventDefault() {} }, { type: 'Actor', uuid: actor.uuid });
    }, { hq: HQ, member: ACTOR });

    expect(await memberRank()).toBe(2);
    await update(page, { 'system.attributes.rank.x': true });
    expect(await memberRank()).toBe('X');
  });
});
