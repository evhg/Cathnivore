// Laser grids (D4, the Board Tower): red curtains across a corridor that pulse on and off. Pure rules; the session
// draws the beams and applies the damage. A grid is a pair of level markers, `laser:<name>` = [a, b].

import * as THREE from "three";

export const LASER_PERIOD = 4;
export const LASER_ON = 2.4;
export const LASER_WARN = 0.5;
export const LASER_HEIGHT = 2.2;
export const LASER_DAMAGE = 14;
export const LASER_COOLDOWN = 0.9;
export const LASER_RADIUS = 0.35;

export interface Laser {
  a: THREE.Vector3;
  b: THREE.Vector3;
  phase: number;
}

/** 0 = off, 0..1 = warning flicker before it fires, 1 = live. */
export function laserState(t: number, phase: number): { live: boolean; warn: boolean } {
  const c = (((t + phase) % LASER_PERIOD) + LASER_PERIOD) % LASER_PERIOD;
  return { live: c < LASER_ON, warn: c >= LASER_PERIOD - LASER_WARN };
}

/** Does a player standing at `p` (feet) touch the curtain between a and b? */
export function laserTouches(l: Laser, p: THREE.Vector3): boolean {
  const y0 = Math.min(l.a.y, l.b.y);
  if (p.y > y0 + LASER_HEIGHT || p.y + 1.7 < y0) return false;
  const abx = l.b.x - l.a.x;
  const abz = l.b.z - l.a.z;
  const len2 = abx * abx + abz * abz || 1;
  const k = Math.max(0, Math.min(1, ((p.x - l.a.x) * abx + (p.z - l.a.z) * abz) / len2));
  return Math.hypot(p.x - (l.a.x + abx * k), p.z - (l.a.z + abz * k)) < LASER_RADIUS;
}

/** Build grids from level markers; alternating phases so a corridor can always be timed. */
export function lasersFrom(markers: Record<string, THREE.Vector3[]>): Laser[] {
  const out: Laser[] = [];
  for (const [key, pts] of Object.entries(markers)) {
    if (!key.startsWith("laser:") || pts.length < 2) continue;
    out.push({ a: pts[0]!, b: pts[1]!, phase: (out.length % 2) * (LASER_PERIOD / 2) });
  }
  return out;
}
