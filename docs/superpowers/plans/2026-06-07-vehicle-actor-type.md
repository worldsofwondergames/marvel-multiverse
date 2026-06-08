# Vehicle Actor Type Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `vehicle` actor type with a dedicated tabbed sheet, a `vehicleWeapon` item type, occupant tracking with pilot defense integration, and crash damage calculation.

**Architecture:** Standalone `MarvelMultiverseVehicle` data model (does not extend `MarvelMultiverseActorBase`) with speed fields reusing character movement names (`run`, `flight`, `swim`, `climb`) for Active Effect compatibility. New `MarvelMultiverseVehicleWeapon` item type extending `MarvelMultiverseItemBase`. New `MarvelMultiverseVehicleSheet` extending `ActorSheet` with four tabs: Stats, Occupants, Powers & Weapons, Profile & Notes.

**Tech Stack:** FoundryVTT v12/v13 API, Handlebars templates, vanilla JS/CSS

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `marvel-multiverse.mjs` | Modify | Add `MarvelMultiverseVehicle` data model (~line 3301), `MarvelMultiverseVehicleWeapon` item model (~line 3471), `MarvelMultiverseVehicleSheet` class (~line 2304), vehicle sizes config (~line 697); register all in init hook (~line 3681) |
| `system.json` | Modify | Add `vehicle` actor type, `vehicleWeapon` item type, `vehicles` compendium pack |
| `templates/actor/actor-vehicle-sheet.hbs` | Create | Main vehicle sheet template (tabbed) |
| `templates/actor/parts/actor-vehicle-weapons.hbs` | Create | Vehicle weapon list partial |
| `templates/actor/parts/actor-vehicle-occupants.hbs` | Create | Occupants list partial |
| `templates/item/item-vehicleweapon-sheet.hbs` | Create | Vehicle weapon edit sheet |
| `css/marvel-multiverse.css` | Modify | Vehicle sheet styles |
| `lang/en.json` | Modify | Vehicle and vehicleWeapon localization strings |

---

### Task 1: Register the Vehicle Actor Type and VehicleWeapon Item Type in system.json and lang/en.json

**Files:**
- Modify: `system.json` (lines 46-101, 102-116)
- Modify: `lang/en.json` (lines 98-113)

- [ ] **Step 1: Add `vehicles` compendium pack to `system.json`**

In the `packs` array (after the `items` pack entry at line 100), add:

```json
{
    "name": "vehicles",
    "label": "Vehicles",
    "system": "marvel-multiverse",
    "path": "packs/vehicles",
    "type": "Actor",
    "private": false,
    "flags": {}
}
```

Note: This is an `Actor` pack, not an `Item` pack.

- [ ] **Step 2: Add `"vehicles"` to the `packFolders` array**

In `packFolders[0].packs` (line 107-115), add `"vehicles"` to the array.

- [ ] **Step 3: Add `vehicle` actor type and `vehicleWeapon` item type to `lang/en.json`**

Update the `TYPES` section:

```json
"TYPES": {
    "Actor": {
        "character": "Character",
        "npc": "NPC",
        "vehicle": "Vehicle"
    },
    "Item": {
        "item": "Item",
        "weapon": "Weapon",
        "trait": "Trait",
        "tag": "Tag",
        "origin": "Origin",
        "occupation": "Occupation",
        "power": "Power",
        "powerSet": "Power Set",
        "vehicleWeapon": "Vehicle Weapon"
    }
}
```

- [ ] **Step 4: Add vehicle sheet label and vehicle-specific strings to `lang/en.json`**

In the `MARVEL_MULTIVERSE.SheetLabels` section, add:

```json
"SheetLabels": {
    "Actor": "MarvelMultiverse Actor Sheet",
    "Item": "MarvelMultiverse Item Sheet",
    "NPC": "MarvelMultiverse NPC Sheet",
    "Vehicle": "MarvelMultiverse Vehicle Sheet"
}
```

Add a new `Vehicle` section inside the `MARVEL_MULTIVERSE` object:

```json
"Vehicle": {
    "GroundSpeed": "Ground Speed",
    "FlightSpeed": "Flight Speed",
    "ClimbSpeed": "Climb Speed",
    "NauticalSpeed": "Nautical Speed",
    "DamageReduction": "Damage Reduction",
    "Passengers": "Passengers",
    "Crew": "Crew",
    "SafetyHarness": "Safety Harness",
    "CrashDamage": "Crash Damage Multiplier",
    "Occupants": "Occupants",
    "Pilot": "Pilot",
    "Gunner": "Gunner",
    "Passenger": "Passenger",
    "Unpiloted": "Unpiloted",
    "VehicleDefense": "Vehicle Defense",
    "Profile": "Profile",
    "Notes": "Notes",
    "Automated": "Automated",
    "HalfSpeed": "Half Speed",
    "Disabled": "Disabled",
    "Destroyed": "Destroyed",
    "VehicleFull": "Vehicle is at passenger capacity"
}
```

- [ ] **Step 5: Create the empty `packs/vehicles/` directory**

Create directory: `packs/vehicles/`

- [ ] **Step 6: Commit**

```
feat: register vehicle actor type, vehicleWeapon item type, and localization strings
```

---

### Task 2: Add the Vehicle Sizes Config and VehicleWeapon Item Data Model

