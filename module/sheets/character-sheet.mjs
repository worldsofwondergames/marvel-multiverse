import {
  onManageActiveEffect,
  prepareActiveEffectCategories,
} from "../helpers/effects.mjs";
import { linkForm, unlinkForm, switchForm, validateFormLink } from "../helpers/alternate-forms.mjs";
import { enrichSheetFields } from "../helpers/enrich.mjs";
import { isVillainous } from "../helpers/villainous.mjs";
import { isBigFightEnabled, findGroup, groupAttackBonus } from "../helpers/big-fight.mjs";

/**
 * Extend the basic actor sheet with some very simple modifications
 * @extends {foundry.appv1.sheets.ActorSheet}
 */
export class MarvelMultiverseCharacterSheet extends foundry.appv1.sheets.ActorSheet {
  /** @override */
  static get defaultOptions() {
    // biome-ignore lint/complexity/noThisInStatic: <explanation>
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["marvel-multiverse", "sheet", "actor"],
      width: 690,
      height: 980,
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-body",
          initial: "traits",
        },
        {
          navSelector: ".mm-subtabs",
          contentSelector: ".mm-bio-body",
          initial: "details",
        },
      ],
    });
  }

  /** @override */
  get template() {
    return "systems/marvel-multiverse/templates/actor/actor-character-sheet.hbs";
  }

  /* -------------------------------------------- */

  /** @override */
  async getData() {
    // Retrieve the data structure from the base sheet. You can inspect or log
    // the context variable to see the structure, but some key properties for
    // sheets are the actor object, the data object, whether or not it's
    // editable, the items array, and the effects array.
    const context = super.getData();

    // Use a safe clone of the actor data for further operations.
    const actorData = context.data;

    // Add the actor's data to context.data for easier access, as well as flags.
    context.system = actorData.system;
    context.flags = actorData.flags;

    // Prepare character data and items.
    this._prepareItems(context);
    this._prepareData(context);

    // Add roll data for TinyMCE editors.
    context.rollData = context.actor.getRollData();

    context.sizes = CONFIG.MARVEL_MULTIVERSE.sizes;

    // Ten schooling boxes, labelled from the printed chart. Bound directly to
    // the schema path so the stock sheet submit persists them.
    const schoolingBoxes = this.actor.system.schooling.boxes;
    context.schoolingBoxes = CONFIG.MARVEL_MULTIVERSE.schoolingChart.map((reward, i) => ({
      index: i,
      name: `system.schooling.boxes.box${i}`,
      label: game.i18n.localize(reward.label),
      checked: schoolingBoxes[`box${i}`],
    }));

    context.sizeSelection = Object.fromEntries(
      Object.keys(CONFIG.MARVEL_MULTIVERSE.sizes).map((key) => [
        key,
        game.i18n.localize(CONFIG.MARVEL_MULTIVERSE.sizes[key].label),
      ])
    );

    const named = CONFIG.MARVEL_MULTIVERSE.namedTeamManeuvers;
    const sources = [...new Set(named.map(m => m.source))];

    context.teamManeuverOptions = {
      generic: CONFIG.MARVEL_MULTIVERSE.teamManeuvers.map(tm => ({
        value: `generic:${tm.maneuverType.toLowerCase()}`,
        label: tm.maneuverType,
      })),
      groups: sources.map(source => ({
        label: named.find(m => m.source === source)?.sourceLabel || source,
        options: named.filter(m => m.source === source)
          .map(m => ({ value: `named:${m.key}`, label: `${m.team}: ${m.name}` })),
      })),
    };

    const tm = context.system.teamManeuver;
    context.teamManeuverSelected = tm.named
      ? `named:${tm.named}`
      : tm.maneuverType
        ? `generic:${tm.maneuverType}`
        : "";

    context.teamManeuverLevels = Object.fromEntries(
      [1, 2, 3].map((tml) => [tml, tml.toString()])
    );
    context.showLevelPicker = !tm.named && !!tm.maneuverType;

    context.elements = Object.fromEntries(
      Object.keys(CONFIG.MARVEL_MULTIVERSE.elements).map((k) => [
        k,
        CONFIG.MARVEL_MULTIVERSE.elements[k].label,
      ])
    );

    context.mutantReputationEnabled = game.settings.get("marvel-multiverse", "mutantReputationEnabled");
    context.mutantReputationLevels = CONFIG.MARVEL_MULTIVERSE.mutantReputationLevels;
    const worldRepKey = game.settings.get("marvel-multiverse", "mutantReputationLevel");
    context.worldReputationLevel = worldRepKey;
    context.worldReputationLabel = CONFIG.MARVEL_MULTIVERSE.mutantReputationLevels[worldRepKey]?.label ?? "Neutral";

    // Prepare active effects
    context.effects = prepareActiveEffectCategories(
      // A generator that returns all effects stored on the actor
      // as well as any items
      this.actor.allApplicableEffects()
    );

    context.isVillainous = game.settings.get("marvel-multiverse", "sinisterPlotPointsEnabled")
      && isVillainous(this.actor.items);

    context.enableAlternateForms = game.settings.get("marvel-multiverse", "enableAlternateForms");
    if (context.enableAlternateForms) {
      const alternateForms = this.actor.system.alternateForms ?? [];
      const primaryFormIds = this.actor.system.primaryFormIds ?? [];
      const isPrimary = alternateForms.length > 0;
      const isAlternate = primaryFormIds.length > 0;

      const formTypeLabels = {
        cosmetic: game.i18n.localize("MARVEL_MULTIVERSE.AlternateForm.Cosmetic"),
        powerDown: game.i18n.localize("MARVEL_MULTIVERSE.AlternateForm.PowerDown"),
        powerSwap: game.i18n.localize("MARVEL_MULTIVERSE.AlternateForm.PowerSwap"),
      };

      const forms = alternateForms.map(f => {
        const actor = game.actors.get(f.actorId);
        const triggerSummary = f.triggers?.length
          ? "Triggers: " + f.triggers.map(t => t.description).join(", ")
          : "";
        return {
          ...f,
          actor: actor ? { id: actor.id, name: actor.name, img: actor.img } : { id: f.actorId, name: "(Deleted)", img: "icons/svg/mystery-man.svg" },
          formTypeLabel: formTypeLabels[f.formType] ?? f.formType,
          triggerSummary,
        };
      });

      const primaryActors = primaryFormIds.map(id => {
        const actor = game.actors.get(id);
        const formEntry = actor?.system.alternateForms?.find(f => f.actorId === this.actor.id);
        return {
          id,
          name: actor?.name ?? "(Deleted)",
          img: actor?.img ?? "icons/svg/mystery-man.svg",
          formTypeLabel: formTypeLabels[formEntry?.formType] ?? "",
        };
      });

      context.formData = { isPrimary, isAlternate, forms, primaryActors };
    }

    // Rich text is shown enriched so content links, inline rolls and the
    // roll links registered by this system all work on the sheet.
    context.enriched = await enrichSheetFields(this.actor, {
      rollData: context.rollData,
    });

    return context;
  }

  /**
   * Organize and classify Items for Character sheets.
   *
   * @param {Object} actorData The actor to prepare.
   *
   * @return {undefined}
   */
  _prepareItems(context) {
    // Initialize containers.
    const gear = [];
    const iconicItems = [];
    const battleSuits = [];
    const origins = [];
    const occupations = [];
    const weapons = [];
    const traits = [];
    const tags = [];
    const powers = Object.fromEntries(
      Object.keys(CONFIG.MARVEL_MULTIVERSE.reverseSetList).map((ps) => [ps, []])
    );

    // Iterate through items, allocating to containers
    for (const i of context.items) {
      i.img = i.img || Item.DEFAULT_ICON;

      // Append to origin tags traits and powers as well as origins.
      if (i.type === "origin") {
        origins.push(i);
      }
      // Append to origin tags traits and powers as well as origins.
      if (i.type === "occupation") {
        occupations.push(i);
      } else if (i.type === "iconicItem") {
        const pc = i.system.powers?.length ?? 0;
        const rc = i.system.restrictions?.length ?? 0;
        i.powerValue = (pc === 0 && rc === 0) ? 0 : Math.max(1, pc - rc);
        iconicItems.push(i);
      } else if (i.type === "battleSuit") {
        const pc = i.system.powers?.length ?? 0;
        const rc = i.system.restrictions?.length ?? 0;
        i.powerValue = (pc === 0 && rc === 0) ? 0 : Math.max(1, pc - rc);
        const parts = [];
        const abilityLabels = { melee: "Mel", agility: "Agl", resilience: "Res", vigilance: "Vig", ego: "Ego", logic: "Log" };
        for (const [key, label] of Object.entries(abilityLabels)) {
          const mod = i.system.abilityModifiers?.[key] ?? 0;
          if (mod !== 0) parts.push(`${label} ${mod > 0 ? "+" : ""}${mod}`);
        }
        if (i.system.rankIncrease > 0) parts.push(`Rank +${i.system.rankIncrease}`);
        i.modifiersSummary = parts.length ? parts.join(", ") : "";
        battleSuits.push(i);
      } else if (i.type === "item") {
        gear.push(i);
      } else if (i.type === "weapon") {
        weapons.push(i);
      } else if (i.type === "trait") {
        traits.push(i);
      } else if (i.type === "tag") {
        tags.push(i);
      } else if (i.type === "power") {
        const powersets = i.system.powerSet.split(",");
        powers[powersets[0].trim()].push(i);
      }

      // Assign and return
      context.gear = gear;
      context.iconicItems = iconicItems;
      context.battleSuits = battleSuits;
      context.origins = origins;
      context.occupations = occupations;
      context.weapons = weapons;
      context.traits = traits;
      context.tags = tags;
      context.powers = powers;
    }
  }

  /**
   * Organize and classify Items for Character sheets.
   *
   * @param {Object} actorData The actor to prepare.
   *
   * @return {undefined}
   */
  _prepareData(context) {
    // Handle ability scores.
    for (const [k, v] of Object.entries(context.system.abilities)) {
      v.label = game.i18n.localize(CONFIG.MARVEL_MULTIVERSE.abilities[k]) ?? k;
    }

    for (const i of context.items.filter((item) => item.type === "power")) {
      const mappedPowersets = i.system.powerSet
        .split(",")
        .map((ps) => CONFIG.MARVEL_MULTIVERSE.reverseSetList[ps.trim()]);
      context.system.powers[mappedPowersets[0]].push(i);
    }

    for (const i of context.items.filter((item) => item.type === "origin")) {
      context.system.origins.push(i);
    }
  }
  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Render the item sheet for viewing/editing prior to the editable check.
    html.on("click", ".item-edit", (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.items.get(li.data("itemId"));
      item.sheet.render(true);
    });

    // -------------------------------------------------------------
    // Everything below here is only needed if the sheet is editable
    // if (!this.isEditable) return;

    // Add Inventory Item
    html.on("click", ".item-create", this._onItemCreate.bind(this));

    // Delete Inventory Item
    html.on("click", ".item-delete", async (ev) => {
      const li = $(ev.currentTarget).parents(".item");
      const itemId = li.data("itemId");
      const item = this.actor.items.get(itemId);
      if (item?.type === "battleSuit" && item.system.equipped) {
        await this._removeBattleSuitEffects(itemId);
      }
      this.actor.deleteEmbeddedDocuments("Item", [itemId]);
      li.slideUp(200, () => this.render(false));
    });

    // Iconic item ownership toggle
    html.on("change", ".iconic-ownership-toggle", async (ev) => {
      const itemId = ev.currentTarget.dataset.itemId;
      const item = this.actor.items.get(itemId);
      if (item) await item.update({ "system.ownershipMode": ev.currentTarget.value });
    });

    // Battle suit equip toggle
    html.on("click", ".battlesuit-equip-toggle", this._onToggleBattleSuitEquip.bind(this));

    // Active Effect management
    html.on("click", ".effect-control", (ev) => {
      const row = ev.currentTarget.closest("li");
      const document =
        row.dataset.parentId === this.actor.id
          ? this.actor
          : this.actor.items.get(row.dataset.parentId);
      onManageActiveEffect(ev, document);
    });

    // Rollable abilities.
    html.on("click", ".rollable", this._onRoll.bind(this));

    html.on(
      "change",
      'select[name="system.size"]',
      this._onSizeChange.bind(this)
    );

    html.on("click", ".roll-initiative", (ev) => {
      this.actor.rollInitiative({ createCombatants: true });
    });

    // Drag events for macros.
    if (this.actor.isOwner) {
      const handler = (ev) => this._onDragStart(ev);
      html.find("li.item").each((i, li) => {
        if (li.classList.contains("inventory-header")) return;
        li.setAttribute("draggable", true);
        li.addEventListener("dragstart", handler, false);
      });

      // Ability and non-combat checks are not embedded documents, so core's
      // _onDragStart has nothing to describe them with. They carry their own
      // drag payload instead.
      const checkHandler = (ev) => this._onDragCheckStart(ev);
      html
        .find('[data-roll-type="ability"], [data-roll-type="noncom"]')
        .each((i, el) => {
          el.setAttribute("draggable", true);
          el.addEventListener("dragstart", checkHandler, false);
        });
    }

    // Alternate Forms
    html.on("click", ".alternate-form-switch", async (ev) => {
      const targetActorId = ev.currentTarget.dataset.actorId;
      await switchForm(this.actor, targetActorId);
    });

    html.on("click", ".alternate-form-unlink", async (ev) => {
      const targetActorId = ev.currentTarget.dataset.actorId;
      await unlinkForm(this.actor, targetActorId);
      this.render(false);
    });

    html.on("click", ".alternate-form-edit", async (ev) => {
      const targetActorId = ev.currentTarget.dataset.actorId;
      const targetActor = game.actors.get(targetActorId);
      if (targetActor) targetActor.sheet.render(true);
    });

    html.on("click", ".alternate-form-add", async () => {
      this._onAddAlternateForm();
    });
  }

  async _onAddAlternateForm() {
    const formTypes = {};
    for (const [key, label] of Object.entries(CONFIG.MARVEL_MULTIVERSE.alternateFormTypes)) {
      formTypes[key] = game.i18n.localize(label);
    }

    const availableActors = game.actors.filter(a => {
      if (a.id === this.actor.id) return false;
      if (!["character", "npc"].includes(a.type)) return false;
      if ((a.system.alternateForms ?? []).length > 0) return false;
      return true;
    });

    const content = await foundry.applications.handlebars.renderTemplate(
      "systems/marvel-multiverse/templates/dialogs/add-form-dialog.hbs",
      { availableActors, formTypes, triggers: [] }
    );

    new Dialog({
      title: game.i18n.localize("MARVEL_MULTIVERSE.AlternateForm.AddForm"),
      content,
      buttons: {
        add: {
          icon: '<i class="fas fa-plus"></i>',
          label: game.i18n.localize("MARVEL_MULTIVERSE.AlternateForm.AddForm"),
          callback: async (html) => {
            const actorId = html.find('select[name="actorId"]').val();
            const formType = html.find('select[name="formType"]').val();
            if (!actorId) return;

            const triggers = [];
            html.find(".trigger-row").each((i, row) => {
              const desc = $(row).find('input[name^="triggers"][name$=".description"]').val();
              const resistable = $(row).find('input[name^="triggers"][name$=".resistable"]').is(":checked");
              const tn = Number($(row).find('input[name^="triggers"][name$=".tn"]').val()) || 0;
              if (desc) triggers.push({ description: desc, resistable, tn });
            });

            const alternateActor = game.actors.get(actorId);
            const validation = validateFormLink(this.actor, alternateActor);
            if (!validation.valid) {
              ui.notifications.warn(validation.reason);
              return;
            }

            await linkForm(this.actor, actorId, formType, triggers);
            this.render(false);
          },
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel",
        },
      },
      default: "add",
      render: (html) => {
        html.find(".trigger-add").on("click", () => {
          const list = html.find(".trigger-list");
          const idx = list.find(".trigger-row").length;
          list.append(`
            <div class="trigger-row flexrow" data-index="${idx}">
              <input type="text" name="triggers.${idx}.description" value="" placeholder="e.g., Anger, Full Moon" />
              <label><input type="checkbox" name="triggers.${idx}.resistable" checked /> Resistable</label>
              <input type="number" name="triggers.${idx}.tn" value="0" min="0" placeholder="TN" style="width:60px" />
              <a class="trigger-remove" data-index="${idx}"><i class="fas fa-trash"></i></a>
            </div>
          `);
        });
        html.on("click", ".trigger-remove", (ev) => {
          $(ev.currentTarget).closest(".trigger-row").remove();
        });
      },
    }).render(true);
  }

  /**
   * Build the hotbar drag payload for an ability or non-combat check.
   * @param {DragEvent} event   The originating dragstart event
   * @private
   */
  _onDragCheckStart(event) {
    const { rollType, abilityKey } = event.currentTarget.dataset;
    if (!abilityKey) return;
    event.dataTransfer.setData(
      "text/plain",
      JSON.stringify({
        type: "MarvelMultiverseCheck",
        actorUuid: this.actor.uuid,
        rollType,
        abilityKey,
      })
    );
  }

  /**
   * Handle changes to actor size
   * @param {Event} event   The originating click event
   * @private
   */
  async _onSizeChange(event) {
    event.preventDefault();
    const selected = event.target.value;
    this._changeSizeEffect(selected);
  }

  async _changeSizeEffect(effectKey) {
    const sizeEffectNames = Object.keys(
      CONFIG.MARVEL_MULTIVERSE.sizeEffects
    ).map((key) => CONFIG.MARVEL_MULTIVERSE.sizeEffects[key].name);

    const currentSizeEffects = this.actor.effects.contents.filter((effect) =>
      sizeEffectNames.includes(effect.name)
    );
    const currentSizeEffectIds = currentSizeEffects.map((ae) => ae._id);

    if (currentSizeEffectIds.length > 0) {
      this.actor.deleteEmbeddedDocuments("ActiveEffect", currentSizeEffectIds);
    }
    const effect = CONFIG.MARVEL_MULTIVERSE.sizeEffects[effectKey];
    ActiveEffect.create(effect, { parent: this.actor });
  }

  /**
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   * @param {Event} event   The originating click event
   * @private
   */
  async _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;
    // Get the type of item to create.
    const type = header.dataset.type;
    // Grab any data associated with this control.
    const data = foundry.utils.duplicate(header.dataset);
    // Initialize a default name.
    const name = `New ${type.capitalize()}`;
    // Prepare the item object.
    const itemData = {
      name: name,
      type: type,
      system: data,
    };
    // Remove the type from the dataset since it's in the itemData.type prop.
    // biome-ignore lint/complexity/useLiteralKeys: <explanation>
    itemData.system["type"] = undefined;

    // Finally, create the item!
    return await Item.create(itemData, { parent: this.actor });
  }

  async _createTrait(traitData) {
    if (
      !this.actor.items.map((item) => item.name).includes(traitData.name) &&
      !traitData.multiple
    ) {
      super._onDropItemCreate(traitData);
    }
  }

  async _createTag(tagData) {
    if (
      !this.actor.items.map((item) => item.name).includes(tagData.name) &&
      !tagData.multiple
    ) {
      super._onDropItemCreate(tagData);
    }
  }

  /** Fired whenever an embedded document is created.
   */
  _onDropItemCreate(itemData) {
    if (!this.actor.items.map((item) => item.name).includes(itemData.name)) {
      if (
        itemData.type === "power" &&
        itemData.system.powerSet === "Elemental Control"
      ) {
        if (!itemData.system.element) {
          itemData.system.element = this.actor.system.defaultElement;
        }
      }

      if (itemData.type === "occupation") {
        // biome-ignore lint/complexity/noForEach: <explanation>
        itemData.system.tags.forEach(async (tag) => {
          this._createTag(tag);
        });
        // biome-ignore lint/complexity/noForEach: <explanation>
        itemData.system.traits.forEach(async (trait) => {
          this._createTrait(trait);
        });
        // create the occupation
        return super._onDropItemCreate(itemData);
        // biome-ignore lint/style/noUselessElse: <explanation>
      } else if (itemData.type === "origin") {
        // biome-ignore lint/complexity/noForEach: <explanation>
        itemData.system.tags.forEach(async (tag) => {
          this._createTag(tag);
        });
        // biome-ignore lint/complexity/noForEach: <explanation>
        itemData.system.traits.forEach(async (trait) => {
          this._createTrait(trait);
        });
        // biome-ignore lint/complexity/noForEach: <explanation>
        itemData.system.powers.forEach(async (power) => {
          const newItemData = {
            name: power.name,
            type: "power",
            data: power.system,
          };
          if (this.actor.system.defaultElement) {
            Object.assign(newItemData, {
              element: this.actor.system.defaultElement,
            });
          }
          await Item.create(newItemData, { parent: this.actor });
        });
        // create the origin
        return super._onDropItemCreate(itemData);
        // biome-ignore lint/style/noUselessElse: <explanation>
      } else if (
        itemData.type === "trait" &&
        ["Big", "Small"].includes(itemData.name)
      ) {
        this._changeSizeEffect(itemData.name.toLowerCase());
        return super._onDropItemCreate(itemData);
        // biome-ignore lint/style/noUselessElse: <explanation>
      } else {
        return super._onDropItemCreate(itemData);
      }
    }
  }

  async _onToggleBattleSuitEquip(event) {
    event.preventDefault();
    const itemId = event.currentTarget.dataset.itemId;
    const item = this.actor.items.get(itemId);
    if (!item) return;

    if (item.system.equipped) {
      await this._removeBattleSuitEffects(itemId);
      await item.update({ "system.equipped": false });
    } else {
      for (const other of this.actor.items.filter(i => i.type === "battleSuit" && i.system.equipped)) {
        await this._removeBattleSuitEffects(other.id);
        await other.update({ "system.equipped": false });
      }
      await item.update({ "system.equipped": true });
      await this._applyBattleSuitEffects(item);
    }
  }

  async _removeBattleSuitEffects(itemId) {
    const effects = this.actor.effects.filter(e => e.flags?.["marvel-multiverse"]?.battleSuitId === itemId);
    if (effects.length) {
      await this.actor.deleteEmbeddedDocuments("ActiveEffect", effects.map(e => e.id));
    }
  }

  async _applyBattleSuitEffects(item) {
    const abilityMap = { melee: "mle", agility: "agl", resilience: "res", vigilance: "vig", ego: "ego", logic: "log" };
    const changes = [];
    for (const [suitKey, actorKey] of Object.entries(abilityMap)) {
      const mod = item.system.abilityModifiers[suitKey];
      if (mod !== 0) {
        changes.push({ key: `system.abilities.${actorKey}.value`, mode: 2, value: mod.toString() });
      }
    }
    if (item.system.rankIncrease > 0) {
      changes.push({ key: "system.attributes.rank.value", mode: 2, value: item.system.rankIncrease.toString() });
    }
    if (changes.length) {
      await ActiveEffect.create({
        name: `Battle Suit: ${item.name}`,
        img: item.img,
        changes: changes,
        flags: { "marvel-multiverse": { battleSuitId: item.id } }
      }, { parent: this.actor });
    }
  }

  async _updateObject(event, formData) {
    const selection = formData["system.teamManeuver._selection"];
    if (selection !== undefined) {
      delete formData["system.teamManeuver._selection"];
      if (selection.startsWith("generic:")) {
        formData["system.teamManeuver.maneuverType"] = selection.slice(8);
        formData["system.teamManeuver.named"] = "";
      } else if (selection.startsWith("named:")) {
        formData["system.teamManeuver.named"] = selection.slice(6);
        formData["system.teamManeuver.maneuverType"] = "";
        formData["system.teamManeuver.level"] = null;
      } else {
        formData["system.teamManeuver.maneuverType"] = "";
        formData["system.teamManeuver.named"] = "";
        formData["system.teamManeuver.level"] = null;
      }
    }
    return super._updateObject(event, formData);
  }

  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  _onRoll(event) {
    event.preventDefault();
    const rollMode = game.settings.get("core", "rollMode");
    const element = event.currentTarget;
    const dataset = element.dataset;

    const itemId = element.closest(".item")?.dataset?.itemId;
    const item = this.actor.items.get(itemId);

    // Handle item rolls.
    if (dataset.rollType) {
      if (dataset.rollType === "item") {
        if (item) return item.roll();
      }
    }
    if (dataset.formula) {
      const ability =
        CONFIG.MARVEL_MULTIVERSE.damageAbility[dataset.label] ?? dataset.label;
      let label = `ability: ${ability}<br/>${item?.type}: ${item?.name}`;
      const title = dataset.power ? `[power] ${dataset.power}` : "";

      label = dataset.damagetype
        ? `${label}<br/>damagetype: ${dataset.damagetype}`
        : label;

      if (item?.system?.isElemental && item?.system?.element) {
        label += `<br/>element: ${item.system.element}`;
      }

      const tokenDoc = this.actor.token ?? canvas.tokens?.controlled?.find(t => t.actor?.id === this.actor.id)?.document ?? this.actor.getActiveTokens()?.[0]?.document;
      const speaker = ChatMessage.getSpeaker({ actor: this.actor, token: tokenDoc });
      const rollMode = game.settings.get("core", "rollMode");

      if (item?.system?.description) {
        ChatMessage.create({
          speaker: speaker,
          rollMode: rollMode,
          flavor: label,
          content: `<div>${item.system.description}</div><div>${
            item.system.effect ? item.system.effect : ""
          }</div>`,
        });
      }

      if (dataset.abilityKey === "ego" && game.settings.get("marvel-multiverse", "mutantReputationEnabled")) {
        const repOverride = this.actor.system.mutantReputation;
        const repKey = repOverride !== "world" ? repOverride : game.settings.get("marvel-multiverse", "mutantReputationLevel");
        const repConfig = CONFIG.MARVEL_MULTIVERSE.mutantReputationLevels[repKey];
        if (repConfig && repKey !== "neutral") {
          label += `<br/><div style="margin-top:4px;padding:2px 6px;background:#5c3d6e;color:#fff;border-radius:3px;font-size:11px;"><b>Mutant Reputation (${repConfig.label}):</b> ${repConfig.effect}</div>`;
        }
      }

      // bigFightFlag() itself is monolith-only glue (no module twin exists
      // for it), so the flag is read inline here the same way it defines it:
      // combat?.getFlag(...) ?? null.
      const bigFight = game.combat?.getFlag("marvel-multiverse", "bigFight") ?? null;
      const bigFightCombatant = game.combat?.combatants?.find((c) => c.actorId === this.actor.id);
      const bigFightGroup = bigFightCombatant ? findGroup(bigFight?.groups, bigFightCombatant.id) : null;
      const groupBonus = isBigFightEnabled(bigFight) ? groupAttackBonus(bigFightGroup, {}) : 0;
      const formula = groupBonus ? `${dataset.formula} + ${groupBonus}` : dataset.formula;
      const roll = new CONFIG.Dice.MarvelMultiverseRoll(
        formula,
        this.actor.getRollData()
      );

      roll.toMessage(
        {
          speaker: speaker,
          flavor: label,
          rollMode: rollMode,
          title: title,
        },
        { rollMode: rollMode, itemId: itemId }
      );
      return roll;
    }
  }
}
