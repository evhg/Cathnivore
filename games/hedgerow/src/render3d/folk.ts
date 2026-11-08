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

let bakedMat: THREE.Material | null = null;

/**
 * Plan item 255: the people drawn to the 2D field's standard: a toon ramp (three flat bands of light, like the 2D
 * sprites' cel shading) and an ink outline. The outline is an inverted hull baked into the same vertex-coloured
 * geometry (pushed out along the normals, wound the other way, coloured ink), so it costs no draw call.
 */
let toonRamp: THREE.DataTexture | null = null;
export function toonGradient(): THREE.DataTexture {
  if (toonRamp) return toonRamp;
  const t = new THREE.DataTexture(new Uint8Array([110, 110, 110, 255, 190, 190, 190, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return (toonRamp = t);
}
const INK = new THREE.Color("#2b2320");
let inkMat: THREE.MeshBasicMaterial | null = null;
/**
 * Plan item 255: an ink outline on a figure built from separate meshes (Cath, Hollowell's rep): on its `n` largest
 * meshes, each a child hull of its mesh (so it moves with it), drawn in flat ink. `w` is the line's width in the
 * figure's own units. Returns the hulls added.
 */
export function inkFigure(root: THREE.Object3D, n: number, w: number): THREE.Mesh[] {
  root.updateMatrixWorld(true);
  const meshes: Array<{ m: THREE.Mesh; r: number }> = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry.attributes.normal || (m.material as THREE.Material).transparent || o.userData.ink) return;
    m.geometry.computeBoundingSphere();
    const s = new THREE.Vector3().setFromMatrixScale(m.matrixWorld);
    meshes.push({ m, r: m.geometry.boundingSphere!.radius * Math.max(s.x, s.y, s.z) });
  });
  inkMat ??= Object.assign(new THREE.MeshBasicMaterial({ color: INK }), { shared: true });
  const out: THREE.Mesh[] = [];
  // the largest parts, but at most two of one material (her long hair's layers would otherwise take every line)
  const per = new Map<THREE.Material, number>();
  const picked = meshes
    .sort((a, b) => b.r - a.r)
    .filter(({ m }) => {
      const k = per.get(m.material as THREE.Material) ?? 0;
      per.set(m.material as THREE.Material, k + 1);
      return k < 2;
    })
    .slice(0, n);
  for (const { m } of picked) {
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    // the line's width in the mesh's own units (its world scale divided out)
    const s = new THREE.Vector3().setFromMatrixScale(m.matrixWorld);
    // a lathe's normals can face in: push the hull the way most normals point away from the part's centre
    g.computeBoundingSphere();
    const c = g.boundingSphere!.center;
    const pos = g.attributes.position!;
    const nor = g.attributes.normal!;
    let outward = 0;
    for (let i = 0; i < pos.count; i++) outward += (pos.getX(i) - c.x) * nor.getX(i) + (pos.getY(i) - c.y) * nor.getY(i) + (pos.getZ(i) - c.z) * nor.getZ(i) >= 0 ? 1 : -1;
    const hull = new THREE.Mesh(inkHull(g, (outward >= 0 ? 1 : -1) * (w / Math.max(1e-6, (s.x + s.y + s.z) / 3))), inkMat);
    g.dispose();
    hull.userData.ink = true;
    hull.castShadow = false;
    m.add(hull);
    out.push(hull);
  }
  return out;
}
/** An inverted hull of a non-indexed geometry with normals and colours: each triangle pushed out by `w` and turned
 *  inside out, coloured ink. Merged with the original, it draws as an outline round the figure. */
