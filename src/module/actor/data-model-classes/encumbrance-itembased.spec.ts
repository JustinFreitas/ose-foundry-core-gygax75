import { describe, expect, it, vi } from "vitest";
import OseDataModelCharacterEncumbranceItemBased from "./data-model-character-encumbrance-item-based";

describe("Offline Item-based Encumbrance Model", () => {
  it("initializes default capacities and configurations correctly", () => {
    // Mock settings get
    const settingsSpy = vi.spyOn(game.settings, "get").mockReturnValue(false);

    try {
      const enc = new OseDataModelCharacterEncumbranceItemBased(16, []);
      expect(enc.variant).toBe("itembased");
      expect(enc.enabled).toBe(true);
      expect(enc.max).toBe(9); // defaults to equippedMax which is 9
      expect(enc.value).toBe(0);
      expect(enc.pct).toBe(0);
      expect(enc.encumbered).toBe(false);
      expect(enc.equippedLabel).toBe("0/9");
      expect(enc.packedLabel).toBe("0/16");
    } finally {
      settingsSpy.mockRestore();
    }
  });

  it("calculates coin slot allocations accurately (100 coins = 1 slot)", () => {
    const items = [
      {
        type: "item",
        system: {
          isCoinsOrGems: true,
          quantity: { value: 250 }, // should equal 3 slots
          itemslots: 0,
        },
      },
    ];

    const enc = new OseDataModelCharacterEncumbranceItemBased(16, items as unknown as Item[]);
    expect(enc.packedValue).toBe(3); // Math.ceil(250 / 100) = 3
  });

  it("distributes equipped and packed item weights correctly", () => {
    const items = [
      {
        type: "weapon",
        system: {
          equipped: true,
          itemslots: 2,
        },
      },
      {
        type: "weapon",
        system: {
          equipped: false,
          itemslots: 3, // packed
        },
      },
      {
        type: "armor",
        system: {
          equipped: true,
          itemslots: 4,
        },
      },
    ];

    const enc = new OseDataModelCharacterEncumbranceItemBased(16, items as unknown as Item[]);
    expect(enc.equippedValue).toBe(6); // 2 + 4 = 6
    expect(enc.packedValue).toBe(3); // unequipped weapon is packed = 3
  });

  it("implements Strength modifier capacity adjustments if setting enabled", () => {
    // 1. Setting is true, Strength Mod is +3 -> packed limit increases by 3
    const settingsSpy = vi.spyOn(game.settings, "get").mockReturnValue(true);

    try {
      const options = { scores: { str: { mod: 3 } } };
      const enc = new OseDataModelCharacterEncumbranceItemBased(16, [], options as unknown as Record<string, unknown>);
      // packedLabel is weight/max + weightMod -> 0/16+3 = 0/19
      expect(enc.packedLabel).toBe("0/19");
    } finally {
      settingsSpy.mockRestore();
    }
  });

  it("evaluates breakpoint transitions correctly for equipped and packed options", () => {
    // Test equipped breakpoints: counts stepOne = 3, stepTwo = 5, stepThree = 7
    const items = [
      {
        type: "weapon",
        system: {
          equipped: true,
          itemslots: 4, // > stepOne (3) -> atFirstBreakpoint
        },
      },
    ];

    const enc = new OseDataModelCharacterEncumbranceItemBased(16, items as unknown as Item[]);
    expect(enc.usingEquippedEncumbrance).toBe(true);
    expect(enc.atFirstBreakpoint).toBe(true);
    expect(enc.atSecondBreakpoint).toBe(false);

    // Increase weight to 6 (> stepTwo (5) -> atSecondBreakpoint)
    const items2 = [
      {
        type: "weapon",
        system: {
          equipped: true,
          itemslots: 6,
        },
      },
    ];
    const enc2 = new OseDataModelCharacterEncumbranceItemBased(16, items2 as unknown as Item[]);
    expect(enc2.atSecondBreakpoint).toBe(true);
    expect(enc2.atThirdBreakpoint).toBe(false);
  });
});
