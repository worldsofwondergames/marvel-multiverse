import { test, expect } from './fixtures.mjs';
import { createActorViaAPI, deleteActor, deleteCombat, dismissNotifications } from './helpers.mjs';

/**
 * Issue #144. A shield thrown with a Shield Bearer power returns at the start
 * of the character's next turn. Until then the character cannot use other
 * Shield Bearer powers or get the shield's benefit.
 */

const HERO = 'E2E Shield Hero';
const FOE = 'E2E Shield Foe';
const SHIELD_SET = 'Shield Bearer';
const WALL_REDUCTION = 2;

const POWERS = [
  // Throws the shield, which its effect text says.
  { name: 'Throw', set: SHIELD_SET, cost: '5 Focus', effect: '<p>The enemy takes regular damage. The shield then bounces back to the character.</p>' },
  // Gives Health Damage Reduction through an effect, as the Shield powers do.
  { name: 'Wall', set: SHIELD_SET, cost: '5 Focus', reduction: WALL_REDUCTION },
  { name: 'Bash', set: SHIELD_SET },
  { name: 'Other', set: 'Basic', cost: '5 Focus' },
];

/** Create the hero with the test powers and return the power ids by name. */
async function setup(page) {
  await createActorViaAPI(page, HERO);
  return page.evaluate(async ({ hero, powers }) => {
    const actor = game.actors.find(a => a.name === hero);
    await actor.update({ 'system.attributes.rank.value': 3, 'system.focus.bonus': 100 });
    await actor.update({ 'system.focus.value': 100 });
    const created = await actor.createEmbeddedDocuments('Item', powers.map(p => ({
      name: p.name,
      type: 'power',
      system: { powerSets: [{ name: p.set }], powerSet: p.set, cost: p.cost ?? '', effect: p.effect ?? '' },
      effects: p.reduction ? [{
        name: p.name,
        transfer: true,
        changes: [{ key: 'system.healthDamageReduction', mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: String(p.reduction) }],
      }] : [],
    })));
    return Object.fromEntries(created.map(i => [i.name, i.id]));
  }, { hero: HERO, powers: POWERS });
}

const state = (page) => page.evaluate((hero) => {
  const actor = game.actors.find(a => a.name === hero);
  return {
    thrown: actor.statuses.has('shieldThrown'),
    reduction: actor.system.healthDamageReduction,
    focus: actor.system.focus.value,
    // The chat cards this actor has posted.
    cards: game.messages.filter(m => m.speaker.actor === actor.id).length,
  };
}, HERO);

async function openSheet(page) {
  const id = await page.evaluate(async (hero) => {
    const actor = game.actors.find(a => a.name === hero);
    await actor.sheet._render(true);
    return actor.sheet.id;
  }, HERO);
  return page.locator(`#${id}`);
}

/** Click a power's activate control on the open sheet. */
async function activate(page, sheet, itemId) {
  await sheet.locator(`.power-activate[data-item-id="${itemId}"]`).click();
  await page.waitForTimeout(700);
}

/** Post a power to chat, which also rolls it when it has a roll. */
const post = (page, itemId) => page.evaluate(async ({ hero, itemId }) => {
  await game.actors.find(a => a.name === hero).items.get(itemId).roll();
  await new Promise(r => setTimeout(r, 500));
}, { hero: HERO, itemId });

/** Start a combat with the hero acting first and the foe second. */
async function startCombat(page) {
  await createActorViaAPI(page, FOE);
  await page.evaluate(async ({ hero, foe }) => {
    const id = (name) => game.actors.find(a => a.name === name).id;
    const combat = await Combat.create({});
    await combat.createEmbeddedDocuments('Combatant', [
      { actorId: id(hero), initiative: 20 },
      { actorId: id(foe), initiative: 5 },
    ]);
    await combat.startCombat();
  }, { hero: HERO, foe: FOE });
}

const actingNow = (page) => page.evaluate(() => game.combat.combatant.actor.name);

test.describe('Thrown shields (Issue #144)', () => {
  test.beforeEach(async ({ foundryPage: page }) => {
    await dismissNotifications(page);
    await deleteCombat(page);
    await deleteActor(page, HERO);
    await deleteActor(page, FOE);
  });

  test.afterEach(async ({ foundryPage: page }) => {
    await deleteCombat(page);
    await deleteActor(page, HERO);
    await deleteActor(page, FOE);
  });

  test('throwing the shield removes its damage reduction and refuses other Shield Bearer powers', async ({ foundryPage: page }) => {
    const ids = await setup(page);
    const sheet = await openSheet(page);

    // With the shield in hand, a Shield Bearer power works and its reduction counts.
    await activate(page, sheet, ids.Wall);
    await expect.poll(async () => (await state(page)).focus).toBe(95);
    expect(await state(page)).toMatchObject({ thrown: false, reduction: WALL_REDUCTION });

    await activate(page, sheet, ids.Throw);
    await expect.poll(async () => (await state(page)).thrown).toBe(true);
    expect(await state(page)).toMatchObject({ focus: 90, reduction: 0 });

    // Another Shield Bearer power is refused, so nothing is spent.
    await activate(page, sheet, ids.Wall);
    expect((await state(page)).focus).toBe(90);

    // A power outside the set still works, and so does the power that threw the shield.
    await activate(page, sheet, ids.Other);
    await expect.poll(async () => (await state(page)).focus).toBe(85);
    await activate(page, sheet, ids.Throw);
    await expect.poll(async () => (await state(page)).focus).toBe(80);
  });

  test('posting a throwing power to chat throws the shield, and other Shield Bearer powers cannot be posted', async ({ foundryPage: page }) => {
    const ids = await setup(page);

    await post(page, ids.Bash);
    await expect.poll(async () => (await state(page)).cards).toBe(1);
    expect((await state(page)).thrown).toBe(false);

    await post(page, ids.Throw);
    await expect.poll(async () => (await state(page)).cards).toBe(2);
    expect((await state(page)).thrown).toBe(true);

    await post(page, ids.Bash);
    expect((await state(page)).cards).toBe(2);
    await post(page, ids.Other);
    await expect.poll(async () => (await state(page)).cards).toBe(3);
  });

  test('the shield returns when the next turn of the character starts, and not before', async ({ foundryPage: page }) => {
    const ids = await setup(page);
    await startCombat(page);
    expect(await actingNow(page)).toBe(HERO);

    await post(page, ids.Throw);
    await expect.poll(async () => (await state(page)).thrown).toBe(true);
    expect((await state(page)).reduction).toBe(0);

    // The foe's turn starts, and the shield is still away.
    await page.evaluate(() => game.combat.nextTurn());
    await expect.poll(() => actingNow(page)).toBe(FOE);
    await page.waitForTimeout(700);
    expect((await state(page)).thrown).toBe(true);

    await page.evaluate(() => game.combat.nextTurn());
    await expect.poll(() => actingNow(page)).toBe(HERO);
    await expect.poll(async () => (await state(page)).thrown).toBe(false);
    expect((await state(page)).reduction).toBe(WALL_REDUCTION);
  });

  test('the shield returns when the encounter ends', async ({ foundryPage: page }) => {
    const ids = await setup(page);
    await startCombat(page);
    await post(page, ids.Throw);
    await expect.poll(async () => (await state(page)).thrown).toBe(true);

    await page.evaluate(() => game.combat.delete());
    await expect.poll(async () => (await state(page)).thrown).toBe(false);
  });
});
