import { describe, expect, it } from "vitest";
import OseDataModelCharacterAC from "./data-model-character-ac";

describe("Offline Character AC Data Model", () => {
  describe("Descending AC (Traditional)", () => {
    it("handles naked AC calculations correctly", () => {
      // 1. With positive DEX modifier (+2) -> lower AC is better, so 9 - 2 = 7
      const ac1 = new OseDataModelCharacterAC(false, [], 2, 0);
      expect(ac1.base).toBe(9);
      expect(ac1.naked).toBe(7);
      expect(ac1.shield).toBe(0);
      expect(ac1.value).toBe(7);

      // 2. With negative DEX modifier (-2) -> 9 - (-2) = 11
      const ac2 = new OseDataModelCharacterAC(false, [], -2, 0);
      expect(ac2.naked).toBe(11);
    });

    it("handles shield and armor overrides correctly", () => {
      const armorItems = [
        {
          system: {
            type: "shield",
            ac: { value: 1 },
          },
        },
        {
          system: {
            type: "heavy",
            ac: { value: 4 }, // descending AC armor overrides base
          },
        },
      ];

      // Dex = 1, mod = 2
      const ac = new OseDataModelCharacterAC(false, armorItems as unknown as Item[], 1, 2);
      expect(ac.shield).toBe(1);
      // armored value = 4 - 1 (dex) = 3
      // total value = armoredValue - shield - mod = 3 - 1 - 2 = 0
      expect(ac.value).toBe(0);
    });
  });

  describe("Ascending AC (AAC)", () => {
    it("handles naked AC calculations correctly", () => {
      // 1. With positive DEX modifier (+2) -> higher AC is better, so 10 + 2 = 12
      const ac1 = new OseDataModelCharacterAC(true, [], 2, 0);
      expect(ac1.base).toBe(10);
      expect(ac1.naked).toBe(12);
      expect(ac1.value).toBe(12);

      // 2. With negative DEX modifier (-2) -> 10 + (-2) = 8
      const ac2 = new OseDataModelCharacterAC(true, [], -2, 0);
      expect(ac2.naked).toBe(8);
    });

    it("handles shield and armor overrides correctly", () => {
      const armorItems = [
        {
          system: {
            type: "shield",
            aac: { value: 2 },
          },
        },
        {
          system: {
            type: "heavy",
            aac: { value: 16 },
          },
        },
      ];

      // Dex = 1, mod = 3
      const ac = new OseDataModelCharacterAC(true, armorItems as unknown as Item[], 1, 3);
      expect(ac.shield).toBe(2);
      // armored value = 16 + 1 (dex) = 17
      // total value = armoredValue + shield + mod = 17 + 2 + 3 = 22
      expect(ac.value).toBe(22);
    });
  });
});
