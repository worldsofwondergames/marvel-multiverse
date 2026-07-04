export default class MarvelMultiverseHeadquarters extends foundry.abstract.TypeDataModel {
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
