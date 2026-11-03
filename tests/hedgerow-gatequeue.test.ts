import { describe, expect, it } from "vitest";
import { isBig } from "../games/hedgerow/src/engine";
import { gateQueue } from "../games/hedgerow/src/gatequeue";
import { LEVELS } from "../games/hedgerow/src/levels";

// Plan item 72: the queue at the Hollowell gate previews the next round: its leads are that round's vehicles in
// spawn order, and its plates count every vehicle in it.
describe("Hedgerow gate queue", () => {
  it("leads in spawn order, counts the whole round, and flags big vehicles", () => {
    const q = gateQueue(
      [
        { enemy: "drone", count: 3, gap: 1, delay: 2.5 },
        { enemy: "van", count: 5, gap: 1, delay: 0 },
        { enemy: "boss", count: 1, gap: 0, delay: 20, lane: 1 },
      ],
      isBig,
    )!;
    expect(q.leads).toEqual(["van", "van", "van", "drone"]);
    expect(q.count).toBe(8);
    expect(q.count2).toBe(1);
    expect(q.boss).toBe(true);
    expect(gateQueue([], isBig)).toBeNull();
  });

  it("matches the next wave's kinds on every level", () => {
    for (const lv of LEVELS) {
      lv.waves.forEach((groups, w) => {
        const q = gateQueue(groups, isBig)!;
        const kinds = new Set(groups.map((g) => g.enemy));
        expect(q.leads.length, `level ${lv.id} wave ${w + 1}`).toBeGreaterThan(0);
        for (const k of q.leads) expect(kinds.has(k), `level ${lv.id} wave ${w + 1}`).toBe(true);
        expect(q.count + q.count2).toBe(groups.reduce((a, g) => a + g.count, 0));
        expect(q.boss).toBe(groups.some((g) => isBig(g.enemy)));
      });
    }
  });
});
