/**
 * Extend the base Roll document by defining a pool for evaluating rolls with the Marvel DiceTerms.
 * @extends {Roll}
 * A type of Roll specific to a mmrpg check, challenge, or attack roll in the mmrpg system.
 * @param {string} formula                       The string formula to parse
 * @param {object} data                          The data object against which to parse attributes within the formula
 * @param {object} [options={}]                  Extra optional arguments which describe or modify the MarvelMultiverseRoll
 * @param {number} [options.edgeMode]            What edge modifier to apply to the roll (none, edge,
 *                                               trouble)
 * @param {number} [options.fantastic=1]         The value of dM result which represents a fantastic success
 * @param {(number)} [options.targetValue]       Assign a target value against which the result of this roll should be
 *
 */
class MarvelMultiverseRoll extends Roll {
  constructor(formula, data, options) {
    super(formula, data, options);
    if (!this.options.configured) this.configureModifiers();
  }

  /* -------------------------------------------- */

  /**
   * Create a MarvelMultiverseRoll from a standard Roll instance.
   * @param {Roll} roll
   * @returns {MarvelMultiverseRoll}
   */
  static fromRoll(roll) {
    // biome-ignore lint/complexity/noThisInStatic: <explanation>
    const newRoll = new this(roll.formula, roll.data, roll.options);
    Object.assign(newRoll, roll);
    return newRoll;
  }

  /**
   * Create a MarvelMultiverseRoll from a standard Roll Terms.
   * @param {RollTerm[]} terms
   * @returns {MarvelMultiverseRoll}
   */
  static fromTerms(terms) {
    // biome-ignore lint/complexity/noThisInStatic: <explanation>
    const newRoll = super.fromTerms(terms);
    Object.assign(newRoll, roll);
    return newRoll;
  }

  /* -------------------------------------------- */

  /**
   * Determine whether a d616 roll should be fast-forwarded, and whether edge or trouble should be applied.
   * @param {object} [options]
   * @param {Event} [options.event]                               The Event that triggered the roll.
   * @param {boolean} [options.edge]                         Is something granting this roll edge?
   * @param {boolean} [options.trouble]                      Is something granting this roll trouble?
   * @param {boolean} [options.fastForward]                       Should the roll dialog be skipped?
   * @returns {{edgeMode: MarvelMultiverseRoll.EDGE_MODE, isFF: boolean}}  Whether the roll is fast-forwarded, and its edge
   *                                                              mode.
   */
  static determineEdgeMode({
    event,
    edge = false,
    trouble = false,
    fastForward,
  } = {}) {
    const isFF =
      fastForward ??
      (event?.shiftKey || event?.altKey || event?.ctrlKey || event?.metaKey);
    // biome-ignore lint/complexity/noThisInStatic: <explanation>
    let edgeMode = this.EDGE_MODE.NORMAL;
    // biome-ignore lint/complexity/noThisInStatic: <explanation>
    if (edge || event?.altKey) edgeMode = this.EDGE_MODE.EDGE;
    else if (trouble || event?.ctrlKey || event?.metaKey)
      // biome-ignore lint/complexity/noThisInStatic: <explanation>
      edgeMode = this.EDGE_MODE.TROUBLE;
    return { isFF: !!isFF, edgeMode };
  }

  /* -------------------------------------------- */

  /**
   * Edge mode of a mmrpg d616 roll
   * @enum {number}
   */
  static EDGE_MODE = {
    NORMAL: 0,
    EDGE: 1,
    TROUBLE: -1,
  };

  /* -------------------------------------------- */

  /**
   * The HTML template path used to configure evaluation of this Roll
   * @type {string}
   */
  static EVALUATION_TEMPLATE =
    "systems/marvel-multiverse/templates/chat/roll-dialog.hbs";

  /**
   * The HTML template path used to configure evaluation of this Roll
   * @type {string}
   */
  static DAMAGE_EVALUATION_TEMPLATE =
    "systems/marvel-multiverse/templates/chat/damage-roll-dialog.hbs";

  /**
   * The  template path used to Roll in chat
   * @type {string}
   */
  static CHAT_TEMPLATE = "systems/marvel-multiverse/templates/dice/roll.hbs";
  /* -------------------------------------------- */

  /**
   * Does this roll start with a d6 or dM?
   * @type {boolean}
   */
  get validD616Roll() {
    // return this.dice.length === 3 && this.dice[0].faces === 6 && this.dice[1] instanceof game.MarvelMultiverse.dice.MarvelDie && this.dice[2].faces === 6
    return (
      this.dice.length === 3 &&
      this.terms[0] instanceof foundry.dice.terms.PoolTerm
    );
  }

  /* -------------------------------------------- */

  /**
   * A convenience reference for whether this marvel or d6 Roll has edge
   * @type {boolean}
   */
  get hasEdge() {
    return this.options.edgeMode === MarvelMultiverseRoll.EDGE_MODE.EDGE;
  }

  /* -------------------------------------------- */

  /**
   * A convenience reference for whether this marvel or d6 Roll has trouble
   * @type {boolean}
   */
  get hasTrouble() {
    return this.options.edgeMode === MarvelMultiverseRoll.EDGE_MODE.TROUBLE;
  }

  /**
   * Is this roll a fantastic result? Returns undefined if roll isn't evaluated.
   * @type {boolean|void}
   */
  get isFantastic() {
    if (!this._evaluated) return undefined;
    return this.dice[1].result === 1;
  }

  /* -------------------------------------------- */
  /*  D616 Roll Methods                            */
  /* -------------------------------------------- */

  /**
   * Apply optional modifiers which customize the behavior of the d616term
   * @private
   */
  configureModifiers() {
    const valid616 = this.validD616Roll;
    if (!valid616) return;
    this.options.fantastic = 1;

    if (this.isFantastic) {
      this.dice[1].results.map((r) => {
        if (r.result === 1) {
          r.discarded = false;
          r.active = true;
        } else {
          r.discarded = true;
          r.active = false;
        }
      });
      this.dice[1].total = 6;
    }

    // Mark configuration as complete
    this.options.configured = true;
  }

  /** @inheritdoc */
  async toMessage(messageData = {}, options = {}) {
    // Evaluate the roll now so we have the results available to determine edge mode
    if (!this._evaluated) await this.evaluate({});

    // Add appropriate edge mode message flavor and mmrpg roll flags
    messageData.flavor = messageData.flavor || this.options.flavor;
    messageData.fantastic = this.isFantastic;
    if (options.itemId) {
      foundry.utils.setProperty(
        messageData,
        "flags.marvel-multiverse.itemId",
        options.itemId
      );
    }

    if (this.hasEdge)
      messageData.flavor += ` (${game.i18n.localize(
        "MARVEL_MULTIVERSE.edge"
      )})`;
    else if (this.hasTrouble)
      messageData.flavor += ` (${game.i18n.localize(
        "MARVEL_MULTIVERSE.trouble"
      )})`;
    // Record the preferred rollMode
    options.rollMode = options.rollMode ?? this.options.rollMode;
    return super.toMessage(messageData, options);
  }

  /* -------------------------------------------- */
  /*  Configuration Dialog                        */
  /* -------------------------------------------- */

  /**
   * Create a Dialog prompt used to configure evaluation of an existing MarvelMultiverseRoll instance.
   * @param {object} data                     Dialog configuration data
   * @param {string} [data.title]             The title of the shown dialog window
   * @param {boolean} [data.chooseModifier]   Choose which ability modifier should be applied to the roll?
   * @param {string} [data.defaultAbility]    For tool rolls, the default ability modifier applied to the roll
   * @param {string} [data.template]          A custom path to an HTML template to use instead of the default
   * @param {object} options                  Additional Dialog customization options
   * @returns {Promise<MarvelMultiverseRoll|null>}         A resulting MarvelMultiverseRoll object constructed with the dialog, or null if the
   *                                          dialog was closed
   */
  async configureDialog(
    { title, chooseModifier = false, defaultAbility, template } = {},
    options = {}
  ) {
    // Render the Dialog inner HTML
    const content = await renderTemplate(
      template ?? this.constructor.EVALUATION_TEMPLATE,
      {
        formulas: [{ formula: `${this.formula} + @bonus` }],
        chooseModifier,
        defaultAbility,
        abilities: Object.fromEntries(
          Object.entries(CONFIG.MARVEL_MULTIVERSE.abilities).map((abl) => [
            abl[0],
            game.i18n.localize(abl[1]),
          ])
        ),
      }
    );

    const defaultButton = "normal";

    // Create the Dialog window and await submission of the form
    return new Promise((resolve) => {
      new Dialog(
        {
          title,
          content,
          buttons: {
            normal: {
              label: "Roll",
              callback: (html) => resolve(this._onDamageDialogSubmit(html)),
            },
          },
          default: defaultButton,
          close: () => resolve(null),
        },
        options
      ).render(true);
    });
  }

  /* -------------------------------------------- */

  /**
   * Handle submission of the Roll evaluation configuration Dialog
   * @param {jQuery} html            The submitted dialog content
   * @returns {MarvelMultiverseRoll}              This damage roll.
   * @private
   */

  _onDialogSubmit(html) {
    const form = html[0].querySelector("form");

    // Append a situational bonus term
    if (form.bonus.value) {
      const bonus = new Roll(form.bonus.value, this.data);
      if (!(bonus.terms[0] instanceof foundry.dice.terms.OperatorTerm))
        this.terms.push(new foundry.dice.terms.OperatorTerm({ operator: "+" }));
      this.terms = this.terms.concat(bonus.terms);
    }

    // Customize the modifier
    if (form.ability?.value) {
      const abl = this.data.abilities[form.ability.value];
      this.terms = this.terms.flatMap((t) => {
        if (t.term === "@mod")
          return new foundry.dice.terms.NumericTerm({ number: abl.value });
        if (t.term === "@abilityCheckBonus") {
          const bonus = abl.bonuses?.check;
          if (bonus) return new Roll(bonus, this.data).terms;
          return new foundry.dice.terms.NumericTerm({ number: 0 });
        }
        return t;
      });
      this.options.flavor += ` (${
        CONFIG.MARVEL_MULTIVERSE.abilities[form.ability.value]?.label ?? ""
      })`;
    }

    // Apply advantage or disadvantage
    this.configureModifiers();
    return this;
  }
}

/**
 * Extend the base Actor document by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
class MarvelMultiverseActor extends Actor {
  /** @override */
  prepareData() {
    // Prepare data for the actor. Calling the super version of this executes
    // the following, in order: data reset (to clear active effects),
    // prepareBaseData(), prepareEmbeddedDocuments() (including active effects),
    // prepareDerivedData().
    super.prepareData();
  }

  /** @override */
  prepareBaseData() {
    // Data modifications in this step occur before processing embedded
    // documents or derived data.
  }

  /**
   * @override
   * Augment the actor source data with additional dynamic data that isn't
   * handled by the actor's DataModel. Data calculated in this step should be
   * available both inside and outside of character sheets (such as if an actor
   * is queried and has a roll executed directly from it).
   */
  prepareDerivedData() {
    this.flags.MarvelMultiverse || {};
  }

  /**
   *
   * @override
   * Augment the actor's default getRollData() method by appending the data object
   * generated by the its DataModel's getRollData(), or null. This polymorphic
   * approach is useful when you have actors & items that share a parent Document,
   * but have slightly different data preparation needs.
   */
  getRollData() {
    const data = {};

    // Copy the ability scores to the top rank, so that rolls can use
    // formulas like `@mle.value + 4`.
    if (this.system.abilities) {
      for (const [k, v] of Object.entries(this.system.abilities)) {
        data[k] = foundry.utils.deepClone(v);
      }
    }

    data.rank = this.system.attributes.rank.value;

    return { ...super.getRollData(), ...data };
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  async rollInitiative(options = {}, rollOptions = {}) {
    const combat = await super.rollInitiative(options);
    return combat;
  }

  /* -------------------------------------------- */

  /**
   * Get an un-evaluated MarvelMultiverseRoll instance used to roll initiative for this Actor.
   * @param {object} [options]                        Options which modify the roll
   * @param {MarvelMultiverseRoll.edgeMode} [options.edgeMode]    A specific edge mode to apply
   * @param {string} [options.flavor]                     Special flavor text to apply
   * @returns {MarvelMultiverseRoll}                               The constructed but unevaluated MarvelMultiverseRoll
   */
  getInitiativeRoll(options = {}) {
    // Use a temporarily cached initiative roll
    if (this._cachedInitiativeRoll) return this._cachedInitiativeRoll.clone();

    this.system.attributes?.init;
    const data = this.getRollData();
    // Create the initiative roll

    const parts = ["{1d6,1dm,1d6}"];
    const formula = parts.join(" + ");

    return new CONFIG.Dice.MarvelMultiverseRoll(formula, data, options);
  }
}

/**
 * Extend the basic Item with some very simple modifications.
 * @extends {Item}
 */
const ITEM_DEFAULT_ICONS = {
  trait: "systems/marvel-multiverse/icons/trait.svg",
  occupation: "systems/marvel-multiverse/icons/work.svg",
  origin: "systems/marvel-multiverse/icons/origin.svg",
  powerSet: "icons/svg/card-hand.svg",
  power: "systems/marvel-multiverse/icons/super-powers.svg",
  tag: "systems/marvel-multiverse/icons/tags.svg"
};

