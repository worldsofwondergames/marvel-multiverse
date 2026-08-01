# Alternate Form Management System — Design Spec

**Issue:** #68
**Source:** Avengers Expansion, pages 121-123 (rules at `marvel-multiverse-data/docs/rules/iconic-items-20-alternate-forms.md`)

## Goal

Allow characters to have multiple forms (e.g., Bruce Banner / Hulk) with form switching, rank recalculation support, and power-swap alternates. Each form is a separate FoundryVTT actor linked via schema fields. Switching replaces the token in-place on the canvas, preserving position and combat state.

## Rules Summary

Characters with an alternate form have a **primary form** (most powerful, best-known) and one or more **alternate forms** (often a less-powerful or different-powered version).

### Alternate Form Types

- **Cosmetic:** Differences are purely visual/personality. No second sheet needed (e.g., Tigra, Moon Knight).
- **Power Down:** Alternate has fewer/no powers, lower rank. Most common type (e.g., Hulk/Banner, Colossus).
- **Power Swap:** Alternate has different powers at the same rank (e.g., Emma Frost diamond form).

### Power-Down Rank Recalculation

The alternate form's rank is the lowest rank that accommodates all retained powers (4 powers per rank). The Alternate Form Changes table governs ability points and damage multipliers:

| Rank | Powers | Ability Points | Damage Multiplier and Karma |
|------|--------|---------------|---------------------------|
| 1 | 4 | 5 | 1 |
| 2 | 8 | 10 | 2 |
| 3 | 12 | 15 | 3 |
| 4 | 16 | 20 | 4 |
| 5 | 20 | 25 | 5 |
| 6 | 24 | 30 | 6 |

The alternate form retains the primary's origin and origin-derived traits/tags. Occupation, other traits, and powers may change. Powers available to a Special Training origin character can be retained; others are lost.

### Multiple Primary Forms

Some characters (e.g., Banner) have multiple primary forms (Savage Hulk, Joe Fixit, Devil Hulk, Professor Hulk) all sharing a single alternate form. This is a "Narrator power" per the rules, but the system supports it for all users. Each primary form is a separate actor.

### Switching Forms

- A character switches forms using a **movement action** or **reaction** (instantaneous).
- Involuntary triggers (anger, stress, full moon) may force a switch. If resistable, the character makes an **Ego check** (Challenging, TN = rank of current form). If unresistable, the switch is automatic.

## Architecture

### Approach: Schema Fields + Token API

Form relationships are stored as schema fields on the actor data model, following the existing vehicle occupant pattern. Switching uses FoundryVTT's Token API to replace tokens in-place.

## System Setting

### `enableAlternateForms`

| Property | Value |
|----------|-------|
| Key | `enableAlternateForms` |
| Name | "Enable Alternate Forms" |
| Hint | "Adds alternate form management to character sheets, allowing characters to link and switch between multiple forms." |
| Scope | `world` (GM-only) |
| Type | `Boolean` |
| Default | `false` |
| Config | `true` |

When **disabled**: Forms section hidden from Details tab, context menu entries hidden, existing form link data preserved but not surfaced.

When **enabled**: Forms section visible on character/NPC Details tabs, context menu entries appear on actors and tokens.

## Data Model

### Actor Schema Changes (Character and NPC)

Two new fields added to `MarvelMultiverseActorBase.defineSchema()`:

```js
alternateForms: new fields.ArrayField(new fields.SchemaField({
  actorId: new fields.StringField({ required: true, blank: false }),
  formType: new fields.StringField({
    required: true,
    initial: "powerDown",
    choices: ["cosmetic", "powerDown", "powerSwap"]
  }),
  triggers: new fields.ArrayField(new fields.SchemaField({
    description: new fields.StringField({ required: true, blank: false }),
    resistable: new fields.BooleanField({ initial: true }),
    tn: new fields.NumberField({ required: true, initial: 0, integer: true, min: 0 })
  }))
}))

primaryFormIds: new fields.ArrayField(new fields.StringField({ required: true, blank: false }))
```

### Config Enum

