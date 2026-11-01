import { beforeEach, describe, expect, it, vi } from "vitest";
import OseDataModelCharacter from "../../actor/data-model-character";
import OseDataModelMonster from "../../actor/data-model-monster";
import OseActor from "../../actor/entity";
import { effectKeys } from "../../effects/effect-keys";
import OseDice from "../../helpers-dice";
import OseDataModelAbility from "../../item/data-model-ability";
import OseDataModelWeapon from "../../item/data-model-weapon";
import OseItem from "../../item/entity";

describe("Phase 3: Tactical Combat & Automated Ammunition", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    if (!(OseItem.prototype as any).update) {
      (OseItem.prototype as any).update = vi.fn().mockImplementation(function (this: any) {
        return Promise.resolve(this);
      });
    }
  });

  describe("Tactical Combat Modifiers & Missile Damage Lever (OseActor.rollAttack)", () => {
    it("adds Str mod to melee attack roll and damage roll, but does not leak thac0 melee mod into damage", () => {
      let capturedRollData: any = null;
      vi.spyOn(OseDice, "Roll").mockImplementation((data: any) => {
        capturedRollData = data;
        return data;
      });

      const actor = new OseActor({
        id: "fighter-1",
        type: "character",
        system: {
          scores: { str: { mod: 2 }, dex: { mod: 1 } },
          thac0: { value: 19, bba: 0, mod: { melee: 1, missile: 0 } },
          config: {},
        },
      });

      actor.rollAttack({ item: { system: { damage: "1d8", bonus: 0 } } }, { type: "melee", skipDialog: true });

      expect(capturedRollData).not.toBeNull();
      // Attack roll parts: ["1d20", str.mod (2), thac0.mod.melee (1)]
      expect(capturedRollData.parts).toEqual(["1d20", 2, 1]);
      // Damage parts: ["1d8", str.mod (2)] (NOT thac0.mod.melee)
      expect(capturedRollData.data.roll.dmg).toEqual(["1d8", 2]);
    });

    it("applies two-weapon fighting bonus (+1 to attack) on melee attacks", () => {
      let capturedRollData: any = null;
      vi.spyOn(OseDice, "Roll").mockImplementation((data: any) => {
        capturedRollData = data;
        return data;
      });

      const actor = new OseActor({
        id: "ranger-1",
        type: "character",
        system: {
          scores: { str: { mod: 1 }, dex: { mod: 0 } },
          thac0: { value: 19, bba: 0, mod: { melee: 0, missile: 0 } },
          config: {},
        },
      });

      actor.rollAttack({ item: { system: { damage: "1d6" } } }, { type: "melee", twoWeapons: true, skipDialog: true });

      // ["1d20", str.mod (1), twoWeapons (+1)]
      expect(capturedRollData.parts).toEqual(["1d20", 1, 1]);
    });

    it("applies defender retreating bonus (+2 to attack) and customBonus", () => {
      let capturedRollData: any = null;
      vi.spyOn(OseDice, "Roll").mockImplementation((data: any) => {
        capturedRollData = data;
        return data;
      });

      const actor = new OseActor({
        id: "cleric-1",
        type: "character",
        system: {
          scores: { str: { mod: 0 }, dex: { mod: 0 } },
          thac0: { value: 19, bba: 0, mod: { melee: 0, missile: 0 } },
          config: {},
        },
      });

      actor.rollAttack(
        { item: { system: { damage: "1d6" } } },
        { type: "melee", defenderRetreating: true, customBonus: 3, skipDialog: true },
      );

      // ["1d20", retreating (+2), customBonus (+3)]
      expect(capturedRollData.parts).toEqual(["1d20", 2, 3]);
    });

    it("applies missile damage lever (system.damage.mod.missile) to missile damage, while keeping dex mod out of damage (RAW)", () => {
      let capturedRollData: any = null;
      vi.spyOn(OseDice, "Roll").mockImplementation((data: any) => {
        capturedRollData = data;
        return data;
      });

      const actor = new OseActor({
        id: "archer-1",
        type: "character",
        system: {
          scores: { str: { mod: 0 }, dex: { mod: 3 } },
          thac0: { value: 19, bba: 0, mod: { melee: 0, missile: 1 } },
          damage: { mod: { missile: 2 } }, // Bless or special magic effect
          config: {},
        },
      });

      actor.rollAttack({ item: { system: { damage: "1d6" } } }, { type: "missile", skipDialog: true });

      // Attack roll parts: ["1d20", dex.mod (3), thac0.mod.missile (1)]
      expect(capturedRollData.parts).toEqual(["1d20", 3, 1]);
      // Damage parts: ["1d6", damage.mod.missile (2)] - dex.mod (3) is NOT in damage!
      expect(capturedRollData.data.roll.dmg).toEqual(["1d6", 2]);
    });

    it("keeps missile damage completely unaugmented when damage.mod.missile is absent", () => {
      let capturedRollData: any = null;
      vi.spyOn(OseDice, "Roll").mockImplementation((data: any) => {
        capturedRollData = data;
        return data;
      });

      const actor = new OseActor({
        id: "archer-plain",
        type: "character",
        system: {
          scores: { str: { mod: 0 }, dex: { mod: 3 } },
          thac0: { value: 19, bba: 0, mod: { melee: 0, missile: 0 } },
          config: {},
        },
      });

      actor.rollAttack({ item: { system: { damage: "1d6" } } }, { type: "missile", skipDialog: true });

      expect(capturedRollData.parts).toEqual(["1d20", 3]);
      expect(capturedRollData.data.roll.dmg).toEqual(["1d6"]);
    });
  });

  describe("Automated Ammunition Tracking (OseItem._handleAmmoConsumption)", () => {
    it("skips ammunition consumption when automateAmmo is disabled", async () => {
      const getSettingSpy = vi.spyOn(game.settings, "get").mockReturnValue("disabled");

      const weapon = new OseItem({
        id: "bow-1",
        name: "Shortbow",
        type: "weapon",
        system: { missile: true },
      });

      const options: Record<string, unknown> = {};
      const result = await weapon._handleAmmoConsumption(options);

      expect(result).toBe(true);
      expect(options.ammoOptions).toBeUndefined();
      expect(options.onConfirm).toBeUndefined();
      getSettingSpy.mockRestore();
    });

    it("tracks thrown weapons and decrements weapon quantity on confirm", async () => {
      vi.spyOn(game.settings, "get").mockReturnValue("warn");

      const dagger = new OseItem({
        id: "dagger-1",
        name: "Dagger",
        type: "weapon",
        system: { quantity: { value: 3 }, missile: true },
      });
      // Attach to mock actor
      (dagger as any).actor = { items: new Map() };

      const updateSpy = vi.spyOn(dagger, "update").mockResolvedValue(dagger);

      const options: Record<string, unknown> = {};
      const result = await dagger._handleAmmoConsumption(options);

      expect(result).toBe(true);
      expect(typeof options.onConfirm).toBe("function");

      const confirmResult = await (options.onConfirm as Function)();
      expect(confirmResult).toBeNull();
      expect(updateSpy).toHaveBeenCalledWith({ "system.quantity.value": 2 });
    });

    it("enforces thrown ammo when quantity is 0 and mode is enforce", async () => {
      vi.spyOn(game.settings, "get").mockReturnValue("enforce");
      const errorSpy = vi.spyOn(ui.notifications, "error").mockImplementation(() => {});

      const dagger = new OseItem({
        id: "dagger-empty",
        name: "Throwing Dagger",
        type: "weapon",
        system: { quantity: { value: 0 }, missile: true },
      });
      (dagger as any).actor = { items: new Map() };

      const options: Record<string, unknown> = {};
      const result = await dagger._handleAmmoConsumption(options);

      expect(result).toBe(false);
      expect(errorSpy).toHaveBeenCalled();
    });

    it("detects compatible ammunition for bows, sorts magic ammo first, and decrements spent ammo", async () => {
      vi.spyOn(game.settings, "get").mockReturnValue("warn");

      const normalArrows = new OseItem({
        id: "arrows-norm",
        name: "Arrows (20)",
        type: "item",
        system: { quantity: { value: 20 } },
      });

      const magicArrows = new OseItem({
        id: "arrows-magic",
        name: "+1 Silver Arrows",
        type: "item",
        system: { quantity: { value: 5 } },
      });

      const mockItems = new Map([
        [normalArrows.id, normalArrows],
        [magicArrows.id, magicArrows],
      ]);

      const bow = new OseItem({
        id: "bow-1",
        name: "Longbow",
        type: "weapon",
        system: { missile: true },
      });
      (bow as any).actor = {
        items: {
          filter: (fn: any) => Array.from(mockItems.values()).filter(fn),
          get: (id: string) => mockItems.get(id),
        },
      };

      const updateSpy = vi.spyOn(magicArrows, "update").mockResolvedValue(magicArrows);

      const options: Record<string, unknown> = {};
      const result = await bow._handleAmmoConsumption(options);

      expect(result).toBe(true);
      expect(Array.isArray(options.ammoOptions)).toBe(true);
      const ammoList = options.ammoOptions as any[];
      expect(ammoList.length).toBe(2);
      // Normal ammo is sorted first to protect precious magic ammo from accidental consumption
      expect(ammoList[0].id).toBe("arrows-norm");
      expect(ammoList[1].id).toBe("arrows-magic");

      // Confirm with magic arrows
      const formMock = { elements: { namedItem: () => ({ value: "arrows-magic" }) } } as any;
      const spentLabel = await (options.onConfirm as Function)(formMock);

      expect(updateSpy).toHaveBeenCalledWith({ "system.quantity.value": 4 });
      expect(spentLabel).toContain("+1 Silver Arrows");
      expect(spentLabel).toContain("4 left");
    });

    it("handles out of ammo condition for bow under enforce vs warn modes", async () => {
      const bow = new OseItem({
        id: "bow-empty",
        name: "Shortbow",
        type: "weapon",
        system: { missile: true },
      });
      (bow as any).actor = {
        items: {
          filter: () => [],
          get: () => null,
        },
      };

      // 1. Enforce mode
      vi.spyOn(game.settings, "get").mockReturnValue("enforce");
      const errorSpy = vi.spyOn(ui.notifications, "error").mockImplementation(() => {});

      let options: Record<string, unknown> = {};
      let result = await bow._handleAmmoConsumption(options);
      expect(result).toBe(false);
      expect(errorSpy).toHaveBeenCalled();

      // 2. Warn mode
      vi.spyOn(game.settings, "get").mockReturnValue("warn");
      options = {};
      result = await bow._handleAmmoConsumption(options);
      expect(result).toBe(true);
      const warnMsg = await (options.onConfirm as Function)();
      expect(warnMsg).toBeTruthy();
    });

    it("correctly identifies ammo types for crossbows (bolt/quarrel), slings (stone/bullet), and blowguns (dart)", async () => {
      vi.spyOn(game.settings, "get").mockReturnValue("warn");

      const crossbow = new OseItem({ id: "xbow", name: "Heavy Crossbow", type: "weapon" });
      const sling = new OseItem({ id: "sling", name: "Leather Sling", type: "weapon" });
      const blowgun = new OseItem({ id: "blowgun", name: "Bamboo Blowpipe", type: "weapon" });

      const boltItem = new OseItem({
        id: "bolt",
        name: "Crossbow Bolts",
        type: "item",
        system: { quantity: { value: 10 } },
      });
      const stoneItem = new OseItem({
        id: "stone",
        name: "Sling Stones",
        type: "item",
        system: { quantity: { value: 15 } },
      });
      const dartItem = new OseItem({
        id: "dart",
        name: "Poison Darts",
        type: "item",
        system: { quantity: { value: 8 } },
      });

      const allItems = [boltItem, stoneItem, dartItem];
      const mockActor = {
        items: {
          filter: (fn: any) => allItems.filter(fn),
          get: (id: string) => allItems.find((i) => i.id === id),
        },
      };

      (crossbow as any).actor = mockActor;
      (sling as any).actor = mockActor;
      (blowgun as any).actor = mockActor;

      const xbowOpts: Record<string, unknown> = {};
      await crossbow._handleAmmoConsumption(xbowOpts);
      expect((xbowOpts.ammoOptions as any[])[0].id).toBe("bolt");

      const slingOpts: Record<string, unknown> = {};
      await sling._handleAmmoConsumption(slingOpts);
      expect((slingOpts.ammoOptions as any[])[0].id).toBe("stone");

      const blowgunOpts: Record<string, unknown> = {};
      await blowgun._handleAmmoConsumption(blowgunOpts);
      expect((blowgunOpts.ammoOptions as any[])[0].id).toBe("dart");
    });

    it("clamps spent ammo quantity at minimum 0", async () => {
      vi.spyOn(game.settings, "get").mockReturnValue("warn");

      const arrow = new OseItem({
        id: "last-arrow",
        name: "Arrows",
        type: "item",
        system: { quantity: { value: 1 } },
      });
      const updateSpy = vi.spyOn(arrow, "update").mockResolvedValue(arrow);

      const bow = new OseItem({ id: "bow", name: "Shortbow", type: "weapon", system: { missile: true } });
      (bow as any).actor = {
        items: {
          filter: () => [arrow],
          get: () => arrow,
        },
      };

      const options: Record<string, unknown> = {};
      await bow._handleAmmoConsumption(options);

      // Confirm expenditure
      await (options.onConfirm as Function)();
      expect(updateSpy).toHaveBeenCalledWith({ "system.quantity.value": 0 });
    });
  });

  describe("TargetAttack Forwarding & Monster Safety", () => {
    it("forwards tactical combat options (twoWeapons, defenderRetreating, customBonus) through targetAttack to rollAttack", async () => {
      let capturedOptions: any = null;
      const actor = new OseActor({
        id: "fighter-target",
        type: "character",
        system: {
          scores: { str: { mod: 2 }, dex: { mod: 0 } },
          thac0: { value: 19, bba: 0, mod: { melee: 0, missile: 0 } },
          config: {},
        },
      });

      vi.spyOn(actor, "rollAttack").mockImplementation((_data: any, options: any) => {
        capturedOptions = options;
        return Promise.resolve({} as any);
      });

      await actor.targetAttack({ roll: {} }, "melee", {
        twoWeapons: true,
        defenderRetreating: true,
        customBonus: 3,
        skipDialog: true,
      });

      expect(capturedOptions).not.toBeNull();
      expect(capturedOptions.type).toBe("melee");
      expect(capturedOptions.twoWeapons).toBe(true);
      expect(capturedOptions.defenderRetreating).toBe(true);
      expect(capturedOptions.customBonus).toBe(3);
      expect(capturedOptions.skipDialog).toBe(true);
    });

    it("safely rolls attack for monsters without scores throwing TypeError", () => {
      let capturedRollData: any = null;
      vi.spyOn(OseDice, "Roll").mockImplementation((data: any) => {
        capturedRollData = data;
        return data;
      });

      const monster = new OseActor({
        id: "goblin-1",
        type: "monster",
        system: {
          thac0: { value: 19, bba: 0, mod: { melee: 1, missile: 0 } },
          config: {},
        },
      });

      expect(() => {
        monster.rollAttack({ item: { system: { damage: "1d6", bonus: 0 } } }, { type: "melee", skipDialog: true });
      }).not.toThrow();

      expect(capturedRollData).not.toBeNull();
      // Monster thac0.mod.melee (1) should be in roll parts without error on missing scores
      expect(capturedRollData.parts).toContain(1);
    });

    it("safely rolls missile attack for monsters without scores", () => {
      let capturedRollData: any = null;
      vi.spyOn(OseDice, "Roll").mockImplementation((data: any) => {
        capturedRollData = data;
        return data;
      });

      const monster = new OseActor({
        id: "goblin-archer",
        type: "monster",
        system: {
          thac0: { value: 19, bba: 0, mod: { melee: 0, missile: 2 } },
          damage: { mod: { missile: 1 } },
          config: {},
        },
      });

      expect(() => {
        monster.rollAttack(
          { item: { system: { damage: "1d6", bonus: 0, missile: true } } },
          { type: "missile", skipDialog: true },
        );
      }).not.toThrow();

      expect(capturedRollData).not.toBeNull();
      // Monster thac0.mod.missile (2) should be in attack roll parts
      expect(capturedRollData.parts).toEqual(["1d20", 2]);
      // Monster damage.mod.missile (1) should be in damage parts
      expect(capturedRollData.data.roll.dmg).toEqual(["1d6", 1]);
    });
  });

  describe("GYGAX-031: Magical Ammunition Bonus & Auto-Range Band Modifiers", () => {
    it("extracts numerical bonus from ammo system.bonus or signed +N/-N name tokens", () => {
      expect(OseItem.extractAmmoBonus({ name: "Arrows (20)", system: {} })).toBe(0);
      expect(OseItem.extractAmmoBonus({ name: "Arrows +1", system: {} })).toBe(1);
      expect(OseItem.extractAmmoBonus({ name: "+2 Silver Bolts", system: {} })).toBe(2);
      expect(OseItem.extractAmmoBonus({ name: "Cursed Arrows -1", system: {} })).toBe(-1);
      expect(OseItem.extractAmmoBonus({ name: "Custom Arrows", system: { bonus: 3 } })).toBe(3);
    });

    it("injects selected magical ammo bonus into attack and damage rollData on confirm", async () => {
      vi.spyOn(game.settings, "get").mockImplementation((_scope: string, key: string) => {
        if (key === "automateAmmo") return "warn";
        return false;
      });

      const magicArrows = new OseItem({
        id: "arrows-plus2",
        name: "Arrows +2",
        type: "item",
        system: { quantity: { value: 5 } },
      });
      vi.spyOn(magicArrows, "update").mockResolvedValue(magicArrows);

      const bow = new OseItem({
        id: "bow-magic-test",
        name: "Longbow",
        type: "weapon",
        system: { missile: true, damage: "1d6" },
      });
      (bow as any).actor = {
        items: {
          filter: () => [magicArrows],
          get: () => magicArrows,
        },
      };

      const options: Record<string, any> = {};
      await bow._handleAmmoConsumption(options);

      const rollData = {
        parts: ["1d20", 1],
        data: {
          actor: { system: { config: {} } },
          roll: { dmg: ["1d6"] },
        },
      };

      const formMock = { elements: { namedItem: () => ({ value: "arrows-plus2" }) } } as any;
      const spentText = await options.onConfirm(formMock, rollData);

      expect(spentText).toContain("Arrows +2 (4 left)");
      expect(options.selectedAmmoBonus).toBe(2);
      expect(rollData.parts).toEqual(["1d20", 1, 2]);
      expect(rollData.data.roll.dmg).toEqual(["1d6", 2]);
    });

    it("computes B/X missile range modifiers (+1 Short, 0 Medium, -1 Long, outOfRange beyond Long)", () => {
      const range = { short: 50, medium: 100, long: 150 };
      expect(OseActor.computeRangeModifier(range, 30)).toEqual({
        band: "short",
        modifier: 1,
        outOfRange: false,
        distance: 30,
      });
      expect(OseActor.computeRangeModifier(range, 80)).toEqual({
        band: "medium",
        modifier: 0,
        outOfRange: false,
        distance: 80,
      });
      expect(OseActor.computeRangeModifier(range, 140)).toEqual({
        band: "long",
        modifier: -1,
        outOfRange: false,
        distance: 140,
      });
      expect(OseActor.computeRangeModifier(range, 180)).toEqual({
        band: "out",
        modifier: -1,
        outOfRange: true,
        distance: 180,
      });
    });

    it("applies range band modifier in rollAttack when targetDistance is provided", () => {
      let capturedRollData: any = null;
      vi.spyOn(OseDice, "Roll").mockImplementation((data: any) => {
        capturedRollData = data;
        return data;
      });
      const warnSpy = vi.spyOn(ui.notifications, "warn").mockImplementation(() => {});

      const archer = new OseActor({
        id: "archer-range",
        type: "character",
        system: {
          scores: { str: { mod: 0 }, dex: { mod: 1 } },
          thac0: { value: 19, bba: 0, mod: { melee: 0, missile: 0 } },
          config: {},
        },
      });

      const bow = { system: { damage: "1d6", missile: true, range: { short: 50, medium: 100, long: 150 } } };

      // Short range (40'): +1
      archer.rollAttack({ item: bow }, { type: "missile", targetDistance: 40, skipDialog: true });
      expect(capturedRollData.parts).toEqual(["1d20", 1, 1]);

      // Long range (120'): -1
      archer.rollAttack({ item: bow }, { type: "missile", targetDistance: 120, skipDialog: true });
      expect(capturedRollData.parts).toEqual(["1d20", 1, -1]);

      // Out of range (200'): -1 and warning
      archer.rollAttack({ item: bow }, { type: "missile", targetDistance: 200, skipDialog: true });
      expect(capturedRollData.parts).toEqual(["1d20", 1, -1]);
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe("GYGAX-032: Spell Levels 1–9 Schema & Effect Keys", () => {
    it("tracks spell slot max for levels 1 through 9 on OseActor.classStats()", () => {
      const caster = new OseActor({
        id: "caster-lvl9",
        type: "character",
        system: {
          hp: { max: 20, fraction: 0 },
          thac0: { value: 14 },
          saves: {
            death: { value: 8 },
            wand: { value: 9 },
            paralysis: { value: 10 },
            breath: { value: 11 },
            spell: { value: 12 },
          },
          spells: {
            slots: {
              1: { max: 4 },
              2: { max: 4 },
              3: { max: 3 },
              4: { max: 3 },
              5: { max: 2 },
              6: { max: 2 },
              7: { max: 1 },
              8: { max: 1 },
              9: { max: 1 },
            },
          },
        },
      });
      const stats = caster.classStats();
      for (let lvl = 1; lvl <= 9; lvl++) {
        expect(stats.spells[lvl]).toBeGreaterThan(0);
      }
    });

    it("exposes spell slot Active Effect keys for levels 1 through 9", () => {
      const keys = effectKeys().map((k) => k.key);
      for (let lvl = 1; lvl <= 9; lvl++) {
        expect(keys).toContain(`system.spells.${lvl}.max`);
      }
    });
  });

  describe("GYGAX-033: Unidentified Items & Hidden GM Charges", () => {
    it("masks unidentified item name and description for non-GM users while showing true values to GMs", () => {
      const prevIsGM = game.user.isGM;
      try {
        const wand = new OseItem({
          id: "wand-1",
          name: "Wand of Paralyzation",
          type: "item",
          system: {
            identified: false,
            unidentifiedName: "Carved Bone Wand",
            description: "<p>Saves vs wand or paralyzed for 6 turns (14 charges).</p>",
            unidentifiedDescription: "<p>A pale bone rod etched with runes.</p>",
            hideCounter: true,
            quantity: { value: 14, max: 14 },
          },
        });

        game.user.isGM = false;
        expect(wand.isIdentified).toBe(false);
        expect(wand.displayName).toBe("Carved Bone Wand");
        expect(wand.displayDescription).toBe("<p>A pale bone rod etched with runes.</p>");
        expect(wand.isCounterVisible).toBe(false);

        game.user.isGM = true;
        expect(wand.displayName).toBe("Wand of Paralyzation");
        expect(wand.displayDescription).toBe("<p>Saves vs wand or paralyzed for 6 turns (14 charges).</p>");
        expect(wand.isCounterVisible).toBe(true);
      } finally {
        game.user.isGM = prevIsGM;
      }
    });
  });

  describe("GYGAX-034: Conditional Vs. Creature Group Weapon Modifiers", () => {
    it("parses vsGroup modifiers from weapon tags and structured vsGroup map", () => {
      const weaponModel = new OseDataModelWeapon({
        bonus: 1,
        tags: [{ title: "+3 vs. undead", value: "+3 vs. undead" }],
        vsGroup: { dragons: 4 },
      });

      expect(weaponModel.parsedVsGroups).toEqual({
        undead: 3,
        dragons: 4,
      });
    });

    it("uses conditional +3 vs. undead bonus instead of base +1 when attacking an undead target", () => {
      let capturedRollData: any = null;
      vi.spyOn(OseDice, "Roll").mockImplementation((data: any) => {
        capturedRollData = data;
        return data;
      });

      const fighter = new OseActor({
        id: "fighter-undead-slayer",
        type: "character",
        system: {
          scores: { str: { mod: 1 }, dex: { mod: 0 } },
          thac0: { value: 17, bba: 2, mod: { melee: 0, missile: 0 } },
          config: {},
        },
      });

      const maceVsUndead = {
        system: {
          damage: "1d6",
          bonus: 1,
          tags: [{ title: "+3 vs. undead", value: "+3 vs. undead" }],
        },
      };

      const wraithTarget = {
        actor: {
          name: "Wraith",
          system: { details: { biography: "Incorporeal undead monster" } },
        },
      };

      const goblinTarget = {
        actor: {
          name: "Goblin",
          system: { details: { biography: "Small humanoid monster" } },
        },
      };

      // Against Wraith (undead): uses +3 instead of +1
      fighter.rollAttack({ item: maceVsUndead }, { type: "melee", target: wraithTarget, skipDialog: true });
      // parts: ["1d20", str(1), vsUndead(3)]
      expect(capturedRollData.parts).toEqual(["1d20", 1, 3]);
      expect(capturedRollData.data.roll.dmg).toEqual(["1d6", 3, 1]);

      // Against Goblin: uses base +1
      fighter.rollAttack({ item: maceVsUndead }, { type: "melee", target: goblinTarget, skipDialog: true });
      expect(capturedRollData.parts).toEqual(["1d20", 1, 1]);
      expect(capturedRollData.data.roll.dmg).toEqual(["1d6", 1, 1]);
    });
  });

  describe("GYGAX-035: Ability-Linked Roll-Under Proficiencies", () => {
    it("computes effectiveTarget from linked actor ability score + targetMod", () => {
      const ability = new OseDataModelAbility({
        abilityScore: "int",
        targetMod: -2,
        roll: "1d20",
        rollType: "under",
      });
      (ability as any).parent = {
        actor: {
          system: {
            scores: {
              int: { value: 14 },
            },
          },
        },
      };

      expect(ability.effectiveTarget).toBe(12);
    });
  });

  describe("GYGAX-036: Silver/Magic Gating, Damage Mitigation, MR %, & Mount Encumbrance", () => {
    it("gates weapon damage against monsters requiring magic or silver weapons and applies half/immune traits", () => {
      const wight = new OseActor({
        id: "wight-1",
        name: "Wight",
        type: "monster",
        system: {
          hp: { value: 15, max: 15 },
          OnlyHurtByMagic: true,
          OnlyHurtBySilver: true,
          halfDamageFrom: ["blunt"],
          immuneTo: ["poison"],
        },
      });

      const normalSword = { name: "Normal Sword", system: { bonus: 0, tags: [] } };
      const silverDagger = {
        name: "Silver Dagger",
        system: { bonus: 0, tags: [{ title: "Silver", value: "Silver" }] },
      };
      const magicMace = {
        name: "Mace +1",
        system: { bonus: 1, tags: [{ title: "Blunt", value: "Blunt" }] },
      };

      // Normal sword cannot harm Wight
      expect(wight.evaluateWeaponDamage(8, { weapon: normalSword }).amount).toBe(0);

      // Silver dagger harms Wight for full damage
      expect(wight.evaluateWeaponDamage(6, { weapon: silverDagger }).amount).toBe(6);

      // Magic mace harms Wight, halved by blunt resistance
      expect(wight.evaluateWeaponDamage(7, { weapon: magicMace }).amount).toBe(3);

      // Poison damage is immune
      expect(wight.evaluateWeaponDamage(10, { damageType: "poison" }).amount).toBe(0);
    });

    it("computes mount/pack-animal encumbrance and auto-halves movement past half capacity", () => {
      const camelModel = new OseDataModelMonster({
        movement: { base: 150 },
        config: { movementAuto: true },
        encumbrance: { value: 0, max: 3000 },
      });

      // Mock 2000 cn carried (> 1500 half capacity, <= 3000 max)
      (camelModel as any).parent = {
        items: [
          {
            type: "item",
            system: { containerId: "", quantity: { value: 1 }, weight: 2000, cost: 0 },
          },
        ],
      };

      camelModel.prepareDerivedData();
      expect(camelModel.encumbrance.value).toBe(2000);
      expect(camelModel.encumbrance.atSecondBreakpoint).toBe(true);
      expect(camelModel.encumbrance.encumbered).toBe(false);
      expect(camelModel.movement.base).toBe(75);
    });

    it("rolls percentile Magic Resistance (1d100 <= mr) for monsters", () => {
      let capturedRollData: any = null;
      vi.spyOn(OseDice, "Roll").mockImplementation((data: any) => {
        capturedRollData = data;
        return data;
      });

      const demon = new OseActor({
        id: "demon-mr",
        name: "Demon",
        type: "monster",
        system: { details: { magicResistance: 50 } },
      });

      demon.rollMagicResistance();
      expect(capturedRollData).not.toBeNull();
      expect(capturedRollData.parts).toEqual(["1d100"]);
      expect(capturedRollData.data.roll.type).toBe("below");
      expect(capturedRollData.data.roll.target).toBe(50);
    });
  });
});