let MarvelMultiverseItem$1 = class MarvelMultiverseItem extends Item {
  async _preCreate(data, options, user) {
    await super._preCreate(data, options, user);
    const defaultIcon = ITEM_DEFAULT_ICONS[data.type];
    if (defaultIcon && (!data.img || data.img === Item.DEFAULT_ICON)) {
      this.updateSource({ img: defaultIcon });
    }
  }

  /**
   * Augment the basic Item data model with additional dynamic data.
   */
  prepareData() {
    // As with the actor class, items are documents that can have their data
    // preparation methods overridden (such as prepareBaseData()).
    super.prepareData();
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    // Build the formula
    this.formula =
      this.system.ability && this.formula
        ? `${this.formula} + @${this.system.ability}.value`
        : "";
  }

  /**
   * Prepare a data object which defines the data schema used by dice roll commands against this Item
   * @override
   */
  getRollData() {
    // Starts off by populating the roll data with `this.system`
    const rollData = { ...super.getRollData() };

    // Quit early if there's no parent actor
    if (!this.actor) return rollData;

    // If present, add the actor's roll data
    rollData.actor = this.actor.getRollData();

    return rollData;
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  async roll() {
    // Initialize chat data.
    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const rollMode = game.settings.get("core", "rollMode");
    const abilityName = CONFIG.MARVEL_MULTIVERSE.damageAbility[this.system.ability];
    const typeName = this.type.charAt(0).toUpperCase() + this.type.slice(1);
    const detailText = this.system.detail ? `: ${this.system.detail}` : '';
    const header = `<div class="mm-chat-item-header" style="background:#8b0502;clip-path:polygon(0 0,calc(100% - 20px) 0,100% 100%,0 100%);padding:6px 8px;"><span style="color:#fff;font-family:Roboto,serif;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">${this.name}</span>${detailText ? `<span style="color:#fff;font-family:Roboto,serif;font-size:14px;font-weight:400;letter-spacing:1px;">${detailText}</span>` : ''} <span style="color:#fff2ec;font-family:Roboto,serif;font-size:11px;font-weight:400;text-transform:capitalize;">(${typeName})</span></div>`;
    let details = '';
    if (abilityName) {
      details += `<div style="font-size:11px;font-weight:600;text-transform:uppercase;color:#8b0502;padding:0 8px;">Ability: ${abilityName}</div>`;
    }
    if (this.system.damageType) {
      details += `<div style="font-size:11px;font-weight:600;text-transform:uppercase;color:#8b0502;padding:0 8px;">Damage Type: ${this.system.damageType}</div>`;
    }
    if (this.system.cost) {
      details += `<div style="font-size:12px;padding:2px 8px;"><b>Cost:</b> ${this.system.cost}</div>`;
    }

    ChatMessage.create({
      speaker: speaker,
      rollMode: rollMode,
      content: `${header}${details}<div style="padding:4px 8px;" class="mm-chat-description">${this.system.description}</div>${
        this.system.effect ? `<div style="padding:0 8px;" class="mm-chat-effect">${this.system.effect}</div>` : ""
      }`,
    });

    if (this.system.formula && this.system.ability) {
      // Retrieve roll data.
      const rollData = this.getRollData();
      // Invoke the roll and submit it to chat.
      const roll = new CONFIG.Dice.MarvelMultiverseRoll(
        rollData.formula,
        rollData.actor
      );
      // If you need to store the value first, uncomment the next line.
      // const result = await roll.evaluate();
      const modLabel = `${label}, [ability] ${this.system.ability}`;

      roll.toMessage(
        {
          title: this.name,
          speaker: speaker,
          rollMode: rollMode,
          flavor: modLabel,
        },
        { rollMode: rollMode, itemId: this._id }
      );

      if (this.system.attack) {
        Hooks.callAll("marvel-multiverse.rollAttack", this, roll);
        Hooks.callAll("marvel-multiverse.calcDamage", this, roll);
      }
      return roll;
    }
  }
};

const MARVEL_MULTIVERSE = {};
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

MARVEL_MULTIVERSE.sources = {
  core: { label: "Core Rulebook" },
  coreModified: { label: "Core Rulebook (Modified)" },
  xmen: { label: "X-Men Expansion" },
  xmenModified: { label: "X-Men Expansion (Modified)" },
  spiderverse: { label: "Spider-Verse Expansion" },
  spiderverseModified: { label: "Spider-Verse Expansion (Modified)" },
  avengers: { label: "Avengers Expansion" },
  avengersModified: { label: "Avengers Expansion (Modified)" },
  enterHydra: { label: "Enter: Hydra" },
  enterHydraModified: { label: "Enter: Hydra (Modified)" },
  cataclysmOfKang: { label: "Cataclysm of Kang" },
  cataclysmOfKangModified: { label: "Cataclysm of Kang (Modified)" },
  other: { label: "Other" },
  homebrew: { label: "Homebrew" }
};

MARVEL_MULTIVERSE.weaponTypes = {
  blunt: { label: "Blunt" },
  sharp: { label: "Sharp" },
};

MARVEL_MULTIVERSE.reverseSetList = Object.fromEntries(
  Object.keys(MARVEL_MULTIVERSE.powersets).map((k) => [
    MARVEL_MULTIVERSE.powersets[k].label,
    k,
  ])
);

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

MARVEL_MULTIVERSE.elements = {
  air: { label: "Air", fantasticEffect: "Target is knocked prone for one round." },
  chemical: { label: "Chemical", fantasticEffect: "The target is corroding." },
  earth: { label: "Earth", fantasticEffect: "Target moves at half speed for one round." },
  electricity: { label: "Electricity", fantasticEffect: "Stuns target for one round." },
  energy: { label: "Energy", fantasticEffect: "Blinds target for one round." },
  fire: { label: "Fire", fantasticEffect: "Sets target ablaze." },
  force: { label: "Force", fantasticEffect: "Target has trouble on all actions for one round." },
  hellfire: { label: "Hellfire", fantasticEffect: "Splits damage equally between Health and Focus." },
  ice: { label: "Ice", fantasticEffect: "Paralyzes target for one round." },
  iron: { label: "Iron", fantasticEffect: "Pins target for one round." },
  sound: { label: "Sound", fantasticEffect: "Deafens target for one round." },
  swarm: { label: "Swarm", fantasticEffect: "The target is frightened." },
  toxin: { label: "Toxin", fantasticEffect: "The target is poisoned." },
  water: { label: "Water", fantasticEffect: "Surprises target until the end of the next round." },
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
          "The team members all get an edge on any attack they make this round.",
      },
      {
        level: 2,
        cost: "10 focus, each",
        rankAvg: [3, 4],
        description:
          "The team members can each reroll all their dice on any attack they make this round. They get to use the better result.",
      },
      {
        level: 3,
        cost: "15 focus, each",
        rankAvg: [5, 6],
        description:
          "The team members can each turn their Marvel die to a Fantastic success on any attack roll they make this round against targets of equal or highter rank.",
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
          "The team members all have Damage Reduction 2 for this round",
      },
      {
        level: 2,
        cost: "10 focus, each",
        rankAvg: [3, 4],
        description:
          "The team members all have Damage Reduction 4 for this round",
      },
      {
        level: 3,
        cost: "15 focus, each",
        rankAvg: [5, 6],
        description:
          "The team members all have Damage Reduction 8 for this round",
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
          "All actions taken against team members have trouble this round.",
      },
      {
        level: 2,
        cost: "10 focus, each",
        rankAvg: [3, 4],
        description:
          "Each member of the team can make a speedy recovery roll for either Health or Focus, as if they had spent a point of Karma",
      },
      {
        level: 3,
        cost: "15 focus, each",
        rankAvg: [5, 6],
        description:
          "A single member of the team who has been killed or shattered in battle is healed to at least Health: 0 and Focus: 0",
      },
    ],
  },
];

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
        mode: "2",
        value: "8",
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

