// C11 "Takedowns" (docs/design/cathode-combat.md S5.1, S5.2): who can be taken down, which of the eleven paired
// sequences plays, where Cath is pulled to for it, and what it drops. Pure: plain numbers in, plain numbers out,
// so the tests read exactly the rules the game plays.
//
// Eligibility: an unaware or suspicious enemy approached within 70 degrees of his back; anyone staggered, knocked
// down, crawling or surrendered; anyone under 20% health. Within 2.5 m (Cat's Cradle's wire: 3 m), and she has to be
// looking at him. Machines never; a cyberpsycho only while staggered (the "counter").
//
// The variant comes from the approach (behind, front, side, down, surrendered), the gun in her hand and a wall
// nearby, seeded, and never one of the last two played when another fits.

export type TakedownApproach = "behind" | "front" | "side" | "down" | "surrender";

export interface TakedownTargetState {
  /** The awareness state ("dead" is never eligible). */
  state: "unaware" | "suspicious" | "searching" | "combat" | "dead";
  /** Health left, 0..1. */
  hpFrac: number;
  /** Ground distance from Cath to him (m). */
  dist: number;
  /** Angle (rad) between his back (the way he faces, reversed) and the way from him to Cath: 0 is right behind him. */
  fromBack: number;
  /** Angle (rad) between Cath's view and the way to him. */
  viewOff: number;
  machine?: boolean;
  cyberpsycho?: boolean;
  staggered?: boolean;
  knockedDown?: boolean;
  crawling?: boolean;
  surrendered?: boolean;
}

export const TAKEDOWN = {
  /** S5.1 range (m), and the garrotte's. */
  rangeM: 2.5,
  wireRangeM: 3,
  /** Within this of his back counts as "approached from behind". */
  backDeg: 70,
  /** Below this share of health anyone can be taken down. */
  lowHp: 0.2,
  /** She must be looking within this of him. */
  viewDeg: 55,
  /** Approach bands for the variant (degrees off his back): behind, side, front. */
  behindDeg: 60,
  frontDeg: 120,
  /** The magnet (S5.1): 120 to 300 ms to the sync point, longer the further it is. */
  magnetMs: { min: 120, max: 300, perM: 110 },
  /** Cath's body radius for the sync point's collision check (m). */
  bodyR: 0.3,
  /** The sequence's noise radius (S5.2: 2 m, so the next guard over doesn't hear it). */
  noiseM: 2,
  /** S5.2 reward: health orbs worth 8% of max health each, one Guard orb; magnetised after 400 ms within 4 m. */
  orb: { healShare: 0.08, guardShare: 0.12, pullAfterMs: 400, pullM: 4, speed: 7, collectM: 0.45 },
  /** Surrendered: hold the key this long to knock him out. */
  holdKoMs: 600,
  /** The base sequence's world time (everyone but Cath and the target), and the first takedown's. */
  worldScale: 0.4,
  firstScale: 0.3,
} as const;

const DEG = Math.PI / 180;

export type TakedownWhy = "ok" | "dead" | "machine" | "range" | "view" | "aware" | "cyberpsycho";

/** S5.1: can she take him down right now, and from which approach. */
export function takedownEligible(t: TakedownTargetState, wire = false): { ok: boolean; why: TakedownWhy; approach: TakedownApproach } {
  const approach = approachFor(t);
  const no = (why: TakedownWhy) => ({ ok: false, why, approach });
  if (t.state === "dead") return no("dead");
  if (t.machine) return no("machine");
  if (t.dist > (wire ? TAKEDOWN.wireRangeM : TAKEDOWN.rangeM)) return no("range");
  if (t.viewOff > TAKEDOWN.viewDeg * DEG) return no("view");
  if (t.cyberpsycho) return t.staggered ? { ok: true, why: "ok", approach: "front" } : no("cyberpsycho");
  const special = !!(t.staggered || t.knockedDown || t.crawling || t.surrendered);
  const sneak = (t.state === "unaware" || t.state === "suspicious") && t.fromBack <= TAKEDOWN.backDeg * DEG;
  if (special || sneak || t.hpFrac < TAKEDOWN.lowHp) return { ok: true, why: "ok", approach };
  return no("aware");
}

