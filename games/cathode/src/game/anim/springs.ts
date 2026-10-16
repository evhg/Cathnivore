// Hit flinches (docs/design/cathode-combat.md S4.1): every hit kicks a set of damped springs on the body, by
// zone, scaled by how much of the enemy's health the round took and by the archetype's poise. The springs are
// additive on top of locomotion: animate.ts rotates the hit chain about its pivot by each channel's angle.
// No three.js here, so the tests read the same numbers the game plays.

import { Spring1, type SpringSpec } from "../feel/spring";
import { tuning } from "../feel/tuning";

export type FlinchZone = "head" | "torso" | "armL" | "armR" | "legL" | "legR";

/** A direction in body space (x to the body's left, y up, z forward), unit length in the horizontal plane. */
export interface Dir {
  x: number;
  y: number;
  z: number;
}

/** Peak angles (radians) and offsets (metres) one hit asks for, before the springs shape them over time. */
export interface FlinchImpulse {
  /** Tip of the head about the neck, along the round's travel. */
  headTip: number;
  /** Head turned away from the side it was hit on (signed). */
  headYaw: number;
  /** The torso tipped about the pelvis along the round's travel. */
  torsoTip: number;
  /** The torso twisted about the spine, the hit side going with the round (signed). */
  twist: number;
  /** Both shoulders shrug up (metres). */
  shrug: number;
  /** An arm swung about its shoulder along the round. */
  armL: number;
  armR: number;
  /** The weapon's muzzle dropped (radians), held for a moment. */
  muzzleDrop: number;
  /** A knee buckled forward. */
  kneeL: number;
  kneeR: number;
  /** The pelvis drops (metres). */
  pelvisDrop: number;
  /** The whole body shoved along the round (metres, body space). */
  rootX: number;
  rootZ: number;
}

const DEG = Math.PI / 180;

const ZERO: FlinchImpulse = { headTip: 0, headYaw: 0, torsoTip: 0, twist: 0, shrug: 0, armL: 0, armR: 0, muzzleDrop: 0, kneeL: 0, kneeR: 0, pelvisDrop: 0, rootX: 0, rootZ: 0 };

/** S4.1's scale: clamp(damage / maxHp x 4, 0.4, 1.4) x the archetype's poise. */
export function flinchScale(damage: number, maxHp: number, poise = 1): number {
  const T = tuning.flinch;
  const k = Math.min(T.scaleMax, Math.max(T.scaleMin, (damage / Math.max(1, maxHp)) * 4));
  return k * poise;
}

/** The root push for a weapon (S4.1): pistol 0.15 m, rifle 0.25, a shotgun inside 6 m 0.45, the sniper x2.5. */
export function weaponPush(weaponCls: string, distance: number): number {
  const P = tuning.flinch.weaponPush;
  if (weaponCls === "shotgun") return distance < 6 ? P.shotgunClose : P.rifle;
  if (weaponCls === "sniper") return P.pistol * P.sniperMul;
  if (weaponCls === "rifle" || weaponCls === "smg" || weaponCls === "launcher") return P.rifle;
  return P.pistol;
}

/**
 * What one hit asks of the body. `dir` is the round's travel in body space; `side` is which side of the
 * segment's axis it struck (+1 the body's left, -1 its right); `scale` comes from flinchScale.
 */
export function flinchImpulse(zone: FlinchZone, dir: Dir, side: number, scale: number, weaponCls = "pistol", distance = 10): FlinchImpulse {
  const Z = tuning.flinch.zones;
  const out = { ...ZERO };
  const s = side >= 0 ? 1 : -1;
  // Going with the round: a hit from the front (dir.z < 0) tips the hit side back.
  const back = dir.z <= 0 ? 1 : -1;
  const push = (zonePush: number) => zonePush * (weaponPush(weaponCls, distance) / tuning.flinch.weaponPush.pistol) * scale;
  let root = 0;
  switch (zone) {
    case "head":
      out.headTip = Z.head.pitchDeg * DEG * scale;
      out.headYaw = -s * Z.head.yawDeg * DEG * scale;
      root = push(Z.head.pushM);
      break;
    case "torso":
      out.torsoTip = Z.torso.pitchDeg * DEG * scale;
      out.twist = s * back * Z.torso.twistDeg * DEG * scale;
      out.shrug = Math.sin(Z.torso.shrugDeg * DEG) * 0.22 * scale;
      // The head rides the chest, a little late: it nods with the hit.
      out.headTip = Z.torso.pitchDeg * 0.6 * DEG * scale;
      root = push(Z.torso.pushM);
      break;
    case "armL":
    case "armR":
      out[zone] = Z.arm.swingDeg * DEG * scale;
      out.muzzleDrop = Z.arm.muzzleDropDeg * DEG * Math.min(1, scale);
      out.twist = (zone === "armL" ? 1 : -1) * back * Z.arm.twistDeg * DEG * scale;
      root = push(Z.arm.pushM);
      break;
    case "legL":
    case "legR":
      out[zone === "legL" ? "kneeL" : "kneeR"] = Z.leg.kneeDeg * DEG * scale;
      out.pelvisDrop = Z.leg.pelvisDropM * scale;
      out.torsoTip = Z.leg.tipDeg * DEG * scale;
      root = push(Z.leg.pushM);
      break;
  }
  // The shove goes with the round and off to the side it struck: a hit square on from the front would
  // otherwise move the body only away from the camera, which the eye can't see (pillar 4: overstate).
  const L = tuning.flinch.lateral;
  const d = lateral(dir, s, L.root);
  out.rootX = d.x * root;
  out.rootZ = d.z * root;
  if (zone === "head") {
    // The body rides a headshot a little: a sympathetic tip of the torso.
    out.torsoTip = Z.torso.pitchDeg * L.headTorso * DEG * scale;
  }
  return out;
}

