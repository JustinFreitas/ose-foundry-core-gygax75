import { describe, expect, it } from "vitest";
import OseDataModelCharacterSpells from "./data-model-character-spells";

describe("Offline Character Spells Data Model", () => {
  it("initializes disabled state and default values correctly", () => {
    const spells = new OseDataModelCharacterSpells({ enabled: false });
    expect(spells.enabled).toBe(false);
    expect(spells.spellList).toEqual({});
    expect(spells.slots).toEqual({ 0: { max: 0, used: 0 } });
  });

  it("organizes spellList by level and sorts alphabetically by name", () => {
    const items = [
      {
        name: "Magic Missile",
        system: { lvl: 1, cast: 0 },
      },
      {
        name: "Detect Magic",
        system: { lvl: 1, cast: 1 },
      },
      {
        name: "Web",
        system: { lvl: 2, cast: 0 },
      },
    ];

    const spells = new OseDataModelCharacterSpells({ enabled: true }, items as unknown as Item[]);
    expect(spells.enabled).toBe(true);

    const spellList = spells.spellList;
    // Level 1 should contain Detect Magic and Magic Missile sorted alphabetically
    expect(spellList[1].length).toBe(2);
    expect(spellList[1][0].name).toBe("Detect Magic");
    expect(spellList[1][1].name).toBe("Magic Missile");

    // Level 2 contains Web
    expect(spellList[2].length).toBe(1);
    expect(spellList[2][0].name).toBe("Web");
  });

  it("calculates spell slots usage and limits correctly", () => {
    const maxSlots = {
      enabled: true,
      1: { max: 2 },
      2: { max: 1 },
    };

    const items = [
      {
        name: "Detect Magic",
        system: { lvl: 1, cast: 1 },
      },
      {
        name: "Magic Missile",
        system: { lvl: 1, cast: 1 },
      },
      {
        name: "Web",
        system: { lvl: 2, cast: 0 },
      },
    ];

    const spells = new OseDataModelCharacterSpells(
      maxSlots as unknown as { enabled?: boolean } & Record<number, { max: number }>,
      items as unknown as Item[],
    );

    const slots = spells.slots;
    // Level 0: max = 0, used = 0
    expect(slots[0]).toEqual({ max: 0, used: 0 });
    // Level 1: max = 2, used = 1 + 1 = 2
    expect(slots[1]).toEqual({ max: 2, used: 2 });
    // Level 2: max = 1, used = 0
    expect(slots[2]).toEqual({ max: 1, used: 0 });
  });

  it("handles setter for enabled state", () => {
    const spells = new OseDataModelCharacterSpells({ enabled: false });
    expect(spells.enabled).toBe(false);
    spells.enabled = true;
    expect(spells.enabled).toBe(true);
  });
});
