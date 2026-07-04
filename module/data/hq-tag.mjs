export default class MarvelMultiverseHqTag extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = {};

    schema.description = new fields.StringField({ required: true, blank: true });
    schema.incompatible = new fields.StringField({ required: true, blank: true });

    return schema;
  }
}