/** Which way she comes at him (S5.2's variant groups). */
export function approachFor(t: Pick<TakedownTargetState, "fromBack" | "knockedDown" | "crawling" | "surrendered">): TakedownApproach {
  if (t.surrendered) return "surrender";
  if (t.knockedDown || t.crawling) return "down";
  if (t.fromBack <= TAKEDOWN.behindDeg * DEG) return "behind";
  if (t.fromBack >= TAKEDOWN.frontDeg * DEG) return "front";
  return "side";
}

export type TakedownVariantId =
  | "behindWrap"
  | "behindChoke"
  | "behindPistol"
  | "frontCollar"
  | "frontKick"
  | "frontBaton"
  | "sideKnee"
  | "sideSweep"
  | "sideWall"
  | "downStrike"
  | "surrender";

export interface TakedownVariant {
  id: TakedownVariantId;
  approach: TakedownApproach;
  /** "pistol": only with a pistol in hand (the finisher is a shot); "any": the Pin or her hands. */
  weapon: "pistol" | "any";
  /** Needs a wall within 1.5 m on his far side. */
  wall?: boolean;
  /** The whole sequence (ms): input is locked for it. */
  durMs: number;
  /** Where she is pulled to: metres from his pelvis, toward the approach. */
  syncM: number;
  /** The blows (ms): the hit-stop, the thud, the camera kick. The first one is lethal. */
  impacts: number[];
  /** "blunt" (baton, elbow, knee, boot), "shot" (the Kestrel, suppressed), "choke" (the squeeze). */
  kind: "blunt" | "shot" | "choke";
  /** When she lets go and the camera starts back (ms). */
  releaseMs: number;
  /** Non-lethal (the choke, a knock-out). */
  nonLethal?: boolean;
  /** S5.2's one-line description, for the feed and the docs. */
  label: string;
}

/** S5.2's table: three per approach, one for a man on the floor, one for a man with his hands up. */
export const TAKEDOWN_VARIANTS: readonly TakedownVariant[] = [
  { id: "behindWrap", approach: "behind", weapon: "any", durMs: 1200, syncM: 0.78, impacts: [420], kind: "blunt", releaseMs: 900, label: "Neck wrap and baton" },
  { id: "behindChoke", approach: "behind", weapon: "any", durMs: 1250, syncM: 0.75, impacts: [900], kind: "choke", releaseMs: 950, nonLethal: true, label: "Choke-down" },
  { id: "behindPistol", approach: "behind", weapon: "pistol", durMs: 1200, syncM: 0.78, impacts: [650], kind: "shot", releaseMs: 900, label: "Shot under the jaw" },
  { id: "frontCollar", approach: "front", weapon: "pistol", durMs: 1200, syncM: 0.8, impacts: [650, 300], kind: "shot", releaseMs: 900, label: "Collar grab" },
  { id: "frontKick", approach: "front", weapon: "pistol", durMs: 1150, syncM: 0.85, impacts: [700, 820], kind: "shot", releaseMs: 900, label: "Chest kick" },
  { id: "frontBaton", approach: "front", weapon: "any", durMs: 1150, syncM: 0.85, impacts: [600, 250], kind: "blunt", releaseMs: 880, label: "Baton combo" },
  { id: "sideKnee", approach: "side", weapon: "any", durMs: 1150, syncM: 0.8, impacts: [600, 250], kind: "blunt", releaseMs: 880, label: "Knee then elbow" },
  { id: "sideSweep", approach: "side", weapon: "any", durMs: 1200, syncM: 0.85, impacts: [720, 300], kind: "blunt", releaseMs: 920, label: "Sweep and stomp" },
  { id: "sideWall", approach: "side", weapon: "any", wall: true, durMs: 1150, syncM: 0.8, impacts: [420], kind: "blunt", releaseMs: 880, label: "Into the wall" },
  { id: "downStrike", approach: "down", weapon: "any", durMs: 950, syncM: 0.8, impacts: [380], kind: "blunt", releaseMs: 700, label: "Downstrike" },
  { id: "surrender", approach: "surrender", weapon: "any", durMs: 1000, syncM: 0.8, impacts: [520], kind: "blunt", releaseMs: 760, nonLethal: true, label: "Knock-out" },
];

export function variantById(id: TakedownVariantId): TakedownVariant {
  return TAKEDOWN_VARIANTS.find((v) => v.id === id)!;
}

/** The lethal blow (the first in `impacts`), and every blow in time order. */
export function lethalMs(v: TakedownVariant): number {
  return v.impacts[0]!;
}
export function blowsInOrder(v: TakedownVariant): number[] {
  return [...v.impacts].sort((a, b) => a - b);
}

