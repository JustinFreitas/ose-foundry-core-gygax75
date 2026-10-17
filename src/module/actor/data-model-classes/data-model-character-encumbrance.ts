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
  // Gygax75 customization: BECMI / Rules Compendium encumbrance scale (2,400 cn max with
  // 400 cn, 800 cn, and 1,200 cn tiers) vs official B/X (1,600 cn max with 400, 600, 800 cn tiers).
  // Controlled via the 'gygax75Encumbrance' world setting (defaults to true).
  static #gygax75Override: boolean | null = null;

  static get isGygax75(): boolean {
    if (OseDataModelCharacterEncumbrance.#gygax75Override !== null) {
      return OseDataModelCharacterEncumbrance.#gygax75Override;
    }
    try {
      const settingVal = game?.settings?.get?.(game?.system?.id ?? "ose", "gygax75Encumbrance");
      if (typeof settingVal === "boolean") {
        return settingVal;
      }
    } catch {
      // Fall through to true if game.settings is uninitialized
    }
    return true;
  }

  static set isGygax75(val: boolean | null) {
    OseDataModelCharacterEncumbrance.#gygax75Override = val;
  }

  static get baseEncumbranceCap(): number {
    return OseDataModelCharacterEncumbrance.isGygax75 ? 2400 : 1600;
  }

  static set baseEncumbranceCap(val: number) {
    OseDataModelCharacterEncumbrance.isGygax75 = val > 1600;
  }

  // Encumbrance step percentages used by the 'complete' and 'detailed' encumbrance variants
  static get encumbranceSteps() {
    if (OseDataModelCharacterEncumbrance.isGygax75) {
      return {
        quarter: (400 / 2400) * 100, // 16.666...% -> 400 cn breakpoint (90')
        threeEighths: (800 / 2400) * 100, // 33.333...% -> 800 cn breakpoint (60')
        half: (1200 / 2400) * 100, // 50.0% -> 1,200 cn breakpoint (30')
      };
    }
    return {
      quarter: (1 / 4) * 100, // 25.0% -> 400 cn breakpoint (90')
      threeEighths: (3 / 8) * 100, // 37.5% -> 600 cn breakpoint (60')
      half: (1 / 2) * 100, // 50.0% -> 800 cn breakpoint (30')
    };
  }

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
      100,
    ].map((pct) => Math.round((pct / 100) * this.max));

    for (const step of steps) {
      if (this.value <= step) return step;
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
