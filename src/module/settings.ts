/**
 * @file Wire up system settings.
 */
import type { ApplyDamageOption, EncumbranceOption } from "./config";

/**
 * Perform setting registration.
 */
const registerSettings = () => {
  game.settings.register(game.system.id, "initiative", {
    name: "OSE.Setting.Initiative",
    hint: "OSE.Setting.InitiativeHint",
    default: "group",
    scope: "world",
    type: String,
    requiresReload: true,
    config: true,
    choices: {
      individual: "OSE.Setting.InitiativeIndividual",
      group: "OSE.Setting.InitiativeGroup",
    },
  });

  game.settings.register(game.system.id, "rerollInitiative", {
    name: "OSE.Setting.RerollInitiative",
    hint: "OSE.Setting.RerollInitiativeHint",
    default: "reset",
    scope: "world",
    type: String,
    config: true,
    choices: {
      keep: "OSE.Setting.InitiativeKeep",
      reset: "OSE.Setting.InitiativeReset",
      reroll: "OSE.Setting.InitiativeReroll",
    },
  });

  game.settings.register(game.system.id, "ascendingAC", {
    name: "OSE.Setting.AscendingAC",
    hint: "OSE.Setting.AscendingACHint",
    default: false,
    scope: "world",
    type: Boolean,
    config: true,
  });

  game.settings.register(game.system.id, "morale", {
    name: "OSE.Setting.Morale",
    hint: "OSE.Setting.MoraleHint",
    default: false,
    scope: "world",
    type: Boolean,
    config: true,
  });

  game.settings.register(game.system.id, "encumbranceOption", {
    name: "OSE.Setting.Encumbrance",
    hint: "OSE.Setting.EncumbranceHint",
    default: "detailed",
    scope: "world",
    type: String,
    config: true,
    requiresReload: true,
    choices: Object.fromEntries(
      Object.values(CONFIG.OSE.encumbranceOptions).map((enc) => [enc.type, enc.localizedLabel]),
    ) as Record<EncumbranceOption, string>,
  });

  game.settings.register(game.system.id, "encumbranceItemStrengthMod", {
    name: "OSE.Setting.EncumbranceItemStrengthMod",
    hint: "OSE.Setting.EncumbranceItemStrengthModHint",
    default: false,
    scope: "world",
    type: Boolean,
    config: true,
  });

  game.settings.register(game.system.id, "gygax75Encumbrance", {
    name: "OSE.Setting.Gygax75Encumbrance",
    hint: "OSE.Setting.Gygax75EncumbranceHint",
    default: true,
    scope: "world",
    type: Boolean,
    config: true,
    requiresReload: true,
  });

  game.settings.register(game.system.id, "significantTreasure", {
    name: "OSE.Setting.SignificantTreasure",
    hint: "OSE.Setting.SignificantTreasureHint",
    default: 800,
    scope: "world",
    type: Number,
    config: true,
  });

  game.settings.register(game.system.id, "languages", {
    name: "OSE.Setting.Languages",
    hint: "OSE.Setting.LanguagesHint",
    default: "",
    scope: "world",
    type: String,
    config: true,
  });

  game.settings.register(game.system.id, "applyDamageOption", {
    name: "OSE.Setting.applyDamageOption",
    hint: "OSE.Setting.applyDamageOptionHint",
    default: "selected",
    scope: "world",
    type: String,
    config: true,
    choices: {
      selected: "OSE.Setting.damageSelected",
      targeted: "OSE.Setting.damageTarget",
      originalTarget: "OSE.Setting.damageOriginalTarget",
    },
  });

  game.settings.register(game.system.id, "invertedCtrlBehavior", {
    name: "OSE.Setting.InvertedCtrlBehavior",
    hint: "OSE.Setting.InvertedCtrlBehaviorHint",
    default: false,
    scope: "world",
    type: Boolean,
    config: true,
  });

  game.settings.register(game.system.id, "ignoreAttackBonusOnDamageRoll", {
    name: "OSE.Setting.ignoreAttackBonusOnDamageRoll",
    hint: "OSE.Setting.ignoreAttackBonusOnDamageRollHint",
    default: false,
    scope: "world",
    type: Boolean,
    config: true,
    requiresReload: true,
  });

  game.settings.register(game.system.id, "hasPromptedDefaultOSETokenRing", {
    default: false,
    scope: "world",
    type: Boolean,
  });

  game.settings.register(game.system.id, "savedParties", {
    scope: "world",
    config: false,
    type: Object,
    default: {},
  });

  game.settings.register(game.system.id, "automateAmmo", {
    name: "OSE.Setting.AutomateAmmo",
    hint: "OSE.Setting.AutomateAmmoHint",
    scope: "world",
    config: true,
    type: String,
    choices: {
      disabled: "OSE.Setting.AutomateAmmoDisabled",
      warn: "OSE.Setting.AutomateAmmoWarn",
      enforce: "OSE.Setting.AutomateAmmoEnforce",
    },
    default: "warn",
  });

  game.settings.register(game.system.id, "enableClassItems", {
    name: "OSE.Setting.EnableClassItems",
    hint: "OSE.Setting.EnableClassItemsHint",
    default: false,
    scope: "world",
    type: Boolean,
    config: true,
    requiresReload: true,
  });

  game.settings.register(game.system.id, "multipleClasses", {
    name: "OSE.Setting.MultipleClasses",
    hint: "OSE.Setting.MultipleClassesHint",
    default: false,
    scope: "world",
    type: Boolean,
    config: true,
    requiresReload: true,
  });

  game.settings.register(game.system.id, "promptAddClassAbilities", {
    name: "OSE.Setting.PromptAddClassAbilities",
    hint: "OSE.Setting.PromptAddClassAbilitiesHint",
    default: true,
    scope: "world",
    type: Boolean,
    config: true,
  });

  game.settings.register(game.system.id, "effectsTab", {
    name: "OSE.Setting.EffectsTab",
    hint: "OSE.Setting.EffectsTabHint",
    default: true,
    scope: "world",
    type: Boolean,
    config: true,
  });

  game.settings.register(game.system.id, "tweaksMigrated", {
    default: false,
    scope: "world",
    type: Boolean,
    config: false,
  });

  game.settings.register(game.system.id, "systemMigrationVersion", {
    default: "",
    scope: "world",
    type: String,
    config: false,
  });
};

