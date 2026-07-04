/**
 * Extend the basic ActorSheet to handle Headquarters actors.
 * @extends {ActorSheet}
 */
export class MarvelMultiverseHeadquartersSheet extends ActorSheet {
  /** @override */
  static get defaultOptions() {
    // biome-ignore lint/complexity/noThisInStatic: <explanation>
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["marvel-multiverse", "sheet", "actor"],
      width: 600,
      height: 700,
      tabs: [],
    });
  }

  /** @override */
  get template() {
    return "systems/marvel-multiverse/templates/actor/actor-headquarters-sheet.hbs";
  }

  /** @override */
  getData() {
    const context = super.getData();
    const actorData = context.data;
    context.system = actorData.system;
    context.flags = actorData.flags;
    this._prepareItems(context);
    this._prepareMembers(context);
    context.rollData = context.actor.getRollData();
    return context;
  }

  /**
   * Organize and classify items for the Headquarters sheet.
   * @param {object} context  The rendering context.
   */
  _prepareItems(context) {
    const hqTags = [];
    const hqTraits = [];
    for (const i of context.items) {
      i.img = i.img || Item.DEFAULT_ICON;
      if (i.type === "hqTag") hqTags.push(i);
      else if (i.type === "hqTrait") hqTraits.push(i);
    }
    hqTags.sort((a, b) => a.name.localeCompare(b.name));
    hqTraits.sort((a, b) => a.name.localeCompare(b.name));
    context.hqTags = hqTags;
    context.hqTraits = hqTraits;
  }

  /**
   * Resolve live actor data for each member reference stored in system.members.
   * @param {object} context  The rendering context.
   */
  _prepareMembers(context) {
    context.members = context.system.members.map(m => {
      const actor = game.actors?.get(m.actorId);
      return {
        actorId: m.actorId,
        name: actor?.name ?? m.name,
        img: actor?.img ?? m.img,
        rank: actor?.system?.attributes?.rank?.value ?? "?",
      };
    });
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    html.on("click", ".item-edit", (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.sheet.render(true);
    });
    if (!this.isEditable) return;
    html.on("click", ".item-delete", (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      this.actor.deleteEmbeddedDocuments("Item", [li.data("itemId")]);
      li.slideUp(200, () => this.render(false));
    });
    html.on("click", ".member-delete", this._onMemberDelete.bind(this));
  }

  /**
   * Handle removing a team member by index.
   * @param {Event} event  The originating click event.
   */
  async _onMemberDelete(event) {
    event.preventDefault();
    const index = Number(event.currentTarget.dataset.index);
    const members = foundry.utils.deepClone(this.actor.system.members);
    members.splice(index, 1);
    await this.actor.update({ "system.members": members });
  }

  /** @override */
  async _onDropActor(event, data) {
    if (!this.isEditable) return;
    const actor = await Actor.implementation.fromDropData(data);
    if (!actor) return;
    if (!["character", "npc"].includes(actor.type)) {
      ui.notifications.warn("Only characters and NPCs can be added as team members.");
      return;
    }
    const members = foundry.utils.deepClone(this.actor.system.members);
    if (members.some(m => m.actorId === actor.id)) {
      ui.notifications.warn(`${actor.name} ${game.i18n.localize("MARVEL_MULTIVERSE.Headquarters.MemberAlreadyAdded")}`);
      return;
    }
    members.push({ actorId: actor.id, name: actor.name, img: actor.img });
    await this.actor.update({ "system.members": members });
  }

  /** @override */
  async _onDropItemCreate(itemData) {
    const allowedTypes = ["hqTag", "hqTrait"];
    const items = Array.isArray(itemData) ? itemData : [itemData];
    for (const item of items) {
      if (!allowedTypes.includes(item.type)) {
        ui.notifications.warn(`Headquarters cannot hold ${item.type} items.`);
        return;
      }
      if (item.type === "hqTag") {
        const incomingIncompat = (item.system?.incompatible ?? "").split(",").map(s => s.trim()).filter(Boolean);
        const existingTags = this.actor.items.filter(i => i.type === "hqTag");
        for (const existing of existingTags) {
          const existingIncompat = (existing.system?.incompatible ?? "").split(",").map(s => s.trim()).filter(Boolean);
          if (incomingIncompat.includes(existing.name) || existingIncompat.includes(item.name)) {
            ui.notifications.warn(
              `${item.name} ${game.i18n.localize("MARVEL_MULTIVERSE.Headquarters.IncompatibleTag")} ${existing.name}.`
            );
            return;
          }
        }
      }
    }
    return super._onDropItemCreate(itemData);
  }
}
