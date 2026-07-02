# Equipment Item Type Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `equipment` item type with three subtypes (protection, grenade, gadget) that integrates with the existing damage reduction system via Active Effects.

**Architecture:** Single `equipment` item type with flat data model. An `equipmentType` enum switches which fields display on the sheet. Protection items auto-apply DR via Active Effects on equip. Grenades and gadgets are descriptive only.

**Tech Stack:** FoundryVTT v13, Handlebars templates, ES modules

## Global Constraints

- FoundryVTT v13 APIs only
- Follow existing codebase patterns (flat schemas extending `MarvelMultiverseItemBase`)
- Source modules live in `module/data/`, templates in `templates/item/`
- The compiled bundle `marvel-multiverse.mjs` must be updated in sync with source modules
- No Marvel IP in the system repo (character names, team names, etc.)

---

### Task 1: Data Model, Config, and Registration

Create the equipment data model, config enums, register the new type, and add localization strings. This is the foundation everything else builds on.

**Files:**
- Create: `module/data/equipment.mjs`
- Modify: `module/data/_module.mjs` (line 19, add export)
- Modify: `template.json` (line 12, add to Item types)
- Modify: `module/config.mjs` (after line 774, add enums)
- Modify: `lang/en.json` (add equipment strings)
- Modify: `marvel-multiverse.mjs` (line ~4712, add class; line 5388, add to dataModels)

**Produces:**
- `MarvelMultiverseEquipment` class (used by Task 2 template, Task 3 actor sheets)
- `MARVEL_MULTIVERSE.equipmentTypes` config enum (used by Task 2 template)
- `MARVEL_MULTIVERSE.grenadeTypes` config enum (used by Task 2 template)

- [ ] **Step 1: Create `module/data/equipment.mjs`**

```js
import MarvelMultiverseItemBase from "./item-base.mjs";

export default class MarvelMultiverseEquipment extends MarvelMultiverseItemBase {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.equipmentType = new fields.StringField({
      required: true,
      initial: "protection",
    });
    schema.equipped = new fields.BooleanField({
      required: true,
      initial: false,
    });
    schema.ruined = new fields.BooleanField({
      required: true,
      initial: false,
    });

    // Protection fields
    schema.damageReduction = new fields.NumberField({
      ...requiredInteger,
      initial: 0,
      min: 0,
    });
    schema.protectionNotes = new fields.StringField({
      required: true,
      blank: true,
    });

    // Grenade fields
    schema.grenadeType = new fields.StringField({
      required: true,
      blank: true,
    });
    schema.grenadeEffect = new fields.StringField({
      required: true,
      blank: true,
    });

    // Gadget fields
    schema.gadgetHP = new fields.NumberField({
      ...requiredInteger,
      initial: 10,
      min: 0,
    });
    schema.gadgetMaxHP = new fields.NumberField({
      ...requiredInteger,
      initial: 10,
      min: 0,
    });
    schema.gadgetEffect = new fields.StringField({
      required: true,
      blank: true,
    });

    return schema;
  }
}
```

- [ ] **Step 2: Export from `module/data/_module.mjs`**

Add after line 11 (`export {default as MarvelMultiverseWeapon} from "./weapon.mjs";`):

```js
export {default as MarvelMultiverseEquipment} from "./equipment.mjs";
```

- [ ] **Step 3: Add `"equipment"` to `template.json`**

Add `"equipment"` to the Item types array (after `"battleSuit"`, before `"vehicleWeapon"`):

```json
{
  "Item": {
    "types": [
      "item",
      "iconicItem",
      "weapon",
      "trait",
      "tag",
      "origin",
      "occupation",
      "power",
      "powerSet",
      "restriction",
      "battleSuit",
      "equipment",
      "vehicleWeapon"
    ]
  }
}
```

- [ ] **Step 4: Add config enums to `module/config.mjs`**

Add before the ASCII art block (before line 775):

