/**
 * Tactical Combat Hooks for Gygax '75:
 * - Healing inhibition warning when healing an actor with active Poisoned / Diseased effects.
 * - Extra attack notification banner on attack rolls for actors under Haste / Speed effects.
 */

export function getActorEffects(actor: any): any[] {
  if (!actor?.effects) return [];
  if (Array.isArray(actor.effects)) return actor.effects;
  if (actor.effects.contents) return actor.effects.contents;
  if (typeof actor.effects.values === "function") return Array.from(actor.effects.values());
  return Array.from(actor.effects);
}

/**
 * Warns in chat when an actor with active Poison or Disease effects receives healing (HP increase).
 */
export function handlePreUpdateActorHealing(actor: any, updateData: any, _options?: any, userId?: string): void {
  const hpChange = (foundry as any).utils.getProperty(updateData, "system.hp.value");
  if (hpChange === undefined) return;

  const oldHp = actor.system?.hp?.value ?? 0;
  if (hpChange <= oldHp) return;

  const effects = getActorEffects(actor);
  const preventsHealing = effects.some(
    (e: any) =>
      !e.disabled &&
      (Boolean(e.flags?.ose?.preventsHealing) ||
        (typeof e.name === "string" && /\b(poison|poisoned|disease|diseased)\b/i.test(e.name))),
  );

  if (preventsHealing) {
    const user = (game as any).users?.get ? (game as any).users.get(userId) : null;
    const userName = user?.name || "A player";
    const actorName = actor.name || "Unknown";

    (ChatMessage as any).create({
      content: `<div class="ose chat-card">
        <h3>⚠️ Healing Warning</h3>
        <p><b>${actorName}</b> HP was modified from <b>${oldHp}</b> to <b>${hpChange}</b> by <i>${userName}</i>, but this character has an active <b>Poisoned / Diseased</b> effect preventing healing!</p>
      </div>`,
    });
  }
}

/**
 * Appends an Extra Attack banner callout when an actor under Haste or Speed of the Heroes rolls an attack.
 */
export function handlePreCreateChatMessageSpeed(message: any, data: any, _options?: any, _userId?: string): void {
  const speaker = message.speaker;
  if (!speaker) return;

  const actor = (ChatMessage as any).getSpeakerActor ? (ChatMessage as any).getSpeakerActor(speaker) : null;
  if (!actor) return;

  const effects = getActorEffects(actor);
  const hasSpeed = effects.some(
    (e: any) =>
      !e.disabled &&
      (Boolean(e.flags?.ose?.isSpeedOfHeroes || e.flags?.ose?.isHasted || e.flags?.ose?.isSpeed) ||
        (typeof e.name === "string" &&
          (/\b(haste|hasted|speed of the heroes|potion of speed)\b/i.test(e.name) ||
            (/\bspeed\b/i.test(e.name) && !/(reduced|half|slow|quarter)/i.test(e.name))))),
  );

  if (!hasSpeed) return;

  const flavorStr = message.flavor || message.title || "";
  const isAttack =
    message.flags?.ose?.rollType === "attack" ||
    message.flags?.ose?.roll === "attack" ||
    message.flags?.ose?.type === "attack" ||
    flavorStr.toLowerCase().includes("attack");

  if (isAttack) {
    const contentStr = data?.content || message.content || "";
    if (contentStr.includes("ose-hasted-note") || contentStr.includes("Extra Attack:")) return;
    const hastedNote = `<div class="ose-hasted-note" style="margin-top: 4px; padding: 4px 8px; background: #fff8dc; border: 1px solid #d4af37; border-radius: 4px; color: #5a3e1b; font-size: 0.85em; text-align: center;">⚡ <b>Extra Attack:</b> Character may make an additional attack this round!</div>`;

    if (typeof message.updateSource === "function") {
      message.updateSource({ content: contentStr + hastedNote });
    } else {
      message.content = contentStr + hastedNote;
    }
  }
}

/**
 * Registers tactical combat hooks for OSE Gygax '75.
 */
export function registerTacticalCombatHooks(): void {
  (Hooks as any).on("preUpdateActor", handlePreUpdateActorHealing);
  (Hooks as any).on("preCreateChatMessage", handlePreCreateChatMessageSpeed);
}
