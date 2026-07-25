/**
 * @file A class representing the character's ability to move, depending on encumbrance state
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import OseDataModelCharacterEncumbrance from "./data-model-character-encumbrance";

export interface CharacterMove {
  base: number;
  encounter: number;
  overland: number;
}

/**
 * A class representing a character's move speeds.
 */
export default class OseDataModelCharacterMove implements CharacterMove {
  static baseMoveRate = 120;

  #moveBase;

  #autocalculate;

  #encumbranceVariant;

  #overEncumbranceLimit;

  #atFirstBreakpoint;

  #atSecondBreakpoint;

  #atThirdBreakpoint;

  /**
   * The constructor
   *
   * @param {OseDataModelCharacterEncumbrance} encumbrance - An object representing the character's encumbrance values
   * @param {boolean} shouldCalculateMovement - Should the class autocalculate movement?
   * @param {number} base - The base move rate for the actor
   */
  constructor(
    encumbrance: OseDataModelCharacterEncumbrance = new OseDataModelCharacterEncumbrance(),
    shouldCalculateMovement = true,
    base = OseDataModelCharacterMove.baseMoveRate,
  ) {
    // Props necessary for any encumbrance variant
    this.#moveBase = base;
    this.#autocalculate = shouldCalculateMovement;
    this.#encumbranceVariant = encumbrance.variant;
    this.#overEncumbranceLimit = encumbrance.encumbered;

    // Encumbrance Breakpoints
    this.#atFirstBreakpoint = encumbrance.atFirstBreakpoint;
    this.#atSecondBreakpoint = encumbrance.atSecondBreakpoint;
    this.#atThirdBreakpoint = encumbrance.atThirdBreakpoint;
  }

  #derivedSpeed() {
    if (this.#overEncumbranceLimit) return 0;
    if (this.#atThirdBreakpoint) return 30;
    if (this.#atSecondBreakpoint) return 60;
    return this.#atFirstBreakpoint ? 90 : 120;
  }

  #nextDerivedSpeed() {
    if (this.#overEncumbranceLimit) return 0;
    if (this.#atThirdBreakpoint) return 0;
    if (this.#atSecondBreakpoint) return 30;
    if (this.#atFirstBreakpoint) return 60;
    return 90;
  }

  get base() {
    // Manual entry for movement
    if (!this.#autocalculate || this.#encumbranceVariant === "disabled") return Math.round(this.#moveBase);
    // Automatic calculation for movement
    return Math.round(this.#derivedSpeed());
  }

  set base(value) {
    this.#moveBase = value;
  }

  get nextBase() {
    if (!this.#autocalculate || this.#encumbranceVariant === "disabled") return null;
    return Math.round(this.#nextDerivedSpeed());
  }

  get nextEncounter() {
    const next = this.nextBase;
    return next !== null ? Math.round(next / 3) : null;
  }

  get encounter() {
    return Math.round(this.base / 3);
  }

  get overland() {
    return Math.round(this.base / 5);
  }
}