export function inkHull(geom: THREE.BufferGeometry, w: number): THREE.BufferGeometry {
  const pos = geom.attributes.position!;
  const nor = geom.attributes.normal!;
  const n = pos.count;
  const p = new Float32Array(n * 3);
  const nn = new Float32Array(n * 3);
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 3)
    for (const [k, src] of [[0, 0], [1, 2], [2, 1]] as const) {
      const j = i + src;
      const o = (i + k) * 3;
      p[o] = pos.getX(j) + nor.getX(j) * w;
      p[o + 1] = pos.getY(j) + nor.getY(j) * w;
      p[o + 2] = pos.getZ(j) + nor.getZ(j) * w;
      nn[o] = -nor.getX(j);
      nn[o + 1] = -nor.getY(j);
      nn[o + 2] = -nor.getZ(j);
      c[o] = INK.r;
      c[o + 1] = INK.g;
      c[o + 2] = INK.b;
    }
  const h = new THREE.BufferGeometry();
  h.setAttribute("position", new THREE.BufferAttribute(p, 3));
  h.setAttribute("normal", new THREE.BufferAttribute(nn, 3));
  h.setAttribute("color", new THREE.BufferAttribute(c, 3));
  return h;
}
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
  const body = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)));
  for (const p of parts) p.dispose();
  // Plan item 255: the ink outline, a hull about 1.2 cm out at the field's scale
  const merged = mergeGeometries([body, inkHull(body, 0.012)])!;
  body.dispose();
  bakedMat ??= Object.assign(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() }), { shared: true });
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

/**
 * Plan item 284: the farmers and neighbours in Cath's proportions (about five heads tall; they were chibi boxes with
 * a ball for a head): tapered legs in work trousers and boots, a shirt under dungarees or a gilet, sleeves with
 * hands, a neck, and a head with hair, eyes, cheeks and a nose under a straw hat, a flat cap or a headscarf. Bea
 * stays a child (about four heads), in her pink dress and bunches. Everything bakes into one mesh per moving part.
 */
