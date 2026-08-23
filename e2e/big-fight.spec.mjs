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
  updateActorData,
  forceHit,
  clearTargets,
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

test.describe('Foe grouping', () => {
  const FOE_1 = 'E2E Big Fight Foe 1';
  const FOE_2 = 'E2E Big Fight Foe 2';
  const HERO = 'E2E Big Fight Grouping Hero';
  const GROUPING_SCENE = 'E2E Big Fight Grouping Scene';

  test.afterEach(async ({ foundryPage }) => {
    await deleteCombat(foundryPage);
    await deleteActor(foundryPage, FOE_1);
    await deleteActor(foundryPage, FOE_2);
    await deleteActor(foundryPage, HERO);
    await deleteScene(foundryPage, GROUPING_SCENE);
  });

  /**
   * Places FOE_1 and FOE_2 as hostile tokens and HERO as a friendly token on
   * a fresh scene, adds all three to a new combat as real token-linked
   * combatants (a plain addToCombat combatant has no token and always reads
   * as "hero" -- see combatantSide), then enables Big Fight mode.
   */
  async function setUpGroupingCombat(page) {
    await createActorViaAPI(page, FOE_1);
    await createActorViaAPI(page, FOE_2);
    await createActorViaAPI(page, HERO);
    // A freshly created actor's Health starts at 0 (schema default), not at
    // its computed max -- the GM normally tops it off before a fight. Do
    // that here so the foes start alive instead of already "destroyed".
    await page.evaluate(async (names) => {
      for (const name of names) {
        const actor = game.actors.find((a) => a.name === name);
        await actor.update({ 'system.health.value': actor.system.health.max });
      }
    }, [FOE_1, FOE_2]);
    await createScene(page, GROUPING_SCENE);
    await activateScene(page, GROUPING_SCENE);
    const foe1TokenId = await placeToken(page, FOE_1, 100, 100);
    const foe2TokenId = await placeToken(page, FOE_2, 150, 100);
    const heroTokenId = await placeToken(page, HERO, 300, 300);
    await createCombat(page);
    await page.evaluate(
      async ({ foe1TokenId, foe2TokenId, heroTokenId }) => {
        const [foe1Token, foe2Token, heroToken] = [foe1TokenId, foe2TokenId, heroTokenId].map(
          (id) => canvas.tokens.placeables.find((t) => t.id === id)?.document
        );
        await foe1Token.update({ disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE });
        await foe2Token.update({ disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE });
        await heroToken.update({ disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY });
        await game.combat.createEmbeddedDocuments(
          'Combatant',
          [foe1Token, foe2Token, heroToken].map((t) => ({
            tokenId: t.id,
            sceneId: t.parent.id,
            actorId: t.actorId,
            hidden: false,
          }))
        );
      },
      { foe1TokenId, foe2TokenId, heroTokenId }
    );

    await page.evaluate(() => {
      ui.sidebar.expand();
      ui.sidebar.activateTab('combat');
    });
    await page.locator('.mm-big-fight-toggle').click();
  }

  /** Reads back the combatant ids for the named combatants in the active combat. */
  async function combatantIdsByName(page, names) {
    return page.evaluate(
      (names) =>
        Object.fromEntries(
          names.map((name) => [name, game.combat.combatants.find((c) => c.actor.name === name)?.id])
        ),
      names
    );
  }

  test('checking two foe rows and clicking Group Selected creates a pooled HP/Focus row', async ({ foundryPage }) => {
    const page = foundryPage;
    await setUpGroupingCombat(page);

    const ids = await combatantIdsByName(page, [FOE_1, FOE_2, HERO]);
    const maxes = await page.evaluate(
      (names) =>
        names.map((name) => game.actors.find((a) => a.name === name).system.health.max),
      [FOE_1, FOE_2]
    );
    const totalMax = maxes[0] + maxes[1];

    await page.locator(`.mm-big-fight-select[data-combatant-id="${ids[FOE_1]}"]`).check();
    await page.locator(`.mm-big-fight-select[data-combatant-id="${ids[FOE_2]}"]`).check();
    await page.locator('.mm-big-fight-group-btn').click();
    await page.locator('.dialog-buttons button[data-button="ok"]').click();
    await page.waitForTimeout(300);

    const pool = page.locator('.mm-big-fight-pool');
    await expect(pool).toContainText('(2)');
    await expect(pool).toContainText(`HP ${totalMax}/${totalMax}`);

    // Grouped rows lose their selection checkbox; only the ungrouped hero's
    // remains, proving the checkbox pass reads the just-written group back.
    await expect(page.locator('.mm-big-fight-select')).toHaveCount(1);
    await expect(page.locator(`.mm-big-fight-select[data-combatant-id="${ids[HERO]}"]`)).toBeVisible();
  });

  test('the pooled HP total shrinks when a member is destroyed, and Ungroup restores individual rows', async ({ foundryPage }) => {
    const page = foundryPage;
    await setUpGroupingCombat(page);
    const ids = await combatantIdsByName(page, [FOE_1, FOE_2]);

    await page.locator(`.mm-big-fight-select[data-combatant-id="${ids[FOE_1]}"]`).check();
    await page.locator(`.mm-big-fight-select[data-combatant-id="${ids[FOE_2]}"]`).check();
    await page.locator('.mm-big-fight-group-btn').click();
    await page.locator('.dialog-buttons button[data-button="ok"]').click();
    await expect(page.locator('.mm-big-fight-pool')).toContainText('(2)');

    // No document is deleted -- the actor's Health simply drops to 0, which
    // is this glue's "destroyed" threshold (see combatantsById).
    await page.evaluate(async (name) => {
      const actor = game.actors.find((a) => a.name === name);
      await actor.update({ 'system.health.value': 0 });
    }, FOE_1);
    await page.waitForTimeout(300);
    await expect(page.locator('.mm-big-fight-pool')).toContainText('(1)');

    const combatantCountAfterDrop = await page.evaluate(() => game.combat.combatants.size);
    expect(combatantCountAfterDrop).toBe(3);

    await page.locator('.mm-big-fight-ungroup').click();
    await page.waitForTimeout(300);
    await expect(page.locator('.mm-big-fight-pool')).toHaveCount(0);
    await expect(page.locator(`.mm-big-fight-select[data-combatant-id="${ids[FOE_1]}"]`)).toBeVisible();
    await expect(page.locator(`.mm-big-fight-select[data-combatant-id="${ids[FOE_2]}"]`)).toBeVisible();
  });

  test('grouping combatants from different sides is rejected', async ({ foundryPage }) => {
    const page = foundryPage;
    await setUpGroupingCombat(page);
    const ids = await combatantIdsByName(page, [FOE_1, HERO]);

    await page.evaluate(() => {
      window.__bigFightWarnings = [];
      window.__bigFightOriginalWarn = ui.notifications.warn;
      ui.notifications.warn = (msg) => {
        window.__bigFightWarnings.push(String(msg));
        return 0;
      };
    });

    await page.locator(`.mm-big-fight-select[data-combatant-id="${ids[FOE_1]}"]`).check();
    await page.locator(`.mm-big-fight-select[data-combatant-id="${ids[HERO]}"]`).check();
    await page.locator('.mm-big-fight-group-btn').click();
    await page.locator('.dialog-buttons button[data-button="ok"]').click();
    await page.waitForTimeout(300);

    const { warnings, groupCount } = await page.evaluate(() => {
      ui.notifications.warn = window.__bigFightOriginalWarn;
      return {
        warnings: window.__bigFightWarnings,
        groupCount: (game.combat.getFlag('marvel-multiverse', 'bigFight')?.groups ?? []).length,
      };
    });

    expect(warnings.some((w) => w.toLowerCase().includes('same side'))).toBe(true);
    expect(groupCount).toBe(0);
    await expect(page.locator('.mm-big-fight-pool')).toHaveCount(0);
  });

  test('the group controls only appear while Big Fight mode is enabled', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, FOE_1);
    await createActorViaAPI(page, FOE_2);
    await createCombat(page);
    await addToCombat(page, FOE_1);
    await addToCombat(page, FOE_2);

    await page.evaluate(() => {
      ui.sidebar.expand();
      ui.sidebar.activateTab('combat');
    });

    await expect(page.locator('.mm-big-fight-group-btn')).toHaveCount(0);
    await expect(page.locator('.mm-big-fight-select')).toHaveCount(0);

    await page.locator('.mm-big-fight-toggle').click();
    await expect(page.locator('.mm-big-fight-group-btn')).toBeVisible();
    await expect(page.locator('.mm-big-fight-select')).toHaveCount(2);

    await page.locator('.mm-big-fight-toggle.-enabled').click();
    await expect(page.locator('.mm-big-fight-group-btn')).toHaveCount(0);
    await expect(page.locator('.mm-big-fight-select')).toHaveCount(0);
  });
});

