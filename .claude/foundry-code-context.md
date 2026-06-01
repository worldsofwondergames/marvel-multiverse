# Marvel Multiverse FoundryVTT Code Context

## Architecture
- **FoundryVTT v13** with ApplicationV2, DialogV2, renderDialogV2 hooks
- **Single-file system**: All code consolidated into `marvel-multiverse.mjs` (~3200 lines)
- **No build step**: CSS is plain CSS (`css/marvel-multiverse.css`), templates are Handlebars
- **Module companion**: `marvel-multiverse-data` module at `C:\Users\jeff_\AppData\Local\FoundryVTT\Data\modules\marvel-multiverse-data` holds compendium packs

## Key Classes in marvel-multiverse.mjs

### MarvelMultiverseRoll (extends Roll)
- Line ~14. Custom d616 roll class
- `configureModifiers()` — sets up fantastic detection, edge/trouble dice modification
- `EDGE_MODE` enum: NORMAL=0, EDGE=1, TROUBLE=2
- `validD616Roll` — checks formula matches d616 pattern
- `isFantastic` — true when Marvel die shows 1 and total meets target

### MarvelDie (extends foundry.dice.terms.Die)
- Custom die term for the Marvel die (dM), faces 1-6
- Face value 1 = Marvel result (triggers fantastic checks)

### MarvelMultiverseCharacterSheet (extends ActorSheet)
- `getData()` (~line 1820) — prepares template context
- `_prepareItems()` (~line 1880) — sorts items into powers (by powerSet), traits, tags, gear, origins, occupations, weapons
- `_onRoll()` — handles ability/power rolls, reads edge/trouble from ability data
- Drop handlers for origins/occupations gated by `autoPopulateOrigin` setting

### MarvelMultiverseNPCSheet (extends ActorSheet)
- Parallel structure to CharacterSheet with same methods
- Simplified template, no biography tab

### MarvelMultiverseActorBase (extends foundry.abstract.TypeDataModel)
- `defineSchema()` (~line 2900) — defines all actor data fields
- `prepareDerivedData()` (~line 3080) — calculates Health max, Focus max, movement speeds, defense scores, damage multipliers
- Health/Focus use the **bonus pattern**: schema defines `bonus` field (initial 0), Active Effects target `system.health.bonus`/`system.focus.bonus`, then `prepareDerivedData()` calculates `max = (ability × 30) + bonus`

### MarvelMultiverseNPC (extends MarvelMultiverseActorBase)
- Separate `prepareDerivedData()` (~line 3150) with same calculations

### ChatMessageMarvel
- `_handleChatButton()` (~line 1556) — retroactive edge/trouble via chat buttons, modifies evaluated roll formula with regex

### MarvelMultiverseItemSheet (extends ItemSheet)
- Power set management (add/remove power sets)
- Element selection for elemental powers

## Data Schema Pattern
- Actor system data defined in `MarvelMultiverseActorBase.defineSchema()`
- Key fields: `abilities.{mle,agl,res,vig,ego,log}`, `health.{value,max,bonus}`, `focus.{value,max,bonus}`, `movement.{run,climb,swim,jump,flight,glide,swingline,levitation}`, `attributes.rank`, `karma`, `defaultElement`, `defaultWeaponType`
- Item fields defined inline for each type (power, trait, tag, origin, occupation, weapon)

## Active Effects
- **Mode 2** = Add (CONST.ACTIVE_EFFECT_MODES.ADD)
- **Mode 5** = Override (CONST.ACTIVE_EFFECT_MODES.OVERRIDE)
- `transfer: true` makes effects apply from owned items to the parent actor
- Common AE targets: `system.abilities.X.damageMultiplier`, `system.abilities.X.noncom`, `system.health.bonus`, `system.focus.bonus`, `system.healthDamageReduction`, `system.focusDamageReduction`, `system.movement.X.active`, `system.movement.X.calc`

## LevelDB Compendium Structure
Pack location: `modules/marvel-multiverse-data/packs/marvel-multiverse-items/`

Key format:
- `!items!{itemId}` — item document (effects array contains string IDs, NOT inline objects)
- `!items.effects!{itemId}.{effectId}` — effect document stored separately

World actor key format:
- `!actors!{actorId}` — actor document (items array contains string IDs)
- `!actors.items!{actorId}.{itemId}` — embedded item
- `!actors.items.effects!{actorId}.{itemId}.{effectId}` — embedded item's effect
- `!actors.effects!{actorId}.{effectId}` — actor-level effect

IDs are 16-character alphanumeric strings. Use `classic-level` package (in marvel-multiverse-data/scripts) to read/write. **Foundry must be closed** to access world databases.

## Templates
- `templates/actor/actor-character-sheet.hbs` — main character sheet
- `templates/actor/actor-npc-sheet.hbs` — NPC sheet
- `templates/actor/parts/actor-powers.hbs` — powers list partial (iterates `{{#each powers}}` by power set)
- `templates/actor/parts/actor-traits.hbs` — traits list with `system.detail` display
- `templates/actor/parts/actor-tags.hbs` — tags list
- `templates/actor/parts/actor-details.hbs` — biography details (name, height, weight, etc.)
- `templates/actor/parts/actor-biography.hbs` — history, personality, features (ProseMirror editors)
- `templates/actor/parts/actor-origin.hbs` / `actor-occupation.hbs` — origin/occupation dropdowns

## CSS
Single file: `css/marvel-multiverse.css`
- `.mm-item` — item row styling (flex, nowrap)
- `.mm-derived-value` — read-only calculated fields (health/focus max)
- `.mm-styled-field`, `.mm-styled-label`, `.mm-styled-input` — form field patterns

## System Settings
- `autoPopulateOrigin` (Boolean, default true) — auto-create associated powers/traits/tags when adding origin/occupation

## Config Object (MARVEL_MULTIVERSE)
Registered as `CONFIG.MARVEL_MULTIVERSE` in the init hook. Contains:
- `abilities` — six ability definitions
- `sizes` — size categories with multipliers
- `powersets` — 26 power set categories
- `elements` — elemental types with fantastic effects
- `weaponTypes` — blunt/sharp
- `movementTypes` — run, climb, swim, jump, flight, glide, swingline, levitation
- `sources` — rulebook sources
- `MARVEL_RESULTS` / `DICE_RESULTS` — die face icons

## Scripts Directory (marvel-multiverse-data/scripts/)
Node.js scripts for compendium management:
- `populate-powers.mjs`, `populate-traits.mjs`, `populate-tags.mjs`, `populate-origins.mjs`, `populate-occupations.mjs` — bulk import scripts
- `rebuild-compendium.mjs` — rebuilds the LevelDB pack
- `add-new-powers.mjs` — adds new powers to existing pack
- Use `import { ClassicLevel } from 'classic-level'` for ESM scripts

## GitHub Repos
- System: `worldsofwondergames/marvel-multiverse`
- Module: `worldsofwondergames/marvel-multiverse-data`

## PowerShell Requirement
Always use PowerShell (not Bash) when running node commands that interact with LevelDB. Bash mangles `!` characters in LevelDB keys (e.g., `!actors!` gets interpreted as history expansion).
