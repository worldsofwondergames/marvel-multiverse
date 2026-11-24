import { test, expect } from './fixtures.mjs';
import { createActorViaAPI, deleteActor, getActorSystemData } from './helpers.mjs';

const ACTOR_NAME = 'E2E Effects Tab Test';
// Bonuses to one ability do not stack, so each effect feeds a different one.
const ACTOR_CHANGE = { key: 'system.abilities.mle.damageMultiplier', mode: 2, value: '1' };
const ITEM_CHANGE = { key: 'system.abilities.agl.damageMultiplier', mode: 2, value: '1' };

/**
 * Create a rank 3 character with one effect of its own and one effect owned
 * by a power, then open its sheet on the Effects tab.
 */
async function setup(page) {
  await createActorViaAPI(page, ACTOR_NAME);
  const ids = await page.evaluate(async ({ name, actorChange, itemChange }) => {
    const actor = game.actors.find(a => a.name === name);
    await actor.update({ 'system.attributes.rank.value': 3 });
    const [actorEffect] = await actor.createEmbeddedDocuments('ActiveEffect', [
      { name: 'Actor Effect', changes: [actorChange] },
    ]);
    const [item] = await actor.createEmbeddedDocuments('Item', [{
      name: 'Effect Power',
      type: 'power',
      effects: [{ name: 'Item Effect', transfer: true, changes: [itemChange] }],
    }]);
    await actor.sheet.render(true);
    return {
      actorId: actor.id,
      actorEffectId: actorEffect.id,
      itemId: item.id,
      itemEffectId: item.effects.contents[0].id,
    };
  }, { name: ACTOR_NAME, actorChange: ACTOR_CHANGE, itemChange: ITEM_CHANGE });

  const sheet = page.locator('.sheet.actor').last();
  await sheet.locator('.sheet-tabs a[data-tab="effects"]').click();
  return { sheet, ...ids };
}

function effectRow(sheet, effectId) {
  return sheet.locator(`.tab[data-tab="effects"] li.effect[data-effect-id="${effectId}"]`);
}

function actorEffectDisabled(page, effectId) {
  return page.evaluate(({ name, effectId }) =>
    game.actors.find(a => a.name === name).effects.get(effectId).disabled,
  { name: ACTOR_NAME, effectId });
}

function itemEffectDisabled(page, itemId, effectId) {
  return page.evaluate(({ name, itemId, effectId }) =>
    game.actors.find(a => a.name === name).items.get(itemId).effects.get(effectId).disabled,
  { name: ACTOR_NAME, itemId, effectId });
}

test.describe('Actor sheet Effects tab', () => {

  test.afterEach(async ({ foundryPage }) => {
    await deleteActor(foundryPage, ACTOR_NAME);
  });

  test('toggling an actor effect disables it and removes its bonus', async ({ foundryPage: page }) => {
    const { sheet, actorEffectId } = await setup(page);

    // Rank 3, plus 1 from the effect.
    expect((await getActorSystemData(page, ACTOR_NAME)).abilities.mle.damageMultiplier).toBe(4);

    await effectRow(sheet, actorEffectId).locator('[data-action="toggle"]').click();

    await expect.poll(() => actorEffectDisabled(page, actorEffectId)).toBe(true);
    expect((await getActorSystemData(page, ACTOR_NAME)).abilities.mle.damageMultiplier).toBe(3);
  });

  test('toggling an item-owned effect updates the effect on the item', async ({ foundryPage: page }) => {
    const { sheet, itemId, itemEffectId } = await setup(page);

    expect((await getActorSystemData(page, ACTOR_NAME)).abilities.agl.damageMultiplier).toBe(4);

    await effectRow(sheet, itemEffectId).locator('[data-action="toggle"]').click();

    await expect.poll(() => itemEffectDisabled(page, itemId, itemEffectId)).toBe(true);
    expect((await getActorSystemData(page, ACTOR_NAME)).abilities.agl.damageMultiplier).toBe(3);
  });

  test('the toggle icon follows the effect state across a re-render', async ({ foundryPage: page }) => {
    const { sheet, actorEffectId } = await setup(page);
    const icon = effectRow(sheet, actorEffectId).locator('[data-action="toggle"] i');

    await expect(icon).toHaveClass(/fa-toggle-on/);

    await icon.click();
    await expect.poll(() => actorEffectDisabled(page, actorEffectId)).toBe(true);
    await page.evaluate(async (name) => {
      const actor = game.actors.find(a => a.name === name);
      await actor.sheet.close();
      await actor.sheet.render(true);
    }, ACTOR_NAME);
    await sheet.locator('.sheet-tabs a[data-tab="effects"]').click();

    await expect(icon).toHaveClass(/fa-toggle-off/);
  });

  test('an item-owned effect shows its item as the source', async ({ foundryPage: page }) => {
    const { sheet, itemId, itemEffectId } = await setup(page);
    const itemName = await page.evaluate(({ name, itemId }) =>
      game.actors.find(a => a.name === name).items.get(itemId).name,
    { name: ACTOR_NAME, itemId });

    await expect(effectRow(sheet, itemEffectId).locator('.effect-source')).toHaveText(itemName);
  });

  test('only an effect owned by the actor can be deleted from the tab', async ({ foundryPage: page }) => {
    const { sheet, actorEffectId, itemEffectId } = await setup(page);

    await expect(effectRow(sheet, actorEffectId).locator('[data-action="delete"]')).toHaveCount(1);
    await expect(effectRow(sheet, itemEffectId).locator('[data-action="toggle"]')).toHaveCount(1);
    await expect(effectRow(sheet, itemEffectId).locator('[data-action="delete"]')).toHaveCount(0);
  });
});
