export const MARVEL_MULTIVERSE = {};
/**
 * The set of Ability Scores used within the system.
 * @type {Object}
 */
MARVEL_MULTIVERSE.abilities = {
  mle: "MARVEL_MULTIVERSE.Ability.Mel.long",
  agl: "MARVEL_MULTIVERSE.Ability.Agl.long",
  res: "MARVEL_MULTIVERSE.Ability.Res.long",
  vig: "MARVEL_MULTIVERSE.Ability.Vig.long",
  ego: "MARVEL_MULTIVERSE.Ability.Ego.long",
  log: "MARVEL_MULTIVERSE.Ability.Log.long",
};

MARVEL_MULTIVERSE.damageAbilityAbr = {
  Melee: "mle",
  Agility: "agl",
  Ego: "ego",
  Logic: "log",
};

MARVEL_MULTIVERSE.damageAbility = Object.fromEntries(
  Object.keys(MARVEL_MULTIVERSE.damageAbilityAbr).map((k) => [
    MARVEL_MULTIVERSE.damageAbilityAbr[k],
    k,
  ])
);

MARVEL_MULTIVERSE.MARVEL_RESULTS = {
  1: {
    label: "MARVEL_MULTIVERSE.MarvelResult.M",
    image: `systems/marvel-multiverse/icons/marvel-1.svg`,
  },
  2: {
    label: "MARVEL_MULTIVERSE.MarvelResult.2",
    image: `systems/marvel-multiverse/icons/marvel-2.svg`,
  },
  3: {
    label: "MARVEL_MULTIVERSE.MarvelResult.3",
    image: `systems/marvel-multiverse/icons/marvel-3.svg`,
  },
  4: {
    label: "MARVEL_MULTIVERSE.MarvelResult.4",
    image: `systems/marvel-multiverse/icons/marvel-4.svg`,
  },
  5: {
    label: "MARVEL_MULTIVERSE.MarvelResult.5",
    image: `systems/marvel-multiverse/icons/marvel-5.svg`,
  },
  6: {
    label: "MARVEL_MULTIVERSE.MarvelResult.6",
    image: `systems/marvel-multiverse/icons/marvel-6.svg`,
  },
};

MARVEL_MULTIVERSE.DICE_RESULTS = {
  1: {
    label: "MARVEL_MULTIVERSE.DiceResult.1",
    image: `systems/marvel-multiverse/icons/1.svg`,
  },
  2: {
    label: "MARVEL_MULTIVERSE.DiceResult.2",
    image: `systems/marvel-multiverse/icons/2.svg`,
  },
  3: {
    label: "MARVEL_MULTIVERSE.DiceResult.3",
    image: `systems/marvel-multiverse/icons/3.svg`,
  },
  4: {
    label: "MARVEL_MULTIVERSE.DiceResult.4",
    image: `systems/marvel-multiverse/icons/4.svg`,
  },
  5: {
    label: "MARVEL_MULTIVERSE.DiceResult.5",
    image: `systems/marvel-multiverse/icons/5.svg`,
  },
  6: {
    label: "MARVEL_MULTIVERSE.DiceResult.6",
    image: `systems/marvel-multiverse/icons/6.svg`,
  },
};

MARVEL_MULTIVERSE.sizes = {
  microscopic: {
    label: "MARVEL_MULTIVERSE.Size.Microscopic",
    sizeMultiplier: 0,
  },
  miniature: { label: "MARVEL_MULTIVERSE.Size.Miniature", sizeMultiplier: 0 },
  tiny: { label: "MARVEL_MULTIVERSE.Size.Tiny", sizeMultiplier: 0 },
  little: { label: "MARVEL_MULTIVERSE.Size.Little", sizeMultiplier: 0.25 },
  small: { label: "MARVEL_MULTIVERSE.Size.Small", sizeMultiplier: 0 },
  average: { label: "MARVEL_MULTIVERSE.Size.Average", sizeMultiplier: 0 },
  big: { label: "MARVEL_MULTIVERSE.Size.Big", sizeMultiplier: 0 },
  huge: { label: "MARVEL_MULTIVERSE.Size.Huge", sizeMultiplier: 5 },
  gigantic: { label: "MARVEL_MULTIVERSE.Size.Gigantic", sizeMultiplier: 20 },
  titanic: { label: "MARVEL_MULTIVERSE.Size.Titanic", sizeMultiplier: 80 },
  gargantuan: {
    label: "MARVEL_MULTIVERSE.Size.Gargantuan",
    sizeMultiplier: 320,
  },
};

