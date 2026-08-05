# Headquarters System Design Spec

**Issue:** [#69 — Headquarters System](https://github.com/worldsofwondergames/marvel-multiverse/issues/69)
**Source:** Avengers Expansion, pages 123-131 (iconic-items-21 through 24)

---

## Overview

Add a `headquarters` actor type with a dedicated sheet for managing a team's base of operations. Headquarters have tags (narrative labels with incompatibility rules), traits (mechanical benefits with downtime activities), a team roster for auto-calculating team rank, and a health system for tracking damage/destruction.

Two new item types — `hqTag` and `hqTrait` — are owned by the HQ actor and stored in compendium packs for easy browsing.

**Approach:** Standalone data model (does NOT extend `MarvelMultiverseActorBase`). Like Vehicle, headquarters carry fundamentally different data — no abilities, no karma, no focus, no movement. A purpose-built schema avoids dead fields.

---

## Data Model: `MarvelMultiverseHeadquarters`

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `health.value` | Number | 0 | Current HP |
| `health.max` | Number | 0 | Derived: 2 × owned hqTrait count |
| `teamRank` | Number | 1 | Derived from members (fallback to 1) |
| `members` | ArrayField(SchemaField) | [] | `{actorId, name, img}` |
| `description` | String | "" | Rich text narrative |
| `notes` | String | "" | Rich text special features |
| `source` | String | "" | Rulebook source |

### Derived Data (`prepareDerivedData`)

| Derived Field | Calculation |
|---------------|-------------|
| `teamRank` | Average of top 6 member ranks, rounded up. Falls back to 1 if no members. |
| `health.max` | 2 × (number of owned `hqTrait` items) |
| `health.damaged` | `value > 0 && value <= max / 2` |
| `health.destroyed` | `max > 0 && value <= 0` |
| `traitSlots` | `teamRank * 3` |
| `traitCount` | Count of owned `hqTrait` items |

### Team Rank Calculation

```
ranks = members.map(m => game.actors.get(m.actorId)?.system.attributes.rank.value ?? 1)
topSix = ranks.sort(descending).slice(0, 6)
teamRank = Math.ceil(sum(topSix) / topSix.length)
```

If no members are linked, `teamRank` = 1.

---

## Data Model: `MarvelMultiverseHqTag`

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `description` | String | "" | Tag narrative description |
| `incompatible` | ArrayField(StringField) | [] | Names of incompatible tags |

Does NOT extend `MarvelMultiverseItemBase` — HQ tags have no quantity, formula, ability, or attack fields.

---

## Data Model: `MarvelMultiverseHqTrait`

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `description` | String | "" | Trait description |
| `downtimeActivity` | String | "" | Downtime benefit description |
| `maxCount` | Number | 0 | Max times selectable (0 = no limit) |

Does NOT extend `MarvelMultiverseItemBase` — HQ traits have no quantity, formula, ability, or attack fields.

### Stackable Traits

Some traits (Security Measures Active/Passive) can be taken up to 3 times. This is represented by dropping multiple copies of the item onto the HQ actor. The `maxCount` field on the item data is informational — no hard enforcement (Narrator flexibility), but the sheet can display a warning.

---

## Tag Incompatibility Enforcement

**Incompatible pairs:**
- Central Location ↔ Isolated Location
- Cozy ↔ Roomy
- High-Tech ↔ Low-Tech
- Mobile ↔ Stationary
- Public Location ↔ Secret Location

**Mechanism:** The HQ sheet's `_onDropItem` handler checks the incoming `hqTag` item's `incompatible` array against the names of existing owned `hqTag` items. If a conflict exists, reject the drop with `ui.notifications.warn`.

This is a UI-level guard only — no server-side enforcement. The incompatibility data lives on the item so compendium tags are self-describing.

---

## Health & Damage States

**Health bar:**
- `health.max` = 2 × (owned hqTrait count), derived automatically
- `health.value` is manually set/decremented by the Narrator

**Status thresholds:**
- **Operational:** `value > max / 2`
- **Damaged:** `value > 0 && value <= max / 2` — nearly unlivable, requires repairs
- **Destroyed:** `value <= 0` — utterly useless, starting from scratch

**Sheet display:** Color-coded health bar with status label (green/yellow/red).

**Initial health:** When a headquarters is first created, `health.value` starts at 0. The Narrator should set it to `health.max` once traits are added. Health does NOT auto-sync to max when traits change — this avoids overwriting intentional damage states.

**No automatic damage** — Narrator decrements health manually as combat rounds pass. Repair is also manual (rules say ~1 week per trait's worth of damage, but that's narrative pacing).

---

## Sheet: `MarvelMultiverseHeadquartersSheet`

**Template:** `templates/actor/actor-headquarters-sheet.hbs`
**Dimensions:** ~600w × 700h
**Layout:** Single page (no tabs)

```
┌─────────────────────────────────────────────┐
│  [Image]  Name          Team Rank: 4        │
│           Health: ████████░░ 8/12           │
│           Status: Operational               │
├─────────────────────────────────────────────┤
│  MEMBERS                        [drop zone] │
│  ┌──┬──────────┬──────┐                    │
│  │🖼│ Iron Man  │ Rk 6 │ ✕                 │
│  │🖼│ She-Hulk  │ Rk 5 │ ✕                 │
│  └──┴──────────┴──────┘                    │
├─────────────────────────────────────────────┤
│  TAGS                                       │
│  Central Location, High-Tech, Staff, ...    │
│  [droppable/deletable items]                │
├─────────────────────────────────────────────┤
│  TRAITS (8 / 12 slots)                      │
│  ┌─────────────────────────────────────┐    │
│  │ Laboratory                          │    │
│  │   Downtime: edge on gadget hacking  │    │
│  │ Security Measures (Passive)         │    │
│  │   Downtime: harden TN +2           │    │
│  └─────────────────────────────────────┘    │
├─────────────────────────────────────────────┤
│  DESCRIPTION  [rich text editor]            │
│  NOTES        [rich text editor]            │
└─────────────────────────────────────────────┘
```

**Interactions:**
- Drag character/NPC actors onto Members to add team members
- Drag `hqTag` items onto Tags (incompatibility enforced on drop)
- Drag `hqTrait` items onto Traits
- Click item name to open item sheet
- Delete button (✕) on members, tags, and traits
- Health value is directly editable

---

## Registration & Integration

**Init hook additions:**

```javascript
CONFIG.Actor.dataModels.headquarters = MarvelMultiverseHeadquarters;
CONFIG.Item.dataModels.hqTag = MarvelMultiverseHqTag;
CONFIG.Item.dataModels.hqTrait = MarvelMultiverseHqTrait;

Actors.registerSheet("marvel-multiverse", MarvelMultiverseHeadquartersSheet, {
  types: ["headquarters"],
  makeDefault: true,
  label: "MM.SheetLabels.Headquarters",
});
```

**Default icons:**
- HQ actor: `systems/marvel-multiverse/icons/headquarters.svg`
- hqTag item: `systems/marvel-multiverse/icons/hq-tag.svg`
- hqTrait item: `systems/marvel-multiverse/icons/hq-trait.svg`

**Compendium packs (added to `system.json`):**
- `packs/hq-tags` — 18 canonical tags (Arcane, Central Location, Contains Secrets, Cozy, Embedded Assistance, High-Tech, Interdimensional, Isolated Location, Low-Tech, Mobile, Outside Funding, Public Location, Repurposed, Roomy, Secret Location, Shared, Staff, Stationary)
- `packs/hq-traits` — 17 canonical traits (Armory, Communications Center, Dock, Firing Range, Garage, Hangar, Holding Cells, Kitchen, Laboratory, Library, Medical Bay, Recreation Room, Security Measures Active, Security Measures Passive, Situation Room, Teleportation, Therapy Office, Training Center)

**Localization (`lang/en.json`):**
- `MM.ActorType.Headquarters`
- `MM.headquarters.*` — field labels, status text, section headers
- `MM.hqTag.*` / `MM.hqTrait.*` — item type labels

**No combat integration** — HQs don't roll initiative. They can be placed on scenes as tokens for map purposes.

---

## Files to Create

| File | Purpose |
|------|---------|
| `module/data/headquarters.mjs` | Actor data model |
| `module/data/hq-tag.mjs` | HQ Tag item data model |
| `module/data/hq-trait.mjs` | HQ Trait item data model |
| `module/sheets/headquarters-sheet.mjs` | Sheet class |
| `templates/actor/actor-headquarters-sheet.hbs` | Sheet template |
| `module/__tests__/headquarters.test.mjs` | Unit tests |
| `icons/headquarters.svg` | Actor default icon |
| `icons/hq-tag.svg` | HQ Tag default icon |
| `icons/hq-trait.svg` | HQ Trait default icon |

## Files to Modify

| File | Change |
|------|--------|
| `module/data/_module.mjs` | Export new data models |
| `marvel-multiverse.mjs` | Register actor/item types, sheet, default icons |
| `system.json` | Add compendium pack entries |
| `lang/en.json` | Add localization strings |
| `scss/` | Sheet styles |

---

## Test Plan

- [ ] Create a new headquarters actor
- [ ] Drag character actors onto members — verify team rank auto-calculates
- [ ] Verify top-6 rule (add 7+ members, confirm only top 6 ranks count)
- [ ] Verify trait slots display (teamRank × 3)
- [ ] Drop hqTag items — verify they appear in Tags section
- [ ] Drop incompatible tags (Central + Isolated) — verify rejection with warning
- [ ] Drop hqTrait items — verify they appear in Traits section
- [ ] Drop same trait multiple times — verify multiple copies allowed
- [ ] Verify health.max updates when traits are added/removed (2 × trait count)
- [ ] Decrement health — verify Damaged state at half
- [ ] Decrement health to 0 — verify Destroyed state
- [ ] Verify sheet displays status indicator with correct color
- [ ] Click item names — verify item sheets open
- [ ] Delete members/tags/traits — verify removal
- [ ] Place HQ token on scene — verify token displays correctly
- [ ] Load a headquarters profile (e.g., Avengers Mansion from compendium) — verify data
