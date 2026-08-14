import { test, expect } from './fixtures.mjs';
import {
  createActorViaAPI,
  updateActorData,
  createActiveEffect,
  createScene,
  activateScene,
  placeToken,
  targetToken,
  clearTargets,
  triggerAbilityRoll,
  forceHit,
  clearChatMessages,
  dismissNotifications,
} from './helpers.mjs';

/**
 * Issue #131 — the damage chat card carries a Take Damage button per target the
 * attack hit, and clicking it takes the recorded amount off that actor's Health
 * or Focus.
 *
 * Every assertion goes through the rendered chat log and two live reads of the
 * actor document. The amount is never hardcoded: it is read back from the
 * message flag, so a test cannot agree with a wrong number by coincidence.
 */
const ATTACKER = 'E2E Take Damage Attacker';
const DEFENDER = 'E2E Take Damage Defender';
const BYSTANDER = 'E2E Take Damage Bystander';
const SCENE_NAME = 'E2E Take Damage Scene';
const PLAYER_NAME = 'E2E Take Damage Player';

/**
 * Wait out anything still navigating the page.
 *
 * Foundry reloads the client on its own account between tests -- deleting the
 * active scene is one trigger -- and a page.evaluate issued during that window
 * dies with "execution context was destroyed". waitForFunction re-evaluates
 * after a navigation, so this waits rather than races.
 */
async function awaitStableGame(page) {
  await page.waitForFunction(() => window.game?.ready === true, { timeout: 60_000 });
}

/**
 * Wait until the canvas is actually showing the named scene.
 *
 * `canvas.ready` stays true across a scene change, so it is not enough on its
 * own to know which scene the tokens placed next will belong to.
 */
async function waitForCanvasScene(page, name) {
  await page.waitForFunction(
    (name) => canvas?.ready === true && canvas.scene?.name === name,
    name,
    { timeout: 30_000 },
  );
}

/**
 * Click the damage button on the attack card, failing loudly if it is not there.
 *
 * Returns whether the card counts this roll as Fantastic, read from the same
 * rendered die the handler reads. `Roll#isFantastic` is a different question —
 * it also requires the total to meet a target — so a test that used it would
 * disagree with the card about when damage doubles.
 */
async function openDamageCard(page) {
  const fantastic = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button.damage');
    if (!buttons.length) throw new Error('No damage button rendered on the attack card');
    const button = buttons[buttons.length - 1];
    const marked = !!button.parentNode.querySelector(
      'li.roll.marvel-roll.fantastic:not(.discarded)',
    );
    button.click();
    return marked;
  });
  await page.waitForFunction(
    () => document.querySelectorAll('button.mm-take-damage, .mm-damage-target').length > 0,
    { timeout: 15_000 },
  );
  return { fantastic };
}

/** The damage flag the card recorded, read off the message document. */
async function damageFlag(page) {
  return page.evaluate(() => {
    const message = [...game.messages.contents]
      .reverse()
      .find((m) => m.getFlag('marvel-multiverse', 'damage'));
    if (!message) throw new Error('No message carries a marvel-multiverse.damage flag');
    return { id: message.id, ...message.getFlag('marvel-multiverse', 'damage') };
  });
}

/**
 * Health and Focus on the exact document the flag names.
 *
 * A token placed from an actor is unlinked here, so the token carries its own
 * copy of the actor. Damage lands on that copy, and reading the world actor
 * instead would report no change however well the button worked.
 */
async function pools(page, uuid) {
  return page.evaluate((uuid) => {
    const actor = fromUuidSync(uuid);
    if (!actor) throw new Error(`No actor at ${uuid}`);
    return { health: actor.system.health.value, focus: actor.system.focus.value };
  }, uuid);
}

/** Set a pool on the document the flag names, not on the world actor. */
async function setPool(page, uuid, path, value) {
  await page.evaluate(async ({ uuid, path, value }) => {
    const actor = fromUuidSync(uuid);
    await actor.update({ [path]: value });
  }, { uuid, path, value });
  await page.waitForTimeout(500);
}