declare global {
  namespace ClientSettings {
    // Include OSE settings in addition to foundry default settings
    interface Values {
      "ose.initiative": "individual" | "group";
      "ose.rerollInitiative": "keep" | "reset" | "reroll";
      "ose.ascendingAC": boolean;
      "ose.morale": boolean;
      "ose.encumbranceOption": EncumbranceOption;
      "ose.encumbranceItemStrengthMod": boolean;
      "ose.gygax75Encumbrance": boolean;
      "ose.savedParties": Record<string, string[]>;
      "ose.automateAmmo": "disabled" | "warn" | "enforce";
      "ose.significantTreasure": number;
      "ose.languages": string;
      "ose.applyDamageOption": ApplyDamageOption;
      "ose.invertedCtrlBehavior": boolean;
      "ose.ignoreAttackBonusOnDamageRoll": boolean;
      "ose.hasPromptedDefaultOSETokenRing": boolean;
      "ose.multipleClasses": boolean;
      "ose.promptAddClassAbilities": boolean;
      "ose.effectsTab": boolean;
      "ose.enableClassItems": boolean;
      "ose.tweaksMigrated": boolean;
      "ose.systemMigrationVersion": string;
    }
  }
}

declare module "@league-of-foundry-developers/foundry-vtt-types/configuration" {
  interface SettingConfig extends ClientSettings.Values {}
}

export default registerSettings;
