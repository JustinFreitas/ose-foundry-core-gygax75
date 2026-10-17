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

    // Case 2: At third breakpoint -> 30' base (Tier 4)
    enc.testAtThird = true;
    const move3 = new OseDataModelCharacterMove(enc, true, 120);
    expect(move3.base).toBe(30);
    expect(move3.encounter).toBe(10);
    expect(move3.nextBase).toBe(0);
    expect(move3.nextEncounter).toBe(0);
    enc.testAtThird = false;

    // Case 3: At second breakpoint -> 60' base (Tier 3)
    enc.testAtSecond = true;
    const move2 = new OseDataModelCharacterMove(enc, true, 120);
    expect(move2.base).toBe(60);
    expect(move2.encounter).toBe(20);
    expect(move2.nextBase).toBe(30);
    expect(move2.nextEncounter).toBe(10);
    enc.testAtSecond = false;

    // Case 4: At first breakpoint -> 90' base (Tier 2)
    enc.testAtFirst = true;
    const move1 = new OseDataModelCharacterMove(enc, true, 120);
    expect(move1.base).toBe(90);
    expect(move1.encounter).toBe(30);
    expect(move1.nextBase).toBe(60);
    expect(move1.nextEncounter).toBe(20);
    enc.testAtFirst = false;

    // Case 5: Normal -> 120' base (Tier 1)
    const moveNormal = new OseDataModelCharacterMove(enc, true, 120);
    expect(moveNormal.base).toBe(120);
    expect(moveNormal.encounter).toBe(40);
    expect(moveNormal.nextBase).toBe(90);
    expect(moveNormal.nextEncounter).toBe(30);
  });
});