/**
 * Click the Take Damage button belonging to one target.
 *
 * Foundry renders a message in more than one place at once (the chat log and
 * the notification stack), so the same button exists more than once. Clicking
 * the last is arbitrary but consistent.
 */
async function clickTakeDamage(page, uuid) {
  await page.evaluate((uuid) => {
    const buttons = document.querySelectorAll(`button.mm-take-damage[data-target-uuid="${uuid}"]`);
    if (!buttons.length) throw new Error(`No Take Damage button rendered for ${uuid}`);
    buttons[buttons.length - 1].click();
  }, uuid);
}

/** Every rendered copy of one target's button. */
async function buttonStates(page, uuid) {
  return page.evaluate((uuid) => {
    return [...document.querySelectorAll(`button.mm-take-damage[data-target-uuid="${uuid}"]`)].map(
      (b) => ({ disabled: b.disabled, label: b.textContent.trim() }),
    );
  }, uuid);
}

/**
 * Remove everything these tests create, by name and in every copy.
 *
 * Teardown runs from afterEach rather than from the end of a test body, so a
 * test that fails partway still takes its actors, scene and user with it. The
 * shared deleteScene helper removes only the first match, which is not enough
 * once an earlier failure has left one behind.
 */
async function purgeTestData(page) {
  await page.evaluate(async ({ actorNames, sceneName, userName }) => {
    game.user.targets.forEach((t) => t.setTarget(false));

    const actors = game.actors.filter((a) => actorNames.includes(a.name));
    if (actors.length) await Actor.deleteDocuments(actors.map((a) => a.id));

    const scenes = game.scenes.filter((s) => s.name === sceneName);
    if (scenes.length) await Scene.deleteDocuments(scenes.map((s) => s.id));

    const users = game.users.filter((u) => u.name === userName);
    if (users.length) await User.deleteDocuments(users.map((u) => u.id));
  }, { actorNames: [ATTACKER, DEFENDER, BYSTANDER], sceneName: SCENE_NAME, userName: PLAYER_NAME });
  await page.waitForTimeout(500);
}

/** Set up attacker, defender and scene, then roll an attack that cannot miss. */
async function attackDefender(page, { ability = 'mle', damageType = null } = {}) {
  await createActorViaAPI(page, ATTACKER);
  await updateActorData(page, ATTACKER, {
    [`system.abilities.${ability}.value`]: 5,
    'system.attributes.rank.value': 3,
  });

  await createActorViaAPI(page, DEFENDER);
  await forceHit(page, DEFENDER, ability);

  await createScene(page, SCENE_NAME);
  await activateScene(page, SCENE_NAME);
  // activateScene only waits for canvas.ready, which is still true while the
  // previous spec file's canvas is being torn down. Tokens placed against that
  // canvas are written to a scene that is about to go away.
  await waitForCanvasScene(page, SCENE_NAME);
  await placeToken(page, ATTACKER, 200, 200);
  await placeToken(page, DEFENDER, 400, 200);
  await targetToken(page, DEFENDER);

  // Both pools start well clear of zero so a test about the subtraction is not
  // also a test about passing below zero — that has its own case, and a clamp
  // at zero must be able to fail exactly one of them.
  const started = await page.evaluate(async (name) => {
    const matches = canvas.tokens.placeables.filter((t) => t.actor?.name === name);
    if (matches.length !== 1) {
      throw new Error(`Expected one token for "${name}" on the canvas, found ${matches.length}`);
    }
    await matches[0].actor.update({ 'system.health.value': 500, 'system.focus.value': 500 });
    return {
      uuid: matches[0].actor.uuid,
      health: matches[0].actor.system.health.value,
      focus: matches[0].actor.system.focus.value,
      sceneId: game.scenes.active?.id,
      viewedId: canvas.scene?.id,
    };
  }, DEFENDER);
  // A setup value that did not take would otherwise surface much later as a
  // damage total that looks wrong, so it is checked where it is set.
  if (started.health !== 500 || started.focus !== 500) {
    throw new Error(`Starting pools did not take: ${JSON.stringify(started)}`);
  }

  if (damageType) {
    await page.evaluate(async ({ actorName, ability, damageType }) => {
      const actor = game.actors.find((a) => a.name === actorName);
      const roll = new CONFIG.Dice.MarvelMultiverseRoll(
        `{1d6,1dm,1d6}+@abilities.${ability}.value`,
        actor.getRollData(),
      );
      const labels = { mle: 'Melee', agl: 'Agility', ego: 'Ego', log: 'Logic' };
      const targets = Array.from(game.user.targets).map((token) => ({
        name: token.name,
        img: token.document?.texture?.src ?? '',
        ac: token.actor.system.abilities[ability].defense,
        uuid: token.actor.uuid,
      }));
      await roll.toMessage(
        {
          speaker: ChatMessage.getSpeaker({ actor }),
          flavor: `[ability] ${labels[ability]} [damageType] ${damageType}`,
          rollMode: 'publicroll',
          'flags.marvel-multiverse.targets': targets,
        },
        { rollMode: 'publicroll' },
      );
    }, { actorName: ATTACKER, ability, damageType });
    await page.waitForTimeout(2000);
  } else {
    await triggerAbilityRoll(page, ATTACKER, ability);
  }

  await openDamageCard(page);
}

