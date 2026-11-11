/**
 * @file An application for deducting currency from an actor using the Shopping Cart feature.
 */
const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;
const cloneData = (val) => (foundry.utils.deepClone ? foundry.utils.deepClone(val) : structuredClone(val));

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
    position: { width: 400, height: "auto" },
    window: { resizable: true },
  };

  static PARTS = {
    main: { template: "systems/__SYSTEM_ID__/dist/templates/actors/dialogs/gp-cost-dialog.html" },
  };

  get title() {
    return `${this.document.name}: ${game.i18n.localize("OSE.dialog.shoppingCart")}`;
  }

  static #computeLineCost(item) {
    const itemData = item?.system ?? {};
    const rawCost = Number(item?._unitCost ?? itemData.cost) || 0;
    const max = Number(itemData.quantity?.max) || 0;
    const qty = item?.type === "armor" ? itemData.quantity?.value || 1 : (itemData.quantity?.value ?? 1);
    const lineCost = max > 0 ? (rawCost / max) * qty : rawCost * qty;
    return Math.round(lineCost * 100) / 100;
  }

  static #isUnpaidPhysicalItem(item) {
    return (
      Boolean(item) &&
      OseCharacterGpCost.physicalItemTypes.has(item.type) &&
      !item.system?.treasure &&
      !item.flags?.ose?.paid
    );
  }

  static #toCartItemViewModel(item, { forceZeroCost = false } = {}) {
    const itemData = item?.system ?? {};
    const rawCost = Number(item?._unitCost ?? itemData.cost) || 0;
    const max = Number(itemData.quantity?.max) || 0;
    const qty = item?.type === "armor" ? itemData.quantity?.value || 1 : (itemData.quantity?.value ?? 1);
    let bundleTooltip;
    if (!forceZeroCost && max > 0 && rawCost > 0) {
      const perItem = Math.round((rawCost / max) * 1000) / 1000;
      bundleTooltip = `Per-unit cost: ${perItem}`;
    }
    const isIdentified = item?.isIdentified ?? itemData.identified !== false;
    const displayName = item?.displayName ?? (!game?.user?.isGM && !isIdentified ? "Unidentified Item" : item?.name);

    return {
      id: item?.id,
      name: displayName,
      displayName,
      img: item?.img,
      type: item?.type,
      isIdentified,
      _unitCost: rawCost,
      flags: cloneData(item?.flags ?? {}),
      enrichedDescription: item?.enrichedDescription ?? itemData.description ?? "",
      system: {
        cost: forceZeroCost ? 0 : OseCharacterGpCost.#computeLineCost(item),
        treasure: Boolean(itemData.treasure),
        containerId: itemData.containerId ?? "",
        bundleTooltip,
        quantity: {
          value: qty,
          max,
        },
        autoTags: game?.user?.isGM || isIdentified ? cloneData(itemData.autoTags ?? []) : [],
      },
    };
  }

  #buildOwnedCartViewModels() {
    const liveItems = this.document?.items ? [...this.document.items] : null;
    if (liveItems && liveItems.length > 0) {
      const weapons = [];
      const armors = [];
      const items = [];
      const containers = [];

      for (const item of liveItems) {
        const containerId = item.system?.containerId;
        if (item.type === "container" && !containerId) {
          const rawChildren = Array.isArray(item.system?.contents)
            ? item.system.contents
            : liveItems.filter((c) => c.system?.containerId === item.id || item.system?.itemIds?.includes?.(c.id));
          const unpaidChildren = rawChildren
            .filter((child) => OseCharacterGpCost.#isUnpaidPhysicalItem(child))
            .map((child) => OseCharacterGpCost.#toCartItemViewModel(child));
          const bagPaid = Boolean(item.flags?.ose?.paid);
          if (!bagPaid || unpaidChildren.length > 0) {
            const bagVm = OseCharacterGpCost.#toCartItemViewModel(item, { forceZeroCost: bagPaid });
            bagVm.system.contents = unpaidChildren;
            containers.push(bagVm);
          }
          continue;
        }

        if (containerId || !OseCharacterGpCost.#isUnpaidPhysicalItem(item)) continue;
        if (item.type === "weapon") weapons.push(OseCharacterGpCost.#toCartItemViewModel(item));
        else if (item.type === "armor") armors.push(OseCharacterGpCost.#toCartItemViewModel(item));
        else if (item.type === "item") items.push(OseCharacterGpCost.#toCartItemViewModel(item));
      }

      return { owned: { weapons, armors, items, containers }, allItems: liveItems };
    }

    const srcOwned = this.preparedData?.owned ?? {};
    const mapList = (list) =>
      (list ?? [])
        .filter((item) => OseCharacterGpCost.#isUnpaidPhysicalItem(item))
        .map((item) => OseCharacterGpCost.#toCartItemViewModel(item));
    const containers = [];
    for (const bag of srcOwned.containers ?? []) {
      const unpaidChildren = (bag.system?.contents ?? [])
        .filter((child) => OseCharacterGpCost.#isUnpaidPhysicalItem(child))
        .map((child) => OseCharacterGpCost.#toCartItemViewModel(child));
      const bagPaid = Boolean(bag.flags?.ose?.paid);
      if (!bagPaid || unpaidChildren.length > 0) {
        const bagVm = OseCharacterGpCost.#toCartItemViewModel(bag, { forceZeroCost: bagPaid });
        bagVm.system.contents = unpaidChildren;
        containers.push(bagVm);
      }
    }

    return {
      owned: {
        weapons: mapList(srcOwned.weapons),
        armors: mapList(srcOwned.armors),
        items: mapList(srcOwned.items),
        containers,
      },
      allItems: this.preparedData?.items ?? [
        ...(srcOwned.weapons ?? []),
        ...(srcOwned.armors ?? []),
        ...(srcOwned.items ?? []),
        ...(srcOwned.containers ?? []).flatMap((b) => [b, ...(b.system?.contents ?? [])]),
      ],
    };
  }

  async _prepareContext() {
    const { owned, allItems } = this.#buildOwnedCartViewModels();
    const context = {
      name: this.document?.name ?? this.preparedData?.name ?? "",
      owned,
      totalCost: await this._getTotalCost({ items: allItems }),
      user: game.user,
    };
    return context;
  }

  static async #onSubmitForm(_event, _form, _formData) {
    return this._submit();
  }

  async _submit() {
    // Compute cost from the actor's live inventory rather than a stale snapshot.
    const totalCost = await this._getTotalCost({ items: [...this.document.items] });

    const gpShort = game.i18n.localize("OSE.items.gp.short");
    const gpBank = this.document.items.find((item) => item.name === "GP (Bank)" && item.system.treasure);
    const gp = this.document.items.find(
      (item) => (item.name === gpShort || item.name === "GP") && item.system.treasure,
    );

    const gpBankQty = gpBank ? gpBank.system.quantity.value : 0;
    const gpQty = gp ? gp.system.quantity.value : 0;

    if (gpBankQty + gpQty < totalCost) {
      ui.notifications.error(game.i18n.localize("OSE.error.notEnoughGP"));
      return;
    }

    let remainingCost = totalCost;
    const updates = [];
    const coinsToCreate = [];

    if (gpBank && remainingCost > 0) {
      const deduct = Math.min(gpBankQty, remainingCost);
      const newQty = Math.round((gpBankQty - deduct) * 100) / 100;
      updates.push({ _id: gpBank.id, "system.quantity.value": newQty });
      remainingCost = Math.round((remainingCost - deduct) * 100) / 100;
    }

    const remainingCp = Math.round(remainingCost * 100);
    if (gp && remainingCp > 0) {
      const wholeGp = Math.ceil(remainingCp / 100);
      if (gpQty < wholeGp) {
        ui.notifications.error(game.i18n.localize("OSE.error.notEnoughGP"));
        return;
      }
      const newGpQty = Math.round((gpQty - wholeGp) * 100) / 100;
      updates.push({ _id: gp.id, "system.quantity.value": newGpQty });

      const changeCp = wholeGp * 100 - remainingCp;
      const spChange = Math.floor(changeCp / 10);
      const cpChange = changeCp % 10;

      if (spChange > 0) {
        const spShort = game.i18n.localize("OSE.items.sp.short");
        const existingSp = this.document.items.find(
          (item) =>
            (item.name === "SP" || (spShort !== "OSE.items.sp.short" && item.name === spShort)) && item.system.treasure,
        );
        if (existingSp) {
          updates.push({
            _id: existingSp.id,
            "system.quantity.value": (existingSp.system.quantity?.value ?? 0) + spChange,
          });
        } else {
          coinsToCreate.push({
            name: "SP",
            type: "item",
            img: "icons/commodities/currency/coins-plain-stack-silver.webp",
            flags: { ose: { paid: true } },
            system: {
              treasure: true,
              cost: 0.1,
              weight: 1,
              quantity: { value: spChange, max: 0 },
            },
          });
        }
      }

      if (cpChange > 0) {
        const cpShort = game.i18n.localize("OSE.items.cp.short");
        const existingCp = this.document.items.find(
          (item) =>
            (item.name === "CP" || (cpShort !== "OSE.items.cp.short" && item.name === cpShort)) && item.system.treasure,
        );
        if (existingCp) {
          updates.push({
            _id: existingCp.id,
            "system.quantity.value": (existingCp.system.quantity?.value ?? 0) + cpChange,
          });
        } else {
          coinsToCreate.push({
            name: "CP",
            type: "item",
            img: "icons/commodities/currency/coins-assorted-mix-copper.webp",
            flags: { ose: { paid: true } },
            system: {
              treasure: true,
              cost: 0.01,
              weight: 1,
              quantity: { value: cpChange, max: 0 },
            },
          });
        }
      }

      remainingCost = 0;
    }

    // Capture receipt view-model before marking items as paid.
    const receiptContext = await this._prepareContext();

    if (updates.length > 0) {
      await this.document.updateEmbeddedDocuments("Item", updates);
    }
    if (coinsToCreate.length > 0) {
      await this.document.createEmbeddedDocuments("Item", coinsToCreate);
    }

    await this._markItemsAsPaid();

    // Post the cart receipt to chat
    const content = await foundry.applications.handlebars.renderTemplate(
      "systems/__SYSTEM_ID__/dist/templates/chat/inventory-list.html",
      receiptContext,
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
      if (OseCharacterGpCost.#isUnpaidPhysicalItem(item)) {
        const itemData = item.system ?? {};
        const rawCost = Number(item._unitCost ?? itemData.cost) || 0;
        const max = Number(itemData.quantity?.max) || 0;
        const qty = item.type === "armor" ? itemData.quantity?.value || 1 : (itemData.quantity?.value ?? 1);
        if (max > 0) {
          return total + (rawCost / max) * qty;
        }
        return total + rawCost * qty;
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
