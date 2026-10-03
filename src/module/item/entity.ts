import type { ItemTag } from "./item-types";

type AnyItemSystem = any;
type OwningActor = any;

declare const foundry: any;
declare const game: any;
declare const ui: any;
declare const CONFIG: any;
declare const ChatMessage: any;
declare const Item: any;

export default class OseItem extends Item {
  static migrateData(source: any) {
    if (source?.type === "container" && Array.isArray(source.system?.itemIds)) {
      const deduped = [...new Set(source.system.itemIds)];
      if (deduped.length !== source.system.itemIds.length) {
        source.system.itemIds = deduped;
      }
    }
    return typeof super.migrateData === "function" ? super.migrateData(source) : source;
  }

  async _preCreate(data: any, options: any, user: any) {
    const qtyValue = foundry.utils.getProperty(data, "system.quantity.value");
    if (qtyValue !== undefined) {
      const name = data.name;
      if (name !== "GP (Bank)") {
        this.updateSource({ "system.quantity.value": Math.floor(qtyValue) });
      } else {
        this.updateSource({ "system.quantity.value": Math.round(qtyValue * 100) / 100 });
      }
    }
    return super._preCreate(data, options, user);
  }

  async _preUpdate(changed: any, options: any, user: any) {
    const qtyValue = foundry.utils.getProperty(changed, "system.quantity.value");
    if (qtyValue !== undefined) {
      const name = changed.name ?? this.name;
      if (name !== "GP (Bank)") {
        foundry.utils.setProperty(changed, "system.quantity.value", Math.floor(qtyValue));
      } else {
        foundry.utils.setProperty(changed, "system.quantity.value", Math.round(qtyValue * 100) / 100);
      }
    }
    return super._preUpdate(changed, options, user);
  }

  async prepareDerivedData(): Promise<void> {
    // Rich text description
    (this.system as AnyItemSystem).enrichedDescription =
      // `async` was removed from EnrichmentOptions in v13; kept so the call is
      // byte-identical to the JavaScript this replaces.
      await foundry.applications.ux.TextEditor.implementation.enrichHTML((this.system as AnyItemSystem).description, {
        async: true,
      } as never);
  }

  async roll(options: Record<string, unknown> = {}) {
    const itemData = this.system as any;
    switch (this.type) {
      case "weapon":
        return this.rollWeapon(options);
      case "spell":
        return this.rollSpell(options);
      case "ability":
        if (itemData.roll) {
          return this.rollFormula(options);
        }
        return this.show(options);
      case "item":
      case "armor":
        return this.show(options);
      default:
        return this.rollFormula(options);
    }
  }

  async rollWeapon(options: Record<string, unknown> = {}) {
    const actor = this.actor as OwningActor;
    const isNPC = (actor?.type as string) !== "character";
    const itemData = this.system as any;

    let type = isNPC ? "attack" : "melee";
    const rollData = {
      item: this._source,
      actor: this.actor as OwningActor,
      roll: {
        save: itemData.save,
        target: null,
      },
    };

    if (itemData.missile && itemData.melee && !isNPC) {
      new (foundry.applications.api as any).DialogV2({
        classes: ["ose", "dialog"],
        window: { title: "Choose Attack Range" },
        position: { width: 400, height: "auto" },
        content: "",
        buttons: [
          {
            action: "melee",
            icon: "fas fa-fist-raised",
            label: game.i18n.localize("OSE.Melee"),
            default: true,
            callback: () => {
              (actor as any).targetAttack(rollData, "melee", options);
            },
          },
          {
            action: "missile",
            icon: "fas fa-bullseye",
            label: game.i18n.localize("OSE.Missile"),
            callback: async () => {
              if (await this._handleAmmoConsumption(options)) {
                (actor as any).targetAttack(rollData, "missile", options);
              }
            },
          },
        ],
      }).render(true);
      return true;
    }
    if (itemData.missile && !isNPC) {
      type = "missile";
      if (!(await this._handleAmmoConsumption(options))) {
        return false;
      }
    }
    (actor as any).targetAttack(rollData, type, options);
    return true;
  }

