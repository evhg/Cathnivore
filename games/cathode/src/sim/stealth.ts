// CATHODE's stealth rules (design bible 4.5): every enemy has a vision cone, a detection meter and ears.
//
// Sight: while Cath is inside an enemy's cone and line of sight, its meter fills at
//   rate = BASE_FILL × distance × angle × light × stance × motion × Cath's detection multiplier × alarm
// per second, and drains when she isn't seen. Crossing SUSPICIOUS_AT makes the enemy suspicious (it
// investigates); a full meter means combat. Outside the cone or behind cover nothing fills.
// Hearing: a noise event (a shot, a footstep, a body dropping) is heard within its radius, cut by
// suppressors and subsonic rounds, and masked entirely for quiet noises by thunder, a train or a neon hum.
// Awareness states decay: combat → searching after LOSE_COMBAT_AFTER s without sight, searching →
// suspicious after SEARCH_TIME s, suspicious → unaware after SUSPICION_TIME s once the meter has drained.
// Every function here is pure: it takes a state and returns the next one.

import type { Vec3 } from "./types";
import { clamp } from "./types";

export type Awareness = "unaware" | "suspicious" | "searching" | "combat";
export const AWARENESS_ORDER: readonly Awareness[] = ["unaware", "suspicious", "searching", "combat"];
export type Stance = "stand" | "crouch" | "prone" | "slide";

/** Meter fill per second at point-blank, dead centre, full light, standing still. */
export const BASE_FILL = 1.6;
/** The meter level at which an enemy turns suspicious. */
export const SUSPICIOUS_AT = 0.35;
/** Meter drain per second when Cath isn't seen. */
export const DRAIN = 0.12;
/** Seconds of no sight before combat drops to searching. */
export const LOSE_COMBAT_AFTER = 5;
/** Seconds searching lasts without a new stimulus. */
export const SEARCH_TIME = 20;
/** Seconds suspicion lasts once the meter has drained below the threshold. */
export const SUSPICION_TIME = 6;
/** Within this distance and inside the cone, an enemy sees Cath instantly. */
export const POINT_BLANK = 1.5;
export const STANCE_FACTOR: Record<Stance, number> = { stand: 1, crouch: 0.55, prone: 0.3, slide: 0.8 };

export interface AwarenessState {
  state: Awareness;
  /** Detection meter, 0..1. */
  meter: number;
  /** Seconds since the last stimulus (sight or sound). */
  sinceStimulus: number;
  /** Where the enemy last saw or heard something. */
  lastKnown?: Vec3;
}

export const UNAWARE: AwarenessState = Object.freeze({ state: "unaware", meter: 0, sinceStimulus: 0 }) as AwarenessState;

/** What one enemy perceives of Cath this frame. The game layer fills it from positions and raycasts. */
export interface Observation {
  /** Metres from the enemy's eyes to Cath. */
  distance: number;
  /** Degrees between the enemy's facing and the direction to Cath. */
  angle: number;
  /** The enemy's full vision cone in degrees (e.g. 110). */
  visionCone: number;
  /** The enemy's sight range in metres. */
  visionRange: number;
  /** Nothing solid between the enemy's eyes and Cath. */
  lineOfSight: boolean;
  /** Light level on Cath, 0 (pitch dark) to 1 (under a street lamp). */
  light: number;
  stance: Stance;
  /** Cath's speed in m/s (0 still, 2 walk, 4.5 run, 7 sprint). */
  speed: number;
  /** Cath's `DerivedStats.detectionMultiplier` (Nerve and stealth gear), and any skill effect such as Optic Camo. */
  detectionMultiplier: number;
  /** The area's alarm level (0..3): each level makes enemies 25% sharper. */
  alarm?: number;
  /** Cath's position, remembered as `lastKnown`. */
  position?: Vec3;
}

/** True when Cath is inside the cone, in range and in line of sight. */
export function inVision(obs: Observation): boolean {
  return obs.lineOfSight && obs.distance <= obs.visionRange && Math.abs(obs.angle) <= obs.visionCone / 2;
}

