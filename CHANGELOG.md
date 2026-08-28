# CHANGELOG

## 3.1.1

### Big Fight Abstraction Mode

- A **Big Fight** toggle on the combat tracker simplifies large battles: side-based initiative, foe grouping, and a group attack bonus.
- **Side-based initiative:** one roll per side, using its best Vigilance, instead of per-combatant rolls. Ties reroll once.
- **Foe grouping:** same-side combatants group into one tracker row with pooled, editable Health and Focus. A member drops out of the pool as its Health is depleted; damage to an individual target still applies to that combatant directly.
- **Group attack bonus:** a grouped attacker's roll gets +1 per additional live member beyond the first.
- **In-range toggle** replaces movement tracking with a per-combatant in/out-of-range marker.
- Attacking multiple foes in one roll resolves each target's hit/miss and damage individually, with a grouped heading on the damage card when two or more targets share a group.

### Sinister Plot Points, Battle Multiplier & Ultimate Fantastic Initiative

- **Sinister Plot Points.** A Villainous-tagged actor gets an SPP tracker in place of Karma, gated by a world setting.
- **Battle Multiplier.** The x30 Health/Focus scaling is now a world setting, x10–x100 (default x30).
- **Ultimate Fantastic Initiative.** An M on the initiative roll posts a chat note for the bonus round.
- **Fixed:** Fantastic detection on the Marvel die and initiative-roll registration, both pre-existing.
- Disarming, from the same source material, remains a manual GM action — not automated.

### Stunts

- **New Stunt item type**, off by default behind a "Stunts" world setting, linked to a specific power.
- A power gains a **Stunts tab** listing its stunts, split Learned/Available.
- Learning is manual: a Learn control matches the actor's powers against the stunt's prerequisite text, or prompts for confirmation on no match.
- A learned stunt rolls and posts its effect to chat, like traits and tags.

### Reaction Powers

- A power whose action text names "Reaction" shows a red "R" icon next to its name.
- **Fixed:** a missing closing tag on the power row was silently breaking item-detail sub-text styling.

### Items Sidebar & Equipment

- The Items sidebar gains a filter panel matching the Actor directory's: Type, Source, Tags, Traits, plus Power Set/Duration or Equipment Type.
- **Fixed:** the equipment HP field showed current and max on separate lines instead of current / max.

## 3.1.0

### Rolling a Power

- **Power text is clickable.** A power that tells you to make a check — "the character makes an Ego check", "makes a close attack", "requires a Melee check (target number 20)" — now renders that phrase as a link that rolls it. A stated target number is carried onto the roll and the card says whether it was met. The same links work on item sheets and in journal entries.
- Only phrases that instruct you to roll are linked. Text naming the class of rolls a bonus applies to — "gains an edge on all close attacks" — is left as plain text, as is a defense being rolled against.
- **A power that names its own check is no longer rolled by clicking it.** Clicking such a power posts its card; the link in the text rolls it. Previously you got two attacks in the log for one action. Of the 79 attack powers in the compendium, 78 name their check in their own text.
- Rolling through that link knows which power it came from, so the card uses the power's damage type and compares against the defense the power names rather than the ability rolled. Several powers are rolled with one ability against another — a Melee check against Agility defense — and those were previously judged against the wrong defense.

### Half-Damage Powers

- Powers whose text says targets "take half regular damage" now deal half. A new **Damage Scale** field on the power sheet holds the fraction, and the damage card applies it.
- A Fantastic success deals the total before halving, not double the halved figure. Halving and the Fantastic doubling are worked out together and rounded once, so a regular 11 gives 6 normally and 11 on a Fantastic rather than 12. Rounding is up throughout, as the rulebooks do everywhere.
- The damage breakdown shows the scale, so the printed total can be checked against its parts.
- **Action required, handled automatically:** powers already on your characters are independent copies and did not pick up this change, so a one-time repair runs when the world loads. It also restores the attack settings on powers imported before those fields existed — without an ability set, a power could not be rolled at all. A power whose Damage Scale you have set yourself is left alone.

### Chat Cards

- Power cards show Action, Trigger, Duration and Cost under the power name, omitting any the power does not set, and every line on the card shares one size and left edge.
- **Fixed:** cards for traits, tags, weapons and every item type other than powers were rendered entirely in italics. The italic marks flavor text sitting above rules text, which only powers have, so it now appears only where there is rules text to contrast with.
- The Damage button on a check card is centered under the roll rather than pushed against the left edge.

### Activating Powers

- A power with a Focus cost can be activated from its row on the sheet or from its chat card, which spends the Focus. A stepper sets the amount when the cost is a range, and the control is hidden from anyone who may not use it.
- Health and Focus each gained a control that resets the value to its maximum.

### Character Sheet

- The Biography tab is split into **Details**, **Background** and **Advancement** sub-tabs.
- The Advancement sub-tab shows the schooling chart, tracking progress toward the next rank.
- Rich text fields no longer collapse to a sliver when empty; each keeps a minimum height whether or not it is being edited.

### Applying Damage

- The damage chat card now carries a **Take Damage** button on each target the attack hit. Clicking it subtracts that target's damage from Health, or from Focus when the attack does Focus damage. The amount comes from the card, so it matches what the card printed.
- The GM sees the button on every hit target. A player sees it only on targets they own, and a user who owns none of the targets sees the card with no buttons.
- Once a target's damage has been taken the button reads **Applied** and stops responding, for every connected client and after a reload. When a player applies damage the record is saved through a connected GM; with no GM connected the damage still applies and the player is told the button will come back.
- Health and Focus are allowed below zero, as before. Nothing is clamped.
- **Fixed:** the damage card was built from whoever was targeted at the moment the Damage button was clicked, not from the targets declared when the attack was rolled. Retargeting in between damaged the wrong actors. It now reads the targets recorded on the attack, which is also what lets it tell a hit from a miss — missed targets are listed as misses and take nothing.
- A Fantastic elemental effect now applies its status only to targets the attack hit, instead of to everyone who was targeted.

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