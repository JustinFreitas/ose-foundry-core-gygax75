/**
 * @file Reusable getData / _prepareContext slices for actor sheets.
 */
import OSE from "../config";

export const prepareSheetConfig = () => ({
  ...CONFIG.OSE,
  ascendingAC: game.settings.get(game.system.id, "ascendingAC"),
  initiative: game.settings.get(game.system.id, "initiative") !== "group",
  encumbrance: game.settings.get(game.system.id, "encumbranceOption"),
  encumbranceStrengthMod:
    game.settings.get(game.system.id, "encumbranceItemStrengthMod") &&
    game.settings.get(game.system.id, "encumbranceOption") === "itembased",
});

export const prepareEncumbranceTemplate = () =>
  OSE.encumbrance?.templateEncumbranceBar || `${OSE.systemPath()}/templates/actors/partials/character-encumbrance.html`;

export const prepareActiveEffectCategories = (actor) => {
  const categories = {
    temporary: {
      type: "temporary",
      label: "OSE.effect.temporary",
      effects: [],
    },
    passive: {
      type: "passive",
      label: "OSE.effect.passive",
      effects: [],
    },
    inactive: {
      type: "inactive",
      label: "OSE.effect.inactive",
      effects: [],
    },
  };

  for (const effect of actor.effects ?? []) {
    if (effect.disabled) categories.inactive.effects.push(effect);
    else if (effect.isTemporary) categories.temporary.effects.push(effect);
    else categories.passive.effects.push(effect);
  }

  // Read-only group: effects granted by the actor's items (transferred).
  const fromItems = [];
  for (const item of actor.items ?? []) {
    const suppressed = Object.hasOwn(item.system ?? {}, "equipped") ? !item.system.equipped : false;
    for (const effect of item.effects ?? []) {
      if (effect.transfer !== false) {
        fromItems.push({
          id: effect.id,
          name: effect.name,
          img: effect.img || effect.icon || "icons/svg/aura.svg",
          itemId: item.id,
          itemName: item.name,
          suppressed,
        });
      }
    }
  }
  if (fromItems.length > 0) {
    categories.managed = {
      type: "managed",
      label: "OSE.effect.fromItems",
      effects: fromItems,
      readonly: true,
    };
  }

  return categories;
};

export const prepareActorContext = async (actor, expandedSet) => {
  for (const item of actor.items) {
    item.isExpanded = expandedSet.has(item.id);
    await item.prepareDerivedData();
  }
  return {
    owner: actor.isOwner,
    isOwnerOrObserver: actor.isOwnerOrObserver,
    isNew: actor.isNew(),
    config: prepareSheetConfig(),
    encumbranceTemplate: prepareEncumbranceTemplate(),
    effects: prepareActiveEffectCategories(actor),
  };
};
