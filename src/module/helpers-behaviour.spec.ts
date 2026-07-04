import { describe, expect, it, vi } from "vitest";
import skipRollDialogCheck from "./helpers-behaviour";

describe("Offline skipRollDialogCheck behavior helper", () => {
  it("evaluates skip check correctly with default ctrl behavior", () => {
    // Mock setting: invertedCtrlBehavior = false
    const getSpy = vi.spyOn(game.settings, "get").mockReturnValue(false);

    try {
      // 1. Without ctrlKey/metaKey or event -> should not skip
      expect(skipRollDialogCheck(undefined)).toBeFalsy();
      expect(skipRollDialogCheck({ ctrlKey: false, metaKey: false } as unknown as Event)).toBeFalsy();

      // 2. With ctrlKey or metaKey -> should skip
      expect(skipRollDialogCheck({ ctrlKey: true, metaKey: false } as unknown as Event)).toBeTruthy();
      expect(skipRollDialogCheck({ ctrlKey: false, metaKey: true } as unknown as Event)).toBeTruthy();
    } finally {
      getSpy.mockRestore();
    }
  });

  it("evaluates skip check correctly with inverted ctrl behavior", () => {
    // Mock setting: invertedCtrlBehavior = true
    const getSpy = vi.spyOn(game.settings, "get").mockReturnValue(true);

    try {
      // 1. Without ctrlKey/metaKey or event -> should skip
      expect(skipRollDialogCheck(undefined)).toBeTruthy();
      expect(skipRollDialogCheck({ ctrlKey: false, metaKey: false } as unknown as Event)).toBeTruthy();

      // 2. With ctrlKey or metaKey -> should not skip
      expect(skipRollDialogCheck({ ctrlKey: true, metaKey: false } as unknown as Event)).toBeFalsy();
      expect(skipRollDialogCheck({ ctrlKey: false, metaKey: true } as unknown as Event)).toBeFalsy();
    } finally {
      getSpy.mockRestore();
    }
  });
});
