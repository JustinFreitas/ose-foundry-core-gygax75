/**
 * Tactical Combat Hooks for Gygax '75:
 * - Healing inhibition warning when healing an actor with active Poisoned / Diseased effects.
 * - Extra attack notification banner on attack rolls for actors under Haste / Speed effects.
 */

export interface TacticalEffectLike {
  name?: string | null;
  disabled?: boolean;
  isSuppressed?: boolean;
  flags?: {
    ose?: {
      preventsHealing?: boolean;
      isSpeedOfHeroes?: boolean;
      isHasted?: boolean;
      isSpeed?: boolean;
    };
  };
}

interface EffectCollectionLike {
  contents?: TacticalEffectLike[];
  values?: () => Iterable<TacticalEffectLike>;
}

export interface TacticalActorLike {
  name?: string | null;
  system?: {
    hp?: {
      value?: number;
      max?: number;
    };
  };
  appliedEffects?: TacticalEffectLike[] | EffectCollectionLike | Iterable<TacticalEffectLike> | null;
  effects?: TacticalEffectLike[] | EffectCollectionLike | Iterable<TacticalEffectLike> | null;
}

export interface TacticalChatMessageLike {
  speaker?: Record<string, unknown> | null;
  flavor?: string | null;
  title?: string | null;
  content?: string | null;
  flags?: {
    ose?: {
      rollType?: string;
      roll?: string;
      type?: string;
    };
  };
  updateSource?: (changes: { content: string }) => void;
}

function sanitizeHtmlFallback(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function escapeHtml(text: string): string {
  const utils = (foundry as unknown as { utils?: { escapeHTML?: (value: string) => string } }).utils;
  if (typeof utils?.escapeHTML === "function") {
    const escaped = utils.escapeHTML(text);
    if (escaped !== text || !/[&<>"']/.test(text)) {
      return escaped;
    }
  }
  return sanitizeHtmlFallback(text);
}

function getPropertyValue(target: unknown, path: string): unknown {
  const utils = (foundry as unknown as { utils?: { getProperty?: (obj: unknown, key: string) => unknown } }).utils;
  if (typeof utils?.getProperty === "function") {
    return utils.getProperty(target, path);
  }
  if (!target || typeof target !== "object") return undefined;
  return path.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object" && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, target);
}

export function getActorEffects(actor: TacticalActorLike | null | undefined): TacticalEffectLike[] {
  const source = actor?.appliedEffects ?? actor?.effects;
  if (!source) return [];
  if (Array.isArray(source)) return source;
  const collection = source as EffectCollectionLike;
  if (Array.isArray(collection.contents)) return collection.contents;
  if (typeof collection.values === "function") return Array.from(collection.values());
  if (typeof (source as Iterable<TacticalEffectLike>)[Symbol.iterator] === "function") {
    return Array.from(source as Iterable<TacticalEffectLike>);
  }
  return [];
}

function hasCondition(
  actor: TacticalActorLike | null | undefined,
  predicate: (effect: TacticalEffectLike) => boolean,
): boolean {
  return getActorEffects(actor).some((effect) => !effect.disabled && !effect.isSuppressed && predicate(effect));
}

/**
 * Warns in chat when an actor with active Poison or Disease effects receives healing (HP increase).
 */
export function handlePreUpdateActorHealing(
  actor: TacticalActorLike,
  updateData: Record<string, unknown>,
  _options?: unknown,
  userId?: string,
): void {
  const rawHpChange = getPropertyValue(updateData, "system.hp.value");
  if (typeof rawHpChange !== "number") return;

  const oldHp = actor.system?.hp?.value ?? 0;
  const hpIncrease = rawHpChange - oldHp;
  if (hpIncrease <= 0) return;

  // Ignore max-HP increases (e.g. level-up or starting HP rolls) where max HP increases by at least the HP gain.
  const rawNewMax = getPropertyValue(updateData, "system.hp.max");
  if (typeof rawNewMax === "number") {
    const oldMax = actor.system?.hp?.max ?? 0;
    if (rawNewMax > oldMax && rawNewMax - oldMax >= hpIncrease) {
      return;
    }
  }

  const preventsHealing = hasCondition(
    actor,
    (e) =>
      Boolean(e.flags?.ose?.preventsHealing) ||
      (typeof e.name === "string" && /\b(poison|poisoned|disease|diseased)\b/i.test(e.name)),
  );

  if (preventsHealing) {
    const users = (game as unknown as { users?: { get?: (id?: string) => { name?: string } | undefined } }).users;
    const user = userId && users?.get ? users.get(userId) : undefined;
    const userName = escapeHtml(user?.name || "A player");
    const actorName = escapeHtml(actor.name || "Unknown");

    const chatMessageApi = ChatMessage as unknown as { create: (data: { content: string }) => unknown };
    chatMessageApi.create({
      content: `<div class="ose chat-card">
        <h3>⚠️ Healing Warning</h3>
        <p><b>${actorName}</b> HP was modified from <b>${oldHp}</b> to <b>${rawHpChange}</b> by <i>${userName}</i>, but this character has an active <b>Poisoned / Diseased</b> effect preventing healing!</p>
      </div>`,
    });
  }
}

/**
 * Appends an Extra Attack banner callout when an actor under Haste or Speed of the Heroes rolls an attack.
 */
export function handlePreCreateChatMessageSpeed(
  message: TacticalChatMessageLike,
  data?: { content?: string | null },
  _options?: unknown,
  _userId?: string,
): void {
  const speaker = message.speaker;
  if (!speaker) return;

  const chatMessageApi = ChatMessage as unknown as {
    getSpeakerActor?: (spk: Record<string, unknown>) => TacticalActorLike | null | undefined;
  };
  const actor = chatMessageApi.getSpeakerActor ? chatMessageApi.getSpeakerActor(speaker) : null;
  if (!actor) return;

  const hasSpeed = hasCondition(
    actor,
    (e) =>
      Boolean(e.flags?.ose?.isSpeedOfHeroes || e.flags?.ose?.isHasted || e.flags?.ose?.isSpeed) ||
      (typeof e.name === "string" &&
        (/\b(haste|hasted|speed of the heroes|potion of speed)\b/i.test(e.name) ||
          (/\bspeed\b/i.test(e.name) && !/(reduced|half|slow|quarter)/i.test(e.name)))),
  );

  if (!hasSpeed) return;

  const oseFlags = message.flags?.ose;
  const explicitType = oseFlags?.rollType ?? oseFlags?.roll ?? oseFlags?.type;
  const flavorStr = message.flavor || message.title || "";
  const isSave = explicitType === "save" || /\bsave\b/i.test(flavorStr);
  const isAttack =
    !isSave && (explicitType === "attack" || (explicitType === undefined && /\battack\b/i.test(flavorStr)));

  if (isAttack) {
    const contentStr =
      typeof message.content === "string" && message.content.length > 0
        ? message.content
        : (data?.content ?? message.content ?? "");
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
  const hooksApi = Hooks as unknown as {
    on: (hook: string, fn: (...args: never[]) => void) => unknown;
  };
  hooksApi.on("preUpdateActor", handlePreUpdateActorHealing as (...args: never[]) => void);
  hooksApi.on("preCreateChatMessage", handlePreCreateChatMessageSpeed as (...args: never[]) => void);
}
