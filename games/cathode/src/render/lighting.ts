// Light in the Drowned Market comes in three layers:
//  1. A baked light volume: every authored light (signs, lamps, bulbs, shopfronts) summed into a 3D
//     texture at load. Surfaces read it as indirect light and the fog reads it as in-scatter, so the
//     whole street glows for the price of two texture taps.
//  2. A small pool of real point lights (phone 12, high 32, ultra 44) that stream to the authored lights
//     nearest the camera, fading in and out, so wet surfaces and the game's characters get real
//     specular highlights. They flicker in sync with their signs.
//  3. One shadow-casting key light (a security floodlight raking up the street).
// lightAt() reads the same data on the CPU for stealth.

import * as THREE from "three";
import type { VLight } from "./level";

export interface Volume {
  texture: THREE.Data3DTexture;
  min: THREE.Vector3;
  size: THREE.Vector3;
  dims: [number, number, number];
  /** Linear RGB per cell, CPU copy for lightAt and particle tints. */
  data: Float32Array;
  sample(p: THREE.Vector3, out: THREE.Color): THREE.Color;
}

export function bakeVolume(lights: VLight[], min: THREE.Vector3, max: THREE.Vector3, cell: [number, number, number]): Volume {
  const size = new THREE.Vector3().subVectors(max, min);
  const nx = Math.ceil(size.x / cell[0]);
  const ny = Math.ceil(size.y / cell[1]);
  const nz = Math.ceil(size.z / cell[2]);
  const data = new Float32Array(nx * ny * nz * 3);
  const p = new THREE.Vector3();
  const d = new THREE.Vector3();
  for (const l of lights) {
    const rr = l.range;
    const i0 = Math.max(0, Math.floor((l.pos.x - rr - min.x) / cell[0]));
    const i1 = Math.min(nx - 1, Math.ceil((l.pos.x + rr - min.x) / cell[0]));
    const j0 = Math.max(0, Math.floor((l.pos.y - rr - min.y) / cell[1]));
    const j1 = Math.min(ny - 1, Math.ceil((l.pos.y + rr - min.y) / cell[1]));
    const k0 = Math.max(0, Math.floor((l.pos.z - rr - min.z) / cell[2]));
    const k1 = Math.min(nz - 1, Math.ceil((l.pos.z + rr - min.z) / cell[2]));
    const cr = l.color.r * l.intensity;
    const cg = l.color.g * l.intensity;
    const cb = l.color.b * l.intensity;
    for (let k = k0; k <= k1; k++)
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          p.set(min.x + (i + 0.5) * cell[0], min.y + (j + 0.5) * cell[1], min.z + (k + 0.5) * cell[2]);
          d.subVectors(p, l.pos);
          const dist = d.length();
          if (dist > rr) continue;
          let w = 1 / (1 + dist * dist * 0.9);
          const edge = 1 - dist / rr;
          w *= edge * edge;
          if (l.normal) {
            const facing = d.dot(l.normal) / Math.max(dist, 0.001);
            w *= THREE.MathUtils.clamp(facing * 0.85 + 0.15, 0, 1);
          }
          const o = ((k * ny + j) * nx + i) * 3;
          data[o] = data[o]! + cr * w;
          data[o + 1] = data[o + 1]! + cg * w;
          data[o + 2] = data[o + 2]! + cb * w;
        }
  }
  // Half-float RGBA for the GPU (linear filtering of half floats is core in WebGL2).
  const half = new Uint16Array(nx * ny * nz * 4);
  for (let n = 0; n < nx * ny * nz; n++) {
    half[n * 4] = THREE.DataUtils.toHalfFloat(Math.min(data[n * 3]!, 60000));
    half[n * 4 + 1] = THREE.DataUtils.toHalfFloat(Math.min(data[n * 3 + 1]!, 60000));
    half[n * 4 + 2] = THREE.DataUtils.toHalfFloat(Math.min(data[n * 3 + 2]!, 60000));
    half[n * 4 + 3] = THREE.DataUtils.toHalfFloat(1);
  }
  const texture = new THREE.Data3DTexture(half, nx, ny, nz);
  texture.format = THREE.RGBAFormat;
  texture.type = THREE.HalfFloatType;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = texture.wrapT = texture.wrapR = THREE.ClampToEdgeWrapping;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;

  const at = (i: number, j: number, k: number, c: number) => {
    i = THREE.MathUtils.clamp(i, 0, nx - 1);
    j = THREE.MathUtils.clamp(j, 0, ny - 1);
    k = THREE.MathUtils.clamp(k, 0, nz - 1);
    return data[((k * ny + j) * nx + i) * 3 + c]!;
  };
  return {
    texture,
    min: min.clone(),
    size,
    dims: [nx, ny, nz],
    data,
    sample(q, out) {
      const fx = (q.x - min.x) / cell[0] - 0.5;
      const fy = (q.y - min.y) / cell[1] - 0.5;
      const fz = (q.z - min.z) / cell[2] - 0.5;
      const i = Math.floor(fx);
      const j = Math.floor(fy);
      const k = Math.floor(fz);
      const tx = fx - i;
      const ty = fy - j;
      const tz = fz - k;
      const ch = [0, 0, 0];
      for (let c = 0; c < 3; c++) {
        const a = THREE.MathUtils.lerp(at(i, j, k, c), at(i + 1, j, k, c), tx);
        const b = THREE.MathUtils.lerp(at(i, j + 1, k, c), at(i + 1, j + 1, k, c), tx);
        const e = THREE.MathUtils.lerp(at(i, j, k + 1, c), at(i + 1, j, k + 1, c), tx);
        const f = THREE.MathUtils.lerp(at(i, j + 1, k + 1, c), at(i + 1, j + 1, k + 1, c), tx);
        ch[c] = THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, ty), THREE.MathUtils.lerp(e, f, ty), tz);
      }
      return out.setRGB(ch[0]!, ch[1]!, ch[2]!);
    },
  };
}

