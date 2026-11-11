/**
 * @file A collection of helper utils for chat cards
 */

import type { OseContextMenuEntry } from "../global";
import OseActor from "./actor/entity";
import { contextMenuEntry } from "./context-menu-entry";

interface DamageAttackContext {
  weapon?: Item | null;
  ammo?: Item | null;
}

interface AttackerActorLike {
  items?: {
    get?: (id: string) => Item | undefined;
  };
}

interface CanvasTokensLike {
  get?: (id: string) => unknown;
  controlled?: Array<{ actor: Actor | OseActor | null; name: string }>;
}

function getCanvasTokens(): CanvasTokensLike | undefined {
  return (globalThis as { canvas?: { tokens?: CanvasTokensLike } }).canvas?.tokens;
}

/**
 * Resolve attacker weapon and ammo items from a rendered `.item-card` chat element.
 */
function resolveAttackContextFromCard(html: HTMLElement): DamageAttackContext {
  const card = (html.matches?.(".item-card") ? html : html.querySelector<HTMLElement>(".item-card")) ?? null;
  if (!card) return {};

  const { tokenId, actorId, itemId, ammoId } = card.dataset;
  if (!itemId && !ammoId) return {};

  let attacker: AttackerActorLike | null = null;
  const canvasTokens = getCanvasTokens();

  if (tokenId) {
    if (tokenId.includes(".") && !tokenId.startsWith("Scene.") && !tokenId.startsWith("Actor.")) {
      const [sceneId, tokId] = tokenId.split(".");
      if (sceneId && tokId) {
        const sceneToken = game.scenes?.get?.(sceneId)?.tokens?.get?.(tokId) as
          | { actor?: AttackerActorLike }
          | undefined;
        attacker = sceneToken?.actor ?? null;
        if (!attacker && typeof fromUuidSync === "function") {
          const resolved = fromUuidSync(`Scene.${sceneId}.Token.${tokId}`) as { actor?: AttackerActorLike } | null;
          attacker = resolved?.actor ?? null;
        }
        if (!attacker) {
          const canvasToken = canvasTokens?.get?.(tokId) as { actor?: AttackerActorLike } | undefined;
          attacker = canvasToken?.actor ?? null;
        }
      }
    } else {
      if (typeof fromUuidSync === "function") {
        const resolved = fromUuidSync(tokenId) as ({ actor?: AttackerActorLike } & AttackerActorLike) | null;
        attacker = resolved?.actor ?? (resolved?.items ? resolved : null);
      }
      if (!attacker) {
        const canvasToken = canvasTokens?.get?.(tokenId) as { actor?: AttackerActorLike } | undefined;
        attacker = canvasToken?.actor ?? null;
      }
    }
  }

  if (!attacker && actorId) {
    attacker = (game.actors?.get?.(actorId) as unknown as AttackerActorLike | undefined) ?? null;
  }

  if (!attacker?.items?.get) return {};

  const rawItem = itemId ? attacker.items.get(itemId) : undefined;
  const itemType = (rawItem as { type?: string } | undefined)?.type;
  const weapon = rawItem && itemType !== "spell" && itemType !== "ability" ? rawItem : undefined;
  const ammo = ammoId ? attacker.items.get(ammoId) : undefined;

  return { weapon, ammo };
}

/**
 * Apply damage to a target actor
 *
 * @param {Actor | null} actor - The target actor to apply damage to
 * @param {string} amount - The amount of damage to apply
 * @param {1 | -1} multiplier - The multiplier to apply to the damage
 * @param {string} nameOrId - The name or ID of the target actor
 * @param {DamageAttackContext} [attackContext] - Optional weapon/ammo context from the attack card
 */
async function applyDamageToTarget(
  actor: Actor | OseActor | null | undefined,
  amount: string,
  multiplier: 1 | -1,
  nameOrId: string,
  attackContext?: DamageAttackContext,
) {
  if (!game.user?.isGM || !(actor instanceof OseActor)) {
    ui.notifications?.error(game.i18n.format("OSE.error.cantDealDamageTo", { nameOrId }));
    return;
  }
  if (multiplier > 0) {
    const finalAmount = Math.floor(Number.parseInt(amount, 10) * multiplier);
    const options =
      attackContext && (attackContext.weapon || attackContext.ammo)
        ? { weapon: attackContext.weapon ?? null, ammo: attackContext.ammo ?? null }
        : {};
    await actor.applyDamage(finalAmount, 1, options);
    return;
  }
  await actor.applyDamage(amount, multiplier);
}

/**
 * Apply rolled dice damage to the token or tokens which are currently controlled.
 * This allows for damage to be scaled by a multiplier to account for healing, critical hits, or resistance
 *
 * @param {HTMLElement} html - The chat entry which contains the roll data
 * @param {number} multiplier - A damage multiplier to apply to the rolled damage.
 */
