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

      // Gygax '75 Breakpoints: quarter = 16.67%, threeEighths = 33.33%, half = 50%
      enc.testValue = 10;
      expect(enc.atFirstBreakpoint).toBe(false);

      enc.testValue = 20;
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
      expect(enc.steps).toEqual(Object.values(OseDataModelCharacterEncumbrance.encumbranceSteps));
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

  describe("Configurable Gygax '75 Encumbrance Rules (BECMI 2,400 cn vs B/X 1,600 cn)", () => {
    it("enables Gygax '75 rules by default with 2,400 cn cap and 400/800/1200 cn breakpoints", () => {
      OseDataModelCharacterEncumbrance.isGygax75 = null; // reset override
      expect(OseDataModelCharacterEncumbrance.isGygax75).toBe(true);
      expect(OseDataModelCharacterEncumbrance.baseEncumbranceCap).toBe(2400);

      const steps = OseDataModelCharacterEncumbrance.encumbranceSteps;
      expect(steps.quarter).toBeCloseTo((400 / 2400) * 100, 5); // 16.67%
      expect(steps.threeEighths).toBeCloseTo((800 / 2400) * 100, 5); // 33.33%
      expect(steps.half).toBe(50); // 50% = 1200 cn

      // Test breakpoint triggers with TestEncumbrance
      const enc = new TestEncumbrance("detailed", 2400);
      enc.testValue = 400;
      expect(enc.atFirstBreakpoint).toBe(false); // <= 400 is Tier 1 (120')
      expect(enc.nextBreakpointValue).toBe(400);

      enc.testValue = 401;
      expect(enc.atFirstBreakpoint).toBe(true); // > 400 is Tier 2 (90')
      expect(enc.atSecondBreakpoint).toBe(false);
      expect(enc.nextBreakpointValue).toBe(800);

      enc.testValue = 801;
      expect(enc.atSecondBreakpoint).toBe(true); // > 800 is Tier 3 (60')
      expect(enc.atThirdBreakpoint).toBe(false);
      expect(enc.nextBreakpointValue).toBe(1200);

      enc.testValue = 1201;
      expect(enc.atThirdBreakpoint).toBe(true); // > 1200 is Tier 4 (30')
      expect(enc.encumbered).toBe(false);
      expect(enc.nextBreakpointValue).toBe(2400); // 1,199 left until 0'/0' (encumbered)
      expect(enc.untilNextBreakpoint).toBe(1199);

      enc.testValue = 2401;
      expect(enc.encumbered).toBe(true); // > 2400 is encumbered (0')
      expect(enc.nextBreakpointValue).toBe(null);
    });

    it("restores official B/X defaults when gygax75Encumbrance is disabled", () => {
      const originalGet = game.settings.get;
      try {
        OseDataModelCharacterEncumbrance.isGygax75 = null;
        (game.settings.get as ReturnType<typeof vi.fn>).mockImplementation((_scope, key) => {
          if (key === "gygax75Encumbrance") return false;
          return undefined;
        });

        expect(OseDataModelCharacterEncumbrance.isGygax75).toBe(false);
        expect(OseDataModelCharacterEncumbrance.baseEncumbranceCap).toBe(1600);

        const steps = OseDataModelCharacterEncumbrance.encumbranceSteps;
        expect(steps.quarter).toBe(25); // 25% = 400 cn
        expect(steps.threeEighths).toBe(37.5); // 37.5% = 600 cn
        expect(steps.half).toBe(50); // 50% = 800 cn

        const enc = new TestEncumbrance("detailed", 1600);
        enc.testValue = 401;
        expect(enc.atFirstBreakpoint).toBe(true);
        enc.testValue = 601;
        expect(enc.atSecondBreakpoint).toBe(true);
        enc.testValue = 801;
        expect(enc.atThirdBreakpoint).toBe(true);
        enc.testValue = 1601;
        expect(enc.encumbered).toBe(true);
      } finally {
        game.settings.get = originalGet;
        OseDataModelCharacterEncumbrance.isGygax75 = null;
      }
    });

    it("safely falls back to Gygax '75 (2400 cn) if game.settings is uninitialized", () => {
      const originalSettings = game.settings;
      try {
        OseDataModelCharacterEncumbrance.isGygax75 = null;
        // @ts-expect-error test uninitialized settings
        game.settings = undefined;
        expect(OseDataModelCharacterEncumbrance.baseEncumbranceCap).toBe(2400);
        expect(OseDataModelCharacterEncumbrance.isGygax75).toBe(true);
      } finally {
        game.settings = originalSettings;
        OseDataModelCharacterEncumbrance.isGygax75 = null;
      }
    });
  });
});
