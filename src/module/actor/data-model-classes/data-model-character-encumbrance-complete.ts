/**
 * @file A class representing the "Complete" encumbrance scheme from Old School Essentials: Classic Fantasy
 */
import OseDataModelCharacterEncumbrance, { type CharacterEncumbrance } from "./data-model-character-encumbrance";

/**
 * @todo Add template path for encumbrance bar
 * @todo Add template path for inventory item row
 */
export default class OseDataModelCharacterEncumbranceComplete
  extends OseDataModelCharacterEncumbrance
  implements CharacterEncumbrance
{
  static templateEncumbranceBar = "";

  static templateInventoryRow = "";

  /**
   * The machine-readable label for this encumbrance scheme
   */
  static type = "complete";

  /**
   * The human-readable label for this encumbrance scheme
   */
  static localizedLabel = "OSE.Setting.EncumbranceComplete";

  #weight;

  constructor(max: number | null = null, items: Item[] = []) {
    super(OseDataModelCharacterEncumbranceComplete.type, max);
    this.#weight = items.reduce((acc, item: Item) => {
      const {
        type,
        system: { quantity, weight },
      } = item;
      if (type === "item") {
        const itemWeight =
          (item.system as { cumulativeWeight?: number }).cumulativeWeight ??
          (quantity?.max && quantity.max > 0
            ? ((weight ?? 0) / quantity.max) * (quantity?.value ?? 0)
            : (quantity?.value ?? 0) * (weight ?? 0));
        return acc + itemWeight;
      }
      if (["weapon", "armor", "container"].includes(type)) return acc + (weight ?? 0);
      return acc;
    }, 0);
  }

  static defineSchema() {
    const { ArrayField, BooleanField, NumberField, SchemaField, StringField } = foundry.data.fields;

    return new SchemaField({
      variant: new StringField({
        initial: OseDataModelCharacterEncumbranceComplete.type,
      }),
      enabled: new BooleanField({ initial: true }),
      encumbered: new BooleanField({ initial: false }),
      pct: new NumberField({ integer: false, initial: 0, min: 0, max: 100 }),
      steps: new ArrayField(new NumberField()),
      value: new NumberField({ integer: false }),
      max: new NumberField({
        integer: false,
        nullable: true,
        initial: null,
      }),
      atFirstBreakpoint: new BooleanField({ initial: false }),
      atSecondBreakpoint: new BooleanField({ initial: false }),
      atThirdBreakpoint: new BooleanField({ initial: false }),
      nextBreakpointValue: new NumberField({ nullable: true, required: false, initial: null }),
      untilNextBreakpoint: new NumberField({ nullable: true, required: false, initial: null }),
    });
  }

  get steps() {
    return Object.values(OseDataModelCharacterEncumbrance.encumbranceSteps);
  }

  get value(): number {
    return this.#weight;
  }
}
