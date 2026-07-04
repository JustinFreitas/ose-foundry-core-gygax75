import { describe, expect, it, vi } from "vitest";
import { getRollMode, getRollModes, setRollMode } from "./helpers-message-mode";

describe("Offline Message Mode Helpers", () => {
  describe("Legacy (V11/V12/V13) Environment", () => {
    it("handles get, set, and list for legacy roll modes", async () => {
      // Mock game release as V11
      game.release = { generation: 11 } as unknown as typeof game.release;

      // Mock rollModes config
      CONFIG.Dice.rollModes = {
        publicroll: "Public",
        gmroll: "GM Roll",
      } as unknown as typeof CONFIG.Dice.rollModes;

      const getSpy = vi.spyOn(game.settings, "get").mockReturnValue("gmroll");
      const setSpy = vi.spyOn(game.settings, "set").mockResolvedValue(true);

      expect(getRollMode()).toBe("gmroll");
      expect(getSpy).toHaveBeenCalledWith("core", "rollMode");

      await setRollMode("selfroll");
      expect(setSpy).toHaveBeenCalledWith("core", "rollMode", "selfroll");

      expect(getRollModes()).toEqual({ publicroll: "Public", gmroll: "GM Roll" });

      getSpy.mockRestore();
      setSpy.mockRestore();
    });
  });

  describe("Modern (V14+) Environment", () => {
    it("handles get, set, and list mapping to messageMode", async () => {
      // Mock game release as V14
      game.release = { generation: 14 } as unknown as typeof game.release;

      // Mock ChatMessage modes config
      CONFIG.ChatMessage = {
        modes: { public: 0, gm: 1, blind: 2, self: 3 },
      } as unknown as typeof CONFIG.ChatMessage;

      const getSpy = vi.spyOn(game.settings, "get").mockReturnValue("gm");
      const setSpy = vi.spyOn(game.settings, "set").mockResolvedValue(true);

      expect(getRollMode()).toBe("gmroll"); // maps gm to gmroll
      expect(getSpy).toHaveBeenCalledWith("core", "messageMode");

      await setRollMode("selfroll");
      expect(setSpy).toHaveBeenCalledWith("core", "messageMode", "self");

      expect(getRollModes()).toEqual({
        publicroll: 0,
        gmroll: 1,
        blindroll: 2,
        selfroll: 3,
      });

      getSpy.mockRestore();
      setSpy.mockRestore();
    });
  });
});