```js
MARVEL_MULTIVERSE.equipmentTypes = {
  protection: "MARVEL_MULTIVERSE.Equipment.Protection",
  grenade: "MARVEL_MULTIVERSE.Equipment.Grenade",
  gadget: "MARVEL_MULTIVERSE.Equipment.Gadget",
};

MARVEL_MULTIVERSE.grenadeTypes = {
  explosive: "MARVEL_MULTIVERSE.Equipment.Grenade.Explosive",
  flashbang: "MARVEL_MULTIVERSE.Equipment.Grenade.Flashbang",
  gas: "MARVEL_MULTIVERSE.Equipment.Grenade.Gas",
  smoke: "MARVEL_MULTIVERSE.Equipment.Grenade.Smoke",
};
```

- [ ] **Step 5: Add localization strings to `lang/en.json`**

Add an `"Equipment"` section inside the `"MARVEL_MULTIVERSE"` object:

```json
"Equipment": {
  "Protection": "Protection",
  "Grenade": {
    "label": "Grenade",
    "Explosive": "Explosive",
    "Flashbang": "Flashbang",
    "Gas": "Gas",
    "Smoke": "Smoke"
  },
  "Gadget": "Gadget"
}
```

- [ ] **Step 6: Add `MarvelMultiverseEquipment` class to `marvel-multiverse.mjs`**

Add the class after `MarvelMultiverseBattleSuit` (after line 4712, before `MarvelMultiversePowerSet`):

```js
class MarvelMultiverseEquipment extends MarvelMultiverseItemBase {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.equipmentType = new fields.StringField({
      required: true,
      initial: "protection",
    });
    schema.equipped = new fields.BooleanField({
      required: true,
      initial: false,
    });
    schema.ruined = new fields.BooleanField({
      required: true,
      initial: false,
    });

    schema.damageReduction = new fields.NumberField({
      ...requiredInteger,
      initial: 0,
      min: 0,
    });
    schema.protectionNotes = new fields.StringField({
      required: true,
      blank: true,
    });

    schema.grenadeType = new fields.StringField({
      required: true,
      blank: true,
    });
    schema.grenadeEffect = new fields.StringField({
      required: true,
      blank: true,
    });

    schema.gadgetHP = new fields.NumberField({
      ...requiredInteger,
      initial: 10,
      min: 0,
    });
    schema.gadgetMaxHP = new fields.NumberField({
      ...requiredInteger,
      initial: 10,
      min: 0,
    });
    schema.gadgetEffect = new fields.StringField({
      required: true,
      blank: true,
    });

    return schema;
  }
}
```

- [ ] **Step 7: Register equipment in `CONFIG.Item.dataModels`**

In `marvel-multiverse.mjs`, add `equipment: MarvelMultiverseEquipment,` to `CONFIG.Item.dataModels` (after the `battleSuit` entry at line 5387):

```js
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
  };
```

- [ ] **Step 8: Commit**

```bash
git add module/data/equipment.mjs module/data/_module.mjs template.json module/config.mjs lang/en.json marvel-multiverse.mjs
git commit -m "Add equipment data model, config enums, and registration (#67)"
```

---

### Task 2: Equipment Item Sheet Template and Sheet Context

Create the Handlebars template for the equipment item sheet and add equipment-specific context data to the item sheet class.

**Files:**
- Create: `templates/item/item-equipment-sheet.hbs`
- Modify: `module/sheets/item-sheet.mjs` (line ~107, add equipment context in `getData()`)
- Modify: `marvel-multiverse.mjs` (mirror the `getData()` change in the compiled `MarvelMultiverseItemSheet`)

**Consumes:**
- `MARVEL_MULTIVERSE.equipmentTypes` from config (Task 1)
- `MARVEL_MULTIVERSE.grenadeTypes` from config (Task 1)

**Produces:**
- Equipment item sheet UI (used by Task 3 for rendering on actor sheets)

- [ ] **Step 1: Create `templates/item/item-equipment-sheet.hbs`**

