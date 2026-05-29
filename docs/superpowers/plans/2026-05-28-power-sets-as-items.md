# Power Sets as Items Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert power sets from a hardcoded config object + string field into proper FoundryVTT items that can be drag/dropped, edited, deleted, and displayed as tag boxes on power sheets and character sheets.

**Architecture:** Create a new `powerSet` item type with its own data model, sheet template, and compendium pack. Replace the `system.powerSet` string field on powers with an array of power set item references (stored as `{id, name, img}` objects). Update character/NPC sheet grouping to use the first power set's name. Add tag-box UI with hover-to-delete on both the power edit sheet and character sheet power rows. Migrate existing string-based power set data to reference the new items.

**Tech Stack:** FoundryVTT v12 API, Handlebars templates, vanilla JS/CSS

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `marvel-multiverse.mjs` | Modify | Add `MarvelMultiversePowerSet` data model, register item type, update power data model (`powerSet` string -> `powerSets` array), update character/NPC sheet `_prepareItems` grouping logic, update `_onDropItemCreate` handlers, add power set drop handling on power sheets, add migration in `migrateData`, update `reverseSetList`/`powersets` config usage |
| `system.json` | Modify | Add `powerSet` to item types list, add `powersets` compendium pack entry |
| `templates/item/item-powerset-sheet.hbs` | Create | Edit sheet for power set items (name, icon, description) |
| `templates/item/item-power-sheet.hbs` | Modify | Replace text input with tag-box drop zone for power sets |
| `templates/actor/parts/actor-powers.hbs` | Modify | Update power set header rendering to use item data |
| `css/marvel-multiverse.css` | Modify | Add tag-box styles (`.mm-powerset-tag`, hover X button) |

---

### Task 1: Create the PowerSet Data Model and Register the Item Type

**Files:**
- Modify: `marvel-multiverse.mjs` (lines ~3244, ~3305-3317, ~3444-3452)
- Modify: `system.json` (lines ~46-100, ~102-116)

- [ ] **Step 1: Add `MarvelMultiversePowerSet` class in `marvel-multiverse.mjs`**

Insert after `MarvelMultiverseTrait` class (line ~3243):

```javascript
class MarvelMultiversePowerSet extends MarvelMultiverseItemBase {
  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = super.defineSchema();
    return schema;
  }
}
```

This inherits `description` from `MarvelMultiverseItemBase`. Name and img come from the base `Item` document.

- [ ] **Step 2: Add to the models freeze object**

In the `models` object freeze (line ~3305), add:

```javascript
MarvelMultiversePowerSet: MarvelMultiversePowerSet,
```

- [ ] **Step 3: Register the data model**

In `CONFIG.Item.dataModels` (line ~3444), add:

```javascript
powerSet: MarvelMultiversePowerSet,
```

- [ ] **Step 4: Add compendium pack in `system.json`**

In the `packs` array, add a new entry:

```json
{
    "name": "powersets",
    "label": "Power Sets",
    "system": "marvel-multiverse",
    "path": "packs/powersets",
    "type": "Item",
    "private": false,
    "flags": {}
}
```

- [ ] **Step 5: Add to packFolders in `system.json`**

In the `packFolders[0].packs` array, add `"powersets"`.

- [ ] **Step 6: Create the empty LevelDB pack directory**

Create directory: `packs/powersets/`

- [ ] **Step 7: Commit**

```
feat: add PowerSet item type and compendium pack
```

---

### Task 2: Create the Power Set Item Sheet Template

**Files:**
- Create: `templates/item/item-powerset-sheet.hbs`

- [ ] **Step 1: Create `item-powerset-sheet.hbs`**

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

  {{!-- Sheet Tab Navigation --}}
  <nav class="sheet-tabs tabs mm-tabs -two" data-group="primary">
    <a class="item" data-tab="attributes">Attributes</a>
    <a class="item" data-tab="effects">Effects</a>
  </nav>

  {{!-- Sheet Body --}}
  <section class="sheet-body">

   {{!-- Attributes Tab --}}
    <div class="tab flexcol -gap-sm" data-group="primary" data-tab="attributes">
      <div class="mm-styled-field -fill">
        <label class="mm-styled-label -align-left rollable" for="system.description" data-label="description"><span>Description</span></label>
        <div class="mm-styled-input">
          {{editor system.description target="system.description" button=false engine="prosemirror" collaborate=false}}
        </div>
      </div>
    </div>
    {{!-- Effects Tab --}}
    <div class="tab powerset-effects" data-group="primary" data-tab="effects">
       {{> "systems/marvel-multiverse/templates/item/parts/item-effects.hbs"}}
    </div>
  </section>

