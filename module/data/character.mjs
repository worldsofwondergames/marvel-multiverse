import MarvelMultiverseActorBase from "./actor-base.mjs";

export default class MarvelMultiverseCharacter extends MarvelMultiverseActorBase {
  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = MarvelMultiverseActorBase.defineSchema();

    schema.teamManeuver = new fields.SchemaField({
      maneuverType: new fields.StringField({ required: true, blank: true }),
      level: new fields.NumberField({ min: 1, max: 3, integer: true, nullable: true }),
      named: new fields.StringField({ required: false, blank: true }),
    });

    // The ten boxes of the Schooling Advancement Chart. Named boolean fields
    // rather than an ArrayField: an ArrayField needs a function for its
    // `initial`, and shipping-parity compares declared initials with toEqual,
    // which compares functions by reference and would fail across the trees.
    schema.schooling = new fields.SchemaField({
      boxes: new fields.SchemaField(
        Object.fromEntries(
          Array.from({ length: 10 }, (_, i) => [
            `box${i}`,
            new fields.BooleanField({ required: true, initial: false }),
          ])
        )
      ),
    });

    return schema;
  }

  prepareDerivedData() {
    super.prepareDerivedData();

    // Written to `schooling`, not `schooling.boxes`, so the count never picks
    // up its own output on a subsequent prepare.
    this.schooling.completed = Object.values(this.schooling.boxes).filter(Boolean).length;
    this.schooling.readyToAdvance = this.schooling.completed >= 10;
  }
}