  async _handleAmmoConsumption(options: any) {
    const mode = game.settings?.get(game.system.id, "automateAmmo") ?? "disabled";
    if (mode === "disabled") return true;

    const itemName = this.name.toLowerCase();

    let requiredAmmo: string[] | null = null;
    let isThrown = false;

    if (itemName.includes("crossbow")) {
      requiredAmmo = ["bolt", "quarrel"];
    } else if (itemName.includes("bow")) {
      requiredAmmo = ["arrow"];
    } else if (itemName.includes("sling")) {
      requiredAmmo = ["stone", "bullet"];
    } else if (itemName.includes("blowpipe") || itemName.includes("blowgun")) {
      requiredAmmo = ["dart"];
    } else {
      isThrown = true;
    }

    if (isThrown) {
      if ((this.system as any).quantity?.value <= 0 && mode === "enforce") {
        ui.notifications?.error(game.i18n.format("OSE.error.outOfAmmo", { name: this.name }));
        return false;
      }
      options.onConfirm = async () => {
        if ((this.system as any).quantity?.value > 0) {
          await this.update({ "system.quantity.value": (this.system as any).quantity.value - 1 });
          return null;
        }
        return game.i18n.format("OSE.error.outOfAmmo", { name: this.name });
      };
      return true;
    }
    const validAmmo = (this.actor as any).items.filter((i: any) => {
      if (i.type !== "item" && i.type !== "weapon") return false;
      const iName = i.name.toLowerCase();
      return requiredAmmo?.some((req) => iName.includes(req));
    });

    const availableAmmo = validAmmo.filter((i: any) => i.system.quantity?.value > 0);

    if (availableAmmo.length === 0) {
      if (mode === "enforce") {
        ui.notifications?.error(game.i18n.format("OSE.error.noAmmoFound", { type: requiredAmmo?.[0] }));
        return false;
      }
      options.onConfirm = async () => {
        return game.i18n.format("OSE.error.noAmmoFound", { type: requiredAmmo?.[0] });
      };
      return true;
    }

    availableAmmo.sort((a: any, b: any) => {
      const aMagic = a.name.includes("+");
      const bMagic = b.name.includes("+");
      if (aMagic && !bMagic) return 1;
      if (!aMagic && bMagic) return -1;
      return a.name.localeCompare(b.name);
    });

    options.ammoOptions = availableAmmo.map((a: any) => ({
      id: a.id,
      name: a.name,
      quantity: a.system.quantity.value,
    }));
    options.onConfirm = async (form: any) => {
      // If skipDialog was used, form is null, so use the first ammo
      const ammoId = form?.elements?.ammoId?.value || options.ammoOptions[0].id;
      const ammoItem = (this.actor as any).items.get(ammoId);
      if (ammoItem) {
        await ammoItem.update({ "system.quantity.value": ammoItem.system.quantity.value - 1 });
        return `${ammoItem.name} (${ammoItem.system.quantity.value - 1} left)`;
      }
      return null;
    };
    return true;
  }

  async rollFormula(options: { event?: Event } = {}) {
    const itemData = this.system as any;

    if (!itemData.roll) {
      throw new Error("This item does not have a formula to roll!");
    }

    const label = `${this.name}`;
    const rollParts = [itemData.roll];
    const rollData = {
      actor: this.actor,
      item: this,
    };

    return (this.actor as any)?.rollFormula({
      parts: rollParts,
      data: rollData,
      skipDialog: true,
      speaker: ChatMessage.getSpeaker({ actor: this as any }),
      flavor: game.i18n.format("OSE.roll.formula", { label }),
      title: game.i18n.format("OSE.roll.formula", { label }),
    } as never);
  }

  async spendSpell(options: Record<string, unknown> = {}) {
    if (this.type !== "spell") throw new Error("Trying to spend a spell on an item that is not a spell.");

    const itemData = this.system as any;
    if (itemData.cast <= 0) {
      ui.notifications?.warn("This spell has no remaining casts.");
      return;
    }

    await this.update({
      system: {
        cast: (itemData.cast ?? 0) - 1,
      },
    });

    if (itemData.roll) {
      await this.rollFormula(options);
    } else {
      await this.show(options);
    }
  }

