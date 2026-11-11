/**
 * @file Helper functions for managing the Party Sheet
 */
import OsePartySheet from "./party/party-sheet";

/**
 * Add a button to the actor sheet to open the Party Sheet
 *
 * @param {foundry.applications.sidebar.tabs.ActorDirectory} object - The actor directory object
 */
export const addControl = (object) => {
  const html = object?.element;
  if (!html || html.querySelector("button.ose-party-sheet")) {
    // If element is not rendered or button already exists, do not add it
    return;
  }

  const control = document.createElement("button");
  control.className = "ose-party-sheet";
  control.type = "button";
  control.title = game.i18n.localize("OSE.dialog.partysheet");
  const icon = document.createElement("i");
  icon.className = "fas fa-users";
  control.append(icon);

  const searchToggle = html?.querySelector(".toggle-search-mode");
  if (searchToggle) {
    control.addEventListener("click", (ev) => {
      ev.preventDefault();
      Hooks.call("OSE.Party.showSheet");
    });

    searchToggle.parentNode.insertBefore(control, searchToggle);
  }
};

export const update = (actor, data) => {
  const sysId = game.system.id;
  const partyFlag = actor.getFlag(sysId, "party");
  const flagScope = data?.flags?.[sysId] ?? data?.flags?.ose;
  const flagChanged = flagScope !== undefined && flagScope !== null && ("party" in flagScope || "-=party" in flagScope);

  if (!partyFlag && !flagChanged) {
    return;
  }

  OsePartySheet.partySheet?.render();
};

export { resetDutyXP } from "./party/duty-xp";
