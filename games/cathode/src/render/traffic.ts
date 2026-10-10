// Air traffic: a handful of spinner cars cruising over the rooftops, each a dark wedge with a red tail light
// and a white nose light. Cheap CPU-driven meshes (no shadows, no lights), outdoor districts only.

import * as THREE from "three";
import { LAYER_NO_REFLECT } from "./reflection";

export interface Spinner {
  x0: number;
  z: number;
  y: number;
  speed: number;
  phase: number;
}

/** Deterministic lanes: alternate directions, spread across height and depth. */
export function spinnerLanes(count: number, span: number, zNear: number, zFar: number): Spinner[] {
  const out: Spinner[] = [];
  for (let i = 0; i < count; i++) {
    const f = (i + 0.5) / count;
    const dir = i % 2 === 0 ? 1 : -1;
    out.push({ x0: 0, z: zNear + (zFar - zNear) * ((i * 0.618) % 1), y: 38 + ((i * 7) % 5) * 7, speed: dir * (9 + (i % 3) * 3), phase: f * span });
  }
  return out;
}

/** Wrapped x position of a spinner at time t on a track of the given span. */
export function spinnerX(s: Spinner, t: number, span: number): number {
  const u = (((s.phase + s.speed * t) % span) + span) % span;
  return u - span / 2;
}

export function addTraffic(scene: THREE.Scene, count: number, span = 220, zNear = -90, zFar = 60) {
  const lanes = spinnerLanes(count, span, zNear, zFar);
  const body = new THREE.MeshBasicMaterial({ color: 0x07090c });
  const red = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
  const white = new THREE.MeshBasicMaterial({ color: 0xdff4ff });
  const group = new THREE.Group();
  const cars = lanes.map((s) => {
    const car = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(5, 0.9, 1.9), body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 1.5), red);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.6), white);
    const dir = Math.sign(s.speed);
    tail.position.x = -2.6 * dir;
    nose.position.x = 2.6 * dir;
    car.add(hull, tail, nose);
    car.traverse((o) => o.layers.set(LAYER_NO_REFLECT));
    group.add(car);
    return car;
  });
  scene.add(group);
  return {
    update(t: number) {
      cars.forEach((car, i) => car.position.set(spinnerX(lanes[i]!, t, span), lanes[i]!.y, lanes[i]!.z));
    },
  };
}
