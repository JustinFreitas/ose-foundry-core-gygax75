/**
 * @file The base class for all encumbrance schemes. Feel free to extend this to make your own schemes!
 */
/**
 * A character's carrying load under the active encumbrance scheme. The
 * breakpoint flags and `steps` are only meaningful for variants that impose
 * movement penalties as weight increases.
 */
export interface CharacterEncumbrance {
  /** Identifier of the active encumbrance scheme (e.g. `"disabled"`, `"basic"`, `"detailed"`, `"complete"`). */
  readonly variant: string;

  /** Whether encumbrance is being tracked for this character. */
  readonly enabled: boolean;

  /** Carried weight as a percentage (0–100) of `max`. */
  readonly pct: number;

  /** Whether the character is carrying more than their limit. */
  readonly encumbered: boolean;

  /** Weight thresholds, as percentages of `max`, at which movement penalties take effect. */
  readonly steps: number[];

  /** Total weight currently carried. */
  readonly value: number;

  /** Maximum weight the character can carry. */
  max: number;

  /** Whether carried weight has reached the first movement-penalty threshold; `null` when the active variant defines none. */
  readonly atFirstBreakpoint: boolean | null;

  /** Whether carried weight has reached the second movement-penalty threshold; `null` when the active variant defines none. */
  readonly atSecondBreakpoint: boolean | null;

  /** Whether carried weight has reached the third movement-penalty threshold; `null` when the active variant defines none. */
  readonly atThirdBreakpoint: boolean | null;

  /** Carried weight at which the next movement penalty takes effect; `null` when no further breakpoint applies. */
  readonly nextBreakpointValue: number | null;

  /** Weight that can still be carried before the next breakpoint; `null` when no further breakpoint applies. */
  readonly untilNextBreakpoint: number | null;
}

/**
 * A class to handle character encumbrance.
 */
export default class OseDataModelCharacterEncumbrance implements CharacterEncumbrance {
  // Gygax75 customization: BECMI / Rules Compendium encumbrance cap (2400) instead
  // of the B/X default of 1600. Kept in sync with template.json and the tests.
  static baseEncumbranceCap = 2400;

  // Default encumbrance steps used by the 'complete' and 'detailed' encumbrance variants
  static encumbranceSteps = {
    quarter: (1 / 4) * 100,
    threeEighths: (3 / 8) * 100,
    half: (1 / 2) * 100,
  };

  #encumbranceVariant;

  #max;

  #weight = 0;

  /**
   * The constructor
   *
   * @param {string} variant - The name of this encumbrance variant.
   * @param {number} max - The max weight this character can carry
   * @param {Item[]} items - The items this character is carrying. Note: we're not using this in the base class.
   */
  constructor(variant = "disabled", max = OseDataModelCharacterEncumbrance.baseEncumbranceCap) {
    this.#encumbranceVariant = variant;
    this.#max = max;
  }

  static defineSchema() {
    // @ts-expect-error League v13 client/data/fields shadows common (only declares ShaderField)
    const { ArrayField, BooleanField, NumberField, SchemaField, StringField } = foundry.data.fields;

    return new SchemaField({
      variant: new StringField({ initial: "disabled" }),
      enabled: new BooleanField({ initial: true }),
      encumbered: new BooleanField({ initial: false }),
      pct: new NumberField({ integer: false, initial: 0, min: 0, max: 100 }),
      steps: new ArrayField(new NumberField()),
      value: new NumberField({ integer: false }),
      max: new NumberField({
        integer: false,
        initial: OseDataModelCharacterEncumbrance.baseEncumbranceCap,
      }),
      atFirstBreakpoint: new BooleanField({ initial: false }),
      atSecondBreakpoint: new BooleanField({ initial: false }),
      atThirdBreakpoint: new BooleanField({ initial: false }),
      nextBreakpointValue: new NumberField({ nullable: true, required: false, initial: null }),
      untilNextBreakpoint: new NumberField({ nullable: true, required: false, initial: null }),
    });
  }

  get variant() {
    return this.#encumbranceVariant;
  }

  get enabled() {
    return this.#encumbranceVariant !== "disabled";
  }

  get pct() {
    return Math.clamp((this.value / this.max) * 100, 0, 100);
  }

  get encumbered() {
    return this.value > this.max;
  }

  // eslint-disable-next-line class-methods-use-this
  get steps(): number[] {
    return [];
  }

  get value(): number {
    return this.#weight;
  }

  get max() {
    return this.#max;
  }

  set max(value) {
    this.#max = value;
  }

  get atThirdBreakpoint() {
    return this.pct > OseDataModelCharacterEncumbrance.encumbranceSteps.half;
  }

  get atSecondBreakpoint() {
    return this.pct > OseDataModelCharacterEncumbrance.encumbranceSteps.threeEighths;
  }

  get atFirstBreakpoint() {
    return this.pct > OseDataModelCharacterEncumbrance.encumbranceSteps.quarter;
  }

  get nextBreakpointValue() {
    const steps = [
      OseDataModelCharacterEncumbrance.encumbranceSteps.quarter,
      OseDataModelCharacterEncumbrance.encumbranceSteps.threeEighths,
      OseDataModelCharacterEncumbrance.encumbranceSteps.half,
    ].map((pct) => (pct / 100) * this.max);

    for (const step of steps) {
      if (this.value <= step) return Math.round(step);
    }
    return null;
  }

  get untilNextBreakpoint() {
    const next = this.nextBreakpointValue;
    return next !== null ? Math.max(0, next - this.value) : null;
  }

  // eslint-disable-next-line class-methods-use-this
  get defaultMax() {
    return (this.constructor as typeof OseDataModelCharacterEncumbrance).baseEncumbranceCap;
  }

  get alternateMax() {
    return this.defaultMax;
  }
}