/** The meter fill per second this observation causes (0 when Cath can't be seen). */
export function detectionRate(obs: Observation): number {
  if (!inVision(obs)) return 0;
  // Distance: full rate within 3 m, fading to nothing at the edge of sight.
  const d = clamp((obs.visionRange - obs.distance) / Math.max(1, obs.visionRange - 3), 0, 1);
  const distanceFactor = Math.pow(d, 1.2);
  // Angle: the centre of the cone sees twice as fast as its edge.
  const angleFactor = 1 - 0.5 * clamp(Math.abs(obs.angle) / (obs.visionCone / 2), 0, 1);
  // Light: darkness cuts detection to 15%.
  const lightFactor = 0.15 + 0.85 * clamp(obs.light, 0, 1);
  const stanceFactor = STANCE_FACTOR[obs.stance];
  // Motion: still is 60%, a run is 130%, a sprint about 165%.
  const motionFactor = 0.6 + 0.15 * clamp(obs.speed, 0, 7);
  const alarmFactor = 1 + 0.25 * clamp(obs.alarm ?? 0, 0, 3);
  return BASE_FILL * distanceFactor * angleFactor * lightFactor * stanceFactor * motionFactor * obs.detectionMultiplier * alarmFactor;
}

/** Steps one enemy's awareness by `dt` seconds of an observation. */
export function stepDetection(enemy: AwarenessState, obs: Observation, dt: number): AwarenessState {
  const seen = inVision(obs);
  let meter = enemy.meter;
  let state = enemy.state;
  let since = enemy.sinceStimulus + dt;
  let lastKnown = enemy.lastKnown;

  if (seen && obs.distance <= POINT_BLANK) {
    meter = 1;
  } else if (seen) {
    meter = Math.min(1, meter + detectionRate(obs) * dt);
  } else {
    meter = Math.max(0, meter - DRAIN * dt);
  }

  if (seen && detectionRate(obs) > 0) {
    since = 0;
    if (obs.position) lastKnown = obs.position;
  }

  if (meter >= 1 && seen) {
    state = "combat";
    since = 0;
  } else if (state === "combat") {
    if (since >= LOSE_COMBAT_AFTER) {
      state = "searching";
      since = 0;
      meter = Math.min(meter, 0.99);
    }
  } else if (state === "searching") {
    if (since >= SEARCH_TIME) {
      state = "suspicious";
      since = 0;
    }
  } else if (meter >= SUSPICIOUS_AT) {
    state = state === "unaware" ? "suspicious" : state;
  } else if (state === "suspicious" && since >= SUSPICION_TIME) {
    state = "unaware";
  }

  return { state, meter, sinceStimulus: since, ...(lastKnown ? { lastKnown } : {}) };
}

// ---------------------------------------------------------------------------------------------------------
// Hearing
// ---------------------------------------------------------------------------------------------------------

export type NoiseKind = "gunshot" | "explosion" | "footstep" | "impact" | "body" | "voice" | "takedown";

export interface NoiseEvent {
  kind: NoiseKind;
  position: Vec3;
  /** Radius in metres it carries to (a weapon's `noise`, a footstep's 4–12 m...). */
  radius: number;
  /** Fired through a suppressor: radius ×0.25. */
  suppressed?: boolean;
  /** Subsonic rounds: radius ×0.4 on top. */
  subsonic?: boolean;
  /** Cath's `noiseMultiplier` (or `footstepNoiseMultiplier` for steps). */
  multiplier?: number;
}

/** A loud ambient sound that hides quiet ones: thunder, a passing train, a neon sign's hum. */
export interface MaskingEvent {
  kind: "thunder" | "train" | "neonHum" | "music" | "rain";
  position: Vec3;
  /** Metres around it that are masked. */
  radius: number;
  /** Noises with an effective radius up to this many metres are masked completely. */
  strength: number;
}

export interface Listener {
  position: Vec3;
  /** Hearing multiplier (1 = average; drones 0.5, a sentry turret 0). */
  hearing: number;
}

const dist = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** The radius a noise really carries, before masking. */
export function effectiveNoiseRadius(noise: NoiseEvent): number {
  let r = noise.radius * (noise.multiplier ?? 1);
  if (noise.suppressed) r *= 0.25;
  if (noise.subsonic) r *= 0.4;
  return r;
}