const SHIRTS = ["#c4433a", "#4f7fb0", "#d9a441", "#7a9a52", "#b5657a"];
const HAIRS = ["#5b3a26", "#2e211c", "#a9a39a", "#b8642e", "#d8c08a"];
const SKINS = ["#f0c9a0", "#e2b08a", "#c98f66", "#f3d3b6"];
function person(f: Folk): Rig {
  const bea = f.kind === "bea";
  const h = bea ? 0.6 : 0.86;
  const v = f.id;
  const shirt = bea ? "#e8748b" : SHIRTS[v % SHIRTS.length]!;
  const skin = SKINS[(v * 3 + 1) % SKINS.length]!;
  const hairC = bea ? "#2e211c" : HAIRS[(v * 7 + 2) % HAIRS.length]!;
  const look = bea ? -1 : v % 3; // 0 straw hat, 1 flat cap, 2 headscarf
  const legC = bea ? "#f6efe4" : v % 2 ? "#3f5a7a" : "#6b5843";
  const over = bea ? "#e8748b" : v % 2 ? "#3f5a7a" : "#56603f"; // dungarees, or a waxed gilet
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const hip = h * (bea ? 0.4 : 0.47);
  const shoulder = h * (bea ? 0.7 : 0.8);
  const legs = [-1, 1].map((z) => {
    const leg = hinge(legC, h * 0.075, hip * 0.86, 0, hip, z * h * 0.05);
    leg.add(part("box", "#3a2a20", h * 0.11, h * 0.06, h * 0.075, h * 0.02, -hip * 0.93, 0));
    return leg;
  });
  body.add(...legs);
  // The torso: a shirt, narrower at the waist, and the bib or gilet over its front.
  const tw = h * (bea ? 0.15 : 0.13);
  body.add(part("disc", shirt, tw * 1.6, shoulder - hip + h * 0.02, tw * 2.3, 0, (hip + shoulder) / 2, 0));
  if (bea) body.add(part("cone", shirt, h * 0.42, h * 0.26, h * 0.42, 0, hip + h * 0.04, 0));
  else {
    body.add(part("box", over, h * 0.06, (shoulder - hip) * 0.62, tw * 1.5, tw * 0.62, hip + (shoulder - hip) * 0.33, 0));
    body.add(part("disc", over, tw * 1.7, h * 0.12, tw * 2.4, 0, hip + h * 0.02, 0));
    // Straps (dungarees) or the gilet's open front.
    for (const z of [-1, 1]) body.add(part("box", over, h * 0.03, (shoulder - hip) * 0.45, h * 0.03, tw * 0.7, shoulder - (shoulder - hip) * 0.25, z * tw * 0.55));
  }
  const arms = [-1, 1].map((z) => {
    const arm = hinge(shirt, h * 0.06, h * 0.3, 0, shoulder - h * 0.02, z * (tw * 1.15 + h * 0.03));
    arm.add(part("ball", skin, h * 0.065, h * 0.075, h * 0.065, 0, -h * 0.32, 0));
    return arm;
  });
  body.add(...arms);
  body.add(part("rod", skin, h * 0.055, h * 0.05, h * 0.055, 0, shoulder + h * 0.04, 0));
  const head = new THREE.Group();
  const hr = h * (bea ? 0.13 : 0.095);
  head.position.set(0, shoulder + h * 0.02 + hr, 0);
  head.add(part("ball", skin, hr * 1.9, hr * 2.15, hr * 1.85));
  // Hair round the back and crown, then the face on the side the figure faces (+x).
  head.add(part("ball", hairC, hr * 1.95, hr * 1.9, hr * 2.0, -hr * 0.22, hr * 0.22, 0));
  for (const z of [-1, 1]) {
    head.add(part("ball", "#2b2320", hr * 0.36, hr * 0.46, hr * 0.32, hr * 0.84, hr * 0.08, z * hr * 0.36));
    head.add(part("ball", "#ffffff", hr * 0.14, hr * 0.14, hr * 0.14, hr * 0.98, hr * 0.2, z * hr * 0.32));
    head.add(part("ball", "#e88d82", hr * 0.34, hr * 0.22, hr * 0.3, hr * 0.8, -hr * 0.26, z * hr * 0.5));
    head.add(part("box", hairC, hr * 0.12, hr * 0.1, hr * 0.42, hr * 0.86, hr * 0.42, z * hr * 0.36));
  }
  head.add(part("ball", skin, hr * 0.32, hr * 0.36, hr * 0.3, hr * 0.98, -hr * 0.1, 0));
  head.add(part("box", "#a8564e", hr * 0.1, hr * 0.08, hr * 0.42, hr * 0.88, -hr * 0.48, 0));
  if (bea) {
    head.add(part("ball", hairC, hr * 2.08, hr * 1.6, hr * 2.08, -hr * 0.12, hr * 0.28, 0));
    for (const z of [-1, 1]) {
      head.add(part("ball", hairC, hr * 0.84, hr * 0.84, hr * 0.84, -hr * 0.2, 0, z * hr * 1.16));
      head.add(part("ball", "#f2c94c", hr * 0.36, hr * 0.36, hr * 0.36, -hr * 0.2, hr * 0.44, z * hr * 1.04));
    }
  } else if (look === 0) {
    // A straw hat: a wide brim, a crown and a band in the shirt's colour.
    head.add(part("disc", "#e3c26a", hr * 3.6, hr * 0.14, hr * 3.6, 0, hr * 0.78, 0));
    head.add(part("disc", "#e3c26a", hr * 2.0, hr * 0.8, hr * 2.0, 0, hr * 1.14, 0));
    head.add(part("disc", shirt, hr * 2.06, hr * 0.2, hr * 2.06, 0, hr * 0.92, 0));
  } else if (look === 1) {
    // A tweed flat cap, its peak over the eyes.
    head.add(part("ball", "#7a6a55", hr * 2.08, hr * 0.9, hr * 2.08, 0, hr * 0.74, 0));
    head.add(part("box", "#6a5b48", hr * 0.8, hr * 0.12, hr * 1.5, hr * 0.98, hr * 0.68, 0));
  } else {
    // A headscarf tied at the nape, in a print colour.
    head.add(part("ball", "#d65f5f", hr * 2.06, hr * 1.5, hr * 2.08, -hr * 0.1, hr * 0.44, 0));
    head.add(part("ball", "#d65f5f", hr * 0.6, hr * 0.5, hr * 0.6, -hr * 1.04, -hr * 0.1, 0));
  }
  body.add(head);
  let tool: THREE.Group | undefined;
  if (!bea) {
    // A hoe in the near hand: handle and blade, pivoting at the hand.
    tool = new THREE.Group();
    tool.add(part("rod", "#8a6238", h * 0.035, h * 0.8, h * 0.035));
    tool.add(part("box", "#7d8a92", h * 0.15, h * 0.035, h * 0.09, h * 0.06, -h * 0.8, 0));
    tool.position.set(h * 0.1, shoulder - h * 0.3, tw * 1.15 + h * 0.08);
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
