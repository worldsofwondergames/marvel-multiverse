import { test, expect } from './fixtures.mjs';
import {
  dismissNotifications,
  createActorViaAPI,
  deleteActor,
  getActorSystemData,
  getActiveEffectNames,
} from './helpers.mjs';

const ACTOR_NAME = 'E2E Actor Iconic BS Test';
const ICONIC_ITEM_NAME = 'E2E Shield of Test';
const BATTLE_SUIT_NAME = 'E2E Iron Test Suit';
const BATTLE_SUIT_2_NAME = 'E2E War Test Suit';

async function cleanup(page) {
  await page.evaluate(async (names) => {
    for (const name of names) {
      const actor = game.actors.find(a => a.name === name);
      if (actor) await actor.delete();
    }
  }, [ACTOR_NAME]);
  await page.waitForTimeout(500);
}

async function createIconicItemOnActor(page, actorName, itemName, opts = {}) {
  await page.evaluate(async ({ actorName, itemName, opts }) => {
    const actor = game.actors.find(a => a.name === actorName);
    if (!actor) throw new Error(`Actor "${actorName}" not found`);
    await actor.createEmbeddedDocuments('Item', [{
      name: itemName,
      type: 'iconicItem',
      system: {
        ownershipMode: opts.ownershipMode || 'owned',
        powers: opts.powers || [],
        restrictions: opts.restrictions || [],
      },
    }]);
  }, { actorName, itemName, opts });
  await page.waitForTimeout(500);
}

async function createBattleSuitOnActor(page, actorName, suitName, opts = {}) {
  await page.evaluate(async ({ actorName, suitName, opts }) => {
    const actor = game.actors.find(a => a.name === actorName);
    if (!actor) throw new Error(`Actor "${actorName}" not found`);
    await actor.createEmbeddedDocuments('Item', [{
      name: suitName,
      type: 'battleSuit',
      system: {
        equipped: opts.equipped || false,
        abilityModifiers: opts.abilityModifiers || {
          melee: 0, agility: 0, resilience: 0, vigilance: 0, ego: 0, logic: 0,
        },
        rankIncrease: opts.rankIncrease || 0,
        powers: opts.powers || [],
        restrictions: opts.restrictions || [],
        additionalTraits: opts.additionalTraits || [],
      },
    }]);
  }, { actorName, suitName, opts });
  await page.waitForTimeout(500);
}

async function openActorSheet(page, actorName) {
  await page.evaluate(async (name) => {
    const actor = game.actors.find(a => a.name === name);
    if (!actor) throw new Error(`Actor "${name}" not found`);
    actor.sheet.render(true);
  }, actorName);
  await page.waitForTimeout(2000);
  await dismissNotifications(page);
  return page.locator('.sheet.actor').last();
}

async function goToGearTab(sheet) {
  await sheet.locator('.sheet-tabs a[data-tab="gear"]').click();
  await sheet.page().waitForTimeout(500);
}

async function clickEquipToggle(page, sheet, selector = '.battlesuit-equip-toggle') {
  const toggle = sheet.locator(selector);
  const itemId = await toggle.getAttribute('data-item-id');
  await page.evaluate((id) => {
    document.querySelector(`.battlesuit-equip-toggle[data-item-id="${id}"]`).click();
  }, itemId);
  await page.waitForTimeout(1500);
}