function hash(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * S5.2: the variant for this approach, weapon and street, seeded, never one of the last two played when another
 * fits. A wall variant without a wall falls back to the approach's first ("Side C falls back to A").
 */
export function pickTakedownVariant(o: { approach: TakedownApproach; pistol: boolean; wall: boolean; seed: number; recent?: readonly TakedownVariantId[]; first?: boolean }): TakedownVariant {
  if (o.first) return variantById("behindWrap");
  const fits = TAKEDOWN_VARIANTS.filter((v) => v.approach === o.approach && (v.weapon === "any" || o.pistol) && (!v.wall || o.wall));
  const last2 = (o.recent ?? []).slice(-2);
  const fresh = fits.filter((v) => !last2.includes(v.id));
  const pool = fresh.length ? fresh : fits;
  if (!pool.length) return variantById("behindWrap");
  return pool[Math.floor(hash(o.seed) * pool.length) % pool.length]!;
}

/** A collider's footprint on the street (m), for the sync point's check. */
export interface Rect {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

function blocked(x: number, z: number, r: number, rects: readonly Rect[]): boolean {
  for (const b of rects) {
    const cx = Math.max(b.minX, Math.min(x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
    if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return true;
  }
  return false;
}

/**
 * S5.1's magnet target: `syncM` from his pelvis along `dir` (a unit vector from him toward where she stands), clear
 * of every collider by her body's radius. Blocked, it swings round him (15 degree steps either way, up to 90) and
 * then comes in to 0.6 m; nothing clear, she stays where she is (`fallback`).
 */
export function syncPoint(target: { x: number; z: number }, dir: { x: number; z: number }, syncM: number, rects: readonly Rect[], from: { x: number; z: number }): { x: number; z: number; fallback: boolean } {
  const r = TAKEDOWN.bodyR;
  const len = Math.hypot(dir.x, dir.z) || 1;
  const a0 = Math.atan2(dir.x / len, dir.z / len);
  for (const d of [syncM, Math.max(0.6, syncM - 0.15), 0.6])
    for (let k = 0; k <= 12; k++) {
      const a = a0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 15 * DEG;
      const x = target.x + Math.sin(a) * d;
      const z = target.z + Math.cos(a) * d;
      if (!blocked(x, z, r, rects)) return { x, z, fallback: false };
    }
  return { x: from.x, z: from.z, fallback: true };
}

/** How long the magnet takes to pull her `d` metres (S5.1: 120 to 300 ms). */
export function magnetMs(d: number): number {
  const M = TAKEDOWN.magnetMs;
  return Math.max(M.min, Math.min(M.max, M.min + Math.max(0, d) * M.perM));
}

export type OrbKind = "health" | "guard" | "ammo";
export interface OrbDrop {
  kind: OrbKind;
  /** Health or Guard restored, in HP; ammo orbs carry rounds as a share of a magazine. */
  amount: number;
}

/**
 * S5.2's reward: one or two red health orbs (8% of max health each, into Flesh), one cyan Guard orb, and ammo when
 * the finisher was a shot. Seeded, so the same takedown drops the same orbs.
 */
export function takedownRewards(v: TakedownVariant, maxHp: number, seed: number): OrbDrop[] {
  const O = TAKEDOWN.orb;
  const n = hash(seed * 1.7 + 0.3) < 0.5 ? 1 : 2;
  const out: OrbDrop[] = [];
  for (let i = 0; i < n; i++) out.push({ kind: "health", amount: Math.round(maxHp * O.healShare) });
  out.push({ kind: "guard", amount: Math.round(maxHp * O.guardShare) });
  if (v.kind === "shot") out.push({ kind: "ammo", amount: 0.5 });
  return out;
}

/** An orb's pull toward Cath (m/s) at `ageMs` and `dist` metres: nothing before 400 ms or beyond 4 m. */
export function orbPull(ageMs: number, dist: number): number {
  const O = TAKEDOWN.orb;
  if (ageMs < O.pullAfterMs || dist > O.pullM) return 0;
  return O.speed * (0.5 + 0.5 * (1 - dist / O.pullM));
}

/** Surrendered: has she held the key long enough to knock him out. */
export function holdKnocksOut(heldMs: number): boolean {
  return heldMs >= TAKEDOWN.holdKoMs;
}
