import { buildRollFlavor } from "../helpers/roll-flavor.mjs";

/**
 * Extend the basic Item with some very simple modifications.
 * @extends {Item}
 */
export class MarvelMultiverseItem extends Item {
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
    const tokenImg = this.actor?.prototypeToken?.texture?.src || this.actor?.img;
    const elementKey = this.system.isElemental ? this.system.element : null;
    const label = buildRollFlavor({
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
      roll.toMessage(
        {
          title: this.name,
          speaker: speaker,
          rollMode: rollMode,
          flavor: label,
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
}
