import { beforeEach, describe, expect, it, vi } from "vitest";
import OseActorSheetCharacter from "../actor/character-sheet";
import OseDataModelCharacterAC from "../actor/data-model-classes/data-model-character-ac";
import OseActor from "../actor/entity";
import OSECombatGroupSelector from "../combat/combat-set-groups";
import OseEntityTweaks from "../dialog/entity-tweaks";
import { augmentEffectConfig } from "../effects/effect-config";
import registerFVTTModuleAPIs from "../fvttModuleAPIs";
import OseDice from "../helpers-dice.js";
import { addControl } from "../helpers-party";
import { augmentTable } from "../helpers-treasure";
import OseItem from "../item/entity";
import OsePartySheet from "../party/party-sheet";
import { RenderCompendium, RenderItemDirectory } from "../renderList";

type ActorCtor = new (data?: Record<string, unknown>) => OseActor;
const createActor = (data: Record<string, unknown> = {}): OseActor => new (OseActor as unknown as ActorCtor)(data);

type ItemCtor = new (data?: Record<string, unknown>) => OseItem;
const createItem = (data: Record<string, unknown> = {}): OseItem => new (OseItem as unknown as ItemCtor)(data);

describe("Foundry V14 & Upstream v3.3.0 Audit Regressions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (globalThis as unknown as { game: Record<string, unknown> }).game.user = { id: "user-1", isGM: true };
  });

  describe("Upstream v3.3.0 Melee & Missile Damage Modifiers", () => {
    it("applies melee and missile damage.mod bonuses exactly once in rollAttack (never doubled)", () => {
      let capturedDmgParts: (string | number)[] = [];
      vi.spyOn(OseDice, "Roll").mockImplementation(((opts: { data: { roll: { dmg: (string | number)[] } } }) => {
        capturedDmgParts = opts.data.roll.dmg;
        return opts;
      }) as never);

      const actor = createActor({
        id: "actor-dmg",
        name: "Archer",
        type: "character",
        system: {
          scores: { str: { mod: 1 }, dex: { mod: 2 } },
          thac0: { value: 19, bba: 0, mod: { melee: 0, missile: 0 } },
          damage: { mod: { melee: 3, missile: 2 } },
          config: {},
        },
      });

      actor.rollAttack({}, { type: "melee", skipDialog: true });
      expect(capturedDmgParts).toEqual(["1d6", 1, 3]);

      actor.rollAttack({}, { type: "missile", skipDialog: true });
      expect(capturedDmgParts).toEqual(["1d6", 2]);
    });

    it("applies both melee and missile damage.mod bonuses in rollDamage", async () => {
      const rolled: (string | number)[][] = [];
      vi.spyOn(OseDice, "Roll").mockImplementation(((opts: { parts: (string | number)[] }) => {
        rolled.push(opts.parts);
        return Promise.resolve(opts);
      }) as never);

      const actor = createActor({
        id: "actor-rolldmg",
        name: "Ranger",
        type: "character",
        system: {
          scores: { str: { mod: 1 } },
          damage: { mod: { melee: 2, missile: 4 } },
        },
      });

      await actor.rollDamage({ label: "Sword", roll: { dmg: "1d8", type: "melee" } });
      await actor.rollDamage({ label: "Bow", roll: { dmg: "1d6", type: "missile" } });

      expect(rolled[0]).toEqual(["1d8", 1, 2]);
      expect(rolled[1]).toEqual(["1d6", 4]);
    });
  });

  describe("Retainer Loyalty & Multi-Armor AC", () => {
    it("forwards { event } as first argument to actor.rollLoyalty from character sheet", () => {
      const rollLoyalty = vi.fn();
      const fakeSheet = { actor: { rollLoyalty, rollCheck: vi.fn() } };
      const event = { ctrlKey: true };
      const target = {
        closest: () => ({ dataset: { stat: "lr" } }),
      };

      (
        OseActorSheetCharacter as unknown as {
          _onRollAbilityScore: (this: unknown, ev: unknown, el: unknown) => void;
        }
      )._onRollAbilityScore.call(fakeSheet, event, target);

      expect(rollLoyalty).toHaveBeenCalledWith({ event });
    });

    it("selects the best AC across multiple equipped non-shield armor items regardless of order", () => {
      const cloak = { system: { type: "unarmored", ac: { value: 9 }, aac: { value: 10 } } } as unknown as Item;
      const plate = { system: { type: "heavy", ac: { value: 3 }, aac: { value: 16 } } } as unknown as Item;
      const shield = { system: { type: "shield", ac: { value: 1 }, aac: { value: 1 } } } as unknown as Item;

      const descending = new OseDataModelCharacterAC(false, [cloak, plate, shield], 1, 0);
      expect(descending.value).toBe(1); // 3 (plate) - 1 (dex) - 1 (shield)

      const ascending = new OseDataModelCharacterAC(true, [cloak, plate, shield], 1, 0);
      expect(ascending.value).toBe(18); // 16 (plate) + 1 (dex) + 1 (shield)
    });
  });

  describe("OseItem Speaker, Spell Options & Chat Card Actions", () => {
    it("uses ChatMessage.getSpeaker({ actor: this.actor }) in show() and rollFormula() without leaking TokenDocument or secret item name", async () => {
      const getSpeakerSpy = vi
        .spyOn(ChatMessage, "getSpeaker")
        .mockReturnValue({ actor: "actor-16chars000", token: "token-16chars000", alias: "Goblin Scout" } as never);
      const createMsgSpy = vi.spyOn(ChatMessage, "create").mockResolvedValue({} as never);
      vi.spyOn(OseDice, "Roll").mockResolvedValue({} as never);

      (globalThis as unknown as { CONST: Record<string, unknown> }).CONST = {
        CHAT_MESSAGE_STYLES: { OTHER: 0 },
      };
      (globalThis as unknown as { game: Record<string, unknown> }).game.user = { id: "player-1", isGM: false };

      const ownerActor = {
        id: "actor-16chars000",
        name: "Goblin Scout",
        token: { id: "token-16chars000", parent: { id: "scene-16chars000" } },
      };
      const secretWand = createItem({
        id: "wand-16chars0000",
        name: "Wand of Paralyzation +2",
        type: "item",
        system: {
          identified: false,
          unidentifiedName: "Carved Bone Wand",
          unidentifiedDescription: "A pale wand.",
          description: "Secret GM text",
          roll: "1d6",
          autoTags: [],
        },
      });
      Object.defineProperty(secretWand, "actor", { value: ownerActor, configurable: true });

      await secretWand.show();
      expect(getSpeakerSpy).toHaveBeenCalledWith({ actor: ownerActor });
      expect(createMsgSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          speaker: { actor: "actor-16chars000", token: "token-16chars000", alias: "Goblin Scout" },
        }),
      );

      getSpeakerSpy.mockClear();
      await secretWand.rollFormula({ skipDialog: true });
      expect(getSpeakerSpy).toHaveBeenCalledWith({ actor: ownerActor });
    });

    it("forwards options through OseItem.roll() and spendSpell() into rollFormula()", async () => {
      const spell = createItem({
        id: "spell-1",
        name: "Magic Missile",
        type: "spell",
        system: { cast: 1, roll: "1d6+1" },
      });
      (spell as unknown as { update: unknown }).update = vi.fn().mockResolvedValue(spell);
      const rollFormulaSpy = vi.spyOn(spell, "rollFormula").mockResolvedValue(undefined);

      const opts = { skipDialog: false, event: { shiftKey: true } };
      await spell.spendSpell(opts);
      expect(rollFormulaSpy).toHaveBeenCalledWith(opts);

      rollFormulaSpy.mockClear();
      spell.roll(opts);
      await vi.waitFor(() => expect(rollFormulaSpy).toHaveBeenCalledWith(opts));
    });

    it("restores button.disabled on early return and dispatches damage action to actor.rollDamage", async () => {
      const rollDamage = vi.fn().mockResolvedValue({});
      const sword = createItem({
        id: "wpn-1",
        name: "Broad Sword",
        type: "weapon",
        system: { damage: "1d8", melee: true, identified: true },
      });
      const mockActor = {
        id: "act-1",
        name: "Fighter",
        items: new Map([["wpn-1", sword]]),
        rollDamage,
      };
      (globalThis as unknown as { game: Record<string, unknown> }).game.actors = new Map([["act-1", mockActor]]);
      (globalThis as unknown as { game: Record<string, unknown> }).game.messages = new Map([
        ["msg-1", { isAuthor: false }],
      ]);
      (globalThis as unknown as { game: Record<string, unknown> }).game.user = { id: "u-2", isGM: false };

      const makeEvent = (action: string, itemId = "wpn-1") => {
        const card = {
          dataset: { actorId: "act-1", itemId },
          closest: (sel: string) => (sel === ".message" ? { dataset: { messageId: "msg-1" } } : null),
        };
        const button = {
          disabled: false,
          dataset: { action },
          closest: (sel: string) => {
            if (sel === ".card-buttons button") return button;
            if (sel === ".chat-card") return card;
            return null;
          },
        };
        return {
          button,
          event: {
            preventDefault: vi.fn(),
            target: button,
          } as unknown as Event,
        };
      };

      // Unauthorized click should re-enable button via finally
      const unauthorized = makeEvent("formula");
      await OseItem._onChatCardAction(unauthorized.event);
      expect(unauthorized.button.disabled).toBe(false);

      // GM clicking damage button should invoke actor.rollDamage and re-enable button
      (globalThis as unknown as { game: Record<string, unknown> }).game.user = { id: "gm-1", isGM: true };
      const dmgClick = makeEvent("damage");
      await OseItem._onChatCardAction(dmgClick.event);
      expect(rollDamage).toHaveBeenCalledWith(
        expect.objectContaining({
          item: sword,
          label: "Broad Sword",
          roll: { dmg: "1d8", type: "melee" },
        }),
        { event: dmgClick.event },
      );
      expect(dmgClick.button.disabled).toBe(false);
    });
  });

  describe("Party Sheet Synchronous DragStart", () => {
    it("populates dataTransfer synchronously in _onDragStart using fromUuidSync", () => {
      const setData = vi.fn();
      (foundry.utils as unknown as Record<string, unknown>).fromUuidSync = vi.fn().mockReturnValue({
        toDragData: () => ({ type: "Actor", uuid: "Actor.pc-1" }),
      });

      const sheet = new OsePartySheet();
      const result = (sheet as unknown as { _onDragStart: (ev: unknown) => boolean })._onDragStart({
        currentTarget: { dataset: { uuid: "Actor.pc-1", actorId: "pc-1" } },
        dataTransfer: { setData },
      });

      expect(result).toBe(true);
      expect(setData).toHaveBeenCalledWith("text/plain", JSON.stringify({ type: "Actor", uuid: "Actor.pc-1" }));
    });
  });

  describe("Directory Tag Rendering, Idempotency & GYGAX-033 Masking", () => {
    it("renders visible auto-tags once without duplicating on repeated calls or leaking secret tags", async () => {
      const renderTemplateSpy = vi
        .spyOn(foundry.applications.handlebars, "renderTemplate")
        .mockImplementation(async (_tpl: string, data: unknown) => {
          const tags = (data as { tags: { label: string }[] }).tags;
          return `<ol class="tag-list">${tags.map((t) => `<li>${t.label}</li>`).join("")}</ol>`;
        });

      (globalThis as unknown as { game: Record<string, unknown> }).game.user = { id: "p-1", isGM: false };
      const secretSword = createItem({
        id: "sword-1",
        name: "Sword +2 vs Undead",
        type: "weapon",
        system: {
          identified: false,
          autoTags: [{ label: "Melee" }, { label: "+2 vs undead" }],
          manualTags: [{ value: "+2 vs undead" }],
        },
      });

      let htmlBuffer = "";
      const row = {
        dataset: { entryId: "sword-1" },
        querySelector: (sel: string) => (sel === ".tag-list" && htmlBuffer.includes("tag-list") ? {} : null),
        insertAdjacentHTML: (_pos: string, html: string) => {
          htmlBuffer += html;
        },
      };
      const missingRow = {
        dataset: { entryId: "deleted-id" },
        querySelector: () => null,
        insertAdjacentHTML: vi.fn(),
      };

      const directory = {
        documentName: "Item",
        element: {
          querySelectorAll: () => [row, missingRow],
        },
        collection: {
          find: (fn: (doc: OseItem) => boolean) => ([secretSword].find(fn) ?? undefined) as OseItem | undefined,
          getDocuments: async () => [secretSword],
        },
      };

      await RenderItemDirectory(directory as never);
      await RenderItemDirectory(directory as never);
      expect(renderTemplateSpy).toHaveBeenCalledTimes(1);
      expect(htmlBuffer).toContain("Melee");
      expect(htmlBuffer).not.toContain("+2 vs undead");

      htmlBuffer = "";
      await RenderCompendium(directory as never);
      await RenderCompendium(directory as never);
      expect(renderTemplateSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("Idempotent UI Helpers, Combat Group Selector, Tweaks & Item Piles Integration", () => {
    it("guards augmentTable, augmentEffectConfig, and addControl against duplicate/null DOM elements", () => {
      // addControl null element safety
      expect(() => addControl({ element: null } as never)).not.toThrow();

      // augmentTable idempotency
      const appended: unknown[] = [];
      let toggleEl: {
        classList: { add: () => void; toggle: ReturnType<typeof vi.fn> };
        addEventListener: () => void;
      } | null = null;
      const head = {
        querySelector: (sel: string) => (sel === ".toggle-treasure" ? toggleEl : null),
        append: (el: typeof toggleEl) => {
          toggleEl = el;
          appended.push(el);
        },
      };
      const origDoc = (globalThis as Record<string, unknown>).document;
      (globalThis as Record<string, unknown>).document = {
        createElement: () => ({
          className: "",
          title: "",
          classList: { add: vi.fn(), toggle: vi.fn() },
          addEventListener: vi.fn(),
          append: vi.fn(),
          setAttribute: vi.fn(),
        }),
      };
      (globalThis as Record<string, unknown>).Option = class {
        constructor(
          public text: string,
          public value: string,
        ) {}
      };

      try {
        const fakeTable = { document: { getFlag: () => false, setFlag: vi.fn() } };
        const tableHtml = { querySelector: (sel: string) => (sel === ".sheet-header" ? head : null) };
        augmentTable(fakeTable, tableHtml);
        augmentTable(fakeTable, tableHtml);
        expect(appended).toHaveLength(1);

        // augmentEffectConfig replaces existing datalist instead of duplicating
        const datalists: { id: string; remove: () => void; append: () => void }[] = [];
        (globalThis as Record<string, unknown>).document = {
          createElement: (tag: string) => {
            if (tag === "datalist") {
              const dl = {
                id: "",
                append: vi.fn(),
                remove: () => {
                  const idx = datalists.indexOf(dl);
                  if (idx >= 0) datalists.splice(idx, 1);
                },
              };
              return dl;
            }
            return { className: "", dataset: {}, innerHTML: "", append: vi.fn() };
          },
        };
        const section = {
          querySelectorAll: (sel: string) => (sel === "datalist" ? [...datalists] : []),
          querySelector: () => null,
          append: (dl: (typeof datalists)[number]) => datalists.push(dl),
        };
        const root = { querySelector: () => section } as unknown as HTMLElement;
        (globalThis as Record<string, unknown>).HTMLElement = Object as never;
        augmentEffectConfig({ id: "ae-1", document: { parent: { documentName: "Actor", type: "character" } } }, root);
        augmentEffectConfig({ id: "ae-1", document: { parent: { documentName: "Actor", type: "character" } } }, root);
        expect(datalists).toHaveLength(1);
      } finally {
        (globalThis as Record<string, unknown>).document = origDoc;
      }
    });

    it("includes dialog class on OSECombatGroupSelector and prefers ui.combat.viewed", async () => {
      expect(OSECombatGroupSelector.DEFAULT_OPTIONS.classes).toContain("ose");
      expect(OSECombatGroupSelector.DEFAULT_OPTIONS.classes).toContain("dialog");

      const viewedCombatants = [{ id: "c-viewed" }];
      (globalThis as unknown as { ui: Record<string, unknown> }).ui.combat = {
        viewed: { combatants: viewedCombatants },
      };
      const selector = new OSECombatGroupSelector();
      const ctx = await (
        selector as unknown as { _prepareContext: (o: unknown) => Promise<{ combatants: unknown }> }
      )._prepareContext({});
      expect(ctx.combatants).toBe(viewedCombatants);
    });

    it("gates OseEntityTweaks hasClasses on enableClassItems world setting", async () => {
      const actorDoc = {
        name: "Fighter",
        type: "character",
        items: [{ type: "class" }],
        effects: [],
        _source: { system: {} },
        toObject: () => ({ system: { encumbrance: {} } }),
      };
      await game.settings.set("ose", "enableClassItems", false);
      const appDisabled = new (
        OseEntityTweaks as unknown as new (
          o: unknown,
        ) => {
          document: unknown;
          _prepareContext: () => Promise<{ hasClasses: boolean }>;
        }
      )({ document: actorDoc });
      appDisabled.document = actorDoc;
      const ctxDisabled = await appDisabled._prepareContext();
      expect(ctxDisabled.hasClasses).toBe(false);

      await game.settings.set("ose", "enableClassItems", true);
      const ctxEnabled = await appDisabled._prepareContext();
      expect(ctxEnabled.hasClasses).toBe(true);
      await game.settings.set("ose", "enableClassItems", false);
    });

    it("registers full OSE currencies (weight 1 cn) and class/race filters in Item Piles integration", async () => {
      let registeredConfig: Record<string, unknown> | undefined;
      (globalThis as unknown as { game: Record<string, unknown> }).game.itempiles = {
        API: {
          addSystemIntegration: (cfg: Record<string, unknown>) => {
            registeredConfig = cfg;
          },
        },
      };
      let readyCb: (() => Promise<void>) | undefined;
      const onceSpy = vi.spyOn(Hooks, "once").mockImplementation(((hook: string, fn: () => Promise<void>) => {
        if (hook === "item-piles-ready") readyCb = fn;
        return 1;
      }) as never);

      registerFVTTModuleAPIs();
      await readyCb?.();
      onceSpy.mockRestore();

      expect(registeredConfig).toBeDefined();
      expect(registeredConfig?.ITEM_FILTERS).toEqual([{ path: "type", filters: "spell,ability,class,race" }]);
      const currencies = registeredConfig?.CURRENCIES as {
        abbreviation: string;
        exchangeRate: number;
        data: { item: { system: { weight: number } } };
      }[];
      expect(currencies.map((c) => c.abbreviation)).toEqual(["{#}PP", "{#}GP", "{#}EP", "{#}SP", "{#}CP"]);
      expect(currencies.every((c) => c.data.item.system.weight === 1)).toBe(true);
    });
  });
});
