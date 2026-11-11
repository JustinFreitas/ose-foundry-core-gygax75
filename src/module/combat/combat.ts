/**
 * @file System-level modifications to the way combat works
 */
import { OSE } from "../config";
import OSECombatGroupSelector from "./combat-set-groups";
import { OSECombatant } from "./combatant";

export const actionGroups = {
  slow: "OSE.items.Slow",
  cast: "OSE.spells.Cast",
  fast: "OSE.combat.Fast",
};

interface CombatantLike {
  id: string | null;
  name?: string | null;
  initiative?: number | string | null;
  isDefeated?: boolean;
  isFast?: boolean;
  isSlow?: boolean;
  disposition?: number;
  hasPlayerOwner?: boolean;
  group?: { name?: string | null; initiative?: number | string | null } | string | null;
  system?: { retainer?: { enabled?: boolean } };
  actor?: { system?: { retainer?: { enabled?: boolean } } } | null;
}

function getCombatantGroupObj(
  combatant: CombatantLike,
): { name?: string | null; initiative?: number | string | null } | undefined {
  const grp = combatant.group;
  return typeof grp === "object" && grp !== null ? grp : undefined;
}

/**
 * An extension of Foundry's Combat class that implements initiative for individual combatants.
 *
 * @todo Use a single chat card for rolling group initiative
 */
export class OSECombat extends foundry.documents.Combat {
  static FORMULA = "1d6 + @init";

  static GROUP_FORMULA = "1d6";

  static get GROUPS(): Record<string, string> {
    return {
      ...OSE.colors,
      ...Object.entries(actionGroups).reduce<Record<string, string>>((acc, [key, value]) => {
        acc[key] = game.i18n.localize(value);
        return acc;
      }, {}),
    };
  }

  // Track combatant groups since multiple combatants can trigger group creation
  // at the same time.
  #combatantGroups = new Map<string, Promise<unknown>>();

