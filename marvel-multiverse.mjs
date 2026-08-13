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

/**
 * Whether an attack roll beat a target's defense.
 *
 * A Fantastic result hits regardless of the number, so it is checked before the
 * comparison rather than folded into it. `_enrichAttackTargets` draws the
 * Hit/Miss list from this and the damage card decides who gets a button from
 * the same call, so the two can never disagree about what a hit is.
 *
 * @param {{isFantastic?: boolean, total?: number}} attackRoll
 * @param {number} ac  The target's defense against the attacking ability.
 * @returns {boolean}
 */
function isTargetHit(attackRoll, ac) {
  if (attackRoll?.isFantastic) return true;
  return Number(attackRoll?.total) >= Number(ac);
}

/**
 * Damage after the target's damage reduction is taken off the attacker's
 * multiplier.
 *
 * Rulebook: once DR meets or exceeds the multiplier the attack "does no damage
 * at all, not even from the attacker's Ability score bonus", so a zeroed
 * multiplier returns 0 rather than the bare ability score. Clamping the
 * multiplier first also stops DR above it from producing negative damage.
 *
 * @param {object} args
 * @param {number} args.marvelDieTotal
 * @param {number} args.damageMultiplier   The attacker's multiplier for the ability used.
 * @param {number} [args.damageReduction]  The target's DR for this damage type.
 * @param {number} args.abilityValue       The attacker's score in the ability used.
 * @param {boolean} [args.fantastic]
 * @returns {{amount: number, effectiveMultiplier: number}}
 */
function computeDamage({
  marvelDieTotal,
  damageMultiplier,
  damageReduction = 0,
  abilityValue,
  fantastic = false,
}) {
  const effectiveMultiplier = Math.max(0, damageMultiplier - damageReduction);
  let amount =
    effectiveMultiplier === 0
      ? 0
      : marvelDieTotal * effectiveMultiplier + abilityValue;
  if (fantastic) amount = amount * 2;
  return { amount, effectiveMultiplier };
}

/**
 * The actor field a damage type comes out of. Only `focus` diverts; everything
 * else, including an attack that named no damage type, comes off Health.
 * @param {string} damageType
 * @returns {string}
 */
function damageValuePath(damageType) {
  return damageType === "focus" ? "system.focus.value" : "system.health.value";
}

/**
 * The DR field a damage type is reduced by, matching damageValuePath.
 * @param {string} damageType
 * @returns {string}
 */
function damageReductionPath(damageType) {
  return damageType === "focus"
    ? "focusDamageReduction"
    : "healthDamageReduction";
}

/**
 * Whether this user may apply damage to this actor. The damage message is sent
 * to everyone, so the button has to be removed per viewer at render time rather
 * than left out when the message is built.
 * @param {User} user
 * @param {Actor} actor
 * @returns {boolean}
 */
function canApplyDamage(user, actor) {
  if (!user || !actor) return false;
  if (user.isGM) return true;
  return actor.testUserPermission?.(user, "OWNER") === true;
}

/**
 * The applied list after a target's damage has been taken.
 *
 * A list rather than a keyed object because actor uuids contain a period
 * ("Actor.4kNqW..."), and Foundry expands periods in a flag key into nested
 * objects — a uuid used as a key would silently become a tree of one-character
 * levels.
 *
 * @param {string[]} applied  The existing list, if any.
 * @param {string} uuid
 * @returns {string[]}  A new list; the input is not modified.
 */
function withApplied(applied, uuid) {
  const list = Array.isArray(applied) ? applied : [];
  if (list.includes(uuid)) return [...list];
  return [...list, uuid];
}

function _toTitleCase(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function _getTokenDoc(actor) {
  if (actor?.token) return actor.token;
  const controlled = canvas.tokens?.controlled?.find(t => t.actor?.id === actor?.id);
  if (controlled) return controlled.document;
  const active = actor?.getActiveTokens?.()?.[0];
  if (active) return active.document;
  return null;
}

function _getTokenImg(actor) {
  const tokenDoc = _getTokenDoc(actor);
  if (tokenDoc?.texture?.src) return tokenDoc.texture.src;
  const protoSrc = actor?.prototypeToken?.texture?.src;
  if (protoSrc && !protoSrc.includes("*")) return protoSrc;
  return actor?.img || "";
}

/**
 * True when rich-text content has something worth showing. ProseMirror stores
 * an emptied editor as `<p></p>`, which is not blank as a string but renders as
 * nothing, so tags are stripped before testing. An image-only body counts as
 * content.
 */
function _hasContent(html) {
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
function _buildItemMeta(system) {
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
function _parseFocusCost(text) {
  const raw = String(text ?? "").trim();
  if (!raw || !/focus/i.test(raw)) return null;

  // "5 or more Focus" -- the number is a floor, the player chooses the rest.
  const orMore = /^(\d+)\s+or\s+more\s+focus$/i.exec(raw);
  if (orMore) return { kind: "variable", amount: Number(orMore[1]), period: null };

  // "5 Focus per turn", "15 Focus per round" -- charged again each turn or round.
  const per = /^(\d+)\s+focus\s+per\s+(turn|round)$/i.exec(raw);
  if (per) return { kind: "recurring", amount: Number(per[1]), period: per[2].toLowerCase() };

  // "10 Focus" -- a fixed price.
  const flat = /^(\d+)\s+focus$/i.exec(raw);
  if (flat) return { kind: "flat", amount: Number(flat[1]), period: null };

  return null;
}

/**
 * The most Focus a character may spend at once: five times their rank, per the
 * core rulebook's "Spending Focus". Applies to every cost, flat or chosen.
 */
function _maxFocusSpend(actor) {
  const rank = Number(actor?.system?.attributes?.rank?.value ?? 0);
  return rank * 5;
}

/**
 * True when a power lasts for as long as the character concentrates on it.
 * Duration is free text, but every concentration power in the data module
 * spells it exactly "Concentration".
 */
function _isConcentrationPower(system) {
  return /concentration/i.test(String(system?.duration ?? ""));
}

/**
 * How many powers a character may concentrate on at once: one per rank, per the
 * core rulebook's "Breaking Concentration".
 */
function _concentrationLimit(actor) {
  return Number(actor?.system?.attributes?.rank?.value ?? 0);
}

/**
 * Whether a new concentration may start, and if not, why.
 *
 * Kept separate from the actor so the rule can be tested without Foundry: the
 * caller passes the ids already held, the id being added, and the limit.
 *
 * @returns {{ok: true}|{ok: false, reason: "duplicate"|"limit"}}
 */
function _checkConcentration({ held = [], itemId, limit = 0 }) {
  if (held.includes(itemId)) return { ok: false, reason: "duplicate" };
  if (held.length >= limit) return { ok: false, reason: "limit" };
  return { ok: true };
}

/**
 * Conditions that break concentration and can be detected from actor state.
 *
 * The rulebook also breaks it on blinded, deafened and paralyzed, but only when
 * the power needs line of sight, hearing, or a Melee or Agility check. Nothing
 * in the power schema records those requirements, so those stay manual, as does
 * knockback, which is not a condition at all.
 */
const CONCENTRATION_BREAKERS = ["unconscious", "demoralized", "stunned", "prone"];

/** Whether this user may activate powers on the actor: its owner, or a GM. */
function _canActivatePowers(actor) {
  return !!(game.user?.isGM || actor?.isOwner);
}

/**
 * Ask the player how much Focus to spend. Used for costs that state a floor
 * ("5 or more Focus") and for recurring ones, which are prefilled with a single
 * period's price.
 *
 * @returns {Promise<number|null>} the chosen amount, or null if cancelled
 */
function _promptFocusAmount({ powerName, min, max }) {
  return new Promise((resolve) => {
    const content = `<form>
      <div class="form-group mm-spend-group">
        <label for="mm-focus-amount"><b>${powerName}</b> - Focus to spend (min ${min}, max ${max})</label>
        <div class="mm-quantity">
          <button type="button" class="minus" aria-label="Decrease">&minus;</button>
          <input id="mm-focus-amount" class="input-box" type="number" name="amount" value="${min}" min="${min}" max="${max}" step="1" autofocus/>
          <button type="button" class="plus" aria-label="Increase">&plus;</button>
        </div>
      </div>
    </form>`;
    let settled = false;
    const done = (value) => { if (!settled) { settled = true; resolve(value); } };

    new Dialog({
      title: "Spend Focus",
      content,
      buttons: {
        spend: {
          icon: '<i class="fas fa-bolt"></i>',
          label: "Spend",
          callback: (html) => {
            const raw = Number(html.find('input[name="amount"]').val());
            if (!Number.isFinite(raw)) return done(null);
            if (raw < min) {
              ui.notifications.warn(`${powerName} costs at least ${min} Focus.`);
              return done(null);
            }
            if (raw > max) {
              ui.notifications.warn(`A character cannot spend more than ${max} Focus at once.`);
              return done(null);
            }
            done(Math.trunc(raw));
          },
        },
        cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancel", callback: () => done(null) },
      },
      default: "spend",
      // Stepper buttons, wired here rather than with inline onclick attributes so
      // they clamp to both bounds and do not depend on named-element globals.
      render: (html) => {
        const root = html instanceof HTMLElement ? html : html?.[0];
        const input = root?.querySelector('input[name="amount"]');
        if (!input) return;
        const step = (delta) => {
          const next = Math.min(max, Math.max(min, (Number(input.value) || min) + delta));
          input.value = String(next);
        };
        root.querySelector("button.minus")?.addEventListener("click", () => step(-1));
        root.querySelector("button.plus")?.addEventListener("click", () => step(1));
      },
      close: () => done(null),
    }, { classes: ["dialog", "marvel-multiverse", "mm-dialog"] }).render(true);
  });
}

/** Confirm a spend that would take the character below zero Focus. */
function _confirmOverspend({ powerName, cost, current }) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (value) => { if (!settled) { settled = true; resolve(value); } };
    new Dialog({
      title: "Not enough Focus",
      content: `<p><b>${powerName}</b> costs ${cost} Focus, but the character has ${current}.</p>
                <p>Spending it anyway leaves them at ${current - cost}.</p>`,
      buttons: {
        yes: { icon: '<i class="fas fa-check"></i>', label: "Spend anyway", callback: () => done(true) },
        no: { icon: '<i class="fas fa-times"></i>', label: "Cancel", callback: () => done(false) },
      },
      default: "no",
      close: () => done(false),
    }, { classes: ["dialog", "marvel-multiverse", "mm-dialog"] }).render(true);
  });
}

/**
 * Spend a power's Focus cost and announce it.
 *
 * Shared by the sheet control and the chat card button so the two cannot drift.
 * The message is always public, whatever the current roll mode.
 *
 * @returns {Promise<boolean>} whether Focus was actually spent
 */
/** Concentration ids on the actor, with any deleted powers dropped. */
function _heldConcentrations(actor) {
  const held = actor?.system?.concentrating ?? [];
  return held.filter((id) => actor.items.get(id));
}

/** The single user answering for this actor: an owning player, else the GM. */
function _isResponsibleFor(actor) {
  const owners = game.users?.filter((u) => u.active && actor.testUserPermission(u, "OWNER")) ?? [];
  const responsible = owners.find((u) => !u.isGM) ?? owners.find((u) => u.isGM);
  return responsible?.id === game.user?.id;
}

/** Stop concentrating on one power, or on every power when no id is given. */
async function _endConcentration(actor, itemId = null, { announce = true, reason = "" } = {}) {
  const held = _heldConcentrations(actor);
  const ending = itemId ? held.filter((id) => id === itemId) : held;
  if (!ending.length) return false;

  const remaining = held.filter((id) => !ending.includes(id));
  await actor.update({ "system.concentrating": remaining });
  // The marker reflects "holding at least one", so it clears only when the last
  // one goes. Removing it here is what makes toggling it off symmetrical.
  if (!remaining.length && actor.statuses?.has("concentrating")) {
    await actor.toggleStatusEffect("concentrating", { active: false });
  }

  if (announce) {
    const names = ending.map((id) => actor.items.get(id)?.name).filter(Boolean).join(", ");
    if (names) {
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor, token: _getTokenDoc(actor) }),
        flavor: _buildRollFlavor({ tokenImg: _getTokenImg(actor), actorName: actor.name }),
        content: `<div class="mm-chat-body"><div class="mm-concentration-ended">Concentration on <b>${names}</b> ends${reason ? ` — ${reason}` : ""}.</div></div>`,
      });
    }
  }
  return true;
}

/**
 * Record a new concentration, refusing when the character is already at their
 * rank's worth or already concentrating on that same power.
 *
 * @returns {Promise<boolean>} whether it was recorded
 */
async function _startConcentration(actor, item) {
  const held = _heldConcentrations(actor);
  const limit = _concentrationLimit(actor);
  const check = _checkConcentration({ held, itemId: item.id, limit });
  if (!check.ok) {
    if (check.reason === "duplicate") {
      ui.notifications.warn(`${actor.name} is already concentrating on ${item.name}.`);
    } else {
      const names = held.map((id) => actor.items.get(id)?.name).filter(Boolean).join(", ");
      ui.notifications.warn(
        `${actor.name} can concentrate on ${limit} power${limit === 1 ? "" : "s"} at a time` +
        `${names ? `, and is already holding ${names}` : ""}.`
      );
    }
    return false;
  }
  await actor.update({ "system.concentrating": [...held, item.id] });
  if (!actor.statuses?.has("concentrating")) {
    await actor.toggleStatusEffect("concentrating", { active: true });
  }
  return true;
}

async function _activatePower(actor, item) {
  if (!actor || !item) return false;
  if (!_canActivatePowers(actor)) {
    ui.notifications.warn("You do not have permission to activate powers on this character.");
    return false;
  }

  const cost = _parseFocusCost(item.system?.cost);
  if (!cost) {
    ui.notifications.warn(`${item.name} has no Focus cost that can be worked out automatically.`);
    return false;
  }

  // Checked before anything is spent, so a refused concentration costs nothing.
  const concentrates = _isConcentrationPower(item.system);
  if (concentrates) {
    const check = _checkConcentration({
      held: _heldConcentrations(actor),
      itemId: item.id,
      limit: _concentrationLimit(actor),
    });
    if (!check.ok) {
      await _startConcentration(actor, item); // reports the reason
      return false;
    }
  }

  const max = _maxFocusSpend(actor);
  // The rulebook caps a single spend at five times rank. A flat cost above that
  // ceiling cannot be paid at all, so say so rather than deducting it.
  if (cost.amount > max) {
    ui.notifications.warn(
      `${item.name} costs ${cost.amount} Focus, but this character cannot spend more than ${max} at once.`
    );
    return false;
  }

  let amount = cost.amount;
  if (cost.kind !== "flat") {
    amount = await _promptFocusAmount({ powerName: item.name, min: cost.amount, max });
    if (amount === null) return false;
  }

  const current = Number(actor.system?.focus?.value ?? 0);
  if (amount > current) {
    const ok = await _confirmOverspend({ powerName: item.name, cost: amount, current });
    if (!ok) return false;
  }

  await actor.update({ "system.focus.value": current - amount });

  const period = cost.period ? ` per ${cost.period}` : "";
  const flavor = _buildRollFlavor({
    tokenImg: _getTokenImg(actor),
    actorName: actor.name,
    powerName: item.name,
  });
  if (concentrates) await _startConcentration(actor, item);

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor, token: _getTokenDoc(actor) }),
    flavor,
    content: `<div class="mm-chat-body"><div class="mm-power-activated">Activated, spending <b>${amount} Focus</b>${period}.${concentrates ? " Concentrating." : ""}</div></div>`,
  });
  return true;
}