```js
alternateFormTypes: {
  cosmetic: "MARVEL_MULTIVERSE.AlternateForm.Cosmetic",
  powerDown: "MARVEL_MULTIVERSE.AlternateForm.PowerDown",
  powerSwap: "MARVEL_MULTIVERSE.AlternateForm.PowerSwap"
}
```

### Validation Rules

- An actor cannot link to itself.
- An actor with entries in `primaryFormIds` (already an alternate) cannot itself have `alternateForms` entries — prevents circular chains. It can, however, be the alternate for multiple primaries (e.g., Banner is alternate for both Savage Hulk and Joe Fixit).
- A primary can link to multiple alternates (multi-form scenario).
- Only actors in the same world can be linked.
- Linking is bidirectional: adding an alternate sets `alternateForms` on the primary and `primaryFormIds` on the alternate. Unlinking clears both sides.

## Form Linking Workflow

1. User creates both actors as separate characters with their own abilities, powers, traits, and rank.
2. On the primary actor's Details tab, the **"Alternate Forms"** section shows an **"Add Form"** button.
3. Clicking "Add Form" opens a dialog with:
   - Actor picker dropdown (filtered to characters/NPCs, excluding self and actors with existing `primaryFormIds`)
   - Form type select: Cosmetic / Power Down / Power Swap
   - Triggers list with add/remove rows (description text, resistable checkbox, TN number input)
4. On save, the system sets `alternateForms` on the primary and `primaryFormIds` on the alternate.
5. The Forms section shows linked forms as a list with name, image, type badge, trigger summary, and Switch/Edit/Unlink buttons.
6. Unlinking removes the entry from `alternateForms` and clears `primaryFormIds`. Neither actor is deleted.

## Form Switching Mechanics

### Triggering a Switch

Three methods:
1. **Sheet button:** Click "Switch" next to a form in the Details tab Forms section.
2. **Actor sidebar context menu:** Right-click actor → "Switch to [Form Name]".
3. **Token context menu:** Right-click token → "Switch to [Form Name]".

All three are considered **voluntary** switches (no Ego check).

For **involuntary** switches, the token context menu includes:
- "Trigger Involuntary Change" → submenu of configured triggers → initiates Ego check flow.

### What Happens on Switch

1. If the actor has a token on the active scene: delete the current token, create a new token for the target form actor at the same **position**, **elevation**, and **rotation**.
2. If in combat: the new token inherits the combatant's **initiative** and **turn position** in the tracker. The combatant entry updates to reference the new actor/token.
3. A **chat message** is posted: "*[Character] transforms into [Form Name]*".
4. If the old form's sheet was open, the new form's sheet opens.

### Involuntary Trigger (Ego Check)

1. When triggered, the system checks if the trigger is resistable.
2. If **resistable**: a dialog appears — "Make an Ego check (TN [tn]) to resist transforming into [Form Name]?"
   - Meeting or beating the TN: form stays, chat message says the character resisted.
   - Failing: form switches as normal.
3. If **not resistable** (TN = 0): switches immediately, no dialog.

## Character Sheet UI

### Details Tab — "Alternate Forms" Section

Placed after existing content on the Details tab. Only visible when `enableAlternateForms` setting is enabled.

**Primary form actor (or unlinked actor):**

```
┌─ Alternate Forms ──────────────────────────┐
│                                            │
│  [img] Bruce Banner                        │
│  Power Down  ·  Triggers: Calm, Sleep      │
│  [Switch] [Edit] [Unlink]                  │
│                                            │
│  [img] Joe Fixit                           │
│  Power Swap  ·  No triggers                │
│  [Switch] [Edit] [Unlink]                  │
│                                            │
│  [+ Add Form]                              │
└────────────────────────────────────────────┘
```

**Alternate form actor (has entries in `primaryFormIds`):**

```
┌─ Alternate Forms ──────────────────────────┐
│                                            │
│  Alternate form of:                        │
│                                            │
│  [img] Hulk (Savage)                       │
│  Power Down  [Switch]                      │
│                                            │
│  [img] Joe Fixit                           │
│  Power Swap  [Switch]                      │
│                                            │
└────────────────────────────────────────────┘
```

Lists all primary forms this actor is an alternate of, with switch buttons for each. No "Add Form" button — alternates don't manage their own form list.

### Context Menus