class ChatMessageMarvel extends ChatMessage {
  /** @inheritDoc */
  _initialize(options = {}) {
    super._initialize(options);
    Object.defineProperty(this, "user", {
      value: this.author,
      configurable: true,
    });
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async getHTML(...args) {
    const html = await super.getHTML();
    this._displayChatActionButtons(html);

    this._enrichChatCard(html[0]);

    /**
     * A hook event that fires after marvel-multiverse-specific chat message modifications have completed.
     * @function marvel-multiverse.renderChatMessage
     * @memberof hookEvents
     * @param {ChatMessageMarvel} message  Chat message being rendered.
     * @param {HTMLElement} html       HTML contents of the message.
     */
    Hooks.callAll("marvel-multiverse.renderChatMessage", this, html[0]);

    return html;
  }

  /**
   * Optionally hide the display of chat card action buttons which cannot be performed by the user
   * @param {jQuery} html     Rendered contents of the message.
   * @protected
   */
  _displayChatActionButtons(html) {
    const chatCard = html.find(
      ".marvel-multiverse.chat-card, .marvel-multiverse.chat-card"
    );
    if (chatCard.length > 0) {
      const flavor = html.find(".flavor-text");
      if (flavor.text() === html.find(".item-name").text()) flavor.remove();

      if (this.shouldDisplayChallenge)
        chatCard[0].dataset.displayChallenge = "";

      // Conceal effects that the user cannot apply.
      chatCard.find(".effects-tray .effect").each((i, el) => {
        if (
          !game.user.isGM &&
          (el.dataset.transferred === "false" || this.user.id !== game.user.id)
        )
          el.remove();
      });

      // If the user is the message author or the actor owner, proceed
      const actor = game.actors.get(this.speaker.actor);
      if (game.user.isGM || actor?.isOwner || this.user.id === game.user.id) {
        const summonsButton = chatCard[0].querySelector(
          'button[data-action="summon"]'
        );
        if (summonsButton && !SummonsData.canSummon)
          summonsButton.style.display = "none";
        const template = chatCard[0].querySelector(
          'button[data-action="placeTemplate"]'
        );
        if (template && !game.user.can("TEMPLATE_CREATE"))
          template.style.display = "none";
        return;
      }

      // Otherwise conceal action buttons except for saving throw
      const buttons = chatCard.find("button[data-action]:not(.apply-effect)");
      buttons.each((i, btn) => {
        if (
          ["save", "rollRequest", "concentration"].includes(btn.dataset.action)
        )
          return;
        btn.style.display = "none";
      });
    }
  }

  /* -------------------------------------------- */

  /**
   * Augment the chat card markup for additional styling.
   * @param {HTMLElement} html  The chat card markup.
   * @protected
   */
  _enrichChatCard(html) {
    // Header matter
    const { scene: sceneId, token: tokenId, actor: actorId } = this.speaker;
    game.scenes.get(sceneId)?.tokens.get(tokenId)?.actor ??
      game.actors.get(actorId);
    // let img;
    let nameText;
    if (this.isContentVisible) {
      nameText = this.alias;
    } else {
      nameText = this.user.name;
    }

    const avatar = document.createElement("div");
    const name = document.createElement("span");
    name.classList.add("name-stacked");
    name.innerHTML = `<span class="title">${nameText}</span>`;

    const sender = html.querySelector(".message-sender");
    sender?.replaceChildren(avatar, name);
    html.querySelector(".whisper-to")?.remove();

    // Context menu
    const metadata = html.querySelector(".message-metadata");
    metadata.querySelector(".message-delete")?.remove();
    const anchor = document.createElement("a");
    anchor.setAttribute(
      "aria-label",
      game.i18n.localize("MARVEL_MULTIVERSE.AdditionalControls")
    );
    anchor.classList.add("chat-control");
    anchor.dataset.contextMenu = "";
    anchor.innerHTML = '<i class="fas fa-ellipsis-vertical fa-fw"></i>';
    metadata.appendChild(anchor);

    // SVG icons
    for (const el of html.querySelectorAll("i.marvel-multiverse-icon")) {
      const icon = document.createElement("marvel-multiverse-icon");
      icon.src = el.dataset.src;
      el.replaceWith(icon);
    }

    // Enriched roll flavor
    this.rolls;

    if (this.isContentVisible) {
      const chatCard = document.createElement("div");
      chatCard.classList.add("marvel-multiverse", "chat-card");
      chatCard.innerHTML = `
        <section class="card-header description">
          <header class="summary">
            <div class="name-stacked">
              <span class="title">${this.title ?? ""}</span>
            </div>
          </header>
        </section>
      `;
      html
        .querySelector(".message-content")
        .insertAdjacentElement("afterbegin", chatCard);

      const flavorText = html.querySelector("span.flavor-text");
      const isInitiative = flavorText?.innerHTML.includes("Initiative");
      for (const el of html.querySelectorAll("button.retroEdgeMode")) {
        if (isInitiative) {
          el.setAttribute("data-initiative", true);
        }
        el.addEventListener("click", this._onClickRetroButton.bind(this));
      }
      html
        .querySelector("button.damage")
        ?.addEventListener("click", this._onClickDamageButton.bind(this));
    }
  }

  /* -------------------------------------------- */

  /**
   * Augment attack cards with additional information.
   * @param {HTMLLIElement} html   The chat card.
   * @protected
   */
  _enrichAttackTargets(html) {
    const attackRoll = this.rolls[0];
    const targets = this.getFlag("marvel-multiverse", "targets");
    if (
      !game.user.isGM ||
      !(attackRoll instanceof CONFIG.Dice.MarvelMultiverseRoll) ||
      !targets?.length
    )
      return;
    const evaluation = document.createElement("ul");
    evaluation.classList.add("marvel-multiverse", "evaluation");
    evaluation.innerHTML = targets
      .map(({ name, img, ac, uuid }) => {
        const isMiss = !attackRoll.isFantastic && attackRoll.total < ac;
        return [
          `
        <li data-uuid="${uuid}" class="target ${isMiss ? "miss" : "hit"}">
          <img src="${img}" alt="${name}">
          <div class="name-stacked">
            <span class="title">
              ${name}
              <i class="fas ${isMiss ? "fa-times" : "fa-check"}"></i>
            </span>
          </div>
          <div class="ac">
            <i class="fas fa-shield-halved"></i>
            <span>${ac}</span>
          </div>
        </li>
      `,
          isMiss,
        ];
      })
      .sort((a, b) => (a[1] === b[1] ? 0 : a[1] ? 1 : -1))
      .reduce((str, [li]) => str + li, "");
    for (const target of evaluation.querySelectorAll("li.target")) {
      target.addEventListener("click", this._onTargetMouseDown.bind(this));
      target.addEventListener("mouseover", this._onTargetHoverIn.bind(this));
      target.addEventListener("mouseout", this._onTargetHoverOut.bind(this));
    }
    html.querySelector(".message-content")?.appendChild(evaluation);
  }

  /* -------------------------------------------- */

  /**
   * Handle dice roll expansion.
   * @param {PointerEvent} event  The triggering event.
   * @protected
   */
  _onClickDiceRoll(event) {
    event.stopPropagation();
    const eventTarget = event.currentTarget;
    eventTarget.classList.toggle("expanded");
  }

  /**
   * Handle clicking damage button.
   * @param {PointerEvent} event      The initiating click event.
   */
  _onClickDamageButton(event) {
    event.stopPropagation();
    const eventTarget = event.currentTarget;
    const messageId =
      eventTarget.closest("[data-message-id]").dataset.messageId;
    const fantastic = eventTarget.parentNode.querySelector(
      "li.roll.marvel-roll.fantastic"
    );

    const messageHeader = eventTarget.closest("li.chat-message");
    const flavorText =
      messageHeader.querySelector("span.flavor-text").innerHTML;

    this._handleDamageChatButton(messageId, flavorText, fantastic);
  }

  /**
   * Handles the damage from the chat log
   * @param {string} messageId
   * @param {string} ability
   * @param {string} fantastic
   */
  async _handleDamageChatButton(messageId, flavorText, fantastic) {
    const re = /ability:\s(?<ability>\w*)/;
    const dmgTypeRe = /damagetype:\s(?<damageType>\w*)/;
    const ability = re.exec(flavorText).groups.ability;
    const damageType = dmgTypeRe.exec(flavorText)?.groups?.damageType;
    const abilityAbr = MARVEL_MULTIVERSE.damageAbilityAbr[ability] ?? ability;
    const chatMessage = game.messages.get(messageId);
    const sixOneSixPool = chatMessage.rolls[0].terms[0];
    const marvelRoll = sixOneSixPool.rolls[1];
    const actor = game.actors.contents.find(
      (a) => a.name === chatMessage.alias
    );

    const [marvelDie] = marvelRoll.dice;
    const damageMultiplier =
      actor.system.abilities[abilityAbr].damageMultiplier;

    const targetTokens = canvas.tokens.objects.children.filter(
      (t) => t.isTargeted
    );

    const abilityValue = actor.system.abilities[abilityAbr].value;

    const targets = targetTokens.map((t) => t.actor);

    const damageContent = targets.map((t) => {
      const damageReduction =
        damageType && damageType === "focus"
          ? t.system.focusDamageReduction
          : t.system.healthDamageReduction;
      const dmgMultiplier = damageMultiplier - damageReduction;
      let dmg =
        dmgMultiplier === 0
          ? 0
          : marvelDie.total * dmgMultiplier + abilityValue;
      if (fantastic) {
        dmg = dmg * 2;
      }
      return `<p><b>${t.name}</b> takes <b>${dmg} ${
        fantastic ? "Fantastic" : ""
      } </b> ${damageType} damage.<br/> re: MarvelDie: ${
        marvelDie.total
      } &#42; damage multiplier: &#40; ${
        actor.system.abilities[abilityAbr].damageMultiplier
      } - damageReduction: ${damageReduction} &#61; ${dmgMultiplier} &#41; + ${ability} score ${abilityValue} of damage.</p>`;
    });

    if (damageContent.length === 0) {
      let dmg = marvelDie.total * damageMultiplier + abilityValue;
      if (fantastic) {
        dmg = dmg * 2;
      }
      damageContent.push(
        `<p>target(s) take <b>${dmg} ${
          fantastic ? "Fantastic" : ""
        } </b> ${damageType} damage.<br/> re: MarvelDie: ${
          marvelDie.total
        } &#42; damage multiplier: ${damageMultiplier} + ${ability} score ${abilityValue} of damage.</p>`
      );
    }
    // const content = `<p>Delivers <b>${dmg}</b> points re: MarvelDie: ${marvelDie.total} &#42; damage multiplier: &#40; ${actor.system.abilities[abilityAbr].damageMultiplier} - damageReduction: ${damageReduction} &#61; ${damageMultiplier} &#41; + ${ability} score ${abilityValue} of damage.</p>`;

    const msgData = {
      speaker: ChatMessageMarvel.getSpeaker({ actor: actor }),
      rollMode: game.settings.get("core", "rollMode"),
      flavor: flavorText,
      content: damageContent.join(""),
    };
    ChatMessageMarvel.create(msgData);
  }

  /**
   * Handle clicking a retro button.
   * @param {PointerEvent} event      The initiating click event.
   */
  _onClickRetroButton(event) {
    event.stopPropagation();
    const eventTarget = event.currentTarget;

    const action = eventTarget.dataset.retroAction;
    const isInit = eventTarget.dataset.initiative;
    const dieIndex = Math.round(eventTarget.dataset.index);
    const messageId =
      eventTarget.closest("[data-message-id]").dataset.messageId;

    const messageHeader = eventTarget.closest("li.chat-message");
    const flavorText =
      messageHeader.querySelector("span.flavor-text")?.innerHTML;
    this._handleChatButton(action, messageId, dieIndex, isInit, flavorText);
  }

  async _handleEdge(active, rollResult) {
    if (active) {
      rollResult.active = true;
      rollResult.discarded = undefined;
    } else {
      rollResult.active = false;
      rollResult.discarded = true;
    }
  }

  /**
   * Handles our button clicks from the chat log
   * @param {string} action
   * @param {string} messageId
   * @param {number} dieIndex
   */
  async _handleChatButton(action, messageId, dieIndex, isInit, flavor) {
    if (!action || !messageId) throw new Error("Missing Information");

    const chatMessage = game.messages.get(messageId);
    const modifier = action === "edge" ? "kh" : "kl";
    const [roll] = chatMessage.rolls;
    const firstRollTerm = roll.terms[0];

    let rollTerm;

    if (
      firstRollTerm instanceof foundry.dice.terms.ParentheticalTerm &&
      firstRollTerm.roll.terms[0] instanceof foundry.dice.terms.PoolTerm
    ) {
      rollTerm = firstRollTerm.roll.terms[0];
    } else if (firstRollTerm instanceof foundry.dice.terms.PoolTerm) {
      rollTerm = firstRollTerm;
    }

    if (
      !(
        rollTerm.rolls.length === 3 &&
        rollTerm.rolls[1].terms[0] instanceof
          game.MarvelMultiverse.dice.MarvelDie
      )
    )
      return;

    const targetRoll = rollTerm.rolls[dieIndex];
    const targetDie = targetRoll.terms[0];
    const targetIsMarvel =
      targetDie instanceof game.MarvelMultiverse.dice.MarvelDie;
    const formulaReg = /(?<number>\d)d(?<dieType>\d|m).*/;
    const formulaGroups = formulaReg.exec(targetRoll._formula)?.groups;

    const formulaDie = formulaGroups.dieType;

    targetDie.number = 2;

    const targetFormula = `${targetDie.number}d${formulaDie}`;

    targetRoll._formula = `${targetFormula}${modifier}`;

    rollTerm.terms[dieIndex] = targetRoll._formula;

    targetDie.modifiers = [modifier];

    const oldRollResult = targetDie.results.find((r) => r.active);
    const oldFantastic = targetIsMarvel && oldRollResult.result === 1;
    const oldResult =
      targetIsMarvel && oldRollResult.result === 1 ? 6 : oldRollResult.result;

    const newRoll = new MarvelMultiverseRoll(targetRoll._formula, {
      ...targetRoll.data,
    });
    await newRoll.roll();

    const newRollResult = newRoll.terms[0].results[0];
    const newFantastic = targetIsMarvel && newRollResult.result === 1;
    const newResult =
      targetIsMarvel && newRollResult.result === 1 ? 6 : newRollResult.result;

    if (modifier === "kh") {
      if (newFantastic || newResult >= oldResult) {
        this._handleEdge(false, oldRollResult);
        this._handleEdge(true, newRollResult);
      } else if (oldFantastic || oldResult >= newResult) {
        this._handleEdge(false, newRollResult);
      }
    } else if (modifier === "kl") {
      if (newFantastic) {
        this._handleEdge(false, newRollResult);
        this._handleEdge(true, oldRollResult);
      } else if (newResult <= oldResult) {
        this._handleEdge(false, oldRollResult);
        this._handleEdge(true, newRollResult);
      } else if (newResult > oldResult) {
        this._handleEdge(false, newRollResult);
        this._handleEdge(true, oldRollResult);
      }
    }

    targetDie.results.push(newRollResult);

    const re = /(\(?{)(\dd\d),(\ddm),(\dd\d)(}.*)/;

    let replacedFormula;
    switch (dieIndex) {
      case 0: {
        replacedFormula = roll.formula.replace(
          re,
          `$1${targetDie.number}d6${modifier},$3,$4$5`
        );
        break;
      }
      case 1: {
        replacedFormula = roll.formula.replace(
          re,
          `$1$2,${targetDie.number}dm${modifier},$4$5`
        );
        break;
      }
      case 2: {
        replacedFormula = roll.formula.replace(
          re,
          `$1$2,$3,${targetDie.number}d6${modifier}$5`
        );
        break;
      }
    }

    roll._formula = replacedFormula;

    if (newRollResult.active) {
      roll._total = roll.total - oldResult + newResult;
    }

    let update = await roll.toMessage({ flavor: flavor }, { create: false });
    update = foundry.utils.mergeObject(chatMessage.toJSON(), update);

    if (isInit) {
      const actorId = game.actors.contents.find(
        (a) => a.name === chatMessage.alias
      )._id;
      const combatant = game.combat.combatants.contents.find(
        (combatant) => combatant.actorId === actorId
      );
      await combatant.update({ initiative: roll.total });
    }

    return chatMessage.update(update);
  }

  /* -------------------------------------------- */
  /**
   * Wait to apply appropriate element heights until after the chat log has completed its initial batch render.
   * @param {jQuery} html  The chat log HTML.
   */
  static onRenderChatLog(html) {
  }
}

/**
 * Manage Active Effect instances through an Actor or Item Sheet via effect control buttons.
 * @param {MouseEvent} event      The left-click event on the effect control
 * @param {Actor|Item} owner      The owning document which manages this effect
 */
function onManageActiveEffect(event, owner) {
  event.preventDefault();
  const a = event.currentTarget;
  const li = a.closest('li');
  const effect = li.dataset.effectId
    ? owner.effects.get(li.dataset.effectId)
    : null;
  switch (a.dataset.action) {
    case 'create':
      return owner.createEmbeddedDocuments('ActiveEffect', [
        {
          name: game.i18n.format('DOCUMENT.New', {
            type: game.i18n.localize('DOCUMENT.ActiveEffect'),
          }),
          img: 'icons/svg/aura.svg',
          origin: owner.uuid,
          'duration.rounds':
            li.dataset.effectType === 'temporary' ? 1 : undefined,
          disabled: li.dataset.effectType === 'inactive',
        },
      ]);
    case 'edit':
      return effect.sheet.render(true);
    case 'delete':
      return effect.delete();
    case 'toggle':
      return effect.update({ disabled: !effect.disabled });
  }
}

/**
 * Prepare the data structure for Active Effects which are currently embedded in an Actor or Item.
 * @param {ActiveEffect[]} effects    A collection or generator of Active Effect documents to prepare sheet data for
 * @return {object}                   Data for rendering
 */
function prepareActiveEffectCategories(effects) {
  // Define effect header categories
  const categories = {
    temporary: {
      type: 'temporary',
      label: game.i18n.localize('MARVEL_MULTIVERSE.Effect.Temporary'),
      effects: [],
    },
    passive: {
      type: 'passive',
      label: game.i18n.localize('MARVEL_MULTIVERSE.Effect.Passive'),
      effects: [],
    },
    inactive: {
      type: 'inactive',
      label: game.i18n.localize('MARVEL_MULTIVERSE.Effect.Inactive'),
      effects: [],
    },
  };

  // Iterate over active effects, classifying them into categories
  for (let e of effects) {
    if (e.disabled) categories.inactive.effects.push(e);
    else if (e.isTemporary) categories.temporary.effects.push(e);
    else categories.passive.effects.push(e);
  }
  return categories;
}

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
class MarvelMultiverseCharacterSheet extends ActorSheet {
  /** @override */
  static get defaultOptions() {
    // biome-ignore lint/complexity/noThisInStatic: <explanation>
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["marvel-multiverse", "sheet", "actor"],
      width: 690,
      height: 980,
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-body",
          initial: "traits",
        },
      ],
    });
  }

  /** @override */
  get template() {
    return "systems/marvel-multiverse/templates/actor/actor-character-sheet.hbs";
  }

  /** @override */
  async _render(...args) {
    const scrollables = this.element.find(".mm-styled-container-body");
    const scrollPositions = [];
    scrollables.each(function() {
      scrollPositions.push(this.scrollTop);
    });
    await super._render(...args);
    const newScrollables = this.element.find(".mm-styled-container-body");
    newScrollables.each(function(i) {
      if (scrollPositions[i] !== undefined) this.scrollTop = scrollPositions[i];
    });
  }

  /* -------------------------------------------- */

  /** @override */
  getData() {
    // Retrieve the data structure from the base sheet. You can inspect or log
    // the context variable to see the structure, but some key properties for
    // sheets are the actor object, the data object, whether or not it's
    // editable, the items array, and the effects array.
    const context = super.getData();

    // Use a safe clone of the actor data for further operations.
    const actorData = context.data;

    // Add the actor's data to context.data for easier access, as well as flags.
    context.system = actorData.system;
    context.flags = actorData.flags;

    // Prepare character data and items.
    this._prepareItems(context);
    this._prepareData(context);

    // Add roll data for TinyMCE editors.
    context.rollData = context.actor.getRollData();

    context.sizes = CONFIG.MARVEL_MULTIVERSE.sizes;
    context.sources = CONFIG.MARVEL_MULTIVERSE.sources;

    context.sizeSelection = Object.fromEntries(
      Object.keys(CONFIG.MARVEL_MULTIVERSE.sizes).map((key) => [
        key,
        game.i18n.localize(CONFIG.MARVEL_MULTIVERSE.sizes[key].label),
      ])
    );

    context.teamManeuverTypes = Object.fromEntries(
      CONFIG.MARVEL_MULTIVERSE.teamManeuvers.map((teamMan) => [
        teamMan.maneuverType.toLowerCase(),
        teamMan.maneuverType,
      ])
    );
    context.teamManeuverLevels = Object.fromEntries(
      [1, 2, 3].map((tml) => [tml, tml.toString()])
    );

    context.elements = Object.fromEntries(
      Object.keys(CONFIG.MARVEL_MULTIVERSE.elements).map((k) => [
        k,
        CONFIG.MARVEL_MULTIVERSE.elements[k].label,
      ])
    );

    context.weaponTypes = Object.fromEntries(
      Object.keys(CONFIG.MARVEL_MULTIVERSE.weaponTypes).map((k) => [
        k,
        CONFIG.MARVEL_MULTIVERSE.weaponTypes[k].label,
      ])
    );

    // Prepare active effects
    context.effects = prepareActiveEffectCategories(
      // A generator that returns all effects stored on the actor
      // as well as any items
      this.actor.allApplicableEffects()
    );

    return context;
  }

  /**
   * Organize and classify Items for Character sheets.
   *
   * @param {Object} actorData The actor to prepare.
   *
   * @return {undefined}
   */
  _prepareItems(context) {
    // Initialize containers.
    const gear = [];
    const origins = [];
    const occupations = [];
    const weapons = [];
    const traits = [];
    const tags = [];
    const powers = {};

    // Iterate through items, allocating to containers
    for (const i of context.items) {
      i.img = i.img || Item.DEFAULT_ICON;

      // Append to origin tags traits and powers as well as origins.
      if (i.type === "origin") {
        origins.push(i);
      }
      // Append to origin tags traits and powers as well as origins.
      if (i.type === "occupation") {
        occupations.push(i);
      } else if (i.type === "item") {
        gear.push(i);
      } else if (i.type === "weapon") {
        weapons.push(i);
      } else if (i.type === "trait") {
        traits.push(i);
      } else if (i.type === "tag") {
        tags.push(i);
      } else if (i.type === "power") {
        const firstSet = i.system.powerSets?.length
          ? i.system.powerSets[0].name
          : (i.system.powerSet?.split(",")[0]?.trim() || "Basic");
        if (!powers[firstSet]) powers[firstSet] = [];
        powers[firstSet].push(i);
      }

      // Assign and return
      context.gear = gear;
      context.origins = origins;
      context.occupations = occupations;
      context.weapons = weapons;
      context.traits = traits.sort((a, b) => a.name.localeCompare(b.name));
      context.tags = tags.sort((a, b) => a.name.localeCompare(b.name));
      for (const set in powers) powers[set].sort((a, b) => a.name.localeCompare(b.name));
      const sortedPowers = {};
      for (const key of Object.keys(powers).sort()) sortedPowers[key] = powers[key];
      context.powers = sortedPowers;
      context.powerCount = Object.values(sortedPowers).reduce((sum, arr) => sum + arr.reduce((s, p) => {
        const match = p.name.match(/\s+(\d+)$/);
        return s + (match ? parseInt(match[1]) : 1);
      }, 0), 0);
      context.hasElementalPowers = (powers["Elemental Control"] ?? []).length > 0;
      context.hasMeleeWeaponPowers = (powers["Melee Weapons"] ?? []).length > 0;
    }
  }

  /**
   * Organize and classify Items for Character sheets.
   *
   * @param {Object} actorData The actor to prepare.
   *
   * @return {undefined}
   */
  _prepareData(context) {
    // Handle ability scores.
    for (const [k, v] of Object.entries(context.system.abilities)) {
      v.label = game.i18n.localize(CONFIG.MARVEL_MULTIVERSE.abilities[k]) ?? k;
    }

    for (const i of context.items.filter((item) => item.type === "power")) {
      const firstSet = i.system.powerSets?.length
        ? i.system.powerSets[0].name
        : (i.system.powerSet?.split(",")[0]?.trim() || "Basic");
      const key = CONFIG.MARVEL_MULTIVERSE.reverseSetList[firstSet];
      if (key && context.system.powers[key]) {
        context.system.powers[key].push(i);
      }
    }

    for (const i of context.items.filter((item) => item.type === "origin")) {
      context.system.origins.push(i);
    }
  }
  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Render the item sheet for viewing/editing prior to the editable check.
    html.on("click", ".item-edit", (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.sheet.render(true);
    });

    // -------------------------------------------------------------
    // Everything below here is only needed if the sheet is editable
    // if (!this.isEditable) return;

    // Add Inventory Item
    html.on("click", ".item-create", this._onItemCreate.bind(this));

    // Delete Inventory Item
    html.on("click", ".item-delete", (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      this.actor.items.get(li.data("itemId"));
      this.actor.deleteEmbeddedDocuments("Item", [li.data("itemId")]);
      li.slideUp(200, () => this.render(false));
    });

    // Active Effect management
    html.on("click", ".effect-control", (ev) => {
      const row = ev.currentTarget.closest("li");
      const document =
        row.dataset.parentId === this.actor.id
          ? this.actor
          : this.actor.items.get(row.dataset.parentId);
      onManageActiveEffect(ev, document);
    });

    // Rollable abilities.
    html.on("click", ".rollable", this._onRoll.bind(this));

    html.on(
      "change",
      'select[name="system.size"]',
      this._onSizeChange.bind(this)
    );

    html.on("click", ".roll-initiative", (ev) => {
      this.actor.rollInitiative({ createCombatants: true });
    });

    // Drag events for macros.
    if (this.actor.isOwner) {
      const handler = (ev) => this._onDragStart(ev);
      html.find("li.item").each((i, li) => {
        if (li.classList.contains("inventory-header")) return;
        li.setAttribute("draggable", true);
        li.addEventListener("dragstart", handler, false);
      });
    }
  }

  /**
   * Handle changes to actor size
   * @param {Event} event   The originating click event
   * @private
   */
  async _onSizeChange(event) {
    event.preventDefault();
    const selected = event.target.value;
    this._changeSizeEffect(selected);
  }

  async _changeSizeEffect(effectKey) {
    const sizeEffectNames = Object.keys(
      CONFIG.MARVEL_MULTIVERSE.sizeEffects
    ).map((key) => CONFIG.MARVEL_MULTIVERSE.sizeEffects[key].name);

    const currentSizeEffects = this.actor.effects.contents.filter((effect) =>
      sizeEffectNames.includes(effect.name)
    );
    const currentSizeEffectIds = currentSizeEffects.map((ae) => ae._id);

    if (currentSizeEffectIds.length > 0) {
      this.actor.deleteEmbeddedDocuments("ActiveEffect", currentSizeEffectIds);
    }
    const effect = CONFIG.MARVEL_MULTIVERSE.sizeEffects[effectKey];
    ActiveEffect.create(effect, { parent: this.actor });
  }

  /**
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   * @param {Event} event   The originating click event
   * @private
   */
  async _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;
    // Get the type of item to create.
    const type = header.dataset.type;
    // Grab any data associated with this control.
    const data = foundry.utils.duplicate(header.dataset);
    // Initialize a default name.
    const name = `New ${type.capitalize()}`;
    // Prepare the item object.
    const itemData = {
      name: name,
      type: type,
      system: data,
    };
    // Remove the type from the dataset since it's in the itemData.type prop.
    // biome-ignore lint/complexity/useLiteralKeys: <explanation>
    itemData.system["type"] = undefined;

    // Finally, create the item!
    return await Item.create(itemData, { parent: this.actor });
  }

  async _createTrait(traitData) {
    if (
      !this.actor.items.map((item) => item.name).includes(traitData.name) &&
      !traitData.multiple
    ) {
      super._onDropItemCreate(traitData);
    }
  }

  async _createTag(tagData) {
    if (
      !this.actor.items.map((item) => item.name).includes(tagData.name) &&
      !tagData.multiple
    ) {
      super._onDropItemCreate(tagData);
    }
  }

  /** Fired whenever an embedded document is created.
   */
  _onDropItemCreate(itemData) {
    if (!this.actor.items.map((item) => item.name).includes(itemData.name)) {
      if (
        itemData.type === "power" &&
        (itemData.system.powerSets?.some(ps => ps.name === "Elemental Control") ||
         itemData.system.powerSet === "Elemental Control")
      ) {
        if (!itemData.system.element) {
          itemData.system.element = this.actor.system.defaultElement;
        }
      }

      if (itemData.type === "occupation") {
        if (game.settings.get("marvel-multiverse", "autoPopulateOrigin")) {
          // biome-ignore lint/complexity/noForEach: <explanation>
          itemData.system.tags.forEach(async (tag) => {
            this._createTag(tag);
          });
          // biome-ignore lint/complexity/noForEach: <explanation>
          itemData.system.traits.forEach(async (trait) => {
            this._createTrait(trait);
          });
        }
        // create the occupation
        return super._onDropItemCreate(itemData);
        // biome-ignore lint/style/noUselessElse: <explanation>
      } else if (itemData.type === "origin") {
        if (game.settings.get("marvel-multiverse", "autoPopulateOrigin")) {
          // biome-ignore lint/complexity/noForEach: <explanation>
          itemData.system.tags.forEach(async (tag) => {
            this._createTag(tag);
          });
          // biome-ignore lint/complexity/noForEach: <explanation>
          itemData.system.traits.forEach(async (trait) => {
            this._createTrait(trait);
          });
          // biome-ignore lint/complexity/noForEach: <explanation>
          itemData.system.powers.forEach(async (power) => {
            const newItemData = {
              name: power.name,
              type: "power",
              data: power.system,
            };
            if (this.actor.system.defaultElement) {
              Object.assign(newItemData, {
                element: this.actor.system.defaultElement,
              });
            }
            await Item.create(newItemData, { parent: this.actor });
          });
        }
        // create the origin
        return super._onDropItemCreate(itemData);
        // biome-ignore lint/style/noUselessElse: <explanation>
      } else if (
        itemData.type === "trait" &&
        ["Big", "Small"].includes(itemData.name)
      ) {
        this._changeSizeEffect(itemData.name.toLowerCase());
        return super._onDropItemCreate(itemData);
        // biome-ignore lint/style/noUselessElse: <explanation>
      } else {
        return super._onDropItemCreate(itemData);
      }
    }
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  _onRoll(event) {
    event.preventDefault();
    game.settings.get("core", "rollMode");
    const element = event.currentTarget;
    const dataset = element.dataset;

    const itemId = element.closest(".item")?.dataset?.itemId;
    const item = this.actor.items.get(itemId);

    // Handle item rolls.
    if (dataset.rollType) {
      if (dataset.rollType === "item") {
        if (item) return item.roll();
      }
    }
    if (dataset.formula) {
      const ability =
        CONFIG.MARVEL_MULTIVERSE.damageAbility[dataset.label] ?? dataset.label;
      let label = `Ability: ${ability}`;
      if (item) label += `<br/>${item.type}: ${item.name}`;
      const title = dataset.power ? `[power] ${dataset.power}` : "";

      label = dataset.damagetype
        ? `${label}<br/>damagetype: ${dataset.damagetype}`
        : label;

      const speaker = ChatMessage.getSpeaker({ actor: this.actor });
      const rollMode = game.settings.get("core", "rollMode");

      if (item?.system?.description) {
        ChatMessage.create({
          speaker: speaker,
          rollMode: rollMode,
          flavor: label,
          content: `<div>${item.system.description}</div><div>${
            item.system.effect ? item.system.effect : ""
          }</div>`,
        });
      }

      const abilityKey = dataset.abilityKey;
      const abilityData = abilityKey ? this.actor.system.abilities[abilityKey] : null;
      let edgeMode = MarvelMultiverseRoll.EDGE_MODE.NORMAL;
      if (abilityData?.edge) edgeMode = MarvelMultiverseRoll.EDGE_MODE.EDGE;
      else if (abilityData?.trouble) edgeMode = MarvelMultiverseRoll.EDGE_MODE.TROUBLE;

      const roll = new CONFIG.Dice.MarvelMultiverseRoll(
        dataset.formula,
        this.actor.getRollData(),
        { edgeMode }
      );

      roll.toMessage(
        {
          speaker: speaker,
          flavor: label,
          rollMode: rollMode,
          title: title,
        },
        { rollMode: rollMode, itemId: itemId }
      );
      return roll;
    }
  }
}

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
class MarvelMultiverseNPCSheet extends ActorSheet {
  /** @override */
  static get defaultOptions() {
    // biome-ignore lint/complexity/noThisInStatic: <explanation>
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["marvel-multiverse", "sheet", "actor"],
      width: 690,
      height: 500,
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-body",
          initial: "traits",
        },
      ],
    });
  }

  /** @override */
  get template() {
    return "systems/marvel-multiverse/templates/actor/actor-npc-sheet.hbs";
  }

  /** @override */
  async _render(...args) {
    const scrollables = this.element.find(".mm-styled-container-body");
    const scrollPositions = [];
    scrollables.each(function() {
      scrollPositions.push(this.scrollTop);
    });
    await super._render(...args);
    const newScrollables = this.element.find(".mm-styled-container-body");
    newScrollables.each(function(i) {
      if (scrollPositions[i] !== undefined) this.scrollTop = scrollPositions[i];
    });
  }

  /* -------------------------------------------- */

  /** @override */
  getData() {
    // Retrieve the data structure from the base sheet. You can inspect or log
    // the context variable to see the structure, but some key properties for
    // sheets are the actor object, the data object, whether or not it's
    // editable, the items array, and the effects array.
    const context = super.getData();

    // Use a safe clone of the actor data for further operations.
    const actorData = context.data;

    // Add the actor's data to context.data for easier access, as well as flags.
    context.system = actorData.system;
    context.flags = actorData.flags;

    // Prepare character data and items.
    if (actorData.type === "character") {
      this._prepareItems(context);
      this._prepareCharacterData(context);
    }

    // Prepare NPC data and items.
    if (actorData.type === "npc") {
      this._prepareItems(context);
    }

    // Add roll data for TinyMCE editors.
    context.rollData = context.actor.getRollData();

    context.sizes = CONFIG.MARVEL_MULTIVERSE.sizes;
    context.sources = CONFIG.MARVEL_MULTIVERSE.sources;

    context.sizeSelection = Object.fromEntries(
      Object.keys(CONFIG.MARVEL_MULTIVERSE.sizes).map((key) => [
        key,
        game.i18n.localize(CONFIG.MARVEL_MULTIVERSE.sizes[key].label),
      ])
    );

    context.teamManeuverTypes = Object.fromEntries(
      CONFIG.MARVEL_MULTIVERSE.teamManeuvers.map((teamMan) => [
        teamMan.maneuverType.toLowerCase(),
        teamMan.maneuverType,
      ])
    );
    context.teamManeuverLevels = Object.fromEntries(
      [1, 2, 3].map((tml) => [tml, tml.toString()])
    );

    context.elements = Object.fromEntries(
      Object.keys(CONFIG.MARVEL_MULTIVERSE.elements).map((k) => [
        k,
        CONFIG.MARVEL_MULTIVERSE.elements[k].label,
      ])
    );

    context.weaponTypes = Object.fromEntries(
      Object.keys(CONFIG.MARVEL_MULTIVERSE.weaponTypes).map((k) => [
        k,
        CONFIG.MARVEL_MULTIVERSE.weaponTypes[k].label,
      ])
    );

    // Prepare active effects
    context.effects = prepareActiveEffectCategories(
      // A generator that returns all effects stored on the actor
      // as well as any items
      this.actor.allApplicableEffects()
    );

    return context;
  }

  /**
   * Organize and classify Items for Character sheets.
   *
   * @param {Object} actorData The actor to prepare.
   *
   * @return {undefined}
   */
  _prepareItems(context) {
    // Initialize containers.
    const gear = [];
    const traits = [];
    const origins = [];
    const occupations = [];
    const tags = [];
    const weapons = [];
    const powers = {};

    // Iterate through items, allocating to containers
    for (const i of context.items) {
      i.img = i.img || Item.DEFAULT_ICON;

      // Append to origin tags traits and powers as well as origins.
      if (i.type === "origin") {
        origins.push(i);
      }
      // Append to origin tags traits and powers as well as origins.
      if (i.type === "occupation") {
        occupations.push(i);
      }
      // Append to traits.
      else if (i.type === "trait") {
        traits.push(i);
      } else if (i.type === "tag") {
        tags.push(i);
      }
      // Append to power.
      else if (i.type === "power") {
        const firstSet = i.system.powerSets?.length
          ? i.system.powerSets[0].name
          : (i.system.powerSet?.split(",")[0]?.trim() || "Basic");
        if (!powers[firstSet]) powers[firstSet] = [];
        powers[firstSet].push(i);
      } else if (i.type === "item") {
        gear.push(i);
      } else if (i.type === "weapon") {
        weapons.push(i);
      }

      // Assign and return
      context.gear = gear;
      context.traits = traits.sort((a, b) => a.name.localeCompare(b.name));
      context.tags = tags.sort((a, b) => a.name.localeCompare(b.name));
      for (const set in powers) powers[set].sort((a, b) => a.name.localeCompare(b.name));
      const sortedPowers = {};
      for (const key of Object.keys(powers).sort()) sortedPowers[key] = powers[key];
      context.powers = sortedPowers;
      context.hasElementalPowers = (powers["Elemental Control"] ?? []).length > 0;
      context.hasMeleeWeaponPowers = (powers["Melee Weapons"] ?? []).length > 0;
      context.origins = origins;
      context.occupations = occupations;
      context.weapons = weapons;
    }
  }

  /**
   * Organize and classify Items for Character sheets.
   *
   * @param {Object} actorData The actor to prepare.
   *
   * @return {undefined}
   */
  _prepareCharacterData(context) {
    // Handle ability scores.
    for (const [k, v] of Object.entries(context.system.abilities)) {
      v.label = game.i18n.localize(CONFIG.MARVEL_MULTIVERSE.abilities[k]) ?? k;
    }

    for (const i of context.items.filter((item) => item.type === "power")) {
      const firstSet = i.system.powerSets?.length
        ? i.system.powerSets[0].name
        : (i.system.powerSet?.split(",")[0]?.trim() || "Basic");
      const key = CONFIG.MARVEL_MULTIVERSE.reverseSetList[firstSet];
      if (key && context.system.powers[key]) {
        context.system.powers[key].push(i);
      }
    }

    for (const i of context.items.filter((item) => item.type === "origin")) {
      context.system.origins.push(i);
    }
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Render the item sheet for viewing/editing prior to the editable check.
    html.on("click", ".item-edit", (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.sheet.render(true);
    });

    // -------------------------------------------------------------
    // Everything below here is only needed if the sheet is editable
    // if (!this.isEditable) return;

    // Add Inventory Item
    html.on("click", ".item-create", this._onItemCreate.bind(this));

    // Delete Inventory Item
    html.on("click", ".item-delete", (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      this.actor.items.get(li.data("itemId"));
      this.actor.deleteEmbeddedDocuments("Item", [li.data("itemId")]);
      li.slideUp(200, () => this.render(false));
    });

    // Active Effect management
    html.on("click", ".effect-control", (ev) => {
      const row = ev.currentTarget.closest("li");
      const document =
        row.dataset.parentId === this.actor.id
          ? this.actor
          : this.actor.items.get(row.dataset.parentId);
      onManageActiveEffect(ev, document);
    });

    // Rollable abilities.
    html.on("click", ".rollable", this._onRoll.bind(this));

    html.on(
      "change",
      'select[name="system.size"]',
      this._onSizeChange.bind(this)
    );

    html.on("click", ".roll-initiative", (ev) => {
      this.actor.rollInitiative({ createCombatants: true });
    });

    // Drag events for macros.
    if (this.actor.isOwner) {
      const handler = (ev) => this._onDragStart(ev);
      html.find("li.item").each((i, li) => {
        if (li.classList.contains("inventory-header")) return;
        li.setAttribute("draggable", true);
        li.addEventListener("dragstart", handler, false);
      });
    }
  }

  /**
   * Handle changes to actor size
   * @param {Event} event   The originating click event
   * @private
   */
  async _onSizeChange(event) {
    event.preventDefault();
    const selected = event.target.value;
    this._changeSizeEffect(selected);
  }

  async _changeSizeEffect(effectKey) {
    const sizeEffectNames = Object.keys(
      CONFIG.MARVEL_MULTIVERSE.sizeEffects
    ).map((key) => CONFIG.MARVEL_MULTIVERSE.sizeEffects[key].name);

    const currentSizeEffects = this.actor.effects.contents.filter((effect) =>
      sizeEffectNames.includes(effect.name)
    );
    const currentSizeEffectIds = currentSizeEffects.map((ae) => ae._id);

    if (currentSizeEffectIds.length > 0) {
      this.actor.deleteEmbeddedDocuments("ActiveEffect", currentSizeEffectIds);
    }
    const effect = CONFIG.MARVEL_MULTIVERSE.sizeEffects[effectKey];
    ActiveEffect.create(effect, { parent: this.actor });
  }

  /**
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   * @param {Event} event   The originating click event
   * @private
   */
  async _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;
    // Get the type of item to create.
    const type = header.dataset.type;
    // Grab any data associated with this control.
    const data = foundry.utils.duplicate(header.dataset);
    // Initialize a default name.
    const name = `New ${type.capitalize()}`;
    // Prepare the item object.
    const itemData = {
      name: name,
      type: type,
      system: data,
    };
    // Remove the type from the dataset since it's in the itemData.type prop.
    itemData.system.type = undefined;

    // Finally, create the item!
    return await Item.create(itemData, { parent: this.actor });
  }

  async _createTrait(traitData) {
    if (
      !this.actor.items.map((item) => item.name).includes(traitData.name) &&
      !traitData.multiple
    ) {
      super._onDropItemCreate(traitData);
    }
  }

  async _createTag(tagData) {
    if (
      !this.actor.items.map((item) => item.name).includes(tagData.name) &&
      !tagData.multiple
    ) {
      super._onDropItemCreate(tagData);
    }
  }

  /** Fired whenever an embedded document is created.
   */
  async _onDropItemCreate(itemData) {
    if (!this.actor.items.map((item) => item.name).includes(itemData.name)) {
      if (
        itemData.type === "power" &&
        (itemData.system.powerSets?.some(ps => ps.name === "Elemental Control") ||
         itemData.system.powerSet === "Elemental Control")
      ) {
        if (!itemData.system.element) {
          itemData.system.element = this.actor.system.defaultElement;
        }
      }

      if (itemData.type === "occupation") {
        if (game.settings.get("marvel-multiverse", "autoPopulateOrigin")) {
          for (const tag of itemData.system.tags) {
            this._createTag(tag);
          }
          for (const trait of itemData.system.traits) {
            this._createTrait(trait);
          }
        }
        // create the occupation
        return super._onDropItemCreate(itemData);
        // biome-ignore lint/style/noUselessElse: <explanation>
      } else if (itemData.type === "origin") {
        if (game.settings.get("marvel-multiverse", "autoPopulateOrigin")) {
          for (const tag of itemData.system.tags) {
            this._createTag(tag);
          }
          for (const trait of itemData.system.traits) {
            this._createTrait(trait);
          }
          for (const power of itemData.system.powers) {
            const newItemData = {
              name: power.name,
              type: "power",
              data: power.system,
            };
            if (this.actor.system.defaultElement) {
              Object.assign(newItemData, {
                element: this.actor.system.defaultElement,
              });
            }
            await Item.create(newItemData, { parent: this.actor });
          }
        }
        // create the origin
        return super._onDropItemCreate(itemData);
        // biome-ignore lint/style/noUselessElse: <explanation>
      } else if (
        itemData.type === "trait" &&
        ["Big", "Small"].includes(itemData.name)
      ) {
        this._changeSizeEffect(itemData.name.toLowerCase());
        return super._onDropItemCreate(itemData);
        // biome-ignore lint/style/noUselessElse: <explanation>
      } else {
        return super._onDropItemCreate(itemData);
      }
    }
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  _onRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;

    // Handle item rolls.
    if (dataset.rollType) {
      if (dataset.rollType === "item") {
        const itemId = element.closest(".item").dataset.itemId;
        const item = this.actor.items.get(itemId);
        if (item) return item.roll();
      }
    }

    // Handle rolls that supply the formula directly.
    if (dataset.formula) {
      const ability =
        CONFIG.MARVEL_MULTIVERSE.damageAbility[dataset.label] ?? dataset.label;
      let label = `[ability] ${ability}`;
      const title = dataset.power ? `[power] ${dataset.power}` : "";
      label = dataset.damageType
        ? `${label} [damageType] ${dataset.damageType}`
        : label;

      const abilityKey = dataset.abilityKey;
      const abilityData = abilityKey ? this.actor.system.abilities[abilityKey] : null;
      let edgeMode = MarvelMultiverseRoll.EDGE_MODE.NORMAL;
      if (abilityData?.edge) edgeMode = MarvelMultiverseRoll.EDGE_MODE.EDGE;
      else if (abilityData?.trouble) edgeMode = MarvelMultiverseRoll.EDGE_MODE.TROUBLE;

      const roll = new CONFIG.Dice.MarvelMultiverseRoll(
        dataset.formula,
        this.actor.getRollData(),
        { edgeMode }
      );

      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: label,
        rollMode: game.settings.get("core", "rollMode"),
        title: title,
      });
      return roll;
    }
  }
}

