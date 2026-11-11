/**
 * @file A class representing the "Item-based" encumbrance scheme from Carcass Crawler Issue Two
 */
import OseDataModelCharacterEncumbrance, { type CharacterEncumbrance } from "./data-model-character-encumbrance";

const rawItemSlots = (item: Item): number => {
  if (item.type === "container") {
    return item.system.itemslots ?? 1;
  }
  const slots = item.system.itemslots ?? 0;
  if (item.type === "weapon" || item.type === "armor") {
    const max = item.system.quantity?.max ?? 0;
    if (max > 0) return (slots / max) * (item.system.quantity?.value ?? 0);
    return slots;
  }
  if (item.type === "item") {
    const qty = item.system.quantity?.value ?? 0;
    const max = item.system.quantity?.max ?? 0;
    if (max > 0) return (slots / max) * qty;
    return slots * qty;
  }
  return 0;
};

/**
 * @todo Add template path for encumbrance bar
 * @todo Add template path for inventory item row
 */
export default class OseDataModelCharacterEncumbranceItemBased
  extends OseDataModelCharacterEncumbrance
  implements CharacterEncumbrance
{
  static baseEncumbranceCap = 9;

  static alternateBaseEncumbranceCap = 16;

  static packedEncumbranceSteps = {
    fiveEighths: (10 / 16) * 100,
    threeQuarters: (12 / 16) * 100,
    sevenEighths: (14 / 16) * 100,
  };

  static packedStepCounts = {
    stepOne: 10,
    stepTwo: 12,
    stepThree: 14,
  };

  static equippedEncumbranceSteps = {
    oneThird: (3 / 9) * 100,
    fiveNinths: (5 / 9) * 100,
    sevenNinths: (7 / 9) * 100,
  };

  static equippedStepCounts = {
    stepOne: 3,
    stepTwo: 5,
    stepThree: 7,
  };

  #equippedMax;

  #packedMax;

  #max;

  #atFiveEighths;

  #atThreeQuarters;

  #atSevenEights;

  #atOneThird;

  #atFiveNinths;

  #atSevenNinths;

  static templateEncumbranceBar = "";

  static templateInventoryRow = "";

  /**
   * The machine-readable label for this encumbrance scheme
   */
  static type = "itembased";

  /**
   * The human-readable label for this encumbrance scheme
   */
  static localizedLabel = "OSE.Setting.EncumbranceItemBased";

  #weight;

  #equippedWeight;

  #packedWeight;

  #weightMod = 0;

  /**
   * The equipped and packed caps from stored values.
   */
  static caps(max?: number | null, packedMax?: number | null) {
    const isDefaultMax =
      !max ||
      max === OseDataModelCharacterEncumbrance.baseEncumbranceCap ||
      max === OseDataModelCharacterEncumbranceItemBased.baseEncumbranceCap ||
      max === 2400 ||
      max === 1600 ||
      max === OseDataModelCharacterEncumbranceItemBased.alternateBaseEncumbranceCap;
    const equipped = isDefaultMax ? OseDataModelCharacterEncumbranceItemBased.baseEncumbranceCap : max;
    const packed =
      packedMax ?? (isDefaultMax ? OseDataModelCharacterEncumbranceItemBased.alternateBaseEncumbranceCap : max);
    return { equipped, packed };
  }

  constructor(
    max: number | null = 16,
    items: Item[] = [],
    options: { scores?: { str?: { mod?: number } }; packedMax?: number | null } = {},
  ) {
    super(OseDataModelCharacterEncumbranceItemBased.type, max);
    if (game.settings.get(game.system.id, "encumbranceItemStrengthMod")) {
      this.#weightMod = Math.max(0, options.scores?.str?.mod ?? 0);
    } else {
      this.#weightMod = 0;
    }

    const caps = OseDataModelCharacterEncumbranceItemBased.caps(max, options.packedMax);
    this.#packedMax = caps.packed;
    this.#equippedMax = caps.equipped;
    this.#packedWeight =
      Math.ceil(
        items.reduce((acc, item: Item) => {
          if (item.type === "item" && item.system.isCoinsOrGems) {
            // Coins and gems are handled below
            return acc;
          }
          if (["item", "weapon", "armor", "container"].includes(item.type) && !item.system.equipped) {
            return acc + rawItemSlots(item);
          }

          return acc;
        }, 0),
      ) +
      Math.ceil(
        items.reduce((acc, item: Item) => {
          if (item.type === "item" && item.system.isCoinsOrGems) {
            // Up to 100 coins or gems count as 1 item.
            return acc + (item.system.quantity?.value ?? 0) / 100;
          }

          return acc;
        }, 0),
      );
    this.#equippedWeight = Math.ceil(
      items.reduce((acc, item: Item) => {
        if (["item", "weapon", "armor", "container"].includes(item.type) && item.system.equipped) {
          return acc + rawItemSlots(item);
        }
        return acc;
      }, 0),
    );
    // Breakpoints are the same fractions of each cap as the default 9 and 16 slots.
    const C = OseDataModelCharacterEncumbranceItemBased;
    const packedLoad = this.#packedWeight - this.#weightMod;
    const packedOver = (n: number) => packedLoad * C.alternateBaseEncumbranceCap > n * this.#packedMax;
    const equippedOver = (n: number) => this.#equippedWeight * C.baseEncumbranceCap > n * this.#equippedMax;
    this.#atFiveEighths = packedOver(C.packedStepCounts.stepOne);
    this.#atThreeQuarters = packedOver(C.packedStepCounts.stepTwo);
    this.#atSevenEights = packedOver(C.packedStepCounts.stepThree);
    this.#atOneThird = equippedOver(C.equippedStepCounts.stepOne);
    this.#atFiveNinths = equippedOver(C.equippedStepCounts.stepTwo);
    this.#atSevenNinths = equippedOver(C.equippedStepCounts.stepThree);

    this.#weight = this.usingEquippedEncumbrance ? this.#equippedWeight : this.#packedWeight;
    this.#max = this.usingEquippedEncumbrance ? this.#equippedMax : this.#packedMax;
  }

  static defineSchema() {
    const { ArrayField, BooleanField, NumberField, SchemaField, StringField } = foundry.data.fields;

    return new SchemaField({
      variant: new StringField({
        initial: OseDataModelCharacterEncumbranceItemBased.type,
      }),
      enabled: new BooleanField({ initial: true }),
      encumbered: new BooleanField({ initial: false }),
      pct: new NumberField({ integer: false, initial: 0, min: 0, max: 100 }),
      steps: new ArrayField(new NumberField()),
      value: new NumberField({ integer: false }),
      max: new NumberField({
        integer: false,
        initial: OseDataModelCharacterEncumbranceItemBased.baseEncumbranceCap,
      }),
      packedMax: new NumberField({ integer: false, nullable: true, initial: null }),
      atFirstBreakpoint: new BooleanField({ initial: false }),
      atSecondBreakpoint: new BooleanField({ initial: false }),
      atThirdBreakpoint: new BooleanField({ initial: false }),
      nextBreakpointValue: new NumberField({ nullable: true, required: false, initial: null }),
      untilNextBreakpoint: new NumberField({ nullable: true, required: false, initial: null }),
      equippedSteps: new ArrayField(new NumberField()),
      packedSteps: new ArrayField(new NumberField()),
      equippedPct: new NumberField({ integer: false, min: 0, max: 100 }),
      packedPct: new NumberField({ integer: false, min: 0, max: 100 }),
      equippedValue: new NumberField({ integer: false }),
      packedValue: new NumberField({ integer: false }),
      equippedLabel: new StringField({ initial: "0/0" }),
      packedLabel: new StringField({ initial: "0/0" }),
      usingEquippedEncumbrance: new BooleanField({ initial: true }),
      weightMod: new NumberField({ integer: true, initial: 0 }),
    });
  }

  get steps() {
    return this.usingEquippedEncumbrance ? this.equippedSteps : this.packedSteps;
  }

  get usingEquippedEncumbrance() {
    const equippedLevel = [this.#atOneThird, this.#atFiveNinths, this.#atSevenNinths].filter(Boolean).length;
    const packedLevel = [this.#atFiveEighths, this.#atThreeQuarters, this.#atSevenEights].filter(Boolean).length;
    if (equippedLevel === 0 && packedLevel === 0) {
      // both are under the first breakpoint, use weight comparison
      return this.#equippedWeight >= this.#packedWeight - this.#weightMod;
    }

    return equippedLevel >= packedLevel;
  }

  get value(): number {
    return this.#weight;
  }

  get max(): number {
    return this.#max;
  }

  get atFirstBreakpoint(): boolean {
    return this.usingEquippedEncumbrance ? this.#atOneThird : this.#atFiveEighths;
  }

  get nextBreakpointValue() {
    const C = OseDataModelCharacterEncumbranceItemBased;
    const steps = this.usingEquippedEncumbrance
      ? [
          ...Object.values(C.equippedStepCounts).map((n) => Math.floor((n * this.#equippedMax) / C.baseEncumbranceCap)),
          this.#equippedMax,
        ]
      : [
          ...Object.values(C.packedStepCounts).map((n) =>
            Math.floor((n * this.#packedMax) / C.alternateBaseEncumbranceCap),
          ),
          this.#packedMax,
        ];

    const activeWeight = this.usingEquippedEncumbrance ? this.#equippedWeight : this.#packedWeight - this.#weightMod;

    for (const step of steps) {
      if (activeWeight <= step) {
        return step + (this.usingEquippedEncumbrance ? 0 : this.#weightMod);
      }
    }
    return null;
  }

  get atSecondBreakpoint(): boolean {
    return this.usingEquippedEncumbrance ? this.#atFiveNinths : this.#atThreeQuarters;
  }

  get atThirdBreakpoint(): boolean {
    return this.usingEquippedEncumbrance ? this.#atSevenNinths : this.#atSevenEights;
  }

  get encumbered() {
    return this.#equippedWeight > this.#equippedMax || this.#packedWeight > this.#packedMax + this.#weightMod;
  }

  get equippedSteps() {
    return Object.values(OseDataModelCharacterEncumbranceItemBased.equippedEncumbranceSteps);
  }

  get packedSteps() {
    return Object.values(OseDataModelCharacterEncumbranceItemBased.packedEncumbranceSteps);
  }

  get equippedPct() {
    return Math.clamp((this.#equippedWeight / this.#equippedMax) * 100, 0, 100);
  }

  get packedPct() {
    return Math.clamp(((this.#packedWeight - this.#weightMod) / this.#packedMax) * 100, 0, 100);
  }

  get equippedValue(): number {
    return this.#equippedWeight;
  }

  get packedValue(): number {
    return this.#packedWeight;
  }

  get equippedLabel(): string {
    return `${this.#equippedWeight}/${this.#equippedMax}`;
  }

  get packedLabel(): string {
    return `${this.#packedWeight}/${this.#packedMax + this.#weightMod}`;
  }

  get alternateMax() {
    return OseDataModelCharacterEncumbranceItemBased.alternateBaseEncumbranceCap;
  }
}
