/**
 * @file Functions that alter the way that sidebar and compendium lists render
 */
import OSE from "./config";

/**
 * Called when a compendium directory is rendered
 *
 * @param {foundry.applications.sidebar.tabs.DocumentDirectory} object - The compendium directory object
 */
export const RenderCompendium = async (object) => {
  if (object?.documentName !== "Item") {
    return;
  }

  const content = await object.collection.getDocuments();
  const html = object.element;
  if (!html) return;
  const render = html.querySelectorAll(".item");

  for (const item of render) {
    if (item.querySelector(".tag-list")) continue;
    const foundryDocument = content.find((e) => e.id === item.dataset.entryId);
    if (!foundryDocument?.system) continue;
    const tags =
      typeof foundryDocument.getVisibleAutoTags === "function"
        ? foundryDocument.getVisibleAutoTags()
        : foundryDocument.system.autoTags || [];

    const tagsHtml = await foundry.applications.handlebars.renderTemplate(
      `${OSE.systemPath()}/templates/actors/partials/item-auto-tags-partial.html`,
      { tags },
    );
    item.insertAdjacentHTML("beforeend", tagsHtml);
  }
};

/**
 * Called when the sidebar item directory is rendered
 *
 * @param {foundry.applications.sidebar.tabs.ItemDirectory} object - The item directory object
 */
export const RenderItemDirectory = async (object) => {
  const html = object?.element;
  if (!html) return;
  const render = html.querySelectorAll(".item");
  const content = object.collection;
  if (!content) return;

  for (const item of render) {
    if (item.querySelector(".tag-list")) continue;
    const foundryDocument = content.find((e) => e.id === item.dataset.entryId);
    if (!foundryDocument?.system) continue;
    const tags =
      typeof foundryDocument.getVisibleAutoTags === "function"
        ? foundryDocument.getVisibleAutoTags()
        : foundryDocument.system.autoTags || [];

    const tagsHtml = await foundry.applications.handlebars.renderTemplate(
      `${OSE.systemPath()}/templates/actors/partials/item-auto-tags-partial.html`,
      { tags },
    );
    item.insertAdjacentHTML("beforeend", tagsHtml);
  }
};
