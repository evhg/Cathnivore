// CATHODE's long shot: sniper rounds that travel in time, drop under gravity and drift in the district's
// wind (design bible 4.5). The model is a point mass with quadratic air drag relative to the moving air:
//
//   a = g − k |v − w| (v − w)
//
// Drag is what makes wind matter: a round in a vacuum would carry the wind's velocity it never had, so
// with drag the drift grows with the "lag time" (flight time minus the vacuum flight time), as with real
// rifles. Coordinates are metres with y up; the scope's line of sight is the straight line from the muzzle.
// `rangeLadder` gives the reticle's holdover marks and `solveShot` the lead and holdover the HUD shows.

import type { Vec3 } from "./types";

export const GRAVITY = 9.81;
/** Drag constant per metre: about 18% of a 850 m/s round's speed is gone at 400 m. */
export const DRAG = 0.0005;
/** Integration step in seconds. */
export const BALLISTIC_DT = 1 / 500;

const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const scale = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
const norm = (a: Vec3): Vec3 => {
  const l = len(a);
  return l > 0 ? scale(a, 1 / l) : { x: 0, y: 0, z: 1 };
};
const cross = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });

export interface ShotSample {
  /** Seconds since the shot. */
  t: number;
  pos: Vec3;
  vel: Vec3;
}

export interface ShotResult {
  /** Positions every sample step (about every 10 ms), first at the muzzle, last at the end. */
  samples: ShotSample[];
  /** Seconds until the round reached `maxRange` along its initial direction, hit something or fell. */
  timeOfFlight: number;
  /** Where the round ended. */
  end: Vec3;
  /** Velocity at the end (m/s). */
  endVelocity: Vec3;
  /** True when `stepFn` reported a hit. */
  hit: boolean;
}

/**
 * Called for every integration step with the segment travelled; return true to stop (the round hit
 * something). The game layer raycasts the segment against the level and the enemies here.
 */
export type StepFn = (from: Vec3, to: Vec3, t: number) => boolean;

export interface ShotOptions {
  drag?: number;
  gravity?: number;
  dt?: number;
  /** Keep a sample every n steps (default 5, i.e. every 10 ms). */
  sampleEvery?: number;
}

/**
 * Flies one round. `dir` needn't be normalised. The flight ends when the round's progress along `dir`
 * reaches `maxRange`, when `stepFn` returns true, or after 10 s.
 */
export function simulateShot(
  origin: Vec3,
  dir: Vec3,
  velocity: number,
  wind: Vec3,
  maxRange: number,
  stepFn?: StepFn,
  opts: ShotOptions = {},
): ShotResult {
  const k = opts.drag ?? DRAG;
  const gy = opts.gravity ?? GRAVITY;
  const dt = opts.dt ?? BALLISTIC_DT;
  const every = Math.max(1, opts.sampleEvery ?? 5);
  const d = norm(dir);
  let pos = { ...origin };
  let vel = scale(d, velocity);
  let t = 0;
  const samples: ShotSample[] = [{ t, pos, vel }];
  let hit = false;
  for (let step = 1; t < 10; step++) {
    // Semi-implicit Euler with a midpoint drag estimate: accurate to centimetres at these step sizes.
    const rel = sub(vel, wind);
    const accel = add({ x: 0, y: -gy, z: 0 }, scale(rel, -k * len(rel)));
    const mid = add(vel, scale(accel, dt / 2));
    const relMid = sub(mid, wind);
    const accelMid = add({ x: 0, y: -gy, z: 0 }, scale(relMid, -k * len(relMid)));
    const nextVel = add(vel, scale(accelMid, dt));
    let next = add(pos, scale(mid, dt));
    t += dt;
    // Clip the last step to exactly maxRange along the initial direction.
    const progress = dot(sub(next, origin), d);
    let done = false;
    if (progress >= maxRange) {
      const before = dot(sub(pos, origin), d);
      const f = (maxRange - before) / Math.max(1e-9, progress - before);
      next = add(pos, scale(sub(next, pos), f));
      t -= dt * (1 - f);
      done = true;
    }
    if (stepFn && stepFn(pos, next, t)) {
      hit = true;
      done = true;
    }
    pos = next;
    vel = nextVel;
    if (done || step % every === 0) samples.push({ t, pos, vel });
    if (done) break;
  }
  return { samples, timeOfFlight: t, end: pos, endVelocity: vel, hit };
}

/** Where a round crosses the plane at `distance` metres along the line of sight (and when). */
export function impactAt(origin: Vec3, dir: Vec3, losDir: Vec3, distance: number, velocity: number, wind: Vec3, opts?: ShotOptions): { pos: Vec3; t: number } {
  const los = norm(losDir);
  let result: { pos: Vec3; t: number } | null = null;
  simulateShot(
    origin,
    dir,
    velocity,
    wind,
    distance * 4,
    (from, to, t) => {
      const a = dot(sub(from, origin), los) - distance;
      const b = dot(sub(to, origin), los) - distance;
      if (a < 0 && b >= 0) {
        const f = -a / (b - a);
        result = { pos: add(from, scale(sub(to, from), f)), t: t - (1 - f) * (opts?.dt ?? BALLISTIC_DT) };
        return true;
      }
      return false;
    },
    opts,
  );
  return result ?? { pos: add(origin, scale(los, distance)), t: Infinity };
}

/** Milliradians subtended by `offset` metres at `distance` metres. */
export function toMils(offset: number, distance: number): number {
  return (Math.atan2(offset, distance) * 1000);
}

