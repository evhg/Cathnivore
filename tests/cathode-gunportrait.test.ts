import { describe, expect, it } from "vitest";
import { GUN_STILL_YAW, GUN_SWAY, turntableYaw } from "../games/cathode/src/render/gunportrait";

// Plan item 313: the pick's lit weapon turntable starts on the still three-quarter view and turns once round.
describe("gun turntable", () => {
  it("starts at the still three-quarter view", () => {
    expect(turntableYaw(0, 24)).toBe(GUN_STILL_YAW);
    expect(turntableYaw(0, 1)).toBe(GUN_STILL_YAW);
  });
  it("sways each way and comes back, never end-on", () => {
    const n = 48;
    const yaws = Array.from({ length: n + 1 }, (_, i) => turntableYaw(i, n));
    expect(Math.max(...yaws) - GUN_STILL_YAW).toBeCloseTo(GUN_SWAY);
    expect(GUN_STILL_YAW - Math.min(...yaws)).toBeCloseTo(GUN_SWAY);
    expect(yaws[n]).toBeCloseTo(GUN_STILL_YAW);
    // The kit's guns point down -z: broadside is a quarter turn; the sway stays well short of end-on.
    for (const y of yaws) expect(Math.abs(Math.sin(y))).toBeGreaterThan(0.45);
  });
});
