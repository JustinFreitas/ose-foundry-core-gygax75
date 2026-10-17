import { describe, expect, it, vi } from "vitest";
import OseDice from "../helpers-dice.js";
import OseActor from "./entity";

describe("OseActor Hit Dice Rolling (Gygax '75)", () => {
  it("opens a DialogV2 for characters with Single Level and All Levels buttons", () => {
    const actor = new OseActor({
      id: "char-1",
      type: "character",
      system: {
        hp: { hd: "1d8" },
        details: { level: 1 },
        scores: { con: { mod: 0 } },
      },
    });

    const dialogSpy = vi.spyOn(foundry.applications.api, "DialogV2");
    actor.rollHitDice();

    expect(dialogSpy).toHaveBeenCalledTimes(1);
    const options = dialogSpy.mock.calls[0]?.[0];
    expect(options.classes).toContain("ose");
    expect(options.classes).toContain("dialog");
    expect(options.position).toEqual({ width: 400, height: "auto" });
    expect(options.buttons.some((b: any) => b.action === "single")).toBe(true);
    expect(options.buttons.some((b: any) => b.action === "all")).toBe(true);
  });

  it("calculates correct roll formulas for standard progression (Levels 1-9) with min 1 HP per die", () => {
    let rolledParts: string[] = [];
    const rollSpy = vi.spyOn(OseDice, "Roll").mockImplementation((data: any) => {
      rolledParts = data.parts;
      return data;
    });

    try {
      // Level 1: 1d8, CON +1
      const actorLvl1 = new OseActor({
        id: "char-lvl1",
        type: "character",
        system: {
          hp: { hd: "1d8" },
          details: { level: 1 },
          scores: { con: { mod: 1 } },
        },
      });

      actorLvl1.selectSingleOrAllHitDiceRoll({ hdRollType: "single" });
      expect(rolledParts[0]).toBe("max(1d8 + 1, 1)");

      actorLvl1.selectSingleOrAllHitDiceRoll({ hdRollType: "all" });
      expect(rolledParts[0]).toBe("max(1d8 + 1, 1)");

      // Level 3: 3d8, CON -2 -> CON bonus should not reduce HP below number of dice (floor is 3 for all, 1 for single)
      const actorLvl3 = new OseActor({
        id: "char-lvl3",
        type: "character",
        system: {
          hp: { hd: "3d8" },
          details: { level: 3 },
          scores: { con: { mod: -2 } },
        },
      });

      actorLvl3.selectSingleOrAllHitDiceRoll({ hdRollType: "single" });
      expect(rolledParts[0]).toBe("max(1d8 + -2, 1)");

      actorLvl3.selectSingleOrAllHitDiceRoll({ hdRollType: "all" });
      expect(rolledParts[0]).toBe("max(3d8 + -6, 3)");
    } finally {
      rollSpy.mockRestore();
    }
  });

  it("calculates correct roll formulas for Name-Level progression (Level 10+, e.g. 9d8+2)", () => {
    let rolledParts: string[] = [];
    const rollSpy = vi.spyOn(OseDice, "Roll").mockImplementation((data: any) => {
      rolledParts = data.parts;
      return data;
    });

    try {
      // Level 10: 9d8+2, CON +2
      const actorLvl10 = new OseActor({
        id: "char-lvl10",
        type: "character",
        system: {
          hp: { hd: "9d8+2" },
          details: { level: 10 },
          scores: { con: { mod: 2 } },
        },
      });

      // Single HD roll at Name-Level gets flat bonus per level (+2), NO CON modifier
      actorLvl10.selectSingleOrAllHitDiceRoll({ hdRollType: "single" });
      expect(rolledParts[0]).toBe("2");

      // All HD roll gets 9d8 + (9 * CON) + flatBonus
      actorLvl10.selectSingleOrAllHitDiceRoll({ hdRollType: "all" });
      expect(rolledParts[0]).toBe("max(9d8 + 18, 9) + 2");

      // Level 12: 9d8+6, CON +1 (3 levels past base: 6 / 3 = 2 per level)
      const actorLvl12 = new OseActor({
        id: "char-lvl12",
        type: "character",
        system: {
          hp: { hd: "9d8+6" },
          details: { level: 12 },
          scores: { con: { mod: 1 } },
        },
      });

      actorLvl12.selectSingleOrAllHitDiceRoll({ hdRollType: "single" });
      expect(rolledParts[0]).toBe("2");

      actorLvl12.selectSingleOrAllHitDiceRoll({ hdRollType: "all" });
      expect(rolledParts[0]).toBe("max(9d8 + 9, 9) + 6");
    } finally {
      rollSpy.mockRestore();
    }
  });

  it("clamps monster HD rolls to minimum 1 HP", () => {
    let rolledParts: string[] = [];
    const rollSpy = vi.spyOn(OseDice, "Roll").mockImplementation((data: any) => {
      rolledParts = data.parts;
      return data;
    });

    try {
      const monster = new OseActor({
        id: "monster-1",
        type: "monster",
        system: {
          hp: { hd: "1d4-2" },
        },
      });

      monster.rollHitDice();
      expect(rolledParts[0]).toBe("max(1d4-2, 1)");
    } finally {
      rollSpy.mockRestore();
    }
  });

  it("warns and aborts if Hit Dice formula is invalid", () => {
    const actor = new OseActor({
      id: "char-invalid",
      type: "character",
      system: {
        hp: { hd: "invalid-formula" },
        details: { level: 1 },
      },
    });

    const warnSpy = vi.spyOn(ui.notifications, "warn").mockImplementation(() => {});

    try {
      const result = actor.selectSingleOrAllHitDiceRoll({ hdRollType: "single" });
      expect(result).toBeUndefined();
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});
