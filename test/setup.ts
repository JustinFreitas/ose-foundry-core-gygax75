import { vi } from "vitest";

// Define Math.clamp globally as in Foundry environment
Math.clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

// Define mock base classes for Foundry documents
class MockDocument {
  id: string;
  name: string;
  system: any;
  flags: any;
  type: string;

  constructor(data: any = {}) {
    this.id = data._id || data.id || "mock-id";
    this.name = data.name || "Mock Document";
    this.system = data.system || {};
    this.flags = data.flags || {};
    this.type = data.type || "character";
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

class MockActor extends MockDocument {
  items: any[] = [];
  effects: any[] = [];
  prototypeToken: any = { actorLink: true };

  constructor(data: any = {}) {
    super(data);
    this.items = data.items || [];
  }

  getIsOwner() {
    return true;
  }

  async delete() {}
  
  async deleteEmbeddedDocuments() {}
  async updateEmbeddedDocuments() {}
}

class MockItem extends MockDocument {
  actor: any = null;
}

class MockRoll {
  formula: string;
  total: number = 0;
  constructor(formula: string) {
    this.formula = formula;
  }
  async evaluate() {
    this.total = 50; // simple static return
    return this;
  }
  async toMessage() {
    return {};
  }
  async render() {
    return "<div>Roll HTML</div>";
  }
}

class MockChatMessage {
  static create = vi.fn().mockResolvedValue({});
  static getSpeaker = vi.fn().mockReturnValue({});
}

class MockFolder extends MockDocument {
  contents: any[] = [];
  children: any[] = [];
}

class MockRollTable extends MockDocument {
  results: any[] = [];
  constructor(data: any = {}) {
    super(data);
    this.results = data.results || [];
  }
  async roll() {
    return { results: this.results };
  }
}

// Attach mocks to global scope
global.game = {
  system: { id: "ose" },
  i18n: {
    localize: (key: string) => key,
    format: (key: string, data?: any) => {
      if (data) return `${key}: ${JSON.stringify(data)}`;
      return key;
    },
  },
  settings: {
    get: vi.fn().mockImplementation((scope, key) => {
      if (key === "ascendingAC") return false;
      if (key === "initiative") return "group";
      if (key === "rerollInitiative") return "reset";
      return undefined;
    }),
    set: vi.fn().mockResolvedValue(true),
    register: vi.fn(),
  },
  actors: {
    get: vi.fn(),
    filter: vi.fn().mockReturnValue([]),
  },
  user: {
    id: "mock-user-id",
    isGM: true,
  },
  tables: [],
  messages: {
    size: 0,
    contents: [],
  },
} as any;

global.ui = {
  notifications: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
} as any;

global.CONFIG = {
  OSE: {
    languages: ["Common", "Elvish", "Dwarvish"],
    colors: {},
  },
  Dice: {},
} as any;

global.Hooks = {
  on: vi.fn(),
  once: vi.fn(),
  call: vi.fn(),
} as any;

global.Actor = MockActor as any;
global.Item = MockItem as any;
global.Roll = MockRoll as any;
global.ChatMessage = MockChatMessage as any;
global.Folder = MockFolder as any;
global.RollTable = MockRollTable as any;
global.foundry = {
  utils: {
    mergeObject: (a: any, b: any) => ({ ...a, ...b }),
    deepClone: (obj: any) => JSON.parse(JSON.stringify(obj)),
    parseUuid: (uuid: string) => {
      if (!uuid) return null;
      const parts = uuid.split(".");
      return { documentType: parts[0], documentId: parts[1] };
    },
    escapeHTML: (str: string) => str,
  },
  applications: {
    api: {
      DialogV2: class {
        static wait = vi.fn().mockResolvedValue({});
        static confirm = vi.fn().mockResolvedValue(true);
        static prompt = vi.fn().mockResolvedValue({});
        addEventListener = vi.fn();
        render = vi.fn().mockReturnThis();
      },
    },
    handlebars: {
      renderTemplate: vi.fn().mockResolvedValue("<div>Template</div>"),
    },
    ux: {
      FormDataExtended: class {
        form: any;
        object: any;
        constructor(form: any) {
          this.form = form;
          this.object = {};
        }
      },
      TextEditor: {
        implementation: {
          enrichHTML: vi.fn().mockImplementation(async (html) => html),
        },
      },
    },
  },
  abstract: {
    TypeDataModel: class {},
  },
} as any;

global.FormApplication = class {} as any;
global.CONST = {
  TABLE_RESULT_TYPES: {
    DOCUMENT: "DOCUMENT",
  },
} as any;
