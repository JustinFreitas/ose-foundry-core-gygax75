import { OSE } from "../config";
import { contextMenuEntry } from "../context-menu-entry";
import type { OSECombat } from "./combat";
import { OSECombatant } from "./combatant";

interface FlagBearer {
  getFlag(scope: string, key: string): unknown;
  setFlag(scope: string, key: string, value: unknown): Promise<unknown>;
}

interface TrackerTurn {
  id: string;
  initiative: number | string | null;
  isSlowed?: boolean;
  isFast?: boolean;
  isCasting?: boolean;
  isRetreating?: boolean;
  isOwnedByUser?: boolean;
  group?: unknown;
}

interface TrackerRenderContext extends foundry.applications.sidebar.tabs.CombatTracker.RenderContext {
  turns?: TrackerTurn[];
}

function parseTrackerInitiative(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default class OSECombatTracker extends foundry.applications.sidebar.tabs.CombatTracker {
  /** @inheritDoc */
  static override DEFAULT_OPTIONS = {
    ...foundry.applications.sidebar.tabs.CombatTracker.DEFAULT_OPTIONS,
    actions: {
      ...foundry.applications.sidebar.tabs.CombatTracker.DEFAULT_OPTIONS.actions,
      casting: OSECombatTracker.#onCombatantControl,
      retreat: OSECombatTracker.#onCombatantControl,
      rollGroup: OSECombatTracker.#onRollGroup,
    },
  };

  /** @inheritDoc */
  protected override async _prepareTrackerContext(
    context: foundry.applications.sidebar.tabs.CombatTracker.RenderContext,
    options: foundry.applications.sidebar.tabs.CombatTracker.RenderOptions,
  ) {
    await super._prepareTrackerContext(context, options);
    const trackerContext = context as TrackerRenderContext;
    const combat = this.viewed as OSECombat | null;
    trackerContext.turns?.forEach((turn) => {
      const combatant = combat?.combatants.get(turn.id) as OSECombatant | undefined;
      if (!combatant) return;
      const parsedInit = parseTrackerInitiative(turn.initiative);
      const groupObj =
        typeof combatant.group === "object" && combatant.group !== null
          ? (combatant.group as { name?: string | null })
          : undefined;
      turn.isSlowed =
        Boolean(combatant.isSlow) || groupObj?.name === "slow" || parsedInit === OSECombatant.INITIATIVE_VALUE_SLOWED;
      turn.isFast =
        !turn.isSlowed &&
        (Boolean(combatant.isFast) || groupObj?.name === "fast" || parsedInit === OSECombatant.INITIATIVE_VALUE_FAST);
      const flagDoc = combatant as unknown as FlagBearer;
      turn.isCasting = Boolean(flagDoc.getFlag(game.system.id, "prepareSpell"));
      turn.isRetreating = Boolean(flagDoc.getFlag(game.system.id, "moveInCombat"));
      turn.isOwnedByUser = Boolean(combatant.actor?.isOwner);
      turn.group = combatant.group;
    });
  }

  /** @override */
  protected override _onUpdateInitiative(event: Event) {
    const input = event.target as HTMLInputElement | null;
    if (!input) return;
    const li = input.closest<HTMLElement>("[data-combatant-id]");
    const combatantId = li?.dataset?.combatantId;
    const combatant = combatantId ? this.viewed?.combatants.get(combatantId) : undefined;
    if (!combatant) return;
    const rawValue = input.value.trim();
    if (rawValue === "") {
      void combatant.update({ initiative: null });
      return;
    }
    const parsed = parseTrackerInitiative(rawValue);
    if (parsed !== null && !/^[+=]/.test(rawValue)) {
      void combatant.update({ initiative: parsed });
      return;
    }
    super._onUpdateInitiative(event);
  }

  /** Roll initiative for the group whose header button was clicked. */
  static #onRollGroup(this: OSECombatTracker, _event: PointerEvent, target: HTMLElement) {
    const combat = this.viewed as OSECombat | null;
    const groupId = target.dataset.groupId;
    const group = groupId ? combat?.groups.get(groupId) : undefined;
    if (combat && group) {
      void combat.rollGroupInitiative([group]);
    }
  }

  /**
   * Prompt for a group's initiative. Set an empty value to clear it.
   *
   * @param {CombatantGroup} group - The group to set.
   */
  async #promptGroupInitiative(group: CombatantGroup) {
    const promptFn = foundry.applications.api.DialogV2.prompt as unknown as <T = string>(
      config: Record<string, unknown>,
    ) => Promise<T | null | undefined>;
    const value = await promptFn<string>({
      classes: ["ose", "dialog"],
      position: { width: 400, height: "auto" },
      window: { title: "OSE.combat.SetGroupInitiative" },
      content: `<label>${game.i18n.localize("OSE.Initiative")} <input type="number" name="initiative" value="${group.initiative ?? ""}" autofocus></label>`,
      ok: {
        callback: (_event: Event, button: HTMLButtonElement): string => {
          const input = button.form?.elements.namedItem("initiative") as HTMLInputElement | null;
          return input?.value ?? "";
        },
      },
      rejectClose: false,
    });
    if (value === null || value === undefined) return;
    if (value === "" && !game.user?.isGM) return;
    const combat = this.viewed as OSECombat | null;
    if (!combat) return;
    await combat.setGroupInitiative(group, value === "" ? null : Number(value));
  }

  /** @inheritDoc */
  static #onCombatantControl(
    this: OSECombatTracker,
    event: PointerEvent,
    target: Parameters<foundry.applications.sidebar.tabs.CombatTracker["_onCombatantControl"]>[1],
  ) {
    void this._onCombatantControl(event, target);
  }

  /**
   * Handle performing some action for an individual combatant.
   *
   * @param {PointerEvent} event - The triggering event.
   * @param {HTMLElement} target - The action target element.
   * @protected
   */
  protected override async _onCombatantControl(
    event: PointerEvent,
    target: Parameters<foundry.applications.sidebar.tabs.CombatTracker["_onCombatantControl"]>[1],
  ) {
    event.preventDefault();
    event.stopPropagation();
    const btn = (target || event.currentTarget) as HTMLElement | null;
    const combatantId = btn?.closest<HTMLElement>(".combatant")?.dataset?.combatantId;
    const combatant = combatantId ? (this.viewed?.combatants.get(combatantId) as OSECombatant | undefined) : undefined;
    const action = btn?.dataset?.control || btn?.dataset?.action;
    if (combatant) {
      switch (action) {
        case "casting":
          await this.#toggleFlag(combatant, "prepareSpell");
          return super._onCombatantControl(event, target);

        case "retreat":
          await this.#toggleFlag(combatant, "moveInCombat");
          return super._onCombatantControl(event, target);
      }
    }
    return super._onCombatantControl(event, target);
  }

  /** @override */
  protected override _configureRenderOptions(
    options: Parameters<foundry.applications.sidebar.tabs.CombatTracker["_configureRenderOptions"]>[0],
  ) {
    super._configureRenderOptions(options);

    // Replace the tracker template
    const ctor = this.constructor as unknown as { PARTS?: { tracker?: { template?: string } } };
    if (ctor.PARTS?.tracker) {
      ctor.PARTS.tracker.template = `${OSE.systemPath()}/templates/sidebar/combat-tracker-combatant.hbs`;
    }
  }

  /**
   * Toggle a boolean flag value on the combatant.
   *
   * @param {OSECombatant} combatant - The combatant to toggle the flag on.
   * @param {string} flag - The flag name to toggle.
   * @private
   */
  async #toggleFlag(combatant: OSECombatant, flag: string) {
    const flagDoc = combatant as unknown as FlagBearer;
    const isActive = Boolean(flagDoc.getFlag(game.system.id, flag));
    await flagDoc.setFlag(game.system.id, flag, !isActive);
  }

  /**
   * Get context menu entries for Combatants in the tracker.
   *
   * @returns {ContextMenuEntry[]}
   * @protected
   */
  protected override _getEntryContextOptions() {
    const options = super._getEntryContextOptions();
    return [
      contextMenuEntry({
        label: game.i18n.localize("OSE.combat.SetCombatantAsActive"),
        icon: '<i class="fas fa-star-of-life"></i>',
        onClick: (li: HTMLElement) => {
          const { combatantId } = li.dataset;
          const combat = this.viewed as OSECombat | null;
          if (!combat || !combatantId) return;
          const turnToActivate = combat.turns.findIndex((t) => t.id === combatantId);
          if (turnToActivate >= 0) {
            void combat.activateCombatant(turnToActivate);
          }
        },
      }),
      ...options,
    ];
  }

  /**
   * Adjust initiative tracker to group combatants.
   *
   * @param {HTMLElement} html - The combat tracker being rendered.
   */
  async renderGroups(html: HTMLElement) {
    const combat = this.viewed as OSECombat | null;
    if (!combat || game.settings.get(game.system.id as "ose", "initiative") !== "group") {
      return;
    }

    const headerButtonContainer = html.querySelector(".combat-tracker-header .control-buttons");
    if (headerButtonContainer) {
      // Replace the buttons with the OSE versions
      const reRollButton = document.createElement("button");
      reRollButton.type = "button";
      reRollButton.classList.add("inline-control", "combat-control", "combat-button", "icon", "fa-solid", "fa-users");
      reRollButton.dataset.action = "smartRerollInitiative";
      reRollButton.dataset.tooltip = game.i18n.localize("OSE.Reroll");
      reRollButton.ariaLabel = game.i18n.localize("OSE.Reroll");

      const reRollNPCButton = document.createElement("button");
      reRollNPCButton.type = "button";
      reRollNPCButton.classList.add(
        "inline-control",
        "combat-control",
        "combat-button",
        "icon",
        "fa-solid",
        "fa-users-cog",
      );
      reRollNPCButton.dataset.action = "rerollNPCInitiative";
      reRollNPCButton.dataset.tooltip = game.i18n.localize("OSE.combat.RerollNPCs");
      reRollNPCButton.ariaLabel = game.i18n.localize("OSE.combat.RerollNPCs");

      const setCombatantGroupsButton = document.createElement("button");
      setCombatantGroupsButton.type = "button";
      setCombatantGroupsButton.classList.add(
        "inline-control",
        "combat-control",
        "combat-button",
        "icon",
        "fa-solid",
        "fa-flag",
      );
      setCombatantGroupsButton.dataset.action = "setCombatantGroups";
      setCombatantGroupsButton.dataset.tooltip = game.i18n.localize("OSE.combat.SetCombatantGroups");
      setCombatantGroupsButton.ariaLabel = game.i18n.localize("OSE.combat.SetCombatantGroups");

      headerButtonContainer.replaceChildren(reRollButton, reRollNPCButton, setCombatantGroupsButton);
    }

    const list = html.querySelector(".directory-list, .combat-tracker");
    for (const combatantGroup of combat.groups?.values() ?? []) {
      if (!combatantGroup.members?.size) {
        continue;
      }

      const selectors = [...combatantGroup.members]
        .map((c) => (c?.id ? `[data-combatant-id="${c.id}"]` : ""))
        .filter(Boolean);
      const children = selectors.length > 0 ? list?.querySelectorAll(selectors.join(", ")) || [] : [];
      if (children.length === 0) {
        continue;
      }

      const label = combatantGroup.name ?? "";
      const groupContainer = document.createElement("li");

      const isOwner = Boolean(game.user?.isGM) || combatantGroup.members.some((c) => Boolean(c.isOwner));
      const parsedGroupInit = parseTrackerInitiative(combatantGroup.initiative);
      const unrolled = parsedGroupInit === null;
      const formattedGroupInit = unrolled ? "" : `${parsedGroupInit}`;
      let initiativeCounter: HTMLElement;
      if (label === "slow") {
        initiativeCounter = document.createElement("span");
        initiativeCounter.innerHTML = `<i class="fa fa-weight-hanging"></i>`;
      } else if (label === "fast") {
        initiativeCounter = document.createElement("span");
        initiativeCounter.innerHTML = `<i class="fa fa-bolt-lightning"></i>`;
      } else if (isOwner && unrolled) {
        initiativeCounter = document.createElement("button");
        initiativeCounter.setAttribute("type", "button");
        initiativeCounter.classList.add("inline-control", "icon", "fa-solid", "fa-dice-d6");
        initiativeCounter.dataset.action = "rollGroup";
        initiativeCounter.dataset.groupId = combatantGroup.id ?? "";
        initiativeCounter.dataset.tooltip = game.i18n.localize("OSE.combat.RollGroupInitiative");
      } else {
        initiativeCounter = document.createElement("span");
        initiativeCounter.textContent = formattedGroupInit;
      }
      initiativeCounter.classList.add("create-button");
      initiativeCounter.style.fontSize = "1.25em";
      initiativeCounter.style.fontWeight = "600";
      initiativeCounter.style.flex = "0 0 20px";
      initiativeCounter.style.textAlign = "center";
      // Players may only enter a value for their own unrolled group.
      if (!["slow", "fast"].includes(label) && (game.user?.isGM || (isOwner && unrolled))) {
        initiativeCounter.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          event.stopPropagation();
          void this.#promptGroupInitiative(combatantGroup);
        });
      }

      const groupHeader = document.createElement("div");
      groupHeader.className = "group-header flexrow";
      groupHeader.style.background = `linear-gradient(90deg, var(--ose-group-color-${label}, ${label}), transparent)`;

      const tokenName = document.createElement("div");
      tokenName.className = "token-name";

      const nameStrong = document.createElement("strong");
      nameStrong.className = "name";

      const diceIcon = document.createElement("i");
      diceIcon.className = "fas fa-dice-d6";
      nameStrong.append(diceIcon);

      nameStrong.append(
        " ",
        game.i18n.localize(
          label === "slow" ? "OSE.items.Slow" : label === "fast" ? "OSE.combat.Fast" : `OSE.colors.${label}`,
        ),
      );

      tokenName.append(nameStrong);
      groupHeader.append(tokenName);
      groupHeader.append(initiativeCounter);

      const wrapper = document.createElement("div");
      wrapper.className = "wrapper";

      const groupChildren = document.createElement("ol");
      groupChildren.className = "group-children";
      wrapper.append(groupChildren);

      groupContainer.append(groupHeader);
      groupContainer.append(wrapper);
      groupContainer.dataset.groupKey = label;
      if (label === "slow") {
        groupContainer.dataset.initiative = `${OSECombatant.INITIATIVE_VALUE_SLOW}`;
      } else if (label === "fast") {
        groupContainer.dataset.initiative = `${OSECombatant.INITIATIVE_VALUE_FAST}`;
      } else if (!unrolled) {
        groupContainer.dataset.initiative = formattedGroupInit;
      }
      children[0]?.before(groupContainer);
      groupContainer.querySelector(".group-children")?.replaceChildren(...children);
    }
  }
}