**Files:**
- Modify: `marvel-multiverse.mjs` (~line 697, ~line 3471, ~line 3687)

- [ ] **Step 1: Add `vehicleSizes` to the `MARVEL_MULTIVERSE` config**

After the `movementTypes` block (line ~708), add:

```javascript
MARVEL_MULTIVERSE.vehicleSizes = {
  average: { label: "Average" },
  big: { label: "Big" },
  huge: { label: "Huge" },
  gigantic: { label: "Gigantic" },
  gargantuan: { label: "Gargantuan" },
};
```

- [ ] **Step 2: Add `vehicleOccupantRoles` to the config**

After `vehicleSizes`, add:

```javascript
MARVEL_MULTIVERSE.vehicleOccupantRoles = {
  passenger: { label: "Passenger" },
  gunner: { label: "Gunner" },
  pilot: { label: "Pilot" },
};
```

- [ ] **Step 3: Add `vehicleSpeedLabels` to the config**

After `vehicleOccupantRoles`, add:

```javascript
MARVEL_MULTIVERSE.vehicleSpeedLabels = {
  run: { label: "MARVEL_MULTIVERSE.Vehicle.GroundSpeed" },
  flight: { label: "MARVEL_MULTIVERSE.Vehicle.FlightSpeed" },
  climb: { label: "MARVEL_MULTIVERSE.Vehicle.ClimbSpeed" },
  swim: { label: "MARVEL_MULTIVERSE.Vehicle.NauticalSpeed" },
};
```

- [ ] **Step 4: Add `MarvelMultiverseVehicleWeapon` class**

After the `MarvelMultiversePowerSet` class (line ~3471), add:

```javascript
class MarvelMultiverseVehicleWeapon extends MarvelMultiverseItemBase {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.agility = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
    schema.range = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
    schema.damageMultiplier = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
    schema.automated = new fields.BooleanField({ required: true, initial: false });
    schema.notes = new fields.StringField({ required: true, blank: true });

    return schema;
  }
}
```

- [ ] **Step 5: Register `vehicleWeapon` in `CONFIG.Item.dataModels`**

At line ~3696, add to the `CONFIG.Item.dataModels` object:

```javascript
vehicleWeapon: MarvelMultiverseVehicleWeapon,
```

- [ ] **Step 6: Commit**

```
feat: add vehicle sizes config and vehicleWeapon data model
```

---

### Task 3: Add the Vehicle Actor Data Model

**Files:**
- Modify: `marvel-multiverse.mjs` (~line 3301, ~line 3681)

- [ ] **Step 1: Add `MarvelMultiverseVehicle` class**

After the `MarvelMultiverseNPC` class (line ~3301), add:

```javascript
class MarvelMultiverseVehicle extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = {};

    schema.health = new fields.SchemaField({
      value: new fields.NumberField({ required: true, nullable: false, initial: 0, min: -9999 }),
      max: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
    });

    schema.damageReduction = new fields.NumberField({ ...requiredInteger, initial: 0 });

    schema.size = new fields.StringField({ required: true, initial: "big" });

    schema.passengers = new fields.NumberField({ ...requiredInteger, initial: 1, min: 1 });
    schema.crew = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
    schema.safetyHarness = new fields.BooleanField({ required: true, initial: false });

    const speedField = () => new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      active: new fields.BooleanField({ required: true, initial: false }),
    });

    schema.speed = new fields.SchemaField({
      run: speedField(),
      flight: speedField(),
      climb: speedField(),
      swim: speedField(),
    });

    schema.occupants = new fields.ArrayField(new fields.SchemaField({
      actorId: new fields.StringField({ required: true, blank: false }),
      name: new fields.StringField({ required: true, blank: true }),
      img: new fields.StringField({ required: true, blank: true }),
      role: new fields.StringField({ required: true, initial: "passenger" }),
    }));

    schema.profile = new fields.StringField({ required: true, blank: true });
    schema.notes = new fields.StringField({ required: true, blank: true });
    schema.source = new fields.StringField({ required: true, blank: true });

    return schema;
  }

  prepareDerivedData() {
    const maxHealth = this.health.max;
    const curHealth = this.health.value;

    this.health.halfSpeed = curHealth > 0 && curHealth < maxHealth / 2;
    this.health.disabled = curHealth < 1;
    this.health.destroyed = maxHealth > 0 && curHealth <= -(maxHealth);

    let healthStatus = "normal";
    if (this.health.destroyed) healthStatus = "destroyed";
    else if (this.health.disabled) healthStatus = "disabled";
    else if (this.health.halfSpeed) healthStatus = "halfSpeed";
    this.health.status = healthStatus;

    const activeSpeedValues = Object.values(this.speed)
      .filter(s => s.active)
      .map(s => s.value);
    const highestActiveSpeed = activeSpeedValues.length > 0 ? Math.max(...activeSpeedValues) : 0;

    let crashDM = highestActiveSpeed > 0 ? Math.min(20, Math.ceil(highestActiveSpeed / 3)) : 0;
    if (this.safetyHarness && crashDM > 0) {
      crashDM = Math.ceil(crashDM / 2);
    }
    this.crashDamageMultiplier = crashDM;

    for (const key in this.speed) {
      this.speed[key].label = game.i18n.localize(
        CONFIG.MARVEL_MULTIVERSE.vehicleSpeedLabels[key]?.label ?? key
      );
    }

    const pilot = this.occupants.find(o => o.role === "pilot");
    if (pilot) {
      const pilotActor = game.actors?.get(pilot.actorId);
      if (pilotActor) {
        this.defense = {
          melee: pilotActor.system.abilities.mle.defense,
          agility: pilotActor.system.abilities.agl.defense,
          pilotName: pilotActor.name,
        };
      } else {
        this.defense = { melee: 10, agility: 10, pilotName: null };
      }
    } else {
      this.defense = { melee: 10, agility: 10, pilotName: null };
    }
  }
}
```

