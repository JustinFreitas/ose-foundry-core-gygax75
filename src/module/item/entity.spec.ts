import { beforeEach, describe, expect, it } from "vitest";
import OseItem from "./entity";

/**
 * Offline regression tests for OseItem.pushManualTag.
 *
 * In production the CONFIG.OSE.tags values are localized during setup;
 * the tests use the plain English words the comparison operates on.
 */
describe("Offline Item Entity manual tag tests", () => {
  beforeEach(() => {
    CONFIG.OSE.tags = {
      melee: "Melee",
      slow: "Slow",
      missile: "Missile",
    } as typeof CONFIG.OSE.tags;
  });

  const makeWeapon = (tags: unknown[] = []) =>
    new OseItem({
      id: "weapon-1",
      name: "Test Weapon",
      type: "weapon",
      system: { tags },
    } as unknown as Item);

  it("keeps plain tags that follow a checkbox tag (regression: 'Melee, Silver' dropped Silver)", async () => {
    const item = makeWeapon();
    await item.pushManualTag(["Melee", "Silver"]);

    expect(item.system.melee).toBe(true);
    expect(item.system.tags).toEqual([{ title: "Silver", value: "Silver", label: "Silver" }]);
  });

  it("sets the checkbox and keeps the titled tag for parenthesized values", async () => {
    const item = makeWeapon();
    await item.pushManualTag(["Bulky (Slow)"]);

    expect(item.system.slow).toBe(true);
    expect(item.system.tags).toEqual([{ title: "Slow", value: "Bulky", label: "Bulky" }]);
  });

  it("does not add a list entry for a bare checkbox tag", async () => {
    const item = makeWeapon();
    await item.pushManualTag(["Missile"]);

    expect(item.system.missile).toBe(true);
    expect(item.system.tags).toEqual([]);
  });

  it("does not mutate the existing tags array in place", async () => {
    const existingTags = [{ title: "Sharp", value: "Sharp", label: "Sharp" }];
    const item = makeWeapon(existingTags);
    await item.pushManualTag(["Silver"]);

    expect(existingTags).toHaveLength(1);
    expect(item.system.tags).toHaveLength(2);
    expect(item.system.tags).not.toBe(existingTags);
  });

  it("sets itemslots to 2 for Two-handed weapons", async () => {
    const item = makeWeapon();
    await item.pushManualTag(["Two-handed"]);

    expect(item.system.itemslots).toBe(2);
    expect(item.system.tags).toEqual([{ title: "Two-handed", value: "Two-handed", label: "Two-handed" }]);
  });
});

describe("Offline Item Entity migrateData tests", () => {
  it("dedupes container itemIds corrupted by the duplicate-drop bug, preserving order", () => {
    const source = {
      type: "container",
      system: { itemslots: 1, itemIds: ["a", "b", "a", "c", "b", "a"] },
    };

    const migrated = OseItem.migrateData(source);

    expect(migrated.system.itemIds).toEqual(["a", "b", "c"]);
  });

  it("leaves an already-clean itemIds array untouched", () => {
    const itemIds = ["a", "b", "c"];
    const source = { type: "container", system: { itemslots: 1, itemIds } };

    const migrated = OseItem.migrateData(source);

    // Same reference: no churn when there is nothing to fix
    expect(migrated.system.itemIds).toBe(itemIds);
  });

  it("ignores non-container items and malformed itemIds", () => {
    const weapon = { type: "weapon", system: { itemslots: 1, tags: [] } };
    expect(() => OseItem.migrateData(weapon)).not.toThrow();

    // Drag data can double-stringify itemIds into a string; migrateData must not touch it
    const stringIds = { type: "container", system: { itemslots: 1, itemIds: '["a","a"]' } };
    const migrated = OseItem.migrateData(stringIds);
    expect(migrated.system.itemIds).toBe('["a","a"]');
  });
});
