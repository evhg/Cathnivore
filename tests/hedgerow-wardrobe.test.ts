import { afterEach, describe, expect, it, vi } from "vitest";
import { emptySave, parseSave } from "../games/hedgerow/src/store";
import { OUTFITS, outfitFor, unlockedOutfits } from "../games/hedgerow/src/wardrobe";

describe("wardrobe", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("unlocks outfits earned in other games (shared wardrobe)", () => {
    const store: Record<string, string> = { "runnel:v1": JSON.stringify({ results: { a: 1, b: 1, c: 1, d: 1, e: 1 } }) };
    vi.stubGlobal("localStorage", { getItem: (k: string) => store[k] ?? null, setItem: () => {} });
    const d = emptySave();
    expect(unlockedOutfits(d).map((o) => o.id)).toContain("market");
  });
  it("starts with only the blazer", () => {
    expect(unlockedOutfits(emptySave()).map((o) => o.id)).toEqual(["blazer"]);
  });
  it("unlocks the wax jacket after act 1 and the gown after level 100", () => {
    const d = emptySave();
    for (let i = 1; i <= 10; i++) d.stars[String(i)] = 1;
    expect(unlockedOutfits(d).map((o) => o.id)).toContain("wax");
    d.stars["100"] = 1;
    expect(unlockedOutfits(d).map((o) => o.id)).toContain("gown");
  });
  it("won't wear an outfit that is not earned", () => {
    const d = emptySave();
    d.outfit = "gown";
    expect(outfitFor(d).id).toBe("blazer");
  });
  it("keeps the choice through a save round-trip", () => {
    const d = emptySave();
    d.outfit = "wax";
    expect(parseSave(JSON.stringify(d)).outfit).toBe("wax");
    expect(OUTFITS.length).toBe(5);
    expect(OUTFITS.map((o) => o.art)).toEqual(["field", "wax", "pinny", "market", "gown"]);
  });
});
