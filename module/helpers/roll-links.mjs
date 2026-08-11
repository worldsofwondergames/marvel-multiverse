/**
 * Turns roll-calling phrases in power text into clickable rolls.
 *
 * Power descriptions say things like "the character makes an Ego check
 * against the target's Ego defense". The first half names a roll the player
 * should make; the second half is the number they are rolling against. Only
 * the first becomes a link.
 *
 * Registered as a custom enricher, so it runs anywhere enrichHTML runs.
 * Foundry already enriches chat message content, which covers the power cards.
 */

/** Ability names as they appear in the rulebook, mapped to schema keys. */
export const ABILITY_BY_NAME = {
  melee: "mle",
  agility: "agl",
  resilience: "res",
  vigilance: "vig",
  ego: "ego",
  logic: "log",
};

/**
 * Attacks that name a range rather than an ability. The rulebook defines a
 * close attack as Melee and a ranged attack as Agility.
 */
export const IMPLIED_ABILITY = {
  close: "mle",
  ranged: "agl",
};

const ABILITIES = Object.keys(ABILITY_BY_NAME).join("|");

/**
 * One pattern rather than several, because alternation is ordered: at a given
 * position the first alternative that matches wins. That is what stops the
 * bare "Melee check" branch from eating the "Melee check (target number 20)"
 * branch. Separate enrichers would each get their own pass and could nest.
 *
 * Deliberately not matched:
 *   - "Ego defense" and friends, which are the number being rolled against
 *   - bare "the attack", which refers back to a roll already made
 *   - bare "action check", which describes a bonus and names no ability
 */
export const ROLL_LINK_PATTERN = new RegExp(
  "\\b(?:" +
    // "makes an Ego vs. TN 12 action check"
    `(?<tnAbility>${ABILITIES})\\s+vs\\.?\\s+TN\\s+(?<tnValue>\\d+)\\s+action\\s+checks?\\b` +
    // "requires a Melee check (target number 20)"
    `|(?<parenAbility>${ABILITIES})\\s+checks?\\s*\\(\\s*target\\s+number\\s+(?<parenValue>\\d+)\\s*\\)` +
    // "makes an Ego check", "makes a Melee attack"
    `|(?<ability>${ABILITIES})\\s+(?<abilityKind>checks?|attacks?)\\b` +
    // "makes a close attack", "makes a ranged attack"
    `|(?<implied>close|ranged)\\s+(?<impliedKind>attacks?)\\b` +
  ")",
  "gi"
);

/**
 * Read a regex match into the roll it describes.
 * @param {RegExpMatchArray} match
 * @returns {{abilityKey: string, kind: string, tn: number|null, label: string}|null}
 */
export function describeRollLink(match) {
  const groups = match?.groups;
  if (!groups) return null;
  const label = match[0];

  if (groups.tnAbility) {
    return {
      abilityKey: ABILITY_BY_NAME[groups.tnAbility.toLowerCase()],
      kind: "check",
      tn: Number(groups.tnValue),
      label,
    };
  }
  if (groups.parenAbility) {
    return {
      abilityKey: ABILITY_BY_NAME[groups.parenAbility.toLowerCase()],
      kind: "check",
      tn: Number(groups.parenValue),
      label,
    };
  }
  if (groups.ability) {
    return {
      abilityKey: ABILITY_BY_NAME[groups.ability.toLowerCase()],
      kind: /attack/i.test(groups.abilityKind) ? "attack" : "check",
      tn: null,
      label,
    };
  }
  if (groups.implied) {
    return {
      abilityKey: IMPLIED_ABILITY[groups.implied.toLowerCase()],
      kind: "attack",
      tn: null,
      label,
    };
  }
  return null;
}

/**
 * Find every roll phrase in a plain string. Used by the tests and by anything
 * that wants the descriptors without building DOM.
 * @param {string} text
 * @returns {Array<object>}
 */
export function findRollLinks(text) {
  const found = [];
  for (const match of String(text ?? "").matchAll(ROLL_LINK_PATTERN)) {
    const described = describeRollLink(match);
    if (described) found.push({ ...described, index: match.index });
  }
  return found;
}

/**
 * Build the anchor an enriched phrase becomes.
 * @param {object} descriptor  Output of describeRollLink
 * @returns {HTMLAnchorElement}
 */
export function buildRollLinkAnchor({ abilityKey, kind, tn, label }) {
  const anchor = document.createElement("a");
  anchor.classList.add("mm-roll-link");
  anchor.dataset.ability = abilityKey;
  anchor.dataset.rollKind = kind;
  if (tn !== null && tn !== undefined) anchor.dataset.tn = String(tn);
  const icon = document.createElement("i");
  icon.className = "fa-solid fa-dice-d6";
  anchor.append(icon, document.createTextNode(label));
  return anchor;
}

/**
 * The custom enricher itself. Returning nothing leaves the text as it was.
 * @param {RegExpMatchArray} match
 * @returns {HTMLAnchorElement|null}
 */
export function enrichRollLink(match) {
  const descriptor = describeRollLink(match);
  if (!descriptor?.abilityKey) return null;
  return buildRollLinkAnchor(descriptor);
}

/**
 * Work out whose check this is from where the link was clicked.
 *
 * A link in a chat card belongs to the actor who spoke it. A link on a sheet
 * belongs to that sheet's actor. Failing both, fall back to whoever the user
 * is currently playing, which covers links in a journal entry.
 * @param {HTMLElement} anchor
 * @returns {Actor|null}
 */
export function resolveRollLinkActor(anchor) {
  const messageEl = anchor.closest("[data-message-id]");
  if (messageEl) {
    const message = game.messages.get(messageEl.dataset.messageId);
    if (message?.speakerActor) return message.speakerActor;
  }

  const appEl = anchor.closest("[data-appid]");
  if (appEl) {
    const app = ui.windows?.[appEl.dataset.appid];
    const doc = app?.document ?? app?.actor ?? app?.object;
    if (doc?.documentName === "Actor") return doc;
    if (doc?.parent?.documentName === "Actor") return doc.parent;
  }

  const controlled = canvas?.tokens?.controlled ?? [];
  if (controlled.length === 1 && controlled[0].actor) return controlled[0].actor;
  return game.user?.character ?? null;
}
