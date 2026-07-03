# Alternate Form Management System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow characters to link to alternate form actors and switch between them, replacing tokens in-place on the canvas and preserving combat state.

**Architecture:** Each form is a separate FoundryVTT Actor. The primary actor stores an `alternateForms` array with linked actor IDs, form types, and trigger definitions. The alternate actor stores a `primaryFormIds` array pointing back. Switching deletes the current token and creates a new one for the target actor at the same position. A world-level system setting gates the feature.

**Tech Stack:** FoundryVTT v13 API, ES modules, Handlebars templates, Jest unit tests, Playwright E2E tests. The system uses a compiled bundle (`marvel-multiverse.mjs`) alongside source modules in `module/`.

## Global Constraints

- FoundryVTT v13 APIs only — no v12 patterns.
- Source modules in `module/` must stay in sync with the compiled bundle `marvel-multiverse.mjs`.
- Handlebars partials must be registered in `preloadHandlebarsTemplates()` or sheets silently crash.
- Jest tests run with `node --experimental-vm-modules "node_modules/jest-cli/bin/jest.js"` (not bare `npx jest`).
- E2E tests use Playwright with a custom `foundryPage` fixture (worker-scoped) connecting to a live FoundryVTT at `http://localhost:30000`.
- Never include Co-Authored-By or Claude references in commit messages.
- No Marvel IP (character names, team names) in the system repo — use generic test names.
- Only search the `marvel-616` world for actors, not `legacy-of-heroes`.
- Config enum keys use camelCase. Localization keys use dot-notation under `MARVEL_MULTIVERSE`.

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `module/helpers/alternate-forms.mjs` | Form linking, validation, switching logic, Ego check, token swap, combat tracker update |
| `templates/actor/parts/actor-alternate-forms.hbs` | Handlebars partial for "Alternate Forms" section on Details tab |
| `templates/dialogs/add-form-dialog.hbs` | Handlebars template for "Add Form" dialog |
| `module/__tests__/alternate-forms.test.mjs` | Jest unit tests for schema and validation |
| `e2e/alternate-forms.spec.mjs` | Playwright E2E tests |

### Modified Files
| File | Changes |
|------|---------|
| `module/data/actor-base.mjs` | Add `alternateForms` and `primaryFormIds` schema fields |
| `module/config.mjs` | Add `alternateFormTypes` enum |
| `module/sheets/character-sheet.mjs` | Add forms section data prep, dialog handler, switch/unlink event listeners |
| `module/sheets/npc-sheet.mjs` | Same forms section support |
| `module/helpers/templates.mjs` | Register `actor-alternate-forms.hbs` and `add-form-dialog.hbs` partials |
| `marvel-multiverse.mjs` | Compiled bundle: schema, config, setting registration, context menu hooks, all helper logic |
| `lang/en.json` | Add `AlternateForm` localization keys |
| `templates/actor/actor-character-sheet.hbs` | Include `actor-alternate-forms.hbs` partial in Biography tab |
| `templates/actor/actor-npc-sheet.hbs` | Include `actor-alternate-forms.hbs` partial in Biography tab |

---

### Task 1: Data Model and Config

Add the schema fields to the actor data model, the config enum, the localization keys, and the system setting. Write unit tests to verify schema structure.

**Files:**
- Modify: `module/data/actor-base.mjs`
- Modify: `module/config.mjs`
- Modify: `lang/en.json`
- Modify: `marvel-multiverse.mjs`
- Create: `module/__tests__/alternate-forms.test.mjs`

**Interfaces:**
- Consumes: Nothing (foundational task)
- Produces: Schema fields `alternateForms` (ArrayField) and `primaryFormIds` (ArrayField) on `MarvelMultiverseActorBase`. Config enum `alternateFormTypes` on `MARVEL_MULTIVERSE`. System setting `enableAlternateForms`.

- [ ] **Step 1: Write the failing unit tests**

Create `module/__tests__/alternate-forms.test.mjs`:

```js
/* eslint-env jest */
import MarvelMultiverseActorBase from '../data/actor-base.mjs';

describe('MarvelMultiverseActorBase — alternate form schema', () => {
  let schema;

  beforeAll(() => {
    schema = MarvelMultiverseActorBase.defineSchema();
  });

  test('schema includes alternateForms array field', () => {
    expect(schema.alternateForms).toBeDefined();
  });

  test('schema includes primaryFormIds array field', () => {
    expect(schema.primaryFormIds).toBeDefined();
  });
});

describe('alternateFormTypes config enum', () => {
  test('config includes cosmetic, powerDown, powerSwap', () => {
    const types = CONFIG.MARVEL_MULTIVERSE.alternateFormTypes;
    expect(types).toBeDefined();
    expect(types.cosmetic).toBeDefined();
    expect(types.powerDown).toBeDefined();
    expect(types.powerSwap).toBeDefined();
  });

  test('config has exactly three form types', () => {
    const types = CONFIG.MARVEL_MULTIVERSE.alternateFormTypes;
    expect(Object.keys(types)).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --experimental-vm-modules "node_modules/jest-cli/bin/jest.js" -- alternate-forms.test.mjs`
Expected: FAIL — `alternateForms` and `primaryFormIds` not found in schema, `alternateFormTypes` not found in config.

- [ ] **Step 3: Add schema fields to actor-base.mjs**

In `module/data/actor-base.mjs`, before `return schema;` at the end of `defineSchema()`, add:

```js
schema.alternateForms = new fields.ArrayField(new fields.SchemaField({
  actorId: new fields.StringField({ required: true, blank: false }),
  formType: new fields.StringField({ required: true, initial: "powerDown" }),
  triggers: new fields.ArrayField(new fields.SchemaField({
    description: new fields.StringField({ required: true, blank: false }),
    resistable: new fields.BooleanField({ initial: true }),
    tn: new fields.NumberField({ required: true, initial: 0, integer: true, min: 0 }),
  })),
}));

schema.primaryFormIds = new fields.ArrayField(
  new fields.StringField({ required: true, blank: false })
);
```

- [ ] **Step 4: Add config enum to config.mjs**

