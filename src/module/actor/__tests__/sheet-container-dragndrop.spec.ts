/**
 * @file Unit tests for Container-to-Container Drag & Drop on Actor Sheets.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
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

    it("copies a container and its stowed contents with fresh linked IDs on cross-actor drop", async () => {
      const sourceActor: any = {
        id: "actor-source",
        items: [],
      };
      const sourceTorch: any = {
        _id: "src-torch",
        id: "src-torch",
        name: "Torch",
        type: "item",
        parent: sourceActor,
        system: { containerId: "src-bag", itemIds: [] },
        toObject: () => ({
          _id: "src-torch",
          name: "Torch",
          type: "item",
          system: { containerId: "src-bag" },
        }),
      };
      const sourceBag: any = {
        _id: "src-bag",
        id: "src-bag",
        name: "Adventurer Pack",
        type: "container",
        parent: sourceActor,
        system: {
          containerId: "",
          itemIds: ["src-torch"],
          contents: [sourceTorch],
        },
        toObject: () => ({
          _id: "src-bag",
          name: "Adventurer Pack",
          type: "container",
          system: { containerId: "", itemIds: ["src-torch"] },
        }),
      };
      sourceActor.items = [sourceBag, sourceTorch];

      await sheet._onDropItemCreate(sourceBag, null);

      const createdBag = Array.from(itemsMap.values()).find((i) => i.type === "container");
      const createdTorch = Array.from(itemsMap.values()).find((i) => i.name === "Torch");

      expect(createdBag).toBeDefined();
      expect(createdTorch).toBeDefined();
      expect(createdBag.id).not.toBe("src-bag");
      expect(createdTorch.id).not.toBe("src-torch");
      expect(createdTorch.system.containerId).toBe(createdBag.id);
      expect(createdBag.system.itemIds).toEqual([createdTorch.id]);
    });

    it("treats items from a duplicated actor sharing IDs as foreign and cleans up source container", async () => {
      // Target actor happens to have an item with the same _id "shared-1"
      createMockItem("shared-1", "Local Ration", "item", { containerId: "" });

      const otherItems = new Map<string, any>();
      const otherActor: any = {
        id: "actor-2",
        items: {
          get: (id: string) => otherItems.get(id) || null,
        },
        updateEmbeddedDocuments: vi.fn().mockImplementation(async (_type: string, updates: any[]) => {
          for (const u of updates) {
            const target = otherItems.get(u._id);
            if (target && u["system.itemIds"]) target.system.itemIds = u["system.itemIds"];
          }
          return updates;
        }),
        deleteEmbeddedDocuments: vi.fn().mockResolvedValue([]),
      };
      const otherBag: any = {
        _id: "other-bag",
        id: "other-bag",
        name: "Other Bag",
        type: "container",
        parent: otherActor,
        system: { containerId: "", itemIds: ["shared-1"] },
        update: vi.fn().mockImplementation(async (d: any) => {
          otherBag.system.itemIds = d["system.itemIds"];
        }),
      };
      const foreignItem: any = {
        _id: "shared-1",
        id: "shared-1",
        name: "Foreign Gem",
        type: "item",
        actor: otherActor,
        parent: otherActor,
        system: { containerId: "other-bag", itemIds: [] },
        toObject: () => ({
          _id: "shared-1",
          name: "Foreign Gem",
          type: "item",
          system: { containerId: "other-bag" },
        }),
      };
      otherItems.set("other-bag", otherBag);
      otherItems.set("shared-1", foreignItem);
      (globalThis as any).Item.implementation.fromDropData = vi.fn().mockResolvedValue(foreignItem);

      const mockEvent = { target: { closest: () => null } } as any;
      await sheet._onDropItem(mockEvent, { uuid: "Actor.actor-2.Item.shared-1" });

      expect(otherBag.system.itemIds).toEqual([]);
      expect(otherActor.deleteEmbeddedDocuments).toHaveBeenCalledWith("Item", ["shared-1"]);
      expect(Array.from(itemsMap.values()).some((i) => i.name === "Foreign Gem")).toBe(true);
    });

    it("handles stale or missing containerId in _removeItemFromActor without throwing", async () => {
      actor.deleteEmbeddedDocuments = vi.fn().mockResolvedValue([]);
      const orphan = createMockItem("orphan-1", "Orphan Coin", "item", { containerId: "deleted-bag-id" });

      await expect(sheet._removeItemFromActor(orphan)).resolves.not.toThrow();
      expect(actor.deleteEmbeddedDocuments).toHaveBeenCalledWith("Item", ["orphan-1"]);
    });

    it("awaits async fromUuid resolution across folder contents in _onDropFolder", async () => {
      const folderDoc = {
        type: "Item",
        contents: [{ uuid: "Compendium.ose.items.Item.rope" }],
      };
      (globalThis as any).fromUuid = vi.fn().mockResolvedValue({
        name: "Hemp Rope",
        type: "item",
        system: {},
        toObject: () => ({ name: "Hemp Rope", type: "item", system: {} }),
      });

      const mockEvent = { target: { closest: () => null } } as any;
      await sheet._onDropFolder(mockEvent, folderDoc);

      expect((globalThis as any).fromUuid).toHaveBeenCalledWith("Compendium.ose.items.Item.rope");
      expect(Array.from(itemsMap.values()).some((i) => i.name === "Hemp Rope")).toBe(true);
    });
  });
});
