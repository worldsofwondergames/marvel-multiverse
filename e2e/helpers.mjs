/**
 * Shared helper functions for FoundryVTT e2e tests.
 */

/**
 * Wait for the FoundryVTT game object to be fully initialized.
 */
export async function waitForGameReady(page) {
  await page.waitForFunction(() => window.game?.ready === true, { timeout: 60_000 });
}

/**
 * Dismiss any FoundryVTT notification banners that block pointer events.
 */
export async function dismissNotifications(page) {
  await page.evaluate(() => {
    document.querySelectorAll('#notifications li.notification').forEach(n => n.remove());
  });
  await page.waitForTimeout(300);
}

/**
 * Create a new actor via the Actors sidebar tab.
 * Returns the actor sheet locator.
 */
export async function createActor(page, name, type = 'character') {
  // Click the Actors tab in the sidebar (v13 uses <button> elements)
  await dismissNotifications(page);
  const actorsTab = page.locator('#sidebar-tabs button[data-tab="actors"]');
  await actorsTab.click({ timeout: 10_000 });
  await page.waitForTimeout(1000);

  // Click "Create Actor"
  await dismissNotifications(page);
  const createBtn = page.locator('#actors button.create-entry[data-action="createEntry"]');
  await createBtn.waitFor({ state: 'visible', timeout: 10_000 });
  await createBtn.click();
  await page.waitForTimeout(2000);

  // Fill in the dialog (v13 uses <dialog> elements)
  const nameInput = page.locator('dialog input[name="name"]');
  await nameInput.waitFor({ state: 'attached', timeout: 10_000 });
  await nameInput.click();
  await nameInput.pressSequentially(name, { delay: 30 });

  const typeSelect = page.locator('dialog select[name="type"]');
  if (await typeSelect.count() > 0) {
    await typeSelect.selectOption(type);
  }

  // Wait for the submit button to become enabled
  const submitBtn = page.locator('dialog button[type="submit"]');
  await submitBtn.waitFor({ state: 'visible', timeout: 5_000 });
  await page.waitForFunction(() => {
    const btn = document.querySelector('dialog button[type="submit"]');
    return btn && !btn.disabled;
  }, { timeout: 5_000 });
  await submitBtn.click();

  // Wait for the character sheet to appear
  await page.waitForTimeout(3000);

  // Dismiss any notification banners that block interaction
  await dismissNotifications(page);

  // Find the sheet — it's the window containing inputs with system.abilities fields
  const sheet = page.locator('.sheet.actor').last();
  await sheet.locator('input[name="system.attributes.rank.value"]').waitFor({ state: 'attached', timeout: 10_000 });
  return sheet;
}

/**
 * Set a numeric input field on the character sheet and trigger an update.
 */
export async function setNumericField(sheet, fieldName, value) {
  const page = sheet.page();
  await dismissNotifications(page);
  const input = sheet.locator(`input[name="${fieldName}"]`);
  await input.click({ clickCount: 3 });
  await input.fill(String(value));
  await input.press('Tab');
  await page.waitForTimeout(800);
}

/**
 * Set a text input field on the character sheet.
 */
export async function setTextField(sheet, fieldName, value) {
  const input = sheet.locator(`input[name="${fieldName}"]`);
  await input.click({ clickCount: 3 });
  await input.fill(value);
  await input.press('Tab');
  await sheet.page().waitForTimeout(800);
}

/**
 * Select an option from a dropdown on the character sheet.
 */
export async function setSelectField(sheet, fieldName, value) {
  const select = sheet.locator(`select[name="${fieldName}"]`);
  await select.selectOption(value);
  await sheet.page().waitForTimeout(800);
}

/**
 * Drop a compendium item onto the currently open character sheet
 * by using FoundryVTT's API to find the item and call the sheet's drop handler.
 *
 * Searches the marvel-multiverse-data module's combined items pack,
 * falling back to the system's own packs if not found.
 */
