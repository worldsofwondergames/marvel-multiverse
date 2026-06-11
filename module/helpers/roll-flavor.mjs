function _toTitleCase(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function buildRollFlavor({ tokenImg, actorName, powerName, ability, damageType, element }) {
  let detailHtml = "";
  if (powerName) detailHtml += `<div><b>Power:</b> ${powerName}</div>`;
  const cols = [];
  if (ability) cols.push(`<b>Ability:</b> ${_toTitleCase(ability)}`);
  if (damageType) cols.push(`<b>Type:</b> ${_toTitleCase(damageType)}`);
  if (element) cols.push(`<b>Element:</b> ${_toTitleCase(element)}`);
  if (cols.length >= 3) {
    detailHtml += `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;">${cols.map(c => `<span>${c}</span>`).join("")}</div>`;
  } else {
    detailHtml += cols.map(c => `<div>${c}</div>`).join("");
  }
  const tags = `<span style="display:none;">ability: ${ability || ""}${damageType ? " damagetype: " + damageType : ""}${element ? " element: " + element : ""}</span>`;
  const tokenData = tokenImg ? ` data-token-img="${tokenImg}"` : "";
  return `<div class="mm-roll-flavor"${tokenData}><div style="padding:4px 0;font-size:12px;">${detailHtml}</div>${tags}</div>`;
}
