// C15 "Armour that breaks" (docs/design/cathode-combat.md S4.3), the drawn half of sim/armour.ts: a broken plate
// leaves the body as a loose rigid piece (the same pieces the body was drawing, unskinned, cracks and all) thrown off
// along the round, tumbling, clattering two or three times and going to sleep where it lands; the body's own copy
// collapses in the shader and the padded carrier under it shows, its torn strap tabs flapping.

import * as THREE from "three";
import { DroppedProp } from "./death";
import { place } from "./body";
import type { Body } from "./body";
import { plateGeometry, type Arch } from "./models/enforcer";
import { SHIELD_PIECES, buildShieldPiece } from "./models/gear";
import { enemyMaterials } from "./models/materials";
import { FX0 } from "./rig";

/** S4.3's throw: 3 m/s along the shot, 1.5 m/s up, 8 to 15 rad/s of spin. */
export const DEBRIS = { along: 3, up: 1.5, spinMin: 8, spinMax: 15, cap: 12, lift: 0.02 } as const;

/** Which bone each plate's loose piece is framed on (its biggest part). */
const FRAME_BONE: Record<number, string> = { 1: "chest", 2: "chest", 3: "upperChest", 4: "upperChest", 5: "helmet" };

const live: PlateDebris[] = [];

export class PlateDebris {
  readonly group = new THREE.Group();
  private readonly prop: DroppedProp;
  private readonly axis = new THREE.Vector3();
  private readonly face = new THREE.Vector3();
  private roll = 0;
  private rollV: number;
  /** The list that steps this piece (its enemy's), so disposing it by the cap stops the stepping too. */
  owner: PlateDebris[] | null = null;
  constructor(body: Body, arch: Arch, slot: number, dir: THREE.Vector3, phone: boolean, onClatter: (speed: number, at: THREE.Vector3) => void) {
    const parts = plateGeometry(arch, slot, phone);
    const mats = enemyMaterials(phone, FX0);
    const frameName = FRAME_BONE[slot] ?? "chest";
    const frame = body.root.getObjectByName(frameName) ?? body.root;
    body.root.updateMatrixWorld(true);
    // The piece's frame: its centre on the frame bone, the bone's sideways axis as the two-point body's length.
    const fw = frame.matrixWorld;
    const centre = new THREE.Vector3(0, slot <= 2 ? 0.14 : 0, slot === 1 ? 0.13 : slot === 2 ? -0.13 : 0).applyMatrix4(fw);
    const side = new THREE.Vector3().setFromMatrixColumn(fw, 0).normalize();
    this.face.setFromMatrixColumn(fw, 2).normalize();
    if (slot === 2) this.face.negate();
    const a = centre.clone().addScaledVector(side, -0.14);
    const b = centre.clone().addScaledVector(side, 0.14);
    place(this.group, a, b, this.face);
    this.group.updateMatrixWorld(true);
    const inv = this.group.matrixWorld.clone().invert();
    for (const [bone, g] of parts) {
      const bo = body.root.getObjectByName(bone);
      if (!bo) continue;
      const m = new THREE.Matrix4().multiplyMatrices(inv, bo.matrixWorld);
      for (const [geo, mat] of [
        [g.opaque, mats.opaque],
        [g.glow, mats.glow],
      ] as const) {
        if (!geo) continue;
        const mesh = new THREE.Mesh(geo, mat);
        mesh.matrixAutoUpdate = false;
        mesh.matrix.copy(m);
        mesh.castShadow = mat === mats.opaque;
        mesh.name = `plate:${slot}:${bone}`;
        this.group.add(mesh);
      }
    }
    const flat = dir.clone().setY(0);
    if (flat.lengthSq() < 1e-6) flat.copy(this.face).negate();
    flat.normalize();
    // A plate can't fly on through the man it was strapped to: a throw that heads into him (the round's way, for a
    // plate struck square on) glances off his chest instead, out and to the side, and drops in front of him, where
    // she sees it land (C15 review: thrown through him, it hung in the air beside her muzzle).
    const into = flat.dot(this.face);
    if (into < 0) flat.addScaledVector(this.face, -2 * into).multiplyScalar(0.55).addScaledVector(side, (slot % 2 ? 1 : -1) * 0.45).normalize();
    const seed = (slot * 7 + Math.floor(centre.x * 100)) % 5;
    const spin = DEBRIS.spinMin + ((DEBRIS.spinMax - DEBRIS.spinMin) * seed) / 4;
    const vel = flat.multiplyScalar(DEBRIS.along).add(new THREE.Vector3(0, DEBRIS.up, 0));
    // Half the spin tumbles it end over end (the two-point body), half rolls it about its length (the face).
    this.prop = new DroppedProp(a, b, vel, (seed % 2 ? 1 : -1) * spin * 0.5, (speed, at) => {
      this.rollV *= 0.45;
      onClatter(speed, at);
    });
    this.prop.lift = DEBRIS.lift;
    this.rollV = (seed % 2 ? -1 : 1) * spin * 0.5;
    body.root.parent?.add(this.group);
    live.push(this);
    while (live.length > DEBRIS.cap) live.shift()!.dispose();
  }

