const BATTLE_SUIT_ABILITIES = { melee: "mle", agility: "agl", resilience: "res", vigilance: "vig", ego: "ego", logic: "log" };

/**
 * The Active Effect changes a worn battle suit makes to its wearer.
 *
 * @param {object} system  A battle suit's system data.
 * @returns {{key: string, mode: number, value: string}[]}
 */
export function battleSuitChanges(system) {
  const changes = [];
  for (const [suitKey, actorKey] of Object.entries(BATTLE_SUIT_ABILITIES)) {
    const mod = Number(system?.abilityModifiers?.[suitKey]) || 0;
    if (mod !== 0) changes.push({ key: `system.abilities.${actorKey}.value`, mode: 2, value: String(mod) });
  }
  const rank = Number(system?.rankIncrease) || 0;
  if (rank > 0) changes.push({ key: "system.attributes.rank.value", mode: 2, value: String(rank) });
  return changes;
}

/**
 * Make the actor's effect for a battle suit match the suit as it is now. An
 * equipped suit with modifiers has one effect, and any other suit has none.
 *
 * @param {Actor} actor
 * @param {Item} item  A battle suit the actor owns.
 */
export async function syncBattleSuitEffect(actor, item) {
  const [effect, ...extra] = actor.effects.filter(e => e.flags?.["marvel-multiverse"]?.battleSuitId === item.id);
  const changes = item.system.equipped ? battleSuitChanges(item.system) : [];
  const remove = (changes.length ? extra : [effect, ...extra]).filter(Boolean);
  if (remove.length) await actor.deleteEmbeddedDocuments("ActiveEffect", remove.map(e => e.id));
  if (!changes.length) return;

  const data = { name: `Battle Suit: ${item.name}`, img: item.img, changes };
  if (effect) await effect.update(data);
  else await ActiveEffect.create({ ...data, flags: { "marvel-multiverse": { battleSuitId: item.id } } }, { parent: actor });
}

/**
 * The attacks an iconic item can make as a weapon. An attack is listed when
 * the item has a range or a damage multiplier bonus for it.
 *
 * @param {object} system  An item's system data.
 * @returns {{mode: string, ability: string, range: string, bonus: number}[]}
 */
export function iconicWeaponAttacks(system) {
  const weapon = system?.weaponData;
  if (!weapon?.isWeapon) return [];
  return [
    { mode: "melee", ability: "mle", range: weapon.meleeRange, bonus: weapon.meleeDamageMultiplierBonus },
    { mode: "ranged", ability: "agl", range: weapon.rangedRange, bonus: weapon.rangedDamageMultiplierBonus },
  ]
    .map(a => ({ ...a, range: String(a.range ?? "").trim(), bonus: Math.max(0, Number(a.bonus) || 0) }))
    .filter(a => a.range || a.bonus > 0);
}
