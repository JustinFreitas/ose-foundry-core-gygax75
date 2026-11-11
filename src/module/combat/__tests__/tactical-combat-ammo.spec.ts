import { beforeEach, describe, expect, it, vi } from "vitest";
import OseDataModelMonster from "../../actor/data-model-monster";
import OseActor from "../../actor/entity";
import { effectKeys } from "../../effects/effect-keys";
import { functionsForTesting as chatTesting } from "../../helpers-chat";
import OseDice from "../../helpers-dice";
import OseDataModelAbility from "../../item/data-model-ability";
import OseDataModelWeapon from "../../item/data-model-weapon";
import OseItem from "../../item/entity";

type ActorCtor = new (data?: Record<string, unknown>) => OseActor;
type ItemCtor = new (data?: Record<string, unknown>) => OseItem;

const createActor = (data: Record<string, unknown> = {}): OseActor => new (OseActor as unknown as ActorCtor)(data);

const createItem = (data: Record<string, unknown> = {}): OseItem => new (OseItem as unknown as ItemCtor)(data);

const mockWeapon = (data: Record<string, unknown>): OseItem => data as unknown as OseItem;

interface CapturedRollPayload {
  parts: Array<string | number>;
  flavor?: string;
  title?: string;
  data: {
    roll: {
      dmg?: Array<string | number>;
      type?: string;
      target?: unknown;
    };
  };
}

function captureRolls(): { readonly last: CapturedRollPayload | null } {
  let captured: CapturedRollPayload | null = null;
  vi.spyOn(OseDice, "Roll").mockImplementation(((data: CapturedRollPayload) => {
    captured = data;
    return data;
  }) as never);
  return {
    get last() {
      return captured;
    },
  };
}

interface AmmoOptionEntry {
  id: string;
  name: string;
  quantity: number;
  bonus: number;
}

type ConfirmFn = (form?: unknown, rollData?: unknown) => Promise<string | null>;

