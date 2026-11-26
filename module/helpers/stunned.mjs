/**
 * The edge mode of an action check once the stunned condition is counted.
 *
 * A stunned character has trouble on the check, and an attack against a
 * stunned target has an edge. An edge and a trouble cancel each other. The
 * result stays within one edge or one trouble, the most a roll can show.
 *
 * @param {number} edgeMode  The mode before the condition: 1 edge, 0 normal, -1 trouble
 * @param {object} [state]
 * @param {boolean} [state.stunned=false]        The character rolling is stunned
 * @param {boolean} [state.targetStunned=false]  The attack is against a stunned target
 * @returns {number}
 */
export function stunnedEdgeMode(edgeMode, { stunned = false, targetStunned = false } = {}) {
  const shifted = edgeMode + (targetStunned ? 1 : 0) - (stunned ? 1 : 0);
  return Math.max(-1, Math.min(1, shifted));
}
