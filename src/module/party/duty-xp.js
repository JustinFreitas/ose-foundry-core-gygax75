/**
 * @file Duty XP helper functions.
 */

const getDutyEffects = (actor) => {
  const sysId = globalThis.game?.system?.id ?? "ose";
  return [...(actor?.effects ?? [])].filter((e) =>
    Boolean(e?.flags?.[sysId]?.dutyXP || e?.flags?.ose?.dutyXP || e?.flags?.dutyXP),
  );
};

export const hasActiveDutyXP = (actor) => {
  const sysId = globalThis.game?.system?.id ?? "ose";
  return Boolean(
    actor?.flags?.dutyXP ||
      actor?.flags?.[sysId]?.dutyXP ||
      actor?.flags?.ose?.dutyXP ||
      getDutyEffects(actor).length > 0,
  );
};

/**
 * Resets temporary Duty XP bonuses (+5%) for specified actors (or all actors with active duty XP).
 * Preserves Active Effect Tweaks (`tweak: "xp"`) and Class Item XP bonuses without double-dipping.
 * @param {Array<OseActor>} [targetActors=null] - Actors to reset. If null, resets all actors with active dutyXP flags/effects.
 */
export const resetDutyXP = async (targetActors = null) => {
  const sysId = globalThis.game?.system?.id ?? "ose";
  const actorsToReset = targetActors || game.actors.filter((a) => hasActiveDutyXP(a));
  const resetLogs = [];
  const esc = (val) => foundry.utils.escapeHTML(String(val ?? ""));

  for (const actor of actorsToReset) {
    const dutyEffects = getDutyEffects(actor);
    const flagData = actor.flags?.dutyXP ?? actor.flags?.[sysId]?.dutyXP ?? actor.flags?.ose?.dutyXP;

    if (dutyEffects.length > 0 && typeof actor.deleteEmbeddedDocuments === "function") {
      const duties =
        flagData?.duties || dutyEffects.flatMap((e) => e.flags?.[sysId]?.duties || e.flags?.ose?.duties || []);
      const currentBonus = actor.system?.details?.xp?.bonus ?? 0;
      await actor.deleteEmbeddedDocuments(
        "ActiveEffect",
        dutyEffects.map((e) => e.id),
      );
      const flagCleanup = {};
      if (actor.flags?.dutyXP !== undefined) flagCleanup["flags.-=dutyXP"] = null;
      if (actor.flags?.[sysId]?.dutyXP !== undefined) flagCleanup[`flags.${sysId}.-=dutyXP`] = null;
      if (Object.keys(flagCleanup).length > 0 && typeof actor.update === "function") {
        await actor.update(flagCleanup);
      }
      const origBonus = flagData?.origXpBonus ?? currentBonus - 5;
      const dutyLabel = duties.length > 0 ? duties.map(esc).join(", ") : "duty";
      resetLogs.push(
        `<b>${esc(actor.name)}:</b> XP bonus reset from ${currentBonus}% back to ${origBonus}% for duty (${dutyLabel}).`,
      );
      continue;
    }

    if (flagData?.origXpBonus !== undefined) {
      const origBonus = Number(flagData.origXpBonus) || 0;
      const duties = (flagData.duties || []).map(esc);
      const currentBonus = actor.system?.details?.xp?.bonus ?? 0;

      // Subtract active non-duty AE bonuses targeting system.details.xp.bonus so writing _source does not double-dip Tweaks
      const activeAeXpBonus = [...(actor.effects ?? [])]
        .filter(
          (e) =>
            !e.disabled && !e.isSuppressed && !(e.flags?.[sysId]?.dutyXP || e.flags?.ose?.dutyXP || e.flags?.dutyXP),
        )
        .flatMap((e) => e.changes ?? [])
        .filter((c) => c.key === "system.details.xp.bonus")
        .reduce((sum, c) => sum + (Number(c.value) || 0), 0);

      const restoredSourceBonus = activeAeXpBonus !== 0 ? origBonus - activeAeXpBonus : origBonus;

      resetLogs.push(
        `<b>${esc(actor.name)}:</b> XP bonus reset from ${currentBonus}% back to ${origBonus}% for duty (${duties.join(", ")}).`,
      );
      const updatePayload = {
        "flags.-=dutyXP": null,
        "system.details.xp.bonus": restoredSourceBonus,
      };
      if (actor.flags?.[sysId]?.dutyXP !== undefined) {
        updatePayload[`flags.${sysId}.-=dutyXP`] = null;
      }
      await actor.update(updatePayload);
    }
  }

  if (resetLogs.length > 0) {
    await ChatMessage.create({
      content: `<h2>Duty XP Reset Report</h2>${resetLogs.join("<br/>")}`,
    });
    ui.notifications.info(
      game.i18n.format("OSE.dialog.party.infoDutyReset", { count: resetLogs.length }) ||
        `Reset Duty XP for ${resetLogs.length} character(s).`,
    );
  } else {
    const noDutyMsg = game.i18n?.localize?.("OSE.dialog.party.noDutyActive");
    ui.notifications.info(
      noDutyMsg && noDutyMsg !== "OSE.dialog.party.noDutyActive"
        ? noDutyMsg
        : "No characters currently have active Duty XP.",
    );
  }
};
