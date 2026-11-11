/**
 * @file The data model for Actors of type Monster
 */
// Encumbrance schemes
import OseDataModelCharacterEncumbranceDisabled from "./data-model-classes/data-model-character-encumbrance-disabled";
import OseDataModelCharacterMove from "./data-model-classes/data-model-character-move";
import OseDataModelCharacterSpells from "./data-model-classes/data-model-character-spells";

const getItemsOfActorOfType = (actor, filterType, filterFn = null) =>
  actor.items.filter(({ type }) => type === filterType).filter(filterFn || (() => true));

/**
 * Compute carried weight for a monster / mount / pack animal when `encumbrance.max > 0`.
 */
export const computeMonsterCarriedWeight = (items = []) => {
  let total = 0;
  for (const item of items) {
    if (
      !item?.system ||
      item.type === "spell" ||
      item.type === "ability" ||
      item.type === "class" ||
      item.type === "race"
    ) {
      continue;
    }
    if (item.type === "container") {
      total += Number(item.system.weight) || 0;
      continue;
    }
    // Armor (e.g. Horse Barding) has no quantity input on its sheet and historically stored
    // quantity.value === 0 or null; treat 0/null/undefined armor quantity as 1.
    if (item.type === "armor" && (item.system.quantity?.value === 0 || item.system.quantity?.value == null)) {
      total += Number(item.system.weight) || 0;
      continue;
    }
    if (item.type === "weapon" && item.system.quantity?.value == null) {
      total += Number(item.system.weight) || 0;
      continue;
    }
    if (typeof item.system.cumulativeWeight === "number") {
      total += item.system.cumulativeWeight;
    } else {
      const qty = item.system.quantity?.value ?? 1;
      const max = item.system.quantity?.max ?? 0;
      const weight = Number(item.system.weight) || 0;
      total += max > 0 ? (weight / max) * qty : weight * qty;
    }
  }
  return Math.round(total * 100) / 100;
};

export default class OseDataModelMonster extends foundry.abstract.TypeDataModel {
  prepareDerivedData() {
    const maxLoad = Number(this.encumbrance?.max) || 0;
    const rawBaseMove = Number(this.movement?.base) || 120;
    if (maxLoad > 0) {
      const carried = computeMonsterCarriedWeight([...(this.parent?.items ?? [])]);
      const halfLoad = maxLoad / 2;
      const overMax = carried > maxLoad;
      const overHalf = carried > halfLoad;
      this.encumbrance = {
        variant: "mount",
        enabled: true,
        value: carried,
        max: maxLoad,
        pct: Math.clamp((carried / maxLoad) * 100, 0, 100),
        steps: [50],
        encumbered: overMax,
        atFirstBreakpoint: false,
        atSecondBreakpoint: overHalf,
        atThirdBreakpoint: false,
      };
      const autoMove = Boolean(this.config?.movementAuto ?? this.movementAuto);
      const effectiveBase = autoMove
        ? overMax
          ? 0
          : overHalf
            ? Math.floor(rawBaseMove / 2)
            : rawBaseMove
        : rawBaseMove;
      this.movement = new OseDataModelCharacterMove(
        new OseDataModelCharacterEncumbranceDisabled(),
        false,
        effectiveBase,
      );
    } else {
      const disabled = new OseDataModelCharacterEncumbranceDisabled();
      disabled.max = 0;
      this.encumbrance = disabled;
      this.config.movementAuto = false;
      this.movement = new OseDataModelCharacterMove(this.encumbrance, false, rawBaseMove);
    }

    this.spells = new OseDataModelCharacterSpells(this.spells, this.#spellList);
    const source = this.parent?._source?.system ?? {};
    if (this.ac && this.aac) {
      if (this.ac.value !== source.ac?.value) this.aac.value = 19 - this.ac.value;
      else if (this.aac.value !== source.aac?.value) this.ac.value = 19 - this.aac.value;
    }
  }

  /**
   * @inheritdoc
   */
  static migrateData(source) {
    OseDataModelMonster.#migrateMonsterLanguages(source);
    OseDataModelMonster.#migrateCantrips(source);

    return super.migrateData ? super.migrateData(source) : source;
  }

  /**
   * Use an empty array for system.languages.value
   * in order to suppress Polyglot errors.
   *
   * @param {OseDataModelMonster} source - Source data to migrate
   */
  static #migrateMonsterLanguages(source) {
    const languages = source.languages ?? {};

    // If languages.value isn't an iterable, use an empty array
    if (typeof languages?.value?.[Symbol.iterator] !== "function") {
      languages.value = [];
    }
  }

  /**
   * Ensure cantrips (level 0 spells) exist in the spells object.
   * @param {OseDataModelMonster} source - Source data to migrate
   */
  static #migrateCantrips(source) {
    const spells = source.spells ?? {};

