import { test, expect } from './fixtures.mjs';
import { createActorViaAPI, updateActorData, deleteActor } from './helpers.mjs';

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

  // Regression coverage for #96. Ability scores and Non-Combat Checks are not
  // embedded documents, so they were never drag sources and hotbarDrop had no
  // branch for them. This first test covers the drag source: without it the
  // drop never happens at all, which is what the bug looked like in play.
  test('ability and non-combat check elements are drag sources', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME, 'character');

    const result = await page.evaluate(async (name) => {
      const actor = game.actors.find(a => a.name === name);
      await actor.sheet.render(true);
      await new Promise(r => setTimeout(r, 800));

      const el = actor.sheet.element instanceof HTMLElement
        ? actor.sheet.element
        : actor.sheet.element?.[0] ?? null;
      if (!el) return { error: 'sheet did not render' };

      const abilities = [...el.querySelectorAll('[data-roll-type="ability"]')];
      const noncoms = [...el.querySelectorAll('[data-roll-type="noncom"]')];

      // Fire a real dragstart and read back what the handler wrote.
      let payload = null;
      const dt = new DataTransfer();
      abilities[0]?.dispatchEvent(
        new DragEvent('dragstart', { dataTransfer: dt, bubbles: true })
      );
      try {
        payload = JSON.parse(dt.getData('text/plain'));
      } catch {
        /* handler set nothing */
      }

      const out = {
        abilityCount: abilities.length,
        noncomCount: noncoms.length,
        allDraggable: [...abilities, ...noncoms].every(
          n => n.getAttribute('draggable') === 'true'
        ),
        payload,
        actorUuid: actor.uuid,
      };
      await actor.sheet.close();
      return out;
    }, ACTOR_NAME);

    expect(result.error).toBeUndefined();
    expect(result.abilityCount).toBe(6);
    expect(result.noncomCount).toBe(6);
    expect(result.allDraggable).toBe(true);

    expect(result.payload).not.toBeNull();
    expect(result.payload.type).toBe('MarvelMultiverseCheck');
    expect(result.payload.actorUuid).toBe(result.actorUuid);
    expect(result.payload.rollType).toBe('ability');
    expect(['mle', 'agl', 'res', 'vig', 'ego', 'log']).toContain(result.payload.abilityKey);
  });

  for (const { rollType, suffix } of [
    { rollType: 'ability', suffix: '' },
    { rollType: 'noncom', suffix: ' (Non-Combat)' },
  ]) {
    test(`dropping a ${rollType} check creates a roll macro in the slot`, async ({ foundryPage }) => {
      const page = foundryPage;
      await createActorViaAPI(page, ACTOR_NAME, 'character');

      const result = await page.evaluate(async ({ name, slot, rollType }) => {
        const actor = game.actors.find(a => a.name === name);

        const data = {
          type: 'MarvelMultiverseCheck',
          actorUuid: actor.uuid,
          rollType,
          abilityKey: 'mle',
        };

        const hookReturn = Hooks.call('hotbarDrop', ui.hotbar, data, slot);
        await new Promise(r => setTimeout(r, 1500));

        const assigned = game.user.getHotbarMacros().find(m => m.slot === Number(slot));
        const macro = assigned?.macro ?? null;

        return {
          hookReturn,
          hasMacro: !!macro,
          macroName: macro?.name ?? null,
          command: macro?.command ?? null,
        };
      }, { name: ACTOR_NAME, slot: SLOT, rollType });

      expect(result.hookReturn).toBe(false);
      expect(result.hasMacro).toBe(true);
      expect(result.macroName).toBe(`${ACTOR_NAME}: Melee${suffix}`);
      expect(result.command).toContain('game.MarvelMultiverse.rollCheckMacro');
    });
  }

  // The two checks read different fields of the same ability, so each macro
  // has to roll the one it was created from. Give the fields distinct values:
  // stored noncom is a bonus, and prepareDerivedData adds value on top of it.
  test('ability and non-combat macros roll their own field', async ({ foundryPage }) => {
    const page = foundryPage;
    await createActorViaAPI(page, ACTOR_NAME, 'character');
    await updateActorData(page, ACTOR_NAME, {
      'system.abilities.mle.value': 4,
      'system.abilities.mle.noncom': 3,
    });

    const result = await page.evaluate(async (name) => {
      const actor = game.actors.find(a => a.name === name);
      const before = game.messages.size;

      const ability = await game.MarvelMultiverse.rollCheckMacro(actor.uuid, 'mle', false);
      const noncom = await game.MarvelMultiverse.rollCheckMacro(actor.uuid, 'mle', true);
      await new Promise(r => setTimeout(r, 1000));

      return {
        // The formula is resolved by the time it can be read, so compare it
        // against the actor's own derived values.
        abilityFormula: ability?._formula ?? null,
        noncomFormula: noncom?._formula ?? null,
        abilityTotal: ability?.total ?? null,
        noncomTotal: noncom?.total ?? null,
        value: actor.system.abilities.mle.value,
        noncomValue: actor.system.abilities.mle.noncom,
        newMessages: game.messages.size - before,
      };
    }, ACTOR_NAME);

    // Guards the premise: if these ever matched, the assertions below would
    // pass no matter which field the macro read.
    expect(result.value).toBe(4);
    expect(result.noncomValue).toBe(7);

    expect(result.abilityFormula).toBe(`{1d6,1dm,1d6} + ${result.value}`);
    expect(result.noncomFormula).toBe(`{1d6,1dm,1d6} + ${result.noncomValue}`);
    expect(typeof result.abilityTotal).toBe('number');
    expect(typeof result.noncomTotal).toBe('number');
    // The macro must post to chat, same as clicking the sheet.
    expect(result.newMessages).toBeGreaterThan(0);
  });

  test('a missing actor does not throw', async ({ foundryPage }) => {
    const result = await foundryPage.evaluate(async () => {
      try {
        await game.MarvelMultiverse.rollCheckMacro('Actor.doesnotexist', 'mle', false);
        return 'ok';
      } catch (err) {
        return `${err.name}: ${err.message}`;
      }
    });
    expect(result).toBe('ok');
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
