// Instanced Fleet rungs (Hedgerow 2 M2, docs/design/hedgerow-2.md section 8). Hundreds of vehicles can be on
// the lane at once, so the rungs are not a cloned Group each: every rung kind is one InstancedMesh, its model
// merged into a single vertex-coloured geometry. A pop swaps a vehicle to the next rung's mesh on the same
// frame (the engine changes its kind in place). About eight draw calls for the whole Fleet.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { EnemyKind } from "../engine";
import { P, PROPERTY_ORDER, type Property } from "../fleet";
import { drawPropIcon } from "../sprites";
import { buildEnemy, buildRung, enemyLift, enemyScale } from "./models";

/** Per-instance tints for the Fleet's materials (section 2): steel, bubble wrap, mesh, frost, hazard bands. */
const TINTS: Array<[number, THREE.Color]> = [
  [P.stealth, new THREE.Color(0.8, 1.0, 0.78)],
  [P.plated, new THREE.Color(0.72, 0.78, 0.86)],
  [P.sealed, new THREE.Color(0.78, 0.58, 1.0)],
  [P.reefer, new THREE.Color(0.8, 0.96, 1.0)],
  [P.wrapped, new THREE.Color(0.88, 0.97, 1.0)],
  [P.reinforced, new THREE.Color(1.0, 0.88, 0.45)],
];
const WHITE = new THREE.Color(1, 1, 1);
/** A stealth vehicle nothing can see: hedge-camo green, drawn see-through (section 2: "hedge-camo, 60% alpha"). */
const CAMO = new THREE.Color(0.45, 0.85, 0.45);
const GHOST_ALPHA = 0.5;

/** Icons are drawn this many world units across, a row of them over the vehicle. */
const ICON = 0.24;
const ICON_CAPACITY = 700;

/** One billboard InstancedMesh per property: its icon, drawn by the same code as the 2D field. */
function iconMesh(prop: Property): THREE.InstancedMesh {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  drawPropIcon(ctx, prop, 32, 32, 60);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false });
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(ICON, ICON), mat, ICON_CAPACITY);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.renderOrder = 12;
  mesh.name = `prop:${prop}`;
  return mesh;
}

/** The kinds drawn instanced on fleet levels (the boss keeps its own animated model). */
export const INSTANCED_RUNGS: readonly EnemyKind[] = ["courier", "hatchback", "van", "pickup", "sprinter", "lorry", "drone", "quad", "steel", "artic", "transporter"];

/** Per-kind instance capacity: the engine's live cap, plus a little room. */
const CAPACITY = 360;

/** Bakes a model into one geometry: world transforms applied, materials turned into vertex colours. */
function bakeModel(root: THREE.Object3D): THREE.BufferGeometry {
  root.updateMatrixWorld(true);
  const parts: THREE.BufferGeometry[] = [];
  const colour = new THREE.Color();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.visible) return;
    const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
    if (mat.transparent && mat.opacity < 0.5) return;
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    g.applyMatrix4(m.matrixWorld);
    for (const name of Object.keys(g.attributes)) if (name !== "position" && name !== "normal") g.deleteAttribute(name);
    colour.copy(mat.color ?? new THREE.Color("#ffffff"));
    const em = (mat as THREE.MeshStandardMaterial).emissive;
    const ei = (mat as THREE.MeshStandardMaterial).emissiveIntensity ?? 0;
    if (em && ei > 0) colour.lerp(em, Math.min(0.8, ei * 0.4));
    const n = g.attributes.position!.count;
    const cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) colour.toArray(cols, i * 3);
    g.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    if (!g.attributes.normal) g.computeVertexNormals();
    parts.push(g);
  });
  const merged = mergeGeometries(parts, false)!;
  for (const p of parts) p.dispose();
  return merged;
}