```hbs
<form class="{{cssClass}}" autocomplete="off">
  <header class="sheet-header">
    <div class="mm-styled-field -lg -img">
      <img class="profile-img" src="{{item.img}}" data-edit="img" title="{{item.name}}" />
      <div class="mm-styled-input">
        <input name="name" type="text" value="{{item.name}}" placeholder="Name"/>
      </div>
    </div>
  </header>

  {{!-- Sheet Tab Navigation --}}
  <nav class="sheet-tabs tabs mm-tabs -two" data-group="primary">
    <a class="item" data-tab="attributes">Attributes</a>
    <a class="item" data-tab="effects">Effects</a>
  </nav>

  {{!-- Sheet Body --}}
  <section class="sheet-body">
    {{!-- Attributes Tab --}}
    <div class="tab equipment-attributes" data-group="primary" data-tab="attributes">
      {{> "systems/marvel-multiverse/templates/item/parts/item-source.hbs"}}
      <div class="mm-styled-field -fill">
        <label class="mm-styled-label -align-left" for="system.description"><span>Description</span></label>
        <div class="mm-styled-input">
          {{editor system.description target="system.description" button=false engine="prosemirror" collaborate=false editable=editable}}
        </div>
      </div>
      <div class="mm-styled-field -sm">
        <label class="mm-styled-label -align-left"><span>Equipment Type</span></label>
        <div class="mm-styled-input">
          <select name="system.equipmentType">
            {{selectOptions equipmentTypes selected=system.equipmentType}}
          </select>
        </div>
      </div>
      <div class="mm-styled-field -fill">
        <label class="mm-styled-label -align-left"><span>Equipped</span></label>
        <div class="mm-styled-input">
          <input type="checkbox" name="system.equipped" {{checked system.equipped}}>
        </div>
      </div>

      {{!-- Protection Fields --}}
      {{#if (eq system.equipmentType "protection")}}
        <div class="mm-styled-field -fill">
          <label class="mm-styled-label -align-left"><span>Ruined</span></label>
          <div class="mm-styled-input">
            <input type="checkbox" name="system.ruined" {{checked system.ruined}}>
          </div>
        </div>
        <div class="mm-styled-field -fill">
          <label class="mm-styled-label -align-left"><span>Damage Reduction</span></label>
          <div class="mm-styled-input">
            <input type="number" name="system.damageReduction" value="{{system.damageReduction}}" min="0" data-dtype="Number"/>
          </div>
        </div>
        <div class="mm-styled-field -fill">
          <label class="mm-styled-label -align-left"><span>Notes</span></label>
          <div class="mm-styled-input">
            <input type="text" name="system.protectionNotes" value="{{system.protectionNotes}}" data-dtype="String"/>
          </div>
        </div>
      {{/if}}

      {{!-- Grenade Fields --}}
      {{#if (eq system.equipmentType "grenade")}}
        <div class="mm-styled-field -sm">
          <label class="mm-styled-label -align-left"><span>Grenade Type</span></label>
          <div class="mm-styled-input">
            <select name="system.grenadeType">
              {{selectOptions grenadeTypes selected=system.grenadeType}}
            </select>
          </div>
        </div>
        <div class="mm-styled-field -fill">
          <label class="mm-styled-label -align-left"><span>Effect</span></label>
          <div class="mm-styled-input">
            <textarea name="system.grenadeEffect" data-dtype="String">{{system.grenadeEffect}}</textarea>
          </div>
        </div>
      {{/if}}

      {{!-- Gadget Fields --}}
      {{#if (eq system.equipmentType "gadget")}}
        <div class="mm-styled-field -fill">
          <label class="mm-styled-label -align-left"><span>HP</span></label>
          <div class="mm-styled-input">
            <input type="number" name="system.gadgetHP" value="{{system.gadgetHP}}" min="0" data-dtype="Number"/>
            <span>/</span>
            <input type="number" name="system.gadgetMaxHP" value="{{system.gadgetMaxHP}}" min="0" data-dtype="Number"/>
          </div>
        </div>
        <div class="mm-styled-field -fill">
          <label class="mm-styled-label -align-left"><span>Effect</span></label>
          <div class="mm-styled-input">
            <textarea name="system.gadgetEffect" data-dtype="String">{{system.gadgetEffect}}</textarea>
          </div>
        </div>
      {{/if}}
    </div>

    {{!-- Effects Tab --}}
    <div class="tab equipment-effects" data-group="primary" data-tab="effects">
      {{> "systems/marvel-multiverse/templates/item/parts/item-effects.hbs"}}
    </div>
  </section>
</form>
```