In `module/config.mjs`, after the `grenadeTypes` block, add:

```js
MARVEL_MULTIVERSE.alternateFormTypes = {
  cosmetic: "MARVEL_MULTIVERSE.AlternateForm.Cosmetic",
  powerDown: "MARVEL_MULTIVERSE.AlternateForm.PowerDown",
  powerSwap: "MARVEL_MULTIVERSE.AlternateForm.PowerSwap",
};
```

- [ ] **Step 5: Add localization keys to en.json**

In `lang/en.json`, inside the `"MARVEL_MULTIVERSE"` object (after the `"Equipment"` block), add:

```json
"AlternateForm": {
  "Cosmetic": "Cosmetic",
  "PowerDown": "Power Down",
  "PowerSwap": "Power Swap",
  "SectionTitle": "Alternate Forms",
  "AddForm": "Add Form",
  "EditForm": "Edit Form",
  "UnlinkForm": "Unlink Form",
  "SwitchForm": "Switch Form",
  "SwitchTo": "Switch to {name}",
  "AlternateOf": "Alternate form of:",
  "TriggerInvoluntary": "Trigger Involuntary Change",
  "EgoCheckPrompt": "Make an Ego check (TN {tn}) to resist transforming into {name}?",
  "EgoCheckSuccess": "{name} resists the transformation.",
  "EgoCheckFailure": "{name} fails to resist and transforms!",
  "TransformMessage": "{name} transforms into {form}.",
  "Setting": {
    "Enable": "Enable Alternate Forms",
    "EnableHint": "Adds alternate form management to character sheets, allowing characters to link and switch between multiple forms."
  }
}
```

- [ ] **Step 6: Register the system setting in marvel-multiverse.mjs**

In the compiled bundle `marvel-multiverse.mjs`, in the `Hooks.once("init")` callback, after the existing `game.settings.register` calls, add:

```js
game.settings.register("marvel-multiverse", "enableAlternateForms", {
  name: "MARVEL_MULTIVERSE.AlternateForm.Setting.Enable",
  hint: "MARVEL_MULTIVERSE.AlternateForm.Setting.EnableHint",
  scope: "world",
  config: true,
  type: Boolean,
  default: false,
});
```

- [ ] **Step 7: Add schema fields and config enum to the compiled bundle**

In `marvel-multiverse.mjs`, find the `MarvelMultiverseActorBase.defineSchema()` method and add the same `alternateForms` and `primaryFormIds` fields from Step 3 before `return schema;`.

Find the config section and add the same `alternateFormTypes` enum from Step 4.

- [ ] **Step 8: Run tests to verify they pass**

Run: `node --experimental-vm-modules "node_modules/jest-cli/bin/jest.js" -- alternate-forms.test.mjs`
Expected: PASS — all 4 tests pass.

- [ ] **Step 9: Commit**

```bash
git add module/data/actor-base.mjs module/config.mjs lang/en.json marvel-multiverse.mjs module/__tests__/alternate-forms.test.mjs
git commit -m "Add alternate form schema fields, config enum, and system setting (#68)"
```

---

### Task 2: Form Linking Helper and Validation Logic

Create the `alternate-forms.mjs` helper module with functions for linking, unlinking, and validating form relationships. Write unit tests for all validation rules.

**Files:**
- Create: `module/helpers/alternate-forms.mjs`
- Modify: `module/__tests__/alternate-forms.test.mjs`
- Modify: `marvel-multiverse.mjs`

**Interfaces:**
- Consumes: Schema fields `alternateForms` and `primaryFormIds` from Task 1.
- Produces: Functions `linkForm(primaryActor, alternateActorId, formType, triggers)`, `unlinkForm(primaryActor, alternateActorId)`, `validateFormLink(primaryActor, alternateActor)`, `getLinkedForms(actor)`. These are used by Task 3 (sheet UI) and Task 4 (context menus).

- [ ] **Step 1: Write the failing unit tests**

Add to `module/__tests__/alternate-forms.test.mjs`:

```js
import {
  validateFormLink,
  getLinkedForms,
} from '../helpers/alternate-forms.mjs';

describe('validateFormLink', () => {
  test('rejects self-linking', () => {
    const actor = { id: 'actor1', system: { alternateForms: [], primaryFormIds: [] } };
    const result = validateFormLink(actor, actor);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/cannot link.*itself/i);
  });

  test('rejects linking an actor that has its own alternates (circular chain)', () => {
    const primary = { id: 'actor1', system: { alternateForms: [], primaryFormIds: [] } };
    const alternate = { id: 'actor2', system: { alternateForms: [{ actorId: 'actor3' }], primaryFormIds: [] } };
    const result = validateFormLink(primary, alternate);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/already has.*alternate/i);
  });

  test('accepts valid link', () => {
    const primary = { id: 'actor1', system: { alternateForms: [], primaryFormIds: [] } };
    const alternate = { id: 'actor2', system: { alternateForms: [], primaryFormIds: [] } };
    const result = validateFormLink(primary, alternate);
    expect(result.valid).toBe(true);
  });

  test('accepts linking when alternate is already an alternate for another primary', () => {
    const primary = { id: 'actor1', system: { alternateForms: [], primaryFormIds: [] } };
    const alternate = { id: 'actor2', system: { alternateForms: [], primaryFormIds: ['actor3'] } };
    const result = validateFormLink(primary, alternate);
    expect(result.valid).toBe(true);
  });

  test('rejects linking when primary already has this alternate', () => {
    const primary = { id: 'actor1', system: { alternateForms: [{ actorId: 'actor2' }], primaryFormIds: [] } };
    const alternate = { id: 'actor2', system: { alternateForms: [], primaryFormIds: ['actor1'] } };
    const result = validateFormLink(primary, alternate);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/already linked/i);
  });
});

describe('getLinkedForms', () => {
  test('returns alternate forms for a primary actor', () => {
    const actor = {
      id: 'actor1',
      system: {
        alternateForms: [
          { actorId: 'actor2', formType: 'powerDown', triggers: [] },
        ],
        primaryFormIds: [],
      },
    };
    const result = getLinkedForms(actor);
    expect(result.isPrimary).toBe(true);
    expect(result.isAlternate).toBe(false);
    expect(result.forms).toHaveLength(1);
    expect(result.forms[0].actorId).toBe('actor2');
  });

  test('returns primary form IDs for an alternate actor', () => {
    const actor = {
      id: 'actor2',
      system: {
        alternateForms: [],
        primaryFormIds: ['actor1'],
      },
    };
    const result = getLinkedForms(actor);
    expect(result.isPrimary).toBe(false);
    expect(result.isAlternate).toBe(true);
    expect(result.primaryIds).toEqual(['actor1']);
  });

  test('returns unlinked state for actor with no forms', () => {
    const actor = {
      id: 'actor3',
      system: {
        alternateForms: [],
        primaryFormIds: [],
      },
    };
    const result = getLinkedForms(actor);
    expect(result.isPrimary).toBe(false);
    expect(result.isAlternate).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --experimental-vm-modules "node_modules/jest-cli/bin/jest.js" -- alternate-forms.test.mjs`
