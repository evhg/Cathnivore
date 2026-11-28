import { describe, expect, it } from "vitest";
import * as THREE from "three";
import type { EnemyKind } from "../games/hedgerow/src/engine";
import { newGame } from "../games/hedgerow/src/engine";
import { LEVELS } from "../games/hedgerow/src/levels";
import { Crops } from "../games/hedgerow/src/render3d/crops";
import { buildEnemy, buildRung } from "../games/hedgerow/src/render3d/models";
import { RUNGS } from "../games/hedgerow/src/fleet";
import { GAP_3D } from "../games/hedgerow/src/convoy";

// Plan item 539: the 3D fleet is modelled, not blocked out (each road vehicle four or more wheels and two or more
// materials), and a bed grows in several plant shapes rather than one wallpapered cabbage.
const ROAD: EnemyKind[] = ["van", "wrapped", "truck", "tender", "influencer", "hatchback", "pickup", "sprinter", "lorry", "steel", "artic", "transporter", "crane", "skip", "execcar", "bus", "clinic"];

function stats(g: THREE.Object3D): { tyres: number; mats: number } {
  let tyres = 0;
  const mats = new Set<THREE.Material>();
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (m.userData.tyre) tyres++;
    for (const x of Array.isArray(m.material) ? m.material : [m.material]) mats.add(x);
  });
  return { tyres, mats: mats.size };
}

describe("Hedgerow 3D fleet models (plan item 539)", () => {
  for (const kind of ROAD)
    it(`${kind}: four or more wheels and two or more materials`, () => {
      const s = stats(buildRung(kind) ?? buildEnemy(kind));
      expect(s.tyres).toBeGreaterThanOrEqual(4);
      expect(s.mats).toBeGreaterThanOrEqual(2);
    });

  it("the lane's baked vehicles keep their wheels", () => {
    for (const kind of ["van", "truck", "tender"] as EnemyKind[]) expect(stats(buildEnemy(kind)).tyres).toBeGreaterThanOrEqual(4);
  });
});

describe("Hedgerow 3D crops (plan item 539)", () => {
  it("level 21's beds show three or more plant shapes", () => {
    const level = LEVELS.find((l) => l.id === 21)!;
    const canvas = { dataset: {} } as unknown as HTMLCanvasElement;
    const crops = new Crops(level, () => 0, canvas, true);
    crops.sync(newGame(level), 0, 1);
    expect(crops.shapesShown()).toBeGreaterThanOrEqual(3);
  });
});

// Plan item 703: the convoy's classes tell apart by colour as well as shape: each chromatic body (the Round Book's
// rungs from the courier to the transporter, which the queue pills, the 2D sprites and the 3D models all paint in
// RUNGS' colour) sits 40 degrees of hue or more from every other. The pickup was blue, 9 degrees from the navy lorry.
describe("Hedgerow convoy body hues (plan item 703)", () => {
  const CHAIN: EnemyKind[] = ["courier", "hatchback", "pickup", "sprinter", "lorry", "transporter"];
  const hue = (hex: string) => {
    const hsl = { h: 0, s: 0, l: 0 };
    new THREE.Color(hex).getHSL(hsl, THREE.SRGBColorSpace);
    return hsl.h * 360;
  };
  it("each pair of classes 40 degrees of hue apart", () => {
    for (const a of CHAIN)
      for (const b of CHAIN) {
        if (a >= b) continue;
        const d = Math.abs(hue(RUNGS[a]!.colour) - hue(RUNGS[b]!.colour));
        expect(Math.min(d, 360 - d), `${a} vs ${b}`).toBeGreaterThanOrEqual(40);
      }
  });
  it("the 3D model wears its class's colour", () => {
    for (const kind of CHAIN) {
      const want = RUNGS[kind]!.colour.slice(1);
      const got = new Set<string>();
      buildRung(kind)!.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (m?.color) got.add(m.color.getHexString(THREE.SRGBColorSpace));
      });
      expect([...got], kind).toContain(want);
    }
  });
});

// Plan item 757: Hollowell's vans are vans from the field camera, not bricks: glass the camera sees from above (a
// flat pane over the cab's roof edge, not only the upright screen) and a quarter of a van's length of road
// between queued vans.
describe("Hedgerow 3D vans (plan item 757)", () => {
  const VANS: EnemyKind[] = ["van", "sprinter", "wrapped", "truck", "tender", "clinic"];
  for (const kind of VANS)
    it(`${kind}: four wheels and glass seen from above`, () => {
      const g = buildRung(kind) ?? buildEnemy(kind);
      g.updateMatrixWorld(true);
      expect(stats(g).tyres).toBeGreaterThanOrEqual(4);
      let roofGlass = 0;
      g.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || !(m.material as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial) return;
        const b = new THREE.Box3().setFromObject(m);
        const s = b.getSize(new THREE.Vector3());
        if (s.y < s.x * 0.3 && s.z > 0.15) roofGlass++;
      });
      expect(roofGlass).toBeGreaterThanOrEqual(1);
    });

  // Measured 2026-11-28: before 757 a van baked to 25 meshes and 1,388 triangles; its glass and darks add 72
  // triangles and, sharing the chassis' dark, one mesh (each is a draw call per van on a classic level's lane).
  it("the van's detail stays in budget: 26 meshes and 1,600 triangles or fewer", () => {
    for (const kind of ["van", "tender"] as EnemyKind[]) {
      let meshes = 0;
      let tris = 0;
      buildEnemy(kind).traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        meshes++;
        tris += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position!.count) / 3;
      });
      expect(meshes, kind).toBeLessThanOrEqual(kind === "van" ? 26 : 27);
      expect(tris, kind).toBeLessThanOrEqual(1600);
    }
  });

  it("queued vans keep a quarter of a van's length of road between them", () => {
    expect(GAP_3D - 1).toBeGreaterThanOrEqual(0.25);
  });
});