test.describe('applying damage from the chat card', () => {
  test.beforeEach(async ({ foundryPage }) => {
    // Deleting the active scene in the previous test's teardown can still be
    // settling here. waitForFunction re-evaluates after a navigation, so this
    // waits the page out instead of racing it.
    await awaitStableGame(foundryPage);
    await clearChatMessages(foundryPage);
    await dismissNotifications(foundryPage);
  });

  test.afterEach(async ({ foundryPage }) => {
    await purgeTestData(foundryPage);
  });

  test('clicking Take Damage takes the recorded amount off the target Health', async ({ foundryPage: page }) => {
    await attackDefender(page);

    const flag = await damageFlag(page);
    const entry = flag.targets.find((t) => t.hit);
    const before = await pools(page, entry.uuid);

    await clickTakeDamage(page, entry.uuid);
    await page.waitForTimeout(1500);
    const after = await pools(page, entry.uuid);

    // A zero amount would satisfy the subtraction below without anything having
    // happened, so the recorded damage has to be real first.
    expect(entry.amount).toBeGreaterThan(0);
    expect(after.health).toBe(before.health - entry.amount);
    // Health damage must not come out of Focus as well.
    expect(after.focus).toBe(before.focus);
  });

  test('focus damage comes out of Focus and leaves Health alone', async ({ foundryPage: page }) => {
    await attackDefender(page, { ability: 'ego', damageType: 'focus' });

    const flag = await damageFlag(page);
    expect(flag.damageType).toBe('focus');
    const entry = flag.targets.find((t) => t.hit);
    const before = await pools(page, entry.uuid);

    await clickTakeDamage(page, entry.uuid);
    await page.waitForTimeout(1500);
    const after = await pools(page, entry.uuid);

    expect(entry.amount).toBeGreaterThan(0);
    expect(after.focus).toBe(before.focus - entry.amount);
    expect(after.health).toBe(before.health);
  });

  test('Health is allowed to pass below zero', async ({ foundryPage: page }) => {
    await attackDefender(page);

    const flag = await damageFlag(page);
    const entry = flag.targets.find((t) => t.hit);

    // Start one point above nothing so the recorded damage must carry the value
    // past zero, where a clamp would show up as a floor at 0.
    await setPool(page, entry.uuid, 'system.health.value', 1);
    const before = await pools(page, entry.uuid);
    expect(before.health).toBe(1);

    await clickTakeDamage(page, entry.uuid);
    await page.waitForTimeout(1500);
    const after = await pools(page, entry.uuid);

    expect(after.health).toBe(1 - entry.amount);
    expect(after.health).toBeLessThan(0);
  });

  test('a target whose damage was applied cannot be damaged again', async ({ foundryPage: page }) => {
    await attackDefender(page);

    const flag = await damageFlag(page);
    const entry = flag.targets.find((t) => t.hit);
    const before = await pools(page, entry.uuid);

    // The button has to be live before its being spent means anything.
    const live = await buttonStates(page, entry.uuid);
    expect(live.length).toBeGreaterThan(0);
    expect(live.every((b) => b.disabled === false)).toBe(true);

    await clickTakeDamage(page, entry.uuid);
    await page.waitForTimeout(1500);
    const once = await pools(page, entry.uuid);
    expect(once.health).toBe(before.health - entry.amount);

    // Every rendered copy goes to the spent state, not just the one clicked.
    const spent = await buttonStates(page, entry.uuid);
    expect(spent.length).toBe(live.length);
    expect(spent.every((b) => b.disabled === true)).toBe(true);
    expect(spent.every((b) => b.label === 'Applied')).toBe(true);

    // Clicking the spent button must not take the damage a second time.
    await page.evaluate((uuid) => {
      const buttons = document.querySelectorAll(`button.mm-take-damage[data-target-uuid="${uuid}"]`);
      buttons[buttons.length - 1].click();
    }, entry.uuid);
    await page.waitForTimeout(1500);
    const twice = await pools(page, entry.uuid);
    expect(twice.health).toBe(once.health);
  });

  test('the applied state and the damage both survive a reload', async ({ foundryPage: page }) => {
    await attackDefender(page);

    const flag = await damageFlag(page);
    const entry = flag.targets.find((t) => t.hit);
    const before = await pools(page, entry.uuid);

    await clickTakeDamage(page, entry.uuid);
    await page.waitForTimeout(1500);
    const applied = await pools(page, entry.uuid);
    expect(applied.health).toBe(before.health - entry.amount);

    await page.reload();
    await page.waitForFunction(() => window.game?.ready === true, { timeout: 60_000 });
    await page.waitForFunction(
      (uuid) => !!document.querySelector(`button.mm-take-damage[data-target-uuid="${uuid}"]`),
      entry.uuid,
      { timeout: 30_000 },
    );

    const afterReload = await buttonStates(page, entry.uuid);
    expect(afterReload.length).toBeGreaterThan(0);
    expect(afterReload.every((b) => b.disabled === true)).toBe(true);
    // The damage stayed applied once rather than being re-applied on render.
    expect((await pools(page, entry.uuid)).health).toBe(applied.health);
  });

  test('a target the attack missed is listed without a button', async ({ foundryPage: page }) => {
    await createActorViaAPI(page, ATTACKER);
    await updateActorData(page, ATTACKER, {
      'system.abilities.mle.value': 5,
      'system.attributes.rank.value': 3,
    });

    await createActorViaAPI(page, DEFENDER);
    await forceHit(page, DEFENDER, 'mle');

    await createActorViaAPI(page, BYSTANDER);
    await createActiveEffect(page, BYSTANDER, {
      name: 'E2E Unreachable Defense',
      changes: [{ key: 'system.abilities.mle.defense', mode: 2, value: '100' }],
    });

    await createScene(page, SCENE_NAME);
    await activateScene(page, SCENE_NAME);
    await waitForCanvasScene(page, SCENE_NAME);
    await placeToken(page, ATTACKER, 200, 200);
    await placeToken(page, DEFENDER, 400, 200);
    await placeToken(page, BYSTANDER, 600, 200);
    await page.evaluate(({ hit, miss }) => {
      for (const name of [hit, miss]) {
        const token = canvas.tokens.placeables.find((t) => t.actor?.name === name);
        if (!token) throw new Error(`Token for "${name}" not found`);
        token.setTarget(true, { releaseOthers: false });
      }
    }, { hit: DEFENDER, miss: BYSTANDER });
    await page.waitForTimeout(300);

    await triggerAbilityRoll(page, ATTACKER, 'mle');
    await openDamageCard(page);

    const flag = await damageFlag(page);
    const hitEntry = flag.targets.find((t) => t.name === DEFENDER);
    const missEntry = flag.targets.find((t) => t.name === BYSTANDER);
    expect(hitEntry.hit).toBe(true);
    expect(missEntry.hit).toBe(false);

    const rendered = await page.evaluate(({ hitUuid, missUuid }) => ({
      hitButton: !!document.querySelector(`button.mm-take-damage[data-target-uuid="${hitUuid}"]`),
      missButton: !!document.querySelector(`button.mm-take-damage[data-target-uuid="${missUuid}"]`),
      missListed: !!document.querySelector(`.mm-damage-target[data-target-uuid="${missUuid}"]`),
    }), { hitUuid: hitEntry.uuid, missUuid: missEntry.uuid });

    // Presence first: without this the absence below would pass on a card that
    // rendered no targets at all.
    expect(rendered.hitButton).toBe(true);
    expect(rendered.missListed).toBe(true);
    expect(rendered.missButton).toBe(false);
    expect(missEntry.amount).toBe(0);
  });

  /**
   * A power whose text reads "take half regular damage" carries
   * `system.damageScale`. The value has to survive the trip from the item, onto
   * the attack message, and into the amount the button applies.
   */
  test('a half-damage power halves what the card records and the button applies', async ({ foundryPage: page }) => {
    await createActorViaAPI(page, ATTACKER);
    await updateActorData(page, ATTACKER, {
      'system.abilities.mle.value': 5,
      'system.attributes.rank.value': 3,
    });
    await createActorViaAPI(page, DEFENDER);
    await forceHit(page, DEFENDER, 'agl');

    await createScene(page, SCENE_NAME);
    await activateScene(page, SCENE_NAME);
    await waitForCanvasScene(page, SCENE_NAME);
    await placeToken(page, ATTACKER, 200, 200);
    await placeToken(page, DEFENDER, 400, 200);
    await targetToken(page, DEFENDER);

    const rolled = await page.evaluate(async (name) => {
      const actor = game.actors.find((a) => a.name === name);
      const [power] = await actor.createEmbeddedDocuments('Item', [{
        name: 'E2E Half Damage Power',
        type: 'power',
        system: {
          ability: 'mle',
          attack: true,
          formula: '{1d6,1dm,1d6}',
          attackTarget: 'agl',
          damageType: 'health',
          damageScale: 0.5,
        },
      }]);
      await power.roll();
      await new Promise((r) => setTimeout(r, 1200));

      const attack = [...game.messages.contents].reverse().find((m) => m.rolls?.length);
      const roll = attack.rolls[0];
      return {
        scaleFlag: attack.getFlag('marvel-multiverse', 'damageScale') ?? null,
        targetsFlag: attack.getFlag('marvel-multiverse', 'targets') ?? null,
        itemIdFlag: attack.getFlag('marvel-multiverse', 'itemId') ?? null,
        marvelDie: roll.terms[0].rolls[1].dice[0].total,
        damageMultiplier: actor.system.abilities.mle.damageMultiplier,
        abilityValue: actor.system.abilities.mle.value,
      };
    }, ATTACKER);

    // The flag is the channel; if it never reached the message nothing below
    // could distinguish a halved card from an ordinary one.
    expect(rolled.scaleFlag).toBe(0.5);
    // Rolling an item passes an itemId, and toMessage writes that as a nested
    // flags object. A flag added as a flat "flags.a.b" key is wiped out by it,
    // which took the declared targets with it and left power attacks with no
    // Take Damage button at all.
    expect(rolled.itemIdFlag).not.toBeNull();
    expect(rolled.targetsFlag).toHaveLength(1);

    const { fantastic } = await openDamageCard(page);
    const flag = await damageFlag(page);
    const entry = flag.targets.find((t) => t.hit);

    // Rebuilt from the actor and the die that were actually rolled, so the
    // expectation cannot drift into agreeing with a wrong constant.
    const regular = rolled.marvelDie * rolled.damageMultiplier + rolled.abilityValue;
    const expected = Math.ceil(regular * 0.5 * (fantastic ? 2 : 1));
    expect(regular).toBeGreaterThan(0);
    expect(entry.amount).toBe(expected);
    // A Fantastic deals the total before halving; otherwise it is a real cut.
    expect(entry.amount).toBe(fantastic ? regular : Math.ceil(regular / 2));
    if (!fantastic) expect(entry.amount).toBeLessThan(regular);

    const before = await pools(page, entry.uuid);
    await clickTakeDamage(page, entry.uuid);
    await page.waitForTimeout(1500);
    const after = await pools(page, entry.uuid);
    expect(after.health).toBe(before.health - expected);

    await page.evaluate(async (name) => {
      const actor = game.actors.find((a) => a.name === name);
      for (const i of actor.items.filter((i) => i.name === 'E2E Half Damage Power')) await i.delete();
    }, ATTACKER);
  });

  test('an attack that declared no target produces a card with no button', async ({ foundryPage: page }) => {
    await createActorViaAPI(page, ATTACKER);
    await updateActorData(page, ATTACKER, {
      'system.abilities.mle.value': 5,
      'system.attributes.rank.value': 3,
    });

    await createScene(page, SCENE_NAME);
    await activateScene(page, SCENE_NAME);
    await waitForCanvasScene(page, SCENE_NAME);
    await clearTargets(page);

    await triggerAbilityRoll(page, ATTACKER, 'mle');
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('button.damage');
      if (!buttons.length) throw new Error('No damage button rendered on the attack card');
      buttons[buttons.length - 1].click();
    });
    await page.waitForTimeout(2500);

    const card = await page.evaluate(() => {
      const last = game.messages.contents[game.messages.contents.length - 1];
      return {
        content: last.content,
        hasDamageFlag: !!last.getFlag('marvel-multiverse', 'damage'),
        buttons: document.querySelectorAll('button.mm-take-damage').length,
      };
    });

    // The card itself still has to have been produced, or "no button" is vacuous.
    expect(card.content.toLowerCase()).toContain('damage');
    expect(card.hasDamageFlag).toBe(false);
    expect(card.buttons).toBe(0);
  });
});