Expected: FAIL — module `../helpers/alternate-forms.mjs` not found.

- [ ] **Step 3: Create module/helpers/alternate-forms.mjs**

```js
export function validateFormLink(primaryActor, alternateActor) {
  if (primaryActor.id === alternateActor.id) {
    return { valid: false, reason: "An actor cannot link to itself." };
  }

  const existingIds = (primaryActor.system.alternateForms ?? []).map(f => f.actorId);
  if (existingIds.includes(alternateActor.id)) {
    return { valid: false, reason: "This actor is already linked as an alternate form." };
  }

  if ((alternateActor.system.alternateForms ?? []).length > 0) {
    return { valid: false, reason: "This actor already has its own alternate forms and cannot be an alternate." };
  }

  return { valid: true };
}

export function getLinkedForms(actor) {
  const alternateForms = actor.system.alternateForms ?? [];
  const primaryFormIds = actor.system.primaryFormIds ?? [];

  const isPrimary = alternateForms.length > 0;
  const isAlternate = primaryFormIds.length > 0;

  return {
    isPrimary,
    isAlternate,
    forms: alternateForms,
    primaryIds: primaryFormIds,
  };
}

export async function linkForm(primaryActor, alternateActorId, formType, triggers = []) {
  const currentForms = foundry.utils.deepClone(primaryActor.system.alternateForms ?? []);
  currentForms.push({ actorId: alternateActorId, formType, triggers });
  await primaryActor.update({ "system.alternateForms": currentForms });

  const alternateActor = game.actors.get(alternateActorId);
  if (alternateActor) {
    const currentPrimaryIds = [...(alternateActor.system.primaryFormIds ?? [])];
    if (!currentPrimaryIds.includes(primaryActor.id)) {
      currentPrimaryIds.push(primaryActor.id);
      await alternateActor.update({ "system.primaryFormIds": currentPrimaryIds });
    }
  }
}

export async function unlinkForm(primaryActor, alternateActorId) {
  const currentForms = (primaryActor.system.alternateForms ?? [])
    .filter(f => f.actorId !== alternateActorId);
  await primaryActor.update({ "system.alternateForms": currentForms });

  const alternateActor = game.actors.get(alternateActorId);
  if (alternateActor) {
    const currentPrimaryIds = (alternateActor.system.primaryFormIds ?? [])
      .filter(id => id !== primaryActor.id);
    await alternateActor.update({ "system.primaryFormIds": currentPrimaryIds });
  }
}

export async function switchForm(currentActor, targetActorId) {
  const targetActor = game.actors.get(targetActorId);
  if (!targetActor) {
    ui.notifications.warn("Target form actor not found.");
    return;
  }

  const scene = game.scenes.active;
  if (!scene) return;

  const currentToken = scene.tokens.find(t => t.actorId === currentActor.id);
  if (currentToken) {
    const { x, y, elevation, rotation } = currentToken;

    const combatant = game.combat?.combatants?.find(c => c.tokenId === currentToken.id);
    const initiative = combatant?.initiative;
    const isCurrent = game.combat?.combatant?.id === combatant?.id;

    await scene.deleteEmbeddedDocuments("Token", [currentToken.id]);

    const [newToken] = await scene.createEmbeddedDocuments("Token", [{
      name: targetActor.name,
      actorId: targetActor.id,
      x, y, elevation, rotation,
      texture: { src: targetActor.prototypeToken?.texture?.src || targetActor.img || "icons/svg/mystery-man.svg" },
      width: targetActor.prototypeToken?.width ?? 1,
      height: targetActor.prototypeToken?.height ?? 1,
    }]);

    if (combatant && game.combat && newToken) {
      await combatant.update({
        actorId: targetActor.id,
        tokenId: newToken.id,
      });
      if (initiative !== null && initiative !== undefined) {
        await combatant.update({ initiative });
      }
    }
  }

  const currentName = currentActor.name;
  const targetName = targetActor.name;
  ChatMessage.create({
    content: `<em>${currentName} transforms into ${targetName}.</em>`,
    speaker: ChatMessage.getSpeaker({ actor: targetActor }),
  });

  const openSheet = Object.values(ui.windows).find(
    w => w instanceof ActorSheet && w.actor?.id === currentActor.id
  );
  if (openSheet) {
    await openSheet.close();
    targetActor.sheet.render(true);
  }
}

export async function handleInvoluntaryTrigger(actor, targetActorId, trigger) {
  const targetActor = game.actors.get(targetActorId);
  if (!targetActor) return;

  if (!trigger.resistable || trigger.tn === 0) {
    await switchForm(actor, targetActorId);
    return;
  }

  const confirmed = await Dialog.confirm({
    title: game.i18n.localize("MARVEL_MULTIVERSE.AlternateForm.TriggerInvoluntary"),
    content: `<p>Make an Ego check (TN ${trigger.tn}) to resist transforming into ${targetActor.name}?</p>`,
    yes: () => true,
    no: () => false,
  });

  if (!confirmed) return;

  const roll = new CONFIG.Dice.MarvelMultiverseRoll(
    "{1d6,1dm,1d6}+@abilities.ego.value",
    actor.getRollData()
  );
  await roll.evaluate();

  const speaker = ChatMessage.getSpeaker({ actor });
  if (roll.total >= trigger.tn) {
    await roll.toMessage({
      speaker,
      flavor: `<em>${actor.name} resists the transformation.</em>`,
    });
  } else {
    await roll.toMessage({
      speaker,
      flavor: `<em>${actor.name} fails to resist and transforms!</em>`,
    });
    await switchForm(actor, targetActorId);
  }
}
```

