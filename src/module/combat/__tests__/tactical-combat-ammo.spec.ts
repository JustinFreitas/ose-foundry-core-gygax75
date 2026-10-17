import { beforeEach, describe, expect, it, vi } from "vitest";
import OseActor from "../../actor/entity";
import OseDice from "../../helpers-dice";
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
});
