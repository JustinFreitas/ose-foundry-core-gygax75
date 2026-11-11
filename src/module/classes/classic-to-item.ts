/**
 * @file Converts bundled Classic Fantasy & Gygax 75 class tables into class item data.
 */
import type { ClassicClassName, OseClass } from "../../types/classes";
import type { ClassItemData } from "../item/item-types";
import { toKey } from "./matching";
import { type ClassLevelRow, defaultPrimeReqs, type PrimeReq, SAVE_KEYS, type SaveKey } from "./progression";

export const CLASSIC_PRIME_REQS: Record<ClassicClassName, string[]> = {
  Cleric: ["wis"],
  Dwarf: ["str"],
  Elf: ["int", "str"],
  Fighter: ["str"],
  Halfling: ["dex", "str"],
  "Magic-User": ["int"],
  Thief: ["dex"],
};

export const GYGAX75_PRIME_REQS: Record<string, PrimeReq[]> = {
  Barbarian: [
    { ability: "con", minScore: 13, percentage: 5, concatLogic: "or" },
    { ability: "str", minScore: 13, percentage: 5, concatLogic: "or" },
    { ability: "con", minScore: 16, percentage: 10, concatLogic: "and" },
    { ability: "str", minScore: 16, percentage: 10, concatLogic: "and" },
  ],
  Druid: defaultPrimeReqs(["wis"]),
  Gnome: [
    { ability: "dex", minScore: 13, percentage: 5, concatLogic: "and" },
    { ability: "int", minScore: 13, percentage: 5, concatLogic: "and" },
    { ability: "dex", minScore: 13, percentage: 10, concatLogic: "and" },
    { ability: "int", minScore: 16, percentage: 10, concatLogic: "and" },
  ],
  "Half-Orc": defaultPrimeReqs(["dex", "str"]),
  Knight: defaultPrimeReqs(["str"]),
  Warden: defaultPrimeReqs(["str"]),
  "Wood Elf": [
    { ability: "dex", minScore: 13, percentage: 5, concatLogic: "and" },
    { ability: "wis", minScore: 13, percentage: 5, concatLogic: "and" },
    { ability: "dex", minScore: 16, percentage: 10, concatLogic: "and" },
    { ability: "wis", minScore: 13, percentage: 10, concatLogic: "and" },
  ],
};

const DEMIHUMAN_CLASSES = new Set(["Dwarf", "Elf", "Gnome", "Half-Orc", "Halfling", "Wood Elf"]);

// Classes casting from a specific spell list.
const SPELL_LISTS: Record<string, string> = {
  Druid: "Druid",
  Elf: "Magic-User",
  Gnome: "Illusionist",
  "Wood Elf": "Druid",
};

// Usually game.i18n.format; injectable for tests.
type Translate = (key: string, data?: Record<string, string>) => string;

export const classicClassToItemData = (
  cls: OseClass,
  primeReqAbilities: string[] = [],
  t: Translate = (key) => key,
) => {
  const levels: ClassLevelRow[] = cls.levels.map((l) => ({
    xp: l.xp,
    hd: l.hd,
    hdcon: !/\+/.test(l.hd),
    thac0: l.thac0,
    bba: 19 - l.thac0,
    saves: Object.fromEntries(SAVE_KEYS.map((k, i) => [k, l.saves[i] ?? 0])) as Record<SaveKey, number>,
    spellSlots: Object.fromEntries(
      (l.spells ?? []).flatMap((n, i) => (n ? [[String(i + 1), n] as [string, number]] : [])),
    ),
  }));
  const primeReqs = primeReqAbilities.length
    ? defaultPrimeReqs(primeReqAbilities)
    : (GYGAX75_PRIME_REQS[cls.name] ?? defaultPrimeReqs(CLASSIC_PRIME_REQS[cls.name as ClassicClassName] ?? []));
  const system: Partial<ClassItemData> = {
    key: toKey(cls.name),
    requirements: Object.fromEntries(Object.entries(cls.requirements).map(([k, v]) => [k, { min: v, max: null }])),
    demihuman: DEMIHUMAN_CLASSES.has(cls.name),
    primeReqs: primeReqs.map((r) => ({ ...r })),
    maxLevel: levels.length,
    spellList: SPELL_LISTS[cls.name] ?? "",
    tables: cls.skillChecks?.length
      ? [
          {
            key: "skills",
            label: t("OSE.classes.skills.Table", { cls: cls.name }),
            columns: Object.keys(cls.skillChecks[0] ?? {}).map((key) => ({
              key,
              name: t(`OSE.classes.skills.${key}Name`),
            })),
            rows: cls.skillChecks.map((r) => ({ ...r })),
          },
        ]
      : [],
    hitDie: `1${/d\d+/.exec(cls.levels[0]?.hd ?? "")?.[0] ?? "d6"}`,
    levels,
  };
  return { name: cls.name, type: "class" as const, system };
};
