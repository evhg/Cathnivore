// Plan item 148: the title's noir key. A wordless neon blade (a crescent moon over three stars in a pink tube
// border) hangs from the overhead wires a few metres behind her (screen right of her on the title), and its light is her key and rim: the pink lights in
// render/frontscene.ts follow `level`, so when the tube stutters, she does too. Unlit HDR tubes (they bloom and
// show in the wet street's mirror), one merged mesh for the tubes and one for the iron (both unlit), so it costs two draw calls.

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export interface FrontNeon {
  readonly group: THREE.Group;
  /** The tube's brightness now, 0..1 (1 lit, about 0.12 in a stutter's dark beats). */
  level(t: number, still: boolean): number;
  /** Writes `level` into the tubes' colour. */
  update(t: number, still: boolean): void;
  dispose(): void;
}

/** The tube colour (linear, HDR): hot pink, bright enough for the bloom to halo it. */
const TUBE = new THREE.Color(3.2, 0.2, 1.05);

/**
 * The stutter: lit, then once every 7.3 s a 0.62 s fault of dark and lit beats (a failing ballast), then lit again.
 * Deterministic in loop time so screenshots at t = 8 or 26 always hold it lit. Reduced motion never stutters.
 */
export function neonLevel(t: number, still: boolean): number {
  if (still) return 1;
  const u = (((t % 7.3) + 7.3) % 7.3) - 5.1;
  if (u < 0 || u > 0.62) return 1;
  const beat = Math.floor(u * 21);
  return [1, 0.12, 0.12, 1, 0.12, 0.6, 1, 0.12, 0.12, 0.12, 1, 0.3, 1, 1][beat % 14]!;
}

export function buildFrontNeon(phone: boolean): FrontNeon {
  const group = new THREE.Group();
  group.name = "front-neon";
  const seg = phone ? 5 : 8;
  const r = 0.017;
  const tubes: THREE.BufferGeometry[] = [];
  const tube = (pts: Array<[number, number]>, closed = false) => {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, 0.03)), closed, "catmullrom", 0.2);
    tubes.push(new THREE.TubeGeometry(curve, Math.max(12, pts.length * 6), r, seg, closed));
  };
  // The border: a tall blade with a pointed foot, 0.62 x 1.3 m.
  tube([[-0.31, 0.65], [0.31, 0.65], [0.31, -0.45], [0, -0.65], [-0.31, -0.45]], true);
  // The crescent: two arcs meeting at the horns.
  const arc = (cx: number, cy: number, rad: number, a0: number, a1: number, n = 14): Array<[number, number]> =>
    Array.from({ length: n + 1 }, (_, i) => {
      const a = a0 + ((a1 - a0) * i) / n;
      return [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad];
    });
  tube([...arc(0, 0.22, 0.2, Math.PI * 0.35, Math.PI * 1.65), ...arc(0.09, 0.22, 0.15, Math.PI * 1.45, Math.PI * 0.55, 12)]);
  // Three small stars down the blade, each a four-point twinkle.
  for (const [sx, sy, s] of [[0.12, -0.1, 0.07], [-0.08, -0.27, 0.055], [0.06, -0.42, 0.045]] as const) {
    tube([[sx - s, sy], [sx + s, sy]]);
    tube([[sx, sy - s], [sx, sy + s]]);
  }
  const tubeGeo = mergeGeometries(tubes)!;
  for (const g of tubes) g.dispose();
  const tubeMat = new THREE.MeshBasicMaterial({ color: TUBE.clone(), fog: false });
  const tubesMesh = new THREE.Mesh(tubeGeo, tubeMat);
  tubesMesh.name = "front-neon-tubes";
  group.add(tubesMesh);
  // The iron: a channel along the top and a stub at the foot, unlit near-black.
  const iron: THREE.BufferGeometry[] = [
    // A slim channel frame behind the border tube, not a plate (a lit plate read as a pink shield).
    new THREE.BoxGeometry(0.66, 0.025, 0.03).translate(0, 0.67, -0.01),
    new THREE.BoxGeometry(0.025, 0.025, 0.03).translate(0, -0.66, -0.01),
    // It hangs over the street from the overhead wires on two long rods.
    new THREE.CylinderGeometry(0.008, 0.008, 3, 5).translate(-0.24, 2.17, 0),
    new THREE.CylinderGeometry(0.008, 0.008, 3, 5).translate(0.24, 2.17, 0),
  ];
  const ironGeo = mergeGeometries(iron)!;
  for (const g of iron) g.dispose();
  const ironMat = new THREE.MeshBasicMaterial({ color: 0x0a090c });
  const ironMesh = new THREE.Mesh(ironGeo, ironMat);
  ironMesh.name = "front-neon-iron";
  group.add(ironMesh);
  const now = new THREE.Color();
  return {
    group,
    level: neonLevel,
    update(t, still) {
      const k = neonLevel(t, still);
      tubeMat.color.copy(now.copy(TUBE).multiplyScalar(k));
    },
    dispose() {
      group.removeFromParent();
      tubeGeo.dispose();
      ironGeo.dispose();
      tubeMat.dispose();
      ironMat.dispose();
    },
  };
}
