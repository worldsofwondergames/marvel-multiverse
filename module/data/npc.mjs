import MarvelMultiverseActorBase from "./actor-base.mjs";

export default class MarvelMultiverseNPC extends MarvelMultiverseActorBase {
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

    const baseRunSpeed = this.movement.run.value;

    this.movement.climb.value = Math.ceil(baseRunSpeed * 0.5);
    this.movement.jump.value = Math.ceil(baseRunSpeed * 0.5);
    this.movement.swim.value = Math.ceil(baseRunSpeed * 0.5);

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
  }
}
