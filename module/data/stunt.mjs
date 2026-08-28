import MarvelMultiverseItemBase from "./item-base.mjs";

export default class MarvelMultiverseStunt extends MarvelMultiverseItemBase {
    static defineSchema() {
        const fields = foundry.data.fields;
        const schema = super.defineSchema();

        schema.prerequisite = new fields.StringField({ required: true, blank: true });
        schema.duration = new fields.StringField({ required: true, blank: true });
        schema.effect = new fields.StringField({ required: true, blank: true });
        schema.learned = new fields.BooleanField({ required: true, initial: false });
        schema.power = new fields.StringField({ required: true, blank: true });

        return schema;
    }
}
