/**
 * The next turn in the bonus round after a given turn. Only combatants with a
 * Fantastic initiative result take part.
 *
 * @param {{fantastic: boolean, defeated: boolean}[]} turns  The turn order.
 * @param {number} from  The current turn index, or -1 before the first turn.
 * @param {boolean} skipDefeated  Whether defeated combatants lose their turn.
 * @returns {number|null}  A turn index, or null when nobody is left to act.
 */
export function nextBonusTurn(turns, from, skipDefeated) {
  for (let i = from + 1; i < turns.length; i++) {
    if (turns[i].fantastic && !(skipDefeated && turns[i].defeated)) return i;
  }
  return null;
}

/**
 * The turn in the bonus round before a given turn.
 *
 * @param {{fantastic: boolean, defeated: boolean}[]} turns  The turn order.
 * @param {number} from  The current turn index.
 * @param {boolean} skipDefeated  Whether defeated combatants lose their turn.
 * @returns {number|null}  A turn index, or null when the turn is the first.
 */
export function previousBonusTurn(turns, from, skipDefeated) {
  for (let i = from - 1; i >= 0; i--) {
    if (turns[i].fantastic && !(skipDefeated && turns[i].defeated)) return i;
  }
  return null;
}

/**
 * The round number to show for a combat. In an encounter that began with a
 * bonus round, the stored round 1 is the bonus round and round 2 is shown as
 * round 1.
 *
 * @param {number} round  The stored round.
 * @param {boolean} hasBonusRound  Whether the encounter began with a bonus round.
 * @returns {number}  The round to show, or 0 for the bonus round.
 */
export function shownRound(round, hasBonusRound) {
  return hasBonusRound ? round - 1 : round;
}
