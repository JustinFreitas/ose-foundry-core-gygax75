import { describe, it, expect, vi } from "vitest";
import { functionsForTesting } from "./helpers-treasure";

const { drawTreasure } = functionsForTesting;

describe("Offline drawTreasure tests", () => {
  it("draws successfully from a treasure table", async () => {
    // Mock table with results
    const mockTable = {
      uuid: "Table.123",
      name: "Test Table",
      getFlag: () => true, // simulates treasure table flag being true
      results: [
        {
          id: "result-1",
          weight: 100, // 100% chance
          img: "icons/gem.svg",
          getHTML: async () => "<p>100% Chance Text</p>",
          documentUuid: "Item.1",
        },
      ],
    };

    const data = await drawTreasure(mockTable as any, {});
    expect(data.treasure).toBeDefined();
    expect(data.treasure["result-1"]).toBeDefined();
    expect(data.treasure["result-1"].img).toBe("icons/gem.svg");
    expect(data.treasure["result-1"].text).toContain("100% Chance Text");
  });

  it("skips items if probability check fails", async () => {
    const mockTable = {
      uuid: "Table.124",
      name: "Test Table 2",
      getFlag: () => true,
      results: [
        {
          id: "result-2",
          weight: 0, // 0% chance
          img: "icons/gold.svg",
          getHTML: async () => "<p>0% Chance Text</p>",
        },
      ],
    };

    const data = await drawTreasure(mockTable as any, {});
    expect(data.treasure).toBeDefined();
    expect(Object.keys(data.treasure).length).toBe(0);
  });

  it("handles circular table references gracefully without crashing", async () => {
    // Set up circular reference: Table A results point to Table A (itself)
    const mockTable: any = {
      uuid: "RollTable.circular",
      name: "Circular Table",
      getFlag: () => true,
    };

    mockTable.results = [
      {
        id: "result-circular",
        weight: 100,
        img: "icons/loop.svg",
        getHTML: async () => "<p>Circular Reference</p>",
        type: "DOCUMENT", // CONST.TABLE_RESULT_TYPES.DOCUMENT
        documentUuid: "RollTable.circular",
      },
    ];

    // Mock fromUuid to return the same table to simulate recursive loading
    const originalFromUuid = global.fromUuid;
    global.fromUuid = async (uuid) => {
      if (uuid === "RollTable.circular") return mockTable;
      return null;
    };

    // Spy on console.warn
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      const data = await drawTreasure(mockTable, {});
      expect(data.treasure).toBeDefined();
      expect(consoleWarnSpy).toHaveBeenCalled();
      
      const firstArg = consoleWarnSpy.mock.calls[0]?.[0];
      expect(firstArg).toContain("Circular dependency detected");
    } finally {
      // Clean up mock
      global.fromUuid = originalFromUuid;
      consoleWarnSpy.mockRestore();
    }
  });
});