MARVEL_MULTIVERSE.powersets = {
  basic: { label: "Basic" },
  elementalControl: { label: "Elemental Control" },
  healing: { label: "Healing" },
  iconicItems: { label: "Iconic Items" },
  illusion: { label: "Illusion" },
  luck: { label: "Luck" },
  magic: { label: "Magic" },
  martialArts: { label: "Martial Arts" },
  meleeWeapons: { label: "Melee Weapons" },
  narrative: { label: "Narrative" },
  omniversalTravel: { label: "Omniversal Travel" },
  phasing: { label: "Phasing" },
  plasticity: { label: "Plasticity" },
  powerControl: { label: "Power Control" },
  rangedWeapons: { label: "Ranged Weapons" },
  resize: { label: "Resize" },
  shieldBearer: { label: "Shield Bearer" },
  sixthSense: { label: "Sixth Sense" },
  spiderPowers: { label: "Spider-Powers" },
  superSpeed: { label: "Super-Speed" },
  superStrength: { label: "Super-Strength" },
  tactics: { label: "Tactics" },
  telekinesis: { label: "Telekinesis" },
  telepathy: { label: "Telepathy" },
  teleportation: { label: "Teleportation" },
  translation: { label: "Translation" },
  weatherControl: { label: "Weather Control" },
};

/**
 * Publication sources an item can be attributed to.
 *
 * This is an open registry, not a fixed list. The system ships only generic
 * entries; named sourcebooks are content rather than mechanics and are supplied
 * by content modules, which merge their own entries in during `init` -- the same
 * arrangement as `namedTeamManeuvers`. Keys are persisted on items, so entries
 * may be added but must not be renamed.
 */
MARVEL_MULTIVERSE.sources = {
  core: { label: "Core Rulebook" },
  coreModified: { label: "Core Rulebook (Modified)" },
  homebrew: { label: "Homebrew" },
};

MARVEL_MULTIVERSE.reverseSetList = Object.fromEntries(
  Object.keys(MARVEL_MULTIVERSE.powersets).map((k) => [
    MARVEL_MULTIVERSE.powersets[k].label,
    k,
  ])
);

MARVEL_MULTIVERSE.restrictionKinds = {
  access: { label: "Access" },
  challenging: { label: "Challenging" },
  obvious: { label: "Obvious" },
  unattached: { label: "Unattached" },
  use: { label: "Use" },
};

MARVEL_MULTIVERSE.ownershipModes = {
  owned: { label: "Owned" },
  borrowed: { label: "Borrowed" },
};

MARVEL_MULTIVERSE.specialEffectTypes = {
  blunt: { label: "Blunt" },
  sharp: { label: "Sharp" },
  elemental: { label: "Elemental" },
};

MARVEL_MULTIVERSE.movementTypes = {
  run: { label: "MARVEL_MULTIVERSE.Movement.Run", active: true },
  climb: { label: "MARVEL_MULTIVERSE.Movement.Climb", active: true },
  swim: { label: "MARVEL_MULTIVERSE.Movement.Swim", active: true },
  jump: { label: "MARVEL_MULTIVERSE.Movement.Jump", active: true },
  flight: { label: "MARVEL_MULTIVERSE.Movement.Flight", active: false },
  glide: { label: "MARVEL_MULTIVERSE.Movement.Glide", active: false },
  swingline: { label: "MARVEL_MULTIVERSE.Movement.Swingline", active: false },
  levitation: { label: "MARVEL_MULTIVERSE.Movement.Levitation", active: false },
};

MARVEL_MULTIVERSE.vehicleSpeedLabels = {
  run: { label: "MARVEL_MULTIVERSE.Vehicle.GroundSpeed" },
  flight: { label: "MARVEL_MULTIVERSE.Vehicle.FlightSpeed" },
  climb: { label: "MARVEL_MULTIVERSE.Vehicle.ClimbSpeed" },
  swim: { label: "MARVEL_MULTIVERSE.Vehicle.NauticalSpeed" },
};

