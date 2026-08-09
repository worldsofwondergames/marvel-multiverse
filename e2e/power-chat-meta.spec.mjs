import { test, expect } from './fixtures.mjs';
import { evaluateWhenReady, dismissNotifications, deleteActor } from './helpers.mjs';

/**
 * Issue #116 — a power's Action, Trigger, Duration and Cost were stored on the
 * item but never reached the chat card. Each line must appear when the field
 * has a value and be omitted entirely when it does not, which is conditional
 * display and only observable by actually rolling the power.
 */
const HERO = 'E2E Chat Meta Hero';

/** Roll one power on the actor and return the resulting chat card HTML. */
async function rollPowerAndReadCard(page, powerData) {
  return evaluateWhenReady(page, async ({ name, power }) => {
    const actor = game.actors.find(a => a.name === name);
    const before = new Set(game.messages.contents.map(m => m.id));

    const [item] = await actor.createEmbeddedDocuments('Item', [
      { name: 'E2E Probe Power', type: 'power', system: power },
    ]);
    await item.roll();
    await new Promise(r => setTimeout(r, 400));

    const created = game.messages.contents.filter(m => !before.has(m.id));
    await item.delete();
    // The description/effect/meta card is the one that is not a roll.
    const card = created.find(m => !m.rolls?.length);
    return card ? card.content : null;
  }, { name: HERO, power: powerData });
}

/** Which of the four meta rows the card carries, in render order. */
const metaRows = (html) => [...html.matchAll(/data-meta="([a-z]+)"/g)].map(m => m[1]);

test.describe('Power chat card meta lines', () => {
  test.beforeEach(async ({ foundryPage }) => {
    await dismissNotifications(foundryPage);
    await evaluateWhenReady(foundryPage, async (name) => {
      const stale = game.actors.filter(a => a.name === name);
      if (stale.length) await Actor.deleteDocuments(stale.map(a => a.id));
      await Actor.create({ name, type: 'character' });
    }, HERO);
  });

  test.afterEach(async ({ foundryPage }) => {
    await deleteActor(foundryPage, HERO);
  });

  test('shows all four lines when the power sets all four', async ({ foundryPage: page }) => {
    const html = await rollPowerAndReadCard(page, {
      description: '<p>Probe description.</p>',
      action: 'Standard',
      trigger: 'On a hit',
      duration: '1 round',
      cost: '10 Focus',
    });
    expect(html).not.toBeNull();
    expect(metaRows(html)).toEqual(['action', 'trigger', 'duration', 'cost']);
    for (const value of ['Standard', 'On a hit', '1 round', '10 Focus']) {
      expect(html).toContain(value);
    }
  });

  test('omits every line when the power sets none of them', async ({ foundryPage: page }) => {
    const html = await rollPowerAndReadCard(page, {
      description: '<p>Probe description.</p>',
    });
    expect(html).not.toBeNull();
    // The description proves the card rendered, so an empty meta list is a real
    // result rather than a card that failed to appear.
    expect(html).toContain('Probe description.');
    expect(metaRows(html)).toEqual([]);
  });

  test('shows only the fields that have values', async ({ foundryPage: page }) => {
    const html = await rollPowerAndReadCard(page, {
      description: '<p>Probe description.</p>',
      cost: '5 Focus',
    });
    expect(html).not.toBeNull();
    expect(metaRows(html)).toEqual(['cost']);
    expect(html).toContain('5 Focus');
  });

  test('an emptied description leaves no empty element behind', async ({ foundryPage: page }) => {
    const html = await rollPowerAndReadCard(page, {
      description: '<p></p>',
      cost: '5 Focus',
    });
    expect(html).not.toBeNull();
    // Cost proves the card rendered; the description block must be absent.
    expect(metaRows(html)).toEqual(['cost']);
    expect(html).not.toContain('mm-chat-description');
  });
});
