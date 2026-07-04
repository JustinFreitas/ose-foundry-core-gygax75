import { describe, expect, it } from "vitest";
import OseDataModelCharacterEncumbrance from "./data-model-character-encumbrance";
import OseDataModelCharacterMove from "./data-model-character-move";

class TestEncumbrance extends OseDataModelCharacterEncumbrance {
  testEncumbered = false;
  testAtFirst = false;
  testAtSecond = false;
  testAtThird = false;

  get encumbered() {
    return this.testEncumbered;
  }
  get atFirstBreakpoint() {
    return this.testAtFirst;
  }
  get atSecondBreakpoint() {
    return this.testAtSecond;
  }
  get atThirdBreakpoint() {
    return this.testAtThird;
  }
}

describe("Offline Character Move Data Model", () => {
  it("returns base rate directly if autocalculate is disabled or encumbrance is disabled", () => {
    const encDisabled = new OseDataModelCharacterEncumbrance("disabled");
    const move1 = new OseDataModelCharacterMove(encDisabled, true, 120);
    expect(move1.base).toBe(120);
    expect(move1.encounter).toBe(40);
    expect(move1.overland).toBe(24);

    const encBasic = new OseDataModelCharacterEncumbrance("basic");
    const move2 = new OseDataModelCharacterMove(encBasic, false, 120); // shouldCalculateMovement = false
    expect(move2.base).toBe(120);
  });

  it("calculates movement based on encumbrance breakpoints correctly", () => {
    const enc = new TestEncumbrance("basic");

    // Case 1: Over encumbrance limit -> speed = 0
    enc.testEncumbered = true;
    const moveLimit = new OseDataModelCharacterMove(enc, true, 120);
    expect(moveLimit.base).toBe(0);

    // Reset encumbered flag
    enc.testEncumbered = false;

    // Case 2: At third breakpoint -> 25% of base
    enc.testAtThird = true;
    const move3 = new OseDataModelCharacterMove(enc, true, 120);
    expect(move3.base).toBe(30); // 120 * 0.25 = 30
    enc.testAtThird = false;

    // Case 3: At second breakpoint -> 50% of base
    enc.testAtSecond = true;
    const move2 = new OseDataModelCharacterMove(enc, true, 120);
    expect(move2.base).toBe(60); // 120 * 0.5 = 60
    enc.testAtSecond = false;

    // Case 4: At first breakpoint -> 75% of base
    enc.testAtFirst = true;
    const move1 = new OseDataModelCharacterMove(enc, true, 120);
    expect(move1.base).toBe(90); // 120 * 0.75 = 90
    enc.testAtFirst = false;

    // Case 5: Normal -> 100% of base
    const moveNormal = new OseDataModelCharacterMove(enc, true, 120);
    expect(moveNormal.base).toBe(120);
  });
});
