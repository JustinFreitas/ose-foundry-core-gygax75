/**
 * @file Minimal Foundry globals for running data-model logic under Vitest.
 *
 * Mirrors only what the item data models touch: the `TypeDataModel` base, the
 * schema field classes used by `defineSchema()`, `CONFIG.OSE`, and
 * `game.i18n.localize`. Anything beyond that is deliberately absent — a test
 * that needs more Foundry than this belongs in the Quench suite.
 */
import { vi } from "vitest";
import { OSE } from "../src/module/config";

interface FieldOptions {
  initial?: unknown;
}

class DataField {
  options: FieldOptions;

  constructor(options: FieldOptions = {}) {
    this.options = options ?? {};
  }

  getInitialValue(): unknown {
    return this.options.initial;
  }
}

class StringField extends DataField {
  getInitialValue() {
    return this.options.initial ?? "";
  }
}

class HTMLField extends StringField {}

class NumberField extends DataField {
  getInitialValue() {
    return this.options.initial ?? null;
  }
}

class BooleanField extends DataField {
  getInitialValue() {
    return this.options.initial ?? false;
  }
}

class ArrayField extends DataField {
  constructor(
    readonly element: DataField,
    options: FieldOptions = {},
  ) {
    super(options);
  }

  getInitialValue() {
    return this.options.initial ?? [];
  }
}

class ObjectField extends DataField {
  getInitialValue() {
    return this.options.initial ?? {};
  }
}

class SchemaField extends DataField {
  constructor(
    readonly fields: Record<string, DataField>,
    options: FieldOptions = {},
  ) {
    super(options);
  }

  getInitialValue() {
    return Object.fromEntries(Object.entries(this.fields).map(([key, field]) => [key, field.getInitialValue()]));
  }
}

/**
 * Stands in for `foundry.abstract.TypeDataModel`. Foundry runs `migrateData`
 * over the source before initializing fields, so this does too — otherwise
 * migration logic would be untestable here.
 */
class TypeDataModel {
  parent: unknown;

  /** The cleaned source, as Foundry exposes it. Tag helpers read roll data off this. */
  _source: Record<string, unknown> = {};