export interface LadderRung {
  range: number;
  /** Metres below the line of sight a centred shot lands (positive = low). */
  dropMeters: number;
  /** Holdover in mils for the reticle (positive = aim high). */
  dropMils: number;
  timeOfFlight: number;
}

/** The launch elevation (radians above the line of sight) that zeroes the rifle at `zeroRange`. */
export function zeroAngle(velocity: number, zeroRange: number, opts?: ShotOptions): number {
  if (zeroRange <= 0) return 0;
  let angle = 0;
  for (let i = 0; i < 6; i++) {
    const dir = { x: 0, y: Math.sin(angle), z: Math.cos(angle) };
    const hit = impactAt({ x: 0, y: 0, z: 0 }, dir, { x: 0, y: 0, z: 1 }, zeroRange, velocity, { x: 0, y: 0, z: 0 }, opts);
    angle += Math.atan2(-hit.pos.y, zeroRange);
  }
  return angle;
}

/**
 * The scope's range ladder: drop in metres and mils at each range, for a rifle zeroed at `zeroRange`
 * (default 100 m; 0 for a raw, unzeroed bore line). No wind.
 */
export function rangeLadder(velocity: number, ranges: readonly number[] = [100, 200, 300, 400], zeroRange = 100, opts?: ShotOptions): LadderRung[] {
  const angle = zeroAngle(velocity, zeroRange, opts);
  const dir = { x: 0, y: Math.sin(angle), z: Math.cos(angle) };
  return ranges.map((range) => {
    const hit = impactAt({ x: 0, y: 0, z: 0 }, dir, { x: 0, y: 0, z: 1 }, range, velocity, { x: 0, y: 0, z: 0 }, opts);
    const dropMeters = -hit.pos.y;
    return { range, dropMeters, dropMils: toMils(dropMeters, range), timeOfFlight: hit.t };
  });
}

export interface ShotSolution {
  /** Direction to fire in (normalised). */
  aimDir: Vec3;
  /** Holdover in mils: how far above the target to aim (positive = high). */
  holdoverMils: number;
  /** Windage in mils: how far to aim into the wind (positive = right of the target). */
  windageMils: number;
  /** Lead in mils for a moving target (positive = right of the target), included in `windageMils`' frame separately. */
  leadMils: number;
  timeOfFlight: number;
  distance: number;
  /** Where the round lands if fired along `aimDir` (should be on the target's predicted position). */
  predictedImpact: Vec3;
}

/**
 * Solves where to aim to hit a (possibly moving) target: iterates flight time, the target's predicted
 * position, then corrects the aim by the miss until it converges. Holdover, windage and lead are reported
 * in mils relative to the line of sight to the target's current position, as the HUD draws them.
 * Rifles here are treated as zeroed at `zeroRange` (default 100 m).
 */
export function solveShot(
  shooter: Vec3,
  target: Vec3,
  targetVelocity: Vec3,
  velocity: number,
  wind: Vec3,
  zeroRange = 100,
  opts?: ShotOptions,
): ShotSolution {
  const los = norm(sub(target, shooter));
  const distance = len(sub(target, shooter));
  // An orthonormal frame on the line of sight: right and up as the scope sees them.
  let right = norm(cross(los, { x: 0, y: 1, z: 0 }));
  if (len(cross(los, { x: 0, y: 1, z: 0 })) < 1e-6) right = { x: 1, y: 0, z: 0 };
  const up = cross(right, los);

  let tof = distance / velocity;
  let aim = los;
  let predicted = target;
  let impact = target;
  for (let i = 0; i < 8; i++) {
    predicted = add(target, scale(targetVelocity, tof));
    const predLos = norm(sub(predicted, shooter));
    const predDist = len(sub(predicted, shooter));
    const hit = impactAt(shooter, aim, predLos, predDist, velocity, wind, opts);
    impact = hit.pos;
    if (Number.isFinite(hit.t)) tof = hit.t;
    const miss = sub(predicted, impact);
    if (len(miss) < 0.002) break;
    aim = norm(add(aim, scale(miss, 1 / predDist)));
  }
  // Decompose the final aim into the scope frame relative to the line of sight to the target now.
  const aimLocal = { r: dot(aim, right), u: dot(aim, up), f: dot(aim, los) };
  const predLocal = norm(sub(predicted, shooter));
  const leadR = dot(predLocal, right);
  const leadU = dot(predLocal, up);
  const f = Math.max(1e-6, aimLocal.f);
  const zeroLift = zeroAngle(velocity, zeroRange, opts) * 1000;
  const leadMils = Math.atan2(leadR, dot(predLocal, los)) * 1000;
  const totalRight = Math.atan2(aimLocal.r, f) * 1000;
  const totalUp = Math.atan2(aimLocal.u, f) * 1000;
  return {
    aimDir: aim,
    holdoverMils: totalUp - Math.atan2(leadU, dot(predLocal, los)) * 1000 - zeroLift,
    windageMils: totalRight - leadMils,
    leadMils,
    timeOfFlight: tof,
    distance,
    predictedImpact: impact,
  };
}

/** Scope sway amplitude in degrees: the weapon's sway × the character's sway multiplier, steadied by Held Breath. */
export function swayAmplitude(weaponSway: number, swayMultiplier: number, heldBreathPercent = 0): number {
  return weaponSway * swayMultiplier * Math.max(0.05, 1 - heldBreathPercent / 100);
}
