# Populate Actor from Character Sheet Image

Convert a Marvel Multiverse RPG character sheet image into a fully populated FoundryVTT world actor. If the actor doesn't exist in the world yet, the script creates it automatically.

**IMPORTANT: Foundry VTT must be closed before running this command.**

## Input

The user provides:
1. An image of a Marvel Multiverse RPG character sheet (photo, scan, or screenshot)

## Step 1: Extract Data from Image

Read the character sheet image and extract all fields:

### Character Name (top of sheet)
- The character name appears in bold at the top of the sheet (e.g., "ANT-MAN" or "BLACK WIDOW (NATASHA ROMANOFF)")
- Convert to title case (e.g., "Ant-Man", "Black Bolt", "Black Widow")
- If a parenthetical real name is shown (e.g., "NATASHA ROMANOFF"), it goes in the biography `realname` field, not the actor name
- Ask the user to confirm the actor name if it's ambiguous

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
- Health Damage Reduction, Focus Damage Reduction — these are derived from Active Effects on powers (e.g., Sturdy adds health DR). Do NOT store them in the JSON.
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
- **IMPORTANT:** Each distinct item is marked with a diamond bullet (◆). If text appears on the next line WITHOUT a diamond bullet, it is a continuation of the previous item's name (e.g., "◆ Enduring" followed by "Constitution" on the next line = one trait named "Enduring Constitution"). Do NOT treat continuation lines as separate items.
- For items with a colon, always store as `name` + `detail` in the JSON. The script will first try matching a compendium item named `"Name: Detail"` (some origins like "High Tech: Pym Particles" exist as distinct items). If no full-name match is found, it falls back to matching by name alone and sets `system.detail`.

### Powers (bottom)
- Grouped by power set (Basic, Elemental Control, Illusion, etc.)
- Numbered powers like "Discipline 3" are single compendium items
- If a power has parenthetical text (e.g., "Animal Communication (Bugs)"), strip the parenthetical from the power name and store it as `detail` on the item
- If Elemental Control powers are present, note the element (often in parentheses after the power set name) and set `defaultElement`

## Step 2: Find Actor and Token Images

Check `modules/marvel-multiverse-data/assets/images/` (top level only, not subfolders) for a character portrait image. Look for files matching the actor's display name with any of these extensions: `.png`, `.webp`, `.jpg`, `.jpeg`, `.svg`, `.avif`. The name on the image file may not exactly match the actor name (e.g., actor "Ant-Man (Scott Lang)" has image "Ant-Man.png"). If exactly one match is found, include `img` in the JSON. If multiple possible matches exist or the name is ambiguous, ask the user which one to use. If none found, omit `img`.

Then check `modules/marvel-multiverse-data/assets/images/Tokens/` for a token image. Token files follow the pattern `"<Name> Token.<ext>"`. Same matching rules — exact single match goes in `tokenImg`, ambiguous or multiple matches prompt the user, none found omits it.

Image paths in the JSON use the Foundry-relative format: `modules/marvel-multiverse-data/assets/images/<filename>`.

## Step 3: Write the JSON Data File

Write a temporary JSON file at `modules/marvel-multiverse-data/scripts/actor-data.json` with the extracted data. The generic `populate-actor.mjs` script reads this file.

### JSON structure

```json
{
  "name": "Actor Name",
  "hero": true,
  "img": "modules/marvel-multiverse-data/assets/images/Actor Name.png",
  "tokenImg": "modules/marvel-multiverse-data/assets/images/Tokens/Actor Name Token.png",
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
    { "name": "Animal Communication", "type": "power", "detail": "Bugs" },
    { "name": "Special Training", "type": "origin" },
    { "name": "Spy", "type": "occupation" }
  ]
}
```

### Hero vs Villain (`hero` field)

Set `"hero": true` for heroes, `"hero": false` for villains, `"hero": "neutral"` for civilians/NPCs that are neither. Determine from the character sheet — characters with the "Heroic" tag are heroes; obvious villains are `false`; civilians or ambiguous characters are `"neutral"`.

| Setting | Hero (`true`) | Villain (`false`) | Neutral (`"neutral"`) |
|---------|------|---------|---------|
| Disposition | Friendly | Hostile | Neutral |
| Display Bars | Hovered by Anyone (Health + Focus) | None | None |

All actors get: Display Name = Hovered by Anyone, Link Actor Data = true, Lock Rotation = true, Vision Enabled = true.

### Fields NOT to set (derived by the system)

| Field | Derived From |
|-------|-------------|
| `healthDamageReduction` | Active Effects from powers (e.g., Sturdy) |
| `focusDamageReduction` | Active Effects from powers (e.g., Mental Shelter) |
| `abilities.X.defense` | `value + 10` |
| `abilities.X.damageMultiplier` | `rank + AE bonuses` |
| `abilities.X.noncom` | `value + AE bonuses` |
| `health.max` | `res.value × 30 + health.bonus` |
| `focus.max` | `vig.value × 30 + focus.bonus` |
| `movement.climb.value` | `ceil(run × 0.5)` |
| `movement.swim.value` | `ceil(run × 0.5)` |
| `movement.jump.value` | `ceil(run × 0.5)` |
| `attributes.init.value` | `vig.value` |

## Step 4: Run and Verify

Remove any stale LOCK files before running (Foundry may leave them after a crash):
```
Remove-Item "C:\Users\jeff_\AppData\Local\FoundryVTT\Data\worlds\marvel-616\data\actors\LOCK" -Force -ErrorAction SilentlyContinue
Remove-Item "C:\Users\jeff_\AppData\Local\FoundryVTT\Data\modules\marvel-multiverse-data\packs\marvel-multiverse-items\LOCK" -Force -ErrorAction SilentlyContinue
```

Run the script via PowerShell, passing the JSON data file as an argument:
```
cd C:\Users\jeff_\AppData\Local\FoundryVTT\Data\modules\marvel-multiverse-data\scripts
node populate-actor.mjs actor-data.json
```

Report all items added grouped by type, flag any compendium items that weren't found, and confirm whether portrait and token images were set.

## Input

$ARGUMENTS
