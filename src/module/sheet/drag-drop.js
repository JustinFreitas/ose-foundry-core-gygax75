/**
 * @file Shared drag-and-drop handlers used by actor sheets.
 */

export const onDragStartItem = (sheet, event) => {
  const li = event.currentTarget;
  if (event.target.classList.contains("content-link")) return;

  let dragData;
  let itemIdsArray = [];

  if (li.dataset.itemId) {
    const item = sheet.actor.items.get(li.dataset.itemId);
    dragData = item.toDragData();
    dragData.item = item;
    dragData.type = "Item";
    if (item.type === "container" && item.system.itemIds.length > 0) {
      itemIdsArray = item.system.itemIds;
    }
  }

  dragData.actorId = sheet.actor.id;
  dragData.sceneId = sheet.actor.isToken ? canvas.scene?.id : null;
  dragData.tokenId = sheet.actor.isToken ? sheet.actor.token.id : null;
  dragData.pack = sheet.actor.pack;

  if (li.dataset.effectId) {
    const effect = sheet.actor.effects.get(li.dataset.effectId);
    dragData.type = "ActiveEffect";
    dragData.data = effect.data;
  }

  event.dataTransfer.setData(
    "text/plain",
    JSON.stringify(dragData, (key, value) => {
      if (key === "itemIds") return JSON.stringify(itemIdsArray);
      return value;
    }),
  );
};

export const onDropFolder = async (sheet, _event, folder) => {
  if (!folder || folder.type !== "Item") return;

  let itemArray = folder.contents || [];
  folder.getSubfolders(true).forEach((subfolder) => {
    itemArray.push(...subfolder.contents);
  });

  if (itemArray.length > 0 && itemArray[0]?.uuid?.includes("Compendium")) {
    const items = [];
    itemArray.forEach(async (item) => {
      items.push(await fromUuid(item.uuid));
    });
    itemArray = items;
  }
  return onDropItemCreate(sheet, itemArray);
};

/**
 * Determine the target container document for a drop event, if one is targeted.
 *
 * @param {OseActorSheet} sheet - The actor sheet receiving the drop.
 * @param {DragEvent} event - The drop event.
 * @returns {Item|null} The targeted container Item document, or null if none.
 */
export const getTargetContainer = (sheet, event) => {
  const dropTargetItem = event?.target?.closest?.("[data-item-id]");
  const targetId = dropTargetItem ? dropTargetItem.dataset.itemId : null;
  const targetDoc = targetId ? sheet.actor.items.get(targetId) : null;

  if (targetDoc?.type === "container") return targetDoc;
  if (targetDoc?.system?.containerId) {
    return sheet.actor.items.get(targetDoc.system.containerId) || null;
  }
  const containerEl = event?.target?.closest?.(".container");
  if (containerEl?.dataset?.itemId) {
    return sheet.actor.items.get(containerEl.dataset.itemId) || null;
  }
  return null;
};

/**
 * Atomically transfer an item between containers, or into a container.
 *
 * @param {OseActorSheet} sheet - The actor sheet receiving the drop.
 * @param {Item} item - The item being moved.
 * @param {Item|null} sourceContainer - The container the item currently belongs to (if any).
 * @param {Item} targetContainer - The container the item is being moved into.
 * @returns {Promise<Document[]>}
 */
export const transferItemBetweenContainers = async (sheet, item, sourceContainer, targetContainer) => {
  const updates = [];

  if (sourceContainer && sourceContainer.id !== targetContainer.id) {
    const newSourceList = sourceContainer.system.itemIds.filter((id) => id !== item.id);
    updates.push({ _id: sourceContainer.id, "system.itemIds": newSourceList });
  }

  const alreadyExists = targetContainer.system.itemIds.includes(item.id);
  if (!alreadyExists) {
    const newTargetList = [...targetContainer.system.itemIds, item.id];
    updates.push({ _id: targetContainer.id, "system.itemIds": newTargetList });
  }

  updates.push({
    _id: item.id,
    "system.containerId": targetContainer.id,
    "system.equipped": false,
  });

  return sheet.actor.updateEmbeddedDocuments("Item", updates);
};

