import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getActorEffects,
  handlePreCreateChatMessageSpeed,
  handlePreUpdateActorHealing,
  registerTacticalCombatHooks,
  type TacticalActorLike,
  type TacticalChatMessageLike,
} from "../tactical-combat-hooks";

interface MockChatMessageStatic {
  create: ReturnType<typeof vi.fn>;
}

interface MockGameUsers {
  users?: {
    get: ReturnType<typeof vi.fn>;
  };
}

interface MockHooksStatic {
  on: ReturnType<typeof vi.fn>;
}

const getChatMessageMock = (): MockChatMessageStatic => ChatMessage as unknown as MockChatMessageStatic;

describe("Tactical Combat Hooks (Gygax '75)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("handlePreUpdateActorHealing", () => {
    it("warns in chat when an actor with active Poison effect is healed", () => {
      const actor: TacticalActorLike = {
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

      (game as unknown as MockGameUsers).users = {
        get: vi.fn().mockReturnValue({ name: "DM Justin" }),
      };

      handlePreUpdateActorHealing(actor, updateData, {}, "user-123");

      const createMock = getChatMessageMock().create;
      expect(createMock).toHaveBeenCalledTimes(1);
      const callArg = createMock.mock.calls[0]?.[0] as { content: string };
      expect(callArg.content).toContain("⚠️ Healing Warning");
      expect(callArg.content).toContain("Valerius");
      expect(callArg.content).toContain("4");
      expect(callArg.content).toContain("8");
      expect(callArg.content).toContain("DM Justin");
      expect(callArg.content).toContain("Poisoned / Diseased");
    });

    it("escapes HTML in actorName and userName when posting healing warnings", () => {
      const escapeSpy = vi.spyOn(foundry.utils, "escapeHTML");
      const actor: TacticalActorLike = {
        name: "<img src=x onerror=alert(1)>",
        system: { hp: { value: 2, max: 10 } },
        effects: [{ name: "Poisoned", disabled: false }],
      };

      (game as unknown as MockGameUsers).users = {
        get: vi.fn().mockReturnValue({ name: "<b>Malicious</b>" }),
      };

      handlePreUpdateActorHealing(actor, { system: { hp: { value: 6 } } }, {}, "user-xss");

      expect(escapeSpy).toHaveBeenCalledWith("<img src=x onerror=alert(1)>");
      expect(escapeSpy).toHaveBeenCalledWith("<b>Malicious</b>");
      const createMock = getChatMessageMock().create;
      expect(createMock).toHaveBeenCalledTimes(1);
      const callArg = createMock.mock.calls[0]?.[0] as { content: string };
      expect(callArg.content).not.toContain("<img src=x");
      expect(callArg.content).toContain("&lt;img src=x onerror=alert(1)&gt;");
      expect(callArg.content).toContain("&lt;b&gt;Malicious&lt;/b&gt;");
    });

    it("ignores max-HP level-up increases where hp.max rises by at least the hp.value gain", () => {
      const actor: TacticalActorLike = {
        name: "Valerius",
        system: { hp: { value: 4, max: 10 } },
        effects: [{ name: "Poisoned", disabled: false }],
      };

      // Level up gaining +5 max HP and +5 current HP
      handlePreUpdateActorHealing(actor, { system: { hp: { value: 9, max: 15 } } }, {}, "user-gm");
      expect(getChatMessageMock().create).not.toHaveBeenCalled();
    });

    it("warns when an actor with active Diseased effect is healed", () => {
      const actor: TacticalActorLike = {
        name: "Elric",
        system: { hp: { value: 2, max: 8 } },
        effects: [
          {
            name: "Diseased (Rot)",
            disabled: false,
          },
        ],
      };

      handlePreUpdateActorHealing(actor, { system: { hp: { value: 6 } } }, {}, "user-gm");

      const createMock = getChatMessageMock().create;
      expect(createMock).toHaveBeenCalledTimes(1);
      const callArg = createMock.mock.calls[0]?.[0] as { content: string };
      expect(callArg.content).toContain("Elric");
    });

    it("warns when an actor has an effect with flags.ose.preventsHealing", () => {
      const actor: TacticalActorLike = {
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

      handlePreUpdateActorHealing(actor, { system: { hp: { value: 5 } } }, {}, "user-gm");
      expect(getChatMessageMock().create).toHaveBeenCalledTimes(1);
    });

    it("does not warn when the poison effect is disabled or suppressed", () => {
      const actor: TacticalActorLike = {
        name: "Valerius",
        system: { hp: { value: 4, max: 10 } },
        appliedEffects: [
          { name: "Poisoned", disabled: true },
          { name: "Diseased", disabled: false, isSuppressed: true },
        ],
      };

      handlePreUpdateActorHealing(actor, { system: { hp: { value: 8 } } }, {}, "user-123");
      expect(getChatMessageMock().create).not.toHaveBeenCalled();
    });

    it("does not warn when actor takes damage (HP decreases)", () => {
      const actor: TacticalActorLike = {
        name: "Valerius",
        system: { hp: { value: 8, max: 10 } },
        effects: [{ name: "Poisoned", disabled: false }],
      };

      handlePreUpdateActorHealing(actor, { system: { hp: { value: 4 } } }, {}, "user-123");
      expect(getChatMessageMock().create).not.toHaveBeenCalled();
    });

    it("does not warn when update has no HP change", () => {
      const actor: TacticalActorLike = {
        name: "Valerius",
        system: { hp: { value: 8, max: 10 } },
        effects: [{ name: "Poisoned", disabled: false }],
      };

      handlePreUpdateActorHealing(actor, { name: "Valerius the Bold" }, {}, "user-123");
      expect(getChatMessageMock().create).not.toHaveBeenCalled();
    });

    it("does not warn when healed actor has no poison or disease effects", () => {
      const actor: TacticalActorLike = {
        name: "Valerius",
        system: { hp: { value: 4, max: 10 } },
        effects: [{ name: "Bless", disabled: false }],
      };

      handlePreUpdateActorHealing(actor, { system: { hp: { value: 8 } } }, {}, "user-123");
      expect(getChatMessageMock().create).not.toHaveBeenCalled();
    });

    it("warns on case-insensitive disease or poison variants", () => {
      const actor: TacticalActorLike = {
        name: "Thorin",
        system: { hp: { value: 3, max: 10 } },
        effects: [{ name: "Mummy disease", disabled: false }],
      };

      handlePreUpdateActorHealing(actor, { system: { hp: { value: 7 } } }, {}, "user-gm");
      expect(getChatMessageMock().create).toHaveBeenCalledTimes(1);

      vi.clearAllMocks();
      actor.effects = [{ name: "spider poison", disabled: false }];
      handlePreUpdateActorHealing(actor, { system: { hp: { value: 9 } } }, {}, "user-gm");
      expect(getChatMessageMock().create).toHaveBeenCalledTimes(1);
    });
  });

  describe("handlePreCreateChatMessageSpeed", () => {
    it("appends extra attack banner to attack rolls when speaker has Haste (including via appliedEffects)", () => {
      const hastedActor: TacticalActorLike = {
        name: "Alanna",
        appliedEffects: [{ name: "Haste", disabled: false }],
        effects: [],
      };

      const updateSource = vi.fn();
      const message: TacticalChatMessageLike = {
        speaker: { _actor: hastedActor },
        flags: { ose: { rollType: "attack" } },
        content: "<div>Attack Roll: 18</div>",
        updateSource,
      };

      handlePreCreateChatMessageSpeed(message, {});

      expect(updateSource).toHaveBeenCalledTimes(1);
      const updated = updateSource.mock.calls[0]?.[0] as { content: string };
      expect(updated.content).toContain("⚡ <b>Extra Attack:</b>");
      expect(updated.content).toContain("Character may make an additional attack this round!");
    });

    it("does NOT trigger extra attack banner on 'Breath Attacks Save' saving throws", () => {
      const hastedActor: TacticalActorLike = {
        name: "Alanna",
        effects: [{ name: "Haste", disabled: false }],
      };

      const updateSource = vi.fn();
      const message: TacticalChatMessageLike = {
        speaker: { _actor: hastedActor },
        flavor: "Breath Attacks Save",
        title: "Breath Attacks Save",
        content: "<div>Save Roll: 15</div>",
        updateSource,
      };

      handlePreCreateChatMessageSpeed(message, {});
      expect(updateSource).not.toHaveBeenCalled();
    });

    it("preserves prior hook mutations in message.content instead of clobbering with stale data.content", () => {
      const hastedActor: TacticalActorLike = {
        name: "Alanna",
        effects: [{ name: "Haste", disabled: false }],
      };

      const updateSource = vi.fn();
      const message: TacticalChatMessageLike = {
        speaker: { _actor: hastedActor },
        flags: { ose: { roll: "attack" } },
        content: "<div>Attack Roll: 18 (prior-hook)</div>",
        updateSource,
      };

      handlePreCreateChatMessageSpeed(message, { content: "<div>Attack Roll: 18 (stale)</div>" });
      expect(updateSource).toHaveBeenCalledTimes(1);
      const updated = updateSource.mock.calls[0]?.[0] as { content: string };
      expect(updated.content).toContain("(prior-hook)");
      expect(updated.content).not.toContain("(stale)");
    });

    it("appends extra attack banner via direct property assignment if updateSource is not a function", () => {
      const speedActor: TacticalActorLike = {
        name: "Boran",
        effects: [{ name: "Speed of the Heroes", disabled: false }],
      };

      const message: TacticalChatMessageLike = {
        speaker: { _actor: speedActor },
        flavor: "Sword Attack Roll",
        content: "<div>Attack Roll: 15</div>",
      };

      handlePreCreateChatMessageSpeed(message, {});

      expect(message.content).toContain("⚡ <b>Extra Attack:</b>");
    });

    it("detects speed from flags.ose.isSpeed", () => {
      const potionActor: TacticalActorLike = {
        name: "Celia",
        effects: [
          {
            name: "Potion of Speed",
            disabled: false,
            flags: { ose: { isSpeed: true } },
          },
        ],
      };

      const updateSource = vi.fn();
      const message: TacticalChatMessageLike = {
        speaker: { _actor: potionActor },
        flags: { ose: { roll: "attack" } },
        content: "<div>Bow Attack: 19</div>",
        updateSource,
      };

      handlePreCreateChatMessageSpeed(message, {});
      expect(updateSource).toHaveBeenCalledTimes(1);
    });

    it("does not trigger extra attack banner on negative speed debuffs", () => {
      const debuffedActor: TacticalActorLike = {
        name: "Slowpoke",
        effects: [{ name: "Reduced Speed", disabled: false }],
      };

      const updateSource = vi.fn();
      const message: TacticalChatMessageLike = {
        speaker: { _actor: debuffedActor },
        flags: { ose: { rollType: "attack" } },
        content: "<div>Attack: 12</div>",
        updateSource,
      };

      handlePreCreateChatMessageSpeed(message, {});
      expect(updateSource).not.toHaveBeenCalled();
    });

    it("does not inject duplicate extra attack banner if already present", () => {
      const hastedActor: TacticalActorLike = {
        name: "Speedy",
        effects: [{ name: "Haste", disabled: false }],
      };

      const updateSource = vi.fn();
      const message: TacticalChatMessageLike = {
        speaker: { _actor: hastedActor },
        flags: { ose: { rollType: "attack" } },
        content: `<div>Attack: 18</div><div class="ose-hasted-note">⚡ <b>Extra Attack:</b> Character may make an additional attack this round!</div>`,
        updateSource,
      };

      handlePreCreateChatMessageSpeed(message, {});
      expect(updateSource).not.toHaveBeenCalled();
    });

    it("does nothing if the speed effect is disabled or suppressed", () => {
      const actor: TacticalActorLike = {
        name: "Doran",
        appliedEffects: [
          { name: "Haste", disabled: true },
          { name: "Ring of Speed", disabled: false, isSuppressed: true, flags: { ose: { isSpeed: true } } },
        ],
      };

      const updateSource = vi.fn();
      const message: TacticalChatMessageLike = {
        speaker: { _actor: actor },
        flags: { ose: { rollType: "attack" } },
        content: "<div>Attack Roll: 14</div>",
        updateSource,
      };

      handlePreCreateChatMessageSpeed(message, {});
      expect(updateSource).not.toHaveBeenCalled();
    });

    it("does nothing for non-attack messages (e.g. saving throw)", () => {
      const actor: TacticalActorLike = {
        name: "Alanna",
        effects: [{ name: "Haste", disabled: false }],
      };

      const updateSource = vi.fn();
      const message: TacticalChatMessageLike = {
        speaker: { _actor: actor },
        flags: { ose: { rollType: "save" } },
        flavor: "Save vs Spells",
        content: "<div>Save: 12</div>",
        updateSource,
      };

      handlePreCreateChatMessageSpeed(message, {});
      expect(updateSource).not.toHaveBeenCalled();
    });

    it("does nothing if message has no speaker or speaker actor", () => {
      const updateSource = vi.fn();
      const message: TacticalChatMessageLike = {
        speaker: null,
        flags: { ose: { rollType: "attack" } },
        content: "<div>Attack Roll: 14</div>",
        updateSource,
      };

      handlePreCreateChatMessageSpeed(message, {});
      expect(updateSource).not.toHaveBeenCalled();
    });
  });

  describe("getActorEffects", () => {
    it("extracts values from Map or iterable collections and prefers appliedEffects when present", () => {
      const effectMap = new Map([
        ["eff1", { name: "Bless", disabled: false }],
        ["eff2", { name: "Shield", disabled: true }],
      ]);
      const actor: TacticalActorLike = { effects: effectMap };
      const result = getActorEffects(actor);
      expect(result).toHaveLength(2);
      expect(result[0]?.name).toBe("Bless");
      expect(result[1]?.name).toBe("Shield");

      const actorWithApplied: TacticalActorLike = {
        appliedEffects: [{ name: "Transferred Haste", disabled: false }],
        effects: effectMap,
      };
      const applied = getActorEffects(actorWithApplied);
      expect(applied).toHaveLength(1);
      expect(applied[0]?.name).toBe("Transferred Haste");
    });
  });

  describe("registerTacticalCombatHooks", () => {
    it("registers preUpdateActor and preCreateChatMessage on Hooks", () => {
      registerTacticalCombatHooks();

      const hooksMock = Hooks as unknown as MockHooksStatic;
      expect(hooksMock.on).toHaveBeenCalledWith("preUpdateActor", handlePreUpdateActorHealing);
      expect(hooksMock.on).toHaveBeenCalledWith("preCreateChatMessage", handlePreCreateChatMessageSpeed);
    });
  });
});