/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
class MarvelMultiverseItemSheet extends ItemSheet {
  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(ItemSheet.defaultOptions, {
      classes: ["marvel-multiverse", "sheet", "item"],
      width: 520,
      height: 480,
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-body",
          initial: "description",
        },
      ],
    });
  }

  /** @override */
  get template() {
    const path = "systems/marvel-multiverse/templates/item";
    // Return a single sheet for all item types.
    // return `${path}/item-sheet.hbs`;

    // Alternatively, you could use the following return statement to do a
    // unique item sheet by type, like `weapon-sheet.hbs`.
    const itemSheet = `${path}/item-${this.item.type}-sheet.hbs`;
    console.log(
      `Loading item sheet template: ${itemSheet} for type ${this.item.type}`
    );
    return itemSheet;
  }

  /* -------------------------------------------- */

  /** @override */
  getData() {
    // Retrieve base data structure.
    const context = super.getData();

    // Use a safe clone of the item data for further operations.
    const itemData = context.data;

    // Retrieve the roll data for TinyMCE editors.
    context.rollData = this.item.getRollData();

    // Add the item's data to context.data for easier access, as well as flags.
    context.system = itemData.system;
    context.flags = itemData.flags;

    // Prepare active effects for easier access
    context.effects = prepareActiveEffectCategories(this.item.effects);

    // Source dropdown
    context.sources = CONFIG.MARVEL_MULTIVERSE.sources;

    // Prepare data and items.
    if (itemData.type === "power" || itemData.type === "weapon") {
      context.elements = Object.fromEntries(
        Object.keys(CONFIG.MARVEL_MULTIVERSE.elements).map((k) => [
          k,
          CONFIG.MARVEL_MULTIVERSE.elements[k].label,
        ])
      );
      context.selectedElement = context.system.element;

      context.damageTypes = {
        health: { label: "Health" },
        focus: { label: "Focus" },
      };

      context.attackKinds = {
        ranged: { label: "Ranged" },
        close: { label: "Close" },
      };
      context.attackEdgeModes = {
        edge: { label: "Edge" },
        normal: { label: "Normal" },
        trouble: { label: "Trouble" },
      };
      context.abilities = {
        mle: {
          label: game.i18n.localize(CONFIG.MARVEL_MULTIVERSE.abilities.mle),
        },
        agl: {
          label: game.i18n.localize(CONFIG.MARVEL_MULTIVERSE.abilities.agl),
        },
        res: {
          label: game.i18n.localize(CONFIG.MARVEL_MULTIVERSE.abilities.res),
        },
        vig: {
          label: game.i18n.localize(CONFIG.MARVEL_MULTIVERSE.abilities.vig),
        },
        ego: {
          label: game.i18n.localize(CONFIG.MARVEL_MULTIVERSE.abilities.ego),
        },
        log: {
          label: game.i18n.localize(CONFIG.MARVEL_MULTIVERSE.abilities.log),
        },
      };
    }
    return context;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Roll handlers, click handlers, etc. would go here.

    // Active Effect management
    html.on("click", ".effect-control", (ev) =>
      onManageActiveEffect(ev, this.item)
    );

    // Power set tag removal
    html.on("click", ".mm-powerset-remove", async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const index = Number(ev.currentTarget.dataset.index);
      const powerSets = [...this.item.system.powerSets];
      powerSets.splice(index, 1);
      const powerSet = powerSets.map(ps => ps.name).join(", ");
      await this.item.update({ "system.powerSets": powerSets, "system.powerSet": powerSet });
    });

    // Power set drag-and-drop visual feedback
    const dropZone = html.find(".mm-powerset-drop-zone");
    dropZone.on("dragover", (ev) => {
      ev.preventDefault();
      ev.currentTarget.classList.add("drag-over");
    });
    dropZone.on("dragleave", (ev) => {
      ev.currentTarget.classList.remove("drag-over");
    });
  }

  async _onDrop(event) {
    const data = TextEditor.getDragData(event);
    if (data?.type !== "Item") return super._onDrop(event);

    const droppedItem = await Item.implementation.fromDropData(data);
    if (droppedItem.type !== "powerSet") return super._onDrop(event);
    if (this.item.type !== "power") return;

    const powerSets = [...this.item.system.powerSets];
    if (powerSets.some(ps => ps.name === droppedItem.name)) return;

    powerSets.push({
      id: droppedItem.id,
      name: droppedItem.name,
      img: droppedItem.img
    });
    const powerSet = powerSets.map(ps => ps.name).join(", ");
    await this.item.update({ "system.powerSets": powerSets, "system.powerSet": powerSet });
  }
}

