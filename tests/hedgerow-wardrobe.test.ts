import { describe, expect, it } from "vitest";
import { emptySave, parseSave } from "../games/hedgerow/src/store";
import { OUTFITS, outfitFor, unlockedOutfits } from "../games/hedgerow/src/wardrobe";

describe("wardrobe", () => {
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
    expect(OUTFITS.length).toBe(4);
  });
});