export async function dragCompendiumItem(page, packName, itemName, sheet) {
  await page.evaluate(async ({ packName, itemName }) => {
    // Primary source: the module's combined items pack
    const modulePack = game.packs.get('marvel-multiverse-data.marvel-multiverse-items');
    // Fallback: the system's per-type packs
    const systemPack = game.packs.get(`marvel-multiverse.${packName}`);

    let item = null;

    for (const pack of [modulePack, systemPack].filter(Boolean)) {
      const index = await pack.getIndex({ fields: ['name', 'type'] });
      const entry = index.find(e => e.name === itemName);
      if (entry) {
        item = await pack.getDocument(entry._id);
        break;
      }
    }

    if (!item) {
      throw new Error(`Item "${itemName}" not found in any compendium pack.`);
    }

    const itemData = item.toObject();

    const actorSheet = Object.values(ui.windows).find(w => w instanceof ActorSheet);
    if (!actorSheet) throw new Error('No actor sheet is currently open');

    await actorSheet._onDropItemCreate(itemData);
  }, { packName, itemName });

  await page.waitForTimeout(500);
}

/**
 * Navigate to the Biography tab on the character sheet.
 */
export async function goToBiographyTab(sheet) {
  await sheet.locator('.sheet-tabs a[data-tab="biography"]').click();
  await sheet.page().waitForTimeout(500);
}

/**
 * Navigate to the Abilities tab on the character sheet.
 */
export async function goToAbilitiesTab(sheet) {
  await sheet.locator('.sheet-tabs a[data-tab="abilities"]').click();
  await sheet.page().waitForTimeout(500);
}

/**
 * Close the character sheet.
 */
export async function closeSheet(sheet) {
  await sheet.locator('button[data-action="close"]').click();
  await sheet.page().waitForTimeout(500);
}

/**
 * Delete an actor by name to clean up after tests.
 */
export async function deleteActor(page, actorName) {
  await page.evaluate(async (name) => {
    const actor = game.actors.find(a => a.name === name);
    if (actor) await actor.delete();
  }, actorName);
  await page.waitForTimeout(500);
}

/**
 * Get all item names of a given type on the actor.
 */
export async function getActorItems(page, actorName, itemType) {
  return page.evaluate(({ actorName, itemType }) => {
    const actor = game.actors.find(a => a.name === actorName);
    if (!actor) return [];
    return actor.items.filter(i => i.type === itemType).map(i => i.name).sort();
  }, { actorName, itemType });
}

/**
 * Get derived actor data by manually reading each property.
 * JSON.stringify strips Foundry's derived (non-schema) fields,
 * so we extract them explicitly.
 */
