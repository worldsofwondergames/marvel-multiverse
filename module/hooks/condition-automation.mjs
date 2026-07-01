import { MARVEL_MULTIVERSE } from "../config.mjs";

function getConditionDamage(actor) {
  const conditions = MARVEL_MULTIVERSE.conditionEffects;
  let totalDamage = 0;
  const active = [];

  for (const [id, cfg] of Object.entries(conditions)) {
    if (cfg.timing !== "end" || !cfg.turnDamage) continue;
    if (!actor.statuses?.has(id)) continue;
    active.push({ id, name: cfg.name, damage: cfg.turnDamage });
    totalDamage += cfg.turnDamage;
  }

  return { active, totalDamage };
}

function getWhisperRecipients(actor) {
  const ids = new Set();
  for (const user of game.users) {
    if (user.isGM) ids.add(user.id);
    if (actor.testUserPermission(user, "OWNER")) ids.add(user.id);
  }
  return Array.from(ids);
}

async function processEndOfTurn(combatant) {
  const actor = combatant?.actor;
  if (!actor) return;

  const { active, totalDamage } = getConditionDamage(actor);
  if (active.length === 0) return;

  const conditionDR = actor.system.conditionDamageReduction ?? 0;
  const damageAfterDR = Math.max(0, totalDamage - conditionDR);

  if (damageAfterDR > 0) {
    const oldHealth = actor.system.health.value;
    const newHealth = oldHealth - damageAfterDR;
    await actor.update({ "system.health.value": newHealth });
  }

  const lines = active.map(c => `<b>${c.name}:</b> ${c.damage} damage`);
  const healthBefore = actor.system.health.value + damageAfterDR;
  const healthAfter = actor.system.health.value;

  let summary = lines.join("<br>");
  if (conditionDR > 0) {
    summary += `<br><b>Total:</b> ${totalDamage} | <b>Condition DR:</b> ${conditionDR} | <b>Damage taken:</b> ${damageAfterDR}`;
  }
  summary += `<br><b>Health:</b> ${healthBefore} → ${healthAfter}`;

  await ChatMessage.create({
    content: `<div class="marvel-multiverse condition-alert">
      <h4>Condition Damage: ${actor.name}</h4>
      <p>${summary}</p>
    </div>`,
    whisper: getWhisperRecipients(actor),
    speaker: ChatMessage.getSpeaker({ actor }),
  });
}

async function processStartOfTurn(combatant) {
  const actor = combatant?.actor;
  if (!actor) return;

  if (!actor.statuses?.has("poisoned")) return;

  const cfg = MARVEL_MULTIVERSE.conditionEffects.poisoned;
  const { ability, tn } = cfg.turnCheck;
  const abilityValue = actor.system.abilities[ability]?.value ?? 0;

  const roll = new CONFIG.Dice.MarvelMultiverseRoll(
    `{1d6,1dm,1d6}+${abilityValue}`,
    actor.getRollData(),
  );
  await roll.evaluate();

  const total = roll.total;
  const isFantastic = roll.isFantastic;
  const success = isFantastic || total >= tn;
  const abilityLabel = game.i18n.localize(CONFIG.MARVEL_MULTIVERSE.abilities[ability]) ?? ability;

  let resultText;
  if (isFantastic) {
    resultText = "<b>Fantastic!</b> Poison cleared!";
    await actor.toggleStatusEffect("poisoned", { active: false });
  } else if (success) {
    resultText = "<b>Success</b> — fine this turn.";
  } else {
    resultText = `<b>Failed</b> — loses 1 Health.`;
    await actor.update({ "system.health.value": actor.system.health.value - 1 });
  }

  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `Poison Check: ${abilityLabel} vs TN ${tn}`,
  }, { rollMode: "publicroll" });

  await ChatMessage.create({
    content: `<div class="marvel-multiverse condition-alert">
      <h4>Poison Check: ${actor.name}</h4>
      <p>${abilityLabel} vs TN ${tn}: <b>${total}</b></p>
      <p>${resultText}</p>
    </div>`,
    whisper: getWhisperRecipients(actor),
    speaker: ChatMessage.getSpeaker({ actor }),
  });
}

function getPreviousCombatant(combat) {
  const combatants = combat.turns;
  if (!combatants?.length) return null;
  const prevIndex = (combat.turn === 0)
    ? combatants.length - 1
    : combat.turn - 1;
  return combatants[prevIndex] ?? null;
}

export function registerConditionAutomation() {
  Hooks.on("combatTurn", (combat, updateData, updateOptions) => {
    const previous = getPreviousCombatant(combat);
    if (previous) processEndOfTurn(previous);

    const current = combat.combatant;
    if (current) processStartOfTurn(current);
  });

  Hooks.on("combatRound", (combat, updateData, updateOptions) => {
    const combatants = combat.turns;
    if (!combatants?.length) return;

    const lastCombatant = combatants[combatants.length - 1];
    if (lastCombatant) processEndOfTurn(lastCombatant);

    const current = combat.combatant;
    if (current) processStartOfTurn(current);
  });
}
