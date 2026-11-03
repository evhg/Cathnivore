import { describe, expect, it } from "vitest";
import { isBig, newGame, waveSpawns } from "../games/hedgerow/src/engine";
import { gateQueue } from "../games/hedgerow/src/gatequeue";
import { LEVELS } from "../games/hedgerow/src/levels";

// Plan item 72: the queue at the Hollowell gate previews the next round: its leads are that round's vehicles in
// spawn order, and its plates count every vehicle Go will send (twists applied).
describe("Hedgerow gate queue", () => {
  it("leads in spawn order per lane, counts the whole round, and flags big vehicles", () => {
    const q = gateQueue(
      [
        { at: 2.5, kind: "drone" },
        { at: 3.5, kind: "drone" },
        { at: 0, kind: "van" },
        { at: 1, kind: "van" },
        { at: 2, kind: "van" },
        { at: 3, kind: "van" },
        { at: 0.5, kind: "hatchback", ambush: 0.4 },
        { at: 20, kind: "boss", lane: 1 },
      ],
      isBig,
    )!;
    expect(q.leads).toEqual(["van", "van", "van", "drone"]);
    expect(q.leads2).toEqual(["boss"]);
    expect(q.count).toBe(7);
    expect(q.count2).toBe(1);
    expect(q.boss).toBe(true);
    expect(gateQueue([], isBig)).toBeNull();
  });

  it("matches the next wave's kinds and counts on every level", () => {
    for (const lv of LEVELS) {
      const game = newGame(lv);
      lv.waves.forEach((groups, w) => {
        const spawns = waveSpawns(game, groups, w + 1);
        const q = gateQueue(spawns, isBig)!;
        const at = `level ${lv.id} wave ${w + 1}`;
        const kinds = new Set(spawns.map((sp) => sp.kind));
        expect(q.leads.length + q.leads2.length, at).toBeGreaterThan(0);
        for (const k of [...q.leads, ...q.leads2]) expect(kinds.has(k), at).toBe(true);
        expect(q.count + q.count2, at).toBe(spawns.length);
        expect(q.boss, at).toBe(spawns.some((sp) => isBig(sp.kind)));
        if (!lv.path2) expect(q.count2, at).toBe(0);
      });
    }
  });
});