export const onDropItem = async (sheet, event, item) => {
  let resolvedItem = item;
  if (!resolvedItem?.system && resolvedItem) {
    if (globalThis.Item?.implementation?.fromDropData) {
      try {
        const fromDrop = await globalThis.Item.implementation.fromDropData(resolvedItem);
        if (fromDrop) resolvedItem = fromDrop;
      } catch (_e) {
        // Fall back to actor item if available
      }
    }
    if (!resolvedItem?.system && (resolvedItem?.id || resolvedItem?._id)) {
      resolvedItem = sheet.actor.items.get(resolvedItem.id || resolvedItem._id) || resolvedItem;
    }
  }

  const targetContainer = getTargetContainer(sheet, event);
  const dropTargetEl = event?.target?.closest?.("[data-item-id]");
  const targetId = dropTargetEl ? dropTargetEl.dataset.itemId : null;

  const itemData = typeof resolvedItem.toObject === "function" ? resolvedItem.toObject() : resolvedItem;
  const itemId = resolvedItem.id || resolvedItem._id;
  const isOwned = !!sheet.actor.items.get(itemId);
  const sourceContainer = resolvedItem.system?.containerId
    ? sheet.actor.items.get(resolvedItem.system.containerId)
    : null;

  // Dragging container onto itself
  if (itemId === targetId || (targetContainer && itemId === targetContainer.id)) return;

  // Prevent nesting containers
  if (resolvedItem.type === "container" && targetContainer) {
    return ui.notifications.warn(game.i18n.localize("OSE.warn.noNestedContainers") || "You cannot nest containers.");
  }

  // Branch A: Drop target is a Container (or inside a container)
  if (targetContainer) {
    if (!isOwned) {
      const result = await onContainerItemAdd(sheet, resolvedItem, targetContainer);
      if (resolvedItem.actor && resolvedItem.actor.id !== sheet.actor.id && !event?.ctrlKey) {
        await resolvedItem.delete?.();
      }
      return result;
    }

    // Owned item dropped within same container: no-op / allow standard sort
    if (sourceContainer?.id === targetContainer.id) {
      if (resolvedItem.parent?.uuid === sheet.actor.uuid) return sheet._onSortItem?.(event, resolvedItem);
      return;
    }

    // Owned item moved from another container or root inventory into targetContainer
    return transferItemBetweenContainers(sheet, resolvedItem, sourceContainer, targetContainer);
  }

  // Branch B: Drop target is Root Inventory (outside any container)
  if (sourceContainer) {
    return onContainerItemRemove(sheet, resolvedItem, sourceContainer);
  }

  if (!isOwned) {
    const result = await onDropItemCreate(sheet, [itemData]);
    if (resolvedItem.actor && resolvedItem.actor.id !== sheet.actor.id && !event?.ctrlKey) {
      await resolvedItem.delete?.();
    }
    return result;
  }

  if (resolvedItem.parent?.uuid === sheet.actor.uuid) return sheet._onSortItem?.(event, resolvedItem);
};

export const onContainerItemRemove = async (sheet, item, container) => {
  const newList = container.system.itemIds.filter((s) => s !== item.id);
  const itemObj = sheet.actor.items.get(item.id);
  return sheet.actor.updateEmbeddedDocuments("Item", [
    { _id: container.id, "system.itemIds": newList },
    { _id: itemObj ? itemObj.id : item.id, "system.containerId": "" },
  ]);
};

export const onContainerItemAdd = async (sheet, item, target) => {
  const alreadyExistsInActor = target.parent?.items?.get
    ? target.parent.items.get(item.id)
    : target.parent?.items?.find?.((i) => i.id === item.id);
  let latestItem = item;
  if (!alreadyExistsInActor) {
    const newItem = await onDropItemCreate(sheet, [item.toObject ? item.toObject() : item]);
    latestItem = Array.isArray(newItem) ? newItem[newItem.length - 1] : newItem;
  }

  const alreadyExistsInContainer = target.system.itemIds.includes(latestItem.id);
  if (!alreadyExistsInContainer) {
    const newList = [...target.system.itemIds, latestItem.id];
    await target.update({ "system.itemIds": newList });
    await latestItem.update({ "system.containerId": target.id, "system.equipped": false });
  }
  return [latestItem];
};

export const onDropItemCreate = async (sheet, droppedItem, targetContainer = false) => {
  const droppedItemArray = Array.isArray(droppedItem) ? droppedItem : [droppedItem];
  droppedItemArray.forEach((item) => {
    if (item.system.containerId && item.system.containerId !== "") item.system.containerId = "";
    if (item.type === "container" && typeof item.system.itemIds === "string") {
      const containedItems = JSON.parse(item.system.itemIds);
      containedItems.forEach((containedItem) => {
        containedItem.system.containerId = "";
      });
      droppedItem.push(...containedItems);
    }
  });
  if (!targetContainer) {
    return sheet.actor.createEmbeddedDocuments("Item", droppedItem);
  }
  const { itemIds } = targetContainer.system;
  itemIds.push(droppedItem.id);
  const item = sheet.actor.items.get(droppedItem[0].id);
  await targetContainer.update({ system: { itemIds } });
  return item.update({ system: { containerId: targetContainer.id } });
};