/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
const preloadHandlebarsTemplates = async () =>
  loadTemplates([
    // Actor partials.
    "systems/marvel-multiverse/templates/actor/parts/actor-biography.hbs",
    "systems/marvel-multiverse/templates/actor/parts/actor-details.hbs",
    "systems/marvel-multiverse/templates/actor/parts/actor-effects.hbs",
    "systems/marvel-multiverse/templates/actor/parts/actor-items.hbs",
    "systems/marvel-multiverse/templates/actor/parts/actor-occupation.hbs",
    "systems/marvel-multiverse/templates/actor/parts/actor-origin.hbs",
    "systems/marvel-multiverse/templates/actor/parts/actor-powers.hbs",
    "systems/marvel-multiverse/templates/actor/parts/actor-tags.hbs",
    "systems/marvel-multiverse/templates/actor/parts/actor-traits.hbs",
    "systems/marvel-multiverse/templates/actor/parts/actor-weapons.hbs",
    // Item partials
    "systems/marvel-multiverse/templates/item/parts/item-effects.hbs",
    "systems/marvel-multiverse/templates/item/parts/item-source.hbs",
  ]);

class MarvelMultiverseActorBase extends foundry.abstract
  .TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = {};

    schema.attributes = new fields.SchemaField({
      init: new fields.SchemaField({
        value: new fields.NumberField({
          ...requiredInteger,
          initial: 0,
          min: 0,
        }),
        edge: new fields.BooleanField({ required: true, initial: false }),
        trouble: new fields.BooleanField({ required: true, initial: false }),
      }),

      rank: new fields.SchemaField({
        value: new fields.NumberField({ ...requiredInteger, initial: 1 }),
      }),
    });

    // Iterate over ability names and create a new SchemaField for each.
    schema.abilities = new fields.SchemaField(
      Object.keys(CONFIG.MARVEL_MULTIVERSE.abilities).reduce((obj, ability) => {
        obj[ability] = new fields.SchemaField({
          value: new fields.NumberField({
            required: true,
            nullable: false,
            initial: 0,
            min: -3,
          }),
          defense: new fields.NumberField({
            required: true,
            nullable: false,
            initial: 0,
          }),
          noncom: new fields.NumberField({
            required: true,
            nullable: false,
            initial: 0,
            min: 0,
          }),
          edge: new fields.BooleanField({ required: true, initial: false }),
          damageMultiplier: new fields.NumberField({
            ...requiredInteger,
            initial: 0,
            min: 0,
          }),
          label: new fields.StringField({ required: true, blank: true }),
        });
        return obj;
      }, {})
    );

    schema.health = new fields.SchemaField({
      value: new fields.NumberField({
        required: true,
        nullable: false,
        initial: 0,
        min: -300,
      }),
      max: new fields.NumberField({
        required: true,
        nullable: false,
        initial: 0,
      }),
      bonus: new fields.NumberField({
        required: true,
        nullable: false,
        integer: true,
        initial: 0,
      }),
    });

    schema.healthDamageReduction = new fields.NumberField({
      ...requiredInteger,
      initial: 0,
    });
    schema.focus = new fields.SchemaField({
      value: new fields.NumberField({
        required: true,
        nullable: false,
        initial: 0,
        min: -300,
      }),
      max: new fields.NumberField({
        required: true,
        nullable: false,
        initial: 0,
      }),
      bonus: new fields.NumberField({
        required: true,
        nullable: false,
        integer: true,
        initial: 0,
      }),
    });

    schema.focusDamageReduction = new fields.NumberField({
      ...requiredInteger,
      initial: 0,
    });

    schema.karma = new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      max: new fields.NumberField({ ...requiredInteger, initial: 0 }),
    });

    schema.codename = new fields.StringField({ required: true, blank: true }); // equivalent to passing ({initial: ""}) for StringFields
    schema.realname = new fields.StringField({ required: true, blank: true }); // equivalent to passing ({initial: ""}) for StringFields
    schema.height = new fields.StringField({ required: true, blank: true }); // equivalent to passing ({initial: ""}) for StringFields
    schema.weight = new fields.StringField({ required: true, blank: true }); // equivalent to passing ({initial: ""}) for StringFields
    schema.gender = new fields.StringField({ required: true, blank: true }); // equivalent to passing ({initial: ""}) for StringFields
    schema.eyes = new fields.StringField({ required: true, blank: true }); // equivalent to passing ({initial: ""}) for StringFields
    schema.hair = new fields.StringField({ required: true, blank: true }); // equivalent to passing ({initial: ""}) for StringFields
    schema.size = new fields.StringField({
      required: true,
      initial: "average",
    });
    schema.distinguishingFeatures = new fields.StringField({
      required: true,
      blank: true,
    }); // equivalent to passing ({initial: ""}) for StringFields
    schema.teams = new fields.StringField({ required: true, blank: true }); // equivalent to passing ({initial: ""}) for StringFields
    schema.history = new fields.StringField({ required: true, blank: true }); // equivalent to passing ({initial: ""}) for StringFields
    schema.personality = new fields.StringField({
      required: true,
      blank: true,
    }); // equivalent to passing ({initial: ""}) for StringFields

    schema.source = new fields.StringField({ required: true, blank: true });

    schema.actorSizes = new fields.SchemaField(
      Object.keys(CONFIG.MARVEL_MULTIVERSE.sizes).reduce((obj, size) => {
        obj[size] = new fields.SchemaField({
          label: new fields.StringField({
            required: true,
            initial: CONFIG.MARVEL_MULTIVERSE.sizes[size].label,
          }),
        });
        return obj;
      }, {})
    );

    schema.movement = new fields.SchemaField(
      Object.keys(CONFIG.MARVEL_MULTIVERSE.movementTypes).reduce(
        (obj, movement) => {
          obj[movement] = new fields.SchemaField({
            label: new fields.StringField({
              required: true,
              initial: CONFIG.MARVEL_MULTIVERSE.movementTypes[movement].label,
            }),
            value: new fields.NumberField({
              ...requiredInteger,
              initial: 5,
              min: 0,
            }),
            noncom: new fields.NumberField({
              ...requiredInteger,
              initial: 5,
              min: 0,
            }),
            active: new fields.BooleanField({
              required: true,
              initial: CONFIG.MARVEL_MULTIVERSE.movementTypes[movement].active,
            }),
            rankMode: new fields.StringField({ required: true, blank: true }),
            calc: new fields.StringField({ blank: true }),
          });
          return obj;
        },
        {}
      )
    );

    schema.base = new fields.StringField({ required: true, blank: true });
    schema.occupations = new fields.ArrayField(new fields.ObjectField());
    schema.weapons = new fields.ArrayField(new fields.ObjectField());
    schema.origins = new fields.ArrayField(new fields.ObjectField());
    schema.gear = new fields.ArrayField(new fields.ObjectField());
    schema.tags = new fields.ArrayField(new fields.ObjectField());
    schema.traits = new fields.ArrayField(new fields.ObjectField());
    schema.powers = new fields.SchemaField(
      Object.keys(CONFIG.MARVEL_MULTIVERSE.powersets).reduce(
        (obj, powerset) => {
          obj[powerset] = new fields.ArrayField(new fields.ObjectField());
          return obj;
        },
        {}
      )
    );
    schema.reach = new fields.NumberField({
      ...requiredInteger,
      initial: 1,
      min: 0,
    });
    schema.defaultElement = new fields.StringField({
      required: true,
      blank: true,
    });
    schema.defaultWeaponType = new fields.StringField({
      required: true,
      blank: true,
    });

    return schema;
  }

  prepareDerivedData() {
    // Loop through ability scores, and add their modifiers to our sheet output.
    for (const key in this.abilities) {
      // Caclulate the defense score using mmrpg rules.
      this.abilities[key].defense += this.abilities[key].value + 10;
      // Damage Multiplier rank to apply effect changes.
      this.abilities[key].damageMultiplier += this.attributes.rank.value;
      // Non-combat checks base to apply effect changes.
      this.abilities[key].noncom += this.abilities[key].value;
      // Handle ability label localization.
      this.abilities[key].label =
        game.i18n.localize(CONFIG.MARVEL_MULTIVERSE.abilities[key]) ?? key;
    }

    this.health.max = Math.max(10, (this.abilities.res.value * 30) + this.health.bonus);
    this.focus.max = (this.abilities.vig.value * 30) + this.focus.bonus;

    this.movement.climb.value = Math.ceil(this.movement.run.value * 0.5);
    this.movement.jump.value = Math.ceil(this.movement.run.value * 0.5);
    this.movement.swim.value = Math.ceil(this.movement.run.value * 0.5);

    this.attributes.init.value += this.abilities.vig.value;

    for (const key in this.movement) {
      this.movement[key].label =
        game.i18n.localize(CONFIG.MARVEL_MULTIVERSE.movementTypes[key].label) ??
        key;
      switch (this.movement[key].calc) {
        case "half": {
          this.movement[key].value = Math.ceil(this.movement[key].value * 0.5);
          break;
        }
        case "double": {
          this.movement[key].value *= 2;
          break;
        }
        case "triple":
          this.movement[key].value *= 3;
          break;
        case "runspeed":
          this.movement[key].value = this.movement.run.value;
          break;
        case "runspeed-rank":
          this.movement[key].value = this.movement.run.value * this.attributes.rank.value;
          break;
        case "rank": {
          const val =
            this.movement[key].value === 0 ? 1 : this.movement[key].value;
          this.movement[key].value = val * this.attributes.rank.value;
          break;
        }
      }
    }
  }
}

