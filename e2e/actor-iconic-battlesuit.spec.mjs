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

test.describe('Iconic Items on Actor Sheet', () => {
  test.beforeEach(async ({ page }) => {
    await cleanup(page);
    await createActorViaAPI(page, ACTOR_NAME, 'character');
  });

  test.afterEach(async ({ page }) => {
    await cleanup(page);
  });

  test('iconic item shows on gear tab with power value', async ({ page }) => {
    await createIconicItemOnActor(page, ACTOR_NAME, ICONIC_ITEM_NAME, {
      powers: [
        { name: 'Shield Throw', description: 'Throw shield' },
        { name: 'Deflect', description: 'Deflect attacks' },
      ],
    });
    const sheet = await openActorSheet(page, ACTOR_NAME);
    await goToGearTab(sheet);

    const itemRow = sheet.locator('.mm-actor-iconic-item');
    await expect(itemRow).toHaveCount(1);
    await expect(itemRow.locator('.mm-item-name')).toContainText(ICONIC_ITEM_NAME);
    await expect(itemRow.locator('.mm-pv-badge')).toContainText('PV 2');
  });

  test('iconic item shows powers list', async ({ page }) => {
    await createIconicItemOnActor(page, ACTOR_NAME, ICONIC_ITEM_NAME, {
      powers: [
        { name: 'Shield Throw', description: '' },
        { name: 'Deflect', description: '' },
      ],
    });
    const sheet = await openActorSheet(page, ACTOR_NAME);
    await goToGearTab(sheet);

    const subtext = sheet.locator('.mm-actor-iconic-item .mm-item-subtext');
    await expect(subtext).toContainText('Shield Throw');
    await expect(subtext).toContainText('Deflect');
  });

  test('ownership toggle defaults to owned', async ({ page }) => {
    await createIconicItemOnActor(page, ACTOR_NAME, ICONIC_ITEM_NAME);
    const sheet = await openActorSheet(page, ACTOR_NAME);
    await goToGearTab(sheet);

    const select = sheet.locator('.iconic-ownership-toggle');
    await expect(select).toHaveValue('owned');
  });

  test('ownership toggle can be changed to borrowed', async ({ page }) => {
    await createIconicItemOnActor(page, ACTOR_NAME, ICONIC_ITEM_NAME);
    const sheet = await openActorSheet(page, ACTOR_NAME);
    await goToGearTab(sheet);

    const select = sheet.locator('.iconic-ownership-toggle');
    await select.selectOption('borrowed');
    await page.waitForTimeout(1000);

    const mode = await page.evaluate((actorName) => {
      const actor = game.actors.find(a => a.name === actorName);
      const item = actor.items.find(i => i.type === 'iconicItem');
      return item.system.ownershipMode;
    }, ACTOR_NAME);
    expect(mode).toBe('borrowed');
  });
});

