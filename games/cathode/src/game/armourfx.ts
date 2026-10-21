// C15 "Armour that breaks" (docs/design/cathode-combat.md S4.3), the drawn half of sim/armour.ts: a broken plate
// leaves the body as a loose rigid piece (the same pieces the body was drawing, unskinned, cracks and all) thrown off
// along the round, tumbling, clattering two or three times and going to sleep where it lands; the body's own copy
// collapses in the shader and the padded carrier under it shows, its torn strap tabs flapping.

import * as THREE from "three";
import { DroppedProp } from "./death";
import { place } from "./body";
import type { Body } from "./body";
import { plateGeometry, type Arch } from "./models/enforcer";
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