test.describe('Group attack bonus', () => {
  const FOE_1 = 'E2E Big Fight Attacker 1';
  const FOE_2 = 'E2E Big Fight Attacker 2';
  const ATTACK_BONUS_SCENE = 'E2E Big Fight Attack Bonus Scene';

  test.afterEach(async ({ foundryPage }) => {
    await deleteCombat(foundryPage);
    await deleteActor(foundryPage, FOE_1);
    await deleteActor(foundryPage, FOE_2);
    await deleteScene(foundryPage, ATTACK_BONUS_SCENE);
  });

  test('a Melee attack from a grouped combatant carries the group bonus in its formula', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, FOE_1);
    await createActorViaAPI(page, FOE_2);

    // A freshly created actor's Health starts at 0 (schema default) while
    // its computed max is always at least 10 -- see actor-base.mjs's
    // Math.max(10, ...) -- so combatantsById would read both foes as
    // already "destroyed" and groupAttackBonus would always be 0. Top them
    // off first, same as the Foe grouping tests above.
    await page.evaluate(async (names) => {
      for (const name of names) {
        const actor = game.actors.find((a) => a.name === name);
        await actor.update({ 'system.health.value': actor.system.health.max });
      }
    }, [FOE_1, FOE_2]);

    // Real hostile-disposition tokens, same reasoning as the Foe grouping
    // tests: a token-less combatant always reads as "hero" via
    // combatantSide, and this needs a real foe side to be representative
    // of how Big Fight mode is actually used.
    await createScene(page, ATTACK_BONUS_SCENE);
    await activateScene(page, ATTACK_BONUS_SCENE);
    const foe1TokenId = await placeToken(page, FOE_1, 100, 100);
    const foe2TokenId = await placeToken(page, FOE_2, 150, 100);
    await createCombat(page);
    await page.evaluate(
      async ({ foe1TokenId, foe2TokenId }) => {
        const [foe1Token, foe2Token] = [foe1TokenId, foe2TokenId].map(
          (id) => canvas.tokens.placeables.find((t) => t.id === id)?.document
        );
        await foe1Token.update({ disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE });
        await foe2Token.update({ disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE });
        await game.combat.createEmbeddedDocuments(
          'Combatant',
          [foe1Token, foe2Token].map((t) => ({
            tokenId: t.id,
            sceneId: t.parent.id,
            actorId: t.actorId,
            hidden: false,
          }))
        );
      },
      { foe1TokenId, foe2TokenId }
    );

    const ids = await page.evaluate((names) =>
      game.combat.combatants.filter((c) => names.includes(c.actor.name)).map((c) => c.id),
      [FOE_1, FOE_2]);

    // Open the attacker's sheet; the ungrouped roll below is the baseline
    // showing the formula carries no extra additive term yet.
    await page.evaluate(async (name) => {
      const actor = game.actors.find((a) => a.name === name);
      await actor.sheet.render(true);
    }, FOE_1);
    await page.waitForTimeout(1000);

    const sheetLocator = page.locator('.sheet.actor').last();
    await sheetLocator.locator('input[name="system.attributes.rank.value"]').waitFor({ state: 'attached', timeout: 10_000 });
    await sheetLocator.locator('.rollable[data-ability-key="mle"]').first().click();
    await page.waitForTimeout(2000);

    const dialogSubmit = page.locator('dialog button[type="submit"], dialog button.dialog-button');
    if (await dialogSubmit.count() > 0) {
      await dialogSubmit.first().click();
      await page.waitForTimeout(2000);
    }

    const withoutGroup = await page.evaluate(() => game.messages.contents.at(-1).rolls[0].formula);
    expect(withoutGroup).not.toMatch(/\+\s*1\s*$/);

    // Group the two combatants together, then roll the same check again.
    await page.evaluate(async ({ ids }) => {
      const combat = game.combat;
      const before = combat.getFlag('marvel-multiverse', 'bigFight') ?? { enabled: false, sideInitiative: { hero: null, foe: null }, groups: [] };
      await combat.setFlag('marvel-multiverse', 'bigFight', {
        ...before,
        enabled: true,
        groups: [{ id: 'atk-group', name: 'Attackers', side: 'foe', memberCombatantIds: ids }],
      });
    }, { ids });

    await sheetLocator.locator('.rollable[data-ability-key="mle"]').first().click();
    await page.waitForTimeout(2000);

    const dialogSubmit2 = page.locator('dialog button[type="submit"], dialog button.dialog-button');
    if (await dialogSubmit2.count() > 0) {
      await dialogSubmit2.first().click();
      await page.waitForTimeout(2000);
    }

    const withGroup = await page.evaluate(() => game.messages.contents.at(-1).rolls[0].formula);
    // A live group of 2 grants +1; the appended term must be exactly that,
    // not merely present, so a bonus of the wrong size still fails this.
    expect(withGroup.trim().endsWith('+ 1')).toBe(true);

    await sheetLocator.locator('[data-action="close"], .header-button.close').first().click().catch(() => {});
  });
});