test.describe('Battle Suits on Actor Sheet', () => {
  test.beforeEach(async ({ page }) => {
    await cleanup(page);
    await createActorViaAPI(page, ACTOR_NAME, 'character');
  });

  test.afterEach(async ({ page }) => {
    await cleanup(page);
  });

  test('battle suit shows on gear tab with power value and modifiers', async ({ page }) => {
    await createBattleSuitOnActor(page, ACTOR_NAME, BATTLE_SUIT_NAME, {
      abilityModifiers: { melee: 2, agility: 0, resilience: 3, vigilance: 0, ego: 0, logic: 0 },
      rankIncrease: 1,
      powers: [{ name: 'Flight', description: '' }, { name: 'Repulsors', description: '' }],
    });
    const sheet = await openActorSheet(page, ACTOR_NAME);
    await goToGearTab(sheet);

    const suitRow = sheet.locator('.mm-actor-battlesuit');
    await expect(suitRow).toHaveCount(1);
    await expect(suitRow.locator('.mm-item-name')).toContainText(BATTLE_SUIT_NAME);
    await expect(suitRow.locator('.mm-pv-badge')).toContainText('PV 2');
    await expect(suitRow.locator('.mm-item-subtext')).toContainText('Mel +2');
    await expect(suitRow.locator('.mm-item-subtext')).toContainText('Res +3');
    await expect(suitRow.locator('.mm-item-subtext')).toContainText('Rank +1');
  });

  test('equip toggle applies active effects', async ({ page }) => {
    await createBattleSuitOnActor(page, ACTOR_NAME, BATTLE_SUIT_NAME, {
      abilityModifiers: { melee: 2, agility: 0, resilience: 0, vigilance: 0, ego: 0, logic: 0 },
      rankIncrease: 1,
    });
    const sheet = await openActorSheet(page, ACTOR_NAME);
    await goToGearTab(sheet);

    const dataBefore = await getActorSystemData(page, ACTOR_NAME);
    const baseMelee = dataBefore.abilities.mle.value;
    const baseRank = dataBefore.attributes.rank.value;

    await sheet.locator('.battlesuit-equip-toggle').click();
    await page.waitForTimeout(1500);

    const dataAfter = await getActorSystemData(page, ACTOR_NAME);
    expect(dataAfter.abilities.mle.value).toBe(baseMelee + 2);
    expect(dataAfter.attributes.rank.value).toBe(baseRank + 1);

    const effects = await getActiveEffectNames(page, ACTOR_NAME);
    expect(effects).toContain(`Battle Suit: ${BATTLE_SUIT_NAME}`);
  });

  test('unequip toggle removes active effects', async ({ page }) => {
    await createBattleSuitOnActor(page, ACTOR_NAME, BATTLE_SUIT_NAME, {
      abilityModifiers: { melee: 2, agility: 0, resilience: 0, vigilance: 0, ego: 0, logic: 0 },
    });
    const sheet = await openActorSheet(page, ACTOR_NAME);
    await goToGearTab(sheet);

    await sheet.locator('.battlesuit-equip-toggle').click();
    await page.waitForTimeout(1500);

    const effectsBefore = await getActiveEffectNames(page, ACTOR_NAME);
    expect(effectsBefore).toContain(`Battle Suit: ${BATTLE_SUIT_NAME}`);

    await sheet.locator('.battlesuit-equip-toggle').click();
    await page.waitForTimeout(1500);

    const effectsAfter = await getActiveEffectNames(page, ACTOR_NAME);
    expect(effectsAfter).not.toContain(`Battle Suit: ${BATTLE_SUIT_NAME}`);
  });

  test('only one battle suit can be equipped at a time', async ({ page }) => {
    await createBattleSuitOnActor(page, ACTOR_NAME, BATTLE_SUIT_NAME, {
      abilityModifiers: { melee: 2, agility: 0, resilience: 0, vigilance: 0, ego: 0, logic: 0 },
    });
    await createBattleSuitOnActor(page, ACTOR_NAME, BATTLE_SUIT_2_NAME, {
      abilityModifiers: { melee: 0, agility: 3, resilience: 0, vigilance: 0, ego: 0, logic: 0 },
    });
    const sheet = await openActorSheet(page, ACTOR_NAME);
    await goToGearTab(sheet);

    const suitRows = sheet.locator('.mm-actor-battlesuit');
    await expect(suitRows).toHaveCount(2);

    await suitRows.first().locator('.battlesuit-equip-toggle').click();
    await page.waitForTimeout(1500);

    let effects = await getActiveEffectNames(page, ACTOR_NAME);
    expect(effects).toContain(`Battle Suit: ${BATTLE_SUIT_NAME}`);

    await suitRows.last().locator('.battlesuit-equip-toggle').click();
    await page.waitForTimeout(1500);

    effects = await getActiveEffectNames(page, ACTOR_NAME);
    expect(effects).not.toContain(`Battle Suit: ${BATTLE_SUIT_NAME}`);
    expect(effects).toContain(`Battle Suit: ${BATTLE_SUIT_2_NAME}`);

    const equipped = await page.evaluate((actorName) => {
      const actor = game.actors.find(a => a.name === actorName);
      return actor.items.filter(i => i.type === 'battleSuit' && i.system.equipped).map(i => i.name);
    }, ACTOR_NAME);
    expect(equipped).toHaveLength(1);
    expect(equipped[0]).toBe(BATTLE_SUIT_2_NAME);
  });

  test('equipped suit has visual indicator', async ({ page }) => {
    await createBattleSuitOnActor(page, ACTOR_NAME, BATTLE_SUIT_NAME, {
      equipped: true,
      abilityModifiers: { melee: 0, agility: 0, resilience: 0, vigilance: 0, ego: 0, logic: 0 },
    });
    const sheet = await openActorSheet(page, ACTOR_NAME);
    await goToGearTab(sheet);

    const suitRow = sheet.locator('.mm-actor-battlesuit');
    await expect(suitRow).toHaveClass(/mm-equipped/);
    await expect(suitRow.locator('.battlesuit-equip-toggle i')).toHaveClass(/fa-toggle-on/);
  });

  test('deleting an equipped suit removes its active effects', async ({ page }) => {
    await createBattleSuitOnActor(page, ACTOR_NAME, BATTLE_SUIT_NAME, {
      abilityModifiers: { melee: 2, agility: 0, resilience: 0, vigilance: 0, ego: 0, logic: 0 },
    });
    const sheet = await openActorSheet(page, ACTOR_NAME);
    await goToGearTab(sheet);

    await sheet.locator('.battlesuit-equip-toggle').click();
    await page.waitForTimeout(1500);

    let effects = await getActiveEffectNames(page, ACTOR_NAME);
    expect(effects).toContain(`Battle Suit: ${BATTLE_SUIT_NAME}`);

    await sheet.locator('.mm-actor-battlesuit .item-delete').click();
    await page.waitForTimeout(1500);

    effects = await getActiveEffectNames(page, ACTOR_NAME);
    expect(effects).not.toContain(`Battle Suit: ${BATTLE_SUIT_NAME}`);
  });
});