class MarvelMultiverseCharacter extends MarvelMultiverseActorBase {
  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = MarvelMultiverseActorBase.defineSchema();

    schema.teamManeuver = new fields.SchemaField({
      maneuverType: new fields.StringField({ required: true, blank: true }),
      level: new fields.NumberField({ min: 1, max: 3, integer: true }),
    });

    return schema;
  }
}

class MarvelMultiverseNPC extends MarvelMultiverseActorBase {
  prepareDerivedData() {
    // Loop through ability scores, and add their modifiers to our sheet output.
    for (const key in this.abilities) {
      // Caclulate the defense score using mmrpg rules.
      this.abilities[key].defense += this.abilities[key].value + 10;
      // Damage Multiplier rank to apply effect changes.
      this.abilities[key].damageMultiplier += this.attributes.rank.value;
      // Non-combat checks base to apply effect changes.
      this.abilities[key].noncom += this.abilities[key].value;
      // Handle ability label localization.
      this.abilities[key].label =
        game.i18n.localize(CONFIG.MARVEL_MULTIVERSE.abilities[key]) ?? key;
    }

    this.health.max = Math.max(10, (this.abilities.res.value * 30) + this.health.bonus);
    this.focus.max = (this.abilities.vig.value * 30) + this.focus.bonus;

    this.movement.climb.value = Math.ceil(this.movement.run.value * 0.5);
    this.movement.jump.value = Math.ceil(this.movement.run.value * 0.5);
    this.movement.swim.value = Math.ceil(this.movement.run.value * 0.5);

    this.attributes.init.value += this.abilities.vig.value;

    for (const key in this.movement) {
      this.movement[key].label =
        game.i18n.localize(CONFIG.MARVEL_MULTIVERSE.movementTypes[key].label) ??
        key;
      switch (this.movement[key].calc) {
        case "half": {
          this.movement[key].value = Math.ceil(this.movement[key].value * 0.5);
          break;
        }
        case "double": {
          this.movement[key].value *= 2;
          break;
        }
        case "triple":
          this.movement[key].value *= 3;
          break;
        case "runspeed":
          this.movement[key].value = this.movement.run.value;
          break;
        case "runspeed-rank":
          this.movement[key].value = this.movement.run.value * this.attributes.rank.value;
          break;
        case "rank": {
          const val =
            this.movement[key].value === 0 ? 1 : this.movement[key].value;
          this.movement[key].value = val * this.attributes.rank.value;
          break;
        }
      }
    }
  }
}

