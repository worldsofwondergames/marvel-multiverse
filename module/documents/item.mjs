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
/**
 * Read a power's Focus cost out of its free-text `cost` field.
 *
 * Returns null when there is no cost, when the text names no Focus at all
 * ("Varies", "Same as the character's Elemental Protection power"), or when the
 * wording is not one of the recognised shapes. A null result means no activate
 * control is offered, which is the safe outcome: better to leave the player to
 * adjust Focus by hand than to deduct a guessed amount.
 *
 * @param {string} text
 * @returns {{kind: 'flat'|'variable'|'recurring', amount: number, period: string|null}|null}
 */
export function _parseFocusCost(text) {
  const raw = String(text ?? '').trim();
  if (!raw || !/focus/i.test(raw)) return null;

  // "5 or more Focus" — the number is a floor, the player chooses the rest.
  const orMore = /^(\d+)\s+or\s+more\s+focus$/i.exec(raw);
  if (orMore) return { kind: 'variable', amount: Number(orMore[1]), period: null };

  // "5 Focus per turn", "15 Focus per round" — charged again each turn or round.
  const per = /^(\d+)\s+focus\s+per\s+(turn|round)$/i.exec(raw);
  if (per) return { kind: 'recurring', amount: Number(per[1]), period: per[2].toLowerCase() };

  // "10 Focus" — a fixed price.
  const flat = /^(\d+)\s+focus$/i.exec(raw);
  if (flat) return { kind: 'flat', amount: Number(flat[1]), period: null };

  return null;
}

/**
 * The most Focus a character may spend at once: five times their rank, per the
 * core rulebook's "Spending Focus". Applies to every cost, flat or chosen.
 */
export function _maxFocusSpend(actor) {
  const rank = Number(actor?.system?.attributes?.rank?.value ?? 0);
  return rank * 5;
}

/** Whether this user may activate powers on the actor: its owner, or a GM. */
export function _canActivatePowers(actor) {
  return !!(globalThis.game?.user?.isGM || actor?.isOwner);
}

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