/** The flicker curve every sign and its light share (also mirrored in the sign shader). */
export function flicker(mode: number, seed: number, t: number): number {
  if (mode === 0) return 1;
  if (mode === 1) return 0.94 + 0.06 * Math.sin(t * 113 + seed * 7.1) * Math.sin(t * 3.1 + seed);
  if (mode === 3) return Math.sin(t * 5.2 + seed) > 0 ? 1 : 0.03;
  // Failing fluorescent: mostly on, with bursts of stutter.
  const slot = Math.floor(t * 9 + seed * 3.7);
  const h = hash1(slot * 0.137 + seed * 1.71);
  const burst = Math.sin(t * 0.7 + seed * 2.3) > 0.55;
  if (burst && h > 0.45) return 0.08;
  return h > 0.97 ? 0.15 : 1;
}

/**
 * A district's signature lighting moment as a multiplier on every pooled light.
 * brownout: every ~24 s the clinic's power stutters out for a second and comes back.
 * alarm: the vault's red alarm swells and fades every 6 s (a breathing 0.75..1.25).
 * surge: the tower's grid surges every ~30 s, a short bright swell.
 */
export function signatureGain(kind: string | undefined, t: number): number {
  switch (kind) {
    case "brownout": {
      const p = t % 24;
      if (p < 18 || p > 19.4) return 1;
      return hash1(Math.floor(t * 14)) > 0.45 ? 0.12 : 0.7;
    }
    case "alarm":
      return 1 + 0.25 * Math.sin((t / 6) * Math.PI * 2);
    case "surge": {
      const p = t % 30;
      return p > 22 && p < 23.2 ? 1 + 0.6 * Math.sin(((p - 22) / 1.2) * Math.PI) : 1;
    }
    default:
      return 1;
  }
}