- [ ] **Step 2: Register `vehicle` in `CONFIG.Actor.dataModels`**

At line ~3683, add to the `CONFIG.Actor.dataModels` object:

```javascript
vehicle: MarvelMultiverseVehicle,
```

- [ ] **Step 3: Commit**

```
feat: add MarvelMultiverseVehicle data model with derived data
```

---

### Task 4: Create the VehicleWeapon Item Sheet Template

**Files:**
- Create: `templates/item/item-vehicleWeapon-sheet.hbs`

- [ ] **Step 1: Create the template file `item-vehicleWeapon-sheet.hbs`** (camelCase W — must match `this.item.type`)

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
    <div class="tab vehicleweapon-attributes" data-group="primary" data-tab="attributes">
      {{> "systems/marvel-multiverse/templates/item/parts/item-source.hbs"}}
      <div class="mm-styled-field -fill">
        <label class="mm-styled-label -align-left" for="system.description"><span>Description</span></label>
        <div class="mm-styled-input">
          {{editor system.description target="system.description" button=false engine="prosemirror" collaborate=false editable=editable}}
        </div>
      </div>
      <div class="mm-styled-field -fill">
        <label class="mm-styled-label -align-left"><span>Agility</span></label>
        <div class="mm-styled-input">
          <input type="number" name="system.agility" value="{{system.agility}}" data-dtype="Number" min="0"/>
        </div>
      </div>
      <div class="mm-styled-field -fill">
        <label class="mm-styled-label -align-left"><span>Range</span></label>
        <div class="mm-styled-input">
          <input type="number" name="system.range" value="{{system.range}}" data-dtype="Number" min="0"/>
        </div>
      </div>
      <div class="mm-styled-field -fill">
        <label class="mm-styled-label -align-left"><span>Damage Multiplier</span></label>
        <div class="mm-styled-input">
          <input type="number" name="system.damageMultiplier" value="{{system.damageMultiplier}}" data-dtype="Number" min="0"/>
        </div>
      </div>
      <div class="mm-styled-field -fill">
        <label class="mm-styled-label -align-left"><span>{{localize "MARVEL_MULTIVERSE.Vehicle.Automated"}}</span></label>
        <div class="mm-styled-input">
          <input type="checkbox" name="system.automated" {{checked system.automated}}/>
        </div>
      </div>
      <div class="mm-styled-field -fill">
        <label class="mm-styled-label -align-left"><span>{{localize "MARVEL_MULTIVERSE.Vehicle.Notes"}}</span></label>
        <div class="mm-styled-input">
          <input type="text" name="system.notes" value="{{system.notes}}" data-dtype="String"/>
        </div>
      </div>
    </div>
    {{!-- Effects Tab --}}
    <div class="tab vehicleweapon-effects" data-group="primary" data-tab="effects">
      {{> "systems/marvel-multiverse/templates/item/parts/item-effects.hbs"}}
    </div>
  </section>
