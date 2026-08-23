import { test, expect } from './fixtures.mjs';
import {
  createActorViaAPI,
  createCombat,
  addToCombat,
  deleteCombat,
  deleteActor,
  createScene,
  activateScene,
  placeToken,
  deleteScene,
} from './helpers.mjs';

const HERO = 'E2E Big Fight Hero';

test.describe('Big Fight toggle', () => {
  test.afterEach(async ({ foundryPage }) => {
    await deleteCombat(foundryPage);
    await deleteActor(foundryPage, HERO);
  });

  test('toggling Big Fight persists across rounds and reverts cleanly when disabled', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, HERO);
    await createCombat(page);
    await addToCombat(page, HERO);

    // The combat tracker renders into the sidebar regardless of which tab is
    // active, but the toggle button only becomes clickable once the sidebar
    // is expanded and the Combat tab is the one showing.
    await page.evaluate(() => {
      ui.sidebar.expand();
      ui.sidebar.activateTab('combat');
    });

    await page.locator('.mm-big-fight-toggle').click();
    await expect(page.locator('.mm-big-fight-toggle.-enabled')).toBeVisible();

    const enabledAfterRound = await page.evaluate(async () => {
      await game.combat.nextRound();
      return game.combat.getFlag('marvel-multiverse', 'bigFight')?.enabled;
    });
    expect(enabledAfterRound).toBe(true);

    await page.locator('.mm-big-fight-toggle.-enabled').click();
    await expect(page.locator('.mm-big-fight-toggle:not(.-enabled)')).toBeVisible();

    const stillHasData = await page.evaluate(() => game.combat.getFlag('marvel-multiverse', 'bigFight'));
    expect(stillHasData.enabled).toBe(false);
  });
});