  get #rerollBehavior() {
    return game.settings.get(game.system.id as "ose", "rerollInitiative");
  }

  /**
   * Returns whether the combat is using group initiative.
   *
   * @returns {boolean} True if the combat is using group initiative, false otherwise.
   */
  get isGroupInitiative(): boolean {
    return game.settings.get(game.system.id as "ose", "initiative") === "group";
  }

  // ===========================================================================
  // INITIATIVE MANAGEMENT
  // ===========================================================================

  /**
   * Roll initiative for all combatants.
   *
   * @param {object} [options={}] - Additional options which modify how initiative rolls are created or presented.
   * @param {boolean} [options.excludeAlreadyRolled=false] - If true, exclude combatants that have already rolled initiative.
   * @param {boolean} [options.updateTurn=false] - Update the Combat turn after adding new initiative scores to
   *                                               keep the turn on the same Combatant.
   * @private
   */
  async #rollAbsolutelyEveryone({ excludeAlreadyRolled = false, updateTurn = false } = {}) {
    const formula = this.isGroupInitiative ? OSECombat.GROUP_FORMULA : OSECombat.FORMULA;
    const ids = this.combatants
      .filter((c) => !c.defeated && (!excludeAlreadyRolled || c.initiative === null))
      .map((c) => c.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    await this.rollInitiative(ids, {
      formula,
      updateTurn,
    });
  }

  /**
   * Reroll initiative for all combatants.
   * If the initiative type is set to "group", reroll initiative for each group.
   *
   * @param {object} [options={}] - Additional options which modify how initiative rolls are created or presented.
   * @param {boolean} [options.excludeAlreadyRolled=false] - If true, exclude combatants that have already rolled initiative.
   * @param {boolean} [options.updateTurn=false] - Update the Combat turn after adding new initiative scores to
   *                                               keep the turn on the same Combatant.
   * @param {boolean} [options.npcOnly=false] - If true, only reroll groups with no player-owned combatants.
   */
  async smartRerollInitiative({ excludeAlreadyRolled = false, updateTurn = false, npcOnly = false } = {}) {
    if (!this.isGroupInitiative) {
      return this.#rollAbsolutelyEveryone({ excludeAlreadyRolled, updateTurn });
    }

    const groups = this.groups.filter(
      (group: CombatantGroup) =>
        group.members.size > 0 &&
        !(excludeAlreadyRolled && group.initiative !== null) &&
        !(npcOnly && group.members.some((c) => c.hasPlayerOwner)),
    );
    return this.rollGroupInitiative(groups);
  }

  /**
   * Roll one initiative per group and post them on a single chat card.
   *
   * @param {CombatantGroup[]} groups - The groups to roll for.
   */
  async rollGroupInitiative(groups: CombatantGroup[]) {
    const toRoll = groups.filter((g) => g.members.size > 0 && !["slow", "fast"].includes(g.name ?? ""));
    if (!toRoll.length) return this;

    if (!this.isOwner) {
      const gm = game.users?.activeGM;
      if (!gm) {
        ui.notifications?.warn("OSE.combat.NoActiveGM", { localize: true });
        return this;
      }
      const queryFn = gm.query as unknown as (key: string, data: Record<string, unknown>) => Promise<unknown>;
      await queryFn.call(gm, `${game.system.id}.rollGroupInitiative`, {
        combatId: this.id,
        groupIds: toRoll.map((g) => g.id),
        userId: game.user?.id,
      });
      return this;
    }

    const rolls: Roll[] = [];
    const updates: Array<{ _id: string | null; initiative: number | undefined }> = [];
    const rows: string[] = [];
    for (const group of toRoll) {
      const roll = await new Roll(OSECombat.GROUP_FORMULA).evaluate();
      rolls.push(roll);
      updates.push({ _id: group.id, initiative: roll.total });
      const label = foundry.utils.escapeHTML(game.i18n.localize(`OSE.colors.${group.name}`));
      const anchor = (await roll.toAnchor()).outerHTML;
      rows.push(
        `<li class="ose-initiative-group" data-group-key="${group.name}"><strong>${label}</strong> ${anchor}</li>`,
      );
    }

    await this.updateEmbeddedDocuments("CombatantGroup", updates);
    await foundry.documents.ChatMessage.implementation.create({
      speaker: { alias: game.i18n.localize("OSE.Initiative") },
      flavor: game.i18n.localize("OSE.roll.individualInitGroup"),
      content: `<ul class="ose-initiative-groups">${rows.join("")}</ul>`,
      rolls,
      sound: CONFIG.sounds.dice,
      flags: { core: { initiativeRoll: true } },
    });
    return this;
  }

  /**
   * Set a group's initiative directly. Null to clear it.
   *
   * @param {CombatantGroup} group - The group to set.
   * @param {number|null} value - The initiative value.
   */
  async setGroupInitiative(group: CombatantGroup, value: number | null): Promise<CombatantGroup | undefined> {
    if (this.isOwner) return group.update({ initiative: value });
    const gm = game.users?.activeGM;
    if (!gm) {
      ui.notifications?.warn("OSE.combat.NoActiveGM", { localize: true });
      return undefined;
    }
    const queryFn = gm.query as unknown as (key: string, data: Record<string, unknown>) => Promise<unknown>;
    const applied = await queryFn.call(gm, `${game.system.id}.rollGroupInitiative`, {
      combatId: this.id,
      groupIds: [group.id],
      userId: game.user?.id,
      value,
    });
    if (!applied) ui.notifications?.warn("OSE.combat.GroupInitiativeRefused", { localize: true });
    return undefined;
  }

  /**
   * GM handler for a player's group initiative roll or manual value.
   *
   * @param {object} data - The query data.
   * @param {object} [context] - Query context; v14 includes the sending user.
   */
  static async handleRollGroupQuery(
    { combatId, groupIds, userId, value }: { combatId: string; groupIds: string[]; userId: string; value?: number },
    context: { user?: User } = {},
  ) {
    const combat = game.combats?.get(combatId) as OSECombat | undefined;
    const user = context.user ?? game.users?.get(userId);
    if (!combat || !user) return false;
    if (value !== undefined && !Number.isInteger(value)) return false;
    const groups = groupIds
      .map((id) => combat.groups.get(id))
      .filter(
        (g): g is CombatantGroup =>
          !!g && g.initiative === null && g.members.some((c) => c.testUserPermission(user, "OWNER")),
      );
    if (value !== undefined) {
      await combat.updateEmbeddedDocuments(
        "CombatantGroup",
        groups.map((g) => ({ _id: g.id, initiative: value })),
      );
    } else await combat.rollGroupInitiative(groups);
    return true;
  }

  /** @override */
  override async rollInitiative(ids: string | string[], options = {}) {
    if (!this.isGroupInitiative) return super.rollInitiative(ids, options);
    const idList = typeof ids === "string" ? [ids] : ids;
    const groups = new Set<CombatantGroup>();
    const loose: string[] = [];
    for (const id of idList) {
      const group = this.combatants.get(id)?.group as CombatantGroup | undefined;
      if (group && !["slow", "fast"].includes(group.name ?? "")) groups.add(group);
      else loose.push(id);
    }
    if (loose.length) await super.rollInitiative(loose, options);
    return this.rollGroupInitiative([...groups]);
  }

  /**
   * Reroll initiative for groups with no player-owned combatants.
   */
  async rerollNPCInitiative() {
    return this.smartRerollInitiative({ npcOnly: true });
  }

  /**
   * Handle updating a combatant group.
   */
  onUpdateCombatantGroup() {
    this.setupTurns();
    this.#renderTracker();
  }

  // Batch group updates into one tracker render.
  #renderTracker = foundry.utils.debounce(() => {
    if (this.isView) ui.combat?.render();
  }, 50);

  /** @override */
  override async rollAll(options?: Combat.InitiativeOptions) {
    await super.rollAll(options);
    // Preserve the fact that it's no-one's turn currently.
    let turn = this.turn === null || this.turns.length === 0 ? null : 0;
    if (this.settings.skipDefeated && turn !== null) {
      turn = this.turns.findIndex((t) => !t.isDefeated);
      if (this.turns.length > 0 && turn === -1) {
        ui.notifications?.warn("COMBAT.NoneRemaining", { localize: true });
        turn = 0;
      }
    }
    await this.update({ turn });
    this.setupTurns();
    await ui.combat?.render({ force: true });
    return this;
  }

  // ===========================================================================
  // COMBAT LIFECYCLE MANAGEMENT
  // ===========================================================================

  /** @override */
  override async startCombat() {
    await super.startCombat();
    if (this.#rerollBehavior !== "reset")
      await this.smartRerollInitiative({
        excludeAlreadyRolled: true,
      });
    this.#warnUnrolled();
    return this;
  }

  /** @override */
  override async nextTurn() {
    this.#warnUnrolled();
    return super.nextTurn();
  }

  /** Warn without blocking when an active combatant has no initiative yet. */
  #warnUnrolled() {
    const unrolled = this.combatants.some((raw) => {
      const c = raw as OSECombatant;
      const groupName = getCombatantGroupObj(c as unknown as CombatantLike)?.name ?? "";
      return !c.isDefeated && !c.isSlow && !c.isFast && !["slow", "fast"].includes(groupName) && c.initiative === null;
    });
    if (unrolled) ui.notifications?.warn("OSE.combat.UnrolledInitiative", { localize: true });
  }

  /**
   * Reset the actions of all combatants in the combat.
   */
  async resetActions() {
    const flags = { [`flags.${game.system.id}.prepareSpell`]: false, [`flags.${game.system.id}.moveInCombat`]: false };
    await this.updateEmbeddedDocuments(
      "Combatant",
      this.combatants.map((c) => ({ _id: c.id, ...flags })),
    );
  }

  /** @override */
  override async _manageTurnEvents() {
    const prevRound = this.previous?.round;
    const currRound = this.current?.round;
    // Re-roll before core picks who starts the round, so turn events go to the new first combatant.
    if (
      game.user?.isActiveGM &&
      this.started &&
      typeof prevRound === "number" &&
      prevRound > 0 &&
      typeof currRound === "number" &&
      currRound > prevRound
    ) {
      const previous = { ...this.previous };
      await this.#onNewRound();
      // v13 overwrites the previous state on combatant updates even without turn events.
      if (this.previous) {
        Object.assign(this.previous, previous);
      }
    }
    return super._manageTurnEvents();
  }

  /**
   * Re-roll or reset initiative and clear combatant actions for a new round.
   */
  async #onNewRound() {
    switch (this.#rerollBehavior) {
      case "reset":
        await this.resetAll({ updateTurn: false } as Combat.Database.UpdateOperation);
        break;

      case "reroll":
        await this.smartRerollInitiative();
        break;
      default:
        break;
    }
    await this.resetActions();
  }

  /** @override */
  override async resetAll(options?: Combat.Database.UpdateOperation) {
    await (super.resetAll as (opts?: Combat.Database.UpdateOperation) => Promise<this>).call(this, options);

    if (this.isGroupInitiative) {
      const groupUpdates = this.groups.map((g: CombatantGroup) => ({
        _id: g.id,
        initiative: null,
      }));

      if (groupUpdates.length > 0) {
        await this.updateEmbeddedDocuments("CombatantGroup", groupUpdates);
      }
    }

    return this;
  }

  /**
   * Activate the given combatant within the combat.
   *
   * @param {number} turn - The turn number of the combatant to activate.
   */
  async activateCombatant(turn: number) {
    if (game.user?.isGM) {
      await this.update({ turn });
    }
  }

  /**
   * Assign a combatant to a group, creating the group if it doesn't exist.
   * This method prevents multiple groups being created due to the async nature
   * of Foundry VTT.
   *
   * @param {OSECombatant} combatant - The combatant to assign to the group.
   * @param {string} groupName - The name of the group to assign the combatant to.
   */
  async assignGroup(combatant: OSECombatant, groupName: string) {
    if (!groupName) {
      return;
    }

    if (!this.groups.some((g: CombatantGroup) => g.name === groupName)) {
      if (!this.#combatantGroups.has(groupName)) {
        const groupCreation = this.createEmbeddedDocuments("CombatantGroup", [{ name: groupName, initiative: null }]);
        this.#combatantGroups.set(
          groupName,
          groupCreation.finally(() => this.#combatantGroups.delete(groupName)),
        );
      }
      await this.#combatantGroups.get(groupName);
    }

    const group = this.groups.find((g: CombatantGroup) => g.name === groupName);
    if (!group) {
      return;
    }
    await combatant.update({ group: group.id } as unknown as Combatant.UpdateData);
  }

  /**
   * Determine which group each combatant should be added to, or if a new group should be created.
   */
  async createGroups() {
    for (const rawCombatant of this.combatants) {
      const combatant = rawCombatant as OSECombatant;
      if (combatant.group) continue;

      const key = combatant.groupRaw;
      if (!key) continue;

      await this.assignGroup(combatant, key);
    }

    return this.groups;
  }

  /**
   * Prompts to set the combatant groups.
   */
  setCombatantGroups() {
    new OSECombatGroupSelector().render({ force: true });
  }

  /** @override */
  override _sortCombatants(a: Combatant.Implementation, b: Combatant.Implementation): number {
    const ca = a as unknown as CombatantLike;
    const cb = b as unknown as CombatantLike;

    // First sort by initiative
    const ia = OSECombat.getInitiativeForCombatant(ca as unknown as OSECombatant);
    const ib = OSECombat.getInitiativeForCombatant(cb as unknown as OSECombatant);
    if (ia !== ib) {
      return ib - ia;
    }

    // If still tied, sort by group name if available
    const groupNameA = getCombatantGroupObj(ca)?.name;
    const groupNameB = getCombatantGroupObj(cb)?.name;
    if (groupNameA && groupNameB && groupNameA !== groupNameB) {
      // Fast groups always sort first, slow groups always sort last.
      // Use an explicit rank so the comparator stays transitive.
      const groupRank = (name: string) => (name === "fast" ? -1 : name === "slow" ? 1 : 0);
      const rankDiff = groupRank(groupNameA) - groupRank(groupNameB);
      if (rankDiff !== 0) return rankDiff;

      const colorsKeys = Object.keys(OSECombat.GROUPS);
      const indexA = colorsKeys.indexOf(groupNameA);
      const indexB = colorsKeys.indexOf(groupNameB);

      const colorDiff = indexA - indexB;
      if (colorDiff !== 0) return colorDiff;
    }

    // If still tied, sort by disposition
    // Higher values of CONST.TOKEN_DISPOSITIONS are sorted first (e.g. Friendly).
    const dispositionA = ca.disposition ?? CONST.TOKEN_DISPOSITIONS.NEUTRAL;
    const dispositionB = cb.disposition ?? CONST.TOKEN_DISPOSITIONS.NEUTRAL;
    if (dispositionA !== dispositionB) {
      // Return negative to prioritize higher disposition values
      return dispositionB - dispositionA;
    }

    // If still tied, sort by player ownership and retainer status together
    // Player-owned combatants come before non-player-owned ones
    const ownerA = Boolean(ca.hasPlayerOwner);
    const ownerB = Boolean(cb.hasPlayerOwner);
    if (ownerA !== ownerB) {
      return ownerA ? -1 : 1;
    }
    const isRetainerA = Boolean(ca.system?.retainer?.enabled ?? ca.actor?.system?.retainer?.enabled);
    const isRetainerB = Boolean(cb.system?.retainer?.enabled ?? cb.actor?.system?.retainer?.enabled);
    if (ownerA && ownerB) {
      // Both are player-owned, sort non-retainers first
      if (isRetainerA !== isRetainerB) {
        return isRetainerA ? 1 : -1;
      }
    } else if (!ownerA && !ownerB) {
      // For non-player owned, sort retainers before non-retainers
      if (isRetainerA !== isRetainerB) {
        return isRetainerA ? -1 : 1;
      }
    }

    if (ca.name && ca.name === cb.name) {
      const idA = ca.id ?? "";
      const idB = cb.id ?? "";
      if (idA !== idB) {
        return idA > idB ? 1 : -1;
      }
    }

    return (ca.name || "").localeCompare(cb.name || "");
  }

  static getInitiativeForCombatant(combatant: OSECombatant): number {
    const c = combatant as unknown as CombatantLike;
    if (c.isDefeated) return OSECombatant.INITIATIVE_VALUE_DEFEATED;

    const groupObj = getCombatantGroupObj(c);
    const groupName = groupObj?.name;
    if (c.isSlow || groupName === "slow") return OSECombatant.INITIATIVE_VALUE_SLOW;
    if (c.isFast || groupName === "fast") return OSECombatant.INITIATIVE_VALUE_FAST;

    // Foundry stores `initiative` as a number/string (or null when not yet rolled).
    const raw = c.initiative ?? groupObj?.initiative;
    if (raw === null || raw === undefined || raw === "") {
      return Number.NEGATIVE_INFINITY;
    }
    const init = Number(raw);
    return Number.isNaN(init) ? Number.NEGATIVE_INFINITY : init;
  }
}
