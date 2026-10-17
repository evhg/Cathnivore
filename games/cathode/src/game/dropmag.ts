// The empty reload's spent magazine (S2.4): the viewmodel's mag, copied into the street at the moment it
// leaves the gun, falls and tumbles, bounces once or twice (restitution 0.2) and lies there for 10 s. At most six
// at once, the oldest going first.

import * as THREE from "three";
import { tuning } from "./feel/tuning";

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
    const obj = mag.clone(true);
    obj.visible = true;
    // An empty mag: its top round stays in the gun's story, not on the street.
    obj.getObjectByName("magRound")?.removeFromParent();
    obj.position.copy(p.applyQuaternion(q).add(eye));
    obj.quaternion.copy(q).multiply(mq);
    obj.traverse((o) => {
      o.frustumCulled = true;
      (o as THREE.Mesh).castShadow = false;
    });
    this.scene.add(obj);
    if (this.drops.length >= R.dropMagMax) this.remove(0);
    this.drops.push({ obj, vel: vel.clone(), spin: new THREE.Vector3((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 9), age: 0, resting: false, bounces: 0 });
  }

  private remove(i: number): void {
    const d = this.drops[i];
    if (!d) return;
    d.obj.removeFromParent();
    this.drops.splice(i, 1);
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
  }

  clear(): void {
    while (this.drops.length) this.remove(0);
  }
}
