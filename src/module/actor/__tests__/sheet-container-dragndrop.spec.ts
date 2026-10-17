/**
 * @file Unit tests for Container-to-Container Drag & Drop on Actor Sheets.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getTargetContainer,
  onContainerItemAdd,
  onContainerItemRemove,
  onDropItem,
  transferItemBetweenContainers,
} from "../../sheet/drag-drop";
import OseActorSheet from "../actor-sheet";

describe("Container-to-Container Drag and Drop", () => {
  let actor: any;
  let sheet: any;
  let itemsMap: Map<string, any>;

  const createMockItem = (id: string, name: string, type: string, system: any = {}) => {
    const item: any = {
      _id: id,
      id,
      name,
      type,
      system: {
        containerId: "",
        itemIds: [],
        equipped: false,
        ...system,
      },
      actor,
      parent: actor,
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
            } else {
              item[key] = data[key];
            }
          }
        }
        return item;
      }),
    };
    itemsMap.set(id, item);
    return item;
  };

  beforeEach(() => {
    itemsMap = new Map();
    actor = {
      id: "actor-1",
      uuid: "Actor.actor-1",
      name: "Valerius",
      isOwner: true,
      items: {
        get: (id: string) => itemsMap.get(id) || null,
        find: (fn: (item: any) => boolean) => Array.from(itemsMap.values()).find(fn) || null,
        contents: Array.from(itemsMap.values()),
        size: itemsMap.size,
      },
      createEmbeddedDocuments: vi.fn().mockImplementation(async (_type: string, dataArray: any[]) => {
        return dataArray.map((d: any) =>
          createMockItem(d._id || d.id || `gen-${Math.random()}`, d.name, d.type, d.system),
        );
      }),
      updateEmbeddedDocuments: vi.fn().mockImplementation(async (_type: string, updates: any[]) => {
        for (const update of updates) {
          const item = itemsMap.get(update._id);
          if (item) {
            for (const key of Object.keys(update)) {
              if (key === "_id") continue;
              if (key.startsWith("system.")) {
                const subKey = key.replace("system.", "");
                item.system[subKey] = update[key];
              } else if (key === "system") {
                Object.assign(item.system, update.system);
              } else {
                item[key] = update[key];
              }
            }
          }
        }
        return updates;
      }),
    };

    sheet = new OseActorSheet({ document: actor });
    (sheet as any).actor = actor;

    (globalThis as any).Item = {
      implementation: {
        fromDropData: vi.fn().mockImplementation(async (data: any) => {
          if (data.id) return itemsMap.get(data.id) || null;
          if (data.uuid) {
            const id = data.uuid.split(".").pop();
            return itemsMap.get(id) || null;
          }
          return null;
        }),
      },
    };
  });

  describe("getTargetContainer", () => {
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

      const target = sheet._getTargetContainer(mockEvent);
      expect(target).not.toBeNull();
      expect(target.id).toBe("bag-1");
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

      const target = sheet._getTargetContainer(mockEvent);
      expect(target).not.toBeNull();
      expect(target.id).toBe("bag-1");
    });

    it("returns null when dropped outside any container", () => {
      const mockEvent = {
        target: {
          closest: (_selector: string) => null,
        },
      } as any;

      const target = sheet._getTargetContainer(mockEvent);
      expect(target).toBeNull();
    });
  });

  describe("transferItemBetweenContainers", () => {
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

    it("atomically transfers an item from Root into Container B", async () => {
      const bagB = createMockItem("bag-b", "Sack", "container", { itemIds: [] });
      const potion = createMockItem("potion-1", "Potion", "item", { containerId: "", equipped: false });

      await sheet._transferItemBetweenContainers(potion, null, bagB);

      expect(actor.updateEmbeddedDocuments).toHaveBeenCalledTimes(1);
      expect(bagB.system.itemIds).toEqual(["potion-1"]);
      expect(potion.system.containerId).toBe("bag-b");
    });
  });

  describe("onDropItem handling", () => {
    it("moves an item from Container A to Container B via _onDropItem", async () => {
      const bagA = createMockItem("bag-a", "Backpack", "container", { itemIds: ["potion-1"] });
      const bagB = createMockItem("bag-b", "Sack", "container", { itemIds: [] });
      const potion = createMockItem("potion-1", "Healing Potion", "item", { containerId: "bag-a" });

      const mockEvent = {
        target: {
          closest: (selector: string) => {
            if (selector === "[data-item-id]") return { dataset: { itemId: "bag-b" } };
            return null;
          },
        },
      } as any;

      await sheet._onDropItem(mockEvent, potion);

      expect(bagA.system.itemIds).toEqual([]);
      expect(bagB.system.itemIds).toEqual(["potion-1"]);
      expect(potion.system.containerId).toBe("bag-b");
    });

    it("removes an item from container to root inventory when dropped outside any container", async () => {
      const bagA = createMockItem("bag-a", "Backpack", "container", { itemIds: ["potion-1"] });
      const potion = createMockItem("potion-1", "Healing Potion", "item", { containerId: "bag-a" });

      const mockEvent = {
        target: {
          closest: (_selector: string) => null,
        },
      } as any;

      await sheet._onDropItem(mockEvent, potion);

      expect(bagA.system.itemIds).toEqual([]);
      expect(potion.system.containerId).toBe("");
    });

    it("warns and blocks dragging a container into another container", async () => {
      const bagA = createMockItem("bag-a", "Small Sack", "container", { itemIds: [] });
      const bagB = createMockItem("bag-b", "Large Chest", "container", { itemIds: [] });

      const warnSpy = vi.spyOn((globalThis as any).ui.notifications, "warn").mockImplementation(() => {});

      const mockEvent = {
        target: {
          closest: (selector: string) => {
            if (selector === "[data-item-id]") return { dataset: { itemId: "bag-b" } };
            return null;
          },
        },
      } as any;

      await sheet._onDropItem(mockEvent, bagA);

      expect(warnSpy).toHaveBeenCalled();
      expect(bagB.system.itemIds).toEqual([]);
      expect(bagA.system.containerId).toBe("");
    });

    it("does not mutate or remove an item when dropped within the same container", async () => {
      const bagA = createMockItem("bag-a", "Backpack", "container", { itemIds: ["gem-1"] });
      const gem = createMockItem("gem-1", "Ruby", "item", { containerId: "bag-a" });

      const mockEvent = {
        target: {
          closest: (selector: string) => {
            if (selector === "[data-item-id]") return { dataset: { itemId: "bag-a" } };
            return null;
          },
        },
      } as any;

      await sheet._onDropItem(mockEvent, gem);

      expect(actor.updateEmbeddedDocuments).not.toHaveBeenCalled();
      expect(bagA.system.itemIds).toEqual(["gem-1"]);
      expect(gem.system.containerId).toBe("bag-a");
    });

    it("guarantees zero phantom items across sequential container operations", async () => {
      const bag1 = createMockItem("bag-1", "Bag 1", "container", { itemIds: [] });
      const bag2 = createMockItem("bag-2", "Bag 2", "container", { itemIds: [] });
      const ring = createMockItem("ring-1", "Ring", "item", { containerId: "" });

      // 1. Drop ring into Bag 1
      let mockEvent = {
        target: {
          closest: (selector: string) => (selector === "[data-item-id]" ? { dataset: { itemId: "bag-1" } } : null),
        },
      } as any;
      await sheet._onDropItem(mockEvent, ring);

      expect(ring.system.containerId).toBe("bag-1");
      expect(bag1.system.itemIds).toEqual(["ring-1"]);

      // 2. Transfer ring from Bag 1 to Bag 2
      mockEvent = {
        target: {
          closest: (selector: string) => (selector === "[data-item-id]" ? { dataset: { itemId: "bag-2" } } : null),
        },
      } as any;
      await sheet._onDropItem(mockEvent, ring);

      expect(ring.system.containerId).toBe("bag-2");
      expect(bag1.system.itemIds).toEqual([]);
      expect(bag2.system.itemIds).toEqual(["ring-1"]);

      // 3. Drop ring to Root
      mockEvent = {
        target: {
          closest: (_s: string) => null,
        },
      } as any;
      await sheet._onDropItem(mockEvent, ring);

      expect(ring.system.containerId).toBe("");
      expect(bag1.system.itemIds).toEqual([]);
      expect(bag2.system.itemIds).toEqual([]);

      // Invariant: No item points to a container that doesn't exist or is invalid
      const phantoms = Array.from(itemsMap.values()).filter(
        (i) => i.system.containerId !== "" && !itemsMap.has(i.system.containerId),
      );
      expect(phantoms.length).toBe(0);
    });
  });
});
