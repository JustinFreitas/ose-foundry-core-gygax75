import { describe, expect, it } from "vitest";
import { findActorsToMigrate, promptClassMigration, runClassMigration } from "../../migration";
import { convertActor, convertSingleActor } from "../../migration/convert-actor";
import OseDataModelCharacter from "../data-model-character";
import OseDataModelMonster, { computeMonsterCarriedWeight } from "../data-model-monster";
import OseDataModelCharacterEncumbrance from "./data-model-character-encumbrance";
import OseDataModelCharacterEncumbranceBasic from "./data-model-character-encumbrance-basic";
import OseDataModelCharacterEncumbranceComplete from "./data-model-character-encumbrance-complete";
import OseDataModelCharacterEncumbranceDetailed from "./data-model-character-encumbrance-detailed";
import OseDataModelCharacterEncumbranceDisabled from "./data-model-character-encumbrance-disabled";
import OseDataModelCharacterEncumbranceItemBased from "./data-model-character-encumbrance-item-based";

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

    it("uses cumulativeWeight and bundle scaling for partial treasure bundles in basic encumbrance", () => {
      const items = [
        {
          type: "item",
          system: {
            treasure: true,
            quantity: { value: 10, max: 20 },
            weight: 100,
            cumulativeWeight: 50,
          },
        },
        {
          type: "item",
          system: {
            treasure: true,
            quantity: { value: 5, max: 10 },
            weight: 40,
          },
        },
      ];

      const enc = new OseDataModelCharacterEncumbranceBasic(null, items as unknown as Item[]);
      expect(enc.value).toBe(70); // 50 + (40 / 10) * 5 = 70
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

    it("uses item cumulativeWeight for partial bundles", () => {
      const items = [
        {
          type: "item",
          system: {
            quantity: { value: 15, max: 20 },
            weight: 20,
            cumulativeWeight: 15, // (20 / 20) * 15 = 15 cn
          },
        },
      ];

      const enc = new OseDataModelCharacterEncumbranceComplete(1600, items as unknown as Item[]);
      expect(enc.value).toBe(15);
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

    it("uses item cumulativeWeight for treasure bundles in detailed encumbrance", () => {
      const items = [
        {
          type: "item",
          system: {
            treasure: true,
            quantity: { value: 5, max: 10 },
            weight: 100,
            cumulativeWeight: 50, // partial bundle
          },
        },
      ];

      const enc = new OseDataModelCharacterEncumbranceDetailed(1600, items as unknown as Item[]);
      expect(enc.value).toBe(50);
    });
  });

  describe("Item-Based Encumbrance Model", () => {
    it("uses cumulativeItemslots for packed and equipped bundle items", () => {
      const items = [
        {
          type: "item",
          system: {
            equipped: false,
            quantity: { value: 10, max: 20 },
            itemslots: 1,
            cumulativeItemslots: 0.5,
          },
        },
        {
          type: "item",
          system: {
            equipped: true,
            quantity: { value: 5, max: 20 },
            itemslots: 1,
            cumulativeItemslots: 0.25,
          },
        },
      ];

      const enc = new OseDataModelCharacterEncumbranceItemBased(16, items as unknown as Item[]);
      // packed weight: ceil(0.5) = 1
      expect(enc.packedValue).toBe(1);
      // equipped weight: ceil(0.25) = 1
      expect(enc.equippedValue).toBe(1);
    });

    it("sums fractional bundle slots before Math.ceil and counts empty containers as 1 slot", () => {
      const items = [
        {
          type: "item",
          system: {
            equipped: false,
            quantity: { value: 10, max: 20 },
            itemslots: 1,
            cumulativeItemslots: 0.5,
          },
        },
        {
          type: "item",
          system: {
            equipped: false,
            quantity: { value: 10, max: 20 },
            itemslots: 1,
            cumulativeItemslots: 0.5,
          },
        },
        {
          type: "container",
          system: {
            equipped: false,
            quantity: { value: 0 },
            itemslots: 1,
          },
        },
        {
          type: "container",
          system: {
            equipped: true,
            quantity: { value: 0 },
            itemslots: 1,
          },
        },
      ];

      const enc = new OseDataModelCharacterEncumbranceItemBased(16, items as unknown as Item[]);
      // packed: ceil(0.5 + 0.5 + 1) = 2 (not 1 + 1 + 0 = 2 by accident; verify without container too)
      expect(enc.packedValue).toBe(2);
      expect(enc.equippedValue).toBe(1);

      const twoHalfBundlesOnly = new OseDataModelCharacterEncumbranceItemBased(
        16,
        items.slice(0, 2) as unknown as Item[],
      );
      expect(twoHalfBundlesOnly.packedValue).toBe(1);
    });

    it("derives nextBreakpointValue from custom equipped/packed caps including the overload threshold", () => {
      const makeSlots = (equippedSlots: number, packedSlots: number) => [
        ...(equippedSlots > 0
          ? [{ type: "item", system: { equipped: true, quantity: { value: equippedSlots }, itemslots: 1 } }]
          : []),
        ...(packedSlots > 0
          ? [{ type: "item", system: { equipped: false, quantity: { value: packedSlots }, itemslots: 1 } }]
          : []),
      ];

      // Default caps: equippedMax = 9, packedMax = 16
      const encTier4 = new OseDataModelCharacterEncumbranceItemBased(16, makeSlots(0, 15) as unknown as Item[]);
      expect(encTier4.atThirdBreakpoint).toBe(true);
      expect(encTier4.encumbered).toBe(false);
      expect(encTier4.nextBreakpointValue).toBe(16); // overload cap included!

      const encOver = new OseDataModelCharacterEncumbranceItemBased(16, makeSlots(0, 17) as unknown as Item[]);
      expect(encOver.encumbered).toBe(true);
      expect(encOver.nextBreakpointValue).toBeNull();

      // Custom caps: equippedMax = 12 (thresholds 4, 6, 9, 12), packedMax = 20 (thresholds 12, 15, 17, 20)
      const encCustom = new OseDataModelCharacterEncumbranceItemBased(12, makeSlots(8, 10) as unknown as Item[], {
        packedMax: 20,
      });
      // equippedWeight = 8 (tier 2, <= 9): next equipped breakpoint is 9 (1 slot remaining)
      expect(encCustom.usingEquippedEncumbrance).toBe(true);
      expect(encCustom.nextBreakpointValue).toBe(9);
      expect(encCustom.untilNextBreakpoint).toBe(1);

      const encCustomTier4 = new OseDataModelCharacterEncumbranceItemBased(12, makeSlots(10, 10) as unknown as Item[], {
        packedMax: 20,
      });
      expect(encCustomTier4.atThirdBreakpoint).toBe(true);
      expect(encCustomTier4.encumbered).toBe(false);
      expect(encCustomTier4.nextBreakpointValue).toBe(12); // custom overload cap
      expect(encCustomTier4.untilNextBreakpoint).toBe(2);
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

    it("restores official B/X defaults when gygax75Encumbrance is disabled", async () => {
      try {
        OseDataModelCharacterEncumbrance.isGygax75 = null;
        await game.settings.set("ose", "gygax75Encumbrance", false);

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
        await game.settings.set("ose", "gygax75Encumbrance", true);
        OseDataModelCharacterEncumbrance.isGygax75 = null;
      }
    });

    it("safely falls back to Gygax '75 (2400 cn) if game.settings is uninitialized", () => {
      const mutableGame = game as unknown as { settings: unknown };
      const originalSettings = mutableGame.settings;
      try {
        OseDataModelCharacterEncumbrance.isGygax75 = null;
        mutableGame.settings = undefined;
        expect(OseDataModelCharacterEncumbrance.baseEncumbranceCap).toBe(2400);
        expect(OseDataModelCharacterEncumbrance.isGygax75).toBe(true);
      } finally {
        mutableGame.settings = originalSettings;
        OseDataModelCharacterEncumbrance.isGygax75 = null;
      }
    });

    it("dynamically resolves unset max between 2,400 cn and 1,600 cn when gygax75Encumbrance toggles", async () => {
      OseDataModelCharacterEncumbrance.isGygax75 = null;
      await game.settings.set("ose", "gygax75Encumbrance", true);
      const enc = new OseDataModelCharacterEncumbranceDetailed(null, []);
      expect(enc.max).toBe(2400);

      OseDataModelCharacterEncumbrance.isGygax75 = null;
      await game.settings.set("ose", "gygax75Encumbrance", false);
      expect(enc.max).toBe(1600);
      OseDataModelCharacterEncumbrance.isGygax75 = null;
    });
  });

  describe("Monster & Mount Encumbrance (Horse Barding & Disabled Max)", () => {
    it("counts armor with quantity 0 or null (e.g. Horse Barding 600 cn) as quantity 1", () => {
      const mountItems = [
        { type: "armor", system: { weight: 600, quantity: { value: 0 } } },
        { type: "armor", system: { weight: 150, quantity: { value: null } } },
        { type: "weapon", system: { weight: 50, quantity: { value: null } } },
        { type: "item", system: { weight: 100, quantity: { value: 2 } } },
      ];
      expect(computeMonsterCarriedWeight(mountItems)).toBe(1000);

      const parentMount = {
        items: [{ type: "armor", system: { weight: 600, quantity: { value: 0 } } }],
        _source: { system: {} },
      };
      const mountModel = new OseDataModelMonster(
        { encumbrance: { max: 4000 }, movement: { base: 240 }, config: { movementAuto: true } },
        { parent: parentMount },
      );
      mountModel.prepareDerivedData();
      expect(mountModel.encumbrance.value).toBe(600);
      expect(mountModel.encumbrance.max).toBe(4000);
      expect(mountModel.movement.base).toBe(240);

      const unencumberedMonster = new OseDataModelMonster(
        { encumbrance: { max: 0 }, movement: { base: 120 }, config: {} },
        { parent: { items: [], _source: { system: {} } } },
      );
      unencumberedMonster.prepareDerivedData();
      expect(unencumberedMonster.encumbrance.enabled).toBe(false);
      expect(unencumberedMonster.encumbrance.max).toBe(0);
    });
  });

  describe("Character Data Model Treasure & enableClassItems Gate", () => {
    it("includes container-stowed treasure and cumulativeCost in carriedTreasure", () => {
      const parentActor = {
        items: [
          { id: "sack1", type: "container", system: { containerId: "" } },
          {
            id: "gp-loose",
            type: "item",
            system: { treasure: true, containerId: "", quantity: { value: 50 }, cost: 1, cumulativeCost: 50 },
          },
          {
            id: "gems-stowed",
            type: "item",
            system: { treasure: true, containerId: "sack1", quantity: { value: 2 }, cost: 100, cumulativeCost: 200 },
          },
          {
            id: "bundle-treasure",
            type: "item",
            system: { treasure: true, containerId: "sack1", quantity: { value: 5, max: 10 }, cost: 20 },
          },
          {
            id: "orphaned-treasure",
            type: "item",
            system: { treasure: true, containerId: "dropped-chest", quantity: { value: 1 }, cost: 500 },
          },
        ],
        _source: { system: {} },
      };

      const charModel = new OseDataModelCharacter({}, { parent: parentActor });
      // 50 (loose) + 200 (in sack1) + 10 (5/10 bundle in sack1) = 260 GP; orphaned chest excluded
      expect(charModel.carriedTreasure).toBe(260);
    });

    it("gates residual class/race items and migration helpers when enableClassItems is false", async () => {
      const residualClass = {
        id: "cls1",
        name: "Fighter",
        type: "class",
        system: {
          key: "fighter",
          level: 3,
          hasTable: true,
          levels: [
            {
              xp: 0,
              hd: "1d8",
              hdcon: true,
              thac0: 19,
              bba: 0,
              saves: { death: 12, wand: 13, paralysis: 14, breath: 15, spell: 16 },
              spellSlots: {},
            },
          ],
          tables: [{ key: "skills", label: "Skills", columns: [{ key: "ms", name: "MS" }], rows: [{ ms: 2 }] }],
        },
      };
      const residualRace = {
        id: "race1",
        name: "Elf",
        type: "race",
        system: { key: "elf", saveBonuses: [], requirements: {}, classAccess: () => null },
      };
      const parentActor = {
        type: "character",
        items: [residualClass, residualRace],
        appliedEffects: [],
        _source: { system: { scores: {}, ac: { mod: 0 }, aac: { mod: 0 } } },
      };

      // Default stub has ose.enableClassItems = false
      const charModel = new OseDataModelCharacter(
        {
          details: { class: "Fighter", level: 1, xp: { value: 0, next: 2000 } },
          scores: {
            str: { value: 10 },
            int: { value: 10 },
            wis: { value: 10 },
            dex: { value: 10 },
            con: { value: 10 },
            cha: { value: 10 },
          },
          saves: {
            death: { value: 14 },
            wand: { value: 15 },
            paralysis: { value: 16 },
            breath: { value: 17 },
            spell: { value: 17 },
          },
          thac0: { value: 19, bba: 0 },
          hp: { hd: "1d6", value: 4, max: 4 },
          spells: { enabled: false },
          config: { movementAuto: true },
        },
        { parent: parentActor },
      );

      expect(charModel.classes).toEqual([]);
      expect(charModel.race).toBeNull();
      charModel.prepareBaseData();
      expect(charModel.derivedFromClasses).toBe(false);
      expect(charModel.details.level).toBe(1);
      charModel.prepareTables();
      expect(charModel.tables).toEqual({});

      await expect(findActorsToMigrate()).resolves.toEqual([]);
      expect((await convertActor(parentActor as unknown as Actor, [])).status).toBe("none");
      expect((await convertSingleActor(parentActor as unknown as Actor)).status).toBe("none");
      await expect(runClassMigration([])).resolves.toEqual([]);
      await expect(promptClassMigration()).resolves.toBeUndefined();
    });

    it("prompts class migration via V14 DialogV2 constructor with ose/dialog classes and position when enabled", async () => {
      await game.settings.set("ose", "enableClassItems", true);
      (game.user as unknown as Record<string, unknown>).isActiveGM = true;
      const pendingActor = {
        type: "character",
        getFlag: () => false,
        _source: { system: { details: { class: "Fighter" } } },
      };
      (game as unknown as { actors: unknown[] }).actors = [pendingActor];

      let capturedOptions: Record<string, unknown> | null = null;
      const OriginalDialogV2 = foundry.applications.api.DialogV2;
      try {
        foundry.applications.api.DialogV2 = class extends OriginalDialogV2 {
          constructor(options: Record<string, unknown>) {
            super(options);
            capturedOptions = options;
          }
          override async render() {
            const laterBtn = (this.options.buttons as unknown as Array<{ action: string; callback: () => void }>).find(
              (b) => b.action === "later",
            );
            laterBtn?.callback();
            return this;
          }
        } as unknown as typeof foundry.applications.api.DialogV2;

        await promptClassMigration();
        expect(capturedOptions).toMatchObject({
          classes: ["ose", "dialog"],
          position: { width: 420, height: "auto" },
        });
      } finally {
        foundry.applications.api.DialogV2 = OriginalDialogV2;
        (game as unknown as { actors: unknown[] }).actors = [];
      }
    });
  });
});
