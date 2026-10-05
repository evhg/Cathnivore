import { describe, expect, it } from "vitest";
import { AutoScale } from "../games/cathode/src/game/autoscale";

describe("thermal rescue", () => {
  it("flags rescued after sustained slow frames at the floor", () => {
    const a = new AutoScale({ min: 0.55, max: 1, target: 1000 / 60, rescueMin: 0.35 });
    for (let i = 0; i < 30 * 20; i++) a.frame(40);
    expect(a.rescued).toBe(true);
    expect(a.scale).toBeCloseTo(0.35);
  });
});
