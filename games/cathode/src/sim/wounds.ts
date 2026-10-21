// C15 "Enemies that stagger" (docs/design/cathode-combat.md S4.2, "Wounded behaviour"): what a man carries after the
// hits that didn't put him down. Each limb keeps the damage it took; a leg past 40% of its share limps (the injured
// stance shortened to 35% of the cycle, the hip dropping 4 cm, speed x0.6), an arm past it goes one-handed (accuracy
// x0.7), and below 25% health he hunches 10 degrees with a hand pressed to his worst wound, breathing at 0.6 Hz. A
// knockdown below 10% health can turn into a crawl (25% for Enforcers, every Price-War Boy can). Pure: no three.js,
// so the tests read the same numbers the game plays.

export type Limb = "armL" | "armR" | "legL" | "legR";
export type WoundZone = Limb | "torso" | "head";

export const WOUNDS = {
  /** A limb's share of max HP: its "health" for the wounded thresholds. */
  limbShare: 0.3,
  /** A limb is hurt at this share of its health taken. */
  hurtAt: 0.4,
  /** S4.2's limp: the injured stance's share of the gait cycle, the hip drop (m), the speed multiplier. */
  limpStance: 0.35,
  limpHipDropM: 0.04,
  limpSpeed: 0.6,
  /** S4.2's one-handed pose. */
  oneHandAccuracy: 0.7,
  /** S4.2's hunch: below this share of health, the pitch (deg) and the breathing bob (Hz, m). */
  hunchBelow: 0.25,
  hunchDeg: 10,
  breathHz: 0.6,
  breathM: 0.014,
  /** A floor blood trail every this many metres below the hunch line. */
  trailM: 1.2,
  /** S4.2's crawl: below this share of health a knockdown may become one. */
  crawl: { below: 0.1, chance: 0.25, speed: 0.4, maxS: 6, accuracy: 0.25, smearM: 0.35 },
} as const;

export interface Wounds {
  /** Damage each zone has taken. */
  dmg: Record<WoundZone, number>;
}

export function makeWounds(): Wounds {
  return { dmg: { armL: 0, armR: 0, legL: 0, legR: 0, torso: 0, head: 0 } };
}

export function resetWounds(w: Wounds): void {
  for (const k of Object.keys(w.dmg) as WoundZone[]) w.dmg[k] = 0;
}

/** A hit of `damage` (what reached the man) on `zone`. */
export function woundHit(w: Wounds, zone: WoundZone, damage: number): void {
  if (damage > 0) w.dmg[zone] += damage;
}

/** True once a limb has taken 40% of its share of `maxHp`. */
export function limbHurt(w: Wounds, limb: Limb, maxHp: number): boolean {
  return w.dmg[limb] >= WOUNDS.limbShare * WOUNDS.hurtAt * Math.max(1, maxHp);
}

export interface WoundState {
  /** The limping leg (the worse one), or null. */
  limp: "L" | "R" | null;
  /** The arm that hangs (the worse one), or null. */
  oneArm: "L" | "R" | null;
  /** Below 25% health: the hunch. */
  hunch: boolean;
  /** Where the clutching hand goes: the zone that has taken the most. */
  worst: WoundZone | null;
  speedMul: number;
  accuracyMul: number;
}

/** What his wounds make of him at `hp` of `maxHp`. */
export function woundState(w: Wounds, hp: number, maxHp: number): WoundState {
  const d = w.dmg;
  const legL = limbHurt(w, "legL", maxHp);
  const legR = limbHurt(w, "legR", maxHp);
  const armL = limbHurt(w, "armL", maxHp);
  const armR = limbHurt(w, "armR", maxHp);
  const limp = legL || legR ? (legL && legR ? (d.legL >= d.legR ? "L" : "R") : legL ? "L" : "R") : null;
  const oneArm = armL || armR ? (armL && armR ? (d.armL >= d.armR ? "L" : "R") : armL ? "L" : "R") : null;
  let worst: WoundZone | null = null;
  for (const k of Object.keys(d) as WoundZone[]) if (d[k] > 0 && (!worst || d[k] > d[worst])) worst = k;
  return {
    limp,
    oneArm,
    hunch: hp > 0 && hp < maxHp * WOUNDS.hunchBelow,
    worst,
    speedMul: limp ? WOUNDS.limpSpeed : 1,
    accuracyMul: oneArm ? WOUNDS.oneHandAccuracy : 1,
  };
}

/**
 * Whether a knockdown becomes a crawl (S4.2): below 10% health, an Enforcer 25% of the time (`roll` uniform 0..1),
 * a Price-War Boy always. Machines and the dead never crawl.
 */
export function crawlRoll(hp: number, maxHp: number, kind: "enforcer" | "priceWar" | "machine", roll: number): boolean {
  if (kind === "machine" || hp <= 0 || hp >= maxHp * WOUNDS.crawl.below) return false;
  return kind === "priceWar" || roll < WOUNDS.crawl.chance;
}

/**
 * The limp's gait clock (S4.2): a phase warp so the injured leg's stance (its phase in pi..2pi, when its foot is
 * down) takes `limpStance` of the cycle instead of half. `phase` is the plain gait phase (rad); `injuredOffset` is
 * the injured leg's offset in it (0 for the left, pi for the right). Returns the warped phase for the left leg.
 */
export function limpPhase(phase: number, injuredOffset: number, k = 1): number {
  const TAU = Math.PI * 2;
  const u = ((((phase + injuredOffset) % TAU) + TAU) % TAU) / TAU;
  const s = 0.5 + (WOUNDS.limpStance - 0.5) * k;
  // The injured leg swings for 1 - s of the cycle and stands for s.
  const w = u < 1 - s ? (u / (1 - s)) * Math.PI : Math.PI + ((u - (1 - s)) / s) * Math.PI;
  return w - injuredOffset;
}
