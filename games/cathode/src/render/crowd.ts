// Ambient crowds: dozens of dark, rain-coated silhouettes milling about `crowd:*` markers. One InstancedMesh,
// CPU-animated sway (no lights, no shadows), so a whole plaza of bystanders costs a single draw call.

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
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

// ------------------------------------------------------------ seated patients (the clinic's waiting room)
// Plan item 1: the Candor Clinic's waiting room seats its debtors in the chairs: hunched, seated figures in gowns
// and street coats, each with a lit debt tag on a lanyard. Four instanced draws (clothes, skin, hair, tags), built
// once and static. Each seat is (x, z, yaw): yaw 0 faces +x.

export interface Seat {
  x: number;
  z: number;
  yaw: number;
}

/** A cylinder from a to b (a limb). */
function limb(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1 = r0): THREE.BufferGeometry {
  const d = b.clone().sub(a);
  const g = new THREE.CylinderGeometry(r1, r0, d.length(), 7, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  const m = a.clone().add(b).multiplyScalar(0.5);
  g.translate(m.x, m.y, m.z);
  return g;
}

function ball(c: THREE.Vector3, r: number, sx = 1, sy = 1, sz = 1): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(r, 10, 8);
  g.scale(sx, sy, sz);
  g.translate(c.x, c.y, c.z);
  return g;
}

function boxAt(x: number, y: number, z: number, w: number, h: number, d: number, tilt = 0): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  if (tilt) g.rotateZ(tilt);
  g.translate(x, y, z);
  return g;
}

/** The seated figure's parts, in its own frame (seat centre on the floor, facing +x). */
export function seatedParts() {
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const clothes: THREE.BufferGeometry[] = [];
  const skin: THREE.BufferGeometry[] = [];
  // Thighs along the seat, shins down to the floor, shoes.
  for (const s of [-1, 1]) {
    const hip = v(-0.12, 0.55, s * 0.1);
    const knee = v(0.3, 0.56, s * 0.12);
    const ankle = v(0.36, 0.08, s * 0.12);
    clothes.push(limb(hip, knee, 0.085, 0.07), limb(knee, ankle, 0.06, 0.05), ball(knee, 0.07));
    clothes.push(boxAt(0.42, 0.04, s * 0.12, 0.24, 0.08, 0.1));
  }
  // Torso hunched forward over the knees, shoulders rounded.
  const pelvis = v(-0.14, 0.6, 0);
  const chest = v(-0.04, 1.02, 0);
  clothes.push(ball(pelvis, 0.17, 1, 0.7, 1.15), limb(pelvis, chest, 0.16, 0.19), ball(chest, 0.19, 0.8, 0.6, 1.15));
  // Arms: shoulder to elbow, forearms resting on the thighs, hands together near the knees.
  for (const s of [-1, 1]) {
    const sh = v(-0.04, 1.06, s * 0.21);
    const el = v(0.1, 0.74, s * 0.2);
    const wr = v(0.3, 0.64, s * 0.07);
    clothes.push(ball(sh, 0.07), limb(sh, el, 0.06, 0.05), limb(el, wr, 0.048, 0.04));
    skin.push(ball(v(0.33, 0.63, s * 0.05), 0.045, 1.3, 0.7, 1));
  }
  // Neck and a bowed head.
  skin.push(limb(v(0.0, 1.12, 0), v(0.06, 1.24, 0), 0.05), ball(v(0.1, 1.31, 0), 0.105, 1, 1.12, 0.92));
  const hair = [ball(v(0.07, 1.36, 0), 0.112, 1.02, 0.9, 0.97)];
  // Brows and the shadow of downcast eyes, so a face reads as a face at a few metres.
  for (const s of [-1, 1]) hair.push(boxAt(0.192, 1.33, s * 0.04, 0.02, 0.014, 0.045, -0.2), boxAt(0.193, 1.305, s * 0.038, 0.012, 0.012, 0.03));
  // The debt tag: a lanyard card on the chest, tipped forward with the hunch.
  const tags = [boxAt(0.15, 0.92, 0.0, 0.012, 0.085, 0.06, -0.25), boxAt(0.33, 0.67, -0.07, 0.035, 0.02, 0.05)];
  return { clothes, skin, hair, tags };
}

const CLOTHES = ["#6f8c86", "#7d8a8e", "#5d7a74", "#2a2622", "#3a2f2a", "#1d2430", "#4a3a3e", "#6a7072"];
const SKINS = ["#c99a7a", "#8a5a3c", "#e0b494", "#5c3a26", "#b07a58", "#d7a888"];
const HAIRS = ["#14100e", "#2a1c14", "#5a4a3a", "#8a8a88", "#1a1410"];

