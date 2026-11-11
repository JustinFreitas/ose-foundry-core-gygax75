/**
 * @file Helpful methods for dealing with OSE-specific dice logic
 */
import OSE from "./config";
import { getRollMode, getRollModes } from "./helpers-message-mode";

const OseDice = {
  async sendRoll({
    parts = [],
    data = {},
    title = null,
    flavor = null,
    speaker = null,
    form = null,
    chatMessage = true,
  } = {}) {
    const template = `${OSE.systemPath()}/templates/chat/roll-result.html`;

    const chatData = {
      user: game.user.id,
      speaker,
    };

    const tokenId = data.actor?.token ? `${data.actor.token.parent?.id}.${data.actor.token.id}` : null;
    const templateData = {
      title,
      flavor,
      data,
      config: CONFIG.OSE,
      tokenId,
    };

    const rollParts = [...parts];
    // Optionally include a situational bonus
    if (form?.bonus?.value) {
      rollParts.push(form.bonus.value);
    }

    const roll = new Roll(rollParts.join("+"), data);
    await roll.evaluate({ allowStrings: true });

    // Convert the roll to a chat message and return the roll
    let rollMode = getRollMode();
    rollMode = form ? form.rollMode.value : rollMode;

    // Force blind roll (ability formulas)
    if (!form && data.roll?.blindroll) {
      rollMode = game.user.isGM ? "selfroll" : "blindroll";
    }

    if (["gmroll", "blindroll"].includes(rollMode)) chatData.whisper = ChatMessage.getWhisperRecipients("GM");
    if (rollMode === "selfroll") chatData.whisper = [game.user.id];
    if (rollMode === "blindroll") {
      chatData.blind = true;
      if (data.roll) data.roll.blindroll = true;
    }

    templateData.result = OseDice.digestResult(data, roll);
    templateData.rollOSE = await roll.render();
    chatData.content = await foundry.applications.handlebars.renderTemplate(template, templateData);

    // Dice So Nice
    if (game.dice3d) {
      await game.dice3d.showForRoll(roll, game.user, true, chatData.whisper, chatData.blind);
      if (chatMessage !== false) await ChatMessage.create(chatData);
      return roll;
    }

    chatData.sound = CONFIG.sounds.dice;
    if (chatMessage !== false) await ChatMessage.create(chatData);
    return roll;
  },

  /**
   * Digesting results depending on type of roll
   *
   * @param {object} data - Contains roll data, including what type of check
   * @param {object} roll - Evaluated Roll returned object
   * @returns {object} - Object containing the evaluated data // @todo DigestResult
   */
  digestResult(data, roll) {
    // @todo: Extract this to a DigestResult type/interface
    const result = {
      isSuccess: false,
      isFailure: false,
      target: data.roll?.target,
      total: roll.total,
      direction: "",
    };

    const die = roll.dice?.[0]?.results?.[0]?.result ?? roll.total;
    // eslint-disable-next-line default-case
    switch (data.roll?.type) {
      case "result": {
        result.direction = "OSE.roll.direction.exactly";
        if (roll.total === result.target) {
          result.isSuccess = true;
        } else {
          result.isFailure = true;
        }

        break;
      }

      case "above": {
        result.direction = "OSE.roll.direction.orHigher";
        // SAVING THROWS
        if (roll.total >= result.target) {
          result.isSuccess = true;
        } else {
          result.isFailure = true;
        }

        break;
      }

      case "below": {
        result.direction = "OSE.roll.direction.orLower";
        // MORALE, EXPLORATION
        if (roll.total <= result.target) {
          result.isSuccess = true;
        } else {
          result.isFailure = true;
        }

        break;
      }

      case "check": {
        result.direction = "OSE.roll.direction.orLower";
        // SCORE CHECKS (1s and 20s)
        if (die === 1 || (roll.total <= result.target && die < 20)) {
          result.isSuccess = true;
        } else {
          result.isFailure = true;
        }

        break;
      }

      case "table": {
        // Reaction
        const { table } = data.roll;
        let output = Object.values(table)[0];
        for (let i = 0; i <= roll.total; i++) {
          if (table[i]) {
            output = table[i];
          }
        }
        result.details = output;

        break;
      }

      default: {
        result.isSuccess = false;
        result.isFailure = false;

        break;
      }
    }

    // Without a target, there's no direction to show
    if (result.target == null) result.direction = "";

    return result;
  },

  /**
   * Evaluates if a roll is successful for both THAC0 and Ascending AC
   *
   * @param {object} roll - Evaluated roll data from a Roll
   * @param {number} thac0 - THAC0 value, or Hit Target when AscendingAC
   * @param {number} ac - AC Value, or Attack Bonus when AscendingAC
   * @returns {boolean} - Did the attack succeed?
   */
  attackIsSuccess(roll, thac0, ac) {
    const d20 = roll.dice?.[0]?.results?.[0]?.result ?? roll.terms?.[0]?.results?.[0]?.result;
    // Natural 1
    if (d20 === 1) {
      return false;
    }
    // Natural 20
    if (d20 === 20) {
      return true;
    }
    return roll.total + ac >= thac0;
  },

  /**
   * Digest the results of a target to reach, and an evaluated roll
   * to evaluate if it does hit or not. The function adds information
   * for generating chat card data too.
   *
   * @param {object} data - Data with at least roll target data
   * @param {object} roll - Evaluation result from a Roll
   * @returns {object} - DigestResult
   */
  digestAttackResult(data, roll) {
    // @todo: Extract this to a DigestResult type/interface
    const result = {
      isSuccess: false,
      isFailure: false,
      target: "",
      total: roll.total,
    };
    result.target = data.roll.thac0;
    const targetActorData = data.roll.target?.actor?.system || null;

    const targetAc = data.roll.target ? targetActorData?.ac?.value : 9;
    const targetAac = data.roll.target ? targetActorData?.aac?.value : 10;
    result.victim = data.roll.target || null;

    if (game.settings.get(game.system.id, "ascendingAC")) {
      const attackBonus = 0; // Attack bonus is already included in the roll
      if (this.attackIsSuccess(roll, targetAac, attackBonus) || result.victim == null) {
        result.details = game.i18n.format("OSE.messages.AttackAscendingSuccess", {
          result: roll.total,
        });
        result.isSuccess = true;
      } else {
        result.details = game.i18n.format("OSE.messages.AttackAscendingFailure", {
          bonus: result.target,
        });
        result.isFailure = true;
      }
    } else if (this.attackIsSuccess(roll, result.target, targetAc) || result.victim == null) {
      // Show result in chat card
      const value = result.target - roll.total;
      result.details = game.i18n.format("OSE.messages.AttackSuccess", {
        result: value,
        bonus: result.target,
      });
      result.isSuccess = true;
    } else {
      result.details = game.i18n.format("OSE.messages.AttackFailure", {
        bonus: result.target,
      });
      result.isFailure = true;
    }
    return result;
  },

  /**
   * Puts together the information needed to roll a Roll and the
   * expectations on hitting a target. Also creates the chat card
   * containing the information about the evaluated roll.
   */
  async sendAttackRoll({
    parts = [],
    data = {},
    flags = {},
    title = null,
    flavor = null,
    speaker = null,
    form = null,
  } = {}) {
    if (data.roll.dmg.filter((v) => v !== "").length === 0) {
      ui.notifications.error("Attack has no damage dice terms; be sure to set the attack's damage");
      return;
    }
    const template = `${OSE.systemPath()}/templates/chat/roll-attack.html`;
    const chatData = {
      user: game.user.id,
      speaker,
      flags,
    };

    const tokenId = data.actor?.token ? `${data.actor.token.parent?.id}.${data.actor.token.id}` : null;
    const templateData = {
      title,
      flavor,
      data,
      config: CONFIG.OSE,
      tokenId,
    };

    const rollParts = [...parts];
    // Optionally include a situational bonus
    if (form?.bonus?.value) rollParts.push(form.bonus.value);

    const roll = new Roll(rollParts.join("+"), data);
    await roll.evaluate();
    const dmgRoll = new Roll(data.roll.dmg.join("+"), data);
    await dmgRoll.evaluate();

    // Convert the roll to a chat message and return the roll
    let rollMode = getRollMode();
    rollMode = form ? form.rollMode.value : rollMode;

    // Force blind roll (ability formulas)
    if (data.roll.blindroll) {
      rollMode = game.user.isGM ? "selfroll" : "blindroll";
    }

    if (["gmroll", "blindroll"].includes(rollMode)) chatData.whisper = ChatMessage.getWhisperRecipients("GM");
    if (rollMode === "selfroll") chatData.whisper = [game.user.id];
    if (rollMode === "blindroll") {
      chatData.blind = true;
      data.roll.blindroll = true;
    }

    templateData.result = OseDice.digestAttackResult(data, roll);
    templateData.rollOSE = await roll.render();
    templateData.rollDamage = await dmgRoll.render();
    chatData.content = await foundry.applications.handlebars.renderTemplate(template, templateData);

    // 2 Step Dice So Nice
    if (game.dice3d) {
      await game.dice3d.showForRoll(roll, game.user, true, chatData.whisper, chatData.blind);
      if (templateData.result.isSuccess) {
        templateData.result.dmg = dmgRoll.total;
        await game.dice3d.showForRoll(dmgRoll, game.user, true, chatData.whisper, chatData.blind);
      }
      await ChatMessage.create(chatData);
      return roll;
    }

    chatData.sound = CONFIG.sounds.dice;
    await ChatMessage.create(chatData);
    return roll;
  },

  async RollSave({
    parts = [],
    data = {},
    skipDialog = false,
    speaker = null,
    flavor = null,
    title = null,
    chatMessage = true,
  } = {}) {
    let rolled = false;
    const rollParts = [...parts];
    const template = `${OSE.systemPath()}/templates/chat/roll-dialog.html`;
    const dialogData = {
      formula: rollParts.join(" "),
      data,
      rollMode: getRollMode(),
      rollModes: getRollModes(),
    };

    const rollData = {
      parts: rollParts,
      data,
      title,
      flavor,
      speaker,
      chatMessage,
    };
    if (skipDialog) {
      return OseDice.sendRoll(rollData);
    }

    let roll;

    const buttons = [
      {
        action: "ok",
        label: game.i18n.localize("OSE.Roll"),
        icon: "fas fa-dice-d20",
        default: true,
        callback: (_event, button) => {
          rolled = true;
          rollData.form = button.form;
          roll = OseDice.sendRoll(rollData);
        },
      },
      {
        action: "magic",
        label: game.i18n.localize("OSE.saves.magic.short"),
        icon: "fas fa-magic",
        callback: (_event, button) => {
          rolled = true;
          rollData.form = button.form;
          rollData.parts.push(`${rollData.data.roll.magic}`);
          rollData.title =
            `${rollData.title || ""} ${game.i18n.localize("OSE.saves.magic.short")} (${rollData.data.roll.magic})`.trim();
          roll = OseDice.sendRoll(rollData);
        },
      },
      {
        action: "poison",
        label: game.i18n.localize("OSE.saves.poison.short"),
        icon: "fas fa-skull",
        callback: (_event, button) => {
          rolled = true;
          rollData.form = button.form;
          rollData.parts.push(`${rollData.data.roll.poison}`);
          rollData.title =
            `${rollData.title || ""} ${game.i18n.localize("OSE.saves.poison.short")} (${rollData.data.roll.poison})`.trim();
          roll = OseDice.sendRoll(rollData);
        },
      },
      {
        action: "cancel",
        icon: "fas fa-times",
        label: game.i18n.localize("OSE.Cancel"),
        callback: () => {},
      },
    ];

    const html = await foundry.applications.handlebars.renderTemplate(template, dialogData);

    // Create Dialog window
    return new Promise((resolve) => {
      let settled = false;
      const finish = async () => {
        if (settled) return;
        settled = true;
        resolve(rolled ? await roll : false);
      };
      const dialog = new foundry.applications.api.DialogV2({
        classes: ["ose", "dialog"],
        position: { width: 400, height: "auto" },
        window: { title: title || "" },
        content: html,
        buttons,
        submit: () => finish(),
      });
      dialog.addEventListener?.("close", () => finish());
      dialog.render({ force: true });
    });
  },

  async Roll({
    parts = [],
    data = {},
    skipDialog = false,
    speaker = null,
    flavor = null,
    title = null,
    chatMessage = true,
    flags = {},
    ammoOptions = null,
    onConfirm = null,
  } = {}) {
    let rolled = false;
    const rollParts = [...parts];
    const template = `${OSE.systemPath()}/templates/chat/roll-dialog.html`;
    const dialogData = {
      formula: rollParts.join(" "),
      data,
      rollMode: data.roll?.blindroll ? "blindroll" : getRollMode(),
      rollModes: getRollModes(),
      ammoOptions,
    };
    const rollData = {
      parts: rollParts,
      data,
      title,
      flavor,
      speaker,
      chatMessage,
      flags,
    };
    if (skipDialog) {
      if (typeof onConfirm === "function") {
        const warning = await onConfirm(null, rollData);
        if (warning) {
          rollData.flavor = rollData.flavor ? `${rollData.flavor} [${warning}]` : `[${warning}]`;
          rollData.title = rollData.title ? `${rollData.title} [${warning}]` : `[${warning}]`;
        }
      }
      return ["melee", "missile", "attack"].includes(data.roll?.type)
        ? OseDice.sendAttackRoll(rollData)
        : OseDice.sendRoll(rollData);
    }

    let roll;

    const buttons = [
      {
        action: "ok",
        label: game.i18n.localize("OSE.Roll"),
        icon: "fas fa-dice-d20",
        callback: (_event, button) => {
          rolled = true;
          rollData.form = button.form;
          roll = (async () => {
            if (typeof onConfirm === "function") {
              const warning = await onConfirm(button.form, rollData);
              if (warning) {
                rollData.flavor = rollData.flavor ? `${rollData.flavor} [${warning}]` : `[${warning}]`;
                rollData.title = rollData.title ? `${rollData.title} [${warning}]` : `[${warning}]`;
              }
            }
            return ["melee", "missile", "attack"].includes(data.roll?.type)
              ? OseDice.sendAttackRoll(rollData)
              : OseDice.sendRoll(rollData);
          })();
          return roll;
        },
        default: true,
      },
      {
        action: "cancel",
        icon: "fas fa-times",
        label: game.i18n.localize("OSE.Cancel"),
        callback: () => {},
      },
    ];

    const html = await foundry.applications.handlebars.renderTemplate(template, dialogData);

    // Create Dialog window
    return new Promise((resolve) => {
      let settled = false;
      const finish = async () => {
        if (settled) return;
        settled = true;
        resolve(rolled ? await roll : false);
      };
      const dialog = new foundry.applications.api.DialogV2({
        classes: ["ose", "dialog"],
        position: { width: 400, height: "auto" },
        window: { title: title || "" },
        content: html,
        buttons,
        submit: () => finish(),
      });
      dialog.addEventListener?.("close", () => finish());
      dialog.render({ force: true });
    });
  },
};

export default OseDice;