- [ ] **Step 2: Add equipment context in `module/sheets/item-sheet.mjs`**

Add after the `iconicItem` block (after line 154, before `return context;`):

```js
    if (itemData.type === "equipment") {
      context.equipmentTypes = Object.fromEntries(
        Object.keys(CONFIG.MARVEL_MULTIVERSE.equipmentTypes).map((k) => [
          k,
          game.i18n.localize(CONFIG.MARVEL_MULTIVERSE.equipmentTypes[k]),
        ])
      );
      context.grenadeTypes = Object.fromEntries(
        Object.keys(CONFIG.MARVEL_MULTIVERSE.grenadeTypes).map((k) => [
          k,
          game.i18n.localize(CONFIG.MARVEL_MULTIVERSE.grenadeTypes[k]),
        ])
      );
    }
```

- [ ] **Step 3: Mirror the `getData()` change in `marvel-multiverse.mjs`**

Find the compiled `getData()` in the `MarvelMultiverseItemSheet` class in `marvel-multiverse.mjs` (search for the `iconicItem` context block ending with `context.sortedRestrictions`). Add the same equipment context block after that `iconicItem` block, before `return context;`.

- [ ] **Step 4: Commit**

```bash
git add templates/item/item-equipment-sheet.hbs module/sheets/item-sheet.mjs marvel-multiverse.mjs
git commit -m "Add equipment item sheet template and context (#67)"
```

---

### Task 3: Actor Sheet Integration and Equip/Unequip Logic

Add equipment to both character and NPC actor sheet item categorization, render equipment in the Gear tab, and implement equip/unequip toggle with Active Effect management for protection DR.

**Files:**
- Create: `templates/actor/parts/actor-equipment.hbs`
- Modify: `templates/actor/actor-character-sheet.hbs` (line 297, include equipment partial)
- Modify: `templates/actor/actor-npc-sheet.hbs` (include equipment partial in gear section)
- Modify: `marvel-multiverse.mjs`:
  - Character `_prepareItems()` (~line 2103): add `equipment` array
  - NPC `_prepareItems()` (~line 2924): add `equipment` array
  - Character `activateListeners()`: add equip toggle handler + delete cleanup
  - NPC `activateListeners()`: add equip toggle handler + delete cleanup
  - Add `_onToggleEquipmentEquip()`, `_removeEquipmentEffects()`, `_applyEquipmentEffects()` to both sheet classes

**Consumes:**
- `MarvelMultiverseEquipment` data model (Task 1)
- Equipment item sheet template (Task 2)

- [ ] **Step 1: Create `templates/actor/parts/actor-equipment.hbs`**

