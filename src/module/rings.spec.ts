import { describe, expect, it, vi } from "vitest";
import { initializeTokenRing, promptTokenRingSelection } from "./rings";

describe("Offline Token Ring Helpers", () => {
  describe("initializeTokenRing", () => {
    it("adds custom dynamic token ring config", () => {
      const mockConfig = {
        addConfig: vi.fn(),
      };

      // Mock foundry DynamicRingData class
      global.foundry.canvas = global.foundry.canvas || {};
      const canvas = global.foundry.canvas;
      canvas.placeables = canvas.placeables || {};
      const placeables = canvas.placeables;
      placeables.tokens = placeables.tokens || {};
      const tokens = placeables.tokens;

      const originalDynamicRingData = tokens.DynamicRingData;
      tokens.DynamicRingData = class {
        label: string;
        spritesheet: string;
        constructor(data: { label: string; spritesheet: string }) {
          this.label = data.label;
          this.spritesheet = data.spritesheet;
        }
      } as unknown as typeof tokens.DynamicRingData;

      try {
        initializeTokenRing(mockConfig as unknown as foundry.canvas.tokens.TokenRingConfig);
        expect(mockConfig.addConfig).toHaveBeenCalled();
        expect(mockConfig.addConfig.mock.calls[0]?.[0]).toBe("ose-default-black-white");
      } finally {
        if (originalDynamicRingData) {
          tokens.DynamicRingData = originalDynamicRingData;
        }
      }
    });
  });

  describe("promptTokenRingSelection", () => {
    it("does nothing if already prompted", async () => {
      const getSpy = vi.spyOn(game.settings, "get").mockReturnValue(true);
      const confirmSpy = vi.spyOn(foundry.applications.api.DialogV2, "confirm");

      await promptTokenRingSelection();
      expect(confirmSpy).not.toHaveBeenCalled();

      getSpy.mockRestore();
      confirmSpy.mockRestore();
    });

    it("prompts user and sets settings if confirmed", async () => {
      const getSpy = vi.spyOn(game.settings, "get").mockReturnValue(false);
      const setSpy = vi.spyOn(game.settings, "set").mockResolvedValue(true);
      const confirmSpy = vi.spyOn(foundry.applications.api.DialogV2, "confirm").mockResolvedValue(true);

      await promptTokenRingSelection();
      expect(confirmSpy).toHaveBeenCalled();
      expect(setSpy).toHaveBeenCalledWith("core", "dynamicTokenRing", "ose-default-black-white");
      expect(setSpy).toHaveBeenCalledWith("ose", "hasPromptedDefaultOSETokenRing", true);

      getSpy.mockRestore();
      setSpy.mockRestore();
      confirmSpy.mockRestore();
    });

    it("does not set core token ring if user declines prompt", async () => {
      const getSpy = vi.spyOn(game.settings, "get").mockReturnValue(false);
      const setSpy = vi.spyOn(game.settings, "set").mockResolvedValue(true);
      const confirmSpy = vi.spyOn(foundry.applications.api.DialogV2, "confirm").mockResolvedValue(false);

      await promptTokenRingSelection();
      expect(confirmSpy).toHaveBeenCalled();
      expect(setSpy).not.toHaveBeenCalledWith("core", "dynamicTokenRing", "ose-default-black-white");
      expect(setSpy).toHaveBeenCalledWith("ose", "hasPromptedDefaultOSETokenRing", true);

      getSpy.mockRestore();
      setSpy.mockRestore();
      confirmSpy.mockRestore();
    });
  });
});
