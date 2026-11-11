import { describe, expect, it, vi } from "vitest";
import OseItem from "../../item/entity";
import OseCharacterGpCost from "../character-gp-cost";

describe("Phase 1: Gygax '75 Auto Character Generation & Economy", () => {
  describe("Sub-Par Character Stat Standard", () => {
    function isSubPar(scores: number[]): boolean {
      const sum = scores.reduce((a, b) => a + b, 0);
      const lowScoresCount = scores.filter((x) => x <= 8).length;
      return sum <= 55 || lowScoresCount >= 2;
    }

    it("flags characters with sum <= 55 as sub-par", () => {
      // 9 * 5 + 10 = 55 (no scores <= 8)
      expect(isSubPar([9, 9, 9, 9, 9, 10])).toBe(true);
      // 9 * 6 = 54
      expect(isSubPar([9, 9, 9, 9, 9, 9])).toBe(true);
    });

    it("flags characters with 2 or more scores <= 8 as sub-par even if sum > 55", () => {
      // 8 + 8 + 14 + 14 + 14 + 14 = 72 (high total, but two scores <= 8)
      expect(isSubPar([8, 8, 14, 14, 14, 14])).toBe(true);
      // 7 + 8 + 12 + 12 + 12 + 12 = 63
      expect(isSubPar([7, 8, 12, 12, 12, 12])).toBe(true);
    });

    it("accepts viable characters with sum > 55 and at most 1 score <= 8", () => {
      // 8 + 10 + 10 + 10 + 10 + 10 = 58 (only one <= 8, sum > 55)
      expect(isSubPar([8, 10, 10, 10, 10, 10])).toBe(false);
      // All 10s = 60
      expect(isSubPar([10, 10, 10, 10, 10, 10])).toBe(false);
    });
  });

  describe("Item Quantity Constraints & GP (Bank) Precision", () => {
    it("clamps physical item quantities to integers on _preCreate", async () => {
      const item = new OseItem({ name: "Arrows", type: "item" });
      const updateSourceSpy = vi.spyOn(item as any, "updateSource").mockImplementation(() => {});

      await item._preCreate({ name: "Arrows", system: { quantity: { value: 15.8 } } }, {}, "user");
      expect(updateSourceSpy).toHaveBeenCalledWith({ "system.quantity.value": 15 });
    });

    it("preserves up to 2 decimal places for GP (Bank) on _preCreate", async () => {
      const item = new OseItem({ name: "GP (Bank)", type: "item" });
      const updateSourceSpy = vi.spyOn(item as any, "updateSource").mockImplementation(() => {});

      await item._preCreate({ name: "GP (Bank)", system: { quantity: { value: 12.3456 } } }, {}, "user");
      expect(updateSourceSpy).toHaveBeenCalledWith({ "system.quantity.value": 12.35 });
    });

    it("clamps physical item quantities to integers on _preUpdate", async () => {
      const item = new OseItem({ name: "Rations", type: "item" });
      const changed: any = { system: { quantity: { value: 4.9 } } };

      await item._preUpdate(changed, {}, "user");
      expect(changed.system.quantity.value).toBe(4);
    });

    it("preserves 2 decimal places for GP (Bank) on _preUpdate", async () => {
      const item = new OseItem({ name: "GP (Bank)", type: "item" });
      const changed: any = { system: { quantity: { value: 99.876 } } };

      await item._preUpdate(changed, {}, "user");
      expect(changed.system.quantity.value).toBe(99.88);
    });

    it("leaves null weapon quantity.value untouched on _preCreate and _preUpdate", async () => {
      const sword = new OseItem({ name: "Sword", type: "weapon" });
      const updateSourceSpy = vi.spyOn(sword as any, "updateSource").mockImplementation(() => {});

      await sword._preCreate({ name: "Sword", system: { quantity: { value: null } } }, {}, "user");
      expect(updateSourceSpy).not.toHaveBeenCalled();

      const changed: any = { system: { quantity: { value: null } } };
      await sword._preUpdate(changed, {}, "user");
      expect(changed.system.quantity.value).toBeNull();
    });
  });

  describe("Shopping Cart Bundle Pricing & Bank Payment Priority", () => {
    it("correctly prices bundled items by per-unit price instead of multiplying full cost", async () => {
      const gpCostDialog = new OseCharacterGpCost({} as any, {} as any);

      // Quiver of 20 arrows costing 5 GP total. Bought 20 arrows: total cost should be 5 GP, not 100 GP!
      const data = {
        items: [
          {
            type: "weapon",
            system: {
              cost: 5,
              treasure: false,
              quantity: { max: 20, value: 20 },
            },
          },
        ],
      };

      const total = await gpCostDialog._getTotalCost(data);
      expect(total).toBe(5);
    });

    it("correctly computes fractional prices for partial bundle quantities", async () => {
      const gpCostDialog = new OseCharacterGpCost({} as any, {} as any);

      // 10 arrows out of a 20-arrow bundle costing 5 GP: cost should be 2.5 GP
      const data = {
        items: [
          {
            type: "weapon",
            system: {
              cost: 5,
              treasure: false,
              quantity: { max: 20, value: 10 },
            },
          },
        ],
      };

      const total = await gpCostDialog._getTotalCost(data);
      expect(total).toBe(2.5);
    });

    it("deducts shopping cart cost from GP (Bank) before carried GP", async () => {
      const bankItem = {
        id: "bank-id",
        name: "GP (Bank)",
        system: { treasure: true, quantity: { value: 10 } },
      };
      const carriedGp = {
        id: "gp-id",
        name: "GP",
        system: { treasure: true, quantity: { value: 10 } },
      };
      const cartItem = {
        type: "item",
        system: { cost: 15, treasure: false, quantity: { value: 1 } },
      };

      const mockActor: any = {
        name: "Fighter",
        items: [bankItem, carriedGp, cartItem],
        updateEmbeddedDocuments: vi.fn().mockResolvedValue([]),
      };

      const gpCostDialog = new OseCharacterGpCost(mockActor, { items: [cartItem] });
      vi.spyOn(gpCostDialog, "_markItemsAsPaid" as any).mockResolvedValue(undefined);
      vi.spyOn(gpCostDialog, "_prepareContext" as any).mockResolvedValue({ totalCost: 15 });
      vi.spyOn(gpCostDialog, "close").mockResolvedValue(undefined as any);

      await gpCostDialog._submit();

      // Should deduct 10 from bank (leaving 0) and 5 from carried GP (leaving 5)
      expect(mockActor.updateEmbeddedDocuments).toHaveBeenCalledWith("Item", [
        { _id: "bank-id", "system.quantity.value": 0 },
        { _id: "gp-id", "system.quantity.value": 5 },
      ]);
    });

    it("blocks transaction when total GP between Bank and Carried is insufficient", async () => {
      const bankItem = {
        id: "bank-id",
        name: "GP (Bank)",
        system: { treasure: true, quantity: { value: 5 } },
      };
      const carriedGp = {
        id: "gp-id",
        name: "GP",
        system: { treasure: true, quantity: { value: 5 } },
      };
      const cartItem = {
        type: "item",
        system: { cost: 20, treasure: false, quantity: { value: 1 } },
      };

      const mockActor: any = {
        name: "Fighter",
        items: [bankItem, carriedGp, cartItem],
        updateEmbeddedDocuments: vi.fn(),
      };

      const gpCostDialog = new OseCharacterGpCost(mockActor, { items: [cartItem] });
      const errorSpy = vi.spyOn(ui.notifications, "error");

      await gpCostDialog._submit();

      expect(errorSpy).toHaveBeenCalled();
      expect(mockActor.updateEmbeddedDocuments).not.toHaveBeenCalled();
    });

    it("never mutates live item.system.cost during _prepareContext + _submit and includes unpaid items inside paid containers", async () => {
      const bankItem = {
        id: "bank-id",
        name: "GP (Bank)",
        type: "item",
        flags: {},
        system: { cost: 1, treasure: true, quantity: { value: 20, max: 0 } },
      };
      const paidBackpack = {
        id: "bag-1",
        name: "Backpack",
        type: "container",
        flags: { ose: { paid: true } },
        system: { cost: 2, treasure: false, containerId: "", itemIds: ["rations-1"], quantity: { value: 1, max: 0 } },
      };
      const unpaidRationsInBag = {
        id: "rations-1",
        name: "Iron Rations",
        type: "item",
        flags: {},
        system: { cost: 5, treasure: false, containerId: "bag-1", quantity: { value: 2, max: 0 } },
      };
      const bundledArrows = {
        id: "arrows-1",
        name: "Arrows",
        type: "weapon",
        flags: {},
        system: { cost: 5, treasure: false, containerId: "", quantity: { value: 10, max: 20 } },
      };

      const mockActor: any = {
        name: "Fighter",
        items: [bankItem, paidBackpack, unpaidRationsInBag, bundledArrows],
        updateEmbeddedDocuments: vi.fn().mockResolvedValue([]),
        createEmbeddedDocuments: vi.fn().mockResolvedValue([]),
      };

      const gpCostDialog = new OseCharacterGpCost(mockActor, {});
      vi.spyOn(gpCostDialog, "close").mockResolvedValue(undefined as any);

      const context = await gpCostDialog._prepareContext();
      // Live items MUST retain their unit/bundle cost (5 GP each, never mutated to 10 or 2.5!)
      expect(unpaidRationsInBag.system.cost).toBe(5);
      expect(bundledArrows.system.cost).toBe(5);
      expect(paidBackpack.system.cost).toBe(2);

      // Total cost = 0 (paid backpack) + 10 (2x5 GP rations in bag) + 2.5 (10/20 arrows) = 12.5 GP
      expect(context.totalCost).toBe(12.5);
      expect(context.owned.containers).toHaveLength(1);
      const firstBag = context.owned.containers[0] as any;
      expect(firstBag.system.cost).toBe(0);
      expect(firstBag.system.contents).toHaveLength(1);
      expect(firstBag.system.contents[0].system.cost).toBe(10);
      expect((context.owned as any).treasures).toBeUndefined();

      await gpCostDialog._submit();

      expect(unpaidRationsInBag.system.cost).toBe(5);
      expect(bundledArrows.system.cost).toBe(5);
      expect(mockActor.updateEmbeddedDocuments).toHaveBeenCalledWith("Item", [
        { _id: "bank-id", "system.quantity.value": 7.5 },
      ]);
    });

    it("breaks whole physical GP and makes exact SP and CP change when GP (Bank) is absent or exhausted", async () => {
      const bankItem = {
        id: "bank-id",
        name: "GP (Bank)",
        type: "item",
        flags: {},
        system: { cost: 1, treasure: true, quantity: { value: 1.1, max: 0 } },
      };
      const carriedGp = {
        id: "gp-id",
        name: "GP",
        type: "item",
        flags: {},
        system: { cost: 1, treasure: true, quantity: { value: 5, max: 0 } },
      };
      const existingSp = {
        id: "sp-id",
        name: "SP",
        type: "item",
        flags: {},
        system: { cost: 0.1, treasure: true, quantity: { value: 2, max: 0 } },
      };
      // Item costs 2.35 GP -> Bank pays 1.10 GP, leaving 1.25 GP from physical GP -> deducts 2 GP, returns 7 SP + 5 CP!
      const cartItem = {
        id: "oil-1",
        name: "Fine Oil",
        type: "item",
        flags: {},
        system: { cost: 2.35, treasure: false, quantity: { value: 1, max: 0 } },
      };

      const mockActor: any = {
        name: "Thief",
        items: [bankItem, carriedGp, existingSp, cartItem],
        updateEmbeddedDocuments: vi.fn().mockResolvedValue([]),
        createEmbeddedDocuments: vi.fn().mockResolvedValue([]),
      };

      const gpCostDialog = new OseCharacterGpCost(mockActor, {});
      vi.spyOn(gpCostDialog, "close").mockResolvedValue(undefined as any);

      await gpCostDialog._submit();

      // Bank: 1.1 -> 0; GP: 5 - 2 = 3; existing SP: 2 + 7 = 9
      expect(mockActor.updateEmbeddedDocuments).toHaveBeenCalledWith("Item", [
        { _id: "bank-id", "system.quantity.value": 0 },
        { _id: "gp-id", "system.quantity.value": 3 },
        { _id: "sp-id", "system.quantity.value": 9 },
      ]);
      // Creates canonical CP item with 5 CP
      expect(mockActor.createEmbeddedDocuments).toHaveBeenCalledWith("Item", [
        expect.objectContaining({
          name: "CP",
          type: "item",
          img: "icons/commodities/currency/coins-assorted-mix-copper.webp",
          system: expect.objectContaining({
            treasure: true,
            cost: 0.01,
            weight: 1,
            quantity: { value: 5, max: 0 },
          }),
        }),
      ]);
    });
  });

  describe("String Class Mode & enableClassItems Ruleset Setting", () => {
    it("defaults enableClassItems to false in settings store", () => {
      expect(game.settings.get("ose", "enableClassItems")).toBe(false);
    });

    it("gates canConvert when enableClassItems is false", () => {
      const getCanConvert = (enableClassItems: boolean, classesLength: number, classStr: string) => {
        return enableClassItems && !classesLength && !!String(classStr ?? "").trim();
      };

      // When false (default), canConvert is always false even if a class string is typed
      expect(getCanConvert(false, 0, "Fighter")).toBe(false);
      expect(getCanConvert(false, 0, "Thief")).toBe(false);

      // When true, canConvert is allowed for unmigrated string classes
      expect(getCanConvert(true, 0, "Fighter")).toBe(true);
      // But false if class items already exist
      expect(getCanConvert(true, 1, "Fighter")).toBe(false);
    });

    it("prevents accidental migration when enableClassItems is disabled", async () => {
      const warnSpy = vi.spyOn(ui.notifications, "warn");
      const mockActor: any = {
        uuid: "Actor.123",
        name: "Test PC",
        items: [],
        classStats: vi.fn().mockReturnValue({}),
      };

      const { convertSingleActor } = await import("../../migration/convert-actor");
      const result = await convertSingleActor(mockActor);

      expect(warnSpy).toHaveBeenCalled();
      expect(result.status).toBe("none");
    });
  });

  describe("OseItem Unidentified Masking & Ammo/Derived Roll Safety", () => {
    it("masks unidentified item secrets and counter visibility for non-GM players", () => {
      const potion = new OseItem({
        name: "Potion of Poison",
        type: "item",
        system: {
          identified: false,
          unidentifiedName: "Cloudy Vial",
          description: "Deadly poison!",
          unidentifiedDescription: "Smells faintly of almonds.",
          hideCounter: true,
        },
      });

      (globalThis as any).game.user = { isGM: false };
      expect(potion.isIdentified).toBe(false);
      expect(potion.displayName).toBe("Cloudy Vial");
      expect(potion.displayDescription).toBe("Smells faintly of almonds.");
      expect(potion.isCounterVisible).toBe(false);

      (globalThis as any).game.user = { isGM: true };
      expect(potion.displayName).toBe("Potion of Poison");
      expect(potion.displayDescription).toBe("Deadly poison!");
      expect(potion.isCounterVisible).toBe(true);
    });

    it("does not apply magic ammo bonuses or tags when ammo quantity is 0 under warn mode", async () => {
      await (globalThis as any).game.settings.set("ose", "automateAmmo", "warn");
      const emptyMagicArrows: any = {
        id: "ammo-1",
        name: "Arrow +2",
        displayName: "Arrow +2",
        type: "item",
        system: {
          bonus: 2,
          tags: [{ value: "Magic" }],
          quantity: { value: 0, max: 20 },
        },
        update: vi.fn(),
      };
      const bow = new OseItem({
        name: "Shortbow",
        type: "weapon",
        system: { melee: false, missile: true, damage: "1d6" },
      });
      const mockItems: any = Object.assign([emptyMagicArrows], {
        get: (id: string) => (id === "ammo-1" ? emptyMagicArrows : undefined),
      });
      (bow as any).actor = {
        type: "character",
        items: mockItems,
        targetAttack: vi.fn(),
      };

      const options: Record<string, any> = {};
      const allowed = await bow._handleAmmoConsumption(options);
      expect(allowed).toBe(true);

      const rollData: any = { data: { roll: { bonus: 0, dmg: [] }, item: { system: { tags: [] } } } };
      const warning = await options.onConfirm("ammo-1", rollData);
      expect(warning).toContain("OSE.error.noAmmoFound");
      expect(rollData.data.roll.bonus).toBe(0);
      expect(rollData.data.roll.dmg).toEqual([]);
      expect(rollData.data.item.system.tags).toEqual([]);
      expect(emptyMagicArrows.update).not.toHaveBeenCalled();

      // Also verify race condition where ammo has 1 remaining at dialog creation, then 0 when onConfirm fires
      emptyMagicArrows.system.quantity.value = 1;
      const raceOptions: Record<string, any> = {};
      await bow._handleAmmoConsumption(raceOptions);
      emptyMagicArrows.system.quantity.value = 0;

      const raceWarning = await raceOptions.onConfirm("ammo-1", rollData);
      expect(raceWarning).toContain("OSE.error.outOfAmmo");
      expect(rollData.data.roll.bonus).toBe(0);
      expect(rollData.data.roll.dmg).toEqual([]);
      expect(rollData.data.item.system.tags).toEqual([]);
      expect(emptyMagicArrows.update).not.toHaveBeenCalled();
    });

    it("clones derived system and isolates per-target rollData across multi-target attacks", async () => {
      await (globalThis as any).game.settings.set("ose", "automateAmmo", "disabled");
      const sword = new OseItem({
        name: "Magic Sword",
        type: "weapon",
        system: {
          melee: true,
          missile: false,
          bonus: 0,
          damage: "1d8",
          identified: false,
          unidentifiedName: "Strange Blade",
        },
      });
      (sword as any)._source = { _id: "sw-1", name: "Magic Sword", system: { bonus: 0, damage: "1d8" } };
      // Simulate an Active Effect raising derived bonus to +2 on this.system
      (sword.system as any).bonus = 2;

      const capturedPayloads: any[] = [];
      (sword as any).actor = {
        type: "character",
        items: [],
        rollAttack: vi.fn().mockImplementation(async (attData: any) => {
          // Mutate attData.item.system inside rollAttack to verify per-target isolation
          capturedPayloads.push({
            name: attData.item.name,
            bonusBeforeMutation: attData.item.system.bonus,
          });
          attData.item.system.bonus = 999;
        }),
        targetAttack: vi.fn(),
      };

      const prevTargets = (globalThis as any).game.user.targets;
      (globalThis as any).game.user = { isGM: false, targets: new Set([{ id: "t1" }, { id: "t2" }]) };
      try {
        await sword.rollWeapon({});
      } finally {
        (globalThis as any).game.user = { isGM: true, targets: prevTargets };
      }

      expect(capturedPayloads).toEqual([
        { name: "Strange Blade", bonusBeforeMutation: 2 },
        { name: "Strange Blade", bonusBeforeMutation: 2 },
      ]);
      expect(sword.system.bonus).toBe(2);
    });
  });
});
