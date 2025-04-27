export class OSECombatant extends Combatant {
  static INITIATIVE_VALUE_SLOWED = -789;
  static INITIATIVE_VALUE_DEFEATED = -790;
  static INITIATIVE_VALUE_FAST = 789;

  // ===========================================================================
  // BOOLEAN FLAGS
  // ===========================================================================

  get isCasting() {
    return this.getFlag(game.system.id, "prepareSpell");
  }
  set isCasting(value) {
    this.setFlag(game.system.id, 'prepareSpell', value)
  }
  
  get isSlow() {
    return this.actor.system.isSlow;
  }

  get isDefeated() {
    if (this.defeated)
      return true;
    
    return !this.defeated && (this.actor.system.hp.value === 0)
  }

  get isFast() {
    return !this.isSlow
        && !this.isDefeated
        && (this.actor.system.config.fastCombat || ['Halfling'].includes(this.actor.system.details.class));
  }

  // ===========================================================================
  // INITIATIVE MANAGEMENT
  // ===========================================================================

  getInitiativeRoll(formula: string) {
    let term = formula || CONFIG.Combat.initiative.formula;
    if (this.isFast) term = `${OSECombatant.INITIATIVE_VALUE_FAST}`;
    if (this.isSlow) term = `${OSECombatant.INITIATIVE_VALUE_SLOWED}`;
    if (this.isDefeated) term = `${OSECombatant.INITIATIVE_VALUE_DEFEATED}`;
    const rollData = this.actor?.getRollData() || {};
    return new Roll(term, rollData);
  }

  async getData(options = {}) {
    const context = await super.getData(options);
    return foundry.utils.mergeObject(context, {
      slow: this.isSlow,
      casting: this.isCasting,
      fast: this.isFast
    })
  }
  
}