function _buildRollFlavor({ tokenImg, actorName, powerName, ability, damageType, element, meta }) {
  let detailHtml = "";
  if (powerName) detailHtml += `<div class="mm-roll-power-name">${powerName}</div>`;
  // Action / Trigger / Duration / Cost sit directly under Power and above the
  // ability row, sharing the wrapper's font size so every line matches.
  if (meta) detailHtml += meta;
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
  // Bottom padding is 2px rather than 4px so the gap between this block and the
  // card body matches the gap between the description and the effect. The 8px
  // side padding matches .mm-chat-body, so every line shares one left edge.
  return `<div class="mm-roll-flavor"${tokenData}><div style="padding:4px 8px 2px;font-size:12px;">${detailHtml}</div>${tags}</div>`;
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
    const content = await foundry.applications.handlebars.renderTemplate(
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
      , { classes: ["dialog", "marvel-multiverse", "mm-dialog"] }).render(true);
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
const ACTOR_DEFAULT_ICONS = {
  headquarters: "systems/marvel-multiverse/icons/headquarters.svg",
};

class MarvelMultiverseActor extends Actor {
  async _preCreate(data, options, user) {
    await super._preCreate(data, options, user);
    const defaultIcon = ACTOR_DEFAULT_ICONS[data.type];
    if (defaultIcon && (!data.img || data.img === Actor.DEFAULT_ICON)) {
      this.updateSource({ img: defaultIcon });
    }
  }

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
    // Must call super: as of v14, Actor#prepareBaseData runs _clearData(),
    // which initialises tokenActiveEffectChanges and resets the ActiveEffect
    // application phases. Without it applyActiveEffects() throws and NO
    // active effect is ever applied.
    super.prepareBaseData();
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
  tag: "systems/marvel-multiverse/icons/tags.svg",
  hqTag: "systems/marvel-multiverse/icons/tags.svg",
  hqTrait: "systems/marvel-multiverse/icons/trait.svg"
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
    const speaker = ChatMessage.getSpeaker({ actor: this.actor, token: _getTokenDoc(this.actor) });
    const rollMode = game.settings.get("core", "rollMode");
    const abilityName = CONFIG.MARVEL_MULTIVERSE.damageAbility[this.system.ability];
    const tokenImg = _getTokenImg(this.actor);
    const elementKey = this.system.isElemental ? this.system.element : null;
    const flavorParts = {
      tokenImg,
      actorName: this.actor?.name,
      powerName: this.name,
      ability: abilityName ?? this.system.ability,
      damageType: this.system.damageType,
      element: elementKey,
    };
    // The description card carries the Action/Trigger/Duration/Cost block; the
    // roll message below it reuses the same flavor without, so the four lines
    // are not repeated twice in the log.
    const label = _buildRollFlavor(flavorParts);
    const cardLabel = _buildRollFlavor({ ...flavorParts, meta: _buildItemMeta(this.system) });

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
      }${
        // Same routine as the sheet control. Rendered for everyone, but the
        // listener refuses anyone who is neither an owner nor a GM, and the
        // button is hidden from them on render.
        _parseFocusCost(this.system.cost)
          ? `<div class="mm-chat-activate"><button type="button" class="mm-activate-power" data-actor-id="${this.actor?.id ?? ""}" data-item-id="${this.id}">Activate (${this.system.cost})</button></div>`
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

/**
 * The Schooling Advancement Chart. Ten boxes divide the space between one rank
 * and the next; indices 0-4 are the chart's left column and 5-9 its right
 * column, so rendering `i` beside `i + 5` reproduces the printed five rows of
 * two.
 * @type {Array<{key: string, label: string}>}
 */
MARVEL_MULTIVERSE.schoolingChart = [
  { key: "ability", label: "MARVEL_MULTIVERSE.Schooling.Reward.Ability" },
  { key: "ability", label: "MARVEL_MULTIVERSE.Schooling.Reward.Ability" },
  { key: "ability", label: "MARVEL_MULTIVERSE.Schooling.Reward.Ability" },
  { key: "ability", label: "MARVEL_MULTIVERSE.Schooling.Reward.Ability" },
  { key: "ability", label: "MARVEL_MULTIVERSE.Schooling.Reward.Ability" },
  { key: "power", label: "MARVEL_MULTIVERSE.Schooling.Reward.Power" },
  { key: "power", label: "MARVEL_MULTIVERSE.Schooling.Reward.Power" },
  { key: "power", label: "MARVEL_MULTIVERSE.Schooling.Reward.Power" },
  { key: "power", label: "MARVEL_MULTIVERSE.Schooling.Reward.Power" },
  { key: "trait", label: "MARVEL_MULTIVERSE.Schooling.Reward.Trait" },
];

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

MARVEL_MULTIVERSE.elements = {
  air: { label: "Air", fantasticEffect: "Target is knocked prone for one round.", statusId: "prone" },
  chemical: { label: "Chemical", fantasticEffect: "The target is corroding.", statusId: "corroding" },
  earth: { label: "Earth", fantasticEffect: "Target moves at half speed for one round.", statusId: "exhausted" },
  electricity: { label: "Electricity", fantasticEffect: "Stuns target for one round.", statusId: "stunned" },
  energy: { label: "Energy", fantasticEffect: "Blinds target for one round.", statusId: "blinded" },
  fire: { label: "Fire", fantasticEffect: "Sets target ablaze.", statusId: "ablaze" },
  force: { label: "Force", fantasticEffect: "Target has trouble on all actions for one round.", statusId: "demoralized" },
  hellfire: { label: "Hellfire", fantasticEffect: "Splits damage equally between Health and Focus." },
  ice: { label: "Ice", fantasticEffect: "Paralyzes target for one round.", statusId: "paralyzed" },
  iron: { label: "Iron", fantasticEffect: "Pins target for one round.", statusId: "pinned" },
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
          (el.dataset.transferred === "false" || this.author.id !== game.user.id)
        )
          el.remove();
      });

      // If the user is the message author or the actor owner, proceed
      const actor = game.actors.get(this.speaker.actor);
      if (game.user.isGM || actor?.isOwner || this.author.id === game.user.id) {
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
      nameText = this.author.name;
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
        const isMiss = !isTargetHit(attackRoll, ac);
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

    const abilityValue = actor.system.abilities[abilityAbr].value;

    // Who was targeted when the attack was rolled, not who happens to be
    // targeted now. Reading live canvas targeting here meant retargeting
    // between the attack and this click damaged the wrong actors, and it left
    // the handler with no defense value to tell a hit from a miss.
    const attackRoll = chatMessage.rolls[0];
    const declaredTargets = chatMessage.getFlag("marvel-multiverse", "targets") ?? [];
    const resolvedTargets = [];
    for (const declared of declaredTargets) {
      const targetActor = await fromUuid(declared.uuid);
      if (!targetActor) continue;
      resolvedTargets.push({
        ...declared,
        actor: targetActor,
        hit: isTargetHit(attackRoll, declared.ac),
      });
    }
    const hitActors = resolvedTargets.filter((t) => t.hit).map((t) => t.actor);

    /** Per-target amounts, recorded on the message so the button never has to read them back out of the rendered text. */
    const damageFlagTargets = [];

    const damageContent = resolvedTargets.map((t) => {
      const dmgTypeLabel = damageType ? ` ${damageType}` : "";
      if (!t.hit) {
        damageFlagTargets.push({ uuid: t.uuid, name: t.name, amount: 0, hit: false });
        return `<div class="mm-damage-target -miss" data-target-uuid="${t.uuid}">
          <p style="margin:4px 0;"><b>${t.name}</b> — <span style="color:#a00;font-weight:700;"><i class="fas fa-times"></i> Miss</span>, no damage</p>
        </div>`;
      }
      const damageReduction =
        t.actor.system[damageReductionPath(damageType)] ?? 0;
      const { amount: dmg, effectiveMultiplier } = computeDamage({
        marvelDieTotal: marvelDie.total,
        damageMultiplier,
        damageReduction,
        abilityValue,
        fantastic: !!fantastic,
      });
      damageFlagTargets.push({ uuid: t.uuid, name: t.name, amount: dmg, hit: true });
      const fantasticLabel = fantastic ? " Fantastic" : "";
      const drLine = damageReduction > 0
        ? `<br/><span style="font-size:11px;color:#555;">Multiplier ${damageMultiplier} − DR ${damageReduction} = ${effectiveMultiplier}</span>`
        : "";
      const multiplierText = damageReduction > 0
        ? `(Multiplier - DR) ${effectiveMultiplier}`
        : `Multiplier ${damageMultiplier}`;
      const fantasticMult = fantastic ? " × 2" : "";
      return `<div class="mm-damage-target" data-target-uuid="${t.uuid}">
        <p style="margin:4px 0;"><b>${t.name}</b> takes <b style="color:#8b0502;">${dmg}${fantasticLabel}${dmgTypeLabel} damage</b></p>
        <p style="font-size:11px;color:#555;margin:2px 0;">((Marvel Die ${marvelDie.total} × ${multiplierText}) + ${ability} ${abilityValue})${fantasticMult}${drLine}</p>
        <button type="button" class="mm-take-damage" data-target-uuid="${t.uuid}"><i class="fa-solid fa-heart-crack"></i> Take Damage</button>
      </div>`;
    });

    if (damageContent.length === 0) {
      // No target was declared, so there is nobody to apply the damage to and
      // the card keeps its plain form: the number, and no button.
      const { amount: dmg } = computeDamage({
        marvelDieTotal: marvelDie.total,
        damageMultiplier,
        abilityValue,
        fantastic: !!fantastic,
      });
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
          // Only targets the attack actually hit. Before the handler could tell
          // a hit from a miss it applied the status to everyone targeted.
          for (const target of hitActors) {
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
    if (damageFlagTargets.length) {
      msgData.flags = {
        "marvel-multiverse": {
          damage: {
            damageType: damageType ?? "health",
            targets: damageFlagTargets,
            applied: [],
          },
        },
      };
    }
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

function validateFormLink(primaryActor, alternateActor) {
  if (primaryActor.id === alternateActor.id) {
    return { valid: false, reason: "An actor cannot link to itself." };
  }

  const existingIds = (primaryActor.system.alternateForms ?? []).map(f => f.actorId);
  if (existingIds.includes(alternateActor.id)) {
    return { valid: false, reason: "This actor is already linked as an alternate form." };
  }

  if ((alternateActor.system.alternateForms ?? []).length > 0) {
    return { valid: false, reason: "This actor already has its own alternate forms and cannot be an alternate." };
  }

  return { valid: true };
}

function getLinkedForms(actor) {
  const alternateForms = actor.system.alternateForms ?? [];
  const primaryFormIds = actor.system.primaryFormIds ?? [];

  const isPrimary = alternateForms.length > 0;
  const isAlternate = primaryFormIds.length > 0;

  return {
    isPrimary,
    isAlternate,
    forms: alternateForms,
    primaryIds: primaryFormIds,
  };
}

async function linkForm(primaryActor, alternateActorId, formType, triggers = []) {
  const currentForms = foundry.utils.deepClone(primaryActor.system.alternateForms ?? []);
  currentForms.push({ actorId: alternateActorId, formType, triggers });
  await primaryActor.update({ "system.alternateForms": currentForms });

  const alternateActor = game.actors.get(alternateActorId);
  if (alternateActor) {
    const currentPrimaryIds = [...(alternateActor.system.primaryFormIds ?? [])];
    if (!currentPrimaryIds.includes(primaryActor.id)) {
      currentPrimaryIds.push(primaryActor.id);
      await alternateActor.update({ "system.primaryFormIds": currentPrimaryIds });
    }
  }
}

async function unlinkForm(primaryActor, alternateActorId) {
  const currentForms = (primaryActor.system.alternateForms ?? [])
    .filter(f => f.actorId !== alternateActorId);
  await primaryActor.update({ "system.alternateForms": currentForms });

  const alternateActor = game.actors.get(alternateActorId);
  if (alternateActor) {
    const currentPrimaryIds = (alternateActor.system.primaryFormIds ?? [])
      .filter(id => id !== primaryActor.id);
    await alternateActor.update({ "system.primaryFormIds": currentPrimaryIds });
  }
}

function _waitForPlaceable(tokenDoc, timeout = 2000) {
  return new Promise(resolve => {
    if (tokenDoc?.object) return resolve(tokenDoc.object);
    const start = Date.now();
    const id = setInterval(() => {
      if (tokenDoc?.object) { clearInterval(id); resolve(tokenDoc.object); }
      else if (Date.now() - start > timeout) { clearInterval(id); resolve(null); }
    }, 16);
  });
}

function _animateAlpha(placeable, from, to, duration) {
  return new Promise(resolve => {
    const start = performance.now();
    function step(now) {
      const t = Math.min((now - start) / duration, 1);
      placeable.alpha = from + (to - from) * t;
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    }
    requestAnimationFrame(step);
  });
}

async function switchForm(currentActor, targetActorId) {
  const targetActor = game.actors.get(targetActorId);
  if (!targetActor) {
    ui.notifications.warn("Target form actor not found.");
    return;
  }

  const scene = game.scenes.active;
  const currentToken = scene?.tokens.find(t => t.actorId === currentActor.id);
  if (currentToken) {
    const { x, y, elevation, rotation } = currentToken;

    const combatant = game.combat?.combatants?.find(c => c.tokenId === currentToken.id);
    const initiative = combatant?.initiative;

    const oldPlaceable = currentToken.object;

    const protoData = targetActor.prototypeToken?.toObject?.() ?? {};
    const [newToken] = await scene.createEmbeddedDocuments("Token", [{
      ...protoData,
      actorId: targetActor.id,
      x, y, elevation, rotation,
      hidden: false,
    }]);

    const newPlaceable = await _waitForPlaceable(newToken);
    const duration = 1000;

    if (oldPlaceable?.mesh && newPlaceable?.mesh) {
      newPlaceable.mesh.alpha = 0;
      await Promise.all([
        _animateAlpha(oldPlaceable.mesh, 1, 0, duration),
        _animateAlpha(newPlaceable.mesh, 0, 1, duration),
      ]);
    }

    await scene.deleteEmbeddedDocuments("Token", [currentToken.id]);

    if (combatant && game.combat && newToken) {
      const updateData = { actorId: targetActor.id, tokenId: newToken.id };
      if (initiative !== null && initiative !== undefined) {
        updateData.initiative = initiative;
      }
      await combatant.update(updateData);
    }
  }

  ChatMessage.create({
    content: `<em>${game.i18n.format("MARVEL_MULTIVERSE.AlternateForm.TransformMessage", { name: currentActor.name, form: targetActor.name })}</em>`,
    speaker: ChatMessage.getSpeaker({ actor: targetActor }),
  });

  const openSheet = Object.values(ui.windows).find(
    w => w instanceof foundry.appv1.sheets.ActorSheet && w.actor?.id === currentActor.id
  );
  if (openSheet) {
    await openSheet.close();
    targetActor.sheet.render(true);
  }
}

async function handleInvoluntaryTrigger(actor, targetActorId, trigger) {
  const targetActor = game.actors.get(targetActorId);
  if (!targetActor) return;

  if (!trigger.resistable || trigger.tn === 0) {
    await switchForm(actor, targetActorId);
    return;
  }

  const confirmed = await Dialog.confirm({
    title: game.i18n.localize("MARVEL_MULTIVERSE.AlternateForm.TriggerInvoluntary"),
    content: `<p>${game.i18n.format("MARVEL_MULTIVERSE.AlternateForm.EgoCheckPrompt", { tn: trigger.tn, name: targetActor.name })}</p>`,
    yes: () => true,
    no: () => false,
  });

  if (!confirmed) return;

  const roll = new CONFIG.Dice.MarvelMultiverseRoll(
    "{1d6,1dm,1d6}+@abilities.ego.value",
    actor.getRollData()
  );
  await roll.evaluate();

  const speaker = ChatMessage.getSpeaker({ actor });
  if (roll.total >= trigger.tn) {
    await roll.toMessage({
      speaker,
      flavor: `<em>${game.i18n.format("MARVEL_MULTIVERSE.AlternateForm.EgoCheckSuccess", { name: actor.name })}</em>`,
    });
  } else {
    await roll.toMessage({
      speaker,
      flavor: `<em>${game.i18n.format("MARVEL_MULTIVERSE.AlternateForm.EgoCheckFailure", { name: actor.name })}</em>`,
    });
    await switchForm(actor, targetActorId);
  }
}

/**
 * Extend the basic actor sheet with some very simple modifications
 * @extends {foundry.appv1.sheets.ActorSheet}
 */
class MarvelMultiverseCharacterSheet extends foundry.appv1.sheets.ActorSheet {
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
        {
          navSelector: ".mm-subtabs",
          contentSelector: ".mm-bio-body",
          initial: "details",
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
  async getData() {
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

    // Only an owner or a GM sees the activate control on a power.
    context.canActivatePowers = _canActivatePowers(this.actor);
    context.concentrating = _heldConcentrations(this.actor);

    // Ten schooling boxes, labelled from the printed chart. Bound directly to
    // the schema path so the stock sheet submit persists them.
    const schoolingBoxes = this.actor.system.schooling.boxes;
    context.schoolingBoxes = CONFIG.MARVEL_MULTIVERSE.schoolingChart.map((reward, i) => ({
      index: i,
      name: `system.schooling.boxes.box${i}`,
      label: game.i18n.localize(reward.label),
      checked: schoolingBoxes[`box${i}`],
    }));

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

    const named = CONFIG.MARVEL_MULTIVERSE.namedTeamManeuvers;
    const sources = [...new Set(named.map(m => m.source))];

    context.teamManeuverOptions = {
      generic: CONFIG.MARVEL_MULTIVERSE.teamManeuvers.map(tm => ({
        value: `generic:${tm.maneuverType.toLowerCase()}`,
        label: tm.maneuverType,
      })),
      groups: sources.map(source => ({
        label: named.find(m => m.source === source)?.sourceLabel || source,
        options: named.filter(m => m.source === source)
          .map(m => ({ value: `named:${m.key}`, label: `${m.team}: ${m.name}` })),
      })),
    };

    const tm = context.system.teamManeuver;
    context.teamManeuverSelected = tm.named
      ? `named:${tm.named}`
      : tm.maneuverType
        ? `generic:${tm.maneuverType}`
        : "";

    context.teamManeuverLevels = Object.fromEntries(
      [1, 2, 3].map((tml) => [tml, tml.toString()])
    );
    context.showLevelPicker = !tm.named && !!tm.maneuverType;

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

    context.enableAlternateForms = game.settings.get("marvel-multiverse", "enableAlternateForms");
    if (context.enableAlternateForms) {
      const alternateForms = this.actor.system.alternateForms ?? [];
      const primaryFormIds = this.actor.system.primaryFormIds ?? [];
      const isPrimary = alternateForms.length > 0;
      const isAlternate = primaryFormIds.length > 0;

      const formTypeLabels = {
        cosmetic: game.i18n.localize("MARVEL_MULTIVERSE.AlternateForm.Cosmetic"),
        powerDown: game.i18n.localize("MARVEL_MULTIVERSE.AlternateForm.PowerDown"),
        powerSwap: game.i18n.localize("MARVEL_MULTIVERSE.AlternateForm.PowerSwap"),
      };

      const forms = alternateForms.map(f => {
        const actor = game.actors.get(f.actorId);
        const triggerSummary = f.triggers?.length
          ? "Triggers: " + f.triggers.map(t => t.description).join(", ")
          : "";
        return {
          ...f,
          actor: actor ? { id: actor.id, name: actor.name, img: actor.img } : { id: f.actorId, name: "(Deleted)", img: "icons/svg/mystery-man.svg" },
          formTypeLabel: formTypeLabels[f.formType] ?? f.formType,
          triggerSummary,
        };
      });

      const primaryActors = primaryFormIds.map(id => {
        const actor = game.actors.get(id);
        const formEntry = actor?.system.alternateForms?.find(f => f.actorId === this.actor.id);
        return {
          id,
          name: actor?.name ?? "(Deleted)",
          img: actor?.img ?? "icons/svg/mystery-man.svg",
          formTypeLabel: formTypeLabels[formEntry?.formType] ?? "",
        };
      });

      context.formData = { isPrimary, isAlternate, forms, primaryActors };
    }

    // Rich text is shown enriched so content links, inline rolls and the
    // roll links registered by this system all work on the sheet.
    context.enriched = await enrichSheetFields(this.actor, {
      rollData: context.rollData,
    });

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
    const battleSuits = [];
    const origins = [];
    const occupations = [];
    const weapons = [];
    const traits = [];
    const tags = [];
    const powers = {};
    const equipment = [];

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
        const pc = i.system.powers?.length ?? 0;
        const rc = i.system.restrictions?.length ?? 0;
        i.powerValue = (pc === 0 && rc === 0) ? 0 : Math.max(1, pc - rc);
        iconicItems.push(i);
      } else if (i.type === "battleSuit") {
        const pc = i.system.powers?.length ?? 0;
        const rc = i.system.restrictions?.length ?? 0;
        i.powerValue = (pc === 0 && rc === 0) ? 0 : Math.max(1, pc - rc);
        const parts = [];
        const abilityLabels = { melee: "Mel", agility: "Agl", resilience: "Res", vigilance: "Vig", ego: "Ego", logic: "Log" };
        for (const [key, label] of Object.entries(abilityLabels)) {
          const mod = i.system.abilityModifiers?.[key] ?? 0;
          if (mod !== 0) parts.push(`${label} ${mod > 0 ? "+" : ""}${mod}`);
        }
        if (i.system.rankIncrease > 0) parts.push(`Rank +${i.system.rankIncrease}`);
        i.modifiersSummary = parts.length ? parts.join(", ") : "";
        battleSuits.push(i);
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
      } else if (i.type === "equipment") {
        i.equipmentTypeLabel = game.i18n.localize(
          CONFIG.MARVEL_MULTIVERSE.equipmentTypes[i.system.equipmentType] ?? ""
        );
        if (i.system.grenadeType) {
          i.grenadeTypeLabel = game.i18n.localize(
            CONFIG.MARVEL_MULTIVERSE.grenadeTypes[i.system.grenadeType] ?? ""
          );
        }
        equipment.push(i);
      }

      // Assign and return
      context.gear = gear;
      context.iconicItems = iconicItems;
      context.battleSuits = battleSuits;
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
      context.equipment = equipment;
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



    // Restore Health or Focus to its maximum.
    html.on("click", ".mm-stat-reset", async (ev) => {
      ev.preventDefault();
      const key = ev.currentTarget.dataset.reset;
      const max = this.actor.system?.[key]?.max;
      // max is derived, so it is a number whenever the field exists at all.
      if (typeof max !== "number") return;
      await this.actor.update({ [`system.${key}.value`]: max });
    });

    // Stop concentrating on a power. Costs no action, per the rulebook.
    html.on("click", ".power-end-concentration", async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const itemId = ev.currentTarget.dataset.itemId;
      await _endConcentration(this.actor, itemId, { reason: "ended voluntarily" });
    });
    // Spend a power's Focus cost from the sheet.
    html.on("click", ".power-activate", async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const itemId = ev.currentTarget.dataset.itemId ?? $(ev.currentTarget).parents(".item").data("itemId");
      const item = this.actor.items.get(itemId);
      if (item) await _activatePower(this.actor, item);
    });
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
    html.on("click", ".item-delete", async (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const itemId = li.data("itemId");
      const item = this.actor.items.get(itemId);
      if (item?.type === "battleSuit" && item.system.equipped) {
        await this._removeBattleSuitEffects(itemId);
      }
      if (item?.type === "equipment" && item.system.equipped) {
        await this._removeEquipmentEffects(itemId);
      }
      this.actor.deleteEmbeddedDocuments("Item", [itemId]);
      li.slideUp(200, () => this.render(false));
    });

    // Iconic item ownership toggle
    html.on("change", ".iconic-ownership-toggle", async (ev) => {
      const itemId = ev.currentTarget.dataset.itemId;
      const item = this.actor.items.get(itemId);
      if (item) await item.update({ "system.ownershipMode": ev.currentTarget.value });
    });

    // Battle suit equip toggle
    html.on("click", ".battlesuit-equip-toggle", this._onToggleBattleSuitEquip.bind(this));

    // Equipment equip toggle
    html.on("click", ".equipment-equip-toggle", this._onToggleEquipmentEquip.bind(this));

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

      // Ability and non-combat checks are not embedded documents, so core's
      // _onDragStart has nothing to describe them with. They carry their own
      // drag payload instead.
      const checkHandler = (ev) => this._onDragCheckStart(ev);
      html
        .find('[data-roll-type="ability"], [data-roll-type="noncom"]')
        .each((i, el) => {
          el.setAttribute("draggable", true);
          el.addEventListener("dragstart", checkHandler, false);
        });
    }

    // Alternate Forms
    html.on("click", ".alternate-form-switch", async (ev) => {
      const targetActorId = ev.currentTarget.dataset.actorId;
      await switchForm(this.actor, targetActorId);
    });

    html.on("click", ".alternate-form-unlink", async (ev) => {
      const targetActorId = ev.currentTarget.dataset.actorId;
      await unlinkForm(this.actor, targetActorId);
      this.render(false);
    });

    html.on("click", ".alternate-form-edit", async (ev) => {
      const targetActorId = ev.currentTarget.dataset.actorId;
      const targetActor = game.actors.get(targetActorId);
      if (targetActor) targetActor.sheet.render(true);
    });

    html.on("click", ".alternate-form-add", async () => {
      this._onAddAlternateForm();
    });
  }

  async _onAddAlternateForm() {
    const formTypes = {};
    for (const [key, label] of Object.entries(CONFIG.MARVEL_MULTIVERSE.alternateFormTypes)) {
      formTypes[key] = game.i18n.localize(label);
    }

    const availableActors = game.actors.filter(a => {
      if (a.id === this.actor.id) return false;
      if (!["character", "npc"].includes(a.type)) return false;
      if ((a.system.alternateForms ?? []).length > 0) return false;
      return true;
    });

    const content = await foundry.applications.handlebars.renderTemplate(
      "systems/marvel-multiverse/templates/dialogs/add-form-dialog.hbs",
      { availableActors, formTypes, triggers: [] }
    );

    new Dialog({
      title: game.i18n.localize("MARVEL_MULTIVERSE.AlternateForm.AddForm"),
      content,
      buttons: {
        add: {
          icon: '<i class="fas fa-plus"></i>',
          label: game.i18n.localize("MARVEL_MULTIVERSE.AlternateForm.AddForm"),
          callback: async (html) => {
            const actorId = html.find('select[name="actorId"]').val();
            const formType = html.find('select[name="formType"]').val();
            if (!actorId) return;

            const triggers = [];
            html.find(".trigger-row").each((i, row) => {
              const desc = $(row).find('input[name^="triggers"][name$=".description"]').val();
              const resistable = $(row).find('input[name^="triggers"][name$=".resistable"]').is(":checked");
              const tn = Number($(row).find('input[name^="triggers"][name$=".tn"]').val()) || 0;
              if (desc) triggers.push({ description: desc, resistable, tn });
            });

            const alternateActor = game.actors.get(actorId);
            const validation = validateFormLink(this.actor, alternateActor);
            if (!validation.valid) {
              ui.notifications.warn(validation.reason);
              return;
            }

            await linkForm(this.actor, actorId, formType, triggers);
            this.render(false);
          },
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel",
        },
      },
      default: "add",
      render: (html) => {
        html.find(".trigger-add").on("click", () => {
          const list = html.find(".trigger-list");
          const idx = list.find(".trigger-row").length;
          list.append(`
            <div class="trigger-row flexrow" data-index="${idx}">
              <input type="text" name="triggers.${idx}.description" value="" placeholder="e.g., Anger, Full Moon" />
              <label><input type="checkbox" name="triggers.${idx}.resistable" checked /> Resistable</label>
              <input type="number" name="triggers.${idx}.tn" value="0" min="0" placeholder="TN" style="width:60px" />
              <a class="trigger-remove" data-index="${idx}"><i class="fas fa-trash"></i></a>
            </div>
          `);
        });
        html.on("click", ".trigger-remove", (ev) => {
          $(ev.currentTarget).closest(".trigger-row").remove();
        });
      },
    }, { classes: ["dialog", "marvel-multiverse", "mm-dialog"] }).render(true);
  }

  /**
   * Build the hotbar drag payload for an ability or non-combat check.
   * @param {DragEvent} event   The originating dragstart event
   * @private
   */
  _onDragCheckStart(event) {
    const { rollType, abilityKey } = event.currentTarget.dataset;
    if (!abilityKey) return;
    event.dataTransfer.setData(
      "text/plain",
      JSON.stringify({
        type: "MarvelMultiverseCheck",
        actorUuid: this.actor.uuid,
        rollType,
        abilityKey,
      })
    );
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

  async _onToggleBattleSuitEquip(event) {
    event.preventDefault();
    const itemId = event.currentTarget.dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (!item) return;

    if (item.system.equipped) {
      await this._removeBattleSuitEffects(itemId);
      await item.update({ "system.equipped": false });
    } else {
      for (const other of this.actor.items.filter(i => i.type === "battleSuit" && i.system.equipped)) {
        await this._removeBattleSuitEffects(other.id);
        await other.update({ "system.equipped": false });
      }
      await item.update({ "system.equipped": true });
      await this._applyBattleSuitEffects(item);
    }
  }

  async _removeBattleSuitEffects(itemId) {
    const effects = this.actor.effects.filter(e => e.flags?.["marvel-multiverse"]?.battleSuitId === itemId);
    if (effects.length) {
      await this.actor.deleteEmbeddedDocuments("ActiveEffect", effects.map(e => e.id));
    }
  }

  async _applyBattleSuitEffects(item) {
    const abilityMap = { melee: "mle", agility: "agl", resilience: "res", vigilance: "vig", ego: "ego", logic: "log" };
    const changes = [];
    for (const [suitKey, actorKey] of Object.entries(abilityMap)) {
      const mod = item.system.abilityModifiers[suitKey];
      if (mod !== 0) {
        changes.push({ key: `system.abilities.${actorKey}.value`, mode: 2, value: mod.toString() });
      }
    }
    if (item.system.rankIncrease > 0) {
      changes.push({ key: "system.attributes.rank.value", mode: 2, value: item.system.rankIncrease.toString() });
    }
    if (changes.length) {
      await ActiveEffect.create({
        name: `Battle Suit: ${item.name}`,
        img: item.img,
        changes: changes,
        flags: { "marvel-multiverse": { battleSuitId: item.id } }
      }, { parent: this.actor });
    }
  }

  async _onToggleEquipmentEquip(event) {
    event.preventDefault();
    const itemId = event.currentTarget.dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (!item) return;

    if (item.system.equipped) {
      await this._removeEquipmentEffects(itemId);
      await item.update({ "system.equipped": false });
    } else {
      await item.update({ "system.equipped": true });
      if (item.system.equipmentType === "protection" && !item.system.ruined && item.system.damageReduction > 0) {
        await this._applyEquipmentEffects(item);
      }
    }
  }

  async _removeEquipmentEffects(itemId) {
    const effects = this.actor.effects.filter(e => e.flags?.["marvel-multiverse"]?.equipmentId === itemId);
    if (effects.length) {
      await this.actor.deleteEmbeddedDocuments("ActiveEffect", effects.map(e => e.id));
    }
  }

  async _applyEquipmentEffects(item) {
    const changes = [{
      key: "system.healthDamageReduction",
      mode: 2,
      value: item.system.damageReduction.toString(),
    }];
    await ActiveEffect.create({
      name: `Equipment: ${item.name}`,
      img: item.img,
      changes: changes,
      flags: { "marvel-multiverse": { equipmentId: item.id } },
    }, { parent: this.actor });
  }

  async _updateObject(event, formData) {
    const selection = formData["system.teamManeuver._selection"];
    if (selection !== undefined) {
      delete formData["system.teamManeuver._selection"];
      if (selection.startsWith("generic:")) {
        formData["system.teamManeuver.maneuverType"] = selection.slice(8);
        formData["system.teamManeuver.named"] = "";
      } else if (selection.startsWith("named:")) {
        formData["system.teamManeuver.named"] = selection.slice(6);
        formData["system.teamManeuver.maneuverType"] = "";
        formData["system.teamManeuver.level"] = null;
      } else {
        formData["system.teamManeuver.maneuverType"] = "";
        formData["system.teamManeuver.named"] = "";
        formData["system.teamManeuver.level"] = null;
      }
    }
    return super._updateObject(event, formData);
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
      // Shared with the hotbar macro so a dragged check rolls identically.
      if (dataset.rollType === "ability" || dataset.rollType === "noncom") {
        return rollAbilityCheck(this.actor, dataset.abilityKey, {
          noncom: dataset.rollType === "noncom",
        });
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

      const speaker = ChatMessage.getSpeaker({ actor: this.actor, token: _getTokenDoc(this.actor) });
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

class MarvelMultiverseVehicleSheet extends foundry.appv1.sheets.ActorSheet {
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

  async getData() {
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

    // Rich text is shown enriched so content links, inline rolls and the
    // roll links registered by this system all work on the sheet.
    context.enriched = await enrichSheetFields(this.actor, {
      rollData: context.rollData,
    });

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

class MarvelMultiverseHeadquartersSheet extends foundry.appv1.sheets.ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["marvel-multiverse", "sheet", "actor"],
      width: 690,
      height: 700,
      tabs: [],
    });
  }

  get template() {
    return "systems/marvel-multiverse/templates/actor/actor-headquarters-sheet.hbs";
  }

  async getData() {
    const context = super.getData();
    const actorData = context.data;
    context.system = this.actor.system;
    context.flags = actorData.flags;
    this._prepareItems(context);
    this._prepareMembers(context);
    context.sources = CONFIG.MARVEL_MULTIVERSE.sources;
    context.rollData = context.actor.getRollData();
    // Rich text is shown enriched so content links, inline rolls and the
    // roll links registered by this system all work on the sheet.
    context.enriched = await enrichSheetFields(this.actor, {
      rollData: context.rollData,
    });

    return context;
  }

  _prepareItems(context) {
    const hqTags = [];
    const hqTraits = [];
    for (const i of context.items) {
      i.img = i.img || Item.DEFAULT_ICON;
      if (i.type === "hqTag") hqTags.push(i);
      else if (i.type === "hqTrait") hqTraits.push(i);
    }
    hqTags.sort((a, b) => a.name.localeCompare(b.name));
    hqTraits.sort((a, b) => a.name.localeCompare(b.name));
    context.hqTags = hqTags;
    context.hqTraits = hqTraits;
  }

  _prepareMembers(context) {
    context.members = context.system.members.map(m => {
      const actor = game.actors?.get(m.actorId);
      return {
        actorId: m.actorId,
        name: actor?.name ?? m.name,
        img: actor?.img ?? m.img,
        rank: actor?.system?.attributes?.rank?.value ?? "?",
      };
    });
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.on("click", ".item-edit", (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.sheet.render(true);
    });
    if (!this.isEditable) return;
    html.on("click", ".item-delete", (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      this.actor.deleteEmbeddedDocuments("Item", [li.data("itemId")]);
      li.slideUp(200, () => this.render(false));
    });
    html.on("click", ".member-delete", this._onMemberDelete.bind(this));
  }

  async _onMemberDelete(event) {
    event.preventDefault();
    const index = Number(event.currentTarget.dataset.index);
    const members = foundry.utils.deepClone(this.actor.system.members);
    members.splice(index, 1);
    await this.actor.update({ "system.members": members });
  }

  async _onDropActor(event, data) {
    if (!this.isEditable) return;
    const actor = await Actor.implementation.fromDropData(data);
    if (!actor) return;
    if (!["character", "npc"].includes(actor.type)) {
      ui.notifications.warn("Only characters and NPCs can be added as team members.");
      return;
    }
    const members = foundry.utils.deepClone(this.actor.system.members);
    if (members.some(m => m.actorId === actor.id)) {
      ui.notifications.warn(`${actor.name} ${game.i18n.localize("MARVEL_MULTIVERSE.Headquarters.MemberAlreadyAdded")}`);
      return;
    }
    members.push({ actorId: actor.id, name: actor.name, img: actor.img });
    await this.actor.update({ "system.members": members });
  }

  async _onDropItemCreate(itemData) {
    const allowedTypes = ["hqTag", "hqTrait"];
    const items = Array.isArray(itemData) ? itemData : [itemData];
    for (const item of items) {
      if (!allowedTypes.includes(item.type)) {
        ui.notifications.warn(`Headquarters cannot hold ${item.type} items.`);
        return;
      }
      if (item.type === "hqTag") {
        const incomingIncompat = (item.system?.incompatible ?? "").split(",").map(s => s.trim()).filter(Boolean);
        const existingTags = this.actor.items.filter(i => i.type === "hqTag");
        for (const existing of existingTags) {
          const existingIncompat = (existing.system?.incompatible ?? "").split(",").map(s => s.trim()).filter(Boolean);
          if (incomingIncompat.includes(existing.name) || existingIncompat.includes(item.name)) {
            ui.notifications.warn(
              `${item.name} ${game.i18n.localize("MARVEL_MULTIVERSE.Headquarters.IncompatibleTag")} ${existing.name}.`
            );
            return;
          }
        }
      }
    }
    return super._onDropItemCreate(itemData);
  }
}

/**
 * Extend the basic actor sheet with some very simple modifications
 * @extends {foundry.appv1.sheets.ActorSheet}
 */
class MarvelMultiverseNPCSheet extends foundry.appv1.sheets.ActorSheet {
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
  async getData() {
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

    // Only an owner or a GM sees the activate control on a power.
    context.canActivatePowers = _canActivatePowers(this.actor);
    context.concentrating = _heldConcentrations(this.actor);

    context.sizeSelection = Object.fromEntries(
      Object.keys(CONFIG.MARVEL_MULTIVERSE.sizes).map((key) => [
        key,
        game.i18n.localize(CONFIG.MARVEL_MULTIVERSE.sizes[key].label),
      ])
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

    context.enableAlternateForms = game.settings.get("marvel-multiverse", "enableAlternateForms");
    if (context.enableAlternateForms) {
      const alternateForms = this.actor.system.alternateForms ?? [];
      const primaryFormIds = this.actor.system.primaryFormIds ?? [];
      const isPrimary = alternateForms.length > 0;
      const isAlternate = primaryFormIds.length > 0;

      const formTypeLabels = {
        cosmetic: game.i18n.localize("MARVEL_MULTIVERSE.AlternateForm.Cosmetic"),
        powerDown: game.i18n.localize("MARVEL_MULTIVERSE.AlternateForm.PowerDown"),
        powerSwap: game.i18n.localize("MARVEL_MULTIVERSE.AlternateForm.PowerSwap"),
      };

      const forms = alternateForms.map(f => {
        const actor = game.actors.get(f.actorId);
        const triggerSummary = f.triggers?.length
          ? "Triggers: " + f.triggers.map(t => t.description).join(", ")
          : "";
        return {
          ...f,
          actor: actor ? { id: actor.id, name: actor.name, img: actor.img } : { id: f.actorId, name: "(Deleted)", img: "icons/svg/mystery-man.svg" },
          formTypeLabel: formTypeLabels[f.formType] ?? f.formType,
          triggerSummary,
        };
      });

      const primaryActors = primaryFormIds.map(id => {
        const actor = game.actors.get(id);
        const formEntry = actor?.system.alternateForms?.find(f => f.actorId === this.actor.id);
        return {
          id,
          name: actor?.name ?? "(Deleted)",
          img: actor?.img ?? "icons/svg/mystery-man.svg",
          formTypeLabel: formTypeLabels[formEntry?.formType] ?? "",
        };
      });

      context.formData = { isPrimary, isAlternate, forms, primaryActors };
    }

    // Rich text is shown enriched so content links, inline rolls and the
    // roll links registered by this system all work on the sheet.
    context.enriched = await enrichSheetFields(this.actor, {
      rollData: context.rollData,
    });

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
    const battleSuits = [];
    const traits = [];
    const origins = [];
    const occupations = [];
    const tags = [];
    const weapons = [];
    const powers = {};
    const equipment = [];

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
        const pc = i.system.powers?.length ?? 0;
        const rc = i.system.restrictions?.length ?? 0;
        i.powerValue = (pc === 0 && rc === 0) ? 0 : Math.max(1, pc - rc);
        iconicItems.push(i);
      } else if (i.type === "battleSuit") {
        const pc = i.system.powers?.length ?? 0;
        const rc = i.system.restrictions?.length ?? 0;
        i.powerValue = (pc === 0 && rc === 0) ? 0 : Math.max(1, pc - rc);
        const parts = [];
        const abilityLabels = { melee: "Mel", agility: "Agl", resilience: "Res", vigilance: "Vig", ego: "Ego", logic: "Log" };
        for (const [key, label] of Object.entries(abilityLabels)) {
          const mod = i.system.abilityModifiers?.[key] ?? 0;
          if (mod !== 0) parts.push(`${label} ${mod > 0 ? "+" : ""}${mod}`);
        }
        if (i.system.rankIncrease > 0) parts.push(`Rank +${i.system.rankIncrease}`);
        i.modifiersSummary = parts.length ? parts.join(", ") : "";
        battleSuits.push(i);
      } else if (i.type === "item") {
        gear.push(i);
      } else if (i.type === "weapon") {
        weapons.push(i);
      } else if (i.type === "equipment") {
        i.equipmentTypeLabel = game.i18n.localize(
          CONFIG.MARVEL_MULTIVERSE.equipmentTypes[i.system.equipmentType] ?? ""
        );
        if (i.system.grenadeType) {
          i.grenadeTypeLabel = game.i18n.localize(
            CONFIG.MARVEL_MULTIVERSE.grenadeTypes[i.system.grenadeType] ?? ""
          );
        }
        equipment.push(i);
      }

      // Assign and return
      context.gear = gear;
      context.iconicItems = iconicItems;
      context.battleSuits = battleSuits;
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
      context.equipment = equipment;
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



    // Restore Health or Focus to its maximum.
    html.on("click", ".mm-stat-reset", async (ev) => {
      ev.preventDefault();
      const key = ev.currentTarget.dataset.reset;
      const max = this.actor.system?.[key]?.max;
      // max is derived, so it is a number whenever the field exists at all.
      if (typeof max !== "number") return;
      await this.actor.update({ [`system.${key}.value`]: max });
    });

    // Stop concentrating on a power. Costs no action, per the rulebook.
    html.on("click", ".power-end-concentration", async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const itemId = ev.currentTarget.dataset.itemId;
      await _endConcentration(this.actor, itemId, { reason: "ended voluntarily" });
    });
    // Spend a power's Focus cost from the sheet.
    html.on("click", ".power-activate", async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const itemId = ev.currentTarget.dataset.itemId ?? $(ev.currentTarget).parents(".item").data("itemId");
      const item = this.actor.items.get(itemId);
      if (item) await _activatePower(this.actor, item);
    });
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
    html.on("click", ".item-delete", async (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const itemId = li.data("itemId");
      const item = this.actor.items.get(itemId);
      if (item?.type === "battleSuit" && item.system.equipped) {
        await this._removeBattleSuitEffects(itemId);
      }
      if (item?.type === "equipment" && item.system.equipped) {
        await this._removeEquipmentEffects(itemId);
      }
      this.actor.deleteEmbeddedDocuments("Item", [itemId]);
      li.slideUp(200, () => this.render(false));
    });

    // Iconic item ownership toggle
    html.on("change", ".iconic-ownership-toggle", async (ev) => {
      const itemId = ev.currentTarget.dataset.itemId;
      const item = this.actor.items.get(itemId);
      if (item) await item.update({ "system.ownershipMode": ev.currentTarget.value });
    });

    // Battle suit equip toggle
    html.on("click", ".battlesuit-equip-toggle", this._onToggleBattleSuitEquip.bind(this));

    // Equipment equip toggle
    html.on("click", ".equipment-equip-toggle", this._onToggleEquipmentEquip.bind(this));

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

      // Ability and non-combat checks are not embedded documents, so core's
      // _onDragStart has nothing to describe them with. They carry their own
      // drag payload instead.
      const checkHandler = (ev) => this._onDragCheckStart(ev);
      html
        .find('[data-roll-type="ability"], [data-roll-type="noncom"]')
        .each((i, el) => {
          el.setAttribute("draggable", true);
          el.addEventListener("dragstart", checkHandler, false);
        });
    }

    // Alternate Forms
    html.on("click", ".alternate-form-switch", async (ev) => {
      const targetActorId = ev.currentTarget.dataset.actorId;
      await switchForm(this.actor, targetActorId);
    });

    html.on("click", ".alternate-form-unlink", async (ev) => {
      const targetActorId = ev.currentTarget.dataset.actorId;
      await unlinkForm(this.actor, targetActorId);
      this.render(false);
    });

    html.on("click", ".alternate-form-edit", async (ev) => {
      const targetActorId = ev.currentTarget.dataset.actorId;
      const targetActor = game.actors.get(targetActorId);
      if (targetActor) targetActor.sheet.render(true);
    });

    html.on("click", ".alternate-form-add", async () => {
      this._onAddAlternateForm();
    });
  }

  async _onAddAlternateForm() {
    const formTypes = {};
    for (const [key, label] of Object.entries(CONFIG.MARVEL_MULTIVERSE.alternateFormTypes)) {
      formTypes[key] = game.i18n.localize(label);
    }

    const availableActors = game.actors.filter(a => {
      if (a.id === this.actor.id) return false;
      if (!["character", "npc"].includes(a.type)) return false;
      if ((a.system.alternateForms ?? []).length > 0) return false;
      return true;
    });

    const content = await foundry.applications.handlebars.renderTemplate(
      "systems/marvel-multiverse/templates/dialogs/add-form-dialog.hbs",
      { availableActors, formTypes, triggers: [] }
    );

    new Dialog({
      title: game.i18n.localize("MARVEL_MULTIVERSE.AlternateForm.AddForm"),
      content,
      buttons: {
        add: {
          icon: '<i class="fas fa-plus"></i>',
          label: game.i18n.localize("MARVEL_MULTIVERSE.AlternateForm.AddForm"),
          callback: async (html) => {
            const actorId = html.find('select[name="actorId"]').val();
            const formType = html.find('select[name="formType"]').val();
            if (!actorId) return;

            const triggers = [];
            html.find(".trigger-row").each((i, row) => {
              const desc = $(row).find('input[name^="triggers"][name$=".description"]').val();
              const resistable = $(row).find('input[name^="triggers"][name$=".resistable"]').is(":checked");
              const tn = Number($(row).find('input[name^="triggers"][name$=".tn"]').val()) || 0;
              if (desc) triggers.push({ description: desc, resistable, tn });
            });

            const alternateActor = game.actors.get(actorId);
            const validation = validateFormLink(this.actor, alternateActor);
            if (!validation.valid) {
              ui.notifications.warn(validation.reason);
              return;
            }

            await linkForm(this.actor, actorId, formType, triggers);
            this.render(false);
          },
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel",
        },
      },
      default: "add",
      render: (html) => {
        html.find(".trigger-add").on("click", () => {
          const list = html.find(".trigger-list");
          const idx = list.find(".trigger-row").length;
          list.append(`
            <div class="trigger-row flexrow" data-index="${idx}">
              <input type="text" name="triggers.${idx}.description" value="" placeholder="e.g., Anger, Full Moon" />
              <label><input type="checkbox" name="triggers.${idx}.resistable" checked /> Resistable</label>
              <input type="number" name="triggers.${idx}.tn" value="0" min="0" placeholder="TN" style="width:60px" />
              <a class="trigger-remove" data-index="${idx}"><i class="fas fa-trash"></i></a>
            </div>
          `);
        });
        html.on("click", ".trigger-remove", (ev) => {
          $(ev.currentTarget).closest(".trigger-row").remove();
        });
      },
    }, { classes: ["dialog", "marvel-multiverse", "mm-dialog"] }).render(true);
  }

  /**
   * Build the hotbar drag payload for an ability or non-combat check.
   * @param {DragEvent} event   The originating dragstart event
   * @private
   */
  _onDragCheckStart(event) {
    const { rollType, abilityKey } = event.currentTarget.dataset;
    if (!abilityKey) return;
    event.dataTransfer.setData(
      "text/plain",
      JSON.stringify({
        type: "MarvelMultiverseCheck",
        actorUuid: this.actor.uuid,
        rollType,
        abilityKey,
      })
    );
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

  async _onToggleBattleSuitEquip(event) {
    event.preventDefault();
    const itemId = event.currentTarget.dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (!item) return;

    if (item.system.equipped) {
      await this._removeBattleSuitEffects(itemId);
      await item.update({ "system.equipped": false });
    } else {
      for (const other of this.actor.items.filter(i => i.type === "battleSuit" && i.system.equipped)) {
        await this._removeBattleSuitEffects(other.id);
        await other.update({ "system.equipped": false });
      }
      await item.update({ "system.equipped": true });
      await this._applyBattleSuitEffects(item);
    }
  }

  async _removeBattleSuitEffects(itemId) {
    const effects = this.actor.effects.filter(e => e.flags?.["marvel-multiverse"]?.battleSuitId === itemId);
    if (effects.length) {
      await this.actor.deleteEmbeddedDocuments("ActiveEffect", effects.map(e => e.id));
    }
  }

  async _applyBattleSuitEffects(item) {
    const abilityMap = { melee: "mle", agility: "agl", resilience: "res", vigilance: "vig", ego: "ego", logic: "log" };
    const changes = [];
    for (const [suitKey, actorKey] of Object.entries(abilityMap)) {
      const mod = item.system.abilityModifiers[suitKey];
      if (mod !== 0) {
        changes.push({ key: `system.abilities.${actorKey}.value`, mode: 2, value: mod.toString() });
      }
    }
    if (item.system.rankIncrease > 0) {
      changes.push({ key: "system.attributes.rank.value", mode: 2, value: item.system.rankIncrease.toString() });
    }
    if (changes.length) {
      await ActiveEffect.create({
        name: `Battle Suit: ${item.name}`,
        img: item.img,
        changes: changes,
        flags: { "marvel-multiverse": { battleSuitId: item.id } }
      }, { parent: this.actor });
    }
  }

  async _onToggleEquipmentEquip(event) {
    event.preventDefault();
    const itemId = event.currentTarget.dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (!item) return;

    if (item.system.equipped) {
      await this._removeEquipmentEffects(itemId);
      await item.update({ "system.equipped": false });
    } else {
      await item.update({ "system.equipped": true });
      if (item.system.equipmentType === "protection" && !item.system.ruined && item.system.damageReduction > 0) {
        await this._applyEquipmentEffects(item);
      }
    }
  }

  async _removeEquipmentEffects(itemId) {
    const effects = this.actor.effects.filter(e => e.flags?.["marvel-multiverse"]?.equipmentId === itemId);
    if (effects.length) {
      await this.actor.deleteEmbeddedDocuments("ActiveEffect", effects.map(e => e.id));
    }
  }

  async _applyEquipmentEffects(item) {
    const changes = [{
      key: "system.healthDamageReduction",
      mode: 2,
      value: item.system.damageReduction.toString(),
    }];
    await ActiveEffect.create({
      name: `Equipment: ${item.name}`,
      img: item.img,
      changes: changes,
      flags: { "marvel-multiverse": { equipmentId: item.id } },
    }, { parent: this.actor });
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
      // Shared with the hotbar macro so a dragged check rolls identically.
      if (dataset.rollType === "ability" || dataset.rollType === "noncom") {
        return rollAbilityCheck(this.actor, dataset.abilityKey, {
          noncom: dataset.rollType === "noncom",
        });
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
        speaker: ChatMessage.getSpeaker({ actor: this.actor, token: _getTokenDoc(this.actor) }),
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
 * Extend the basic item sheet with some very simple modifications
 * @extends {foundry.appv1.sheets.ItemSheet}
 */
class MarvelMultiverseItemSheet extends foundry.appv1.sheets.ItemSheet {
  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(foundry.appv1.sheets.ItemSheet.defaultOptions, {
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
  async getData() {
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
    if (itemData.type === "battleSuit") {
      context.restrictionKinds = CONFIG.MARVEL_MULTIVERSE.restrictionKinds;
      const powersCount = context.system.powers?.length ?? 0;
      const restrictionsCount = context.system.restrictions?.length ?? 0;
      context.powerValue = (powersCount === 0 && restrictionsCount === 0) ? 0 : Math.max(1, powersCount - restrictionsCount);
      context.sortedPowers = (context.system.powers ?? [])
        .map((p, idx) => ({ ...p, _origIndex: idx }))
        .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
      context.sortedRestrictions = (context.system.restrictions ?? [])
        .map((r, idx) => ({ ...r, _origIndex: idx }))
        .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
      context.sortedIntegratedIconicItems = (context.system.integratedIconicItems ?? [])
        .map((ii, idx) => ({ ...ii, _origIndex: idx }))
        .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
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
      context.powerValue = (powersCount === 0 && restrictionsCount === 0) ? 0 : Math.max(1, powersCount - restrictionsCount);
      context.sortedPowers = (context.system.powers ?? [])
        .map((p, idx) => ({ ...p, _origIndex: idx }))
        .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
      context.sortedRestrictions = (context.system.restrictions ?? [])
        .map((r, idx) => ({ ...r, _origIndex: idx }))
        .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    }
    if (itemData.type === "equipment") {
      context.equipmentTypes = Object.fromEntries(
        Object.keys(CONFIG.MARVEL_MULTIVERSE.equipmentTypes).map((k) => [
          k,
          game.i18n.localize(CONFIG.MARVEL_MULTIVERSE.equipmentTypes[k]),
        ])
      );
      context.grenadeTypes = Object.fromEntries(
        Object.keys(CONFIG.MARVEL_MULTIVERSE.grenadeTypes).map((k) => [
          k,
          game.i18n.localize(CONFIG.MARVEL_MULTIVERSE.grenadeTypes[k]),
        ])
      );
    }
    if (itemData.type === "restriction") {
      context.restrictionKinds = Object.fromEntries(
        Object.keys(CONFIG.MARVEL_MULTIVERSE.restrictionKinds).map((k) => [
          k,
          CONFIG.MARVEL_MULTIVERSE.restrictionKinds[k].label,
        ])
      );
    }
    // Rich text is shown enriched so content links, inline rolls and the
    // roll links registered by this system all work on the sheet.
    context.enriched = await enrichSheetFields(this.item, {
      rollData: context.rollData,
    });

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
      const powerSets = [...(this.item.system.powerSets ?? [])];
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
      }, { classes: ["dialog", "marvel-multiverse", "mm-dialog"] }).render(true);
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

    // Battle suit: restriction management
    html.on("click", ".battlesuit-restriction-add", async (ev) => {
      ev.preventDefault();
      const restrictions = [...this.item.system.restrictions];
      restrictions.push({ kind: "access", name: "", description: "" });
      await this.item.update({ "system.restrictions": restrictions });
    });

    html.on("click", ".battlesuit-restriction-remove", async (ev) => {
      ev.preventDefault();
      const index = Number(ev.currentTarget.dataset.index);
      const restrictions = [...this.item.system.restrictions];
      restrictions.splice(index, 1);
      await this.item.update({ "system.restrictions": restrictions });
    });

    html.on("click", ".battlesuit-restriction-edit", async (ev) => {
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
              restrictions[index] = {
                kind: html.find('[name="kind"]').val(),
                name: html.find('[name="name"]').val(),
                description: html.find('[name="description"]').val(),
              };
              await this.item.update({ "system.restrictions": restrictions });
            },
          },
          cancel: { label: "Cancel" },
        },
        default: "save",
      }, { classes: ["dialog", "marvel-multiverse", "mm-dialog"] }).render(true);
    });

    // Battle suit: power removal
    html.on("click", ".battlesuit-power-remove", async (ev) => {
      ev.preventDefault();
      const index = Number(ev.currentTarget.dataset.index);
      const powers = [...this.item.system.powers];
      powers.splice(index, 1);
      await this.item.update({ "system.powers": powers });
    });

    // Battle suit: integrated iconic item removal
    html.on("click", ".battlesuit-iconic-remove", async (ev) => {
      ev.preventDefault();
      const index = Number(ev.currentTarget.dataset.index);
      const items = [...this.item.system.integratedIconicItems];
      items.splice(index, 1);
      await this.item.update({ "system.integratedIconicItems": items });
    });

    // Battle suit: additional trait management
    html.on("click", ".battlesuit-trait-add", async (ev) => {
      ev.preventDefault();
      const input = html.find(".battlesuit-trait-input");
      const value = input.val()?.trim();
      if (!value) return;
      const traits = [...(this.item.system.additionalTraits ?? [])];
      traits.push(value);
      await this.item.update({ "system.additionalTraits": traits });
      input.val("");
    });

    html.on("click", ".battlesuit-trait-remove", async (ev) => {
      ev.preventDefault();
      const index = Number(ev.currentTarget.dataset.index);
      const traits = [...(this.item.system.additionalTraits ?? [])];
      traits.splice(index, 1);
      await this.item.update({ "system.additionalTraits": traits });
    });

    // Battle suit: drop zone visual feedback
    const battlesuitDropZones = html.find(".mm-battlesuit-powers-drop-zone, .mm-battlesuit-restrictions-drop-zone, .mm-battlesuit-iconic-drop-zone");
    battlesuitDropZones.on("dragover", (ev) => {
      ev.preventDefault();
      ev.currentTarget.classList.add("drag-over");
    });
    battlesuitDropZones.on("dragleave", (ev) => {
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
      const powerSets = [...(this.item.system.powerSets ?? [])];
      if (powerSets.some(ps => ps.name === droppedItem.name)) return;
      powerSets.push({
        id: droppedItem.id,
        name: droppedItem.name,
        img: droppedItem.img,
      });
      const powerSet = powerSets.map(ps => ps.name).join(", ");
      return await this.item.update({ "system.powerSets": powerSets, "system.powerSet": powerSet });
    }

    // Handle restriction drops onto battle suits
    if (droppedItem.type === "restriction" && this.item.type === "battleSuit") {
      const restrictions = [...this.item.system.restrictions];
      if (restrictions.some(r => r.name === droppedItem.name)) return;
      restrictions.push({
        kind: droppedItem.system.kind,
        name: droppedItem.name,
        description: droppedItem.system.description,
      });
      return await this.item.update({ "system.restrictions": restrictions });
    }

    // Handle power drops onto battle suits
    if (droppedItem.type === "power" && this.item.type === "battleSuit") {
      const powers = [...this.item.system.powers];
      if (powers.some(p => p.name === droppedItem.name)) return;
      powers.push({
        id: droppedItem.id,
        name: droppedItem.name,
        img: droppedItem.img,
      });
      return await this.item.update({ "system.powers": powers });
    }

    // Handle iconic item drops onto battle suits
    if (droppedItem.type === "iconicItem" && this.item.type === "battleSuit") {
      const items = [...this.item.system.integratedIconicItems];
      if (items.some(ii => ii.name === droppedItem.name)) return;
      items.push({
        id: droppedItem.id,
        name: droppedItem.name,
        img: droppedItem.img,
      });
      return await this.item.update({ "system.integratedIconicItems": items });
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
  foundry.applications.handlebars.loadTemplates([
    // Actor partials.
    "systems/marvel-multiverse/templates/actor/parts/actor-biography.hbs",
    "systems/marvel-multiverse/templates/actor/parts/actor-details.hbs",
    "systems/marvel-multiverse/templates/actor/parts/actor-schooling.hbs",
    "systems/marvel-multiverse/templates/actor/parts/actor-effects.hbs",
    "systems/marvel-multiverse/templates/actor/parts/actor-items.hbs",
    "systems/marvel-multiverse/templates/actor/parts/actor-occupation.hbs",
    "systems/marvel-multiverse/templates/actor/parts/actor-origin.hbs",
    "systems/marvel-multiverse/templates/actor/parts/actor-powers.hbs",
    "systems/marvel-multiverse/templates/actor/parts/actor-tags.hbs",
    "systems/marvel-multiverse/templates/actor/parts/actor-traits.hbs",
    "systems/marvel-multiverse/templates/actor/parts/actor-equipment.hbs",
    "systems/marvel-multiverse/templates/actor/parts/actor-weapons.hbs",
    "systems/marvel-multiverse/templates/actor/parts/actor-alternate-forms.hbs",
    // Item partials
    "systems/marvel-multiverse/templates/item/parts/item-effects.hbs",
    "systems/marvel-multiverse/templates/item/parts/item-source.hbs",
    // Dialog partials
    "systems/marvel-multiverse/templates/dialogs/add-form-dialog.hbs",
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
    // Ids of the powers this actor is currently concentrating on. No `initial`
    // is declared: ArrayField defaults to an empty array, and an explicit
    // function-valued initial would break the shipping-parity comparison, which
    // compares declared options and sees two functions as unequal.
    schema.concentrating = new fields.ArrayField(new fields.StringField());
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

    schema.alternateForms = new fields.ArrayField(new fields.SchemaField({
      actorId: new fields.StringField({ required: true, blank: false }),
      formType: new fields.StringField({ required: true, initial: "powerDown", choices: ["cosmetic", "powerDown", "powerSwap"] }),
      triggers: new fields.ArrayField(new fields.SchemaField({
        description: new fields.StringField({ required: true, blank: false }),
        resistable: new fields.BooleanField({ initial: true }),
        tn: new fields.NumberField({ required: true, initial: 0, integer: true, min: 0 }),
      })),
    }));

    schema.primaryFormIds = new fields.ArrayField(
      new fields.StringField({ required: true, blank: false })
    );

    return schema;
  }

  prepareDerivedData() {
    // Damage multiplier and damage reduction bonuses do not stack (rulebook).
    // AEs use ADD mode which sums all bonuses; enforce highest-only here.
    if (this.parent?.allApplicableEffects) {
      const maxDmgBonus = {};
      for (const key in this.abilities) maxDmgBonus[key] = 0;
      let maxHealthDR = 0;
      let maxFocusDR = 0;

      for (const effect of this.parent.allApplicableEffects()) {
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

    if (this.parent?.statuses?.has("asleep")) {
      for (const key in this.abilities) {
        this.abilities[key].defense = 10;
      }
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
      level: new fields.NumberField({ min: 1, max: 3, integer: true, nullable: true }),
      named: new fields.StringField({ required: false, blank: true }),
    });

    // The ten boxes of the Schooling Advancement Chart. Named boolean fields
    // rather than an ArrayField: an ArrayField needs a function for its
    // `initial`, and shipping-parity compares declared initials with toEqual,
    // which compares functions by reference and would fail across the trees.
    schema.schooling = new fields.SchemaField({
      boxes: new fields.SchemaField(
        Object.fromEntries(
          Array.from({ length: 10 }, (_, i) => [
            `box${i}`,
            new fields.BooleanField({ required: true, initial: false }),
          ])
        )
      ),
    });

    return schema;
  }
}

class MarvelMultiverseNPC extends MarvelMultiverseActorBase {
  prepareDerivedData() {
    if (this.parent?.allApplicableEffects) {
      const maxDmgBonus = {};
      for (const key in this.abilities) maxDmgBonus[key] = 0;
      let maxHealthDR = 0;
      let maxFocusDR = 0;

      for (const effect of this.parent.allApplicableEffects()) {
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

    if (this.parent?.statuses?.has("asleep")) {
      for (const key in this.abilities) {
        this.abilities[key].defense = 10;
      }
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

class MarvelMultiverseHeadquarters extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = {};

    schema.health = new fields.SchemaField({
      value: new fields.NumberField({ required: true, nullable: false, initial: 0, min: 0 }),
      max: new fields.NumberField({ required: true, nullable: false, initial: 0, min: 0 }),
    });

    schema.members = new fields.ArrayField(new fields.SchemaField({
      actorId: new fields.StringField({ required: true, blank: false }),
      name: new fields.StringField({ required: true, blank: true }),
      img: new fields.StringField({ required: true, blank: true }),
    }));

    schema.description = new fields.StringField({ required: true, blank: true });
    schema.notes = new fields.StringField({ required: true, blank: true });
    schema.source = new fields.StringField({ required: true, blank: true });

    return schema;
  }

  prepareDerivedData() {
    const hqTraits = this.parent?.items?.filter(i => i.type === "hqTrait") ?? [];
    this.traitCount = hqTraits.length;
    this.health.max = this.traitCount * 2;

    const ranks = this.members
      .map(m => game.actors?.get(m.actorId)?.system?.attributes?.rank?.value)
      .filter(r => r != null)
      .sort((a, b) => b - a)
      .slice(0, 6);

    this.teamRank = ranks.length > 0 ? Math.ceil(ranks.reduce((s, r) => s + r, 0) / ranks.length) : 1;
    this.traitSlots = this.teamRank * 3;

    this.health.damaged = this.health.max > 0 && this.health.value > 0 && this.health.value <= this.health.max / 2;
    this.health.destroyed = this.health.max > 0 && this.health.value <= 0;

    let healthStatus = "operational";
    if (this.health.destroyed) healthStatus = "destroyed";
    else if (this.health.damaged) healthStatus = "damaged";
    this.health.status = healthStatus;
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
    return Math.max(1, powersCount - restrictionsCount);
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

class MarvelMultiverseHqTag extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = {};

    schema.description = new fields.StringField({ required: true, blank: true });
    schema.incompatible = new fields.StringField({ required: true, blank: true });

    return schema;
  }
}

class MarvelMultiverseHqTrait extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = {};

    schema.description = new fields.StringField({ required: true, blank: true });
    schema.downtimeActivity = new fields.StringField({ required: true, blank: true });
    schema.maxCount = new fields.NumberField({ required: true, nullable: false, integer: true, initial: 0, min: 0 });

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

class MarvelMultiverseBattleSuit extends MarvelMultiverseItemBase {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.origin = new fields.StringField({
      required: true,
      initial: "High-Tech: Battle Suit",
    });

    schema.restrictions = new fields.ArrayField(new fields.ObjectField());

    schema.powers = new fields.ArrayField(new fields.ObjectField());

    schema.abilityModifiers = new fields.SchemaField({
      melee: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      agility: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      resilience: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      vigilance: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      ego: new fields.NumberField({ ...requiredInteger, initial: 0 }),
      logic: new fields.NumberField({ ...requiredInteger, initial: 0 }),
    });

    schema.rankIncrease = new fields.NumberField({
      ...requiredInteger,
      initial: 0,
      min: 0,
    });

    schema.additionalTraits = new fields.ArrayField(
      new fields.StringField({ required: true, blank: false })
    );

    schema.notes = new fields.StringField({ required: true, blank: true });

    schema.integratedIconicItems = new fields.ArrayField(
      new fields.ObjectField()
    );

    schema.equipped = new fields.BooleanField({
      required: true,
      initial: false,
    });

    return schema;
  }

  get powerValue() {
    const powersCount = this.powers?.length ?? 0;
    const restrictionsCount = this.restrictions?.length ?? 0;
    if (powersCount === 0 && restrictionsCount === 0) return 0;
    return Math.max(1, powersCount - restrictionsCount);
  }
}

class MarvelMultiverseEquipment extends MarvelMultiverseItemBase {
  static defineSchema() {
    const fields = foundry.data.fields;
    const requiredInteger = { required: true, nullable: false, integer: true };
    const schema = super.defineSchema();

    schema.equipmentType = new fields.StringField({
      required: true,
      initial: "protection",
    });
    schema.equipped = new fields.BooleanField({
      required: true,
      initial: false,
    });
    schema.ruined = new fields.BooleanField({
      required: true,
      initial: false,
    });

    schema.damageReduction = new fields.NumberField({
      ...requiredInteger,
      initial: 0,
      min: 0,
    });
    schema.protectionNotes = new fields.StringField({
      required: true,
      blank: true,
    });

    schema.grenadeType = new fields.StringField({
      required: true,
      blank: true,
    });
    schema.grenadeEffect = new fields.StringField({
      required: true,
      blank: true,
    });

    schema.gadgetHP = new fields.NumberField({
      ...requiredInteger,
      initial: 10,
      min: 0,
    });
    schema.gadgetMaxHP = new fields.NumberField({
      ...requiredInteger,
      initial: 10,
      min: 0,
    });
    schema.gadgetEffect = new fields.StringField({
      required: true,
      blank: true,
    });

    schema.source = new fields.StringField({ required: true, blank: true });

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
  rollCheckMacro,
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
      const rendered = await foundry.applications.handlebars.renderTemplate(
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
    const actorTypesUnsorted = {
      character: { label: "Character", checked: s.actorType.includes("character") },
      npc: { label: "NPC", checked: s.actorType.includes("npc") },
      vehicle: { label: "Vehicle", checked: s.actorType.includes("vehicle") },
      headquarters: { label: "Headquarters", checked: s.actorType.includes("headquarters") },
    };
    const actorTypes = Object.fromEntries(
      Object.entries(actorTypesUnsorted).sort(([, a], [, b]) => a.label.localeCompare(b.label))
    );
    const sizes = Object.fromEntries(
      Object.entries(CONFIG.MARVEL_MULTIVERSE.sizes).map(([key, data]) => [key, {
        label: game.i18n.localize(data.label),
        checked: s.size.includes(key),
      }]).sort(([, a], [, b]) => a.label.localeCompare(b.label))
    );
    const movementTypes = Object.fromEntries(
      Object.entries(CONFIG.MARVEL_MULTIVERSE.movementTypes).map(([key, data]) => [key, {
        label: game.i18n.localize(data.label),
        checked: s.movementTypes.includes(key),
      }]).sort(([, a], [, b]) => a.label.localeCompare(b.label))
    );
    const elements = Object.fromEntries(
      Object.entries(CONFIG.MARVEL_MULTIVERSE.elements).map(([key, data]) => [key, {
        label: data.label,
        checked: s.elements.includes(key),
      }]).sort(([, a], [, b]) => a.label.localeCompare(b.label))
    );
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

  // Make phrases like "makes an Ego check" rollable wherever they are shown.
  // Chat card content is enriched by core, so the power cards are covered
  // without touching the code that builds them.
  CONFIG.TextEditor.enrichers.push({
    pattern: ROLL_LINK_PATTERN,
    enricher: enrichRollLink,
  });

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
    headquarters: MarvelMultiverseHeadquarters,
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
    battleSuit: MarvelMultiverseBattleSuit,
    equipment: MarvelMultiverseEquipment,
    vehicleWeapon: MarvelMultiverseVehicleWeapon,
    hqTag: MarvelMultiverseHqTag,
    hqTrait: MarvelMultiverseHqTrait,
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
    hint: "Enable the optional Mutant Reputation system. When active, Ego checks display reputation-based edge/trouble notices.",
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

  game.settings.register("marvel-multiverse", "enableAlternateForms", {
    name: "MARVEL_MULTIVERSE.AlternateForm.Setting.Enable",
    hint: "MARVEL_MULTIVERSE.AlternateForm.Setting.EnableHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  // Active Effects are never copied to the Actor, but still apply to the Actor
  // from within the Item when the effect's transfer property is true. This is
  // core behavior as of v14 (the legacy transferral framework was removed).

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
    { id: "asleep", name: "Asleep", img: "icons/svg/sleep.svg" },
    { id: "bleeding", name: "Bleeding", img: "systems/marvel-multiverse/icons/statuses/bleeding.svg" },
    { id: "blinded", name: "Blinded", img: "systems/marvel-multiverse/icons/statuses/blinded.svg" },
    { id: "corroding", name: "Corroding", img: "icons/svg/acid.svg" },
    { id: "concentrating", name: "Concentrating", img: "icons/svg/eye.svg" },
    { id: "damageReduction", name: "Damage Reduction", img: "icons/svg/shield.svg" },
    { id: "deafened", name: "Deafened", img: "systems/marvel-multiverse/icons/statuses/deafened.svg" },
    { id: "demoralized", name: "Demoralized", img: "systems/marvel-multiverse/icons/statuses/demoralized.svg" },
    { id: "exhausted", name: "Exhausted", img: "systems/marvel-multiverse/icons/statuses/exhaustion.svg" },
    { id: "flying", name: "Flying", img: "systems/marvel-multiverse/icons/statuses/flying.svg" },
    { id: "frightened", name: "Frightened", img: "systems/marvel-multiverse/icons/statuses/frightened.svg" },
    { id: "grabbed", name: "Grabbed", img: "systems/marvel-multiverse/icons/statuses/grabbed.svg" },
    { id: "infected", name: "Infected", img: "icons/svg/biohazard.svg" },
    { id: "invisible", name: "Invisible", img: "systems/marvel-multiverse/icons/statuses/invisible.svg" },
    { id: "paralyzed", name: "Paralyzed", img: "systems/marvel-multiverse/icons/statuses/paralyzed.svg" },
    { id: "pinned", name: "Pinned", img: "systems/marvel-multiverse/icons/statuses/pinned.svg" },
    { id: "poisoned", name: "Poisoned", img: "icons/svg/poison.svg" },
    { id: "prone", name: "Prone", img: "systems/marvel-multiverse/icons/statuses/prone.svg" },
    { id: "shattered", name: "Shattered", img: "systems/marvel-multiverse/icons/statuses/shattered.svg" },
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
  foundry.documents.collections.Actors.unregisterSheet("core", foundry.appv1.sheets.ActorSheet);
  foundry.documents.collections.Actors.registerSheet("marvel-multiverse", MarvelMultiverseCharacterSheet, {
    types: ["character"],
    makeDefault: true,
    label: "MARVEL_MULTIVERSE.SheetLabels.Actor",
  });
  foundry.documents.collections.Actors.registerSheet("marvel-multiverse", MarvelMultiverseNPCSheet, {
    types: ["npc"],
    makeDefault: true,
    label: "MARVEL_MULTIVERSE.SheetLabels.NPC",
  });
  foundry.documents.collections.Actors.registerSheet("marvel-multiverse", MarvelMultiverseVehicleSheet, {
    types: ["vehicle"],
    makeDefault: true,
    label: "MARVEL_MULTIVERSE.SheetLabels.Vehicle",
  });
  foundry.documents.collections.Actors.registerSheet("marvel-multiverse", MarvelMultiverseHeadquartersSheet, {
    types: ["headquarters"],
    makeDefault: true,
    label: "MARVEL_MULTIVERSE.SheetLabels.Headquarters",
  });
  foundry.documents.collections.Items.unregisterSheet("core", foundry.appv1.sheets.ItemSheet);
  foundry.documents.collections.Items.registerSheet("marvel-multiverse", MarvelMultiverseItemSheet, {
    makeDefault: true,
    label: "MARVEL_MULTIVERSE.SheetLabels.Item",
  });

  // Initialize Actor Directory Filters
  ActorDirectoryFilter.init();

  // Add context menu for actor sidebar
  Hooks.on("getActorContextOptions", (app, options) => {
    if (!game.settings.get("marvel-multiverse", "enableAlternateForms")) return;

    options.push({
      name: game.i18n.localize("MARVEL_MULTIVERSE.AlternateForm.SwitchForm"),
      icon: '<i class="fas fa-exchange-alt"></i>',
      condition: (li) => {
        const actorId = li.dataset.entryId;
        const actor = game.actors.get(actorId);
        if (!actor) return false;
        const forms = actor.system.alternateForms ?? [];
        const primaryIds = actor.system.primaryFormIds ?? [];
        return forms.length > 0 || primaryIds.length > 0;
      },
      callback: (li) => {
        const actorId = li.dataset.entryId;
        const actor = game.actors.get(actorId);
        if (!actor) return;

        const forms = actor.system.alternateForms ?? [];
        const primaryIds = actor.system.primaryFormIds ?? [];
        const targets = [];

        for (const f of forms) {
          const a = game.actors.get(f.actorId);
          if (a) targets.push({ id: a.id, name: a.name });
        }
        for (const id of primaryIds) {
          const a = game.actors.get(id);
          if (a) targets.push({ id: a.id, name: a.name });
        }

        if (targets.length === 1) {
          switchForm(actor, targets[0].id);
        } else if (targets.length > 1) {
          const buttons = {};
          for (const t of targets) {
            buttons[t.id] = { label: t.name, callback: () => switchForm(actor, t.id) };
          }
          new Dialog({
            title: game.i18n.localize("MARVEL_MULTIVERSE.AlternateForm.SwitchForm"),
            content: "<p>Select a form to switch to:</p>",
            buttons,
          }, { classes: ["dialog", "marvel-multiverse", "mm-dialog"] }).render(true);
        }
      },
    });
  });

  // Add Switch Form button to Token HUD
  Hooks.on("renderTokenHUD", (app, html) => {
    if (!game.settings.get("marvel-multiverse", "enableAlternateForms")) return;
    const actor = app.actor;
    if (!actor) return;

    const forms = actor.system.alternateForms ?? [];
    const primaryIds = actor.system.primaryFormIds ?? [];
    if (forms.length === 0 && primaryIds.length === 0) return;

    const targets = [];
    for (const f of forms) {
      const a = game.actors.get(f.actorId);
      if (a) targets.push({ id: a.id, name: a.name });
    }
    for (const id of primaryIds) {
      const a = game.actors.get(id);
      if (a) targets.push({ id: a.id, name: a.name });
    }
    if (targets.length === 0) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.classList.add("control-icon");
    btn.dataset.tooltip = game.i18n.localize("MARVEL_MULTIVERSE.AlternateForm.SwitchForm");
    btn.innerHTML = '<i class="fas fa-exchange-alt" inert></i>';
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      if (targets.length === 1) {
        switchForm(actor, targets[0].id);
      } else {
        const existing = document.querySelector(".mm-form-picker");
        if (existing) {
          existing.remove();
          return;
        }

        const picker = document.createElement("div");
        picker.classList.add("mm-form-picker");

        for (const t of targets) {
          const a = game.actors.get(t.id);
          const img = a?.prototypeToken?.texture?.src || a?.img || CONST.DEFAULT_TOKEN;
          const item = document.createElement("div");
          item.classList.add("mm-form-picker-item");
          item.dataset.actorId = t.id;
          item.innerHTML = `<img src="${img}"/><span class="mm-form-picker-name">${t.name}</span>`;
          item.addEventListener("click", () => {
            picker.remove();
            switchForm(actor, t.id);
          });
          picker.appendChild(item);
        }

        const btnRect = btn.getBoundingClientRect();
        picker.style.top = `${btnRect.top + btnRect.height / 2}px`;
        picker.style.left = `${btnRect.left}px`;

        document.body.appendChild(picker);

        const dismiss = (e) => {
          if (!picker.contains(e.target) && e.target !== btn) {
            picker.remove();
            document.removeEventListener("pointerdown", dismiss);
          }
        };
        setTimeout(() => document.addEventListener("pointerdown", dismiss), 50);
      }
    });

    const col = html.querySelector(".col.left");
    if (col) col.appendChild(btn);
  });

  // Preload Handlebars templates.
  return preloadHandlebarsTemplates();
});

/* -------------------------------------------- */
/*  Condition Automation Hooks                  */
/* -------------------------------------------- */

function _getConditionDamage(actor) {
  const conditions = MARVEL_MULTIVERSE.conditionEffects;
  let totalDamage = 0;
  const active = [];
  for (const [id, cfg] of Object.entries(conditions)) {
    if (cfg.timing !== "end" || !cfg.turnDamage) continue;
    if (!actor.statuses?.has(id)) continue;
    active.push({ id, name: cfg.name, damage: cfg.turnDamage });
    totalDamage += cfg.turnDamage;
  }
  return { active, totalDamage };
}

function _getWhisperRecipients(actor) {
  const ids = new Set();
  for (const user of game.users) {
    if (user.isGM) ids.add(user.id);
    if (actor.testUserPermission(user, "OWNER")) ids.add(user.id);
  }
  return Array.from(ids);
}

async function _processEndOfTurn(combatant) {
  const actor = combatant?.actor;
  if (!actor) return;
  const { active, totalDamage } = _getConditionDamage(actor);
  if (active.length === 0) return;
  const conditionDR = actor.system.conditionDamageReduction ?? 0;
  const damageAfterDR = Math.max(0, totalDamage - conditionDR);
  const oldHealth = actor.system.health.value;
  if (damageAfterDR > 0) {
    await actor.update({ "system.health.value": oldHealth - damageAfterDR });
  }
  const tokenImg = _getTokenImg(actor);
  const tokenData = tokenImg ? ` data-token-img="${tokenImg}"` : "";
  let detailHtml = active.map(c => `<div><b>${c.name}:</b> ${c.damage} damage</div>`).join("");
  if (conditionDR > 0) detailHtml += `<div><b>Condition DR:</b> -${conditionDR}</div>`;
  const flavor = `<div class="mm-roll-flavor"${tokenData}><div style="padding:4px 0;font-size:12px;">${detailHtml}</div></div>`;
  await ChatMessage.create({
    content: `<div class="marvel-multiverse dice-roll marvel-roll"><div class="dice-result"><h4 class="dice-total"><span>Health: ${oldHealth} → ${oldHealth - damageAfterDR}</span></h4></div></div>`,
    flavor,
    whisper: _getWhisperRecipients(actor),
    speaker: ChatMessage.getSpeaker({ token: combatant.token, actor }),
  });
}

async function _processStartOfTurn(combatant) {
  const actor = combatant?.actor;
  if (!actor) return;
  if (!actor.statuses?.has("poisoned")) return;
  const cfg = MARVEL_MULTIVERSE.conditionEffects.poisoned;
  const { ability, tn } = cfg.turnCheck;
  const abilityValue = actor.system.abilities[ability]?.value ?? 0;
  const roll = new CONFIG.Dice.MarvelMultiverseRoll(
    `{1d6,1dm,1d6}+${abilityValue}`,
    actor.getRollData(),
  );
  await roll.evaluate();
  const total = roll.total;
  const isFantastic = roll.isFantastic;
  const success = isFantastic || total >= tn;
  const abilityLabel = game.i18n.localize(CONFIG.MARVEL_MULTIVERSE.abilities[ability]) ?? ability;
  let resultText;
  if (isFantastic) {
    resultText = "<b>Fantastic!</b> Poison cleared!";
    await actor.toggleStatusEffect("poisoned", { active: false });
  } else if (success) {
    resultText = "<b>Success</b> — fine this turn.";
  } else {
    resultText = "<b>Failed</b> — loses 1 Health.";
    await actor.update({ "system.health.value": actor.system.health.value - 1 });
  }
  const tokenImg = _getTokenImg(actor);
  const tokenData = tokenImg ? ` data-token-img="${tokenImg}"` : "";
  const rollFlavor = `<div class="mm-roll-flavor"${tokenData}><div style="padding:4px 0;font-size:12px;"><div>Poison Check: ${abilityLabel} vs TN ${tn}</div></div></div>`;
  const resultFlavor = `<div class="mm-roll-flavor"${tokenData}><div style="padding:4px 0;font-size:12px;"><div>${resultText}</div></div></div>`;
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ token: combatant.token, actor }),
    flavor: rollFlavor,
  }, { rollMode: "publicroll" });
  await ChatMessage.create({
    content: `<div class="marvel-multiverse dice-roll marvel-roll"><div class="dice-result"><h4 class="dice-total"><span>${total}</span></h4></div></div>`,
    flavor: resultFlavor,
    whisper: _getWhisperRecipients(actor),
    speaker: ChatMessage.getSpeaker({ token: combatant.token, actor }),
  });
}


/**
 * Ask whether to keep concentrating on a power that charges every turn or
 * round. Only 7 of the 125 concentration powers do; the rest are free to
 * maintain and are never asked about.
 */
async function _processConcentrationUpkeep(combatant) {
  const actor = combatant?.actor;
  if (!actor) return;
  if (!_isResponsibleFor(actor)) return;

  for (const id of _heldConcentrations(actor)) {
    const item = actor.items.get(id);
    const cost = _parseFocusCost(item?.system?.cost);
    if (!cost || cost.kind !== "recurring") continue;

    const keep = await _confirmUpkeep({
      powerName: item.name,
      cost: cost.amount,
      period: cost.period,
      current: Number(actor.system?.focus?.value ?? 0),
    });
    if (!keep) {
      await _endConcentration(actor, id, { reason: "not maintained" });
      continue;
    }

    const current = Number(actor.system?.focus?.value ?? 0);
    await actor.update({ "system.focus.value": current - cost.amount });
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor, token: _getTokenDoc(actor) }),
      flavor: _buildRollFlavor({ tokenImg: _getTokenImg(actor), actorName: actor.name, powerName: item.name }),
      content: `<div class="mm-chat-body"><div class="mm-power-activated">Concentration maintained, spending <b>${cost.amount} Focus</b> per ${cost.period}.</div></div>`,
    });
  }
}

