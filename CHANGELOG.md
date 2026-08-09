# CHANGELOG

## 3.1.0

### Concentration

- Activating a power whose duration is Concentration now records it against the character. A character can hold one per rank, on separate powers, as the core rulebook requires; a further power, or the same power twice, is refused before any Focus is spent.
- A **Concentrating** marker appears in the token HUD while at least one power is held. Clearing it ends everything the character is holding.
- Concentration ends automatically on becoming unconscious, demoralized, stunned or prone, and when the encounter ends. Blinded, deafened and paralyzed break it only when the power requires sight, hearing, or a Melee or Agility check, which the power data does not record, so those stay manual — as does knockback, which is not a condition.
- Powers that charge every turn or round — 7 of the 125 concentration powers — prompt at the start of the character's turn in combat. Continuing spends the cost again; declining ends that concentration. The other 118 are free to maintain and never prompt.
- A control on the power row ends a single concentration, at no action cost.

### Conditions

- **Conditions reworked to follow the rulebooks.** `Grappled` is renamed to `Grabbed`, and `Encumbered` and `Restrained` are replaced by `Demoralized` and `Pinned` — the names the core rulebook uses for those exact effects. `Demoralized`, `Pinned`, `Shattered` and `Damage Reduction` are added. `Damage Reduction` exists as a condition in addition to the existing numeric damage-reduction fields, which are unchanged. `Frightened`, `Flying` and `Invisible` are kept even though the books do not define them.
- The Force and Iron elemental Fantastic effects now apply `Demoralized` and `Pinned` instead of `Encumbered` and `Restrained`. Their behaviour is unchanged; only the condition name differs. Swarm still applies `Frightened`.
- **Action required:** tokens already carrying Grappled, Encumbered or Restrained keep a status id the system no longer registers, so they will show a stale icon that cannot be cleared from the HUD. Clear and reapply the condition on any affected token.

## 3.0.0

### Hotbar Macros

- Ability scores and Non-Combat Checks can now be dragged from a character or NPC sheet onto the macro hotbar. They were never drag sources, and `hotbarDrop` had no branch for them, so the drop did nothing
- Ability and non-combat rolls now share one implementation between the sheet and the hotbar macro, so both produce the same chat card

### FoundryVTT v14 Compatibility

- **Active Effects now apply again.** `MarvelMultiverseActor.prepareBaseData()` overrode Foundry's method without calling `super`. As of v14 that method runs `_clearData()`, which initialises the state `applyActiveEffects()` depends on — so effect application threw before applying anything and **no Active Effect took effect on any actor**. Restoring the `super` call fixes every affected effect: ability modifiers, damage multipliers, damage reduction, and battle suit bonuses.
- Replaced `ChatMessage#user` with `#author` (removed in v14)
- Replaced `ActiveEffect#icon` with `#img` (removed in v14)
- Removed `CONFIG.ActiveEffect.legacyTransferral` (framework removed in v14; the system already used the modern behavior)
- **Breaking:** FoundryVTT v14 is now the minimum supported version. Compatibility declares `minimum: 14, verified: 14`; v13 and earlier are no longer supported
- Added a guard test that scans for v14-removed APIs and for missing `super.prepareBaseData()` calls, so these cannot silently regress
- Untracked the generated `marvel-multiverse-compiled.mjs` build artifact, which is regenerated during release
- Fixed the Jest `canvas` global stub so the `MarvelMultiverseItem — roll` tests run; they threw `ReferenceError` before reaching `ChatMessage.getSpeaker`
- Equipment damage-reduction effects now set `img` instead of the `icon` removed in v14, so they render with the equipment's image. Carried in from 2.4.1, which predates the v14 work

## 2.4.1

### Headquarters System
- New Headquarters actor type for team bases with dedicated sheet
- HQ Tag and HQ Trait item types owned by headquarters actors
- Tag incompatibility enforcement prevents conflicting tags
- Team rank auto-calculated from top 6 member ranks (rounded up)
- Health bar with operational/damaged/destroyed status tracking
- Trait slots scale with team rank (3 per rank)
- Drag-and-drop member management (characters and NPCs)
- Downtime activity tracking on traits

### Alternate Form Management
- Alternate form system allowing characters to link and switch between multiple forms
- Three form types: Cosmetic, Power Down, and Power Swap
- Form switching replaces tokens in-place, preserving position, elevation, rotation, combat tracker state, and all prototype token settings
- Actor sidebar context menu and Token HUD button for voluntary switching
- Involuntary trigger flow with resistable Ego check
- Forms section on character and NPC sheet Biography tabs with Add Form dialog
- Enabled by default via "Enable Alternate Forms" world setting

