import { describe, expect, it } from "vitest";
import { buildClassIndex, resolveClass } from "../class-index";

const e = (name: string, source: string, key = "") => ({ name, key, source, load: async () => ({}) });
const entries = [e("Fighter", "world"), e("Magic-User", "tome", "magic-user"), e("Fighter", "classic")];

describe("resolveClass", () => {
  it("matches ignoring case and punctuation", () => expect(resolveClass("magic user", entries)?.source).toBe("tome"));
  it("prefers the first source", () => expect(resolveClass("FIGHTER", entries)?.source).toBe("world"));
  it("matches by key when names differ", () =>
    expect(resolveClass("Magic-User", [e("Mago", "es", "magic-user")])?.source).toBe("es"));
  it("returns null for unknown or combined text", () => {
    expect(resolveClass("Fighter/Thief", entries)).toBeNull();
    expect(resolveClass("Elf Fighter", entries)).toBeNull();
    expect(resolveClass("", entries)).toBeNull();
    expect(resolveClass("   ", entries)).toBeNull();
  });
});

describe("buildClassIndex", () => {
  it("indexes classes across all configured class groups including gygax75", async () => {
    const indexed = await buildClassIndex();
    const names = indexed.map((entry) => entry.name);
    // Classic classes
    expect(names).toContain("Cleric");
    expect(names).toContain("Fighter");
    // Gygax '75 custom classes
    expect(names).toContain("Barbarian");
    expect(names).toContain("Druid");
    expect(names).toContain("Knight");
  });
});