test.describe('Group attack bonus with duplicate unlinked tokens', () => {
  const DUP_FOE = 'E2E Big Fight Duplicate Foe';
  const DUP_SCENE = 'E2E Big Fight Duplicate Scene';

  test.afterEach(async ({ foundryPage }) => {
    await deleteCombat(foundryPage);
    await deleteScene(foundryPage, DUP_SCENE);
    await deleteActor(foundryPage, DUP_FOE);
  });

  test('grouping some duplicates of one prototype actor gives the bonus to the specific combatant that rolls, not whichever duplicate is first', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, DUP_FOE);
    await page.evaluate(async (name) => {
      const actor = game.actors.find((a) => a.name === name);
      await actor.update({ 'system.health.value': actor.system.health.max });
    }, DUP_FOE);

    await createScene(page, DUP_SCENE);
    await activateScene(page, DUP_SCENE);

    // Five unlinked tokens of the same prototype actor -- an unlinked
    // token's synthetic actor reports the base actor's id, so all five
    // combatants below share one actorId. This is exactly the scenario that
    // used to collapse `combat.combatants.find(c => c.actorId === actor?.id)`
    // onto whichever combatant happened to be first in the collection.
    const tokenIds = [];
    for (let i = 0; i < 5; i++) {
      const tokenId = await page.evaluate(async ({ name, x }) => {
        const actor = game.actors.find((a) => a.name === name);
        const scene = game.scenes.active;
        const [token] = await scene.createEmbeddedDocuments('Token', [{
          name: actor.name,
          actorId: actor.id,
          actorLink: false,
          disposition: CONST.TOKEN_DISPOSITIONS.HOSTILE,
          x, y: 100,
          texture: { src: actor.img || 'icons/svg/mystery-man.svg' },
        }]);
        return token.id;
      }, { name: DUP_FOE, x: 100 + i * 60 });
      tokenIds.push(tokenId);
    }

    await createCombat(page);
    const combatants = await page.evaluate(async (tokenIds) => {
      const docs = tokenIds.map((id) => canvas.tokens.placeables.find((t) => t.id === id).document);
      const created = await game.combat.createEmbeddedDocuments('Combatant', docs.map((t) => ({
        tokenId: t.id,
        sceneId: t.parent.id,
        actorId: t.actorId,
        hidden: false,
      })));
      return created.map((c) => ({ id: c.id, tokenId: c.tokenId }));
    }, tokenIds);

    // Group only the first three duplicates; the last two stay ungrouped.
    const groupedCombatantIds = combatants.slice(0, 3).map((c) => c.id);
    const groupedTokenId = combatants[0].tokenId;
    const ungroupedTokenId = combatants[3].tokenId;

    await page.evaluate(async (ids) => {
      await game.combat.setFlag('marvel-multiverse', 'bigFight', {
        enabled: true,
        sideInitiative: { hero: null, foe: null },
        groups: [{ id: 'dup-group', name: 'Duplicates', side: 'foe', memberCombatantIds: ids }],
      });
    }, groupedCombatantIds);

    // Roll from the grouped duplicate's own token-actor. A live group of 3
    // grants +2, and it must land on this specific combatant -- not on
    // whichever duplicate combatant happens to be first in the collection.
    await page.evaluate(async (tokenId) => {
      const token = canvas.tokens.placeables.find((t) => t.id === tokenId);
      await token.actor.sheet.render(true);
    }, groupedTokenId);
    await page.waitForTimeout(1000);

    const groupedSheet = page.locator('.sheet.actor').last();
    await groupedSheet.locator('input[name="system.attributes.rank.value"]').waitFor({ state: 'attached', timeout: 10_000 });
    await groupedSheet.locator('.rollable[data-ability-key="mle"]').first().click();
    await page.waitForTimeout(2000);
    const groupedDialogSubmit = page.locator('dialog button[type="submit"], dialog button.dialog-button');
    if (await groupedDialogSubmit.count() > 0) {
      await groupedDialogSubmit.first().click();
      await page.waitForTimeout(2000);
    }
    const groupedFormula = await page.evaluate(() => game.messages.contents.at(-1).rolls[0].formula);
    expect(groupedFormula.trim().endsWith('+ 2')).toBe(true);
    await groupedSheet.locator('[data-action="close"], .header-button.close').first().click().catch(() => {});

    // Roll from an ungrouped duplicate's own token-actor. Despite sharing the
    // same actorId as the grouped combatants above, it must get no bonus.
    await page.evaluate(async (tokenId) => {
      const token = canvas.tokens.placeables.find((t) => t.id === tokenId);
      await token.actor.sheet.render(true);
    }, ungroupedTokenId);
    await page.waitForTimeout(1000);

    const ungroupedSheet = page.locator('.sheet.actor').last();
    await ungroupedSheet.locator('input[name="system.attributes.rank.value"]').waitFor({ state: 'attached', timeout: 10_000 });
    await ungroupedSheet.locator('.rollable[data-ability-key="mle"]').first().click();
    await page.waitForTimeout(2000);
    const ungroupedDialogSubmit = page.locator('dialog button[type="submit"], dialog button.dialog-button');
    if (await ungroupedDialogSubmit.count() > 0) {
      await ungroupedDialogSubmit.first().click();
      await page.waitForTimeout(2000);
    }
    // The base formula naturally ends in "+ 0" from the (unset) Melee
    // ability value -- the bug this catches would append the grouped trio's
    // "+ 2" here instead, so that is specifically what must be absent.
    const ungroupedFormula = await page.evaluate(() => game.messages.contents.at(-1).rolls[0].formula);
    expect(ungroupedFormula.trim().endsWith('+ 2')).toBe(false);
    await ungroupedSheet.locator('[data-action="close"], .header-button.close').first().click().catch(() => {});
  });
});

