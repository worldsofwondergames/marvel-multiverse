/**
 * The name to show for a stored source. A registered key shows its registry
 * label, and any other text shows as it is.
 *
 * @param {string} value  A stored `system.source`.
 * @returns {string}
 */
export function sourceLabel(value) {
  const sources = CONFIG.MARVEL_MULTIVERSE.sources;
  return Object.hasOwn(sources, value) ? sources[value].label : (value ?? "");
}

/**
 * The value to store for text typed into a Source field. Text that matches a
 * registered label, in any case, gives that source's key. Other text is stored
 * as typed, without the spaces around it.
 *
 * @param {string} text
 * @returns {string}
 */
export function sourceValue(text) {
  const typed = String(text ?? "").trim();
  const match = Object.entries(CONFIG.MARVEL_MULTIVERSE.sources)
    .find(([, source]) => source.label.toLowerCase() === typed.toLowerCase());
  return match ? match[0] : typed;
}

/**
 * The Source choices for the item directory filter. Every registered source
 * comes first, then every other source the items use, in alphabetical order.
 *
 * @param {Iterable<Item>} items
 * @param {string[]} selected  The sources checked in the filter.
 * @returns {Object<string, {label: string, checked: boolean}>}
 */
export function sourceFilterOptions(items, selected) {
  const used = [...items].map(item => item.system?.source).filter(Boolean).sort((a, b) => a.localeCompare(b));
  const all = new Set([...Object.keys(CONFIG.MARVEL_MULTIVERSE.sources), ...used]);
  return Object.fromEntries([...all].map(key => [key, { label: sourceLabel(key), checked: selected.includes(key) }]));
}