  async rollSpell(options: Record<string, unknown> = {}) {
    return this.spendSpell(options);
  }

  async getChatData(_htmlOptions?: unknown) {
    const itemType = this.type;
    const itemData = this.system as AnyItemSystem;

    // Item properties
    const props = [];

    if (itemType === "weapon") {
      for (const t of itemData.tags ?? []) {
        props.push(t.value);
      }
    }
    if (itemType === "spell") {
      props.push(`${itemData.class} ${itemData.lvl}`, itemData.range, itemData.duration);
    }
    if (Object.hasOwn(itemData, "equipped")) {
      props.push(itemData.equipped ? "Equipped" : "Not Equipped");
    }

    // Filter properties and return
    itemData.properties = props.filter((p: any) => !!p);
    return itemData;
  }

  async show(_options: Record<string, unknown> = {}) {
    const itemType = this.type;
    // Basic template rendering data
    const token = (this.actor as OwningActor | null)?.token;
    const templateData: Record<string, unknown> = {
      actor: this.actor as OwningActor,
      tokenId: token ? `${token.parent?.id}.${token.id}` : null,
      item: this._source,
      itemId: (this._source as { _id?: string })._id,
      data: await this.getChatData(),
      labels: (this as unknown as Record<string, unknown>).labels,
      isHealing: (this as unknown as Record<string, unknown>).isHealing,
      hasDamage: (this as unknown as Record<string, unknown>).hasDamage,
      isSpell: itemType === "spell",
      hasSave: (this as unknown as Record<string, unknown>).hasSave,
      config: CONFIG.OSE,
    };
    const chatItemData = templateData.data as AnyItemSystem;
    if (chatItemData.roll) {
      templateData.rollFormula = new (globalThis as any).Roll(chatItemData.roll ?? "", templateData).formula;
    }
    chatItemData.properties = (this.system as any).autoTags;

    // Render the chat card template
    const template = `${(CONFIG as any).OSE?.systemPath?.() ?? "systems/ose"}/templates/chat/item-card.html`;
    const html = await foundry.applications.handlebars.renderTemplate(template, templateData);

    // Basic chat message data
    const chatData: Record<string, unknown> = {
      user: game.user.id,
      style: (CONST as any).CHAT_MESSAGE_STYLES?.OTHER ?? 0,
      content: html,
      speaker: {
        actor: (this.actor as OwningActor | null)?.id,
        token: (this.actor as OwningActor | null)?.token,
        alias: (this.actor as OwningActor | null)?.name,
      },
    };

    // Toggle default roll mode
    const rollMode =
      typeof (game as any).settings?.get === "function" ? (game as any).settings.get("core", "rollMode") : "publicroll";
    if (["gmroll", "blindroll"].includes(rollMode)) (chatData as any).whisper = ChatMessage.getWhisperRecipients("GM");
    if (rollMode === "selfroll") (chatData as any).whisper = [game.user.id];
    if (rollMode === "blindroll") (chatData as any).blind = true;

    // Create the chat message
    return ChatMessage.create(chatData as never);
  }

