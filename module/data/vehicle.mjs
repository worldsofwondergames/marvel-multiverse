export default class MarvelMultiverseVehicle extends foundry.abstract.TypeDataModel {
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

    this.crew = this.occupants.length;

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