```hbs
<ol class="mm-item-list">
  <li class="flexrow item mm-item-header">
    <span>Equipment</span>
    <hr />
    <div class="item-controls">
      <a
        class="item-control item-create"
        title="{{localize 'DOCUMENT.Create' type="Item"}}"
        data-type="equipment"
      >
        <i class="fas fa-plus"></i>
      </a>
    </div>
  </li>
  {{#each equipment as |item id|}}
    <li class="flexrow item mm-item {{#if item.system.equipped}}mm-equipped{{/if}} {{#if item.system.ruined}}mm-ruined{{/if}}" data-item-id='{{item._id}}'>
      <div class="item-name mm-item-name">
        <a>
          <span>{{item.name}}</span>
          <span class="mm-item-subtext">
            {{item.equipmentTypeLabel}}
            {{#if (eq item.system.equipmentType "protection")}}
              {{#if item.system.damageReduction}}— DR {{item.system.damageReduction}}{{/if}}
              {{#if item.system.ruined}} (Ruined){{/if}}
            {{/if}}
            {{#if (eq item.system.equipmentType "grenade")}}
              {{#if item.system.grenadeType}}— {{item.grenadeTypeLabel}}{{/if}}
            {{/if}}
            {{#if (eq item.system.equipmentType "gadget")}}
              — HP {{item.system.gadgetHP}}/{{item.system.gadgetMaxHP}}
            {{/if}}
          </span>
        </a>
      </div>
      <div class="mm-item-detail">
        <a class="item-control equipment-equip-toggle" data-item-id="{{item._id}}" title="{{#if item.system.equipped}}Unequip{{else}}Equip{{/if}}">
          <i class="fas {{#if item.system.equipped}}fa-toggle-on mm-equipped-icon{{else}}fa-toggle-off{{/if}}"></i>
        </a>
      </div>
      <div class="item-controls">
        <a
          class="item-control item-edit"
          title="{{localize 'DOCUMENT.Update' type="Item"}}"
        >
          <i class="fas fa-edit"></i>
        </a>
        <a
          class="item-control item-delete"
          title="{{localize 'DOCUMENT.Delete' type="Item"}}"
        >
          <i class="fas fa-trash"></i>
        </a>
      </div>
    </li>
  {{/each}}
</ol>
```

- [ ] **Step 2: Include equipment partial in character sheet**

In `templates/actor/actor-character-sheet.hbs`, add after line 297 (`actor-items.hbs` partial):

```hbs
          {{> "systems/marvel-multiverse/templates/actor/parts/actor-equipment.hbs"}}
```

- [ ] **Step 3: Include equipment partial in NPC sheet**

Find the gear section in `templates/actor/actor-npc-sheet.hbs` and add the equipment partial after the items partial (same pattern as character sheet).

- [ ] **Step 4: Add equipment to character `_prepareItems()` in `marvel-multiverse.mjs`**

In the character sheet's `_prepareItems()` (~line 2103), add `const equipment = [];` to the initializers, add an `else if` branch for `i.type === "equipment"`:

```js
      } else if (i.type === "equipment") {
        i.equipmentTypeLabel = game.i18n.localize(
          CONFIG.MARVEL_MULTIVERSE.equipmentTypes[i.system.equipmentType] ?? ""
        );
        if (i.system.grenadeType) {
          i.grenadeTypeLabel = game.i18n.localize(
            CONFIG.MARVEL_MULTIVERSE.grenadeTypes[i.system.grenadeType] ?? ""
          );
        }
        equipment.push(i);
```

And add `context.equipment = equipment;` alongside the other context assignments.

- [ ] **Step 5: Add equipment to NPC `_prepareItems()` in `marvel-multiverse.mjs`**

Same pattern as Step 4, in the NPC sheet's `_prepareItems()` (~line 2924).

- [ ] **Step 6: Add equip toggle listener and delete cleanup to character sheet**

In the character sheet's `activateListeners()`, add:

```js
    html.on("click", ".equipment-equip-toggle", this._onToggleEquipmentEquip.bind(this));
```

In the item-delete handler (~line 2230), add equipment cleanup alongside battleSuit:

```js
      if (item?.type === "equipment" && item.system.equipped) {
        await this._removeEquipmentEffects(itemId);
      }
```

- [ ] **Step 7: Add equip toggle listener and delete cleanup to NPC sheet**

Same as Step 6, for the NPC sheet class.

- [ ] **Step 8: Add `_onToggleEquipmentEquip`, `_removeEquipmentEffects`, `_applyEquipmentEffects` to character sheet class**

Add these methods to the character sheet class in `marvel-multiverse.mjs` (after `_applyBattleSuitEffects`):

