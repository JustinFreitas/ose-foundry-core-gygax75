/**
 * @file Shared drag-and-drop handlers used by actor sheets.
 */
import { rollsStartingHp } from "../classes/levels";
import { startingProgress } from "../classes/progression";
import OSE from "../config";

export const onDragStartItem = (sheet, event) => {
  const li = event.currentTarget;
  if (event.target.classList.contains("content-link")) return;

  let dragData;
  let itemIdsArray = [];

  if (li.dataset.itemId) {
    const item = sheet.actor.items.get(li.dataset.itemId);
    if (item) {
      dragData = item.toDragData();
      dragData.item = item;
      dragData.type = "Item";
      if (item.type === "container" && item.system?.itemIds?.length > 0) {
        itemIdsArray = item.system.itemIds;
      }
    }
  }

  if (li.dataset.effectId) {
    const effect = sheet.actor.effects.get(li.dataset.effectId);
    if (effect) {
      dragData =
        typeof effect.toDragData === "function" ? effect.toDragData() : { type: "ActiveEffect", uuid: effect.uuid };
      dragData.type = "ActiveEffect";
    }
  }

  if (!dragData) return;

  dragData.actorId = sheet.actor.id;
  dragData.sceneId = sheet.actor.isToken ? canvas.scene?.id : null;
  dragData.tokenId = sheet.actor.isToken ? sheet.actor.token.id : null;
  dragData.pack = sheet.actor.pack;

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

  const pool = event?.target?.closest?.("[data-spell-pool]")?.dataset.spellPool;
  if (isOwned && resolvedItem.type === "spell" && pool && pool !== resolvedItem.system.castAs) {
    return resolvedItem.update({ "system.castAs": pool });
  }

  // Dragging container onto itself
  if (itemId === targetId || (targetContainer && itemId === targetContainer.id)) return;

  if (!isOwned && resolvedItem.type === "class" && sheet.actor.type === "character") return onDropClass(sheet, itemData);
  if (!isOwned && resolvedItem.type === "race" && sheet.actor.type === "character") return onDropRace(sheet, itemData);

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

const esc = (s) => foundry.utils.escapeHTML(s);

// Without the multiple classes rule, a new class replaces the old one.
// Ask which level a new class starts at, and whether to roll HP and offer abilities.
const promptClassStart = async (itemData, rollHp) => {
  const { levels = [], maxLevel, titles = [] } = itemData.system;
  const count = Math.max(levels.length, maxLevel || 0);
  const content = await foundry.applications.handlebars.renderTemplate(
    `${OSE.systemPath()}/templates/actors/dialogs/class-start.html`,
    {
      options: Array.from({ length: count }, (_, i) => ({
        value: i + 1,
        label: titles[i] ? `${i + 1} — ${titles[i]}` : i + 1,
      })),
      rollHp,
      offer: game.settings.get(game.system.id, "promptAddClassAbilities"),
    },
  );
  return foundry.applications.api.DialogV2.prompt({
    classes: ["ose", "dialog"],
    window: { title: game.i18n.format("OSE.classes.StartTitle", { cls: itemData.name }) },
    position: { width: 480, height: "auto" },
    content,
    ok: {
      label: game.i18n.localize("OSE.Add"),
      callback: (_event, button) => {
        const { level, rollHp, offer } = new foundry.applications.ux.FormDataExtended(button.form).object;
        return { level: Number(level) || 1, rollHp: !!rollHp, offer: !!offer };
      },
    },
    rejectClose: false,
  });
};

// Without the multiple classes rule, a new class replaces the old one.
export const onDropClass = async (sheet, itemData) => {
  const { actor } = sheet;
  const [existing] = actor.system.classes;
  if (existing && !game.settings.get(game.system.id, "multipleClasses")) {
    const ok = await foundry.applications.api.DialogV2.confirm({
      classes: ["ose", "dialog"],
      window: { title: game.i18n.localize("OSE.classes.Replace") },
      content: `<p>${game.i18n.format("OSE.classes.ReplaceHint", { from: esc(existing.name), to: esc(itemData.name) })}</p>`,
      position: { width: 400, height: "auto" },
      rejectClose: false,
    });
    if (!ok) return;
    itemData.system.level = existing.system.level;
    itemData.system.xp = existing.system.xp;
    const before = actor.classStats();
    await existing.delete();
    const created = await onDropItemCreate(sheet, [itemData]);
    const [cls] = created ?? [];
    if (cls) await actor.postClassChanges(cls, before);
    if (cls?.system.level === 1) await actor.offerAbilities(cls, 1);
    return created;
  }
  const start = await promptClassStart(
    itemData,
    rollsStartingHp({ isNew: actor.isNew(), hasClass: !!existing, level: Number(actor._source.system.details?.level) }),
  );
  if (!start) return;
  Object.assign(itemData.system, startingProgress(itemData.system.levels ?? [], start.level));
  const before = actor.classStats();
  const created = await onDropItemCreate(sheet, [itemData]);
  const [cls] = created ?? [];
  if (!cls) return created;
  const hp = start.rollHp ? await actor.rollStartingHp(cls, start.level) : null;
  await actor.postClassChanges(cls, before, hp);
  if (start.offer) await actor.offerAbilities(cls, start.level, { upTo: true });
  return created;
};

// One race per character; existing characters usually already include its modifiers.
export const onDropRace = async (sheet, itemData) => {
  const { actor } = sheet;
  const { DialogV2 } = foundry.applications.api;
  const existing = actor.system.race;
  if (existing) {
    const ok = await DialogV2.confirm({
      classes: ["ose", "dialog"],
      window: { title: game.i18n.localize("OSE.race.Replace") },
      content: `<p>${game.i18n.format("OSE.race.ReplaceHint", { from: esc(existing.name), to: esc(itemData.name) })}</p>`,
      position: { width: 400, height: "auto" },
      rejectClose: false,
    });
    if (!ok) return;
    await existing.delete();
  }
  const scope = game.system.id;
  const modifiers = (itemData.effects ?? []).find((e) => e.flags?.[scope]?.raceModifiers);
  if (modifiers && !actor.isNew()) {
    const included = await DialogV2.confirm({
      classes: ["ose", "dialog"],
      window: { title: itemData.name },
      content: `<p>${game.i18n.format("OSE.race.AlreadyIncluded", { race: esc(itemData.name) })}</p>`,
      position: { width: 400, height: "auto" },
      rejectClose: false,
    });
    if (included) modifiers.disabled = true;
  }
  const created = await onDropItemCreate(sheet, [itemData]);
  const [race] = created ?? [];
  if (race) await actor.offerAbilities(race, 1);
  return created;
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