    // If there are spells but no cantrips (level 0 spells),
    // add an empty cantrip entry.
    if (spells && !spells["0"]) {
      spells["0"] = { max: 0, value: 0 };
    }
  }

  // @todo define schema options; stuff like min/max values and so on.
  static defineSchema() {
    const { StringField, NumberField, BooleanField, ObjectField, SchemaField } = foundry.data.fields;

    return {
      spells: new ObjectField(),
      details: new ObjectField(),
      ac: new ObjectField(),
      aac: new ObjectField(),
      encumbrance: new SchemaField({
        value: new NumberField({ integer: false }),
        max: new NumberField({ integer: false }),
      }),
      movement: new ObjectField(),
      config: new ObjectField(),
      initiative: new SchemaField({
        value: new NumberField({ integer: false, initial: 0 }),
        mod: new NumberField({ integer: false, initial: 0 }),
      }),
      hp: new SchemaField({
        hd: new StringField(),
        value: new NumberField({ integer: true }),
        max: new NumberField({ integer: true }),
      }),
      thac0: new ObjectField(),
      // Damage modifiers (e.g. damage.mod.missile), applied via Active Effects.
      // Read in rollAttack; mirrors the untyped thac0 ObjectField.
      damage: new ObjectField(),
      languages: new ObjectField(),
      saves: new SchemaField({
        breath: new SchemaField({ value: new NumberField({ integer: true }) }),
        death: new SchemaField({ value: new NumberField({ integer: true }) }),
        paralysis: new SchemaField({
          value: new NumberField({ integer: true }),
        }),
        spell: new SchemaField({ value: new NumberField({ integer: true }) }),
        wand: new SchemaField({ value: new NumberField({ integer: true }) }),
      }),
      retainer: new SchemaField({
        enabled: new BooleanField(),
        loyalty: new NumberField({ integer: true }),
        wage: new StringField(),
      }),
    };
  }

  // @todo This only needs to be public until
  //       we can ditch sharing out AC/AAC.
  // eslint-disable-next-line class-methods-use-this
  get usesAscendingAC() {
    return game.settings.get(game.system.id, "ascendingAC");
  }

  get isNew() {
    return !Object.values(this.saves).reduce((prev, curr) => prev + (Number.parseInt(curr?.value, 10) || 0), 0);
  }

  get containers() {
    return getItemsOfActorOfType(this.parent, "container", ({ system: { containerId } }) => !containerId);
  }

  get treasures() {
    return getItemsOfActorOfType(
      this.parent,
      "item",
      ({ system: { treasure, containerId } }) => treasure && !containerId,
    ).sort((a, b) => a.name.localeCompare(b.name));
  }

  get items() {
    return getItemsOfActorOfType(
      this.parent,
      "item",
      ({ system: { treasure, containerId } }) => !treasure && !containerId,
    ).sort((a, b) => a.name.localeCompare(b.name));
  }

  get weapons() {
    return getItemsOfActorOfType(this.parent, "weapon", ({ system: { containerId } }) => !containerId).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }

  get armor() {
    return getItemsOfActorOfType(this.parent, "armor", ({ system: { containerId } }) => !containerId).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }

  get abilities() {
    return getItemsOfActorOfType(this.parent, "ability", ({ system: { containerId } }) => !containerId).sort(
      (a, b) => (a.sort || 0) - (b.sort || 0),
    );
  }

  get attackPatterns() {
    return [...this.weapons, ...this.abilities]
      .sort((a, b) => {
        // Transparent attack patterns always go last.
        if (a.system.pattern !== "transparent" && b.system.pattern === "transparent") {
          return -1;
        }
        if (a.system.pattern === "transparent" && b.system.pattern !== "transparent") {
          return 1;
        }

        // White attack patterns are used for all general monster abilities.
        // Put these at the end of the colors.
        if (a.system.pattern === "white" && b.system.pattern !== "white") {
          return 1;
        }
        if (b.system.pattern === "white" && a.system.pattern !== "white") {
          return -1;
        }

        return b.type.localeCompare(a.type) || a.name.localeCompare(b.name);
      })
      .reduce((prev, curr) => {
        const { pattern } = curr.system;
        if (!prev[pattern]) prev[pattern] = [];
        prev[pattern].push(curr);
        return prev;
      }, {});
  }

  get #spellList() {
    if (!this.parent?.items) return [];
    return getItemsOfActorOfType(this.parent, "spell", ({ system: { containerId } }) => !containerId);
  }

  get isSlow() {
    return this.weapons.length === 0
      ? false
      : this.weapons.every((item) => !(item.type !== "weapon" || !item.system.slow));
  }

  get init() {
    const group = game.settings.get(game.system.id, "initiative") !== "group";

    return group ? (this.initiative.value || 0) + (this.initiative.mod || 0) : 0;
  }
}
