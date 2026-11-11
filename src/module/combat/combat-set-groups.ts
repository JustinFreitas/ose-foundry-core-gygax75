import { OSE } from "../config";
import type { OSECombatant } from "./combatant";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

interface HoverableToken {
  isVisible?: boolean;
  controlled?: boolean;
  _onHoverIn?: (event: Event, options?: { hoverOutOthers?: boolean }) => void;
  _onHoverOut?: (event: Event) => void;
}

export default class OSECombatGroupSelector extends HandlebarsApplicationMixin(ApplicationV2) {
  _highlighted: HoverableToken | null = null;

  // ===========================================================================
  // APPLICATION SETUP
  // ===========================================================================
  static override DEFAULT_OPTIONS = {
    id: "combat-set-groups-{id}",
    classes: ["ose", "combat-set-groups"],
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
      height: "auto" as const,
    },
  };

  static override PARTS = {
    main: {
      template: "/systems/__SYSTEM_ID__/dist/templates/apps/combat-set-groups.hbs",
    },
  };

  #getActiveCombatants() {
    return game.combats?.active?.combatants ?? game.combat?.combatants;
  }

  // ===========================================================================
  // RENDER SETUP
  // ===========================================================================

  /** @override */
  protected override _configureRenderOptions(options: Record<string, unknown>) {
    super._configureRenderOptions(options as never);
    if (game.system?.id) {
      OSECombatGroupSelector.PARTS.main.template = `${OSE.systemPath()}/templates/apps/combat-set-groups.hbs`;
    }
  }

  /** @inheritDoc */
  protected override async _prepareContext(
    options: Parameters<InstanceType<typeof ApplicationV2>["_prepareContext"]>[0],
  ) {
    const context = await super._prepareContext(options);
    return Object.assign(context, {
      groups: {
        ...OSE.colors,
        slow: "OSE.items.Slow",
        fast: "OSE.combat.Fast",
      },
      combatants: this.#getActiveCombatants() || [],
    });
  }

  /** @inheritDoc */
  protected override async _onRender(context: Record<string, unknown>, options: Record<string, unknown>) {
    await super._onRender(context as never, options as never);
    const combatants = this.#getActiveCombatants();
    if (!combatants) return;
    for (const li of this.element.querySelectorAll<HTMLLIElement>("[data-combatant-id]")) {
      li.addEventListener("mouseover", this.#onCombatantHoverIn.bind(this));
      li.addEventListener("mouseout", this.#onCombatantHoverOut.bind(this));
    }
    this.element.addEventListener("change", this._updateObject.bind(this));
  }

  // ===========================================================================
  // UPDATING
  // ===========================================================================

  /** @inheritDoc */
  protected async _updateObject(event: Event): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    const input = event.target as HTMLInputElement | null;
    if (!input?.name || !input?.value) return;
    const combatant = this.#getActiveCombatants()?.get(input.name) as OSECombatant | undefined;
    if (!combatant) return;
    await combatant.assignGroup(input.value);
  }

  // ===========================================================================
  // UI EVENTS
  // ===========================================================================

  #onCombatantHoverIn(event: MouseEvent) {
    event.preventDefault();
    if (!canvas?.ready) return;
    const li = event.currentTarget as HTMLLIElement | null;
    const combatantId = li?.dataset?.combatantId;
    if (!combatantId) return;
    const combatant = this.#getActiveCombatants()?.get(combatantId) as OSECombatant | undefined;
    const token = combatant?.token?.object as unknown as HoverableToken | undefined;
    if (token?.isVisible) {
      if (!token.controlled) {
        token._onHoverIn?.(event, { hoverOutOthers: true });
      }
      this._highlighted = token;
    }
  }

  #onCombatantHoverOut(event: MouseEvent) {
    event.preventDefault();
    if (this._highlighted) {
      this._highlighted._onHoverOut?.(event);
    }
    this._highlighted = null;
  }
}