MARVEL_MULTIVERSE.elements = {
  air: {
    label: "Air",
    fantasticEffect: "Target is knocked prone for one round.",
    statusId: "prone",
  },
  earth: {
    label: "Earth",
    fantasticEffect: "Target moves at half speed for one round.",
    statusId: "exhausted",
  },
  electricity: {
    label: "Electricity",
    fantasticEffect: "Stuns target for one round.",
    statusId: "stunned",
  },
  energy: {
    label: "Energy",
    fantasticEffect: "Blinds target for one round.",
    statusId: "blinded",
  },
  fire: {
    label: "Fire",
    fantasticEffect: "Sets target ablaze.",
    statusId: "ablaze",
  },
  force: {
    label: "Force",
    fantasticEffect: "Target has trouble on all actions for one round.",
    statusId: "encumbered",
  },
  hellfire: {
    label: "Hellfire",
    fantasticEffect: "Splits damage equally between Health and Focus.",
  },
  ice: {
    label: "Ice",
    fantasticEffect: "Paralyzes target for one round.",
    statusId: "paralyzed",
  },
  iron: {
    label: "Iron",
    fantasticEffect: "Pins target for one round.",
    statusId: "restrained",
  },
  sound: {
    label: "Sound",
    fantasticEffect: "Deafens target for one round.",
    statusId: "deafened",
  },
  water: {
    label: "Water",
    fantasticEffect: "Surprises target until the end of the next round.",
    statusId: "surprised",
  },
  toxin: {
    label: "Toxin",
    fantasticEffect: "The target is poisoned.",
    statusId: "poisoned",
  },
  chemical: {
    label: "Chemical",
    fantasticEffect: "The target is corroding.",
    statusId: "corroding",
  },
  swarm: {
    label: "Swarm",
    fantasticEffect: "The target is frightened.",
    statusId: "frightened",
  },
};

MARVEL_MULTIVERSE.teamManeuvers = [
  {
    maneuverType: "Offensive",
    levels: [
      {
        level: 1,
        cost: "5 focus, each",
        rankAvg: [1, 2],
        description:
          "Participants attack with edge for the remainder of the round.",
      },
      {
        level: 2,
        cost: "10 focus, each",
        rankAvg: [3, 4],
        description:
          "Participants may reroll their dice on an attack this round, keeping whichever result is better.",
      },
      {
        level: 3,
        cost: "15 focus, each",
        rankAvg: [5, 6],
        description:
          "Participants may set their Marvel die to a Fantastic success on an attack this round, against targets of equal or higher rank.",
      },
    ],
  },
  {
    maneuverType: "Defensive",
    levels: [
      {
        level: 1,
        cost: "5 focus, each",
        rankAvg: [1, 2],
        description:
          "Participants gain Damage Reduction 2 for the round.",
      },
      {
        level: 2,
        cost: "10 focus, each",
        rankAvg: [3, 4],
        description:
          "Participants gain Damage Reduction 4 for the round.",
      },
      {
        level: 3,
        cost: "15 focus, each",
        rankAvg: [5, 6],
        description:
          "Participants gain Damage Reduction 8 for the round.",
      },
    ],
  },
  {
    maneuverType: "Rally",
    levels: [
      {
        level: 1,
        cost: "5 focus, each",
        rankAvg: [1, 2],
        description:
          "Actions targeting participants suffer trouble for the round.",
      },
      {
        level: 2,
        cost: "10 focus, each",
        rankAvg: [3, 4],
        description:
          "Each participant may make one speedy recovery roll for Health or Focus without spending Karma.",
      },
      {
        level: 3,
        cost: "15 focus, each",
        rankAvg: [5, 6],
        description:
          "One fallen participant is restored to Health 0 and Focus 0.",
      },
    ],
  },
];

MARVEL_MULTIVERSE.namedTeamManeuvers = [];

