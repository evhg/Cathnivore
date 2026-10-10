// Ambient crowds: dozens of dark, rain-coated silhouettes milling about `crowd:*` markers. One InstancedMesh,
// CPU-animated sway (no lights, no shadows), so a whole plaza of bystanders costs a single draw call.

import * as THREE from "three";
import { LAYER_NO_REFLECT } from "./reflection";

export interface Spot {
  x: number;
  z: number;
  yaw: number;
  phase: number;
}

function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Deterministic scatter of `count` figures within `radius` of (cx, cz). */
export function crowdSpots(cx: number, cz: number, count: number, radius: number, seed = 1): Spot[] {
  const out: Spot[] = [];
  for (let i = 0; i < count; i++) {
    const a = hash(seed * 97 + i * 3.1) * Math.PI * 2;
    const r = Math.sqrt(hash(seed * 31 + i * 7.7)) * radius;
    out.push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, yaw: hash(seed + i * 5.3) * Math.PI * 2, phase: hash(i + seed) * 6.28 });
  }
  return out;
}

/** Sway offset (metres) of a figure at time t. */
export function crowdSway(s: Spot, t: number): number {
  return Math.sin(t * 1.3 + s.phase) * 0.06;
}

export function addCrowd(scene: THREE.Scene, centres: THREE.Vector3[], perCluster = 14, radius = 3.2) {
  const spots = centres.flatMap((c, k) => crowdSpots(c.x, c.z, perCluster, radius, k + 1).map((s) => ({ ...s, y: c.y })));
  if (!spots.length) return null;
  // Coat + head merged into one capsule-ish silhouette.
  const geo = new THREE.CapsuleGeometry(0.28, 1.2, 3, 8);
  geo.translate(0, 0.9, 0);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0x0a0d12 }), spots.length);
  mesh.layers.set(LAYER_NO_REFLECT);
  mesh.frustumCulled = false;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const p = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const place = (t: number) => {
    spots.forEach((s, i) => {
      q.setFromAxisAngle(up, s.yaw);
      sc.set(1, 0.9 + hash(i) * 0.2, 1);
      p.set(s.x + crowdSway(s, t), s.y, s.z + crowdSway({ ...s, phase: s.phase + 1.7 }, t));
      mesh.setMatrixAt(i, m.compose(p, q, sc));
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  place(0);
  scene.add(mesh);
  return { update: place };
}
