import { describe, expect, it } from "vitest";
import OseDataModelCharacterEncumbrance from "./data-model-character-encumbrance";
import OseDataModelCharacterEncumbranceBasic from "./data-model-character-encumbrance-basic";
import OseDataModelCharacterEncumbranceComplete from "./data-model-character-encumbrance-complete";
import OseDataModelCharacterEncumbranceDetailed from "./data-model-character-encumbrance-detailed";
import OseDataModelCharacterEncumbranceDisabled from "./data-model-character-encumbrance-disabled";

// Test sub-class to allow controlling the value getter
class TestEncumbrance extends OseDataModelCharacterEncumbrance {
  testValue = 0;
  get value() {
    return this.testValue;
  }
}

describe("Offline Encumbrance Model Tests", () => {
  describe("Base Encumbrance Model", () => {
    it("initializes with default options", () => {
      const enc = new OseDataModelCharacterEncumbrance("basic", 1600);
      expect(enc.variant).toBe("basic");
      expect(enc.enabled).toBe(true);
      expect(enc.max).toBe(1600);
      expect(enc.value).toBe(0);
      expect(enc.pct).toBe(0);
      expect(enc.encumbered).toBe(false);
      expect(enc.steps).toEqual([]);
    });

    it("calculates carry percentage and encumbered state correctly", () => {
      const enc = new TestEncumbrance("basic", 1000);
      enc.testValue = 500;
      expect(enc.pct).toBe(50);
      expect(enc.encumbered).toBe(false);

      enc.testValue = 1200;
      expect(enc.pct).toBe(100); // clamped at 100
      expect(enc.encumbered).toBe(true);
    });

    it("determines breakpoints by percentage", () => {
      const enc = new TestEncumbrance("basic", 100);

      // Breakpoints: quarter = 25%, threeEighths = 37.5%, half = 50%
      enc.testValue = 20;
      expect(enc.atFirstBreakpoint).toBe(false);

      enc.testValue = 30;
      expect(enc.atFirstBreakpoint).toBe(true);
      expect(enc.atSecondBreakpoint).toBe(false);

      enc.testValue = 40;
      expect(enc.atSecondBreakpoint).toBe(true);
      expect(enc.atThirdBreakpoint).toBe(false);

      enc.testValue = 60;
      expect(enc.atThirdBreakpoint).toBe(true);
    });
  });

  describe("Disabled Encumbrance Model", () => {
    it("handles disabled variant correctly", () => {
      const enc = new OseDataModelCharacterEncumbranceDisabled();
      expect(enc.variant).toBe("disabled");
      expect(enc.enabled).toBe(false);
      expect(enc.value).toBe(0);
      expect(enc.pct).toBe(0);
      expect(enc.encumbered).toBe(false);
    });
  });

  describe("Basic Encumbrance Model", () => {
    it("calculates treasure weight correctly", () => {
      const items = [
        {
          type: "item",
          system: { treasure: true, quantity: { value: 10 }, weight: 2 },
        },
        {
          type: "item",
          system: { treasure: false, quantity: { value: 10 }, weight: 2 }, // not treasure, ignored in basic
        },
        {
          type: "weapon",
          system: { treasure: true, quantity: { value: 1 }, weight: 10 }, // not type "item", ignored
        },
      ];

      const enc = new OseDataModelCharacterEncumbranceBasic(1600, items as unknown as Item[]);
      expect(enc.value).toBe(20); // 10 * 2 = 20
    });

    it("evaluates armor and treasure thresholds for basic encumbrance", () => {
      // Significant treasure limit = 800
      const heavyItems = [
        {
          type: "item",
          system: { treasure: true, quantity: { value: 100 }, weight: 10 }, // weight = 1000
        },
      ];

      const encHeavy = new OseDataModelCharacterEncumbranceBasic(2400, heavyItems as unknown as Item[]);
      expect(encHeavy.overTreasureThreshold).toBe(true);
      expect(encHeavy.overSignificantTreasureThreshold).toBe(true);
      expect(encHeavy.steps).toEqual([33.333333333333336]);
    });

    it("evaluates breakpoint calculations correctly based on armor and treasure", () => {
      // Case 1: Unarmored, no treasure
      const enc1 = new OseDataModelCharacterEncumbranceBasic(2400, []);
      expect(enc1.atFirstBreakpoint).toBe(false);
      expect(enc1.atSecondBreakpoint).toBe(false);
      expect(enc1.atThirdBreakpoint).toBe(false);

      // Case 2: Light armor, no treasure
      const lightArmor = [
        {
          type: "armor",
          system: { type: "light", equipped: true },
        },
      ];
      const enc2 = new OseDataModelCharacterEncumbranceBasic(2400, lightArmor as unknown as Item[]);
      expect(enc2.atFirstBreakpoint).toBe(true);
      expect(enc2.atSecondBreakpoint).toBe(false);
      expect(enc2.atThirdBreakpoint).toBe(false);

      // Case 3: Light armor, with treasure (1000 weight)
      const lightArmorWithTreasure = [
        {
          type: "armor",
          system: { type: "light", equipped: true },
        },
        {
          type: "item",
          system: { treasure: true, quantity: { value: 100 }, weight: 10 },
        },
      ];
      const enc3 = new OseDataModelCharacterEncumbranceBasic(2400, lightArmorWithTreasure as unknown as Item[]);
      expect(enc3.atFirstBreakpoint).toBe(true);
      expect(enc3.atSecondBreakpoint).toBe(true);
      expect(enc3.atThirdBreakpoint).toBe(false);

      // Case 4: Heavy armor, no treasure
      const heavyArmor = [
        {
          type: "armor",
          system: { type: "heavy", equipped: true },
        },
      ];
      const enc4 = new OseDataModelCharacterEncumbranceBasic(2400, heavyArmor as unknown as Item[]);
      expect(enc4.atFirstBreakpoint).toBe(false); // matches ruleset design (only checks light armor / treasure limit)
      expect(enc4.atSecondBreakpoint).toBe(true);
      expect(enc4.atThirdBreakpoint).toBe(false);

      // Case 5: Heavy armor, with treasure (1000 weight)
      const heavyArmorWithTreasure = [
        {
          type: "armor",
          system: { type: "heavy", equipped: true },
        },
        {
          type: "item",
          system: { treasure: true, quantity: { value: 100 }, weight: 10 },
        },
      ];
      const enc5 = new OseDataModelCharacterEncumbranceBasic(2400, heavyArmorWithTreasure as unknown as Item[]);
      expect(enc5.atFirstBreakpoint).toBe(true); // triggered by overSignificantTreasureThreshold
      expect(enc5.atSecondBreakpoint).toBe(true);
      expect(enc5.atThirdBreakpoint).toBe(true);
    });
  });

  describe("Complete Encumbrance Model", () => {
    it("initializes and calculates item weights correctly", () => {
      const items = [
        {
          type: "item",
          system: { quantity: { value: 5 }, weight: 10 },
        },
        {
          type: "weapon",
          system: { weight: 50 },
        },
        {
          type: "ability", // ignored
          system: { weight: 100 },
        },
      ];

      const enc = new OseDataModelCharacterEncumbranceComplete(1600, items as unknown as Item[]);
      expect(enc.variant).toBe("complete");
      expect(enc.enabled).toBe(true);
      expect(enc.value).toBe(100); // (5 * 10) + 50 = 100
      expect(enc.steps).toEqual([25, 37.5, 50]);
    });
  });

  describe("Detailed Encumbrance Model", () => {
    it("initializes and adds adventuring gear flat weight correctly", () => {
      // 1. Without adventuring gear (only treasure & weapons)
      const items1 = [
        {
          type: "item",
          system: { treasure: true, quantity: { value: 10 }, weight: 2 }, // 20 coins
        },
        {
          type: "weapon",
          system: { weight: 30 }, // 30 coins
        },
      ];

      const enc1 = new OseDataModelCharacterEncumbranceDetailed(1600, items1 as unknown as Item[]);
      expect(enc1.variant).toBe("detailed");
      expect(enc1.value).toBe(50); // 20 + 30 = 50

      // 2. With adventuring gear (non-treasure item)
      const items2 = [
        ...items1,
        {
          type: "item",
          system: { treasure: false, quantity: { value: 1 }, weight: 5 }, // triggers flat 80 gearWeight
        },
      ];

      const enc2 = new OseDataModelCharacterEncumbranceDetailed(1600, items2 as unknown as Item[]);
      expect(enc2.value).toBe(130); // 50 + 80 = 130
    });
  });
});