/** Keep concentrating and pay, or let it lapse. */
function _confirmUpkeep({ powerName, cost, period, current }) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };
    new Dialog({
      title: "Maintain Concentration",
      content: `<form><div class="form-group mm-spend-group">
        <label><b>${powerName}</b> - costs ${cost} Focus per ${period} to maintain. Focus is ${current}.</label>
      </div></form>`,
      buttons: {
        keep: { icon: '<i class="fas fa-bolt"></i>', label: `Spend ${cost}`, callback: () => done(true) },
        drop: { icon: '<i class="fas fa-times"></i>', label: "Let it end", callback: () => done(false) },
      },
      default: "keep",
      close: () => done(false),
    }, { classes: ["dialog", "marvel-multiverse", "mm-dialog"] }).render(true);
  });
}

/**
 * Conditions listed in CONCENTRATION_BREAKERS end every concentration the
 * character holds. Status effects arrive as Active Effects on the actor, so the
 * check runs when one is created.
 */
Hooks.on("createActiveEffect", async (effect) => {
  const actor = effect?.parent;
  if (!actor || actor.documentName !== "Actor") return;
  if (!_isResponsibleFor(actor)) return;
  const statuses = [...(effect.statuses ?? [])];
  const breaker = statuses.find((s) => CONCENTRATION_BREAKERS.includes(s));
  if (!breaker) return;
  await _endConcentration(actor, null, { reason: `${actor.name} is ${breaker}` });
});


