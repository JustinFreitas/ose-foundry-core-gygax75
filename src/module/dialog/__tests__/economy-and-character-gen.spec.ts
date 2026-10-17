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
  });
});
