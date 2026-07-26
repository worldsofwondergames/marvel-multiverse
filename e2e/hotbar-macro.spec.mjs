import { test, expect } from './fixtures.mjs';
import { createActorViaAPI, deleteActor } from './helpers.mjs';

const ACTOR_NAME = 'E2E Hotbar Test';
const SLOT = 9;

/**
 * Regression coverage for #94.
 *
 * Dropping an owned item on the hotbar should create a roll macro that calls
 * game.MarvelMultiverse.rollItemMacro(). Two defects prevented that:
 *
 *   1. createItemMacro()'s guard was `data.type !== "Item" || data.type !== "Weapon"`,
 *      which is always true, so the function always returned immediately.
 *   2. The hotbarDrop hook passed an async function, so it returned a Promise.
 *      Core checks `Hooks.call(...) === false` to suppress its default, so core
 *      also built a sheet-toggle macro and assigned it to the same slot.
 */
test.describe('Hotbar item macros', () => {

  test.afterEach(async ({ foundryPage }) => {
    await foundryPage.evaluate(async (slot) => {
      await game.user.assignHotbarMacro(null, slot);
      const junk = game.macros.filter(m => m.name?.startsWith('E2E Hotbar'));
      if (junk.length) await Macro.deleteDocuments(junk.map(m => m.id));
    }, SLOT);
    await deleteActor(foundryPage, ACTOR_NAME);
  });

  test('dropping an owned item creates a roll macro in the slot', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME, 'character');

    const result = await page.evaluate(async ({ name, slot }) => {
      const actor = game.actors.find(a => a.name === name);
      const [item] = await actor.createEmbeddedDocuments('Item', [
        { name: 'E2E Hotbar Weapon', type: 'weapon' },
      ]);

      const data = { type: 'Item', uuid: item.uuid };

      // Core suppresses its own default only on a strict `false`.
      const hookReturn = Hooks.call('hotbarDrop', ui.hotbar, data, slot);

      // createItemMacro is async and fire-and-forget; give it time to land.
      await new Promise(r => setTimeout(r, 1500));

      const assigned = game.user.getHotbarMacros().find(m => m.slot === Number(slot));
      const macro = assigned?.macro ?? null;

      return {
        hookReturn,
        hasMacro: !!macro,
        macroName: macro?.name ?? null,
        command: macro?.command ?? null,
      };
    }, { name: ACTOR_NAME, slot: SLOT });

    // The hook must synchronously say "handled", or core overwrites the slot.
    expect(result.hookReturn).toBe(false);

    expect(result.hasMacro).toBe(true);
    expect(result.macroName).toBe('E2E Hotbar Weapon');
    // Must be the system's roll macro, not core's sheet-toggle macro.
    expect(result.command).toContain('game.MarvelMultiverse.rollItemMacro');
  });

  // The fix added an early return for non-Item drops. Confirm that still hands
  // off to core rather than silently swallowing the drop.
  test('non-Item drops are left to core', async ({ foundryPage }) => {
    const hookReturn = await foundryPage.evaluate((slot) => {
      const data = { type: 'Macro', uuid: 'Macro.doesnotexist' };
      return Hooks.call('hotbarDrop', ui.hotbar, data, slot);
    }, SLOT);

    // Anything other than a strict `false` lets core proceed with its default.
    expect(hookReturn).not.toBe(false);
  });
});
