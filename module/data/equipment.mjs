import MarvelMultiverseItemBase from "./item-base.mjs";

export default class MarvelMultiverseEquipment extends MarvelMultiverseItemBase {
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

    // Protection fields
    schema.damageReduction = new fields.NumberField({
      ...requiredInteger,
      initial: 0,
      min: 0,
    });
    schema.protectionNotes = new fields.StringField({
      required: true,
      blank: true,
    });

    // Grenade fields
    schema.grenadeType = new fields.StringField({
      required: true,
      blank: true,
    });
    schema.grenadeEffect = new fields.StringField({
      required: true,
      blank: true,
    });

    // Gadget / Device fields
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
