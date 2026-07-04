import { describe, expect, it } from "vitest";
import OseParty from "./party";

describe("OseParty currentParty helper", () => {
  it("filters game.actors to only return character actors with party flag set to true", () => {
    // Mock actors collection on game
    const originalActors = game.actors;
    game.actors = [
      {
        id: "hero-1",
        type: "character",
        flags: { ose: { party: true } },
      },
      {
        id: "hero-2",
        type: "character",
        flags: { ose: { party: false } },
      },
      {
        id: "monster-1",
        type: "monster",
        flags: { ose: { party: true } },
      },
    ] as unknown as typeof game.actors;

    try {
      const party = OseParty.currentParty;
      expect(party.length).toBe(1);
      expect(party[0].id).toBe("hero-1");
    } finally {
      game.actors = originalActors;
    }
  });
});
