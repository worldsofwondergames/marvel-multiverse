const ITEM_TYPE_LABELS = {
  item: "Item",
  iconicItem: "Iconic Item",
  weapon: "Weapon",
  trait: "Trait",
  tag: "Tag",
  origin: "Origin",
  occupation: "Occupation",
  power: "Power",
  powerSet: "Power Set",
  restriction: "Restriction",
  battleSuit: "Battlesuit",
  equipment: "Equipment",
  vehicleWeapon: "Vehicle Weapon",
  hqTag: "HQ Tag",
  hqTrait: "HQ Trait",
};

export const ItemDirectoryFilter = {

  _filterState: null,
  _directoryApp: null,

  _getDefaultFilterState() {
    return {
      logic: "and",
      panelOpen: false,
      itemType: "",
      source: [],
      powerSets: [],
      duration: [],
      equipmentType: [],
      tags: [],
      traits: [],
    };
  },

  init() {
    this._filterState = this._getDefaultFilterState();
  },

  async onRenderDirectory(app, jqHtml) {
    try {
      this._directoryApp = app;
      const html = jqHtml instanceof jQuery ? jqHtml : $(jqHtml);
      const filterData = this._getFilterTemplateData();
      const rendered = await foundry.applications.handlebars.renderTemplate(
        "systems/marvel-multiverse/templates/sidebar/item-directory-filters.hbs",
        filterData
      );
      const header = html.find(".directory-header");
      if (!header.length) {
        console.warn("ItemDirectoryFilter | No .directory-header found");
        return;
      }
      header.find(".mm-sidebar-filters").remove();
      header.append(rendered);
      this._activateFilterListeners(html);
      if (this._hasActiveFilters()) {
        this._applyFilters(html[0]);
      }
    } catch (err) {
      console.error("ItemDirectoryFilter | Render error:", err);
    }
  },

  _getFilterTemplateData() {
    const s = this._filterState;
    const dynamicOpts = this._buildDynamicOptions();

    const itemTypesUnsorted = {};
    for (const [key, label] of Object.entries(ITEM_TYPE_LABELS)) {
      itemTypesUnsorted[key] = { label, selected: s.itemType === key };
    }
    const itemTypes = Object.fromEntries(
      Object.entries(itemTypesUnsorted).sort(([, a], [, b]) => a.label.localeCompare(b.label))
    );

    const sources = Object.fromEntries(
      Object.entries(CONFIG.MARVEL_MULTIVERSE.sources).map(([key, data]) => [key, {
        label: data.label,
        checked: s.source.includes(key),
      }])
    );

    const powerSets = dynamicOpts.powerSets.map(name => ({
      name,
      checked: s.powerSets.includes(name),
    }));
    const durations = dynamicOpts.durations.map(name => ({
      name,
      checked: s.duration.includes(name),
    }));
    const equipmentTypes = Object.fromEntries(
      Object.entries(CONFIG.MARVEL_MULTIVERSE.equipmentTypes).map(([key, labelKey]) => [key, {
        label: game.i18n.localize(labelKey),
        checked: s.equipmentType.includes(key),
      }])
    );
    const tags = dynamicOpts.tags.map(name => ({
      name,
      checked: s.tags.includes(name),
    }));
    const traits = dynamicOpts.traits.map(name => ({
      name,
      checked: s.traits.includes(name),
    }));

    return {
      filterState: s,
      activeFilterCount: this._countActiveFilters(),
      filterOptions: {
        itemTypes,
        sources,
        powerSets,
        durations,
        equipmentTypes,
        tags,
        traits,
      },
    };
  },

  /**
   * Traits are not only their own item type -- a battleSuit carries
   * `additionalTraits` as plain trait names, which also count as a source of
   * the values a trait filter can select.
   */
  _buildDynamicOptions() {
    const powerSets = new Set();
    const durations = new Set();
    const tags = new Set();
    const traits = new Set();
    for (const item of game.items) {
      switch (item.type) {
        case "power": {
          for (const ps of String(item.system.powerSet ?? "").split(",")) {
            const trimmed = ps.trim();
            if (trimmed) powerSets.add(trimmed);
          }
          const duration = String(item.system.duration ?? "").trim();
          if (duration) durations.add(duration);
          break;
        }
        case "tag": tags.add(item.name); break;
        case "trait": traits.add(item.name); break;
      }
      if (item.type === "battleSuit") {
        for (const t of item.system.additionalTraits ?? []) {
          if (t) traits.add(t);
        }
      }
    }
    return {
      powerSets: [...powerSets].sort(),
      durations: [...durations].sort(),
      tags: [...tags].sort(),
      traits: [...traits].sort(),
    };
  },

  _activateFilterListeners(html) {
    const self = this;

    html.find(".mm-filter-toggle").on("click", (ev) => {
      ev.preventDefault();
      self._filterState.panelOpen = !self._filterState.panelOpen;
      const container = html.find(".mm-sidebar-filters");
      container.toggleClass("open", self._filterState.panelOpen);
      container.find(".mm-filter-chevron")
        .toggleClass("fa-chevron-down", !self._filterState.panelOpen)
        .toggleClass("fa-chevron-up", self._filterState.panelOpen);
    });

    html.find(".mm-filter-logic").on("change", (ev) => {
      self._filterState.logic = ev.currentTarget.value;
      self._applyFilters(html[0]);
    });

    html.find(".mm-filter-clear").on("click", (ev) => {
      ev.preventDefault();
      self._filterState = self._getDefaultFilterState();
      self._filterState.panelOpen = true;
      if (self._directoryApp) self._directoryApp.render(false);
    });

    html.find(".mm-filter-group-header").on("click", (ev) => {
      const header = $(ev.currentTarget);
      const body = header.next(".mm-filter-group-body");
      header.toggleClass("collapsed");
      body.toggleClass("collapsed");
    });

    // The Power Set group only exists when Type is "power", so switching Type
    // needs the whole panel re-rendered, not just the visible rows re-applied.
    html.find(".mm-filter-type-select").on("change", (ev) => {
      self._filterState.itemType = ev.currentTarget.value;
      if (self._filterState.itemType !== "power") {
        self._filterState.powerSets = [];
        self._filterState.duration = [];
      }
      if (self._filterState.itemType !== "equipment") {
        self._filterState.equipmentType = [];
      }
      if (self._directoryApp) self._directoryApp.render(false);
    });

    const checkboxFilters = ["source", "powerSets", "duration", "equipmentType", "tags", "traits"];
    for (const filterKey of checkboxFilters) {
      html.find(`.mm-filter-checkbox[data-filter='${filterKey}']`).on("change", () => {
        self._updateCheckboxFilter(filterKey, html);
      });
    }
  },

  _updateCheckboxFilter(filterKey, html) {
    const checked = [];
    html.find(`.mm-filter-checkbox[data-filter='${filterKey}']:checked`).each((i, el) => {
      checked.push(el.value);
    });
    this._filterState[filterKey] = checked;
    this._applyFilters(html[0]);
  },

  _applyFilters(htmlEl) {
    const entries = htmlEl.querySelectorAll(".directory-item.document");
    for (const entry of entries) {
      const itemId = entry.dataset.documentId || entry.dataset.entryId;
      const item = game.items.get(itemId);
      if (!item) continue;
      if (this._hasActiveFilters() && !this._matchesFilters(item)) {
        entry.style.display = "none";
      } else {
        entry.style.display = "";
      }
    }
    this._updateFolderVisibility(htmlEl);
    this._updateFilterCount(htmlEl);
  },

  _updateFolderVisibility(htmlEl) {
    const folders = htmlEl.querySelectorAll(".directory-item.folder");
    for (const folder of folders) {
      const subdirectory = folder.querySelector(".subdirectory");
      if (!subdirectory) continue;
      const visibleEntries = subdirectory.querySelectorAll(".directory-item.document:not([style*='display: none'])");
      const visibleSubfolders = subdirectory.querySelectorAll(".directory-item.folder:not([style*='display: none'])");
      if (visibleEntries.length === 0 && visibleSubfolders.length === 0 && this._hasActiveFilters()) {
        folder.style.display = "none";
      } else {
        folder.style.display = "";
      }
    }
  },

  _updateFilterCount(htmlEl) {
    const count = this._countActiveFilters();
    const badge = $(htmlEl).find(".mm-filter-count");
    badge.text(count);
    badge.toggleClass("hidden", count === 0);
  },

  _countActiveFilters() {
    const s = this._filterState;
    let count = 0;
    if (s.itemType) count++;
    if (s.source.length) count++;
    if (s.powerSets.length) count++;
    if (s.duration.length) count++;
    if (s.equipmentType.length) count++;
    if (s.tags.length) count++;
    if (s.traits.length) count++;
    return count;
  },

  _hasActiveFilters() {
    return this._countActiveFilters() > 0;
  },

  _matchesFilters(item) {
    const s = this._filterState;
    const results = [];

    if (s.itemType) {
      results.push(item.type === s.itemType);
    }

    if (s.source.length) {
      results.push(s.source.includes(item.system?.source));
    }

    if (s.powerSets.length) {
      results.push(s.powerSets.some(ps => this._itemHasPowerSet(item, ps)));
    }

    if (s.duration.length) {
      results.push(s.duration.some(d => this._itemHasDuration(item, d)));
    }

    if (s.equipmentType.length) {
      results.push(s.equipmentType.some(et => this._itemHasEquipmentType(item, et)));
    }

    if (s.tags.length) {
      results.push(s.tags.some(t => this._itemHasTag(item, t)));
    }

    if (s.traits.length) {
      results.push(s.traits.some(t => this._itemHasTrait(item, t)));
    }

    if (!results.length) return true;
    return s.logic === "and" ? results.every(Boolean) : results.some(Boolean);
  },

  _itemHasPowerSet(item, name) {
    if (item.type !== "power") return false;
    return String(item.system.powerSet ?? "")
      .split(",")
      .map(s => s.trim())
      .includes(name);
  },

  _itemHasDuration(item, name) {
    return item.type === "power" && item.system.duration === name;
  },

  _itemHasEquipmentType(item, name) {
    return item.type === "equipment" && item.system.equipmentType === name;
  },

  _itemHasTag(item, name) {
    return item.type === "tag" && item.name === name;
  },

  _itemHasTrait(item, name) {
    if (item.type === "trait") return item.name === name;
    if (item.type === "battleSuit") return (item.system.additionalTraits ?? []).includes(name);
    return false;
  },
};
