import { nextBonusTurn, previousBonusTurn } from "../helpers/bonus-round.mjs";

/**
 * A combatant that remembers its last initiative roll, so the combat can tell
 * whether the result was Fantastic.
 */
export class MarvelMultiverseCombatant extends Combatant {
  /** @override */
  getInitiativeRoll(formula) {
    this._initiativeRoll = super.getInitiativeRoll(formula);
    return this._initiativeRoll;
  }

  /** Whether the initiative result of this combatant was Fantastic. */
  get hasFantasticInitiative() {
    return this.getFlag("marvel-multiverse", "fantasticInitiative") === true;
  }
}

/**
 * A combat that begins with a bonus round when any combatant has a Fantastic
 * initiative result. The bonus round is stored as round 1, and only those
 * combatants act in it.
 */
export class MarvelMultiverseCombat extends Combat {
  /** Whether this encounter began with a bonus round. */
  get hasBonusRound() {
    return this.getFlag("marvel-multiverse", "bonusRound") === true;
  }

  /** Whether the combat is in its bonus round now. */
  get inBonusRound() {
    return this.hasBonusRound && this.round === 1;
  }

  _bonusTurns() {
    return this.turns.map((c) => ({ fantastic: c.hasFantasticInitiative, defeated: c.isDefeated }));
  }

  /** @override */
  async rollInitiative(ids, options = {}) {
    ids = typeof ids === "string" ? [ids] : ids;
    await super.rollInitiative(ids, options);
    const updates = [];
    for (const id of ids) {
      const roll = this.combatants.get(id)?._initiativeRoll;
      if (!roll?._evaluated) continue;
      updates.push({ _id: id, "flags.marvel-multiverse.fantasticInitiative": roll.isFantastic === true });
    }
    if (updates.length) await this.updateEmbeddedDocuments("Combatant", updates, { turnEvents: false });
    return this;
  }

  /** @override */
  async startCombat() {
    const first = nextBonusTurn(this._bonusTurns(), -1, this.settings.skipDefeated);
    this._playCombatSound("startEncounter");
    const updateData = { round: 1, turn: first ?? 0, "flags.marvel-multiverse.bonusRound": first !== null };
    Hooks.callAll("combatStart", this, updateData);
    await this.update(updateData);
    await ActiveEffect.registry.refresh("combatStart", { combat: this });
    return this;
  }

  /** @override */
  async nextTurn() {
    if (!this.inBonusRound) return super.nextTurn();
    const next = nextBonusTurn(this._bonusTurns(), this.turn ?? -1, this.settings.skipDefeated);
    if (next === null) return this.nextRound();
    return this._moveBonusTurn(next, 1);
  }

  /** @override */
  async previousTurn() {
    if (!this.inBonusRound) return super.previousTurn();
    const previous = previousBonusTurn(this._bonusTurns(), this.turn ?? this.turns.length, this.settings.skipDefeated);
    if (previous === null) return this.previousRound();
    return this._moveBonusTurn(previous, -1);
  }

  /** @override */
  async previousRound() {
    if (!(this.hasBonusRound && this.round === 2)) return super.previousRound();
    const last = previousBonusTurn(this._bonusTurns(), this.turns.length, this.settings.skipDefeated);
    const updateData = { round: 1, turn: last };
    const updateOptions = { direction: -1, worldTime: { delta: this.getTimeDelta(this.round, this.turn, 1, last) } };
    Hooks.callAll("combatRound", this, updateData, updateOptions);
    await this.update(updateData, updateOptions);
    return this;
  }

  async _moveBonusTurn(turn, direction) {
    const updateData = { round: this.round, turn };
    const updateOptions = { direction, worldTime: { delta: this.getTimeDelta(this.round, this.turn, this.round, turn) } };
    Hooks.callAll("combatTurn", this, updateData, updateOptions);
    await this.update(updateData, updateOptions);
    return this;
  }

  /** @override */
  async resetAll(options) {
    const marked = this.combatants.filter((c) => c.hasFantasticInitiative);
    if (marked.length) {
      await this.updateEmbeddedDocuments("Combatant",
        marked.map((c) => ({ _id: c.id, "flags.marvel-multiverse.fantasticInitiative": false })), { turnEvents: false });
    }
    return super.resetAll(options);
  }
}
