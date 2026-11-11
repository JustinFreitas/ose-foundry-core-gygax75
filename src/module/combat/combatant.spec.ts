import { beforeEach, describe, expect, it, vi } from "vitest";
import { OSECombat } from "./combat";
import OSECombatGroupSelector from "./combat-set-groups";
import { OSECombatant } from "./combatant";

type CombatantCtor = new (data?: Record<string, unknown>) => OSECombatant;
const createCombatant = (data: Record<string, unknown> = {}): OSECombatant =>
  new (OSECombatant as unknown as CombatantCtor)(data);

interface FlagMutator {
  setFlag(scope: string, key: string, value: unknown): Promise<unknown>;
}

describe("OSECombatant, OSECombat Sorting, and Tracker Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes expected initiative constants", () => {
    expect(OSECombatant.INITIATIVE_VALUE_FAST).toBe(789);
    expect(OSECombatant.INITIATIVE_VALUE_SLOW).toBe(-789);
    expect(OSECombatant.INITIATIVE_VALUE_SLOWED).toBe(-789);
    expect(OSECombatant.INITIATIVE_VALUE_DEFEATED).toBe(-790);
  });

  describe("isFast detection", () => {
    it("detects Halflings automatically by class name (case-insensitive)", () => {
      const combatant1 = createCombatant({
        actor: {
          system: {
            details: { class: "Halfling" },
            hp: { value: 10 },
          },
        },
      });
      expect(combatant1.isFast).toBe(true);

      const combatant2 = createCombatant({
        actor: {
          system: {
            details: { class: "Halfling (Thief)" },
            hp: { value: 8 },
          },
        },
      });
      expect(combatant2.isFast).toBe(true);

      const combatant3 = createCombatant({
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
      const combatant = createCombatant({
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

    it("returns true for Advanced Fantasy Halflings by race name", () => {
      const combatant = createCombatant({
        actor: {
          system: {
            details: { class: "Thief" },
            race: { name: "Halfling" },
            hp: { value: 10 },
          },
        },
      });
      expect(combatant.isFast).toBe(true);
    });

    it("returns false for standard combatants without fast traits", () => {
      const combatant = createCombatant({
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
      const combatant = createCombatant({
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
      const combatant = createCombatant({
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
      const combatant = createCombatant({
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
      const combatant = createCombatant({
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
      const combatant = createCombatant({
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
      const combatant = createCombatant({
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
      const combatant = createCombatant({
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
      const combatant = createCombatant({
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
    it("assigns 'slow' group when slow and no manual group is assigned", () => {
      const combatant = createCombatant({
        actor: { system: { isSlow: true, hp: { value: 10 } } },
      });
      expect(combatant.groupRaw).toBe("slow");
    });

    it("assigns 'fast' group when fast and no manual group is assigned", () => {
      const combatant = createCombatant({
        actor: { system: { details: { class: "Halfling" }, hp: { value: 10 } } },
      });
      expect(combatant.groupRaw).toBe("fast");
    });

    it("respects explicit manual group.name override before isSlow or isFast", () => {
      const halflingInBlue = createCombatant({
        group: { name: "blue" },
        actor: { system: { details: { class: "Halfling" }, hp: { value: 10 } } },
      });
      expect(halflingInBlue.isFast).toBe(true);
      expect(halflingInBlue.groupRaw).toBe("blue");

      const slowInOrange = createCombatant({
        group: { name: "orange" },
        actor: { system: { isSlow: true, hp: { value: 10 } } },
      });
      expect(slowInOrange.isSlow).toBe(true);
      expect(slowInOrange.groupRaw).toBe("orange");
    });

    it("maps token disposition to colors when no group is assigned", () => {
      const hostile = createCombatant({
        actor: { system: { hp: { value: 10 } } },
        token: { disposition: -1 },
      });
      expect(hostile.groupRaw).toBe("red");

      const neutral = createCombatant({
        actor: { system: { hp: { value: 10 } } },
        token: { disposition: 0 },
      });
      expect(neutral.groupRaw).toBe("purple");

      const friendly = createCombatant({
        actor: { system: { hp: { value: 10 } } },
        token: { disposition: 1 },
      });
      expect(friendly.groupRaw).toBe("green");

      const secret = createCombatant({
        actor: { system: { hp: { value: 10 } } },
        token: { disposition: 2 },
      });
      expect(secret.groupRaw).toBe("white");
    });
  });

  describe("OSECombat._sortCombatants & getInitiativeForCombatant", () => {
    it("maps null/empty initiative to -Infinity, negative rolled above unrolled, fast to 789, slow to -789, and defeated to -790", () => {
      const combat = new OSECombat();

      const fastHalfling = createCombatant({
        id: "c-fast-trait",
        name: "Pip",
        initiative: null,
        actor: { system: { details: { class: "Halfling" }, hp: { value: 8 } } },
      });
      const manualFastGroup = createCombatant({
        id: "c-fast-group",
        name: "Scout",
        initiative: null,
        group: { name: "fast", initiative: null },
        actor: { system: { details: { class: "Fighter" }, hp: { value: 10 } } },
      });
      const rolledSix = createCombatant({
        id: "c-six",
        name: "Knight",
        initiative: 6,
        actor: { system: { hp: { value: 12 } } },
      });
      const rolledNegative = createCombatant({
        id: "c-neg",
        name: "Clumsy",
        initiative: -1,
        actor: { system: { hp: { value: 10 } } },
      });
      const manualSlowGroup = createCombatant({
        id: "c-slow-group",
        name: "Zweihander",
        initiative: null,
        group: { name: "slow", initiative: null },
        actor: { system: { hp: { value: 10 } } },
      });
      const defeated = createCombatant({
        id: "c-dead",
        name: "Fallen",
        initiative: 6,
        defeated: true,
        actor: { system: { details: { class: "Halfling" }, hp: { value: 0 } } },
      });
      const unrolled = createCombatant({
        id: "c-unrolled",
        name: "Waiting",
        initiative: null,
        actor: { system: { hp: { value: 10 } } },
      });

      expect(OSECombat.getInitiativeForCombatant(fastHalfling)).toBe(789);
      expect(OSECombat.getInitiativeForCombatant(manualFastGroup)).toBe(789);
      expect(OSECombat.getInitiativeForCombatant(rolledSix)).toBe(6);
      expect(OSECombat.getInitiativeForCombatant(rolledNegative)).toBe(-1);
      expect(OSECombat.getInitiativeForCombatant(manualSlowGroup)).toBe(-789);
      expect(OSECombat.getInitiativeForCombatant(defeated)).toBe(-790);
      expect(OSECombat.getInitiativeForCombatant(unrolled)).toBe(Number.NEGATIVE_INFINITY);

      const list = [unrolled, defeated, manualSlowGroup, rolledNegative, rolledSix, manualFastGroup, fastHalfling];
      list.sort((a, b) =>
        combat._sortCombatants(a as unknown as Combatant.Implementation, b as unknown as Combatant.Implementation),
      );

      expect(list.map((c) => c.id)).toEqual([
        "c-fast-trait",
        "c-fast-group",
        "c-six",
        "c-neg",
        "c-slow-group",
        "c-dead",
        "c-unrolled",
      ]);
    });
  });

  describe("OSECombatTracker._prepareTrackerContext & OSECombatGroupSelector", () => {
    it("handles numeric, decimal-formatted, and null initiatives cleanly in _prepareTrackerContext", async () => {
      const apps = foundry.applications as unknown as {
        sidebar?: { tabs?: { CombatTracker?: unknown } };
      };
      if (!apps.sidebar?.tabs?.CombatTracker) {
        class StubCombatTracker {
          static DEFAULT_OPTIONS = { actions: {} };
          viewed: unknown = null;
          protected async _prepareTrackerContext(_context: unknown, _options: unknown) {}
          protected _onUpdateInitiative(_event: Event) {}
          protected async _onCombatantControl(_event: PointerEvent, _target: HTMLElement) {}
          protected _configureRenderOptions(_options: unknown) {}
          protected _getEntryContextOptions() {
            return [];
          }
        }
        apps.sidebar = { tabs: { CombatTracker: StubCombatTracker } };
      }

      const { default: OSECombatTracker } = await import("./combat-tracker");
      const tracker = new OSECombatTracker();

      const fastTraitUnrolled = createCombatant({
        id: "t-fast-null",
        actor: { isOwner: true, system: { details: { class: "Halfling" }, hp: { value: 8 } } },
      });
      const fastDecimal = createCombatant({
        id: "t-fast-dec",
        actor: { isOwner: true, system: { hp: { value: 8 } } },
      });
      const slowDecimal = createCombatant({
        id: "t-slow-dec",
        actor: { isOwner: true, system: { hp: { value: 8 } } },
      });
      const normalUnrolled = createCombatant({
        id: "t-normal-null",
        actor: { isOwner: true, system: { hp: { value: 8 } } },
      });

      const map = new Map<string, OSECombatant>([
        [fastTraitUnrolled.id ?? "t-fast-null", fastTraitUnrolled],
        [fastDecimal.id ?? "t-fast-dec", fastDecimal],
        [slowDecimal.id ?? "t-slow-dec", slowDecimal],
        [normalUnrolled.id ?? "t-normal-null", normalUnrolled],
      ]);
      (tracker as unknown as { viewed: unknown }).viewed = { combatants: map };

      const context = {
        turns: [
          { id: "t-fast-null", initiative: null, isFast: false, isSlowed: false },
          { id: "t-fast-dec", initiative: "789.00", isFast: false, isSlowed: false },
          { id: "t-slow-dec", initiative: "-789.00", isFast: false, isSlowed: false },
          { id: "t-normal-null", initiative: null, isFast: false, isSlowed: false },
        ],
      };

      const prepare = (
        tracker as unknown as {
          _prepareTrackerContext: (ctx: unknown, opts: unknown) => Promise<void>;
        }
      )._prepareTrackerContext.bind(tracker);
      await prepare(context, {});

      expect(context.turns[0]).toMatchObject({ isFast: true, isSlowed: false });
      expect(context.turns[1]).toMatchObject({ isFast: true, isSlowed: false });
      expect(context.turns[2]).toMatchObject({ isFast: false, isSlowed: true });
      expect(context.turns[3]).toMatchObject({ isFast: false, isSlowed: false });
    });

    it("configures OSECombatGroupSelector with 'ose' class and __SYSTEM_ID__ template path", () => {
      expect(OSECombatGroupSelector.DEFAULT_OPTIONS.classes).toContain("ose");
      expect(OSECombatGroupSelector.DEFAULT_OPTIONS.classes).toContain("combat-set-groups");
      expect(OSECombatGroupSelector.PARTS.main.template).not.toContain("ose-dev");
    });
  });

  describe("flags and actions", () => {
    it("reads and writes isCasting flag", async () => {
      const combatant = createCombatant();
      expect(combatant.isCasting).toBeFalsy();
      await (combatant as unknown as FlagMutator).setFlag("ose", "prepareSpell", true);
      expect(combatant.isCasting).toBe(true);
    });

    it("assigns group delegating to combat.assignGroup", async () => {
      const mockCombat = {
        assignGroup: vi.fn().mockResolvedValue(true),
      };
      const combatant = createCombatant({
        combat: mockCombat,
        actor: { system: { hp: { value: 10 } } },
        token: { disposition: 1 },
      });

      await combatant.assignGroup("custom-group");
      expect(mockCombat.assignGroup).toHaveBeenCalledWith(combatant, "custom-group");
    });

    it("excludes both 'slow' and 'fast' groups from rollGroupInitiative", async () => {
      const combat = new OSECombat();
      const combatMut = combat as unknown as {
        isOwner: boolean;
        updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
        rollGroupInitiative: (groups: unknown[]) => Promise<OSECombat>;
      };
      combatMut.isOwner = true;
      combatMut.updateEmbeddedDocuments = vi.fn().mockResolvedValue([]);
      const result = await combatMut.rollGroupInitiative([
        { id: "g1", name: "slow", members: new Set([{}]) },
        { id: "g2", name: "fast", members: new Set([{}]) },
      ]);
      expect(result).toBe(combat);
      expect(combatMut.updateEmbeddedDocuments).not.toHaveBeenCalled();
    });
  });
});
