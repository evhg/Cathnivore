// Cath's health (docs/design/cathode-combat.md S6.1), pure: a Guard layer that comes back on its own and a
// Flesh layer that doesn't. Their total is the old single health pool, so BALANCE.md's difficulty holds.
//   Guard (cyan) 40%: regen starts 4.0 s after any hit (a 0-damage hit counts), fills in 2.0 s, ease-in-out.
//   Flesh (red)  60%: no regen, except the bleed floor (up to 25% of Flesh at 3%/s after 6 s), so nobody is
//                     stranded on 1 HP. Stims, takedowns, orbs and checkpoints restore it.
// Damage hits Guard first and the overflow carries into Flesh. The frame Guard breaks emits "guardBreak".

export const VITALS = {
  guardShare: 0.4,
  regenDelayS: 4.0,
  regenFillS: 2.0,
  bleedFloorShare: 0.25,
  bleedDelayS: 6,
  bleedPerS: 0.03,
} as const;

export type WoundTier = "fine" | "hurt" | "critical" | "bleeding";
export type VitalsEvent = "guardBreak" | "regenStart" | "guardFull";

export interface HitResult {
  guard: number;
  flesh: number;
  /** Guard went from something to nothing on this hit. */
  broke: boolean;
}

const smooth = (u: number) => {
  const x = Math.max(0, Math.min(1, u));
  return x * x * (3 - 2 * x);
};

/** The tier for a Flesh share 0..1 (S6.1's table). */
export function tierOf(fleshFrac: number): WoundTier {
  if (fleshFrac > 0.6) return "fine";
  if (fleshFrac >= 0.3) return "hurt";
  if (fleshFrac >= 0.1) return "critical";
  return "bleeding";
}

/** `w` (0..1) for a Flesh share: it drives the post and the audio (C7), continuous across the tier bounds. */
export function woundW(fleshFrac: number): number {
  const f = Math.max(0, Math.min(1, fleshFrac));
  if (f > 0.6) return 0;
  if (f >= 0.3) return ((0.6 - f) / 0.3) * 0.35;
  if (f >= 0.1) return 0.35 + ((0.3 - f) / 0.2) * 0.5;
  return 0.85 + ((0.1 - f) / 0.1) * 0.15;
}

/**
 * Where a source is relative to where she faces, in radians: 0 ahead, +π/2 on her right, ±π behind. The
 * camera looks along `fwd` (only x and z count), so a source at +X with the camera facing −Z is +π/2.
 */
export function bearing(fwd: { x: number; z: number }, from: { x: number; z: number }, src: { x: number; z: number }): number {
  const yaw = Math.atan2(-fwd.x, -fwd.z);
  let b = yaw - Math.atan2(-(src.x - from.x), -(src.z - from.z));
  while (b > Math.PI) b -= Math.PI * 2;
  while (b < -Math.PI) b += Math.PI * 2;
  return b;
}

export class Vitals {
  maxTotal = 1;
  guard = 0;
  flesh = 0;
  /** Seconds since the last hit (any hit). */
  sinceHit = 1e9;
  /** Guard regen: where it started, and how far in (s); -1 when not regenerating. */
  private regenFrom = 0;
  private regenT = -1;
  /** What happened since the last drain (the session turns these into sound and HUD). */
  readonly events: VitalsEvent[] = [];

  constructor(maxTotal = 100) {
    this.reset(maxTotal);
  }

  get maxGuard(): number {
    return this.maxTotal * VITALS.guardShare;
  }
  get maxFlesh(): number {
    return this.maxTotal - this.maxGuard;
  }
  get total(): number {
    return this.guard + this.flesh;
  }
  get fleshFrac(): number {
    return this.flesh / Math.max(1e-6, this.maxFlesh);
  }
  get guardFrac(): number {
    return this.guard / Math.max(1e-6, this.maxGuard);
  }
  get tier(): WoundTier {
    return tierOf(this.fleshFrac);
  }
  get w(): number {
    return woundW(this.fleshFrac);
  }
  get regenerating(): boolean {
    return this.regenT >= 0;
  }

  /** Full health at a new maximum. */
  reset(maxTotal: number): void {
    this.maxTotal = Math.max(1, maxTotal);
    this.guard = this.maxGuard;
    this.flesh = this.maxFlesh;
    this.sinceHit = 1e9;
    this.regenT = -1;
  }

  /** A new maximum (a level-up, a skill), keeping each layer's share. */
  setMax(maxTotal: number): void {
    const g = this.guardFrac;
    const f = this.fleshFrac;
    this.maxTotal = Math.max(1, maxTotal);
    this.guard = g * this.maxGuard;
    this.flesh = f * this.maxFlesh;
  }

  /** A hit of `amount` (0 still counts: it resets the regen delay). Guard first, the rest into Flesh. */
  damage(amount: number): HitResult {
    const a = Math.max(0, amount);
    const g0 = this.guard;
    const toGuard = Math.min(this.guard, a);
    this.guard -= toGuard;
    const toFlesh = Math.min(this.flesh, a - toGuard);
    this.flesh -= toFlesh;
    this.sinceHit = 0;
    this.regenT = -1;
    const broke = g0 > 0 && this.guard <= 1e-9;
    if (broke) {
      this.guard = 0;
      this.events.push("guardBreak");
    }
    return { guard: toGuard, flesh: toFlesh, broke };
  }

  /** Healing (stims, orbs, life steal, skills): into Flesh, never past its share. */
  heal(amount: number): void {
    this.flesh = Math.min(this.maxFlesh, this.flesh + Math.max(0, amount));
  }

  /** Healing as a share of max Flesh (a takedown's +15%, a Second Wind kill's +30%). */
  healShare(share: number): void {
    this.heal(this.maxFlesh * share);
  }

  /** Sets the total as one number (old callers and test hooks), Guard first. */
  setTotal(total: number): void {
    const t = Math.max(0, Math.min(this.maxTotal, total));
    this.flesh = Math.min(this.maxFlesh, t);
    this.guard = Math.max(0, t - this.flesh);
  }

  /** Steps the clocks; returns (and keeps in `events`) what happened this step. */
  update(dt: number): VitalsEvent[] {
    if (dt <= 0) return this.events;
    const before = this.sinceHit;
    this.sinceHit += dt;
    if (this.flesh <= 0) return this.events;
    if (this.regenT < 0 && this.guard < this.maxGuard - 1e-9 && before < VITALS.regenDelayS && this.sinceHit >= VITALS.regenDelayS) {
      this.regenT = this.sinceHit - VITALS.regenDelayS;
      this.regenFrom = this.guard;
      this.events.push("regenStart");
    } else if (this.regenT >= 0) this.regenT += dt;
    if (this.regenT >= 0) {
      const u = this.regenT / VITALS.regenFillS;
      this.guard = this.regenFrom + (this.maxGuard - this.regenFrom) * smooth(u);
      if (u >= 1) {
        this.guard = this.maxGuard;
        this.regenT = -1;
        this.events.push("guardFull");
      }
    }
    const floor = this.maxFlesh * VITALS.bleedFloorShare;
    if (this.sinceHit >= VITALS.bleedDelayS && this.flesh < floor) this.flesh = Math.min(floor, this.flesh + this.maxFlesh * VITALS.bleedPerS * dt);
    return this.events;
  }

  /** Empties the event list (the session reads it once a frame). */
  drain(): VitalsEvent[] {
    return this.events.splice(0);
  }
}
