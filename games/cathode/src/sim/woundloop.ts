// The wounded loop (docs/design/cathode-combat.md S6.3, C7), pure so it can be tested without WebAudio or WebGL:
//   - the heartbeat clock: beats at lerp(80, 120, w) bpm (a stim slows it 30 bpm over 2 s), each a lub and a
//     dub 110 ms later, kept in AudioContext time; the frame reads the same clock through a phase map, so the
//     vignette's uPulse beats exactly when the beat is heard;
//   - breath, world muffle and the bleeding wobble as functions of w;
//   - the four lens-blood slots (age 1.8 s, one splat per 400 ms, none under reduced violence) and the stim wipe.

export const WOUND = {
  bpmFine: 80,
  bpmBleeding: 120,
  /** A stim takes this many bpm off, eased in over `stimSlowS` and held while the stim's wash runs. */
  stimSlowBpm: 30,
  stimSlowS: 2,
  /** The dub follows the lub by 110 ms. */
  dubS: 0.11,
  /** Heard from critical on (w >= 0.35). */
  heartFromW: 0.35,
  breathHzFine: 0.3,
  breathHzBleeding: 0.9,
  muffleTopHz: 22000,
  muffleLowHz: 1500,
  /** Bleeding wobble: +-1 degree of roll at 0.3 Hz and a 0.4% FOV breathe in step. */
  wobbleDeg: 1,
  wobbleHz: 0.3,
  fovBreathe: 0.004,
  lensLifeS: 1.8,
  lensGapS: 0.4,
  lensDrip: 0.06,
  wipeS: 0.5,
} as const;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Heart rate for `w`, less a stim's slowing (0..1 of its full 30 bpm). */
export function heartBpm(w: number, stimSlow = 0): number {
  return Math.max(40, lerp(WOUND.bpmFine, WOUND.bpmBleeding, clamp01(w)) - WOUND.stimSlowBpm * clamp01(stimSlow));
}

/** The world lowpass for `w`, on an exponential curve from 22 kHz (fine) to 1.5 kHz (bleeding out). */
export function muffleHz(w: number): number {
  return WOUND.muffleTopHz * Math.pow(WOUND.muffleLowHz / WOUND.muffleTopHz, clamp01(w));
}

/** Breathing: its rate (Hz) and level (0 fine .. 1), so the loop plays at `0.25 * level`. */
export function breath(w: number): { hz: number; level: number } {
  const x = clamp01(w);
  return { hz: lerp(WOUND.breathHzFine, WOUND.breathHzBleeding, x), level: x <= 0 ? 0 : Math.min(1, 0.3 + 0.7 * x) };
}

/**
 * The bleeding wobble at `t` seconds: a slow roll (radians) and a FOV multiplier breathing with it. Only in the
 * bleeding tier, faded in over its first 0.1 of w, and nothing at all under reduced motion.
 */
export function wobble(t: number, w: number, reducedMotion: boolean): { roll: number; fovMul: number } {
  if (reducedMotion) return { roll: 0, fovMul: 1 };
  const on = clamp01((w - 0.85) / 0.05);
  if (on <= 0) return { roll: 0, fovMul: 1 };
  const ph = Math.sin(t * Math.PI * 2 * WOUND.wobbleHz);
  return { roll: ((WOUND.wobbleDeg * Math.PI) / 180) * ph * on, fovMul: 1 + WOUND.fovBreathe * on * Math.sin(t * Math.PI * 2 * WOUND.wobbleHz + Math.PI / 2) };
}

/**
 * The envelope of one beat `dt` seconds after its lub: a 4 ms attack, then a fast fall; the dub 110 ms on at 70%.
 * 0..1. The vignette closes by `uPulse * 0.035 * w` (S6.4), so this is the visible beat.
 */
export function beatEnvelope(dt: number): number {
  const one = (x: number, decay: number) => (x < 0 ? 0 : x < 0.004 ? x / 0.004 : Math.exp(-(x - 0.004) / decay));
  return Math.min(1, one(dt, 0.07) + 0.7 * one(dt - WOUND.dubS, 0.06));
}

/**
 * Maps frame time to AudioContext time. The audio clock is what the ear hears; the frame clock is what the
 * render uses. `sync` is called once a frame with both; the offset follows slowly (the two clocks drift and the
 * frame stamp jitters), so the pulse lands on the beat without stepping. Before any audio, the map is identity.
 */
export class PhaseMap {
  private offset = 0;
  private synced = false;
  sync(audioT: number, frameT: number): void {
    const o = audioT - frameT;
    if (!this.synced || Math.abs(o - this.offset) > 0.25) {
      this.offset = o;
      this.synced = true;
    } else this.offset += (o - this.offset) * 0.1;
  }
  toAudio(frameT: number): number {
    return frameT + this.offset;
  }
  toFrame(audioT: number): number {
    return audioT - this.offset;
  }
}

