// ?debug=cover (S1.1): every collider bullets meet, drawn as a wireframe coloured by what it's made of, so a
// gap in the cover (a prop rounds pass through) shows at a glance. Thin, shot-only cover draws dashed-bright.

import * as THREE from "three";
import type { RayWorld } from "./ray";
import type { CoverMat } from "../sim/penetration";

const MAT_COLOUR: Record<CoverMat, number> = {
  concrete: 0x9aa0a8,
  metal: 0x48b8ff,
  metalSheet: 0x7fe0ff,
  glass: 0x7dffc0,
  drywall: 0xe8d6b0,
  cloth: 0xff7ad0,
  wood: 0xffa040,
  flesh: 0xff3b3b,
  water: 0x3060ff,
  chrome: 0xd0e0ff,
};

/** One LineSegments for every collider (12 edges each), vertex-coloured by material; thin cover brighter. */
export function coverWireframe(rays: RayWorld): THREE.LineSegments {
  const pos: number[] = [];
  const col: number[] = [];
  const c = new THREE.Color();
  const corners = (b: THREE.Box3, obb: { center: THREE.Vector3; half: THREE.Vector3; yaw: number } | null): THREE.Vector3[] => {
    const out: THREE.Vector3[] = [];
    for (let i = 0; i < 8; i++) {
      if (!obb) {
        out.push(new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z));
        continue;
      }
      const lx = (i & 1 ? 1 : -1) * obb.half.x;
      const ly = (i & 2 ? 1 : -1) * obb.half.y;
      const lz = (i & 4 ? 1 : -1) * obb.half.z;
      const cs = Math.cos(obb.yaw);
      const sn = Math.sin(obb.yaw);
      out.push(new THREE.Vector3(obb.center.x + lx * cs + lz * sn, obb.center.y + ly, obb.center.z - lx * sn + lz * cs));
    }
    return out;
  };
  const EDGES = [0, 1, 2, 3, 4, 5, 6, 7, 0, 2, 1, 3, 4, 6, 5, 7, 0, 4, 1, 5, 2, 6, 3, 7];
  for (const e of rays.entries) {
    const v = corners(e.box, e.obb);
    c.setHex(MAT_COLOUR[e.mat] ?? 0xffffff).multiplyScalar(e.thin ? 1.6 : 1);
    for (const k of EDGES) {
      const p = v[k]!;
      pos.push(p.x, p.y, p.z);
      col.push(c.r, c.g, c.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  const m = new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true, opacity: 0.9, toneMapped: false });
  const lines = new THREE.LineSegments(g, m);
  lines.name = "debug:cover";
  lines.renderOrder = 999;
  lines.frustumCulled = false;
  return lines;
}
