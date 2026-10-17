// C5 "Kestrel 9 in motion" (S2.2 to S2.4): the pistol's choreography as data, with no three.js import so the
// tests read exactly what the viewmodel plays. Clips are in gun-root space (metres, radians; -Z is the muzzle,
// +X her right, +Y up). Scalar channels (weights, visibility) ride in a track's pos[0].
//
//   FIRE        the shot: slide 24 mm back by 30 ms, home by 62 ms with a 0.6 mm overshoot, barrel tilt from
//               14 ms, hammer down and re-cocked, the shell at 18 ms.
//   TAC / EMPTY the reloads (1.55 s / 2.05 s); the mag counts as in at 60% (930 / 1230 ms).
//   DRAW / HERO the 450 ms draw and the first pickup's 900 ms hero draw with its rack at 300 ms.
//   PRESS_CHECK after 12 s idle: the slide eased back 8 mm under the support thumb, a look, and home.

import { Spring1, type SpringSpec } from "./spring";
import { sampleTrack, eventsBetween, type Clip, type Sample } from "./clip";
import { tuning } from "./tuning";

const K = tuning.kestrel;
const D = Math.PI / 180;
const F = K.fire;

/** The magazine's way out of the grip, in gun space (the grip rakes about 18°). */
export const MAG_AXIS: [number, number, number] = [0, -0.951, 0.309];
const out = (m: number): [number, number, number] => [MAG_AXIS[0] * m, MAG_AXIS[1] * m, MAG_AXIS[2] * m];
/** Off the bottom-left of the frame: where the old mag goes and the new one comes from. */
// Out low and to the left (C5 review: straight down, the mag crossed the middle of the frame with the glove
// already off the bottom edge).
const POUCH: [number, number, number] = [-0.34, -0.3, 0.08];
const POUCH_ROT: [number, number, number] = [0.5, 0.2, 0.7];

export const FIRE: Clip = {
  dur: F.settleMs,
  tracks: {
    // 0-30 ms back with an ease-out, 30-62 ms home with an ease-in to a one-frame 0.6 mm overshoot, then rest.
    slide: [
      [0, [0, 0, 0], [0, 0, 0]],
      [F.slideBackMs, [0, 0, F.slideM], [0, 0, 0], "out"],
      [F.slideHomeMs, [0, 0, -F.overshootM], [0, 0, 0], "in"],
      [F.settleMs, [0, 0, 0], [0, 0, 0], "out"],
    ],
    // The barrel unlocks and tilts 3° from 14 ms while the slide is back, and relocks as it returns.
    barrel: [
      [0, [0, 0, 0], [0, 0, 0]],
      [F.barrelFromMs, [0, 0, 0], [0, 0, 0]],
      [F.slideBackMs, [0, 0, 0], [F.barrelTiltDeg * D, 0, 0], "out"],
      [F.slideHomeMs - 8, [0, 0, 0], [F.barrelTiltDeg * D * 0.8, 0, 0]],
      [F.slideHomeMs, [0, 0, 0], [0, 0, 0], "in"],
    ],
    // The hammer falls at once (55° to 0 in 4 ms), then re-cocks as the slide returns.
    hammer: [
      [0, [0, 0, 0], [F.hammerDeg * D, 0, 0]],
      [4, [0, 0, 0], [0, 0, 0], "in"],
      [F.slideBackMs, [0, 0, 0], [0, 0, 0]],
      [F.slideHomeMs, [0, 0, 0], [F.hammerDeg * D, 0, 0], "inOut"],
    ],
    // The trigger at full travel on the break, resetting as the slide comes home.
    trigger: [
      [0, [F.triggerMm, 0, 0], [0, 0, 0]],
      [F.slideBackMs, [F.triggerMm, 0, 0], [0, 0, 0]],
      [F.settleMs, [0, 0, 0], [0, 0, 0], "out"],
    ],
  },
  events: [
    [0, "fire"],
    [F.shellMs, "shell"],
    [F.slideBackMs, "slideBack"],
    [F.slideHomeMs, "slideHome"],
  ],
};

const R = K.reload;
const seatTac = R.tacMs * R.commit;
const seatEmpty = R.emptyMs * R.commit;
// The gun's reload pose: rolled 26° clockwise (top to the right, the butt swung left out from behind her
// forearm toward the support hand, the left flank to the eye), muzzle up 12° so the magwell opens toward her,
// and lifted so the bottom of the grip comes into frame (at the hip it sits below the screen's edge).
const TILT: [number, number, number] = [8 * D, 18 * D, -30 * D];
// Held 13 cm further out than the hip (C5 review: closer in, the firing forearm filled the lower right quarter).
const TILT_P: [number, number, number] = [0.035, 0.05, -0.13];