</form>
```

- [ ] **Step 2: Commit**

```
feat: add vehicleWeapon item sheet template
```

---

### Task 5: Create the Vehicle Occupants Partial Template

**Files:**
- Create: `templates/actor/parts/actor-vehicle-occupants.hbs`

- [ ] **Step 1: Create the occupants partial**

```handlebars
<ol class="mm-vehicle-occupants-list">
  {{#each occupants as |occupant idx|}}
  <li class="mm-vehicle-occupant flexrow" data-index="{{idx}}">
    <div class="mm-vehicle-occupant-img">
      <img src="{{occupant.img}}" title="{{occupant.name}}" width="36" height="36"/>
    </div>
    <div class="mm-vehicle-occupant-name">{{occupant.name}}</div>
    <div class="mm-vehicle-occupant-role">
      <select class="occupant-role-select" data-index="{{idx}}">
        {{selectOptions ../occupantRoles selected=occupant.role}}
      </select>
    </div>
    {{#if (eq occupant.role "pilot")}}
    <div class="mm-vehicle-occupant-defense">
      Melee: {{../defense.melee}} / Agility: {{../defense.agility}}
    </div>
    {{/if}}
    <div class="mm-vehicle-occupant-controls">
      <a class="occupant-delete" data-index="{{idx}}" title="Remove"><i class="fas fa-trash"></i></a>
    </div>
  </li>
  {{/each}}
  {{#unless occupants.length}}
  <li class="mm-vehicle-occupant-empty">Drag actors here to add occupants</li>
  {{/unless}}
</ol>
```

- [ ] **Step 2: Commit**

```
feat: add vehicle occupants partial template
```

---

### Task 6: Create the Vehicle Weapons Partial Template

**Files:**
- Create: `templates/actor/parts/actor-vehicle-weapons.hbs`

- [ ] **Step 1: Create the vehicle weapons partial**

```handlebars
<ol class="mm-vehicle-weapons-list item-list">
  <li class="mm-vehicle-weapon-header flexrow">
    <div class="mm-vehicle-weapon-name"><strong>Name</strong></div>
    <div class="mm-vehicle-weapon-stat"><strong>Agl</strong></div>
    <div class="mm-vehicle-weapon-stat"><strong>Range</strong></div>
    <div class="mm-vehicle-weapon-stat"><strong>DM</strong></div>
    <div class="mm-vehicle-weapon-stat"><strong>Auto</strong></div>
    <div class="mm-vehicle-weapon-controls"></div>
  </li>
  {{#each vehicleWeapons as |weapon|}}
  <li class="mm-vehicle-weapon flexrow item" data-item-id="{{weapon._id}}">
    <div class="mm-vehicle-weapon-name">
      <div class="item-image"><img src="{{weapon.img}}" title="{{weapon.name}}" width="24" height="24"/></div>
      <span class="item-edit">{{weapon.name}}</span>
    </div>
    <div class="mm-vehicle-weapon-stat">{{#if weapon.system.agility}}{{weapon.system.agility}}{{else}}&mdash;{{/if}}</div>
    <div class="mm-vehicle-weapon-stat">{{#if weapon.system.range}}{{weapon.system.range}}{{else}}&mdash;{{/if}}</div>
    <div class="mm-vehicle-weapon-stat">{{#if weapon.system.damageMultiplier}}&times;{{weapon.system.damageMultiplier}}{{else}}&mdash;{{/if}}</div>
    <div class="mm-vehicle-weapon-stat">{{#if weapon.system.automated}}<i class="fas fa-robot" title="Automated"></i>{{/if}}</div>
    <div class="mm-vehicle-weapon-controls">
      <a class="item-delete" title="Delete"><i class="fas fa-trash"></i></a>
    </div>
  </li>
  {{#if weapon.system.notes}}
  <li class="mm-vehicle-weapon-notes">
    <em>{{weapon.system.notes}}</em>
  </li>
  {{/if}}
  {{/each}}
</ol>
<div class="mm-vehicle-add-weapon">
  <a class="item-create" data-type="vehicleWeapon"><i class="fas fa-plus"></i> Add Weapon</a>
</div>
```

- [ ] **Step 2: Commit**

```
feat: add vehicle weapons partial template
```

---

### Task 7: Create the Main Vehicle Sheet Template

**Files:**
- Create: `templates/actor/actor-vehicle-sheet.hbs`

- [ ] **Step 1: Create the vehicle sheet template**

```handlebars
<form class="{{cssClass}} vehicle flexcol" autocomplete="off">
  {{!-- Sheet Header --}}
  <header class="sheet-header">
    <div class="flexrow">
      <div class="flexcol -gap-sm -grow-2">
        {{!-- Vehicle Name --}}
        <div class="mm-styled-field">
          <label class="mm-styled-label -align-left" for="name"><span>Name</span></label>
          <div class="mm-styled-input">
            <input name="name" type="text" value="{{actor.name}}" placeholder="Vehicle Name"/>
          </div>
        </div>

        <div class="flexrow -nowrap">
          {{!-- Portrait --}}
          <div class="mm-vehicle-portrait-block">
            <div class="mm-hero-portrait">
              <img src="{{actor.img}}" data-edit="img" title="{{actor.name}}"/>
            </div>
          </div>

          {{!-- Stats Block --}}
          <div class="flexcol -gap-sm -grow-2">
            <div class="flexrow -nowrap -gap-sm">
              {{!-- Health --}}
              <div class="mm-stat-block mm-vehicle-health mm-vehicle-health-{{system.health.status}}">
                <label class="mm-label">Health</label>
                <div class="mm-input">
                  <input type="number" name="system.health.value" value="{{system.health.value}}" data-dtype="Number"/>
                  <span>/</span>
                  <input type="number" name="system.health.max" value="{{system.health.max}}" data-dtype="Number" min="0"/>
                </div>
                {{#if system.health.halfSpeed}}
                <span class="mm-vehicle-status-badge -warning">{{localize "MARVEL_MULTIVERSE.Vehicle.HalfSpeed"}}</span>
                {{/if}}
                {{#if system.health.disabled}}
                <span class="mm-vehicle-status-badge -danger">{{localize "MARVEL_MULTIVERSE.Vehicle.Disabled"}}</span>
                {{/if}}
                {{#if system.health.destroyed}}
                <span class="mm-vehicle-status-badge -destroyed">{{localize "MARVEL_MULTIVERSE.Vehicle.Destroyed"}}</span>
                {{/if}}
              </div>
              {{!-- DR --}}
              <div class="mm-stat-block">
                <label class="mm-label">{{localize "MARVEL_MULTIVERSE.Vehicle.DamageReduction"}}</label>
                <div class="mm-input">
                  {{#if (gt system.damageReduction 0)}}-{{/if}}{{system.damageReduction}}
                </div>
              </div>
            </div>

            {{!-- Active Speeds --}}
            <div class="flexrow -nowrap -gap-sm mm-vehicle-speeds">
              {{#each system.speed as |spd key|}}
                {{#if spd.active}}
                <div class="mm-stat-block">
                  <label class="mm-label">{{spd.label}}</label>
                  <div class="mm-input">{{spd.value}}</div>
                </div>
                {{/if}}
              {{/each}}
            </div>

            {{!-- Defense --}}
            <div class="mm-vehicle-defense">
              <strong>{{localize "MARVEL_MULTIVERSE.Vehicle.VehicleDefense"}}:</strong>
              {{#if system.defense.pilotName}}
                Melee {{system.defense.melee}} / Agility {{system.defense.agility}}
                <em>({{system.defense.pilotName}})</em>
              {{else}}
                10 ({{localize "MARVEL_MULTIVERSE.Vehicle.Unpiloted"}})
              {{/if}}
            </div>
          </div>
        </div>
      </div>
    </div>
  </header>

  {{!-- Sheet Tab Navigation --}}
  <nav class="sheet-tabs tabs mm-tabs" data-group="primary">
    <a class="item" data-tab="stats">Stats</a>
    <a class="item" data-tab="occupants">{{localize "MARVEL_MULTIVERSE.Vehicle.Occupants"}} ({{system.occupants.length}} / {{system.passengers}})</a>
    <a class="item" data-tab="combat">Powers &amp; Weapons</a>
    <a class="item" data-tab="profile">{{localize "MARVEL_MULTIVERSE.Vehicle.Profile"}}</a>
  </nav>

  {{!-- Sheet Body --}}
  <section class="sheet-body">

    {{!-- Stats Tab --}}
    <div class="tab flexcol" data-group="primary" data-tab="stats">
      <div class="mm-styled-container">
        <h3>Speeds</h3>
        <div class="mm-styled-container-body">
          {{#each system.speed as |spd key|}}
          <div class="mm-styled-field -fill flexrow -nowrap">
            <label class="mm-styled-label -align-left"><span>{{spd.label}}</span></label>
            <div class="mm-styled-input -narrow">
              <input type="number" name="system.speed.{{key}}.value" value="{{spd.value}}" data-dtype="Number" min="0"/>
            </div>
            <label class="mm-vehicle-speed-active">
              <input type="checkbox" name="system.speed.{{key}}.active" {{checked spd.active}}/>
              Active
            </label>
          </div>
          {{/each}}
        </div>
      </div>

      <div class="mm-styled-container">
        <h3>Vehicle Details</h3>
        <div class="mm-styled-container-body">
          <div class="mm-styled-field -sm">
            <label class="mm-styled-label -align-left"><span>Size</span></label>
            <div class="mm-styled-input">
              <select name="system.size">
                {{selectOptions vehicleSizeSelection selected=system.size}}
              </select>
            </div>
          </div>
          <div class="mm-styled-field -fill">
            <label class="mm-styled-label -align-left"><span>{{localize "MARVEL_MULTIVERSE.Vehicle.Passengers"}} (Max)</span></label>
            <div class="mm-styled-input">
              <input type="number" name="system.passengers" value="{{system.passengers}}" data-dtype="Number" min="1"/>
            </div>
          </div>
          <div class="mm-styled-field -fill">
            <label class="mm-styled-label -align-left"><span>{{localize "MARVEL_MULTIVERSE.Vehicle.Crew"}}</span></label>
            <div class="mm-styled-input">
              <input type="number" name="system.crew" value="{{system.crew}}" data-dtype="Number" min="0"/>
            </div>
          </div>
          <div class="mm-styled-field -fill">
            <label class="mm-styled-label -align-left"><span>{{localize "MARVEL_MULTIVERSE.Vehicle.DamageReduction"}}</span></label>
            <div class="mm-styled-input">
              <input type="number" name="system.damageReduction" value="{{system.damageReduction}}" data-dtype="Number"/>
            </div>
          </div>
        </div>
      </div>

      <div class="mm-styled-container">
        <h3>{{localize "MARVEL_MULTIVERSE.Vehicle.CrashDamage"}}</h3>
        <div class="mm-styled-container-body">
          <div class="flexrow -nowrap">
            <div class="mm-stat-block">
              <label class="mm-label">Crash DM</label>
              <div class="mm-input mm-derived-value">&times;{{system.crashDamageMultiplier}}</div>
            </div>
            <div class="mm-styled-field -fill">
              <label class="mm-styled-label -align-left"><span>{{localize "MARVEL_MULTIVERSE.Vehicle.SafetyHarness"}}</span></label>
              <div class="mm-styled-input">
                <input type="checkbox" name="system.safetyHarness" {{checked system.safetyHarness}}/>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    {{!-- Occupants Tab --}}
    <div class="tab flexcol" data-group="primary" data-tab="occupants">
      <div class="mm-styled-container">
        <h3>{{localize "MARVEL_MULTIVERSE.Vehicle.Occupants"}} ({{system.occupants.length}} / {{system.passengers}})</h3>
        <div class="mm-styled-container-body mm-vehicle-occupants-drop-zone">
          {{> "systems/marvel-multiverse/templates/actor/parts/actor-vehicle-occupants.hbs"}}
        </div>
      </div>
    </div>

    {{!-- Powers & Weapons Tab --}}
    <div class="tab flexcol" data-group="primary" data-tab="combat">
      <div class="mm-styled-container mm-powers-block">
        <h3>Powers</h3>
        <div class="mm-styled-container-body">
          {{> "systems/marvel-multiverse/templates/actor/parts/actor-powers.hbs"}}
        </div>
      </div>
      <div class="mm-styled-container">
        <h3>Weapons</h3>
        <div class="mm-styled-container-body">
          {{> "systems/marvel-multiverse/templates/actor/parts/actor-vehicle-weapons.hbs"}}
        </div>
      </div>
    </div>

    {{!-- Profile & Notes Tab --}}
    <div class="tab flexcol" data-group="primary" data-tab="profile">
      <div class="mm-styled-container">
        <h3>{{localize "MARVEL_MULTIVERSE.Vehicle.Profile"}}</h3>
        <div class="mm-styled-container-body">
          <div class="mm-styled-field -fill">
            <div class="mm-styled-input">
              {{editor system.profile target="system.profile" button=false engine="prosemirror" collaborate=false editable=editable}}
            </div>
          </div>
        </div>
      </div>
      <div class="mm-styled-container">
        <h3>{{localize "MARVEL_MULTIVERSE.Vehicle.Notes"}}</h3>
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

- [ ] **Step 2: Commit**

```
feat: add main vehicle sheet template
```

---

### Task 8: Add the Vehicle Sheet Class and Register It

**Files:**
- Modify: `marvel-multiverse.mjs` (~line 2304, ~line 2938, ~line 3733)

- [ ] **Step 1: Add `MarvelMultiverseVehicleSheet` class**

Insert before the `MarvelMultiverseNPCSheet` class (line ~2304):

```javascript
class MarvelMultiverseVehicleSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["marvel-multiverse", "sheet", "actor"],
      width: 690,
      height: 700,
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-body",
          initial: "stats",
        },
      ],
    });
  }

  get template() {
    return "systems/marvel-multiverse/templates/actor/actor-vehicle-sheet.hbs";
  }

  async _render(...args) {
    const scrollables = this.element.find(".mm-styled-container-body");
    const scrollPositions = [];
    scrollables.each(function() {
      scrollPositions.push(this.scrollTop);
    });
    await super._render(...args);
    const newScrollables = this.element.find(".mm-styled-container-body");
    newScrollables.each(function(i) {
      if (scrollPositions[i] !== undefined) this.scrollTop = scrollPositions[i];
    });
  }

  getData() {
    const context = super.getData();
    const actorData = context.data;

    context.system = actorData.system;
    context.flags = actorData.flags;

    this._prepareItems(context);

    context.rollData = context.actor.getRollData();
    context.sources = CONFIG.MARVEL_MULTIVERSE.sources;

    context.vehicleSizeSelection = Object.fromEntries(
      Object.keys(CONFIG.MARVEL_MULTIVERSE.vehicleSizes).map((key) => [
        key,
        CONFIG.MARVEL_MULTIVERSE.vehicleSizes[key].label,
      ])
    );

    context.occupantRoles = Object.fromEntries(
      Object.keys(CONFIG.MARVEL_MULTIVERSE.vehicleOccupantRoles).map((key) => [
        key,
        CONFIG.MARVEL_MULTIVERSE.vehicleOccupantRoles[key].label,
      ])
    );

    context.occupants = context.system.occupants;
    context.defense = context.system.defense;

    context.effects = prepareActiveEffectCategories(
      this.actor.allApplicableEffects()
    );

    return context;
  }

  _prepareItems(context) {
    const powers = {};
    const vehicleWeapons = [];

    for (const i of context.items) {
      i.img = i.img || Item.DEFAULT_ICON;

      if (i.type === "power") {
        const firstSet = i.system.powerSets?.length
          ? i.system.powerSets[0].name
          : (i.system.powerSet?.split(",")[0]?.trim() || "Basic");
        if (!powers[firstSet]) powers[firstSet] = [];
        powers[firstSet].push(i);
      } else if (i.type === "vehicleWeapon") {
        vehicleWeapons.push(i);
      }
    }

    for (const set in powers) powers[set].sort((a, b) => a.name.localeCompare(b.name));
    const sortedPowers = {};
    for (const key of Object.keys(powers).sort()) sortedPowers[key] = powers[key];
    context.powers = sortedPowers;
    context.vehicleWeapons = vehicleWeapons;
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.on("click", ".item-edit", (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.sheet.render(true);
    });

    if (!this.isEditable) return;

    html.on("click", ".item-create", this._onItemCreate.bind(this));

    html.on("click", ".item-delete", (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      this.actor.deleteEmbeddedDocuments("Item", [li.data("itemId")]);
      li.slideUp(200, () => this.render(false));
    });

    html.on("click", ".effect-control", (ev) => {
      const row = ev.currentTarget.closest("li");
      const document =
        row.dataset.parentId === this.actor.id
          ? this.actor
          : this.actor.items.get(row.dataset.parentId);
      onManageActiveEffect(ev, document);
    });

    html.on("change", ".occupant-role-select", this._onOccupantRoleChange.bind(this));
    html.on("click", ".occupant-delete", this._onOccupantDelete.bind(this));
  }

  async _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;
    const type = header.dataset.type;
    const data = foundry.utils.duplicate(header.dataset);
    const name = `New ${type.capitalize()}`;
    const itemData = { name, type, system: data };
    itemData.system.type = undefined;
    return await Item.create(itemData, { parent: this.actor });
  }

  async _onOccupantRoleChange(event) {
    event.preventDefault();
    const index = Number(event.currentTarget.dataset.index);
    const newRole = event.currentTarget.value;
    const occupants = foundry.utils.deepClone(this.actor.system.occupants);

    if (newRole === "pilot") {
      for (const occ of occupants) {
        if (occ.role === "pilot") occ.role = "passenger";
      }
    }

    occupants[index].role = newRole;
    await this.actor.update({ "system.occupants": occupants });
  }

  async _onOccupantDelete(event) {
    event.preventDefault();
    const index = Number(event.currentTarget.dataset.index);
    const occupants = foundry.utils.deepClone(this.actor.system.occupants);
    occupants.splice(index, 1);
    await this.actor.update({ "system.occupants": occupants });
  }

  async _onDropActor(event, data) {
    if (!this.isEditable) return;

    const actor = await Actor.implementation.fromDropData(data);
    if (!actor) return;

    const occupants = foundry.utils.deepClone(this.actor.system.occupants);

    if (occupants.length >= this.actor.system.passengers) {
      ui.notifications.warn(game.i18n.localize("MARVEL_MULTIVERSE.Vehicle.VehicleFull"));
      return;
    }

    if (occupants.some(o => o.actorId === actor.id)) {
      ui.notifications.warn(`${actor.name} is already in this vehicle.`);
      return;
    }

    occupants.push({
      actorId: actor.id,
      name: actor.name,
      img: actor.img,
      role: "passenger",
    });

    await this.actor.update({ "system.occupants": occupants });
  }

  async _onDropItemCreate(itemData) {
    const allowedTypes = ["power", "vehicleWeapon"];
    if (!allowedTypes.includes(itemData.type)) {
      ui.notifications.warn(`Vehicles cannot hold ${itemData.type} items.`);
      return;
    }
    return super._onDropItemCreate(itemData);
  }
}
```

- [ ] **Step 2: Add vehicle sheet partials to `preloadHandlebarsTemplates`**

At line ~2938 in the `preloadHandlebarsTemplates` function, add to the array:

```javascript
"systems/marvel-multiverse/templates/actor/parts/actor-vehicle-occupants.hbs",
"systems/marvel-multiverse/templates/actor/parts/actor-vehicle-weapons.hbs",
```

- [ ] **Step 3: Register the vehicle sheet in the init hook**

After the NPC sheet registration (line ~3737), add:

```javascript
Actors.registerSheet("marvel-multiverse", MarvelMultiverseVehicleSheet, {
  types: ["vehicle"],
  makeDefault: true,
  label: "MARVEL_MULTIVERSE.SheetLabels.Vehicle",
});
```

- [ ] **Step 4: Commit**

```
feat: add MarvelMultiverseVehicleSheet class and register it
```

---

### Task 9: Add Vehicle CSS Styles

**Files:**
- Modify: `css/marvel-multiverse.css` (append at end of file)

- [ ] **Step 1: Add vehicle sheet styles**

Append to the end of `css/marvel-multiverse.css`:

```css
/* ====================== */
/* Vehicle Sheet Styles   */
/* ====================== */

.mm-vehicle-portrait-block {
  flex: 0 0 150px;
  margin-right: 8px;
}

.mm-vehicle-portrait-block .mm-hero-portrait img {
  border: 2px solid #4b4a44;
  border-radius: 4px;
  height: 150px;
  object-fit: cover;
  width: 150px;
}

.mm-vehicle-health {
  position: relative;
}

.mm-vehicle-health-halfSpeed {
  border-color: #c89e18;
}

.mm-vehicle-health-disabled {
  border-color: #c05a2e;
}

.mm-vehicle-health-destroyed {
  border-color: #8b0502;
}

.mm-vehicle-status-badge {
  border-radius: 3px;
  color: #fff;
  display: inline-block;
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
  margin-top: 2px;
  padding: 2px 6px;
  text-transform: uppercase;
}

.mm-vehicle-status-badge.-warning {
  background: #c89e18;
}

.mm-vehicle-status-badge.-danger {
  background: #c05a2e;
}

.mm-vehicle-status-badge.-destroyed {
  background: #8b0502;
}

.mm-vehicle-speeds {
  flex-wrap: wrap;
}

.mm-vehicle-defense {
  font-size: 12px;
  padding: 4px 0;
}

.mm-vehicle-defense em {
  color: #7a7971;
}

/* Vehicle Speed Toggle */
.mm-vehicle-speed-active {
  align-items: center;
  display: flex;
  font-size: 11px;
  gap: 4px;
  white-space: nowrap;
}

.mm-styled-input.-narrow {
  max-width: 60px;
}

/* Vehicle Occupants */
.mm-vehicle-occupants-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.mm-vehicle-occupant {
  align-items: center;
  border-bottom: 1px solid #c9c7b8;
  gap: 8px;
  padding: 4px 0;
}

.mm-vehicle-occupant-img img {
  border: 1px solid #4b4a44;
  border-radius: 3px;
  object-fit: cover;
}

.mm-vehicle-occupant-name {
  flex: 1;
  font-weight: 600;
}

.mm-vehicle-occupant-role select {
  font-size: 11px;
  width: auto;
}

.mm-vehicle-occupant-defense {
  color: #7a7971;
  font-size: 11px;
}

.mm-vehicle-occupant-controls a {
  color: #7a7971;
  cursor: pointer;
}

.mm-vehicle-occupant-controls a:hover {
  color: #8b0502;
}

.mm-vehicle-occupant-empty {
  color: #c0b8b4;
  font-style: italic;
  padding: 12px;
  text-align: center;
}

.mm-vehicle-occupants-drop-zone {
  min-height: 60px;
}

/* Vehicle Weapons */
.mm-vehicle-weapons-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.mm-vehicle-weapon-header {
  border-bottom: 2px solid #4b4a44;
  font-size: 11px;
  padding: 2px 0;
}

.mm-vehicle-weapon {
  align-items: center;
  border-bottom: 1px solid #c9c7b8;
  gap: 4px;
  padding: 4px 0;
}

.mm-vehicle-weapon-name {
  align-items: center;
  display: flex;
  flex: 2;
  gap: 4px;
}

.mm-vehicle-weapon-name .item-edit {
  cursor: pointer;
}

.mm-vehicle-weapon-name .item-edit:hover {
  text-decoration: underline;
}

.mm-vehicle-weapon-stat {
  flex: 0 0 40px;
  text-align: center;
}

.mm-vehicle-weapon-controls {
  flex: 0 0 24px;
  text-align: center;
}

.mm-vehicle-weapon-controls a {
  color: #7a7971;
  cursor: pointer;
}

.mm-vehicle-weapon-controls a:hover {
  color: #8b0502;
}

.mm-vehicle-weapon-notes {
  color: #7a7971;
  font-size: 11px;
  padding: 0 0 4px 28px;
}

.mm-vehicle-add-weapon {
  padding: 4px 0;
}

.mm-vehicle-add-weapon a {
  color: #7a7971;
  cursor: pointer;
  font-size: 12px;
}

.mm-vehicle-add-weapon a:hover {
  color: #4b4a44;
}
```

- [ ] **Step 2: Commit**

```
feat: add vehicle sheet CSS styles
```

---

### Task 10: Fix VehicleWeapon Template Filename

**Files:**
- Rename: `templates/item/item-vehicleweapon-sheet.hbs` → `templates/item/item-vehicleWeapon-sheet.hbs`

The existing `MarvelMultiverseItemSheet.get template()` at line 2796 uses `this.item.type` directly:

```javascript
const itemSheet = `${path}/item-${this.item.type}-sheet.hbs`;
```

For the `vehicleWeapon` type, this resolves to `item-vehicleWeapon-sheet.hbs` (camelCase). The template file created in Task 4 must use this exact casing. This follows the existing pattern — `item-powerSet-sheet.hbs` already uses camelCase.

- [ ] **Step 1: Rename the template file created in Task 4**

When creating the file in Task 4, name it `templates/item/item-vehicleWeapon-sheet.hbs` (capital W). If already created with the wrong name, rename it:

```
git mv templates/item/item-vehicleweapon-sheet.hbs templates/item/item-vehicleWeapon-sheet.hbs
```

- [ ] **Step 2: Commit**

```
fix: use camelCase in vehicleWeapon template filename to match item type
```

---

### Task 11: Smoke Test the Vehicle Actor in FoundryVTT

**Files:** None (manual testing)

- [ ] **Step 1: Launch FoundryVTT and load the world**

Open FoundryVTT, load a world using the `marvel-multiverse` system.

- [ ] **Step 2: Create a new Vehicle actor**

In the Actors directory, click "Create Actor", select type "Vehicle", name it "Test Car".

- [ ] **Step 3: Verify the sheet opens with all four tabs**

Confirm tabs: Stats, Occupants, Powers & Weapons, Profile.

- [ ] **Step 4: Test the Stats tab**

- Set Health max to 100, current to 100
- Set Ground Speed to 20, toggle it active
- Set Size to Big
- Set Passengers to 2
- Verify crash damage multiplier shows ×7

- [ ] **Step 5: Test health status indicators**

- Set Health to 40 (below half of 100) → verify "Half Speed" badge appears
- Set Health to 0 → verify "Disabled" badge
- Set Health to -100 → verify "Destroyed" badge

- [ ] **Step 6: Test the Occupants tab**

- Drag a character actor onto the Occupants tab
- Verify they appear with "Passenger" role defaulted
- Change role to "Pilot" → verify defense scores appear in the header
- Drag a second actor → verify they can be added (capacity permitting)
- Try to exceed passenger capacity → verify warning message

- [ ] **Step 7: Test the Powers & Weapons tab**

- Drag a power from the Powers compendium onto the vehicle
- Verify it appears in the Powers section grouped by power set
- Click "Add Weapon" → verify a new vehicleWeapon item is created
- Open the vehicleWeapon sheet → verify all fields (agility, range, DM, automated, notes)

- [ ] **Step 8: Test the Profile & Notes tab**

- Enter text in Profile and Notes rich text editors
- Verify it saves and persists after closing/reopening the sheet

- [ ] **Step 9: Commit any fixes discovered during testing**

```
fix: address issues found during vehicle sheet smoke testing
```

---

## Notes

- The `vehicles` compendium pack is created empty. Population with actual vehicle entries (Car, Boat, Helicopter, etc.) is a separate follow-up task.
- The existing `actor-powers.hbs` partial is reused on the vehicle sheet. If it references character-specific fields, minor adjustments may be needed during Task 11 testing.
- Active Effects from powers that target `system.movement.*` (character paths) will NOT automatically affect `system.speed.*` (vehicle paths). Speed values must be entered manually on the vehicle sheet. The primary AE benefit is for effects targeting `system.damageReduction`.
