import { describe, expect, it } from "vitest";
import { liveryOf } from "../games/hedgerow/src/render3d/rungs";

describe("rung liveries", () => {
  it("is stable per vehicle and varies across a fleet", () => {
    for (let act = 1; act <= 10; act++) {
      const seen = new Set<string>();
      for (let id = 0; id < 40; id++) {
        expect(liveryOf(act, id).getHexString()).toBe(liveryOf(act, id).getHexString());
        seen.add(liveryOf(act, id).getHexString());
      }
      expect(seen.size).toBeGreaterThan(1);
    }
  });
});

import { LEVELS } from "../games/hedgerow/src/levels";
import { inFord } from "../games/hedgerow/src/engine";

describe("fords", () => {
  it("sit on wet-act fleet levels only", () => {
    const withFord = LEVELS.filter((l) => l.fords).map((l) => l.id);
    expect(withFord.length).toBeGreaterThan(0);
    for (const id of withFord) expect([3, 4, 6]).toContain(Math.ceil(id / 10));
    const l = LEVELS.find((x) => x.fords)!;
    const f = l.fords![0]!;
    expect(inFord(l, (f.from + f.to) / 2)).toBe(true);
    expect(inFord(l, f.to + 1)).toBe(false);
  });
});
