import MarvelMultiverseItemBase from "./item-base.mjs";

export default class MarvelMultiverseIconicItem extends MarvelMultiverseItemBase {
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
    return Math.max(1, powersCount - restrictionsCount);
  }
}
