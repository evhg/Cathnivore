import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { CLASS_KEY } from "../games/cathode/src/render/frontscene";

// Plan item 278: each class's key light on the pick is its own colour. Every pair of keys sits 40 degrees or more
// apart in hue, and each is saturated (so it reads as a colour on her coat, not a brighter white).
describe("NIGHT SHIFT class key lights", () => {
  const hsl = Object.fromEntries(Object.entries(CLASS_KEY).map(([k, [r, g, b]]) => [k, new THREE.Color(r, g, b).getHSL({ h: 0, s: 0, l: 0 })]));
  it("covers the five classes", () => {
    expect(Object.keys(CLASS_KEY).sort()).toEqual(["butcher", "fixer", "ghost", "gunslinger", "wirewitch"]);
  });
  it("keeps every pair 40 degrees apart in hue", () => {
    const names = Object.keys(hsl);
    for (const a of names)
      for (const b of names) {
        if (a >= b) continue;
        const d = Math.abs(hsl[a]!.h - hsl[b]!.h) * 360;
        expect(Math.min(d, 360 - d), `${a}/${b}`).toBeGreaterThanOrEqual(40);
      }
  });
  it("keeps each key saturated", () => {
    for (const [k, c] of Object.entries(hsl)) expect(c.s, k).toBeGreaterThan(0.6);
  });
});
