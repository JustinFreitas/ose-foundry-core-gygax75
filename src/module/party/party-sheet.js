/**
 * @file An application for managing the current party.
 */
import { resetDutyXP } from "./duty-xp";
import OseParty from "./party";
import OsePartyXP from "./party-xp";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;
const { DragDrop } = foundry.applications.ux;

const Party = {
  partySheet: undefined,
};

export default class OsePartySheet extends HandlebarsApplicationMixin(ApplicationV2) {
  static init() {
    Party.partySheet = new OsePartySheet();
  }

  static get partySheet() {
    return Party.partySheet;
  }

  static showPartySheet(options = {}) {
    Party.partySheet?.render({ force: true, ...options });
  }

  static async onDeleteActor(deletedActor) {
    if (!game.user?.isGM) return;
    const deletedActorId = deletedActor?.id ?? deletedActor;
    if (!deletedActorId) return;
    const savedParties = { ...(game.settings.get(game.system.id, "savedParties") || {}) };
    let changed = false;
    for (const [name, actorIds] of Object.entries(savedParties)) {
      if (actorIds.includes(deletedActorId)) {
        savedParties[name] = actorIds.filter((id) => id !== deletedActorId);
        changed = true;
      }
    }
    if (changed) {
      await game.settings.set(game.system.id, "savedParties", savedParties);
    }
  }

  static DEFAULT_OPTIONS = {
    id: "party-sheet",
    classes: ["ose", "dialog", "party-sheet"],
    tag: "form",
    form: {
      handler: OsePartySheet.#onSubmitForm,
      submitOnChange: false,
      closeOnSubmit: false,
    },
    position: { width: 280, height: 400 },
    window: { resizable: true },
    dragDrop: [{ dragSelector: ".actor-list .actor", dropSelector: ".party-members" }],
    actions: {
      dealXP: OsePartySheet._onDealXP,
      openActorSheet: OsePartySheet._onOpenActorSheet,
      removeActor: OsePartySheet._onRemoveActor,
      manageParties: OsePartySheet._onManageParties,
      resetDutyXP: OsePartySheet._onResetDutyXP,
    },
  };

  static PARTS = {
    main: { template: "systems/__SYSTEM_ID__/dist/templates/apps/party-sheet.html" },
  };

  get title() {
    return game.i18n.localize("OSE.dialog.partysheet");
  }

  #dragDrop;

  get dragDrop() {
    if (this.#dragDrop) return this.#dragDrop;
    this.#dragDrop = (this.options.dragDrop ?? []).map(
      (cfg) =>
        new DragDrop.implementation({
          ...cfg,
          permissions: {
            dragstart: this._canDragStart.bind(this),
            drop: this._canDragDrop.bind(this),
          },
          callbacks: {
            dragstart: this._onDragStart.bind(this),
            drop: this._onDrop.bind(this),
          },
        }),
    );
    return this.#dragDrop;
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    for (const dd of this.dragDrop) dd.bind(this.element);
  }

  async _prepareContext() {
    const partyActors = OseParty.currentParty;
    const hasDutyXP = partyActors.some((a) => Boolean(a.flags?.dutyXP));
    return {
      partyActors,
      config: CONFIG.OSE,
      user: game.user,
      settings: {
        ascending: game.settings.get(game.system.id, "ascendingAC"),
      },
      hasDutyXP,
    };
  }

  _canDragStart() {
    return game.user.isGM;
  }

  _canDragDrop() {
    return game.user.isGM;
  }

  async _addActorToParty(actor) {
    if (actor.type !== "character") return;
    await actor.setFlag(game.system.id, "party", true);
  }

  async _removeActorFromParty(actor) {
    await actor.setFlag(game.system.id, "party", false);
  }

