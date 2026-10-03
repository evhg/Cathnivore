import { describe, expect, it } from "vitest";
import {
  ATTR_CAP,
  TALENTS,
  applyCath,
  emptyCath,
  freePoints,
  levelOf,
  parseCath,
  pickTalent,
  raise,
  talentsWaiting,
  xpOf,
  xpToNext,
} from "../games/hedgerow/src/cath";
import { NO_PERKS } from "../games/hedgerow/src/engine";
import { cathLevel, emptySave, parseSave, perksOf } from "../games/hedgerow/src/store";

describe("Cath's character sheet", () => {
  it("earns XP from cleared levels and stars, and levels up on a rising curve", () => {
    expect(xpOf({})).toBe(0);
    expect(xpOf({ "1": 3, "2": 1 })).toBe(80 + 120 + 80 + 40);
    expect(levelOf(0)).toEqual({ level: 1, into: 0, need: xpToNext(1) });
    expect(levelOf(xpToNext(1)).level).toBe(2);
    expect(xpToNext(5)).toBeGreaterThan(xpToNext(1));
    // Every level cleared with three stars takes her past level 25.
    const all = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [String(i + 1), 3]));
    expect(levelOf(xpOf(all)).level).toBeGreaterThanOrEqual(25);
  });

  it("spends one skill point per level, caps attributes, and folds them into the perks", () => {
    const c = emptyCath();
    expect(freePoints(c, 1)).toBe(0);
    expect(raise(c, 1, "strength")).toBe(false);
    for (let i = 0; i < 3; i++) expect(raise(c, 4, "strength")).toBe(true);
    expect(raise(c, 4, "grit")).toBe(false);
    const p = { ...NO_PERKS };
    applyCath(p, c, 4);
    expect(p.heroDamage).toBeCloseTo(1.24);
    const big = emptyCath();
    for (let i = 0; i < ATTR_CAP + 2; i++) raise(big, 30, "leadership");
    expect(big.attrs.leadership).toBe(ATTR_CAP);
  });

  it("offers a talent every five levels, one choice each, applied only once reached", () => {
    const c = emptyCath();
    expect(talentsWaiting(c, 4)).toEqual([]);
    expect(talentsWaiting(c, 10)).toEqual([5, 10]);
    expect(pickTalent(c, 4, 5, 1)).toBe(false);
    expect(pickTalent(c, 6, 5, 1)).toBe(true);
    expect(pickTalent(c, 6, 5, 0)).toBe(false);
    const p = { ...NO_PERKS };
    applyCath(p, c, 6);
    expect(p.heroHolds).toBe(1);
    expect(TALENTS.every(([, opts]) => opts.length === 2)).toBe(true);
  });

  it("repairs junk in the save and never spends points she hasn't earned", () => {
    const c = parseCath({ attrs: { strength: 99, nonsense: 3, grit: -1 }, talents: { "5": 1, "7": 0, "10": 4 } });
    expect(c).toEqual({ attrs: { strength: ATTR_CAP }, talents: { "5": 1 } });
    const data = parseSave(JSON.stringify({ ...emptySave(), stars: {}, cath: c }));
    expect(cathLevel(data)).toBe(1);
    // Level 1: none of those points count yet, and the talent isn't reached.
    expect(perksOf(data).heroDamage).toBe(1);
    expect(perksOf(data).heroHolds).toBe(0);
  });
});

describe("Cath's wardrobe", () => {
  it("unlocks outfits by playing and only wears what's earned", async () => {
    const { WARDROBE, outfitOf } = await import("../games/hedgerow/src/cath");
    expect(WARDROBE.map((w) => w.id)).toEqual(["field", "market", "wax", "pinny", "gown"]);
    const c = emptyCath();
    c.outfit = "gown";
    expect(outfitOf(c, {}, 0)).toBe("field");
    expect(outfitOf(c, { "90": 1 }, 0)).toBe("gown");
    c.outfit = "wax";
    expect(outfitOf(c, {}, 4)).toBe("field");
    expect(outfitOf(c, {}, 5)).toBe("wax");
    expect(parseCath({ attrs: {}, talents: {}, outfit: "pyjamas" }).outfit).toBeUndefined();
    expect(parseCath({ attrs: {}, talents: {}, outfit: "pinny" }).outfit).toBe("pinny");
  });
});