/** True when a mask hides this noise from this listener (the mask covers the noise or the listener). */
export function isMasked(noise: NoiseEvent, listener: Listener, masks: readonly MaskingEvent[]): boolean {
  const r = effectiveNoiseRadius(noise);
  return masks.some(
    (m) => r <= m.strength && (dist(m.position, noise.position) <= m.radius || dist(m.position, listener.position) <= m.radius),
  );
}

/** True when the listener hears the noise. */
export function hears(noise: NoiseEvent, listener: Listener, masks: readonly MaskingEvent[] = []): boolean {
  if (listener.hearing <= 0) return false;
  if (isMasked(noise, listener, masks)) return false;
  return dist(noise.position, listener.position) <= effectiveNoiseRadius(noise) * listener.hearing;
}

/**
 * Feeds a noise to one enemy. Gunshots and explosions send it searching toward the noise; footsteps,
 * impacts, voices and takedowns make it suspicious; a body dropping makes it search. Combat is unchanged
 * (it already knows). Returns the new state and whether it heard anything.
 */
export function hearNoise(
  enemy: AwarenessState,
  noise: NoiseEvent,
  listener: Listener,
  masks: readonly MaskingEvent[] = [],
): { state: AwarenessState; heard: boolean } {
  if (!hears(noise, listener, masks)) return { state: enemy, heard: false };
  if (enemy.state === "combat") return { state: { ...enemy, lastKnown: noise.position, sinceStimulus: 0 }, heard: true };
  const alarming = noise.kind === "gunshot" || noise.kind === "explosion" || noise.kind === "body";
  const next: Awareness = alarming ? "searching" : enemy.state === "unaware" ? "suspicious" : enemy.state;
  return {
    state: {
      state: next,
      meter: Math.max(enemy.meter, alarming ? 0.6 : SUSPICIOUS_AT),
      sinceStimulus: 0,
      lastKnown: noise.position,
    },
    heard: true,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Area alarm
// ---------------------------------------------------------------------------------------------------------

export interface AreaAlarm {
  /** 0 quiet, 1 wary (a noise or a missing guard), 2 alert (a body found), 3 lockdown (several bodies or combat). */
  level: number;
  bodiesFound: number;
  /** Seconds since the last alarm event. */
  sinceEvent: number;
  /** True once any enemy in the area has seen Cath (no "Ghost" bonus). */
  seen: boolean;
}

export const QUIET_AREA: AreaAlarm = Object.freeze({ level: 0, bodiesFound: 0, sinceEvent: 0, seen: false }) as AreaAlarm;
/** Seconds without events before the alarm drops a level (never below 1 once a body has been found). */
export const ALARM_COOLDOWN = 120;

export type AlarmCause = "noise" | "body" | "combat" | "camera";

/** Raises an area's alarm for an event. Bodies stack: the second one found means lockdown. */
export function raiseAlarm(area: AreaAlarm, cause: AlarmCause): AreaAlarm {
  const bodies = area.bodiesFound + (cause === "body" ? 1 : 0);
  let level = area.level;
  if (cause === "noise" || cause === "camera") level = Math.max(level, 1);
  if (cause === "body") level = Math.max(level, bodies >= 2 ? 3 : 2);
  if (cause === "combat") level = 3;
  return { level, bodiesFound: bodies, sinceEvent: 0, seen: area.seen || cause === "combat" || cause === "camera" };
}

/** Lets an area calm down over time. */
export function stepAlarm(area: AreaAlarm, dt: number): AreaAlarm {
  const since = area.sinceEvent + dt;
  if (since < ALARM_COOLDOWN || area.level === 0) return { ...area, sinceEvent: since };
  const floor = area.bodiesFound > 0 ? 1 : 0;
  return { ...area, level: Math.max(floor, area.level - 1), sinceEvent: 0 };
}

/** Patrol and reinforcement multipliers for an alarm level. */
export function alarmEffects(level: number): { patrols: number; reinforcements: number } {
  const l = clamp(Math.round(level), 0, 3);
  return { patrols: [1, 1.25, 1.5, 2][l] ?? 1, reinforcements: [0, 0, 2, 4][l] ?? 0 };
}
