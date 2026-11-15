import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { CLASS_KEY, CLASS_KEY_AT, KEY_EASE } from "../games/cathode/src/render/frontscene";

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
  // Plan item 422: each class's key from its own angle (every pair 15 degrees or more apart, seen from her chest),
  // the colour and the angle crossfading in 200-300 ms when the pick changes.
  it("lights each class from its own angle", () => {
    expect(Object.keys(CLASS_KEY_AT).sort()).toEqual(Object.keys(CLASS_KEY).sort());
    const dir = (k: string) => new THREE.Vector3(...CLASS_KEY_AT[k]!).sub(new THREE.Vector3(0, 1.3, 0)).normalize();
    const names = Object.keys(CLASS_KEY_AT);
    for (const a of names)
      for (const b of names) {
        if (a >= b) continue;
        expect(THREE.MathUtils.radToDeg(dir(a).angleTo(dir(b))), `${a}/${b}`).toBeGreaterThanOrEqual(15);
      }
  });
  it("crossfades the key in 200-300 ms", () => {
    const t95 = Math.log(20) / KEY_EASE;
    expect(t95).toBeGreaterThanOrEqual(0.2);
    expect(t95).toBeLessThanOrEqual(0.3);
  });
});
