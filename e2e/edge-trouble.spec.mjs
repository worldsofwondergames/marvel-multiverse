import { test, expect } from './fixtures.mjs';
import {
  createActorViaAPI,
  updateActorData,
  deleteActor,
  triggerAbilityRoll,
  getLastChatMessage,
  clearChatMessages,
  dismissNotifications,
  createCombat,
  addToCombat,
  deleteCombat,
} from './helpers.mjs';

const ACTOR_NAME = 'E2E Edge Test';

test.describe('Edge & Trouble Mechanics', () => {

  test.beforeEach(async ({ foundryPage }) => {
    await clearChatMessages(foundryPage);
    await dismissNotifications(foundryPage);
  });

  test.afterEach(async ({ foundryPage }) => {
    await deleteActor(foundryPage, ACTOR_NAME);
    await deleteCombat(foundryPage);
  });

  test('ability with edge flag shows Edge in roll flavor', async ({ foundryPage }) => {
    const page = foundryPage;

    await createActorViaAPI(page, ACTOR_NAME);
    await updateActorData(page, ACTOR_NAME, {
      'system.abilities.mle.value': 3,
      'system.abilities.mle.edge': true,
    });

    await triggerAbilityRoll(page, ACTOR_NAME, 'mle');

    const msg = await getLastChatMessage(page);
    expect(msg).not.toBeNull();
    const flavor = msg.flavor.toLowerCase();
    expect(flavor).toContain('edge');
  });

  test('roll created with TROUBLE edge mode shows Trouble in flavor', async ({ foundryPage }) => {
    const page = foundryPage;

    await createActorViaAPI(page, ACTOR_NAME);
    await updateActorData(page, ACTOR_NAME, {
      'system.abilities.agl.value': 2,
    });

    // Directly create a roll with trouble mode since abilities lack a schema trouble field
    await page.evaluate(async (actorName) => {
      const actor = game.actors.find(a => a.name === actorName);
      const roll = new CONFIG.Dice.MarvelMultiverseRoll(
        '{1d6,1dm,1d6}+@abilities.agl.value',
        actor.getRollData(),
        { edgeMode: CONFIG.Dice.MarvelMultiverseRoll.EDGE_MODE.TROUBLE },
      );
      const speaker = ChatMessage.getSpeaker({ actor });
      await roll.toMessage({ speaker, flavor: '[ability] Agility', rollMode: 'publicroll' });
    }, ACTOR_NAME);
    await page.waitForTimeout(2000);

    const msg = await getLastChatMessage(page);
    expect(msg).not.toBeNull();
    const flavor = msg.flavor.toLowerCase();
    expect(flavor).toContain('trouble');
  });

  test('normal ability has neither edge nor trouble in flavor', async ({ foundryPage }) => {
    const page = foundryPage;

    await createActorViaAPI(page, ACTOR_NAME);
    await updateActorData(page, ACTOR_NAME, {
      'system.abilities.res.value': 2,
    });

    await triggerAbilityRoll(page, ACTOR_NAME, 'res');

    const msg = await getLastChatMessage(page);
    expect(msg).not.toBeNull();
    const flavor = msg.flavor.toLowerCase();
    expect(flavor).not.toContain('edge');
    expect(flavor).not.toContain('trouble');
  });

  test('retro edge/trouble buttons are present in roll chat message', async ({ foundryPage }) => {
    const page = foundryPage;

    await createActorViaAPI(page, ACTOR_NAME);
    await updateActorData(page, ACTOR_NAME, {
      'system.abilities.mle.value': 3,
    });

    await triggerAbilityRoll(page, ACTOR_NAME, 'mle');

    // Expand the dice tooltip to reveal the retro buttons
    const lastMsgLocator = page.locator('#chat-log .message').last();
    const diceTotal = lastMsgLocator.locator('.dice-total');
    if (await diceTotal.count() > 0) {
      await diceTotal.first().click();
      await page.waitForTimeout(500);
    }

    // Check for retro buttons in the rendered chat message DOM
    const buttons = await page.evaluate(() => {
      // Find all edge/trouble retro buttons anywhere in the document
      const edgeBtns = document.querySelectorAll('.retroEdgeMode.roll-edge, button[data-retro-action="edge"]');
      const troubleBtns = document.querySelectorAll('.retroEdgeMode.roll-trouble, button[data-retro-action="trouble"]');
      return {
        edge: edgeBtns.length,
        trouble: troubleBtns.length,
      };
    });

    expect(buttons.edge).toBeGreaterThan(0);
    expect(buttons.trouble).toBeGreaterThan(0);
  });

  test('initiative roll with edge on init shows edge flavor', async ({ foundryPage }) => {
    const page = foundryPage;

    await createActorViaAPI(page, ACTOR_NAME);
    await updateActorData(page, ACTOR_NAME, {
      'system.abilities.vig.value': 3,
      'system.attributes.init.edge': true,
    });

    await createCombat(page);
    await addToCombat(page, ACTOR_NAME);

    // Roll initiative for the combatant
    await page.evaluate(async () => {
      await game.combat.rollAll();
    });
    await page.waitForTimeout(3000);

    const msg = await getLastChatMessage(page);
    expect(msg).not.toBeNull();
    const flavor = msg.flavor.toLowerCase();
    // Initiative flavor should mention edge
    expect(flavor).toContain('edge');
  });
});
