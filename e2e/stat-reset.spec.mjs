import { test, expect } from './fixtures.mjs';
import { evaluateWhenReady, dismissNotifications, deleteActor } from './helpers.mjs';

/**
 * Reset controls in the Health and Focus blocks. Clicking one restores that
 * track to its maximum, which is derived from an ability score, so the tests
 * compare against the live derived value rather than a fixed number.
 */
const HERO = 'E2E Reset Hero';

/** Build a character whose Health and Focus are below their maxima. */
async function setup(page, { res = 3, vig = 2, health = 20, focus = 15 } = {}) {
  return evaluateWhenReady(page, async ({ hero, res, vig, health, focus }) => {
    const stale = game.actors.filter(a => a.name === hero);
    if (stale.length) await Actor.deleteDocuments(stale.map(a => a.id));
    const actor = await Actor.create({ name: hero, type: 'character' });
    await actor.update({
      'system.abilities.res.value': res,
      'system.abilities.vig.value': vig,
      'system.health.value': health,
      'system.focus.value': focus,
    });
    return {
      health: actor.system.health.value,
      healthMax: actor.system.health.max,
      focus: actor.system.focus.value,
      focusMax: actor.system.focus.max,
    };
  }, { hero: HERO, res, vig, health, focus });
}

/** Click one reset control and report the track before and after. */
async function clickReset(page, which) {
  return evaluateWhenReady(page, async ({ hero, which }) => {
    const actor = game.actors.find(a => a.name === hero);
    const sheet = actor.sheet;
    await sheet._render(true);
    await new Promise(r => setTimeout(r, 500));
    const root = sheet.element?.[0] ?? sheet.element;
    const button = root.querySelector(`.mm-stat-reset[data-reset="${which}"]`);
    const before = { health: actor.system.health.value, focus: actor.system.focus.value };
    if (button) button.click();
    await new Promise(r => setTimeout(r, 600));
    const out = {
      hadButton: !!button,
      before,
      after: { health: actor.system.health.value, focus: actor.system.focus.value },
      max: { health: actor.system.health.max, focus: actor.system.focus.max },
    };
    await sheet.close();
    return out;
  }, { hero: HERO, which });
}

test.describe('Health and Focus reset controls', () => {
  test.beforeEach(async ({ foundryPage }) => {
    await dismissNotifications(foundryPage);
  });

  test.afterEach(async ({ foundryPage }) => {
    await deleteActor(foundryPage, HERO);
  });

  test('resetting Health restores it to its derived maximum', async ({ foundryPage: page }) => {
    const start = await setup(page, { res: 3, health: 20 });
    expect(start.health).toBeLessThan(start.healthMax);

    const r = await clickReset(page, 'health');
    expect(r.hadButton).toBe(true);
    expect(r.before.health).toBe(20);
    expect(r.after.health).toBe(r.max.health);
    // Focus is a separate track and must not move.
    expect(r.after.focus).toBe(r.before.focus);
  });

  test('resetting Focus restores it to its derived maximum', async ({ foundryPage: page }) => {
    const start = await setup(page, { vig: 2, focus: 15 });
    expect(start.focus).toBeLessThan(start.focusMax);

    const r = await clickReset(page, 'focus');
    expect(r.hadButton).toBe(true);
    expect(r.before.focus).toBe(15);
    expect(r.after.focus).toBe(r.max.focus);
    expect(r.after.health).toBe(r.before.health);
  });

  test('the reset value follows the ability score, not a fixed number', async ({ foundryPage: page }) => {
    // Resilience 5 gives a different maximum, so a hardcoded reset would fail.
    const start = await setup(page, { res: 5, health: 3 });
    const r = await clickReset(page, 'health');
    expect(r.after.health).toBe(start.healthMax);
    expect(start.healthMax).toBe(5 * 30);
  });

  test('each control sits centred below its damage-reduction box', async ({ foundryPage: page }) => {
    await setup(page);
    const geometry = await evaluateWhenReady(page, async ({ hero }) => {
      const actor = game.actors.find(a => a.name === hero);
      const sheet = actor.sheet;
      await sheet._render(true);
      await new Promise(r => setTimeout(r, 600));
      const root = sheet.element?.[0] ?? sheet.element;

      const out = ['health', 'focus'].map((which) => {
        const button = root.querySelector(`.mm-stat-reset[data-reset="${which}"]`);
        const row = button?.closest('.flexrow.-relative');
        const corner = row?.querySelector('.mm-stat-corner-block');
        if (!button || !row || !corner) return null;
        const r = row.getBoundingClientRect();
        const b = button.getBoundingClientRect();
        const c = corner.getBoundingClientRect();
        return {
          // Horizontal centres, relative to the row.
          buttonCentreX: Math.round(b.left + b.width / 2 - r.left),
          cornerCentreX: Math.round(c.left + c.width / 2 - r.left),
          // Vertical: the button's centre against the midpoint of the space
          // between the DR box's bottom edge and the row's bottom.
          buttonCentreY: Math.round(b.top + b.height / 2 - r.top),
          gapMidpointY: Math.round((c.bottom - r.top + (r.bottom - r.top)) / 2),
          buttonTop: Math.round(b.top - r.top),
          cornerBottom: Math.round(c.bottom - r.top),
          rowBottom: Math.round(r.bottom - r.top),
          buttonHeight: Math.round(b.height),
        };
      });
      await sheet.close();
      return out;
    }, { hero: HERO });

    for (const g of geometry) {
      expect(g).not.toBeNull();
      // Centred left to right on the same axis as the DR box above it.
      expect(g.buttonCentreX).toBe(g.cornerCentreX);
      // Sits wholly below the DR box and inside the block.
      expect(g.buttonTop).toBeGreaterThanOrEqual(g.cornerBottom);
      expect(g.buttonTop + g.buttonHeight).toBeLessThanOrEqual(g.rowBottom);
      // Centred top to bottom in that space, allowing a pixel for the border inset.
      expect(Math.abs(g.buttonCentreY - g.gapMidpointY)).toBeLessThanOrEqual(2);
    }
  });
});