/**
 * AC 6 and 7 are about what a player sees, and a GM sees a button on every
 * line, so this needs a second client actually joined as a player. Nothing
 * about the rule can be observed from the GM's session.
 */
/**
 * An open sheet must show the new value straight away (AC10), and a player who
 * is not the message's author cannot write its flags, so the applied state has
 * to reach a GM over the socket (AC13).
 */
test.describe('applying damage from other clients and other windows', () => {
  test.afterEach(async ({ foundryPage }) => {
    await purgeTestData(foundryPage);
  });

  test('an open sheet shows the reduced Health without a reload', async ({ foundryPage: page }) => {
    await attackDefender(page);
    const flag = await damageFlag(page);
    const entry = flag.targets.find((t) => t.hit);

    const shown = await page.evaluate(async (uuid) => {
      const actor = fromUuidSync(uuid);
      await actor.sheet.render(true);
      await new Promise((r) => setTimeout(r, 900));
      const read = () => {
        const el = actor.sheet.element instanceof HTMLElement
          ? actor.sheet.element
          : actor.sheet.element?.[0];
        return Number(el?.querySelector('input[name="system.health.value"]')?.value);
      };
      return { before: read(), stored: actor.system.health.value };
    }, entry.uuid);

    // The sheet has to be showing the pre-damage number first, or "it changed"
    // would mean nothing.
    expect(shown.before).toBe(shown.stored);

    await clickTakeDamage(page, entry.uuid);
    await page.waitForTimeout(1800);

    const after = await page.evaluate((uuid) => {
      const actor = fromUuidSync(uuid);
      const el = actor.sheet.element instanceof HTMLElement
        ? actor.sheet.element
        : actor.sheet.element?.[0];
      return {
        rendered: actor.sheet.rendered,
        shown: Number(el?.querySelector('input[name="system.health.value"]')?.value),
        stored: actor.system.health.value,
      };
    }, entry.uuid);

    expect(after.rendered).toBe(true);
    expect(after.stored).toBe(shown.stored - entry.amount);
    // No reload happened between the click and this read.
    expect(after.shown).toBe(after.stored);

    await page.evaluate(async (uuid) => {
      const actor = fromUuidSync(uuid);
      await actor.sheet.close();
    }, entry.uuid);
  });

  test('a player applying damage has the applied state saved through a GM', async ({ foundryPage: page, browser }) => {
    await attackDefender(page);
    const flag = await damageFlag(page);
    const entry = flag.targets.find((t) => t.hit);

    const playerId = await page.evaluate(async ({ name, uuid }) => {
      const stale = game.users.filter((u) => u.name === name);
      if (stale.length) await User.deleteDocuments(stale.map((u) => u.id));
      const user = await User.create({ name, role: CONST.USER_ROLES.PLAYER });
      // The player owns the target but did not author the damage message.
      const actor = fromUuidSync(uuid);
      await actor.update({ [`ownership.${user.id}`]: 3 });
      return user.id;
    }, { name: PLAYER_NAME, uuid: entry.uuid });

    const before = await pools(page, entry.uuid);
    const authorIsPlayer = await page.evaluate((id) => {
      const msg = [...game.messages.contents].reverse().find((m) => m.getFlag('marvel-multiverse', 'damage'));
      return msg.author?.id === id;
    }, playerId);
    // The relay only matters because the player is not the author.
    expect(authorIsPlayer).toBe(false);

    const context = await browser.newContext({
      viewport: { width: 1600, height: 900 },
      baseURL: 'http://localhost:30000',
    });
    const playerPage = await context.newPage();
    try {
      await playerPage.goto('/join');
      await playerPage.waitForSelector('select[name="userid"]', { timeout: 30_000 });
      await playerPage.selectOption('select[name="userid"]', playerId);
      await playerPage.locator('button[name="join"]').click();
      await playerPage.waitForURL('**/game', { timeout: 60_000 });
      await playerPage.waitForFunction(() => window.game?.ready === true, { timeout: 60_000 });
      await playerPage.waitForFunction(
        (uuid) => !!document.querySelector(`button.mm-take-damage[data-target-uuid="${uuid}"]`),
        entry.uuid,
        { timeout: 30_000 },
      );

      const canWrite = await playerPage.evaluate(() => {
        const msg = [...game.messages.contents].reverse().find((m) => m.getFlag('marvel-multiverse', 'damage'));
        return msg.canUserModify(game.user, 'update');
      });
      // If the player could write the flag directly the socket would never run.
      expect(canWrite).toBe(false);

      await playerPage.evaluate((uuid) => {
        const buttons = document.querySelectorAll(`button.mm-take-damage[data-target-uuid="${uuid}"]`);
        buttons[buttons.length - 1].click();
      }, entry.uuid);
      await playerPage.waitForTimeout(2500);

      // The actor update is the player's own doing, since they own the target.
      const after = await pools(page, entry.uuid);
      expect(after.health).toBe(before.health - entry.amount);

      // The applied record could only have been written by the GM client.
      const appliedOnGm = await page.evaluate(() => {
        const msg = [...game.messages.contents].reverse().find((m) => m.getFlag('marvel-multiverse', 'damage'));
        return msg.getFlag('marvel-multiverse', 'damage').applied;
      });
      expect(appliedOnGm).toContain(entry.uuid);
    } finally {
      await context.close();
    }
  });
});

