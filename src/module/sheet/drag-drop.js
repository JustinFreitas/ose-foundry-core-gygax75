/**
 * @file Shared drag-and-drop handlers used by actor sheets.
 */
import { rollsStartingHp } from "../classes/levels";
import OSE from "../config";
import { removeItemFromActor } from "./inventory-actions";

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

  let itemArray = [...(folder.contents || [])];
  folder.getSubfolders?.(true)?.forEach((subfolder) => {
    itemArray.push(...(subfolder.contents || []));
  });

  if (itemArray.length > 0 && itemArray.some((item) => item?.uuid?.includes?.("Compendium") || !item?.system)) {
    itemArray = (
      await Promise.all(itemArray.map((item) => (item?.uuid ? fromUuid(item.uuid) : Promise.resolve(item))))
    ).filter(Boolean);
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
  const isOwned = Boolean(resolvedItem?.parent ? resolvedItem.parent === sheet.actor : false);
  const sourceContainer =
    isOwned && resolvedItem.system?.containerId ? sheet.actor.items.get(resolvedItem.system.containerId) : null;

  const pool = event?.target?.closest?.("[data-spell-pool]")?.dataset.spellPool;
  if (isOwned && resolvedItem.type === "spell" && pool && pool !== resolvedItem.system.castAs) {
    return resolvedItem.update({ "system.castAs": pool });
  }

  // Dragging owned item/container onto itself
  if (isOwned && (itemId === targetId || (targetContainer && itemId === targetContainer.id))) return;

  if (!isOwned && resolvedItem.type === "class" && sheet.actor.type === "character")
    return onDropClass(sheet, itemData);
  if (!isOwned && resolvedItem.type === "race" && sheet.actor.type === "character") return onDropRace(sheet, itemData);

  // Prevent nesting containers
  if (resolvedItem.type === "container" && targetContainer) {
    return ui.notifications.warn(game.i18n.localize("OSE.warn.noNestedContainers") || "You cannot nest containers.");
  }

  const removeFromSourceActor = async () => {
    if (!resolvedItem.actor || event?.ctrlKey) return;
    const isSameActor =
      resolvedItem.actor.uuid && sheet.actor.uuid
        ? resolvedItem.actor.uuid === sheet.actor.uuid
        : resolvedItem.actor === sheet.actor;
    if (isSameActor) return;

    if (typeof resolvedItem.actor.deleteEmbeddedDocuments === "function") {
      if (resolvedItem.type === "container") {
        const listedIds = new Set(Array.isArray(resolvedItem.system?.itemIds) ? resolvedItem.system.itemIds : []);
        const actorItems = resolvedItem.actor.items?.contents ?? [...(resolvedItem.actor.items ?? [])];
        const childIds = actorItems
          .filter((i) => i && (i.system?.containerId === resolvedItem.id || listedIds.has(i.id)))
          .map((i) => i.id)
          .filter(Boolean);
        const idsToDelete = [...new Set([resolvedItem.id, ...childIds].filter(Boolean))];
        await resolvedItem.actor.deleteEmbeddedDocuments("Item", idsToDelete);
      } else {
        await removeItemFromActor(resolvedItem.actor, resolvedItem);
      }
    } else {
      await resolvedItem.delete?.();
    }
  };

  // Branch A: Drop target is a Container (or inside a container)
  if (targetContainer) {
    if (!isOwned) {
      const result = await onContainerItemAdd(sheet, resolvedItem, targetContainer);
      await removeFromSourceActor();
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
    const result = await onDropItemCreate(sheet, [resolvedItem]);
    await removeFromSourceActor();
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

export const onDropClass = async (sheet, itemData) => {
  const { actor } = sheet;
  if (!game.settings.get(game.system.id, "enableClassItems")) {
    await actor.update({ "system.details.class": itemData.name });
    ui.notifications?.info(game.i18n.format("OSE.classes.setClassName", { name: itemData.name }));
    return;
  }
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
    const cls = await actor.addClass(itemData, { replace: existing });
    if (cls?.system.level === 1) await actor.offerAbilities(cls, 1);
    return cls;
  }
  const start = await promptClassStart(
    itemData,
    rollsStartingHp({ isNew: actor.isNew(), hasClass: !!existing, level: Number(actor._source.system.details?.level) }),
  );
  if (!start) return;
  const cls = await actor.addClass(itemData, { level: start.level, rollHp: start.rollHp });
  if (cls && start.offer) await actor.offerAbilities(cls, start.level, { upTo: true });
  return cls;
};

export const onDropRace = async (sheet, itemData) => {
  const { actor } = sheet;
  if (!game.settings.get(game.system.id, "enableClassItems")) {
    await actor.update({ "system.details.title": itemData.name });
    ui.notifications?.info(game.i18n.format("OSE.races.setRaceName", { name: itemData.name }));
    return;
  }
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
  }
  const scope = game.system.id;
  const modifiers = (itemData.effects ?? []).find((e) => e.flags?.[scope]?.raceModifiers);
  let modifiersIncluded = false;
  if (modifiers && !actor.isNew()) {
    modifiersIncluded = await DialogV2.confirm({
      classes: ["ose", "dialog"],
      window: { title: itemData.name },
      content: `<p>${game.i18n.format("OSE.race.AlreadyIncluded", { race: esc(itemData.name) })}</p>`,
      position: { width: 400, height: "auto" },
      rejectClose: false,
    });
  }
  const race = await actor.setRace(itemData, { modifiersIncluded: !!modifiersIncluded });
  if (race) await actor.offerAbilities(race, 1);
  return race;
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
  const isAlreadyOnTargetActor =
    item.parent === sheet.actor &&
    Boolean(
      target.parent?.items?.get
        ? target.parent.items.get(item.id)
        : target.parent?.items?.find?.((i) => i.id === item.id),
    );
  let latestItem = item;
  const cloneData = (val) => (foundry.utils.deepClone ? foundry.utils.deepClone(val) : structuredClone(val));
  if (!isAlreadyOnTargetActor) {
    const itemPayload = typeof item.toObject === "function" ? item.toObject() : cloneData(item);
    if (item.parent && item.parent !== sheet.actor) {
      delete itemPayload._id;
      delete itemPayload.id;
    }
    const newItem = await onDropItemCreate(sheet, [itemPayload]);
    latestItem = Array.isArray(newItem) ? newItem[newItem.length - 1] : newItem;
  }

  if (!latestItem) return [];

  const alreadyExistsInContainer = target.system.itemIds.includes(latestItem.id);
  if (!alreadyExistsInContainer) {
    const newList = [...target.system.itemIds, latestItem.id];
    await target.update({ "system.itemIds": newList });
    await latestItem.update({ "system.containerId": target.id, "system.equipped": false });
  }
  return [latestItem];
};

export const onDropItemCreate = async (sheet, droppedItem, targetContainer = false) => {
  const cloneData = (val) => (foundry.utils.deepClone ? foundry.utils.deepClone(val) : structuredClone(val));
  const rawItems = (Array.isArray(droppedItem) ? droppedItem : [droppedItem]).filter(Boolean);
  if (rawItems.length === 0) return [];

  const itemsToCreate = [];
  const pendingContainerChildren = [];

  for (const raw of rawItems) {
    const isForeignActorItem = Boolean(raw.parent && raw.parent !== sheet.actor);
    const sourceActor = isForeignActorItem ? raw.actor || raw.parent : null;
    const data = typeof raw.toObject === "function" ? raw.toObject() : cloneData(raw);
    if (isForeignActorItem) {
      delete data._id;
      delete data.id;
    }
    data.system = data.system || {};
    if (data.system.containerId) data.system.containerId = "";

    if (data.type === "container") {
      let rawChildEntries = [];
      if (typeof data.system.itemIds === "string") {
        try {
          const parsed = JSON.parse(data.system.itemIds);
          if (Array.isArray(parsed)) rawChildEntries = parsed;
        } catch {
          rawChildEntries = [];
        }
      } else if (Array.isArray(data.system.itemIds)) {
        rawChildEntries = [...data.system.itemIds];
      }

      data.system.itemIds = [];
      const childPayloads = [];
      for (const entry of rawChildEntries) {
        if (entry && typeof entry === "object" && entry.system) {
          const childClone = cloneData(entry);
          delete childClone._id;
          delete childClone.id;
          childClone.system.containerId = "";
          childPayloads.push(childClone);
        } else if (typeof entry === "string") {
          const srcChild =
            sourceActor?.items?.get?.(entry) ??
            (Array.isArray(sourceActor?.items)
              ? sourceActor.items.find((i) => i.id === entry || i._id === entry)
              : null) ??
            (Array.isArray(raw.system?.contents)
              ? raw.system.contents.find((i) => i.id === entry || i._id === entry)
              : null);
          if (srcChild) {
            const childClone = typeof srcChild.toObject === "function" ? srcChild.toObject() : cloneData(srcChild);
            delete childClone._id;
            delete childClone.id;
            childClone.system = childClone.system || {};
            childClone.system.containerId = "";
            childPayloads.push(childClone);
          }
        }
      }

      const containerIndex = itemsToCreate.length;
      itemsToCreate.push(data);
      if (childPayloads.length > 0) {
        pendingContainerChildren.push({ containerIndex, childPayloads, sourceActor, rawChildEntries });
      }
      continue;
    }

    itemsToCreate.push(data);
  }

  const createdRaw = await sheet.actor.createEmbeddedDocuments("Item", itemsToCreate);
  const createdItems = Array.isArray(createdRaw) ? [...createdRaw] : [createdRaw].filter(Boolean);

  for (const { containerIndex, childPayloads } of pendingContainerChildren) {
    const newContainer = createdItems[containerIndex];
    if (!newContainer) continue;
    const createdChildrenRaw = await sheet.actor.createEmbeddedDocuments("Item", childPayloads);
    const createdChildren = Array.isArray(createdChildrenRaw)
      ? createdChildrenRaw
      : [createdChildrenRaw].filter(Boolean);
    const childIds = createdChildren.map((c) => c.id || c._id).filter(Boolean);
    if (childIds.length > 0) {
      if (typeof newContainer.update === "function") {
        await newContainer.update({ "system.itemIds": childIds });
      } else if (typeof sheet.actor.updateEmbeddedDocuments === "function") {
        await sheet.actor.updateEmbeddedDocuments("Item", [
          { _id: newContainer.id || newContainer._id, "system.itemIds": childIds },
        ]);
      }
      for (const child of createdChildren) {
        if (typeof child.update === "function") {
          await child.update({ "system.containerId": newContainer.id || newContainer._id, "system.equipped": false });
        } else if (typeof sheet.actor.updateEmbeddedDocuments === "function") {
          await sheet.actor.updateEmbeddedDocuments("Item", [
            {
              _id: child.id || child._id,
              "system.containerId": newContainer.id || newContainer._id,
              "system.equipped": false,
            },
          ]);
        }
      }
      createdItems.push(...createdChildren);
    }
  }

  if (targetContainer?.id) {
    const stowable = createdItems.filter((c) => c && c.type !== "container");
    const newItemIds = [...(targetContainer.system?.itemIds ?? [])];
    for (const item of stowable) {
      const id = item.id || item._id;
      if (id && !newItemIds.includes(id)) newItemIds.push(id);
    }
    if (typeof targetContainer.update === "function") {
      await targetContainer.update({ "system.itemIds": newItemIds });
    } else if (typeof sheet.actor.updateEmbeddedDocuments === "function") {
      await sheet.actor.updateEmbeddedDocuments("Item", [{ _id: targetContainer.id, "system.itemIds": newItemIds }]);
    }
    for (const item of stowable) {
      if (typeof item.update === "function") {
        await item.update({ "system.containerId": targetContainer.id, "system.equipped": false });
      } else if (typeof sheet.actor.updateEmbeddedDocuments === "function") {
        await sheet.actor.updateEmbeddedDocuments("Item", [
          { _id: item.id || item._id, "system.containerId": targetContainer.id, "system.equipped": false },
        ]);
      }
    }
  }

  return createdItems;
};
