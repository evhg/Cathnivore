import { describe, expect, it } from "vitest";
import { SWARM_GAP, SWARM_MIN, swarms } from "../games/hedgerow/src/swarm";

const queue = (n: number, from: number, kind = "van", lane?: 1) =>
  Array.from({ length: n }, (_, i) => ({ kind, dist: from - i * (SWARM_GAP * 0.8), ...(lane ? { lane } : {}) }));

describe("Hedgerow swarms", () => {
  it("badges only a queue of more than 12", () => {
    expect(swarms(queue(SWARM_MIN, 20) as never)).toEqual([]);
    const [s] = swarms(queue(SWARM_MIN + 1, 20) as never);
    expect(s?.count).toBe(SWARM_MIN + 1);
  });

  it("splits queues at a gap and keeps lanes apart", () => {
    const units = [...queue(14, 40), ...queue(15, 20), ...queue(13, 40, "van", 1)];
    const out = swarms(units as never);
    expect(out.map((s) => [s.count, s.lane ?? 0])).toEqual([
      [13, 1],
      [14, 0],
      [15, 0],
    ]);
  });

  it("gives the make-up by type, commonest first, and a middle for the badge", () => {
    const units = [...queue(5, 30, "drone"), ...queue(9, 30 - 5 * SWARM_GAP * 0.8, "van")];
    const [s] = swarms(units as never);
    expect(s!.kinds).toEqual([
      { kind: "van", n: 9 },
      { kind: "drone", n: 5 },
    ]);
    expect(s!.dist).toBeLessThan(30);
    expect(s!.dist).toBeGreaterThan(30 - 14 * SWARM_GAP);
  });
});
