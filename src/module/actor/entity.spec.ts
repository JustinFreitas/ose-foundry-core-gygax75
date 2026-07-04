import { describe, it, expect, vi } from "vitest";
import OseActor from "./entity";
import OseDice from "../helpers-dice";

describe("Offline Actor Entity Hit Dice tests", () => {
  it("parses standard and modified HD formulas correctly in selectSingleOrAllHitDiceRoll", async () => {
    // Mock the OseDice.Roll function to inspect the parts argument
    let rolledParts: string[] = [];
    const originalRoll = OseDice.Roll;
    OseDice.Roll = (async (options: any) => {
      rolledParts = options.parts;
      return null;
    }) as any;

    try {
      // 1. Test standard 1d8 formula at Level 2 with +2 CON mod, Single HD roll
      const actor1 = new OseActor({
        id: "actor-1",
        system: {
          hp: { hd: "1d8" },
          details: { level: 2 },
          scores: { con: { mod: 2 } },
        },
      });

      actor1.selectSingleOrAllHitDiceRoll({ hdRollType: "single" });
      expect(rolledParts[0]).toBe("max(1d8 + 2, 1)");

      // 2. Test modified 1d8+1 formula at Level 3 with +2 CON mod, All HD roll
      const actor2 = new OseActor({
        id: "actor-2",
        system: {
          hp: { hd: "1d8+1" },
          details: { level: 3 },
          scores: { con: { mod: 2 } },
        },
      });

      actor2.selectSingleOrAllHitDiceRoll({ hdRollType: "all" });
      expect(rolledParts[0]).toBe("max(3d8 + 6, 3)");
    } finally {
      // Restore mock
      OseDice.Roll = originalRoll;
    }
  });

  it("warns and aborts if Hit Dice formula is invalid", async () => {
    const actor = new OseActor({
      id: "actor-invalid",
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
      expect(warnSpy.mock.calls[0]?.[0]).toContain("invalid-formula");
    } finally {
      warnSpy.mockRestore();
    }
  });
});
