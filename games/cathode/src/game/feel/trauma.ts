// One camera-shake accumulator (S0). Shake = trauma² × max, driven by 20 Hz value noise, decaying linearly.
// Reduced motion caps trauma and turns roll off; phones get a little more in place of rumble.

import { tuning } from "./tuning";

const T = tuning.trauma;

/** Smooth 1D value noise in [-1, 1]. */
function noise1(x: number, seed: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const h = (n: number) => {
    const s = Math.sin((n + seed * 57.13) * 127.1) * 43758.5453;
    return (s - Math.floor(s)) * 2 - 1;
  };
  const u = f * f * (3 - 2 * f);
  return h(i) * (1 - u) + h(i + 1) * u;
}

export interface Shake {
  pitch: number;
  yaw: number;
  roll: number;
  x: number;
  y: number;
}

export class Trauma {
  value = 0;
  private t = 0;
  reducedMotion = false;
  phone = false;

  add(x: number): void {
    const cap = this.reducedMotion ? T.reducedMotionCap : 1;
    this.value = Math.min(cap, this.value + x * (this.phone ? T.phoneMul : 1));
  }

  update(dt: number): void {
    this.t += dt;
    this.value = Math.max(0, this.value - T.decayPerS * dt);
  }

  /** The current offset: rotations in radians, translations in metres. */
  sample(): Shake {
    const k = this.value * this.value;
    if (k <= 0) return { pitch: 0, yaw: 0, roll: 0, x: 0, y: 0 };
    const rot = (T.maxRotDeg * Math.PI) / 180;
    const n = this.t * T.noiseHz;
    return {
      pitch: k * rot * noise1(n, 1),
      yaw: k * rot * noise1(n, 2),
      roll: this.reducedMotion ? 0 : k * rot * noise1(n, 3),
      x: k * T.maxOffsetM * noise1(n, 4),
      y: k * T.maxOffsetM * noise1(n, 5),
    };
  }
}