### Condition Automation
- Asleep and Exhausted conditions with Active Effects
- Turn-based condition damage via updateCombat hook with reliable turn tracking

### Chat Message Styling
- Dark red header with circular token image and white token name
- Chat messages now display token name instead of actor/sheet name for linked tokens
- White three-dot context menu controls on dark red header

### Context Menu Improvements
- Left-click support for three-dot context menu (Make Private / Delete)
- Proper toggle behavior using v13 ContextMenu API

### Status Effects Cleanup
- Removed non-MMRPG status effects: Petrified, Silenced, Incapacitated

## 2.4.0

### Iconic Items & Battle Suits
- New Iconic Item item type with data model, sheet, and drag-drop power support
- Iconic Items power set registered in system config
- Restriction item type with drag-drop onto iconic item sheets and enforcement
- Alphabetized powers/restrictions, em dash for negative power value, centered PV display
- New Battle Suit item type with data model, sheet, and drag-drop support
- Iconic items and battle suits supported on actor sheets

### Vehicle Actor Type
- New vehicle actor type with data model, sheet, and templates
- Vehicle weapons item type with dedicated sheet
- Vehicle occupants with crew derived from occupants
- Vehicle sheet UI with header, tab navigation, and weapons styling
- Actor type filter and vehicle size config

### Conditions & Status Effects
- New conditions: Corroding, Poisoned, Infected with Condition DR
- Ablaze and Bleeding separated into distinct conditions
- Replaced Foundry default statuses with MMRPG-only conditions
- Built-in Foundry icons for Ablaze, Unconscious, Poisoned, and Corroding
- Alphabetized target list in combat

### Elemental Effects
- Elemental fantastic success status effects
- Chemical element wired to corroding status
- Redesigned power roll chat card with token header and styled layout
- Active canvas token image used in chat card instead of prototype token

### Mutant Reputation
- Mutant Reputation system
- Fix Fantastic damage after trouble reroll on Marvel die

### Non-Combat Movement Speed
- Non-combat movement speed calculation support
- Auto-activate movement types that have a calc mode set

### Stacking Rules
- Enforce rulebook stacking rules for speed, damage multiplier, and damage reduction

### Actor Directory Filters
- Advanced filter panel for the Actors sidebar

### Bug Fixes
- Fix trait wrapping so edit/delete icons stay at upper right
- Fix crash when clicking damage button with no active scene
- Additional damage button regex fixes for flavor text formats

### Testing
- Playwright E2E test suite with FoundryVTT setup automation
- Comprehensive E2E tests for core MMRPG mechanics, character creation, edge/trouble, damage calculation, and elemental effects
- Jest test framework with mutation testing

### Housekeeping
- Removed packs and docs from git tracking
- Updated compatibility to FoundryVTT v13

## 2.3.1

### Attack & Damage Improvements
- Attack rolls now display targeted tokens with hit/miss results in chat
- Clicking a target in chat opens their actor sheet; hovering highlights their token
- Improved damage chat output with clearer formatting and damage reduction breakdown
- Damage multiplier now floors at 0 (prevents negative damage)
- Case-insensitive regex matching for ability and damage type parsing
- Damage button removed from chat for initiative rolls and non-damage abilities

### Brawling
- Brawling power support: if an actor has the Brawling power, their Agility defense is raised to match Melee defense when Melee is higher

### Default Item Icons
- Default icons for generic items and weapons
- Existing default icons for traits, occupations, origins, powers, and tags

### CI/CD
- Added `contents:write` permission to release workflow

## 2.3.0

### Source & Compendium Updates
- Added Enter: Hydra and Cataclysm of Kang sources
- Compendium pack updates

### Populate Actor Skill
- Generic populate-actor script for bulk actor creation
- Auto-create actors with images, token defaults, and Uncanny DR
- Improved populate-actor command handling

### Character Sheet Improvements
- Auto-calculate Health and Focus max values (Health min 10)
- Edge/Trouble wired to rolls
- Ranked power count display
- Alphabetized power sets, traits, tags, and powers
- Power count shown on sheet
- Auto-populate setting added

### UI & Layout
- Fixed item row layout and icon wrapping
- Bumped version and updated repo URLs to worldsofwondergames

## 2.2.0

- Add support for Foundry v10