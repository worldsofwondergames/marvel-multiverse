/**
 * Whether an actor may hold a Karma total below 0. The Bad Karma setting must
 * be on and the actor must own the Weird trait.
 *
 * @param {Actor} actor
 * @returns {boolean}
 */
export function allowsBadKarma(actor) {
  return Boolean(game.settings.get("marvel-multiverse", "badKarmaEnabled"))
    && actor.items.some((i) => i.type === "trait" && i.name === "Weird");
}

/**
 * Raise a Karma total below 0 in an actor update to 0, unless the actor may
 * hold Bad Karma.
 *
 * @param {Actor} actor
 * @param {object} changed  The update, as passed to `_preUpdate`.
 */
export function limitKarmaUpdate(actor, changed) {
  const karma = changed.system?.karma;
  if (karma?.value < 0 && !allowsBadKarma(actor)) karma.value = 0;
}