/**
 * Clearing the Concentrating marker from the token HUD ends everything the
 * character is holding. `_endConcentration` clears the marker itself once the
 * last power goes, so the length check below is what keeps the two from
 * calling each other in a loop.
 */
Hooks.on("deleteActiveEffect", async (effect) => {
  const actor = effect?.parent;
  if (!actor || actor.documentName !== "Actor") return;
  if (!effect.statuses?.has("concentrating")) return;
  if (!_isResponsibleFor(actor)) return;
  if (!_heldConcentrations(actor).length) return;
  await _endConcentration(actor, null, { reason: "the marker was cleared" });
});

/** Ending the encounter ends any concentration its combatants were holding. */
Hooks.on("deleteCombat", async (combat) => {
  for (const combatant of combat.combatants ?? []) {
    const actor = combatant.actor;
    if (!actor || !_isResponsibleFor(actor)) continue;
    if (!_heldConcentrations(actor).length) continue;
    await _endConcentration(actor, null, { reason: "the encounter ended" });
  }
});

Hooks.on("updateCombat", (combat, changed, options, userId) => {
  if (!("turn" in changed) && !("round" in changed)) return;

  // Upkeep is answered by whoever owns the character, not only the GM, so this
  // runs before the GM-only automation below.
  const upkeepFor = combat.combatant;
  if (upkeepFor) _processConcentrationUpkeep(upkeepFor);

  if (!game.user.isGM) return;
  if (combat.previous.round === 0) {
    const current = combat.combatant;
    if (current) _processStartOfTurn(current);
    return;
  }
  const prevCombatant = combat.turns[combat.previous.turn];
  if (prevCombatant) _processEndOfTurn(prevCombatant);
  const current = combat.combatant;
  if (current) _processStartOfTurn(current);
});