```js
  async _onToggleEquipmentEquip(event) {
    event.preventDefault();
    const itemId = event.currentTarget.dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (!item) return;

    if (item.system.equipped) {
      await this._removeEquipmentEffects(itemId);
      await item.update({ "system.equipped": false });
    } else {
      await item.update({ "system.equipped": true });
      if (item.system.equipmentType === "protection" && !item.system.ruined && item.system.damageReduction > 0) {
        await this._applyEquipmentEffects(item);
      }
    }
  }

  async _removeEquipmentEffects(itemId) {
    const effects = this.actor.effects.filter(e => e.flags?.["marvel-multiverse"]?.equipmentId === itemId);
    if (effects.length) {
      await this.actor.deleteEmbeddedDocuments("ActiveEffect", effects.map(e => e.id));
    }
  }

  async _applyEquipmentEffects(item) {
    const changes = [{
      key: "system.healthDamageReduction",
      mode: 2,
      value: item.system.damageReduction.toString(),
    }];
    await ActiveEffect.create({
      name: `Equipment: ${item.name}`,
      icon: item.img,
      changes: changes,
      flags: { "marvel-multiverse": { equipmentId: item.id } },
    }, { parent: this.actor });
  }
```

- [ ] **Step 9: Add same three methods to NPC sheet class**

Copy the same `_onToggleEquipmentEquip`, `_removeEquipmentEffects`, and `_applyEquipmentEffects` methods to the NPC sheet class.

- [ ] **Step 10: Commit**

```bash
git add templates/actor/parts/actor-equipment.hbs templates/actor/actor-character-sheet.hbs templates/actor/actor-npc-sheet.hbs marvel-multiverse.mjs
git commit -m "Add equipment to actor sheets with equip toggle and DR effects (#67)"
```

---

### Task 4: Manual Testing in FoundryVTT

Verify the full feature works end-to-end in the running FoundryVTT application.

**Consumes:** All previous tasks

- [ ] **Step 1: Launch FoundryVTT and load the marvel-616 world**

- [ ] **Step 2: Create a protection equipment item**

Create a new equipment item from the Items sidebar. Set:
- Equipment Type: Protection
- Name: "Body Armor"
- Damage Reduction: 2
- Notes: "Trouble on Agility"
- Verify the protection-specific fields appear and grenade/gadget fields are hidden

- [ ] **Step 3: Create a grenade equipment item**

Create another equipment item. Set Equipment Type to Grenade. Verify:
- Grenade Type dropdown appears (Explosive, Flashbang, Gas, Smoke)
- Effect textarea appears
- Protection and gadget fields are hidden

- [ ] **Step 4: Create a gadget equipment item**

Create another equipment item. Set Equipment Type to Gadget. Verify:
- HP/MaxHP fields appear (default 10/10)
- Effect textarea appears
- Protection and grenade fields are hidden

- [ ] **Step 5: Test equipment on a character**

Drag Body Armor to a character. Verify:
- It appears in the Equipment section of the Gear tab
- Shows "Protection — DR 2" subtext
- Equip toggle works
- When equipped: an Active Effect "Equipment: Body Armor" appears on the character with `system.healthDamageReduction` +2
- When unequipped: the Active Effect is removed
- Verify `conditionDamageReduction` increases by 10 (2 * 5) when equipped

- [ ] **Step 6: Test ruined state**

Open the Body Armor item sheet, check "Ruined", verify:
- "(Ruined)" appears in the subtext on the actor sheet
- If currently equipped, the DR Active Effect should still be present (ruined only prevents re-application on future equip toggles; to fully handle ruined-while-equipped would require an item update hook, which is out of scope)

- [ ] **Step 7: Test equipment on an NPC**

Drag equipment to an NPC character. Verify same behavior as character sheet.

- [ ] **Step 8: Test deletion cleanup**

Equip armor on a character, then delete the item. Verify the Active Effect is cleaned up.

- [ ] **Step 9: Commit any fixes**

```bash
git add -A
git commit -m "Fix issues found during manual testing (#67)"
```