MARVEL_MULTIVERSE.sizeEffects = {
  microscopic: {
    name: "Microscopic Effects",
    disabled: false,
    changes: [
      {
        key: "system.size",
        mode: 5,
        value: "microscopic",
      },
      {
        key: "system.abilities.mle.defense",
        mode: 2,
        value: 5,
      },
      {
        key: "system.abilities.agl.defense",
        mode: 2,
        value: 5,
      },
    ],
    description: "",
    transfer: true,
    statuses: [],
    flags: {},
  },
  miniature: {
    name: "Miniature Effects",
    disabled: false,
    changes: [
      {
        key: "system.size",
        mode: 5,
        value: "miniature",
      },
      {
        key: "system.abilities.mle.defense",
        mode: 2,
        value: 4,
      },
      {
        key: "system.abilities.agl.defense",
        mode: 2,
        value: 4,
      },
    ],
    description: "",
    transfer: true,
    statuses: [],
    flags: {},
  },
  tiny: {
    name: "Tiny Effects",
    disabled: false,
    changes: [
      {
        key: "system.size",
        mode: 5,
        value: "tiny",
      },
      {
        key: "system.abilities.mle.defense",
        mode: 2,
        value: 3,
      },
      {
        key: "system.abilities.agl.defense",
        mode: 2,
        value: 3,
      },
    ],
    description: "",
    transfer: true,
    statuses: [],
    flags: {},
  },
  little: {
    name: "Little Effects",
    disabled: false,
    changes: [
      {
        key: "system.size",
        mode: 5,
        value: "little",
      },
      {
        key: "system.abilities.mle.defense",
        mode: 2,
        value: 2,
      },
      {
        key: "system.abilities.agl.defense",
        mode: 2,
        value: 2,
      },
      {
        key: "prototypeToken.width",
        mode: 1,
        value: 0.25,
      },
      {
        key: "prototypeToken.height",
        mode: 1,
        value: 0.25,
      },
    ],
    description: "",
    transfer: true,
    statuses: [],
    flags: {},
  },
  small: {
    name: "Small Effects",
    disabled: false,
    changes: [
      {
        key: "system.size",
        mode: 5,
        value: "small",
      },
      {
        key: "system.abilities.mle.defense",
        mode: 2,
        value: 1,
      },
      {
        key: "system.abilities.agl.defense",
        mode: 2,
        value: 1,
      },
      {
        key: "system.movement.run.value",
        mode: 2,
        value: -1,
      },
    ],
    description: "",
    transfer: true,
    statuses: [],
    flags: {},
  },
  average: {
    name: "Average Effects",
    disabled: false,
    changes: [
      {
        key: "system.size",
        mode: 5,
        value: "average",
      },
    ],
    description: "",
    transfer: true,
    statuses: [],
    flags: {},
  },
  big: {
    name: "Big Effects",
    disabled: false,
    changes: [
      {
        key: "system.size",
        mode: 5,
        value: "big",
      },
      {
        key: "system.abilities.mle.defense",
        mode: 2,
        value: -1,
      },
      {
        key: "system.abilities.agl.defense",
        mode: 2,
        value: -1,
      },
      {
        key: "system.reach",
        mode: 5,
        value: 2,
      },
      {
        key: "system.movement.run.value",
        mode: 2,
        value: 1,
      },
    ],
    description: "",
    transfer: true,
    statuses: [],
    flags: {},
  },
  huge: {
    name: "Huge Effects",
    disabled: false,
    changes: [
      {
        key: "system.size",
        mode: 5,
        value: "huge",
      },
      {
        key: "system.abilities.mle.defense",
        mode: 2,
        value: -2,
      },
      {
        key: "system.abilities.agl.defense",
        mode: 2,
        value: -2,
      },
      {
        key: "system.reach",
        mode: 5,
        value: 5,
      },
      {
        key: "system.movement.run.value",
        mode: 1,
        value: 5,
      },
      {
        key: "system.abilities.mle.damageMultiplier",
        mode: 2,
        value: 2,
      },
      {
        key: "prototypeToken.width",
        mode: 1,
        value: 5,
      },
      {
        key: "prototypeToken.height",
        mode: 1,
        value: 5,
      },
    ],
    description: "",
    transfer: true,
    statuses: [],
    flags: {},
  },
  gigantic: {
    name: "Gigantic Effects",
    disabled: false,
    changes: [
      {
        key: "system.size",
        mode: 5,
        value: "gigantic",
      },
      {
        key: "system.abilities.mle.defense",
        mode: 2,
        value: -3,
      },
      {
        key: "system.abilities.agl.defense",
        mode: 2,
        value: -3,
      },
      {
        key: "system.reach",
        mode: 5,
        value: 20,
      },
      {
        key: "system.movement.run.value",
        mode: 1,
        value: 20,
      },
      {
        key: "system.abilities.mle.damageMultiplier",
        mode: 2,
        value: 4,
      },
      {
        key: "prototypeToken.width",
        mode: 1,
        value: 20,
      },
      {
        key: "prototypeToken.height",
        mode: 1,
        value: 20,
      },
    ],
    description: "",
    transfer: true,
    statuses: [],
    flags: {},
  },
  titanic: {
    name: "Titanic Effects",
    disabled: false,
    changes: [
      {
        key: "system.size",
        mode: 5,
        value: "titanic",
      },
      {
        key: "system.abilities.mle.defense",
        mode: 2,
        value: -4,
      },
      {
        key: "system.abilities.agl.defense",
        mode: 2,
        value: -4,
      },
      {
        key: "system.reach",
        mode: 5,
        value: 80,
      },
      {
        key: "system.movement.run.value",
        mode: 1,
        value: 80,
      },
      {
        key: "system.abilities.mle.damageMultiplier",
        mode: 2,
        value: 6,
      },
      {
        key: "prototypeToken.width",
        mode: 1,
        value: 80,
      },
      {
        key: "prototypeToken.height",
        mode: 1,
        value: 80,
      },
    ],
    description: "",
    transfer: true,
    statuses: [],
    flags: {},
  },
  gargantuan: {
    name: "Gargantuan Effects",
    disabled: false,
    changes: [
      {
        key: "system.size",
        mode: 5,
        value: "gargantuan",
      },
      {
        key: "system.abilities.mle.defense",
        mode: 2,
        value: -5,
      },
      {
        key: "system.abilities.agl.defense",
        mode: 2,
        value: -5,
      },
      {
        key: "system.reach",
        mode: 5,
        value: 320,
      },
      {
        key: "system.movement.run.value",
        mode: 1,
        value: 320,
      },
      {
        key: "system.abilities.mle.damageMultiplier",
        mode: 2,
        value: 8,
      },
      {
        key: "prototypeToken.width",
        mode: 1,
        value: 320,
      },
      {
        key: "prototypeToken.height",
        mode: 1,
        value: 320,
      },
    ],
    description: "",
    transfer: true,
    statuses: [],
    flags: {},
  },
};