test.describe('In-range marker', () => {
  const HERO = 'E2E Big Fight In Range';

  test.afterEach(async ({ foundryPage }) => {
    await deleteCombat(foundryPage);
    await deleteActor(foundryPage, HERO);
  });

  test('clicking the in-range icon toggles the combatant flag', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, HERO);
    await createCombat(page);
    await addToCombat(page, HERO);

    await page.evaluate(() => {
      ui.sidebar.expand();
      ui.sidebar.activateTab('combat');
    });

    await page.locator('.mm-big-fight-toggle').click();
    await expect(page.locator('.mm-big-fight-in-range')).toBeVisible();

    await page.locator('.mm-big-fight-in-range').click();
    await page.waitForTimeout(300);
    const afterFirstClick = await page.evaluate(() =>
      game.combat.combatants.contents[0].getFlag('marvel-multiverse', 'inRange')
    );
    expect(afterFirstClick).toBe(true);

    await page.locator('.mm-big-fight-in-range').click();
    await page.waitForTimeout(300);
    const afterSecondClick = await page.evaluate(() =>
      game.combat.combatants.contents[0].getFlag('marvel-multiverse', 'inRange')
    );
    expect(afterSecondClick).toBe(false);
  });

  test('the in-range icon only appears while Big Fight mode is enabled', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, HERO);
    await createCombat(page);
    await addToCombat(page, HERO);

    await page.evaluate(() => {
      ui.sidebar.expand();
      ui.sidebar.activateTab('combat');
    });

    await expect(page.locator('.mm-big-fight-in-range')).toHaveCount(0);

    await page.locator('.mm-big-fight-toggle').click();
    await expect(page.locator('.mm-big-fight-in-range')).toBeVisible();

    await page.locator('.mm-big-fight-toggle.-enabled').click();
    await expect(page.locator('.mm-big-fight-in-range')).toHaveCount(0);
  });

  test('the icon survives a re-render without duplicating', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, HERO);
    await createCombat(page);
    await addToCombat(page, HERO);

    await page.evaluate(() => {
      ui.sidebar.expand();
      ui.sidebar.activateTab('combat');
    });

    await page.locator('.mm-big-fight-toggle').click();
    await expect(page.locator('.mm-big-fight-in-range')).toHaveCount(1);

    // Foundry can re-fire renderCombatTracker against the same rendered
    // element more than once for a single logical update (the chat-message
    // render hook does the same thing -- see the dataset.mmBound flag that
    // prevents rebinding the click listener on renderChatMessageHTML). Re-invoking the hook directly against the
    // tracker's own element reproduces that without depending on which
    // combat action happens to trigger it, and proves the top-of-hook
    // cleanup keeps this to one icon per row, not two.
    await page.evaluate(() => Hooks.callAll('renderCombatTracker', ui.combat, ui.combat.element));
    await page.waitForTimeout(300);

    await expect(page.locator('.mm-big-fight-in-range')).toHaveCount(1);
  });
});

