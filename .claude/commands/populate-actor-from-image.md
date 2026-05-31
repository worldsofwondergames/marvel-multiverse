# Populate Actor from Character Sheet Image

Convert a Marvel Multiverse RPG character sheet image into a fully populated FoundryVTT world actor.

**IMPORTANT: Foundry VTT must be closed before running this command.**

## Input

The user provides:
1. An image of a Marvel Multiverse RPG character sheet (photo, scan, or screenshot)
2. The actor name as it exists (or should exist) in the world

## Step 1: Extract Data from Image

Read the character sheet image and extract all fields:

### Abilities (top-left grid)
- Six abilities: Melee, Agility, Resilience, Vigilance, Ego, Logic
- Each has: Ability Score, Defense Score, Non-Combat Checks modifier
- **Only extract the Ability Score (first column).** Defense and Non-Combat are derived by `prepareDerivedData()` — do NOT store them.

### Damage Section (bottom-left)
- Four damage rows: Melee, Agility, Ego, Logic
- Each shows: Marvel die × Multiplier + Ability
- **Do NOT store damageMultiplier values.** They are derived: `prepareDerivedData()` calculates `damageMultiplier = rank + AE bonuses`. Active Effects from powers (like Accuracy, Discipline) add their bonuses, and the system adds rank on top.

### Stats (center)
- Rank, Karma
- Health (current value only — max is derived from Resilience × 30 + bonus)
- Focus (current value only — max is derived from Vigilance × 30 + bonus)
- Health Damage Reduction, Focus Damage Reduction (if shown)
- Speed: Run, Climb, Swim, Jump (only Run is stored; Climb/Swim/Jump are derived as ceil(Run × 0.5) unless modified by powers)
- Initiative Modifier: note if "E" (edge) is present — record the ability key in `edges` array

### Biography (top-right)
- Real Name, Height, Weight, Gender, Eyes, Hair, Size
- Distinguishing Features
- Occupation, Origin
- Teams, Base
- History (rich text — wrap paragraphs in `<p>` tags)
- Personality (rich text — wrap paragraphs in `<p>` tags)

### Traits & Tags (center)
- Traits: list of trait names, some with detail after colon (e.g., "Connections: Super Heroes")
- Tags: list of tag names, some with detail after colon (e.g., "Enemy: Doctor Doom")
- For items with a colon, always store as `name` + `detail` in the JSON. The script will first try matching a compendium item named `"Name: Detail"` (some origins like "High Tech: Pym Particles" exist as distinct items). If no full-name match is found, it falls back to matching by name alone and sets `system.detail`.

### Powers (bottom)
- Grouped by power set (Basic, Elemental Control, Illusion, etc.)
- Numbered powers like "Discipline 3" are single compendium items
- Note any parenthetical text (flavor/rules text) — strip when searching compendium
- If Elemental Control powers are present, note the element (often in parentheses after the power set name) and set `defaultElement`

## Step 2: Write the JSON Data File

Write a temporary JSON file at `modules/marvel-multiverse-data/scripts/actor-data.json` with the extracted data. The generic `populate-actor.mjs` script reads this file.

### JSON structure

```json
{
  "name": "Actor Name",
  "abilities": { "mle": 2, "agl": 4, "res": 2, "vig": 3, "ego": 4, "log": 1 },
  "edges": ["vig"],
  "rank": 3,
  "karma": 3,
  "health": 60,
  "focus": 90,
  "run": 5,
  "defaultElement": "",
  "bio": {
    "realname": "Real Name",
    "height": "5'7\"",
    "weight": "131 lbs.",
    "gender": "Female",
    "eyes": "Blue",
    "hair": "Red",
    "size": "average",
    "teams": "Avengers, S.H.I.E.L.D.",
    "base": "Mobile",
    "distinguishingFeatures": "<p>None</p>",
    "history": "<p>Paragraph 1</p><p>Paragraph 2</p>",
    "personality": "<p>Paragraph</p>"
  },
  "items": [
    { "name": "Beguiling", "type": "trait" },
    { "name": "Connections", "type": "trait", "detail": "Espionage" },
    { "name": "Heroic", "type": "tag" },
    { "name": "Linguist", "type": "tag", "detail": "Chinese, English, French" },
    { "name": "Inspiration", "type": "power" },
    { "name": "Special Training", "type": "origin" },
    { "name": "Spy", "type": "occupation" }
  ]
}
```

### Fields NOT to set (derived by the system)

| Field | Derived From |
|-------|-------------|
| `abilities.X.defense` | `value + 10` |
| `abilities.X.damageMultiplier` | `rank + AE bonuses` |
| `abilities.X.noncom` | `value + AE bonuses` |
| `health.max` | `res.value × 30 + health.bonus` |
| `focus.max` | `vig.value × 30 + focus.bonus` |
| `movement.climb.value` | `ceil(run × 0.5)` |
| `movement.swim.value` | `ceil(run × 0.5)` |
| `movement.jump.value` | `ceil(run × 0.5)` |
| `attributes.init.value` | `vig.value` |

## Step 3: Run and Verify

Run the script via PowerShell, passing the JSON data file as an argument:
```
cd C:\Users\jeff_\AppData\Local\FoundryVTT\Data\modules\marvel-multiverse-data\scripts
node populate-actor.mjs actor-data.json
```

Report all items added grouped by type, and flag any compendium items that weren't found.

## Input

$ARGUMENTS
