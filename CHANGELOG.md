# CHANGELOG

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