**Actor sidebar:** "Switch Form" → submenu of linked form names. For alternates: "Switch to [Primary Name]".

**Token canvas:** Same entries, plus "Trigger Involuntary Change" → submenu of configured triggers.

### Add Form Dialog

An Application v2 dialog with:
- Actor dropdown (filtered to characters/NPCs, excluding self and actors that have their own `alternateForms` entries — prevents circular chains)
- Form type select (Cosmetic / Power Down / Power Swap)
- Triggers list with add/remove rows (description text field, resistable checkbox, TN number input)

## Localization

New keys in `lang/en.json`:

```json
"AlternateForm": {
  "Cosmetic": "Cosmetic",
  "PowerDown": "Power Down",
  "PowerSwap": "Power Swap",
  "SectionTitle": "Alternate Forms",
  "AddForm": "Add Form",
  "EditForm": "Edit Form",
  "UnlinkForm": "Unlink Form",
  "SwitchForm": "Switch Form",
  "SwitchTo": "Switch to {name}",
  "AlternateOf": "Alternate form of:",
  "TriggerInvoluntary": "Trigger Involuntary Change",
  "EgoCheckPrompt": "Make an Ego check (TN {tn}) to resist transforming into {name}?",
  "EgoCheckSuccess": "{name} resists the transformation.",
  "EgoCheckFailure": "{name} fails to resist and transforms!",
  "TransformMessage": "{name} transforms into {form}.",
  "Setting": {
    "Enable": "Enable Alternate Forms",
    "EnableHint": "Adds alternate form management to character sheets, allowing characters to link and switch between multiple forms."
  }
}
```

## Testing Strategy

### Unit Tests (Jest)

- Schema validation: `alternateForms` array field structure, `primaryFormIds` field, `alternateFormTypes` enum
- Form linking logic: add/remove forms, bidirectional reference integrity
- Validation rules: no self-linking, no circular chains (alternates can't have their own alternates), actors can be alternate for multiple primaries

### E2E Tests (Playwright)

1. **Link forms:** Create two actors, link them as primary/alternate via the Details tab Add Form dialog.
2. **Verify display:** Confirm the Forms section renders correctly on both actors (primary shows list with buttons, alternate shows "Alternate form of" with switch-back button).
3. **Switch via sheet:** Click Switch button on the Details tab, verify token replacement on canvas at same position.
4. **Switch via context menu:** Right-click actor in sidebar, select Switch, verify same behavior.
5. **Combat tracker:** Create linked actors, add primary to scene, start combat, switch forms during primary's turn. Verify: token replaced at same position, combatant updates to new actor/token with same initiative.
6. **Unlink:** Unlink forms outside combat and verify data cleanup on both actors. Re-link, start combat, unlink mid-combat — verify combatant stays in tracker and context menu no longer shows switch options.
7. **Setting disabled:** Disable `enableAlternateForms`, verify Forms section hidden and context menu entries absent.
8. **Involuntary trigger:** Configure a resistable trigger, use token context menu to trigger involuntary change, verify Ego check dialog appears. Test both pass (form stays) and fail (form switches) outcomes.

## Files Affected

### New Files
- `templates/actor/parts/actor-alternate-forms.hbs` — Forms section partial for Details tab
- `templates/dialogs/add-form-dialog.hbs` — Add Form dialog template
- `module/helpers/alternate-forms.mjs` — Form linking, switching, and validation logic
- `module/__tests__/alternate-forms.test.mjs` — Unit tests
- `e2e/alternate-forms.spec.mjs` — E2E tests

### Modified Files
- `module/data/actor-base.mjs` — Add `alternateForms` and `primaryFormIds` schema fields
- `module/config.mjs` — Add `alternateFormTypes` enum
- `module/sheets/character-sheet.mjs` — Add Forms section to Details tab, Add Form dialog, switch/unlink handlers
- `module/sheets/npc-sheet.mjs` — Same Forms section support
- `module/helpers/templates.mjs` — Register new partials
- `marvel-multiverse.mjs` — Compiled bundle updates, system setting registration, context menu hooks
- `lang/en.json` — Localization keys
- `templates/actor/actor-character-sheet.hbs` — Include Forms partial in Details tab