export async function getActorSystemData(page, actorName) {
  return page.evaluate((name) => {
    const actor = game.actors.find(a => a.name === name);
    if (!actor) throw new Error(`Actor "${name}" not found`);
    const s = actor.system;
    const isVehicle = actor.type === 'vehicle';

    if (isVehicle) {
      return {
        health: {
          value: s.health.value, max: s.health.max,
          halfSpeed: s.health.halfSpeed, disabled: s.health.disabled,
          destroyed: s.health.destroyed, status: s.health.status,
        },
        damageReduction: s.damageReduction,
        size: s.size,
        defense: s.defense,
        crew: s.crew,
        passengers: s.passengers,
        occupants: s.occupants?.map(o => ({ actorId: o.actorId, name: o.name, role: o.role })) ?? [],
        speed: (() => {
          const sp = {};
          for (const key of Object.keys(s.speed)) {
            sp[key] = { value: s.speed[key].value, active: s.speed[key].active };
          }
          return sp;
        })(),
      };
    }

    const abilities = {};
    for (const key of ['mle', 'agl', 'res', 'vig', 'ego', 'log']) {
      abilities[key] = {
        value: s.abilities[key].value,
        defense: s.abilities[key].defense,
        noncom: s.abilities[key].noncom,
        damageMultiplier: s.abilities[key].damageMultiplier,
        edge: s.abilities[key].edge,
        label: s.abilities[key].label,
      };
    }
    const movement = {};
    for (const key of Object.keys(s.movement)) {
      movement[key] = {
        value: s.movement[key].value,
        noncom: s.movement[key].noncom,
        active: s.movement[key].active,
        calc: s.movement[key].calc,
        label: s.movement[key].label,
      };
    }
    return {
      abilities,
      attributes: {
        rank: { value: s.attributes.rank.value },
        init: { value: s.attributes.init.value, edge: s.attributes.init.edge, trouble: s.attributes.init.trouble },
      },
      health: { value: s.health.value, max: s.health.max, bonus: s.health.bonus },
      focus: { value: s.focus.value, max: s.focus.max, bonus: s.focus.bonus },
      karma: { value: s.karma.value, max: s.karma.max },
      healthDamageReduction: s.healthDamageReduction,
      focusDamageReduction: s.focusDamageReduction,
      conditionDamageReduction: s.conditionDamageReduction,
      size: s.size,
      reach: s.reach,
      mutantReputation: s.mutantReputation,
      movement,
    };
  }, actorName);
}

/**
 * Update an actor's data directly via the API.
 */
export async function updateActorData(page, actorName, updateData) {
  await page.evaluate(async ({ name, data }) => {
    const actor = game.actors.find(a => a.name === name);
    if (!actor) throw new Error(`Actor "${name}" not found`);
    await actor.update(data);
  }, { name: actorName, data: updateData });
  await page.waitForTimeout(500);
}

/**
 * Create an Active Effect on an actor and return its ID.
 */
export async function createActiveEffect(page, actorName, effectData) {
  return page.evaluate(async ({ name, data }) => {
    const actor = game.actors.find(a => a.name === name);
    if (!actor) throw new Error(`Actor "${name}" not found`);
    const [effect] = await actor.createEmbeddedDocuments('ActiveEffect', [data]);
    return effect.id;
  }, { name: actorName, data: effectData });
}

/**
 * Get names of all Active Effects on an actor.
 */
export async function getActiveEffectNames(page, actorName) {
  return page.evaluate((name) => {
    const actor = game.actors.find(a => a.name === name);
    if (!actor) return [];
    return actor.effects.contents.map(e => e.name);
  }, actorName);
}

/**
 * Set a game setting for the marvel-multiverse system.
 */
export async function setGameSetting(page, key, value) {
  await page.evaluate(async ({ key, value }) => {
    await game.settings.set('marvel-multiverse', key, value);
  }, { key, value });
  await page.waitForTimeout(500);
}

/**
 * Get a game setting for the marvel-multiverse system.
 */
export async function getGameSetting(page, key) {
  return page.evaluate((key) => {
    return game.settings.get('marvel-multiverse', key);
  }, key);
}

/**
 * Evaluate a d616 roll and return structured results.
 */
export async function evaluateRoll(page, formula = '{1d6,1dm,1d6}', data = {}) {
  return page.evaluate(async ({ formula, data }) => {
    const Roll = CONFIG.Dice.rolls[0];
    const roll = new Roll(formula, data);
    await roll.evaluate();
    return {
      total: roll.total,
      formula: roll.formula,
      terms: roll.terms.map(t => {
        if (t.results) {
          return {
            faces: t.faces,
            results: t.results.map(r => ({ result: r.result, active: r.active })),
            total: t.total,
          };
        }
        return { number: t.number };
      }),
    };
  }, { formula, data });
}

/**
 * Get the last chat message's content and flavor.
 */
export async function getLastChatMessage(page) {
  return page.evaluate(() => {
    const messages = game.messages.contents;
    if (messages.length === 0) return null;
    const last = messages[messages.length - 1];
    return {
      content: last.content,
      flavor: last.flavor ?? '',
    };
  });
}

