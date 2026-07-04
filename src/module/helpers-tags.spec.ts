import { describe, expect, it } from "vitest";
import OseTags from "./helpers-tags";

describe("Offline Tag Generation Helpers", () => {
  describe("rollTagFormula", () => {
    it("constructs a roll formula correctly with provided data", () => {
      const actor = { name: "Hero" };
      const data = { roll: "1d20 + @actor.system.con" };

      // Since Roll is mocked, it will return the formula property
      const formula = OseTags.rollTagFormula({
        actor: actor as unknown as Actor,
        data: data as unknown as { roll: string },
      });
      expect(formula).toBe("1d20 + @actor.system.con");
    });
  });

  describe("rollTagTarget", () => {
    it("returns target label with value if rollTarget is provided", () => {
      // Mock CONFIG.OSE.roll_type
      CONFIG.OSE.roll_type = {
        save: "Save",
        check: "Check",
      } as unknown as typeof CONFIG.OSE.roll_type;

      const target1 = OseTags.rollTagTarget({
        rollType: "save" as keyof typeof CONFIG.OSE.roll_type,
        rollTarget: 12,
      });
      expect(target1).toBe(" Save12");

      const target2 = OseTags.rollTagTarget({
        rollType: "check" as keyof typeof CONFIG.OSE.roll_type,
        rollTarget: 5,
      });
      expect(target2).toBe(" Check5");
    });

    it("returns empty string if rollTarget is null", () => {
      const target = OseTags.rollTagTarget({
        rollType: "save" as keyof typeof CONFIG.OSE.roll_type,
        rollTarget: null,
      });
      expect(target).toBe("");
    });
  });
});
