import { describe, expect, it } from "vitest";
import { HEIRLOOMS, BOONS, heirloomBoons, orchardSeeds, ORCHARD_MAX_DEPTH } from "../games/hedgerow/src/orchard";
import { buyHeirloom, emptySave, parseSave } from "../games/hedgerow/src/store";

describe("orchard heirlooms", () => {
  it("only reference real boons and cost more as they go", () => {
    for (const h of HEIRLOOMS) for (const b of h.boons) expect(BOONS.some((x) => x.id === b)).toBe(true);
    const costs = HEIRLOOMS.map((h) => h.cost);
    expect([...costs].sort((a, b) => a - b)).toEqual(costs);
    expect(heirloomBoons("nope")).toEqual([]);
  });
  it("seeds grow with depth", () => {
    expect(orchardSeeds(0)).toBe(0);
    expect(orchardSeeds(5)).toBe(7);
    expect(orchardSeeds(ORCHARD_MAX_DEPTH)).toBeGreaterThan(orchardSeeds(ORCHARD_MAX_DEPTH - 1));
  });
  it("buying spends seeds once and survives a reload", () => {
    const d = emptySave();
    d.seeds = 7;
    expect(buyHeirloom(d, "seedbag", 6)).toBe(true);
    expect(buyHeirloom(d, "seedbag", 6)).toBe(false);
    const r = parseSave(JSON.stringify(d));
    expect(r.seeds).toBe(1);
    expect(r.heirlooms).toEqual(["seedbag"]);
    expect(r.heirloom).toBe("seedbag");
  });
});

describe("orchard daily ladder", () => {
  it("keeps the deepest run per day and forgets old days", async () => {
    const { recordOrchardDay } = await import("../games/hedgerow/src/store");
    const d: any = {};
    expect(recordOrchardDay(d, 100, 3, ["thin"])).toBe(true);
    expect(recordOrchardDay(d, 100, 2, ["x"])).toBe(false);
    expect(d.orchardDays["100"]).toEqual({ depth: 3, boons: ["thin"] });
    recordOrchardDay(d, 120, 1, []);
    expect(d.orchardDays["100"]).toBeUndefined();
  });
});
