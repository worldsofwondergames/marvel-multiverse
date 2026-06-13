export const ActorDirectoryFilter = {

  _filterState: null,
  _directoryApp: null,

  _getDefaultFilterState() {
    return {
      logic: "and",
      panelOpen: false,
      actorType: [],
      rank: { op: ">=", value: null },
      size: [],
      origins: [],
      occupations: [],
      powerSets: [],
      tags: [],
      traits: [],
      abilities: {
        mle: { op: ">=", value: null },
        agl: { op: ">=", value: null },
        res: { op: ">=", value: null },
        vig: { op: ">=", value: null },
        ego: { op: ">=", value: null },
        log: { op: ">=", value: null },
      },
      teams: "",
      movementTypes: [],
      elements: [],
      healthDR: { op: ">=", value: null },
      focusDR: { op: ">=", value: null },
      healthMax: { op: ">=", value: null },
      focusMax: { op: ">=", value: null },
      karmaMax: { op: ">=", value: null },
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
      const rendered = await renderTemplate(
        "systems/marvel-multiverse/templates/sidebar/actor-directory-filters.hbs",
        filterData
      );
      const header = html.find(".directory-header");
      if (!header.length) {
        console.warn("ActorDirectoryFilter | No .directory-header found");
        return;
      }
      header.find(".mm-sidebar-filters").remove();
      header.append(rendered);
      this._activateFilterListeners(html);
      if (this._hasActiveFilters()) {
        this._applyFilters(html[0]);
      }
    } catch (err) {
      console.error("ActorDirectoryFilter | Render error:", err);
    }
  },

  _getFilterTemplateData() {
    const s = this._filterState;
    const dynamicOpts = this._buildDynamicOptions();
    const abilities = {};
    for (const [key, label] of Object.entries(CONFIG.MARVEL_MULTIVERSE.abilities)) {
      abilities[key] = {
        label: game.i18n.localize(label),
        op: s.abilities[key].op,
        value: s.abilities[key].value,
      };
    }
    const actorTypes = {
      character: { label: "Character", checked: s.actorType.includes("character") },
      npc: { label: "NPC", checked: s.actorType.includes("npc") },
      vehicle: { label: "Vehicle", checked: s.actorType.includes("vehicle") },
    };
    const sizes = {};
    for (const [key, data] of Object.entries(CONFIG.MARVEL_MULTIVERSE.sizes)) {
      sizes[key] = {
        label: game.i18n.localize(data.label),
        checked: s.size.includes(key),
      };
    }
    const movementTypes = {};
    for (const [key, data] of Object.entries(CONFIG.MARVEL_MULTIVERSE.movementTypes)) {
      movementTypes[key] = {
        label: game.i18n.localize(data.label),
        checked: s.movementTypes.includes(key),
      };
    }
    const elements = {};
    for (const [key, data] of Object.entries(CONFIG.MARVEL_MULTIVERSE.elements)) {
      elements[key] = {
        label: data.label,
        checked: s.elements.includes(key),
      };
    }
    const powerSets = dynamicOpts.powerSets.map(name => ({
      name,
      checked: s.powerSets.includes(name),
    }));
    const origins = dynamicOpts.origins.map(name => ({
      name,
      checked: s.origins.includes(name),
    }));
    const occupations = dynamicOpts.occupations.map(name => ({
      name,
      checked: s.occupations.includes(name),
    }));
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
        actorTypes,
        sizes,
        abilities,
        movementTypes,
        elements,
        powerSets,
        origins,
        occupations,
        tags,
        traits,
      },
    };
  },

  _buildDynamicOptions() {
    const origins = new Set();
    const occupations = new Set();
    const tags = new Set();
    const traits = new Set();
    const powerSets = new Set();
    for (const actor of game.actors) {
      for (const item of actor.items) {
        switch (item.type) {
          case "origin": origins.add(item.name); break;
          case "occupation": occupations.add(item.name); break;
          case "tag": tags.add(item.name); break;
          case "trait": traits.add(item.name); break;
          case "power": {
            const ps = item.system.powerSet;
            if (ps) ps.split(",").forEach(s => powerSets.add(s.trim()));
            break;
          }
        }
      }
    }
    return {
      origins: [...origins].sort(),
      occupations: [...occupations].sort(),
      tags: [...tags].sort(),
      traits: [...traits].sort(),
      powerSets: [...powerSets].sort(),
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

    const checkboxFilters = ["actorType", "size", "origins", "occupations", "powerSets", "tags", "traits", "movementTypes", "elements"];
    for (const filterKey of checkboxFilters) {
      html.find(`.mm-filter-checkbox[data-filter='${filterKey}']`).on("change", () => {
        self._updateCheckboxFilter(filterKey, html);
      });
    }

    html.find(".mm-filter-op[data-filter='rank'], .mm-filter-input[data-filter='rank']").on("change", () => {
      self._updateNumericFilter("rank", html);
    });

    html.find("[data-filter='abilities']").on("change", (ev) => {
      const ability = ev.currentTarget.dataset.ability;
      const field = ev.currentTarget.dataset.field;
      if (field === "op") {
        self._filterState.abilities[ability].op = ev.currentTarget.value;
      } else {
        const val = ev.currentTarget.value ? Number(ev.currentTarget.value) : null;
        self._filterState.abilities[ability].value = val;
      }
      self._applyFilters(html[0]);
    });

    html.find(".mm-filter-text[data-filter='teams']").on("input", (ev) => {
      self._filterState.teams = ev.currentTarget.value;
      self._applyFilters(html[0]);
    });

    for (const key of ["healthDR", "focusDR", "healthMax", "focusMax", "karmaMax"]) {
      html.find(`[data-filter='${key}']`).on("change", () => {
        self._updateNumericFilter(key, html);
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

  _updateNumericFilter(filterKey, html) {
    const opEl = html.find(`.mm-filter-op[data-filter='${filterKey}']`)[0];
    const valEl = html.find(`.mm-filter-input[data-filter='${filterKey}']`)[0];
    if (opEl) this._filterState[filterKey].op = opEl.value;
    if (valEl) this._filterState[filterKey].value = valEl.value ? Number(valEl.value) : null;
    this._applyFilters(html[0]);
  },

  _applyFilters(htmlEl) {
    const entries = htmlEl.querySelectorAll(".directory-item.document");
    for (const entry of entries) {
      const actorId = entry.dataset.documentId || entry.dataset.entryId;
      const actor = game.actors.get(actorId);
      if (!actor) continue;
      if (this._hasActiveFilters() && !this._matchesFilters(actor)) {
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
    if (s.actorType.length) count++;
    if (s.rank.value !== null) count++;
    if (s.size.length) count++;
    if (s.origins.length) count++;
    if (s.occupations.length) count++;
    if (s.powerSets.length) count++;
    if (s.tags.length) count++;
    if (s.traits.length) count++;
    for (const abl of Object.values(s.abilities)) {
      if (abl.value !== null) count++;
    }
    if (s.teams.trim()) count++;
    if (s.movementTypes.length) count++;
    if (s.elements.length) count++;
    if (s.healthDR.value !== null) count++;
    if (s.focusDR.value !== null) count++;
    if (s.healthMax.value !== null) count++;
    if (s.focusMax.value !== null) count++;
    if (s.karmaMax.value !== null) count++;
    return count;
  },

  _hasActiveFilters() {
    return this._countActiveFilters() > 0;
  },

  _matchesFilters(actor) {
    const s = this._filterState;
    const results = [];

    if (s.actorType.length) {
      results.push(s.actorType.includes(actor.type));
    }

    if (s.rank.value !== null) {
      results.push(this._evalNumeric(actor.system.attributes?.rank?.value, s.rank.op, s.rank.value));
    }

    if (s.size.length) {
      results.push(s.size.includes(actor.system.size));
    }

    if (s.origins.length) {
      const actorOrigins = actor.items.filter(i => i.type === "origin").map(i => i.name);
      results.push(s.origins.some(o => actorOrigins.includes(o)));
    }

    if (s.occupations.length) {
      const actorOccs = actor.items.filter(i => i.type === "occupation").map(i => i.name);
      results.push(s.occupations.some(o => actorOccs.includes(o)));
    }

    if (s.powerSets.length) {
      const actorPowerSets = new Set();
      actor.items.filter(i => i.type === "power").forEach(i => {
        const ps = i.system.powerSet;
        if (ps) ps.split(",").forEach(p => actorPowerSets.add(p.trim()));
      });
      results.push(s.powerSets.some(ps => actorPowerSets.has(ps)));
    }

    if (s.tags.length) {
      const actorTags = actor.items.filter(i => i.type === "tag").map(i => i.name);
      results.push(s.tags.some(t => actorTags.includes(t)));
    }

    if (s.traits.length) {
      const actorTraits = actor.items.filter(i => i.type === "trait").map(i => i.name);
      results.push(s.traits.some(t => actorTraits.includes(t)));
    }

    for (const [abl, filter] of Object.entries(s.abilities)) {
      if (filter.value !== null) {
        results.push(this._evalNumeric(actor.system.abilities?.[abl]?.value ?? 0, filter.op, filter.value));
      }
    }

    if (s.teams.trim()) {
      results.push((actor.system.teams || "").toLowerCase().includes(s.teams.trim().toLowerCase()));
    }

    if (s.movementTypes.length) {
      results.push(s.movementTypes.every(mt => actor.system.movement?.[mt]?.active));
    }

    if (s.elements.length) {
      results.push(s.elements.includes(actor.system.defaultElement));
    }

    if (s.healthDR.value !== null) {
      results.push(this._evalNumeric(actor.system.healthDamageReduction ?? 0, s.healthDR.op, s.healthDR.value));
    }

    if (s.focusDR.value !== null) {
      results.push(this._evalNumeric(actor.system.focusDamageReduction ?? 0, s.focusDR.op, s.focusDR.value));
    }

    if (s.healthMax.value !== null) {
      results.push(this._evalNumeric(actor.system.health?.max ?? 0, s.healthMax.op, s.healthMax.value));
    }

    if (s.focusMax.value !== null) {
      results.push(this._evalNumeric(actor.system.focus?.max ?? 0, s.focusMax.op, s.focusMax.value));
    }

    if (s.karmaMax.value !== null) {
      results.push(this._evalNumeric(actor.system.karma?.max ?? 0, s.karmaMax.op, s.karmaMax.value));
    }

    if (!results.length) return true;
    return s.logic === "and" ? results.every(Boolean) : results.some(Boolean);
  },

  _evalNumeric(actual, op, target) {
    switch (op) {
      case "=": return actual === target;
      case ">=": return actual >= target;
      case "<=": return actual <= target;
      default: return true;
    }
  },
};