  get asleep(): boolean {
    return this.prop.asleep;
  }
  get clatters(): number {
    return this.prop.clatters;
  }
  get position(): THREE.Vector3 {
    return this.prop.a.clone().lerp(this.prop.b, 0.5);
  }

  step(dt: number, ground: (x: number, z: number) => number, colliders: readonly THREE.Box3[]): void {
    if (this.prop.asleep || dt <= 0) return;
    this.prop.step(dt, ground, colliders);
    this.roll += this.rollV * dt;
    // On the street the roll dies away until the plate lies on a face.
    const mid = this.prop.a.y + this.prop.b.y;
    if (mid * 0.5 - ground(this.prop.a.x, this.prop.a.z) < 0.05) {
      this.rollV *= Math.exp(-dt * 9);
      const flat = Math.round(this.roll / Math.PI) * Math.PI;
      this.roll += (flat - this.roll) * Math.min(1, dt * 10);
    }
    this.axis.subVectors(this.prop.b, this.prop.a).normalize();
    const f = this.face.clone().projectOnPlane(this.axis);
    if (f.lengthSq() < 1e-6) f.set(0, 1, 0).projectOnPlane(this.axis);
    f.normalize().applyAxisAngle(this.axis, this.roll);
    place(this.group, this.prop.a, this.prop.b, f);
  }

  dispose(): void {
    this.group.removeFromParent();
    const i = live.indexOf(this);
    if (i >= 0) live.splice(i, 1);
    const j = this.owner ? this.owner.indexOf(this) : -1;
    if (j >= 0) this.owner!.splice(j, 1);
    this.owner = null;
  }
}

/** Every loose plate in the street (tests, the budget sidecar, screenshot stages). */
export function liveDebris(): readonly PlateDebris[] {
  return live;
}

/** Clears the street of loose plates (screenshot stages start clean). */
export function clearDebris(): void {
  while (live.length) live[0]!.dispose();
}

/**
 * C15: a piece of a broken riot shield, thrown off along the round (spread, up, tumbling) as a two-point rigid body,
 * clattering and lying flat where it lands. `shield` is the intact shield (its pose is where the pieces start).
 */
