import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildCath, dressCath, liftCath } from "../games/hedgerow/src/render3d/models";

// Plan item 84: in 3D her long hair read as a pair of white wings: the lift that keeps her readable on the
// field glowed her vertex-coloured hair by its white base colour. Her hair now glows only as dark as it is.
describe("Cath's 3D hair", () => {
  it("never glows lighter than her hair colour", () => {
    const cath = buildCath(null);
    dressCath(cath);
    liftCath(cath);
    let hair = 0;
    cath.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      if (!mat.vertexColors) return;
      hair++;
      expect(mat.emissive.getHSL({ h: 0, s: 0, l: 0 }).l * mat.emissiveIntensity).toBeLessThan(0.1);
    });
    expect(hair).toBeGreaterThanOrEqual(5);
  });

  // Plan item 81: her skin and collar, lifted at full strength, blew out to white (a beard across her face).
  it("lifts no part of her so far that it blows out", () => {
    const cath = buildCath(null);
    dressCath(cath);
    liftCath(cath);
    cath.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      // A deliberate glow (emission its own colour, such as her pin's halo) is left out.
      if (!mat.isMeshStandardMaterial || mat.emissive.equals(mat.color)) return;
      expect(mat.emissive.getHSL({ h: 0, s: 0, l: 0 }).l * mat.emissiveIntensity).toBeLessThanOrEqual(0.2);
    });
  });
});