export class RungInstances {
  readonly group = new THREE.Group();
  private meshes = new Map<EnemyKind, THREE.InstancedMesh>();
  private used = new Map<EnemyKind, number>();
  /** The same rungs, translucent and camo-tinted, for unrevealed stealth vehicles. */
  private ghosts = new Map<EnemyKind, THREE.InstancedMesh>();
  private ghostUsed = new Map<EnemyKind, number>();
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private p = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);
  private tint = new THREE.Color();
  private icons = new Map<Property, THREE.InstancedMesh>();
  private iconUsed = new Map<Property, number>();
  private face = new THREE.Quaternion();
  private right = new THREE.Vector3(1, 0, 0);

  constructor() {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.08 });
    const ghostMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0, transparent: true, opacity: GHOST_ALPHA, depthWrite: false });
    for (const kind of INSTANCED_RUNGS) {
      const model = buildRung(kind) ?? (buildEnemy(kind).userData.inner as THREE.Group);
      model.scale.setScalar(1);
      const geo = bakeModel(model);
      const mesh = new THREE.InstancedMesh(geo, mat, CAPACITY);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0;
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      mesh.name = `rungs:${kind}`;
      mesh.setColorAt(0, WHITE);
      this.meshes.set(kind, mesh);
      this.group.add(mesh);
      const ghost = new THREE.InstancedMesh(geo, ghostMat, CAPACITY);
      ghost.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      ghost.count = 0;
      ghost.frustumCulled = false;
      ghost.renderOrder = 5;
      ghost.name = `ghosts:${kind}`;
      ghost.setColorAt(0, WHITE);
      this.ghosts.set(kind, ghost);
      this.group.add(ghost);
    }
    for (const prop of PROPERTY_ORDER) {
      const m = iconMesh(prop);
      this.icons.set(prop, m);
      this.group.add(m);
    }
  }

  has(kind: EnemyKind): boolean {
    return this.meshes.has(kind);
  }

  /** Starts a frame; `camera` turns the property icons to face it. */
  begin(camera?: THREE.Camera): void {
    for (const k of this.meshes.keys()) this.used.set(k, 0);
    for (const k of this.ghosts.keys()) this.ghostUsed.set(k, 0);
    for (const k of this.icons.keys()) this.iconUsed.set(k, 0);
    if (camera) {
      this.face.copy(camera.quaternion);
      this.right.set(1, 0, 0).applyQuaternion(this.face);
    }
  }

  /** A vehicle's row of property icons, centred over (x, top, z). Works for any enemy, instanced or not. */
  addIcons(pm: number, x: number, top: number, z: number): void {
    if (!pm) return;
    const props = PROPERTY_ORDER.filter((p) => pm & P[p]);
    const step = ICON * 1.1;
    let off = (-(props.length - 1) * step) / 2;
    for (const prop of props) {
      const mesh = this.icons.get(prop)!;
      const i = this.iconUsed.get(prop) ?? 0;
      if (i < ICON_CAPACITY) {
        this.p.set(x + this.right.x * off, top + this.right.y * off, z + this.right.z * off);
        this.s.setScalar(1);
        this.m.compose(this.p, this.face, this.s);
        mesh.setMatrixAt(i, this.m);
        this.iconUsed.set(prop, i + 1);
      }
      off += step;
    }
  }

  /** One vehicle this frame: where it stands on the ground, its heading, and a bob for its id. */
  add(kind: EnemyKind, x: number, ground: number, z: number, heading: number, bob: number, ghost = false, pm = 0): void {
    const mesh = (ghost ? this.ghosts : this.meshes).get(kind);
    if (!mesh) return;
    const used = ghost ? this.ghostUsed : this.used;
    const i = used.get(kind) ?? 0;
    if (i >= CAPACITY) return;
    const k = enemyScale(kind) * 1.3 * (ghost ? 0.92 : 1);
    this.p.set(x, ground + enemyLift(kind) + bob, z);
    this.q.setFromAxisAngle(this.up, heading);
    this.s.setScalar(k);
    this.m.compose(this.p, this.q, this.s);
    mesh.setMatrixAt(i, this.m);
    // Its materials: steel, wrap, mesh, frost and hazard bands tint the whole vehicle.
    this.tint.copy(WHITE);
    for (const [bit, c] of TINTS) if (pm & bit) this.tint.multiply(c);
    if (ghost) this.tint.multiply(CAMO);
    mesh.setColorAt(i, this.tint);
    used.set(kind, i + 1);
  }

  end(): void {
    for (const [k, mesh] of this.meshes) {
      mesh.count = this.used.get(k) ?? 0;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    for (const [k, mesh] of this.ghosts) {
      mesh.count = this.ghostUsed.get(k) ?? 0;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    for (const [k, mesh] of this.icons) {
      mesh.count = this.iconUsed.get(k) ?? 0;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /** How many draw calls the Fleet costs this frame (one per rung kind on the lane). */
  drawCalls(): number {
    let n = 0;
    for (const mesh of this.meshes.values()) if (mesh.count > 0) n++;
    for (const mesh of this.ghosts.values()) if (mesh.count > 0) n++;
    for (const mesh of this.icons.values()) if (mesh.count > 0) n++;
    return n;
  }
}
