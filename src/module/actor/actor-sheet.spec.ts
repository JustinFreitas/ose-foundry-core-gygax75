import { beforeEach, describe, expect, it, vi } from "vitest";
import OseActorSheet from "./actor-sheet";

describe("OseActorSheet Container Drag and Drop", () => {
  let actor: any;
  let sheet: any;
  let itemsMap: Map<string, any>;

  beforeEach(() => {
    // Setup foundry appv1 mocks if not present
    if (!foundry.appv1) {
      (foundry as any).appv1 = {
        sheets: {
          ActorSheet: class {
            actor: any;
            options: any = { editable: true };
            constructor(actor: any) {
              this.actor = actor;
            }
            async getData() {
              return { data: this.actor.system };
            }
            _onSortItem(_event: any, _itemData: any) {
              return "sorted";
            }
            async _onDropItem(_event: any, _data: any) {
              return "dropped";
            }
          },
        },
      };
    }

    itemsMap = new Map();

    actor = {
      id: "actor-1",
      name: "Test Character",
      type: "character",
      system: {},
      items: {
        get: (id: string) => itemsMap.get(id),
        find: (fn: any) => Array.from(itemsMap.values()).find(fn),
        filter: (fn: any) => Array.from(itemsMap.values()).filter(fn),
        [Symbol.iterator]: () => itemsMap.values(),
      },
      updateEmbeddedDocuments: vi.fn().mockImplementation(async (_embeddedName: string, updates: any[]) => {
        for (const update of updates) {
          const item = itemsMap.get(update._id);
          if (item) {
            if (update["system.containerId"] !== undefined) {
              item.system.containerId = update["system.containerId"];
            }
            if (update["system.equipped"] !== undefined) {
              item.system.equipped = update["system.equipped"];
            }
            if (update["system.itemIds"] !== undefined) {
              item.system.itemIds = update["system.itemIds"];
            }
            if (update.system?.itemIds !== undefined) {
              item.system.itemIds = update.system.itemIds;
            }
            if (update.system?.containerId !== undefined) {
              item.system.containerId = update.system.containerId;
            }
          }
        }
        return updates;
      }),
      createEmbeddedDocuments: vi.fn().mockImplementation(async (_embeddedName: string, data: any[]) => {
        return data.map((d) => {
          const created = {
            id: d._id || `created-${Math.random().toString(36).substring(2, 7)}`,
            ...d,
            update: vi.fn().mockImplementation(async (up: any) => {
              Object.assign(created.system, up.system || up);
              return created;
            }),
          };
          itemsMap.set(created.id, created);
          return created;
        });
      }),
    };

    sheet = new OseActorSheet(actor);
  });

  const createMockItem = (id: string, name: string, type: string, system: any = {}) => {
    const item = {
      id,
      _id: id,
      name,
      type,
      system: {
        containerId: "",
        itemIds: [],
        equipped: false,
        ...system,
      },
      actor,
      toObject: () => ({
        _id: id,
        id,
        name,
        type,
        system: { ...item.system },
      }),
      update: vi.fn().mockImplementation(async (data: any) => {
        if (data.system) {
          Object.assign(item.system, data.system);
        } else {
          for (const key of Object.keys(data)) {
            if (key.startsWith("system.")) {
              const subKey = key.replace("system.", "");
              item.system[subKey] = data[key];
            }
          }
        }
        return item;
      }),
    };
    itemsMap.set(id, item);
    return item;
  };

  it("identifies target container when dropped on container item row", () => {
    createMockItem("bag-1", "Backpack", "container", { itemIds: [] });

    const mockEvent = {
      target: {
        closest: (selector: string) => {
          if (selector === "[data-item-id]") return { dataset: { itemId: "bag-1" } };
          if (selector === ".container") return { dataset: { itemId: "bag-1" } };
          return null;
        },
      },
    } as any;

    const targetContainer = sheet._getTargetContainer(mockEvent);
    expect(targetContainer).not.toBeNull();
    expect(targetContainer.id).toBe("bag-1");
  });

  it("identifies target container when dropped on a child item inside the container", () => {
    createMockItem("bag-1", "Backpack", "container", { itemIds: ["torch-1"] });
    createMockItem("torch-1", "Torch", "item", { containerId: "bag-1" });

    const mockEvent = {
      target: {
        closest: (selector: string) => {
          if (selector === "[data-item-id]") return { dataset: { itemId: "torch-1" } };
          if (selector === ".container") return { dataset: { itemId: "bag-1" } };
          return null;
        },
      },
    } as any;

    const targetContainer = sheet._getTargetContainer(mockEvent);
    expect(targetContainer).not.toBeNull();
    expect(targetContainer.id).toBe("bag-1");
  });

  it("atomically transfers an item from Container A to Container B", async () => {
    const bagA = createMockItem("bag-a", "Backpack", "container", { itemIds: ["sword-1"] });
    const bagB = createMockItem("bag-b", "Sack", "container", { itemIds: [] });
    const sword = createMockItem("sword-1", "Shortsword", "weapon", { containerId: "bag-a", equipped: false });

    await sheet._transferItemBetweenContainers(sword, bagA, bagB);

    expect(actor.updateEmbeddedDocuments).toHaveBeenCalledTimes(1);
    expect(bagA.system.itemIds).toEqual([]);
    expect(bagB.system.itemIds).toEqual(["sword-1"]);
    expect(sword.system.containerId).toBe("bag-b");
    expect(sword.system.equipped).toBe(false);
  });

  it("moves an item from Container A to Container B via _onDropItem", async () => {
    const bagA = createMockItem("bag-a", "Backpack", "container", { itemIds: ["potion-1"] });
    const bagB = createMockItem("bag-b", "Sack", "container", { itemIds: [] });
    const potion = createMockItem("potion-1", "Healing Potion", "item", { containerId: "bag-a" });

    // Mock Item.implementation.fromDropData
    (global as any).Item.implementation = {
      fromDropData: vi.fn().mockResolvedValue(potion),
    };

    const mockEvent = {
      target: {
        closest: (selector: string) => {
          if (selector === "[data-item-id]") return { dataset: { itemId: "bag-b" } };
          if (selector === ".container") return { dataset: { itemId: "bag-b" } };
          return null;
        },
      },
    } as any;

    await sheet._onDropItem(mockEvent, { type: "Item", uuid: "Item.potion-1" });

    expect(bagA.system.itemIds).toEqual([]);
    expect(bagB.system.itemIds).toEqual(["potion-1"]);
    expect(potion.system.containerId).toBe("bag-b");
  });

  it("removes an item from container to root inventory when dropped outside any container", async () => {
    const bagA = createMockItem("bag-a", "Backpack", "container", { itemIds: ["potion-1"] });
    const potion = createMockItem("potion-1", "Healing Potion", "item", { containerId: "bag-a" });

    (global as any).Item.implementation = {
      fromDropData: vi.fn().mockResolvedValue(potion),
    };

    // Dropped on empty root area (no container in hierarchy)
    const mockEvent = {
      target: {
        closest: (_selector: string) => null,
      },
    } as any;

    await sheet._onDropItem(mockEvent, { type: "Item", uuid: "Item.potion-1" });

    expect(bagA.system.itemIds).toEqual([]);
    expect(potion.system.containerId).toBe("");
  });

  it("warns and blocks dragging a container into another container", async () => {
    const bagA = createMockItem("bag-a", "Small Sack", "container", { itemIds: [] });
    const bagB = createMockItem("bag-b", "Large Chest", "container", { itemIds: [] });

    (global as any).Item.implementation = {
      fromDropData: vi.fn().mockResolvedValue(bagA),
    };

    const warnSpy = vi.spyOn(ui.notifications, "warn").mockImplementation(() => {});

    const mockEvent = {
      target: {
        closest: (selector: string) => {
          if (selector === "[data-item-id]") return { dataset: { itemId: "bag-b" } };
          if (selector === ".container") return { dataset: { itemId: "bag-b" } };
          return null;
        },
      },
    } as any;

    await sheet._onDropItem(mockEvent, { type: "Item", uuid: "Item.bag-a" });

    expect(warnSpy).toHaveBeenCalled();
    expect(bagB.system.itemIds).toEqual([]);
    expect(bagA.system.containerId).toBe("");
    warnSpy.mockRestore();
  });

  it("does not mutate or remove an item when dropped within the same container", async () => {
    const bagA = createMockItem("bag-a", "Backpack", "container", { itemIds: ["gem-1"] });
    const gem = createMockItem("gem-1", "Ruby", "item", { containerId: "bag-a" });

    (global as any).Item.implementation = {
      fromDropData: vi.fn().mockResolvedValue(gem),
    };

    const mockEvent = {
      target: {
        closest: (selector: string) => {
          if (selector === "[data-item-id]") return { dataset: { itemId: "bag-a" } };
          if (selector === ".container") return { dataset: { itemId: "bag-a" } };
          return null;
        },
      },
    } as any;

    await sheet._onDropItem(mockEvent, { type: "Item", uuid: "Item.gem-1" });

    expect(actor.updateEmbeddedDocuments).not.toHaveBeenCalled();
    expect(bagA.system.itemIds).toEqual(["gem-1"]);
    expect(gem.system.containerId).toBe("bag-a");
  });

  it("guarantees zero phantom items across multiple container operations", async () => {
    const bag1 = createMockItem("bag-1", "Bag 1", "container", { itemIds: [] });
    const bag2 = createMockItem("bag-2", "Bag 2", "container", { itemIds: [] });
    const ring = createMockItem("ring-1", "Ring", "item", { containerId: "" });

    (global as any).Item.implementation = {
      fromDropData: vi.fn().mockImplementation((data: any) => itemsMap.get(data.id)),
    };

    // 1. Drop ring into Bag 1
    let mockEvent = {
      target: {
        closest: (selector: string) => (selector === "[data-item-id]" ? { dataset: { itemId: "bag-1" } } : null),
      },
    } as any;
    await sheet._onDropItem(mockEvent, { type: "Item", id: "ring-1" });

    // 2. Transfer ring from Bag 1 to Bag 2
    mockEvent = {
      target: {
        closest: (selector: string) => (selector === "[data-item-id]" ? { dataset: { itemId: "bag-2" } } : null),
      },
    } as any;
    await sheet._onDropItem(mockEvent, { type: "Item", id: "ring-1" });

    // 3. Drop ring to Root
    mockEvent = {
      target: {
        closest: (_s: string) => null,
      },
    } as any;
    await sheet._onDropItem(mockEvent, { type: "Item", id: "ring-1" });

    // Verify Invariant: No item points to a container that doesn't exist
    const phantoms = Array.from(itemsMap.values()).filter(
      (i) => i.system.containerId !== "" && !itemsMap.has(i.system.containerId),
    );
    expect(phantoms.length).toBe(0);
    expect(bag1.system.itemIds.length).toBe(0);
    expect(bag2.system.itemIds.length).toBe(0);
    expect(ring.system.containerId).toBe("");
  });
});
