import { test, expect } from './fixtures.mjs';
import {
  dismissNotifications,
  createActorViaAPI,
  deleteActor,
  createScene,
  activateScene,
  deleteScene,
  placeToken,
  deleteCombat,
  setGameSetting,
} from './helpers.mjs';

const PRIMARY_NAME = 'E2E Primary Form';
const ALTERNATE_NAME = 'E2E Alternate Form';
const SCENE_NAME = 'E2E Alt Form Scene';

async function enableAlternateForms(page) {
  await setGameSetting(page, 'enableAlternateForms', true);
}

async function disableAlternateForms(page) {
  await setGameSetting(page, 'enableAlternateForms', false);
}

async function linkFormsViaAPI(page, primaryName, alternateName, formType = 'powerDown', triggers = []) {
  await page.evaluate(async ({ primaryName, alternateName, formType, triggers }) => {
    const primary = game.actors.find(a => a.name === primaryName);
    const alternate = game.actors.find(a => a.name === alternateName);
    if (!primary || !alternate) throw new Error('Actors not found');
    const currentForms = foundry.utils.deepClone(primary.system.alternateForms ?? []);
    currentForms.push({ actorId: alternate.id, formType, triggers });
    await primary.update({ 'system.alternateForms': currentForms });
    const currentPrimaryIds = [...(alternate.system.primaryFormIds ?? [])];
    if (!currentPrimaryIds.includes(primary.id)) {
      currentPrimaryIds.push(primary.id);
      await alternate.update({ 'system.primaryFormIds': currentPrimaryIds });
    }
  }, { primaryName, alternateName, formType, triggers });
  await page.waitForTimeout(500);
}

async function unlinkFormsViaAPI(page, primaryName, alternateName) {
  await page.evaluate(async ({ primaryName, alternateName }) => {
    const primary = game.actors.find(a => a.name === primaryName);
    const alternate = game.actors.find(a => a.name === alternateName);
    if (!primary || !alternate) return;
    const updatedForms = (primary.system.alternateForms ?? []).filter(f => f.actorId !== alternate.id);
    await primary.update({ 'system.alternateForms': updatedForms });
    const updatedPrimaryIds = (alternate.system.primaryFormIds ?? []).filter(id => id !== primary.id);
    await alternate.update({ 'system.primaryFormIds': updatedPrimaryIds });
  }, { primaryName, alternateName });
  await page.waitForTimeout(500);
}

async function getAlternateFormData(page, actorName) {
  return page.evaluate((name) => {
    const actor = game.actors.find(a => a.name === name);
    if (!actor) throw new Error(`Actor "${name}" not found`);
    return {
      alternateForms: actor.system.alternateForms ?? [],
      primaryFormIds: actor.system.primaryFormIds ?? [],
    };
  }, actorName);
}

async function getTokenActorName(page, sceneName) {
  return page.evaluate((sceneName) => {
    const scene = game.scenes.find(s => s.name === sceneName);
    if (!scene) return null;
    const tokens = scene.tokens.contents;
    if (tokens.length === 0) return null;
    return tokens[0].name;
  }, sceneName);
}

async function getCombatantActorName(page) {
  return page.evaluate(() => {
    if (!game.combat) return null;
    const combatant = game.combat.combatants.contents[0];
    if (!combatant) return null;
    const actor = game.actors.get(combatant.actorId);
    return actor?.name ?? null;
  });
}

async function getCombatantInitiative(page) {
  return page.evaluate(() => {
    if (!game.combat) return null;
    const combatant = game.combat.combatants.contents[0];
    return combatant?.initiative ?? null;
  });
}

