# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Marvel Multiverse is an unofficial FoundryVTT system module for the Marvel Multiverse Role Playing Game. It provides character sheets, dice mechanics, and game system support. The system runs on **FoundryVTT v13** and is written in ES modules with a Jest test suite and Playwright e2e tests.

## Common Commands

### Testing
- `npm test` — Run all Jest unit tests
- `npm test -- equipment.test.mjs` — Run single unit test by filename (add `--` before filename)
- `npm run test:e2e` — Run Playwright e2e tests in headless mode
- `npm run test:e2e:headed` — Run e2e tests in headed mode (browser visible, use existing session)
- `npm run test:e2e:debug` — Debug e2e tests with step-through
- `npx stryker run` — Run mutation tests (close FoundryVTT first to avoid LOCK file conflicts)

### Building & Linting
- `npm run build` — Full build: compile code, CSS, and pack database
- `npm run build:code` — Bundle code with rollup (output: `marvel-multiverse-compiled.mjs`)
- `npm run build:css` — Compile SCSS to CSS
- `npm run build:db` — Pack data files to database
- `npm run build:json` — Unpack database to JSON (inverse of build:db)
- `npm run lint` — Check code with ESLint
- `npm run lint:fix` — Auto-fix ESLint issues
- `npm run watch` — Watch SCSS for changes and recompile

## Testing

Always write and run unit tests after implementing a new feature or item type; verify zero regressions before opening a PR.

## Workflow

After completing work, verify state, run the relevant test suite (or Playwright E2E if applicable), then create a PR summarizing changes and test results.

## Architecture

### Module Structure
- **marvel-multiverse.mjs** — Entry point; sets up configuration, registers sheets, creates dice pools
- **module/config.mjs** — System configuration, constants, and enums
- **module/data/** — Data model definitions (Actor types: Character, NPC; Item types: Equipment, Power, etc.)
- **module/documents/** — FoundryVTT document classes (Actor, Item, ChatMessage) that extend base Foundry classes
- **module/sheets/** — Sheet UI classes (CharacterSheet, ItemSheet, NPCSheet)
- **module/dice/** — Marvel-specific dice mechanics (d616 die, damage rolls, roll flavor)
- **module/helpers/** — Utility functions (damage calculations, ability checks, etc.)
- **module/sidebar/** — Sidebar utilities (chat message rendering)

### Data Models

Item types are defined in `module/data/` and extend `ItemData`. Key types:
- **Equipment** — Protection (DR), grenades, gadgets with varying properties
- **Power** — Abilities with damage types and elemental effects
- **Weapon** — Items with damage output
- **Trait**, **Origin**, **Occupation**, **Tag**, **Restriction** — Character attributes

Actor types:
- **Character** — Player characters with abilities, powers, equipment
- **NPC** — Non-player characters with simplified stat blocks
- **Vehicle** — Vehicles with combat stats

Data models use Foundry's `defineSchema()` pattern to define fields; fields inherit from base types.

### Content Storage

Content (traits, powers, occupations, origins) is stored as **LevelDB packs** in `packs/`:
- `packs/tags` — Damage and effect tags
- `packs/powers` — Power abilities
- `packs/items` — Shared equipment
- `packs/traits`, `packs/origins`, `packs/occupations` — Character building blocks
- `packs/vehicles` — Vehicle templates

Marvel IP (character data, universe-specific content) lives in the **marvel-multiverse-data** module, not in this system repo.

### Testing Setup

- **Jest** — Unit tests in `module/__tests__/` test data models and mechanics
- **Mocks** — `module/__mocks__/` contains setup, FoundryVTT global stubs, and system config
- **Playwright** — E2E tests in `e2e/` drive a real FoundryVTT instance at `http://localhost:30000`
  - Runs in headed mode with browser visible
  - Uses existing Chrome session (never kill/relaunch browser)
  - Test fixtures in `e2e/fixtures.mjs` and helpers in `e2e/helpers.mjs`
- **Stryker** — Mutation testing configured in `stryker.config.mjs`; targets specific modules for mutation coverage

### Roll System

The Marvel Multiverse uses a custom `MarvelMultiverseRoll` class that extends Foundry's Roll. Key concepts:
- **Edge/Trouble** — Modifiers applied to rolls (Alt key = Edge, Ctrl/Cmd key = Trouble)
- **d616 die** — Marvel's custom die type
- **Roll flavor** — HTML templates for rendering rolls in chat with power/ability/damage info

## UI / Styling

- Text directly on a red background must be white. Black text is only for directly black backgrounds.

## Key Patterns & Guidelines

### Adding New Item Types
1. Create data model in `module/data/newtype.mjs` with `defineSchema()`
2. Export from `module/data/_module.mjs`
3. Add sheet in `module/sheets/newtype-sheet.mjs` if UI needed
4. Write unit tests in `module/__tests__/newtype.test.mjs`
5. Add e2e test if user-facing in `e2e/newtype.spec.mjs`
6. Update config.mjs if adding system enums

### Hooks & Initialization
System hooks are fired at init and setup:
- `Hooks.once('init')` — Configure Actor/Item types, register sheets, set up dice
- `Hooks.once('setup')` — Register effect icons, system effects
- `Hooks.once('ready')` — System ready, windows can open

### Localization
Strings for UI are in `lang/en.json`. Follow the nested structure:
- `MM.abilities.name` — Ability names
- `MM.equipment.type` — Equipment type labels
- `MM.settings.characterType` — Setting names

## Data

When touching item types or gear, check for required data migrations before assuming a bug is in code logic.

## Changelog

- Do not list fixes for bugs introduced within the same version. If a bug is introduced and fixed within the same release (e.g., both in 2.4.1), neither the bug nor the fix should appear in the changelog. Only document the final working behavior.

## Important Notes

- **Only marvel-616 world** — Actor searches default to marvel-616, not legacy-of-heroes
- **No IP in system** — Marvel characters, team names, universe-specific content belong in marvel-multiverse-data, not this repo
- **E2E tests run headed** — Never kill or relaunch Chrome during e2e tests; use existing session
- **Stryker lock issues** — Close FoundryVTT before running mutation tests to avoid LOCK file contention
- **PRs** — Always prompt before creating or updating a PR. Check for closed PRs on the same branch combination first.
