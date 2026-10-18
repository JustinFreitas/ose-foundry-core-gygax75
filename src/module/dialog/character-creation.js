/**
 * @file The Character Creator application.
 */
import OSE from "../config";
import OseDice from "../helpers-dice";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

const SCORE_KEYS = Object.keys(OSE.scores);

export default class OseCharacterCreator extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(document, options = {}) {
    super(options);
    this.document = document;
    this.counters = { str: 0, int: 0, dex: 0, wis: 0, con: 0, cha: 0, gold: 0 };
    this.stats = { sum: 0, avg: 0, std: 0 };
    this.scores = {};
    this.gold = 0;
    this.subParRerolls = 0;
  }

  /** Bring an open dialog forward (closing if it's for a different actor) before creating a new one. */
  static open(document, options = {}) {
    const existing = foundry.applications.instances.get("character-creator");
    if (existing?.document === document) {
      existing.bringToFront();
      return existing;
    }
    existing?.close();
    const sheet = new OseCharacterCreator(document, options);
    sheet.render({ force: true });
    return sheet;
  }

  static DEFAULT_OPTIONS = {
    id: "character-creator",
    classes: ["ose", "dialog", "creator"],
    tag: "form",
    form: {
      handler: OseCharacterCreator.#onSubmitForm,
      submitOnChange: false,
      closeOnSubmit: true,
    },
    position: { width: 320, height: "auto" },
    window: { resizable: true },
    actions: {
      rollScore: OseCharacterCreator._onRollScore,
      rollGold: OseCharacterCreator._onRollGold,
      autoRoll: OseCharacterCreator._onAutoRoll,
    },
  };

  static PARTS = {
    main: { template: "systems/__SYSTEM_ID__/dist/templates/actors/dialogs/character-creation.html" },
  };

  get title() {
    return `${this.document.name}: ${game.i18n.localize("OSE.dialog.generator")}`;
  }

  async _prepareContext() {
    const context = this.document.toObject();
    context.user = game.user;
    context.config = CONFIG.OSE;
    return context;
  }

  /** Wire the score-value `change` listeners after each render (action map doesn't cover input events). */
  _onRender() {
    this.element.querySelectorAll("input.score-value").forEach((input) => {
      input.addEventListener("change", (ev) => {
        const { score } = ev.currentTarget.closest("[data-score]")?.dataset ?? {};
        const value = Number.parseInt(ev.currentTarget.value, 10);
        if (score && !Number.isNaN(value)) {
          this.scores[score] = { value };
        }
        this._recomputeStats();
      });
    });
  }

  async rollScore(score, options = {}) {
    this.counters[score] += 1;
    const label = score === "gold" ? "Gold" : game.i18n.localize(`OSE.scores.${score}.long`);
    const data = { roll: {} };
    if (options.skipMessage) {
      const skipMessageRoll = new Roll("3d6");
      await skipMessageRoll.evaluate();
      return skipMessageRoll;
    }
    return OseDice.Roll({
      event: options.event,
      parts: ["3d6"],
      data,
      skipDialog: true,
      speaker: ChatMessage.getSpeaker({ actor: this.document }),
      flavor: game.i18n.format("OSE.dialog.generateScore", { score: label, count: this.counters[score] }),
      title: game.i18n.format("OSE.dialog.generateScore", { score: label, count: this.counters[score] }),
    });
  }

  _recomputeStats() {
    const values = Object.values(this.scores);
    const n = values.length;
    if (n === 0) return;
    const sum = values.reduce((acc, next) => acc + next.value, 0);
    const mean = sum / n;
    const std = Math.sqrt(values.map((x) => (x.value - mean) ** 2).reduce((acc, next) => acc + next, 0) / n);
    const lowScoresCount = values.filter((x) => x.value <= 8).length;
    const isSubPar = n >= 6 && (sum <= 55 || lowScoresCount >= 2);

    this.stats = {
      sum,
      avg: Math.round((10 * sum) / n) / 10,
      std: Math.round(100 * std) / 100,
      isSubPar,
    };
    // Update the display
    const statsContainer = this.element.querySelector(".roll-stats");
    if (statsContainer) {
      const sumEl = statsContainer.querySelector(".sum");
      if (sumEl) sumEl.textContent = this.stats.sum;
      const avgEl = statsContainer.querySelector(".avg");
      if (avgEl) avgEl.textContent = this.stats.avg;
      const stdEl = statsContainer.querySelector(".std");
      if (stdEl) stdEl.textContent = this.stats.std;

      let warning = statsContainer.querySelector(".subpar-warning");
      if (isSubPar) {
        if (!warning) {
          warning = document.createElement("div");
          warning.className = "subpar-warning";
          warning.style.cssText =
            "color: #c9302c; font-weight: bold; font-size: 0.85em; margin-top: 6px; text-align: center;";
          warning.textContent =
            game.i18n.localize("OSE.dialog.subparWarning") || "⚠️ Sub-Par Character (Total ≤ 55 or 2+ scores ≤ 8)";
          statsContainer.appendChild(warning);
        }
      } else if (warning) {
        warning.remove();
      }
    }
    // Enable the submit button once all six scores have been rolled
    if (n >= 6) {
      this.element.querySelector('button[type="submit"]')?.removeAttribute("disabled");
    }
  }

  static _onRollScore(event, target) {
    return this._handleRollScore(event, target);
  }
  static _onRollGold(event, target) {
    return this._handleRollGold(event, target);
  }
  static _onAutoRoll(event) {
    return this._handleAutoRoll(event);
  }

  async _handleRollScore(event, target) {
    const row = target.closest("[data-score]");
    const score = row.dataset.score;
    const r = await this.rollScore(score, { event });
    this.scores[score] = { value: r.total };
    row.querySelector("input.score-value").value = r.total;
    this._recomputeStats();
  }

  async _handleRollGold(event, target) {
    const container = target.closest(".roll-stats");
    const r = await this.rollScore("gold", { event });
    this.gold = 10 * r.total;
    container.querySelector(".gold-value").value = this.gold;
  }

  async _handleAutoRoll(event) {
    let subPar = true;
    let rerollCount = 0;
    while (subPar && rerollCount < 1000) {
      let total = 0;
      let count8orLess = 0;
      for (const score of SCORE_KEYS) {
        const r = await this.rollScore(score, { event, skipMessage: true });
        this.scores[score] = { value: r.total };
        total += r.total;
        if (r.total <= 8) {
          count8orLess++;
        }
      }
      if (total > 55 && count8orLess < 2) {
        subPar = false;
      } else {
        rerollCount++;
      }
    }
    this.subParRerolls = rerollCount;
    for (const score of SCORE_KEYS) {
      const input = this.element.querySelector(`[data-score="${score}"] input.score-value`);
      if (input) input.value = this.scores[score].value;
    }
    this._recomputeStats();
    const goldRoll = await this.rollScore("gold", { event, skipMessage: true });
    this.gold = 10 * goldRoll.total;
    const goldInput = this.element.querySelector(".roll-stats .gold-value");
    if (goldInput) goldInput.value = this.gold;
    this.element.requestSubmit();
  }

  static async #onSubmitForm(_event, _form, _formData) {
    return this._submit();
  }

  async _submit() {
    // Persist scores on the actor
    await this.document.update({ system: { scores: this.scores } });

    // Post the creation summary to chat
    const speaker = ChatMessage.getSpeaker({ actor: this.document });
    const templateData = {
      config: CONFIG.OSE,
      scores: this.scores,
      title: game.i18n.localize("OSE.dialog.generator"),
      stats: this.stats,
      gold: this.gold,
      rerolls: this.subParRerolls,
      data: { actor: this.document },
      actor: this.document,
    };
    const content = await foundry.applications.handlebars.renderTemplate(
      "systems/__SYSTEM_ID__/dist/templates/chat/roll-creation.html",
      templateData,
    );
    await ChatMessage.create({
      style: CONST.CHAT_MESSAGE_STYLES?.OTHER ?? 0,
      content,
      speaker,
    });

    // Drop the rolled gold into inventory as GP (Bank) if available
    if (this.gold > 0) {
      const gpBankItem = this.document.items.find((i) => i.name === "GP (Bank)");
      if (gpBankItem) {
        await gpBankItem.update({ "system.quantity.value": this.gold });
      } else {
        const worldGpBank = game.items.find((i) => i.name === "GP (Bank)" && i.type === "item");
        if (worldGpBank) {
          const itemData = worldGpBank.toObject();
          itemData.system.quantity = itemData.system.quantity || {};
          itemData.system.quantity.value = this.gold;
          await this.document.createEmbeddedDocuments("Item", [itemData]);
        } else {
          const itemData = {
            name: "GP (Bank)",
            type: "item",
            img: `${OSE.assetsPath}/gold.png`,
            system: {
              treasure: true,
              cost: 1,
              weight: 0,
              quantity: { value: this.gold },
            },
          };
          await this.document.createEmbeddedDocuments("Item", [itemData]);
        }
      }
    }
  }
}
