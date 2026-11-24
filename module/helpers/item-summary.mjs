import { _buildItemMeta, _hasContent } from "../documents/item.mjs";
import { getTextEditor } from "./enrich.mjs";

/**
 * The text shown under an item row when its name is clicked on an actor sheet:
 * the description and effect the chat card prints, and for a power its Action,
 * Trigger, Duration, and Cost lines.
 * @param {Item} item
 * @returns {Promise<string>}
 */
export async function buildItemSummaryHTML(item) {
  const TE = getTextEditor();
  const enrich = (text) =>
    TE.enrichHTML(String(text), {
      rollData: item.getRollData(),
      relativeTo: item,
      secrets: item.isOwner ?? false,
    });
  const hasEffect = _hasContent(item.system.effect);
  const parts = [];
  if (item.type === "power") parts.push(_buildItemMeta(item.system));
  if (_hasContent(item.system.description)) {
    parts.push(
      `<div class="mm-chat-description${hasEffect ? " -flavor" : ""}">${await enrich(item.system.description)}</div>`
    );
  }
  if (hasEffect) parts.push(`<div class="mm-chat-effect">${await enrich(item.system.effect)}</div>`);
  const body = parts.join("");
  return body || `<div class="mm-item-summary-empty">${game.i18n.localize("MARVEL_MULTIVERSE.Item.NoDescription")}</div>`;
}

/**
 * Put an item's summary directly after its row.
 * @param {HTMLElement} row  The element carrying data-item-id.
 * @param {Item} item
 */
async function showItemSummary(row, item) {
  const html = await buildItemSummaryHTML(item);
  // A second click can arrive while the text above is being enriched.
  if (row.nextElementSibling?.dataset?.summaryItemId === item.id) return;
  const summary = document.createElement(row.tagName === "LI" ? "li" : "div");
  summary.className = "mm-item-summary";
  summary.dataset.summaryItemId = item.id;
  summary.innerHTML = html;
  row.after(summary);
  row.classList.add("-expanded");
}

/**
 * Expand or collapse the item whose name was clicked. The expanded ids are kept
 * on the sheet and not on the actor, so each viewer has their own.
 * @param {object} sheet  The actor sheet.
 * @param {HTMLElement} row
 */
export async function toggleItemSummary(sheet, row) {
  const item = sheet.actor.items.get(row?.dataset?.itemId);
  if (!item) return;
  sheet._expandedItems ??= new Set();
  if (sheet._expandedItems.has(item.id)) {
    sheet._expandedItems.delete(item.id);
    if (row.nextElementSibling?.dataset?.summaryItemId === item.id) row.nextElementSibling.remove();
    row.classList.remove("-expanded");
    return;
  }
  sheet._expandedItems.add(item.id);
  await showItemSummary(row, item);
}

/**
 * Expand again every item that was expanded before the sheet re-rendered.
 * @param {object} sheet  The actor sheet.
 * @param {HTMLElement} root  The sheet's rendered element.
 */
export async function restoreItemSummaries(sheet, root) {
  for (const id of sheet._expandedItems ?? []) {
    const item = sheet.actor.items.get(id);
    const row = root.querySelector(`.item[data-item-id="${id}"]`);
    if (!item || !row) {
      sheet._expandedItems.delete(id);
      continue;
    }
    await showItemSummary(row, item);
  }
}
