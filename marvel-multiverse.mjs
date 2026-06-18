function _getAttackTargets(attackTargetAbility) {
  const targets = game.user.targets;
  if (!targets?.size || !attackTargetAbility) return [];
  return Array.from(targets).map(token => {
    const actor = token.actor;
    const ac = actor?.system?.abilities?.[attackTargetAbility]?.defense ?? null;
    return {
      name: token.name,
      img: token.document?.texture?.src ?? actor?.img ?? "",
      ac,
      uuid: actor?.uuid ?? ""
    };
  }).filter(t => t.ac !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function _toTitleCase(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function _getTokenImg(actor) {
  const activeToken = actor?.getActiveTokens?.()?.[0];
  if (activeToken?.document?.texture?.src) return activeToken.document.texture.src;
  const protoSrc = actor?.prototypeToken?.texture?.src;
  if (protoSrc && !protoSrc.includes("*")) return protoSrc;
  return actor?.img || "";
}

function _buildRollFlavor({ tokenImg, actorName, powerName, ability, damageType, element }) {
  let detailHtml = "";
  if (powerName) detailHtml += `<div><b>Power:</b> ${powerName}</div>`;
  const cols = [];
  if (ability) cols.push(`<b>Ability:</b> ${_toTitleCase(ability)}`);
  if (damageType) cols.push(`<b>Type:</b> ${_toTitleCase(damageType)}`);
  if (element) cols.push(`<b>Element:</b> ${_toTitleCase(element)}`);
  if (cols.length >= 3) {
    detailHtml += `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;">${cols.map(c => `<span>${c}</span>`).join("")}</div>`;
  } else {
    detailHtml += cols.map(c => `<div>${c}</div>`).join("");
  }
  const tags = `<span style="display:none;">ability: ${ability || ""}${damageType ? " damagetype: " + damageType : ""}${element ? " element: " + element : ""}</span>`;
  const tokenData = tokenImg ? ` data-token-img="${tokenImg}"` : "";
  return `<div class="mm-roll-flavor"${tokenData}><div style="padding:4px 0;font-size:12px;">${detailHtml}</div>${tags}</div>`;
}


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

    data.rank = this.system.attributes?.rank?.value ?? null;

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
  item: "icons/svg/item-bag.svg",
  weapon: "systems/marvel-multiverse/icons/weapons.svg",
  vehicleWeapon: "systems/marvel-multiverse/icons/weapons.svg",
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
    const tokenImg = _getTokenImg(this.actor);
    const elementKey = this.system.isElemental ? this.system.element : null;
    const label = _buildRollFlavor({
      tokenImg,
      actorName: this.actor?.name,
      powerName: this.name,
      ability: abilityName ?? this.system.ability,
      damageType: this.system.damageType,
      element: elementKey,
    });

    ChatMessage.create({
      speaker: speaker,
      rollMode: rollMode,
      flavor: label,
      content: `<div style="padding:4px 8px;" class="mm-chat-description">${this.system.description}</div>${
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

      const messageData = {
        title: this.name,
        speaker: speaker,
        rollMode: rollMode,
        flavor: label,
      };
      const attackTargets = _getAttackTargets(this.system.attackTarget || this.system.ability);
      if (attackTargets.length) {
        messageData["flags.marvel-multiverse.targets"] = attackTargets;
      }
      roll.toMessage(messageData, { rollMode: rollMode, itemId: this._id });

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

MARVEL_MULTIVERSE.vehicleSizes = {
  average: { label: "Average" },
  big: { label: "Big" },
  huge: { label: "Huge" },
  gigantic: { label: "Gigantic" },
  gargantuan: { label: "Gargantuan" },
};

MARVEL_MULTIVERSE.vehicleOccupantRoles = {
  passenger: { label: "Passenger" },
  gunner: { label: "Gunner" },
  pilot: { label: "Pilot" },
};

MARVEL_MULTIVERSE.vehicleSpeedLabels = {
  run: { label: "MARVEL_MULTIVERSE.Vehicle.GroundSpeed" },
  flight: { label: "MARVEL_MULTIVERSE.Vehicle.FlightSpeed" },
  climb: { label: "MARVEL_MULTIVERSE.Vehicle.ClimbSpeed" },
  swim: { label: "MARVEL_MULTIVERSE.Vehicle.NauticalSpeed" },
};

MARVEL_MULTIVERSE.elements = {
  air: { label: "Air", fantasticEffect: "Target is knocked prone for one round.", statusId: "prone" },
  chemical: { label: "Chemical", fantasticEffect: "The target is corroding.", statusId: "corroding" },
  earth: { label: "Earth", fantasticEffect: "Target moves at half speed for one round.", statusId: "exhaustion" },
  electricity: { label: "Electricity", fantasticEffect: "Stuns target for one round.", statusId: "stunned" },
  energy: { label: "Energy", fantasticEffect: "Blinds target for one round.", statusId: "blinded" },
  fire: { label: "Fire", fantasticEffect: "Sets target ablaze.", statusId: "ablaze" },
  force: { label: "Force", fantasticEffect: "Target has trouble on all actions for one round.", statusId: "encumbered" },
  hellfire: { label: "Hellfire", fantasticEffect: "Splits damage equally between Health and Focus." },
  ice: { label: "Ice", fantasticEffect: "Paralyzes target for one round.", statusId: "paralyzed" },
  iron: { label: "Iron", fantasticEffect: "Pins target for one round.", statusId: "restrained" },
  sound: { label: "Sound", fantasticEffect: "Deafens target for one round.", statusId: "deafened" },
  swarm: { label: "Swarm", fantasticEffect: "The target is frightened.", statusId: "frightened" },
  toxin: { label: "Toxin", fantasticEffect: "The target is poisoned.", statusId: "poisoned" },
  water: { label: "Water", fantasticEffect: "Surprises target until the end of the next round.", statusId: "surprised" },
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

MARVEL_MULTIVERSE.conditionEffects = {
  corroding: {
    name: "Corroding",
    disabled: false,
    changes: [],
    description:
      "Character loses 5 Health at end of each of their turns. Ends on death or removal of corrosive chemical. Washed off with copious water.",
    transfer: true,
    statuses: ["corroding"],
    flags: {},
  },
  poisoned: {
    name: "Poisoned",
    disabled: false,
    changes: [],
    description:
      "Resilience vs. TN 18 action check at start of each turn (no action cost). Fail: lose 1 Health. Success: fine that turn. Fantastic success: poison cleared. Most poisons have antidotes. Auto-clears after 24 hours if not fatal.",
    transfer: true,
    statuses: ["poisoned"],
    flags: {},
  },
  infected: {
    name: "Infected",
    disabled: false,
    changes: [],
    description:
      "Airborne: target within 3 spaces, breathing. Contact: close attack doing at least 1 damage. Resilience check vs. infection TN (default TN 12). Fantastic success: immunity for 1 full day. Effects and duration vary by disease.",
    transfer: true,
    statuses: ["infected"],
    flags: {},
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
      const damageBtn = html.querySelector("button.damage");
      const flavorContent = flavorText?.innerHTML ?? "";
      const hasDamageAbility = /Melee|Agility|Ego|Logic/i.test(flavorContent);
      if (isInitiative || !hasDamageAbility) {
        damageBtn?.remove();
      } else {
        damageBtn?.addEventListener("click", this._onClickDamageButton.bind(this));
      }

      this._enrichAttackTargets(html);
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
      !(attackRoll instanceof CONFIG.Dice.MarvelMultiverseRoll) ||
      !targets?.length
    )
      return;
    const evaluation = document.createElement("ul");
    evaluation.style.cssText = "list-style:none;padding:4px 0;margin:4px 0 0;border-top:1px solid #ddd;";
    evaluation.innerHTML = targets
      .map(({ name, img, ac, uuid }) => {
        const isMiss = !attackRoll.isFantastic && attackRoll.total < ac;
        const color = isMiss ? "#a00" : "#0a0";
        const icon = isMiss ? "fa-times" : "fa-check";
        const label = isMiss ? "Miss" : "Hit";
        return [
          `
        <li data-uuid="${uuid}" style="display:flex;align-items:center;gap:6px;padding:3px 6px;cursor:pointer;">
          <img src="${img}" alt="${name}" style="width:24px;height:24px;border:none;border-radius:2px;">
          <span style="flex:1;font-weight:600;">${name}</span>
          <span style="font-size:11px;color:#555;"><i class="fas fa-shield-halved"></i> ${ac}</span>
          <span style="font-weight:700;color:${color};font-size:12px;"><i class="fas ${icon}"></i> ${label}</span>
        </li>
      `,
          isMiss,
          name,
        ];
      })
      .sort((a, b) => (a[1] === b[1] ? a[2].localeCompare(b[2]) : a[1] ? 1 : -1))
      .reduce((str, [li]) => str + li, "");
    for (const target of evaluation.querySelectorAll("li")) {
      target.addEventListener("click", this._onTargetMouseDown.bind(this));
      target.addEventListener("mouseover", this._onTargetHoverIn.bind(this));
      target.addEventListener("mouseout", this._onTargetHoverOut.bind(this));
    }
    html.querySelector(".message-content")?.appendChild(evaluation);
  }

  /* -------------------------------------------- */

  _onTargetMouseDown(event) {
    const uuid = event.currentTarget.dataset.uuid;
    if (uuid) fromUuid(uuid).then(actor => {
      if (actor?.sheet) actor.sheet.render(true);
    });
  }

  _onTargetHoverIn(event) {
    const uuid = event.currentTarget.dataset.uuid;
    if (uuid) fromUuid(uuid).then(actor => {
      const token = canvas.tokens?.placeables.find(t => t.actor?.uuid === uuid);
      if (token?._onHoverIn) token._onHoverIn(event);
    });
  }

  _onTargetHoverOut(event) {
    const uuid = event.currentTarget.dataset.uuid;
    if (uuid) fromUuid(uuid).then(actor => {
      const token = canvas.tokens?.placeables.find(t => t.actor?.uuid === uuid);
      if (token?._onHoverOut) token._onHoverOut(event);
    });
  }

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
      "li.roll.marvel-roll.fantastic:not(.discarded)"
    );

    const messageHeader = eventTarget.closest("li.chat-message");
    const flavorText =
      messageHeader.querySelector("span.flavor-text")?.innerHTML ?? "";

    this._handleDamageChatButton(messageId, flavorText, fantastic);
  }

  /**
   * Handles the damage from the chat log
   * @param {string} messageId
   * @param {string} ability
   * @param {string} fantastic
   */
  async _handleDamageChatButton(messageId, flavorText, fantastic) {
    const re = /(?:\[ability\]|ability:)\s*(?<ability>\w+)/i;
    const dmgTypeRe = /(?:\[damageType\]|damage\s*type:)\s*(?<damageType>\w+)/i;
    const elementRe = /(?:\[element\]|element:)\s*(?<element>\w+)/i;
    const ability = re.exec(flavorText)?.groups?.ability;
    if (!ability) return;
    const damageType = dmgTypeRe.exec(flavorText)?.groups?.damageType;
    const elementMatch = elementRe.exec(flavorText)?.groups?.element;
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

    const targetTokens = (canvas.tokens?.objects?.children ?? []).filter(
      (t) => t.isTargeted
    );

    const abilityValue = actor.system.abilities[abilityAbr].value;

    const targets = targetTokens.map((t) => t.actor);

    const damageContent = targets.map((t) => {
      const damageReduction =
        damageType && damageType === "focus"
          ? t.system.focusDamageReduction
          : t.system.healthDamageReduction;
      const effectiveMultiplier = Math.max(0, damageMultiplier - damageReduction);
      let dmg = marvelDie.total * effectiveMultiplier + abilityValue;
      if (fantastic) {
        dmg = dmg * 2;
      }
      const dmgTypeLabel = damageType ? ` ${damageType}` : "";
      const fantasticLabel = fantastic ? " Fantastic" : "";
      const drLine = damageReduction > 0
        ? `<br/><span style="font-size:11px;color:#555;">Multiplier ${damageMultiplier} − DR ${damageReduction} = ${effectiveMultiplier}</span>`
        : "";
      const multiplierText = damageReduction > 0
        ? `(Multiplier - DR) ${effectiveMultiplier}`
        : `Multiplier ${damageMultiplier}`;
      const fantasticMult = fantastic ? " × 2" : "";
      return `<p style="margin:4px 0;"><b>${t.name}</b> takes <b style="color:#8b0502;">${dmg}${fantasticLabel}${dmgTypeLabel} damage</b></p>
        <p style="font-size:11px;color:#555;margin:2px 0;">((Marvel Die ${marvelDie.total} × ${multiplierText}) + ${ability} ${abilityValue})${fantasticMult}${drLine}</p>`;
    });

    if (damageContent.length === 0) {
      let dmg = marvelDie.total * damageMultiplier + abilityValue;
      if (fantastic) {
        dmg = dmg * 2;
      }
      const dmgTypeLabel = damageType ? ` ${damageType}` : "";
      const fantasticLabel = fantastic ? " Fantastic" : "";
      const fantasticMult = fantastic ? " × 2" : "";
      damageContent.push(
        `<p style="margin:4px 0;">Deals <b style="color:#8b0502;">${dmg}${fantasticLabel}${dmgTypeLabel} damage</b></p>
        <p style="font-size:11px;color:#555;margin:2px 0;">((Marvel Die ${marvelDie.total} × Multiplier ${damageMultiplier}) + ${ability} ${abilityValue})${fantasticMult}</p>`
      );
    }
    // const content = `<p>Delivers <b>${dmg}</b> points re: MarvelDie: ${marvelDie.total} &#42; damage multiplier: &#40; ${actor.system.abilities[abilityAbr].damageMultiplier} - damageReduction: ${damageReduction} &#61; ${damageMultiplier} &#41; + ${ability} score ${abilityValue} of damage.</p>`;

    if (fantastic && elementMatch) {
      const elementConfig = MARVEL_MULTIVERSE.elements[elementMatch];
      if (elementConfig) {
        damageContent.push(
          `<p><b>Fantastic Elemental Effect (${elementConfig.label}):</b> ${elementConfig.fantasticEffect}</p>`
        );
        if (elementConfig.statusId) {
          for (const target of targets) {
            await target.toggleStatusEffect(elementConfig.statusId, { active: true });
            const cdr = target.system.conditionDamageReduction ?? 0;
            if (cdr > 0) {
              damageContent.push(
                `<p style="font-size:11px;color:#555;"><b>${target.name}</b> has Condition DR ${cdr}/turn</p>`
              );
            }
          }
        }
      }
    }

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

    context.mutantReputationEnabled = game.settings.get("marvel-multiverse", "mutantReputationEnabled");
    context.mutantReputationLevels = MARVEL_MULTIVERSE.mutantReputationLevels;
    const charWorldRepKey = game.settings.get("marvel-multiverse", "mutantReputationLevel");
    context.worldReputationLevel = charWorldRepKey;
    context.worldReputationLabel = MARVEL_MULTIVERSE.mutantReputationLevels[charWorldRepKey]?.label ?? "Neutral";

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
    const iconicItems = [];
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
      } else if (i.type === "iconicItem") {
        iconicItems.push(i);
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
      context.iconicItems = iconicItems;
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
      const title = dataset.power ? `[power] ${dataset.power}` : "";
      const tokenImg = _getTokenImg(this.actor);
      const elementKey = item?.system?.isElemental ? item?.system?.element : null;
      const label = _buildRollFlavor({
        tokenImg,
        actorName: this.actor.name,
        powerName: item?.name,
        ability: ability,
        damageType: dataset.damagetype,
        element: elementKey,
      });

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

      let flavor = label;
      if (dataset.abilityKey === "ego" && game.settings.get("marvel-multiverse", "mutantReputationEnabled")) {
        const repOverride = this.actor.system.mutantReputation;
        const repKey = repOverride !== "world" ? repOverride : game.settings.get("marvel-multiverse", "mutantReputationLevel");
        const repConfig = MARVEL_MULTIVERSE.mutantReputationLevels[repKey];
        if (repConfig && repKey !== "neutral") {
          flavor += `<div style="margin-top:4px;padding:2px 6px;background:#5c3d6e;color:#fff;border-radius:3px;font-size:11px;"><b>Mutant Reputation (${repConfig.label}):</b> ${repConfig.effect}</div>`;
        }
      }

      const messageData = {
        speaker: speaker,
        flavor: flavor,
        rollMode: rollMode,
        title: title,
      };
      const attackAbility = item?.system?.attackTarget || dataset.abilityKey;
      const attackTargets = _getAttackTargets(attackAbility);
      if (attackTargets.length) {
        messageData["flags.marvel-multiverse.targets"] = attackTargets;
      }
      roll.toMessage(messageData, { rollMode: rollMode, itemId: itemId });
      return roll;
    }
  }
}

class MarvelMultiverseVehicleSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["marvel-multiverse", "sheet", "actor"],
      width: 720,
      height: 700,
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-body",
          initial: "stats",
        },
      ],
    });
  }

  get template() {
    return "systems/marvel-multiverse/templates/actor/actor-vehicle-sheet.hbs";
  }

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

  getData() {
    const context = super.getData();
    const actorData = context.data;

    context.system = actorData.system;
    context.flags = actorData.flags;

    this._prepareItems(context);

    context.rollData = context.actor.getRollData();
    context.sources = CONFIG.MARVEL_MULTIVERSE.sources;

    context.vehicleSizeSelection = Object.fromEntries(
      Object.keys(CONFIG.MARVEL_MULTIVERSE.vehicleSizes).map((key) => [
        key,
        CONFIG.MARVEL_MULTIVERSE.vehicleSizes[key].label,
      ])
    );

    context.occupantRoles = Object.fromEntries(
      Object.keys(CONFIG.MARVEL_MULTIVERSE.vehicleOccupantRoles).map((key) => [
        key,
        CONFIG.MARVEL_MULTIVERSE.vehicleOccupantRoles[key].label,
      ])
    );

    context.occupants = context.system.occupants;
    context.defense = context.system.defense;

    context.effects = prepareActiveEffectCategories(
      this.actor.allApplicableEffects()
    );

    return context;
  }

  _prepareItems(context) {
    const powers = {};
    const vehicleWeapons = [];

    for (const i of context.items) {
      i.img = i.img || Item.DEFAULT_ICON;

      if (i.type === "power") {
        const firstSet = i.system.powerSets?.length
          ? i.system.powerSets[0].name
          : (i.system.powerSet?.split(",")[0]?.trim() || "Basic");
        if (!powers[firstSet]) powers[firstSet] = [];
        powers[firstSet].push(i);
      } else if (i.type === "vehicleWeapon") {
        vehicleWeapons.push(i);
      }
    }

    for (const set in powers) powers[set].sort((a, b) => a.name.localeCompare(b.name));
    const sortedPowers = {};
    for (const key of Object.keys(powers).sort()) sortedPowers[key] = powers[key];
    context.powers = sortedPowers;
    context.vehicleWeapons = vehicleWeapons;
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.on("click", ".item-edit", (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.sheet.render(true);
    });

    if (!this.isEditable) return;

    html.on("click", ".item-create", this._onItemCreate.bind(this));

    html.on("click", ".item-delete", (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      this.actor.deleteEmbeddedDocuments("Item", [li.data("itemId")]);
      li.slideUp(200, () => this.render(false));
    });

    html.on("click", ".effect-control", (ev) => {
      const row = ev.currentTarget.closest("li");
      const document =
        row.dataset.parentId === this.actor.id
          ? this.actor
          : this.actor.items.get(row.dataset.parentId);
      onManageActiveEffect(ev, document);
    });

    html.on("change", ".occupant-role-select", this._onOccupantRoleChange.bind(this));
    html.on("click", ".occupant-delete", this._onOccupantDelete.bind(this));
  }

  async _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;
    const type = header.dataset.type;
    const data = foundry.utils.duplicate(header.dataset);
    const name = `New ${type.capitalize()}`;
    const img = type === "vehicleWeapon" ? "systems/marvel-multiverse/icons/weapons.svg" : undefined;
    const itemData = { name, type, img, system: data };
    itemData.system.type = undefined;
    return await Item.create(itemData, { parent: this.actor });
  }

  async _onOccupantRoleChange(event) {
    event.preventDefault();
    const index = Number(event.currentTarget.dataset.index);
    const newRole = event.currentTarget.value;
    const occupants = foundry.utils.deepClone(this.actor.system.occupants);

    if (newRole === "pilot") {
      for (const occ of occupants) {
        if (occ.role === "pilot") occ.role = "passenger";
      }
    }

    occupants[index].role = newRole;
    await this.actor.update({ "system.occupants": occupants });
  }

  async _onOccupantDelete(event) {
    event.preventDefault();
    const index = Number(event.currentTarget.dataset.index);
    const occupants = foundry.utils.deepClone(this.actor.system.occupants);
    occupants.splice(index, 1);
    await this.actor.update({ "system.occupants": occupants });
  }

  async _onDropActor(event, data) {
    if (!this.isEditable) return;

    const actor = await Actor.implementation.fromDropData(data);
    if (!actor) return;

    const occupants = foundry.utils.deepClone(this.actor.system.occupants);

    if (occupants.length >= this.actor.system.passengers) {
      ui.notifications.warn(game.i18n.localize("MARVEL_MULTIVERSE.Vehicle.VehicleFull"));
      return;
    }

    if (occupants.some(o => o.actorId === actor.id)) {
      ui.notifications.warn(`${actor.name} is already in this vehicle.`);
      return;
    }

    occupants.push({
      actorId: actor.id,
      name: actor.name,
      img: actor.img,
      role: "passenger",
    });

    await this.actor.update({ "system.occupants": occupants });
  }

  async _onDropItemCreate(itemData) {
    const allowedTypes = ["power", "vehicleWeapon"];
    if (!allowedTypes.includes(itemData.type)) {
      ui.notifications.warn(`Vehicles cannot hold ${itemData.type} items.`);
      return;
    }
    return super._onDropItemCreate(itemData);
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
    const iconicItems = [];
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
      } else if (i.type === "iconicItem") {
        iconicItems.push(i);
      } else if (i.type === "item") {
        gear.push(i);
      } else if (i.type === "weapon") {
        weapons.push(i);
      }

      // Assign and return
      context.gear = gear;
      context.iconicItems = iconicItems;
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
      const npcItemId = element.closest(".item")?.dataset?.itemId;
      const npcItem = npcItemId ? this.actor.items.get(npcItemId) : null;
      const ability =
        CONFIG.MARVEL_MULTIVERSE.damageAbility[dataset.label] ?? dataset.label;
      const title = dataset.power ? `[power] ${dataset.power}` : "";
      const tokenImg = _getTokenImg(this.actor);
      const npcElementKey = npcItem?.system?.isElemental ? npcItem?.system?.element : null;
      const label = _buildRollFlavor({
        tokenImg,
        actorName: this.actor.name,
        powerName: npcItem?.name,
        ability: ability,
        damageType: dataset.damageType,
        element: npcElementKey,
      });

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

      let npcFlavor = label;
      if (dataset.abilityKey === "ego" && game.settings.get("marvel-multiverse", "mutantReputationEnabled")) {
        const repOverride = this.actor.system.mutantReputation;
        const repKey = repOverride !== "world" ? repOverride : game.settings.get("marvel-multiverse", "mutantReputationLevel");
        const repConfig = MARVEL_MULTIVERSE.mutantReputationLevels[repKey];
        if (repConfig && repKey !== "neutral") {
          npcFlavor += `<div style="margin-top:4px;padding:2px 6px;background:#5c3d6e;color:#fff;border-radius:3px;font-size:11px;"><b>Mutant Reputation (${repConfig.label}):</b> ${repConfig.effect}</div>`;
        }
      }

      const messageData = {
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: npcFlavor,
        rollMode: game.settings.get("core", "rollMode"),
        title: title,
      };
      const npcAttackAbility = npcItem?.system?.attackTarget || dataset.abilityKey;
      const npcTargets = _getAttackTargets(npcAttackAbility);
      if (npcTargets.length) {
        messageData["flags.marvel-multiverse.targets"] = npcTargets;
      }
      roll.toMessage(messageData);
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
      dragDrop: [{ dropSelector: null }],
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
    if (itemData.type === "iconicItem") {
      context.ownershipModes = Object.fromEntries(
        Object.keys(CONFIG.MARVEL_MULTIVERSE.ownershipModes).map((k) => [
          k,
          CONFIG.MARVEL_MULTIVERSE.ownershipModes[k].label,
        ])
      );
      context.specialEffectTypes = Object.fromEntries(
        Object.keys(CONFIG.MARVEL_MULTIVERSE.specialEffectTypes).map((k) => [
          k,
          CONFIG.MARVEL_MULTIVERSE.specialEffectTypes[k].label,
        ])
      );
      context.restrictionKinds = CONFIG.MARVEL_MULTIVERSE.restrictionKinds;
      const powersCount = context.system.powers?.length ?? 0;
      const restrictionsCount = context.system.restrictions?.length ?? 0;
      const rawPV = powersCount - restrictionsCount;
      context.powerValue = (powersCount === 0 && restrictionsCount === 0) ? 0 : rawPV < 0 ? "—" : Math.max(1, rawPV);
      context.sortedPowers = (context.system.powers ?? [])
        .map((p, idx) => ({ ...p, _origIndex: idx }))
        .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
      context.sortedRestrictions = (context.system.restrictions ?? [])
        .map((r, idx) => ({ ...r, _origIndex: idx }))
        .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    }
    if (itemData.type === "restriction") {
      context.restrictionKinds = Object.fromEntries(
        Object.keys(CONFIG.MARVEL_MULTIVERSE.restrictionKinds).map((k) => [
          k,
          CONFIG.MARVEL_MULTIVERSE.restrictionKinds[k].label,
        ])
      );
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

    // Iconic item: restriction management
    html.on("click", ".iconic-restriction-add", async (ev) => {
      ev.preventDefault();
      const restrictions = [...this.item.system.restrictions];
      if (restrictions.length >= 3) {
        ui.notifications.warn("An iconic item can have no more than 3 restrictions.");
        return;
      }
      restrictions.push({ kind: "access", name: "", description: "" });
      await this.item.update({ "system.restrictions": restrictions });
    });

    html.on("click", ".iconic-restriction-remove", async (ev) => {
      ev.preventDefault();
      const index = Number(ev.currentTarget.dataset.index);
      const restrictions = [...this.item.system.restrictions];
      restrictions.splice(index, 1);
      await this.item.update({ "system.restrictions": restrictions });
    });

    html.on("click", ".iconic-restriction-edit", async (ev) => {
      ev.preventDefault();
      const index = Number(ev.currentTarget.dataset.index);
      const restrictions = [...this.item.system.restrictions];
      const restriction = restrictions[index];
      const kindOptions = Object.entries(CONFIG.MARVEL_MULTIVERSE.restrictionKinds)
        .map(([k, v]) => `<option value="${k}" ${k === restriction.kind ? "selected" : ""}>${v.label}</option>`)
        .join("");
      const content = `
        <form>
          <div class="form-group">
            <label>Kind</label>
            <select name="kind">${kindOptions}</select>
          </div>
          <div class="form-group">
            <label>Name</label>
            <input type="text" name="name" value="${restriction.name ?? ""}" />
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea name="description">${restriction.description ?? ""}</textarea>
          </div>
        </form>`;
      new Dialog({
        title: "Edit Restriction",
        content,
        buttons: {
          save: {
            label: "Save",
            callback: async (html) => {
              const newKind = html.find('[name="kind"]').val();
              if (newKind !== "obvious" && newKind !== restriction.kind) {
                const otherSameKind = restrictions.some((r, i) => i !== index && r.kind === newKind);
                if (otherSameKind) {
                  ui.notifications.warn(`This item already has a restriction of kind "${newKind}". Only Obvious restrictions can appear more than once.`);
                  return;
                }
              }
              restrictions[index] = {
                kind: newKind,
                name: html.find('[name="name"]').val(),
                description: html.find('[name="description"]').val(),
              };
              await this.item.update({ "system.restrictions": restrictions });
            },
          },
          cancel: { label: "Cancel" },
        },
        default: "save",
      }).render(true);
    });

    // Iconic item: power removal
    html.on("click", ".iconic-power-remove", async (ev) => {
      ev.preventDefault();
      const index = Number(ev.currentTarget.dataset.index);
      const powers = [...this.item.system.powers];
      powers.splice(index, 1);
      await this.item.update({ "system.powers": powers });
    });

    // Iconic item: drop zone visual feedback
    const iconicDropZones = html.find(".mm-iconic-powers-drop-zone, .mm-iconic-restrictions-drop-zone");
    iconicDropZones.on("dragover", (ev) => {
      ev.preventDefault();
      ev.currentTarget.classList.add("drag-over");
    });
    iconicDropZones.on("dragleave", (ev) => {
      ev.currentTarget.classList.remove("drag-over");
    });
  }

  async _onDrop(event) {
    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData("text/plain"));
    } catch (e) {
      return super._onDrop(event);
    }
    if (data?.type !== "Item") return super._onDrop(event);

    const droppedItem = await Item.implementation.fromDropData(data);

    // Handle powerSet drops onto power items
    if (droppedItem.type === "powerSet" && this.item.type === "power") {
      const powerSets = [...this.item.system.powerSets];
      if (powerSets.some(ps => ps.name === droppedItem.name)) return;
      powerSets.push({
        id: droppedItem.id,
        name: droppedItem.name,
        img: droppedItem.img,
      });
      const powerSet = powerSets.map(ps => ps.name).join(", ");
      return await this.item.update({ "system.powerSets": powerSets, "system.powerSet": powerSet });
    }

    // Handle restriction drops onto iconic items
    if (droppedItem.type === "restriction" && this.item.type === "iconicItem") {
      const restrictions = [...this.item.system.restrictions];
      if (restrictions.some(r => r.name === droppedItem.name)) return;
      if (restrictions.length >= 3) {
        ui.notifications.warn("An iconic item can have no more than 3 restrictions.");
        return;
      }
      const kind = droppedItem.system.kind;
      if (kind !== "obvious" && restrictions.some(r => r.kind === kind)) {
        ui.notifications.warn(`This item already has a restriction of kind "${kind}". Only Obvious restrictions can appear more than once.`);
        return;
      }
      restrictions.push({
        kind,
        name: droppedItem.name,
        description: droppedItem.system.description,
      });
      return await this.item.update({ "system.restrictions": restrictions });
    }

    // Handle power drops onto iconic items
    if (droppedItem.type === "power" && this.item.type === "iconicItem") {
      const powers = [...this.item.system.powers];
      if (powers.some(p => p.name === droppedItem.name)) return;
      powers.push({
        id: droppedItem.id,
        name: droppedItem.name,
        img: droppedItem.img,
      });
      return await this.item.update({ "system.powers": powers });
    }

    return super._onDrop(event);
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
    // Sidebar partials
    "systems/marvel-multiverse/templates/sidebar/actor-directory-filters.hbs",
    // Vehicle partials
    "systems/marvel-multiverse/templates/actor/parts/actor-vehicle-occupants.hbs",
    "systems/marvel-multiverse/templates/actor/parts/actor-vehicle-weapons.hbs",
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
              initial: 0,
              min: 0,
            }),
            active: new fields.BooleanField({
              required: true,
              initial: CONFIG.MARVEL_MULTIVERSE.movementTypes[movement].active,
            }),
            rankMode: new fields.StringField({ required: true, blank: true }),
            calc: new fields.StringField({ blank: true }),
            noncomMultiplier: new fields.NumberField({
              ...requiredInteger,
              initial: 1,
              min: 1,
            }),
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
    schema.mutantReputation = new fields.StringField({
      required: true,
      initial: "world",
    });

    return schema;
  }

  prepareDerivedData() {
    // Damage multiplier and damage reduction bonuses do not stack (rulebook).
    // AEs use ADD mode which sums all bonuses; enforce highest-only here.
    if (this.parent?.effects) {
      const maxDmgBonus = {};
      for (const key in this.abilities) maxDmgBonus[key] = 0;
      let maxHealthDR = 0;
      let maxFocusDR = 0;

      for (const effect of this.parent.effects) {
        if (effect.disabled) continue;
        for (const change of effect.changes) {
          if (Number(change.mode) !== 2) continue;
          const val = Number(change.value) || 0;
          const dmgMatch = change.key.match(/^system\.abilities\.(\w+)\.damageMultiplier$/);
          if (dmgMatch && dmgMatch[1] in maxDmgBonus) {
            maxDmgBonus[dmgMatch[1]] = Math.max(maxDmgBonus[dmgMatch[1]], val);
          }
          if (change.key === "system.healthDamageReduction") {
            maxHealthDR = Math.max(maxHealthDR, val);
          }
          if (change.key === "system.focusDamageReduction") {
            maxFocusDR = Math.max(maxFocusDR, val);
          }
        }
      }

      for (const key in this.abilities) {
        this.abilities[key].damageMultiplier = maxDmgBonus[key];
      }
      this.healthDamageReduction = maxHealthDR;
      this.focusDamageReduction = maxFocusDR;
    }

    // Each level of Health DR protects up to 5 points of condition damage per turn
    this.conditionDamageReduction = this.healthDamageReduction * 5;

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

    const hasBrawling = this.parent?.items?.some(i => i.type === "power" && i.name === "Brawling");
    if (hasBrawling && this.abilities.mle.defense > this.abilities.agl.defense) {
      this.abilities.agl.defense = this.abilities.mle.defense;
    }

    this.health.max = Math.max(10, (this.abilities.res.value * 30) + this.health.bonus);
    this.focus.max = (this.abilities.vig.value * 30) + this.focus.bonus;

    const baseRunSpeed = this.movement.run.value;

    this.movement.climb.value = Math.ceil(baseRunSpeed * 0.5);
    this.movement.jump.value = Math.ceil(baseRunSpeed * 0.5);
    this.movement.swim.value = Math.ceil(baseRunSpeed * 0.5);

    this.attributes.init.value += this.abilities.vig.value;

    for (const key in this.movement) {
      this.movement[key].label =
        game.i18n.localize(CONFIG.MARVEL_MULTIVERSE.movementTypes[key].label) ??
        key;
      if (this.movement[key].calc) this.movement[key].active = true;
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
          this.movement[key].value = baseRunSpeed;
          break;
        case "runspeed-rank":
          this.movement[key].value = baseRunSpeed * this.attributes.rank.value;
          break;
        case "rank": {
          const val =
            this.movement[key].value === 0 ? 1 : this.movement[key].value;
          this.movement[key].value = val * this.attributes.rank.value;
          break;
        }
      }
    }

    // Re-derive climb/swim/jump from final run speed for modes without power overrides
    if (!this.movement.climb.calc) this.movement.climb.value = Math.ceil(this.movement.run.value * 0.5);
    if (!this.movement.jump.calc) this.movement.jump.value = Math.ceil(this.movement.run.value * 0.5);
    if (!this.movement.swim.calc) this.movement.swim.value = Math.ceil(this.movement.run.value * 0.5);

    for (const key in this.movement) {
      const mult = this.movement[key].noncomMultiplier ?? 1;
      this.movement[key].noncom = this.movement[key].value * mult;
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
    if (this.parent?.effects) {
      const maxDmgBonus = {};
      for (const key in this.abilities) maxDmgBonus[key] = 0;
      let maxHealthDR = 0;
      let maxFocusDR = 0;

      for (const effect of this.parent.effects) {
        if (effect.disabled) continue;
        for (const change of effect.changes) {
          if (Number(change.mode) !== 2) continue;
          const val = Number(change.value) || 0;
          const dmgMatch = change.key.match(/^system\.abilities\.(\w+)\.damageMultiplier$/);
          if (dmgMatch && dmgMatch[1] in maxDmgBonus) {
            maxDmgBonus[dmgMatch[1]] = Math.max(maxDmgBonus[dmgMatch[1]], val);
          }
          if (change.key === "system.healthDamageReduction") {
            maxHealthDR = Math.max(maxHealthDR, val);
          }
          if (change.key === "system.focusDamageReduction") {
            maxFocusDR = Math.max(maxFocusDR, val);
          }
        }
      }

      for (const key in this.abilities) {
        this.abilities[key].damageMultiplier = maxDmgBonus[key];
      }
      this.healthDamageReduction = maxHealthDR;
      this.focusDamageReduction = maxFocusDR;
    }

    // Each level of Health DR protects up to 5 points of condition damage per turn
    this.conditionDamageReduction = this.healthDamageReduction * 5;

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

    const hasBrawling = this.parent?.items?.some(i => i.type === "power" && i.name === "Brawling");
    if (hasBrawling && this.abilities.mle.defense > this.abilities.agl.defense) {
      this.abilities.agl.defense = this.abilities.mle.defense;
    }

    this.health.max = Math.max(10, (this.abilities.res.value * 30) + this.health.bonus);
    this.focus.max = (this.abilities.vig.value * 30) + this.focus.bonus;

    const baseRunSpeed = this.movement.run.value;

    this.movement.climb.value = Math.ceil(baseRunSpeed * 0.5);
    this.movement.jump.value = Math.ceil(baseRunSpeed * 0.5);
    this.movement.swim.value = Math.ceil(baseRunSpeed * 0.5);

    this.attributes.init.value += this.abilities.vig.value;

    for (const key in this.movement) {
      this.movement[key].label =
        game.i18n.localize(CONFIG.MARVEL_MULTIVERSE.movementTypes[key].label) ??
        key;
      if (this.movement[key].calc) this.movement[key].active = true;
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
          this.movement[key].value = baseRunSpeed;
          break;
        case "runspeed-rank":
          this.movement[key].value = baseRunSpeed * this.attributes.rank.value;
          break;
        case "rank": {
          const val =
            this.movement[key].value === 0 ? 1 : this.movement[key].value;
          this.movement[key].value = val * this.attributes.rank.value;
          break;
        }
      }
    }

    if (!this.movement.climb.calc) this.movement.climb.value = Math.ceil(this.movement.run.value * 0.5);
    if (!this.movement.jump.calc) this.movement.jump.value = Math.ceil(this.movement.run.value * 0.5);
    if (!this.movement.swim.calc) this.movement.swim.value = Math.ceil(this.movement.run.value * 0.5);

    for (const key in this.movement) {
      const mult = this.movement[key].noncomMultiplier ?? 1;
      this.movement[key].noncom = this.movement[key].value * mult;
    }
  }
}

