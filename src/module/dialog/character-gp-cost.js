/**
 * @file An application for deducting currency from an actor using the Shopping Cart feature
 */
// eslint-disable-next-line no-unused-vars
import OSE from "../config";

export default class OseCharacterGpCost extends FormApplication {
  static physicalItemTypes = new Set(["item", "container", "weapon", "armor"]);

  constructor(event, preparedData, position) {
    super(event, position);
    this.object.preparedData = preparedData;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(FormApplication.defaultOptions, {
      classes: ["ose", "dialog", "gp-cost"],
      id: "sheet-gp-cost",
      template: `${OSE.systemPath()}/templates/actors/dialogs/gp-cost-dialog.html`,
      width: "auto",
    });
  }

  /* -------------------------------------------- */

  /**
   * Add the Entity name into the window title
   *
   * @type {string}
   * @returns {string} - A localized window title
   */
  get title() {
    return `${this.object.name}: ${game.i18n.localize("OSE.dialog.shoppingCart")}`;
  }

  /* -------------------------------------------- */

  /**
   * Construct and return the data object used to render the HTML template for this form application.
   *
   * @returns {object} - The template data
   */
  async getData() {
    const data = await foundry.utils.deepClone(this.object.preparedData);
    
    // Override the cost display to show the bundle cost dynamically
    const updateDisplayCost = (items) => {
      if (!items) return;
      for (let item of items) {
        if (OseCharacterGpCost.physicalItemTypes.has(item.type) && !item.system.treasure && !item.flags?.ose?.paid) {
          item.system.cost = OseCharacterGpCost.getCartItemCost(item);
        }
      }
    };
    
    updateDisplayCost(data.owned?.weapons);
    updateDisplayCost(data.owned?.armors);
    updateDisplayCost(data.owned?.items);
    if (data.owned?.containers) {
      updateDisplayCost(data.owned.containers);
      for (let bag of data.owned.containers) {
        updateDisplayCost(bag.system?.contents);
      }
    }

    data.totalCost = await this.#getTotalCost(data);
    data.user = game.user;
    this.inventory = this.object.items;
    return data;
  }

  async close(options) {
    return super.close(options);
  }

  /**
   * An object that provides options to _onSubmit
   *
   * @typedef submitOptions
   * @property {boolean} preventClose - Should the application be stopped from closing?
   * @property {boolean} preventRender - Should the application be stopped from rendering?
   */

  /**
   * Override Foundry's default _onSubmit event to add our own behaviors
   *
   * @param {Event} event - The native form submit event
   * @param {submitOptions} options - Options for the _onSubmit event
   */
  // eslint-disable-next-line no-underscore-dangle
  async _onSubmit(event, { preventClose = false, preventRender = false } = {}) {
    // eslint-disable-next-line no-underscore-dangle
    await super._onSubmit(event, {
      preventClose,
      preventRender,
    });
    // Generate gold; compute the cost from the actor's live inventory rather
    // than the snapshot taken when the dialog was opened.
    const totalCost = await this.#getTotalCost({ items: [...this.object.items] });

    const gpBank = this.object.items.find((item) => item.name === "GP (Bank)" && item.system.treasure);
    const gp = this.object.items.find((item) => {
      const itemData = item.system;
      return (
        (item.name === game.i18n.localize("OSE.items.gp.short") || item.name === "GP") && // legacy behavior used GP, even for other languages
        itemData.treasure
      );
    });

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
      remainingCost -= deduct;
    }

    if (gp && remainingCost > 0) {
      const deduct = Math.min(gpQty, remainingCost);
      const newQty = Math.round((gpQty - deduct) * 100) / 100;
      updates.push({ _id: gp.id, "system.quantity.value": newQty });
      remainingCost -= deduct;
    }

    if (updates.length > 0) {
      await this.object.updateEmbeddedDocuments("Item", updates);
    }

    // Mark all items in the cart as "paid for" by setting a flag
    await this.#markItemsAsPaid();

    // Close the dialog after successful transaction
    await this.close();
  }

  /**
   * This method is called upon form submission after form data is validated
   *
   * @param {Event} event - The initial triggering submission event
   * @param {object} formData - The object of validated form data with which to update the object
   * @private
   */
  async _updateObject(event, formData) {
    event.preventDefault();

    const speaker = ChatMessage.getSpeaker({ actor: this });
    const templateData = await this.getData();
    const content = `<div><strong>${game.i18n.localize("OSE.dialog.shoppingCart")}</strong><br/>${game.i18n.format("OSE.dialog.purchaseFor", { totalCost: templateData.totalCost })}</div>`;
    ChatMessage.create({
      content,
      speaker,
    });
    // Update the actor
    await this.object.update(formData);

    // Re-draw the updated sheet
    this.object.sheet.render(true);
  }

  static getCartItemCost(item) {
    const itemData = item.system;
    if (!itemData) return 0;
    
    let calculatedCost = 0;
    // If it's a bundled item (has a max quantity and parenthesis in name like 'Case of Bolts (30)'), charge bundle price
    if (/\(\d+\)/.test(item.name) && itemData.quantity?.max > 0) {
      calculatedCost = itemData.cost * itemData.quantity.max;
    } else {
      // Normal item, charge per-unit price * quantity
      calculatedCost = itemData.cost * (itemData.quantity?.value || 1);
    }
    return Math.round(calculatedCost * 100) / 100;
  }

  async #getTotalCost(data) {
    const rawTotal = data.items.reduce((total, item) => {
      const itemData = item.system;
      // Only count non-treasure physical items that haven't been paid for yet
      if (OseCharacterGpCost.physicalItemTypes.has(item.type) && !itemData.treasure && !item.flags?.ose?.paid) {
        return total + OseCharacterGpCost.getCartItemCost(item);
      }

      return total;
    }, 0);
    return Math.round(rawTotal * 100) / 100;
  }

  /**
   * Mark all items in the shopping cart as paid for
   * This prevents them from appearing in the cart on subsequent openings
   * Items remain in inventory but won't be counted in cart calculations
   * @private
   */
  async #markItemsAsPaid() {
    const updates = [];

    this.object.items.forEach((item) => {
      const itemData = item.system;
      // Mark all non-treasure physical items that haven't been paid for yet
      if (OseCharacterGpCost.physicalItemTypes.has(item.type) && !itemData.treasure && !item.flags?.ose?.paid) {
        updates.push({
          _id: item.id,
          "flags.ose.paid": true,
        });
      }
    });

    // Update all items in one batch
    if (updates.length > 0) {
      await this.object.updateEmbeddedDocuments("Item", updates);
    }
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    html.find("a.auto-deduct").click(() => {
      this.submit();
    });
  }
}
