import { describe, expect, it } from "vitest";
import { signatureGain } from "../games/cathode/src/render/lighting";

describe("signature lighting", () => {
  it("is neutral without a signature", () => {
    expect(signatureGain(undefined, 5)).toBe(1);
  });
  it("clinic brownout dips only in its window", () => {
    expect(signatureGain("brownout", 3)).toBe(1);
    let min = 1;
    for (let t = 18; t < 19.4; t += 0.05) min = Math.min(min, signatureGain("brownout", t));
    expect(min).toBeLessThan(0.5);
  });
  it("vault alarm breathes within 0.75..1.25", () => {
    for (let t = 0; t < 12; t += 0.3) expect(signatureGain("alarm", t)).toBeGreaterThanOrEqual(0.749);
  });
  it("tower surge swells above 1 then settles", () => {
    expect(signatureGain("surge", 22.6)).toBeGreaterThan(1.4);
    expect(signatureGain("surge", 5)).toBe(1);
  });
});

import { spinnerLanes, spinnerX } from "../games/cathode/src/render/traffic";
describe("air traffic", () => {
  it("keeps spinners on the track and moving", () => {
    const lanes = spinnerLanes(6, 220, -90, 60);
    for (const s of lanes) {
      for (const t of [0, 13, 400]) expect(Math.abs(spinnerX(s, t, 220))).toBeLessThanOrEqual(110);
      expect(spinnerX(s, 1, 220)).not.toBe(spinnerX(s, 0, 220));
    }
  });
});

import { crowdSpots, crowdSway } from "../games/cathode/src/render/crowd";
describe("ambient crowds", () => {
  it("scatters deterministically inside the radius and sways a little", () => {
    const a = crowdSpots(10, -4, 20, 3, 2);
    expect(a).toEqual(crowdSpots(10, -4, 20, 3, 2));
    for (const s of a) {
      expect(Math.hypot(s.x - 10, s.z + 4)).toBeLessThanOrEqual(3.001);
      for (const t of [0, 5, 99]) expect(Math.abs(crowdSway(s, t))).toBeLessThanOrEqual(0.061);
    }
  });
});
