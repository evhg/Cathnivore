// Dynamic resolution: watches frame times and nudges the render scale so the game holds ~60 fps
// (and runs cooler on phones). Steps down fast when frames run long, creeps back up when there is headroom.

export interface AutoScaleOptions {
  min: number;
  max: number;
  /** Frame budget in ms (a 60 fps game: 16.7). Slow and fast thresholds default to 0.93x and 0.66x of it (S-budgets: 15.5 and 11). */
  target: number;
  /** Average frame time over 30 frames above which the scale steps down (x0.9). Default 0.93 x target. */
  slowMs?: number;
  /** Average frame time over 120 frames below which the scale steps up (x1.05). Default 0.66 x target. */
  fastMs?: number;
  /** Lowest scale allowed once frames stay slow even at `min` (a hot or weak phone). Defaults to `min`. */
  rescueMin?: number;
}

export class AutoScale {
  scale: number;
  private acc = 0;
  private frames = 0;
  private calm = 0;
  private pinned = 0;
  /** True once the controller has had to dip below `min` to hold the frame rate. */
  rescued = false;
  private floor: number;
  constructor(private o: AutoScaleOptions) {
    this.scale = o.max;
    this.floor = o.min;
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
    if (avg > (this.o.slowMs ?? this.o.target * 0.93)) {
      this.calm = 0;
      // Slow even at the floor for ~2 s: unlock the rescue floor (once).
      if (this.scale <= this.floor && ++this.pinned >= 4 && this.floor > (this.o.rescueMin ?? this.floor)) {
        this.floor = this.o.rescueMin ?? this.floor;
        this.rescued = true;
      }
      if (this.scale > this.floor) {
        this.scale = Math.max(this.floor, +(this.scale * 0.9).toFixed(3));
        return this.scale;
      }
      return null;
    }
    this.pinned = 0;
    if (avg < (this.o.fastMs ?? this.o.target * 0.66)) {
      // Up only after 120 calm frames (four windows) in a row, so it doesn't oscillate.
      if (++this.calm >= 4 && this.scale < this.o.max) {
        this.calm = 0;
        this.scale = Math.min(this.o.max, +(this.scale * 1.05).toFixed(3));
        return this.scale;
      }
    } else this.calm = 0;
    return null;
  }
}

/**
 * Plan item 317: the front door's dynamic resolution, judged against the frame cap it runs at (render/frontscene.ts:
 * phones 30 fps, desktops 60). An on-time frame sits just over its cap's interval, so it never counts as slow; a
 * missed vsync (50 ms on a phone, 33 ms on a desktop) does, and the scale steps down only then; on-time frames bring
 * it back up (with the 60 fps thresholds of old, an on-time 16.7 ms frame never beat 12 ms, so one hitch lowered it for good).
 */
export function frontDynOptions(phone: boolean): AutoScaleOptions {
  return phone
    ? { min: 0.6, max: 1, target: 1000 / 30, slowMs: 38, fastMs: 34.5 }
    : { min: 0.6, max: 1, target: 1000 / 60, slowMs: 18, fastMs: 17.2 };
}
