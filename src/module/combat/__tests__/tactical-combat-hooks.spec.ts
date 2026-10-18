import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getActorEffects,
  handlePreUpdateActorHealing,
  handlePreCreateChatMessageSpeed,
  registerTacticalCombatHooks,
} from "../tactical-combat-hooks";

describe("Tactical Combat Hooks (Gygax '75)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("handlePreUpdateActorHealing", () => {
    it("warns in chat when an actor with active Poison effect is healed", () => {
      const actor = {
        name: "Valerius",
        system: { hp: { value: 4, max: 10 } },
        effects: [
          {
            name: "Poisoned",
            disabled: false,
            flags: {},
          },
        ],
      };

      const updateData = {
        system: { hp: { value: 8 } },
      };

      (game as any).users = {
        get: vi.fn().mockReturnValue({ name: "DM Justin" }),
      };

      handlePreUpdateActorHealing(actor, updateData, {}, "user-123");

      expect((ChatMessage as any).create).toHaveBeenCalledTimes(1);
      const callArg = (ChatMessage as any).create.mock.calls[0][0];
      expect(callArg.content).toContain("⚠️ Healing Warning");
      expect(callArg.content).toContain("Valerius");
      expect(callArg.content).toContain("4");
      expect(callArg.content).toContain("8");
      expect(callArg.content).toContain("DM Justin");
      expect(callArg.content).toContain("Poisoned / Diseased");
    });

    it("warns when an actor with active Diseased effect is healed", () => {
      const actor = {
        name: "Elric",
        system: { hp: { value: 2, max: 8 } },
        effects: [
          {
            name: "Diseased (Rot)",
            disabled: false,
          },
        ],
      };

      const updateData = {
        system: { hp: { value: 6 } },
      };

      handlePreUpdateActorHealing(actor, updateData, {}, "user-gm");

      expect((ChatMessage as any).create).toHaveBeenCalledTimes(1);
      const callArg = (ChatMessage as any).create.mock.calls[0][0];
      expect(callArg.content).toContain("Elric");
    });

    it("warns when an actor has an effect with flags.ose.preventsHealing", () => {
      const actor = {
        name: "Morwen",
        system: { hp: { value: 1, max: 6 } },
        effects: [
          {
            name: "Cursed Wound",
            disabled: false,
            flags: { ose: { preventsHealing: true } },
          },
        ],
      };

      const updateData = {
        system: { hp: { value: 5 } },
      };

      handlePreUpdateActorHealing(actor, updateData, {}, "user-gm");

      expect((ChatMessage as any).create).toHaveBeenCalledTimes(1);
    });

    it("does not warn when the poison effect is disabled", () => {
      const actor = {
        name: "Valerius",
        system: { hp: { value: 4, max: 10 } },
        effects: [
          {
            name: "Poisoned",
            disabled: true,
          },
        ],
      };

      const updateData = {
        system: { hp: { value: 8 } },
      };

      handlePreUpdateActorHealing(actor, updateData, {}, "user-123");

      expect((ChatMessage as any).create).not.toHaveBeenCalled();
    });

    it("does not warn when actor takes damage (HP decreases)", () => {
      const actor = {
        name: "Valerius",
        system: { hp: { value: 8, max: 10 } },
        effects: [
          {
            name: "Poisoned",
            disabled: false,
          },
        ],
      };

      const updateData = {
        system: { hp: { value: 4 } },
      };

      handlePreUpdateActorHealing(actor, updateData, {}, "user-123");

      expect((ChatMessage as any).create).not.toHaveBeenCalled();
    });

    it("does not warn when update has no HP change", () => {
      const actor = {
        name: "Valerius",
        system: { hp: { value: 8, max: 10 } },
        effects: [
          {
            name: "Poisoned",
            disabled: false,
          },
        ],
      };

      const updateData = {
        name: "Valerius the Bold",
      };

      handlePreUpdateActorHealing(actor, updateData, {}, "user-123");

      expect((ChatMessage as any).create).not.toHaveBeenCalled();
    });

    it("does not warn when healed actor has no poison or disease effects", () => {
      const actor = {
        name: "Valerius",
        system: { hp: { value: 4, max: 10 } },
        effects: [
          {
            name: "Bless",
            disabled: false,
          },
        ],
      };

      const updateData = {
        system: { hp: { value: 8 } },
      };

      handlePreUpdateActorHealing(actor, updateData, {}, "user-123");

      expect((ChatMessage as any).create).not.toHaveBeenCalled();
    });
    it("warns on case-insensitive disease or poison variants", () => {
      const actor = {
        name: "Thorin",
        system: { hp: { value: 3, max: 10 } },
        effects: [
          {
            name: "Mummy disease",
            disabled: false,
          },
        ],
      };

      handlePreUpdateActorHealing(actor, { system: { hp: { value: 7 } } }, {}, "user-gm");
      expect((ChatMessage as any).create).toHaveBeenCalledTimes(1);

      vi.clearAllMocks();
      actor.effects = [{ name: "spider poison", disabled: false }];
      handlePreUpdateActorHealing(actor, { system: { hp: { value: 9 } } }, {}, "user-gm");
      expect((ChatMessage as any).create).toHaveBeenCalledTimes(1);
    });
  });

  describe("handlePreCreateChatMessageSpeed", () => {
    it("appends extra attack banner to attack rolls when speaker has Haste", () => {
      const hastedActor = {
        name: "Alanna",
        effects: [
          {
            name: "Haste",
            disabled: false,
          },
        ],
      };

      const message: any = {
        speaker: { _actor: hastedActor },
        flags: { ose: { rollType: "attack" } },
        content: "<div>Attack Roll: 18</div>",
        updateSource: vi.fn(),
      };

      handlePreCreateChatMessageSpeed(message, {});

      expect(message.updateSource).toHaveBeenCalledTimes(1);
      const updated = message.updateSource.mock.calls[0][0];
      expect(updated.content).toContain("⚡ <b>Extra Attack:</b>");
      expect(updated.content).toContain("Character may make an additional attack this round!");
    });

    it("appends extra attack banner via direct property assignment if updateSource is not a function", () => {
      const speedActor = {
        name: "Boran",
        effects: [
          {
            name: "Speed of the Heroes",
            disabled: false,
          },
        ],
      };

      const message: any = {
        speaker: { _actor: speedActor },
        flavor: "Sword Attack Roll",
        content: "<div>Attack Roll: 15</div>",
      };

      handlePreCreateChatMessageSpeed(message, {});

      expect(message.content).toContain("⚡ <b>Extra Attack:</b>");
    });

    it("detects speed from flags.ose.isSpeed", () => {
      const potionActor = {
        name: "Celia",
        effects: [
          {
            name: "Potion of Speed",
            disabled: false,
            flags: { ose: { isSpeed: true } },
          },
        ],
      };

      const message: any = {
        speaker: { _actor: potionActor },
        flags: { ose: { roll: "attack" } },
        content: "<div>Bow Attack: 19</div>",
        updateSource: vi.fn(),
      };

      handlePreCreateChatMessageSpeed(message, {});

      expect(message.updateSource).toHaveBeenCalledTimes(1);
    });

    it("does not trigger extra attack banner on negative speed debuffs", () => {
      const debuffedActor = {
        name: "Slowpoke",
        effects: [
          {
            name: "Reduced Speed",
            disabled: false,
          },
        ],
      };

      const message: any = {
        speaker: { _actor: debuffedActor },
        flags: { ose: { rollType: "attack" } },
        content: "<div>Attack: 12</div>",
        updateSource: vi.fn(),
      };

      handlePreCreateChatMessageSpeed(message, {});
      expect(message.updateSource).not.toHaveBeenCalled();
    });

    it("does not inject duplicate extra attack banner if already present", () => {
      const hastedActor = {
        name: "Speedy",
        effects: [{ name: "Haste", disabled: false }],
      };

      const message: any = {
        speaker: { _actor: hastedActor },
        flags: { ose: { rollType: "attack" } },
        content: `<div>Attack: 18</div><div class="ose-hasted-note">⚡ <b>Extra Attack:</b> Character may make an additional attack this round!</div>`,
        updateSource: vi.fn(),
      };

      handlePreCreateChatMessageSpeed(message, {});
      expect(message.updateSource).not.toHaveBeenCalled();
    });

    it("does nothing if the speed effect is disabled", () => {
      const actor = {
        name: "Doran",
        effects: [
          {
            name: "Haste",
            disabled: true,
          },
        ],
      };

      const message: any = {
        speaker: { _actor: actor },
        flags: { ose: { rollType: "attack" } },
        content: "<div>Attack Roll: 14</div>",
        updateSource: vi.fn(),
      };

      handlePreCreateChatMessageSpeed(message, {});

      expect(message.updateSource).not.toHaveBeenCalled();
    });

    it("does nothing for non-attack messages (e.g. saving throw)", () => {
      const actor = {
        name: "Alanna",
        effects: [
          {
            name: "Haste",
            disabled: false,
          },
        ],
      };

      const message: any = {
        speaker: { _actor: actor },
        flags: { ose: { rollType: "save" } },
        flavor: "Save vs Spells",
        content: "<div>Save: 12</div>",
        updateSource: vi.fn(),
      };

      handlePreCreateChatMessageSpeed(message, {});

      expect(message.updateSource).not.toHaveBeenCalled();
    });

    it("does nothing if message has no speaker or speaker actor", () => {
      const message: any = {
        speaker: null,
        flags: { ose: { rollType: "attack" } },
        content: "<div>Attack Roll: 14</div>",
        updateSource: vi.fn(),
      };

      handlePreCreateChatMessageSpeed(message, {});

      expect(message.updateSource).not.toHaveBeenCalled();
    });
  });

  describe("getActorEffects", () => {
    it("extracts values from Map or iterable collections", () => {
      const effectMap = new Map([
        ["eff1", { name: "Bless", disabled: false }],
        ["eff2", { name: "Shield", disabled: true }],
      ]);
      const actor = { effects: effectMap };
      const result = getActorEffects(actor);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Bless");
      expect(result[1].name).toBe("Shield");
    });
  });

  describe("registerTacticalCombatHooks", () => {
    it("registers preUpdateActor and preCreateChatMessage on Hooks", () => {
      registerTacticalCombatHooks();

      expect((Hooks as any).on).toHaveBeenCalledWith("preUpdateActor", handlePreUpdateActorHealing);
      expect((Hooks as any).on).toHaveBeenCalledWith("preCreateChatMessage", handlePreCreateChatMessageSpeed);
    });
  });
});
