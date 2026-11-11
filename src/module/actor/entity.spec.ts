import { describe, expect, it, vi } from "vitest";
import OseDice from "../helpers-dice.js";
import OseActor from "./entity";

type ActorCtor = new (data?: Record<string, unknown>) => OseActor;
const createActor = (data: Record<string, unknown> = {}): OseActor => new (OseActor as unknown as ActorCtor)(data);

interface DialogButtonOption {
  action?: string;
}

describe("OseActor Hit Dice, Creature Groups & Class Item Gating (Gygax '75)", () => {
  it("opens a DialogV2 for characters with Single Level and All Levels buttons and returns a Promise", async () => {
    const actor = createActor({
      id: "char-1",
      type: "character",
      system: {
        hp: { hd: "1d8" },
        details: { level: 1 },
        scores: { con: { mod: 0 } },
      },
    });

    let closeHandler: (() => void) | undefined;
    const dialogSpy = vi.spyOn(foundry.applications.api, "DialogV2").mockImplementation(function (
      this: Record<string, unknown>,
      opts: Record<string, unknown>,
    ) {
      this.options = opts;
      this.addEventListener = (ev: string, fn: () => void) => {
        if (ev === "close") closeHandler = fn;
      };
      this.render = vi.fn().mockReturnValue(this);
    } as unknown as typeof foundry.applications.api.DialogV2);

    try {
      const pending = actor.rollHitDice();
      expect(pending).toBeInstanceOf(Promise);
      expect(dialogSpy).toHaveBeenCalledTimes(1);

      const options = dialogSpy.mock.calls[0]?.[0] as unknown as {
        classes: string[];
        position: { width: number; height: string };
        buttons: DialogButtonOption[];
      };
      expect(options.classes).toContain("ose");
      expect(options.classes).toContain("dialog");
      expect(options.position).toEqual({ width: 400, height: "auto" });
      expect(options.buttons.some((b) => b.action === "single")).toBe(true);
      expect(options.buttons.some((b) => b.action === "all")).toBe(true);

      closeHandler?.();
      await expect(pending).resolves.toBe(false);
    } finally {
      dialogSpy.mockRestore();
    }
  });

  it("calculates correct roll formulas for standard progression (Levels 1-9) with min 1 HP per die", () => {
    let rolledParts: string[] = [];
    const rollSpy = vi.spyOn(OseDice, "Roll").mockImplementation(((data: { parts: string[] }) => {
      rolledParts = data.parts;
      return data;
    }) as never);

    try {
      const actorLvl1 = createActor({
        id: "char-lvl1",
        type: "character",
        system: {
          hp: { hd: "1d8" },
          details: { level: 1 },
          scores: { con: { mod: 1 } },
        },
      });

      actorLvl1.selectSingleOrAllHitDiceRoll({ hdRollType: "single" });
      expect(rolledParts[0]).toBe("max(1d8 + 1, 1)");

      actorLvl1.selectSingleOrAllHitDiceRoll({ hdRollType: "all" });
      expect(rolledParts[0]).toBe("max(1d8 + 1, 1)");

      const actorLvl3 = createActor({
        id: "char-lvl3",
        type: "character",
        system: {
          hp: { hd: "3d8" },
          details: { level: 3 },
          scores: { con: { mod: -2 } },
        },
      });

      actorLvl3.selectSingleOrAllHitDiceRoll({ hdRollType: "single" });
      expect(rolledParts[0]).toBe("max(1d8 + -2, 1)");

      actorLvl3.selectSingleOrAllHitDiceRoll({ hdRollType: "all" });
      expect(rolledParts[0]).toBe("max(3d8 + -6, 3)");
    } finally {
      rollSpy.mockRestore();
    }
  });

  it("preserves flatBonus when baseDice < 8 (e.g. 2d6+2 and 1d6-1)", () => {
    let rolledParts: string[] = [];
    const rollSpy = vi.spyOn(OseDice, "Roll").mockImplementation(((data: { parts: string[] }) => {
      rolledParts = data.parts;
      return data;
    }) as never);

    try {
      const actor2d6Plus2 = createActor({
        id: "char-2d6plus2",
        type: "character",
        system: {
          hp: { hd: "2d6+2" },
          details: { level: 2 },
          scores: { con: { mod: 1 } },
        },
      });

      actor2d6Plus2.selectSingleOrAllHitDiceRoll({ hdRollType: "all" });
      expect(rolledParts[0]).toBe("max(2d6 + 2, 2) + 2");

      actor2d6Plus2.selectSingleOrAllHitDiceRoll({ hdRollType: "single" });
      expect(rolledParts[0]).toBe("max(1d6 + 1, 1) + 1");

      const actor1d6Minus1 = createActor({
        id: "char-1d6minus1",
        type: "character",
        system: {
          hp: { hd: "1d6-1" },
          details: { level: 1 },
          scores: { con: { mod: 0 } },
        },
      });

      actor1d6Minus1.selectSingleOrAllHitDiceRoll({ hdRollType: "all" });
      expect(rolledParts[0]).toBe("max(1d6 + 0 - 1, 1)");
    } finally {
      rollSpy.mockRestore();
    }
  });

  it("calculates correct roll formulas for Name-Level progression (Level 10+, e.g. 9d8+2)", () => {
    let rolledParts: string[] = [];
    const rollSpy = vi.spyOn(OseDice, "Roll").mockImplementation(((data: { parts: string[] }) => {
      rolledParts = data.parts;
      return data;
    }) as never);

    try {
      const actorLvl10 = createActor({
        id: "char-lvl10",
        type: "character",
        system: {
          hp: { hd: "9d8+2" },
          details: { level: 10 },
          scores: { con: { mod: 2 } },
        },
      });

      actorLvl10.selectSingleOrAllHitDiceRoll({ hdRollType: "single" });
      expect(rolledParts[0]).toBe("2");

      actorLvl10.selectSingleOrAllHitDiceRoll({ hdRollType: "all" });
      expect(rolledParts[0]).toBe("max(9d8 + 18, 9) + 2");

      const actorLvl12 = createActor({
        id: "char-lvl12",
        type: "character",
        system: {
          hp: { hd: "9d8+6" },
          details: { level: 12 },
          scores: { con: { mod: 1 } },
        },
      });

      actorLvl12.selectSingleOrAllHitDiceRoll({ hdRollType: "single" });
      expect(rolledParts[0]).toBe("2");

      actorLvl12.selectSingleOrAllHitDiceRoll({ hdRollType: "all" });
      expect(rolledParts[0]).toBe("max(9d8 + 9, 9) + 6");
    } finally {
      rollSpy.mockRestore();
    }
  });

  it("clamps monster HD rolls and rollHP() to minimum 1 HP", async () => {
    let rolledParts: string[] = [];
    const rollSpy = vi.spyOn(OseDice, "Roll").mockImplementation(((data: { parts: string[] }) => {
      rolledParts = data.parts;
      return data;
    }) as never);

    try {
      const monster = createActor({
        id: "monster-1",
        type: "monster",
        system: {
          hp: { hd: "1d4-2" },
        },
      });

      monster.rollHitDice();
      expect(rolledParts[0]).toBe("max(1d4-2, 1)");

      const origRoll = globalThis.Roll;
      (globalThis as unknown as { Roll: unknown }).Roll = class {
        async evaluate() {
          return { total: -2 };
        }
      };
      const updateSpy = vi.spyOn(monster, "update").mockResolvedValue(monster);
      try {
        await monster.rollHP();
        expect(updateSpy).toHaveBeenCalledWith({ "system.hp": { max: 1, value: 1 } });
      } finally {
        (globalThis as unknown as { Roll: unknown }).Roll = origRoll;
      }
    } finally {
      rollSpy.mockRestore();
    }
  });

  it("warns and aborts if Hit Dice formula is invalid", () => {
    const actor = createActor({
      id: "char-invalid",
      type: "character",
      system: {
        hp: { hd: "invalid-formula" },
        details: { level: 1 },
      },
    });

    const warnSpy = vi.spyOn(ui.notifications, "warn").mockImplementation((() => ({})) as never);

    try {
      const result = actor.selectSingleOrAllHitDiceRoll({ hdRollType: "single" });
      expect(result).toBeUndefined();
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  describe("matchesCreatureGroup word boundaries & HTML stripping", () => {
    it("matches whole creature words and plurals while rejecting substring and biography false positives", () => {
      // Positive matches
      expect(OseActor.matchesCreatureGroup({ name: "Orc Chieftain" }, "giants")).toBe(true);
      expect(OseActor.matchesCreatureGroup({ name: "Black Orcs" }, "orc")).toBe(true);
      expect(OseActor.matchesCreatureGroup({ name: "Shadow" }, "undead")).toBe(true);
      expect(OseActor.matchesCreatureGroup({ name: "Bog Mummies" }, "undead")).toBe(true);
      expect(OseActor.matchesCreatureGroup({ name: "Dire Wolf" }, "wolves")).toBe(true);
      expect(OseActor.matchesCreatureGroup({ name: "Winter Wolves" }, "wolves")).toBe(true);
      expect(
        OseActor.matchesCreatureGroup(
          { name: "Sir Morvain", system: { details: { creatureType: "<b>Undead</b>" } } },
          "undead",
        ),
      ).toBe(true);

      // False-positive rejections ("orc" inside sorcerer/torchbearer/porcupine, "shadow" in Thief bio/CSS)
      expect(OseActor.matchesCreatureGroup({ name: "Human Sorcerer" }, "giants")).toBe(false);
      expect(OseActor.matchesCreatureGroup({ name: "Torchbearer" }, "orc")).toBe(false);
      expect(OseActor.matchesCreatureGroup({ name: "Giant Porcupine" }, "orc")).toBe(false);
      expect(OseActor.matchesCreatureGroup({ name: "Wolverine" }, "wolves")).toBe(false);
      expect(
        OseActor.matchesCreatureGroup(
          {
            name: "Garrett",
            system: {
              details: {
                class: "Thief",
                biography: '<p style="box-shadow: 0 0 4px #000">Hides in shadows on 1-2 in 6.</p>',
              },
            },
          },
          "undead",
        ),
      ).toBe(false);
    });
  });

  describe("enableClassItems setting gate", () => {
    it("routes getExperience to system.details.xp.value and blocks addClass/setRace when enableClassItems is false", async () => {
      await game.settings.set("ose" as "core", "enableClassItems" as never, false as never);

      const residualClass = { id: "cls-1", system: { key: "fighter", level: 1, xp: 0, tables: [] } };
      const actor = createActor({
        id: "char-legacy",
        name: "Aldous",
        type: "character",
        system: {
          classes: [residualClass],
          details: { xp: { value: 100, bonus: 10 } },
        },
      });

      const updateSpy = vi.spyOn(actor, "update").mockResolvedValue(actor);
      const embedSpy = vi.fn().mockResolvedValue([]);
      (actor as unknown as { updateEmbeddedDocuments: typeof embedSpy }).updateEmbeddedDocuments = embedSpy;

      await actor.getExperience(200);
      expect(embedSpy).not.toHaveBeenCalled();
      expect(updateSpy).toHaveBeenCalledWith({ "system.details.xp.value": 320 });

      const addedClass = await actor.addClass({ name: "Fighter", type: "class", system: {} });
      const addedRace = await actor.setRace({ name: "Dwarf", type: "race", system: {} });
      expect(addedClass).toBeUndefined();
      expect(addedRace).toBeUndefined();
    });
  });
});
