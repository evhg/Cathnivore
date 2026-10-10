// Instanced Fleet rungs (Hedgerow 2 M2, docs/design/hedgerow-2.md section 8). Hundreds of vehicles can be on
// the lane at once, so the rungs are not a cloned Group each: every rung kind is one InstancedMesh, its model
// merged into a single vertex-coloured geometry. A pop swaps a vehicle to the next rung's mesh on the same
// frame (the engine changes its kind in place). About eight draw calls for the whole Fleet.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { EnemyKind } from "../engine";
import { buildEnemy, buildRung, enemyLift, enemyScale } from "./models";

/** The kinds drawn instanced on fleet levels (the boss keeps its own animated model). */
export const INSTANCED_RUNGS: readonly EnemyKind[] = ["courier", "hatchback", "van", "pickup", "sprinter", "lorry", "drone", "quad"];

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
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private p = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);

  constructor() {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.08 });
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
      this.meshes.set(kind, mesh);
      this.group.add(mesh);
    }
  }

  has(kind: EnemyKind): boolean {
    return this.meshes.has(kind);
  }

  begin(): void {
    for (const k of this.meshes.keys()) this.used.set(k, 0);
  }

  /** One vehicle this frame: where it stands on the ground, its heading, and a bob for its id. */
  add(kind: EnemyKind, x: number, ground: number, z: number, heading: number, bob: number, ghost = false): void {
    const mesh = this.meshes.get(kind);
    if (!mesh) return;
    const i = this.used.get(kind) ?? 0;
    if (i >= CAPACITY) return;
    const k = enemyScale(kind) * 1.3 * (ghost ? 0.92 : 1);
    this.p.set(x, ground + enemyLift(kind) + bob, z);
    this.q.setFromAxisAngle(this.up, heading);
    this.s.setScalar(k);
    this.m.compose(this.p, this.q, this.s);
    mesh.setMatrixAt(i, this.m);
    this.used.set(kind, i + 1);
  }

  end(): void {
    for (const [k, mesh] of this.meshes) {
      mesh.count = this.used.get(k) ?? 0;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  /** How many draw calls the Fleet costs this frame (one per rung kind on the lane). */
  drawCalls(): number {
    let n = 0;
    for (const mesh of this.meshes.values()) if (mesh.count > 0) n++;
    return n;
  }
}