MARVEL_MULTIVERSE.conditionEffects = {
  ablaze: {
    name: "Ablaze",
    disabled: false,
    changes: [],
    description:
      "Takes 5 damage at the end of each turn until removed. Clearing it costs an action and an Agility check against TN 10.",
    transfer: true,
    statuses: ["ablaze"],
    flags: {},
    turnDamage: 5,
    timing: "end",
  },
  asleep: {
    name: "Asleep",
    disabled: false,
    changes: [],
    description:
      "Cannot act. Every defense is treated as 10 and melee attacks against it hit automatically. Waking requires a challenging check on the resisting ability -- Resilience against drugs, Vigilance against magic -- and assistance grants edge.",
    transfer: true,
    statuses: ["asleep"],
    flags: {},
  },
  bleeding: {
    name: "Bleeding",
    disabled: false,
    changes: [],
    description:
      "Takes 5 damage at the end of each turn until removed. Clearing it costs an action and a Logic check against TN 10, and it also ends once any Health is regained.",
    transfer: true,
    statuses: ["bleeding"],
    flags: {},
    turnDamage: 5,
    timing: "end",
  },
  corroding: {
    name: "Corroding",
    disabled: false,
    changes: [],
    description:
      "Takes 5 damage at the end of each turn until removed. Washing it off clears the condition.",
    transfer: true,
    statuses: ["corroding"],
    flags: {},
    turnDamage: 5,
    timing: "end",
  },
  exhausted: {
    name: "Exhausted",
    disabled: false,
    changes: [],
    description:
      "Powers cost an extra 5 Focus, rising by a further 5 for each additional day without rest. The surcharge ignores the Focus spending cap and all actions suffer trouble. Rest clears it.",
    transfer: true,
    statuses: ["exhausted"],
    flags: {},
  },
  infected: {
    name: "Infected",
    disabled: false,
    changes: [],
    description:
      "Contracted through the air within 3 spaces of a breathing target, or by a close attack dealing at least 1 damage. Resist with a Resilience check against the infection's TN, 12 by default; a Fantastic success grants a full day of immunity. Effects and duration vary by disease.",
    transfer: true,
    statuses: ["infected"],
    flags: {},
  },
  poisoned: {
    name: "Poisoned",
    disabled: false,
    changes: [],
    description:
      "At the start of each turn, make a Resilience check against TN 18 at no action cost. Failure costs 1 Health, a Fantastic success clears the condition, and most have antidotes. Otherwise it lapses after a day if not fatal.",
    transfer: true,
    statuses: ["poisoned"],
    flags: {},
    turnCheck: { ability: "res", tn: 18 },
    timing: "start",
  },
};

