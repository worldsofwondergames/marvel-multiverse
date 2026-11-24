/** Gear an actor can own any number of, such as two of the same weapon. */
export const STACKABLE_ITEM_TYPES = ["weapon", "item", "equipment"];

/** Types whose `multiple` flag lets them be taken again with a new detail. */
export const REPEATABLE_ITEM_TYPES = ["trait", "tag"];

const normalizeDetail = (detail) => String(detail ?? "").trim().toLowerCase();

/** The actor's items with the same type and name as the item data. */
function ownedCopies(actor, itemData) {
  return actor.items.filter((i) => i.type === itemData.type && i.name === itemData.name);
}

/**
 * Whether the item is a repeatable trait or tag the actor already has, so a
 * new copy needs a detail to tell it from the others.
 * @param {Actor} actor
 * @param {object} itemData
 * @returns {boolean}
 */
export function needsDetail(actor, itemData) {
  return REPEATABLE_ITEM_TYPES.includes(itemData.type)
    && Boolean(itemData.system?.multiple)
    && ownedCopies(actor, itemData).length > 0;
}

/**
 * Whether an actor may be given another item. A refusal has the reason
 * "owned" for an item limited to one copy, or "detail" for a repeatable item
 * whose name and detail the actor already has.
 * @param {Actor} actor
 * @param {object} itemData
 * @returns {object}  An `ok` flag, and a `reason` when it is false.
 */
export function canAddItem(actor, itemData) {
  if (STACKABLE_ITEM_TYPES.includes(itemData.type)) return { ok: true };
  const owned = ownedCopies(actor, itemData);
  if (!owned.length) return { ok: true };
  if (!needsDetail(actor, itemData)) return { ok: false, reason: "owned" };
  const detail = normalizeDetail(itemData.system?.detail);
  if (owned.some((i) => normalizeDetail(i.system?.detail) === detail)) return { ok: false, reason: "detail" };
  return { ok: true };
}

/**
 * Ask for the detail of a repeatable trait or tag the actor already has.
 * @param {Actor} actor
 * @param {object} itemData
 * @returns {Promise<string|null>}  The detail, or null if the dialog was canceled.
 */
export async function promptItemDetail(actor, itemData) {
  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/marvel-multiverse/templates/dialogs/item-detail-dialog.hbs",
    {
      message: game.i18n.format("MARVEL_MULTIVERSE.Item.RepeatPrompt", {
        actor: actor.name,
        item: itemData.name,
        type: game.i18n.localize(`TYPES.Item.${itemData.type}`).toLowerCase(),
      }),
      detail: itemData.system?.detail ?? "",
    }
  );
  return new Promise((resolve) => {
    new Dialog({
      title: game.i18n.format("MARVEL_MULTIVERSE.Item.AddTitle", { item: itemData.name }),
      content,
      buttons: {
        add: {
          label: game.i18n.localize("MARVEL_MULTIVERSE.Item.Add"),
          callback: (html) => resolve(html.find('input[name="detail"]').val().trim()),
        },
        cancel: {
          label: game.i18n.localize("MARVEL_MULTIVERSE.Item.Cancel"),
          callback: () => resolve(null),
        },
      },
      default: "add",
      close: () => resolve(null),
    }, { classes: ["dialog", "marvel-multiverse", "mm-dialog", "mm-item-detail-dialog"] }).render(true);
  });
}

/**
 * Decide whether a dropped item is added to the actor. A repeatable trait or
 * tag the actor already has gets its detail from a prompt first. A refused
 * drop shows a warning that names the item.
 * @param {Actor} actor
 * @param {object} itemData  Changed in place when a detail is entered.
 * @returns {Promise<boolean>}
 */
export async function confirmItemDrop(actor, itemData) {
  if (needsDetail(actor, itemData)) {
    const detail = await promptItemDetail(actor, itemData);
    if (detail === null) return false;
    itemData.system.detail = detail;
  }
  const result = canAddItem(actor, itemData);
  if (result.ok) return true;
  const key = result.reason === "detail" && itemData.system.detail
    ? "MARVEL_MULTIVERSE.Item.AlreadyOwnedDetail"
    : "MARVEL_MULTIVERSE.Item.AlreadyOwned";
  ui.notifications.warn(game.i18n.format(key, {
    actor: actor.name,
    item: itemData.name,
    detail: itemData.system?.detail,
  }));
  return false;
}