async function applyChatCardDamage(html: HTMLElement, multiplier: 1 | -1) {
  const diceTotalTargets = html.querySelectorAll(".dice-total");
  const lastDiceTotalTarget = diceTotalTargets[diceTotalTargets.length - 1] as HTMLElement | undefined;
  const amount = lastDiceTotalTarget?.textContent?.trim() || "0";
  const dmgTgt = game.settings.get(game.system.id as "ose", "applyDamageOption");
  const attackContext = multiplier > 0 ? resolveAttackContextFromCard(html) : undefined;

  if (dmgTgt === CONFIG.OSE.apply_damage_options.originalTarget) {
    const victimId = html.querySelector<HTMLElement>(".chat-target")?.dataset.id;
    const resolved = victimId ? await fromUuid(victimId) : null;
    const actor =
      resolved instanceof OseActor ? resolved : ((resolved as { actor?: Actor | null } | null)?.actor ?? null);
    await applyDamageToTarget(actor, amount, multiplier, actor?.name || victimId || "original target", attackContext);
  }
  if (dmgTgt === CONFIG.OSE.apply_damage_options.targeted) {
    const targets = game.user?.targets ? [...game.user.targets] : [];
    for (const t of targets) {
      await applyDamageToTarget(t.actor, amount, multiplier, t.name, attackContext);
    }
  }
  if (dmgTgt === CONFIG.OSE.apply_damage_options.selected) {
    const controlled = getCanvasTokens()?.controlled ?? [];
    for (const t of controlled) {
      await applyDamageToTarget(t.actor, amount, multiplier, t.name, attackContext);
    }
  }
}

/**
 * Check if the chat card can apply damage
 *
 * @param {HTMLElement} html - The chat card HTML element
 */
function canApplyDamage(html: HTMLElement) {
  if (!game.user?.isGM) return false;

  if (!html.querySelector(".dice-total")) return false;
  const applyDamageOption = game.settings.get(game.system.id as "ose", "applyDamageOption");
  switch (applyDamageOption) {
    case CONFIG.OSE.apply_damage_options.originalTarget: {
      const chatTargets = html.querySelectorAll(".chat-target");
      const lastChatTarget = chatTargets[chatTargets.length - 1] as HTMLElement | undefined;
      return !!lastChatTarget?.dataset.id;
    }

    case CONFIG.OSE.apply_damage_options.targeted:
      return !!game.user?.targets?.size;

    case CONFIG.OSE.apply_damage_options.selected:
      return !!getCanvasTokens()?.controlled?.length;

    default:
      ui.notifications?.error(
        game.i18n.format("OSE.error.unexpectedSettings", {
          configName: "applyDamageOption",
          configValue: String(applyDamageOption),
        }),
      );
      return false;
  }
}

const canApply: OseContextMenuEntry["condition"] = (li) => canApplyDamage(li);

/**
 * This function is used to hook into the Chat Log context menu to add additional options to each message
 * These options make it easy to conveniently apply damage to controlled tokens based on the value of a Roll
 *
 * @param {HTMLElement} _ - Unused chat log element
 * @param {Array} options - The list of context menu options
 * @returns {Array}
 */
export const addChatMessageContextOptions = (_: HTMLElement, options: OseContextMenuEntry[]) => {
  const applyDamageLabel = game.i18n.localize("OSE.messages.applyDamage");
  const applyHealingLabel = game.i18n.localize("OSE.messages.applyHealing");
  const hasEntry = (label: string) =>
    options.some((entry) => {
      const rec = entry as unknown as { name?: string; label?: string };
      return rec.name === label || rec.label === label;
    });

  if (!hasEntry(applyDamageLabel)) {
    options.push(
      contextMenuEntry({
        label: applyDamageLabel,
        icon: '<i class="fas fa-user-minus"></i>',
        visible: canApply,
        onClick: (li) => {
          void applyChatCardDamage(li, 1);
        },
      }),
    );
  }
  if (!hasEntry(applyHealingLabel)) {
    options.push(
      contextMenuEntry({
        label: applyHealingLabel,
        icon: '<i class="fas fa-user-plus"></i>',
        visible: canApply,
        onClick: (li) => {
          void applyChatCardDamage(li, -1);
        },
      }),
    );
  }
  return options;
};

/* -------------------------------------------- */

export const addChatMessageButtons = (msg: ChatMessage, html: HTMLElement) => {
  // Hide blind rolls
  const blindable = html.querySelector<HTMLElement>(".blindable");
  const isBlind = Boolean((msg as unknown as { blind?: boolean } | null)?.blind);
  if (isBlind && !game.user?.isGM && blindable && blindable.dataset.blind === "true") {
    blindable.outerHTML =
      "<div class='dice-roll'><div class='dice-result'><div class='dice-formula'>???</div></div></div>";
  }
  // Buttons
  const roll = html.querySelector(".damage-roll");
  if (roll && canApplyDamage(html)) {
    const diceDamageDiv = document.createElement("div");
    diceDamageDiv.className = "dice-damage";

    const button = document.createElement("button");
    button.type = "button";
    button.dataset.action = "apply-damage";
    button.innerHTML = '<i class="fas fa-tint"></i>';

    diceDamageDiv.append(button);
    roll.append(diceDamageDiv);

    button.addEventListener("click", (ev) => {
      ev.preventDefault();
      void applyChatCardDamage(html, 1);
    });
  }
};

export const functionsForTesting = {
  applyChatCardDamage,
};
