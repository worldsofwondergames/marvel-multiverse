/**
 * True when rich-text content has something worth showing. ProseMirror stores
 * an emptied editor as `<p></p>`, which is not blank as a string but renders as
 * nothing, so tags are stripped before testing. An image-only body counts as
 * content.
 */
export function _hasContent(html) {
  const raw = String(html ?? "");
  if (/<img\b/i.test(raw)) return true;
  return raw.replace(/<[^>]*>/g, "").trim().length > 0;
}

/**
 * Action / Trigger / Duration / Cost rows for an item's chat card, in the order
 * the item sheet lists them. A field with no value contributes no row at all --
 * no empty label, no blank line -- and the block itself disappears when none of
 * the four are set. Item types that lack these fields simply produce nothing.
 */
export function _buildItemMeta(system) {
  const rows = [
    ["Action", system?.action],
    ["Trigger", system?.trigger],
    ["Duration", system?.duration],
    ["Cost", system?.cost],
  ].filter(([, value]) => String(value ?? "").trim().length > 0);

  if (!rows.length) return "";
  // No side padding here: this block is nested inside the flavor wrapper, which
  // already provides the 8px that every line on the card shares.
  return `<div class="mm-chat-meta">${rows
    .map(
      ([label, value]) =>
        `<div class="mm-chat-meta-row" data-meta="${label.toLowerCase()}"><b>${label}:</b> ${String(value).trim()}</div>`
    )
    .join("")}</div>`;
}

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
    const tokenDoc = this.actor?.token ?? canvas.tokens?.controlled?.find(t => t.actor?.id === this.actor?.id)?.document ?? this.actor?.getActiveTokens()?.[0]?.document;
    const speaker = ChatMessage.getSpeaker({ actor: this.actor, token: tokenDoc });
    const rollMode = game.settings.get("core", "rollMode");
    let label = `ability: ${
      CONFIG.MARVEL_MULTIVERSE.damageAbility[this.system.ability]
    }<br/>${this.type}: ${this.name}`;
    label = this.system.damageType
      ? `${label}<br/>damagetype: ${this.system.damageType}`
      : label;
    label =
      this.system.isElemental && this.system.element
        ? `${label}<br/>element: ${this.system.element}`
        : label;

    if (this.system.isElemental && this.system.element) {
      label += `<br/>element: ${this.system.element}`;
    }

    console.log(
      `damageType: ${this.system.damageType} item.roll() : label: ${label}`
    );

    // The four meta lines are part of the card's flavor text, directly under
    // the power name and above the ability row. The roll message reuses the
    // plain label instead, so the lines are not shown twice.
    const cardLabel = `${label}${_buildItemMeta(this.system)}`;

    ChatMessage.create({
      speaker: speaker,
      rollMode: rollMode,
      flavor: cardLabel,
      content: `<div class="mm-chat-body">${
        _hasContent(this.system.description)
          ? `<div class="mm-chat-description">${this.system.description}</div>`
          : ""
      }${
        _hasContent(this.system.effect)
          ? `<div class="mm-chat-effect">${this.system.effect}</div>`
          : ""
      }</div>`,
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
}
