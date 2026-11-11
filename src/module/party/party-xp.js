/**
 * @file An application for dispensing XP to party members.
 */
import { hasActiveDutyXP, resetDutyXP } from "./duty-xp";
import OseParty from "./party";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export default class OsePartyXP extends HandlebarsApplicationMixin(ApplicationV2) {
  /** Bring an open dialog forward instead of stacking duplicates. */
  static open(options = {}) {
    const existing = foundry.applications.instances.get("party-xp");
    if (existing) {
      existing.bringToFront();
      return existing;
    }
    const sheet = new OsePartyXP(options);
    sheet.render({ force: true });
    return sheet;
  }

  static DEFAULT_OPTIONS = {
    id: "party-xp",
    classes: ["ose", "dialog", "party-xp"],
    tag: "form",
    form: {
      handler: OsePartyXP.#onSubmitForm,
      submitOnChange: false,
      closeOnSubmit: true,
    },
    position: { width: 300, height: "auto" },
    window: { resizable: false },
  };

  static PARTS = {
    main: { template: "systems/__SYSTEM_ID__/dist/templates/apps/party-xp.html" },
  };

  get title() {
    return game.i18n.localize("OSE.dialog.xp.deal");
  }

  async _prepareContext() {
    return {
      actors: OseParty.currentParty,
      config: CONFIG.OSE,
      user: game.user,
      settings: game.settings,
    };
  }

  _onRender() {
    this.element.querySelector('input[name="total"]')?.addEventListener("input", () => this._calculateShare());
  }

  _calculateShare() {
    const { currentParty } = OseParty;
    const totalInput = this.element.querySelector('input[name="total"]');
    const totalXP = Number.parseFloat(totalInput?.value ?? "0");
    if (!Number.isFinite(totalXP) || currentParty.length === 0) return;

    const baseXpShare = totalXP / currentParty.length;
    for (const actor of currentParty) {
      const xpShare = Math.floor((actor.system.details.xp.share / 100) * baseXpShare);
      const input = this.element.querySelector(`li[data-actor-id='${actor.id}'] input`);
      if (input) input.value = xpShare;
    }
  }

  static async #onSubmitForm(_event, _form, _formData) {
    return this._submit();
  }

  async _submit() {
    const promises = [];
    for (const row of this.element.querySelectorAll(".actor")) {
      const value = row.querySelector("input")?.value;
      const id = row.dataset.actorId;
      if (!value) continue;
      const xp = Math.floor(Number.parseInt(value, 10));
      if (!Number.isFinite(xp) || xp <= 0) continue;
      const actor = OseParty.currentParty.find((a) => a.id === id);
      if (actor) {
        promises.push(actor.getExperience(xp));
      }
    }
    await Promise.all(promises);

    // Prompt GM to reset Duty XP bonuses if any party members have active duty XP
    const dutyActors = OseParty.currentParty.filter((a) => hasActiveDutyXP(a));
    if (dutyActors.length > 0) {
      const confirmed = await foundry.applications.api.DialogV2.confirm({
        classes: ["ose", "dialog"],
        position: { width: 400, height: "auto" },
        window: {
          title: game.i18n.localize("OSE.dialog.party.resetDutyTitle") || "Reset Duty XP Bonuses?",
        },
        content: `<p>XP has been distributed! <strong>${dutyActors.length} character(s)</strong> currently have active Duty XP (+5%) bonuses. Would you like to reset their XP bonuses back to normal now?</p>`,
        rejectClose: false,
      });
      if (confirmed) {
        await resetDutyXP(dutyActors);
        (this.options?.partySheet ?? foundry.applications?.instances?.get?.("party-sheet"))?.render();
      }
    }
  }
}
