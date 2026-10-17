// The empty reload's spent magazine (S2.4): the viewmodel's mag, copied into the street at the moment it
// leaves the gun, falls and tumbles, bounces once or twice (restitution 0.2) and lies there for 10 s. At most six
// at once, the oldest going first. Every drop is one instance of a single InstancedMesh: one draw call for all
// six, not one each (C5 review: draw calls over the S0 budget).

import * as THREE from "three";
import { tuning } from "./feel/tuning";
import { collapse } from "./gunkit";

const R = tuning.kestrel.reload;

interface Drop {
  obj: THREE.Object3D;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  age: number;
  resting: boolean;
  bounces: number;
}

export class DroppedMags {
  private readonly drops: Drop[] = [];
  /** All the drops in one draw, built from the first mag dropped (its opaque kit pieces, no top round). */
  private mesh: THREE.InstancedMesh | null = null;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly ground: (x: number, z: number) => number,
    private readonly onLand: (pos: THREE.Vector3, strength: number) => void = () => undefined,
  ) {}

  /**
   * Drops a copy of `mag` (a viewmodel node) into the world. `toWorld` carries the view layer's camera space
   * into the street (the eye's position and rotation); `vel` is the world velocity it leaves the gun with.
   */
  drop(mag: THREE.Object3D, eye: THREE.Vector3, q: THREE.Quaternion, vel: THREE.Vector3): void {
    mag.updateWorldMatrix(true, false);
    const p = new THREE.Vector3();
    const mq = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    mag.matrixWorld.decompose(p, mq, sc);
    if (!this.mesh) {
      const src = mag.clone(true);
      src.visible = true;
      // An empty mag: its top round stays in the gun's story, not on the street.
      src.getObjectByName("magRound")?.removeFromParent();
      src.position.set(0, 0, 0);
      src.quaternion.identity();
      src.scale.set(1, 1, 1);
      const one = collapse(src);
      if (!one) return;
      this.mesh = new THREE.InstancedMesh(one.geometry, one.material, R.dropMagMax);
      this.mesh.name = "droppedMags";
      this.mesh.count = 0;
      this.mesh.castShadow = false;
      // The instances spread over the street: no single bounding sphere fits, so don't cull.
      this.mesh.frustumCulled = false;
      this.scene.add(this.mesh);
    }
    const obj = new THREE.Object3D();
    obj.position.copy(p.applyQuaternion(q).add(eye));
    obj.quaternion.copy(q).multiply(mq);
    if (this.drops.length >= R.dropMagMax) this.remove(0);
    this.drops.push({ obj, vel: vel.clone(), spin: new THREE.Vector3((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 9), age: 0, resting: false, bounces: 0 });
    this.sync();
  }

  /** Writes every drop's transform into the instanced mesh. */
  private sync(): void {
    const m = this.mesh;
    if (!m) return;
    this.drops.forEach((d, i) => {
      d.obj.updateMatrix();
      m.setMatrixAt(i, d.obj.matrix);
    });
    m.count = this.drops.length;
    m.visible = m.count > 0;
    m.instanceMatrix.needsUpdate = true;
  }

  private remove(i: number): void {
    const d = this.drops[i];
    if (!d) return;
    this.drops.splice(i, 1);
    this.sync();
  }

  get count(): number {
    return this.drops.length;
  }

  update(dt: number): void {
    const e = new THREE.Euler();
    const dq = new THREE.Quaternion();
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i]!;
      d.age += dt;
      if (d.age > R.dropMagLifeS) {
        this.remove(i);
        continue;
      }
      if (d.resting) continue;
      d.vel.y -= 9.8 * dt;
      d.obj.position.addScaledVector(d.vel, dt);
      e.set(d.spin.x * dt, d.spin.y * dt, d.spin.z * dt);
      d.obj.quaternion.multiply(dq.setFromEuler(e));
      const gy = this.ground(d.obj.position.x, d.obj.position.z) + 0.012;
      if (d.obj.position.y < gy) {
        d.obj.position.y = gy;
        const hit = Math.abs(d.vel.y);
        if (hit > 0.8 && d.bounces < 2) {
          d.bounces++;
          d.vel.set(d.vel.x * 0.4, hit * R.dropMagRestitution, d.vel.z * 0.4);
          d.spin.multiplyScalar(0.45);
          this.onLand(d.obj.position, Math.min(1, hit / 4));
        } else {
          // It settles flat on its side.
          d.resting = true;
          const yaw = new THREE.Euler().setFromQuaternion(d.obj.quaternion, "YXZ").y;
          d.obj.quaternion.setFromEuler(new THREE.Euler(0, yaw, Math.PI / 2, "YXZ"));
          if (hit > 0.3) this.onLand(d.obj.position, Math.min(1, hit / 6));
        }
      }
    }
    this.sync();
  }

  clear(): void {
    while (this.drops.length) this.remove(0);
  }
}