test.describe('Side-based initiative', () => {
  const HERO = 'E2E Big Fight Hero 2';
  const HERO2 = 'E2E Big Fight Hero 3';
  const FOE = 'E2E Big Fight Foe';

  const TIE_SCENE = 'E2E Big Fight Tie Scene';

  test.afterEach(async ({ foundryPage }) => {
    await deleteCombat(foundryPage);
    await deleteActor(foundryPage, HERO);
    await deleteActor(foundryPage, HERO2);
    await deleteActor(foundryPage, FOE);
    await deleteScene(foundryPage, TIE_SCENE);
  });

  test('rolling side initiative sets every combatant on a side to the same total', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, HERO);
    await createActorViaAPI(page, FOE);
    await createCombat(page);
    await addToCombat(page, HERO);
    await addToCombat(page, FOE);

    // Same setup Task 2 found necessary: the toggle/roll buttons only become
    // clickable once the sidebar is expanded and the Combat tab is showing.
    await page.evaluate(() => {
      ui.sidebar.expand();
      ui.sidebar.activateTab('combat');
    });

    await page.locator('.mm-big-fight-toggle').click();
    await expect(page.locator('.mm-big-fight-roll-initiative')).toBeVisible();
    await page.locator('.mm-big-fight-roll-initiative').click();
    await page.waitForTimeout(500);

    const initiatives = await page.evaluate(() =>
      game.combat.combatants.map((c) => ({ name: c.actor.name, initiative: c.initiative }))
    );
    expect(initiatives.length).toBe(2);
    expect(typeof initiatives[0].initiative).toBe('number');
    // Each combatant is alone on its side here, so this also proves the
    // per-side total (not a per-combatant roll) is what got written.
    expect(initiatives[0].initiative).not.toBeNull();
  });

  test('two combatants on the same side both get the identical rolled total', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, HERO);
    await createActorViaAPI(page, HERO2);
    await createActorViaAPI(page, FOE);

    // Real tokens again, same reasoning as the tie test: a token-less
    // combatant always reads as NEUTRAL/hero, so without a scene this test
    // would trivially put all three combatants on one side.
    await createScene(page, TIE_SCENE);
    await activateScene(page, TIE_SCENE);
    const hero1TokenId = await placeToken(page, HERO, 100, 100);
    const hero2TokenId = await placeToken(page, HERO2, 150, 100);
    const foeTokenId = await placeToken(page, FOE, 300, 300);
    await createCombat(page);
    await page.evaluate(
      async ({ hero1TokenId, hero2TokenId, foeTokenId }) => {
        const [hero1Token, hero2Token, foeToken] = [hero1TokenId, hero2TokenId, foeTokenId].map(
          (id) => canvas.tokens.placeables.find((t) => t.id === id)?.document
        );
        await hero1Token.update({ disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY });
        await hero2Token.update({ disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY });
        await foeToken.update({ disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE });
        await game.combat.createEmbeddedDocuments(
          'Combatant',
          [hero1Token, hero2Token, foeToken].map((t) => ({
            tokenId: t.id,
            sceneId: t.parent.id,
            actorId: t.actorId,
            hidden: false,
          }))
        );
      },
      { hero1TokenId, hero2TokenId, foeTokenId }
    );

    await page.evaluate(() => {
      ui.sidebar.expand();
      ui.sidebar.activateTab('combat');
    });
    await page.locator('.mm-big-fight-toggle').click();
    await page.locator('.mm-big-fight-roll-initiative').click();
    await page.waitForTimeout(500);

    const byName = await page.evaluate(() =>
      Object.fromEntries(game.combat.combatants.map((c) => [c.actor.name, c.initiative]))
    );

    // The two heroes must match each other exactly -- this is the actual
    // design goal (one roll per side, not one roll per combatant) -- and the
    // foe, rolling its own side, is not required to match them.
    expect(typeof byName[HERO]).toBe('number');
    expect(byName[HERO]).toBe(byName[HERO2]);
    expect(typeof byName[FOE]).toBe('number');
  });

  test('the roll button only appears while Big Fight mode is enabled', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, HERO);
    await createCombat(page);
    await addToCombat(page, HERO);

    await page.evaluate(() => {
      ui.sidebar.expand();
      ui.sidebar.activateTab('combat');
    });

    await expect(page.locator('.mm-big-fight-roll-initiative')).toHaveCount(0);

    await page.locator('.mm-big-fight-toggle').click();
    await expect(page.locator('.mm-big-fight-roll-initiative')).toBeVisible();

    await page.locator('.mm-big-fight-toggle.-enabled').click();
    await expect(page.locator('.mm-big-fight-roll-initiative')).toHaveCount(0);
  });

  test('a persistent tie triggers exactly one reroll, not an infinite loop', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, HERO);
    await createActorViaAPI(page, FOE);

    // combatantSide reads disposition off the combatant's linked scene
    // token; a combatant created straight from an actorId (no token) always
    // reads as NEUTRAL and both sides collapse into "hero". A real scene and
    // placed tokens are needed here so hero and foe actually land on
    // opposite sides and the tie/reroll path gets exercised.
    await createScene(page, TIE_SCENE);
    await activateScene(page, TIE_SCENE);
    const heroTokenId = await placeToken(page, HERO, 100, 100);
    const foeTokenId = await placeToken(page, FOE, 300, 300);
    await createCombat(page);
    await page.evaluate(
      async ({ heroTokenId, foeTokenId }) => {
        const heroToken = canvas.tokens.placeables.find((t) => t.id === heroTokenId)?.document;
        const foeToken = canvas.tokens.placeables.find((t) => t.id === foeTokenId)?.document;
        await heroToken.update({ disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY });
        await foeToken.update({ disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE });
        await game.combat.createEmbeddedDocuments('Combatant', [
          { tokenId: heroToken.id, sceneId: heroToken.parent.id, actorId: heroToken.actorId, hidden: false },
          { tokenId: foeToken.id, sceneId: foeToken.parent.id, actorId: foeToken.actorId, hidden: false },
        ]);
      },
      { heroTokenId, foeTokenId }
    );

    await page.evaluate(() => {
      ui.sidebar.expand();
      ui.sidebar.activateTab('combat');
    });
    await page.locator('.mm-big-fight-toggle').click();

    // Force every roll to total 10, so hero and foe tie no matter how many
    // times rollSideInitiative rerolls. rollSideInitiative reads
    // CONFIG.Dice.MarvelMultiverseRoll fresh on each call, so swapping it in
    // here is picked up by the live click handler without needing any
    // internal function exposed on a test-only global.
    await page.evaluate(() => {
      const OriginalRoll = CONFIG.Dice.MarvelMultiverseRoll;
      window.__bigFightOriginalRoll = OriginalRoll;
      window.__bigFightRollCount = 0;
      class FixedRoll extends OriginalRoll {
        async evaluate(options) {
          await super.evaluate(options);
          window.__bigFightRollCount += 1;
          return this;
        }
        get total() {
          return 10;
        }
      }
      CONFIG.Dice.MarvelMultiverseRoll = FixedRoll;
    });

    await page.locator('.mm-big-fight-roll-initiative').click();
    await page.waitForTimeout(1000);

    const { rollCount, initiatives, sideInitiative } = await page.evaluate(() => {
      CONFIG.Dice.MarvelMultiverseRoll = window.__bigFightOriginalRoll;
      return {
        rollCount: window.__bigFightRollCount,
        initiatives: game.combat.combatants.map((c) => c.initiative),
        sideInitiative: game.combat.getFlag('marvel-multiverse', 'bigFight')?.sideInitiative,
      };
    });

    // Exactly one reroll happened: 2 calls for the first (tied) attempt, 2
    // more for the single reroll, and no third attempt despite the tie
    // persisting.
    expect(rollCount).toBe(4);
    expect(sideInitiative).toEqual({ hero: 10, foe: 10 });
    expect(initiatives).toEqual([10, 10]);
  });
});
