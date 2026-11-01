import { describe, expect, it } from "vitest";
import { countAt, foldLeaks, MAX_LEAK_CHIPS, tallyTimeline } from "../games/hedgerow/src/tally";

describe("Hedgerow end tally", () => {
  it("folds the same vehicle in the same round into one chip, in round order", () => {
    const { chips, more } = foldLeaks([
      { kind: "van", lost: 2, round: 5 },
      { kind: "van", lost: 2, round: 5 },
      { kind: "drone", lost: 1, round: 2 },
      { kind: "van", lost: 2, round: 7 },
    ] as never);
    expect(more).toBe(0);
    expect(chips.map((c) => [c.kind, c.round, c.n, c.lost])).toEqual([
      ["drone", 2, 1, 1],
      ["van", 5, 2, 4],
      ["van", 7, 1, 2],
    ]);
  });

  it("trims a long run to the chip cap and counts the rest", () => {
    const leaks = Array.from({ length: 12 }, (_, i) => ({ kind: "van", lost: 1, round: i + 1 }));
    const { chips, more } = foldLeaks(leaks as never);
    expect(chips).toHaveLength(MAX_LEAK_CHIPS);
    expect(more).toBe(12 - MAX_LEAK_CHIPS);
  });

  it("counts up from zero, eased, and lands exactly", () => {
    expect(countAt(1234, -5, 900)).toBe(0);
    expect(countAt(1234, 900, 900)).toBe(1234);
    expect(countAt(1234, 450, 900)).toBeGreaterThan(617);
    expect(countAt(1234, 450, 900)).toBeLessThan(1234);
    let prev = 0;
    for (let t = 0; t <= 900; t += 30) {
      const v = countAt(1234, t, 900);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it("starts the counters after the last star and lands leaks one after another", () => {
    const tl = tallyTimeline(3, 4);
    expect(tl.counters).toBeGreaterThan(260 * 2 + 200);
    expect(tl.leaks[0]).toBeGreaterThan(tl.counters + tl.countMs);
    for (let i = 1; i < tl.leaks.length; i++) expect(tl.leaks[i]!).toBeGreaterThan(tl.leaks[i - 1]!);
  });
});