/**
 * A headquarters derives its team rank — and from it its trait slots — from the
 * ranks of its member actors, but those actors are separate documents. Foundry
 * only re-prepares the document that changed, so deleting a member or changing
 * a member's rank left the headquarters showing a stale team rank until
 * something else happened to touch it.
 *
 * @param {string} actorId  The member actor that was deleted or updated.
 */
function _refreshHeadquartersFor(actorId) {
  for (const hq of game.actors?.filter((a) => a.type === "headquarters") ?? []) {
    if (!hq.system.members?.some((m) => m.actorId === actorId)) continue;
    hq.prepareData();
    if (hq.sheet?.rendered) hq.sheet.render(false);
  }
}

Hooks.on("deleteActor", (actor) => _refreshHeadquartersFor(actor.id));

Hooks.on("updateActor", (actor, changed) => {
  // Only a rank change can move the team rank.
  if (foundry.utils.getProperty(changed, "system.attributes.rank.value") === undefined) return;
  _refreshHeadquartersFor(actor.id);
});

/* -------------------------------------------- */
/*  Handlebars Helpers                          */
/* -------------------------------------------- */

// If you need to add Handlebars helpers, here is a useful example:
/**
 * True when a power's cost can be worked out, so the sheet knows whether to
 * offer an activate control. Handlebars helpers must be synchronous, which
 * _parseFocusCost is.
 */
