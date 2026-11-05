// Plan item 143: the farmfolk in 3D. Small low-poly figures from a handful of shared primitives (no textures, a few
// dozen draw calls in all), posed each frame from the shared sim in `../farmfolk`: legs swing when walking, a hoe
// rocks when tending, everyone leans in on the run, crouches at home and hops with arms up on a cheer.

import * as THREE from "three";
import type { Folk } from "../farmfolk";
import { matte } from "./palette";
import { sharedGeometry } from "./fx";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

let geo: { box: THREE.BoxGeometry; ball: THREE.SphereGeometry; rod: THREE.CylinderGeometry; disc: THREE.CylinderGeometry; cone: THREE.ConeGeometry } | null = null;
function g() {
  return (geo ??= {
    box: sharedGeometry(new THREE.BoxGeometry(1, 1, 1)),
    ball: sharedGeometry(new THREE.SphereGeometry(0.5, 10, 8)),
    rod: sharedGeometry(new THREE.CylinderGeometry(0.5, 0.5, 1, 6).translate(0, -0.5, 0)),
    disc: sharedGeometry(new THREE.CylinderGeometry(0.5, 0.5, 1, 14)),
    cone: sharedGeometry(new THREE.ConeGeometry(0.5, 1, 6)),
  });
}

function part(shape: keyof NonNullable<typeof geo>, colour: string, sx: number, sy: number, sz: number, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(g()[shape], matte(colour, 0.85, false));
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  return m;
}

let bakedMat: THREE.MeshStandardMaterial | null = null;
/**
 * Merge every mesh directly under `o` (and under its plain groups, recursively, unless they are a pivot listed in
 * `keep`) into one vertex-coloured mesh, so a figure costs a draw call per moving part, not per primitive.
 */
function bake(o: THREE.Object3D, keep: Set<THREE.Object3D>, shadow: boolean): void {
  const parts: THREE.BufferGeometry[] = [];
  const collect = (node: THREE.Object3D, m: THREE.Matrix4) => {
    for (const c of [...node.children]) {
      if (keep.has(c)) continue;
      c.updateMatrix();
      const cm = m.clone().multiply(c.matrix);
      if ((c as THREE.Mesh).isMesh) {
        const mesh = c as THREE.Mesh;
        const geom = mesh.geometry.clone().applyMatrix4(cm);
        const col = (mesh.material as THREE.MeshStandardMaterial).color;
        const n = geom.attributes.position!.count;
        const arr = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) arr.set([col.r, col.g, col.b], i * 3);
        geom.setAttribute("color", new THREE.BufferAttribute(arr, 3));
        geom.deleteAttribute("uv");
        parts.push(geom);
        node.remove(c);
      } else if (c.children.length) {
        collect(c, cm);
        if (!c.children.length) node.remove(c);
      }
    }
  };
  collect(o, new THREE.Matrix4());
  if (!parts.length) return;
  const merged = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)));
  for (const p of parts) p.dispose();
  bakedMat ??= Object.assign(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 }), { shared: true });
  const mesh = new THREE.Mesh(merged, bakedMat);
  mesh.castShadow = shadow;
  o.add(mesh);
}

/** Bake a rig: its body (the shadow caster) and each moving part on its own. */
function bakeRig(r: Rig): Rig {
  const moving = [...r.legs, ...r.arms, r.head, r.tool, r.tail, r.wing].filter((x): x is THREE.Object3D => !!x);
  const keep = new Set(moving);
  bake(r.body, keep, true);
  for (const m of moving) bake(m, new Set(), false);
  return r;
}

interface Rig {
  root: THREE.Group;
  body: THREE.Group;
  legs: THREE.Object3D[];
  arms: THREE.Object3D[];
  head: THREE.Object3D;
  tool?: THREE.Object3D;
  tail?: THREE.Object3D;
  wing?: THREE.Object3D;
  h: number;
}

/** A pivot at (x, y, z) holding a rod hanging down from it. */
function hinge(colour: string, w: number, len: number, x: number, y: number, z: number): THREE.Group {
  const p = new THREE.Group();
  p.position.set(x, y, z);
  p.add(part("rod", colour, w, len, w));
  return p;
}