  constructor(source: Record<string, unknown> = {}, options: { parent?: unknown } = {}) {
    const ctor = new.target as unknown as {
      defineSchema(): Record<string, DataField>;
      migrateData?(source: Record<string, unknown>): Record<string, unknown>;
    };

    this.parent = options.parent;

    const migrated = ctor.migrateData ? ctor.migrateData({ ...source }) : source;
    const schema = ctor.defineSchema();

    for (const [key, field] of Object.entries(schema)) {
      const provided = migrated[key];
      const value = provided === undefined ? field.getInitialValue() : provided;
      this._source[key] = value;
      Object.defineProperty(this, key, {
        value,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }
  }

  /** Merges changes into the source and the initialized fields, as Foundry does. */
  updateSource(changes: Record<string, unknown> = {}) {
    for (const [key, value] of Object.entries(changes)) {
      this._source[key] = value;
      (this as Record<string, unknown>)[key] = value;
    }
    return changes;
  }
}

/**
 * Stands in for Foundry's Roll. Only `formula` is used by the tag helpers, and
 * this returns the expression verbatim — Foundry normalizes spacing, so tests
 * here assert the raw string where Quench asserts the normalized one.
 */
class Roll {
  formula: string;

  constructor(formula = "", _data: unknown = {}) {
    this.formula = formula;
  }
}

class Combatant {
  id: string;
  name: string;
  actor: any = null;
  token: any = null;
  defeated = false;
  initiative: number | string | null = null;
  combat: any = null;
  group: any = null;
  flags: Record<string, any> = {};

  constructor(data: any = {}) {
    this.id = data._id || data.id || "mock-combatant-id";
    this.name = data.name || "Mock Combatant";
    this.actor = data.actor || null;
    this.token = data.token || null;
    this.defeated = data.defeated || false;
    this.initiative = data.initiative ?? null;
    this.combat = data.combat || null;
    this.group = data.group || null;
    this.flags = data.flags || {};
  }

  getFlag(scope: string, key: string) {
    return this.flags[scope]?.[key];
  }

  async setFlag(scope: string, key: string, value: any) {
    this.flags[scope] = this.flags[scope] || {};
    this.flags[scope][key] = value;
  }

  async getData(_options = {}) {
    return { ...this };
  }
}

class Actor {
  id: string;
  name: string;
  type: string;
  system: any;
  flags: Record<string, any> = {};

  constructor(data: any = {}) {
    this.id = data._id || data.id || "mock-actor-id";
    this.name = data.name || "Mock Actor";
    this.type = data.type || "character";
    this.system = data.system || {};
    this.flags = data.flags || {};
  }

  getFlag(scope: string, key: string) {
    return this.flags[scope]?.[key];
  }

  async setFlag(scope: string, key: string, value: any) {
    this.flags[scope] = this.flags[scope] || {};
    this.flags[scope][key] = value;
  }

  async update(data: any) {
    if (data.system) {
      this.system = { ...this.system, ...data.system };
    }
    return this;
  }
}

class Item {
  id: string;
  name: string;
  type: string;
  system: any;
  flags: Record<string, any> = {};

  constructor(data: any = {}) {
    this.id = data._id || data.id || "mock-item-id";
    this.name = data.name || "Mock Item";
    this.type = data.type || "item";
    this.system = data.system || {};
    this.flags = data.flags || {};
  }

  updateSource(data: any) {
    Object.assign(this.system, data);
  }

  async _preCreate(_data: any, _options: any, _user: any) {
    return true;
  }

  async _preUpdate(_changed: any, _options: any, _user: any) {
    return true;
  }

  getFlag(scope: string, key: string) {
    return this.flags[scope]?.[key];
  }

  async setFlag(scope: string, key: string, value: any) {
    this.flags[scope] = this.flags[scope] || {};
    this.flags[scope][key] = value;
  }
}

class MockDialogV2 {
  options: any;
  constructor(options: any) {
    this.options = options;
  }
  addEventListener() {}
  async render() {
    return this;
  }
  static confirm = () => Promise.resolve(true);
  static prompt = vi.fn().mockResolvedValue({ level: 1, rollHp: false, offer: false });
  static wait = vi.fn().mockResolvedValue(true);
}

// Global Math.clamp
if (!Math.clamp) {
  Math.clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);
}

const settingsStore = new Map<string, any>([
  ["ose.ascendingAC", false],
  ["ose.initiative", "group"],
  ["ose.rerollInitiative", "reset"],
  ["ose.gygax75Encumbrance", true],
  ["ose.savedParties", {}],
  ["ose.effectsTab", true],
  ["ose.multipleClasses", true],
  ["ose.enableClassItems", false],
]);

const hookRegistry = new Map<string, Function[]>();
const Hooks = {
  events: hookRegistry,
  on: vi.fn((event: string, fn: Function) => {
    if (!hookRegistry.has(event)) hookRegistry.set(event, []);
    hookRegistry.get(event)!.push(fn);
  }),
  once: vi.fn((event: string, fn: Function) => {
    if (!hookRegistry.has(event)) hookRegistry.set(event, []);
    hookRegistry.get(event)!.push(fn);
  }),
  callAll: vi.fn((event: string, ...args: any[]) => {
    const callbacks = hookRegistry.get(event) || [];
    for (const cb of callbacks) cb(...args);
    return true;
  }),
  call: vi.fn((event: string, ...args: any[]) => {
    const callbacks = hookRegistry.get(event) || [];
    for (const cb of callbacks) cb(...args);
    return true;
  }),
};

Object.assign(globalThis, {
  Roll,
  Actor,
  Item,
  Combatant,
  Hooks,
  CONST: {
    CHAT_MESSAGE_STYLES: {
      OTHER: 0,
    },
    TOKEN_DISPOSITIONS: {
      SECRET: -2,
      HOSTILE: -1,
      NEUTRAL: 0,
      FRIENDLY: 1,
    },
  },
  OseDice: {
    Roll: (data: any) => data,
  },
  foundry: {
    abstract: { TypeDataModel },
    documents: {
      Combat: class Combat {},
      ChatMessage: {
        implementation: {
          create: vi.fn().mockResolvedValue({}),
        },
      },
    },
    applications: {
      handlebars: {
        renderTemplate: vi.fn().mockResolvedValue("<div>Template</div>"),
      },
      api: {
        DialogV2: MockDialogV2,
        ApplicationV2: class ApplicationV2 {
          options: any;
          constructor(options: any = {}) {
            this.options = options;
          }
          render() {
            return this;
          }
          async close() {}
        },
        HandlebarsApplicationMixin: (Base: any) =>
          class extends Base {
            async _prepareContext() {
              return {};
            }
          },
      },
      sheets: {
        ActorSheetV2: class ActorSheetV2 {
          actor: any;
          options: any;
          tabGroups: any = {};
          constructor(options: any = {}) {
            this.options = options;
            this.actor = options.document;
          }
          get isEditable() {
            return true;
          }
          async _prepareContext(_options?: any) {
            return {};
          }
          _getTabsConfig(_group: any) {
            return null;
          }
          async _onFirstRender(_context: any, _options: any) {}
          async _onRender(_context: any, _options: any) {}
          _onPosition(_position: any) {}
          _sizeResizables() {}
          render() {
            return this;
          }
        },
      },
      ux: {
        TextEditor: {
          implementation: class {
            static enrichHTML(content: string) {
              return Promise.resolve(content);
            }
          },
        },
        DragDrop: {
          implementation: class {
            bind() {}
          },
        },
        FormDataExtended: class {
          object: any;
          constructor(form: any) {
            this.object = form || {};
          }
        },
      },
    },
    data: {
      fields: { DataField, StringField, HTMLField, NumberField, BooleanField, ArrayField, ObjectField, SchemaField },
    },
    utils: {
      debounce: (fn: any) => fn,
      mergeObject: (target: any, source: any) => Object.assign(target || {}, source),
      escapeHTML: (str: string) => str,
      getProperty: (obj: any, path: string) => {
        if (!obj || !path) return undefined;
        return path.split(".").reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);
      },
      setProperty: (obj: any, path: string, value: any) => {
        if (!obj || !path) return false;
        const parts = path.split(".");
        let cur = obj;
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          if (!part) continue;
          if (!cur[part]) cur[part] = {};
          cur = cur[part];
        }
        const lastPart = parts[parts.length - 1];
        if (lastPart) cur[lastPart] = value;
        return true;
      },
    },
  },
  CONFIG: {
    OSE,
    Combat: {
      initiative: {
        formula: "1d6",
      },
    },
    Dice: {
      rollModes: {
        publicroll: "publicroll",
        gmroll: "gmroll",
        blindroll: "blindroll",
        selfroll: "selfroll",
      },
    },
    ChatMessage: {
      modes: {
        public: "public",
        gm: "gm",
        blind: "blind",
        self: "self",
      },
    },
  },
  ChatMessage: {
    getSpeaker: () => ({}),
    getSpeakerActor: vi.fn((speaker: any) => speaker?._actor || null),
    create: vi.fn().mockResolvedValue({}),
  },
  ui: {
    notifications: {
      warn: () => {},
      info: () => {},
      error: () => {},
    },
  },
  settingsStore,
  game: {
    system: { id: "ose" },
    user: { isGM: true },
    actors: [] as any[],
    i18n: {
      localize: (key: string) => key,
      format: (key: string, data?: any) => {
        if (data) return `${key}: ${JSON.stringify(data)}`;
        return key;
      },
    },
    settings: {
      _store: settingsStore,
      get: vi.fn((_scope: string, key: string) => {
        const fullKey = `ose.${key}`;
        if (settingsStore.has(fullKey)) return settingsStore.get(fullKey);
        if (settingsStore.has(key)) return settingsStore.get(key);
        return undefined;
      }),
      set: vi.fn().mockImplementation(async (_scope: string, key: string, value: any) => {
        const fullKey = `ose.${key}`;
        settingsStore.set(fullKey, value);
        return value;
      }),
      register: vi.fn(),
    },
  },
});