/** `dir` (horizontal) bent toward the struck side by `k` (0 = straight along the round), unit length. */
export function lateral(dir: Dir, side: number, k: number): Dir {
  const h = Math.hypot(dir.x, dir.z) || 1;
  const fx = dir.x / h;
  const fz = dir.z / h;
  // The perpendicular pointing to the struck side's opposite: a hit on the body's left pushes it right.
  const s = side >= 0 ? 1 : -1;
  const x = fx - fz * s * k * -1;
  const z = fz + fx * s * k * -1;
  const n = Math.hypot(x, z) || 1;
  return { x: x / n, y: 0, z: z / n };
}

/** The peak a spring reaches after a unit velocity kick from rest (so a kick of v peaks at v x this). */
export function peakPerKick(spec: SpringSpec): number {
  // Measured on the integrator the game runs (fixed 1/240 s steps), not the analytic curve, so the kick lands
  // exactly on the table's angle.
  const key = `${spec.freqHz}:${spec.zeta}`;
  const hit = peakCache.get(key);
  if (hit !== undefined) return hit;
  const s = new Spring1(spec);
  s.shove(1);
  let peak = 0;
  for (let i = 0; i < 480; i++) peak = Math.max(peak, s.update(1 / 240));
  peakCache.set(key, peak);
  return peak;
}
const peakCache = new Map<string, number>();

type Channel = keyof FlinchImpulse;
const CHANNELS = Object.keys(ZERO) as Channel[];
const ROOT: Channel[] = ["rootX", "rootZ"];

/** One body's flinch springs: kicked by hits, read by animate() every frame. */
export class Flinch {
  private springs = {} as Record<Channel, Spring1>;
  private kick = {} as Record<Channel, number>;
  /** The round's travel per chain (body space), so animate tips each chain the way it was pushed. */
  readonly headDir: Dir = { x: 0, y: 0, z: -1 };
  readonly torsoDir: Dir = { x: 0, y: 0, z: -1 };
  readonly armDirL: Dir = { x: 0, y: 0, z: -1 };
  readonly armDirR: Dir = { x: 0, y: 0, z: -1 };
  /** Seconds the muzzle stays dropped. */
  private dropT = 0;
  private dropAmt = 0;
  /** Hits taken (for tests and the stage hooks). */
  hits = 0;

  constructor() {
    const T = tuning.flinch;
    for (const c of CHANNELS) {
      const spec = ROOT.includes(c) ? T.rootSpring : T.spring;
      this.springs[c] = new Spring1(spec);
      this.kick[c] = 1 / peakPerKick(spec);
    }
  }

  /**
   * Adds a hit: each channel gets a velocity kick sized so it peaks at the impulse (S4.1). Chains tip along
   * the round, bent toward the far side from where it struck (`side`, +1 the body's left), so the motion
   * reads on screen even when the round comes straight from the camera.
   */
  hit(zone: FlinchZone, imp: FlinchImpulse, dir: Dir, side = 0): void {
    this.hits++;
    const L = tuning.flinch.lateral;
    const set = (d: Dir) => {
      const b = lateral(dir, side, zone === "head" ? L.head : L.chain);
      d.x = b.x;
      d.y = 0;
      d.z = b.z;
    };
    if (zone === "head" || zone === "torso") set(this.headDir);
    if (zone === "torso" || zone === "legL" || zone === "legR") set(this.torsoDir);
    if (zone === "armL") set(this.armDirL);
    if (zone === "armR") set(this.armDirR);
    for (const c of CHANNELS) {
      if (c === "muzzleDrop") continue;
      const v = imp[c];
      if (v !== 0) this.springs[c].shove(v * this.kick[c]);
    }
    if (imp.muzzleDrop > 0) {
      this.dropAmt = Math.max(this.dropAmt, imp.muzzleDrop);
      this.dropT = tuning.flinch.zones.arm.muzzleDropMs / 1000;
    }
  }

  update(dt: number): void {
    if (dt <= 0) return;
    this.dropT = Math.max(0, this.dropT - dt);
    if (this.dropT <= 0) this.dropAmt = 0;
    this.springs.muzzleDrop.target = this.dropAmt;
    const max = tuning.flinch.maxDeg * DEG;
    for (const c of CHANNELS) {
      const s = this.springs[c];
      s.update(dt);
      const lim = ROOT.includes(c) ? tuning.flinch.maxRootM : c === "shrug" || c === "pelvisDrop" ? 0.12 : max;
      if (Math.abs(s.x) > lim) {
        s.x = Math.sign(s.x) * lim;
        s.v *= 0.3;
      }
    }
  }

  /** A channel's value right now. */
  get(c: Channel): number {
    return this.springs[c].x;
  }

  /** Everything at rest (no flinch showing). */
  get still(): boolean {
    return CHANNELS.every((c) => Math.abs(this.springs[c].x) < 1e-4 && Math.abs(this.springs[c].v) < 1e-3);
  }

  reset(): void {
    for (const c of CHANNELS) {
      this.springs[c].x = this.springs[c].v = 0;
      this.springs[c].target = 0;
    }
    this.dropT = this.dropAmt = 0;
  }
}
