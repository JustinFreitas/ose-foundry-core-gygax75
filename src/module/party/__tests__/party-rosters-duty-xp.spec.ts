/**
 * @file Unit tests for Party Sheet Roster Management and Duty XP.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetDutyXP } from "../../helpers-party";
import OseParty from "../party";
import OsePartySheet from "../party-sheet";

describe("Party Sheet Rosters & Duty XP", () => {
  beforeEach(async () => {
    (globalThis as any).game.user = { isGM: true };
    (globalThis as any).game.actors = [];
    (globalThis as any).settingsStore.set("ose.savedParties", {});
    vi.clearAllMocks();
  });

  describe("OsePartySheet.onDeleteActor", () => {
    it("prunes the deleted actor ID from all saved parties", async () => {
      const initialParties = {
        "Dungeon Crawlers": ["actor-1", "actor-2", "actor-3"],
        "Wilderness Scouts": ["actor-2", "actor-4"],
      };
      await (globalThis as any).game.settings.set("ose", "savedParties", initialParties);

      await OsePartySheet.onDeleteActor({ id: "actor-2" });

      const updated = (globalThis as any).game.settings.get("ose", "savedParties");
      expect(updated).toEqual({
        "Dungeon Crawlers": ["actor-1", "actor-3"],
        "Wilderness Scouts": ["actor-4"],
      });
    });

    it("does nothing if caller is not GM", async () => {
      (globalThis as any).game.user = { isGM: false };
      const initialParties = { "Alpha Team": ["actor-1"] };
      await (globalThis as any).game.settings.set("ose", "savedParties", initialParties);

      await OsePartySheet.onDeleteActor({ id: "actor-1" });

      const updated = (globalThis as any).game.settings.get("ose", "savedParties");
      expect(updated).toEqual(initialParties);
    });

    it("does not write settings if deleted actor was not in any saved party", async () => {
      const initialParties = { "Alpha Team": ["actor-1"] };
      await (globalThis as any).game.settings.set("ose", "savedParties", initialParties);

      const setSpy = vi.spyOn((globalThis as any).game.settings, "set");
      setSpy.mockClear();
      await OsePartySheet.onDeleteActor({ id: "actor-999" });

      expect(setSpy).not.toHaveBeenCalled();
    });
  });

  describe("resetDutyXP", () => {
    it("resets actors with active duty XP back to original bonus and cleans up flags", async () => {
      const actor1 = {
        name: "Fighter Bob",
        flags: { dutyXP: { origXpBonus: 5, duties: ["Camp Guard"] } },
        system: { details: { xp: { bonus: 10 } } },
        update: vi.fn().mockResolvedValue(true),
      };
      const actor2 = {
        name: "Cleric Alice",
        flags: { dutyXP: { origXpBonus: 0, duties: ["Scout"] } },
        system: { details: { xp: { bonus: 5 } } },
        update: vi.fn().mockResolvedValue(true),
      };
      const actor3 = {
        name: "Thief Charlie",
        flags: {},
        system: { details: { xp: { bonus: 0 } } },
        update: vi.fn().mockResolvedValue(true),
      };

      (globalThis as any).game.actors = [actor1, actor2, actor3];

      await resetDutyXP();

      expect(actor1.update).toHaveBeenCalledWith({
        "flags.-=dutyXP": null,
        "system.details.xp.bonus": 5,
      });
      expect(actor2.update).toHaveBeenCalledWith({
        "flags.-=dutyXP": null,
        "system.details.xp.bonus": 0,
      });
      expect(actor3.update).not.toHaveBeenCalled();

      expect((globalThis as any).ChatMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining("Duty XP Reset Report"),
        }),
      );
    });

    it("resets only specified target actors when passed explicitly", async () => {
      const actor1 = {
        name: "Fighter Bob",
        flags: { dutyXP: { origXpBonus: 5, duties: ["Guard"] } },
        system: { details: { xp: { bonus: 10 } } },
        update: vi.fn().mockResolvedValue(true),
      };
      const actor2 = {
        name: "Cleric Alice",
        flags: { dutyXP: { origXpBonus: 0, duties: ["Scout"] } },
        system: { details: { xp: { bonus: 5 } } },
        update: vi.fn().mockResolvedValue(true),
      };

      await resetDutyXP([actor1]);

      expect(actor1.update).toHaveBeenCalledTimes(1);
      expect(actor2.update).not.toHaveBeenCalled();
    });

    it("notifies when no actors have active duty XP", async () => {
      (globalThis as any).game.actors = [{ name: "Regular Guy", flags: {}, system: { details: { xp: { bonus: 0 } } } }];

      const infoSpy = vi.spyOn((globalThis as any).ui.notifications, "info");
      await resetDutyXP();

      expect(infoSpy).toHaveBeenCalledWith("No characters currently have active Duty XP.");
      expect((globalThis as any).ChatMessage.create).not.toHaveBeenCalled();
    });

    it("preserves active Tweaks XP bonus Active Effects without double-dipping on reset", async () => {
      // Actor has +5% from Tweaks AE and +5% from legacy Duty XP flag (total derived = 10%, origXpBonus = 5%)
      const actorWithTweaks = {
        name: "Elf Ranger",
        flags: { dutyXP: { origXpBonus: 5, duties: ["Trailblazer"] } },
        effects: [
          {
            id: "tweak-xp",
            disabled: false,
            isSuppressed: false,
            flags: { ose: { tweak: "xp" } },
            changes: [{ key: "system.details.xp.bonus", value: "5" }],
          },
        ],
        system: { details: { xp: { bonus: 10 } } },
        update: vi.fn().mockResolvedValue(true),
      };

      await resetDutyXP([actorWithTweaks as any]);

      expect(actorWithTweaks.update).toHaveBeenCalledWith({
        "flags.-=dutyXP": null,
        "system.details.xp.bonus": 0,
      });
    });

    it("deletes ActiveEffect-based Duty XP documents when present", async () => {
      const actorWithDutyAe = {
        name: "Dwarf Mapper",
        flags: {},
        effects: [
          {
            id: "duty-ae-1",
            disabled: false,
            flags: { ose: { dutyXP: true, duties: ["Mapper"] } },
          },
        ],
        system: { details: { xp: { bonus: 5 } } },
        deleteEmbeddedDocuments: vi.fn().mockResolvedValue([]),
        update: vi.fn().mockResolvedValue(true),
      };

      await resetDutyXP([actorWithDutyAe as any]);

      expect(actorWithDutyAe.deleteEmbeddedDocuments).toHaveBeenCalledWith("ActiveEffect", ["duty-ae-1"]);
    });
  });

  describe("OsePartySheet._prepareContext", () => {
    it("reports hasDutyXP: true when at least one party actor has duty XP", async () => {
      const actorWithDuty = {
        id: "act-1",
        flags: { dutyXP: { origXpBonus: 5 } },
      };
      vi.spyOn(OseParty, "currentParty", "get").mockReturnValue([actorWithDuty as any]);

      const sheet = new OsePartySheet();
      const context = await sheet._prepareContext();

      expect(context.hasDutyXP).toBe(true);
    });

    it("reports hasDutyXP: false when no party actors have duty XP", async () => {
      const normalActor = {
        id: "act-1",
        flags: {},
      };
      vi.spyOn(OseParty, "currentParty", "get").mockReturnValue([normalActor as any]);

      const sheet = new OsePartySheet();
      const context = await sheet._prepareContext();

      expect(context.hasDutyXP).toBe(false);
    });
  });

  describe("OsePartySheet._clearCurrentParty", () => {
    it("removes party flag from all current party members", async () => {
      const removeSpy1 = vi.fn().mockResolvedValue(true);
      const removeSpy2 = vi.fn().mockResolvedValue(true);
      const actor1 = { id: "a1", type: "character", setFlag: removeSpy1 };
      const actor2 = { id: "a2", type: "character", setFlag: removeSpy2 };

      vi.spyOn(OseParty, "currentParty", "get").mockReturnValue([actor1 as any, actor2 as any]);

      const sheet = new OsePartySheet();
      await sheet._clearCurrentParty();

      expect(removeSpy1).toHaveBeenCalledWith("ose", "party", false);
      expect(removeSpy2).toHaveBeenCalledWith("ose", "party", false);
    });
  });
});