  _onDrop(event) {
    event.preventDefault();
    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData("text/plain"));
    } catch (_error) {
      return false;
    }
    if (data.type === "Actor") return this._onDropActor(event, data);
    if (data.type === "Folder") return this._onDropFolder(event, data);
  }

  async _onDropActor(_event, data) {
    const droppedActor = await fromUuid(data.uuid);
    if (!droppedActor) return;
    await this._addActorToParty(droppedActor);
  }

  async _recursiveAddFolder(folder) {
    for (const actor of folder.contents) {
      await this._addActorToParty(actor);
    }
    for (const child of folder.children) {
      await this._recursiveAddFolder(child.folder);
    }
  }

  async _onDropFolder(_event, data) {
    const folder = await fromUuid(data.uuid);
    if (folder?.type !== "Actor") return;
    await this._recursiveAddFolder(folder);
  }

  async _onDragStart(event) {
    try {
      const { uuid } = event.currentTarget.dataset;
      const dragData = (await fromUuid(uuid)).toDragData();
      event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
    } catch (_error) {
      return false;
    }
    return true;
  }

  _getActorFromEvent(target) {
    const id = target.closest(".actor")?.dataset.actorId;
    return id ? game.actors.get(id) : undefined;
  }

  static _onDealXP() {
    return this._handleDealXP();
  }
  static _onOpenActorSheet(_event, target) {
    return this._handleOpenActorSheet(target);
  }
  static _onRemoveActor(_event, target) {
    return this._handleRemoveActor(target);
  }
  static _onManageParties(_event) {
    return this._manageParties(_event);
  }
  static _onResetDutyXP() {
    return this._handleResetDutyXP();
  }

  _handleDealXP() {
    OsePartyXP.open();
  }

  _handleOpenActorSheet(target) {
    this._getActorFromEvent(target)?.sheet?.render({ force: true });
  }

  async _handleRemoveActor(target) {
    const actor = this._getActorFromEvent(target);
    if (!actor) return;
    await this._removeActorFromParty(actor);
    this.render();
  }

  async _handleResetDutyXP() {
    const partyActorsWithDuty = OseParty.currentParty.filter((a) => Boolean(a.flags?.dutyXP));
    if (partyActorsWithDuty.length === 0) {
      ui.notifications.info("No characters in party currently have active Duty XP.");
      return;
    }
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      classes: ["ose", "dialog"],
      position: { width: 400, height: "auto" },
      window: {
        title: game.i18n.localize("OSE.dialog.party.resetDutyTitle") || "Reset Duty XP Bonuses",
      },
      content: `<p>Reset Duty XP (+5%) bonuses for <strong>${partyActorsWithDuty.length} character(s)</strong> back to their original values?</p>`,
    });
    if (confirmed) {
      await resetDutyXP(partyActorsWithDuty);
      this.render();
    }
  }

  async _clearCurrentParty() {
    const promises = OseParty.currentParty.map((actor) => this._removeActorFromParty(actor));
    if (promises.length > 0) {
      await Promise.all(promises);
    }
  }

  async _manageParties(_event) {
    if (!game.user.isGM) return;

    const savedParties = game.settings.get(game.system.id, "savedParties") || {};
    const partyNames = Object.keys(savedParties);
    const hasSavedParties = partyNames.length > 0;

    let optionsHtml = "";
    for (const name of partyNames) {
      const escapedName = foundry.utils.escapeHTML(name);
      optionsHtml += `<option value="${escapedName}">${escapedName}</option>`;
    }

    new foundry.applications.api.DialogV2({
      classes: ["ose", "dialog", "party-config"],
      position: { width: 400, height: "auto" },
      window: {
        title: game.i18n.localize("OSE.dialog.party.manageTitle"),
      },
      content: `
        <div class="form-group">
          <label>${game.i18n.localize("OSE.dialog.party.nameLabel")}</label>
          <input type="text" name="partyName" autofocus />
        </div>
        <div class="form-group checkbox">
          <input type="checkbox" name="clearAfterSave" id="clear-after-save" />
          <label for="clear-after-save">${game.i18n.localize("OSE.dialog.party.clearLabel")}</label>
        </div>
        ${
          hasSavedParties
            ? `
        <hr />
        <div class="form-group">
          <label>${game.i18n.localize("OSE.dialog.party.loadSelectLabel")}</label>
          <select name="partyToLoad">${optionsHtml}</select>
        </div>
        <div class="form-group">
          <label>${game.i18n.localize("OSE.dialog.party.deleteSelectLabel")}</label>
          <select name="partyToDelete">${optionsHtml}</select>
        </div>`
            : ""
        }
      `,
      buttons: [
        {
          action: "save",
          label: game.i18n.localize("OSE.dialog.party.saveButton"),
          icon: "fas fa-save",
          default: true,
          callback: async (_event, button) => {
            const formData = new foundry.applications.ux.FormDataExtended(button.form).object;
            const name = formData.partyName?.trim();
            if (!name) {
              ui.notifications.warn(game.i18n.localize("OSE.dialog.party.warnNoName"));
              return false;
            }
            if (["__proto__", "constructor", "prototype"].includes(name.toLowerCase())) {
              ui.notifications.error(game.i18n.localize("OSE.dialog.party.warnInvalidName"));
              return false;
            }
            const currentPartyIds = OseParty.currentParty.map((actor) => actor.id);
            if (currentPartyIds.length === 0) {
              ui.notifications.warn(game.i18n.localize("OSE.dialog.party.warnEmpty"));
              return false;
            }

            const existingParties = game.settings.get(game.system.id, "savedParties") || {};
            if (existingParties[name]) {
              const confirmed = await foundry.applications.api.DialogV2.confirm({
                classes: ["ose", "dialog"],
                position: { width: 400, height: "auto" },
                window: {
                  title: game.i18n.localize("OSE.dialog.party.overwriteTitle"),
                },
                content: `<p>${game.i18n.format("OSE.dialog.party.confirmOverwrite", {
                  name: foundry.utils.escapeHTML(name),
                })}</p>`,
              });
              if (!confirmed) return false;
            }

            // Re-fetch immediately before writing to keep the read-modify-write window as small as possible.
            const latestSavedParties = { ...(game.settings.get(game.system.id, "savedParties") || {}) };
            latestSavedParties[name] = currentPartyIds;
            await game.settings.set(game.system.id, "savedParties", latestSavedParties);
            ui.notifications.info(
              game.i18n.format("OSE.dialog.party.infoSaved", { name: foundry.utils.escapeHTML(name) }),
            );

            if (formData.clearAfterSave) {
              await this._clearCurrentParty();
              ui.notifications.info(game.i18n.localize("OSE.dialog.party.infoCleared"));
            }
            this.render();
          },
        },
        ...(hasSavedParties
          ? [
              {
                action: "load",
                label: game.i18n.localize("OSE.dialog.party.loadButton"),
                icon: "fas fa-upload",
                callback: async (_event, button) => {
                  const formData = new foundry.applications.ux.FormDataExtended(button.form).object;
                  const name = formData.partyToLoad;
                  if (!name) return false;

                  const partyActorIds = savedParties[name];
                  if (!partyActorIds) return false;

                  const changes = game.actors.reduce((acc, actor) => {
                    if (actor.type !== "character") return acc;
                    const inParty = partyActorIds.includes(actor.id);
                    const isCurrentlyInParty = actor.getFlag(game.system.id, "party") === true;
                    if (inParty !== isCurrentlyInParty) {
                      acc.push(inParty ? this._addActorToParty(actor) : this._removeActorFromParty(actor));
                    }
                    return acc;
                  }, []);
                  if (changes.length > 0) {
                    await Promise.all(changes);
                  }

                  ui.notifications.info(
                    game.i18n.format("OSE.dialog.party.infoLoaded", { name: foundry.utils.escapeHTML(name) }),
                  );
                  this.render();
                },
              },
              {
                action: "delete",
                label: game.i18n.localize("OSE.Delete"),
                icon: "fas fa-trash",
                callback: async (_event, button) => {
                  const formData = new foundry.applications.ux.FormDataExtended(button.form).object;
                  const name = formData.partyToDelete;
                  if (!name) return false;

                  const confirmed = await foundry.applications.api.DialogV2.confirm({
                    classes: ["ose", "dialog"],
                    position: { width: 400, height: "auto" },
                    window: {
                      title: game.i18n.localize("OSE.dialog.party.deleteTitle"),
                    },
                    content: `<p>${game.i18n.format("OSE.dialog.party.confirmDelete", {
                      name: foundry.utils.escapeHTML(name),
                    })}</p>`,
                  });
                  if (!confirmed) return false;

                  // Re-fetch immediately before writing to keep the read-modify-write window as small as possible.
                  const latestSavedParties = { ...(game.settings.get(game.system.id, "savedParties") || {}) };
                  delete latestSavedParties[name];
                  await game.settings.set(game.system.id, "savedParties", latestSavedParties);
                  ui.notifications.info(
                    game.i18n.format("OSE.dialog.party.infoDeleted", { name: foundry.utils.escapeHTML(name) }),
                  );
                  this.render();
                },
              },
            ]
          : []),
        {
          action: "clear",
          label: game.i18n.localize("OSE.dialog.party.clear"),
          icon: "fas fa-broom",
          callback: async () => {
            if (OseParty.currentParty.length === 0) {
              ui.notifications.info(game.i18n.localize("OSE.dialog.party.warnAlreadyEmpty"));
              return false;
            }

            const confirmed = await foundry.applications.api.DialogV2.confirm({
              classes: ["ose", "dialog"],
              position: { width: 400, height: "auto" },
              window: {
                title: game.i18n.localize("OSE.dialog.party.clearTitle"),
              },
              content: `<p>${game.i18n.format("OSE.dialog.party.confirmClear", {
                count: OseParty.currentParty.length,
              })}</p>`,
            });
            if (!confirmed) return false;

            await this._clearCurrentParty();
            ui.notifications.info(game.i18n.localize("OSE.dialog.party.infoCleared"));
            this.render();
          },
        },
        {
          action: "cancel",
          label: game.i18n.localize("OSE.Cancel"),
          icon: "fas fa-times",
        },
      ],
    }).render(true);
  }

  static async #onSubmitForm() {}
}