export class ShieldShard {
  readonly group: THREE.Group;
  private readonly prop: DroppedProp;
  private readonly face = new THREE.Vector3();
  private readonly axis = new THREE.Vector3();
  private roll = 0;
  private rollV: number;
  constructor(shield: THREE.Object3D, i: number, dir: THREE.Vector3, phone: boolean, onClatter: (speed: number, at: THREE.Vector3) => void) {
    shield.updateMatrixWorld(true);
    const m = shield.matrixWorld;
    // The piece's two points: across its middle, in the shield's frame.
    const P = SHIELD_PIECES[i]!.outline;
    const cx = P.reduce((a, p) => a + p[0], 0) / P.length;
    const cy = P.reduce((a, p) => a + p[1], 0) / P.length;
    const long = i === 0 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const half = i === 0 ? 0.25 : 0.24;
    const c = new THREE.Vector3(cx, cy, 0);
    const a = c.clone().addScaledVector(long, -half).applyMatrix4(m);
    const b = c.clone().addScaledVector(long, half).applyMatrix4(m);
    this.face.set(0, 0, 1).transformDirection(m);
    this.group = new THREE.Group();
    const piece = buildShieldPiece(i, phone);
    // The piece's mesh sits in the shield frame: offset it so the two-point frame's origin (a) carries it.
    const frame = new THREE.Group();
    this.group.add(frame);
    frame.add(piece);
    this.offset = { c, long, half };
    this.inner = frame;
    const flat = dir.clone().setY(0).normalize();
    const side = new THREE.Vector3(-flat.z, 0, flat.x);
    const spread = i === 0 ? 0 : i === 1 ? -1 : 1;
    const vel = flat.multiplyScalar(2.2).addScaledVector(side, spread * 1.3).add(new THREE.Vector3(0, i === 0 ? 2.4 : 1.2, 0));
    const spin = (i % 2 ? 1 : -1) * (7 + i * 2);
    this.prop = new DroppedProp(a, b, vel, spin * 0.5, (speed, at) => {
      this.rollV *= 0.45;
      onClatter(speed, at);
    });
    this.prop.lift = 0.012;
    this.rollV = -spin * 0.5;
    shield.parent?.add(this.group);
    shards.push(this);
    while (shards.length > 9) shards.shift()!.dispose();
    this.pose();
  }
  private readonly offset: { c: THREE.Vector3; long: THREE.Vector3; half: number };
  private readonly inner: THREE.Group;

  get asleep(): boolean {
    return this.prop.asleep;
  }

  private pose(): void {
    this.axis.subVectors(this.prop.b, this.prop.a).normalize();
    const f = this.face.clone().projectOnPlane(this.axis);
    if (f.lengthSq() < 1e-6) f.set(0, 1, 0).projectOnPlane(this.axis);
    f.normalize().applyAxisAngle(this.axis, this.roll);
    // place() lays local +Y along a->b and +Z on f; the piece was built with its long axis on x (top) or y (lower).
    place(this.group, this.prop.a, this.prop.b, f);
    const o = this.offset;
    if (o.long.x > 0.5) this.inner.rotation.set(0, 0, Math.PI / 2);
    else this.inner.rotation.set(0, 0, 0);
    // The piece's own point a (its centre less half its length along its long axis) onto the frame's origin.
    const pa = o.c.clone().addScaledVector(o.long, -o.half).applyEuler(this.inner.rotation);
    this.inner.position.copy(pa).negate();
  }

  step(dt: number, ground: (x: number, z: number) => number, colliders: readonly THREE.Box3[]): void {
    if (this.prop.asleep || dt <= 0) return;
    this.prop.step(dt, ground, colliders);
    this.roll += this.rollV * dt;
    const mid = (this.prop.a.y + this.prop.b.y) * 0.5;
    if (mid - ground(this.prop.a.x, this.prop.a.z) < 0.05) {
      this.rollV *= Math.exp(-dt * 9);
      const flat = Math.round(this.roll / Math.PI) * Math.PI;
      this.roll += (flat - this.roll) * Math.min(1, dt * 10);
    }
    this.pose();
  }

  dispose(): void {
    this.group.removeFromParent();
    const i = shards.indexOf(this);
    if (i >= 0) shards.splice(i, 1);
  }
}

const shards: ShieldShard[] = [];

/** The shield pieces in the street (stepped by the session; cleared by the stages). */
export function liveShards(): readonly ShieldShard[] {
  return shards;
}

export function clearShards(): void {
  while (shards.length) shards[0]!.dispose();
}
