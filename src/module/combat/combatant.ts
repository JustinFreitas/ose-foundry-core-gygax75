interface FlagBearer {
  getFlag(scope: string, key: string): unknown;
  setFlag(scope: string, key: string, value: unknown): Promise<unknown>;
}

interface OseCombatantActorSystem {
  isSlow?: boolean;
  hp?: { value?: number };
  config?: { fastCombat?: boolean };
  details?: { class?: string };
  race?: { name?: string };
  retainer?: { enabled?: boolean };
}

interface NamedGroup {
  name?: string;
}

export class OSECombatant extends Combatant {
  static INITIATIVE_VALUE_SLOW = -789;
  static INITIATIVE_VALUE_SLOWED = -789;
  static INITIATIVE_VALUE_DEFEATED = -790;
  static INITIATIVE_VALUE_FAST = 789;

  get #actorSystem(): OseCombatantActorSystem | undefined {
    return this.actor?.system as OseCombatantActorSystem | undefined;
  }

  get #assignedGroupName(): string | undefined {
    const grp = this.group as unknown;
    return typeof grp === "object" && grp !== null ? (grp as NamedGroup).name : undefined;
  }

  // ===========================================================================
  // BOOLEAN FLAGS
  // ===========================================================================

  get isCasting(): boolean {
    return Boolean((this as unknown as FlagBearer).getFlag(game.system.id, "prepareSpell"));
  }

  set isCasting(value: boolean) {
    void (this as unknown as FlagBearer).setFlag(game.system.id, "prepareSpell", value);
  }

  get isSlow(): boolean {
    return Boolean(this.#actorSystem?.isSlow);
  }

  /** Token disposition, falling back to the actor's prototype token. */
  get disposition(): number | undefined {
    return this.token?.disposition ?? this.actor?.prototypeToken?.disposition;
  }

  override get isDefeated(): boolean {
    if (this.defeated) return true;

    return (this.#actorSystem?.hp?.value ?? 1) <= 0;
  }

  get isFast(): boolean {
    if (this.isSlow || this.isDefeated) return false;
    if (this.#actorSystem?.config?.fastCombat) return true;
    // Auto-detect halflings (case-insensitive, tolerant of values like "Halfling" or "Halfling Sheriff").
    const actorClass = this.#actorSystem?.details?.class;
    if (typeof actorClass === "string" && actorClass.toLowerCase().includes("halfling")) return true;
    const actorRace = this.#actorSystem?.race?.name;
    if (typeof actorRace === "string" && actorRace.toLowerCase().includes("halfling")) return true;
    return false;
  }

  // ===========================================================================
  // INITIATIVE MANAGEMENT
  // ===========================================================================

  override getInitiativeRoll(formula?: string) {
    let term = formula || CONFIG.Combat.initiative.formula || "1d6";
    const groupName = this.#assignedGroupName;
    if (this.isFast || groupName === "fast") term = `${OSECombatant.INITIATIVE_VALUE_FAST}`;
    if (this.isSlow || groupName === "slow") term = `${OSECombatant.INITIATIVE_VALUE_SLOW}`;
    if (this.isDefeated) term = `${OSECombatant.INITIATIVE_VALUE_DEFEATED}`;
    const rollData = this.actor?.getRollData() || {};
    return new Roll(term, rollData);
  }

  async getData(options: Record<string, unknown> = {}) {
    const superGetData = (
      Combatant.prototype as unknown as {
        getData?: (opts?: Record<string, unknown>) => Promise<Record<string, unknown>>;
      }
    ).getData;
    const context = superGetData ? await superGetData.call(this, options) : {};
    return foundry.utils.mergeObject(context, {
      slow: this.isSlow,
      casting: this.isCasting,
      fast: this.isFast,
    });
  }

  /**
   * Assign this combatant to a group.
   *
   * @param {string} [group=""] - The name of the group to assign this combatant to. If empty, the group will be automatically determined.
   */
  async assignGroup(group = "") {
    const targetGroup = group || this.groupRaw;

    if (this.#assignedGroupName === targetGroup) {
      return;
    }

    const combat = this.combat as {
      assignGroup?: (combatant: OSECombatant, groupName: string) => Promise<void>;
    } | null;
    await combat?.assignGroup?.(this, targetGroup);
  }

  /**
   * Key for the group to which this combatant should belong.
   *
   * @returns {string} - The group key for this combatant.
   */
  get groupRaw(): string {
    const assignedGroup = this.#assignedGroupName;
    if (assignedGroup) {
      return assignedGroup;
    }

    if (this.isSlow) {
      return "slow";
    }

    if (this.isFast) {
      return "fast";
    }

    switch (this.disposition) {
      case CONST.TOKEN_DISPOSITIONS.HOSTILE:
        return "red";
      case CONST.TOKEN_DISPOSITIONS.NEUTRAL:
        return "purple";
      case CONST.TOKEN_DISPOSITIONS.FRIENDLY:
        return "green";
      default:
        return "white";
    }
  }
}