class MarvelMultiverseVehicle extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = {};

    schema.health = new fields.SchemaField({
      value: new fields.NumberField({ required: true, nullable: false, initial: 0, min: -9999 }),
      max: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
    });

    schema.damageReduction = new fields.NumberField({ ...requiredInteger, initial: 0 });

    schema.size = new fields.StringField({ required: true, initial: "big" });

    schema.passengers = new fields.NumberField({ ...requiredInteger, initial: 1, min: 1 });
    schema.crew = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
    schema.safetyHarness = new fields.BooleanField({ required: true, initial: false });
    schema.crashDamageMultiplier = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });

    const speedField = () => new fields.SchemaField({
      value: new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 }),
      active: new fields.BooleanField({ required: true, initial: false }),
      label: new fields.StringField({ required: true, blank: true }),
    });

    schema.speed = new fields.SchemaField({
      run: speedField(),
      flight: speedField(),
      climb: speedField(),
      swim: speedField(),
    });

    schema.occupants = new fields.ArrayField(new fields.SchemaField({
      actorId: new fields.StringField({ required: true, blank: false }),
      name: new fields.StringField({ required: true, blank: true }),
      img: new fields.StringField({ required: true, blank: true }),
      role: new fields.StringField({ required: true, initial: "passenger" }),
    }));

    schema.profile = new fields.StringField({ required: true, blank: true });
    schema.notes = new fields.StringField({ required: true, blank: true });
    schema.source = new fields.StringField({ required: true, blank: true });

    return schema;
  }

  prepareDerivedData() {
    const maxHealth = this.health.max;
    const curHealth = this.health.value;

    this.health.halfSpeed = curHealth > 0 && curHealth < maxHealth / 2;
    this.health.disabled = curHealth < 1;
    this.health.destroyed = maxHealth > 0 && curHealth <= -(maxHealth);

    let healthStatus = "normal";
    if (this.health.destroyed) healthStatus = "destroyed";
    else if (this.health.disabled) healthStatus = "disabled";
    else if (this.health.halfSpeed) healthStatus = "halfSpeed";
    this.health.status = healthStatus;

    for (const key in this.speed) {
      this.speed[key].label = game.i18n.localize(
        CONFIG.MARVEL_MULTIVERSE.vehicleSpeedLabels[key]?.label ?? key
      );
    }

    const pilot = this.occupants.find(o => o.role === "pilot");
    if (pilot) {
      const pilotActor = game.actors?.get(pilot.actorId);
      if (pilotActor) {
        this.defense = {
          melee: pilotActor.system.abilities.mle.defense,
          agility: pilotActor.system.abilities.agl.defense,
          pilotName: pilotActor.name,
        };
      } else {
        this.defense = { melee: 10, agility: 10, pilotName: null };
      }
    } else {
      this.defense = { melee: 10, agility: 10, pilotName: null };
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

class MarvelMultiverseIconicItem extends MarvelMultiverseItemBase {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.origin = new fields.StringField({ required: true, blank: true });

    schema.ownershipMode = new fields.StringField({
      required: true,
      initial: "owned",
    });

    schema.restrictions = new fields.ArrayField(new fields.ObjectField());

    schema.powers = new fields.ArrayField(new fields.ObjectField());

    schema.isIntelligent = new fields.BooleanField({
      required: true,
      initial: false,
    });
    schema.intelligenceDescription = new fields.StringField({
      required: true,
      blank: true,
    });

    schema.specialEffectType = new fields.StringField({
      required: true,
      blank: true,
    });

    schema.notes = new fields.StringField({ required: true, blank: true });

    schema.weaponData = new fields.SchemaField({
      isWeapon: new fields.BooleanField({ required: true, initial: false }),
      meleeRange: new fields.StringField({ required: true, blank: true }),
      rangedRange: new fields.StringField({ required: true, blank: true }),
      meleeDamageMultiplierBonus: new fields.NumberField({
        ...requiredInteger,
        initial: 0,
        min: 0,
      }),
      rangedDamageMultiplierBonus: new fields.NumberField({
        ...requiredInteger,
        initial: 0,
        min: 0,
      }),
    });

    return schema;
  }

  get powerValue() {
    const powersCount = this.powers?.length ?? 0;
    const restrictionsCount = this.restrictions?.length ?? 0;
    if (powersCount === 0 && restrictionsCount === 0) return 0;
    const raw = powersCount - restrictionsCount;
    if (raw < 0) return "—";
    return Math.max(1, raw);
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

class MarvelMultiverseRestriction extends MarvelMultiverseItemBase {
  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = super.defineSchema();

    schema.kind = new fields.StringField({
      required: true,
      initial: "access",
    });

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

class MarvelMultiverseVehicleWeapon extends MarvelMultiverseItemBase {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.agility = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
    schema.range = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
    schema.damageMultiplier = new fields.NumberField({ ...requiredInteger, initial: 0, min: 0 });
    schema.automated = new fields.BooleanField({ required: true, initial: false });
    schema.notes = new fields.StringField({ required: true, blank: true });

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
/*  Actor Directory Filter Manager               */
/* -------------------------------------------- */

const ActorDirectoryFilter = {

  _filterState: null,
  _directoryApp: null,

  _getDefaultFilterState() {
    return {
      logic: "and",
      panelOpen: false,
      actorType: [],
      rank: { op: ">=", value: null },
      size: [],
      origins: [],
      occupations: [],
      powerSets: [],
      tags: [],
      traits: [],
      abilities: {
        mle: { op: ">=", value: null },
        agl: { op: ">=", value: null },
        res: { op: ">=", value: null },
        vig: { op: ">=", value: null },
        ego: { op: ">=", value: null },
        log: { op: ">=", value: null },
      },
      teams: "",
      movementTypes: [],
      elements: [],
      healthDR: { op: ">=", value: null },
      focusDR: { op: ">=", value: null },
      healthMax: { op: ">=", value: null },
      focusMax: { op: ">=", value: null },
      karmaMax: { op: ">=", value: null },
    };
  },

  init() {
    this._filterState = this._getDefaultFilterState();
  },

  async onRenderDirectory(app, jqHtml) {
    try {
      this._directoryApp = app;
      const html = jqHtml instanceof jQuery ? jqHtml : $(jqHtml);
      const filterData = this._getFilterTemplateData();
      const rendered = await renderTemplate(
        "systems/marvel-multiverse/templates/sidebar/actor-directory-filters.hbs",
        filterData
      );
      const header = html.find(".directory-header");
      if (!header.length) {
        console.warn("ActorDirectoryFilter | No .directory-header found");
        return;
      }
      header.find(".mm-sidebar-filters").remove();
      header.append(rendered);
      this._activateFilterListeners(html);
      if (this._hasActiveFilters()) {
        this._applyFilters(html[0]);
      }
    } catch (err) {
      console.error("ActorDirectoryFilter | Render error:", err);
    }
  },

  _getFilterTemplateData() {
    const s = this._filterState;
    const dynamicOpts = this._buildDynamicOptions();
    const abilities = {};
    for (const [key, label] of Object.entries(CONFIG.MARVEL_MULTIVERSE.abilities)) {
      abilities[key] = {
        label: game.i18n.localize(label),
        op: s.abilities[key].op,
        value: s.abilities[key].value,
      };
    }
    const actorTypes = {
      character: { label: "Character", checked: s.actorType.includes("character") },
      npc: { label: "NPC", checked: s.actorType.includes("npc") },
      vehicle: { label: "Vehicle", checked: s.actorType.includes("vehicle") },
    };
    const sizes = {};
    for (const [key, data] of Object.entries(CONFIG.MARVEL_MULTIVERSE.sizes)) {
      sizes[key] = {
        label: game.i18n.localize(data.label),
        checked: s.size.includes(key),
      };
    }
    const movementTypes = {};
    for (const [key, data] of Object.entries(CONFIG.MARVEL_MULTIVERSE.movementTypes)) {
      movementTypes[key] = {
        label: game.i18n.localize(data.label),
        checked: s.movementTypes.includes(key),
      };
    }
    const elements = {};
    for (const [key, data] of Object.entries(CONFIG.MARVEL_MULTIVERSE.elements)) {
      elements[key] = {
        label: data.label,
        checked: s.elements.includes(key),
      };
    }
    const powerSets = dynamicOpts.powerSets.map(name => ({
      name,
      checked: s.powerSets.includes(name),
    }));
    const origins = dynamicOpts.origins.map(name => ({
      name,
      checked: s.origins.includes(name),
    }));
    const occupations = dynamicOpts.occupations.map(name => ({
      name,
      checked: s.occupations.includes(name),
    }));
    const tags = dynamicOpts.tags.map(name => ({
      name,
      checked: s.tags.includes(name),
    }));
    const traits = dynamicOpts.traits.map(name => ({
      name,
      checked: s.traits.includes(name),
    }));

    return {
      filterState: s,
      activeFilterCount: this._countActiveFilters(),
      filterOptions: {
        actorTypes,
        sizes,
        abilities,
        movementTypes,
        elements,
        powerSets,
        origins,
        occupations,
        tags,
        traits,
      },
    };
  },

  _buildDynamicOptions() {
    const origins = new Set();
    const occupations = new Set();
    const tags = new Set();
    const traits = new Set();
    const powerSets = new Set();
    for (const actor of game.actors) {
      for (const item of actor.items) {
        switch (item.type) {
          case "origin": origins.add(item.name); break;
          case "occupation": occupations.add(item.name); break;
          case "tag": tags.add(item.name); break;
          case "trait": traits.add(item.name); break;
          case "power": {
            const ps = item.system.powerSet;
            if (ps) ps.split(",").forEach(s => powerSets.add(s.trim()));
            break;
          }
        }
      }
    }
    return {
      origins: [...origins].sort(),
      occupations: [...occupations].sort(),
      tags: [...tags].sort(),
      traits: [...traits].sort(),
      powerSets: [...powerSets].sort(),
    };
  },

  _activateFilterListeners(html) {
    const self = this;

    html.find(".mm-filter-toggle").on("click", (ev) => {
      ev.preventDefault();
      self._filterState.panelOpen = !self._filterState.panelOpen;
      const container = html.find(".mm-sidebar-filters");
      container.toggleClass("open", self._filterState.panelOpen);
      container.find(".mm-filter-chevron")
        .toggleClass("fa-chevron-down", !self._filterState.panelOpen)
        .toggleClass("fa-chevron-up", self._filterState.panelOpen);
    });

    html.find(".mm-filter-logic").on("change", (ev) => {
      self._filterState.logic = ev.currentTarget.value;
      self._applyFilters(html[0]);
    });

    html.find(".mm-filter-clear").on("click", (ev) => {
      ev.preventDefault();
      self._filterState = self._getDefaultFilterState();
      self._filterState.panelOpen = true;
      if (self._directoryApp) self._directoryApp.render(false);
    });

    html.find(".mm-filter-group-header").on("click", (ev) => {
      const header = $(ev.currentTarget);
      const body = header.next(".mm-filter-group-body");
      header.toggleClass("collapsed");
      body.toggleClass("collapsed");
    });

    const checkboxFilters = ["actorType", "size", "origins", "occupations", "powerSets", "tags", "traits", "movementTypes", "elements"];
    for (const filterKey of checkboxFilters) {
      html.find(`.mm-filter-checkbox[data-filter='${filterKey}']`).on("change", () => {
        self._updateCheckboxFilter(filterKey, html);
      });
    }

    html.find(".mm-filter-op[data-filter='rank'], .mm-filter-input[data-filter='rank']").on("change", () => {
      self._updateNumericFilter("rank", html);
    });

    html.find("[data-filter='abilities']").on("change", (ev) => {
      const ability = ev.currentTarget.dataset.ability;
      const field = ev.currentTarget.dataset.field;
      if (field === "op") {
        self._filterState.abilities[ability].op = ev.currentTarget.value;
      } else {
        const val = ev.currentTarget.value ? Number(ev.currentTarget.value) : null;
        self._filterState.abilities[ability].value = val;
      }
      self._applyFilters(html[0]);
    });

    html.find(".mm-filter-text[data-filter='teams']").on("input", (ev) => {
      self._filterState.teams = ev.currentTarget.value;
      self._applyFilters(html[0]);
    });

    for (const key of ["healthDR", "focusDR", "healthMax", "focusMax", "karmaMax"]) {
      html.find(`[data-filter='${key}']`).on("change", () => {
        self._updateNumericFilter(key, html);
      });
    }
  },

  _updateCheckboxFilter(filterKey, html) {
    const checked = [];
    html.find(`.mm-filter-checkbox[data-filter='${filterKey}']:checked`).each((i, el) => {
      checked.push(el.value);
    });
    this._filterState[filterKey] = checked;
    this._applyFilters(html[0]);
  },

  _updateNumericFilter(filterKey, html) {
    const opEl = html.find(`.mm-filter-op[data-filter='${filterKey}']`)[0];
    const valEl = html.find(`.mm-filter-input[data-filter='${filterKey}']`)[0];
    if (opEl) this._filterState[filterKey].op = opEl.value;
    if (valEl) this._filterState[filterKey].value = valEl.value ? Number(valEl.value) : null;
    this._applyFilters(html[0]);
  },

  _applyFilters(htmlEl) {
    const entries = htmlEl.querySelectorAll(".directory-item.document");
    for (const entry of entries) {
      const actorId = entry.dataset.documentId || entry.dataset.entryId;
      const actor = game.actors.get(actorId);
      if (!actor) continue;
      if (this._hasActiveFilters() && !this._matchesFilters(actor)) {
        entry.style.display = "none";
      } else {
        entry.style.display = "";
      }
    }
    this._updateFolderVisibility(htmlEl);
    this._updateFilterCount(htmlEl);
  },

  _updateFolderVisibility(htmlEl) {
    const folders = htmlEl.querySelectorAll(".directory-item.folder");
    for (const folder of folders) {
      const subdirectory = folder.querySelector(".subdirectory");
      if (!subdirectory) continue;
      const visibleEntries = subdirectory.querySelectorAll(".directory-item.document:not([style*='display: none'])");
      const visibleSubfolders = subdirectory.querySelectorAll(".directory-item.folder:not([style*='display: none'])");
      if (visibleEntries.length === 0 && visibleSubfolders.length === 0 && this._hasActiveFilters()) {
        folder.style.display = "none";
      } else {
        folder.style.display = "";
      }
    }
  },

  _updateFilterCount(htmlEl) {
    const count = this._countActiveFilters();
    const badge = $(htmlEl).find(".mm-filter-count");
    badge.text(count);
    badge.toggleClass("hidden", count === 0);
  },

  _countActiveFilters() {
    const s = this._filterState;
    let count = 0;
    if (s.actorType.length) count++;
    if (s.rank.value !== null) count++;
    if (s.size.length) count++;
    if (s.origins.length) count++;
    if (s.occupations.length) count++;
    if (s.powerSets.length) count++;
    if (s.tags.length) count++;
    if (s.traits.length) count++;
    for (const abl of Object.values(s.abilities)) {
      if (abl.value !== null) count++;
    }
    if (s.teams.trim()) count++;
    if (s.movementTypes.length) count++;
    if (s.elements.length) count++;
    if (s.healthDR.value !== null) count++;
    if (s.focusDR.value !== null) count++;
    if (s.healthMax.value !== null) count++;
    if (s.focusMax.value !== null) count++;
    if (s.karmaMax.value !== null) count++;
    return count;
  },

  _hasActiveFilters() {
    return this._countActiveFilters() > 0;
  },

  _matchesFilters(actor) {
    const s = this._filterState;
    const results = [];

    if (s.actorType.length) {
      results.push(s.actorType.includes(actor.type));
    }

    if (s.rank.value !== null) {
      results.push(this._evalNumeric(actor.system.attributes?.rank?.value, s.rank.op, s.rank.value));
    }

    if (s.size.length) {
      results.push(s.size.includes(actor.system.size));
    }

    if (s.origins.length) {
      const actorOrigins = actor.items.filter(i => i.type === "origin").map(i => i.name);
      results.push(s.origins.some(o => actorOrigins.includes(o)));
    }

    if (s.occupations.length) {
      const actorOccs = actor.items.filter(i => i.type === "occupation").map(i => i.name);
      results.push(s.occupations.some(o => actorOccs.includes(o)));
    }

    if (s.powerSets.length) {
      const actorPowerSets = new Set();
      actor.items.filter(i => i.type === "power").forEach(i => {
        const ps = i.system.powerSet;
        if (ps) ps.split(",").forEach(p => actorPowerSets.add(p.trim()));
      });
      results.push(s.powerSets.some(ps => actorPowerSets.has(ps)));
    }

    if (s.tags.length) {
      const actorTags = actor.items.filter(i => i.type === "tag").map(i => i.name);
      results.push(s.tags.some(t => actorTags.includes(t)));
    }

    if (s.traits.length) {
      const actorTraits = actor.items.filter(i => i.type === "trait").map(i => i.name);
      results.push(s.traits.some(t => actorTraits.includes(t)));
    }

    for (const [abl, filter] of Object.entries(s.abilities)) {
      if (filter.value !== null) {
        results.push(this._evalNumeric(actor.system.abilities?.[abl]?.value ?? 0, filter.op, filter.value));
      }
    }

    if (s.teams.trim()) {
      results.push((actor.system.teams || "").toLowerCase().includes(s.teams.trim().toLowerCase()));
    }

    if (s.movementTypes.length) {
      results.push(s.movementTypes.every(mt => actor.system.movement?.[mt]?.active));
    }

    if (s.elements.length) {
      results.push(s.elements.includes(actor.system.defaultElement));
    }

    if (s.healthDR.value !== null) {
      results.push(this._evalNumeric(actor.system.healthDamageReduction ?? 0, s.healthDR.op, s.healthDR.value));
    }

    if (s.focusDR.value !== null) {
      results.push(this._evalNumeric(actor.system.focusDamageReduction ?? 0, s.focusDR.op, s.focusDR.value));
    }

    if (s.healthMax.value !== null) {
      results.push(this._evalNumeric(actor.system.health?.max ?? 0, s.healthMax.op, s.healthMax.value));
    }

    if (s.focusMax.value !== null) {
      results.push(this._evalNumeric(actor.system.focus?.max ?? 0, s.focusMax.op, s.focusMax.value));
    }

    if (s.karmaMax.value !== null) {
      results.push(this._evalNumeric(actor.system.karma?.max ?? 0, s.karmaMax.op, s.karmaMax.value));
    }

    if (!results.length) return true;
    return s.logic === "and" ? results.every(Boolean) : results.some(Boolean);
  },

  _evalNumeric(actual, op, target) {
    switch (op) {
      case "=": return actual === target;
      case ">=": return actual >= target;
      case "<=": return actual <= target;
      default: return true;
    }
  },
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
    vehicle: MarvelMultiverseVehicle,
  };
  CONFIG.ChatMessage.documentClass = ChatMessageMarvel;
  CONFIG.Item.documentClass = MarvelMultiverseItem$1;
  CONFIG.Item.dataModels = {
    item: MarvelMultiverseItem,
    iconicItem: MarvelMultiverseIconicItem,
    weapon: MarvelMultiverseWeapon,
    trait: MarvelMultiverseTrait,
    origin: MarvelMultiverseOrigin,
    occupation: MarvelMultiverseOccupation,
    tag: MarvelMultiverseTag,
    power: MarvelMultiversePower,
    powerSet: MarvelMultiversePowerSet,
    restriction: MarvelMultiverseRestriction,
    vehicleWeapon: MarvelMultiverseVehicleWeapon,
  };

  game.settings.register("marvel-multiverse", "autoPopulateOrigin", {
    name: "Auto-Populate Origin Items",
    hint: "When adding an Origin or Occupation to a character, automatically create its associated powers, traits, and tags.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register("marvel-multiverse", "mutantReputationEnabled", {
    name: "Enable Mutant Reputation",
    hint: "Enable the optional Mutant Reputation system from the X-Men Expansion. When active, Ego checks display reputation-based edge/trouble notices.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register("marvel-multiverse", "mutantReputationLevel", {
    name: "Mutant Reputation Level",
    hint: "The current world-level mutant reputation. Affects all mutant characters unless overridden per-actor.",
    scope: "world",
    config: true,
    type: String,
    default: "neutral",
    choices: Object.fromEntries(
      Object.entries(MARVEL_MULTIVERSE.mutantReputationLevels).map(([k, v]) => [k, `${v.label} (${v.effect})`])
    ),
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

  // Replace Foundry defaults with only MMRPG-valid status effects
  const mmrpgStatuses = [
    { id: "ablaze", name: "Ablaze", img: "icons/svg/fire.svg" },
    { id: "bleeding", name: "Bleeding", img: "systems/marvel-multiverse/icons/statuses/bleeding.svg" },
    { id: "blinded", name: "Blinded", img: "systems/marvel-multiverse/icons/statuses/blinded.svg" },
    { id: "corroding", name: "Corroding", img: "icons/svg/acid.svg" },
    { id: "deafened", name: "Deafened", img: "systems/marvel-multiverse/icons/statuses/deafened.svg" },
    { id: "encumbered", name: "Encumbered", img: "systems/marvel-multiverse/icons/statuses/encumbered.svg" },
    { id: "exhaustion", name: "Exhaustion", img: "systems/marvel-multiverse/icons/statuses/exhaustion.svg" },
    { id: "flying", name: "Flying", img: "systems/marvel-multiverse/icons/statuses/flying.svg" },
    { id: "frightened", name: "Frightened", img: "systems/marvel-multiverse/icons/statuses/frightened.svg" },
    { id: "grappled", name: "Grappled", img: "systems/marvel-multiverse/icons/statuses/grappled.svg" },
    { id: "incapacitated", name: "Incapacitated", img: "systems/marvel-multiverse/icons/statuses/incapacitated.svg" },
    { id: "infected", name: "Infected", img: "icons/svg/biohazard.svg" },
    { id: "invisible", name: "Invisible", img: "systems/marvel-multiverse/icons/statuses/invisible.svg" },
    { id: "paralyzed", name: "Paralyzed", img: "systems/marvel-multiverse/icons/statuses/paralyzed.svg" },
    { id: "petrified", name: "Petrified", img: "systems/marvel-multiverse/icons/statuses/petrified.svg" },
    { id: "poisoned", name: "Poisoned", img: "icons/svg/poison.svg" },
    { id: "prone", name: "Prone", img: "systems/marvel-multiverse/icons/statuses/prone.svg" },
    { id: "restrained", name: "Restrained", img: "systems/marvel-multiverse/icons/statuses/restrained.svg" },
    { id: "silenced", name: "Silenced", img: "systems/marvel-multiverse/icons/statuses/silenced.svg" },
    { id: "stunned", name: "Stunned", img: "systems/marvel-multiverse/icons/statuses/stunned.svg" },
    { id: "surprised", name: "Surprised", img: "systems/marvel-multiverse/icons/statuses/surprised.svg" },
    { id: "unconscious", name: "Unconscious", img: "icons/svg/unconscious.svg" },
  ];
  // Keep Foundry's "dead" status for the combat tracker defeated toggle
  const deadStatus = CONFIG.statusEffects.find((s) => s.id === "dead");
  CONFIG.statusEffects = deadStatus ? [deadStatus, ...mmrpgStatuses] : mmrpgStatuses;

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
  Actors.registerSheet("marvel-multiverse", MarvelMultiverseVehicleSheet, {
    types: ["vehicle"],
    makeDefault: true,
    label: "MARVEL_MULTIVERSE.SheetLabels.Vehicle",
  });
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("marvel-multiverse", MarvelMultiverseItemSheet, {
    makeDefault: true,
    label: "MARVEL_MULTIVERSE.SheetLabels.Item",
  });

  // Initialize Actor Directory Filters
  ActorDirectoryFilter.init();

  // Preload Handlebars templates.
  return preloadHandlebarsTemplates();
});

/* -------------------------------------------- */
/*  Handlebars Helpers                          */
/* -------------------------------------------- */

// If you need to add Handlebars helpers, here is a useful example:
Handlebars.registerHelper("toLowerCase", (mle) => mle.toLowerCase());
Handlebars.registerHelper("eq", (a, b) => a === b);
Handlebars.registerHelper("gt", (a, b) => a > b);


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

Hooks.on("renderActorDirectory", (app, html) => {
  ActorDirectoryFilter.onRenderDirectory(app, html);
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
/*  Render Chat Message Hook                    */
/* -------------------------------------------- */

Hooks.on("renderChatMessage", (message, html) => {
  const flavorEl = html.find ? html.find(".mm-roll-flavor") : html.querySelector?.(".mm-roll-flavor");
  const flavor = flavorEl?.[0] ?? flavorEl;
  if (!flavor) return;

  const tokenImg = flavor.dataset.tokenImg;
  const header = html.find ? html.find(".message-header")[0] : html.querySelector(".message-header");
  if (!header) return;

  header.classList.add("mm-custom-header");
  header.style.cssText = "background:#8b0502;padding:2px 8px;position:relative;overflow:visible;min-height:32px;align-items:center;flex-wrap:nowrap;display:flex;";

  const sender = header.querySelector(".message-sender");
  if (sender) {
    sender.style.cssText = "color:#fff;font-weight:700;font-size:14px;white-space:nowrap;flex:1;padding-left:" + (tokenImg ? "39px" : "0") + ";";
    const nameEl = sender.querySelector(".title");
    if (nameEl) nameEl.style.color = "#fff";
  }

  const timestamp = header.querySelector(".message-timestamp");
  if (timestamp) timestamp.style.cssText = "color:rgba(255,255,255,0.7);white-space:nowrap;font-size:10px;";

  const metadata = header.querySelector(".message-metadata");
  if (metadata) metadata.style.cssText = "white-space:nowrap;flex-shrink:0;margin-left:auto;";

  const allControls = header.querySelectorAll(".chat-control, [data-context-menu]");
  allControls.forEach(el => el.style.cssText = "display:none !important;");

  const flavorInHeader = header.querySelector(".flavor-text");
  if (flavorInHeader) {
    header.parentNode.insertBefore(flavorInHeader, header.nextSibling);
  }

  if (tokenImg) {
    const img = document.createElement("img");
    img.src = tokenImg;
    img.style.cssText = "position:absolute;left:4px;top:50%;transform:translateY(-50%);width:36px;height:36px;border:none;border-radius:50%;object-fit:cover;";
    header.insertBefore(img, header.firstChild);
  }
});

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
