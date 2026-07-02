export default class MarvelMultiverseActorBase extends foundry.abstract
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

    schema.mutantReputation = new fields.StringField({
      required: true,
      initial: "world",
    });

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
