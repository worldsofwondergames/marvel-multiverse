# CHANGELOG

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
- Mutant Reputation system from the X-Men Expansion
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