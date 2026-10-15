// Damped springs for feel (S0): semi-implicit Euler at fixed 1/240 s substeps, so they're stable at any frame
// rate. Built from a frequency and damping ratio: k = (2πf)², c = 2ζ·2πf.

const STEP = 1 / 240;

export interface SpringSpec {
  freqHz: number;
  zeta: number;
}

export class Spring1 {
  x = 0;
  v = 0;
  target = 0;
  private k: number;
  private c: number;
  private acc = 0;

  constructor(spec: SpringSpec, x = 0) {
    const w = 2 * Math.PI * spec.freqHz;
    this.k = w * w;
    this.c = 2 * spec.zeta * w;
    this.x = x;
    this.target = x;
  }

  /** An instant velocity kick. */
  shove(v: number): void {
    this.v += v;
  }

  update(dt: number): number {
    this.acc += Math.min(dt, 0.25);
    while (this.acc >= STEP) {
      this.acc -= STEP;
      const a = -this.k * (this.x - this.target) - this.c * this.v;
      this.v += a * STEP;
      this.x += this.v * STEP;
    }
    return this.x;
  }

  get settled(): boolean {
    return Math.abs(this.x - this.target) < 1e-4 && Math.abs(this.v) < 1e-3;
  }
}

/** Three independent springs sharing one spec (positions, rotations). */
export class Spring3 {
  readonly x: Spring1;
  readonly y: Spring1;
  readonly z: Spring1;

  constructor(spec: SpringSpec) {
    this.x = new Spring1(spec);
    this.y = new Spring1(spec);
    this.z = new Spring1(spec);
  }

  shove(x: number, y: number, z: number): void {
    this.x.shove(x);
    this.y.shove(y);
    this.z.shove(z);
  }

  setTarget(x: number, y: number, z: number): void {
    this.x.target = x;
    this.y.target = y;
    this.z.target = z;
  }

  update(dt: number): [number, number, number] {
    return [this.x.update(dt), this.y.update(dt), this.z.update(dt)];
  }
}