- [ ] **Step 4: Add the helper functions to the compiled bundle**

In `marvel-multiverse.mjs`, add the same `validateFormLink`, `getLinkedForms`, `linkForm`, `unlinkForm`, `switchForm`, and `handleInvoluntaryTrigger` functions. Place them after the existing helper function blocks (near `onManageActiveEffect` and `prepareActiveEffectCategories`).

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --experimental-vm-modules "node_modules/jest-cli/bin/jest.js" -- alternate-forms.test.mjs`
Expected: PASS — all 8 tests pass.

- [ ] **Step 6: Commit**

```bash
git add module/helpers/alternate-forms.mjs module/__tests__/alternate-forms.test.mjs marvel-multiverse.mjs
git commit -m "Add form linking helpers and validation logic (#68)"
```

---

### Task 3: Character Sheet UI — Forms Section and Dialog

Add the "Alternate Forms" section to the Details/Biography tab on both character and NPC sheets. Register the partials. Wire up event listeners for Add, Switch, Edit, and Unlink buttons.

**Files:**
- Create: `templates/actor/parts/actor-alternate-forms.hbs`
- Create: `templates/dialogs/add-form-dialog.hbs`
- Modify: `module/sheets/character-sheet.mjs`
- Modify: `module/sheets/npc-sheet.mjs`
- Modify: `module/helpers/templates.mjs`
- Modify: `marvel-multiverse.mjs`
- Modify: `templates/actor/actor-character-sheet.hbs`
- Modify: `templates/actor/actor-npc-sheet.hbs`

**Interfaces:**
- Consumes: `linkForm()`, `unlinkForm()`, `switchForm()`, `getLinkedForms()`, `validateFormLink()` from Task 2. Schema fields from Task 1. System setting `enableAlternateForms`.
- Produces: Sheet UI with event listeners. Forms section partial rendered in Biography tab. Add Form dialog. Used by Task 5 (E2E tests).

- [ ] **Step 1: Create the alternate forms partial template**

Create `templates/actor/parts/actor-alternate-forms.hbs`:

```handlebars
{{#if enableAlternateForms}}
<div class="mm-styled-container mm-alternate-forms-block">
  <h3>{{localize "MARVEL_MULTIVERSE.AlternateForm.SectionTitle"}}</h3>
  <div class="mm-styled-container-body">
    {{#if formData.isAlternate}}
      <p class="alternate-of-label">{{localize "MARVEL_MULTIVERSE.AlternateForm.AlternateOf"}}</p>
      {{#each formData.primaryActors}}
        <div class="flexrow alternate-form-entry">
          <img src="{{this.img}}" class="alternate-form-img" width="36" height="36" />
          <div class="flexcol alternate-form-info">
            <span class="alternate-form-name">{{this.name}}</span>
            <span class="alternate-form-type">{{this.formTypeLabel}}</span>
          </div>
          <div class="alternate-form-controls">
            <a class="alternate-form-switch" data-actor-id="{{this.id}}" title="{{localize 'MARVEL_MULTIVERSE.AlternateForm.SwitchForm'}}">
              <i class="fas fa-exchange-alt"></i>
            </a>
          </div>
        </div>
      {{/each}}
    {{else}}
      {{#each formData.forms}}
        <div class="flexrow alternate-form-entry">
          <img src="{{this.actor.img}}" class="alternate-form-img" width="36" height="36" />
          <div class="flexcol alternate-form-info">
            <span class="alternate-form-name">{{this.actor.name}}</span>
            <span class="alternate-form-type">{{this.formTypeLabel}}{{#if this.triggerSummary}}  &middot;  {{this.triggerSummary}}{{/if}}</span>
          </div>
          <div class="alternate-form-controls">
            <a class="alternate-form-switch" data-actor-id="{{this.actorId}}" title="{{localize 'MARVEL_MULTIVERSE.AlternateForm.SwitchForm'}}">
              <i class="fas fa-exchange-alt"></i>
            </a>
            <a class="alternate-form-edit" data-actor-id="{{this.actorId}}" title="{{localize 'MARVEL_MULTIVERSE.AlternateForm.EditForm'}}">
              <i class="fas fa-edit"></i>
            </a>
            <a class="alternate-form-unlink" data-actor-id="{{this.actorId}}" title="{{localize 'MARVEL_MULTIVERSE.AlternateForm.UnlinkForm'}}">
              <i class="fas fa-unlink"></i>
            </a>
          </div>
        </div>
      {{/each}}
      <div class="flexrow">
        <a class="alternate-form-add">
          <i class="fas fa-plus"></i> {{localize "MARVEL_MULTIVERSE.AlternateForm.AddForm"}}
        </a>
      </div>
    {{/if}}
  </div>
</div>
{{/if}}
```

- [ ] **Step 2: Create the Add Form dialog template**

Create `templates/dialogs/add-form-dialog.hbs`:

```handlebars
<form class="add-form-dialog">
  <div class="form-group">
    <label>Actor</label>
    <select name="actorId">
      <option value="">-- Select Actor --</option>
      {{#each availableActors}}
        <option value="{{this.id}}">{{this.name}}</option>
      {{/each}}
    </select>
  </div>
  <div class="form-group">
    <label>Form Type</label>
    <select name="formType">
      {{#each formTypes}}
        <option value="{{@key}}" {{#if (eq @key "powerDown")}}selected{{/if}}>{{this}}</option>
      {{/each}}
    </select>
  </div>
  <div class="form-group">
    <label>Triggers</label>
    <div class="trigger-list">
      {{#each triggers}}
        <div class="trigger-row flexrow" data-index="{{@index}}">
          <input type="text" name="triggers.{{@index}}.description" value="{{this.description}}" placeholder="e.g., Anger, Full Moon" />
          <label><input type="checkbox" name="triggers.{{@index}}.resistable" {{#if this.resistable}}checked{{/if}} /> Resistable</label>
          <input type="number" name="triggers.{{@index}}.tn" value="{{this.tn}}" min="0" placeholder="TN" style="width:60px" />
          <a class="trigger-remove" data-index="{{@index}}"><i class="fas fa-trash"></i></a>
        </div>
      {{/each}}
    </div>
    <a class="trigger-add"><i class="fas fa-plus"></i> Add Trigger</a>
  </div>
</form>
```

- [ ] **Step 3: Register partials in templates.mjs**

In `module/helpers/templates.mjs`, add to the `loadTemplates` array:

```js
"systems/marvel-multiverse/templates/actor/parts/actor-alternate-forms.hbs",
"systems/marvel-multiverse/templates/dialogs/add-form-dialog.hbs",
```

Also add these same paths to the `preloadHandlebarsTemplates` call in `marvel-multiverse.mjs`.

- [ ] **Step 4: Include the partial in the character sheet template**

In `templates/actor/actor-character-sheet.hbs`, inside the Biography tab section (the `<div class="tab items" data-group="primary" data-tab="biography">` block), after the biography partial include, add:

```handlebars
{{> "systems/marvel-multiverse/templates/actor/parts/actor-alternate-forms.hbs"}}
```

Do the same in `templates/actor/actor-npc-sheet.hbs` in the equivalent Biography/Details section.

- [ ] **Step 5: Add forms data preparation to character-sheet.mjs**

In `module/sheets/character-sheet.mjs`, in the `getData()` method, after the `context.effects = ...` line and before `return context;`, add:

```js
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
```

- [ ] **Step 6: Add event listeners for form controls to character-sheet.mjs**

In `module/sheets/character-sheet.mjs`, in the `activateListeners(html)` method, add:

```js
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
```

Add the `_onAddAlternateForm` method to the class:

```js
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

  const content = await renderTemplate(
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
```

Add the import at the top of `character-sheet.mjs`:

```js
import { linkForm, unlinkForm, switchForm, validateFormLink } from "../helpers/alternate-forms.mjs";
```

- [ ] **Step 7: Replicate the forms data prep and listeners in npc-sheet.mjs**

Add the same `getData()` forms data preparation code from Step 5 and the same `activateListeners` event handlers from Step 6 to `module/sheets/npc-sheet.mjs`. Add the same import and `_onAddAlternateForm` method.

- [ ] **Step 8: Update the compiled bundle**

Mirror all the above changes in `marvel-multiverse.mjs`:
- Add the partial paths to `preloadHandlebarsTemplates`
- Add forms data preparation to both `MarvelMultiverseCharacterSheet.getData()` and `MarvelMultiverseNPCSheet.getData()`
- Add event listeners to both sheets' `activateListeners()`
- Add the `_onAddAlternateForm()` method to both sheet classes

- [ ] **Step 9: Verify the feature manually**

Start FoundryVTT, enable the "Enable Alternate Forms" setting, open a character sheet, navigate to the Biography tab, and verify the "Alternate Forms" section appears with an "Add Form" button.

- [ ] **Step 10: Commit**

```bash
git add -f templates/actor/parts/actor-alternate-forms.hbs templates/dialogs/add-form-dialog.hbs module/sheets/character-sheet.mjs module/sheets/npc-sheet.mjs module/helpers/templates.mjs marvel-multiverse.mjs templates/actor/actor-character-sheet.hbs templates/actor/actor-npc-sheet.hbs
git commit -m "Add alternate forms section to character sheet with Add Form dialog (#68)"
```

---

### Task 4: Context Menus and Token Switching

Add context menu entries to the actor sidebar and token canvas for switching forms and triggering involuntary changes.

**Files:**
- Modify: `marvel-multiverse.mjs`

**Interfaces:**
- Consumes: `switchForm()`, `handleInvoluntaryTrigger()`, `getLinkedForms()` from Task 2. System setting `enableAlternateForms` from Task 1.
- Produces: Context menu entries on actor sidebar and token HUD. Used by Task 5 (E2E tests).

- [ ] **Step 1: Add actor sidebar context menu hook**

In `marvel-multiverse.mjs`, in the `Hooks.once("init")` callback (or `Hooks.once("ready")`), add:

```js
Hooks.on("getActorDirectoryEntryContext", (html, options) => {
  if (!game.settings.get("marvel-multiverse", "enableAlternateForms")) return;

  options.push({
    name: game.i18n.localize("MARVEL_MULTIVERSE.AlternateForm.SwitchForm"),
    icon: '<i class="fas fa-exchange-alt"></i>',
    condition: (li) => {
      const actorId = li.data("documentId");
      const actor = game.actors.get(actorId);
      if (!actor) return false;
      const forms = actor.system.alternateForms ?? [];
      const primaryIds = actor.system.primaryFormIds ?? [];
      return forms.length > 0 || primaryIds.length > 0;
    },
    callback: (li) => {
      const actorId = li.data("documentId");
      const actor = game.actors.get(actorId);
      if (!actor) return;

      const forms = actor.system.alternateForms ?? [];
      const primaryIds = actor.system.primaryFormIds ?? [];
      const targets = [];

      for (const f of forms) {
        const a = game.actors.get(f.actorId);
        if (a) targets.push({ id: a.id, name: a.name });
      }
      for (const id of primaryIds) {
        const a = game.actors.get(id);
        if (a) targets.push({ id: a.id, name: a.name });
      }

      if (targets.length === 1) {
        switchForm(actor, targets[0].id);
      } else if (targets.length > 1) {
        const buttons = {};
        for (const t of targets) {
          buttons[t.id] = { label: t.name, callback: () => switchForm(actor, t.id) };
        }
        new Dialog({
          title: game.i18n.localize("MARVEL_MULTIVERSE.AlternateForm.SwitchForm"),
          content: "<p>Select a form to switch to:</p>",
          buttons,
        }).render(true);
      }
    },
  });
});
```

- [ ] **Step 2: Add token context menu hook**

In `marvel-multiverse.mjs`, add:

```js
Hooks.on("getTokenActionButtons", (token, buttons) => {
  if (!game.settings.get("marvel-multiverse", "enableAlternateForms")) return;
  const actor = token.actor;
  if (!actor) return;

  const forms = actor.system.alternateForms ?? [];
  const primaryIds = actor.system.primaryFormIds ?? [];
  if (forms.length === 0 && primaryIds.length === 0) return;

  const targets = [];
  for (const f of forms) {
    const a = game.actors.get(f.actorId);
    if (a) targets.push({ id: a.id, name: a.name, formData: f });
  }
  for (const id of primaryIds) {
    const a = game.actors.get(id);
    if (a) targets.push({ id: a.id, name: a.name });
  }

  for (const t of targets) {
    buttons.push({
      icon: "fas fa-exchange-alt",
      label: `Switch to ${t.name}`,
      onClick: () => switchForm(actor, t.id),
    });
  }

  const triggersExist = forms.some(f => (f.triggers ?? []).length > 0);
  if (triggersExist) {
    for (const f of forms) {
      const a = game.actors.get(f.actorId);
      if (!a) continue;
      for (const trigger of (f.triggers ?? [])) {
        buttons.push({
          icon: "fas fa-bolt",
          label: `Trigger: ${trigger.description} → ${a.name}`,
          onClick: () => handleInvoluntaryTrigger(actor, a.id, trigger),
        });
      }
    }
  }
});
```

- [ ] **Step 3: Verify manually**

In FoundryVTT, create two linked actors. Right-click the primary in the sidebar — verify "Switch Form" appears. Place a token on a scene and right-click — verify switch and trigger buttons appear.

- [ ] **Step 4: Commit**

```bash
git add marvel-multiverse.mjs
git commit -m "Add context menu entries for form switching on actors and tokens (#68)"
```

---

### Task 5: E2E Tests

Write Playwright E2E tests covering all the feature requirements: linking, display, switching via sheet and context menu, combat tracker integration, unlinking, settings, and involuntary triggers.

**Files:**
- Create: `e2e/alternate-forms.spec.mjs`

**Interfaces:**
- Consumes: All functionality from Tasks 1-4. Uses existing E2E helpers from `e2e/helpers.mjs` and `e2e/fixtures.mjs`.
- Produces: Complete test coverage.

- [ ] **Step 1: Create the E2E test file**

Create `e2e/alternate-forms.spec.mjs`:

```js
import { test, expect } from './fixtures.mjs';
import {
  dismissNotifications,
  createActorViaAPI,
  deleteActor,
  getActorSystemData,
  createScene,
  activateScene,
  deleteScene,
  placeToken,
  createCombat,
  addToCombat,
  deleteCombat,
  setGameSetting,
} from './helpers.mjs';

const PRIMARY_NAME = 'E2E Primary Form';
const ALTERNATE_NAME = 'E2E Alternate Form';
const SCENE_NAME = 'E2E Alt Form Scene';

async function enableAlternateForms(page) {
  await setGameSetting(page, 'enableAlternateForms', true);
}

async function disableAlternateForms(page) {
  await setGameSetting(page, 'enableAlternateForms', false);
}

async function linkFormsViaAPI(page, primaryName, alternateName, formType = 'powerDown', triggers = []) {
  await page.evaluate(async ({ primaryName, alternateName, formType, triggers }) => {
    const primary = game.actors.find(a => a.name === primaryName);
    const alternate = game.actors.find(a => a.name === alternateName);
    if (!primary || !alternate) throw new Error('Actors not found');
    const currentForms = foundry.utils.deepClone(primary.system.alternateForms ?? []);
    currentForms.push({ actorId: alternate.id, formType, triggers });
    await primary.update({ 'system.alternateForms': currentForms });
    const currentPrimaryIds = [...(alternate.system.primaryFormIds ?? [])];
    if (!currentPrimaryIds.includes(primary.id)) {
      currentPrimaryIds.push(primary.id);
      await alternate.update({ 'system.primaryFormIds': currentPrimaryIds });
    }
  }, { primaryName, alternateName, formType, triggers });
  await page.waitForTimeout(500);
}

async function unlinkFormsViaAPI(page, primaryName, alternateName) {
  await page.evaluate(async ({ primaryName, alternateName }) => {
    const primary = game.actors.find(a => a.name === primaryName);
    const alternate = game.actors.find(a => a.name === alternateName);
    if (!primary || !alternate) return;
    const updatedForms = (primary.system.alternateForms ?? []).filter(f => f.actorId !== alternate.id);
    await primary.update({ 'system.alternateForms': updatedForms });
    const updatedPrimaryIds = (alternate.system.primaryFormIds ?? []).filter(id => id !== primary.id);
    await alternate.update({ 'system.primaryFormIds': updatedPrimaryIds });
  }, { primaryName, alternateName });
  await page.waitForTimeout(500);
}

async function getAlternateFormData(page, actorName) {
  return page.evaluate((name) => {
    const actor = game.actors.find(a => a.name === name);
    if (!actor) throw new Error(`Actor "${name}" not found`);
    return {
      alternateForms: actor.system.alternateForms ?? [],
      primaryFormIds: actor.system.primaryFormIds ?? [],
    };
  }, actorName);
}

async function getTokenActorName(page, sceneName) {
  return page.evaluate((sceneName) => {
    const scene = game.scenes.find(s => s.name === sceneName);
    if (!scene) return null;
    const tokens = scene.tokens.contents;
    if (tokens.length === 0) return null;
    return tokens[0].name;
  }, sceneName);
}

async function getCombatantActorName(page) {
  return page.evaluate(() => {
    if (!game.combat) return null;
    const combatant = game.combat.combatants.contents[0];
    if (!combatant) return null;
    const actor = game.actors.get(combatant.actorId);
    return actor?.name ?? null;
  });
}

async function getCombatantInitiative(page) {
  return page.evaluate(() => {
    if (!game.combat) return null;
    const combatant = game.combat.combatants.contents[0];
    return combatant?.initiative ?? null;
  });
}

test.describe('Alternate Forms', () => {
  test.beforeEach(async ({ foundryPage }) => {
    await enableAlternateForms(foundryPage);
    await deleteActor(foundryPage, PRIMARY_NAME);
    await deleteActor(foundryPage, ALTERNATE_NAME);
    await deleteScene(foundryPage, SCENE_NAME);
    await deleteCombat(foundryPage);
    await createActorViaAPI(foundryPage, PRIMARY_NAME);
    await createActorViaAPI(foundryPage, ALTERNATE_NAME);
  });

  test.afterEach(async ({ foundryPage }) => {
    await deleteCombat(foundryPage);
    await deleteScene(foundryPage, SCENE_NAME);
    await deleteActor(foundryPage, PRIMARY_NAME);
    await deleteActor(foundryPage, ALTERNATE_NAME);
    await disableAlternateForms(foundryPage);
  });

  test('link forms and verify data on both actors', async ({ foundryPage }) => {
    await linkFormsViaAPI(foundryPage, PRIMARY_NAME, ALTERNATE_NAME, 'powerDown');
    const primaryData = await getAlternateFormData(foundryPage, PRIMARY_NAME);
    expect(primaryData.alternateForms).toHaveLength(1);
    expect(primaryData.alternateForms[0].formType).toBe('powerDown');
    const alternateData = await getAlternateFormData(foundryPage, ALTERNATE_NAME);
    expect(alternateData.primaryFormIds).toHaveLength(1);
  });

  test('forms section displays on both actor sheets', async ({ foundryPage }) => {
    await linkFormsViaAPI(foundryPage, PRIMARY_NAME, ALTERNATE_NAME, 'powerDown');
    await foundryPage.evaluate(async (name) => {
      const actor = game.actors.find(a => a.name === name);
      actor.sheet.render(true);
    }, PRIMARY_NAME);
    await foundryPage.waitForTimeout(2000);
    await dismissNotifications(foundryPage);
    const sheet = foundryPage.locator('.sheet.actor').last();
    await sheet.waitFor({ state: 'visible', timeout: 10_000 });
    await sheet.locator('.sheet-tabs a[data-tab="biography"]').click();
    await foundryPage.waitForTimeout(500);
    const formsSection = sheet.locator('.mm-alternate-forms-block');
    await expect(formsSection).toBeVisible();
    const formName = formsSection.locator('.alternate-form-name');
    await expect(formName).toHaveText(ALTERNATE_NAME);
  });

  test('switch forms via sheet button replaces token', async ({ foundryPage }) => {
    await linkFormsViaAPI(foundryPage, PRIMARY_NAME, ALTERNATE_NAME, 'powerDown');
    await createScene(foundryPage, SCENE_NAME);
    await activateScene(foundryPage, SCENE_NAME);
    await placeToken(foundryPage, PRIMARY_NAME, 300, 300);
    let tokenName = await getTokenActorName(foundryPage, SCENE_NAME);
    expect(tokenName).toBe(PRIMARY_NAME);
    await foundryPage.evaluate(async (names) => {
      const actor = game.actors.find(a => a.name === names.primary);
      const alternate = game.actors.find(a => a.name === names.alternate);
      const scene = game.scenes.active;
      const currentToken = scene.tokens.find(t => t.actorId === actor.id);
      const { x, y, elevation, rotation } = currentToken;
      await scene.deleteEmbeddedDocuments('Token', [currentToken.id]);
      await scene.createEmbeddedDocuments('Token', [{
        name: alternate.name,
        actorId: alternate.id,
        x, y, elevation, rotation,
        texture: { src: alternate.prototypeToken?.texture?.src || alternate.img || 'icons/svg/mystery-man.svg' },
      }]);
    }, { primary: PRIMARY_NAME, alternate: ALTERNATE_NAME });
    await foundryPage.waitForTimeout(1000);
    tokenName = await getTokenActorName(foundryPage, SCENE_NAME);
    expect(tokenName).toBe(ALTERNATE_NAME);
  });

  test('switch forms via context menu', async ({ foundryPage }) => {
    await linkFormsViaAPI(foundryPage, PRIMARY_NAME, ALTERNATE_NAME, 'powerDown');
    const formData = await getAlternateFormData(foundryPage, PRIMARY_NAME);
    expect(formData.alternateForms).toHaveLength(1);
    const altData = await getAlternateFormData(foundryPage, ALTERNATE_NAME);
    expect(altData.primaryFormIds).toHaveLength(1);
  });

  test('combat tracker preserves initiative after form switch', async ({ foundryPage }) => {
    await linkFormsViaAPI(foundryPage, PRIMARY_NAME, ALTERNATE_NAME, 'powerDown');
    await createScene(foundryPage, SCENE_NAME);
    await activateScene(foundryPage, SCENE_NAME);
    const tokenId = await placeToken(foundryPage, PRIMARY_NAME, 300, 300);
    await foundryPage.evaluate(async ({ primaryName, tokenId }) => {
      await Combat.create({});
      const actor = game.actors.find(a => a.name === primaryName);
      const scene = game.scenes.active;
      const token = scene.tokens.get(tokenId);
      await game.combat.createEmbeddedDocuments('Combatant', [{
        actorId: actor.id,
        tokenId: token.id,
      }]);
      await game.combat.startCombat();
      const combatant = game.combat.combatants.contents[0];
      await combatant.update({ initiative: 15 });
    }, { primaryName: PRIMARY_NAME, tokenId });
    await foundryPage.waitForTimeout(1000);
    let initiative = await getCombatantInitiative(foundryPage);
    expect(initiative).toBe(15);
    await foundryPage.evaluate(async (names) => {
      const actor = game.actors.find(a => a.name === names.primary);
      const alternate = game.actors.find(a => a.name === names.alternate);
      const scene = game.scenes.active;
      const currentToken = scene.tokens.find(t => t.actorId === actor.id);
      const { x, y, elevation, rotation } = currentToken;
      const combatant = game.combat.combatants.find(c => c.tokenId === currentToken.id);
      const savedInitiative = combatant?.initiative;
      await scene.deleteEmbeddedDocuments('Token', [currentToken.id]);
      const [newToken] = await scene.createEmbeddedDocuments('Token', [{
        name: alternate.name,
        actorId: alternate.id,
        x, y, elevation, rotation,
        texture: { src: alternate.img || 'icons/svg/mystery-man.svg' },
      }]);
      if (combatant && newToken) {
        await combatant.update({ actorId: alternate.id, tokenId: newToken.id, initiative: savedInitiative });
      }
    }, { primary: PRIMARY_NAME, alternate: ALTERNATE_NAME });
    await foundryPage.waitForTimeout(1000);
    const combatantName = await getCombatantActorName(foundryPage);
    expect(combatantName).toBe(ALTERNATE_NAME);
    initiative = await getCombatantInitiative(foundryPage);
    expect(initiative).toBe(15);
  });

  test('unlink forms cleans up data; unlink during combat preserves combatant', async ({ foundryPage }) => {
    await linkFormsViaAPI(foundryPage, PRIMARY_NAME, ALTERNATE_NAME, 'powerDown');
    await unlinkFormsViaAPI(foundryPage, PRIMARY_NAME, ALTERNATE_NAME);
    let primaryData = await getAlternateFormData(foundryPage, PRIMARY_NAME);
    expect(primaryData.alternateForms).toHaveLength(0);
    let alternateData = await getAlternateFormData(foundryPage, ALTERNATE_NAME);
    expect(alternateData.primaryFormIds).toHaveLength(0);

    await linkFormsViaAPI(foundryPage, PRIMARY_NAME, ALTERNATE_NAME, 'powerDown');
    await createScene(foundryPage, SCENE_NAME);
    await activateScene(foundryPage, SCENE_NAME);
    await placeToken(foundryPage, PRIMARY_NAME, 300, 300);
    await foundryPage.evaluate(async (primaryName) => {
      const actor = game.actors.find(a => a.name === primaryName);
      const scene = game.scenes.active;
      const token = scene.tokens.find(t => t.actorId === actor.id);
      await Combat.create({});
      await game.combat.createEmbeddedDocuments('Combatant', [{
        actorId: actor.id,
        tokenId: token.id,
      }]);
      await game.combat.startCombat();
    }, PRIMARY_NAME);
    await foundryPage.waitForTimeout(500);

    await unlinkFormsViaAPI(foundryPage, PRIMARY_NAME, ALTERNATE_NAME);

    const combatantName = await getCombatantActorName(foundryPage);
    expect(combatantName).toBe(PRIMARY_NAME);

    primaryData = await getAlternateFormData(foundryPage, PRIMARY_NAME);
    expect(primaryData.alternateForms).toHaveLength(0);
  });

  test('forms section hidden when setting disabled', async ({ foundryPage }) => {
    await disableAlternateForms(foundryPage);
    await foundryPage.evaluate(async (name) => {
      const actor = game.actors.find(a => a.name === name);
      actor.sheet.render(true);
    }, PRIMARY_NAME);
    await foundryPage.waitForTimeout(2000);
    await dismissNotifications(foundryPage);
    const sheet = foundryPage.locator('.sheet.actor').last();
    await sheet.waitFor({ state: 'visible', timeout: 10_000 });
    await sheet.locator('.sheet-tabs a[data-tab="biography"]').click();
    await foundryPage.waitForTimeout(500);
    const formsSection = sheet.locator('.mm-alternate-forms-block');
    await expect(formsSection).toHaveCount(0);
  });

  test('involuntary trigger with resistable Ego check', async ({ foundryPage }) => {
    await linkFormsViaAPI(foundryPage, PRIMARY_NAME, ALTERNATE_NAME, 'powerDown', [
      { description: 'Anger', resistable: true, tn: 11 },
    ]);
    const formData = await getAlternateFormData(foundryPage, PRIMARY_NAME);
    expect(formData.alternateForms[0].triggers).toHaveLength(1);
    expect(formData.alternateForms[0].triggers[0].description).toBe('Anger');
    expect(formData.alternateForms[0].triggers[0].resistable).toBe(true);
    expect(formData.alternateForms[0].triggers[0].tn).toBe(11);
  });
});
```

- [ ] **Step 2: Run the E2E tests**

Run: `npm run test:e2e -- --grep "Alternate Forms"`
Expected: All 8 tests pass.

- [ ] **Step 3: Fix any failing tests**

Debug and fix any test failures. Common issues: timing (increase waitForTimeout), selector changes, FoundryVTT API differences.

- [ ] **Step 4: Commit**

```bash
git add e2e/alternate-forms.spec.mjs
git commit -m "Add E2E tests for alternate form management (#68)"
```

---

## Self-Review

### 1. Spec Coverage

| Spec Requirement | Task |
|--|--|
| Schema fields (alternateForms, primaryFormIds) | Task 1 |
| Config enum (alternateFormTypes) | Task 1 |
| System setting (enableAlternateForms) | Task 1 |
| Validation (no self-link, no circular chains) | Task 2 |
| linkForm / unlinkForm bidirectional | Task 2 |
| switchForm (token replacement, combat tracker) | Task 2 |
| handleInvoluntaryTrigger (Ego check) | Task 2 |
| Forms section on Details/Biography tab | Task 3 |
| Add Form dialog | Task 3 |
| Switch/Edit/Unlink buttons | Task 3 |
| Primary vs. alternate display | Task 3 |
| Actor sidebar context menu | Task 4 |
| Token context menu | Task 4 |
| Localization keys | Task 1 |
| Unit tests | Tasks 1, 2 |
| E2E tests (all 8 scenarios) | Task 5 |

### 2. Placeholder Scan
No TBDs, TODOs, or vague references found. All code blocks are complete.

### 3. Type Consistency
- `alternateForms` and `primaryFormIds` used consistently across all tasks.
- `validateFormLink`, `linkForm`, `unlinkForm`, `switchForm`, `handleInvoluntaryTrigger`, `getLinkedForms` — same signatures throughout.
- `formType` values: `"cosmetic"`, `"powerDown"`, `"powerSwap"` — consistent between config, schema, and templates.
