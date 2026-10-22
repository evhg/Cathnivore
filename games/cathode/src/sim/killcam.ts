// Kill-cam rules (docs/design/cathode-combat.md S5.3), pure: which kills earn one, which shot it takes, and the
// time it runs at, millisecond by millisecond. The camera work itself is game/killcam.ts.
//
// Triggers, at most one per 20 s, never in the first 3 kills of a new save (the first job's finale excepted):
//   - the last enemy of an encounter, killed by a headshot, a sever or a takedown;
//   - a ballistic headshot beyond 30 m;
//   - a multi-kill: 3 within 1.5 s.
// Setting: On / Last enemy only (the default) / Off. A ballistic round gets the bullet follow only when predict()
// says it hits; everything else gets the last-man orbit.

export type KillCamSetting = "on" | "last" | "off";
export type KillCamShot = "bullet" | "orbit";

export const KILLCAM = {
  cooldownMs: 20000,
  /** Kills of a new save before the first kill-cam may play. */
  graceKills: 3,
  longHeadshotM: 30,
  multiKills: 3,
  multiWindowMs: 1500,
  /** Any input skips, but not in the first 300 ms (so the shot that earned it doesn't skip it). */
  skipAfterMs: 300,
  bullet: {
    /** The flight: time 0.1, the camera 0.5 m behind the round, FOV 50, orbiting 8 deg/s. */
    flightScale: 0.1,
    flightCapMs: 1500,
    back: 0.5,
    fov: 50,
    orbitDegS: 8,
    /** The impact: time 0.05 for 200 ms (x-ray on desktop for 600 ms). */
    impactScale: 0.05,
    impactMs: 200,
    xrayMs: 600,
    /** Then an orbit of the body at 0.3 until 800 ms after the impact, a ramp to 1 over 250 ms with a 120 ms whip-pan. */
    orbitScale: 0.3,
    orbitEndMs: 1000,
    rampMs: 250,
    whipMs: 120,
    streak: { length: 0.6, color: 0xffe0b0 },
  },
  orbit: {
    /** Time 0.25; the camera 3.5 m out at 1.4 m, 35 deg off her line, FOV 45, 2.39:1 bars in over 150 ms. */
    scale: 0.25,
    radius: 3.5,
    height: 1.4,
    offDeg: 35,
    fov: 45,
    barsMs: 150,
    degS: 20,
    holdMs: 900,
    rampMs: 250,
  },
  /** Audio: everything down 12 semitones, a low-pass at 800 Hz, a two-beat heartbeat at 55 Hz. */
  audio: { semitones: -12, lowpassHz: 800, heartHz: 55 },
} as const;

export interface KillCamKill {
  /** Real ms (any clock, as long as it is the same one for every call). */
  now: number;
  /** He was the last of the encounter. */
  last: boolean;
  headshot: boolean;
  severed: boolean;
  takedown: boolean;
  /** Fired by a ballistic round (the sniper class), and predict() saw it hit. */
  ballistic: boolean;
  predicted: boolean;
  distance: number;
  /** Kills this save so far, counting this one. */
  killsThisSave: number;
  /** The first job's finale (the grace kills don't apply). */
  finale?: boolean;
}

export class KillCamRules {
  setting: KillCamSetting;
  private lastCamAt = -Infinity;
  private recent: number[] = [];

  constructor(setting: KillCamSetting = "last") {
    this.setting = setting;
  }

  /** Records a kill and says which kill-cam it earns, or null. A camera it earns starts the cooldown. */
  kill(k: KillCamKill): KillCamShot | null {
    this.recent = this.recent.filter((t) => k.now - t <= KILLCAM.multiWindowMs);
    this.recent.push(k.now);
    const shot = this.judge(k);
    if (shot) {
      this.lastCamAt = k.now;
      this.recent = [];
    }
    return shot;
  }

  /** Whether a kill like this would earn one (no side effects): the gate for the bullet follow at the trigger pull. */
  wouldTrigger(k: KillCamKill): KillCamShot | null {
    const saved = this.recent;
    this.recent = [...saved.filter((t) => k.now - t <= KILLCAM.multiWindowMs), k.now];
    const shot = this.judge(k);
    this.recent = saved;
    return shot;
  }

  /** Ms left on the cooldown. */
  cooldownLeft(now: number): number {
    return Math.max(0, KILLCAM.cooldownMs - (now - this.lastCamAt));
  }

  private judge(k: KillCamKill): KillCamShot | null {
    if (this.setting === "off") return null;
    if (k.now - this.lastCamAt < KILLCAM.cooldownMs) return null;
    if (k.killsThisSave <= KILLCAM.graceKills && !k.finale) return null;
    const shot: KillCamShot = k.ballistic && k.predicted ? "bullet" : "orbit";
    if (k.last && (k.headshot || k.severed || k.takedown)) return shot;
    if (this.setting === "last") return null;
    if (k.ballistic && k.predicted && k.headshot && k.distance > KILLCAM.longHeadshotM) return "bullet";
    if (this.recent.length >= KILLCAM.multiKills) return "orbit";
    return null;
  }
}

/** Any input skips a kill-cam after 300 ms. */
export function canSkip(msIn: number): boolean {
  return msIn >= KILLCAM.skipAfterMs;
}

/**
 * The world's time scale through a bullet follow. `sinceImpact` is real ms since the round struck (null in flight).
 * Never above 1, and monotonic back up to 1 once the orbit ends.
 */
export function bulletScale(sinceImpact: number | null): number {
  const B = KILLCAM.bullet;
  if (sinceImpact === null) return B.flightScale;
  if (sinceImpact < B.impactMs) return B.impactScale;
  if (sinceImpact < B.orbitEndMs) return B.orbitScale;
  const u = Math.min(1, (sinceImpact - B.orbitEndMs) / B.rampMs);
  return B.orbitScale + (1 - B.orbitScale) * u;
}

/** The bullet follow is over (real ms since the impact). */
export function bulletDone(sinceImpact: number): boolean {
  return sinceImpact >= KILLCAM.bullet.orbitEndMs + KILLCAM.bullet.rampMs;
}

/** The whip-pan smear (0..1) on the way out of a bullet follow: a 120 ms pulse at the start of the ramp. */
export function whipAt(sinceImpact: number): number {
  const B = KILLCAM.bullet;
  const u = (sinceImpact - B.orbitEndMs) / B.whipMs;
  return u < 0 || u > 1 ? 0 : Math.sin(u * Math.PI);
}

/** The world's time scale through a last-man orbit (real ms since it began). */
export function orbitScale(ms: number): number {
  const O = KILLCAM.orbit;
  if (ms < O.holdMs) return O.scale;
  const u = Math.min(1, (ms - O.holdMs) / O.rampMs);
  return O.scale + (1 - O.scale) * u;
}

export function orbitDone(ms: number): boolean {
  return ms >= KILLCAM.orbit.holdMs + KILLCAM.orbit.rampMs;
}

/** The 2.39:1 bars (0..1): in over 150 ms, out over the ramp. */
export function orbitBars(ms: number): number {
  const O = KILLCAM.orbit;
  if (ms < O.holdMs) return Math.min(1, ms / O.barsMs);
  return Math.max(0, 1 - (ms - O.holdMs) / O.rampMs);
}

/** The bars' height as a share of the viewport for a 2.39:1 frame (each bar), at aspect w/h. */
export function barShare(aspect: number): number {
  return Math.max(0, (1 - aspect / 2.39) / 2);
}
