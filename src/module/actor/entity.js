import { isAbilityOwned } from "../classes/abilities";
import { statChanges } from "../classes/changes";
import { abilitiesGrantedBy } from "../classes/granted";
import { mergeLanguages } from "../classes/languages";
import {
  applyXpBonus,
  divideHp,
  formatHp,
  hdFlatBonus,
  rollableHd,
  SAVE_KEYS,
  splitStartingHp,
  splitXp,
  startingProgress,
} from "../classes/progression";
import { tableRowValues } from "../classes/tables";
import OSE from "../config";
import skipRollDialogCheck from "../helpers-behaviour";
import OseDice from "../helpers-dice";
import OseItem from "../item/entity";

/**
 * Used in the rollAttack function to remove zeroes from rollParts arrays
 *
 * @param {[]} arr - an array
 * @returns {[]} - an array
 */
const removeFalsyElements = (arr) => arr.filter((b) => b);

const CREATURE_GROUP_PATTERNS = {
  undead: [
    "undead",
    "skeleton",
    "zombie",
    "ghoul",
    "wight",
    "wraith",
    "mummy",
    "spectre",
    "specter",
    "vampire",
    "ghost",
    "lich",
    "phantom",
    "haunt",
    "shadow",
    "revenant",
  ],
  dragon: ["dragon", "dragonkind", "wyvern", "hydra", "drake", "chimera"],
  giant: [
    "giant",
    "giantkind",
    "ogre",
    "troll",
    "ettin",
    "cyclops",
    "titan",
    "bugbear",
    "gnoll",
    "goblin",
    "hobgoblin",
    "orc",
    "kobold",
  ],
  regenerating: ["regenerating", "regenerate", "troll"],
  lycanthrope: [
    "lycanthrope",
    "shapechanger",
    "werewolf",
    "wererat",
    "wereboar",
    "weretiger",
    "werebear",
    "doppelganger",
  ],
  enchanted: [
    "enchanted",
    "planar",
    "summoned",
    "elemental",
    "djinn",
    "djinni",
    "efreet",
    "efreeti",
    "invisible stalker",
    "salamander",
    "demon",
    "devil",
    "fiend",
    "gargoyle",
    "golem",
  ],
  construct: ["construct", "golem", "statue", "gargoyle"],
};

export default class OseActor extends Actor {
  /**
   * Compute B/X & OSE missile range band modifier (+1 Short, 0 Medium, -1 Long).
   */
  static computeRangeModifier(range, distance) {
    const dist = Number(distance);
    const short = Number(range?.short) || 0;
    const medium = Number(range?.medium) || 0;
    const long = Number(range?.long) || 0;
    if (!(dist > 0) || !(long > 0)) {
      return { modifier: 0, band: null, outOfRange: false, distance: dist };
    }
    if (short > 0 && dist <= short) {
      return { modifier: 1, band: "short", outOfRange: false, distance: dist };
    }
    if (medium > 0 && dist <= medium) {
      return { modifier: 0, band: "medium", outOfRange: false, distance: dist };
    }
    if (dist <= long) {
      return { modifier: -1, band: "long", outOfRange: false, distance: dist };
    }
    return { modifier: -1, band: "out", outOfRange: true, distance: dist };
  }

  /**
   * Extract normalized `vsGroup` map from a weapon or ammo item/system object.
   */
  static extractVsGroups(itemOrSystem) {
    const sys = itemOrSystem?.system ?? itemOrSystem ?? {};
    if (sys.parsedVsGroups && typeof sys.parsedVsGroups === "object") {
      return sys.parsedVsGroups;
    }
    const map = {};
    for (const [k, v] of Object.entries(sys.vsGroup ?? {})) {
      const num = Number(v);
      if (Number.isFinite(num) && k.trim()) {
        map[k.trim().toLowerCase()] = num;
      }
    }
    for (const tag of sys.tags ?? []) {
      const m = /^([+-]?\d+)\s+vs\.?\s+([a-z0-9\s_-]+)$/i.exec(String(tag?.value ?? "").trim());
      if (m?.[1] && m?.[2]) {
        const num = Number.parseInt(m[1], 10);
        const group = m[2].trim().toLowerCase();
        if (Number.isFinite(num) && group) {
          map[group] = num;
        }
      }
    }
    return map;
  }

  /**
   * Determine whether a target Actor or Token belongs to a creature group (e.g. "undead", "dragons", "regenerating").
   */
  static matchesCreatureGroup(target, groupKey) {
    const actor = target?.actor ?? target;
    if (!actor) return false;
    const rawGroup = String(groupKey ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+creatures?$/, "")
      .replace(/kind$/, "")
      .replace(/s$/, "");
    if (!rawGroup) return false;

    const details = actor.system?.details ?? {};
    const explicitGroups = [
      details.group,
      details.creatureType,
      ...(Array.isArray(details.creatureGroups) ? details.creatureGroups : [details.creatureGroups]),
    ]
      .filter(Boolean)
      .map((g) => String(g).toLowerCase());

    const haystack = [actor.name ?? "", details.biography ?? "", ...explicitGroups].join(" ").toLowerCase();

    if (haystack.includes(rawGroup)) return true;

    const keywords = CREATURE_GROUP_PATTERNS[rawGroup];
    if (keywords) {
      return keywords.some((kw) => haystack.includes(kw));
    }
    return false;
  }

  /**
   * Resolve the effective magic bonus of a weapon against a specific target,
   * substituting a matching `vsGroup` bonus (e.g. +3 vs. undead) when applicable.
   */
  static resolveWeaponBonus(item, target) {
    const baseBonus = Number(item?.system?.bonus) || 0;
    if (!target || !item) return baseBonus;
    const vsGroups = OseActor.extractVsGroups(item);
    let bestBonus = baseBonus;
    let matched = false;
    for (const [groupKey, bonus] of Object.entries(vsGroups)) {
      if (OseActor.matchesCreatureGroup(target, groupKey)) {
        if (!matched || bonus > bestBonus) {
          bestBonus = bonus;
          matched = true;
        }
      }
    }
    return bestBonus;
  }