class MarvelMultiverseItemBase extends foundry.abstract.TypeDataModel {

  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = {};

    schema.description = new fields.StringField({ required: true, blank: true });
    schema.source = new fields.StringField({ required: true, blank: true });


    schema.size = new fields.StringField({ blank: true });
    schema.quantity = new fields.NumberField({ ...requiredInteger, initial: 1, min: 1 });
    
    schema.ability = new fields.StringField({required: true, blank: true});
    schema.attack = new fields.BooleanField({ required: true, initial: false });
    schema.formula = new fields.StringField({required: true,  initial: "{1d6,1dm,1d6}" });
    
    return schema;
  }
}

class MarvelMultiverseItem extends MarvelMultiverseItemBase {
  static defineSchema() {
    const fields = foundry.data.fields;

    const schema = MarvelMultiverseItemBase.defineSchema();

    schema.weight = new fields.NumberField({
      required: true,
      nullable: false,
      initial: 0,
      min: 0,
    });

    return schema;
  }
}

class MarvelMultiverseWeapon extends MarvelMultiverseItemBase {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = MarvelMultiverseItemBase.defineSchema();

    schema.kind = new fields.StringField({ required: true, initial: "close" });
    schema.range = new fields.StringField({ required: true, initial: "Reach" });
    schema.damageMultiplierBonus = new fields.StringField({
      required: true,
      initial: "0",
    });
    schema.rule = new fields.StringField({ blank: true });
    schema.recommendedRank = new fields.StringField({ blank: true });
    schema.category = new fields.StringField({ blank: true });
    schema.reach = new fields.StringField({ blank: true });
    schema.history = new fields.StringField({ blank: true });
    schema.commentary = new fields.StringField({ blank: true });

    schema.equipped = new fields.BooleanField({
      required: true,
      initial: false,
    });
    schema.attackTarget = new fields.StringField({
      required: true,
      initial: "mle",
    });
    schema.attackRange = new fields.NumberField({
      ...requiredInteger,
      initial: 0,
      min: 0,
    });
    schema.attackKind = new fields.StringField({
      required: true,
      initial: "close",
    });
    schema.damageType = new fields.StringField({
      required: true,
      initial: "health",
    });
    schema.attackEdgeMode = new fields.StringField({ blank: true });
    schema.attackMultiplier = new fields.NumberField({
      ...requiredInteger,
      initial: 0,
      min: 0,
    });
    return schema;
  }
}

class MarvelMultiverseOccupation extends MarvelMultiverseItemBase {
  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = MarvelMultiverseItemBase.defineSchema();

    schema.examples = new fields.StringField({ required: true, blank: true });

    schema.tags = new fields.ArrayField(new fields.ObjectField());
    schema.traits = new fields.ArrayField(new fields.ObjectField());

    return schema;
  }
}

class MarvelMultiverseOrigin extends MarvelMultiverseItemBase {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = MarvelMultiverseItemBase.defineSchema();

    schema.examples = new fields.StringField({ required: true, blank: true });
    schema.suggestedOccupation = new fields.StringField({
      required: true,
      blank: true,
    });
    schema.suggestedTags = new fields.ArrayField(new fields.ObjectField());
    (schema.minimumRank = new fields.NumberField({
      ...requiredInteger,
      initial: 0,
      min: 0,
    })),
      (schema.tags = new fields.ArrayField(new fields.ObjectField()));
    schema.traits = new fields.ArrayField(new fields.ObjectField());
    schema.powers = new fields.ArrayField(new fields.ObjectField());
    schema.limitation = new fields.StringField({ required: true, blank: true });

    return schema;
  }
}

class MarvelMultiverseTag extends MarvelMultiverseItemBase {
  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = MarvelMultiverseItemBase.defineSchema();

    schema.restriction = new fields.StringField({
      required: true,
      blank: true,
    });
    schema.rarity = new fields.StringField({ required: true, blank: true });
    schema.detail = new fields.StringField({ required: true, blank: true });
    schema.multiple = new fields.BooleanField({
      required: true,
      initial: false,
    });

    return schema;
  }
}

class MarvelMultiverseTrait extends MarvelMultiverseItemBase {
    static defineSchema() {
        const fields = foundry.data.fields;
        const schema = super.defineSchema();

        schema.restriction = new fields.StringField({ required: true, blank: true });
        schema.detail = new fields.StringField({ required: true, blank: true });
        schema.multiple = new fields.BooleanField({ required: true, initial: false });

        return schema;
    }
}

class MarvelMultiversePowerSet extends MarvelMultiverseItemBase {
  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = super.defineSchema();
    return schema;
  }
}

class MarvelMultiversePower extends MarvelMultiverseItemBase {
  static defineSchema() {
    const fields = foundry.data.fields;
    // biome-ignore lint/complexity/noThisInStatic: <explanation>
    const schema = super.defineSchema();
    const requiredInteger = { required: true, nullable: false, integer: true };

    schema.detail = new fields.StringField({ required: true, blank: true });
    schema.powerSet = new fields.StringField({
      required: true,
      initial: "Basic",
    });
    schema.powerSets = new fields.ArrayField(new fields.ObjectField());
    schema.prerequisites = new fields.StringField({ blank: true });
    schema.action = new fields.StringField({ blank: true });
    schema.trigger = new fields.StringField({ blank: true });
    schema.duration = new fields.StringField({ blank: true });
    schema.range = new fields.StringField({ blank: true });
    schema.cost = new fields.StringField({ blank: true });
    schema.effect = new fields.StringField({ blank: true });
    schema.modifiers = new fields.ArrayField(new fields.ObjectField());
    schema.numbered = new fields.NumberField({
      ...requiredInteger,
      initial: 0,
      min: 0,
    });
    schema.attackTarget = new fields.StringField({ blank: true });
    schema.attackRange = new fields.NumberField({
      ...requiredInteger,
      initial: 0,
      min: 0,
    });
    schema.attackKind = new fields.StringField({ blank: true });
    schema.damageType = new fields.StringField({ blank: true });
    schema.attackEdgeMode = new fields.StringField({ blank: true });
    schema.attackMultiplier = new fields.NumberField({
      ...requiredInteger,
      initial: 0,
      min: 0,
    });
    (schema.isElemental = new fields.BooleanField({
      required: true,
      initial: false,
    })),
      (schema.element = new fields.StringField({ blank: true }));

    return schema;
  }

  static migrateData(source) {
    // Migrate attackAbility to ability.
    if (source.attackAbility) {
      source.ability = source.attackAbility;
      source.attackAbility = undefined;
    }
    // Migrate powerSet string to powerSets array if needed.
    if (source.powerSet && (!source.powerSets || source.powerSets.length === 0)) {
      source.powerSets = source.powerSet.split(",").map(ps => ({
        name: ps.trim(),
        id: null,
        img: null
      }));
    }
    return super.migrateData(source);
  }
}

// Export Actors

var models = /*#__PURE__*/Object.freeze({
  __proto__: null,
  MarvelMultiverseActorBase: MarvelMultiverseActorBase,
  MarvelMultiverseCharacter: MarvelMultiverseCharacter,
  MarvelMultiverseItem: MarvelMultiverseItem,
  MarvelMultiverseItemBase: MarvelMultiverseItemBase,
  MarvelMultiverseNPC: MarvelMultiverseNPC,
  MarvelMultiverseOccupation: MarvelMultiverseOccupation,
  MarvelMultiverseOrigin: MarvelMultiverseOrigin,
  MarvelMultiversePower: MarvelMultiversePower,
  MarvelMultiversePowerSet: MarvelMultiversePowerSet,
  MarvelMultiverseTag: MarvelMultiverseTag,
  MarvelMultiverseTrait: MarvelMultiverseTrait,
  MarvelMultiverseWeapon: MarvelMultiverseWeapon
});

/**
 * Establish each MMRPG dice type here as extensions of DiceTerm.
 * @extends {foundry.dice.terms.Die}
 */
