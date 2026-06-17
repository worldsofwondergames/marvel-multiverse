import MarvelMultiverseItemBase from "./item-base.mjs";

export default class MarvelMultiverseRestriction extends MarvelMultiverseItemBase {
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
