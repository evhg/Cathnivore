import { describe, expect, it } from "vitest";
import * as THREE from "three";
import type { EnemyKind } from "../games/hedgerow/src/engine";
import { newGame } from "../games/hedgerow/src/engine";
import { LEVELS } from "../games/hedgerow/src/levels";
import { Crops } from "../games/hedgerow/src/render3d/crops";
import { buildEnemy, buildRung } from "../games/hedgerow/src/render3d/models";

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
