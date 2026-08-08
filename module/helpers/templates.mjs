/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
export const preloadHandlebarsTemplates = async () =>
  foundry.applications.handlebars.loadTemplates([
    // Actor partials.
    "systems/marvel-multiverse/templates/actor/parts/actor-biography.hbs",
    "systems/marvel-multiverse/templates/actor/parts/actor-details.hbs",
    "systems/marvel-multiverse/templates/actor/parts/actor-schooling.hbs",
    "systems/marvel-multiverse/templates/actor/parts/actor-effects.hbs",
    "systems/marvel-multiverse/templates/actor/parts/actor-items.hbs",
    "systems/marvel-multiverse/templates/actor/parts/actor-occupation.hbs",
    "systems/marvel-multiverse/templates/actor/parts/actor-origin.hbs",
    "systems/marvel-multiverse/templates/actor/parts/actor-powers.hbs",
    "systems/marvel-multiverse/templates/actor/parts/actor-tags.hbs",
    "systems/marvel-multiverse/templates/actor/parts/actor-traits.hbs",
    "systems/marvel-multiverse/templates/actor/parts/actor-equipment.hbs",
    "systems/marvel-multiverse/templates/actor/parts/actor-weapons.hbs",
    "systems/marvel-multiverse/templates/actor/parts/actor-alternate-forms.hbs",
    // Item partials
    "systems/marvel-multiverse/templates/item/parts/item-effects.hbs",
    // Dialog partials
    "systems/marvel-multiverse/templates/dialogs/add-form-dialog.hbs",
    // Sidebar partials
    "systems/marvel-multiverse/templates/sidebar/actor-directory-filters.hbs",
  ]);
