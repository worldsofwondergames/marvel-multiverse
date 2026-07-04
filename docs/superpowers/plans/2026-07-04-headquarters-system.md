# Headquarters System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `headquarters` actor type with team roster, HQ tags/traits as owned items, tag incompatibility enforcement, health/damage tracking, and a dedicated sheet.

**Architecture:** Standalone `MarvelMultiverseHeadquarters` data model (does NOT extend `ActorBase` — same pattern as Vehicle). Two new item types (`hqTag`, `hqTrait`) with their own data models and item sheet templates. A `MarvelMultiverseHeadquartersSheet` extends `ActorSheet` with drag-and-drop for members, tags, and traits.

**Tech Stack:** FoundryVTT v13 APIs, ES modules, Handlebars templates, SCSS, Jest unit tests

## Global Constraints

- FoundryVTT v13 runtime — use v13 APIs only
- Data models use `foundry.abstract.TypeDataModel` and `defineSchema()` pattern
- Follow existing patterns: Vehicle actor type, Tag/Trait item types
- No Marvel IP content in this repo — compendium pack data lives in marvel-multiverse-data module
- Localization strings go in `lang/en.json` under `MARVEL_MULTIVERSE.*`
- Item sheet templates follow naming convention: `templates/item/item-{type}-sheet.hbs`
- Actor sheet templates: `templates/actor/actor-{type}-sheet.hbs`
- SCSS partials: `src/scss/sheets/_{type}.scss`, imported in `marvel-multiverse.scss`
- All source modules are in `module/` and compiled via rollup to `marvel-multiverse.mjs`
- Tests use Jest with mocks in `module/__mocks__/foundry.mjs`

---

### Task 1: Data Models (hqTag, hqTrait, headquarters)

**Files:**
- Create: `module/data/hq-tag.mjs`
- Create: `module/data/hq-trait.mjs`
- Create: `module/data/headquarters.mjs`
- Modify: `module/data/_module.mjs`
- Test: `module/__tests__/headquarters.test.mjs`

**Interfaces:**
- Produces: `MarvelMultiverseHqTag` class with schema fields `description`, `incompatible`
- Produces: `MarvelMultiverseHqTrait` class with schema fields `description`, `downtimeActivity`, `maxCount`
- Produces: `MarvelMultiverseHeadquarters` class with schema fields `health`, `teamRank`, `members`, `description`, `notes`, `source` and derived data: `teamRank`, `health.max`, `health.damaged`, `health.destroyed`, `traitSlots`, `traitCount`

- [ ] **Step 1: Write the HQ Tag data model**

Create `module/data/hq-tag.mjs`:

```javascript
export default class MarvelMultiverseHqTag extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = {};

    schema.description = new fields.StringField({ required: true, blank: true });
    schema.incompatible = new fields.StringField({ required: true, blank: true });

    return schema;
  }
}
```

The `incompatible` field is a comma-separated string (e.g. `"Isolated Location, Secret Location"`) for easy editing in the item sheet. The HQ sheet's `_onDropItemCreate` splits on commas when checking.

- [ ] **Step 2: Write the HQ Trait data model**

Create `module/data/hq-trait.mjs`:

```javascript
export default class MarvelMultiverseHqTrait extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = {};

    schema.description = new fields.StringField({ required: true, blank: true });
    schema.downtimeActivity = new fields.StringField({ required: true, blank: true });
    schema.maxCount = new fields.NumberField({ required: true, nullable: false, integer: true, initial: 0, min: 0 });

    return schema;
  }
}
```

- [ ] **Step 3: Write the Headquarters data model**

Create `module/data/headquarters.mjs`:

```javascript
export default class MarvelMultiverseHeadquarters extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = {};

    schema.health = new fields.SchemaField({
      value: new fields.NumberField({ required: true, nullable: false, initial: 0, min: 0 }),
      max: new fields.NumberField({ required: true, nullable: false, initial: 0, min: 0 }),
    });

    schema.members = new fields.ArrayField(new fields.SchemaField({
      actorId: new fields.StringField({ required: true, blank: false }),
      name: new fields.StringField({ required: true, blank: true }),
      img: new fields.StringField({ required: true, blank: true }),
    }));

    schema.description = new fields.StringField({ required: true, blank: true });
    schema.notes = new fields.StringField({ required: true, blank: true });
    schema.source = new fields.StringField({ required: true, blank: true });

    return schema;
  }

  prepareDerivedData() {
    const hqTraits = this.parent?.items?.filter(i => i.type === "hqTrait") ?? [];
    this.traitCount = hqTraits.length;
    this.health.max = this.traitCount * 2;

    const ranks = this.members
      .map(m => game.actors?.get(m.actorId)?.system?.attributes?.rank?.value)
      .filter(r => r != null)
      .sort((a, b) => b - a)
      .slice(0, 6);

    this.teamRank = ranks.length > 0 ? Math.ceil(ranks.reduce((s, r) => s + r, 0) / ranks.length) : 1;
    this.traitSlots = this.teamRank * 3;

    this.health.damaged = this.health.max > 0 && this.health.value > 0 && this.health.value <= this.health.max / 2;
    this.health.destroyed = this.health.max > 0 && this.health.value <= 0;

    let healthStatus = "operational";
    if (this.health.destroyed) healthStatus = "destroyed";
    else if (this.health.damaged) healthStatus = "damaged";
    this.health.status = healthStatus;
  }
}
```