test.describe('Alternate Forms', () => {
  test.beforeEach(async ({ foundryPage }) => {
    await enableAlternateForms(foundryPage);
    await deleteActor(foundryPage, PRIMARY_NAME);
    await deleteActor(foundryPage, ALTERNATE_NAME);
    await deleteScene(foundryPage, SCENE_NAME);
    await deleteCombat(foundryPage);
    await createActorViaAPI(foundryPage, PRIMARY_NAME);
    await createActorViaAPI(foundryPage, ALTERNATE_NAME);
  });

  test.afterEach(async ({ foundryPage }) => {
    await deleteCombat(foundryPage);
    await deleteScene(foundryPage, SCENE_NAME);
    await deleteActor(foundryPage, PRIMARY_NAME);
    await deleteActor(foundryPage, ALTERNATE_NAME);
    await disableAlternateForms(foundryPage);
  });

  test('link forms and verify data on both actors', async ({ foundryPage }) => {
    await linkFormsViaAPI(foundryPage, PRIMARY_NAME, ALTERNATE_NAME, 'powerDown');
    const primaryData = await getAlternateFormData(foundryPage, PRIMARY_NAME);
    expect(primaryData.alternateForms).toHaveLength(1);
    expect(primaryData.alternateForms[0].formType).toBe('powerDown');
    const alternateData = await getAlternateFormData(foundryPage, ALTERNATE_NAME);
    expect(alternateData.primaryFormIds).toHaveLength(1);
  });

  test('forms section displays on both actor sheets', async ({ foundryPage }) => {
    await linkFormsViaAPI(foundryPage, PRIMARY_NAME, ALTERNATE_NAME, 'powerDown');
    await foundryPage.evaluate(async (name) => {
      const actor = game.actors.find(a => a.name === name);
      actor.sheet.render(true);
    }, PRIMARY_NAME);
    await foundryPage.waitForTimeout(2000);
    await dismissNotifications(foundryPage);
    const sheet = foundryPage.locator('.sheet.actor').last();
    await sheet.waitFor({ state: 'visible', timeout: 10_000 });
    await sheet.locator('.sheet-tabs a[data-tab="biography"]').click();
    await foundryPage.waitForTimeout(500);
    const formsSection = sheet.locator('.mm-alternate-forms-block');
    await expect(formsSection).toBeVisible();
    const formName = formsSection.locator('.alternate-form-name');
    await expect(formName).toHaveText(ALTERNATE_NAME);
  });

  test('switch forms via sheet button replaces token', async ({ foundryPage }) => {
    await linkFormsViaAPI(foundryPage, PRIMARY_NAME, ALTERNATE_NAME, 'powerDown');
    await createScene(foundryPage, SCENE_NAME);
    await activateScene(foundryPage, SCENE_NAME);
    await placeToken(foundryPage, PRIMARY_NAME, 300, 300);
    let tokenName = await getTokenActorName(foundryPage, SCENE_NAME);
    expect(tokenName).toBe(PRIMARY_NAME);
    await foundryPage.evaluate(async (names) => {
      const actor = game.actors.find(a => a.name === names.primary);
      const alternate = game.actors.find(a => a.name === names.alternate);
      const scene = game.scenes.active;
      const currentToken = scene.tokens.find(t => t.actorId === actor.id);
      const protoData = alternate.prototypeToken?.toObject?.() ?? {};
      const { x, y, elevation, rotation } = currentToken;
      await scene.deleteEmbeddedDocuments('Token', [currentToken.id]);
      await scene.createEmbeddedDocuments('Token', [{
        ...protoData,
        actorId: alternate.id,
        x, y, elevation, rotation,
      }]);
    }, { primary: PRIMARY_NAME, alternate: ALTERNATE_NAME });
    await foundryPage.waitForTimeout(1000);
    tokenName = await getTokenActorName(foundryPage, SCENE_NAME);
    expect(tokenName).toBe(ALTERNATE_NAME);
  });

  test('combat tracker preserves initiative after form switch', async ({ foundryPage }) => {
    await linkFormsViaAPI(foundryPage, PRIMARY_NAME, ALTERNATE_NAME, 'powerDown');
    await createScene(foundryPage, SCENE_NAME);
    await activateScene(foundryPage, SCENE_NAME);
    const tokenId = await placeToken(foundryPage, PRIMARY_NAME, 300, 300);
    await foundryPage.evaluate(async ({ primaryName, tokenId }) => {
      await Combat.create({});
      const actor = game.actors.find(a => a.name === primaryName);
      const scene = game.scenes.active;
      const token = scene.tokens.get(tokenId);
      await game.combat.createEmbeddedDocuments('Combatant', [{
        actorId: actor.id,
        tokenId: token.id,
      }]);
      await game.combat.startCombat();
      const combatant = game.combat.combatants.contents[0];
      await combatant.update({ initiative: 15 });
    }, { primaryName: PRIMARY_NAME, tokenId });
    await foundryPage.waitForTimeout(1000);
    let initiative = await getCombatantInitiative(foundryPage);
    expect(initiative).toBe(15);
    await foundryPage.evaluate(async (names) => {
      const actor = game.actors.find(a => a.name === names.primary);
      const alternate = game.actors.find(a => a.name === names.alternate);
      const scene = game.scenes.active;
      const currentToken = scene.tokens.find(t => t.actorId === actor.id);
      const protoData = alternate.prototypeToken?.toObject?.() ?? {};
      const { x, y, elevation, rotation } = currentToken;
      const combatant = game.combat.combatants.find(c => c.tokenId === currentToken.id);
      const savedInitiative = combatant?.initiative;
      await scene.deleteEmbeddedDocuments('Token', [currentToken.id]);
      const [newToken] = await scene.createEmbeddedDocuments('Token', [{
        ...protoData,
        actorId: alternate.id,
        x, y, elevation, rotation,
      }]);
      if (combatant && newToken) {
        await combatant.update({ actorId: alternate.id, tokenId: newToken.id, initiative: savedInitiative });
      }
    }, { primary: PRIMARY_NAME, alternate: ALTERNATE_NAME });
    await foundryPage.waitForTimeout(1000);
    const combatantName = await getCombatantActorName(foundryPage);
    expect(combatantName).toBe(ALTERNATE_NAME);
    initiative = await getCombatantInitiative(foundryPage);
    expect(initiative).toBe(15);
  });

  test('unlink forms cleans up data; unlink during combat preserves combatant', async ({ foundryPage }) => {
    await linkFormsViaAPI(foundryPage, PRIMARY_NAME, ALTERNATE_NAME, 'powerDown');
    await unlinkFormsViaAPI(foundryPage, PRIMARY_NAME, ALTERNATE_NAME);
    let primaryData = await getAlternateFormData(foundryPage, PRIMARY_NAME);
    expect(primaryData.alternateForms).toHaveLength(0);
    let alternateData = await getAlternateFormData(foundryPage, ALTERNATE_NAME);
    expect(alternateData.primaryFormIds).toHaveLength(0);

    await linkFormsViaAPI(foundryPage, PRIMARY_NAME, ALTERNATE_NAME, 'powerDown');
    await createScene(foundryPage, SCENE_NAME);
    await activateScene(foundryPage, SCENE_NAME);
    await placeToken(foundryPage, PRIMARY_NAME, 300, 300);
    await foundryPage.evaluate(async (primaryName) => {
      const actor = game.actors.find(a => a.name === primaryName);
      const scene = game.scenes.active;
      const token = scene.tokens.find(t => t.actorId === actor.id);
      await Combat.create({});
      await game.combat.createEmbeddedDocuments('Combatant', [{
        actorId: actor.id,
        tokenId: token.id,
      }]);
      await game.combat.startCombat();
    }, PRIMARY_NAME);
    await foundryPage.waitForTimeout(500);

    await unlinkFormsViaAPI(foundryPage, PRIMARY_NAME, ALTERNATE_NAME);

    const combatantName = await getCombatantActorName(foundryPage);
    expect(combatantName).toBe(PRIMARY_NAME);

    primaryData = await getAlternateFormData(foundryPage, PRIMARY_NAME);
    expect(primaryData.alternateForms).toHaveLength(0);
  });

  test('forms section hidden when setting disabled', async ({ foundryPage }) => {
    await disableAlternateForms(foundryPage);
    await foundryPage.evaluate(async (name) => {
      const actor = game.actors.find(a => a.name === name);
      actor.sheet.render(true);
    }, PRIMARY_NAME);
    await foundryPage.waitForTimeout(2000);
    await dismissNotifications(foundryPage);
    const sheet = foundryPage.locator('.sheet.actor').last();
    await sheet.waitFor({ state: 'visible', timeout: 10_000 });
    await sheet.locator('.sheet-tabs a[data-tab="biography"]').click();
    await foundryPage.waitForTimeout(500);
    const formsSection = sheet.locator('.mm-alternate-forms-block');
    await expect(formsSection).toHaveCount(0);
  });

  test('token HUD shows Switch Form button for linked actor', async ({ foundryPage }) => {
    await linkFormsViaAPI(foundryPage, PRIMARY_NAME, ALTERNATE_NAME, 'powerDown');
    await createScene(foundryPage, SCENE_NAME);
    await activateScene(foundryPage, SCENE_NAME);
    await placeToken(foundryPage, PRIMARY_NAME, 300, 300);
    await foundryPage.waitForTimeout(1000);

    const hasSwitchBtn = await foundryPage.evaluate(async (primaryName) => {
      const token = canvas.tokens.placeables.find(t => t.name === primaryName);
      if (!token) throw new Error('Token not found');
      token.control({ releaseOthers: true });
      canvas.hud.token.bind(token);
      await new Promise(r => setTimeout(r, 500));
      const btn = canvas.hud.token.element?.querySelector('.fa-exchange-alt');
      return !!btn;
    }, PRIMARY_NAME);

    expect(hasSwitchBtn).toBe(true);
  });

  test('token HUD hides Switch Form button for unlinked actor', async ({ foundryPage }) => {
    await createScene(foundryPage, SCENE_NAME);
    await activateScene(foundryPage, SCENE_NAME);
    await placeToken(foundryPage, PRIMARY_NAME, 300, 300);
    await foundryPage.waitForTimeout(1000);

    const hasSwitchBtn = await foundryPage.evaluate(async (primaryName) => {
      const token = canvas.tokens.placeables.find(t => t.name === primaryName);
      if (!token) throw new Error('Token not found');
      token.control({ releaseOthers: true });
      canvas.hud.token.bind(token);
      await new Promise(r => setTimeout(r, 500));
      const btn = canvas.hud.token.element?.querySelector('.fa-exchange-alt');
      return !!btn;
    }, PRIMARY_NAME);

    expect(hasSwitchBtn).toBe(false);
  });

  test('token HUD Switch Form button triggers form switch', async ({ foundryPage }) => {
    await linkFormsViaAPI(foundryPage, PRIMARY_NAME, ALTERNATE_NAME, 'powerDown');
    await createScene(foundryPage, SCENE_NAME);
    await activateScene(foundryPage, SCENE_NAME);
    await placeToken(foundryPage, PRIMARY_NAME, 300, 300);
    await foundryPage.waitForTimeout(1000);

    await foundryPage.evaluate(async (primaryName) => {
      const token = canvas.tokens.placeables.find(t => t.name === primaryName);
      if (!token) throw new Error('Token not found');
      token.control({ releaseOthers: true });
      canvas.hud.token.bind(token);
      await new Promise(r => setTimeout(r, 500));
      const btn = canvas.hud.token.element?.querySelector('.fa-exchange-alt')?.closest('button');
      if (!btn) throw new Error('Switch Form button not found');
      btn.click();
    }, PRIMARY_NAME);

    await foundryPage.waitForTimeout(2000);
    const tokenName = await getTokenActorName(foundryPage, SCENE_NAME);
    expect(tokenName).toBe(ALTERNATE_NAME);
  });

  test('switch form preserves prototype token settings', async ({ foundryPage }) => {
    await foundryPage.evaluate(async (altName) => {
      const alt = game.actors.find(a => a.name === altName);
      if (!alt) throw new Error('Alternate actor not found');
      await alt.update({
        'prototypeToken.displayName': 30,
        'prototypeToken.actorLink': true,
        'prototypeToken.disposition': 1,
      });
    }, ALTERNATE_NAME);
    await foundryPage.waitForTimeout(500);

    await linkFormsViaAPI(foundryPage, PRIMARY_NAME, ALTERNATE_NAME, 'powerDown');
    await createScene(foundryPage, SCENE_NAME);
    await activateScene(foundryPage, SCENE_NAME);
    await placeToken(foundryPage, PRIMARY_NAME, 300, 300);
    await foundryPage.waitForTimeout(1000);

    await foundryPage.evaluate(async ({ primaryName, alternateName }) => {
      const actor = game.actors.find(a => a.name === primaryName);
      const alternate = game.actors.find(a => a.name === alternateName);
      const scene = game.scenes.active;
      const currentToken = scene.tokens.find(t => t.actorId === actor.id);
      const protoData = alternate.prototypeToken?.toObject?.() ?? {};
      const { x, y, elevation, rotation } = currentToken;
      await scene.deleteEmbeddedDocuments('Token', [currentToken.id]);
      await scene.createEmbeddedDocuments('Token', [{
        ...protoData,
        actorId: alternate.id,
        x, y, elevation, rotation,
      }]);
    }, { primaryName: PRIMARY_NAME, alternateName: ALTERNATE_NAME });
    await foundryPage.waitForTimeout(1000);

    const tokenSettings = await foundryPage.evaluate((sceneName) => {
      const scene = game.scenes.find(s => s.name === sceneName);
      const token = scene.tokens.contents[0];
      return {
        displayName: token.displayName,
        actorLink: token.actorLink,
        disposition: token.disposition,
      };
    }, SCENE_NAME);

    expect(tokenSettings.displayName).toBe(30);
    expect(tokenSettings.actorLink).toBe(true);
    expect(tokenSettings.disposition).toBe(1);
  });

  test('token HUD hidden when alternate forms setting disabled', async ({ foundryPage }) => {
    await linkFormsViaAPI(foundryPage, PRIMARY_NAME, ALTERNATE_NAME, 'powerDown');
    await disableAlternateForms(foundryPage);
    await createScene(foundryPage, SCENE_NAME);
    await activateScene(foundryPage, SCENE_NAME);
    await placeToken(foundryPage, PRIMARY_NAME, 300, 300);
    await foundryPage.waitForTimeout(1000);

    const hasSwitchBtn = await foundryPage.evaluate(async (primaryName) => {
      const token = canvas.tokens.placeables.find(t => t.name === primaryName);
      if (!token) throw new Error('Token not found');
      token.control({ releaseOthers: true });
      canvas.hud.token.bind(token);
      await new Promise(r => setTimeout(r, 500));
      const btn = canvas.hud.token.element?.querySelector('.fa-exchange-alt');
      return !!btn;
    }, PRIMARY_NAME);

    expect(hasSwitchBtn).toBe(false);
    await enableAlternateForms(foundryPage);
  });

  test('involuntary trigger with resistable Ego check', async ({ foundryPage }) => {
    await linkFormsViaAPI(foundryPage, PRIMARY_NAME, ALTERNATE_NAME, 'powerDown', [
      { description: 'Anger', resistable: true, tn: 11 },
    ]);
    const formData = await getAlternateFormData(foundryPage, PRIMARY_NAME);
    expect(formData.alternateForms[0].triggers).toHaveLength(1);
    expect(formData.alternateForms[0].triggers[0].description).toBe('Anger');
    expect(formData.alternateForms[0].triggers[0].resistable).toBe(true);
    expect(formData.alternateForms[0].triggers[0].tn).toBe(11);
  });
});
