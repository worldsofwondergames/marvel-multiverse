/**
 * Prepares rich-text fields for display on a sheet.
 *
 * Handlebars helpers cannot await, and enrichHTML is async, so enriched values
 * have to be built in getData() and handed to the template as a parallel
 * context key. The {{editor}} helper then shows the enriched text while
 * ApplicationV1 loads the raw stored value from the document when the editor
 * is actually opened, so what gets saved is never the enriched copy.
 */

/** The rich-text fields that can appear on a document in this system. */
export const RICH_TEXT_FIELDS = [
  "description",
  "effect",
  "notes",
  "history",
  "personality",
  "distinguishingFeatures",
  "profile",
  "downtimeActivity",
  "intelligenceDescription",
];

/**
 * Resolve the namespaced TextEditor, falling back to the deprecated global on
 * anything older than v13.
 */
export function getTextEditor() {
  return foundry.applications?.ux?.TextEditor?.implementation ?? globalThis.TextEditor;
}

/**
 * Build enriched copies of whichever rich-text fields the document actually
 * has. Fields the document does not define are skipped rather than emitted as
 * empty strings, so a template asking for a field that does not belong to its
 * type renders nothing instead of a blank editor.
 *
 * @param {Document} doc            The actor or item being rendered
 * @param {object} [options]
 * @param {object} [options.rollData]  Roll data so inline rolls resolve
 * @param {string[]} [options.fields]  Override the default field list
 * @returns {Promise<object>}       Keyed by field name, e.g. {description: "..."}
 */
export async function enrichSheetFields(doc, { rollData, fields = RICH_TEXT_FIELDS } = {}) {
  const TE = getTextEditor();
  const enriched = {};
  if (!doc || !TE?.enrichHTML) return enriched;

  for (const field of fields) {
    const value = doc.system?.[field];
    if (value === undefined || value === null) continue;
    enriched[field] = await TE.enrichHTML(String(value), {
      rollData,
      relativeTo: doc,
      // Secret blocks are for whoever owns the document. A player looking at
      // someone else's sheet should not see them.
      secrets: doc.isOwner ?? false,
    });
  }
  return enriched;
}
