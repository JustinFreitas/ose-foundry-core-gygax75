import { OSE } from "../config";
import type { OSECombatant } from "./combatant";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export default class OSECombatGroupSelector extends HandlebarsApplicationMixin(ApplicationV2) {
  _highlighted;

  #changeListenerBound = false;

  // ===========================================================================
  // APPLICATION SETUP
  // ===========================================================================
  static DEFAULT_OPTIONS = {
    id: "combat-set-groups-{id}",
    classes: ["combat-set-groups"],
    tag: "form",
    window: {
      frame: true,
      positioned: true,
      title: "OSE.combat.SetCombatantGroups",
      icon: "fa-solid fa-flag",
      controls: [],
      minimizable: false,
      resizable: true,
      contentTag: "section",
      contentClasses: [],
    },
    actions: {},
    form: {
      handler: undefined,
      submitOnChange: true,
    },
    position: {
      width: 600,
      height: "auto",
    },
  };

  static PARTS = {
    main: {
      // Lazy getter: resolves the system path at render time rather than
      // hardcoding the system id at module load.
      get template() {
        return `${OSE.systemPath()}/templates/apps/combat-set-groups.hbs`;
      },
    },
  };

  // ===========================================================================
  // RENDER SETUP
  // ===========================================================================

  /** @inheritDoc */
  async _prepareContext(_options) {
    return {
      groups: OSE.colors,
      combatants: game.combat?.combatants || [],
    };
  }

  /** @inheritDoc */
  _onRender(context, options) {
    super._onRender(context, options);
    for (const li of this.element.querySelectorAll("[data-combatant-id]")) {
      li.addEventListener("mouseover", this.#onCombatantHoverIn.bind(this));
      li.addEventListener("mouseout", this.#onCombatantHoverOut.bind(this));
    }
    // The root element survives re-renders; bind the delegated listener once.
    if (!this.#changeListenerBound) {
      this.element.addEventListener("change", this._updateObject);
      this.#changeListenerBound = true;
    }
  }

  // ===========================================================================
  // UPDATING
  // ===========================================================================

  /** @inheritDoc */
  protected async _updateObject(event: Event): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    const input = event.target as HTMLInputElement;
    if (!input?.name || !input?.value) return;
    const combatant = game.combat?.combatants.get(input.name) as OSECombatant;
    if (!combatant) return;
    await combatant.assignGroup(input.value);
  }

  // ===========================================================================
  // UI EVENTS
  // ===========================================================================

  #onCombatantHoverIn(event: PointerEvent) {
    event.preventDefault();
    if (!canvas.ready) return;
    const li = event.currentTarget as HTMLLIElement;
    const { combatantId } = li.dataset;
    if (!combatantId) return;
    const combatant = game.combat?.combatants.get(combatantId) as OSECombatant;
    const token = combatant.token?.object as Token;
    if (token?.isVisible) {
      if (!token.controlled) {
        token._onHoverIn(event, { hoverOutOthers: true });
      }
      this._highlighted = token;
    }
  }

  #onCombatantHoverOut(event: PointerEvent) {
    event.preventDefault();
    if (this._highlighted) {
      this._highlighted._onHoverOut(event);
    }
    this._highlighted = null;
  }
}
