import MarvelMultiverseItemBase from "./item-base.mjs";

export default class MarvelMultiverseBattleSuit extends MarvelMultiverseItemBase {
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