function person(f: Folk): Rig {
  const bea = f.kind === "bea";
  const h = bea ? 0.53 : 0.72;
  const shirt = bea ? "#e8748b" : f.id % 2 ? "#c4433a" : "#4f7fb0";
  const legC = bea ? "#f6efe4" : "#5b4a3a";
  const skin = "#f0c9a0";
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const hip = h * 0.4;
  const legs = [hinge(legC, h * 0.1, hip, 0, hip, -h * 0.06), hinge(legC, h * 0.1, hip, 0, hip, h * 0.06)];
  body.add(...legs);
  body.add(part("box", shirt, h * 0.2, h * 0.34, h * 0.28, 0, hip + h * 0.16, 0));
  const shoulder = hip + h * 0.3;
  const arms = [hinge(skin, h * 0.08, h * 0.3, 0, shoulder, -h * 0.17), hinge(skin, h * 0.08, h * 0.3, 0, shoulder, h * 0.17)];
  body.add(...arms);
  const head = new THREE.Group();
  head.position.set(0, shoulder + h * 0.14, 0);
  const hr = bea ? h * 0.32 : h * 0.26;
  head.add(part("ball", skin, hr, hr, hr));
  if (bea) {
    head.add(part("ball", "#2e211c", hr * 1.04, hr * 0.8, hr * 1.04, -hr * 0.06, hr * 0.14, 0));
    for (const z of [-1, 1]) {
      head.add(part("ball", "#2e211c", hr * 0.42, hr * 0.42, hr * 0.42, -hr * 0.1, 0, z * hr * 0.58));
      head.add(part("ball", "#f2c94c", hr * 0.18, hr * 0.18, hr * 0.18, -hr * 0.1, hr * 0.22, z * hr * 0.52));
    }
  } else {
    head.add(part("disc", "#e3c26a", hr * 1.55, hr * 0.1, hr * 1.55, 0, hr * 0.42, 0));
    head.add(part("disc", "#e3c26a", hr * 0.9, hr * 0.36, hr * 0.9, 0, hr * 0.62, 0));
    head.add(part("disc", shirt, hr * 0.92, hr * 0.1, hr * 0.92, 0, hr * 0.5, 0));
    // Eyes on the side the figure faces, so a face reads under the brim.
    for (const z of [-1, 1]) head.add(part("ball", "#2b2320", hr * 0.16, hr * 0.16, hr * 0.16, hr * 0.42, hr * 0.05, z * hr * 0.2));
  }
  body.add(head);
  let tool: THREE.Group | undefined;
  if (!bea) {
    // A hoe in the near hand: handle and blade, pivoting at the hand.
    tool = new THREE.Group();
    tool.add(part("rod", "#8a6238", h * 0.04, h * 0.75, h * 0.04));
    tool.add(part("box", "#7d8a92", h * 0.16, h * 0.04, h * 0.1, h * 0.06, -h * 0.75, 0));
    tool.position.set(h * 0.12, shoulder - h * 0.2, h * 0.2);
    body.add(tool);
  }
  return { root, body, legs, arms, head, tool, h };
}

function dog(): Rig {
  const L = 0.5;
  const coat = "#3b3029";
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const legs = [
    hinge(coat, L * 0.1, L * 0.3, L * 0.3, L * 0.3, -L * 0.1),
    hinge(coat, L * 0.1, L * 0.3, L * 0.3, L * 0.3, L * 0.1),
    hinge(coat, L * 0.1, L * 0.3, -L * 0.3, L * 0.3, -L * 0.1),
    hinge(coat, L * 0.1, L * 0.3, -L * 0.3, L * 0.3, L * 0.1),
  ];
  body.add(...legs);
  body.add(part("ball", coat, L * 0.85, L * 0.36, L * 0.36, 0, L * 0.4, 0));
  body.add(part("ball", "#f4efe6", L * 0.3, L * 0.26, L * 0.3, L * 0.3, L * 0.36, 0));
  const head = new THREE.Group();
  head.position.set(L * 0.46, L * 0.58, 0);
  head.add(part("ball", coat, L * 0.32, L * 0.28, L * 0.3));
  head.add(part("ball", "#f4efe6", L * 0.22, L * 0.14, L * 0.18, L * 0.14, -L * 0.04, 0));
  head.add(part("ball", "#1a1412", L * 0.06, L * 0.06, L * 0.06, L * 0.26, -L * 0.02, 0));
  for (const z of [-1, 1]) head.add(part("cone", coat, L * 0.1, L * 0.16, L * 0.08, -L * 0.04, L * 0.17, z * L * 0.09));
  body.add(head);
  const tail = hinge(coat, L * 0.07, L * 0.3, -L * 0.4, L * 0.48, 0);
  body.add(tail);
  return { root, body, legs, arms: [], head, tail, h: L };
}