test.describe('who the button is shown to', () => {
  test.afterEach(async ({ foundryPage }) => {
    await purgeTestData(foundryPage);
  });

  test('a player sees the button only for the target they own', async ({ foundryPage: page, browser }) => {
    await awaitStableGame(page);
    await clearChatMessages(page);
    await dismissNotifications(page);

    const playerId = await page.evaluate(async (name) => {
      const stale = game.users.filter((u) => u.name === name);
      if (stale.length) await User.deleteDocuments(stale.map((u) => u.id));
      const user = await User.create({ name, role: CONST.USER_ROLES.PLAYER });
      return user.id;
    }, PLAYER_NAME);

    await createActorViaAPI(page, ATTACKER);
    await updateActorData(page, ATTACKER, {
      'system.abilities.mle.value': 5,
      'system.attributes.rank.value': 3,
    });

    // Ownership is set before the tokens are placed, so the unlinked copies the
    // tokens carry are created already owned.
    await createActorViaAPI(page, DEFENDER);
    await createActorViaAPI(page, BYSTANDER);
    await page.evaluate(async ({ owned, unowned, playerId }) => {
      await game.actors.find((a) => a.name === owned).update({ [`ownership.${playerId}`]: 3 });
      await game.actors.find((a) => a.name === unowned).update({ [`ownership.${playerId}`]: 0 });
    }, { owned: DEFENDER, unowned: BYSTANDER, playerId });

    await forceHit(page, DEFENDER, 'mle');
    await forceHit(page, BYSTANDER, 'mle');

    // Several documents were created above; check the page is still settled
    // before building the scene against it.
    await awaitStableGame(page);
    await createScene(page, SCENE_NAME);
    await activateScene(page, SCENE_NAME);
    await waitForCanvasScene(page, SCENE_NAME);
    await placeToken(page, ATTACKER, 200, 200);
    await placeToken(page, DEFENDER, 400, 200);
    await placeToken(page, BYSTANDER, 600, 200);
    await page.evaluate(({ a, b }) => {
      for (const name of [a, b]) {
        canvas.tokens.placeables.find((t) => t.actor?.name === name).setTarget(true, { releaseOthers: false });
      }
    }, { a: DEFENDER, b: BYSTANDER });
    await page.waitForTimeout(300);

    await triggerAbilityRoll(page, ATTACKER, 'mle');
    await openDamageCard(page);

    const flag = await damageFlag(page);
    const owned = flag.targets.find((t) => t.name === DEFENDER);
    const unowned = flag.targets.find((t) => t.name === BYSTANDER);
    expect(owned.hit).toBe(true);
    expect(unowned.hit).toBe(true);

    // The GM sees both, which is what makes the player's view below a
    // restriction rather than an empty card.
    const gmView = await page.evaluate(({ ownedUuid, unownedUuid }) => ({
      owned: document.querySelectorAll(`button.mm-take-damage[data-target-uuid="${ownedUuid}"]`).length,
      unowned: document.querySelectorAll(`button.mm-take-damage[data-target-uuid="${unownedUuid}"]`).length,
    }), { ownedUuid: owned.uuid, unownedUuid: unowned.uuid });
    expect(gmView.owned).toBeGreaterThan(0);
    expect(gmView.unowned).toBeGreaterThan(0);

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      baseURL: 'http://localhost:30000',
    });
    const playerPage = await context.newPage();
    try {
      await playerPage.goto('/join');
      await playerPage.waitForSelector('select[name="userid"]', { timeout: 30_000 });
      await playerPage.selectOption('select[name="userid"]', playerId);
      await playerPage.locator('button[name="join"]').click();
      await playerPage.waitForURL('**/game', { timeout: 60_000 });
      await playerPage.waitForFunction(() => window.game?.ready === true, { timeout: 60_000 });
      await playerPage.waitForFunction(
        () => document.querySelectorAll('.mm-damage-target').length > 0,
        { timeout: 30_000 },
      );

      const playerView = await playerPage.evaluate(({ ownedUuid, unownedUuid }) => ({
        isGM: game.user.isGM,
        ownedButtons: document.querySelectorAll(`button.mm-take-damage[data-target-uuid="${ownedUuid}"]`).length,
        unownedButtons: document.querySelectorAll(`button.mm-take-damage[data-target-uuid="${unownedUuid}"]`).length,
        unownedListed: document.querySelectorAll(`.mm-damage-target[data-target-uuid="${unownedUuid}"]`).length,
      }), { ownedUuid: owned.uuid, unownedUuid: unowned.uuid });

      expect(playerView.isGM).toBe(false);
      // Presence before absence: the owned button proves this client rendered
      // the card at all, so the missing one below means a removed button.
      expect(playerView.ownedButtons).toBeGreaterThan(0);
      expect(playerView.unownedListed).toBeGreaterThan(0);
      expect(playerView.unownedButtons).toBe(0);
    } finally {
      await context.close();
    }

  });
});
