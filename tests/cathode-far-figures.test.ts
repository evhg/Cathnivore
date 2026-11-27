import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { readFileSync } from "node:fs";
import { createShared, patchMaterial } from "../games/cathode/src/render/shading";

// Plan item 737: on a phone the street's people past about 9 m take a distance-ramped lift (CATHODE_FAR), so a
// passer-by at 20 m reads against the street (measured with scripts/cathode-737-figures.mjs: 1.09-4.4x -> 3.5-10x
// luminance at 18-22 m). Desktop tiers draw them at full size and keep item 724's light alone.
describe("NIGHT SHIFT far figures (plan item 737)", () => {
  it("the far lift is its own shader variant, off unless asked", () => {
    const s = createShared();
    const lifted = patchMaterial(new THREE.MeshStandardMaterial(), s, { kind: "prop", rim: 1.35, far: 1 });
    const plain = patchMaterial(new THREE.MeshStandardMaterial(), s, { kind: "prop", rim: 1.35 });
    expect(lifted.defines?.CATHODE_FAR).toBe("1.000");
    expect(plain.defines?.CATHODE_FAR).toBeUndefined();
    expect(lifted.customProgramCacheKey()).not.toBe(plain.customProgramCacheKey());
  });

  it("the world lifts the street's people (walkers and standing crowds) on the phone tier only", () => {
    const src = readFileSync("games/cathode/src/render/world.ts", "utf8");
    const uses = src.match(/far: quality === "phone" \? PEOPLE_LIGHT\.far : 0/g) ?? [];
    expect(uses.length).toBe(2);
    expect(src).toMatch(/PEOPLE_LIGHT = \{[^}]*far: 1/);
  });
});