  static migrateData(source) {
    // Fixing missing img
    if (source?.img === "") {
      source.img = "icons/svg/mystery-man.svg";
    }
    if (source?.prototypeToken?.texture?.img === "") {
      source.prototypeToken.texture.img = "icons/svg/mystery-man.svg";
    }
    // Fixing missing movement.value by moving it to details.movement
    if (source?.system?.movement?.value && !source?.system?.details.movement) {
      source.system.details.movement = source.system.movement.value;
      delete source.system.movement.value;
    }

    return source;
  }

  applyActiveEffects(phase) {
    if (phase !== "final") this.system.prepareTables?.();
    return super.applyActiveEffects(phase);
  }

  // Class table values for formulas, e.g. @classTables.thief.skills.hs.
  getRollData() {
    const data = super.getRollData();
    if (this.type !== "character") return data;
    const classes = this.system.classes ?? [];
    if (classes.length) {
      data.classTables = Object.fromEntries(
        classes.map((c) => [c.system.key || c.id, tableRowValues(c.system.tables ?? [], c.system.level)]),
      );
    }
    return data;
  }

  async update(data, options = {}) {
    const newData = { ...data };
    const {
      "system.ac.value": acValue,
      "system.aac.value": aacValue,
      "system.ac.mod": acMod,
      "system.aac.mod": aacMod,
      "system.thac0.bba": bbaValue,
      "system.thac0.value": thac0Value,
    } = newData;
    // Compute AAC from AC
    if (acValue !== undefined) {
      newData["system.aac.value"] = 19 - acValue;
    } else if (aacValue !== undefined) {
      newData["system.ac.value"] = 19 - aacValue;
    }

    // Ensure AAC and AC have the same mod value
    if (acMod !== undefined) {
      newData["system.aac.mod"] = acMod;
    } else if (aacMod !== undefined) {
      newData["system.ac.mod"] = aacMod;
    }

    // Compute Thac0 from BBA
    if (thac0Value !== undefined) {
      newData["system.thac0.bba"] = 19 - thac0Value;
    } else if (bbaValue !== undefined) {
      newData["system.thac0.value"] = 19 - bbaValue;
    }

    return super.update(newData, options);
  }

  async createEmbeddedDocuments(embeddedName, data = [], context = {}) {
    data.forEach((item) => {
      if (item.img === undefined) {
        item.img = OseItem.defaultIcons[item.type];
      }
    });
    return super.createEmbeddedDocuments(embeddedName, data, context);
  }

  /* -------------------------------------------- */
  /*  Socket Listeners and Handlers
    /* -------------------------------------------- */
  async getExperience(value, _options = {}) {
    if (this.type !== "character") return;
    const classes = this.system.classes;
    let gained;
    if (classes.length) {
      const shares = splitXp(value, classes.length).map((share, i) => {
        return applyXpBonus(share, this.system.classXpBonus(classes[i]) + this.system.xpBonusFromEffects);
      });
      await this.updateEmbeddedDocuments(
        "Item",
        classes.map((c, i) => ({ _id: c.id, "system.xp": c.system.xp + shares[i] })),
      );
      gained = shares.reduce((sum, n) => sum + n, 0);
    } else {
      gained = Math.floor(value + (this.system.details.xp.bonus * value) / 100);
      await this.update({ "system.details.xp.value": gained + this.system.details.xp.value });
    }
    ChatMessage.create({
      content: game.i18n.format("OSE.messages.GetExperience", { name: this.name, value: gained }),
      speaker: ChatMessage.getSpeaker({ actor: this }),
    });
  }

  /**
   * Advance a class one level.
   *
   * @param {Item} classItem - An embedded class item
   */
  async levelUp(classItem) {
    const { system } = classItem;
    if (!system.nextRow) return;
    const before = this.classStats();
    const { gain, formula, fixed, roll } = await this.#rollLevelHp(classItem, system.level + 1);
    const count = this.system.classes.length || 1;
    const { whole, fraction } = divideHp(gain, count, this.system.hp.fraction ?? 0);
    await classItem.update({ "system.level": system.level + 1 });
    await this.update({
      "system.hp.max": (this.system.hp.max || 0) + whole,
      "system.hp.value": (this.system.hp.value || 0) + whole,
      "system.hp.fraction": fraction,
    });
    await this.postClassChanges(
      classItem,
      before,
      { rolls: [formula], gain, count, fixed, dice: roll ? [roll] : [] },
      { levelUp: true },
    );
    await this.offerAbilities(classItem, classItem.system.level);
  }