/** Tactical reload, 1.55 s: a round stays chambered; the mag is in at 930 ms. */
export const TAC: Clip = {
  dur: R.tacMs,
  tracks: {
    gun: [
      [0, [0, 0, 0], [0, 0, 0]],
      [200, TILT_P, TILT, "inOut"],
      [seatTac - 2, TILT_P, TILT],
      // The seat: a one-frame 4 mm jolt up the grip.
      [seatTac + 16, [TILT_P[0], TILT_P[1] + R.seatJoltM, TILT_P[2] - 0.002], [TILT[0] + 2.5 * D, TILT[1], TILT[2]], "out"],
      [seatTac + 90, TILT_P, TILT, "inOut"],
      [R.tacMs, [0, 0, 0], [0, 0, 0], "inOut"],
    ],
    mag: [
      [0, [0, 0, 0], [0, 0, 0]],
      [200, [0, 0, 0], [0, 0, 0]],
      [235, out(0.03), [0, 0, 0], "out"],
      // The glove strips it clear of the grip, then carries it away to the bottom left.
      [330, [-0.012, MAG_AXIS[1] * 0.075, MAG_AXIS[2] * 0.075], [0.08, 0.04, 0.14], "inOut"],
      [520, POUCH, POUCH_ROT, "in"],
      [560, POUCH, POUCH_ROT],
      [880, out(0.045), [0, 0, 0], "out"],
      [seatTac, [0, 0, 0], [0, 0, 0], "in"],
    ],
    // pos[0]: the support hand's weight from the grip (0) to the magazine (1).
    hand: [
      [0, [0, 0, 0], [0, 0, 0]],
      [190, [1, 0, 0], [0, 0, 0], "inOut"],
      [seatTac + 40, [1, 0, 0], [0, 0, 0]],
      [seatTac + 300, [0, 0, 0], [0, 0, 0], "inOut"],
    ],
    // pos[0]: how far the firing shoulder drops out and right (so the forearm falls away under the turned gun).
    arm: [
      [0, [0, 0, 0], [0, 0, 0]],
      [200, [1, 0, 0], [0, 0, 0], "inOut"],
      [seatTac + 90, [1, 0, 0], [0, 0, 0]],
      [R.tacMs, [0, 0, 0], [0, 0, 0], "inOut"],
    ],
    // pos[0]: the mag shown (1) or gone (0). A tactical reload never hides it: it's off screen at the swap.
    magVis: [[0, [1, 0, 0], [0, 0, 0]]],
    // pos[0]: the mag's top round shown.
    round: [[0, [1, 0, 0], [0, 0, 0]]],
  },
  events: [
    [0, "reloadStart"],
    [200, "magRelease"],
    [520, "magPouch"],
    [880, "magIn"],
    [seatTac, "seat"],
    [R.tacMs - 120, "settle"],
  ],
};