- [ ] **Step 4: Export the new data models from `_module.mjs`**

Add these three lines to `module/data/_module.mjs`:

After the existing actor exports, add:
```javascript
export {default as MarvelMultiverseHeadquarters} from "./headquarters.mjs";
```

After the existing item exports, add:
```javascript
export {default as MarvelMultiverseHqTag} from "./hq-tag.mjs";
export {default as MarvelMultiverseHqTrait} from "./hq-trait.mjs";
```

- [ ] **Step 5: Write failing tests for data models**

Create `module/__tests__/headquarters.test.mjs`:

```javascript
/* eslint-env jest */
import MarvelMultiverseHeadquarters from '../data/headquarters.mjs';
import MarvelMultiverseHqTag from '../data/hq-tag.mjs';
import MarvelMultiverseHqTrait from '../data/hq-trait.mjs';

// ─── HQ Tag ──────────────────────────────────────────────────────────────────

describe('MarvelMultiverseHqTag', () => {
  test('has description and incompatible fields', () => {
    const tag = new MarvelMultiverseHqTag({
      description: 'Located in a major city',
      incompatible: 'Isolated Location',
    });
    expect(tag.description).toBe('Located in a major city');
    expect(tag.incompatible).toBe('Isolated Location');
  });

  test('incompatible defaults to empty string', () => {
    const tag = new MarvelMultiverseHqTag({ description: 'Some tag' });
    expect(tag.incompatible).toBeUndefined();
  });
});

// ─── HQ Trait ────────────────────────────────────────────────────────────────

describe('MarvelMultiverseHqTrait', () => {
  test('has description, downtimeActivity, and maxCount fields', () => {
    const trait = new MarvelMultiverseHqTrait({
      description: 'A well-stocked lab',
      downtimeActivity: 'Edge on gadget hacking',
      maxCount: 0,
    });
    expect(trait.description).toBe('A well-stocked lab');
    expect(trait.downtimeActivity).toBe('Edge on gadget hacking');
    expect(trait.maxCount).toBe(0);
  });

  test('maxCount can be set for stackable traits', () => {
    const trait = new MarvelMultiverseHqTrait({
      description: 'Active security',
      downtimeActivity: 'Raise TN by +2',
      maxCount: 3,
    });
    expect(trait.maxCount).toBe(3);
  });
});

// ─── Headquarters ─────────────────────────────────────────────────────────────

function makeHQ({ healthValue = 10, members = [], traitItems = [] } = {}) {
  const instance = new MarvelMultiverseHeadquarters({
    health: { value: healthValue, max: 0 },
    members,
    description: '',
    notes: '',
    source: '',
  });
  instance.parent = {
    items: traitItems.map(t => ({ type: 'hqTrait', ...t })),
  };
  instance.prepareDerivedData();
  return instance;
}

describe('MarvelMultiverseHeadquarters — Health & Status', () => {
  test('health.max = 2 × trait count', () => {
    const hq = makeHQ({
      healthValue: 12,
      traitItems: [{ name: 'Lab' }, { name: 'Kitchen' }, { name: 'Armory' },
        { name: 'Garage' }, { name: 'Hangar' }, { name: 'Library' }],
    });
    expect(hq.health.max).toBe(12);
    expect(hq.traitCount).toBe(6);
  });

  test('operational when health > max / 2', () => {
    const hq = makeHQ({
      healthValue: 10,
      traitItems: [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }, { name: 'E' }, { name: 'F' }],
    });
    expect(hq.health.status).toBe('operational');
    expect(hq.health.damaged).toBe(false);
    expect(hq.health.destroyed).toBe(false);
  });

  test('damaged when health > 0 and <= max / 2', () => {
    const hq = makeHQ({
      healthValue: 5,
      traitItems: Array.from({ length: 6 }, (_, i) => ({ name: `T${i}` })),
    });
    expect(hq.health.max).toBe(12);
    expect(hq.health.damaged).toBe(true);
    expect(hq.health.status).toBe('damaged');
  });

  test('damaged boundary: exactly half is damaged', () => {
    const hq = makeHQ({
      healthValue: 6,
      traitItems: Array.from({ length: 6 }, (_, i) => ({ name: `T${i}` })),
    });
    expect(hq.health.max).toBe(12);
    expect(hq.health.damaged).toBe(true);
  });

  test('destroyed when health <= 0', () => {
    const hq = makeHQ({
      healthValue: 0,
      traitItems: Array.from({ length: 3 }, (_, i) => ({ name: `T${i}` })),
    });
    expect(hq.health.destroyed).toBe(true);
    expect(hq.health.status).toBe('destroyed');
  });

  test('not destroyed when max is 0 (no traits)', () => {
    const hq = makeHQ({ healthValue: 0, traitItems: [] });
    expect(hq.health.destroyed).toBe(false);
  });

  test('trait slots = teamRank × 3', () => {
    const hq = makeHQ();
    expect(hq.traitSlots).toBe(3);
  });
});

describe('MarvelMultiverseHeadquarters — Team Rank', () => {
  test('defaults to 1 when no members', () => {
    const hq = makeHQ();
    expect(hq.teamRank).toBe(1);
  });

  test('calculates average rank rounded up', () => {
    game.actors = {
      get: (id) => {
        const ranks = { a1: 3, a2: 4, a3: 5 };
        return ranks[id] ? { system: { attributes: { rank: { value: ranks[id] } } } } : null;
      },
    };

    const hq = makeHQ({
      members: [
        { actorId: 'a1', name: 'Hero A', img: '' },
        { actorId: 'a2', name: 'Hero B', img: '' },
        { actorId: 'a3', name: 'Hero C', img: '' },
      ],
    });

    expect(hq.teamRank).toBe(4);
    game.actors = undefined;
  });

  test('uses top 6 ranks when more than 6 members', () => {
    game.actors = {
      get: (id) => {
        const ranks = { a1: 3, a2: 3, a3: 3, a4: 4, a5: 4, a6: 5, a7: 5 };
        return ranks[id] ? { system: { attributes: { rank: { value: ranks[id] } } } } : null;
      },
    };

    const hq = makeHQ({
      members: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'].map(id => ({ actorId: id, name: id, img: '' })),
    });

    // Top 6: 5, 5, 4, 4, 3, 3 = 24 / 6 = 4
    expect(hq.teamRank).toBe(4);
    game.actors = undefined;
  });

  test('skips members whose actors are not found', () => {
    game.actors = {
      get: (id) => {
        if (id === 'a1') return { system: { attributes: { rank: { value: 3 } } } };
        return null;
      },
    };

    const hq = makeHQ({
      members: [
        { actorId: 'a1', name: 'Found', img: '' },
        { actorId: 'a2', name: 'Missing', img: '' },
      ],
    });

    expect(hq.teamRank).toBe(3);
    game.actors = undefined;
  });

  test('trait slots update with team rank', () => {
    game.actors = {
      get: (id) => ({ system: { attributes: { rank: { value: 6 } } } }),
    };

    const hq = makeHQ({
      members: [{ actorId: 'a1', name: 'Rank 6 Hero', img: '' }],
    });

    expect(hq.teamRank).toBe(6);
    expect(hq.traitSlots).toBe(18);
    game.actors = undefined;
  });
});
```