</form>
```

- [ ] **Step 2: Commit**

```
feat: add power set item sheet template
```

---

### Task 3: Update the Power Data Model to Support Multiple Power Sets

**Files:**
- Modify: `marvel-multiverse.mjs` — `MarvelMultiversePower.defineSchema()` (line ~3253), `MarvelMultiversePower.migrateData()` (line ~3293)

- [ ] **Step 1: Add `powerSets` array field alongside existing `powerSet` string**

In `MarvelMultiversePower.defineSchema()`, after `schema.powerSet`, add:

```javascript
schema.powerSets = new fields.ArrayField(new fields.ObjectField());
```

Keep the old `powerSet` string field for now — migration will populate `powerSets` from it.

- [ ] **Step 2: Add migration logic in `migrateData`**

Update `MarvelMultiversePower.migrateData()`:

```javascript
static migrateData(source) {
  // Migrate attackAbility to ability.
  if (source.attackAbility) {
    source.ability = source.attackAbility;
    source.attackAbility = undefined;
  }
  // Migrate powerSet string to powerSets array if needed.
  if (source.powerSet && (!source.powerSets || source.powerSets.length === 0)) {
    source.powerSets = source.powerSet.split(",").map(ps => ({
      name: ps.trim(),
      id: null,
      img: null
    }));
  }
  return super.migrateData(source);
}
```

- [ ] **Step 3: Commit**

```
feat: add powerSets array field to power model with migration
```

---

### Task 4: Add Tag-Box CSS Styles

**Files:**
- Modify: `css/marvel-multiverse.css`

- [ ] **Step 1: Add power set tag styles**

Add after the `.mm-item-name` block (around line ~860):

```css
.mm-powerset-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-height: 24px;
  padding: 4px;
  position: relative;
  z-index: 1;
}
.mm-powerset-tag {
  align-items: center;
  background: #e41d18;
  border-radius: 3px;
  color: #fff;
  display: inline-flex;
  font-size: 10px;
  font-weight: 600;
  gap: 4px;
  line-height: 1;
  padding: 3px 6px;
  text-transform: uppercase;
}
.mm-powerset-tag img {
  border: none;
  height: 14px;
  width: 14px;
}
.mm-powerset-tag .mm-powerset-remove {
  cursor: pointer;
  display: none;
  font-size: 8px;
  margin-left: 2px;
}
.mm-powerset-tag:hover .mm-powerset-remove {
  display: inline;
}
.mm-powerset-drop-zone {
  border: 1px dashed rgba(139, 5, 2, 0.3);
  border-radius: 3px;
  color: #c0b8b4;
  font-size: 10px;
  min-height: 24px;
  padding: 4px;
  text-align: center;
}
.mm-powerset-drop-zone.drag-over {
  background: rgba(228, 29, 24, 0.1);
  border-color: #e41d18;
}
```

- [ ] **Step 2: Commit**

```
feat: add power set tag-box CSS styles
```

---

### Task 5: Update the Power Edit Sheet to Show Tag Boxes

**Files:**
- Modify: `templates/item/item-power-sheet.hbs` (lines 45-50)
- Modify: `marvel-multiverse.mjs` — `MarvelMultiverseItemSheet.activateListeners()` (line ~2735) and `MarvelMultiverseItemSheet.getData()` (line ~2667)

- [ ] **Step 1: Replace the power set text input in `item-power-sheet.hbs`**

Replace lines 45-50:

```handlebars
      <div class="mm-styled-field -fill">
        <label class="mm-styled-label -align-left"><span>Power Set</span></label>
        <div class="mm-styled-input">
          <input type="text" name="system.powerSet" value="{{system.powerSet}}" data-dtype="String"/>
        </div>
      </div>