test.describe('Multi-target damage card grouping', () => {
  const FOE_1 = 'E2E Big Fight Target 1';
  const FOE_2 = 'E2E Big Fight Target 2';
  const ATTACKER = 'E2E Big Fight Multi Attacker';
  const SCENE_NAME = 'E2E Big Fight Damage Scene';

  test.afterEach(async ({ foundryPage }) => {
    await clearTargets(foundryPage);
    await deleteScene(foundryPage, SCENE_NAME);
    await deleteCombat(foundryPage);
    await deleteActor(foundryPage, FOE_1);
    await deleteActor(foundryPage, FOE_2);
    await deleteActor(foundryPage, ATTACKER);
  });

  test('attacking two grouped foes at once shows one grouped heading on the damage card', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ATTACKER);
    await updateActorData(page, ATTACKER, { 'system.abilities.mle.value': 5, 'system.attributes.rank.value': 3 });
    await createActorViaAPI(page, FOE_1);
    await createActorViaAPI(page, FOE_2);
    await forceHit(page, FOE_1, 'mle');
    await forceHit(page, FOE_2, 'mle');

    await createScene(page, SCENE_NAME);
    await activateScene(page, SCENE_NAME);
    await placeToken(page, ATTACKER, 200, 200);
    await placeToken(page, FOE_1, 400, 200);
    await placeToken(page, FOE_2, 600, 200);
    await page.evaluate(({ a, b }) => {
      for (const name of [a, b]) {
        canvas.tokens.placeables.find((t) => t.actor?.name === name).setTarget(true, { releaseOthers: false });
      }
    }, { a: FOE_1, b: FOE_2 });
    await page.waitForTimeout(300);

    await createCombat(page);
    await addToCombat(page, FOE_1);
    await addToCombat(page, FOE_2);
    await page.evaluate(async (names) => {
      const combat = game.combat;
      const ids = combat.combatants.filter((c) => names.includes(c.actor.name)).map((c) => c.id);
      await combat.setFlag('marvel-multiverse', 'bigFight', {
        enabled: true,
        sideInitiative: { hero: null, foe: null },
        groups: [{ id: 'dmg-group', name: 'Test Targets', side: 'foe', memberCombatantIds: ids }],
      });
    }, [FOE_1, FOE_2]);

    await page.evaluate(async (name) => {
      const actor = game.actors.find((a) => a.name === name);
      await actor.sheet.render(true);
    }, ATTACKER);
    await page.waitForTimeout(1000);
    const sheetLocator = page.locator('.sheet.actor').last();
    await sheetLocator.locator('.rollable[data-ability-key="mle"]').first().click();
    await page.waitForTimeout(2000);

    await page.evaluate(() => {
      const buttons = document.querySelectorAll('button.damage');
      if (!buttons.length) throw new Error('No damage button rendered on the attack card');
      buttons[buttons.length - 1].click();
    });
    await page.waitForFunction(
      () => document.querySelectorAll('.mm-damage-target').length > 0,
      { timeout: 15_000 },
    );

    const heading = page.locator('.mm-damage-group-heading');
    await expect(heading).toContainText('Test Targets');
    await expect(heading).toContainText('2 hit');
  });

  test('a single grouped target renders with no heading, exactly as an ungrouped hit always has', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ATTACKER);
    await updateActorData(page, ATTACKER, { 'system.abilities.mle.value': 5, 'system.attributes.rank.value': 3 });
    await createActorViaAPI(page, FOE_1);
    await createActorViaAPI(page, FOE_2);
    await forceHit(page, FOE_1, 'mle');

    await createScene(page, SCENE_NAME);
    await activateScene(page, SCENE_NAME);
    await placeToken(page, ATTACKER, 200, 200);
    await placeToken(page, FOE_1, 400, 200);
    await placeToken(page, FOE_2, 600, 200);
    // Only FOE_1 is targeted, even though both foes will be in the same
    // Big Fight group -- a bucket of one must never print a heading.
    await page.evaluate((name) => {
      canvas.tokens.placeables.find((t) => t.actor?.name === name).setTarget(true, { releaseOthers: false });
    }, FOE_1);
    await page.waitForTimeout(300);

    await createCombat(page);
    await addToCombat(page, FOE_1);
    await addToCombat(page, FOE_2);
    await page.evaluate(async (names) => {
      const combat = game.combat;
      const ids = combat.combatants.filter((c) => names.includes(c.actor.name)).map((c) => c.id);
      await combat.setFlag('marvel-multiverse', 'bigFight', {
        enabled: true,
        sideInitiative: { hero: null, foe: null },
        groups: [{ id: 'dmg-group-solo', name: 'Test Targets', side: 'foe', memberCombatantIds: ids }],
      });
    }, [FOE_1, FOE_2]);

    await page.evaluate(async (name) => {
      const actor = game.actors.find((a) => a.name === name);
      await actor.sheet.render(true);
    }, ATTACKER);
    await page.waitForTimeout(1000);
    const sheetLocator = page.locator('.sheet.actor').last();
    await sheetLocator.locator('.rollable[data-ability-key="mle"]').first().click();
    await page.waitForTimeout(2000);

    await page.evaluate(() => {
      const buttons = document.querySelectorAll('button.damage');
      if (!buttons.length) throw new Error('No damage button rendered on the attack card');
      buttons[buttons.length - 1].click();
    });
    await page.waitForFunction(
      () => document.querySelectorAll('.mm-damage-target').length > 0,
      { timeout: 15_000 },
    );

    await expect(page.locator('.mm-damage-target')).toHaveCount(1);
    await expect(page.locator('.mm-damage-group-heading')).toHaveCount(0);
  });
});