test.describe('Iconic Items on Actor Sheet', () => {
  test.beforeEach(async ({ foundryPage }) => {
    await cleanup(foundryPage);
    await createActorViaAPI(foundryPage, ACTOR_NAME, 'character');
  });

  test.afterEach(async ({ foundryPage }) => {
    await cleanup(foundryPage);
  });

  test('iconic item shows on gear tab with power value', async ({ foundryPage }) => {
    await createIconicItemOnActor(foundryPage, ACTOR_NAME, ICONIC_ITEM_NAME, {
      powers: [
        { name: 'Shield Throw', description: 'Throw shield' },
        { name: 'Deflect', description: 'Deflect attacks' },
      ],
    });
    const sheet = await openActorSheet(foundryPage, ACTOR_NAME);
    await goToGearTab(sheet);

    const itemRow = sheet.locator('.mm-actor-iconic-item');
    await expect(itemRow).toHaveCount(1);
    await expect(itemRow.locator('.mm-item-name')).toContainText(ICONIC_ITEM_NAME);
    await expect(itemRow.locator('.mm-pv-badge')).toContainText('PV 2');
  });

  test('iconic item shows powers list', async ({ foundryPage }) => {
    await createIconicItemOnActor(foundryPage, ACTOR_NAME, ICONIC_ITEM_NAME, {
      powers: [
        { name: 'Shield Throw', description: '' },
        { name: 'Deflect', description: '' },
      ],
    });
    const sheet = await openActorSheet(foundryPage, ACTOR_NAME);
    await goToGearTab(sheet);

    const subtext = sheet.locator('.mm-actor-iconic-item .mm-item-subtext');
    await expect(subtext).toContainText('Shield Throw');
    await expect(subtext).toContainText('Deflect');
  });

  test('ownership toggle defaults to owned', async ({ foundryPage }) => {
    await createIconicItemOnActor(foundryPage, ACTOR_NAME, ICONIC_ITEM_NAME);
    const sheet = await openActorSheet(foundryPage, ACTOR_NAME);
    await goToGearTab(sheet);

    const select = sheet.locator('.iconic-ownership-toggle');
    await expect(select).toHaveValue('owned');
  });

  test('ownership toggle can be changed to borrowed', async ({ foundryPage }) => {
    await createIconicItemOnActor(foundryPage, ACTOR_NAME, ICONIC_ITEM_NAME);
    const sheet = await openActorSheet(foundryPage, ACTOR_NAME);
    await goToGearTab(sheet);

    const select = sheet.locator('.iconic-ownership-toggle');
    await select.selectOption('borrowed');
    await foundryPage.waitForTimeout(1000);

    const mode = await foundryPage.evaluate((actorName) => {
      const actor = game.actors.find(a => a.name === actorName);
      const item = actor.items.find(i => i.type === 'iconicItem');
      return item.system.ownershipMode;
    }, ACTOR_NAME);
    expect(mode).toBe('borrowed');
  });
});