MARVEL_MULTIVERSE.additionalStatuses = [
  {
    id: "infected",
    name: "Infected",
    img: "icons/svg/biohazard.svg",
  },
];

MARVEL_MULTIVERSE.mutantReputationLevels = {
  beloved: { label: "Beloved", effect: "Double Edge" },
  liked: { label: "Liked", effect: "Edge" },
  neutral: { label: "Neutral", effect: "No effect" },
  feared: { label: "Feared", effect: "Trouble" },
  hated: { label: "Hated", effect: "Double Trouble" },
};

MARVEL_MULTIVERSE.equipmentTypes = {
  protection: "MARVEL_MULTIVERSE.Equipment.Protection",
  grenade: "MARVEL_MULTIVERSE.Equipment.Grenade.label",
  gadget: "MARVEL_MULTIVERSE.Equipment.Gadget",
  device: "MARVEL_MULTIVERSE.Equipment.Device",
  material: "MARVEL_MULTIVERSE.Equipment.Material",
};

MARVEL_MULTIVERSE.grenadeTypes = {
  explosive: "MARVEL_MULTIVERSE.Equipment.Grenade.Explosive",
  flashbang: "MARVEL_MULTIVERSE.Equipment.Grenade.Flashbang",
  gas: "MARVEL_MULTIVERSE.Equipment.Grenade.Gas",
  smoke: "MARVEL_MULTIVERSE.Equipment.Grenade.Smoke",
};

MARVEL_MULTIVERSE.alternateFormTypes = {
  cosmetic: "MARVEL_MULTIVERSE.AlternateForm.Cosmetic",
  powerDown: "MARVEL_MULTIVERSE.AlternateForm.PowerDown",
  powerSwap: "MARVEL_MULTIVERSE.AlternateForm.PowerSwap",
};

// ASCII Artwork
MARVEL_MULTIVERSE.ASCII = `
=ccccc,      ,cccc       ccccc      ,cccc,  ?$$$$$$$,  ,ccc,   -ccc
:::"$$$$bc    $$$$$     ::'$$$$$c,  : $$$$$c':"$$$$???''."$$$$c,:'?$$c
'::::"?$$$$c,z$$$$F     ':: ?$$$$$c,':'$$$$$h':'?$$$,' :::'$$$$$$c,"$$h,
  '::::."$$$$$$$$$'    ..,,,:"$$$$$$h, ?$$$$$$c':"$$$$$$$b':"$$$$$$$$$$$c
    '::::"?$$$$$$    :"$$$$c:'$$$$$$$$d$$$P$$$b':'?$$$c : ::'?$$c "?$$$$h,
      ':::.$$$$$$$c,'::'????":'?$$$E"?$$$$h ?$$$.':?$$$h..,,,:"$$$,:."?$$$c
        ': $$$$$$$$$c, ::''  :::"$$$b '"$$$ :"$$$b':'?$$$$$$$c''?$F ':: "::
          .,$$$$$"?$$$$$c,    ':::"$$$$.::"$.:: ?$$$.:.???????" ':::  ' '''
          'J$$$$P'::"?$$$$h,   ':::'?$$$c'::'':: .:: : :::::''   '
        :,$$$$$':::::'?$$$$$c,  ::: "::  ::  ' ::'   ''
        .'J$$$$F  '::::: .::::    ' :::'  '
      .: ???):     ':: :::::
      : :::::'        '
        ''
`;