  async pushManualTag(values: string[]) {
    const data = this?.system as any;
    const update = data.tags ? [...data.tags] : [];
    const newData: Record<string, any> = {};
    const regExp = /\(([^)]+)\)/;
    values.forEach((val) => {
      // Catch infos in brackets
      const matches = regExp.exec(val);
      let title = "";
      let trimmedVal = "";
      if (matches) {
        title = matches[1];
        trimmedVal = val.slice(0, Math.max(0, matches.index)).trim();
      } else {
        trimmedVal = val.trim();
        title = trimmedVal;
      }
      // Auto fill checkboxes
      let isCheckboxTag = false;
      const meleeTag = (CONFIG.OSE?.tags?.melee ?? "Melee").toLowerCase();
      const slowTag = (CONFIG.OSE?.tags?.slow ?? "Slow").toLowerCase();
      const missileTag = (CONFIG.OSE?.tags?.missile ?? "Missile").toLowerCase();

      switch (title.toLowerCase()) {
        case meleeTag: {
          newData.melee = true;
          isCheckboxTag = true;
          break;
        }

        case slowTag: {
          newData.slow = true;
          isCheckboxTag = true;
          break;
        }

        case missileTag: {
          newData.missile = true;
          isCheckboxTag = true;
          break;
        }
      }

      // Add the tag if it has a specific title or if it is not a checkbox
      if (title !== trimmedVal || !isCheckboxTag) {
        update.push({
          title,
          value: trimmedVal,
          label: trimmedVal,
        });
      }

      if (trimmedVal === "Two-handed" && this.type === "weapon") {
        newData.itemslots = 2;
      }
    });
    newData.tags = update;
    return this.update({ system: newData });
  }

  async popManualTag(value: string) {
    const itemData = this.system as any;
    const { tags } = itemData;
    if (!tags) return;

    const update = tags.filter((el: any) => el.value.toLowerCase() !== value.toLowerCase());
    const newData = {
      tags: update,
    };
    return this.update({ system: newData });
  }

  static async _onChatCardAction(event: Event) {
    event.preventDefault();

    // Extract card data
    const button = (event.target as HTMLElement).closest(".card-buttons button") as HTMLButtonElement;
    button.disabled = true;
    try {
      const card = button.closest(".chat-card") as HTMLElement;
      const { messageId } = (card.closest(".message") as HTMLElement).dataset;
      const message = game.messages.get(messageId as string);
      const { action } = button.dataset;

      // Validate permission to proceed with the roll
      const isTargetted = action === "save";
      if (!(isTargetted || game.user.isGM || message?.isAuthor)) return;

      // Get the Actor from a synthetic Token
      const actor = OseItem._getChatCardActor(card);
      if (!actor) return;

      // Get the Item
      const item = (actor as any).items.get(card.dataset.itemId as string) as
        | (OseItem & Record<string, any>)
        | undefined;
      if (!item) {
        return ui.notifications?.error(
          game.i18n.format("OSE.error.itemNoLongerExistsOnActor", {
            actorName: (actor as any).name,
            itemId: card.dataset.itemId ?? "",
          }),
        );
      }

      // Get card targets
      let targets: OwningActor[] = [];
      if (isTargetted) {
        targets = OseItem._getChatCardTargets(card);
      }

      // Attack and Damage Rolls
      switch (action) {
        case "damage": {
          const attData = {
            item: (item as any)._source,
            roll: {
              dmg: (item.system as any).damage,
              type: (item.system as any).missile && !(item.system as any).melee ? "missile" : "melee",
            },
            label: item.name,
          };
          await (actor as any).rollDamage(attData, { event });
          break;
        }

        case "formula": {
          await item.rollFormula({ event });
          break;
        }

        case "save": {
          if (targets.length === 0) {
            ui.notifications?.error(game.i18n.localize("OSE.error.noTokenControlled"));
            return;
          }
          for (const t of targets) {
            await (t as any).rollSave(button.dataset.save as string, { event });
          }
          break;
        }
      }
    } finally {
      button.disabled = false;
    }
  }

  static _getChatCardActor(card: HTMLElement): OwningActor | null {
    // Case 1 - a synthetic actor from a Token
    const tokenKey = card.dataset.tokenId;
    if (tokenKey) {
      const [sceneId, tokenId] = tokenKey.split(".");
      const scene = game.scenes.get(sceneId as string);
      if (!scene) return null;
      const tokenDocument = scene.getEmbeddedDocument("Token", tokenId as string);
      return (tokenDocument as any)?.actor ?? null;
    }

    // Case 2 - use Actor ID directory
    const actorId = card.dataset.actorId;
    return game.actors.get(actorId as string) ?? null;
  }

  static _getChatCardTargets(_card: HTMLElement): OwningActor[] {
    const character = game.user.character;
    const controlled = canvas?.tokens?.controlled ?? [];
    let targets = controlled.reduce((acc: OwningActor[], t: any) => {
      if (t.actor) acc.push(t.actor as OwningActor);
      return acc;
    }, []);
    if (character && targets.length === 0) targets = [character];
    return targets;
  }
}
