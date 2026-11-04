import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildCath, dressCath, liftCath } from "../games/hedgerow/src/render3d/models";

// Plan item 102: the 3D Cath is drawn to the character bible, with named hair, face, jacket and blouse parts.
describe("Hedgerow 3D Cath parts", () => {
  it("has named hair, face, jacket and blouse parts, after her dress and lift", () => {
    const cath = buildCath(null);
    dressCath(cath);
    liftCath(cath);
    const names = new Set<string>();
    cath.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !Array.isArray(m.material) && m.material.name) names.add(m.material.name);
    });
    for (const part of ["hair", "face", "jacket", "blouse"]) expect(names, part).toContain(part);
  });
});