Handlebars.registerHelper("mmHasFocusCost", (cost) => _parseFocusCost(cost) !== null);

/** True when the actor is currently concentrating on this power. */
Handlebars.registerHelper("mmIsConcentrating", (held, itemId) =>
  Array.isArray(held) && held.includes(itemId)
);

Handlebars.registerHelper("toLowerCase", (mle) => mle.toLowerCase());
Handlebars.registerHelper("eq", (a, b) => a === b);
Handlebars.registerHelper("gt", (a, b) => a > b);



/* -------------------------------------------- */
/*  Take Damage                                 */
/* -------------------------------------------- */

/** Socket channel for relaying an applied-damage record to a GM. */
const MM_SOCKET = "system.marvel-multiverse";

/** Turn a live Take Damage button into the spent state. */
function _markButtonApplied(button) {
  button.disabled = true;
  button.classList.add("-applied");
  button.innerHTML = '<i class="fa-solid fa-check"></i> Applied';
}

/**
 * Record on the message that a target's damage has been taken, so the button
 * stays spent for everyone and survives a reload.
 *
 * A defending player is usually not the damage message's author and so cannot
 * write its flags. Their actor update still succeeds; only this bookkeeping
 * needs relaying to a GM.
 *
 * @returns {Promise<boolean>}  Whether the applied state was persisted.
 */
