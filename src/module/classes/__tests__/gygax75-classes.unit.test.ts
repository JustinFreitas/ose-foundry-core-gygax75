import { describe, expect, it } from "vitest";
import { GYGAX75_CLASSES, GYGAX75_SOURCE } from "../gygax75-classes";

describe("Gygax 75 Classes", () => {
  it("registers all 7 custom classes", () => {
    const classNames = Object.keys(GYGAX75_CLASSES);
    expect(classNames).toEqual([
      "Barbarian",
      "Druid",
      "Gnome",
      "Half-Orc",
      "Knight",
      "Warden",
      "Wood Elf",
    ]);
  });

  it("sets correct source attribute", () => {
    for (const cls of Object.values(GYGAX75_CLASSES)) {
      expect(cls.source).toBe(GYGAX75_SOURCE);
    }
  });

  it("defines Barbarian level progression correctly", () => {
    const barbarian = GYGAX75_CLASSES.Barbarian;
    expect(barbarian.requirements).toEqual({ str: 9, con: 9 });
    expect(barbarian.levels[0]?.hd).toBe("1d8");
    expect(barbarian.levels[0]?.thac0).toBe(19);
    expect(barbarian.levels[9]?.hd).toBe("9d8+2");
    expect(barbarian.levels[9]?.thac0).toBe(12);
  });

  it("defines Druid spell progression correctly", () => {
    const druid = GYGAX75_CLASSES.Druid;
    expect(druid.levels[0]?.spells).toEqual([1, 0, 0, 0, 0]);
    expect(druid.levels[2]?.spells).toEqual([2, 1, 0, 0, 0]);
    expect(druid.levels[9]?.spells).toEqual([4, 4, 3, 3, 2]);
  });
});