export function hash1(x: number): number {
  const s = Math.sin(x * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Streams a fixed pool of PointLights to the authored lights nearest the camera. */
export class LightPool {
  readonly lights: THREE.PointLight[] = [];
  private assigned: Array<VLight | null>;
  private level: number[];
  private timer = 0;
  private readonly cand: VLight[];
  private readonly tmp = new THREE.Vector3();
  private readonly fwd = new THREE.Vector3();

  constructor(
    scene: THREE.Scene,
    all: VLight[],
    count: number,
    private readonly gain: number,
    /** Signature lighting kind (DistrictTheme.signature); scales every light over time. */
    public signature?: string,
  ) {
    this.cand = all.filter((l) => l.real);
    for (let i = 0; i < count; i++) {
      const p = new THREE.PointLight(0xffffff, 0, 10, 2);
      p.castShadow = false;
      scene.add(p);
      this.lights.push(p);
    }
    this.assigned = new Array(count).fill(null);
    this.level = new Array(count).fill(0);
  }

  /** A light the game places (a lamp over a guard, a glowing case): it competes for a pooled real light. */
  add(l: VLight): () => void {
    this.cand.push(l);
    this.timer = 0;
    return () => {
      const i = this.cand.indexOf(l);
      if (i >= 0) this.cand.splice(i, 1);
      this.timer = 0;
    };
  }

  update(camera: THREE.Camera, dt: number, time: number, instant: boolean): void {
    this.timer -= dt;
    if (this.timer <= 0 || instant) {
      this.timer = 0.25;
      this.reassign(camera);
    }
    const k = instant ? 1 : 1 - Math.exp(-dt * 5);
    for (let i = 0; i < this.lights.length; i++) {
      const l = this.lights[i]!;
      const a = this.assigned[i];
      const target = a ? 1 : 0;
      this.level[i] = this.level[i]! + (target - this.level[i]!) * k;
      if (!a) {
        l.intensity *= 1 - k;
        continue;
      }
      l.position.copy(a.pos);
      l.color.copy(a.color);
      l.distance = a.range * 1.15;
      // Intensity in candela-ish units with physically correct decay: scale up with range.
      l.intensity = a.intensity * this.gain * signatureGain(this.signature, time) * this.level[i]! * flicker(a.flicker, a.seed, time);
    }
  }

  private reassign(camera: THREE.Camera): void {
    const cam = camera.getWorldPosition(this.tmp);
    camera.getWorldDirection(this.fwd);
    const scored = this.cand
      .map((l) => {
        const dx = l.pos.x - cam.x;
        const dy = l.pos.y - cam.y;
        const dz = l.pos.z - cam.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const ahead = (dx * this.fwd.x + dy * this.fwd.y + dz * this.fwd.z) / Math.max(d, 0.001);
        // Prefer near and in front; a light's reach widens its claim.
        const score = (l.intensity * (1 + l.range * 0.15)) / (1 + d * d * 0.02) * (ahead > -0.2 ? 1 : 0.35);
        return { l, score, d };
      })
      .filter((e) => e.d < 70)
      .sort((a, b) => b.score - a.score)
      .slice(0, this.lights.length)
      .map((e) => e.l);
    const keep = new Set(scored);
    // Keep lights that are still wanted in their slots (no pops); fill free slots with the rest.
    for (let i = 0; i < this.assigned.length; i++) if (this.assigned[i] && !keep.has(this.assigned[i]!)) this.assigned[i] = null;
    const placed = new Set(this.assigned.filter(Boolean));
    for (const l of scored) {
      if (placed.has(l)) continue;
      const free = this.assigned.findIndex((a, i) => a === null && this.level[i]! < 0.05);
      const slot = free >= 0 ? free : this.assigned.findIndex((a) => a === null);
      if (slot < 0) break;
      this.assigned[slot] = l;
      this.level[slot] = 0;
    }
  }
}
