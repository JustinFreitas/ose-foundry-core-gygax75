import { describe, expect, it } from "vitest";
import OseDataModelCharacterScores from "./data-model-character-scores";

describe("Offline Character Scores Data Model", () => {
  it("initializes default values correctly when no scores are passed", () => {
    const scores = new OseDataModelCharacterScores();

    // Default value is 0, which maps to -3 standard mod
    expect(scores.str.value).toBe(0);
    expect(scores.str.mod).toBe(-3);
    expect(scores.str.od).toBe(0);

    expect(scores.int.value).toBe(0);
    expect(scores.int.mod).toBe(-3);
    expect(scores.int.literacy).toBe("");
    expect(scores.int.spoken).toBe("OSE.NativeBroken");

    expect(scores.wis.value).toBe(0);
    expect(scores.wis.mod).toBe(-3);

    expect(scores.dex.value).toBe(0);
    expect(scores.dex.mod).toBe(-3);
    expect(scores.dex.init).toBe(-2);

    expect(scores.con.value).toBe(0);
    expect(scores.con.mod).toBe(-3);

    expect(scores.cha.value).toBe(0);
    expect(scores.cha.mod).toBe(-3);
    // retain: #chaMod + 4 = -3 + 4 = 1
    expect(scores.cha.retain).toBe(1);
    // loyalty: #chaMod + 7 = -3 + 7 = 4
    expect(scores.cha.loyalty).toBe(4);
    expect(scores.cha.npc).toBe(-2);
  });

  it("handles standard scores correctly", () => {
    const scores = new OseDataModelCharacterScores({
      str: { value: 18, bonus: 0 },
      int: { value: 15, bonus: 0 },
      wis: { value: 12, bonus: 0 },
      dex: { value: 9, bonus: 0 },
      con: { value: 6, bonus: 0 },
      cha: { value: 3, bonus: 0 },
    });

    // STR 18 -> mod +3, OD 5
    expect(scores.str.value).toBe(18);
    expect(scores.str.mod).toBe(3);
    expect(scores.str.od).toBe(5);

    // INT 15 -> mod +1, literacy Literate (maps to 9 since 15 >= 9), spoken NativePlus1
    expect(scores.int.value).toBe(15);
    expect(scores.int.mod).toBe(1);
    expect(scores.int.literacy).toBe("OSE.Literate");
    expect(scores.int.spoken).toBe("OSE.NativePlus1");

    // WIS 12 -> mod 0 (maps to 9 since 12 >= 9)
    expect(scores.wis.value).toBe(12);
    expect(scores.wis.mod).toBe(0);

    // DEX 9 -> mod 0, init 0
    expect(scores.dex.value).toBe(9);
    expect(scores.dex.mod).toBe(0);
    expect(scores.dex.init).toBe(0);

    // CON 6 -> mod -1 (maps to 6)
    expect(scores.con.value).toBe(6);
    expect(scores.con.mod).toBe(-1);

    // CHA 3 -> mod -3, retain = -3 + 4 = 1, loyalty = -3 + 7 = 4, npc = -2
    expect(scores.cha.value).toBe(3);
    expect(scores.cha.mod).toBe(-3);
    expect(scores.cha.retain).toBe(1);
    expect(scores.cha.loyalty).toBe(4);
    expect(scores.cha.npc).toBe(-2);
  });

  it("allows setting changes on scores", () => {
    const scores = new OseDataModelCharacterScores({
      str: { value: 10, bonus: 0 },
    });

    expect(scores.str.value).toBe(10);
    expect(scores.str.mod).toBe(0);

    // Set new value
    scores.str = { value: 16, bonus: 1 };
    expect(scores.str.value).toBe(16);
    expect(scores.str.bonus).toBe(1);
    expect(scores.str.mod).toBe(2);

    scores.int = { value: 18, bonus: 0 };
    expect(scores.int.value).toBe(18);
    expect(scores.int.literacy).toBe("OSE.Literate");

    scores.wis = { value: 18, bonus: 0 };
    expect(scores.wis.mod).toBe(3);

    scores.dex = { value: 18, bonus: 0 };
    expect(scores.dex.init).toBe(2);

    scores.con = { value: 18, bonus: 0 };
    expect(scores.con.mod).toBe(3);

    scores.cha = { value: 18, bonus: 0 };
    expect(scores.cha.mod).toBe(3);
    expect(scores.cha.npc).toBe(2);
    expect(scores.cha.retain).toBe(7); // 3 + 4
    expect(scores.cha.loyalty).toBe(10); // 3 + 7
  });
});
