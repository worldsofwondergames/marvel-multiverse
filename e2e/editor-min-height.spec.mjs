import { test, expect } from './fixtures.mjs';
import { evaluateWhenReady, dismissNotifications, deleteActor } from './helpers.mjs';

/**
 * `.mm-styled-input > .editor > .editor-content` is what a ProseMirror field
 * renders while it is not being edited. It had no height floor, so an empty
 * Profile or Notes field collapsed to nothing and was barely clickable. The
 * `.editor-container` floor already in the stylesheet only exists while the
 * editor is active, which is the wrong half of the problem.
 *
 * Every assertion here reads a rendered box or a computed style, because the
 * cascade is the only thing under test.
 */

const VEHICLE = 'E2E Editor Height Vehicle';
const HERO = 'E2E Editor Height Hero';

const MIN_HEIGHT = 33;

/** Open a sheet, activate one of its tabs, and let layout settle. */
async function openOnTab(page, name, tab) {
  await evaluateWhenReady(page, async ({ name, tab }) => {
    const actor = game.actors.find(a => a.name === name);
    await actor.sheet._render(true);
    actor.sheet._tabs?.[0]?.activate(tab);
  }, { name, tab });
  await page.waitForTimeout(800);
}

/**
 * Rendered height and computed min-height of every editor body matching
 * `selector` inside the named actor's open sheet.
 */
async function editorBodies(page, name, selector) {
  return evaluateWhenReady(page, ({ name, selector }) => {
    const app = Object.values(ui.windows).find(w => w.actor?.name === name);
    const root = app?.element?.[0] ?? app?.element;
    return [...root.querySelectorAll(selector)].map(el => ({
      height: el.getBoundingClientRect().height,
      minHeight: getComputedStyle(el).minHeight,
    }));
  }, { name, selector });
}

const STYLED = '.mm-styled-input > .editor > .editor-content';

test.describe('Rich text field minimum height', () => {
  test.beforeEach(async ({ foundryPage }) => {
    await dismissNotifications(foundryPage);
    await evaluateWhenReady(foundryPage, async ({ vehicle, hero }) => {
      for (const name of [vehicle, hero]) {
        const stale = game.actors.filter(a => a.name === name);
        if (stale.length) await Actor.deleteDocuments(stale.map(a => a.id));
      }
      await Actor.create({ name: vehicle, type: 'vehicle' });
      await Actor.create({ name: hero, type: 'character' });
    }, { vehicle: VEHICLE, hero: HERO });
  });

  test.afterEach(async ({ foundryPage }) => {
    await evaluateWhenReady(foundryPage, ({ vehicle, hero }) => {
      for (const name of [vehicle, hero]) {
        Object.values(ui.windows).find(w => w.actor?.name === name)?.close();
      }
    }, { vehicle: VEHICLE, hero: HERO });
    await deleteActor(foundryPage, VEHICLE);
    await deleteActor(foundryPage, HERO);
  });

  test('an empty field on the vehicle sheet is at least the minimum tall', async ({ foundryPage }) => {
    await openOnTab(foundryPage, VEHICLE, 'profile');

    const bodies = await editorBodies(foundryPage, VEHICLE, STYLED);
    expect(bodies.length).toBeGreaterThan(0);
    for (const body of bodies) {
      expect(body.minHeight).toBe(`${MIN_HEIGHT}px`);
      // Foundry scales the interface, so the painted box lands a fraction of a
      // pixel under the declared minimum. Round before comparing.
      expect(Math.round(body.height)).toBeGreaterThanOrEqual(MIN_HEIGHT);
    }
  });

  test('a field taller than the minimum keeps its own height', async ({ foundryPage }) => {
    await evaluateWhenReady(foundryPage, async (name) => {
      const actor = game.actors.find(a => a.name === name);
      await actor.update({
        'system.profile': Array.from({ length: 8 }, (_, i) =>
          `<p>Line ${i} of a profile long enough to push the field past its floor.</p>`).join(''),
      });
    }, VEHICLE);
    await openOnTab(foundryPage, VEHICLE, 'profile');

    const bodies = await editorBodies(foundryPage, VEHICLE, STYLED);
    expect(bodies.length).toBeGreaterThan(0);
    const tallest = Math.max(...bodies.map(b => b.height));
    expect(tallest).toBeGreaterThan(MIN_HEIGHT);
  });

  test('the floor does not reach .mm-input editors on the character sheet', async ({ foundryPage }) => {
    await openOnTab(foundryPage, HERO, 'biography');

    const styled = await editorBodies(foundryPage, HERO, STYLED);
    expect(styled).toHaveLength(0);

    const plain = await editorBodies(foundryPage, HERO, '.mm-input > .editor > .editor-content');
    expect(plain.length).toBeGreaterThan(0);
    for (const body of plain) {
      expect(body.minHeight).not.toBe(`${MIN_HEIGHT}px`);
    }
  });
});
