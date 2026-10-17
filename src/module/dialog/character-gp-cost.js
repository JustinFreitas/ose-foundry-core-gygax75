/**
 * @file An application for deducting currency from an actor using the Shopping Cart feature.
 */
const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export default class OseCharacterGpCost extends HandlebarsApplicationMixin(ApplicationV2) {
  static physicalItemTypes = new Set(["item", "container", "weapon", "armor"]);

  constructor(document, preparedData, options = {}) {
    super(options);
    this.document = document;
    this.preparedData = preparedData;
  }

  /** Bring an open dialog forward (closing if it's for a different actor) before creating a new one. */
  static open(document, preparedData, options = {}) {
    const existing = foundry.applications.instances.get("sheet-gp-cost");
    if (existing?.document === document) {
      existing.preparedData = preparedData;
      existing.render();
      existing.bringToFront();
      return existing;
    }
    existing?.close();
    const sheet = new OseCharacterGpCost(document, preparedData, options);
    sheet.render({ force: true });
    return sheet;
  }

  static DEFAULT_OPTIONS = {
    id: "sheet-gp-cost",
    classes: ["ose", "dialog", "gp-cost"],
    tag: "form",
    form: {
      handler: OseCharacterGpCost.#onSubmitForm,
      submitOnChange: false,
      closeOnSubmit: false,
    },
    position: { width: "auto", height: "auto" },
    window: { resizable: true },
  };

  static PARTS = {
    main: { template: "systems/__SYSTEM_ID__/dist/templates/actors/dialogs/gp-cost-dialog.html" },
  };

  get title() {
    return `${this.document.name}: ${game.i18n.localize("OSE.dialog.shoppingCart")}`;
  }

  async _prepareContext() {
    const context = foundry.utils.deepClone(this.preparedData);

    const updateTooltips = (items) => {
      if (!items) return;
      for (const item of items) {
        if (OseCharacterGpCost.physicalItemTypes.has(item.type) && !item.system.treasure && !item.flags?.ose?.paid) {
          if (item.system.quantity?.max > 0 && item.system.cost > 0) {
            const perItem = Math.round((item.system.cost / item.system.quantity.max) * 1000) / 1000;
            item.system.bundleTooltip = `Per-unit cost: ${perItem}`;
          }
          if (item.system.quantity?.max > 0) {
            item.system.cost = (item.system.cost / item.system.quantity.max) * item.system.quantity.value;
          } else {
            item.system.cost = item.system.cost * (item.system.quantity?.value ?? 1);
          }
          item.system.cost = Math.round(item.system.cost * 100) / 100;
        }
      }
    };

    updateTooltips(context.owned?.weapons);
    updateTooltips(context.owned?.armors);
    updateTooltips(context.owned?.items);
    if (context.owned?.containers) {
      updateTooltips(context.owned.containers);
      for (const bag of context.owned.containers) {
        updateTooltips(bag.system?.contents);
      }
    }

    context.totalCost = await this._getTotalCost(context);
    context.user = game.user;
    return context;
  }

  static async #onSubmitForm(_event, _form, _formData) {
    return this._submit();
  }

  async _submit() {
    // Generate gold; compute the cost from the actor's live inventory rather
    // than the snapshot taken when the dialog was opened.
    const totalCost = await this._getTotalCost({ items: [...this.document.items] });

    const gpBank = this.document.items.find((item) => item.name === "GP (Bank)" && item.system.treasure);
    const gp = this.document.items.find(
      (item) => (item.name === game.i18n.localize("OSE.items.gp.short") || item.name === "GP") && item.system.treasure,
    );

    const gpBankQty = gpBank ? gpBank.system.quantity.value : 0;
    const gpQty = gp ? gp.system.quantity.value : 0;

    if (gpBankQty + gpQty < totalCost) {
      ui.notifications.error(game.i18n.localize("OSE.error.notEnoughGP"));
      return;
    }

    let remainingCost = totalCost;
    const updates = [];

    if (gpBank && remainingCost > 0) {
      const deduct = Math.min(gpBankQty, remainingCost);
      const newQty = Math.round((gpBankQty - deduct) * 100) / 100;
      updates.push({ _id: gpBank.id, "system.quantity.value": newQty });
      remainingCost = Math.round((remainingCost - deduct) * 100) / 100;
    }

    if (gp && remainingCost > 0) {
      const deduct = Math.min(gpQty, remainingCost);
      const newQty = Math.round((gpQty - deduct) * 100) / 100;
      updates.push({ _id: gp.id, "system.quantity.value": newQty });
      remainingCost = Math.round((remainingCost - deduct) * 100) / 100;
    }

    if (updates.length > 0) {
      await this.document.updateEmbeddedDocuments("Item", updates);
    }

    await this._markItemsAsPaid();

    // Post the cart receipt to chat
    const context = await this._prepareContext();
    const content = await foundry.applications.handlebars.renderTemplate(
      "systems/__SYSTEM_ID__/dist/templates/chat/inventory-list.html",
      context,
    );
    await ChatMessage.create({
      style: CONST.CHAT_MESSAGE_STYLES?.OTHER ?? 0,
      content,
      speaker: ChatMessage.getSpeaker({ actor: this.document }),
    });

    await this.close();
  }

  async _getTotalCost(data) {
    const rawTotal = (data.items || []).reduce((total, item) => {
      const itemData = item.system;
      // Only count non-treasure physical items that haven't been paid for yet
      if (OseCharacterGpCost.physicalItemTypes.has(item.type) && !itemData.treasure && !item.flags?.ose?.paid) {
        if (itemData.quantity?.max > 0) {
          return total + (itemData.cost / itemData.quantity.max) * itemData.quantity.value;
        }
        return total + itemData.cost * (itemData.quantity?.value ?? 1);
      }
      return total;
    }, 0);
    return Math.round(rawTotal * 100) / 100;
  }

  /**
   * Mark all items in the shopping cart as paid for so they no longer appear in
   * the cart on subsequent openings.
   */
  async _markItemsAsPaid() {
    const updates = [];
    for (const item of this.document.items) {
      const itemData = item.system;
      if (OseCharacterGpCost.physicalItemTypes.has(item.type) && !itemData.treasure && !item.flags?.ose?.paid) {
        updates.push({ _id: item.id, "flags.ose.paid": true });
      }
    }
    if (updates.length > 0) {
      await this.document.updateEmbeddedDocuments("Item", updates);
    }
  }
}
