import { describe, expect, it } from "vitest";
import { BOONS, orchardFieldId, orchardLevel, orchardOffers, ORCHARD_MAX_DEPTH } from "../games/hedgerow/src/orchard";
import { emptySave, recordOrchard } from "../games/hedgerow/src/store";

describe("endless orchard", () => {
  it("is deterministic per seed and depth", () => {
    expect(orchardFieldId(5, 3)).toBe(orchardFieldId(5, 3));
    expect(orchardOffers(5, 3, [])).toEqual(orchardOffers(5, 3, []));
    const ids = new Set(Array.from({ length: 30 }, (_, s) => orchardFieldId(s, 1)));
    expect(ids.size).toBeGreaterThan(1);
  });
  it("moves to later levels as the run goes deeper", () => {
    expect(orchardFieldId(1, ORCHARD_MAX_DEPTH)).toBeGreaterThan(orchardFieldId(1, 1));
  });
  it("offers three distinct boons that are not already taken", () => {
    const taken = ["pockets", "thin"];
    const o = orchardOffers(9, 2, taken);
    expect(o).toHaveLength(3);
    expect(new Set(o.map((b) => b.id)).size).toBe(3);
    expect(o.some((b) => taken.includes(b.id))).toBe(false);
  });
  it("applies taken boons to the field", () => {
    const plain = orchardLevel(4, 2, []);
    const boosted = orchardLevel(4, 2, ["pockets", "neighbours"]);
    expect(boosted.startMarks).toBeGreaterThan(plain.startMarks);
    expect(boosted.goodwill).toBe(plain.goodwill + 4);
    expect(boosted.orchard).toBe(2);
    expect(BOONS.length).toBeGreaterThanOrEqual(8);
  });
  it("keeps the best depth", () => {
    const d = emptySave();
    expect(recordOrchard(d, 3)).toBe(true);
    expect(recordOrchard(d, 2)).toBe(false);
    expect(d.orchard).toBe(3);
  });
});
