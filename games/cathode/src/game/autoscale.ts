// Dynamic resolution: watches frame times and nudges the render scale so the game holds ~60 fps
// (and runs cooler on phones). Steps down fast when frames run long, creeps back up when there is headroom.

export interface AutoScaleOptions {
  min: number;
  max: number;
  /** Frame budget in ms; slower than this on average is "too slow". */
  target: number;
}

export class AutoScale {
  scale: number;
  private acc = 0;
  private frames = 0;
  private calm = 0;
  constructor(private o: AutoScaleOptions) {
    this.scale = o.max;
  }

  /** Feed one frame's duration in ms. Returns the new scale when it changed, else null. */
  frame(ms: number): number | null {
    // Ignore stalls (tab switches, loading): they say nothing about steady cost.
    if (ms > 250) return null;
    this.acc += ms;
    this.frames++;
    if (this.frames < 30) return null;
    const avg = this.acc / this.frames;
    this.acc = 0;
    this.frames = 0;
    if (avg > this.o.target * 1.2 && this.scale > this.o.min) {
      this.calm = 0;
      this.scale = Math.max(this.o.min, +(this.scale - 0.1).toFixed(2));
      return this.scale;
    }
    if (avg < this.o.target * 0.8) {
      // Up only after several calm windows in a row, so it doesn't oscillate.
      if (++this.calm >= 6 && this.scale < this.o.max) {
        this.calm = 0;
        this.scale = Math.min(this.o.max, +(this.scale + 0.05).toFixed(2));
        return this.scale;
      }
    } else this.calm = 0;
    return null;
  }
}