describe("Phase 3: Tactical Combat & Automated Ammunition", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    const proto = OseItem.prototype as unknown as { update?: unknown };
    if (!proto.update) {
      proto.update = vi.fn().mockImplementation(function (this: OseItem) {
        return Promise.resolve(this);
      });
    }
  });

  describe("Tactical Combat Modifiers & Damage Levers (OseActor.rollAttack)", () => {
    it("adds Str mod and explicit damage.mod.melee to melee damage, without leaking thac0.mod.melee into damage", () => {
      const rolls = captureRolls();

      const actor = createActor({
        id: "fighter-1",
        type: "character",
        system: {
          scores: { str: { mod: 2 }, dex: { mod: 1 } },
          thac0: { value: 19, bba: 0, mod: { melee: 1, missile: 0 } },
          damage: { mod: { melee: 3, missile: 0 } },
          config: {},
        },
      });

      actor.rollAttack(
        { item: mockWeapon({ system: { damage: "1d8", bonus: 0 } }) },
        { type: "melee", skipDialog: true },
      );

      expect(rolls.last).not.toBeNull();
      expect(rolls.last?.parts).toEqual(["1d20", 2, 1]);
      expect(rolls.last?.data.roll.dmg).toEqual(["1d8", 2, 3]);
    });

    it("uses weapon displayName for unidentified weapons in attack labels and out-of-range warnings", () => {
      const rolls = captureRolls();
      const warnSpy = vi.spyOn(ui.notifications, "warn").mockImplementation((() => ({})) as never);

      const actor = createActor({
        id: "archer-unid",
        type: "character",
        system: {
          scores: { str: { mod: 0 }, dex: { mod: 0 } },
          thac0: { value: 19, bba: 0, mod: { melee: 0, missile: 0 } },
          config: {},
        },
      });

      const cursedBow = mockWeapon({
        name: "Cursed Longbow -2",
        displayName: "Worn Ash Bow",
        system: { damage: "1d6", missile: true, range: { short: 50, medium: 100, long: 150 } },
      });

      actor.rollAttack({ item: cursedBow }, { type: "missile", targetDistance: 200, skipDialog: true });

      expect(rolls.last?.flavor).not.toContain("Cursed Longbow -2");
      expect(warnSpy).toHaveBeenCalled();
      const warnCall = String(warnSpy.mock.calls[0]?.[0] ?? "");
      expect(warnCall).not.toContain("Cursed Longbow -2");
    });

    it("applies two-weapon fighting bonus (+1 to attack) on melee attacks", () => {
      const rolls = captureRolls();

      const actor = createActor({
        id: "ranger-1",
        type: "character",
        system: {
          scores: { str: { mod: 1 }, dex: { mod: 0 } },
          thac0: { value: 19, bba: 0, mod: { melee: 0, missile: 0 } },
          config: {},
        },
      });

      actor.rollAttack(
        { item: mockWeapon({ system: { damage: "1d6" } }) },
        { type: "melee", twoWeapons: true, skipDialog: true },
      );

      expect(rolls.last?.parts).toEqual(["1d20", 1, 1]);
    });

    it("applies defender retreating bonus (+2 to attack) and customBonus", () => {
      const rolls = captureRolls();

      const actor = createActor({
        id: "cleric-1",
        type: "character",
        system: {
          scores: { str: { mod: 0 }, dex: { mod: 0 } },
          thac0: { value: 19, bba: 0, mod: { melee: 0, missile: 0 } },
          config: {},
        },
      });

      actor.rollAttack(
        { item: mockWeapon({ system: { damage: "1d6" } }) },
        { type: "melee", defenderRetreating: true, customBonus: 3, skipDialog: true },
      );

      expect(rolls.last?.parts).toEqual(["1d20", 2, 3]);
    });

    it("applies missile damage lever (system.damage.mod.missile) to missile damage, while keeping dex mod out of damage (RAW)", () => {
      const rolls = captureRolls();

      const actor = createActor({
        id: "archer-1",
        type: "character",
        system: {
          scores: { str: { mod: 0 }, dex: { mod: 3 } },
          thac0: { value: 19, bba: 0, mod: { melee: 0, missile: 1 } },
          damage: { mod: { missile: 2 } },
          config: {},
        },
      });

      actor.rollAttack({ item: mockWeapon({ system: { damage: "1d6" } }) }, { type: "missile", skipDialog: true });

      expect(rolls.last?.parts).toEqual(["1d20", 3, 1]);
      expect(rolls.last?.data.roll.dmg).toEqual(["1d6", 2]);
    });

    it("keeps missile damage completely unaugmented when damage.mod.missile is absent", () => {
      const rolls = captureRolls();

      const actor = createActor({
        id: "archer-plain",
        type: "character",
        system: {
          scores: { str: { mod: 0 }, dex: { mod: 3 } },
          thac0: { value: 19, bba: 0, mod: { melee: 0, missile: 0 } },
          config: {},
        },
      });

      actor.rollAttack({ item: mockWeapon({ system: { damage: "1d6" } }) }, { type: "missile", skipDialog: true });

      expect(rolls.last?.parts).toEqual(["1d20", 3]);
      expect(rolls.last?.data.roll.dmg).toEqual(["1d6"]);
    });
  });

  describe("Automated Ammunition Tracking (OseItem._handleAmmoConsumption)", () => {
    it("skips ammunition consumption when automateAmmo is disabled", async () => {
      const getSettingSpy = vi.spyOn(game.settings, "get").mockReturnValue("disabled" as never);

      const weapon = createItem({
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
      vi.spyOn(game.settings, "get").mockReturnValue("warn" as never);

      const dagger = createItem({
        id: "dagger-1",
        name: "Dagger",
        type: "weapon",
        system: { quantity: { value: 3 }, missile: true },
      });
      (dagger as unknown as { actor: unknown }).actor = { items: new Map() };

      const updateSpy = vi.spyOn(dagger, "update").mockResolvedValue(dagger);

      const options: Record<string, unknown> = {};
      const result = await dagger._handleAmmoConsumption(options);

      expect(result).toBe(true);
      expect(typeof options.onConfirm).toBe("function");

      const confirmResult = await (options.onConfirm as ConfirmFn)();
      expect(confirmResult).toBeNull();
      expect(updateSpy).toHaveBeenCalledWith({ "system.quantity.value": 2 });
    });

    it("enforces thrown ammo when quantity is 0 and mode is enforce", async () => {
      vi.spyOn(game.settings, "get").mockReturnValue("enforce" as never);
      const errorSpy = vi.spyOn(ui.notifications, "error").mockImplementation((() => ({})) as never);

      const dagger = createItem({
        id: "dagger-empty",
        name: "Throwing Dagger",
        type: "weapon",
        system: { quantity: { value: 0 }, missile: true },
      });
      (dagger as unknown as { actor: unknown }).actor = { items: new Map() };

      const options: Record<string, unknown> = {};
      const result = await dagger._handleAmmoConsumption(options);

      expect(result).toBe(false);
      expect(errorSpy).toHaveBeenCalled();
    });

    it("detects compatible ammunition for bows, sorts normal ammo first, and decrements spent ammo", async () => {
      vi.spyOn(game.settings, "get").mockReturnValue("warn" as never);

      const normalArrows = createItem({
        id: "arrows-norm",
        name: "Arrows (20)",
        type: "item",
        system: { quantity: { value: 20 } },
      });

      const magicArrows = createItem({
        id: "arrows-magic",
        name: "+1 Silver Arrows",
        type: "item",
        system: { quantity: { value: 5 } },
      });

      const mockItems = new Map<string, OseItem>([
        [normalArrows.id ?? "arrows-norm", normalArrows],
        [magicArrows.id ?? "arrows-magic", magicArrows],
      ]);

      const bow = createItem({
        id: "bow-1",
        name: "Longbow",
        type: "weapon",
        system: { missile: true },
      });
      (bow as unknown as { actor: unknown }).actor = {
        items: {
          filter: (fn: (item: OseItem) => boolean) => Array.from(mockItems.values()).filter(fn),
          get: (id: string) => mockItems.get(id),
        },
      };

      const updateSpy = vi.spyOn(magicArrows, "update").mockResolvedValue(magicArrows);

      const options: Record<string, unknown> = {};
      const result = await bow._handleAmmoConsumption(options);

      expect(result).toBe(true);
      expect(Array.isArray(options.ammoOptions)).toBe(true);
      const ammoList = options.ammoOptions as AmmoOptionEntry[];
      expect(ammoList.length).toBe(2);
      expect(ammoList[0]?.id).toBe("arrows-norm");
      expect(ammoList[1]?.id).toBe("arrows-magic");

      const formMock = { elements: { namedItem: () => ({ value: "arrows-magic" }) } };
      const spentLabel = await (options.onConfirm as ConfirmFn)(formMock);

      expect(updateSpy).toHaveBeenCalledWith({ "system.quantity.value": 4 });
      expect(spentLabel).toContain("+1 Silver Arrows");
      expect(spentLabel).toContain("4 left");
    });

    it("handles out of ammo condition for bow under enforce vs warn modes", async () => {
      const bow = createItem({
        id: "bow-empty",
        name: "Shortbow",
        type: "weapon",
        system: { missile: true },
      });
      (bow as unknown as { actor: unknown }).actor = {
        items: {
          filter: () => [],
          get: () => null,
        },
      };

      vi.spyOn(game.settings, "get").mockReturnValue("enforce" as never);
      const errorSpy = vi.spyOn(ui.notifications, "error").mockImplementation((() => ({})) as never);

      let options: Record<string, unknown> = {};
      let result = await bow._handleAmmoConsumption(options);
      expect(result).toBe(false);
      expect(errorSpy).toHaveBeenCalled();

      vi.spyOn(game.settings, "get").mockReturnValue("warn" as never);
      options = {};
      result = await bow._handleAmmoConsumption(options);
      expect(result).toBe(true);
      const warnMsg = await (options.onConfirm as ConfirmFn)();
      expect(warnMsg).toBeTruthy();
    });

    it("correctly identifies ammo types for crossbows (bolt/quarrel), slings (stone/bullet), and blowguns (dart)", async () => {
      vi.spyOn(game.settings, "get").mockReturnValue("warn" as never);

      const crossbow = createItem({ id: "xbow", name: "Heavy Crossbow", type: "weapon" });
      const sling = createItem({ id: "sling", name: "Leather Sling", type: "weapon" });
      const blowgun = createItem({ id: "blowgun", name: "Bamboo Blowpipe", type: "weapon" });

      const boltItem = createItem({
        id: "bolt",
        name: "Crossbow Bolts",
        type: "item",
        system: { quantity: { value: 10 } },
      });
      const stoneItem = createItem({
        id: "stone",
        name: "Sling Stones",
        type: "item",
        system: { quantity: { value: 15 } },
      });
      const dartItem = createItem({
        id: "dart",
        name: "Poison Darts",
        type: "item",
        system: { quantity: { value: 8 } },
      });

      const allItems = [boltItem, stoneItem, dartItem];
      const mockActor = {
        items: {
          filter: (fn: (item: OseItem) => boolean) => allItems.filter(fn),
          get: (id: string) => allItems.find((i) => i.id === id),
        },
      };

      (crossbow as unknown as { actor: unknown }).actor = mockActor;
      (sling as unknown as { actor: unknown }).actor = mockActor;
      (blowgun as unknown as { actor: unknown }).actor = mockActor;

      const xbowOpts: Record<string, unknown> = {};
      await crossbow._handleAmmoConsumption(xbowOpts);
      expect((xbowOpts.ammoOptions as AmmoOptionEntry[])[0]?.id).toBe("bolt");

      const slingOpts: Record<string, unknown> = {};
      await sling._handleAmmoConsumption(slingOpts);
      expect((slingOpts.ammoOptions as AmmoOptionEntry[])[0]?.id).toBe("stone");

      const blowgunOpts: Record<string, unknown> = {};
      await blowgun._handleAmmoConsumption(blowgunOpts);
      expect((blowgunOpts.ammoOptions as AmmoOptionEntry[])[0]?.id).toBe("dart");
    });

    it("clamps spent ammo quantity at minimum 0", async () => {
      vi.spyOn(game.settings, "get").mockReturnValue("warn" as never);

      const arrow = createItem({
        id: "last-arrow",
        name: "Arrows",
        type: "item",
        system: { quantity: { value: 1 } },
      });
      const updateSpy = vi.spyOn(arrow, "update").mockResolvedValue(arrow);

      const bow = createItem({ id: "bow", name: "Shortbow", type: "weapon", system: { missile: true } });
      (bow as unknown as { actor: unknown }).actor = {
        items: {
          filter: () => [arrow],
          get: () => arrow,
        },
      };

      const options: Record<string, unknown> = {};
      await bow._handleAmmoConsumption(options);

      await (options.onConfirm as ConfirmFn)();
      expect(updateSpy).toHaveBeenCalledWith({ "system.quantity.value": 0 });
    });
  });

  describe("TargetAttack Forwarding & Monster Safety", () => {
    it("forwards tactical combat options and clones per-target roll data in targetAttack", async () => {
      const capturedTargets: unknown[] = [];
      let capturedOptions: Record<string, unknown> | null = null;
      const actor = createActor({
        id: "fighter-target",
        type: "character",
        system: {
          scores: { str: { mod: 2 }, dex: { mod: 0 } },
          thac0: { value: 19, bba: 0, mod: { melee: 0, missile: 0 } },
          config: {},
        },
      });

      vi.spyOn(actor, "rollAttack").mockImplementation(((
        data: { roll?: { target?: unknown } },
        options: Record<string, unknown>,
      ) => {
        capturedTargets.push(data.roll?.target);
        capturedOptions = options;
        return Promise.resolve({});
      }) as never);

      const prevTargets = game.user.targets;
      const target1 = { id: "tok-1" };
      const target2 = { id: "tok-2" };
      Object.defineProperty(game.user, "targets", {
        value: new Set([target1, target2]),
        configurable: true,
        writable: true,
      });

      try {
        const sharedData = { roll: {} as Record<string, unknown> };
        await actor.targetAttack(sharedData, "melee", {
          twoWeapons: true,
          defenderRetreating: true,
          customBonus: 3,
          skipDialog: true,
        });
        expect(capturedTargets).toEqual([target1, target2]);
        expect(sharedData.roll.target).toBeUndefined();
      } finally {
        Object.defineProperty(game.user, "targets", {
          value: prevTargets,
          configurable: true,
          writable: true,
        });
      }

      expect(capturedOptions).not.toBeNull();
      expect(capturedOptions).toMatchObject({
        type: "melee",
        twoWeapons: true,
        defenderRetreating: true,
        customBonus: 3,
        skipDialog: true,
      });
    });

    it("safely rolls attack for monsters without scores throwing TypeError", () => {
      const rolls = captureRolls();

      const monster = createActor({
        id: "goblin-1",
        type: "monster",
        system: {
          thac0: { value: 19, bba: 0, mod: { melee: 1, missile: 0 } },
          config: {},
        },
      });

      expect(() => {
        monster.rollAttack(
          { item: mockWeapon({ system: { damage: "1d6", bonus: 0 } }) },
          { type: "melee", skipDialog: true },
        );
      }).not.toThrow();

      expect(rolls.last).not.toBeNull();
      expect(rolls.last?.parts).toContain(1);
    });

    it("safely rolls missile attack for monsters without scores", () => {
      const rolls = captureRolls();

      const monster = createActor({
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
          { item: mockWeapon({ system: { damage: "1d6", bonus: 0, missile: true } }) },
          { type: "missile", skipDialog: true },
        );
      }).not.toThrow();

      expect(rolls.last).not.toBeNull();
      expect(rolls.last?.parts).toEqual(["1d20", 2]);
      expect(rolls.last?.data.roll.dmg).toEqual(["1d6", 1]);
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
      vi.spyOn(game.settings, "get").mockImplementation(((_scope: string, key: string) => {
        if (key === "automateAmmo") return "warn";
        return false;
      }) as never);

      const magicArrows = createItem({
        id: "arrows-plus2",
        name: "Arrows +2",
        type: "item",
        system: { quantity: { value: 5 } },
      });
      vi.spyOn(magicArrows, "update").mockResolvedValue(magicArrows);

      const bow = createItem({
        id: "bow-magic-test",
        name: "Longbow",
        type: "weapon",
        system: { missile: true, damage: "1d6" },
      });
      (bow as unknown as { actor: unknown }).actor = {
        items: {
          filter: () => [magicArrows],
          get: () => magicArrows,
        },
      };

      const options: Record<string, unknown> = {};
      await bow._handleAmmoConsumption(options);

      const rollData = {
        parts: ["1d20", 1] as Array<string | number>,
        data: {
          actor: { system: { config: {} } },
          roll: { dmg: ["1d6"] as Array<string | number> },
        },
      };

      const formMock = { elements: { namedItem: () => ({ value: "arrows-plus2" }) } };
      const spentText = await (options.onConfirm as ConfirmFn)(formMock, rollData);

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
      const rolls = captureRolls();
      const warnSpy = vi.spyOn(ui.notifications, "warn").mockImplementation((() => ({})) as never);

      const archer = createActor({
        id: "archer-range",
        type: "character",
        system: {
          scores: { str: { mod: 0 }, dex: { mod: 1 } },
          thac0: { value: 19, bba: 0, mod: { melee: 0, missile: 0 } },
          config: {},
        },
      });

      const bow = mockWeapon({
        name: "Shortbow",
        system: { damage: "1d6", missile: true, range: { short: 50, medium: 100, long: 150 } },
      });

      archer.rollAttack({ item: bow }, { type: "missile", targetDistance: 40, skipDialog: true });
      expect(rolls.last?.parts).toEqual(["1d20", 1, 1]);

      archer.rollAttack({ item: bow }, { type: "missile", targetDistance: 120, skipDialog: true });
      expect(rolls.last?.parts).toEqual(["1d20", 1, -1]);

      archer.rollAttack({ item: bow }, { type: "missile", targetDistance: 200, skipDialog: true });
      expect(rolls.last?.parts).toEqual(["1d20", 1, -1]);
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  describe("GYGAX-032: Spell Levels 1–9 Schema & Effect Keys", () => {
    it("tracks spell slot max for levels 1 through 9 on OseActor.classStats()", () => {
      const caster = createActor({
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
      const stats = caster.classStats() as { spells: Record<number, number> };
      for (let lvl = 1; lvl <= 9; lvl++) {
        expect(stats.spells[lvl]).toBeGreaterThan(0);
      }
    });

    it("exposes spell slot Active Effect keys for levels 1 through 9", () => {
      const keys = effectKeys("character").map((k) => k.key);
      for (let lvl = 1; lvl <= 9; lvl++) {
        expect(keys).toContain(`system.spells.${lvl}.max`);
      }
    });
  });

  describe("GYGAX-033: Unidentified Items & Hidden GM Charges", () => {
    it("masks unidentified item name and description for non-GM users while showing true values to GMs", () => {
      const userObj = game.user as unknown as Record<string, unknown>;
      const prevIsGM = Boolean(userObj.isGM);
      try {
        const wand = createItem({
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

        userObj.isGM = false;
        expect(wand.isIdentified).toBe(false);
        expect(wand.displayName).toBe("Carved Bone Wand");
        expect(wand.displayDescription).toBe("<p>A pale bone rod etched with runes.</p>");
        expect(wand.isCounterVisible).toBe(false);

        userObj.isGM = true;
        expect(wand.displayName).toBe("Wand of Paralyzation");
        expect(wand.displayDescription).toBe("<p>Saves vs wand or paralyzed for 6 turns (14 charges).</p>");
        expect(wand.isCounterVisible).toBe(true);
      } finally {
        userObj.isGM = prevIsGM;
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
      const rolls = captureRolls();

      const fighter = createActor({
        id: "fighter-undead-slayer",
        type: "character",
        system: {
          scores: { str: { mod: 1 }, dex: { mod: 0 } },
          thac0: { value: 17, bba: 2, mod: { melee: 0, missile: 0 } },
          config: {},
        },
      });

      const maceVsUndead = mockWeapon({
        system: {
          damage: "1d6",
          bonus: 1,
          tags: [{ title: "+3 vs. undead", value: "+3 vs. undead" }],
        },
      });

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

      fighter.rollAttack({ item: maceVsUndead }, { type: "melee", target: wraithTarget, skipDialog: true });
      expect(rolls.last?.parts).toEqual(["1d20", 1, 3]);
      expect(rolls.last?.data.roll.dmg).toEqual(["1d6", 3, 1]);

      fighter.rollAttack({ item: maceVsUndead }, { type: "melee", target: goblinTarget, skipDialog: true });
      expect(rolls.last?.parts).toEqual(["1d20", 1, 1]);
      expect(rolls.last?.data.roll.dmg).toEqual(["1d6", 1, 1]);
    });
  });

  describe("GYGAX-035: Ability-Linked Roll-Under Proficiencies", () => {
    it("computes effectiveTarget from linked actor ability score + targetMod", () => {
      const ability = new OseDataModelAbility({
        abilityScore: "int",
        targetMod: -2,
        roll: "1d20",
        rollType: "below",
      });
      (ability as unknown as { parent: unknown }).parent = {
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

  describe("GYGAX-036: Silver/Magic Gating, Chat Damage Integration, MR %, & Mount Encumbrance", () => {
    it("gates weapon damage against monsters requiring magic or silver weapons and applies half/immune traits", () => {
      const wight = createActor({
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
      }) as unknown as {
        evaluateWeaponDamage: (
          dmg: number,
          opts?: { weapon?: unknown; ammo?: unknown; damageType?: string },
        ) => { amount: number };
      };

      const normalSword = { name: "Normal Sword", system: { bonus: 0, tags: [] } };
      const silverDagger = {
        name: "Silver Dagger",
        system: { bonus: 0, tags: [{ title: "Silver", value: "Silver" }] },
      };
      const magicMace = {
        name: "Mace +1",
        system: { bonus: 1, tags: [{ title: "Blunt", value: "Blunt" }] },
      };

      expect(wight.evaluateWeaponDamage(8, { weapon: normalSword }).amount).toBe(0);
      expect(wight.evaluateWeaponDamage(6, { weapon: silverDagger }).amount).toBe(6);
      expect(wight.evaluateWeaponDamage(7, { weapon: magicMace }).amount).toBe(3);
      expect(wight.evaluateWeaponDamage(10, { damageType: "poison" }).amount).toBe(0);
    });

    it("passes weapon and ammo from chat cards into targetActor.applyDamage via applyChatCardDamage", async () => {
      const wight = createActor({
        id: "wight-chat",
        name: "Wight",
        type: "monster",
        system: {
          hp: { value: 15, max: 15 },
          OnlyHurtByMagic: true,
          OnlyHurtBySilver: true,
        },
      });
      const updateSpy = vi.spyOn(wight, "update").mockResolvedValue(wight);
      const warnSpy = vi.spyOn(ui.notifications, "warn").mockImplementation((() => ({})) as never);

      const mundaneSword = createItem({
        id: "sword-mundane",
        name: "Normal Sword",
        type: "weapon",
        system: { bonus: 0, tags: [] },
      });
      const mundaneBow = createItem({
        id: "bow-mundane",
        name: "Shortbow",
        type: "weapon",
        system: { bonus: 0, tags: [] },
      });
      const silverArrow = createItem({
        id: "arrow-silver",
        name: "Silver Arrows",
        type: "item",
        system: { bonus: 0, tags: [{ title: "Silver", value: "Silver" }] },
      });

      const itemsMap = new Map<string, OseItem>([
        ["sword-mundane", mundaneSword],
        ["bow-mundane", mundaneBow],
        ["arrow-silver", silverArrow],
      ]);
      const attacker = { items: { get: (id: string) => itemsMap.get(id) } };

      const globalWithCanvas = globalThis as unknown as { canvas?: unknown };
      const prevActors = game.actors;
      const prevScenes = game.scenes;
      const prevCanvas = globalWithCanvas.canvas;
      (game as unknown as { actors: unknown }).actors = { get: (id: string) => (id === "att-1" ? attacker : null) };
      (game as unknown as { scenes: unknown }).scenes = {
        get: (sid: string) =>
          sid === "scene-1"
            ? { tokens: { get: (tid: string) => (tid === "tok-1" ? { actor: attacker } : null) } }
            : null,
      };
      globalWithCanvas.canvas = {
        tokens: {
          controlled: [{ actor: wight, name: "Wight" }],
        },
      };
      vi.spyOn(game.settings, "get").mockImplementation(((_scope: string, key: string) => {
        if (key === "applyDamageOption") return "selected";
        return false;
      }) as never);

      const createMockCard = (dataset: Record<string, string>, diceTotal: string): HTMLElement => {
        const itemCardEl = { dataset } as unknown as HTMLElement;
        const diceTotalEl = { textContent: diceTotal } as unknown as HTMLElement;
        return {
          matches: (sel: string) => sel === ".item-card" && false,
          querySelector: (sel: string) => (sel === ".item-card" ? itemCardEl : null),
          querySelectorAll: (sel: string) => (sel === ".dice-total" ? [diceTotalEl] : []),
        } as unknown as HTMLElement;
      };

      try {
        // 1. Mundane sword card -> blocked by Wight immunity
        const mundaneCard = createMockCard({ actorId: "att-1", itemId: "sword-mundane" }, "8");
        await chatTesting.applyChatCardDamage(mundaneCard, 1);
        expect(updateSpy).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalled();

        // 2. Mundane bow + Silver Arrow via tokenId -> deals full 6 damage
        const silverAmmoCard = createMockCard(
          { tokenId: "scene-1.tok-1", itemId: "bow-mundane", ammoId: "arrow-silver" },
          "6",
        );
        await chatTesting.applyChatCardDamage(silverAmmoCard, 1);
        expect(updateSpy).toHaveBeenCalledWith({ "system.hp.value": 9 });
      } finally {
        (game as unknown as { actors: unknown }).actors = prevActors;
        (game as unknown as { scenes: unknown }).scenes = prevScenes;
        globalWithCanvas.canvas = prevCanvas;
      }
    });

    it("computes mount/pack-animal encumbrance and auto-halves movement past half capacity", () => {
      const camelModel = new OseDataModelMonster({
        movement: { base: 150 },
        config: { movementAuto: true },
        encumbrance: { value: 0, max: 3000 },
      });

      (camelModel as unknown as { parent: unknown }).parent = {
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
      const rolls = captureRolls();

      const demon = createActor({
        id: "demon-mr",
        name: "Demon",
        type: "monster",
        system: { details: { magicResistance: 50 } },
      });

      demon.rollMagicResistance();
      expect(rolls.last).not.toBeNull();
      expect(rolls.last?.parts).toEqual(["1d100"]);
      expect(rolls.last?.data.roll.type).toBe("below");
      expect(rolls.last?.data.roll.target).toBe(50);
    });
  });
});
