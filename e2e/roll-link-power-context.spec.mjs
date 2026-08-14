import { test, expect } from './fixtures.mjs';
import {
  createActorViaAPI,
  updateActorData,
  createScene,
  activateScene,
  placeToken,
  targetToken,
  clearTargets,
  clearChatMessages,
  dismissNotifications,
  forceHit,
} from './helpers.mjs';

/**
 * Some powers are rolled by clicking the check named in their own text rather
 * than from a control on the sheet. That click used to produce a bare ability
 * check, so the card had no idea which power it belonged to: it compared
 * against the wrong defense, applied the wrong damage type, and ignored any
 * damage scale the power carried.
 */
const HERO = 'E2E Link Context Hero';
const FOE = 'E2E Link Context Foe';
const SCENE_NAME = 'E2E Link Context Scene';

/** Invented prose that still names a check the enricher will link. */
const EFFECT = '<p>The character makes a Melee check against everyone nearby.</p>';

async function purge(page) {
  await page.evaluate(async ({ names, scene }) => {
    game.user.targets.forEach((t) => t.setTarget(false));
    const actors = game.actors.filter((a) => names.includes(a.name));
    if (actors.length) await Actor.deleteDocuments(actors.map((a) => a.id));
    const scenes = game.scenes.filter((s) => s.name === scene);
    if (scenes.length) await Scene.deleteDocuments(scenes.map((s) => s.id));
  }, { names: [HERO, FOE], scene: SCENE_NAME });
  await page.waitForTimeout(400);
}

test.describe('a check link inside a power', () => {
  test.beforeEach(async ({ foundryPage: page }) => {
    await page.waitForFunction(() => window.game?.ready === true, { timeout: 60_000 });
    await clearChatMessages(page);
    await dismissNotifications(page);
  });

  test.afterEach(async ({ foundryPage: page }) => {
    await purge(page);
  });

  test('carries the power damage scale, damage type and target defense', async ({ foundryPage: page }) => {
    await createActorViaAPI(page, HERO);
    await updateActorData(page, HERO, {
      'system.abilities.mle.value': 5,
      'system.attributes.rank.value': 3,
    });
    await createActorViaAPI(page, FOE);
    // The power compares against Agility, so that is the defense to flatten.
    await forceHit(page, FOE, 'agl');

    await createScene(page, SCENE_NAME);
    await activateScene(page, SCENE_NAME);
    await page.waitForFunction(
      (name) => canvas?.ready === true && canvas.scene?.name === name,
      SCENE_NAME,
      { timeout: 30_000 },
    );
    await placeToken(page, HERO, 200, 200);
    await placeToken(page, FOE, 400, 200);
    await targetToken(page, FOE);

    const outcome = await page.evaluate(async ({ name, effect }) => {
      const actor = game.actors.find((a) => a.name === name);
      const [power] = await actor.createEmbeddedDocuments('Item', [{
        name: 'E2E Link Context Power',
        type: 'power',
        system: {
          effect,
          ability: 'mle',
          attack: true,
          formula: '{1d6,1dm,1d6}',
          // Rolled with Melee but compared against Agility, and it costs Focus.
          attackTarget: 'agl',
          damageType: 'focus',
          damageScale: 0.5,
        },
      }]);

      // Post the power's card, then click the link in its text exactly as a
      // player would.
      await power.roll();
      await new Promise((r) => setTimeout(r, 1000));

      const anchor = document.querySelector('#chat-log a.mm-roll-link, .chat-log a.mm-roll-link');
      const before = new Set(game.messages.contents.map((m) => m.id));
      anchor?.click();
      await new Promise((r) => setTimeout(r, 1200));

      const created = game.messages.contents.filter((m) => !before.has(m.id));
      const rolled = created.find((m) => m.rolls?.length);
      const foe = game.actors.find((a) => a.name === 'E2E Link Context Foe');

      return {
        foundAnchor: !!anchor,
        flags: rolled?.flags?.['marvel-multiverse'] ?? null,
        flavor: String(rolled?.flavor ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '),
        powerId: power.id,
        foeAgilityDefense: foe.system.abilities.agl.defense,
        foeMeleeDefense: foe.system.abilities.mle.defense,
      };
    }, { name: HERO, effect: EFFECT });

    // Presence first: no link means everything below is vacuous.
    expect(outcome.foundAnchor).toBe(true);
    expect(outcome.flags).not.toBeNull();

    // The power behind the link was found...
    expect(outcome.flags.itemId).toBe(outcome.powerId);
    // ...so its scale rides along...
    expect(outcome.flags.damageScale).toBe(0.5);
    // ...the card names the power and its damage type, which is what the
    // damage button reads to decide Health or Focus...
    expect(outcome.flavor).toContain('E2E Link Context Power');
    expect(outcome.flavor.toLowerCase()).toContain('focus');
    // ...and hit or miss is judged against the defense the power names, not the
    // ability that was rolled.
    expect(outcome.flags.targets).toHaveLength(1);
    expect(outcome.foeAgilityDefense).not.toBe(outcome.foeMeleeDefense);
    expect(outcome.flags.targets[0].ac).toBe(outcome.foeAgilityDefense);
  });

  test('a link with no power behind it still rolls a plain check', async ({ foundryPage: page }) => {
    await createActorViaAPI(page, HERO);
    await updateActorData(page, HERO, { 'system.abilities.log.value': 4 });

    const outcome = await page.evaluate(async (name) => {
      const actor = game.actors.find((a) => a.name === name);
      // A plain message carrying the same enriched link, with no power behind
      // it. The actor is resolved from the speaker, as it is for any card.
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: '<p>Anyone present makes a Logic check to work it out.</p>',
      });
      await new Promise((r) => setTimeout(r, 800));

      const anchor = document.querySelector('#chat-log a.mm-roll-link, .chat-log a.mm-roll-link');
      const before = new Set(game.messages.contents.map((m) => m.id));
      anchor?.click();
      await new Promise((r) => setTimeout(r, 1200));
      const created = game.messages.contents.filter((m) => !before.has(m.id));
      const rolled = created.find((m) => m.rolls?.length);

      return {
        foundAnchor: !!anchor,
        rolled: !!rolled,
        flags: rolled?.flags?.['marvel-multiverse'] ?? null,
        formula: rolled?.rolls?.[0]?.formula ?? null,
      };
    }, HERO);

    expect(outcome.foundAnchor).toBe(true);
    expect(outcome.rolled).toBe(true);
    // No power, so no scale and no item are recorded — the roll is unchanged.
    expect(outcome.flags?.damageScale).toBeUndefined();
    expect(outcome.flags?.itemId).toBeUndefined();
    expect(outcome.formula).toContain('+ 4');
  });
});