/**
 * Create a combat encounter.
 */
export async function createCombat(page) {
  await page.evaluate(async () => {
    await Combat.create({});
  });
  await page.waitForTimeout(500);
}

/**
 * Add an actor to the active combat as a combatant.
 */
export async function addToCombat(page, actorName) {
  await page.evaluate(async (name) => {
    const actor = game.actors.find(a => a.name === name);
    if (!actor) throw new Error(`Actor "${name}" not found`);
    await game.combat.createEmbeddedDocuments('Combatant', [{
      actorId: actor.id,
      hidden: false,
    }]);
  }, actorName);
  await page.waitForTimeout(500);
}

/**
 * Delete the active combat encounter.
 */
export async function deleteCombat(page) {
  await page.evaluate(async () => {
    if (game.combat) await game.combat.delete();
  });
  await page.waitForTimeout(500);
}

/**
 * Create an actor via the API (no UI interaction). Returns the actor name.
 * Useful for tests that don't need the sheet open.
 */
export async function createActorViaAPI(page, name, type = 'character') {
  await page.evaluate(async ({ name, type }) => {
    await Actor.create({ name, type });
  }, { name, type });
  await page.waitForTimeout(500);
}

/**
 * Create a simple scene via the API.
 */
export async function createScene(page, name) {
  await page.evaluate(async (name) => {
    await Scene.create({
      name,
      width: 1000,
      height: 1000,
      grid: { size: 100 },
      tokenVision: false,
      fogExploration: false,
    });
  }, name);
  await page.waitForTimeout(500);
}

/**
 * Activate and view a scene so its canvas is rendered.
 */
export async function activateScene(page, name) {
  await page.evaluate(async (name) => {
    const scene = game.scenes.find(s => s.name === name);
    if (!scene) throw new Error(`Scene "${name}" not found`);
    await scene.activate();
    await scene.view();
  }, name);
  // Wait for canvas to be fully ready
  await page.waitForFunction(() => canvas?.ready === true && canvas?.tokens?.objects != null, { timeout: 30000 });
  await page.waitForTimeout(1000);
}

/**
 * Place a token for the named actor on the active scene.
 * Returns the token ID.
 */
export async function placeToken(page, actorName, x = 200, y = 200) {
  return page.evaluate(async ({ actorName, x, y }) => {
    const actor = game.actors.find(a => a.name === actorName);
    if (!actor) throw new Error(`Actor "${actorName}" not found`);
    const scene = game.scenes.active;
    if (!scene) throw new Error('No active scene');
    const [token] = await scene.createEmbeddedDocuments('Token', [{
      name: actor.name,
      actorId: actor.id,
      x, y,
      texture: { src: actor.img || 'icons/svg/mystery-man.svg' },
    }]);
    return token.id;
  }, { actorName, x, y });
}

/**
 * Target a token on the canvas by its actor name.
 */
export async function targetToken(page, actorName) {
  await page.evaluate(async (actorName) => {
    const token = canvas.tokens.placeables.find(t => t.actor?.name === actorName);
    if (!token) throw new Error(`Token for "${actorName}" not found on canvas`);
    token.setTarget(true, { releaseOthers: true });
  }, actorName);
  await page.waitForTimeout(300);
}

/**
 * Clear all token targets for the current user.
 */
export async function clearTargets(page) {
  await page.evaluate(() => {
    game.user.targets.forEach(t => t.setTarget(false));
  });
  await page.waitForTimeout(300);
}

/**
 * Delete a scene by name.
 */
export async function deleteScene(page, name) {
  await page.evaluate(async (name) => {
    const scene = game.scenes.find(s => s.name === name);
    if (scene) await scene.delete();
  }, name);
  await page.waitForTimeout(500);
}