class MarvelDie extends foundry.dice.terms.Die {
  static DENOMINATION = "m";

  constructor(termData) {
    super({ ...termData, faces: 6 });
  }

  /**
   * CSS classes to apply based on the result of the die.
   * @param {DiceTermResult} result
   */
  getResultCSS(result) {
    const resultStyles = ["marvel-roll", "die", "d6"];

    if (result.result === 1) {
      resultStyles.push("fantastic");
    } else if (result.result === 6) {
      resultStyles.push("max");
    }

    if (result.discarded) {
      resultStyles.push("discarded");
    }
    return resultStyles;
  }

  /**
   * Returns an 'M' in place of a roll of 1.
   *
   * @param {DiceTermResult} result
   * @returns {string}
   */
  getResultLabel(result) {
    if (result.result === 1) {
      return "m";
    }

    return result.result.toString();
  }

  /**
   * Override default roll behavior for this die to make an 'm' result (1) count as a value of 6.
   */
  roll({ minimize = false, maximize = false } = {}) {
    const roll = super.roll({ minimize, maximize });

    if (roll.result === 1) {
      this.results[this.results.length - 1].count = 6;
    }

    return roll;
  }

  get total() {
    const total = super.total;
    return total === 1 ? 6 : total;
  }
}

var dice = /*#__PURE__*/Object.freeze({
  __proto__: null,
  MarvelDie: MarvelDie,
  MarvelMultiverseRoll: MarvelMultiverseRoll
});

// Import document classes.

globalThis.MarvelMultiverse = {
  MarvelMultiverseActor,
  MarvelMultiverseItem: MarvelMultiverseItem$1,
  rollItemMacro,
  config: MARVEL_MULTIVERSE,
  dice,
  models,
  MarvelMultiverseCharacterSheet,
  MarvelMultiverseNPCSheet,
  MarvelMultiverseItemSheet,
  ChatMessageMarvel,
};

/* -------------------------------------------- */
/*  Init Hook                                   */
/* -------------------------------------------- */

Handlebars.registerHelper('numberSign', (value) => {
  const n = Number(value);
  return n >= 0 ? `+${n}` : `${n}`;
});

Hooks.once("init", () => {
  // Add utility classes to the global game object so that they're more easily
  // accessible in global contexts.
  globalThis.MarvelMultiverse = game.MarvelMultiverse = Object.assign(
    game.system,
    globalThis.MarvelMultiverse
  );

  console.log(
    `Marvel Multiverse RPG 1e | Initializing the Marvel Multiverse Role Playing Game System - Version  ${MarvelMultiverse.version}\n${MARVEL_MULTIVERSE.ASCII}`
  );

  // Record Configuration Values
  CONFIG.MARVEL_MULTIVERSE = MARVEL_MULTIVERSE;

  /**
   * Set an initiative formula for the system
   * @type {String}
   */
  CONFIG.Combat.initiative = {
    formula: "{1d6,1dm,1d6} + @attributes.init.value",
    decimals: 2,
  };

  // Define custom Document and DataModel classes
  CONFIG.Actor.documentClass = MarvelMultiverseActor;

  // Note that you don't need to declare a DataModel
  // for the base actor/item classes - they are included
  // with the Character/NPC as part of super.defineSchema()
  CONFIG.Actor.dataModels = {
    character: MarvelMultiverseCharacter,
    npc: MarvelMultiverseNPC,
  };
  CONFIG.ChatMessage.documentClass = ChatMessageMarvel;
  CONFIG.Item.documentClass = MarvelMultiverseItem$1;
  CONFIG.Item.dataModels = {
    item: MarvelMultiverseItem,
    weapon: MarvelMultiverseWeapon,
    trait: MarvelMultiverseTrait,
    origin: MarvelMultiverseOrigin,
    occupation: MarvelMultiverseOccupation,
    tag: MarvelMultiverseTag,
    power: MarvelMultiversePower,
    powerSet: MarvelMultiversePowerSet,
  };

  game.settings.register("marvel-multiverse", "autoPopulateOrigin", {
    name: "Auto-Populate Origin Items",
    hint: "When adding an Origin or Occupation to a character, automatically create its associated powers, traits, and tags.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  // Active Effects are never copied to the Actor,
  // but will still apply to the Actor from within the Item
  // if the transfer property on the Active Effect is true.
  CONFIG.ActiveEffect.legacyTransferral = false;

  CONFIG.Dice.MarvelDie = MarvelDie;
  CONFIG.Dice.types.push(MarvelDie);

  Roll.TOOLTIP_TEMPLATE =
    "systems/marvel-multiverse/templates/chat/roll-breakdown.hbs";
  Roll.CHAT_TEMPLATE = "systems/marvel-multiverse/templates/dice/roll.hbs";
  CONFIG.Dice.MarvelMultiverseRoll = MarvelMultiverseRoll;
  // Register Roll Extensions
  CONFIG.Dice.rolls.push(MarvelMultiverseRoll);
  CONFIG.Dice.terms.m = MarvelDie;

  // Add fonts
  _configureFonts();

  // Register sheet application classes
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("marvel-multiverse", MarvelMultiverseCharacterSheet, {
    types: ["character"],
    makeDefault: true,
    label: "MARVEL_MULTIVERSE.SheetLabels.Actor",
  });
  Actors.registerSheet("marvel-multiverse", MarvelMultiverseNPCSheet, {
    types: ["npc"],
    makeDefault: true,
    label: "MARVEL_MULTIVERSE.SheetLabels.NPC",
  });
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("marvel-multiverse", MarvelMultiverseItemSheet, {
    makeDefault: true,
    label: "MARVEL_MULTIVERSE.SheetLabels.Item",
  });

  // Preload Handlebars templates.
  return preloadHandlebarsTemplates();
});

/* -------------------------------------------- */
/*  Handlebars Helpers                          */
/* -------------------------------------------- */

// If you need to add Handlebars helpers, here is a useful example:
Handlebars.registerHelper("toLowerCase", (mle) => mle.toLowerCase());


Hooks.on("renderDialogV2", (app, html) => {
  const el = html instanceof HTMLElement ? html : html[0];
  if (!el) return;
  const select = el.querySelector("select[name='type']");
  if (!select) return;
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.disabled = true;
  placeholder.selected = true;
  placeholder.textContent = "Select One";
  select.prepend(placeholder);
  select.value = "";
  const submitBtn = el.querySelector("button[data-action='ok']") || el.querySelector("button[type='submit']");
  if (submitBtn) submitBtn.disabled = true;
  select.addEventListener("change", () => {
    if (select.value) {
      placeholder.remove();
      if (submitBtn) submitBtn.disabled = false;
    }
  });
});

/* -------------------------------------------- */

/**
 * Configure additional system fonts.
 */
function _configureFonts() {
  Object.assign(CONFIG.fontDefinitions, {
    Roboto: {
      editor: true,
      fonts: [
        {
          urls: ["systems/marvel-multiverse/fonts/roboto/Roboto-Regular.woff2"],
        },
        {
          urls: ["systems/marvel-multiverse/fonts/roboto/Roboto-Bold.woff2"],
          weight: "bold",
        },
        {
          urls: ["systems/marvel-multiverse/fonts/roboto/Roboto-Italic.woff2"],
          style: "italic",
        },
        {
          urls: [
            "systems/marvel-multiverse/fonts/roboto/Roboto-BoldItalic.woff2",
          ],
          weight: "bold",
          style: "italic",
        },
      ],
    },
    "Roboto Condensed": {
      editor: true,
      fonts: [
        {
          urls: [
            "systems/marvel-multiverse/fonts/roboto-condensed/RobotoCondensed-Regular.woff2",
          ],
        },
        {
          urls: [
            "systems/marvel-multiverse/fonts/roboto-condensed/RobotoCondensed-Bold.woff2",
          ],
          weight: "bold",
        },
        {
          urls: [
            "systems/marvel-multiverse/fonts/roboto-condensed/RobotoCondensed-Italic.woff2",
          ],
          style: "italic",
        },
        {
          urls: [
            "systems/marvel-multiverse/fonts/roboto-condensed/RobotoCondensed-BoldItalic.woff2",
          ],
          weight: "bold",
          style: "italic",
        },
      ],
    },
    "Roboto Slab": {
      editor: true,
      fonts: [
        {
          urls: [
            "systems/marvel-multiverse/fonts/roboto-slab/RobotoSlab-Regular.ttf",
          ],
        },
        {
          urls: [
            "systems/marvel-multiverse/fonts/roboto-slab/RobotoSlab-Bold.ttf",
          ],
          weight: "bold",
        },
      ],
    },
  });
}

/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */

Hooks.once("ready", () => {
  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
  Hooks.on("hotbarDrop", (bar, data, slot) => createItemMacro(data, slot));
});
/* -------------------------------------------- */
/*  Render Settings Hook                                  */
/* -------------------------------------------- */

Hooks.on("renderSettings", (app, html) => {
  const heading = document.createElement("div");
  heading.classList.add("mmrpg", "sidebar-heading");
  heading.innerHTML = `
    <h2 class='mmrpg-game-title'>${game.system.title}
      <ul class="links mmrpg-ul">
        <li>
          <a href="https://github.com/mjording/marvel-multiverse/releases/latest" target="_blank">
            Marvel Multiverse RPG
          </a>
        </li>
        <li>
          <a href="https://github.com/mjording/marvel-multiverse/issues" target="_blank">${game.i18n.localize(
            "MARVEL_MULTIVERSE.Issues"
          )}</a>
        </li>
        <li>
          <a href="https://github.com/mjording/marvel-multiverse/wiki" target="_blank">${game.i18n.localize(
            "MARVEL_MULTIVERSE.Wiki"
          )}</a>
        </li>
      </ul>
    </h2>
  `;
  const badge = document.createElement("div");
  badge.classList.add("mmrpg", "system-badge");
  badge.innerHTML = `
    <img src="systems/marvel-multiverse/ui/official/mmrpg-badge-32.webp" data-tooltip="${game.system.title}" alt="${game.system.title}">
    <span class="system-info">${game.system.version}</span>
  `;
  if (game.release.generation < 13) {
    const details = html[0].querySelector("#game-details");
    const pip = details.querySelector(".system-info .update");
    // details.querySelector(".system").remove();
    if (pip)
      badge
        .querySelector(".system-info")
        .insertAdjacentElement("beforeend", pip);
    heading.insertAdjacentElement("afterend", badge);
    details.insertAdjacentElement("afterend", heading);
  } else {
    const infoSection = html.querySelector("section.info");
    infoSection.insertAdjacentElement("beforeend", heading);
  }
});

Hooks.on("renderChatLog", (app, html, data) => {
  ChatMessageMarvel.onRenderChatLog(html);
});

Hooks.once("diceSoNiceReady", (dice3d) => {
  // Register the custom die face for the Marvel Die
  dice3d.addDicePreset({
    type: "dm",
    labels: ["m", "2", "3", "4", "5", "6"],
    colorset: "red",
    system: "standard",
  });
  dice3d.addDicePreset({
    type: "d6",
    labels: ["1", "2", "3", "4", "5", "6"],
    colorset: "white",
    system: "standard",
  });
});
/* -------------------------------------------- */
/*  Hotbar Macros                               */
/* -------------------------------------------- */

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
async function createItemMacro(data, slot) {
  // First, determine if this is a valid owned item.
  if (data.type !== "Item" || data.type !== "Weapon") return;
  if (!data.uuid.includes("Actor.") && !data.uuid.includes("Token.")) {
    return ui.notifications.warn(
      "You can only create macro buttons for owned Items"
    );
  }
  // If it is, retrieve it based on the uuid.
  const item = await Item.fromDropData(data);

  // Create the macro command using the uuid.
  const command = `game.MarvelMultiverse.rollItemMacro("${data.uuid}");`;
  let macro = game.macros.find(
    (m) => m.name === item.name && m.command === command
  );
  if (!macro) {
    macro = await Macro.create({
      name: item.name,
      type: "script",
      img: item.img,
      command: command,
      flags: { "marvel-multiverse.itemMacro": true },
    });
  }
  game.user.assignHotbarMacro(macro, slot);
  return false;
}

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {string} itemUuid
 */
function rollItemMacro(itemUuid) {
  // Reconstruct the drop data so that we can load the item.
  const dropData = {
    type: "Item",
    uuid: itemUuid,
  };
  // Load the item from the uuid.
  Item.fromDropData(dropData).then((item) => {
    // Determine if the item loaded and if it's an owned item.
    if (!item || !item.parent) {
      const itemName = item?.name ?? itemUuid;
      return ui.notifications.warn(
        `Could not find item ${itemName}. You may need to delete and recreate this macro.`
      );
    }

    // Trigger the item roll
    item.roll();
  });
}

export { ChatMessageMarvel, MARVEL_MULTIVERSE, MarvelMultiverseActor, MarvelMultiverseCharacterSheet, MarvelMultiverseItem$1 as MarvelMultiverseItem, MarvelMultiverseItemSheet, MarvelMultiverseNPCSheet, dice, models, rollItemMacro };
//# sourceMappingURL=marvel-multiverse-compiled.mjs.map