async function _markDamageApplied(message, uuid) {
  const flag = message.getFlag("marvel-multiverse", "damage");
  if (!flag) return false;

  if (message.canUserModify(game.user, "update")) {
    await message.setFlag("marvel-multiverse", "damage", {
      ...flag,
      applied: withApplied(flag.applied, uuid),
    });
    return true;
  }

  if (!game.users.activeGM) {
    ui.notifications.warn(
      "Damage was applied, but no GM is connected to save it — the button will be available again after a reload."
    );
    return false;
  }

  game.socket.emit(MM_SOCKET, {
    type: "markDamageApplied",
    messageId: message.id,
    uuid,
  });
  return true;
}

/**
 * Subtract a target's recorded damage from its Health or Focus.
 *
 * The amount comes from the message flag rather than the rendered text: the
 * text is prose a module or a translation could reshape, and re-parsing it
 * would make the number a viewer sees and the number applied two separate
 * things that can disagree.
 */
async function _applyDamageFromMessage(message, uuid, button) {
  const flag = message.getFlag("marvel-multiverse", "damage");
  const entry = flag?.targets?.find((t) => t.uuid === uuid);
  if (!entry?.hit) return;

  const actor = await fromUuid(uuid);
  if (!actor) {
    ui.notifications.warn("That target no longer exists.");
    return;
  }

  const path = damageValuePath(flag.damageType);
  const current = foundry.utils.getProperty(actor, path) ?? 0;
  // Health and Focus are allowed below zero. The schema's min of -300 is the
  // only floor, and a character below zero is a state the rules use, so no
  // clamp at zero is applied here.
  await actor.update({ [path]: current - entry.amount });

  _markButtonApplied(button);
  await _markDamageApplied(message, uuid);
}

/**
 * Wire the damage card's Take Damage buttons. The message content is sent to
 * every user, so who may click and what has already been spent are both decided
 * per viewer at render time.
 */
Hooks.on("renderChatMessageHTML", (message, html) => {
  const el = html instanceof HTMLElement ? html : html?.[0];
  const buttons = el?.querySelectorAll?.("button.mm-take-damage");
  if (!buttons?.length) return;

  const flag = message.getFlag("marvel-multiverse", "damage");
  const applied = Array.isArray(flag?.applied) ? flag.applied : [];

  for (const button of buttons) {
    const uuid = button.dataset.targetUuid;
    const actor = fromUuidSync(uuid);
    if (!canApplyDamage(game.user, actor)) {
      button.remove();
      continue;
    }
    if (applied.includes(uuid)) {
      _markButtonApplied(button);
      continue;
    }

    // The hook fires more than once per message in v14. Binding again on the
    // same element would apply the damage twice from a single click.
    if (button.dataset.mmBound === "1") continue;
    button.dataset.mmBound = "1";

    button.addEventListener("click", async (ev) => {
      ev.preventDefault();
      button.disabled = true;
      try {
        await _applyDamageFromMessage(message, uuid, button);
      } catch (err) {
        button.disabled = false;
        throw err;
      }
    });
  }
});

Hooks.once("ready", () => {
  game.socket.on(MM_SOCKET, async (data) => {
    if (data?.type !== "markDamageApplied") return;
    // One GM writes. Without this every connected GM would race on the same
    // flag and the last write would win by chance.
    if (game.users.activeGM?.id !== game.user.id) return;
    const message = game.messages.get(data.messageId);
    const flag = message?.getFlag("marvel-multiverse", "damage");
    if (!flag) return;
    await message.setFlag("marvel-multiverse", "damage", {
      ...flag,
      applied: withApplied(flag.applied, data.uuid),
    });
  });
});

/**
 * Wire the chat card's Activate button, and hide it from anyone who may not use
 * it. The button is in the message content, which every user receives, so the
 * check has to happen per viewer at render time.
 */
Hooks.on("renderChatMessageHTML", (message, html) => {
  const el = html instanceof HTMLElement ? html : html?.[0];
  const button = el?.querySelector?.("button.mm-activate-power");
  if (!button) return;

  const actor = game.actors?.get(button.dataset.actorId);
  if (!actor || !_canActivatePowers(actor)) {
    button.closest(".mm-chat-activate")?.remove();
    return;
  }

  // The hook fires more than once per message in v14. Binding again on the same
  // element would spend the cost twice from a single click.
  if (button.dataset.mmBound === "1") return;
  button.dataset.mmBound = "1";

  button.addEventListener("click", async (ev) => {
    ev.preventDefault();
    const item = actor.items.get(button.dataset.itemId);
    if (!item) return ui.notifications.warn("That power is no longer on the character.");
    button.disabled = true;
    try {
      await _activatePower(actor, item);
    } finally {
      button.disabled = false;
    }
  });
});

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
  const flavorEl = html.find ? html.find(".mm-roll-flavor")[0] : html.querySelector?.(".mm-roll-flavor");

  const flavorText = html.find ? html.find(".flavor-text")[0] : html.querySelector?.(".flavor-text");
  const isInitiative = !flavorEl && flavorText?.textContent?.includes("Initiative");

  if (!flavorEl && !isInitiative) return;

  let tokenImg;
  if (flavorEl) {
    tokenImg = flavorEl.dataset.tokenImg;
  } else {
    const speaker = message.speaker;
    const scene = game.scenes?.get(speaker.scene);
    const tokenDoc = scene?.tokens?.get(speaker.token);
    tokenImg = tokenDoc?.texture?.src;
    if (!tokenImg) {
      const actor = game.actors?.get(speaker.actor);
      const activeToken = actor?.getActiveTokens?.()?.[0];
      if (activeToken?.document?.texture?.src) {
        tokenImg = activeToken.document.texture.src;
      } else {
        const protoSrc = actor?.prototypeToken?.texture?.src;
        if (protoSrc && !protoSrc.includes("*")) tokenImg = protoSrc;
        else tokenImg = actor?.img || "";
      }
    }
  }

  const header = html.find ? html.find(".message-header")[0] : html.querySelector(".message-header");
  if (!header) return;

  header.classList.add("mm-custom-header");
  header.style.cssText = "background:#8b0502;padding:2px 8px;margin-left:3px;position:relative;overflow:visible;min-height:32px;align-items:center;flex-wrap:nowrap;display:flex;";

  const sender = header.querySelector(".message-sender");
  if (sender) {
    sender.style.cssText = "color:#fff;font-weight:700;font-size:14px;white-space:nowrap;flex:1;padding-left:" + (tokenImg ? "29px" : "0") + ";";
    const nameEl = sender.querySelector(".title");
    if (nameEl) nameEl.style.color = "#fff";
  }

  const timestamp = header.querySelector(".message-timestamp");
  if (timestamp) timestamp.style.cssText = "color:rgba(255,255,255,0.7);white-space:nowrap;font-size:10px;";

  const metadata = header.querySelector(".message-metadata");
  if (metadata) metadata.style.cssText = "white-space:nowrap;flex-shrink:0;margin-left:auto;";

  const flavorInHeader = header.querySelector(".flavor-text");
  if (flavorInHeader) {
    header.parentNode.insertBefore(flavorInHeader, header.nextSibling);
  }

  if (tokenImg) {
    const img = document.createElement("img");
    img.src = tokenImg;
    img.style.cssText = "position:absolute;left:-7px;top:50%;transform:translateY(-50%);width:36px;height:36px;border:none;border-radius:50%;object-fit:cover;";
    header.insertBefore(img, header.firstChild);
  }

});

/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */

