# Equipment Item Type Design

**Issue:** #67 — New Item Type: Equipment (Armor, Grenades, Gadgets)
**Date:** 2026-07-02
**Source:** Avengers Expansion, pages 135-142

## Overview

Add a new `equipment` item type with three subtypes — protection (body armor), grenades, and gadgets. Uses a single item type with an `equipmentType` field that switches which fields are displayed on the sheet.

## Decisions

- **Single item type** with `equipmentType` enum rather than three separate types. The subtypes share common equipment concepts (equipped state, inventory presence) and the flat model follows existing codebase patterns.
- **Flat data model** — all fields in one schema, irrelevant fields hidden by template conditionals. Matches weapon/power patterns.
- **Protection DR via Active Effects** — equipping protection auto-applies a transfer Active Effect setting `system.healthDamageReduction`. Unequipping or marking ruined disables it.
- **Agility trouble is descriptive** — noted in a `protectionNotes` text field, not automated via Active Effect.
- **Grenades and gadgets are descriptive** — stats and rules displayed on sheet, no automation for scatter rolls, creation checks, or power neutralization.

## Data Model

File: `module/data/equipment.mjs`
Extends: `MarvelMultiverseItemBase`

### Common Fields (all subtypes)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `equipmentType` | StringField | `"protection"` | Enum: `protection`, `grenade`, `gadget` |
| `equipped` | BooleanField | `false` | Whether currently worn/carried actively |
| `ruined` | BooleanField | `false` | Whether destroyed; only meaningful for protection, hidden for other subtypes |

### Protection Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `damageReduction` | NumberField | `0` | DR level (1, 2, etc.) |
| `protectionNotes` | StringField | `""` | Descriptive notes (e.g., "trouble on Agility", "only vs front attacks") |

### Grenade Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `grenadeType` | StringField | `""` | Type: explosive, flashbang, gas, smoke, etc. |
| `grenadeEffect` | StringField | `""` | Free-text description of grenade effect |

### Gadget Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `gadgetHP` | NumberField | `10` | Current HP |
| `gadgetMaxHP` | NumberField | `10` | Maximum HP |
| `gadgetEffect` | StringField | `""` | Free-text description of gadget effect |

## Active Effect Behavior (Protection)

When a protection equipment item is **equipped** and not **ruined**:
- Create/enable a transfer Active Effect on the owning actor
- Change: `key: "system.healthDamageReduction"`, `mode: CONST.ACTIVE_EFFECT_MODES.ADD`, `value: <damageReduction>`

When **unequipped** or **ruined**:
- Disable the Active Effect

This mirrors the existing battle suit equip pattern and integrates with the condition damage reduction system (`conditionDamageReduction = healthDamageReduction * 5`).

## Config Enums

File: `module/config.mjs`

```js
MARVEL_MULTIVERSE.equipmentTypes = {
  protection: "MARVEL_MULTIVERSE.Equipment.Protection",
  grenade: "MARVEL_MULTIVERSE.Equipment.Grenade",
  gadget: "MARVEL_MULTIVERSE.Equipment.Gadget"
};

MARVEL_MULTIVERSE.grenadeTypes = {
  explosive: "MARVEL_MULTIVERSE.Equipment.Grenade.Explosive",
  flashbang: "MARVEL_MULTIVERSE.Equipment.Grenade.Flashbang",
  gas: "MARVEL_MULTIVERSE.Equipment.Grenade.Gas",
  smoke: "MARVEL_MULTIVERSE.Equipment.Grenade.Smoke"
};
```

## Template

File: `templates/item/item-equipment-sheet.hbs`

Structure:
- Standard header (image + name)
- Tab navigation: Attributes | Effects
- Attributes tab:
  - Source partial
  - Equipment Type dropdown
  - Equipped checkbox, Ruined checkbox
  - Conditional blocks per `equipmentType`:
    - Protection: DR input, protection notes
    - Grenade: grenade type dropdown, effect textarea
    - Gadget: HP/MaxHP inputs, effect textarea
- Effects tab: standard item-effects partial

## Files to Create

| File | Purpose |
|------|---------|
| `module/data/equipment.mjs` | Data model |
| `templates/item/item-equipment-sheet.hbs` | Sheet template |

## Files to Modify

| File | Change |
|------|--------|
| `template.json` | Add `"equipment"` to Item types |
| `module/data/_module.mjs` | Export `MarvelMultiverseEquipment` |
| `marvel-multiverse.mjs` | Register in `CONFIG.Item.dataModels` |
| `module/sheets/item-sheet.mjs` | Add equipment context in `getData()` |
| `module/config.mjs` | Add `equipmentTypes` and `grenadeTypes` enums |
| Localization `en.json` | Add equipment label strings |

## Out of Scope

- Grenade scatter automation (d6 roll)
- Gadget creation check automation (Logic vs TN 13)
- Gadget power neutralization automation
- Rich/Patron tag enforcement for gadgets
- Agility trouble Active Effect for armor
- Riot Shield directional protection logic

These can be layered on in future iterations.
