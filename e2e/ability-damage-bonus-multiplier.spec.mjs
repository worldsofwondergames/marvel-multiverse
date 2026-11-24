import { test, expect } from './fixtures.mjs';
import {
  createActorViaAPI,
  updateActorData,
  getActorSystemData,
  deleteActor,
  triggerAbilityRoll,
  clickDamageButton,
  getLastChatMessage,
  clearChatMessages,
  dismissNotifications,
} from './helpers.mjs';

/**
 * Issue #176: an effect can multiply the ability score added to damage without
 * raising the ability, for a power that doubles the ability bonus to damage.
 */

const ACTOR_NAME = 'E2E Damage Bonus Multiplier';
const POWER_NAME = 'E2E Doubling Stance';
const MELEE = 5;
const RANK = 2;

/**
 * Create a rank 2 character with Melee 5 and a power whose effect doubles the
 * Melee score added to damage. The effect starts switched off or on.
 */
async function createActorWithStance(page, { disabled }) {
  await createActorViaAPI(page, ACTOR_NAME);
  await updateActorData(page, ACTOR_NAME, {
    'system.attributes.rank.value': RANK,
    'system.abilities.mle.value': MELEE,
  });
  await page.evaluate(async ({ actorName, powerName, disabled }) => {
    const actor = game.actors.find(a => a.name === actorName);
    await actor.createEmbeddedDocuments('Item', [{
      name: powerName,
      type: 'power',
      effects: [{
        name: 'Doubled Melee bonus',
        transfer: true,
        disabled,
        changes: [{ key: 'system.abilities.mle.damageBonusMultiplier', mode: 5, value: '2' }],
      }],
    }]);
  }, { actorName: ACTOR_NAME, powerName: POWER_NAME, disabled });
}

/** Roll a Melee attack, click Damage, and return the card text with the Marvel die rolled. */
async function meleeDamageCard(page) {
  await triggerAbilityRoll(page, ACTOR_NAME, 'mle');
  const die = await page.evaluate(() => {
    const rolled = game.messages.contents.filter(m => m.rolls.length);
    return rolled[rolled.length - 1].rolls[0].terms[0].rolls[1].dice[0].total;
  });
  await clickDamageButton(page);
  const { content } = await getLastChatMessage(page);
  return { content, die };
}

/** The amount on the card, with a Fantastic doubling taken back off. */
function regularDamage(content) {
  const dealt = /Deals <b[^>]*>(\d+)( Fantastic)?/.exec(content);
  expect(dealt).not.toBeNull();
  return Number(dealt[1]) / (dealt[2] ? 2 : 1);
}

test.describe('Ability damage bonus multiplier', () => {

  test.beforeEach(async ({ foundryPage }) => {
    await clearChatMessages(foundryPage);
    await dismissNotifications(foundryPage);
  });

  test.afterEach(async ({ foundryPage }) => {
    await deleteActor(foundryPage, ACTOR_NAME);
  });

  test('with the effect on, the Melee score is added to damage twice', async ({ foundryPage: page }) => {
    await createActorWithStance(page, { disabled: false });

    const { content, die } = await meleeDamageCard(page);

    expect(regularDamage(content)).toBe(die * RANK + MELEE * 2);
    expect(content).toContain(`Melee ${MELEE} × 2)`);
  });

  test('with the effect off, the Melee score is added once', async ({ foundryPage: page }) => {
    await createActorWithStance(page, { disabled: true });

    const { content, die } = await meleeDamageCard(page);

    expect(regularDamage(content)).toBe(die * RANK + MELEE);
    expect(content).toContain(`Melee ${MELEE})`);
  });

  test('the damage card names the power that doubled the bonus', async ({ foundryPage: page }) => {
    await createActorWithStance(page, { disabled: false });

    const { content } = await meleeDamageCard(page);

    expect(content).toContain(`from ${POWER_NAME}`);
  });

  test('the effect leaves the Melee score, defense, and die multiplier alone', async ({ foundryPage: page }) => {
    await createActorWithStance(page, { disabled: false });

    const { abilities } = await getActorSystemData(page, ACTOR_NAME);

    expect(abilities.mle.value).toBe(MELEE);
    expect(abilities.mle.defense).toBe(MELEE + 10);
    expect(abilities.mle.damageMultiplier).toBe(RANK);
  });

  test('the Damage block on the sheet shows the doubled bonus while the effect is on', async ({ foundryPage: page }) => {
    await createActorWithStance(page, { disabled: true });
    await page.evaluate((name) => game.actors.find(a => a.name === name).sheet.render(true), ACTOR_NAME);
    const meleeBonus = page.locator('.sheet.actor').last().locator('.mm-damage-addition').first();

    await expect(meleeBonus).toHaveText(String(MELEE));

    await page.evaluate(async ({ actorName, powerName }) => {
      const power = game.actors.find(a => a.name === actorName).items.getName(powerName);
      await power.effects.contents[0].update({ disabled: false });
    }, { actorName: ACTOR_NAME, powerName: POWER_NAME });

    await expect(meleeBonus).toHaveText(String(MELEE * 2));
  });
});
