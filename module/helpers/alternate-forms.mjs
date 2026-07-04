export function validateFormLink(primaryActor, alternateActor) {
  if (primaryActor.id === alternateActor.id) {
    return { valid: false, reason: "An actor cannot link to itself." };
  }

  const existingIds = (primaryActor.system.alternateForms ?? []).map(f => f.actorId);
  if (existingIds.includes(alternateActor.id)) {
    return { valid: false, reason: "This actor is already linked as an alternate form." };
  }

  if ((alternateActor.system.alternateForms ?? []).length > 0) {
    return { valid: false, reason: "This actor already has its own alternate forms and cannot be an alternate." };
  }

  return { valid: true };
}

export function getLinkedForms(actor) {
  const alternateForms = actor.system.alternateForms ?? [];
  const primaryFormIds = actor.system.primaryFormIds ?? [];

  const isPrimary = alternateForms.length > 0;
  const isAlternate = primaryFormIds.length > 0;

  return {
    isPrimary,
    isAlternate,
    forms: alternateForms,
    primaryIds: primaryFormIds,
  };
}

export async function linkForm(primaryActor, alternateActorId, formType, triggers = []) {
  const currentForms = foundry.utils.deepClone(primaryActor.system.alternateForms ?? []);
  currentForms.push({ actorId: alternateActorId, formType, triggers });
  await primaryActor.update({ "system.alternateForms": currentForms });

  const alternateActor = game.actors.get(alternateActorId);
  if (alternateActor) {
    const currentPrimaryIds = [...(alternateActor.system.primaryFormIds ?? [])];
    if (!currentPrimaryIds.includes(primaryActor.id)) {
      currentPrimaryIds.push(primaryActor.id);
      await alternateActor.update({ "system.primaryFormIds": currentPrimaryIds });
    }
  }
}

export async function unlinkForm(primaryActor, alternateActorId) {
  const currentForms = (primaryActor.system.alternateForms ?? [])
    .filter(f => f.actorId !== alternateActorId);
  await primaryActor.update({ "system.alternateForms": currentForms });

  const alternateActor = game.actors.get(alternateActorId);
  if (alternateActor) {
    const currentPrimaryIds = (alternateActor.system.primaryFormIds ?? [])
      .filter(id => id !== primaryActor.id);
    await alternateActor.update({ "system.primaryFormIds": currentPrimaryIds });
  }
}

export async function switchForm(currentActor, targetActorId) {
  const targetActor = game.actors.get(targetActorId);
  if (!targetActor) {
    ui.notifications.warn("Target form actor not found.");
    return;
  }

  const scene = game.scenes.active;
  const currentToken = scene?.tokens.find(t => t.actorId === currentActor.id);
  if (currentToken) {
    const { x, y, elevation, rotation } = currentToken;

    const combatant = game.combat?.combatants?.find(c => c.tokenId === currentToken.id);
    const initiative = combatant?.initiative;

    await scene.deleteEmbeddedDocuments("Token", [currentToken.id]);

    const [newToken] = await scene.createEmbeddedDocuments("Token", [{
      name: targetActor.name,
      actorId: targetActor.id,
      x, y, elevation, rotation,
      texture: { src: targetActor.prototypeToken?.texture?.src || targetActor.img || "icons/svg/mystery-man.svg" },
      width: targetActor.prototypeToken?.width ?? 1,
      height: targetActor.prototypeToken?.height ?? 1,
    }]);

    if (combatant && game.combat && newToken) {
      const updateData = { actorId: targetActor.id, tokenId: newToken.id };
      if (initiative !== null && initiative !== undefined) {
        updateData.initiative = initiative;
      }
      await combatant.update(updateData);
    }
  }

  ChatMessage.create({
    content: `<em>${game.i18n.format("MARVEL_MULTIVERSE.AlternateForm.TransformMessage", { name: currentActor.name, form: targetActor.name })}</em>`,
    speaker: ChatMessage.getSpeaker({ actor: targetActor }),
  });

  const openSheet = Object.values(ui.windows).find(
    w => w instanceof ActorSheet && w.actor?.id === currentActor.id
  );
  if (openSheet) {
    await openSheet.close();
    targetActor.sheet.render(true);
  }
}

export async function handleInvoluntaryTrigger(actor, targetActorId, trigger) {
  const targetActor = game.actors.get(targetActorId);
  if (!targetActor) return;

  if (!trigger.resistable || trigger.tn === 0) {
    await switchForm(actor, targetActorId);
    return;
  }

  const confirmed = await Dialog.confirm({
    title: game.i18n.localize("MARVEL_MULTIVERSE.AlternateForm.TriggerInvoluntary"),
    content: `<p>${game.i18n.format("MARVEL_MULTIVERSE.AlternateForm.EgoCheckPrompt", { tn: trigger.tn, name: targetActor.name })}</p>`,
    yes: () => true,
    no: () => false,
  });

  if (!confirmed) return;

  const roll = new CONFIG.Dice.MarvelMultiverseRoll(
    "{1d6,1dm,1d6}+@abilities.ego.value",
    actor.getRollData()
  );
  await roll.evaluate();

  const speaker = ChatMessage.getSpeaker({ actor });
  if (roll.total >= trigger.tn) {
    await roll.toMessage({
      speaker,
      flavor: `<em>${game.i18n.format("MARVEL_MULTIVERSE.AlternateForm.EgoCheckSuccess", { name: actor.name })}</em>`,
    });
  } else {
    await roll.toMessage({
      speaker,
      flavor: `<em>${game.i18n.format("MARVEL_MULTIVERSE.AlternateForm.EgoCheckFailure", { name: actor.name })}</em>`,
    });
    await switchForm(actor, targetActorId);
  }
}
