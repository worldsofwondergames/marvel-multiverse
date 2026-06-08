# Vehicle Actor Type Design Spec

**Issue:** [#13 — Add Vehicle actor type and sheet](https://github.com/worldsofwondergames/marvel-multiverse/issues/13)
**Source:** X-Men Expansion Ch. 12 (pp. 136-138), Spider-Verse Expansion, Avengers Expansion

---

## Overview

Add a new `vehicle` actor type with a dedicated sheet for tracking vehicle stats, occupants, weapons, powers, and notes. Vehicles are mechanically distinct from characters/NPCs — they have no ability scores, no focus, no karma. Defense is derived from the pilot's scores.

A new `vehicleWeapon` item type supports vehicle-mounted weapons with their own Agility, Range, Damage Multiplier, and automated flag.

## Architecture

**Approach:** Standalone data model (`MarvelMultiverseVehicle`) that does NOT extend `MarvelMultiverseActorBase`. Vehicles carry fundamentally different data — no MARVED abilities, no focus, no karma, no biography fields. A purpose-built schema avoids dead fields and confusing defaults.

**Movement field names reuse character conventions** (`run`, `flight`, `swim`, `climb`) so that Active Effects from existing power items (Speed Run, Flight, Speed Swim, Wallcrawling) work without modification.

---

## Data Model: `MarvelMultiverseVehicle`

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `health.value` | Number | 0 | Current health |
| `health.max` | Number | 0 | Maximum health (direct entry, not derived) |
| `damageReduction` | Number | 0 | Health damage reduction |
| `size` | String | "big" | One of: average, big, huge, gigantic, gargantuan |
| `passengers` | String | "" | Passenger capacity as text ("1", "2-4", "1,800+") |
| `crew` | Number | 0 | Crew required (0 = hidden on sheet) |
| `safetyHarness` | Boolean | false | Halves crash damage multiplier |
| `speed.run` | SchemaField | {value: 0, active: false} | Ground Speed |
| `speed.flight` | SchemaField | {value: 0, active: false} | Flight Speed |
| `speed.climb` | SchemaField | {value: 0, active: false} | Climb Speed |
| `speed.swim` | SchemaField | {value: 0, active: false} | Swim/Nautical Speed |
| `occupants` | ArrayField(ObjectField) | [] | See Occupants section |
| `profile` | String | "" | Rich text — narrative description |
| `notes` | String | "" | Rich text — special features (bullet list) |
| `source` | String | "" | Rulebook source |

### Speed Fields

Each speed entry has:
- `value` (Number) — speed in spaces
- `active` (Boolean) — whether this speed mode is available

Display labels on the vehicle sheet:
- `speed.run` → "Ground Speed"
- `speed.flight` → "Flight Speed"
- `speed.swim` → "Nautical Speed"
- `speed.climb` → "Climb Speed"

Only active speeds are displayed in the sheet header. Users toggle speeds active and set values directly. Powers can also activate speeds via Active Effects (e.g., Flight power sets `system.speed.flight.active = true`).

### Derived Data (`prepareDerivedData`)

| Derived Field | Calculation |
|---------------|-------------|
| `health.halfSpeed` | `health.value > 0 && health.value < health.max / 2` |
| `health.disabled` | `health.value < 1` |
| `health.destroyed` | `health.value <= -(health.max)` |
| `crashDamageMultiplier` | `Math.min(20, Math.ceil(highestActiveSpeed / 3))`, halved (rounded up) if `safetyHarness` |

`highestActiveSpeed` = the largest `value` among active speed types.

### Vehicle Sizes Config

```javascript
MARVEL_MULTIVERSE.vehicleSizes = {
  average:    { label: "Average" },
  big:        { label: "Big" },
  huge:       { label: "Huge" },
  gigantic:   { label: "Gigantic" },
  gargantuan: { label: "Gargantuan" }
}
```

---

## Occupants

Characters are added to a vehicle by drag/drop from the sidebar or scene. Each occupant entry stores:

| Field | Type | Notes |
|-------|------|-------|
| `actorId` | String | Reference to an Actor document |
| `name` | String | Cached actor name (display fallback) |
| `img` | String | Cached actor image (display fallback) |
| `role` | String | "pilot", "gunner", or "passenger" — defaults to "passenger" |

### Rules

- Role is a dropdown, defaulting to **passenger** on drop.
- Only **one pilot** allowed. Assigning a second pilot demotes the first to passenger.
- The pilot's Melee and Agility defense scores are pulled live from the referenced actor and displayed as the vehicle's defense: "Vehicle Defense — Melee: X / Agility: Y".
- If no pilot is assigned, vehicle defense displays "10 (unpiloted)".
- Delete button to remove an occupant.
- Occupant count shown in tab label: "Occupants (N)".

---

## Item Type: `MarvelMultiverseVehicleWeapon`

Extends `MarvelMultiverseItemBase` (inherits `description` and `source`).

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `agility` | Number | 0 | Weapon's own Agility score (0 = N/A) |
| `range` | Number | 0 | Range in spaces (0 = N/A) |
| `damageMultiplier` | Number | 0 | Damage multiplier (0 = N/A) |
| `automated` | Boolean | false | Fires at end of turn with own Agility |
| `notes` | String | "" | Free text ("Use Elemental Control powers", "Has trouble within 20 spaces") |

Weapons with all stats at 0 serve as text-only entries (e.g., "Missiles" with notes "Use Elemental Control powers").

---

## Vehicle Sheet: `MarvelMultiverseVehicleSheet`

Tabbed layout (extends `ActorSheet`).

### Header

- Vehicle name (text input) + portrait image
- Health: current value input / max input with color-coded status indicator
  - Normal: default
  - Half speed: yellow/warning when `health.halfSpeed`
  - Disabled: orange when `health.disabled`
  - Destroyed: red when `health.destroyed`
- Damage Reduction display
- Active speeds listed (only those with `active: true`)
- Vehicle Defense: pulled from pilot's Melee/Agility defense, or "10 (unpiloted)"

### Tab 1: Stats

- **Speed fields:** Value input + active toggle for each speed type (run, flight, climb, swim). Displayed with vehicle labels (Ground, Flight, Climb, Nautical).
- **Size dropdown** (vehicleSizes config)
- **Passengers** (text input) and **Crew** (number input, hidden when 0)
- **Crash Calculator:** Displays calculated crash damage multiplier based on highest active speed. Safety harness checkbox toggles halving.

### Tab 2: Occupants

- List of occupant entries showing: actor image, actor name, role dropdown (passenger/gunner/pilot)
- Drop zone for dragging actor documents
- Delete button per occupant
- When a pilot is assigned, display their Melee and Agility defense scores inline
- Tab label shows count: "Occupants (3)"

### Tab 3: Powers & Weapons

- **Powers section:** Reuse `actor-powers.hbs` partial. Drag/drop power items from compendium. Active Effects from powers apply to the vehicle (Sturdy → DR, Flight → speed activation, etc.).
- **Weapons section:** List of `vehicleWeapon` items showing name, agility, range, damage multiplier, automated badge, notes. Add/delete/drag-drop support.

### Tab 4: Profile & Notes

- **Profile:** Rich text editor (ProseMirror) for narrative description
- **Notes:** Rich text editor for special features / bullet points

---

## Active Effect Targets

Powers dropped onto vehicles apply Active Effects to these paths:

| Power | AE Target | Mode | Value |
|-------|-----------|------|-------|
| Sturdy N | `system.damageReduction` | ADD | N |
| Flight N | `system.speed.flight.active` | OVERRIDE | true |
| Speed Run N | `system.speed.run.active` | OVERRIDE | true |
| Speed Swim | `system.speed.swim.active` | OVERRIDE | true |
| Wallcrawling | `system.speed.climb.active` | OVERRIDE | true |

Note: Speed values from powers may need manual entry on the vehicle since the existing power AEs target character movement paths (`system.movement.run.value`), not vehicle speed paths (`system.speed.run.value`). The speed activation flags are the primary benefit of AE integration. Speed values are entered directly on the vehicle sheet to match the source material.

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `marvel-multiverse.mjs` | Modify | Add `MarvelMultiverseVehicle` data model, `MarvelMultiverseVehicleWeapon` item model, `MarvelMultiverseVehicleSheet` class; register in init hook |
| `system.json` | Modify | Add `vehicle` to actor types, `vehicleWeapon` to item types, add `vehicles` compendium pack entry |
| `templates/actor/actor-vehicle-sheet.hbs` | Create | Main vehicle sheet template (tabbed) |
| `templates/actor/parts/actor-vehicle-weapons.hbs` | Create | Vehicle weapon list partial |
| `templates/actor/parts/actor-vehicle-occupants.hbs` | Create | Occupants list partial |
| `templates/item/item-vehicleweapon-sheet.hbs` | Create | Vehicle weapon edit sheet |
| `css/marvel-multiverse.css` | Modify | Vehicle sheet styles (health status colors, speed display, crash calc, weapon rows, occupant rows) |
| `lang/en.json` | Modify | Vehicle and vehicleWeapon localization strings |

---

## Compendium

A `vehicles` compendium pack will be added to `system.json`. Population with actual vehicle entries (basic vehicles from X-Men Expansion + named vehicles) is a separate task after the actor type and sheet are functional.

---

## Combat Mechanics Reference

These rules inform the sheet display but most are handled by the GM at the table:

- **Defense:** Uses pilot's Melee and Agility defense scores. TN 10 if unpiloted.
- **Half speed:** When Health drops below half maximum, all speeds are halved.
- **Disabled:** Vehicle stops working when Health falls below 1.
- **Destroyed:** Beyond repair at negative Health equal to max Health.
- **Crash damage:** Speed ÷ 3 (rounded up) as Damage Multiplier, max ×20.
- **Safety harness:** Cuts crash damage multiplier in half.
- **Automated weapons:** Fire at end of turn using their own Agility score, no gunner needed.
