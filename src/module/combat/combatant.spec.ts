import { beforeEach, describe, expect, it, vi } from "vitest";
import { OSECombatant } from "./combatant";

describe("OSECombatant and Fast Combat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes expected initiative constants", () => {
    expect(OSECombatant.INITIATIVE_VALUE_FAST).toBe(789);
    expect(OSECombatant.INITIATIVE_VALUE_SLOWED).toBe(-789);
    expect(OSECombatant.INITIATIVE_VALUE_DEFEATED).toBe(-790);
  });

  describe("isFast detection", () => {
    it("detects Halflings automatically by class name (case-insensitive)", () => {
      const combatant1 = new OSECombatant({
        actor: {
          system: {
            details: { class: "Halfling" },
            hp: { value: 10 },
          },
        },
      });
      expect(combatant1.isFast).toBe(true);

      const combatant2 = new OSECombatant({
        actor: {
          system: {
            details: { class: "Halfling (Thief)" },
            hp: { value: 8 },
          },
        },
      });
      expect(combatant2.isFast).toBe(true);

      const combatant3 = new OSECombatant({
        actor: {
          system: {
            details: { class: "HALFLING SCOUT" },
            hp: { value: 12 },
          },
        },
      });
      expect(combatant3.isFast).toBe(true);
    });

    it("detects fast combat when config.fastCombat is enabled on any class", () => {
      const combatant = new OSECombatant({
        actor: {
          system: {
            details: { class: "Fighter" },
            config: { fastCombat: true },
            hp: { value: 15 },
          },
        },
      });
      expect(combatant.isFast).toBe(true);
    });

    it("returns false for standard combatants without fast traits", () => {
      const combatant = new OSECombatant({
        actor: {
          system: {
            details: { class: "Fighter" },
            hp: { value: 15 },
          },
        },
      });
      expect(combatant.isFast).toBe(false);
    });

    it("prioritizes isSlow over isFast", () => {
      const combatant = new OSECombatant({
        actor: {
          system: {
            details: { class: "Halfling" },
            isSlow: true,
            hp: { value: 10 },
          },
        },
      });
      expect(combatant.isSlow).toBe(true);
      expect(combatant.isFast).toBe(false);
    });

    it("prioritizes isDefeated over isFast", () => {
      const combatant = new OSECombatant({
        actor: {
          system: {
            details: { class: "Halfling" },
            hp: { value: 0 },
          },
        },
      });
      expect(combatant.isDefeated).toBe(true);
      expect(combatant.isFast).toBe(false);
    });

    it("marks combatant as defeated when defeated flag is true even if HP > 0", () => {
      const combatant = new OSECombatant({
        actor: {
          system: {
            details: { class: "Halfling" },
            hp: { value: 10 },
          },
        },
        defeated: true,
      });
      expect(combatant.isDefeated).toBe(true);
      expect(combatant.isFast).toBe(false);
    });
  });

  describe("getInitiativeRoll", () => {
    it("returns fast initiative formula 789 for fast combatants", () => {
      const combatant = new OSECombatant({
        actor: {
          system: {
            details: { class: "Halfling" },
            hp: { value: 10 },
          },
          getRollData: () => ({}),
        },
      });

      const roll = combatant.getInitiativeRoll("1d6");
      expect(roll.formula).toBe("789");
    });

    it("returns slowed initiative formula -789 for slow combatants", () => {
      const combatant = new OSECombatant({
        actor: {
          system: {
            isSlow: true,
            hp: { value: 10 },
          },
          getRollData: () => ({}),
        },
      });

      const roll = combatant.getInitiativeRoll("1d6");
      expect(roll.formula).toBe("-789");
    });

    it("returns defeated initiative formula -790 for defeated combatants", () => {
      const combatant = new OSECombatant({
        actor: {
          system: {
            hp: { value: 0 },
          },
          getRollData: () => ({}),
        },
      });

      const roll = combatant.getInitiativeRoll("1d6");
      expect(roll.formula).toBe("-790");
    });

    it("falls back to passed formula for standard combatants", () => {
      const combatant = new OSECombatant({
        actor: {
          system: {
            details: { class: "Fighter" },
            hp: { value: 10 },
          },
          getRollData: () => ({}),
        },
      });

      const roll = combatant.getInitiativeRoll("1d6");
      expect(roll.formula).toBe("1d6");
    });

    it("falls back to CONFIG.Combat.initiative.formula when no formula is passed", () => {
      const combatant = new OSECombatant({
        actor: {
          system: {
            details: { class: "Fighter" },
            hp: { value: 10 },
          },
          getRollData: () => ({}),
        },
      });

      const roll = combatant.getInitiativeRoll();
      expect(roll.formula).toBe("1d6");
    });
  });

  describe("groupRaw", () => {
    it("assigns 'slow' group when slow", () => {
      const combatant = new OSECombatant({
        actor: { system: { isSlow: true, hp: { value: 10 } } },
      });
      expect(combatant.groupRaw).toBe("slow");
    });

    it("assigns 'fast' group when fast", () => {
      const combatant = new OSECombatant({
        actor: { system: { details: { class: "Halfling" }, hp: { value: 10 } } },
      });
      expect(combatant.groupRaw).toBe("fast");
    });

    it("maps token disposition to colors when no group is assigned", () => {
      const hostile = new OSECombatant({
        actor: { system: { hp: { value: 10 } } },
        token: { disposition: -1 },
      });
      expect(hostile.groupRaw).toBe("red");

      const neutral = new OSECombatant({
        actor: { system: { hp: { value: 10 } } },
        token: { disposition: 0 },
      });
      expect(neutral.groupRaw).toBe("purple");

      const friendly = new OSECombatant({
        actor: { system: { hp: { value: 10 } } },
        token: { disposition: 1 },
      });
      expect(friendly.groupRaw).toBe("green");

      const secret = new OSECombatant({
        actor: { system: { hp: { value: 10 } } },
        token: { disposition: 2 },
      });
      expect(secret.groupRaw).toBe("white");
    });
  });

  describe("flags and actions", () => {
    it("reads and writes isCasting flag", async () => {
      const combatant = new OSECombatant();
      expect(combatant.isCasting).toBeFalsy();
      await combatant.setFlag("ose", "prepareSpell", true);
      expect(combatant.isCasting).toBe(true);
    });

    it("assigns group delegating to combat.assignGroup", async () => {
      const mockCombat = {
        assignGroup: vi.fn().mockResolvedValue(true),
      };
      const combatant = new OSECombatant({
        combat: mockCombat,
        actor: { system: { hp: { value: 10 } } },
        token: { disposition: 1 },
      });

      await combatant.assignGroup("custom-group");
      expect(mockCombat.assignGroup).toHaveBeenCalledWith(combatant, "custom-group");
    });
  });
});