/**
 * The heartbeat scheduler. `schedule(now, ahead, bpm)` returns the lub times (audio clock) to queue in the next
 * `ahead` seconds, so WebAudio plays them sample-exact; `pulse(t)` is the envelope at audio time `t` from the
 * beats already scheduled. Stops when `bpm` is 0 (fine and hurt tiers): the next beat restarts one beat out.
 */
export class HeartClock {
  private next = -1;
  /** The most recent lubs (audio time), newest last. */
  readonly beats: number[] = [];
  schedule(now: number, ahead: number, bpm: number): number[] {
    if (bpm <= 0) {
      this.next = -1;
      return [];
    }
    const period = 60 / bpm;
    if (this.next < 0 || this.next < now - period) this.next = now + 0.02;
    const out: number[] = [];
    while (this.next <= now + ahead) {
      out.push(this.next);
      this.beats.push(this.next);
      this.next += period;
    }
    if (this.beats.length > 6) this.beats.splice(0, this.beats.length - 6);
    return out;
  }
  pulse(t: number): number {
    let p = 0;
    for (const b of this.beats) if (b <= t) p = Math.max(p, beatEnvelope(t - b));
    return p;
  }
  reset(): void {
    this.next = -1;
    this.beats.length = 0;
  }
}

/** One lens-blood slot: where on screen (uv, 0..1, y up), which atlas cell, how old (s; < 0 empty). */
export interface LensSlot {
  x: number;
  y: number;
  cell: number;
  age: number;
  /** 0.8..1.25: the splat's size. */
  size: number;
}

/** Where the four slots sit: right, left, top, bottom, each a little off-axis so they never line up. */
const ANCHORS: ReadonlyArray<readonly [number, number]> = [
  [0.84, 0.56],
  [0.15, 0.47],
  [0.58, 0.86],
  [0.36, 0.16],
];

/**
 * The lens: four slots, each splat in the slot nearest the hit side, at most one per 400 ms, each ageing over
 * 1.8 s. Reduced violence never fills a slot (S6.4 / S6.6). A stim wipes them left to right over 500 ms.
 */
export class LensBlood {
  readonly slots: LensSlot[] = ANCHORS.map(([x, y], i) => ({ x, y, cell: i, age: -1, size: 1 }));
  /** The wipe's front, 0..1 across the screen (uv x); < 0 when no wipe runs. */
  wipe = -1;
  private last = -1e9;
  private n = 0;
  constructor(public reducedViolence = false) {}
  /**
   * A splat toward screen direction (dx, dy) (+x right, +y up) at time `now` (s). Returns the slot used, or -1
   * (reduced violence, or within 400 ms of the last). `force` skips the gap (the death fall's extra splats).
   */
  splat(dx: number, dy: number, now: number, force = false): number {
    if (this.reducedViolence) return -1;
    if (!force && now - this.last < WOUND.lensGapS) return -1;
    let best = 0;
    let bestD = -Infinity;
    const l = Math.hypot(dx, dy) || 1;
    ANCHORS.forEach(([x, y], i) => {
      const ax = x - 0.5;
      const ay = y - 0.5;
      const d = (ax * dx + ay * dy) / (l * Math.hypot(ax, ay));
      if (d > bestD) {
        bestD = d;
        best = i;
      }
    });
    const s = this.slots[best]!;
    this.n++;
    // A little jitter by count so two splats in the same slot don't land on the same pixels.
    const j = ((this.n * 0.618) % 1) - 0.5;
    s.x = ANCHORS[best]![0] + j * 0.06;
    s.y = ANCHORS[best]![1] - j * 0.05;
    s.cell = (best + this.n) % 4;
    s.age = 0;
    s.size = 0.85 + ((this.n * 0.381) % 1) * 0.4;
    this.last = now;
    return best;
  }
  /** Starts the stim wipe (left to right over 500 ms). */
  startWipe(): void {
    if (this.slots.some((s) => s.age >= 0)) this.wipe = 0;
  }
  update(dt: number): void {
    for (const s of this.slots) if (s.age >= 0) s.age = s.age + dt >= WOUND.lensLifeS ? -1 : s.age + dt;
    if (this.wipe >= 0) {
      this.wipe += dt / WOUND.wipeS;
      // Behind the front, the slot is wiped.
      for (const s of this.slots) if (s.age >= 0 && s.x + 0.12 * s.size < this.wipe * 1.2 - 0.1) s.age = -1;
      if (this.wipe >= 1) {
        this.wipe = -1;
        for (const s of this.slots) s.age = -1;
      }
    }
  }
  clear(): void {
    for (const s of this.slots) s.age = -1;
    this.wipe = -1;
    this.last = -1e9;
  }
  get active(): number {
    return this.slots.filter((s) => s.age >= 0).length;
  }
}

/** A lens slot's alpha and drip at `age` (S6.4: alpha 1 - u^2, drip 0.06 * u, u = age / 1.8 s). */
export function lensFade(age: number): { alpha: number; drip: number } {
  if (age < 0) return { alpha: 0, drip: 0 };
  const u = clamp01(age / WOUND.lensLifeS);
  return { alpha: 1 - u * u, drip: WOUND.lensDrip * u };
}
