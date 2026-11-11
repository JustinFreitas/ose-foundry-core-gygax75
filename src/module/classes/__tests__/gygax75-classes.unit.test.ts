import { describe, expect, it } from "vitest";
import OSE from "../../config";
import { buildClassIndex, resolveClass } from "../../migration/class-index";
import { classicClassToItemData } from "../classic-to-item";
import { GYGAX75_CLASSES, GYGAX75_SOURCE } from "../gygax75-classes";
import { primeReqBonus } from "../progression";

const getGygaxClass = (name: string) => {
  const cls = GYGAX75_CLASSES[name];
  if (!cls) throw new Error(`Missing Gygax 75 class: ${name}`);
  return cls;
};

describe("Gygax 75 Classes", () => {
  it("registers all 7 custom classes with Gygax 75 source", () => {
    const classNames = Object.keys(GYGAX75_CLASSES);
    expect(classNames).toEqual(["Barbarian", "Druid", "Gnome", "Half-Orc", "Knight", "Warden", "Wood Elf"]);
    for (const cls of Object.values(GYGAX75_CLASSES)) {
      expect(cls.source).toBe(GYGAX75_SOURCE);
    }
  });

  it("aligns Barbarian progression (L1-14) to OneNote Basic Rulebook", () => {
    const barbarian = getGygaxClass("Barbarian");
    expect(barbarian.requirements).toEqual({ dex: 9 });
    expect(barbarian.levels).toHaveLength(14);
    expect(barbarian.levels[0]).toEqual({ xp: 0, hd: "1d8", thac0: 19, saves: [10, 13, 12, 15, 16] });
    expect(barbarian.levels[9]).toEqual({ xp: 400_000, hd: "9d8+3", thac0: 12, saves: [4, 7, 6, 8, 7] });
    expect(barbarian.levels[13]).toEqual({ xp: 920_000, hd: "9d8+15", thac0: 10, saves: [3, 5, 4, 5, 5] });
  });

  it("aligns Druid progression (L1-14) and spells to OneNote Basic Rulebook", () => {
    const druid = getGygaxClass("Druid");
    expect(druid.requirements).toEqual({});
    expect(druid.spellsPack).toBe("classicfantasycompendium.spells-druid");
    expect(druid.levels).toHaveLength(14);
    expect(druid.levels[0]?.spells).toEqual([1, 0, 0, 0, 0]);
    expect(druid.levels[4]?.spells).toEqual([2, 2, 1, 1, 0]);
    expect(druid.levels[9]).toEqual({
      xp: 125_000,
      hd: "9d6+1",
      thac0: 14,
      saves: [6, 7, 9, 11, 9],
      spells: [4, 4, 4, 3, 3],
    });
    expect(druid.levels[13]).toEqual({
      xp: 1_500_000,
      hd: "9d6+5",
      thac0: 12,
      saves: [3, 5, 7, 8, 7],
      spells: [6, 6, 5, 5, 5],
    });
  });

  it("aligns Gnome progression (L1-8, d4 HD) to OneNote Basic Rulebook", () => {
    const gnome = getGygaxClass("Gnome");
    expect(gnome.requirements).toEqual({ int: 9 });
    expect(gnome.levels).toHaveLength(8);
    expect(gnome.levels[0]).toEqual({
      xp: 0,
      hd: "1d4",
      thac0: 19,
      saves: [8, 9, 10, 14, 11],
      spells: [1, 0, 0, 0],
    });
    expect(gnome.levels[5]).toEqual({
      xp: 32_000,
      hd: "6d4",
      thac0: 17,
      saves: [6, 7, 8, 11, 9],
      spells: [2, 2, 2, 0],
    });
    expect(gnome.levels[7]).toEqual({
      xp: 120_000,
      hd: "8d4",
      thac0: 17,
      saves: [6, 7, 8, 11, 9],
      spells: [3, 3, 2, 2],
    });
  });

  it("preserves Half-Orc L1-8 progression verbatim from OneNote Basic Rulebook", () => {
    const halfOrc = getGygaxClass("Half-Orc");
    expect(halfOrc.requirements).toEqual({});
    expect(halfOrc.levels).toHaveLength(8);
    expect(halfOrc.levels[0]).toEqual({ xp: 0, hd: "1d6", thac0: 19, saves: [13, 14, 13, 16, 15] });
    expect(halfOrc.levels[7]).toEqual({ xp: 120_000, hd: "8d6", thac0: 17, saves: [12, 13, 11, 14, 13] });
  });

  it("aligns Knight and Warden progressions (L1-14) to OneNote Basic Rulebook", () => {
    const knight = getGygaxClass("Knight");
    expect(knight.requirements).toEqual({ con: 9, dex: 9 });
    expect(knight.levels).toHaveLength(14);
    expect(knight.levels[6]).toEqual({ xp: 85_000, hd: "7d8", thac0: 14, saves: [8, 9, 10, 8, 10] });
    expect(knight.levels[9]).toEqual({ xp: 400_000, hd: "9d8+2", thac0: 12, saves: [6, 7, 8, 8, 10] });
    expect(knight.levels[13]).toEqual({ xp: 920_000, hd: "9d8+10", thac0: 10, saves: [4, 5, 6, 5, 8] });

    const warden = getGygaxClass("Warden");
    expect(warden.requirements).toEqual({ con: 9, wis: 9 });
    expect(warden.levels).toHaveLength(14);
    expect(warden.levels[6]).toEqual({ xp: 64_000, hd: "7d8", thac0: 14, saves: [8, 9, 10, 10, 12] });
    expect(warden.levels[9]).toEqual({ xp: 360_000, hd: "9d8+2", thac0: 12, saves: [6, 7, 8, 8, 10] });
    expect(warden.levels[13]).toEqual({ xp: 840_000, hd: "9d8+10", thac0: 10, saves: [4, 5, 6, 5, 8] });
  });

  it("aligns Wood Elf progression (L1-10) and Druid spellsPack to OneNote Basic Rulebook", () => {
    const woodElf = getGygaxClass("Wood Elf");
    expect(woodElf.requirements).toEqual({ dex: 9, int: 9 });
    expect(woodElf.spellsPack).toBe("classicfantasycompendium.spells-druid");
    expect(woodElf.levels).toHaveLength(10);
    expect(woodElf.levels[1]?.xp).toBe(3000);
    expect(woodElf.levels[9]).toEqual({
      xp: 500_000,
      hd: "9d6+2",
      thac0: 12,
      saves: [6, 7, 8, 8, 8],
      spells: [3, 3, 3, 3, 2],
    });
  });

  it("converts Gygax 75 classes to class items with primeReqs, demihuman flags, and spellLists", async () => {
    const barbarianItem = classicClassToItemData(getGygaxClass("Barbarian"));
    expect(barbarianItem.system.demihuman).toBe(false);
    expect(barbarianItem.system.maxLevel).toBe(14);
    expect(primeReqBonus(barbarianItem.system.primeReqs ?? [], { str: 13, con: 10 })).toBe(5);
    expect(primeReqBonus(barbarianItem.system.primeReqs ?? [], { str: 16, con: 15 })).toBe(5);
    expect(primeReqBonus(barbarianItem.system.primeReqs ?? [], { str: 16, con: 16 })).toBe(10);

    const gnomeItem = classicClassToItemData(getGygaxClass("Gnome"));
    expect(gnomeItem.system.demihuman).toBe(true);
    expect(gnomeItem.system.hitDie).toBe("1d4");
    expect(gnomeItem.system.spellList).toBe("Illusionist");
    expect(primeReqBonus(gnomeItem.system.primeReqs ?? [], { dex: 13, int: 13 })).toBe(5);
    expect(primeReqBonus(gnomeItem.system.primeReqs ?? [], { dex: 13, int: 16 })).toBe(10);

    const woodElfItem = classicClassToItemData(getGygaxClass("Wood Elf"));
    expect(woodElfItem.system.demihuman).toBe(true);
    expect(woodElfItem.system.spellList).toBe("Druid");
    expect(primeReqBonus(woodElfItem.system.primeReqs ?? [], { dex: 13, wis: 13 })).toBe(5);
    expect(primeReqBonus(woodElfItem.system.primeReqs ?? [], { dex: 16, wis: 13 })).toBe(10);

    const halfOrcItem = classicClassToItemData(getGygaxClass("Half-Orc"));
    expect(halfOrcItem.system.demihuman).toBe(true);
    expect(primeReqBonus(halfOrcItem.system.primeReqs ?? [], { dex: 13, str: 13 })).toBe(5);
    expect(primeReqBonus(halfOrcItem.system.primeReqs ?? [], { dex: 16, str: 16 })).toBe(10);

    const druidItem = classicClassToItemData(getGygaxClass("Druid"));
    expect(druidItem.system.demihuman).toBe(false);
    expect(druidItem.system.spellList).toBe("Druid");
    expect(primeReqBonus(druidItem.system.primeReqs ?? [], { wis: 5 })).toBe(-20);
    expect(primeReqBonus(druidItem.system.primeReqs ?? [], { wis: 16 })).toBe(10);

    const index = await buildClassIndex();
    const woodElfLoaded = (await resolveClass("Wood Elf", index)?.load()) as {
      system?: { spellList?: string; demihuman?: boolean };
    };
    const knightLoaded = (await resolveClass("Knight", index)?.load()) as {
      system?: { maxLevel?: number; demihuman?: boolean };
    };
    expect(woodElfLoaded?.system?.spellList).toBe("Druid");
    expect(woodElfLoaded?.system?.demihuman).toBe(true);
    expect(knightLoaded?.system?.maxLevel).toBe(14);
    expect(knightLoaded?.system?.demihuman).toBe(false);
    expect(OSE.spellLists).toEqual(["Cleric", "Druid", "Illusionist", "Magic-User"]);
    expect(OSE.tag_images.missile).toBe(`${OSE.assetsPath}/missile.png`);
  });
});