/** Empty reload, 2.05 s: the old mag drops free, the new one is in at 1230 ms, the slide stop at 1450 ms. */
export const EMPTY: Clip = {
  dur: R.emptyMs,
  tracks: {
    gun: [
      [0, [0, 0, 0], [0, 0, 0]],
      [200, TILT_P, TILT, "inOut"],
      [seatEmpty - 2, TILT_P, TILT],
      [seatEmpty + 16, [TILT_P[0], TILT_P[1] + R.seatJoltM, TILT_P[2] - 0.002], [TILT[0] + 2.5 * D, TILT[1], TILT[2]], "out"],
      [seatEmpty + 90, TILT_P, TILT, "inOut"],
      // The thumb comes up onto the slide stop: the gun turns back toward square.
      [R.slideStopMs, [-0.006, 0.006, 0.02], [4 * D, 3 * D, -9 * D], "inOut"],
      // The slam: the slide's mass throws the muzzle down and the gun forward a touch.
      [R.slideStopMs + R.slamMs, [-0.006, 0.0, 0.012], [1 * D, 3 * D, -8 * D], "out"],
      [R.slideStopMs + 110, [-0.006, 0.006, 0.02], [4 * D, 3 * D, -9 * D], "inOut"],
      [R.emptyMs, [0, 0, 0], [0, 0, 0], "inOut"],
    ],
    mag: [
      [0, [0, 0, 0], [0, 0, 0]],
      [200, [0, 0, 0], [0, 0, 0]],
      [560, POUCH, POUCH_ROT, "inOut"],
      [700, POUCH, POUCH_ROT],
      [seatEmpty - 70, out(0.045), [0, 0, 0], "out"],
      [seatEmpty, [0, 0, 0], [0, 0, 0], "in"],
    ],
    hand: [
      [0, [0, 0, 0], [0, 0, 0]],
      [190, [1, 0, 0], [0, 0, 0], "inOut"],
      [seatEmpty + 40, [1, 0, 0], [0, 0, 0]],
      [R.slideStopMs - 40, [0, 0, 0], [0, 0, 0], "inOut"],
    ],
    arm: [
      [0, [0, 0, 0], [0, 0, 0]],
      [200, [1, 0, 0], [0, 0, 0], "inOut"],
      [R.slideStopMs + 110, [1, 0, 0], [0, 0, 0]],
      [R.emptyMs, [0, 0, 0], [0, 0, 0], "inOut"],
    ],
    // The old mag leaves the gun at 200 ms (a physical drop in the world); the new one shows from the pouch.
    magVis: [
      [0, [1, 0, 0], [0, 0, 0]],
      [200, [0, 0, 0], [0, 0, 0], "step"],
      [560, [1, 0, 0], [0, 0, 0], "step"],
    ],
    round: [[0, [1, 0, 0], [0, 0, 0]]],
    // The slide: locked back until the stop drops at 1450 ms, then home in 35 ms.
    slide: [
      [0, [0, 0, F.slideM], [0, 0, 0]],
      [R.slideStopMs, [0, 0, F.slideM], [0, 0, 0]],
      [R.slideStopMs + R.slamMs, [0, 0, -F.overshootM], [0, 0, 0], "in"],
      [R.slideStopMs + R.slamMs + 16, [0, 0, 0], [0, 0, 0], "out"],
    ],
    // pos[0]: the slide stop up (1) until the thumb presses it down.
    stop: [
      [0, [1, 0, 0], [0, 0, 0]],
      [R.slideStopMs - 30, [1, 0, 0], [0, 0, 0]],
      [R.slideStopMs, [0, 0, 0], [0, 0, 0], "in"],
    ],
  },
  events: [
    [0, "reloadStart"],
    [200, "magRelease"],
    [200, "magDrop"],
    [560, "magPouch"],
    [seatEmpty - 70, "magIn"],
    [seatEmpty, "seat"],
    [R.slideStopMs, "slideStop"],
    [R.slideStopMs + R.slamMs, "slam"],
    [R.emptyMs - 120, "settle"],
  ],
};

const DR = K.draw;
/** The draw, 450 ms: up from 25 cm low and 40° down. */
export const DRAW: Clip = {
  dur: DR.ms,
  tracks: {
    gun: [
      [0, [0.02, -DR.dropM, 0.05], [-DR.pitchDeg * D, 0.15, -0.35]],
      // Two beats (C5 review: one cubic ease-out had 96% of the rise done by 300 ms, so the draw never showed):
      // the gun lifts out of the holster still pointing down, then rolls up onto the line and settles.
      [DR.ms * 0.42, [0.012, -DR.dropM * 0.42, 0.03], [-DR.pitchDeg * 0.5 * D, 0.08, -0.2], "inOut"],
      [DR.ms * 0.88, [0, 0.003, 0], [0.6 * D, 0, 0.01], "inOut"],
      [DR.ms, [0, 0, 0], [0, 0, 0], "inOut"],
    ],
  },
  events: [
    [0, "draw"],
    [DR.ms * 0.88, "settle"],
  ],
};

/**
 * The first pickup's hero draw, 900 ms: up and turned to show the flank, a full rack at 300 ms (the support hand
 * stays wrapped: carried over to the rear serrations, her sleeve filled the frame), then aimed in.
 */
export const HERO: Clip = {
  dur: DR.heroMs,
  tracks: {
    gun: [
      [0, [0.02, -DR.dropM, 0.05], [-DR.pitchDeg * D, 0.15, -0.35]],
      // Up and turned to show her the left flank and the top, out a little from her chest.
      [DR.heroRackMs - 40, [-0.03, 0.035, -0.1], [8 * D, 35 * D, -12 * D], "out"],
      // The rack: the support hand pulls the slide, the gun pushes forward against it.
      [DR.heroRackMs + 40, [-0.03, 0.031, -0.116], [6 * D, 35 * D, -12 * D], "out"],
      [DR.heroRackMs + 110, [-0.03, 0.039, -0.094], [11 * D, 35 * D, -11 * D], "out"],
      [DR.heroMs - 150, [0, 0.004, 0], [1 * D, 0, 0], "inOut"],
      [DR.heroMs, [0, 0, 0], [0, 0, 0], "inOut"],
    ],
    slide: [
      [0, [0, 0, 0], [0, 0, 0]],
      [DR.heroRackMs, [0, 0, 0], [0, 0, 0]],
      [DR.heroRackMs + 70, [0, 0, F.slideM], [0, 0, 0], "inOut"],
      [DR.heroRackMs + 95, [0, 0, F.slideM], [0, 0, 0]],
      // Released: it slams home on its spring.
      [DR.heroRackMs + 120, [0, 0, -F.overshootM], [0, 0, 0], "in"],
      [DR.heroRackMs + 136, [0, 0, 0], [0, 0, 0], "out"],
    ],
  },
  events: [
    [0, "draw"],
    [DR.heroRackMs, "rackBack"],
    [DR.heroRackMs + 120, "rackHome"],
    [DR.heroMs - 150, "settle"],
  ],
};

