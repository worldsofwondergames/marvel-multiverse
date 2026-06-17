import {
  onManageActiveEffect,
  prepareActiveEffectCategories,
} from "../helpers/effects.mjs";

/**
 * Extend the basic ItemSheet with some very simple modifications
 * @extends {ItemSheet}
 */
export class MarvelMultiverseItemSheet extends ItemSheet {
  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(ItemSheet.defaultOptions, {
      classes: ["marvel-multiverse", "sheet", "item"],
      width: 520,
      height: 480,
      dragDrop: [{ dropSelector: null }],
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-body",
          initial: "description",
        },
      ],
    });
  }

  /** @override */
  get template() {
    const path = "systems/marvel-multiverse/templates/item";
    // Return a single sheet for all item types.
    // return `${path}/item-sheet.hbs`;

    // Alternatively, you could use the following return statement to do a
    // unique item sheet by type, like `weapon-sheet.hbs`.
    const itemSheet = `${path}/item-${this.item.type}-sheet.hbs`;
    console.log(
      `Loading item sheet template: ${itemSheet} for type ${this.item.type}`
    );
    return itemSheet;
  }

  /* -------------------------------------------- */

  /** @override */
  getData() {
    // Retrieve base data structure.
    const context = super.getData();

    // Use a safe clone of the item data for further operations.
    const itemData = context.data;

    // Retrieve the roll data for TinyMCE editors.
    context.rollData = this.item.getRollData();

    // Add the item's data to context.data for easier access, as well as flags.
    context.system = itemData.system;
    context.flags = itemData.flags;

    // Prepare active effects for easier access
    context.effects = prepareActiveEffectCategories(this.item.effects);

    // Prepare data and items.
    if (itemData.type === "power" || itemData.type === "weapon") {
      context.elements = Object.fromEntries(
        Object.keys(CONFIG.MARVEL_MULTIVERSE.elements).map((k) => [
          k,
          CONFIG.MARVEL_MULTIVERSE.elements[k].label,
        ])
      );
      context.selectedElement = context.system.element;

      context.damageTypes = {
        health: { label: "Health" },
        focus: { label: "Focus" },
      };

      context.attackKinds = {
        ranged: { label: "Ranged" },
        close: { label: "Close" },
      };
      context.attackEdgeModes = {
        edge: { label: "Edge" },
        normal: { label: "Normal" },
        trouble: { label: "Trouble" },
      };
      context.abilities = {
        mle: {
          label: game.i18n.localize(CONFIG.MARVEL_MULTIVERSE.abilities.mle),
        },
        agl: {
          label: game.i18n.localize(CONFIG.MARVEL_MULTIVERSE.abilities.agl),
        },
        res: {
          label: game.i18n.localize(CONFIG.MARVEL_MULTIVERSE.abilities.res),
        },
        vig: {
          label: game.i18n.localize(CONFIG.MARVEL_MULTIVERSE.abilities.vig),
        },
        ego: {
          label: game.i18n.localize(CONFIG.MARVEL_MULTIVERSE.abilities.ego),
        },
        log: {
          label: game.i18n.localize(CONFIG.MARVEL_MULTIVERSE.abilities.log),
        },
      };
    }
    if (itemData.type === "restriction") {
      context.restrictionKinds = Object.fromEntries(
        Object.keys(CONFIG.MARVEL_MULTIVERSE.restrictionKinds).map((k) => [
          k,
          CONFIG.MARVEL_MULTIVERSE.restrictionKinds[k].label,
        ])
      );
    }
    if (itemData.type === "iconicItem") {
      context.ownershipModes = Object.fromEntries(
        Object.keys(CONFIG.MARVEL_MULTIVERSE.ownershipModes).map((k) => [
          k,
          CONFIG.MARVEL_MULTIVERSE.ownershipModes[k].label,
        ])
      );
      context.specialEffectTypes = Object.fromEntries(
        Object.keys(CONFIG.MARVEL_MULTIVERSE.specialEffectTypes).map((k) => [
          k,
          CONFIG.MARVEL_MULTIVERSE.specialEffectTypes[k].label,
        ])
      );
      context.restrictionKinds = CONFIG.MARVEL_MULTIVERSE.restrictionKinds;
      const powersCount = context.system.powers?.length ?? 0;
      const restrictionsCount = context.system.restrictions?.length ?? 0;
      context.powerValue = (powersCount === 0 && restrictionsCount === 0) ? 0 : Math.max(1, powersCount - restrictionsCount);
    }
    return context;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.isEditable) return;

    // Roll handlers, click handlers, etc. would go here.

    // Active Effect management
    html.on("click", ".effect-control", (ev) =>
      onManageActiveEffect(ev, this.item)
    );

    // Iconic item: restriction management
    html.on("click", ".iconic-restriction-add", async (ev) => {
      ev.preventDefault();
      const restrictions = [...this.item.system.restrictions];
      restrictions.push({ kind: "access", name: "", description: "" });
      await this.item.update({ "system.restrictions": restrictions });
    });

    html.on("click", ".iconic-restriction-remove", async (ev) => {
      ev.preventDefault();
      const index = Number(ev.currentTarget.dataset.index);
      const restrictions = [...this.item.system.restrictions];
      restrictions.splice(index, 1);
      await this.item.update({ "system.restrictions": restrictions });
    });

    html.on("click", ".iconic-restriction-edit", async (ev) => {
      ev.preventDefault();
      const index = Number(ev.currentTarget.dataset.index);
      const restrictions = [...this.item.system.restrictions];
      const restriction = restrictions[index];
      const kindOptions = Object.entries(CONFIG.MARVEL_MULTIVERSE.restrictionKinds)
        .map(([k, v]) => `<option value="${k}" ${k === restriction.kind ? "selected" : ""}>${v.label}</option>`)
        .join("");
      const content = `
        <form>
          <div class="form-group">
            <label>Kind</label>
            <select name="kind">${kindOptions}</select>
          </div>
          <div class="form-group">
            <label>Name</label>
            <input type="text" name="name" value="${restriction.name ?? ""}" />
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea name="description">${restriction.description ?? ""}</textarea>
          </div>
        </form>`;
      new Dialog({
        title: "Edit Restriction",
        content,
        buttons: {
          save: {
            label: "Save",
            callback: async (html) => {
              restrictions[index] = {
                kind: html.find('[name="kind"]').val(),
                name: html.find('[name="name"]').val(),
                description: html.find('[name="description"]').val(),
              };
              await this.item.update({ "system.restrictions": restrictions });
            },
          },
          cancel: { label: "Cancel" },
        },
        default: "save",
      }).render(true);
    });

    // Iconic item: power removal
    html.on("click", ".iconic-power-remove", async (ev) => {
      ev.preventDefault();
      const index = Number(ev.currentTarget.dataset.index);
      const powers = [...this.item.system.powers];
      powers.splice(index, 1);
      await this.item.update({ "system.powers": powers });
    });

    // Iconic item: drop zone visual feedback
    const dropZones = html.find(".mm-iconic-powers-drop-zone, .mm-iconic-restrictions-drop-zone");
    dropZones.on("dragover", (ev) => {
      ev.preventDefault();
      ev.currentTarget.classList.add("drag-over");
    });
    dropZones.on("dragleave", (ev) => {
      ev.currentTarget.classList.remove("drag-over");
    });
  }

  async _onDrop(event) {
    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData("text/plain"));
    } catch (e) {
      return super._onDrop(event);
    }
    if (data?.type !== "Item") return super._onDrop(event);

    const droppedItem = await Item.implementation.fromDropData(data);

    // Handle powerSet drops onto power items
    if (droppedItem.type === "powerSet" && this.item.type === "power") {
      const powerSets = [...this.item.system.powerSets];
      if (powerSets.some(ps => ps.name === droppedItem.name)) return;
      powerSets.push({
        id: droppedItem.id,
        name: droppedItem.name,
        img: droppedItem.img,
      });
      const powerSet = powerSets.map(ps => ps.name).join(", ");
      return await this.item.update({ "system.powerSets": powerSets, "system.powerSet": powerSet });
    }

    // Handle restriction drops onto iconic items
    if (droppedItem.type === "restriction" && this.item.type === "iconicItem") {
      const restrictions = [...this.item.system.restrictions];
      if (restrictions.some(r => r.name === droppedItem.name)) return;
      restrictions.push({
        kind: droppedItem.system.kind,
        name: droppedItem.name,
        description: droppedItem.system.description,
      });
      return await this.item.update({ "system.restrictions": restrictions });
    }

    // Handle power drops onto iconic items
    if (droppedItem.type === "power" && this.item.type === "iconicItem") {
      const powers = [...this.item.system.powers];
      if (powers.some(p => p.name === droppedItem.name)) return;
      powers.push({
        id: droppedItem.id,
        name: droppedItem.name,
        img: droppedItem.img,
      });
      return await this.item.update({ "system.powers": powers });
    }

    return super._onDrop(event);
  }
}
