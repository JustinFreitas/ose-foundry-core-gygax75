import { describe, expect, it, vi } from "vitest";
import { OSE } from "../config";
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

    it("adds the Str modifier but not the melee attack tweak to melee damage", async () => {
      let rollOptions: { parts: (string | number)[]; data: { roll: { dmg: (string | number)[] } } } | null = null;
      const originalRoll = OseDice.Roll;
      OseDice.Roll = (async (options: typeof rollOptions) => {
        rollOptions = options;
        return null;
      }) as unknown as typeof OseDice.Roll;

      const actor = new OseActor({
        id: "actor-melee-tweak",
        system: {
          scores: {
            str: { mod: 1 },
            dex: { mod: 0 },
          },
          thac0: {
            value: 19,
            mod: {
              melee: 2, // Tweaks melee attack bonus
              missile: 0,
            },
          },
        },
      } as unknown as Actor);

      const attData = {
        item: {
          _id: "weapon-2",
          name: "Sword",
          system: {
            damage: "1d8",
            bonus: 0,
          },
        },
        roll: {
          save: "",
          target: "",
        },
      };

      const settingsSpy = vi.spyOn(game.settings, "get").mockReturnValue(false);

      try {
        await actor.rollAttack(attData as unknown as Parameters<typeof actor.rollAttack>[0], { type: "melee" });
        expect(rollOptions).not.toBeNull();
        if (rollOptions) {
          // Attack roll gets both the Str mod and the melee tweak
          expect(rollOptions.parts).toContain(1);
          expect(rollOptions.parts).toContain(2);
          // Damage gets the weapon die and the Str mod only
          expect(rollOptions.data.roll.dmg).toContain("1d8");
          expect(rollOptions.data.roll.dmg).toContain(1);
          expect(rollOptions.data.roll.dmg).not.toContain(2);
        }
      } finally {
        OseDice.Roll = originalRoll;
        settingsSpy.mockRestore();
      }
    });
  });

  describe("generateSave", () => {
    // Use the real monster tables so the brackets under test match production
    CONFIG.OSE.monster_saves = OSE.monster_saves;
    CONFIG.OSE.monster_thac0 = OSE.monster_thac0;

    const generate = async (hd: string) => {
      const actor = new OseActor({
        id: `actor-hd-${hd}`,
        system: {},
      } as unknown as Actor);
      const updateSpy = vi.spyOn(actor, "update").mockResolvedValue(actor);
      await actor.generateSave(hd);
      expect(updateSpy).toHaveBeenCalledTimes(1);
      return updateSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    };

    it("computes THAC0 and saves for plain HD", async () => {
      const update = await generate("3");
      expect(update["system.thac0.value"]).toBe(17);
      expect(update["system.thac0.bba"]).toBe(2);
      expect(update["system.saves"]).toMatchObject({ death: { value: 12 } });
    });

    it("treats a '+' bonus as the next HD bracket (regression: '3+1' gave THAC0 5)", async () => {
      const update = await generate("3+1");
      expect(update["system.thac0.value"]).toBe(16);
      expect(update["system.thac0.bba"]).toBe(3);
      expect(update["system.saves"]).toMatchObject({ death: { value: 10 } });
    });

    it("handles low HD with a bonus", async () => {
      const update = await generate("1+1");
      expect(update["system.thac0.value"]).toBe(18);
      expect(update["system.saves"]).toMatchObject({ death: { value: 12 } });
    });

    it("handles the top bracket", async () => {
      const update = await generate("22");
      expect(update["system.thac0.value"]).toBe(5);
      expect(update["system.saves"]).toMatchObject({ death: { value: 2 }, spell: { value: 2 } });
    });
  });
});
