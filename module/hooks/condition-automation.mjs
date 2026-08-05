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

function getTokenImg(combatant, actor) {
  const tokenDoc = combatant.token;
  if (tokenDoc?.texture?.src) return tokenDoc.texture.src;
  const activeToken = actor?.getActiveTokens?.()?.[0];
  if (activeToken?.document?.texture?.src) return activeToken.document.texture.src;
  const protoSrc = actor?.prototypeToken?.texture?.src;
  if (protoSrc && !protoSrc.includes("*")) return protoSrc;
  return actor?.img || "";
}

function buildConditionFlavor(tokenImg, detailHtml) {
  const tokenData = tokenImg ? ` data-token-img="${tokenImg}"` : "";
  return `<div class="mm-roll-flavor"${tokenData}><div style="padding:4px 0;font-size:12px;">${detailHtml}</div></div>`;
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

  let bodyLines = lines.join("<br>");
  if (conditionDR > 0) {
    bodyLines += `<br><b>Condition DR:</b> -${conditionDR}`;
  }

  const tokenImg = getTokenImg(combatant, actor);
  let detailHtml = active.map(c => `<div><b>${c.name}:</b> ${c.damage} damage</div>`).join("");
  if (conditionDR > 0) {
    detailHtml += `<div><b>Condition DR:</b> -${conditionDR}</div>`;
  }
  await ChatMessage.create({
    content: `<div class="marvel-multiverse dice-roll marvel-roll">
      <div class="dice-result">
        <h4 class="dice-total"><span>Health: ${healthBefore} → ${healthAfter}</span></h4>
      </div>
    </div>`,
    flavor: buildConditionFlavor(tokenImg, detailHtml),
    whisper: getWhisperRecipients(actor),
    speaker: ChatMessage.getSpeaker({ token: combatant.token, actor }),
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

  const tokenImg = getTokenImg(combatant, actor);
  const rollFlavor = buildConditionFlavor(tokenImg, `<div>Poison Check: ${abilityLabel} vs TN ${tn}</div>`);
  const resultFlavor = buildConditionFlavor(tokenImg, `<div>${resultText}</div>`);

  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ token: combatant.token, actor }),
    flavor: rollFlavor,
  }, { rollMode: "publicroll" });

  await ChatMessage.create({
    content: `<div class="marvel-multiverse dice-roll marvel-roll">
      <div class="dice-result">
        <h4 class="dice-total"><span>${total}</span></h4>
      </div>
    </div>`,
    flavor: resultFlavor,
    whisper: getWhisperRecipients(actor),
    speaker: ChatMessage.getSpeaker({ token: combatant.token, actor }),
  });
}

export function registerConditionAutomation() {
  Hooks.on("updateCombat", (combat, changed, options, userId) => {
    if (!game.user.isGM) return;
    if (!("turn" in changed) && !("round" in changed)) return;
    if (combat.previous.round === 0) {
      const current = combat.combatant;
      if (current) processStartOfTurn(current);
      return;
    }
    const prevCombatant = combat.turns[combat.previous.turn];
    if (prevCombatant) processEndOfTurn(prevCombatant);
    const current = combat.combatant;
    if (current) processStartOfTurn(current);
  });
}