function hen(f: Folk): Rig {
  const L = 0.32;
  const col = f.id % 2 ? "#b5683a" : "#f3ead8";
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const legs = [hinge("#d99a2b", L * 0.06, L * 0.3, 0, L * 0.3, -L * 0.08), hinge("#d99a2b", L * 0.06, L * 0.3, 0, L * 0.3, L * 0.08)];
  body.add(...legs);
  body.add(part("ball", col, L * 0.8, L * 0.58, L * 0.55, 0, L * 0.55, 0));
  body.add(part("cone", col, L * 0.3, L * 0.4, L * 0.3, -L * 0.38, L * 0.78, 0));
  const wing = new THREE.Group();
  wing.position.set(0, L * 0.62, 0);
  wing.add(part("ball", f.id % 2 ? "#9a5530" : "#e2d6bf", L * 0.45, L * 0.28, L * 0.62));
  body.add(wing);
  const head = new THREE.Group();
  head.position.set(L * 0.36, L * 0.9, 0);
  head.add(part("ball", col, L * 0.3, L * 0.3, L * 0.3));
  head.add(part("ball", "#d4543c", L * 0.14, L * 0.14, L * 0.08, -L * 0.02, L * 0.17, 0));
  const beak = part("cone", "#e7a83a", L * 0.1, L * 0.16, L * 0.1, L * 0.18, 0, 0);
  beak.rotation.z = -Math.PI / 2;
  head.add(beak);
  body.add(head);
  // Her legs are baked into the body (a hen's stride is a bob at this size): one draw call fewer each.
  return { root, body, legs: [], arms: [], head, wing, h: L };
}

export class FolkMeshes {
  readonly group = new THREE.Group();
  private rigs = new Map<number, Rig>();

  constructor() {
    this.group.name = "farmfolk";
  }

  /** Pose everyone for this frame. `height(x, z)` is the ground under a point. */
  update(folk: readonly Folk[], height: (x: number, z: number) => number, t: number): void {
    const alive = new Set<number>();
    for (const f of folk) {
      alive.add(f.id);
      let r = this.rigs.get(f.id);
      if (!r) {
        r = bakeRig(f.kind === "dog" ? dog() : f.kind === "hen" ? hen(f) : person(f));
        this.rigs.set(f.id, r);
        this.group.add(r.root);
      }
      this.pose(r, f, t);
      r.root.position.set(f.x, height(f.x, f.y), f.y);
    }
    for (const [id, r] of this.rigs) if (!alive.has(id)) {
      this.group.remove(r.root);
      this.rigs.delete(id);
    }
  }

  private pose(r: Rig, f: Folk, t: number): void {
    const run = f.mode === "flee";
    const hide = f.mode === "home";
    const cheer = f.mode === "cheer";
    const fast = f.kind === "dog" || f.kind === "hen" ? 1.4 : 1;
    const stride = f.moving ? Math.sin(t * (run ? 20 : 10) * fast + f.id) : 0;
    // Facing: +x is "right" on screen; the figures are built facing +x.
    r.root.rotation.y = f.facing > 0 ? 0 : Math.PI;
    const hop = cheer ? Math.abs(Math.sin(f.t * 9 + f.id)) * r.h * 0.2 : 0;
    r.body.position.y = hop + (f.moving ? Math.abs(stride) * r.h * 0.04 : 0) - (hide ? r.h * 0.15 : 0);
    r.body.rotation.z = run ? -0.25 : hide ? -0.35 : 0;
    const legs = r.legs;
    for (let i = 0; i < legs.length; i++) legs[i]!.rotation.z = stride * 0.6 * (i % 2 ? -1 : 1) * (i >= 2 ? -1 : 1);
    if (r.arms.length) {
      const [a, b] = r.arms as [THREE.Object3D, THREE.Object3D];
      // Raised arms swing up in the screen's plane (about z), spread a little, so they read from the camera.
      const wave = cheer ? Math.sin(f.t * 12 + f.id) * 0.2 : 0;
      if (cheer) [a.rotation.x, b.rotation.x, a.rotation.z, b.rotation.z] = [0.35, -0.35, 2.85 + wave, 2.85 - wave];
      else if (hide) [a.rotation.x, b.rotation.x, a.rotation.z, b.rotation.z] = [0.5, -0.5, 2.3, 2.3];
      else [a.rotation.x, b.rotation.x, a.rotation.z, b.rotation.z] = [0.15, -0.15, -stride * 0.6, stride * 0.6];
    }
    if (r.tool) {
      r.tool.visible = !cheer && !hide && !run;
      const k = f.tending ? (Math.sin(f.t * 4 + f.id) + 1) / 2 : 0.2;
      r.tool.rotation.z = 0.5 + k * 0.5;
    }
    if (f.kind === "bea") r.body.rotation.z = f.tending ? -0.3 : r.body.rotation.z;
    if (f.kind === "dog") {
      r.head.position.y = r.h * (f.tending ? 0.38 : 0.58);
      if (r.tail) r.tail.rotation.set(Math.sin(t * (cheer ? 26 : 10)) * 0.6, 0, hide ? 0.6 : 2.2);
    }
    if (f.kind === "hen") {
      const peck = f.tending ? Math.max(0, Math.sin(f.t * 7 + f.id * 1.7)) : 0;
      r.head.position.set(r.h * (0.36 + peck * 0.1), r.h * (0.9 - peck * 0.55), 0);
      if (r.wing) r.wing.rotation.x = run || cheer ? Math.sin(t * 22 + f.id) * 0.6 : 0;
    }
  }
}
