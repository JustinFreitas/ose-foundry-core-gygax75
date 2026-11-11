import OSE from "./config";

/**
 * Adds custom dynamic token ring option.
 * @param {foundry.canvas.placeables.tokens.TokenRingConfig} config - The TokenRingConfig to modify
 */
export function initializeTokenRing(config: foundry.canvas.placeables.tokens.TokenRingConfig) {
  config.addConfig(
    "ose-default-black-white",
    new foundry.canvas.placeables.tokens.DynamicRingData({
      label: "OSE.rings.BlackWhite",
      spritesheet: `${OSE.assetsPath}/rings/black-white.json`,
    }),
  );
}

/**
 * Prompts the user to select the default OSE dynamic token ring.
 * Will do nothing if the user has previously been prompted.
 */
export async function promptTokenRingSelection() {
  const hasPrompted = game.settings.get(game.system.id, "hasPromptedDefaultOSETokenRing");
  if (hasPrompted) return;

  if (
    await foundry.applications.api.DialogV2.confirm({
      classes: ["ose", "dialog"],
      window: {
        title: game.i18n.localize("OSE.dialog.TokenRingPrompt.Title"),
      },
      content: game.i18n.localize("OSE.dialog.TokenRingPrompt.Content"),
      position: { width: 400, height: "auto" },
      rejectClose: false,
    })
  ) {
    await game.settings.set("core", "dynamicTokenRing", "ose-default-black-white");
  }
  await game.settings.set(game.system.id, "hasPromptedDefaultOSETokenRing", true);
}