- [ ] **Step 6: Run the tests**

Run: `npm test -- headquarters.test.mjs`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add module/data/hq-tag.mjs module/data/hq-trait.mjs module/data/headquarters.mjs module/data/_module.mjs module/__tests__/headquarters.test.mjs
git commit -m "Add headquarters, hqTag, hqTrait data models with tests (#69)"
```

---

### Task 2: System Registration and Localization

**Files:**
- Modify: `marvel-multiverse.mjs` (lines ~6082-6103 for dataModels, ~6191-6210 for sheet registration, ~460-469 for default icons)
- Modify: `lang/en.json`
- Modify: `system.json`

**Interfaces:**
- Consumes: `MarvelMultiverseHeadquarters`, `MarvelMultiverseHqTag`, `MarvelMultiverseHqTrait` from Task 1
- Consumes: `MarvelMultiverseHeadquartersSheet` from Task 3
- Produces: Registered actor/item types available in Foundry's create dialogs

- [ ] **Step 1: Add data model registrations to `marvel-multiverse.mjs`**

In the `CONFIG.Actor.dataModels` block (around line 6082), add `headquarters`:

```javascript
CONFIG.Actor.dataModels = {
    character: MarvelMultiverseCharacter,
    npc: MarvelMultiverseNPC,
    vehicle: MarvelMultiverseVehicle,
    headquarters: MarvelMultiverseHeadquarters,
};
```

In the `CONFIG.Item.dataModels` block (around line 6089), add `hqTag` and `hqTrait`:

```javascript
CONFIG.Item.dataModels = {
    item: MarvelMultiverseItem,
    iconicItem: MarvelMultiverseIconicItem,
    weapon: MarvelMultiverseWeapon,
    trait: MarvelMultiverseTrait,
    origin: MarvelMultiverseOrigin,
    occupation: MarvelMultiverseOccupation,
    tag: MarvelMultiverseTag,
    power: MarvelMultiversePower,
    powerSet: MarvelMultiversePowerSet,
    restriction: MarvelMultiverseRestriction,
    battleSuit: MarvelMultiverseBattleSuit,
    equipment: MarvelMultiverseEquipment,
    vehicleWeapon: MarvelMultiverseVehicleWeapon,
    hqTag: MarvelMultiverseHqTag,
    hqTrait: MarvelMultiverseHqTrait,
};
```

Add default icons for hqTag and hqTrait to the `ITEM_DEFAULT_ICONS` object (around line 460):

```javascript
const ITEM_DEFAULT_ICONS = {
    item: "icons/svg/item-bag.svg",
    weapon: "systems/marvel-multiverse/icons/weapons.svg",
    vehicleWeapon: "systems/marvel-multiverse/icons/weapons.svg",
    trait: "systems/marvel-multiverse/icons/trait.svg",
    occupation: "systems/marvel-multiverse/icons/work.svg",
    origin: "systems/marvel-multiverse/icons/origin.svg",
    powerSet: "icons/svg/card-hand.svg",
    power: "systems/marvel-multiverse/icons/super-powers.svg",
    tag: "systems/marvel-multiverse/icons/tags.svg",
    hqTag: "systems/marvel-multiverse/icons/tags.svg",
    hqTrait: "systems/marvel-multiverse/icons/trait.svg",
};
```

Add sheet registration after the existing vehicle sheet registration (around line 6207):

```javascript
Actors.registerSheet("marvel-multiverse", MarvelMultiverseHeadquartersSheet, {
    types: ["headquarters"],
    makeDefault: true,
    label: "MARVEL_MULTIVERSE.SheetLabels.Headquarters",
});
```

- [ ] **Step 2: Add localization strings to `lang/en.json`**

Add these keys to the appropriate location in `lang/en.json`:

```json
"MARVEL_MULTIVERSE.ActorType.Headquarters": "Headquarters",
"MARVEL_MULTIVERSE.SheetLabels.Headquarters": "Headquarters Sheet",
"MARVEL_MULTIVERSE.Headquarters.Health": "Health",
"MARVEL_MULTIVERSE.Headquarters.TeamRank": "Team Rank",
"MARVEL_MULTIVERSE.Headquarters.Members": "Members",
"MARVEL_MULTIVERSE.Headquarters.Tags": "Tags",
"MARVEL_MULTIVERSE.Headquarters.Traits": "Traits",
"MARVEL_MULTIVERSE.Headquarters.TraitSlots": "Trait Slots",
"MARVEL_MULTIVERSE.Headquarters.Description": "Description",
"MARVEL_MULTIVERSE.Headquarters.Notes": "Notes",
"MARVEL_MULTIVERSE.Headquarters.Source": "Source",
"MARVEL_MULTIVERSE.Headquarters.Status.Operational": "Operational",
"MARVEL_MULTIVERSE.Headquarters.Status.Damaged": "Damaged",
"MARVEL_MULTIVERSE.Headquarters.Status.Destroyed": "Destroyed",
"MARVEL_MULTIVERSE.Headquarters.DropMember": "Drop a character or NPC here to add a team member",
"MARVEL_MULTIVERSE.Headquarters.MemberAlreadyAdded": "is already a team member.",
"MARVEL_MULTIVERSE.Headquarters.IncompatibleTag": "is incompatible with",
"MARVEL_MULTIVERSE.Headquarters.DowntimeActivity": "Downtime Activity",
"MARVEL_MULTIVERSE.Headquarters.Rank": "Rank",
"MARVEL_MULTIVERSE.ItemType.HqTag": "HQ Tag",
"MARVEL_MULTIVERSE.ItemType.HqTrait": "HQ Trait"
```

- [ ] **Step 3: Add compendium pack entries to `system.json`**

Add two new pack entries to the `packs` array in `system.json`:

```json
{
    "name": "hq-tags",
    "label": "HQ Tags",
    "system": "marvel-multiverse",
    "path": "packs/hq-tags",
    "type": "Item",
    "private": false,
    "flags": {}
},
{
    "name": "hq-traits",
    "label": "HQ Traits",
    "system": "marvel-multiverse",
    "path": "packs/hq-traits",
    "type": "Item",
    "private": false,
    "flags": {}
}
```

- [ ] **Step 4: Commit**

```bash
git add marvel-multiverse.mjs lang/en.json system.json
git commit -m "Register headquarters actor/item types, add localization and pack entries (#69)"
```

---

### Task 3: Headquarters Sheet Class

**Files:**
- Create: `module/sheets/headquarters-sheet.mjs`

**Interfaces:**
- Consumes: `MarvelMultiverseHeadquarters` data model (Task 1) — `system.health`, `system.members`, `system.teamRank`, `system.traitSlots`, `system.traitCount`
- Produces: `MarvelMultiverseHeadquartersSheet` class with `getData()`, `activateListeners()`, `_onDropActor()`, `_onDropItemCreate()`, `_onMemberDelete()`, `_onItemDelete()`

- [ ] **Step 1: Create the sheet class**

Create `module/sheets/headquarters-sheet.mjs`:

```javascript
export class MarvelMultiverseHeadquartersSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["marvel-multiverse", "sheet", "actor"],
      width: 600,
      height: 700,
      tabs: [],
    });
  }

  get template() {
    return "systems/marvel-multiverse/templates/actor/actor-headquarters-sheet.hbs";
  }

  getData() {
    const context = super.getData();
    const actorData = context.data;

    context.system = actorData.system;
    context.flags = actorData.flags;

    this._prepareItems(context);
    this._prepareMembers(context);

    context.rollData = context.actor.getRollData();

    return context;
  }

  _prepareItems(context) {
    const hqTags = [];
    const hqTraits = [];

    for (const i of context.items) {
      i.img = i.img || Item.DEFAULT_ICON;
      if (i.type === "hqTag") hqTags.push(i);
      else if (i.type === "hqTrait") hqTraits.push(i);
    }

    hqTags.sort((a, b) => a.name.localeCompare(b.name));
    hqTraits.sort((a, b) => a.name.localeCompare(b.name));

    context.hqTags = hqTags;
    context.hqTraits = hqTraits;
  }

  _prepareMembers(context) {
    context.members = context.system.members.map(m => {
      const actor = game.actors?.get(m.actorId);
      return {
        actorId: m.actorId,
        name: actor?.name ?? m.name,
        img: actor?.img ?? m.img,
        rank: actor?.system?.attributes?.rank?.value ?? "?",
      };
    });
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.on("click", ".item-edit", (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.sheet.render(true);
    });

    if (!this.isEditable) return;

    html.on("click", ".item-delete", (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      this.actor.deleteEmbeddedDocuments("Item", [li.data("itemId")]);
      li.slideUp(200, () => this.render(false));
    });

    html.on("click", ".member-delete", this._onMemberDelete.bind(this));
  }

  async _onMemberDelete(event) {
    event.preventDefault();
    const index = Number(event.currentTarget.dataset.index);
    const members = foundry.utils.deepClone(this.actor.system.members);
    members.splice(index, 1);
    await this.actor.update({ "system.members": members });
  }

  async _onDropActor(event, data) {
    if (!this.isEditable) return;

    const actor = await Actor.implementation.fromDropData(data);
    if (!actor) return;

    if (!["character", "npc"].includes(actor.type)) {
      ui.notifications.warn(`Only characters and NPCs can be added as team members.`);
      return;
    }

    const members = foundry.utils.deepClone(this.actor.system.members);

    if (members.some(m => m.actorId === actor.id)) {
      ui.notifications.warn(`${actor.name} ${game.i18n.localize("MARVEL_MULTIVERSE.Headquarters.MemberAlreadyAdded")}`);
      return;
    }

    members.push({
      actorId: actor.id,
      name: actor.name,
      img: actor.img,
    });

    await this.actor.update({ "system.members": members });
  }

  async _onDropItemCreate(itemData) {
    const allowedTypes = ["hqTag", "hqTrait"];
    const items = Array.isArray(itemData) ? itemData : [itemData];

    for (const item of items) {
      if (!allowedTypes.includes(item.type)) {
        ui.notifications.warn(`Headquarters cannot hold ${item.type} items.`);
        return;
      }

      if (item.type === "hqTag") {
        const incomingIncompat = (item.system?.incompatible ?? "").split(",").map(s => s.trim()).filter(Boolean);
        const existingTags = this.actor.items.filter(i => i.type === "hqTag");

        for (const existing of existingTags) {
          const existingIncompat = (existing.system?.incompatible ?? "").split(",").map(s => s.trim()).filter(Boolean);
          if (incomingIncompat.includes(existing.name) || existingIncompat.includes(item.name)) {
            ui.notifications.warn(
              `${item.name} ${game.i18n.localize("MARVEL_MULTIVERSE.Headquarters.IncompatibleTag")} ${existing.name}.`
            );
            return;
          }
        }
      }
    }

    return super._onDropItemCreate(itemData);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add module/sheets/headquarters-sheet.mjs
git commit -m "Add headquarters sheet class with drop handlers and incompatibility enforcement (#69)"
```

---

### Task 4: Sheet Template, Item Templates, and SCSS

**Files:**
- Create: `templates/actor/actor-headquarters-sheet.hbs`
- Create: `templates/item/item-hqTag-sheet.hbs`
- Create: `templates/item/item-hqTrait-sheet.hbs`
- Create: `src/scss/sheets/_headquarters.scss`
- Modify: `src/scss/marvel-multiverse.scss`

**Interfaces:**
- Consumes: Template context from `MarvelMultiverseHeadquartersSheet.getData()` (Task 3) — `system`, `members`, `hqTags`, `hqTraits`, `actor`, `editable`
- Produces: Rendered HTML for the headquarters actor sheet and hqTag/hqTrait item sheets

- [ ] **Step 1: Create the headquarters actor sheet template**

Create `templates/actor/actor-headquarters-sheet.hbs`:

```handlebars
<form class="{{cssClass}} headquarters flexcol" autocomplete="off">
  {{!-- Sheet Header --}}
  <header class="sheet-header">
    <div class="flexrow">
      <div class="flexcol -gap-sm -grow-2">
        {{!-- HQ Name --}}
        <div class="mm-styled-field">
          <label class="mm-styled-label -align-left" for="name"><span>{{localize "MARVEL_MULTIVERSE.ActorType.Headquarters"}}</span></label>
          <div class="mm-styled-input">
            <input name="name" type="text" value="{{actor.name}}" placeholder="Headquarters Name"/>
          </div>
        </div>

        <div class="flexrow -nowrap mm-hq-portrait-row">
          {{!-- Portrait --}}
          <div class="mm-hq-portrait-block">
            <div class="mm-hero-portrait">
              <img src="{{actor.img}}" data-edit="img" title="{{actor.name}}"/>
            </div>
          </div>

          {{!-- Stats --}}
          <div class="flexrow -nowrap mm-hq-header-stats">
            {{!-- Health --}}
            <div class="mm-hq-stat-block mm-hq-health-{{system.health.status}}">
              <span class="mm-hq-stat-label">{{localize "MARVEL_MULTIVERSE.Headquarters.Health"}}</span>
              <div class="mm-hq-stat-input">
                <input type="number" name="system.health.value" value="{{system.health.value}}" data-dtype="Number" min="0"/>
                <span>/</span>
                <span>{{system.health.max}}</span>
              </div>
              <span class="mm-hq-status-badge {{#if system.health.damaged}}-warning{{/if}} {{#if system.health.destroyed}}-destroyed{{/if}}">
                {{#if system.health.destroyed}}
                  {{localize "MARVEL_MULTIVERSE.Headquarters.Status.Destroyed"}}
                {{else if system.health.damaged}}
                  {{localize "MARVEL_MULTIVERSE.Headquarters.Status.Damaged"}}
                {{else}}
                  {{localize "MARVEL_MULTIVERSE.Headquarters.Status.Operational"}}
                {{/if}}
              </span>
            </div>

            {{!-- Team Rank & Trait Slots --}}
            <div class="mm-hq-info-block">
              <div class="mm-hq-info-field">
                <label class="mm-hq-info-label">{{localize "MARVEL_MULTIVERSE.Headquarters.TeamRank"}}</label>
                <span class="mm-hq-info-value">{{system.teamRank}}</span>
              </div>
              <div class="mm-hq-info-field">
                <label class="mm-hq-info-label">{{localize "MARVEL_MULTIVERSE.Headquarters.TraitSlots"}}</label>
                <span class="mm-hq-info-value">{{system.traitCount}} / {{system.traitSlots}}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </header>

  {{!-- Sheet Body --}}
  <section class="sheet-body">
    <div class="mm-hq-scroll">

      {{!-- Members --}}
      <div class="mm-styled-container">
        <h3>{{localize "MARVEL_MULTIVERSE.Headquarters.Members"}}</h3>
        <div class="mm-styled-container-body mm-hq-members-drop-zone">
          {{#if members.length}}
            <ul class="mm-hq-members-list">
              {{#each members as |member idx|}}
              <li class="flexrow mm-hq-member" data-index="{{idx}}">
                <div class="mm-hq-member-img">
                  <img src="{{member.img}}" width="30" height="30"/>
                </div>
                <span class="mm-hq-member-name">{{member.name}}</span>
                <span class="mm-hq-member-rank">{{localize "MARVEL_MULTIVERSE.Headquarters.Rank"}} {{member.rank}}</span>
                {{#if @root.editable}}
                <div class="mm-hq-member-controls">
                  <a class="member-delete" data-index="{{idx}}" title="Remove"><i class="fas fa-trash"></i></a>
                </div>
                {{/if}}
              </li>
              {{/each}}
            </ul>
          {{else}}
            <p class="mm-hq-member-empty">{{localize "MARVEL_MULTIVERSE.Headquarters.DropMember"}}</p>
          {{/if}}
        </div>
      </div>

      {{!-- Tags --}}
      <div class="mm-styled-container">
        <h3>{{localize "MARVEL_MULTIVERSE.Headquarters.Tags"}}</h3>
        <div class="mm-styled-container-body">
          {{#if hqTags.length}}
            <ul class="mm-hq-tags-list">
              {{#each hqTags as |tag|}}
              <li class="flexrow item" data-item-id="{{tag._id}}">
                <div class="item-image"><img src="{{tag.img}}" width="24" height="24"/></div>
                <span class="item-edit mm-hq-tag-name">{{tag.name}}</span>
                {{#if @root.editable}}
                <div class="mm-hq-item-controls">
                  <a class="item-delete" title="Remove"><i class="fas fa-trash"></i></a>
                </div>
                {{/if}}
              </li>
              {{/each}}
            </ul>
          {{else}}
            <p class="mm-hq-empty-section">Drop HQ Tags here</p>
          {{/if}}
        </div>
      </div>

      {{!-- Traits --}}
      <div class="mm-styled-container">
        <h3>{{localize "MARVEL_MULTIVERSE.Headquarters.Traits"}} ({{system.traitCount}} / {{system.traitSlots}})</h3>
        <div class="mm-styled-container-body">
          {{#if hqTraits.length}}
            <ul class="mm-hq-traits-list">
              {{#each hqTraits as |trait|}}
              <li class="item" data-item-id="{{trait._id}}">
                <div class="flexrow mm-hq-trait-row">
                  <div class="item-image"><img src="{{trait.img}}" width="24" height="24"/></div>
                  <span class="item-edit mm-hq-trait-name">{{trait.name}}</span>
                  {{#if @root.editable}}
                  <div class="mm-hq-item-controls">
                    <a class="item-delete" title="Remove"><i class="fas fa-trash"></i></a>
                  </div>
                  {{/if}}
                </div>
                {{#if trait.system.downtimeActivity}}
                <div class="mm-hq-trait-downtime">
                  <strong>{{localize "MARVEL_MULTIVERSE.Headquarters.DowntimeActivity"}}:</strong> {{trait.system.downtimeActivity}}
                </div>
                {{/if}}
              </li>
              {{/each}}
            </ul>
          {{else}}
            <p class="mm-hq-empty-section">Drop HQ Traits here</p>
          {{/if}}
        </div>
      </div>

      {{!-- Description --}}
      <div class="mm-styled-container">
        <h3>{{localize "MARVEL_MULTIVERSE.Headquarters.Description"}}</h3>
        <div class="mm-styled-container-body">
          <div class="mm-styled-field -fill">
            <div class="mm-styled-input">
              {{editor system.description target="system.description" button=false engine="prosemirror" collaborate=false editable=editable}}
            </div>
          </div>
        </div>
      </div>

      {{!-- Notes --}}
      <div class="mm-styled-container">
        <h3>{{localize "MARVEL_MULTIVERSE.Headquarters.Notes"}}</h3>
        <div class="mm-styled-container-body">
          <div class="mm-styled-field -fill">
            <div class="mm-styled-input">
              {{editor system.notes target="system.notes" button=false engine="prosemirror" collaborate=false editable=editable}}
            </div>
          </div>
        </div>
      </div>

    </div>
  </section>
</form>
```

- [ ] **Step 2: Create the hqTag item sheet template**

Create `templates/item/item-hqTag-sheet.hbs`:

```handlebars
<form class="{{cssClass}}" autocomplete="off">
  <header class="sheet-header">
    <div class="mm-styled-field -lg -img">
      <img class="profile-img" src="{{item.img}}" data-edit="img" title="{{item.name}}" />
      <div class="mm-styled-input">
        <input name="name" type="text" value="{{item.name}}" placeholder="Name"/>
      </div>
    </div>
  </header>

  <section class="sheet-body">
    <div class="flexcol -gap-sm">
      <div class="mm-styled-field -fill">
        <label class="mm-styled-label -align-left"><span>Description</span></label>
        <div class="mm-styled-input">
          {{editor system.description target="system.description" button=false engine="prosemirror" collaborate=false}}
        </div>
      </div>
      <div class="mm-styled-field -fill">
        <label class="mm-styled-label -align-left"><span>Incompatible With</span></label>
        <div class="mm-styled-input">
          <input type="text" name="system.incompatible" value="{{join system.incompatible ", "}}" data-dtype="String" placeholder="e.g. Isolated Location, Secret Location"/>
        </div>
      </div>
    </div>
  </section>
</form>
```

- [ ] **Step 3: Create the hqTrait item sheet template**

Create `templates/item/item-hqTrait-sheet.hbs`:

```handlebars
<form class="{{cssClass}}" autocomplete="off">
  <header class="sheet-header">
    <div class="mm-styled-field -lg -img">
      <img class="profile-img" src="{{item.img}}" data-edit="img" title="{{item.name}}" />
      <div class="mm-styled-input">
        <input name="name" type="text" value="{{item.name}}" placeholder="Name"/>
      </div>
    </div>
  </header>

  <section class="sheet-body">
    <div class="flexcol -gap-sm">
      <div class="mm-styled-field -fill">
        <label class="mm-styled-label -align-left"><span>Description</span></label>
        <div class="mm-styled-input">
          {{editor system.description target="system.description" button=false engine="prosemirror" collaborate=false}}
        </div>
      </div>
      <div class="mm-styled-field -fill">
        <label class="mm-styled-label -align-left"><span>{{localize "MARVEL_MULTIVERSE.Headquarters.DowntimeActivity"}}</span></label>
        <div class="mm-styled-input">
          {{editor system.downtimeActivity target="system.downtimeActivity" button=false engine="prosemirror" collaborate=false}}
        </div>
      </div>
      <div class="mm-styled-field -fill">
        <label class="mm-styled-label -align-left"><span>Max Count (0 = unlimited)</span></label>
        <div class="mm-styled-input">
          <input type="number" name="system.maxCount" value="{{system.maxCount}}" data-dtype="Number" min="0"/>
        </div>
      </div>
    </div>
  </section>
</form>
```

- [ ] **Step 4: Create the SCSS partial**

Create `src/scss/sheets/_headquarters.scss`:

```scss
@use "sass:color";
@use "../utils/variables" as *;
@use "../utils/colors" as *;
@use "../utils/typography" as *;

.marvel-multiverse.sheet.actor .headquarters {
  display: flex;
  flex-direction: column;
  height: 100%;

  .sheet-header {
    flex: 0 0 auto;
  }

  .sheet-body {
    flex: 1 1 auto;
    overflow: hidden;
  }
}

.mm-hq-portrait-row {
  gap: $mm-spacing-md;
}

.mm-hq-portrait-block {
  flex: 0 0 120px;

  .mm-hero-portrait {
    width: 120px;
    height: 120px;
  }
}

.mm-hq-header-stats {
  flex: 1 1 auto;
  gap: $mm-spacing-sm;
  align-items: stretch;
}

.mm-hq-stat-block {
  background: $mm-primary-red;
  border-radius: $mm-border-radius-sm;
  color: white;
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  align-items: center;
  padding: $mm-spacing-sm;
  gap: $mm-spacing-xs;
}

.mm-hq-stat-label {
  color: white;
  font-family: $font-secondary;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
}

.mm-hq-stat-input {
  align-items: center;
  background: $mm-input-bg;
  border-radius: $mm-border-radius-sm;
  color: $mm-text-color;
  display: flex;
  font-size: 18px;
  font-weight: 700;
  gap: $mm-spacing-xs;
  justify-content: center;
  padding: $mm-spacing-xs $mm-spacing-sm;
  width: 100%;

  input {
    background: none;
    border: none;
    color: $mm-text-color;
    font-size: 18px;
    font-weight: 700;
    text-align: center;
    width: 50px;

    &:focus {
      box-shadow: 0 0 0 1px $mm-primary-red;
    }
  }

  span {
    color: $mm-subtext-color;
  }
}

.mm-hq-health-operational {
  background: $mm-primary-red;
}

.mm-hq-health-damaged {
  background: #f5a623;
}

.mm-hq-health-destroyed {
  background: $mm-text-color;
}

.mm-hq-status-badge {
  border-radius: 8px;
  font-size: 9px;
  font-weight: 700;
  padding: 1px $mm-spacing-sm;
  text-transform: uppercase;

  &.-warning {
    background: #f5a623;
    color: white;
  }

  &.-destroyed {
    background: $mm-text-color;
    color: white;
  }
}

.mm-hq-info-block {
  background: $mm-primary-red;
  border-radius: $mm-border-radius-sm;
  color: white;
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  justify-content: space-around;
  gap: $mm-spacing-xs;
  padding: $mm-spacing-sm;
}

.mm-hq-info-field {
  align-items: center;
  display: flex;
  gap: $mm-spacing-sm;
}

.mm-hq-info-label {
  flex: 0 0 80px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
}

.mm-hq-info-value {
  background: $mm-input-bg;
  border-radius: $mm-border-radius-sm;
  box-sizing: border-box;
  color: $mm-text-color;
  flex: 1 1 auto;
  font-size: 12px;
  font-weight: 600;
  height: 21px;
  line-height: 21px;
  padding: 0 $mm-spacing-sm;
}

.mm-hq-scroll {
  display: flex;
  flex-direction: column;
  gap: $mm-spacing-md;
  height: 100%;
  overflow-y: auto;
  padding: $mm-spacing-sm;
}

.mm-hq-members-drop-zone {
  min-height: 60px;
}

.mm-hq-members-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.mm-hq-member {
  align-items: center;
  gap: $mm-spacing-sm;
  padding: $mm-spacing-xs $mm-spacing-sm;

  &:nth-child(odd) {
    background: rgba(255, 255, 255, 0.05);
    border-radius: $mm-border-radius-sm;
  }
}

.mm-hq-member-img {
  flex: 0 0 auto;

  img {
    border: 1px solid $mm-primary-red;
    border-radius: $mm-border-radius-sm;
  }
}

.mm-hq-member-name {
  color: $mm-input-bg;
  flex: 1 1 auto;
  font-size: 13px;
  font-weight: 600;
}

.mm-hq-member-rank {
  color: $mm-input-bg;
  font-size: 11px;
  flex: 0 0 auto;
}

.mm-hq-member-controls {
  flex: 0 0 auto;

  a {
    color: $mm-input-bg;
    opacity: 0.7;

    &:hover {
      opacity: 1;
    }
  }
}

.mm-hq-member-empty,
.mm-hq-empty-section {
  color: $mm-input-bg;
  font-size: 12px;
  font-style: italic;
  padding: $mm-spacing-md;
  text-align: center;
}

.mm-hq-tags-list,
.mm-hq-traits-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.mm-hq-tag-name,
.mm-hq-trait-name {
  color: $mm-input-bg;
  cursor: pointer;
  flex: 1 1 auto;
  font-size: 13px;
  font-weight: 600;

  &:hover {
    color: white;
  }
}

.mm-hq-trait-row {
  align-items: center;
  gap: $mm-spacing-sm;
  padding: $mm-spacing-xs $mm-spacing-sm;
}

.mm-hq-traits-list li:nth-child(odd) .mm-hq-trait-row {
  background: rgba(255, 255, 255, 0.05);
  border-radius: $mm-border-radius-sm;
}

.mm-hq-tags-list li {
  padding: $mm-spacing-xs $mm-spacing-sm;

  &:nth-child(odd) {
    background: rgba(255, 255, 255, 0.05);
    border-radius: $mm-border-radius-sm;
  }
}

.mm-hq-item-controls {
  flex: 0 0 24px;
  text-align: right;

  a {
    color: $mm-input-bg;
    opacity: 0.7;

    &:hover {
      opacity: 1;
    }
  }
}

.mm-hq-trait-downtime {
  color: $mm-input-bg;
  font-size: 11px;
  padding: 0 $mm-spacing-sm $mm-spacing-xs 44px;
}
```

- [ ] **Step 5: Add SCSS import to main stylesheet**

Add this line to `src/scss/marvel-multiverse.scss` after the vehicle import:

```scss
@include meta.load-css('sheets/headquarters');
```

- [ ] **Step 6: Build CSS**

Run: `npm run build:css`
Expected: Compiles without errors

- [ ] **Step 7: Commit**

```bash
git add templates/actor/actor-headquarters-sheet.hbs templates/item/item-hqTag-sheet.hbs templates/item/item-hqTrait-sheet.hbs src/scss/sheets/_headquarters.scss src/scss/marvel-multiverse.scss
git commit -m "Add headquarters sheet template, item templates, and styles (#69)"
```

---

### Task 5: Build, Integration Test, and Final Verification

**Files:**
- Modify: `marvel-multiverse.mjs` (rebuild via rollup)
- Test: `module/__tests__/headquarters.test.mjs`

**Interfaces:**
- Consumes: All artifacts from Tasks 1-4
- Produces: Working headquarters system ready for manual E2E testing

- [ ] **Step 1: Run all unit tests**

Run: `npm test`
Expected: All tests PASS, zero regressions

- [ ] **Step 3: Build the full system**

Run: `npm run build:code`
Expected: Rollup compiles without errors, `marvel-multiverse-compiled.mjs` is generated

Run: `npm run build:css`
Expected: SCSS compiles without errors

- [ ] **Step 4: Manual smoke test in FoundryVTT**

Open FoundryVTT in the browser and verify:
1. Create a new Headquarters actor — sheet opens correctly
2. Drag a character actor onto the Members section — member appears with rank
3. Verify team rank auto-calculates
4. Create an hqTrait item and drag onto the HQ — appears in Traits section
5. Verify health.max updates (2 × trait count)
6. Create an hqTag item with `incompatible: "Isolated Location"` and name it "Central Location"
7. Create an hqTag item named "Isolated Location" with `incompatible: "Central Location"`
8. Add "Central Location" to HQ, then try adding "Isolated Location" — verify rejection warning
9. Edit health value down — verify status changes to Damaged then Destroyed
10. Delete members/tags/traits — verify removal

- [ ] **Step 5: Commit the build output**

```bash
git add marvel-multiverse.mjs
git commit -m "Rebuild compiled output with headquarters system (#69)"
```
