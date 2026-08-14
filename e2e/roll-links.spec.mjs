import { test, expect } from './fixtures.mjs';
import { evaluateWhenReady, dismissNotifications, deleteActor } from './helpers.mjs';

/**
 * Issue #120 — power text names rolls in prose ("the character makes an Ego
 * check against the target's Ego defense"). A custom enricher turns the roll
 * into a link and leaves the defense alone.
 *
 * Enrichment is what is under test, so every assertion goes through a real
 * render: the chat card as Foundry renders it, and the item sheet as the DOM
 * actually shows it. Reading the stored string would prove nothing.
 */
const HERO = 'E2E Roll Link Hero';

/** Render a power's description as a chat card and return the resulting DOM. */
async function renderCard(page, description) {
  return evaluateWhenReady(page, async ({ name, text }) => {
    const actor = game.actors.find((a) => a.name === name);
    const [item] = await actor.createEmbeddedDocuments('Item', [
      { name: 'E2E Roll Link Power', type: 'power', system: { description: text } },
    ]);
    const before = new Set(game.messages.contents.map((m) => m.id));
    await item.roll();
    await new Promise((r) => setTimeout(r, 400));
    const card = game.messages.contents.find((m) => !before.has(m.id) && !m.rolls?.length);
    const html = await card.renderHTML({ canDelete: false });

    const links = [...html.querySelectorAll('a.mm-roll-link')].map((a) => ({
      ability: a.dataset.ability,
      kind: a.dataset.rollKind,
      tn: a.dataset.tn ?? null,
      text: a.textContent.trim(),
    }));
    const result = { links, text: html.querySelector('.message-content')?.textContent ?? '' };

    await card.delete();
    await item.delete();
    return result;
  }, { name: HERO, text: description });
}

test.describe('roll links in power text', () => {
  test.beforeEach(async ({ foundryPage }) => {
    await dismissNotifications(foundryPage);
    await evaluateWhenReady(foundryPage, async (name) => {
      const stale = game.actors.filter((a) => a.name === name);
      if (stale.length) await Actor.deleteDocuments(stale.map((a) => a.id));
      // A different value per ability, so an evaluated formula's modifier says
      // which ability was rolled. The formula stores the resolved number, not
      // the @abilities path, so the name alone is not observable there.
      await Actor.create({
        name,
        type: 'character',
        system: {
          abilities: {
            mle: { value: 1 },
            agl: { value: 2 },
            res: { value: 3 },
            vig: { value: 4 },
            ego: { value: 5 },
            log: { value: 6 },
          },
        },
      });
    }, HERO);
  });

  test.afterEach(async ({ foundryPage }) => {
    await deleteActor(foundryPage, HERO);
  });

  test('the check becomes a link and the defense beside it does not', async ({ foundryPage: page }) => {
    const card = await renderCard(
      page,
      "<p>The character makes an Ego check against the target's Logic defense.</p>"
    );

    expect(card.links).toEqual([
      { ability: 'ego', kind: 'check', tn: null, text: 'Ego check' },
    ]);
    // The defense is still shown, just not as something you can roll.
    expect(card.text).toContain('Logic defense');
  });

  test('close and ranged attacks resolve to their implied abilities', async ({ foundryPage: page }) => {
    const card = await renderCard(
      page,
      '<p>The character makes a close attack, then makes a ranged attack.</p>'
    );

    expect(card.links).toEqual([
      { ability: 'mle', kind: 'attack', tn: null, text: 'close attack' },
      { ability: 'agl', kind: 'attack', tn: null, text: 'ranged attack' },
    ]);
  });

  // Prose naming the class of rolls a bonus covers is not an instruction to
  // roll, so nothing on that line is clickable.
  test('an attack named as the scope of a bonus stays plain text', async ({ foundryPage: page }) => {
    const card = await renderCard(
      page,
      '<p>The character gains an edge on all close attacks this round.</p>'
    );

    expect(card.text).toContain('close attacks');
    expect(card.links).toEqual([]);
  });

  test('a stated target number is carried onto the link', async ({ foundryPage: page }) => {
    const card = await renderCard(
      page,
      '<p>The character makes an Ego vs. TN 12 action check.</p>'
    );

    expect(card.links).toEqual([
      { ability: 'ego', kind: 'check', tn: '12', text: 'Ego vs. TN 12 action check' },
    ]);
  });

  test('an action check naming no ability stays plain text', async ({ foundryPage: page }) => {
    const card = await renderCard(page, '<p>They gain an edge on all action checks.</p>');

    expect(card.links).toEqual([]);
    expect(card.text).toContain('action checks');
  });

  test('clicking a link rolls for the actor who spoke the card', async ({ foundryPage: page }) => {
    const outcome = await evaluateWhenReady(page, async (name) => {
      const actor = game.actors.find((a) => a.name === name);
      const [item] = await actor.createEmbeddedDocuments('Item', [
        {
          name: 'E2E Roll Link Power',
          type: 'power',
          system: { description: '<p>The character makes a Logic check.</p>' },
        },
      ]);
      await item.roll();
      await new Promise((r) => setTimeout(r, 400));

      // Click the link exactly as a user would, through the rendered chat log.
      const anchor = document.querySelector('#chat-log a.mm-roll-link, .chat-log a.mm-roll-link');
      const before = new Set(game.messages.contents.map((m) => m.id));
      anchor?.click();
      await new Promise((r) => setTimeout(r, 900));

      const created = game.messages.contents.filter((m) => !before.has(m.id));
      const rolled = created.find((m) => m.rolls?.length);
      const result = {
        foundAnchor: !!anchor,
        rolledSomething: !!rolled,
        speakerActorId: rolled?.speakerActor?.id ?? null,
        actorId: actor.id,
        formula: rolled?.rolls?.[0]?.formula ?? null,
        flavor: rolled?.flavor ?? '',
      };

      for (const m of created) await m.delete();
      await item.delete();
      return result;
    }, HERO);

    expect(outcome.foundAnchor).toBe(true);
    expect(outcome.rolledSomething).toBe(true);
    // The roll belongs to the card's speaker, not to whoever happens to be selected.
    expect(outcome.speakerActorId).toBe(outcome.actorId);
    // Logic is the only ability worth 6 on this actor, so the modifier proves
    // the link rolled Logic rather than whichever ability came first.
    expect(outcome.formula).toContain('+ 6');
    expect(outcome.flavor).toContain('Logic');
  });

  test('a link on a power sheet rolls for the actor owning that power', async ({ foundryPage: page }) => {
    const outcome = await evaluateWhenReady(page, async (name) => {
      const actor = game.actors.find((a) => a.name === name);
      const [item] = await actor.createEmbeddedDocuments('Item', [
        {
          name: 'E2E Roll Link Power',
          type: 'power',
          system: { description: '<p>The character makes an Ego check.</p>' },
        },
      ]);
      await item.sheet.render(true);
      await new Promise((r) => setTimeout(r, 900));

      const el = item.sheet.element instanceof HTMLElement
        ? item.sheet.element
        : item.sheet.element?.[0];
      const anchor = el.querySelector('a.mm-roll-link');
      const before = new Set(game.messages.contents.map((m) => m.id));
      anchor?.click();
      await new Promise((r) => setTimeout(r, 900));

      const created = game.messages.contents.filter((m) => !before.has(m.id));
      const rolled = created.find((m) => m.rolls?.length);
      const result = {
        foundAnchor: !!anchor,
        speakerActorId: rolled?.speakerActor?.id ?? null,
        actorId: actor.id,
        formula: rolled?.rolls?.[0]?.formula ?? null,
      };

      for (const m of created) await m.delete();
      await item.sheet.close();
      await item.delete();
      return result;
    }, HERO);

    expect(outcome.foundAnchor).toBe(true);
    // Resolved from the sheet, since a sheet has no chat speaker to fall back on.
    expect(outcome.speakerActorId).toBe(outcome.actorId);
    // Ego is the only ability worth 5 on this actor.
    expect(outcome.formula).toContain('+ 5');
  });

  test('a target number link reports whether the roll met it', async ({ foundryPage: page }) => {
    const flavor = await evaluateWhenReady(page, async (name) => {
      const actor = game.actors.find((a) => a.name === name);
      const [item] = await actor.createEmbeddedDocuments('Item', [
        {
          name: 'E2E Roll Link Power',
          type: 'power',
          system: { description: '<p>The character makes an Ego vs. TN 12 action check.</p>' },
        },
      ]);
      await item.roll();
      await new Promise((r) => setTimeout(r, 400));

      const anchor = document.querySelector('#chat-log a.mm-roll-link, .chat-log a.mm-roll-link');
      const before = new Set(game.messages.contents.map((m) => m.id));
      anchor?.click();
      await new Promise((r) => setTimeout(r, 900));

      const created = game.messages.contents.filter((m) => !before.has(m.id));
      const rolled = created.find((m) => m.rolls?.length);
      const result = rolled?.flavor ?? '';
      for (const m of created) await m.delete();
      await item.delete();
      return result;
    }, HERO);

    expect(flavor).toContain('vs TN 12');
    expect(flavor).toMatch(/Success|Failed|Fantastic/);
  });
});

