# Marvel Multiverse RPG System Context

## Dice System: d616
The core mechanic uses a d616 roll: two standard d6s flanking a special Marvel die (dM). The formula is `{1d6,1dm,1d6}` as a PoolTerm. The Marvel die has faces 1-6 where rolling a 1 is a "Marvel result" (M), which triggers a Fantastic success if the total also meets the target number.

- **Edge**: Roll 2d6 and keep the higher for the first d6 position → `{2d6kh,1dm,1d6}`
- **Trouble**: Roll 2d6 and keep the lower → `{2d6kl,1dm,1d6}`
- Edge/trouble can be set on abilities via Active Effects (`system.abilities.X.edge` / `system.abilities.X.trouble`)
- A retroactive edge/trouble system exists via chat message buttons

## Six Abilities (MARVED)
| Key | Ability | Used For |
|-----|---------|----------|
| mle | Melee | Physical close combat, damage |
| agl | Agility | Ranged combat, reflexes, damage |
| res | Resilience | Toughness, Health calculation |
| vig | Vigilance | Awareness, Focus calculation |
| ego | Ego | Willpower, psychic damage |
| log | Logic | Intelligence, tech damage |

Each ability has: `value` (score), `defense` (derived), `noncom` (non-combat modifier), `damageMultiplier`, `edge` (bool), `trouble` (bool).

## Derived Stats
- **Health max** = Resilience × 30 + bonus (min 10)
- **Focus max** = Vigilance × 30 + bonus
- **Defense** = ability value + 10
- **Initiative** = Vigilance modifier + edge flag
- **Damage** = Marvel die result × damageMultiplier + ability value

## Damage Types
Four abilities deal damage: Melee, Agility, Ego, Logic. Each has a damage multiplier that multiplies the Marvel die result.

## Damage Reduction (DR)
Two types: Health DR (`system.healthDamageReduction`) and Focus DR (`system.focusDamageReduction`). Applied via Active Effects from powers like Sturdy (Health), Iron Will (Focus), Thick Skin (Health), Durable (Health).

## Movement
Base movement is Run speed. Others derived from it:
- Climb = Run × 0.5 (rounded up)
- Swim = Run × 0.5 (rounded up)
- Jump = half/equal/double/triple Run based on powers
- Flight, Glide, Swingline, Levitation = inactive by default, activated by powers

The `system.movement.X.calc` field supports: half, double, triple, runspeed, runspeed-rank, rank.

## Character Size
Microscopic, Miniature, Tiny, Little, Small, Average, Big, Huge, Gigantic, Titanic, Gargantuan. Each has a sizeMultiplier.

## Power Sets (26 categories)
Basic, Elemental Control, Healing, Illusion, Luck, Magic, Martial Arts, Melee Weapons, Narrative, Omniversal Travel, Phasing, Plasticity, Power Control, Ranged Weapons, Resize, Shield Bearer, Sixth Sense, Spider-Powers, Super-Speed, Super-Strength, Tactics, Telekinesis, Telepathy, Teleportation, Translation, Weather Control.

Powers belong to one or more power sets. On the character sheet, powers are grouped by their first power set and displayed alphabetically within each group. Power set sections are also alphabetized.

## Ranked Powers
Many powers come in numbered ranks (e.g., Mighty 1, Mighty 2, Mighty 3). Taking rank N requires having ranks 1 through N-1 first. For power slot counting, a rank-N power counts as N slots (it implicitly includes the prerequisites).

## Elements
Used by Elemental Control powers. If a character has Elemental Control powers, a Default Element dropdown appears on their sheet. Elements include: Air, Cosmic, Darkforce, Earth, Electricity, Fire, Ice, Plasma, Radiation, Vibranium, Water, Weather.

## Weapon Types
Melee Weapons can be Blunt or Sharp. If a character has Melee Weapon powers, a Default Weapon Type dropdown appears.

## Item Types
- **Power**: Has powerSets, ability, damageType, attack flag, formula, restriction, source
- **Trait**: Has description, detail (for variants like "Connections: Super Villains"), multiple flag, source
- **Tag**: Same schema as trait
- **Origin**: Defines character background (e.g., Mutant, Alien, High-Tech)
- **Occupation**: Defines character role (e.g., Scientist, Adventurer)
- **Weapon**: Physical weapons with stats

## Sources
Core Rulebook, X-Men Expansion, Spider-Verse Expansion, Avengers Expansion, Other, Homebrew.

## Actor Types
- **Character**: Full PC sheet with biography tab, abilities, powers, traits, tags, gear
- **NPC**: Simplified sheet, same mechanics but condensed layout

## Biography Fields
`system.realname`, `system.gender`, `system.height`, `system.weight`, `system.eyes`, `system.hair`, `system.size`, `system.teams`, `system.base`, `system.history` (rich text), `system.personality` (rich text), `system.distinguishingFeatures` (rich text)
