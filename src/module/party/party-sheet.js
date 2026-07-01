/**
 * @file An application for managing the current party.
 */
import OSE from "../config";
import OseParty from "./party";
import OsePartyXP from "./party-xp";

const Party = {
  partySheet: void 0,
};

export default class OsePartySheet extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(FormApplication.defaultOptions, {
      classes: ["ose", "dialog", "party-sheet"],
      template: `${OSE.systemPath()}/templates/apps/party-sheet.html`,
      width: 280,
      height: 400,
      resizable: true,
      dragDrop: [{ dragSelector: ".actor-list .actor", dropSelector: ".party-members" }],
      closeOnSubmit: false,
    });
  }

  static init() {
    Party.partySheet = new OsePartySheet();
  }

  static showPartySheet(options = {}) {
    OsePartySheet.partySheet.render(true, { focus: true, ...options });
  }

  static get partySheet() {
    return Party.partySheet;
  }

  /* -------------------------------------------- */

  /**
   * Add the Entity name into the window title
   *
   * @type {string}
   */
  get title() {
    return game.i18n.localize("OSE.dialog.partysheet");
  }

  /* -------------------------------------------- */

  /**
   * Construct and return the data object used to render the HTML template for this form application.
   *
   * @returns {object}
   */
  getData() {
    const settings = {
      ascending: game.settings.get(game.system.id, "ascendingAC"),
    };
    const savedParties = game.settings.get(game.system.id, "savedParties") || {};

    return {
      partyActors: OseParty.currentParty,
      savedParties,
      hasSavedParties: Object.keys(savedParties).length > 0,
      // data: this.object,
      config: CONFIG.OSE,
      user: game.user,
      settings,
    };
  }

  async _addActorToParty(actor) {
    if (actor.type !== "character") {
      return;
    }

    await actor.setFlag(game.system.id, "party", true);
  }

  async _removeActorFromParty(actor) {
    await actor.setFlag(game.system.id, "party", false);
  }

  /* ---------------------- */
  /* --Drag&Drop Behavior-- */
  /* ---------------------- */

  /* - Adding to the Party Sheet -*/
  _onDrop(event) {
    event.preventDefault();
    // WIP Drop Items
    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData("text/plain"));

      switch (data.type) {
        case "Actor": {
          return this._onDropActor(event, data);
        }

        case "Folder": {
          return this._onDropFolder(event, data);
        }
      }
    } catch (_error) {
      return false;
    }
  }

  async _onDropActor(_event, data) {
    if (data.type !== "Actor") {
      return;
    }

    const droppedActor = await fromUuid(data.uuid);

    this._addActorToParty(droppedActor);
  }

  _recursiveAddFolder(folder) {
    for (const actor of folder.contents) {
      this._addActorToParty(actor);
    }
    for (const child of folder.children) {
      this._recursiveAddFolder(child.folder);
    }
  }

  async _onDropFolder(_event, data) {
    const folder = await fromUuid(data.uuid);
    if (folder?.type !== "Actor") return;

    this._recursiveAddFolder(folder);
  }

  /* - Dragging from the Party Sheet - */
  async _onDragStart(event) {
    try {
      const { uuid } = event.currentTarget.dataset;
      const dragData = (await fromUuid(uuid)).toDragData();
      // Set data transfer
      event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
    } catch (_error) {
      return false;
    }

    return true;
  }

  /* -------------------------------------------- */

  async _dealXP(_ev) {
    new OsePartyXP(this.object, {}).render(true);
  }

  async _saveParty(event) {
    event.preventDefault();
    const currentPartyIds = OseParty.currentParty.map((actor) => actor.id);
    if (currentPartyIds.length === 0) {
      ui.notifications.warn(game.i18n.localize("OSE.dialog.party.warnEmpty"));
      return;
    }

    new foundry.applications.api.DialogV2({
      window: {
        title: game.i18n.localize("OSE.dialog.party.saveTitle"),
      },
      content: `
        <div class="form-group">
          <label>${game.i18n.localize("OSE.dialog.party.nameLabel")}</label>
          <input type="text" name="partyName" placeholder="e.g. Delving Group" autofocus />
        </div>
        <div class="form-group">
          <label>${game.i18n.localize("OSE.dialog.party.clearLabel")}</label>
          <input type="checkbox" name="clearAfterSave" />
        </div>
      `,
      buttons: [
        {
          action: "save",
          label: game.i18n.localize("OSE.dialog.party.saveButton"),
          icon: "fas fa-save",
          default: true,
          callback: async (event, button) => {
            const formData = new foundry.applications.ux.FormDataExtended(button.form).object;
            const name = formData.partyName?.trim();
            if (!name) {
              ui.notifications.warn(game.i18n.localize("OSE.dialog.party.warnNoName"));
              return false;
            }
            const clearAfterSave = !!formData.clearAfterSave;
            const savedParties = { ...game.settings.get(game.system.id, "savedParties") };
            if (["__proto__", "constructor", "prototype"].includes(name)) {
              ui.notifications.error(game.i18n.localize("OSE.dialog.party.warnInvalidName"));
              return false;
            }

            const doSave = async () => {
              savedParties[name] = currentPartyIds;
              await game.settings.set(game.system.id, "savedParties", savedParties);
              ui.notifications.info(game.i18n.format("OSE.dialog.party.infoSaved", { name }));

              if (clearAfterSave) {
                const updates = OseParty.currentParty.map((actor) => ({
                  _id: actor.id,
                  [`flags.${game.system.id}.party`]: false,
                  [`flags.${game.system.id}.-=marchingOrder`]: null,
                }));
                if (updates.length > 0) {
                  await Actor.updateDocuments(updates);
                }
                ui.notifications.info(game.i18n.localize("OSE.dialog.party.infoCleared"));
              }

              this.render(true);
            };

            if (savedParties[name]) {
              const confirm = await foundry.applications.api.DialogV2.confirm({
                window: {
                  title: game.i18n.localize("OSE.dialog.party.overwriteTitle"),
                },
                content: `<p>${game.i18n.format("OSE.dialog.party.confirmOverwrite", { name })}</p>`,
              });
              if (!confirm) return false;
            }
            await doSave();
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

  async _loadParty(event) {
    const name = event.currentTarget.value;
    if (!name) return;

    const savedParties = game.settings.get(game.system.id, "savedParties") || {};
    const partyActorIds = savedParties[name];
    if (!partyActorIds) return;

    // Reset dropdown value immediately so it shows "Load Party..." again
    event.currentTarget.value = "";

    const updates = game.actors.reduce((acc, actor) => {
      if (actor.type !== "character") return acc;
      const inParty = partyActorIds.includes(actor.id);
      const isCurrentlyInParty = actor.getFlag(game.system.id, "party") === true;
      if (inParty !== isCurrentlyInParty) {
        acc.push({
          _id: actor.id,
          [`flags.${game.system.id}.party`]: inParty,
        });
      }
      return acc;
    }, []);

    if (updates.length > 0) {
      await Actor.updateDocuments(updates);
    }

    ui.notifications.info(game.i18n.format("OSE.dialog.party.infoLoaded", { name }));
    this.render(true);
  }

  async _deleteParty(event) {
    event.preventDefault();
    const savedParties = { ...game.settings.get(game.system.id, "savedParties") };
    const partyNames = Object.keys(savedParties);
    if (partyNames.length === 0) return;

    if (partyNames.length === 1) {
      const name = partyNames[0];
      foundry.applications.api.DialogV2.confirm({
        window: {
          title: game.i18n.localize("OSE.dialog.party.deleteTitle"),
        },
        content: `<p>${game.i18n.format("OSE.dialog.party.confirmDelete", { name })}</p>`,
        yes: {
          callback: async () => {
            delete savedParties[name];
            await game.settings.set(game.system.id, "savedParties", savedParties);
            ui.notifications.info(game.i18n.format("OSE.dialog.party.infoDeleted", { name }));
            this.render(true);
          },
        },
        defaultYes: false,
      });
      return;
    }

    let optionsHtml = "";
    for (const name of partyNames) {
      optionsHtml += `<option value="${name}">${name}</option>`;
    }

    new foundry.applications.api.DialogV2({
      window: {
        title: game.i18n.localize("OSE.dialog.party.deleteTitle"),
      },
      content: `
        <div class="form-group">
          <label>${game.i18n.localize("OSE.dialog.party.deleteSelectLabel")}</label>
          <select name="partyToDelete">
            ${optionsHtml}
          </select>
        </div>
      `,
      buttons: [
        {
          action: "delete",
          label: game.i18n.localize("OSE.Delete"),
          icon: "fas fa-trash",
          callback: async (event, button) => {
            const formData = new foundry.applications.ux.FormDataExtended(button.form).object;
            const name = formData.partyToDelete;
            if (!name) return;

            delete savedParties[name];
            await game.settings.set(game.system.id, "savedParties", savedParties);
            ui.notifications.info(game.i18n.format("OSE.dialog.party.infoDeleted", { name }));
            this.render(true);
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

  async _clearParty(event) {
    event.preventDefault();
    if (OseParty.currentParty.length === 0) {
      ui.notifications.info(game.i18n.localize("OSE.dialog.party.warnAlreadyEmpty"));
      return;
    }

    foundry.applications.api.DialogV2.confirm({
      window: {
        title: game.i18n.localize("OSE.dialog.party.clearTitle"),
      },
      content: `<p>${game.i18n.format("OSE.dialog.party.confirmClear", { count: OseParty.currentParty.length })}</p>`,
      yes: {
        callback: async () => {
          const updates = OseParty.currentParty.map((actor) => ({
            _id: actor.id,
            [`flags.${game.system.id}.party`]: false,
            [`flags.${game.system.id}.-=marchingOrder`]: null,
          }));
          if (updates.length > 0) {
            await Actor.updateDocuments(updates);
          }
          ui.notifications.info(game.i18n.localize("OSE.dialog.party.infoCleared"));
          this.render(true);
        },
      },
      defaultYes: false,
    });
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    html.find(".header #deal-xp").click(this._dealXP.bind(this));
    html.find(".header #save-party").click(this._saveParty.bind(this));
    html.find(".header #clear-party").click(this._clearParty.bind(this));
    html.find(".header #load-party").change(this._loadParty.bind(this));
    html.find(".header #delete-party").click(this._deleteParty.bind(this));

    // Actor buttons
    const getActor = (event) => {
      const id = event.currentTarget.closest(".actor").dataset.actorId;
      return game.actors.get(id);
    };

    html.find(".field-img button[data-action='open-sheet']").click((event) => {
      getActor(event).sheet.render(true);
    });

    html.find(".field-img button[data-action='remove-actor']").click(async (event) => {
      await this._removeActorFromParty(getActor(event));
      this.render(true);
    });
  }
}
