/** Speeds that are half of Run Speed unless a power or the player says otherwise. */
export const HALF_RUN_SPEEDS = ["climb", "jump", "swim"];

/** The Speed block on the sheet has room for this many speeds. */
export const MAX_SHOWN_SPEEDS = 5;

/**
 * Finish the movement speeds after each power's calc has been applied. A
 * power's calc wins. Otherwise a speed entered on the sheet is used, and
 * Climb, Jump, and Swim with no entered speed are half of Run, rounded up.
 * @param {object} movement  The actor's system.movement, changed in place.
 */
export function applyMovementOverrides(movement) {
  const halfRun = Math.ceil(movement.run.value * 0.5);
  for (const key in movement) {
    const mode = movement[key];
    if (mode.calc) continue;
    if (Number.isInteger(mode.override)) mode.value = mode.override;
    else if (HALF_RUN_SPEEDS.includes(key)) mode.value = halfRun;
  }
}

/**
 * Build one row per movement mode for the Movement Speeds dialog.
 * @param {object} source   The actor's stored system.movement.
 * @param {object} derived  The actor's prepared system.movement.
 * @returns {object[]}
 */
export function buildMovementRows(source, derived) {
  return Object.keys(derived).map((key) => {
    const canHalf = HALF_RUN_SPEEDS.includes(key);
    const stored = source[key];
    // A power's effect sets calc, and a set calc switches the speed on.
    const locked = Boolean(derived[key].calc);
    const half = !locked && canHalf && !Number.isInteger(stored.override);
    let spaces = derived[key].value;
    if (!locked && !half) spaces = key === "run" ? stored.value : (stored.override ?? stored.value);
    return {
      key,
      label: derived[key].label,
      active: derived[key].active,
      // A speed shown by an effect cannot be hidden from the dialog.
      activeLocked: derived[key].active && !stored.active,
      canHalf,
      half,
      locked,
      spaces,
    };
  });
}

/**
 * Turn the dialog's rows into an actor update. A locked row has no entry, so
 * a speed set by a power is left alone.
 * @param {object[]} rows  One of { key, active, half, spaces } per editable row.
 *                         `active` is undefined when its checkbox was locked.
 * @returns {object}
 */
export function movementUpdateFromRows(rows) {
  const update = {};
  for (const row of rows) {
    const path = `system.movement.${row.key}`;
    if (row.active !== undefined) update[`${path}.active`] = row.active;
    if (row.locked) continue;
    if (row.key === "run") update[`${path}.value`] = row.spaces;
    else update[`${path}.override`] = row.half ? null : row.spaces;
  }
  return update;
}

/**
 * Read the dialog's form into rows for movementUpdateFromRows.
 * @param {HTMLElement} root  The dialog content.
 * @returns {object[]}
 */
export function readMovementRows(root) {
  return [...root.querySelectorAll(".mm-movement-row")].map((el) => {
    const show = el.querySelector('input[name="active"]');
    const spaces = el.querySelector('input[name="spaces"]');
    return {
      key: el.dataset.key,
      active: el.dataset.activeLocked === "true" ? undefined : show.checked,
      locked: el.dataset.locked === "true",
      half: el.querySelector('select[name="calc"]').value === "half",
      spaces: Math.max(0, Math.trunc(Number(spaces.value)) || 0),
    };
  });
}

/**
 * Open the Movement Speeds dialog for an actor.
 * @param {Actor} actor
 */
export async function openMovementDialog(actor) {
  const rows = buildMovementRows(actor.system._source.movement, actor.system.movement);
  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/marvel-multiverse/templates/dialogs/movement-speeds-dialog.hbs",
    { rows }
  );

  new Dialog({
    title: game.i18n.localize("MARVEL_MULTIVERSE.Movement.DialogTitle"),
    content,
    buttons: {
      save: {
        label: game.i18n.localize("MARVEL_MULTIVERSE.Movement.Save"),
        callback: async (html) => {
          await actor.update(movementUpdateFromRows(readMovementRows(html[0])));
        },
      },
      cancel: {
        label: game.i18n.localize("MARVEL_MULTIVERSE.Movement.Cancel"),
      },
    },
    default: "save",
    render: (html) => {
      const root = html[0];
      const runInput = root.querySelector('.mm-movement-row[data-key="run"] input[name="spaces"]');
      // Half Run rows follow the Run Speed typed in the dialog.
      const refresh = () => {
        for (const el of root.querySelectorAll(".mm-movement-row")) {
          if (el.dataset.locked === "true") continue;
          const spaces = el.querySelector('input[name="spaces"]');
          const half = el.querySelector('select[name="calc"]').value === "half";
          spaces.readOnly = half;
          if (half) spaces.value = Math.ceil((Number(runInput.value) || 0) * 0.5);
        }
      };
      // Once the most speeds the sheet can show are checked, the rest cannot be.
      const limit = () => {
        const boxes = [...root.querySelectorAll('.mm-movement-row input[name="active"]')];
        const full = boxes.filter((box) => box.checked).length >= MAX_SHOWN_SPEEDS;
        for (const box of boxes) {
          if (box.closest(".mm-movement-row").dataset.activeLocked === "true") continue;
          box.disabled = full && !box.checked;
        }
      };
      html.on("change", 'input[name="active"]', limit);
      limit();
      html.on("change", 'select[name="calc"]', refresh);
      runInput.addEventListener("input", refresh);
    },
  }, { classes: ["dialog", "marvel-multiverse", "mm-dialog", "mm-movement-dialog"] }).render(true);
}
