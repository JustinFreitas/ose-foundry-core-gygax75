import { describe, expect, it, vi } from "vitest";
import OseDice from "../helpers-dice";
import OseActor from "./entity";

describe("Offline Actor Entity Hit Dice tests", () => {
  it("parses standard and modified HD formulas correctly in selectSingleOrAllHitDiceRoll", async () => {
    // Mock the OseDice.Roll function to inspect the parts argument
    let rolledParts: string[] = [];
    const originalRoll = OseDice.Roll;
    OseDice.Roll = (async (options: { parts: string[] }) => {
      rolledParts = options.parts;
      return null;
    }) as unknown as typeof OseDice.Roll;

    try {
      // 1. Test standard 1d8 formula at Level 2 with +2 CON mod, Single HD roll
      const actor1 = new OseActor({
        id: "actor-1",
        system: {
          hp: { hd: "1d8" },
          details: { level: 2 },
          scores: { con: { mod: 2 } },
        },
      } as unknown as Actor);

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
      } as unknown as Actor);

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
    } as unknown as Actor);

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

  describe("rollAttack", () => {
    it("handles missile attacks and applies gygax75 damage.mod.missile bonus damage", async () => {
      let rollOptions: { parts: string[]; data: { roll: { dmg: string[] } } } | null = null;
      const originalRoll = OseDice.Roll;
      OseDice.Roll = (async (options: { parts: string[]; data: { roll: { dmg: string[] } } }) => {
        rollOptions = options;
        return null;
      }) as unknown as typeof OseDice.Roll;

      const actor = new OseActor({
        id: "actor-1",
        system: {
          scores: {
            str: { mod: 0 },
            dex: { mod: 0 },
          },
          thac0: {
            value: 19,
            mod: {
              melee: 0,
              missile: 0,
            },
          },
          damage: {
            mod: {
              missile: 2, // gygax75 custom missile damage modifier
            },
          },
        },
      } as unknown as Actor);

      const attData = {
        item: {
          _id: "weapon-1",
          name: "Shortbow",
          system: {
            damage: "1d6",
            bonus: 0,
          },
        },
        roll: {
          save: "",
          target: "",
        },
      };

      const settingsSpy = vi.spyOn(game.settings, "get").mockImplementation((_scope, key) => {
        if (key === "ignoreAttackBonusOnDamageRoll") return false;
        if (key === "ascendingAC") return false;
        return false;
      });

      try {
        // 1. Test Melee Attack (should not apply missile damage modifier)
        await actor.rollAttack(attData as unknown as Parameters<typeof actor.rollAttack>[0], { type: "melee" });
        expect(rollOptions).not.toBeNull();
        if (rollOptions) {
          expect(rollOptions.data.roll.dmg).toContain("1d6");
          expect(rollOptions.data.roll.dmg).not.toContain(2); // no missile mod
        }

        // 2. Test Missile Attack (should apply gygax75 damage.mod.missile to damage roll)
        await actor.rollAttack(attData as unknown as Parameters<typeof actor.rollAttack>[0], { type: "missile" });
        expect(rollOptions).not.toBeNull();
        if (rollOptions) {
          expect(rollOptions.data.roll.dmg).toContain("1d6");
          expect(rollOptions.data.roll.dmg).toContain(2); // gygax75 damage.mod.missile applied!
        }
      } finally {
        OseDice.Roll = originalRoll;
        settingsSpy.mockRestore();
      }
    });
  });
});
