import { test, expect } from './fixtures.mjs';
import { evaluateWhenReady, dismissNotifications } from './helpers.mjs';

/**
 * `occupation`, `origin`, `powerSet` and `vehicleWeapon` are registered in
 * template.json and have sheet templates, but had no test of any kind in either
 * layer. These run against real Foundry so the assertions cover what the data
 * models actually enforce — field coercion, bounds clamping, integer rounding —
 * rather than restating the schema declarations.
 */

const PREFIX = 'E2E ItemType';

/** Create a world item, returning its resolved system data. Replaces any namesake. */
async function createItem(page, name, type, system = {}) {
  return evaluateWhenReady(page, async ({ name, type, system }) => {
    const existing = game.items.filter(i => i.name === name);
    if (existing.length) await Item.deleteDocuments(existing.map(i => i.id));
    const item = await Item.create({ name, type, system });
    return foundry.utils.deepClone(item.system);
  }, { name, type, system });
}

async function deleteItems(page) {
  await evaluateWhenReady(page, async (prefix) => {
    const doomed = game.items.filter(i => i.name.startsWith(prefix));
    if (doomed.length) await Item.deleteDocuments(doomed.map(i => i.id));
  }, PREFIX);
}

/** Open an item's sheet and report whether it rendered with the type's template. */
async function renderSheet(page, name) {
  const result = await evaluateWhenReady(page, async (name) => {
    const item = game.items.find(i => i.name === name);
    await item.sheet._render(true);
    const app = Object.values(ui.windows).find(w => w.item?.name === name);
    return { rendered: !!app, template: app?.template ?? null, html: app?.element?.[0]?.innerHTML?.length ?? 0 };
  }, name);
  await evaluateWhenReady(page, (name) => {
    Object.values(ui.windows).find(w => w.item?.name === name)?.close();
  }, name);
  return result;
}