/**
 * Click the damage button in the most recent chat message.
 * Uses native DOM click dispatch to trigger the bound event listener,
 * falling back to direct _handleDamageChatButton invocation.
 */
export async function clickDamageButton(page) {
  // Ensure the chat sidebar is open
  await page.evaluate(() => {
    ui.sidebar?.activateTab?.('chat');
  });
  await page.waitForTimeout(500);

  // Try native DOM click on the damage button (triggers the bound event listener)
  const clicked = await page.evaluate(() => {
    const buttons = document.querySelectorAll('button.damage');
    if (buttons.length > 0) {
      const btn = buttons[buttons.length - 1];
      btn.click();
      return true;
    }
    return false;
  });

  if (clicked) {
    await page.waitForTimeout(3000);
    return;
  }

  // Fallback: invoke the damage handler programmatically
  await page.evaluate(async () => {
    const messages = game.messages.contents;
    const last = messages[messages.length - 1];
    if (!last) throw new Error('No chat messages found');

    const flavor = last.flavor ?? '';
    const roll = last.rolls?.[0];
    const pool = roll?.terms?.[0];
    const marvelRoll = pool?.rolls?.[1];
    const marvelResult = marvelRoll?.dice?.[0]?.results?.[0]?.result;
    const fantastic = marvelResult === 1 ? true : null;

    if (typeof last._handleDamageChatButton === 'function') {
      await last._handleDamageChatButton(last.id, flavor, fantastic);
    } else {
      throw new Error('_handleDamageChatButton not found on ChatMessage instance');
    }
  });
  await page.waitForTimeout(3000);
}

/**
 * Get the HTML content of the last chat message.
 */
export async function getLastChatMessageHTML(page) {
  return page.evaluate(() => {
    const messages = game.messages.contents;
    if (messages.length === 0) return null;
    const last = messages[messages.length - 1];
    return {
      content: last.content,
      flavor: last.flavor ?? '',
      flags: last.flags ?? {},
    };
  });
}

/**
 * Trigger an ability roll programmatically on an actor and return the chat message.
 * This bypasses the sheet UI and calls the roll directly.
 */
export async function triggerAbilityRoll(page, actorName, abilityKey) {
  await page.evaluate(async ({ actorName, abilityKey }) => {
    const actor = game.actors.find(a => a.name === actorName);
    if (!actor) throw new Error(`Actor "${actorName}" not found`);
    const ability = actor.system.abilities[abilityKey];
    if (!ability) throw new Error(`Ability "${abilityKey}" not found`);
    const abilityLabels = { mle: 'Melee', agl: 'Agility', res: 'Resilience', vig: 'Vigilance', ego: 'Ego', log: 'Logic' };
    const label = abilityLabels[abilityKey] || abilityKey;
    const edgeMode = ability.edge
      ? CONFIG.Dice.MarvelMultiverseRoll.EDGE_MODE.EDGE
      : ability.trouble
        ? CONFIG.Dice.MarvelMultiverseRoll.EDGE_MODE.TROUBLE
        : CONFIG.Dice.MarvelMultiverseRoll.EDGE_MODE.NORMAL;
    const roll = new CONFIG.Dice.MarvelMultiverseRoll(
      `{1d6,1dm,1d6}+@abilities.${abilityKey}.value`,
      actor.getRollData(),
      { edgeMode },
    );
    const speaker = ChatMessage.getSpeaker({ actor });
    let flavor = `[ability] ${label}`;
    await roll.toMessage({ speaker, flavor, rollMode: 'publicroll' });
  }, { actorName, abilityKey });
  await page.waitForTimeout(2000);
}

/**
 * Delete all chat messages to start with a clean slate.
 */
export async function clearChatMessages(page) {
  await page.evaluate(async () => {
    const ids = game.messages.contents.map(m => m.id);
    if (ids.length) await ChatMessage.deleteDocuments(ids);
  });
  await page.waitForTimeout(500);
}