test.describe('rich text on sheets', () => {
  test.afterEach(async ({ foundryPage: page }) => {
    await evaluateWhenReady(page, async () => {
      for (const i of game.items.filter((i) => i.name === 'E2E Sheet Enrich Power')) await i.delete();
    });
  });

  test('an item sheet shows the description enriched, not as raw markup', async ({ foundryPage: page }) => {
    const out = await evaluateWhenReady(page, async () => {
      const item = await Item.create({
        name: 'E2E Sheet Enrich Power',
        type: 'power',
        system: { description: '<p>The character makes a Vigilance check.</p>' },
      });
      await item.sheet.render(true);
      await new Promise((r) => setTimeout(r, 900));

      const el = item.sheet.element instanceof HTMLElement
        ? item.sheet.element
        : item.sheet.element?.[0];
      const content = el.querySelector('.editor-content');
      const anchor = content?.querySelector('a.mm-roll-link');
      const result = {
        hasLink: !!anchor,
        ability: anchor?.dataset.ability ?? null,
        // What the editor would load if opened must stay the raw stored value.
        storedStillRaw: item.system.description,
      };
      await item.sheet.close();
      await item.delete();
      return result;
    });

    expect(out.hasLink).toBe(true);
    expect(out.ability).toBe('vig');
    expect(out.storedStillRaw).toBe('<p>The character makes a Vigilance check.</p>');
  });

  test('editing through the sheet saves the raw value, not the enriched copy', async ({ foundryPage: page }) => {
    const stored = await evaluateWhenReady(page, async () => {
      const item = await Item.create({
        name: 'E2E Sheet Enrich Power',
        type: 'power',
        system: { description: '<p>The character makes a Vigilance check.</p>' },
      });
      await item.sheet.render(true);
      await new Promise((r) => setTimeout(r, 900));

      // Save through the sheet without touching the text. If the enriched copy
      // were the editor's source, this round trip would persist anchor markup.
      await item.sheet.submit();
      await new Promise((r) => setTimeout(r, 600));

      const after = item.system.description;
      await item.sheet.close();
      await item.delete();
      return after;
    });

    expect(stored).not.toContain('mm-roll-link');
    expect(stored).toBe('<p>The character makes a Vigilance check.</p>');
  });
});