const I = K.inspect;
/** The idle press-check, 1.6 s: the gun turns in, the slide comes back 8 mm under the support thumb, home. */
export const PRESS_CHECK: Clip = {
  dur: I.pressCheckMs,
  tracks: {
    gun: [
      [0, [0, 0, 0], [0, 0, 0]],
      [380, [-0.03, 0.025, -0.04], [6 * D, 22 * D, -16 * D], "inOut"],
      [1100, [-0.031, 0.026, -0.042], [7 * D, 24 * D, -17 * D]],
      [I.pressCheckMs, [0, 0, 0], [0, 0, 0], "inOut"],
    ],
    slide: [
      [0, [0, 0, 0], [0, 0, 0]],
      [450, [0, 0, 0], [0, 0, 0]],
      [650, [0, 0, I.pressCheckM], [0, 0, 0], "inOut"],
      [950, [0, 0, I.pressCheckM], [0, 0, 0]],
      [1050, [0, 0, 0], [0, 0, 0], "in"],
    ],
  },
  events: [
    [0, "cloth"],
    [650, "pressBack"],
    [1050, "pressHome"],
    [I.pressCheckMs - 100, "settle"],
  ],
};

/** A scalar channel (a track's pos[0]) of a clip at `tMs`, or `dflt` when the clip has no such track. */
export function channel(clip: Clip, track: string, tMs: number, dflt = 0): number {
  const k = clip.tracks[track];
  return k ? sampleTrack(k, tMs).pos[0] : dflt;
}

/** A track's sample at `tMs` (zero when the clip has none). */
export function track(clip: Clip, name: string, tMs: number, out?: Sample): Sample | null {
  const k = clip.tracks[name];
  return k ? sampleTrack(k, tMs, out) : null;
}

export type ReloadKind = "tac" | "empty";

/**
 * The reload's rules (S2.4): sprint, fire or a swap cancels it before the commit with no ammo lost; at the
 * commit (60%) the rounds move into the gun; after it the reload can't be cancelled.
 */
export class ReloadMachine {
  kind: ReloadKind | null = null;
  /** Ms into the reload. */
  t = 0;
  committed = false;

  get clip(): Clip {
    return this.kind === "empty" ? EMPTY : TAC;
  }

  get active(): boolean {
    return this.kind !== null;
  }

  get dur(): number {
    return this.kind ? this.clip.dur : 0;
  }

  get commitAt(): number {
    return this.dur * R.commit;
  }

  start(kind: ReloadKind): boolean {
    if (this.kind) return false;
    this.kind = kind;
    this.t = 0;
    this.committed = false;
    return true;
  }

  /** Cancels a reload that hasn't committed; returns whether it did. */
  cancel(): boolean {
    if (!this.kind || this.committed) return false;
    this.kind = null;
    this.t = 0;
    return true;
  }

  /** Advances; `commit` is true on the step that crosses 60%, `done` on the step that ends it. */
  step(dtMs: number): { commit: boolean; done: boolean; events: string[] } {
    if (!this.kind) return { commit: false, done: false, events: [] };
    const t0 = this.t;
    const clip = this.clip;
    this.t = Math.min(clip.dur, t0 + Math.max(0, dtMs));
    const events = eventsBetween(clip, t0 === 0 ? -1 : t0, this.t);
    let commit = false;
    if (!this.committed && this.t >= this.commitAt) {
      this.committed = true;
      commit = true;
    }
    const done = this.t >= clip.dur;
    if (done) this.kind = null;
    return { commit, done, events };
  }
}

/**
 * Velocity kick that makes a spring at rest peak at `peak`. Measured on the real integrator (1/240 s semi-implicit
 * Euler, which at 14-16 Hz peaks a little off the analytic value), once per spec.
 */
