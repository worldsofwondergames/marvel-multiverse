# Populate Actor with Compendium Items

Populate a FoundryVTT world actor with traits, tags, and powers from the marvel-multiverse-data compendium.

**IMPORTANT: Foundry VTT must be closed before running this command.**

## Input Format

The user provides an actor name and lists of traits, tags, and powers. The input may be free-form but typically looks like:

```
Actor: <name>

Traits
Trait Name 1
Connections: Super Villains
...

Tags
Tag Name 1
...

Powers
Power Name 1
Discipline 3
...
```

## Parsing Rules

1. **Colons in item names**: If an item has a `:` separator, the part before the colon is the compendium item name, and the part after is the `system.detail` field value. Example: "Connections: Super Villains" → name="Connections", detail="Super Villains".

2. **Extraneous text**: Item lines may include parenthetical notes, effect descriptions, costs, or other flavor text after the actual item name. Strip these when searching the compendium. Common patterns:
   - Parenthetical: "Iron Will (enemies have trouble on Ego attacks)"
   - Dash-separated: "Quick Learner - costs 10 karma"
   - Sentence after name: "Fearless The character cannot be frightened"
   
   Strategy: First try an exact match against the compendium. If not found, progressively strip from the end (at parentheses, dashes, periods, or sentence boundaries) and retry.

3. **Unicode normalization**: Normalize special dashes (‑ → -), smart quotes, etc. before matching.

4. **Numbered powers**: Powers like "Discipline 3" are single items; the number is part of the compendium name.

## Procedure

Use PowerShell (not Bash) for all node commands to avoid `!` key escaping issues with LevelDB.

### Step 1: Find the actor

Search all Marvel Multiverse world databases for the actor name:
- `C:\Users\jeff_\AppData\Local\FoundryVTT\Data\worlds\marvel-616\data\actors`
- `C:\Users\jeff_\AppData\Local\FoundryVTT\Data\worlds\legacy-of-heroes-01-00-come-together\data\actors`

Actor keys look like `!actors!<id>`. The actor document has an `items` array of string IDs.

If the actor is found in multiple worlds, ask which one to use.

### Step 2: Look up compendium items

Open the compendium LevelDB at:
`C:\Users\jeff_\AppData\Local\FoundryVTT\Data\modules\marvel-multiverse-data\packs\marvel-multiverse-items`

Item keys: `!items!<id>`
Effect keys: `!items.effects!<itemId>.<effectId>`

Items have an `effects` array of string effect IDs. For each effect ID, read the corresponding `!items.effects!` key to get the full effect data.

For each requested item:
1. Try exact name match first
2. If not found, try stripping detail/extraneous text
3. Report any items that couldn't be found and ask the user what to do

### Step 3: Write to world database

For each matched compendium item:
1. Generate a new 16-character alphanumeric ID for the item
2. Clone the item data, set `_id` to the new ID, clear `_key`
3. If the item has a detail (from colon parsing), set `system.detail`
4. For each effect on the item:
   - Generate a new 16-character ID
   - Clone the effect data, set `_id` to the new ID, clear `origin`
   - Write as key: `!actors.items.effects!<actorId>.<newItemId>.<newEffectId>`
   - Collect new effect IDs
5. Set item's `effects` array to the new effect ID strings
6. Write item as key: `!actors.items!<actorId>.<newItemId>`
7. Add the new item ID to the actor's `items` array

Write everything in a single batch, including the updated actor document.

### Step 4: Report results

List all added items grouped by type (traits, tags, powers), noting how many effects were included. Report any items that weren't found.

## Key Technical Details

- Use `classic-level` package (available in the marvel-multiverse-data/scripts directory)
- All IDs are 16 characters from `[A-Za-z0-9]`
- Effect records need `_stats` with `coreVersion: "13.351"`, `systemId: "marvel-multiverse"`, `systemVersion: "2.2.0"`, and timestamps
- Effects must have `transfer: true` to apply from items to actors
- Use `db.batch()` for atomic writes

## Input

$ARGUMENTS