test.describe('Untested item types', () => {
  test.beforeEach(async ({ foundryPage }) => {
    await dismissNotifications(foundryPage);
  });

  test.afterEach(async ({ foundryPage }) => {
    await deleteItems(foundryPage);
  });

  test.describe('occupation', () => {
    test('creates with the documented defaults', async ({ foundryPage }) => {
      const s = await createItem(foundryPage, `${PREFIX} Occupation`, 'occupation');
      expect(s.examples).toBe('');
      expect(s.tags).toEqual([]);
      expect(s.traits).toEqual([]);
      // Inherited from the item base contract.
      expect(s.quantity).toBe(1);
      expect(s.formula).toBe('{1d6,1dm,1d6}');
      expect(s.source).toBe('');
    });

    test('tags and traits round-trip structured entries', async ({ foundryPage }) => {
      const s = await createItem(foundryPage, `${PREFIX} Occupation`, 'occupation', {
        examples: 'Journalist, Photographer',
        tags: [{ name: 'Connections', detail: 'Press pass' }],
        traits: [{ name: 'Observant' }],
      });
      expect(s.examples).toBe('Journalist, Photographer');
      expect(s.tags).toHaveLength(1);
      expect(s.tags[0].name).toBe('Connections');
      expect(s.tags[0].detail).toBe('Press pass');
      expect(s.traits[0].name).toBe('Observant');
    });

    test('sheet renders from the occupation template', async ({ foundryPage }) => {
      await createItem(foundryPage, `${PREFIX} Occupation`, 'occupation');
      const r = await renderSheet(foundryPage, `${PREFIX} Occupation`);
      expect(r.rendered).toBe(true);
      expect(r.template).toContain('item-occupation-sheet.hbs');
      expect(r.html).toBeGreaterThan(0);
    });
  });

  test.describe('origin', () => {
    test('creates with the documented defaults', async ({ foundryPage }) => {
      const s = await createItem(foundryPage, `${PREFIX} Origin`, 'origin');
      expect(s.minimumRank).toBe(0);
      expect(s.examples).toBe('');
      expect(s.suggestedOccupation).toBe('');
      expect(s.limitation).toBe('');
      expect(s.suggestedTags).toEqual([]);
      expect(s.tags).toEqual([]);
      expect(s.traits).toEqual([]);
      expect(s.powers).toEqual([]);
    });

    test('minimumRank clamps a negative to its lower bound', async ({ foundryPage }) => {
      const s = await createItem(foundryPage, `${PREFIX} Origin`, 'origin', { minimumRank: -3 });
      expect(s.minimumRank).toBe(0);
    });

    test('minimumRank rounds a fractional value to an integer', async ({ foundryPage }) => {
      const s = await createItem(foundryPage, `${PREFIX} Origin`, 'origin', { minimumRank: 2.6 });
      expect(s.minimumRank).toBe(3);
      expect(Number.isInteger(s.minimumRank)).toBe(true);
    });

    test('accepts a rank inside the allowed range unchanged', async ({ foundryPage }) => {
      const s = await createItem(foundryPage, `${PREFIX} Origin`, 'origin', { minimumRank: 4 });
      expect(s.minimumRank).toBe(4);
    });

    test('suggested content round-trips', async ({ foundryPage }) => {
      const s = await createItem(foundryPage, `${PREFIX} Origin`, 'origin', {
        suggestedOccupation: 'Scientist',
        suggestedTags: [{ name: 'Gamma-Irradiated' }],
        powers: [{ name: 'Super-Strength' }],
        limitation: 'Cannot suppress transformation',
      });
      expect(s.suggestedOccupation).toBe('Scientist');
      expect(s.suggestedTags[0].name).toBe('Gamma-Irradiated');
      expect(s.powers[0].name).toBe('Super-Strength');
      expect(s.limitation).toBe('Cannot suppress transformation');
    });

    test('sheet renders from the origin template', async ({ foundryPage }) => {
      await createItem(foundryPage, `${PREFIX} Origin`, 'origin');
      const r = await renderSheet(foundryPage, `${PREFIX} Origin`);
      expect(r.rendered).toBe(true);
      expect(r.template).toContain('item-origin-sheet.hbs');
      expect(r.html).toBeGreaterThan(0);
    });
  });

  test.describe('powerSet', () => {
    test('carries the item base contract and adds nothing of its own', async ({ foundryPage }) => {
      const powerSet = await createItem(foundryPage, `${PREFIX} PowerSet`, 'powerSet');
      expect(Object.keys(powerSet).sort()).toEqual(
        ['ability', 'attack', 'description', 'formula', 'quantity', 'size', 'source'],
      );
      expect(powerSet.quantity).toBe(1);
      expect(powerSet.attack).toBe(false);
      expect(powerSet.formula).toBe('{1d6,1dm,1d6}');

      // It extends the base directly, so it carries neither the plain `item`
      // type's `weight` nor any other type's fields.
      const base = await createItem(foundryPage, `${PREFIX} BaseItem`, 'item');
      expect(base.weight).toBeDefined();
      expect(powerSet.weight).toBeUndefined();
      expect(powerSet.examples).toBeUndefined();
      expect(powerSet.damageMultiplier).toBeUndefined();
    });

    test('sheet renders from the powerSet template', async ({ foundryPage }) => {
      await createItem(foundryPage, `${PREFIX} PowerSet`, 'powerSet');
      const r = await renderSheet(foundryPage, `${PREFIX} PowerSet`);
      expect(r.rendered).toBe(true);
      expect(r.template).toContain('item-powerSet-sheet.hbs');
      expect(r.html).toBeGreaterThan(0);
    });
  });

  test.describe('vehicleWeapon', () => {
    test('creates with the documented defaults', async ({ foundryPage }) => {
      const s = await createItem(foundryPage, `${PREFIX} VWeapon`, 'vehicleWeapon');
      expect(s.agility).toBe(0);
      expect(s.range).toBe(0);
      expect(s.damageMultiplier).toBe(0);
      expect(s.automated).toBe(false);
      expect(s.notes).toBe('');
    });

    test('stores supplied values', async ({ foundryPage }) => {
      const s = await createItem(foundryPage, `${PREFIX} VWeapon`, 'vehicleWeapon', {
        agility: 3, range: 12, damageMultiplier: 4, automated: true, notes: 'Turret-mounted',
      });
      expect(s.agility).toBe(3);
      expect(s.range).toBe(12);
      expect(s.damageMultiplier).toBe(4);
      expect(s.automated).toBe(true);
      expect(s.notes).toBe('Turret-mounted');
    });

    test('negative numeric fields clamp to zero', async ({ foundryPage }) => {
      const s = await createItem(foundryPage, `${PREFIX} VWeapon`, 'vehicleWeapon', {
        agility: -1, range: -5, damageMultiplier: -2,
      });
      expect(s.agility).toBe(0);
      expect(s.range).toBe(0);
      expect(s.damageMultiplier).toBe(0);
    });

    test('fractional numeric fields round to integers', async ({ foundryPage }) => {
      const s = await createItem(foundryPage, `${PREFIX} VWeapon`, 'vehicleWeapon', {
        agility: 1.4, range: 2.7, damageMultiplier: 3.5,
      });
      expect(s.agility).toBe(1);
      expect(s.range).toBe(3);
      expect([3, 4]).toContain(s.damageMultiplier);
      expect(Number.isInteger(s.damageMultiplier)).toBe(true);
    });

    test('can be embedded on a vehicle actor', async ({ foundryPage }) => {
      const result = await evaluateWhenReady(foundryPage, async (prefix) => {
        const name = `${prefix} Vehicle`;
        const stale = game.actors.filter(a => a.name === name);
        if (stale.length) await Actor.deleteDocuments(stale.map(a => a.id));
        const vehicle = await Actor.create({ name, type: 'vehicle' });
        const [weapon] = await vehicle.createEmbeddedDocuments('Item', [{
          name: `${prefix} Mounted Gun`,
          type: 'vehicleWeapon',
          system: { agility: 2, range: 8, damageMultiplier: 3, automated: true },
        }]);
        const out = {
          type: weapon.type,
          system: foundry.utils.deepClone(weapon.system),
          ownerType: weapon.parent.type,
          count: vehicle.items.filter(i => i.type === 'vehicleWeapon').length,
        };
        await Actor.deleteDocuments([vehicle.id]);
        return out;
      }, PREFIX);

      expect(result.type).toBe('vehicleWeapon');
      expect(result.ownerType).toBe('vehicle');
      expect(result.count).toBe(1);
      expect(result.system.range).toBe(8);
      expect(result.system.automated).toBe(true);
    });

    test('sheet renders from the vehicleWeapon template', async ({ foundryPage }) => {
      await createItem(foundryPage, `${PREFIX} VWeapon`, 'vehicleWeapon');
      const r = await renderSheet(foundryPage, `${PREFIX} VWeapon`);
      expect(r.rendered).toBe(true);
      expect(r.template).toContain('item-vehicleWeapon-sheet.hbs');
      expect(r.html).toBeGreaterThan(0);
    });
  });
});
