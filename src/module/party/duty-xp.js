/**
 * @file Duty XP helper functions.
 */

/**
 * Resets temporary Duty XP bonuses (+5%) for specified actors (or all actors with active duty XP).
 * @param {Array<OseActor>} [targetActors=null] - Actors to reset. If null, resets all actors with active dutyXP flags.
 */
export const resetDutyXP = async (targetActors = null) => {
  const actorsToReset = targetActors || game.actors.filter((a) => a.flags?.dutyXP);
  const resetLogs = [];

  for (const actor of actorsToReset) {
    if (actor.flags?.dutyXP?.origXpBonus !== undefined) {
      const origBonus = actor.flags.dutyXP.origXpBonus;
      const duties = actor.flags.dutyXP.duties || [];
      const currentBonus = actor.system.details?.xp?.bonus ?? 0;
      resetLogs.push(
        `<b>${actor.name}:</b> XP bonus reset from ${currentBonus}% back to ${origBonus}% for duty (${duties.join(", ")}).`,
      );
      await actor.update({
        "flags.-=dutyXP": null,
        "system.details.xp.bonus": origBonus,
      });
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
    ui.notifications.info("No characters currently have active Duty XP.");
  }
};
