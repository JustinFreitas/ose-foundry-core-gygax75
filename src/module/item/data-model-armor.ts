/**
 * @file The data model for Items of type Armor
 */
import { ARMOR_TYPES, type ArmorItemData, type ArmorType, type DisplayTag, type ItemTag } from "./item-types";

// fvtt-types cannot resolve this system's data models, so a precise Parent forces
// casts here and full Item stubs in tests. Revisit if they are ever registered.
// biome-ignore lint/suspicious/noExplicitAny: see above
export default class OseDataModelArmor extends foundry.abstract.TypeDataModel<any, any> implements ArmorItemData {
  static ArmorTypes = ARMOR_TYPES;
  declare type: ArmorType;
  declare ac: { value: number };
  declare aac: { value: number };
  declare description: string;
  declare tags: ItemTag[];
  declare equipped: boolean;
  declare cost: number;
  declare containerId: string;
  declare quantity: { value: number | null; max: number | null };
  declare weight: number | null;
  declare itemslots: number;
  declare identified: boolean;
  declare unidentifiedName: string;
  declare unidentifiedDescription: string;

  static defineSchema() {
    const { SchemaField, StringField, NumberField, BooleanField, ArrayField, ObjectField } = foundry.data.fields;
    return {
      type: new StringField({
        initial: "light",
        choices: Object.keys(OseDataModelArmor.ArmorTypes),
      }),
      ac: new SchemaField({
        value: new NumberField({
          initial: 9,
        }),
      }),
      aac: new SchemaField({
        value: new NumberField({
          initial: 10,
        }),
      }),
      description: new StringField(),
      tags: new ArrayField(new ObjectField()),
      equipped: new BooleanField(),
      cost: new NumberField({ min: 0, initial: 0 }),
      containerId: new StringField(),
      quantity: new SchemaField({
        value: new NumberField({ min: 0, initial: 1 }),
        max: new NumberField({ min: 0, initial: 0 }),
      }),
      weight: new NumberField({ min: 0, initial: 0 }),
      itemslots: new NumberField({ min: 0, initial: 1 }),
      identified: new BooleanField({ initial: true }),
      unidentifiedName: new StringField({ initial: "" }),
      unidentifiedDescription: new StringField({ initial: "" }),
    };
  }

  get cumulativeWeight(): number {
    const qty = this.quantity?.value || 1;
    const weight = this.weight ?? 0;
    if (this.quantity?.max && this.quantity.max > 0) {
      return (weight / this.quantity.max) * qty;
    }
    return weight * qty;
  }

  get cumulativeCost(): number {
    const qty = this.quantity?.value || 1;
    const cost = this.cost ?? 0;
    if (this.quantity?.max && this.quantity.max > 0) {
      return (cost / this.quantity.max) * qty;
    }
    return cost * qty;
  }

  get cumulativeItemslots(): number {
    const qty = this.quantity?.value || 1;
    const itemslots = this.itemslots ?? 0;
    if (this.quantity?.max && this.quantity.max > 0) {
      return Math.ceil((itemslots / this.quantity.max) * qty);
    }
    return Math.ceil(itemslots * qty);
  }

  get manualTags(): ItemTag[] | null {
    if (!this.tags) return null;

    const tagNames = new Set<string>(Object.values(CONFIG.OSE.auto_tags).map(({ label }) => label));
    return this.tags
      .filter(({ value }) => !tagNames.has(value))
      .map(({ title, value }) => ({ title, value, label: value }));
  }

  get autoTags(): DisplayTag[] {
    const tagNames = Object.values(CONFIG.OSE.auto_tags);

    const autoTags = this.tags.map(({ value }) => tagNames.find(({ label }) => value === label));

    return [
      { label: OseDataModelArmor.ArmorTypes[this.type], icon: "fa-tshirt" },
      ...autoTags,
      ...(this.manualTags ?? []),
    ]
      .flat()
      .filter((t) => !!t);
  }
}