```

With:

```handlebars
      <div class="mm-styled-field -fill">
        <label class="mm-styled-label -align-left"><span>Power Sets</span></label>
        <div class="mm-styled-input">
          <div class="mm-powerset-tags mm-powerset-drop-zone" data-drop-type="powerSet">
            {{#each system.powerSets as |ps idx|}}
              <span class="mm-powerset-tag" data-index="{{idx}}">
                {{#if ps.img}}<img src="{{ps.img}}" />{{/if}}
                {{ps.name}}
                <a class="mm-powerset-remove" data-index="{{idx}}"><i class="fas fa-times"></i></a>
              </span>
            {{/each}}
            {{#unless system.powerSets.length}}
              <span class="mm-powerset-placeholder">Drop power sets here</span>
            {{/unless}}
          </div>
        </div>
      </div>
```

- [ ] **Step 2: Add drop handling in `MarvelMultiverseItemSheet.activateListeners()`**

In `activateListeners()` (after the effect-control handler at line ~2744), add:

```javascript
    // Power set tag removal
    html.on("click", ".mm-powerset-remove", async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const index = Number(ev.currentTarget.dataset.index);
      const powerSets = [...this.item.system.powerSets];
      powerSets.splice(index, 1);
      const powerSet = powerSets.map(ps => ps.name).join(", ");
      await this.item.update({ "system.powerSets": powerSets, "system.powerSet": powerSet });
    });

    // Power set drag-and-drop visual feedback
    const dropZone = html.find(".mm-powerset-drop-zone");
    dropZone.on("dragover", (ev) => {
      ev.preventDefault();
      ev.currentTarget.classList.add("drag-over");
    });
    dropZone.on("dragleave", (ev) => {
      ev.currentTarget.classList.remove("drag-over");
    });
```

- [ ] **Step 3: Override `_onDrop` in `MarvelMultiverseItemSheet`**

Add a `_onDrop` method to `MarvelMultiverseItemSheet`:

```javascript
  async _onDrop(event) {
    const data = TextEditor.getDragData(event);
    if (data?.type !== "Item") return super._onDrop(event);

    const droppedItem = await Item.implementation.fromDropData(data);
    if (droppedItem.type !== "powerSet") return super._onDrop(event);
    if (this.item.type !== "power") return;

    const powerSets = [...this.item.system.powerSets];
    if (powerSets.some(ps => ps.name === droppedItem.name)) return;

    powerSets.push({
      id: droppedItem.id,
      name: droppedItem.name,
      img: droppedItem.img
    });
    const powerSet = powerSets.map(ps => ps.name).join(", ");
    await this.item.update({ "system.powerSets": powerSets, "system.powerSet": powerSet });
  }
```

- [ ] **Step 4: Commit**

```
feat: add tag-box UI for power sets on power edit sheet
```

---

### Task 6: Update Character Sheet Power Grouping

**Files:**
- Modify: `marvel-multiverse.mjs` — `MarvelMultiverseCharacterSheet._prepareItems()` (line ~1870), `MarvelMultiverseCharacterSheet._prepareData()` (line ~1923), `MarvelMultiverseNPCSheet._prepareItems()` (line ~2320), `MarvelMultiverseNPCSheet._prepareCharacterData()` (line ~2377)

- [ ] **Step 1: Update character sheet `_prepareItems` power grouping**

Replace the power grouping logic (lines 1870-1895):

Change:
```javascript
    const powers = Object.fromEntries(
      Object.keys(CONFIG.MARVEL_MULTIVERSE.reverseSetList).map((ps) => [ps, []])
    );
```

To:
```javascript
    const powerSetNames = new Set();
    for (const i of context.items) {
      if (i.type === "power" && i.system.powerSets?.length) {
        powerSetNames.add(i.system.powerSets[0].name);
      } else if (i.type === "power") {
        powerSetNames.add(i.system.powerSet?.split(",")[0]?.trim() || "Basic");
      }
    }
    const powers = {};
    for (const name of [...powerSetNames].sort()) {
      powers[name] = [];
    }
```

And update the power classification inside the `for` loop:

Change:
```javascript
      } else if (i.type === "power") {
        const powersets = i.system.powerSet.split(",");
        powers[powersets[0].trim()].push(i);
      }
```

To:
```javascript
      } else if (i.type === "power") {
        const firstSet = i.system.powerSets?.length
          ? i.system.powerSets[0].name
          : (i.system.powerSet?.split(",")[0]?.trim() || "Basic");
        if (!powers[firstSet]) powers[firstSet] = [];
        powers[firstSet].push(i);
      }
```

- [ ] **Step 2: Update character sheet `_prepareData` power grouping**

Replace lines 1923-1928:

Change:
```javascript
    for (const i of context.items.filter((item) => item.type === "power")) {
      const mappedPowersets = i.system.powerSet
        .split(",")
        .map((ps) => CONFIG.MARVEL_MULTIVERSE.reverseSetList[ps.trim()]);
      context.system.powers[mappedPowersets[0]].push(i);
    }
```

To:
```javascript
    for (const i of context.items.filter((item) => item.type === "power")) {
      const firstSet = i.system.powerSets?.length
        ? i.system.powerSets[0].name
        : (i.system.powerSet?.split(",")[0]?.trim() || "Basic");
      const key = CONFIG.MARVEL_MULTIVERSE.reverseSetList[firstSet];
      if (key && context.system.powers[key]) {
        context.system.powers[key].push(i);
      }
    }
```

- [ ] **Step 3: Apply identical changes to NPC sheet `_prepareItems` and `_prepareCharacterData`**

Repeat the same pattern for the NPC sheet methods at lines ~2320-2345 and ~2377-2382.

NPC `_prepareItems` — same change as Step 1 (replace the `powers` initialization and the `else if (i.type === "power")` block).

NPC `_prepareCharacterData` — same change as Step 2.

- [ ] **Step 4: Update `hasElementalPowers` check**

In both sheets, update:

```javascript
context.hasElementalPowers = (powers["Elemental Control"] ?? []).length > 0;
```

This still works since we now key by label name directly.

- [ ] **Step 5: Commit**

```
feat: update power grouping to use powerSets array
```

---

### Task 7: Update the Actor Powers Template Header

**Files:**
- Modify: `templates/actor/parts/actor-powers.hbs` (line 5)

- [ ] **Step 1: Update power set header to use the label directly**

The `{{localize "MARVEL_MULTIVERSE.Item.Power.PowerSET" set=powerSet}}` call uses the config key. Since we now key by label name directly, change line 5:

```handlebars
        <span>{{powerSet}}</span>
```

This replaces:
```handlebars
        <span>{{localize "MARVEL_MULTIVERSE.Item.Power.PowerSET" set=powerSet}}</span>
```

- [ ] **Step 2: Commit**

```
feat: simplify power set header display
```

---

### Task 8: Update Drop Handlers for Elemental Control Check

**Files:**
- Modify: `marvel-multiverse.mjs` — character sheet `_onDropItemCreate` (line ~2076), NPC sheet `_onDropItemCreate` (line ~2530)

- [ ] **Step 1: Update Elemental Control check in character sheet drop handler**

Change:
```javascript
        itemData.system.powerSet === "Elemental Control"
```

To:
```javascript
        (itemData.system.powerSets?.some(ps => ps.name === "Elemental Control") ||
         itemData.system.powerSet === "Elemental Control")
```

- [ ] **Step 2: Apply same change in NPC sheet drop handler**

Same replacement at line ~2530.

- [ ] **Step 3: Commit**

```
feat: update Elemental Control drop check for powerSets array
```

---

### Task 9: Update Chat Message Label for Power Sets

**Files:**
- Modify: `marvel-multiverse.mjs` — `item.roll()` method (line ~450)

- [ ] **Step 1: Update the `typeName` to include power set info when relevant**

No changes needed here — the chat header already uses `this.type` which will still be "power". The power set names are not currently shown in chat and don't need to be.

This task is a no-op unless the user wants power set names in chat. Skip.

---

### Task 10: Create Power Set Items in the Compendium

**Files:**
- The compendium pack at `packs/powersets/` (LevelDB, must be created via FoundryVTT UI)

- [ ] **Step 1: Create power set items via FoundryVTT**

After launching FoundryVTT with the updated system, create the following items in the Power Sets compendium. Each is a `powerSet` type item with just a name and appropriate icon:

1. Basic
2. Elemental Control
3. Healing
4. Illusion
5. Luck
6. Magic
7. Martial Arts
8. Melee Weapons
9. Narrative
10. Omniversal Travel
11. Phasing
12. Plasticity
13. Power Control
14. Ranged Weapons
15. Resize
16. Shield Bearer
17. Sixth Sense
18. Spider-Powers
19. Super-Speed
20. Super-Strength
21. Tactics
22. Telekinesis
23. Telepathy
24. Teleportation
25. Translation
26. Weather Control

- [ ] **Step 2: Commit the generated LevelDB pack files**

```
feat: add power set compendium items
```

---

### Task 11: Retroactively Update Existing Power Items in Compendium

- [ ] **Step 1: Update existing powers in FoundryVTT**

Open each power in the Powers compendium, drag the appropriate power set item(s) onto its power set tag area, and save. The migration in `migrateData` will handle the initial `powerSets` array creation from the string, but the `id` and `img` fields will be `null` until a real power set item is linked.

This is a manual step done in FoundryVTT, or can be scripted via a world script/macro.

- [ ] **Step 2: Commit updated pack files**

```
feat: link existing powers to power set items
```

---

## Notes

- The `MARVEL_MULTIVERSE.powersets` config and `reverseSetList` can remain as a fallback for un-migrated data but are no longer the source of truth for grouping.
- The `system.powerSet` string field is kept for backwards compatibility and is synced whenever `powerSets` changes (written as a comma-joined string). This means existing code that reads `powerSet` as a string still works during migration.
- Tasks 10-11 require FoundryVTT to be running and cannot be done purely via code edits.