Hooks.once("ready", () => {
  // One delegated listener rather than a per-render binding, because enriched
  // roll links turn up in chat, on sheets and in journal entries alike.
  document.body.addEventListener("click", _onRollLinkClick);

  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
  Hooks.on("hotbarDrop", (bar, data, slot) => {
    // Core suppresses its own handling only on a strict `false`, and checks the
    // return synchronously. Returning an async create*Macro() promise would
    // never match, so core would also assign a macro to this slot.
    if (data.type === "MarvelMultiverseCheck") {
      createCheckMacro(data, slot);
      return false;
    }
    // Only Items become roll macros; let core handle Macro, RollTable, etc.
    if (data.type !== "Item") return;
    createItemMacro(data, slot);
    return false;
  });

  const chatLog = document.querySelector("ol.chat-log");
  if (chatLog) {
    const CM = foundry.applications.ux.ContextMenu.implementation ?? ContextMenu;
    const menuItems = ui.chat._getEntryContextOptions();
    const clickCtx = new CM(chatLog, ".message[data-message-id]", menuItems, { eventName: "mmclick", jQuery: false });
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".chat-message [data-context-menu]");
      if (!btn) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      clickCtx._onActivate(e);
    });
  }
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
          <a href="https://github.com/worldsofwondergames/marvel-multiverse/releases/latest" target="_blank">
            Marvel Multiverse RPG
          </a>
        </li>
        <li>
          <a href="https://github.com/worldsofwondergames/marvel-multiverse/issues" target="_blank">${game.i18n.localize(
            "MARVEL_MULTIVERSE.Issues"
          )}</a>
        </li>
        <li>
          <a href="https://github.com/worldsofwondergames/marvel-multiverse/wiki" target="_blank">${game.i18n.localize(
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
  // First, determine if this is a valid owned item. `data.type` is the Document
  // name, so it is "Item" for every item including weapons — `weapon` is an item
  // subtype and never appears here.
  if (data.type !== "Item") return;
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
 * Create a Macro from an ability or non-combat check dropped on the hotbar.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
async function createCheckMacro(data, slot) {
  const actor = await fromUuid(data.actorUuid);
  if (!actor) {
    return ui.notifications.warn(
      "Could not find the actor this check was dragged from."
    );
  }

  const noncom = data.rollType === "noncom";
  const abilityLabel =
    game.i18n.localize(CONFIG.MARVEL_MULTIVERSE.abilities[data.abilityKey]) ??
    data.abilityKey;
  const name = noncom
    ? `${actor.name}: ${abilityLabel} (Non-Combat)`
    : `${actor.name}: ${abilityLabel}`;
  const command = `game.MarvelMultiverse.rollCheckMacro("${data.actorUuid}", "${data.abilityKey}", ${noncom});`;

  let macro = game.macros.find(
    (m) => m.name === name && m.command === command
  );
  if (!macro) {
    macro = await Macro.create({
      name: name,
      type: "script",
      img: actor.img,
      command: command,
      flags: { "marvel-multiverse.checkMacro": true },
    });
  }
  game.user.assignHotbarMacro(macro, slot);
  return false;
}

/**
 * Prepares rich-text fields for display on a sheet.
 *
 * Handlebars helpers cannot await, and enrichHTML is async, so enriched values
 * have to be built in getData() and handed to the template as a parallel
 * context key. The {{editor}} helper then shows the enriched text while
 * ApplicationV1 loads the raw stored value from the document when the editor
 * is actually opened, so what gets saved is never the enriched copy.
 */

/** The rich-text fields that can appear on a document in this system. */
const RICH_TEXT_FIELDS = [
  "description",
  "effect",
  "notes",
  "history",
  "personality",
  "distinguishingFeatures",
  "profile",
  "downtimeActivity",
  "intelligenceDescription",
];

/**
 * Resolve the namespaced TextEditor, falling back to the deprecated global on
 * anything older than v13.
 */
function getTextEditor() {
  return foundry.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor;
}

/**
 * Build enriched copies of whichever rich-text fields the document actually
 * has. Fields the document does not define are skipped rather than emitted as
 * empty strings, so a template asking for a field that does not belong to its
 * type renders nothing instead of a blank editor.
 *
 * @param {Document} doc            The actor or item being rendered
 * @param {object} [options]
 * @param {object} [options.rollData]  Roll data so inline rolls resolve
 * @param {string[]} [options.fields]  Override the default field list
 * @returns {Promise<object>}       Keyed by field name, e.g. {description: "..."}
 */
async function enrichSheetFields(doc, { rollData, fields = RICH_TEXT_FIELDS } = {}) {
  const TE = getTextEditor();
  const enriched = {};
  if (!doc || !TE?.enrichHTML) return enriched;

  for (const field of fields) {
    const value = doc.system?.[field];
    if (value === undefined || value === null) continue;
    enriched[field] = await TE.enrichHTML(String(value), {
      rollData,
      relativeTo: doc,
      // Secret blocks are for whoever owns the document. A player looking at
      // someone else's sheet should not see them.
      secrets: doc.isOwner ?? false,
    });
  }
  return enriched;
}

/**
 * Turns roll-calling phrases in power text into clickable rolls.
 *
 * Power descriptions say things like "the character makes an Ego check
 * against the target's Ego defense". The first half names a roll the player
 * should make; the second half is the number they are rolling against. Only
 * the first becomes a link.
 *
 * Registered as a custom enricher, so it runs anywhere enrichHTML runs.
 * Foundry already enriches chat message content, which covers the power cards.
 */

/** Ability names as they appear in the rulebook, mapped to schema keys. */
const ABILITY_BY_NAME = {
  melee: "mle",
  agility: "agl",
  resilience: "res",
  vigilance: "vig",
  ego: "ego",
  logic: "log",
};

/**
 * Attacks that name a range rather than an ability. The rulebook defines a
 * close attack as Melee and a ranged attack as Agility.
 */
const IMPLIED_ABILITY = {
  close: "mle",
  ranged: "agl",
};

const ROLL_LINK_ABILITIES = Object.keys(ABILITY_BY_NAME).join("|");

/**
 * Words allowed between the cue verb and the phrase: articles and counts, so
 * "makes an Ego check" and "makes two Melee attacks" both qualify.
 */
const ROLL_LINK_CUE_FILLER = "(?:a|an|the|another|one|two|three|four|five|six|\\d+)";

/**
 * A phrase names a roll only when something tells the reader to make it.
 * "makes a close attack" is an instruction; "gains an edge on all close
 * attacks" names the class of rolls a bonus applies to and is not clickable.
 *
 * Written as a lookbehind so the cue decides whether to match without becoming
 * part of the link text -- the anchor still reads "close attack".
 *
 * "made" is left out on purpose: "on all action checks made while this is in
 * effect" is a description, not an instruction.
 */
const ROLL_LINK_INSTRUCTION_CUE =
  `(?<=\\b(?:makes?|making|rolls?|rolling|requires?|attempts?)\\s+(?:${ROLL_LINK_CUE_FILLER}\\s+)*)`;

/**
 * One pattern rather than several, because alternation is ordered: at a given
 * position the first alternative that matches wins. That is what stops the
 * bare "Melee check" branch from eating the "Melee check (target number 20)"
 * branch. Separate enrichers would each get their own pass and could nest.
 *
 * Deliberately not matched:
 *   - "Ego defense" and friends, which are the number being rolled against
 *   - bare "the attack", which refers back to a roll already made
 *   - bare "action check", which describes a bonus and names no ability
 *   - any phrase with no instruction cue in front of it, per the cue above
 */
const ROLL_LINK_PATTERN = new RegExp(
  ROLL_LINK_INSTRUCTION_CUE +
  "\\b(?:" +
    // "makes an Ego vs. TN 12 action check"
    `(?<tnAbility>${ROLL_LINK_ABILITIES})\\s+vs\\.?\\s+TN\\s+(?<tnValue>\\d+)\\s+action\\s+checks?\\b` +
    // "requires a Melee check (target number 20)"
    `|(?<parenAbility>${ROLL_LINK_ABILITIES})\\s+checks?\\s*\\(\\s*target\\s+number\\s+(?<parenValue>\\d+)\\s*\\)` +
    // "makes an Ego check", "makes a Melee attack"
    `|(?<ability>${ROLL_LINK_ABILITIES})\\s+(?<abilityKind>checks?|attacks?)\\b` +
    // "makes a close attack", "makes a ranged attack"
    `|(?<implied>close|ranged)\\s+(?<impliedKind>attacks?)\\b` +
  ")",
  "gi"
);

/**
 * Read a regex match into the roll it describes.
 * @param {RegExpMatchArray} match
 * @returns {{abilityKey: string, kind: string, tn: number|null, label: string}|null}
 */
function describeRollLink(match) {
  const groups = match?.groups;
  if (!groups) return null;
  const label = match[0];

  if (groups.tnAbility) {
    return {
      abilityKey: ABILITY_BY_NAME[groups.tnAbility.toLowerCase()],
      kind: "check",
      tn: Number(groups.tnValue),
      label,
    };
  }
  if (groups.parenAbility) {
    return {
      abilityKey: ABILITY_BY_NAME[groups.parenAbility.toLowerCase()],
      kind: "check",
      tn: Number(groups.parenValue),
      label,
    };
  }
  if (groups.ability) {
    return {
      abilityKey: ABILITY_BY_NAME[groups.ability.toLowerCase()],
      kind: /attack/i.test(groups.abilityKind) ? "attack" : "check",
      tn: null,
      label,
    };
  }
  if (groups.implied) {
    return {
      abilityKey: IMPLIED_ABILITY[groups.implied.toLowerCase()],
      kind: "attack",
      tn: null,
      label,
    };
  }
  return null;
}

/**
 * Build the anchor an enriched phrase becomes.
 * @param {object} descriptor  Output of describeRollLink
 * @returns {HTMLAnchorElement}
 */
function buildRollLinkAnchor({ abilityKey, kind, tn, label }) {
  const anchor = document.createElement("a");
  anchor.classList.add("mm-roll-link");
  anchor.dataset.ability = abilityKey;
  anchor.dataset.rollKind = kind;
  if (tn !== null && tn !== undefined) anchor.dataset.tn = String(tn);
  const icon = document.createElement("i");
  icon.className = "fa-solid fa-dice-d6";
  anchor.append(icon, document.createTextNode(label));
  return anchor;
}

/**
 * The custom enricher itself. Returning nothing leaves the text as it was.
 * @param {RegExpMatchArray} match
 * @returns {HTMLAnchorElement|null}
 */
function enrichRollLink(match) {
  const descriptor = describeRollLink(match);
  if (!descriptor?.abilityKey) return null;
  return buildRollLinkAnchor(descriptor);
}

/**
 * Work out whose check this is from where the link was clicked.
 *
 * A link in a chat card belongs to the actor who spoke it. A link on a sheet
 * belongs to that sheet's actor. Failing both, fall back to whoever the user
 * is currently playing, which covers links in a journal entry.
 * @param {HTMLElement} anchor
 * @returns {Actor|null}
 */
function resolveRollLinkActor(anchor) {
  const messageEl = anchor.closest("[data-message-id]");
  if (messageEl) {
    const message = game.messages.get(messageEl.dataset.messageId);
    if (message?.speakerActor) return message.speakerActor;
  }

  const appEl = anchor.closest("[data-appid]");
  if (appEl) {
    const app = ui.windows?.[appEl.dataset.appid];
    const doc = app?.document ?? app?.actor ?? app?.object;
    if (doc?.documentName === "Actor") return doc;
    if (doc?.parent?.documentName === "Actor") return doc.parent;
  }

  const controlled = canvas?.tokens?.controlled ?? [];
  if (controlled.length === 1 && controlled[0].actor) return controlled[0].actor;
  return game.user?.character ?? null;
}

/**
 * Roll the check a link names. Bound once on the document, since these links
 * appear in chat, on sheets and in journals alike.
 * @param {PointerEvent} event
 */
async function _onRollLinkClick(event) {
  const anchor = event.target.closest?.("a.mm-roll-link");
  if (!anchor) return;
  event.preventDefault();
  event.stopPropagation();

  const actor = resolveRollLinkActor(anchor);
  if (!actor) {
    return ui.notifications.warn(
      "Select a token or assign yourself a character to roll this check."
    );
  }
  if (!actor.isOwner && !game.user.isGM) {
    return ui.notifications.warn(`You do not have permission to roll for ${actor.name}.`);
  }

  const tn = anchor.dataset.tn ? Number(anchor.dataset.tn) : null;
  return rollAbilityCheck(actor, anchor.dataset.ability, { tn });
}

/**
 * Roll an ability or non-combat check for an actor.
 *
 * Shared by the sheet click handler and the hotbar macro so both paths produce
 * the same chat card.
 * @param {Actor} actor             The actor making the check
 * @param {string} abilityKey       One of the six ability keys, e.g. "mle"
 * @param {object} [options]
 * @param {boolean} [options.noncom=false]   Roll the non-combat check instead
 * @param {number|null} [options.tn=null]    Target number stated in the power
 *                                           text, if it gave one
 * @returns {Promise<MarvelMultiverseRoll|null>}
 */
async function rollAbilityCheck(actor, abilityKey, { noncom = false, tn = null } = {}) {
  const abilityData = actor?.system?.abilities?.[abilityKey];
  if (!abilityData) {
    ui.notifications.warn(
      `Could not find the ${abilityKey} ability on ${actor?.name ?? "this actor"}.`
    );
    return null;
  }

  const formula = `{1d6,1dm,1d6}+@abilities.${abilityKey}.${noncom ? "noncom" : "value"}`;
  const abilityLabel =
    game.i18n.localize(CONFIG.MARVEL_MULTIVERSE.abilities[abilityKey]) ??
    abilityKey;

  let flavor = _buildRollFlavor({
    tokenImg: _getTokenImg(actor),
    actorName: actor.name,
    ability: abilityLabel,
  });

  let edgeMode = MarvelMultiverseRoll.EDGE_MODE.NORMAL;
  if (abilityData.edge) edgeMode = MarvelMultiverseRoll.EDGE_MODE.EDGE;
  else if (abilityData.trouble)
    edgeMode = MarvelMultiverseRoll.EDGE_MODE.TROUBLE;

  const roll = new CONFIG.Dice.MarvelMultiverseRoll(
    formula,
    actor.getRollData(),
    { edgeMode }
  );

  if (
    abilityKey === "ego" &&
    game.settings.get("marvel-multiverse", "mutantReputationEnabled")
  ) {
    const repOverride = actor.system.mutantReputation;
    const repKey =
      repOverride !== "world"
        ? repOverride
        : game.settings.get("marvel-multiverse", "mutantReputationLevel");
    const repConfig = MARVEL_MULTIVERSE.mutantReputationLevels[repKey];
    if (repConfig && repKey !== "neutral") {
      flavor += `<div style="margin-top:4px;padding:2px 6px;background:#5c3d6e;color:#fff;border-radius:3px;font-size:11px;"><b>Mutant Reputation (${repConfig.label}):</b> ${repConfig.effect}</div>`;
    }
  }

  // When the power text stated a target number, settle the roll first so the
  // card can say whether it was met rather than leaving the player to compare.
  if (Number.isFinite(tn)) {
    await roll.evaluate();
    const met = roll.isFantastic || roll.total >= tn;
    const outcome = roll.isFantastic
      ? "<b>Fantastic!</b>"
      : met
        ? "<b>Success</b>"
        : "<b>Failed</b>";
    flavor += `<div class="mm-roll-tn"><div>vs TN ${tn} — ${outcome}</div></div>`;
  }

  const rollMode = game.settings.get("core", "rollMode");
  const messageData = {
    speaker: ChatMessage.getSpeaker({ actor: actor }),
    flavor: flavor,
    rollMode: rollMode,
    title: "",
  };
  const attackTargets = _getAttackTargets(abilityKey);
  if (attackTargets.length) {
    messageData["flags.marvel-multiverse.targets"] = attackTargets;
  }

  roll.toMessage(messageData, { rollMode: rollMode });
  return roll;
}

/**
 * Execute an ability or non-combat check macro created from a hotbar drop.
 * @param {string} actorUuid
 * @param {string} abilityKey
 * @param {boolean} [noncom=false]
 */
async function rollCheckMacro(actorUuid, abilityKey, noncom = false) {
  const actor = await fromUuid(actorUuid);
  if (!actor) {
    return ui.notifications.warn(
      "Could not find the actor for this check. You may need to delete and recreate this macro."
    );
  }
  return rollAbilityCheck(actor, abilityKey, { noncom });
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

export { ChatMessageMarvel, MARVEL_MULTIVERSE, MarvelMultiverseActor, MarvelMultiverseCharacterSheet, MarvelMultiverseItem$1 as MarvelMultiverseItem, MarvelMultiverseItemSheet, MarvelMultiverseNPCSheet, canApplyDamage, computeDamage, damageReductionPath, damageValuePath, dice, isTargetHit, models, rollAbilityCheck, rollCheckMacro, rollItemMacro, withApplied };
//# sourceMappingURL=marvel-multiverse-compiled.mjs.map
