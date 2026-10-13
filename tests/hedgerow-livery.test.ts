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
