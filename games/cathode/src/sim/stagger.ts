// C15 "Enemies that stagger" (docs/design/cathode-combat.md S4.2): the stagger meter. Damage fills it in
// proportion to the share of health a hit took, scaled by the archetype's poise; it holds for 0.6 s after a hit,
// then drains. At 0.35 (or on a head hit from a pistol-class weapon, unless the helmet's visor still stands) he
// staggers; at 0.8 (or from a close shotgun blast, an explosive, a heavy melee hit) he is knocked down. A stagger
// opens a takedown window and a guaranteed crit. Pure: the tests read the same numbers the game plays.

import { PISTOL_OR_HEAVIER } from "./armour";

export type StaggerDir = "front" | "back" | "left" | "right";
export type Reaction = "flinch" | "stagger" | "knockdown";

export const STAGGER = {
  /** Meter thresholds. */
  stagger: 0.35,
  knockdown: 0.8,
  /** Seconds after a hit before the meter drains, and how fast (per second). */
  holdS: 0.6,
  decayPerS: 0.35,
  /** Seconds before another stagger, or knockdown, can play. */
  staggerCdS: 1.2,
  knockdownCdS: 4,
  /** Durations (ms) of the stagger set (S4.2). */
  ms: { front: 600, back: 550, left: 500, right: 500 } as Record<StaggerDir, number>,
  /** The knockdown: the fall, on the ground, the get-up (ms). */
  knock: { fallMs: 450, downMs: 1500, upMs: 1150 },
  /** After a stagger, the next hit within this is a guaranteed crit. */
  critWindowMs: 1500,
  /** The visor breaking plays a head snap with the hands to the helmet. */
  visorSnapMs: 400,
  /** A shotgun knocks down inside this range when one blast does this share of max HP. */
  shotgunKnockM: 4,
  shotgunKnockShare: 0.25,
  /** How much of a plate's share of a round still rocks the man (the plate takes the blow, he still feels it). */
  plateShare: 0.5,
} as const;

/** S4.2 poise per archetype: the meter fills slower on heavier kits. */
export const POISE: Record<string, number> = {
  priceWar: 1.2,
  enforcer: 1.0,
  chrome: 0.7,
  riot: 0.6,
  cyberpsycho: 0.5,
  mech: 0.15,
};

export interface StaggerState {
  meter: number;
  /** Seconds since the last hit (the meter holds for 0.6 s). */
  sinceHit: number;
  /** Seconds left on each cooldown. */
  staggerCd: number;
  knockCd: number;
  /** Ms left of a guaranteed crit after a stagger. */
  critMs: number;
}

export function makeStagger(): StaggerState {
  return { meter: 0, sinceHit: 1e9, staggerCd: 0, knockCd: 0, critMs: 0 };
}

export interface StaggerHit {
  /** Damage that reached the man, and what a plate took for him. */
  damage: number;
  plateDamage?: number;
  maxHp: number;
  poise: number;
  zone: string;
  weaponCls: string;
  distance: number;
  /** A helmet whose visor still stands (it suppresses headshot staggers). */
  helmetUp?: boolean;
  explosive?: boolean;
  heavyMelee?: boolean;
  /** The round's travel against his facing, in body space (x to his left, z forward). */
  dir: { x: number; z: number };
  /** The vent or a broken visor forces a stagger whatever the meter says. */
  force?: boolean;
}

/** Which way a round staggers him: hit from the front he goes back ("front"), from behind forward ("back"). */
export function staggerDir(dir: { x: number; z: number }): StaggerDir {
  // The round's travel in body space: travelling toward -z means it came at his front.
  const ax = Math.abs(dir.x);
  const az = Math.abs(dir.z);
  if (az >= ax) return dir.z <= 0 ? "front" : "back";
  // Travelling to his left (+x) means it came from his right, and he staggers to his left.
  return dir.x > 0 ? "left" : "right";
}

/**
 * Adds a hit and says what it does: a flinch (always), a stagger or a knockdown. Mutates the state. The meter
 * grows by damage / max HP x poise (with half of what a plate took for him); a knockdown empties it.
 */
export function staggerHit(s: StaggerState, h: StaggerHit): { reaction: Reaction; dir: StaggerDir; crit: boolean } {
  const crit = s.critMs > 0;
  if (crit) s.critMs = 0;
  const share = (h.damage + (h.plateDamage ?? 0) * STAGGER.plateShare) / Math.max(1, h.maxHp);
  s.meter += share * h.poise;
  s.sinceHit = 0;
  const dir = staggerDir(h.dir);
  const knockByHit =
    (h.weaponCls === "shotgun" && h.distance <= STAGGER.shotgunKnockM && h.damage + (h.plateDamage ?? 0) >= STAGGER.shotgunKnockShare * h.maxHp) || !!h.explosive || !!h.heavyMelee;
  if (s.knockCd <= 0 && (s.meter >= STAGGER.knockdown || knockByHit) && h.poise > 0.2) {
    s.meter = 0;
    s.knockCd = STAGGER.knockdownCdS;
    s.staggerCd = STAGGER.staggerCdS;
    return { reaction: "knockdown", dir, crit };
  }
  const headStagger = h.zone === "head" && PISTOL_OR_HEAVIER.has(h.weaponCls) && !h.helmetUp;
  if (s.staggerCd <= 0 && (s.meter >= STAGGER.stagger || headStagger || h.force)) {
    s.staggerCd = STAGGER.staggerCdS;
    s.critMs = STAGGER.critWindowMs;
    return { reaction: "stagger", dir, crit };
  }
  return { reaction: "flinch", dir, crit };
}

/** Advances the clocks: the meter holds for 0.6 s after a hit, then drains at 0.35 a second. */
export function staggerTick(s: StaggerState, dt: number): void {
  s.sinceHit += dt;
  if (s.sinceHit > STAGGER.holdS) s.meter = Math.max(0, s.meter - STAGGER.decayPerS * Math.min(dt, s.sinceHit - STAGGER.holdS));
  s.staggerCd = Math.max(0, s.staggerCd - dt);
  s.knockCd = Math.max(0, s.knockCd - dt);
  s.critMs = Math.max(0, s.critMs - dt * 1000);
}

/** How long a reaction holds him (ms). */
export function reactionMs(r: Reaction, dir: StaggerDir): number {
  if (r === "stagger") return STAGGER.ms[dir];
  if (r === "knockdown") return STAGGER.knock.fallMs + STAGGER.knock.downMs + STAGGER.knock.upMs;
  return 0;
}