  // HP for reaching a level.
  async #rollLevelHp(classItem, level) {
    const { levels, hitDie } = classItem.system;
    const row = levels[level - 1];
    if (row && !row.hdcon) {
      const gain = hdFlatBonus(row.hd) - hdFlatBonus(levels[level - 2]?.hd ?? "");
      return { gain, formula: String(gain), fixed: true };
    }
    const die = hitDie || "1d6";
    const con = this.system.scores.con.mod || 0;
    // At least 1 HP per level, regardless of CON penalty.
    const formula = con ? `max(${die} ${con > 0 ? "+" : "-"} ${Math.abs(con)}, 1)` : die;
    const roll = await new Roll(formula).evaluate();
    return { gain: roll.total, formula, roll };
  }

  /**
   * Roll hit points for each level of a class added above 1st level.
   *
   * @param {Item} classItem - An embedded class item
   * @param {number} toLevel - The level the class starts at
   */
  async rollStartingHp(classItem, toLevel) {
    const rolls = [];
    for (let level = 1; level <= toLevel; level++) rolls.push(await this.#rollLevelHp(classItem, level));
    const gain = rolls.reduce((sum, r) => sum + r.gain, 0);
    const prevCount = Math.max(0, this.system.classes.length - 1);
    const { max = 0, value = 0, fraction: prevFraction = 0 } = this.system.hp;
    const { whole, fraction } = splitStartingHp({ max, fraction: prevFraction }, prevCount, gain);
    const update = {
      "system.hp.max": whole,
      "system.hp.value": prevCount ? (value || 0) + whole - (max || 0) : whole,
      "system.hp.fraction": fraction,
    };
    Hooks.callAll("ose.preApplyStartingHp", this, classItem, update);
    await this.update(update);
    return {
      rolls: rolls.map((r) => r.gain),
      gain,
      prevTotal: (max + prevFraction) * prevCount,
      count: prevCount + 1,
      dice: rolls.map((r) => r.roll).filter(Boolean),
    };
  }

  /**
   * Embed a class at a starting level and XP, roll its hit points if asked, report the
   * changed stats to chat and teach the character its languages.
   *
   * @param {object} data - Class item data
   * @param {object} [options]
   * @param {number} [options.level] - The level the class starts at; its XP comes from the class table
   * @param {boolean} [options.rollHp] - Roll starting hit points for each level
   * @param {Item} [options.replace] - A class to remove first; its level and XP carry over unless a level is given
   * @throws {Error} If the actor is not a character
   * @returns {Promise<Item|undefined>} The embedded class
   */
  async addClass(data, { level, rollHp = false, replace } = {}) {
    this.#requireCharacter();
    const item = foundry.utils.deepClone(data);
    const progress =
      replace && level === undefined
        ? { level: replace.system.level, xp: replace.system.xp }
        : startingProgress(item.system.levels ?? [], level ?? 1);
    Object.assign(item.system, progress);
    const before = this.classStats();
    if (replace) await replace.delete();
    const [cls] = await this.createEmbeddedDocuments("Item", [item]);
    if (!cls) return;
    const hp = rollHp ? await this.rollStartingHp(cls, cls.system.level) : null;
    await this.postClassChanges(cls, before, hp);
    await this.addLanguages(cls.system.languages);
    return cls;
  }

  /**
   * Embed a race in place of any the character has, replacing its languages with the race's.
   *
   * @param {object} data - Race item data
   * @param {object} [options]
   * @param {boolean} [options.modifiersIncluded] - The scores already include the race's modifiers, so its effect starts disabled
   * @throws {Error} If the actor is not a character
   * @returns {Promise<Item|undefined>} The embedded race
   */
  async setRace(data, { modifiersIncluded = false } = {}) {
    this.#requireCharacter();
    const item = foundry.utils.deepClone(data);
    if (modifiersIncluded) {
      const modifiers = (item.effects ?? []).find((e) => e.flags?.[game.system.id]?.raceModifiers);
      if (modifiers) modifiers.disabled = true;
    }
    await this.system.race?.delete();
    const [race] = await this.createEmbeddedDocuments("Item", [item]);
    if (!race) return;
    await this.addLanguages(race.system.languages, { replace: true });
    return race;
  }

  #requireCharacter() {
    if (this.type !== "character") {
      throw new Error(game.i18n.format("OSE.error.notACharacter", { name: this.name }));
    }
  }

  /**
   * Add languages the character doesn't know yet, or start its list over.
   *
   * @param {string[]} names - Language names; "Alignment" stands for the character's alignment
   * @param {object} [options]
   * @param {boolean} [options.replace] - Forget every language first
   */
  async addLanguages(names, { replace = false } = {}) {
    const current = this.system.languages?.value ?? [];
    const merged = mergeLanguages(replace ? [] : current, names, this.system.details?.alignment ?? "");
    if (merged.length === current.length && merged.every((name, i) => name === current[i])) return;
    return this.update({ "system.languages.value": merged });
  }

  // The stats a class drives, for before/after comparison.
  classStats() {
    const { hp, thac0, saves, spells } = this.system;
    return {
      hp: (hp.max ?? 0) + (hp.fraction ?? 0),
      thac0: thac0.value ?? 0,
      saves: Object.fromEntries(SAVE_KEYS.map((k) => [k, saves[k]?.value ?? 0])),
      spells: Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map((l) => [l, spells?.slots?.[l]?.max ?? 0])),
    };
  }

  /**
   * Post a chat card describing what adding a class or levelling one up changed.
   *
   * @param {Item} classItem - The class just added or levelled up
   * @param {object} before - {@link classStats} from before the change
   * @param {object} [hp] - The hit points gained: { rolls, gain, count, prevTotal?, fixed? }
   * @param {object} [options]
   * @param {boolean} [options.levelUp] - Whether this was a level-up rather than a new class
   * @param {string} [options.title] - Replaces the default title
   * @param {string[]} [options.lines] - Extra paragraphs, before the stat changes
   * @param {{key: string, value: string}[]} [options.kept] - Adjustments kept from before a conversion
   */
  async postClassChanges(classItem, before, hp, { levelUp = false, title, lines = [], kept = [] } = {}) {
    const i18n = game.i18n;
    const key = (k) => `OSE.classes.changes.${k}`;
    const labels = {
      hp: i18n.localize("OSE.Health"),
      thac0: i18n.localize("OSE.Thac0"),
      ...Object.fromEntries(SAVE_KEYS.map((k) => [`saves.${k}`, i18n.localize(`OSE.saves.${k}.long`)])),
      ...Object.fromEntries(
        [1, 2, 3, 4, 5, 6, 7, 8, 9].map((l) => [`spells.${l}`, i18n.format(key("SpellSlots"), { level: l })]),
      ),
      hd: i18n.localize("OSE.HitDice"),
    };
    const show = (k, v) => (k === "hp" ? formatHp(v) : v);
    const changes = statChanges(before, this.classStats()).map((c) => ({
      label: labels[c.key],
      from: show(c.key, c.from),
      to: show(c.key, c.to),
    }));
    const { max, fraction } = this.system.hp;
    const split = () =>
      levelUp
        ? i18n.format(key("LevelSplit"), { gain: hp.gain, count: hp.count, share: formatHp(hp.gain / hp.count) })
        : i18n.format(key("Split"), {
            prev: formatHp(hp.prevTotal),
            gain: hp.gain,
            count: hp.count,
            result: formatHp(max + (fraction || 0)),
          });
    const content = await foundry.applications.handlebars.renderTemplate(
      `${OSE.systemPath()}/templates/chat/class-changes.html`,
      {
        img: classItem.img,
        title:
          title ??
          i18n.format(key(levelUp ? "LevelTitle" : "Title"), {
            cls: classItem.name,
            level: classItem.system.level,
          }),
        lines,
        kept: kept.map((k) => ({ label: labels[k.key] ?? k.key, value: k.value })),
        keptTitle: kept.length && i18n.format(key("Kept"), { effect: i18n.localize("OSE.migration.EffectName") }),
        rolled:
          hp &&
          (hp.fixed
            ? i18n.format(key("Fixed"), { gain: hp.gain })
            : i18n.format(key("Rolled"), { rolls: hp.rolls.join(" + "), gain: hp.gain })),
        split: hp?.count > 1 && split(),
        changes,
        dice: await Promise.all((hp?.dice ?? []).map((r) => r.render())),
      },
    );
    return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this }), content });
  }

  /**
   * Offer the abilities an item grants at a level.
   *
   * @param {Item} item - An embedded class or race item
   * @param {number} level - The level just reached
   * @param {object} [options]
   * @param {boolean} [options.upTo] - Include the abilities of every level up to this one
   * @param {boolean} [options.confirm] - Ask before adding; false adds them regardless of the prompt setting
   */
  async offerAbilities(item, level, { upTo = false, confirm = true } = {}) {
    if (confirm && !game.settings.get(game.system.id, "promptAddClassAbilities")) return;
    const owned = this.items
      .filter((i) => i.type === "ability")
      .map((i) => ({
        name: i.name,
        requirements: i.system.requirements ?? "",
        source: i._stats?.compendiumSource ?? i.flags?.core?.sourceId ?? "",
      }));
    const entries = [];
    for (const entry of (item.system.abilities ?? []).filter((a) => (upTo ? a.level <= level : a.level === level))) {
      const doc = await fromUuid(entry.uuid);
      if (!doc) continue;
      const candidate = { name: doc.name, requirements: doc.system?.requirements ?? "", uuid: entry.uuid };
      if (!isAbilityOwned(owned, candidate)) entries.push({ doc, entry });
    }
    if (!entries.length) return;
    if (confirm) {
      const list = entries.map(({ doc }) => `<li>${foundry.utils.escapeHTML(doc.name)}</li>`).join("");
      const ok = await foundry.applications.api.DialogV2.confirm({
        classes: ["ose", "dialog"],
        window: { title: item.name },
        content: `<p>${game.i18n.localize("OSE.classes.AddAbilities")}</p><ul>${list}</ul>`,
        position: { width: 420, height: "auto" },
        rejectClose: false,
      });
      if (!ok) return;
    }
    const scope = game.system.id;
    const grantedBy = { type: item.type, key: item.system.key };
    const data = entries.map(({ doc, entry }) => {
      const base = doc.pack ? game.items.fromCompendium(doc) : doc.toObject();
      const flags = { grantedBy };
      const target = item.type === "class" ? entry.target || doc.system?.targetFrom : "";
      if (target) flags.classTarget = { classKey: item.system.key, target };
      return foundry.utils.mergeObject(base, { flags: { [scope]: flags } });
    });
    await this.createEmbeddedDocuments("Item", data);
  }

  /**
   * Delete a class or race, offering to delete the abilities it granted.
   *
   * @param {Item} item - An embedded class or race item
   */
  async removeGrantingItem(item) {
    const scope = game.system.id;
    const links = [];
    for (const { uuid } of item.system.abilities ?? []) {
      const doc = await fromUuid(uuid);
      if (doc) links.push({ uuid, name: doc.name, requirements: doc.system?.requirements ?? "" });
    }
    const owned = this.items
      .filter((i) => i.type === "ability")
      .map((i) => ({
        id: i.id,
        name: i.name,
        requirements: i.system.requirements ?? "",
        source: i._stats?.compendiumSource ?? i.flags?.core?.sourceId ?? "",
        grantedBy: i.getFlag(scope, "grantedBy"),
      }));
    const ids = abilitiesGrantedBy({ type: item.type, system: item.system, links }, owned);
    const esc = foundry.utils.escapeHTML;
    const boxes = ids
      .map(
        (id) =>
          `<label class="checkbox"><input type="checkbox" name="${id}" checked> ${esc(this.items.get(id).name)}</label>`,
      )
      .join("");
    const content = ids.length
      ? `<p>${game.i18n.format("OSE.classes.RemoveWithAbilities", { name: esc(item.name) })}</p><div class="granted-abilities">${boxes}</div>`
      : `<p>${game.i18n.format("OSE.dialog.confirmDeleteItem", { name: esc(item.name) })}</p>`;
    const chosen = await foundry.applications.api.DialogV2.confirm({
      classes: ["ose", "dialog"],
      window: { title: game.i18n.localize("OSE.dialog.deleteItem") },
      content,
      position: { width: 420, height: "auto" },
      yes: { callback: (_event, button) => ids.filter((id) => button.form.elements[id]?.checked) },
      rejectClose: false,
    });
    if (!chosen) return;
    await this.deleteEmbeddedDocuments("Item", [item.id, ...chosen]);
  }

  isNew() {
    return this.system.isNew;
  }

  /** @inheritDoc */
  // eslint-disable-next-line no-underscore-dangle
  async _preCreate(data, options, user) {
    // eslint-disable-next-line no-underscore-dangle
    await super._preCreate(data, options, user);

    // If this Actor came from a Compendium, do not change the values.
    // eslint-disable-next-line no-underscore-dangle
    if (this._stats?.compendiumSource?.startsWith("Compendium.")) return;

    // Configure prototype token settings
    const prototypeToken = {};
    if (this.type === "character") {
      Object.assign(prototypeToken, {
        // Only set actorLink if it's not already defined
        ...(data.prototypeToken?.actorLink === undefined && {
          actorLink: true,
        }),
        ...(data.prototypeToken?.disposition === undefined && {
          disposition: foundry.CONST.TOKEN_DISPOSITIONS.FRIENDLY,
        }),
      });
    }
    this.updateSource({ prototypeToken });
  }

  get isOwnerOrObserver() {
    return this.isOwner || this.testUserPermission(game.user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER);
  }

  generateSave(hd) {
    const parsedHd = hd.includes("+") ? Number.parseInt(hd, 10) + 1 : Number.parseInt(hd, 10);

    // Compute saves
    let saves = {};
    for (let i = 0; i <= parsedHd; i++) {
      const tmp = CONFIG.OSE.monster_saves[i];
      if (tmp) {
        saves = tmp;
      }
    }

    // Compute Thac0
    let thac0 = 20;
    Object.keys(CONFIG.OSE.monster_thac0).forEach((k) => {
      if (hd < Number.parseInt(k, 10)) return;
      thac0 = CONFIG.OSE.monster_thac0[k];
    });

    this.update({
      "system.thac0.value": thac0,
      "system.thac0.bba": 19 - thac0,
      "system.saves": {
        death: {
          value: saves.d,
        },
        wand: {
          value: saves.w,
        },
        paralysis: {
          value: saves.p,
        },
        breath: {
          value: saves.b,
        },
        spell: {
          value: saves.s,
        },
      },
    });
  }

  /* -------------------------------------------- */
  /*  Rolls                                       */
  /* -------------------------------------------- */

  async rollHP(_options = {}) {
    const { total } = await new Roll(this.system.hp.hd).evaluate();
    return this.update({ "system.hp": { max: total, value: total } });
  }

  rollSave(save, options = {}) {
    const label = game.i18n.localize(`OSE.saves.${save}.long`);
    const rollParts = ["1d20"];
    const actorData = this.system;
    const actorType = this.type;

    const data = {
      actor: this,
      roll: {
        type: "above",
        target: actorData.saves[save].value,
        magic: actorType === "character" ? actorData.scores.wis.mod + actorData.details.magic.bonus : 0,
        poison: actorType === "character" ? actorData.details.magic.bonus : 0,
      },
      details: game.i18n.format("OSE.roll.details.save", { save: label }),
    };

    const rollMethod = actorType === "character" ? OseDice.RollSave : OseDice.Roll;

    // Roll and return
    return rollMethod({
      event: options.event,
      parts: rollParts,
      data,
      skipDialog: options.fastForward || skipRollDialogCheck(options.event),
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format("OSE.roll.save", { save: label }),
      title: game.i18n.format("OSE.roll.save", { save: label }),
      chatMessage: options.chatMessage,
    });
  }

  rollMagicResistance(options = {}) {
    const mr = Number(this.system?.details?.magicResistance ?? this.system?.mr) || 0;
    const rollParts = ["1d100"];
    const label = game.i18n?.localize?.("OSE.details.magicResistance") || "Magic Resistance";
    const data = {
      actor: this,
      roll: {
        type: "below",
        target: mr,
      },
      details: `Roll 1d100 <= ${mr}%`,
    };
    return OseDice.Roll({
      event: options.event,
      parts: rollParts,
      data,
      skipDialog: options.skipDialog ?? true,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `${label} (${mr}%)`,
      title: `${label} (${mr}%)`,
      chatMessage: options.chatMessage,
    });
  }

  rollMorale(options = {}) {
    const actorData = this.system;

    const rollParts = ["2d6"];

    const data = {
      actor: this,
      roll: {
        type: "below",
        target: actorData.details.morale,
      },
    };

    // Roll and return
    return OseDice.Roll({
      event: options.event,
      parts: rollParts,
      data,
      skipDialog: true,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.localize("OSE.roll.morale"),
      title: game.i18n.localize("OSE.roll.morale"),
    });
  }

  rollLoyalty(options = {}) {
    const label = game.i18n.localize("OSE.roll.loyalty");
    const rollParts = ["2d6"];

    const actorData = this.system;

    const data = {
      actor: this,
      roll: {
        type: "below",
        target: actorData.retainer.loyalty,
      },
    };

    // Roll and return
    return OseDice.Roll({
      event: options.event,
      parts: rollParts,
      data,
      skipDialog: true,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: label,
      title: label,
    });
  }

  rollReaction(options = {}) {
    const rollParts = ["2d6"];

    const data = {
      actor: this,
      roll: {
        type: "table",
        table: {
          2: game.i18n.format("OSE.reaction.Hostile", {
            name: this.name,
          }),
          3: game.i18n.format("OSE.reaction.Unfriendly", {
            name: this.name,
          }),
          6: game.i18n.format("OSE.reaction.Neutral", {
            name: this.name,
          }),
          9: game.i18n.format("OSE.reaction.Indifferent", {
            name: this.name,
          }),
          12: game.i18n.format("OSE.reaction.Friendly", {
            name: this.name,
          }),
        },
      },
    };

    // Roll and return
    return OseDice.Roll({
      event: options.event,
      parts: rollParts,
      data,
      skipDialog: options.fastForward || skipRollDialogCheck(options.event),
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.localize("OSE.reaction.check"),
      title: game.i18n.localize("OSE.reaction.check"),
    });
  }

  rollCheck(score, options = {}) {
    const actorType = this.type;

    if (actorType !== "character") return;

    const actorData = this.system;

    const label = game.i18n.localize(`OSE.scores.${score}.long`);
    const rollParts = ["1d20"];

    const data = {
      actor: this,
      roll: {
        type: "check",
        target: actorData.scores[score].value,
      },

      details: game.i18n.format("OSE.roll.details.attribute", {
        score: label,
      }),
    };

    // Roll and return
    return OseDice.Roll({
      event: options.event,
      parts: rollParts,
      data,
      skipDialog: options.fastForward || skipRollDialogCheck(options.event),
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format("OSE.roll.attribute", { attribute: label }),
      title: game.i18n.format("OSE.roll.attribute", { attribute: label }),
      chatMessage: options.chatMessage,
    });
  }

  selectSingleOrAllHitDiceRoll(options = {}) {
    const actorData = this.system;

    const label = game.i18n.localize("OSE.roll.hd");
    const level = +actorData.details.level || 1;
    const single = options.hdRollType === "single";

    // Parse the die size out of the HD formula (e.g. "3d8" -> 8, "9d8+2" -> 9 dice, d8, +2).
    // If the HD is malformed/empty, warn and bail rather than silently rolling a d0.
    const parts = /^(\d+)\s*d\s*(\d+)(?:\s*([+-])\s*(\d+))?/i.exec(actorData.hp.hd?.trim() ?? "");
    if (!parts) {
      ui.notifications.warn(
        game.i18n.format("OSE.warn.invalidHitDice", { hd: actorData.hp.hd ?? "" }) ||
          `Cannot roll Hit Dice: invalid HD formula "${actorData.hp.hd ?? ""}".`,
      );
      return;
    }
    const baseDice = Number.parseInt(parts[1], 10);
    const dieSize = parts[2];
    const flatSign = parts[3] === "-" ? -1 : 1;
    const flatBonus = parts[4] ? Number.parseInt(parts[4], 10) * flatSign : 0;

    let rollParts;
    // B/X & BECMI Name-Level progression (e.g. "9d8+2" at Level 10+):
    // Levels past base Hit Dice (Level 9+) gain static flat HP per level without CON modifier.
    if (baseDice >= 8 && flatBonus !== 0) {
      if (single) {
        if (level > baseDice) {
          const flatPerLevel = Math.max(1, Math.round(Math.abs(flatBonus) / (level - baseDice))) * flatSign;
          rollParts = [flatPerLevel >= 0 ? `${flatPerLevel}` : `max(${flatPerLevel}, 1)`];
        } else {
          const conBonus = actorData.scores.con.mod;
          rollParts = [`max(1d${dieSize} + ${conBonus}, 1)`];
        }
      } else {
        const conTotal = actorData.scores.con.mod * baseDice;
        rollParts = [`max(${baseDice}d${dieSize} + ${conTotal}, ${baseDice}) + ${flatBonus}`];
      }
    } else {
      // Standard progression (Levels 1-9):
      // Number of dice and the CON bonus scale with how many levels we're rolling.
      const numDice = single ? 1 : level;
      const conBonus = single ? actorData.scores.con.mod : actorData.scores.con.mod * level;

      // A character always gains at least 1 hit point per Hit Die,
      // regardless of CON modifier (so the floor is the number of dice rolled).
      rollParts = [`max(${numDice}d${dieSize} + ${conBonus}, ${numDice})`];
    }

    const data = {
      actor: this,
      roll: {
        type: "hitdice",
      },
    };

    // Roll and return
    return OseDice.Roll({
      event: options.event,
      parts: rollParts,
      data,
      skipDialog: true,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: label,
      title: label,
    });
  }

  rollHitDice(options = {}) {
    const actorType = this.type;
    // Gygax75 - Roll monster HD like normal with min 1 HP clamp.
    if (actorType !== "character") {
      const actorData = this.system;

      const label = game.i18n.localize("OSE.roll.hd");
      const rollParts = [actorData.hp.hd ? `max(${actorData.hp.hd}, 1)` : "1d8"];

      const data = {
        actor: this,
        roll: {
          type: "hitdice",
        },
      };

      // Roll and return
      return OseDice.Roll({
        event: options.event,
        parts: rollParts,
        data,
        skipDialog: true,
        speaker: ChatMessage.getSpeaker({ actor: this }),
        flavor: label,
        title: label,
      });
    }

    // Gygax75 - Roll character HD from single/all dialog.
    new foundry.applications.api.DialogV2({
      classes: ["ose", "dialog"],
      position: { width: 400, height: "auto" },
      window: {
        title: game.i18n.localize("OSE.dialog.hitDice.title"),
      },
      content: `<form><p>${game.i18n.localize("OSE.dialog.hitDice.prompt")}</p></form>`,
      buttons: [
        {
          action: "single",
          label: game.i18n.localize("OSE.dialog.hitDice.single"),
          callback: () => {
            options.hdRollType = "single";
            this.selectSingleOrAllHitDiceRoll(options);
          },
        },
        {
          action: "all",
          label: game.i18n.localize("OSE.dialog.hitDice.all"),
          callback: () => {
            options.hdRollType = "all";
            this.selectSingleOrAllHitDiceRoll(options);
          },
        },
        {
          action: "close",
          label: game.i18n.localize("OSE.Close"),
          default: true,
        },
      ],
    }).render(true);
  }

  rollAppearing(options = {}) {
    const actorType = this.type;
    if (actorType !== "monster") return;

    const actorData = this.system;

    const rollParts = [];
    let label = "";
    if (options.check === "wilderness") {
      rollParts.push(actorData.details.appearing.w);
      label = game.i18n.localize("OSE.roll.appearingWilderness");
    } else {
      rollParts.push(actorData.details.appearing.d);
      label = game.i18n.localize("OSE.roll.appearingDungeon");
    }
    const data = {
      actor: this,
      roll: {
        type: {
          type: "appearing",
        },
      },
    };

    // Roll and return
    return OseDice.Roll({
      event: options.event,
      parts: rollParts,
      data,
      skipDialog: true,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format("OSE.roll.appearing", { type: label }),
      title: game.i18n.format("OSE.roll.appearing", { type: label }),
    });
  }

  /**
   * @param {import("../config").ExplorationSkill} expl - the exploration skill to test
   * @param {object} options - roll options
   * @param {Event} [options.event] - the originating UI event, used to position the roll dialog
   * @param {boolean} [options.fastForward] - whether to skip the roll dialog
   * @returns {OseDice.Roll | undefined} - the roll, or nothing for a non-character actor
   */
  rollExploration(expl, options = {}) {
    const actorType = this.type;
    if (actorType !== "character") return;
    const actorData = this.system;

    const label = game.i18n.localize(`OSE.exploration.${expl}.long`);
    const rollParts = ["1d6"];

    const data = {
      actor: this,
      roll: {
        type: "below",
        target: actorData.exploration[expl],
        blindroll: true,
      },
      details: game.i18n.format("OSE.roll.details.exploration", {
        expl: label,
      }),
    };

    // Roll and return
    return OseDice.Roll({
      event: options.event,
      parts: rollParts,
      data,
      skipDialog: options.fastForward || skipRollDialogCheck(options.event),
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format("OSE.roll.exploration", { exploration: label }),
      title: game.i18n.format("OSE.roll.exploration", { exploration: label }),
    });
  }

  async rollDamage(attData, options = {}) {
    const data = this.system;

    const rollData = {
      actor: this,
      item: attData.item,
      roll: {
        type: "damage",
      },
    };

    const dmgParts = [];
    if (attData.roll?.dmg) {
      dmgParts.push(attData.roll.dmg);
    } else {
      dmgParts.push("1d6");
    }

    // Add Str to damage
    if (attData.roll?.type === "melee" && data.scores.str.mod) {
      dmgParts.push(data.scores.str.mod);
    }

    // Damage roll
    return OseDice.Roll({
      event: options.event,
      parts: dmgParts,
      data: rollData,
      skipDialog: true,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `${attData.label} - ${game.i18n.localize("OSE.Damage")}`,
      title: `${attData.label} - ${game.i18n.localize("OSE.Damage")}`,
    });
  }

  async targetAttack(data, type, options = {}) {
    if (game.user.targets?.size > 0) {
      for (const t of game.user.targets.values()) {
        if (!data.roll) data.roll = {};
        data.roll.target = t;
        await this.rollAttack(data, {
          ...options,
          type,
        });
      }
    } else {
      await this.rollAttack(data, {
        ...options,
        type,
      });
    }
  }

  #measureTargetDistance(target, options = {}) {
    const explicitDist = Number(options.targetDistance ?? options.distance);
    if (Number.isFinite(explicitDist) && explicitDist > 0) {
      return explicitDist;
    }
    const targetToken = target?.object ?? target;
    const attackerToken =
      this.token?.object ?? this.getActiveTokens?.()?.[0] ?? globalThis.canvas?.tokens?.controlled?.[0];
    if (!attackerToken?.center || !targetToken?.center) return 0;

    if (typeof globalThis.canvas?.grid?.measurePath === "function") {
      try {
        const res = globalThis.canvas.grid.measurePath([attackerToken.center, targetToken.center]);
        if (Number.isFinite(res?.distance) && res.distance > 0) return res.distance;
      } catch {
        // Fallback to Euclidean below
      }
    }
    const gridPixels = Number(globalThis.canvas?.dimensions?.size) || 100;
    const gridUnits = Number(globalThis.canvas?.dimensions?.distance) || 5;
    const dx = attackerToken.center.x - targetToken.center.x;
    const dy = attackerToken.center.y - targetToken.center.y;
    return (Math.hypot(dx, dy) / gridPixels) * gridUnits;
  }

  /**
   * Constructs the attack roll formula for an attack
   *
   * @param {object} attData - the attack data
   * @param {OseItem} attData.item - the item being used in the attack
   * @param {OseActor} attData.actor - this actor (at least it should be!)
   * @param {object} attData.roll - the attack roll data
   * @param {string} attData.roll.save - the save roll that may be used against the attack
   * @param {OseActor} attData.roll.target - the target of the attack
   * @param {object} options - the type of attack and whether to skip the dialog
   * @param {string} options.type - the type of attack, i.e. melee or missile
   * @param {boolean} options.skipDialog - whether to skip the dialog
   * @returns {OseDice.Roll} - the attack roll with completed rollParts and other data
   */
  rollAttack(attData, options = {}) {
    const data = this.system;

    const label = attData.item
      ? game.i18n.format("OSE.roll.attacksWith", {
          name: attData.item.name,
        })
      : game.i18n.format("OSE.roll.attacks", {
          name: this.name,
        });

    const dmgParts = removeFalsyElements([
      // Weapon damage roll value
      attData.item?.system?.damage ?? "1d6",
    ]);

    // Resolve weapon bonus (including conditional vsGroup bonus when a matching target is selected)
    const target = attData.roll?.target ?? options.target;
    const effectiveWeaponBonus = OseActor.resolveWeaponBonus(attData.item, target);

    // Weapon Damage Bonus
    const globalIgnoreAttackBonusOnDamageRoll = game.settings.get(game.system.id, "ignoreAttackBonusOnDamageRoll");

    // Global and per-actor flag to ignore bonus dmg are set
    if (!globalIgnoreAttackBonusOnDamageRoll && !this.system.config?.ignoreBonusDamage && effectiveWeaponBonus) {
      dmgParts.push(effectiveWeaponBonus);
    }

    const rollParts = ["1d20"];
    const ascending = game.settings.get(game.system.id, "ascendingAC");

    if (ascending && data.thac0?.bba) rollParts.push(data.thac0.bba);

    // for each type of attack, add the Tweaks bonus
    // and str/dex modifier only if it's non-zero
    let attackMods = [];

    // Melee: str.mod + thac0.mod.melee go to the attack roll; only the Str
    // modifier also adds to damage (RAW). The melee attack tweak does not.
    if (options.type === "melee") {
      attackMods = [data.scores?.str?.mod, data.thac0?.mod?.melee];
      if (options.twoWeapons) attackMods.push(1);
      if (data.scores?.str?.mod) dmgParts.push(data.scores.str.mod);
    }

    // Missile: dex.mod + thac0.mod.missile go to the attack roll only (RAW: missile
    // attacks get no inherent bonus damage). An explicit damage.mod.missile lever
    // (e.g. from Bless) does add to missile damage.
    if (options.type === "missile") {
      attackMods = [data.scores?.dex?.mod, data.thac0?.mod?.missile];
      if (data.damage?.mod?.missile) dmgParts.push(data.damage.mod.missile);

      const dist = this.#measureTargetDistance(target, options);
      if (dist > 0 && attData.item?.system?.range) {
        const { modifier: rangeMod, outOfRange } = OseActor.computeRangeModifier(attData.item.system.range, dist);
        if (outOfRange) {
          ui.notifications?.warn?.(
            game.i18n?.format?.("OSE.warn.outOfRange", { name: attData.item.name, distance: Math.round(dist) }) ||
              `${attData.item.name} target is beyond maximum range (${Math.round(dist)}').`,
          );
        }
        if (rangeMod !== 0) attackMods.push(rangeMod);
      }
    }

    // Tactical combat modifiers (Retreat / Custom)
    if (options.defenderRetreating) attackMods.push(2);
    if (options.customBonus) attackMods.push(options.customBonus);

    // Add weapon bonus to attack roll only (already added to dmgParts)
    if (attData.item && effectiveWeaponBonus) attackMods.push(effectiveWeaponBonus);

    rollParts.push(...removeFalsyElements(attackMods));

    const rollData = {
      actor: this,
      item: attData.item,
      itemId: attData.item?._id,
      roll: {
        type: options.type,
        thac0: data.thac0.value,
        dmg: dmgParts,
        save: attData.roll?.save,
        target,
      },
    };
    // Roll and return
    return OseDice.Roll({
      event: options.event,
      parts: rollParts,
      data: rollData,
      skipDialog: options.skipDialog,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: label,
      flags: { ose: { roll: "attack", itemId: attData.item?._id } },
      title: label,
      ammoOptions: options.ammoOptions,
      onConfirm: options.onConfirm,
    });
  }

  /**
   * Evaluate weapon/damage-type gating and mitigation on this Actor (silver/magic requirements,
   * immunities, and half-damage resistances).
   */
  evaluateWeaponDamage(rawDamage, { weapon = null, ammo = null, damageType = "" } = {}) {
    const sys = this.system ?? {};
    const details = sys.details ?? {};
    const requiresMagicBonus =
      Number(details.requiresMagicBonus ?? sys.requiresMagicBonus) ||
      (details.requiresMagic || sys.OnlyHurtByMagic ? 1 : 0);
    const requiresSilver = Boolean(details.requiresSilver || sys.OnlyHurtBySilver);
    const toList = (val) =>
      Array.isArray(val)
        ? val.map((v) => String(v).toLowerCase().trim()).filter(Boolean)
        : typeof val === "string"
          ? val
              .split(",")
              .map((v) => v.toLowerCase().trim())
              .filter(Boolean)
          : [];
    const immuneTo = toList(details.immuneTo ?? sys.immuneTo);
    const halfDamageFrom = toList(details.halfDamageFrom ?? sys.halfDamageFrom);

    if (!requiresMagicBonus && !requiresSilver && !immuneTo.length && !halfDamageFrom.length) {
      return { damage: rawDamage, amount: rawDamage, immune: false, halved: false, reason: null };
    }

    const weaponBonus = OseActor.resolveWeaponBonus(weapon, this);
    const ammoBonus = OseItem.extractAmmoBonus(ammo);
    const effectiveBonus = Math.max(weaponBonus, ammoBonus);

    const tags = [
      ...(weapon?.system?.tags ?? []).map((t) => String(t.value ?? "").toLowerCase()),
      ...(ammo?.system?.tags ?? []).map((t) => String(t.value ?? "").toLowerCase()),
    ];
    const names = `${weapon?.name ?? ""} ${ammo?.name ?? ""}`.toLowerCase();
    const isSilver = tags.includes("silver") || names.includes("silver");
    const isMagic = effectiveBonus > 0 || tags.includes("magic") || tags.includes("magical");

    if (requiresMagicBonus > 0 && effectiveBonus < requiresMagicBonus) {
      if (!(requiresSilver && isSilver)) {
        return { damage: 0, amount: 0, immune: true, halved: false, reason: "requiresMagic" };
      }
    } else if (requiresSilver && !isSilver && !isMagic) {
      return { damage: 0, amount: 0, immune: true, halved: false, reason: "requiresSilver" };
    }

    const activeTypes = new Set(tags);
    if (damageType) activeTypes.add(String(damageType).toLowerCase().trim());

    if (immuneTo.some((t) => activeTypes.has(t))) {
      return { damage: 0, amount: 0, immune: true, halved: false, reason: "immuneType" };
    }

    if (halfDamageFrom.some((t) => activeTypes.has(t))) {
      const halvedAmt = Math.floor(rawDamage / 2);
      return { damage: halvedAmt, amount: halvedAmt, immune: false, halved: true, reason: "halfDamage" };
    }

    return { damage: rawDamage, amount: rawDamage, immune: false, halved: false, reason: null };
  }

  /**
   * @param {number | string} amount
   * @param {1 | -1} multiplier
   * @param {object} [options]
   * @returns
   */
  async applyDamage(amount = 0, multiplier = 1, options = {}) {
    let damage = Math.floor(Number.parseInt(amount, 10) * multiplier);

    if (damage > 0 && (options.weapon || options.ammo || options.damageType)) {
      const evalResult = this.evaluateWeaponDamage(damage, options);
      if (evalResult.immune) {
        ui.notifications?.warn?.(`${this.name} is immune to this attack (${evalResult.reason}).`);
        return this;
      }
      damage = evalResult.damage;
    }

    const { value, max } = this.system.hp;

    // Update the Actor
    return this.update({
      "system.hp.value": Math.clamp(value - damage, 0, max),
    });
  }
}
