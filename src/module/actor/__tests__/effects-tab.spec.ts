/**
 * @file Unit tests for Active Effects Tab, Data Preparation, Actions, and Layout.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prepareActiveEffectCategories, prepareActorContext } from "../../sheet/data-context";
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
      name,
      img: options.img || "icons/svg/aura.svg",
      disabled: Boolean(options.disabled),
      isTemporary: Boolean(options.isTemporary),
      transfer: options.transfer ?? true,
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
    effectsMap.set(id, effect);
    return effect;
  };

  const createMockItemWithEffects = (id: string, name: string, effects: any[] = [], system: any = {}) => {
    const item: any = {
      _id: id,
      id,
      name,
      system: {
        ...system,
      },
      effects,
      sheet: {
        render: vi.fn(),
      },
      prepareDerivedData: vi.fn().mockResolvedValue(undefined),
    };
    itemsMap.set(id, item);
    return item;
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    effectsMap = new Map();
    itemsMap = new Map();

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
      createEmbeddedDocuments: vi.fn().mockImplementation(async (type: string, data: any[]) => {
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
      },
    };
  });

  describe("prepareActiveEffectCategories", () => {
    it("groups temporary, passive, and inactive effects correctly", () => {
      createMockEffect("eff-1", "Bless", { isTemporary: true, disabled: false });
      createMockEffect("eff-2", "Barkskin", { isTemporary: false, disabled: false });
      createMockEffect("eff-3", "Curse", { isTemporary: true, disabled: true });
      createMockEffect("eff-4", "Sleeping Aura", { isTemporary: false, disabled: true });

      const categories = prepareActiveEffectCategories(actor);

      expect(categories.temporary.effects.map((e: any) => e.name)).toEqual(["Bless"]);
      expect(categories.passive.effects.map((e: any) => e.name)).toEqual(["Barkskin"]);
      expect(categories.inactive.effects.map((e: any) => e.name)).toEqual(["Curse", "Sleeping Aura"]);
      expect(categories.managed).toBeUndefined();
    });

    it("aggregates item-granted effects and marks unequipped items as suppressed", () => {
      const ringEffect = {
        id: "eff-ring",
        name: "Ring of Protection +1",
        img: "icons/equipment/finger/ring-gem-gold-red.webp",
        transfer: true,
      };
      const cloakEffect = {
        id: "eff-cloak",
        name: "Cloak of Elvenkind",
        img: "icons/equipment/back/cloak-hooded-green.webp",
        transfer: true,
      };
      const nonTransferredEffect = {
        id: "eff-scroll",
        name: "Scroll Spell Effect",
        transfer: false,
      };

      // Ring is equipped: suppressed = false
      createMockItemWithEffects("item-ring", "Ring of Protection", [ringEffect], { equipped: true });
      // Cloak is unequipped: suppressed = true
      createMockItemWithEffects("item-cloak", "Cloak of Elvenkind", [cloakEffect], { equipped: false });
      // Item with non-transferred effect: should NOT appear in managed
      createMockItemWithEffects("item-scroll", "Magic Scroll", [nonTransferredEffect]);

      const categories = prepareActiveEffectCategories(actor);

      expect(categories.managed).toBeDefined();
      expect(categories.managed.readonly).toBe(true);
      expect(categories.managed.label).toBe("OSE.effect.fromItems");
      expect(categories.managed.effects).toHaveLength(2);

      const ringEntry = categories.managed.effects.find((e: any) => e.id === "eff-ring");
      expect(ringEntry).toBeDefined();
      expect(ringEntry.itemId).toBe("item-ring");
      expect(ringEntry.itemName).toBe("Ring of Protection");
      expect(ringEntry.suppressed).toBe(false);

      const cloakEntry = categories.managed.effects.find((e: any) => e.id === "eff-cloak");
      expect(cloakEntry).toBeDefined();
      expect(cloakEntry.itemId).toBe("item-cloak");
      expect(cloakEntry.itemName).toBe("Cloak of Elvenkind");
      expect(cloakEntry.suppressed).toBe(true);
    });

    it("handles items without equipped property without suppressing", () => {
      const stoneEffect = { id: "eff-stone", name: "Ioun Stone", transfer: true };
      createMockItemWithEffects("item-stone", "Ioun Stone", [stoneEffect], {});

      const categories = prepareActiveEffectCategories(actor);
      expect(categories.managed.effects[0].suppressed).toBe(false);
    });

    it("handles actor with null or empty collections gracefully", () => {
      const bareActor = { effects: null, items: null };
      const categories = prepareActiveEffectCategories(bareActor as any);
      expect(categories.temporary.effects).toEqual([]);
      expect(categories.passive.effects).toEqual([]);
      expect(categories.inactive.effects).toEqual([]);
      expect(categories.managed).toBeUndefined();
    });
  });

  describe("prepareActorContext", () => {
    it("includes prepared effects in the sheet data context", async () => {
      createMockEffect("eff-1", "Haste", { isTemporary: true, disabled: false });
      const expandedSet = new Set<string>();

      const context = await prepareActorContext(actor, expandedSet);

      expect(context.effects).toBeDefined();
      expect(context.effects.temporary.effects).toHaveLength(1);
      expect(context.effects.temporary.effects[0].name).toBe("Haste");
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

      expect(effect.sheet.render).toHaveBeenCalledWith(true);
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

      expect(item.sheet.render).toHaveBeenCalledWith(true);
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
      const effect = createMockEffect("eff-drag", "Invisibility");
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
      const parsed = JSON.parse(serializedData!);
      expect(parsed.type).toBe("ActiveEffect");
      expect(parsed.actorId).toBe(actor.id);
      expect(parsed.data.name).toBe("Invisibility");
    });
  });

  describe("Sheet Tab Configuration & Visibility", () => {
    it("includes effects tab in Character sheet primary tabs and scrollable parts", () => {
      const characterTabs = OseActorSheetCharacter.TABS.primary.tabs;
      const effectsTab = characterTabs.find((t: any) => t.id === "effects");

      expect(effectsTab).toBeDefined();
      expect(effectsTab?.label).toBe("OSE.category.effects");

      const scrollables = OseActorSheetCharacter.PARTS.sheet.scrollable;
      expect(scrollables).toContain('.tab[data-tab="effects"] .resizable');
    });

    it("includes effects tab in Monster sheet primary tabs and scrollable parts", () => {
      const monsterTabs = OseActorSheetMonster.TABS.primary.tabs;
      const effectsTab = monsterTabs.find((t: any) => t.id === "effects");

      expect(effectsTab).toBeDefined();
      expect(effectsTab?.label).toBe("OSE.category.effects");

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
