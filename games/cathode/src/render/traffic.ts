// Air traffic: a handful of spinner cars cruising over the rooftops, each a dark wedge with a red tail light
// and a white nose light. Cheap CPU-driven meshes (no shadows, no lights), outdoor districts only.

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
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
  // One car (hull, red tail, white nose) as a single vertex-coloured geometry, drawn for every lane as instances:
  // one draw call for the whole sky instead of three per car (S0 budget).
  const part = (geo: THREE.BufferGeometry, x: number, hex: number) => {
    const g = geo.translate(x, 0, 0).toNonIndexed();
    const c = new THREE.Color(hex);
    const n = g.getAttribute("position").count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  };
  // Built heading +x; a car heading -x is the same car turned half round (the boxes are symmetric in z).
  const geo = mergeGeometries([part(new THREE.BoxGeometry(5, 0.9, 1.9), 0, 0x07090c), part(new THREE.BoxGeometry(0.3, 0.35, 1.5), -2.6, 0xff2a1a), part(new THREE.BoxGeometry(0.3, 0.3, 0.6), 2.6, 0xdff4ff)], false)!;
  const cars = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true }), lanes.length);
  // The cars cross the whole skyline: the instances' bounds change every frame.
  cars.frustumCulled = false;
  cars.layers.set(LAYER_NO_REFLECT);
  scene.add(cars);
  const m = new THREE.Matrix4();
  const turn = new THREE.Matrix4();
  const api = {
    update(t: number) {
      lanes.forEach((s, i) => {
        m.makeRotationY(s.speed < 0 ? Math.PI : 0).premultiply(turn.makeTranslation(spinnerX(s, t, span), s.y, s.z));
        cars.setMatrixAt(i, m);
      });
      cars.instanceMatrix.needsUpdate = true;
    },
  };
  api.update(0);
  return api;
}
