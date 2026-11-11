/**
 * @file Unit tests for Active Effects Tab, Data Preparation, Actions, and Layout.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import OseItem from "../../item/entity";
import { onDragStartItem } from "../../sheet/drag-drop";
import OseActorSheet from "../actor-sheet";
import OseActorSheetCharacter from "../character-sheet";
import OseActorSheetMonster from "../monster-sheet";

describe("Phase 4: Active Effects Tab & Sheet Layout", () => {
  let actor: any;
  let effectsMap: Map<string, any>;
  let itemsMap: Map<string, any>;

  const createMockEffect = (id: string, name: string, options: any = {}) => {
    const effect: any = {
      _id: id,
      id,
      uuid: options.uuid || `Actor.actor-1.ActiveEffect.${id}`,
      name,
      img: options.img || "icons/svg/aura.svg",
      disabled: Boolean(options.disabled),
      isTemporary: Boolean(options.isTemporary),
      isSuppressed: Boolean(options.isSuppressed),
      duration: options.duration || {},
      transfer: options.transfer ?? true,
      parent: options.parent ?? actor,
      sheet: {
        render: vi.fn(),
      },
      delete: vi.fn().mockResolvedValue(true),
      update: vi.fn().mockImplementation(async (data: any) => {
        Object.assign(effect, data);
        return effect;
      }),
      toDragData: () => ({
        type: "ActiveEffect",
        uuid: `Actor.${actor.id}.ActiveEffect.${id}`,
        data: { _id: id, name },
      }),
    };
    if (effect.parent === actor) {
      effectsMap.set(id, effect);
    }
    return effect;
  };

  const createMockItemWithEffects = (id: string, name: string, effects: any[] = [], system: any = {}) => {
    const isIdentified = system.identified !== false;
    const item: any = {
      _id: id,
      id,
      documentName: "Item",
      name,
      displayName: isIdentified ? name : "Unknown Item",
      isIdentified,
      system: {
        ...system,
      },
      effects: [] as any[],
      sheet: {
        render: vi.fn(),
      },
      prepareDerivedData: vi.fn().mockResolvedValue(undefined),
    };
    item.effects = effects.map((eff) => ({
      img: "icons/svg/aura.svg",
      disabled: false,
      isTemporary: false,
      isSuppressed: false,
      duration: {},
      uuid: `Actor.actor-1.Item.${id}.ActiveEffect.${eff.id}`,
      ...eff,
      parent: item,
    }));
    itemsMap.set(id, item);
    return item;
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    effectsMap = new Map();
    itemsMap = new Map();
    (globalThis as any).game.user = { isGM: true };

    actor = {
      id: "actor-1",
      uuid: "Actor.actor-1",
      name: "Morgan Ironwolf",
      isOwner: true,
      isOwnerOrObserver: true,
      isToken: false,
      pack: null,
      effects: {
        get: (id: string) => effectsMap.get(id),
        [Symbol.iterator]: () => effectsMap.values(),
      },
      items: {
        get: (id: string) => itemsMap.get(id),
        [Symbol.iterator]: () => itemsMap.values(),
      },
      *allApplicableEffects() {
        for (const e of effectsMap.values()) yield e;
        for (const item of itemsMap.values()) {
          for (const e of item.effects) {
            if (e.transfer !== false) yield e;
          }
        }
      },
      createEmbeddedDocuments: vi.fn().mockImplementation(async (_type: string, data: any[]) => {
        const created = data.map((d, index) => {
          const docId = `created-${index + 1}`;
          return createMockEffect(docId, d.name, d);
        });
        return created;
      }),
      isNew: () => false,
      toObject: () => ({ id: actor.id, name: actor.name }),
      system: {
        spells: { enabled: true },
        config: { enableInventory: true },
        classes: [],
        classXpBonus: vi.fn().mockReturnValue(0),
      },
    };
  });

  describe("OseActorSheet._prepareContext effectGroups", () => {
    it("groups temporary, passive, and inactive effects correctly", async () => {
      createMockEffect("eff-1", "Bless", { isTemporary: true, disabled: false });
      createMockEffect("eff-2", "Barkskin", { isTemporary: false, disabled: false });
      createMockEffect("eff-3", "Curse", { isTemporary: true, disabled: true });
      createMockEffect("eff-4", "Sleeping Aura", { isTemporary: false, disabled: true });

      const sheet = new OseActorSheet({ document: actor });
      const context = await sheet._prepareContext({});
      const effectGroups = (context.effectGroups ?? []) as any[];
      const groups = Object.fromEntries(effectGroups.map((g: any) => [g.key, g]));

      expect(groups.temporary.effects.map((e: any) => e.name)).toEqual(["Bless"]);
      expect(groups.passive.effects.map((e: any) => e.name)).toEqual(["Barkskin"]);
      expect(groups.inactive.effects.map((e: any) => e.name)).toEqual(["Curse", "Sleeping Aura"]);
      expect((context as any).effects).toBeUndefined();
    });

    it("marks unequipped item-granted effects as suppressed and links itemId", async () => {
      createMockItemWithEffects(
        "item-ring",
        "Ring of Protection",
        [{ id: "eff-ring", name: "Ring of Protection +1", transfer: true }],
        { equipped: true },
      );
      createMockItemWithEffects(
        "item-cloak",
        "Cloak of Elvenkind",
        [{ id: "eff-cloak", name: "Cloak of Elvenkind", transfer: true }],
        { equipped: false },
      );
      createMockItemWithEffects("item-scroll", "Magic Scroll", [
        { id: "eff-scroll", name: "Scroll Spell Effect", transfer: false },
      ]);

      const sheet = new OseActorSheet({ document: actor });
      const context = await sheet._prepareContext({});
      const effectGroups = (context.effectGroups ?? []) as any[];
      const passive = effectGroups.find((g: any) => g.key === "passive")?.effects ?? [];

      expect(passive).toHaveLength(2);

      const ringEntry = passive.find((e: any) => e.id === "eff-ring");
      expect(ringEntry).toBeDefined();
      expect(ringEntry?.itemId).toBe("item-ring");
      expect(ringEntry?.source).toBe("Ring of Protection");
      expect(ringEntry?.suppressed).toBe(false);

      const cloakEntry = passive.find((e: any) => e.id === "eff-cloak");
      expect(cloakEntry).toBeDefined();
      expect(cloakEntry?.itemId).toBe("item-cloak");
      expect(cloakEntry?.source).toBe("Cloak of Elvenkind");
      expect(cloakEntry?.suppressed).toBe(true);
    });

    it("handles items without equipped property without suppressing", async () => {
      createMockItemWithEffects(
        "item-stone",
        "Ioun Stone",
        [{ id: "eff-stone", name: "Ioun Stone", transfer: true }],
        {},
      );

      const sheet = new OseActorSheet({ document: actor });
      const context = await sheet._prepareContext({});
      const effectGroups = (context.effectGroups ?? []) as any[];
      const passive = effectGroups.find((g: any) => g.key === "passive")?.effects ?? [];

      expect(passive[0]?.suppressed).toBe(false);
    });

    it("hides effects granted by unidentified items from non-GM players while showing them to GMs", async () => {
      createMockItemWithEffects(
        "item-cursed",
        "Sword -1, Cursed",
        [{ id: "eff-curse", name: "Cursed Penalty -1", transfer: true }],
        { equipped: true, identified: false },
      );

      const sheet = new OseActorSheet({ document: actor });

      (globalThis as any).game.user = { isGM: false };
      const playerCtx = await sheet._prepareContext({});
      const playerGroups = (playerCtx.effectGroups ?? []) as any[];
      const playerPassive = playerGroups.find((g: any) => g.key === "passive")?.effects ?? [];
      expect(playerPassive).toHaveLength(0);

      (globalThis as any).game.user = { isGM: true };
      const gmCtx = await sheet._prepareContext({});
      const gmGroups = (gmCtx.effectGroups ?? []) as any[];
      const gmPassive = gmGroups.find((g: any) => g.key === "passive")?.effects ?? [];
      expect(gmPassive).toHaveLength(1);
      expect(gmPassive[0]?.name).toBe("Cursed Penalty -1");
    });

    it("synchronously suppresses getter-only ActiveEffect instances during OseItem.prepareDerivedData without throwing", async () => {
      class CoreGetterOnlyEffect {
        id = "eff-getter";
        get isSuppressed(): boolean {
          return false;
        }
      }
      const embeddedEffect = new CoreGetterOnlyEffect();
      const unequippedSword = new OseItem({
        name: "Magic Sword +1",
        type: "weapon",
        system: { equipped: false, description: "<p> gleaming blade </p>" },
      });
      (unequippedSword as any).effects = [embeddedEffect];

      await expect(unequippedSword.prepareDerivedData()).resolves.not.toThrow();
      expect(embeddedEffect.isSuppressed).toBe(true);
      expect((unequippedSword.system as any).enrichedDescription).toBe("<p> gleaming blade </p>");

      (unequippedSword.system as any).equipped = true;
      await expect(unequippedSword.prepareDerivedData()).resolves.not.toThrow();
      expect(embeddedEffect.isSuppressed).toBe(false);
    });

    it("gates class XP adjustment rows on enableClassItems", async () => {
      actor.system.classes = [{ uuid: "Item.cls-1", name: "Fighter", img: "fighter.png" }];
      actor.system.classXpBonus = () => 10;

      const sheet = new OseActorSheet({ document: actor });

      await (globalThis as any).game.settings.set("ose", "enableClassItems", false);
      const offCtx = await sheet._prepareContext({});
      const offGroups = (offCtx.effectGroups ?? []) as any[];
      expect(offGroups.find((g: any) => g.key === "passive")?.effects ?? []).toHaveLength(0);

      await (globalThis as any).game.settings.set("ose", "enableClassItems", true);
      const onCtx = await sheet._prepareContext({});
      const onGroups = (onCtx.effectGroups ?? []) as any[];
      expect(onGroups.find((g: any) => g.key === "passive")?.effects ?? []).toHaveLength(1);
    });
  });

  describe("OseActorSheet Action Handlers", () => {
    let mockSheet: any;

    beforeEach(() => {
      mockSheet = {
        actor,
        isEditable: true,
      };
    });

    it("creates temporary ActiveEffect with rounds: 1 duration", async () => {
      const target = {
        dataset: { effectType: "temporary" },
      };

      await OseActorSheet._onCreateEffect.call(mockSheet, {} as any, target as any);

      expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith("ActiveEffect", [
        expect.objectContaining({
          name: "OSE.effect.new",
          img: "icons/svg/aura.svg",
          origin: actor.uuid,
          disabled: false,
          duration: { rounds: 1 },
        }),
      ]);
    });

    it("creates inactive ActiveEffect with disabled: true and empty duration", async () => {
      const target = {
        dataset: { effectType: "inactive" },
      };

      await OseActorSheet._onCreateEffect.call(mockSheet, {} as any, target as any);

      expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith("ActiveEffect", [
        expect.objectContaining({
          disabled: true,
          duration: {},
        }),
      ]);
    });

    it("edits ActiveEffect by rendering its sheet", () => {
      const effect = createMockEffect("eff-edit", "Strength");
      const target = {
        dataset: { effectId: "eff-edit" },
        closest: vi.fn(),
      };

      OseActorSheet._onEditEffect.call(mockSheet, {} as any, target as any);

      expect(effect.sheet.render).toHaveBeenCalledWith({ force: true });
    });

    it("deletes ActiveEffect", async () => {
      const effect = createMockEffect("eff-del", "Weakness");
      const target = {
        dataset: { effectId: "eff-del" },
        closest: vi.fn(),
      };

      await OseActorSheet._onDeleteEffect.call(mockSheet, {} as any, target as any);

      expect(effect.delete).toHaveBeenCalled();
    });

    it("toggles ActiveEffect disabled state", async () => {
      const effect = createMockEffect("eff-toggle", "Shield", { disabled: false });
      const target = {
        dataset: { effectId: "eff-toggle" },
        closest: vi.fn(),
      };

      await OseActorSheet._onToggleEffect.call(mockSheet, {} as any, target as any);

      expect(effect.update).toHaveBeenCalledWith({ disabled: true });
    });

    it("opens source item sheet for item-granted effect", () => {
      const item = createMockItemWithEffects("item-src", "Holy Avenger");
      const target = {
        dataset: { itemId: "item-src" },
        closest: vi.fn(),
      };

      OseActorSheet._onOpenEffectSource.call(mockSheet, {} as any, target as any);

      expect(item.sheet.render).toHaveBeenCalledWith({ force: true });
    });

    it("creates passive ActiveEffect with disabled: false and empty duration", async () => {
      const target = {
        dataset: { effectType: "passive" },
      };

      await OseActorSheet._onCreateEffect.call(mockSheet, {} as any, target as any);

      expect(actor.createEmbeddedDocuments).toHaveBeenCalledWith("ActiveEffect", [
        expect.objectContaining({
          disabled: false,
          duration: {},
        }),
      ]);
    });

    it("safely handles non-existent effect or item IDs as no-ops", async () => {
      const missingTarget = {
        dataset: { effectId: "non-existent" },
      };

      expect(() => OseActorSheet._onEditEffect.call(mockSheet, {} as any, missingTarget as any)).not.toThrow();
      await expect(
        OseActorSheet._onDeleteEffect.call(mockSheet, {} as any, missingTarget as any),
      ).resolves.not.toThrow();
      await expect(
        OseActorSheet._onToggleEffect.call(mockSheet, {} as any, missingTarget as any),
      ).resolves.not.toThrow();

      const missingItemTarget = {
        dataset: { itemId: "non-existent" },
      };
      expect(() =>
        OseActorSheet._onOpenEffectSource.call(mockSheet, {} as any, missingItemTarget as any),
      ).not.toThrow();
    });

    it("does not execute mutations if sheet is not editable", async () => {
      mockSheet.isEditable = false;
      const target = { dataset: { effectType: "temporary" } };

      await OseActorSheet._onCreateEffect.call(mockSheet, {} as any, target as any);
      expect(actor.createEmbeddedDocuments).not.toHaveBeenCalled();
    });
  });

  describe("Active Effect Drag-and-Drop (onDragStartItem)", () => {
    it("handles effect dragging without throwing TypeError and serializes drag data", () => {
      createMockEffect("eff-drag", "Invisibility");
      const li = {
        dataset: { effectId: "eff-drag" },
      };

      let serializedData: string | null = null;
      const mockEvent: any = {
        currentTarget: li,
        target: { classList: { contains: () => false } },
        dataTransfer: {
          setData: (_type: string, val: string) => {
            serializedData = val;
          },
        },
      };

      const sheet = { actor };
      expect(() => onDragStartItem(sheet, mockEvent)).not.toThrow();

      expect(serializedData).not.toBeNull();
      const parsed = JSON.parse(serializedData ?? "{}");
      expect(parsed.type).toBe("ActiveEffect");
      expect(parsed.actorId).toBe(actor.id);
      expect(parsed.data.name).toBe("Invisibility");
    });

    it("returns early when li element has neither itemId nor effectId", () => {
      const li = { dataset: {} };
      const mockEvent: any = {
        currentTarget: li,
        target: { classList: { contains: () => false } },
        dataTransfer: { setData: vi.fn() },
      };
      const dragSheet = { actor };

      expect(() => onDragStartItem(dragSheet as any, mockEvent)).not.toThrow();
      expect(mockEvent.dataTransfer.setData).not.toHaveBeenCalled();
    });
  });

  describe("Sheet Tab Configuration & Visibility", () => {
    it("includes exactly one effects tab in Character sheet primary tabs and scrollable parts", () => {
      const characterTabs = OseActorSheetCharacter.TABS.primary.tabs;
      const effectsTabs = characterTabs.filter((t: any) => t.id === "effects");

      expect(effectsTabs).toHaveLength(1);
      expect(effectsTabs[0]?.label).toBe("OSE.category.effects");

      const scrollables = OseActorSheetCharacter.PARTS.sheet.scrollable;
      expect(scrollables).toContain('.tab[data-tab="abilities"] .resizable');
      expect(scrollables).toContain('.tab[data-tab="effects"] .resizable');
    });

    it("includes exactly one effects tab in Monster sheet primary tabs and scrollable parts", () => {
      const monsterTabs = OseActorSheetMonster.TABS.primary.tabs;
      const effectsTabs = monsterTabs.filter((t: any) => t.id === "effects");

      expect(effectsTabs).toHaveLength(1);
      expect(effectsTabs[0]?.label).toBe("OSE.category.effects");

      const scrollables = OseActorSheetMonster.PARTS.sheet.scrollable;
      expect(scrollables).toContain('.tab[data-tab="effects"] .resizable');
    });

    it("evaluates tab visibility for effects on Character and Monster sheets", () => {
      const charSheet = new OseActorSheetCharacter({ document: actor });
      // When actor is ownerOrObserver, effects tab is visible
      actor.isOwnerOrObserver = true;
      expect(charSheet._isTabVisible("effects")).toBe(true);

      // When actor is not ownerOrObserver, effects tab is hidden
      actor.isOwnerOrObserver = false;
      expect(charSheet._isTabVisible("effects")).toBe(false);

      const monsterSheet = new OseActorSheetMonster({ document: actor });
      actor.isOwnerOrObserver = true;
      expect(monsterSheet._isTabVisible("effects")).toBe(true);

      actor.isOwnerOrObserver = false;
      expect(monsterSheet._isTabVisible("effects")).toBe(false);
    });
  });
});