export function addPatients(scene: THREE.Scene, seats: Seat[], wrap: (m: THREE.MeshStandardMaterial) => THREE.Material) {
  if (!seats.length) return null;
  const parts = seatedParts();
  const merge = (gs: THREE.BufferGeometry[]) => mergeGeometries(gs.map((g) => (g.index ? g.toNonIndexed() : g)), false)!;
  const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, palette: string[] | null, salt: number) => {
    const mesh = new THREE.InstancedMesh(geo, mat, seats.length);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const sc = new THREE.Vector3();
    const p = new THREE.Vector3();
    const c = new THREE.Color();
    seats.forEach((s, i) => {
      // A little slump and turn per person, and a spread of builds.
      e.set(0, s.yaw + (hash(i * 3.3 + 1) - 0.5) * 0.35, (hash(i * 7.1) - 0.5) * 0.12);
      q.setFromEuler(e);
      const k = 0.92 + hash(i * 1.9) * 0.14;
      sc.set(k, k * (0.96 + hash(i * 2.7) * 0.08), k * (0.94 + hash(i * 4.1) * 0.16));
      mesh.setMatrixAt(i, m.compose(p.set(s.x, 0, s.z), q, sc));
      if (palette) mesh.setColorAt(i, c.set(palette[Math.floor(hash(i * 5.7 + salt) * palette.length)]!));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);
    return mesh;
  };
  const std = (rough: number) => wrap(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: rough, metalness: 0 }));
  mk(merge(parts.clothes), std(0.88), CLOTHES, 1);
  mk(merge(parts.skin), std(0.6), SKINS, 2);
  mk(merge(parts.hair), std(0.7), HAIRS, 3);
  // Tags glow amber (overdue) or red (in collections); unlit HDR like the signs.
  const tagMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const tags = mk(merge(parts.tags), tagMat, null, 4);
  const c = new THREE.Color();
  seats.forEach((_, i) => tags.setColorAt(i, c.set(hash(i * 9.1) > 0.7 ? "#ff2a18" : "#ffa020").multiplyScalar(4)));
  tags.instanceColor!.needsUpdate = true;
  return { count: seats.length };
}

/** A body under a sheet, lying along +x (head at +x), its underside at y = 0: the sheet drapes head, chest and feet. */
export function shroudParts() {
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const sheet = [
    ball(v(0.78, 0.11, 0), 0.12, 1.1, 0.9, 1),
    limb(v(0.62, 0.1, 0), v(0.05, 0.12, 0), 0.17, 0.2),
    ball(v(0.3, 0.12, 0), 0.2, 1.4, 0.55, 1.15),
    limb(v(0.05, 0.1, 0), v(-0.7, 0.07, 0), 0.19, 0.14),
    ball(v(-0.78, 0.16, 0.07), 0.06, 1, 1.5, 1),
    ball(v(-0.78, 0.16, -0.07), 0.06, 1, 1.5, 1),
    // The sheet's hem hangs past the gurney's edges.
    boxAt(0, 0.04, 0, 1.9, 0.03, 0.66),
  ];
  const tag = [boxAt(-0.86, 0.12, 0.08, 0.01, 0.05, 0.08, 0.3)];
  return { sheet, tag };
}

/** Shrouded bodies on the morgue's gurneys, with a lit toe tag each (two draws). */
export function addShrouds(scene: THREE.Scene, bodies: Array<{ x: number; y: number; z: number; yaw: number }>, wrap: (m: THREE.MeshStandardMaterial) => THREE.Material) {
  if (!bodies.length) return;
  const parts = shroudParts();
  const merge = (gs: THREE.BufferGeometry[]) => mergeGeometries(gs.map((g) => (g.index ? g.toNonIndexed() : g)), false)!;
  const sheetMat = wrap(new THREE.MeshStandardMaterial({ color: "#b8c4c0", roughness: 0.92, metalness: 0 }));
  const tagMat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#ffa020").multiplyScalar(3) });
  for (const [geo, mat] of [[merge(parts.sheet), sheetMat], [merge(parts.tag), tagMat]] as const) {
    const mesh = new THREE.InstancedMesh(geo, mat, bodies.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    bodies.forEach((b, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), b.yaw);
      const k = 0.94 + hash(i * 2.3) * 0.1;
      mesh.setMatrixAt(i, m.compose(new THREE.Vector3(b.x, b.y, b.z), q, new THREE.Vector3(k, 1, 1)));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    scene.add(mesh);
  }
}