const peakCache = new Map<string, number>();
export function impulseForPeak(spec: SpringSpec, peak: number): number {
  const key = `${spec.freqHz}:${spec.zeta}`;
  let unit = peakCache.get(key);
  if (unit === undefined) {
    const s = new Spring1(spec);
    s.shove(1);
    unit = 0;
    for (let i = 0; i < 480; i++) unit = Math.max(unit, s.update(1 / 240));
    peakCache.set(key, unit);
  }
  return peak / unit;
}

/**
 * The camera side of recoil (S2.3, `recoilAt`): each shot kicks the aim up 1.1° (and ±0.3° sideways); 70% of
 * that springs back over about 200 ms on a 5 Hz critically damped spring, and 30% stays for her to correct.
 */
export class CamRecoil {
  readonly pitch = new Spring1(K.camera.spring);
  readonly yaw = new Spring1(K.camera.spring);

  /**
   * A shot. `side` in -1..1 picks the yaw. Returns the part that stays (radians), which the caller adds to the
   * player's own look; the spring carries the rest.
   */
  kick(side: number, mul = 1): { pitch: number; yaw: number } {
    const p = K.camera.pitchDeg * D * mul;
    const y = K.camera.yawDeg * D * side * mul;
    const r = K.camera.recover;
    this.pitch.x += p * r;
    this.yaw.x += y * r;
    return { pitch: p * (1 - r), yaw: y * (1 - r) };
  }

  /** Advances; returns the transient offset [pitch, yaw] in radians. */
  update(dt: number): [number, number] {
    return [this.pitch.update(dt), this.yaw.update(dt)];
  }

  /** The transient offset `tMs` after one kick of `amount` (analytic, for tests and the stages). */
  static recoilAt(tMs: number, amount = 1): number {
    const w = 2 * Math.PI * K.camera.spring.freqHz;
    const t = tMs / 1000;
    return amount * K.camera.recover * (1 + w * t) * Math.exp(-w * t);
  }

  reset(): void {
    this.pitch.x = this.pitch.v = 0;
    this.yaw.x = this.yaw.v = 0;
  }
}

/** Barrel heat (S2.3): +0.12 per shot, cooling 0.25/s; smoke grows up to 3x, the crown glows past 0.6. */
export class Heat {
  v = 0;
  shot(): void {
    this.v = Math.min(1.5, this.v + K.smoke.heatPerShot);
  }
  update(dt: number): number {
    this.v = Math.max(0, this.v - K.smoke.heatDecay * dt);
    return this.v;
  }
  /** Smoke multiplier, 1 to 3. */
  get smokeMul(): number {
    return 1 + Math.min(1, this.v) * (K.smoke.heatSmokeMax - 1);
  }
  /** Crown glow 0..1. */
  get glow(): number {
    return Math.max(0, Math.min(1, (this.v - K.smoke.glowFrom) / (1 - K.smoke.glowFrom)));
  }
}

/** A pistol's rounds and its slide (the lock on the last round). */
export interface PistolMag {
  ammo: number;
  reserve: number;
  /** Capacity. */
  mag: number;
  /** The slide is locked back on an empty magazine. */
  locked: boolean;
}

/**
 * A trigger pull (S2.3, S2.4): a pull during a reload that hasn't committed cancels it and fires (no ammo lost)
 * when there's a round to fire; on an empty, locked gun it dry-fires. The last round locks the slide.
 */
export function pullTrigger(h: PistolMag, rm: ReloadMachine): "fire" | "dry" | "none" {
  if (rm.active) {
    if (h.ammo <= 0 || !rm.cancel()) return "none";
  }
  if (h.ammo > 0) {
    h.ammo--;
    if (h.ammo === 0) h.locked = true;
    return "fire";
  }
  return "dry";
}

/** Starts the right reload: empty (slide locked) or tactical. Returns whether one began. */
export function startReload(h: PistolMag, rm: ReloadMachine): boolean {
  if (h.mag === 0 || h.ammo >= h.mag || h.reserve <= 0 || rm.active) return false;
  return rm.start(h.ammo === 0 ? "empty" : "tac");
}

/** Advances a reload: the rounds move at the commit, and the slide stop's drop unlocks the slide. */
export function stepReload(h: PistolMag, rm: ReloadMachine, dtMs: number): { commit: boolean; done: boolean; events: string[] } {
  const r = rm.step(dtMs);
  if (r.commit) {
    const take = Math.min(h.mag - h.ammo, h.reserve);
    h.ammo += take;
    h.reserve -= take;
  }
  if (r.events.includes("slam")) h.locked = false;
  // A reload that ended without a slam (a tactical one) never leaves the slide locked on a loaded gun.
  if (r.done && h.ammo > 0 && h.locked && !r.events.includes("slam")) h.locked = false;
  return r;
}
