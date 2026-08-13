import { test, expect } from './fixtures.mjs';
import { evaluateWhenReady, dismissNotifications, deleteActor } from './helpers.mjs';

/**
 * `Item#roll()` is shared by every item type. It puts `system.description` in
 * `.mm-chat-description`, which the stylesheet italicizes so a power's flavor
 * text reads differently from the roman rules text in `.mm-chat-effect`.
 *
 * Only `power` defines an `effect` field. Every other type keeps its rules text
 * in `description`, so the whole card came out italic. The italic belongs to the
 * contrast between the two blocks, so it applies only when both are on the card.
 */

const HERO = 'E2E Italics Hero';

/** Post an item to chat and report the computed font style of each block. */
async function cardStyles(page, itemData) {
  return evaluateWhenReady(page, async ({ name, itemData }) => {
    const actor = game.actors.find(a => a.name === name);
    const [item] = await actor.createEmbeddedDocuments('Item', [itemData]);
    const before = new Set(game.messages.contents.map(m => m.id));
    await item.roll();
    await new Promise(r => setTimeout(r, 1200));

    const card = game.messages.contents
      .filter(m => !before.has(m.id))
      .find(m => !m.rolls?.length);
    const li = card ? document.querySelector(`[data-message-id="${card.id}"]`) : null;
    if (!li) { await item.delete(); return null; }

    const styleOf = (sel) => {
      const el = li.querySelector(sel);
      return el ? getComputedStyle(el).fontStyle : null;
    };
    const result = {
      description: styleOf('.mm-chat-description'),
      effect: styleOf('.mm-chat-effect'),
    };
    await item.delete();
    return result;
  }, { name: HERO, itemData });
}

test.describe('Chat card italics', () => {
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

  test('a trait card is not italic', async ({ foundryPage }) => {
    const styles = await cardStyles(foundryPage, {
      name: 'E2E Italics Trait',
      type: 'trait',
      system: { description: '<p>The character shrugs off the first hit each round.</p>' },
    });
    expect(styles).not.toBeNull();
    expect(styles.description).toBe('normal');
  });

  test('a power with both blocks keeps its description italic', async ({ foundryPage }) => {
    const styles = await cardStyles(foundryPage, {
      name: 'E2E Italics Power',
      type: 'power',
      system: {
        description: '<p>Light bends around the character.</p>',
        effect: '<p>Attacks against the character have trouble.</p>',
      },
    });
    expect(styles).not.toBeNull();
    expect(styles.description).toBe('italic');
    expect(styles.effect).toBe('normal');
  });

  test('a power with no effect block is not italic', async ({ foundryPage }) => {
    const styles = await cardStyles(foundryPage, {
      name: 'E2E Italics Lone Power',
      type: 'power',
      system: { description: '<p>The character leaps twice their usual distance.</p>' },
    });
    expect(styles).not.toBeNull();
    expect(styles.effect).toBeNull();
    expect(styles.description).toBe('normal');
  });
});