test.describe('Battle Suits on Actor Sheet', () => {
  test.beforeEach(async ({ foundryPage }) => {
    await cleanup(foundryPage);
    await createActorViaAPI(foundryPage, ACTOR_NAME, 'character');
  });

  test.afterEach(async ({ foundryPage }) => {
    await cleanup(foundryPage);
  });

  test('battle suit shows on gear tab with power value and modifiers', async ({ foundryPage }) => {
    await createBattleSuitOnActor(foundryPage, ACTOR_NAME, BATTLE_SUIT_NAME, {
      abilityModifiers: { melee: 2, agility: 0, resilience: 3, vigilance: 0, ego: 0, logic: 0 },
      rankIncrease: 1,
      powers: [{ name: 'Flight', description: '' }, { name: 'Repulsors', description: '' }],
    });
    const sheet = await openActorSheet(foundryPage, ACTOR_NAME);
    await goToGearTab(sheet);

    const suitRow = sheet.locator('.mm-actor-battlesuit');
    await expect(suitRow).toHaveCount(1);
    await expect(suitRow.locator('.mm-item-name')).toContainText(BATTLE_SUIT_NAME);
    await expect(suitRow.locator('.mm-pv-badge')).toContainText('PV 2');
    await expect(suitRow.locator('.mm-item-subtext')).toContainText('Mel +2');
    await expect(suitRow.locator('.mm-item-subtext')).toContainText('Res +3');
    await expect(suitRow.locator('.mm-item-subtext')).toContainText('Rank +1');
  });

  test('equip toggle applies active effects', async ({ foundryPage }) => {
    await createBattleSuitOnActor(foundryPage, ACTOR_NAME, BATTLE_SUIT_NAME, {
      abilityModifiers: { melee: 2, agility: 0, resilience: 0, vigilance: 0, ego: 0, logic: 0 },
      rankIncrease: 1,
    });
    const sheet = await openActorSheet(foundryPage, ACTOR_NAME);
    await goToGearTab(sheet);

    const dataBefore = await getActorSystemData(foundryPage, ACTOR_NAME);
    const baseMelee = dataBefore.abilities.mle.value;
    const baseRank = dataBefore.attributes.rank.value;

    await clickEquipToggle(foundryPage, sheet);

    const dataAfter = await getActorSystemData(foundryPage, ACTOR_NAME);
    expect(dataAfter.abilities.mle.value).toBe(baseMelee + 2);
    expect(dataAfter.attributes.rank.value).toBe(baseRank + 1);

    const effects = await getActiveEffectNames(foundryPage, ACTOR_NAME);
    expect(effects).toContain(`Battle Suit: ${BATTLE_SUIT_NAME}`);
  });

  test('unequip toggle removes active effects', async ({ foundryPage }) => {
    await createBattleSuitOnActor(foundryPage, ACTOR_NAME, BATTLE_SUIT_NAME, {
      abilityModifiers: { melee: 2, agility: 0, resilience: 0, vigilance: 0, ego: 0, logic: 0 },
    });
    const sheet = await openActorSheet(foundryPage, ACTOR_NAME);
    await goToGearTab(sheet);

    await clickEquipToggle(foundryPage, sheet);

    const effectsBefore = await getActiveEffectNames(foundryPage, ACTOR_NAME);
    expect(effectsBefore).toContain(`Battle Suit: ${BATTLE_SUIT_NAME}`);

    await clickEquipToggle(foundryPage, sheet);

    const effectsAfter = await getActiveEffectNames(foundryPage, ACTOR_NAME);
    expect(effectsAfter).not.toContain(`Battle Suit: ${BATTLE_SUIT_NAME}`);
  });

  test('only one battle suit can be equipped at a time', async ({ foundryPage }) => {
    await createBattleSuitOnActor(foundryPage, ACTOR_NAME, BATTLE_SUIT_NAME, {
      abilityModifiers: { melee: 2, agility: 0, resilience: 0, vigilance: 0, ego: 0, logic: 0 },
    });
    await createBattleSuitOnActor(foundryPage, ACTOR_NAME, BATTLE_SUIT_2_NAME, {
      abilityModifiers: { melee: 0, agility: 3, resilience: 0, vigilance: 0, ego: 0, logic: 0 },
    });
    const sheet = await openActorSheet(foundryPage, ACTOR_NAME);
    await goToGearTab(sheet);

    const suitRows = sheet.locator('.mm-actor-battlesuit');
    await expect(suitRows).toHaveCount(2);

    const firstToggle = suitRows.first().locator('.battlesuit-equip-toggle');
    const firstItemId = await firstToggle.getAttribute('data-item-id');
    await foundryPage.evaluate((id) => {
      document.querySelector(`.battlesuit-equip-toggle[data-item-id="${id}"]`).click();
    }, firstItemId);
    await foundryPage.waitForTimeout(1500);

    let effects = await getActiveEffectNames(foundryPage, ACTOR_NAME);
    expect(effects).toContain(`Battle Suit: ${BATTLE_SUIT_NAME}`);

    const lastToggle = suitRows.last().locator('.battlesuit-equip-toggle');
    const lastItemId = await lastToggle.getAttribute('data-item-id');
    await foundryPage.evaluate((id) => {
      document.querySelector(`.battlesuit-equip-toggle[data-item-id="${id}"]`).click();
    }, lastItemId);
    await foundryPage.waitForTimeout(1500);

    effects = await getActiveEffectNames(foundryPage, ACTOR_NAME);
    expect(effects).not.toContain(`Battle Suit: ${BATTLE_SUIT_NAME}`);
    expect(effects).toContain(`Battle Suit: ${BATTLE_SUIT_2_NAME}`);

    const equipped = await foundryPage.evaluate((actorName) => {
      const actor = game.actors.find(a => a.name === actorName);
      return actor.items.filter(i => i.type === 'battleSuit' && i.system.equipped).map(i => i.name);
    }, ACTOR_NAME);
    expect(equipped).toHaveLength(1);
    expect(equipped[0]).toBe(BATTLE_SUIT_2_NAME);
  });

  test('equipped suit has visual indicator', async ({ foundryPage }) => {
    await createBattleSuitOnActor(foundryPage, ACTOR_NAME, BATTLE_SUIT_NAME, {
      equipped: true,
      abilityModifiers: { melee: 0, agility: 0, resilience: 0, vigilance: 0, ego: 0, logic: 0 },
    });
    const sheet = await openActorSheet(foundryPage, ACTOR_NAME);
    await goToGearTab(sheet);

    const suitRow = sheet.locator('.mm-actor-battlesuit');
    await expect(suitRow).toHaveClass(/mm-equipped/);
    await expect(suitRow.locator('.battlesuit-equip-toggle i')).toHaveClass(/fa-toggle-on/);
  });

  test('deleting an equipped suit removes its active effects', async ({ foundryPage }) => {
    await createBattleSuitOnActor(foundryPage, ACTOR_NAME, BATTLE_SUIT_NAME, {
      abilityModifiers: { melee: 2, agility: 0, resilience: 0, vigilance: 0, ego: 0, logic: 0 },
    });
    const sheet = await openActorSheet(foundryPage, ACTOR_NAME);
    await goToGearTab(sheet);

    await clickEquipToggle(foundryPage, sheet);

    let effects = await getActiveEffectNames(foundryPage, ACTOR_NAME);
    expect(effects).toContain(`Battle Suit: ${BATTLE_SUIT_NAME}`);

    const deleteBtn = sheet.locator('.mm-actor-battlesuit .item-delete');
    const deleteItemId = await sheet.locator('.mm-actor-battlesuit').getAttribute('data-item-id');
    await foundryPage.evaluate((id) => {
      document.querySelector(`.mm-actor-battlesuit[data-item-id="${id}"] .item-delete`).click();
    }, deleteItemId);
    await foundryPage.waitForTimeout(1500);

    effects = await getActiveEffectNames(foundryPage, ACTOR_NAME);
    expect(effects).not.toContain(`Battle Suit: ${BATTLE_SUIT_NAME}`);
  });
});

test.describe('Create Item Dialog Labels', () => {
  test('dropdown shows Iconic Item, Restriction, and Battlesuit types', async ({ foundryPage }) => {
    await dismissNotifications(foundryPage);

    await foundryPage.evaluate(() => {
      Object.values(ui.windows).forEach(w => w.close());
    });
    await foundryPage.waitForTimeout(500);

    const itemsTab = foundryPage.locator('#sidebar-tabs button[data-tab="items"]');
    await itemsTab.click({ timeout: 10_000 });
    await foundryPage.waitForTimeout(1000);

    await dismissNotifications(foundryPage);
    const createBtn = foundryPage.locator('#items button.create-entry[data-action="createEntry"]');
    await createBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await createBtn.click();
    await foundryPage.waitForTimeout(2000);

    const typeSelect = foundryPage.locator('dialog select[name="type"]');
    await typeSelect.waitFor({ state: 'attached', timeout: 10_000 });

    const options = await typeSelect.locator('option').allTextContents();
    expect(options).toContain('Iconic Item');
    expect(options).toContain('Restriction');
    expect(options).toContain('Battlesuit');

    await foundryPage.keyboard.press('Escape');
    await foundryPage.waitForTimeout(500);
  });
});
