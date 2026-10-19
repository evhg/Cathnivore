// C9 "Deaths that land" (docs/design/cathode-combat.md S4.4). A kill is a powered fall that blends into a
// ragdoll: on the lethal frame the body keeps the velocity it was animated with, takes the round's impulse, and
// for the variant's active phase each joint is pulled toward a dying pose (gut clutch, spin fall, wall slump, knees
// then face, over the rail, crawl-out) with a strength that fades from 0.6 to 0 along a smoothstep. Then it is a
// plain ragdoll with joint limits (knees fold backward only, the neck within 70 degrees, elbows within 150), high
// ground friction, and sleep once it has been still for 30 frames. The variant is picked deterministically from the
// hit, so screenshots are stable. Everything here is pure maths on joint positions: body.ts runs it.

import * as THREE from "three";
import { REST, type Joint, type Zone } from "./rig";

export type DeathVariant = "headshot" | "gutclutch" | "spin" | "wallslump" | "knees" | "blownback" | "rail" | "crawlout";
export const DEATH_VARIANTS: readonly DeathVariant[] = ["headshot", "gutclutch", "spin", "wallslump", "knees", "blownback", "rail", "crawlout"];

/** What the killing blow and the street around the body say about how he goes down. */
export interface DeathCtx {
  zone: Zone;
  weaponCls: string;
  /** Metres from the shooter. */
  distance: number;
  /**
   * The round's travel across the body: its dot with the body's left (+1: travelling to his left, so it came from
   * his right). |side| above 0.6 is a hit from the side.
   */
  side: number;
  /** A wall within 1.2 m behind him along the round (metres), or null. */
  wallBehind?: number | null;
  /** A collider top edge 0.9 to 1.2 m high within 1 m: where it is in body space (z ahead, +x left) and its height. */
  rail?: { z: number; h: number } | null;
  explosive?: boolean;
  /** A crawl (S4.2) ended in death. */
  crawlEnded?: boolean;
  /** The first gun kill of a new save: it is always the gut clutch (the spec's staged first fight). */
  firstGunKill?: boolean;
  /** Any stable number from the hit (enemy id, damage): breaks ties without Math.random. */
  seed: number;
  /** A headshot knocks the helmet off (stages force it; otherwise helmetPops(seed)). */
  helmetPop?: boolean;
}

/** S4.4: the helmet pops off 40% of headshot drops, deterministically from the seed. */
export function helmetPops(seed: number): boolean {
  return hash(seed * 3.7 + 1.3) < DEATH.helmetChance;
}

/** S4.4 numbers. */
export const DEATH = {
  /** Bullet impulse at the hit joint, m/s, falling off with distance from it as max(0.25, 1 - 0.8 d). */
  impulse: {
    pistol: 3.5,
    revolver: 4,
    smg: 4,
    rifle: 4.5,
    smart: 4.5,
    shotgun: 8.5,
    sniper: 9,
    melee: 2.5,
    launcher: 10,
  } as Record<string, number>,
  /** Active-phase length per variant (ms). */
  durMs: {
    headshot: 0,
    gutclutch: 900,
    spin: 600,
    wallslump: 1200,
    knees: 800,
    blownback: 450,
    rail: 700,
    crawlout: 2400,
  } as Record<DeathVariant, number>,
  /** The pose spring's starting strength (per 60 Hz frame). */
  k0: 0.6,
  /** The share of the active phase the pose holds at full strength before it starts to fade. */
  holdShare: 0.5,
  /** Variants whose end pose is held at this strength until the body sleeps (a sit can't balance on points). */
  restHold: { wallslump: 0.3, crawlout: 0.2 } as Partial<Record<DeathVariant, number>>,
  /** Hand IK (the clutch) lets go below this. */
  clutchK: 0.15,
  /** The headshot's backward kick on the head (m/s), and the blown-back multiplier and lift. */
  headKick: 6,
  /** The headshot's helmet pop: the share of headshots, and how it leaves (m/s along the round, up, tumble). */
  helmetChance: 0.4,
  helmet: { along: 2.6, up: 1.5, spin: 8 },
  blownMul: 1.5,
  blownUp: 1.5,
  /** The impulse carries the posed body along the round for about this long (s) before the pose holds it. */
  driftS: 0.09,
  /** Ground friction once limp: the share of sliding speed a joint on the floor loses each contact. */
  friction: 0.85,
  /** Joint limits (degrees): neck off the spine, elbow and knee bend from straight. */
  neckDeg: 70,
  elbowDeg: 150,
  kneeDeg: 155,
  /** Asleep when every joint moves under this (m per 60 Hz frame) for `sleepFrames` frames. */
  sleepM: 0.002,
  sleepFrames: 30,
  /** Limp seconds before extra damping starts, and when a body is put to sleep whatever it is doing. */
  settleS: 0.8,
  forceSleepS: 1.95,
  /** The strongest push a death takes (m/s). */
  maxImpulse: 20,
  /** Any joint faster than this (m/s) drops the pose and clamps: a plain limp is better than an explosion. */
  maxSpeed: 30,
  /** Variant triggers. */
  gutM: 12,
  sideMin: 0.6,
  wallM: 1.2,
  blownM: 4,
  rail: { lo: 0.9, hi: 1.2, m: 1 },
  /** The weapon leaves the hands this far into the active phase (ms), or on the first limp frame. */
  dropMs: 200,
  /** The visor light-out: fade over `ms`, with a flicker back on at each `flickers` time. */
  lightOut: { ms: 900, flickers: [300, 550] as const, flickerMs: 45 },
  /** A joint landing faster than this (m/s) thuds. */
  thudSpeed: 1.5,
};

/** Picks how he dies (S4.4's table), deterministically. */
export function pickVariant(c: DeathCtx): DeathVariant {
  if (c.crawlEnded) return "crawlout";
  const cls = c.weaponCls;
  if (c.explosive || cls === "launcher" || (cls === "shotgun" && c.distance <= DEATH.blownM)) return "blownback";
  if (c.zone === "head") return "headshot";
  if (c.rail) return "rail";
  if (c.wallBehind != null && c.wallBehind <= DEATH.wallM) return "wallslump";
  if (c.zone === "legL" || c.zone === "legR") return "knees";
  const gunTorso = c.zone === "torso" && (cls === "pistol" || cls === "rifle" || cls === "revolver" || cls === "smg" || cls === "smart") && c.distance <= DEATH.gutM;
  if (c.firstGunKill && gunTorso) return "gutclutch";
  if ((c.zone === "torso" || c.zone === "armL" || c.zone === "armR") && Math.abs(c.side) >= DEATH.sideMin) return "spin";
  if (gunTorso) return "gutclutch";
  // Far torso hits and arm hits from the front: seeded between the two that read at range.
  return hash(c.seed) < 0.5 ? "spin" : "gutclutch";
}

function hash(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function smooth(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}
function easeOut(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return 1 - (1 - t) * (1 - t);
}

/**
 * The pose spring's strength `tMs` into a variant's active phase: 0.6, fading to 0 along a smoothstep over the
 * phase's second half (held firm until then, so the pose is actually reached before the ragdoll takes over).
 */
export function poseK(v: DeathVariant, tMs: number): number {
  const dur = DEATH.durMs[v];
  if (dur <= 0) return 0;
  const k = DEATH.k0 * (1 - smooth((tMs - dur * DEATH.holdShare) / (dur * (1 - DEATH.holdShare))));
  // A sit against a wall is held (the back stays pinned to it) until the body sleeps in it.
  return Math.max(k, DEATH.restHold[v] ?? 0);
}

// ------------------------------------------------------------------ dying poses (body space, FK)

/** A dying pose, as a few numbers: the pelvis, how the spine leans, where the feet and hands are. Body space. */
interface PoseP {
  /** Pelvis height and its offset (+x left, +z ahead). */
  h: number;
  fx: number;
  fz: number;
  /** Spine lean forward (+), sideways (+ to his right), whole-body yaw, the upper body's twist on top. */
  pitch: number;
  roll: number;
  yaw: number;
  twist: number;
  /** The head's extra bow forward. */
  head: number;
  footL: THREE.Vector3;
  footR: THREE.Vector3;
  /** Hand targets (body space), or null to hang. */
  handL: THREE.Vector3 | null;
  handR: THREE.Vector3 | null;
}

const LEN = {
  chest: REST.chest.y - REST.pelvis.y,
  neck: REST.neck.y - REST.pelvis.y,
  head: REST.head.y - REST.neck.y,
  shoulderDrop: REST.neck.y - REST.shoulderL.y,
  shoulderW: REST.shoulderL.x,
  hipDrop: REST.pelvis.y - REST.hipL.y,
  hipW: REST.hipL.x,
  thigh: REST.hipL.distanceTo(REST.kneeL),
  shin: REST.kneeL.distanceTo(REST.footL),
  upper: REST.shoulderL.distanceTo(REST.elbowL),
  fore: REST.elbowL.distanceTo(REST.handL),
};

const eu = new THREE.Euler(0, 0, 0, "YZX");
const qa = new THREE.Quaternion();
const vS = new THREE.Vector3();
const vH = new THREE.Vector3();
const vA = new THREE.Vector3();
const vA2 = new THREE.Vector3();
const vF = new THREE.Vector3();
const vT = new THREE.Vector3();
const vP = new THREE.Vector3();
const vD = new THREE.Vector3();

function rot(out: THREE.Vector3, x: number, y: number, z: number, pitch: number, yaw: number, roll: number): THREE.Vector3 {
  eu.set(pitch, yaw, -roll, "YZX");
  return out.set(x, y, z).applyQuaternion(qa.setFromEuler(eu));
}

/** Two-bone IK in place: `mid` for a chain root→end bending toward `pole`; `end` is pulled in if out of reach. */
export function ik2(root: THREE.Vector3, end: THREE.Vector3, l1: number, l2: number, pole: THREE.Vector3, mid: THREE.Vector3): void {
  vD.subVectors(end, root);
  const len = vD.length();
  if (len < 1e-5) vD.set(0, -1, 0);
  else vD.multiplyScalar(1 / len);
  const max = l1 + l2 - 1e-3;
  const min = Math.abs(l1 - l2) + 1e-3;
  const L = Math.min(max, Math.max(min, len));
  end.copy(root).addScaledVector(vD, L);
  const a = (l1 * l1 - l2 * l2 + L * L) / (2 * L);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  vP.copy(pole).addScaledVector(vD, -pole.dot(vD));
  if (vP.lengthSq() < 1e-8) vP.set(0, 0, 1).addScaledVector(vD, -vD.z);
  vP.normalize();
  mid.copy(root).addScaledVector(vD, a).addScaledVector(vP, h);
}

/** Builds every joint (body space, unit scale) from the pose numbers. */
function buildPose(p: PoseP, out: Record<Joint, THREE.Vector3>): void {
  const pel = out.pelvis.set(p.fx, p.h, p.fz);
  rot(vS, 0, 1, 0, p.pitch, p.yaw, p.roll); // spine
  rot(vH, 0, 1, 0, p.pitch + p.head, p.yaw + p.twist, p.roll); // head
  rot(vA, 1, 0, 0, p.pitch, p.yaw + p.twist, p.roll); // shoulders across (to his left)
  rot(vA2, 1, 0, 0, 0, p.yaw, p.roll * 0.5); // hips across
  rot(vF, 0, 0, 1, 0, p.yaw, 0); // his front, flat
  out.chest.copy(pel).addScaledVector(vS, LEN.chest);
  out.neck.copy(pel).addScaledVector(vS, LEN.neck);
  out.head.copy(out.neck).addScaledVector(vH, LEN.head);
  out.shoulderL.copy(out.neck).addScaledVector(vS, -LEN.shoulderDrop).addScaledVector(vA, LEN.shoulderW);
  out.shoulderR.copy(out.neck).addScaledVector(vS, -LEN.shoulderDrop).addScaledVector(vA, -LEN.shoulderW);
  out.hipL.copy(pel).addScaledVector(vS, -LEN.hipDrop).addScaledVector(vA2, LEN.hipW);
  out.hipR.copy(pel).addScaledVector(vS, -LEN.hipDrop).addScaledVector(vA2, -LEN.hipW);
  // Legs: the feet where the pose puts them, knees bending forward.
  out.footL.copy(p.footL);
  out.footR.copy(p.footR);
  vT.copy(vF).multiplyScalar(2).add(out.hipL);
  ik2(out.hipL, out.footL, LEN.thigh, LEN.shin, vT.sub(out.hipL), out.kneeL);
  vT.copy(vF).multiplyScalar(2).add(out.hipR);
  ik2(out.hipR, out.footR, LEN.thigh, LEN.shin, vT.sub(out.hipR), out.kneeR);
  // Arms: to a target or hanging, elbows bending back and out.
  for (const s of ["L", "R"] as const) {
    const sh = out[`shoulder${s}`];
    const hand = out[`hand${s}`];
    const t = s === "L" ? p.handL : p.handR;
    if (t) hand.copy(t);
    else
      hand
        .copy(sh)
        .addScaledVector(vS, -(LEN.upper + LEN.fore) * 0.97)
        .addScaledVector(vF, 0.04);
    vT.copy(vF)
      .multiplyScalar(-1)
      .addScaledVector(vA, s === "L" ? 0.5 : -0.5);
    ik2(sh, hand, LEN.upper, LEN.fore, vT, out[`elbow${s}`]);
  }
}

const STANCE_L = new THREE.Vector3(REST.footL.x, REST.footL.y, 0);
const STANCE_R = new THREE.Vector3(REST.footR.x, REST.footR.y, 0);
const tmpPose: PoseP = {
  h: 0,
  fx: 0,
  fz: 0,
  pitch: 0,
  roll: 0,
  yaw: 0,
  twist: 0,
  head: 0,
  footL: new THREE.Vector3(),
  footR: new THREE.Vector3(),
  handL: new THREE.Vector3(),
  handR: new THREE.Vector3(),
};
const hL = new THREE.Vector3();
const hR = new THREE.Vector3();

/** The variant's dying pose `tMs` into its active phase, body space, unit scale (feet on y = 0, facing +z). */
export function dyingPose(v: DeathVariant, tMs: number, c: Pick<DeathCtx, "side" | "wallBehind" | "rail">, out: Record<Joint, THREE.Vector3>): void {
  const p = tmpPose;
  p.h = REST.pelvis.y;
  p.fx = p.fz = p.pitch = p.roll = p.yaw = p.twist = p.head = 0;
  p.footL.copy(STANCE_L);
  p.footR.copy(STANCE_R);
  p.handL = p.handR = null;
  const sg = c.side >= 0 ? 1 : -1;
  const t = tMs;
  switch (v) {
    case "gutclutch": {
      // The pelvis drops half a metre over 500 ms, he folds over the wound with both hands on it, the head goes
      // down, and he starts to tip over to one side.
      const u = smooth(t / 500);
      p.h = REST.pelvis.y - 0.5 * u;
      p.fz = -0.12 * easeOut(t / 300);
      p.pitch = 0.55 * u;
      p.head = 0.5 * smooth(t / 650);
      p.twist = 0.18 * sg * u;
      p.roll = -0.35 * sg * smooth((t - 450) / 450);
      p.footR.z = -0.1 * u;
      // Hands to the wound: the gut, in front of the bent torso.
      rot(vS, 0, 1, 0, p.pitch, 0, p.roll);
      rot(vF, 0, 0, 1, p.pitch, 0, p.roll);
      rot(vA, 1, 0, 0, p.pitch, p.twist, p.roll);
      const reach = smooth(t / 260);
      hL.set(p.fx, p.h, p.fz).addScaledVector(vS, 0.16).addScaledVector(vF, 0.2).addScaledVector(vA, 0.06);
      hR.set(p.fx, p.h, p.fz).addScaledVector(vS, 0.2).addScaledVector(vF, 0.21).addScaledVector(vA, -0.04);
      // From the hang into the clutch over 260 ms.
      hL.lerp(vT.set(REST.handL.x, REST.handL.y - 0.5 * u, p.fz + 0.05), 1 - reach);
      hR.lerp(vT.set(REST.handR.x, REST.handR.y - 0.5 * u, p.fz + 0.05), 1 - reach);
      p.handL = hL;
      p.handR = hR;
      break;
    }
    case "spin": {
      // A 90 degree turn along the round, the arm on the hit side flung out, then he pitches over.
      const u = easeOut(t / 450);
      p.yaw = sg * 1.45 * u;
      p.h = REST.pelvis.y - 0.22 * smooth(t / 600);
      p.pitch = 0.65 * smooth((t - 250) / 350);
      p.roll = 0.15 * sg * u;
      p.twist = 0.35 * sg * smooth(t / 250) * (1 - u * 0.5);
      p.head = -0.3 * smooth(t / 200);
      rot(p.footL, STANCE_L.x, STANCE_L.y, STANCE_L.z, 0, p.yaw * 0.6, 0);
      rot(p.footR, STANCE_R.x, STANCE_R.y, STANCE_R.z, 0, p.yaw * 0.6, 0);
      // The flung arm: out to the side, up a little, behind the shoulder line.
      rot(vA, 1, 0, 0, 0, p.yaw + p.twist, 0);
      rot(vF, 0, 0, 1, 0, p.yaw, 0);
      const fl = sg > 0 ? -1 : 1; // the shooter's side: the hit side
      const w = smooth(t / 180);
      const hand = fl > 0 ? hL : hR;
      hand
        .set(0, REST.shoulderL.y - 0.22 * smooth(t / 600) + 0.12 * w, 0)
        .addScaledVector(vA, fl * (0.22 + 0.55 * w))
        .addScaledVector(vF, -0.25 * w);
      if (fl > 0) p.handL = hL;
      else p.handR = hR;
      break;
    }
    case "wallslump": {
      // Slammed back into the wall, then the back slides down it to sit, legs out, head dropping last.
      const wd = Math.max(0.3, Math.min(DEATH.wallM, c.wallBehind ?? DEATH.wallM));
      const slam = easeOut(t / 220);
      const slide = smooth((t - 220) / 980);
      // The pelvis ends a hand's width off the wall with the spine leaning back into it, the shoulders touching.
      p.fz = -(wd - 0.06 - 0.12 * slide) * slam;
      p.h = REST.pelvis.y - 0.78 * slide;
      p.pitch = -0.08 * slam - 0.2 * slide;
      p.head = 0.15 * slam + 0.45 * smooth((t - 900) / 300);
      p.roll = 0.04 * sg * smooth((t - 700) / 500);
      // Legs out long and splayed, knees soft: a sit, not a squat (raised knees crossed into an X from the front).
      p.footL.z = p.footR.z = p.fz + 0.84 * slide + 0.12 * (1 - slide) * slam;
      p.footL.x = STANCE_L.x + 0.17 * slide;
      p.footR.x = STANCE_R.x - 0.13 * slide;
      p.footR.z += 0.06 * slide;
      // Hands fall to the floor beside him.
      hL.set(0.34, Math.max(0.05, REST.handL.y - 0.8 * slide), p.fz + 0.14);
      hR.set(-0.34, Math.max(0.05, REST.handR.y - 0.8 * slide), p.fz + 0.14);
      p.handL = hL;
      p.handR = hR;
      break;
    }
    case "knees": {
      // One knee down over 300 ms, a held beat, then forward onto his face.
      const down = smooth(t / 300);
      const fall = smooth((t - 500) / 300);
      p.h = REST.pelvis.y - 0.4 * down - 0.2 * fall;
      p.pitch = 0.12 * down + 1.15 * fall;
      p.head = 0.25 * down - 0.2 * fall;
      p.fz = 0.3 * fall;
      p.footL.z = -0.38 * down;
      p.footL.y = REST.footL.y + 0.06 * down;
      p.footR.z = 0.18 * down;
      p.roll = 0.1 * sg * down;
      break;
    }
    case "blownback": {
      // Lifted off his feet and thrown back: the pelvis flies a metre and a half back on an arc, the body laid out
      // backward through the air, the legs swinging up in front of him, the arms trailing forward.
      const u = t / 450;
      const travel = 1.6 * easeOut(u * 1.15);
      const arc = 0.42 * Math.sin(Math.PI * Math.min(1, u * 0.85));
      p.fz = -travel;
      p.h = REST.pelvis.y + arc - 0.55 * smooth((u - 0.55) / 0.45);
      p.pitch = -1.25 * smooth(u * 1.3);
      p.head = 0.35 * smooth(u * 2);
      p.footL.set(STANCE_L.x + 0.05, 0.1 + 0.45 * smooth(u * 1.6), -travel + 0.55 * smooth(u * 1.4));
      p.footR.set(STANCE_R.x - 0.08, 0.06 + 0.3 * smooth(u * 1.4), -travel + 0.4 * smooth(u * 1.2));
      rot(vS, 0, 1, 0, p.pitch, 0, 0);
      rot(vF, 0, 0, 1, p.pitch, 0, 0);
      const fl = smooth(u * 2.2);
      hL.set(p.fx + 0.3, p.h, p.fz).addScaledVector(vS, 0.55 - 0.1 * fl).addScaledVector(vF, 0.45 * fl);
      hR.set(p.fx - 0.32, p.h, p.fz).addScaledVector(vS, 0.5 - 0.1 * fl).addScaledVector(vF, 0.5 * fl);
      p.handL = hL;
      p.handR = hR;
      break;
    }
    case "rail": {
      // Folded over the edge: the pelvis to the rail top, the torso over it, the feet on this side.
      const r = c.rail ?? { z: -0.6, h: 1 };
      const dirz = r.z >= 0 ? 1 : -1;
      const u = smooth(t / 450);
      const fold = smooth((t - 150) / 550);
      p.fz = (r.z - dirz * 0.12) * u;
      p.h = REST.pelvis.y + (r.h + 0.05 - REST.pelvis.y) * u;
      p.pitch = dirz * 1.5 * fold;
      p.head = dirz * 0.4 * fold;
      p.footL.z = p.footR.z = r.z * 0.35 * u;
      p.footL.y = p.footR.y = REST.footL.y + 0.25 * u;
      break;
    }
    case "crawlout": {
      // Prone, three breaths, then still.
      const breath = Math.sin((Math.PI * 2 * t) / 800) * (1 - smooth((t - 1600) / 800));
      p.h = 0.16;
      p.pitch = 1.5 - 0.05 * breath;
      p.head = -0.4;
      p.footL.set(STANCE_L.x, 0.08, -0.85);
      p.footR.set(STANCE_R.x - 0.06, 0.08, -0.88);
      hL.set(0.4, 0.06, 0.55);
      hR.set(-0.3, 0.06, 0.2);
      p.handL = hL;
      p.handR = hR;
      break;
    }
    default:
      break;
  }
  buildPose(p, out);
}

// ------------------------------------------------------------------ where he comes to rest (C9 review)

/**
 * How a body lies once the fall is over. A plain ragdoll settles into whatever heap the floor leaves, and with
 * rigid armoured segments that heap reads as a pile of boxes (C9 review). So once the variant's active phase is over
 * and he has had a moment to fall, each joint is drawn toward a lying pose that reads as a dead man: flat on his
 * back with the limbs splayed, face down with an arm up by his head and a knee drawn up, or curled on his side
 * with both hands still on the wound. The pose is placed where the ragdoll put him (pelvis, head direction) and
 * matched to the way he actually landed (face up or down, which side), so it never flips him through the floor.
 */
export type RestKind = "back" | "front" | "side";
export const REST_POSE = {
  /** Limp seconds before the pull starts (a headshot drops, a blown-back body flies first). */
  delayS: { headshot: 0.3, blownback: 0.12, gutclutch: 0.05, spin: 0.12, knees: 0.08 } as Partial<Record<DeathVariant, number>>,
  /** Seconds the pull takes to come up to strength, and its strength (share of the gap closed per 60 Hz frame). */
  rampS: 0.6,
  k: 0.2,
  /** Joint heights over the street (m): the torso's plates, the helmet, the limbs. */
  torsoH: 0.13,
  headH: 0.12,
  limbH: 0.075,
  /** The spine's height lying on his side: half the chest plates' width. */
  sideH: 0.19,
};

/** The lying pose a variant ends in, or null for one that holds its own end (a sit, a fold over a rail, a crawl). */
export function restKindFor(v: DeathVariant, frontY: number): RestKind | null {
  if (v === "gutclutch") return "side";
  if (v === "headshot" || v === "blownback") return frontY < -0.5 ? "front" : "back";
  if (v === "spin" || v === "knees") return frontY > 0.5 ? "back" : "front";
  return null;
}

const rS = new THREE.Vector3();
const rA = new THREE.Vector3();
const rF = new THREE.Vector3();
const rD = new THREE.Vector3();
const rP = new THREE.Vector3();
const TORSO: readonly Joint[] = ["pelvis", "chest", "neck", "shoulderL", "shoulderR", "hipL", "hipR"];

/** A limb bone from `from` along `dir` (body basis), its end at height `h`: the floor flattens it, length kept. */
function bone(from: THREE.Vector3, dir: THREE.Vector3, len: number, h: number, out: THREE.Vector3): void {
  const dy = Math.max(-len * 0.95, Math.min(len * 0.95, h - from.y));
  rD.set(dir.x, 0, dir.z);
  if (rD.lengthSq() < 1e-6) rD.set(0, 0, -1);
  rD.setLength(Math.sqrt(len * len - dy * dy));
  out.copy(from).add(rD).y += dy;
}

/**
 * A lying pose in its own frame: the pelvis over the origin, the head toward +z, y up from the street. `sg` picks
 * which arm is flung up (or which side is down, for the curl).
 */
export function lyingPose(kind: RestKind, sg: number, out: Record<Joint, THREE.Vector3>, flung = false): void {
  const s = sg >= 0 ? 1 : -1;
  // The body's basis: spine, his left, his front.
  rS.set(0, 0, 1);
  if (kind === "back") rA.set(-1, 0, 0);
  else if (kind === "front") rA.set(1, 0, 0);
  else rA.set(0, s, 0.12).normalize(); // on his side, his left up (s = 1), the top shoulder rolled a touch forward
  rF.crossVectors(rA, rS).normalize();
  // A slight curve: the shoulders a little off the spine's line, so it isn't a plank.
  if (kind !== "side") rS.addScaledVector(rA, 0.06 * s).normalize();
  for (const j of TORSO) {
    const R = REST[j];
    out[j].set(0, 0, 0).addScaledVector(rA, R.x).addScaledVector(rS, R.y - REST.pelvis.y).addScaledVector(rF, R.z);
  }
  // The head: rolled onto one cheek on his back or front, bowed onto his chest when curled.
  rD.copy(rS);
  if (kind === "side") rD.addScaledVector(rF, 0.55);
  else rD.addScaledVector(rA, kind === "back" ? 0.5 * s : -0.6 * s).addScaledVector(rF, kind === "back" ? 0.1 : -0.1);
  out.head.copy(out.neck).addScaledVector(rD.normalize(), LEN.head);
  // Lift the torso onto the street: the spine at half the plates' depth (their width, on his side), every other
  // joint just off the floor.
  let lift = -Infinity;
  const spineH = kind === "side" ? REST_POSE.sideH : REST_POSE.torsoH;
  for (const j of TORSO) lift = Math.max(lift, (j === "pelvis" || j === "chest" || j === "neck" ? spineH : REST_POSE.limbH) - out[j].y);
  lift = Math.max(lift, REST_POSE.headH - out.head.y);
  for (const j of [...TORSO, "head" as const]) out[j].y += lift;
  const H = REST_POSE.limbH;
  // Limbs: (along his left/right outward, along the spine, along his front), then flattened onto the street.
  const limb = (side: "L" | "R", upper: [number, number, number], lower: [number, number, number], kneeH = H, arm = true) => {
    const o = side === "L" ? 1 : -1;
    const root = arm ? out[`shoulder${side}`] : out[`hip${side}`];
    const mid = arm ? out[`elbow${side}`] : out[`knee${side}`];
    const end = arm ? out[`hand${side}`] : out[`foot${side}`];
    rP.set(0, 0, 0).addScaledVector(rA, upper[0] * o).addScaledVector(rS, upper[1]).addScaledVector(rF, upper[2]);
    bone(root, rP, arm ? LEN.upper : LEN.thigh, kneeH, mid);
    rP.set(0, 0, 0).addScaledVector(rA, lower[0] * o).addScaledVector(rS, lower[1]).addScaledVector(rF, lower[2]);
    bone(mid, rP, arm ? LEN.fore : LEN.shin, H, end);
  };
  // `up` is the side whose arm goes up by the head.
  const up = s > 0 ? "L" : "R";
  const dn = s > 0 ? "R" : "L";
  if (kind === "back") {
    limb(up, [0.85, 0.4, 0], [0.25, 0.95, 0]);
    limb(dn, [0.45, -0.9, 0], [0.55, -0.8, 0]);
    // One leg long and splayed, the other's knee fallen out and up.
    limb(up, [0.15, -1, 0], [0.22, -1, 0], H + 0.03, false);
    limb(dn, [0.55, -0.85, 0], [-0.05, -1, 0], 0.24, false);
  } else if (kind === "front" && flung) {
    // Spun down: the arm on the hit side flung straight out, the other under his chest, the legs scissored.
    limb(up, [1, 0.12, 0], [0.97, -0.2, 0]);
    limb(dn, [0.15, -0.7, 0.3], [-0.6, 0.2, 0.3]);
    limb(up, [0.25, -0.95, 0], [0.4, -0.92, 0], H, false);
    limb(dn, [0.45, -0.85, 0], [-0.25, -0.97, 0], H, false);
  } else if (kind === "front") {
    limb(up, [0.9, 0.35, 0], [-0.25, 0.95, 0]);
    limb(dn, [0.3, -0.95, 0], [0.1, -1, 0]);
    // The knee on the raised arm's side drawn up, the other leg straight.
    limb(up, [0.7, -0.7, 0], [-0.1, -1, 0], H, false);
    limb(dn, [0.06, -1, 0], [0.12, -1, 0], H, false);
  } else {
    // Curled on his side: knees drawn up in front of him, both hands still at the wound.
    for (const sd of ["L", "R"] as const) {
      const top = (sd === "L") === s > 0;
      const o = sd === "L" ? 1 : -1;
      const hip = out[`hip${sd}`];
      rP.copy(rF).multiplyScalar(top ? 0.9 : 0.75).addScaledVector(rS, top ? -0.45 : -0.65);
      bone(hip, rP, LEN.thigh, top ? hip.y - 0.05 : H + 0.02, out[`knee${sd}`]);
      rP.copy(rS).multiplyScalar(-1).addScaledVector(rF, top ? 0.1 : -0.2);
      bone(out[`knee${sd}`], rP, LEN.shin, top ? H + 0.08 : H, out[`foot${sd}`]);
      const hand = out[`hand${sd}`];
      hand.copy(out.pelvis).addScaledVector(rF, 0.2).addScaledVector(rS, 0.16).addScaledVector(rA, 0.05 * o);
      hand.y = Math.max(H, hand.y);
      rP.copy(rS).multiplyScalar(-1).addScaledVector(rF, 0.4);
      ik2(out[`shoulder${sd}`], hand, LEN.upper, LEN.fore, rP, out[`elbow${sd}`]);
    }
  }
  for (const j of JOINTS_ALL) out[j].y = Math.max(out[j].y, H - 0.01);
  limitJoints(out);
}
const JOINTS_ALL = Object.keys(REST) as Joint[];

// ------------------------------------------------------------------ the run (one body's death)

const lp = {} as Record<Joint, THREE.Vector3>;
const lp2 = {} as Record<Joint, THREE.Vector3>;
for (const j of Object.keys(REST) as Joint[]) {
  lp[j] = new THREE.Vector3();
  lp2[j] = new THREE.Vector3();
}

/**
 * One body's death: the variant, its clock, and the frame its dying pose is placed in (where he stood, the way he
 * faced, his scale). `targets` writes this frame's world-space pose and the pose's own velocity.
 */
export class DeathRun {
  /** Ms since the lethal frame (the body's own clock). */
  t = 0;
  readonly dur: number;
  /** Set when a joint went faster than DEATH.maxSpeed: the pose lets go for good. */
  fellBack = false;
  /** The weapon has left the hands (S4.4: 200 ms into the active phase, or on the first limp frame). */
  dropped = false;
  readonly origin = new THREE.Vector3();
  readonly impulse = new THREE.Vector3();
  /** How much of the impulse each joint carries: max(0.25, 1 - 0.8 d) from the hit (set by Body.goLimp). */
  readonly near: Partial<Record<Joint, number>> = {};
  constructor(
    readonly variant: DeathVariant,
    readonly ctx: Pick<DeathCtx, "side" | "wallBehind" | "rail">,
    origin: THREE.Vector3,
    readonly yaw: number,
    readonly scale = 1,
  ) {
    this.dur = DEATH.durMs[variant];
    this.origin.copy(origin);
  }
  get k(): number {
    return this.fellBack ? 0 : poseK(this.variant, this.t);
  }
  get active(): boolean {
    return this.t < this.dur && !this.fellBack;
  }
  /** The lying pose he is drawn into once the fall is over (world space), anchored where he landed; and its kind. */
  rest: Record<Joint, THREE.Vector3> | null = null;
  restKind: RestKind | null = null;
  /** The pull toward the lying pose `limpS` seconds into the limp phase: 0 before it starts or without one. */
  restK(limpS: number): number {
    const d = REST_POSE.delayS[this.variant];
    if (d == null) return 0;
    return REST_POSE.k * smooth((limpS - d) / REST_POSE.rampS);
  }
  /** The lying pose has had time to take him (or this death has none): he may sleep. */
  restSettled(limpS: number): boolean {
    const d = REST_POSE.delayS[this.variant];
    return d == null || limpS > d + REST_POSE.rampS + 0.2;
  }
  /** Places the lying pose where the ragdoll has put him: under his pelvis, head the way his head lies. */
  anchorRest(J: Record<Joint, THREE.Vector3>, ground: (x: number, z: number) => number): void {
    rA.subVectors(J.hipL, J.hipR).add(rD.subVectors(J.shoulderL, J.shoulderR));
    rS.subVectors(J.neck, J.pelvis);
    rF.crossVectors(rA, rS);
    const frontY = rF.lengthSq() > 1e-8 ? rF.normalize().y : 0;
    const kind = restKindFor(this.variant, frontY);
    this.restKind = kind;
    if (!kind) return;
    const across = rA.lengthSq() > 1e-8 ? rA.normalize().y : 0;
    const sg = kind === "side" ? (Math.abs(across) > 0.15 ? Math.sign(across) : this.ctx.side >= 0 ? 1 : -1) : this.ctx.side >= 0 ? 1 : -1;
    // His head's way along the street; straight up (a body still upright) falls back to the way he faced.
    rS.y = 0;
    // A drop onto his back goes the way the round pushed him, unless he has plainly already gone the other way.
    rD.set(this.impulse.x, 0, this.impulse.z);
    if (kind === "back" && rD.lengthSq() > 0.25 && (rS.lengthSq() < 0.16 || rS.dot(rD) > 0)) rS.copy(rD);
    if (rS.lengthSq() < 0.01) rS.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    rS.normalize();
    const hx = rS.x;
    const hz = rS.z;
    const out = {} as Record<Joint, THREE.Vector3>;
    for (const j of JOINTS_ALL) out[j] = new THREE.Vector3();
    lyingPose(kind, sg, out, this.variant === "spin");
    const ox = J.pelvis.x;
    const oz = J.pelvis.z;
    const sc = this.scale;
    for (const j of JOINTS_ALL) {
      const v = out[j];
      const x = ox + (v.x * hz + v.z * hx) * sc;
      const z = oz + (-v.x * hx + v.z * hz) * sc;
      v.set(x, ground(x, z) + v.y * sc, z);
    }
    this.rest = out;
  }
  /** The world pose at `tMs` (the impulse's drift along the round included) into `out`. */
  pose(tMs: number, out: Record<Joint, THREE.Vector3>): void {
    dyingPose(this.variant, tMs, this.ctx, out);
    const tS = tMs / 1000;
    const drift = DEATH.driftS * (1 - Math.exp(-tS / DEATH.driftS));
    const c = Math.cos(this.yaw);
    const s = Math.sin(this.yaw);
    for (const j of Object.keys(out) as Joint[]) {
      const v = out[j];
      const x = v.x * this.scale;
      const z = v.z * this.scale;
      v.set(this.origin.x + x * c + z * s, this.origin.y + v.y * this.scale, this.origin.z - x * s + z * c);
      v.addScaledVector(this.impulse, drift * (this.near[j] ?? 0.6) * (this.variant === "wallslump" ? 0.25 : 1));
    }
  }
  /** This frame's targets and their per-step motion (target now minus target a step ago). */
  targets(dt: number): {
    at: Record<Joint, THREE.Vector3>;
    prev: Record<Joint, THREE.Vector3>;
  } {
    this.pose(this.t, lp);
    this.pose(Math.max(0, this.t - dt * 1000), lp2);
    return { at: lp, prev: lp2 };
  }
}

// ------------------------------------------------------------------ joint limits

const jA = new THREE.Vector3();
const jB = new THREE.Vector3();
const jC = new THREE.Vector3();
const jF = new THREE.Vector3();
const jU = new THREE.Vector3();
const jV = new THREE.Vector3();
const jW = new THREE.Vector3();

/**
 * Keeps the joint between `root` and `end` from folding past `maxBendDeg` from straight: `end` swings out to the
 * limit, keeping its distance. `hint` picks the bend plane when the chain is folded flat.
 */
function limitBend(root: THREE.Vector3, mid: THREE.Vector3, end: THREE.Vector3, maxBendDeg: number, hint: THREE.Vector3): void {
  jU.subVectors(root, mid);
  jV.subVectors(end, mid);
  const lu = jU.length();
  const lv = jV.length();
  if (lu < 1e-6 || lv < 1e-6) return;
  jU.multiplyScalar(1 / lu);
  jV.multiplyScalar(1 / lv);
  // Interior angle at the joint is 180 - bend; it must stay at or above 180 - maxBend.
  const minInterior = ((180 - maxBendDeg) * Math.PI) / 180;
  const cosMin = Math.cos(minInterior);
  const d = jU.dot(jV);
  if (d <= cosMin) return;
  jW.copy(jV).addScaledVector(jU, -d);
  if (jW.lengthSq() < 1e-8) jW.copy(hint).addScaledVector(jU, -hint.dot(jU));
  if (jW.lengthSq() < 1e-8) return;
  jW.normalize();
  end
    .copy(mid)
    .addScaledVector(jU, cosMin * lv)
    .addScaledVector(jW, Math.sin(minInterior) * lv);
}

/** Mirrors a knee that sits behind the hip-foot line (bent the wrong way) to the front of it. */
function kneeFront(hip: THREE.Vector3, knee: THREE.Vector3, foot: THREE.Vector3, hasFront: boolean): void {
  if (!hasFront) return;
  jC.subVectors(foot, hip);
  const len = jC.length();
  if (len < 1e-6) return;
  jC.multiplyScalar(1 / len);
  // The front, square to the leg.
  jU.copy(jF).addScaledVector(jC, -jF.dot(jC));
  if (jU.lengthSq() < 1e-8) return;
  jU.normalize();
  jV.subVectors(knee, hip);
  const off = jV.dot(jU);
  if (off < 0) knee.addScaledVector(jU, -2 * off);
}

/**
 * S4.4's limp-phase limits, in place: knees fold backward only (the knee stays in front of the hip-foot line, a dot
 * product against the thigh's forward), knees and elbows bend no further than their limits, and the head stays
 * within 70 degrees of the spine.
 */
export function limitJoints(J: Record<Joint, THREE.Vector3>, lost?: ReadonlySet<string>): void {
  // His front, from the hips and the spine.
  jA.subVectors(J.hipL, J.hipR);
  jB.subVectors(J.chest, J.pelvis);
  jF.crossVectors(jA, jB);
  const hasFront = jF.lengthSq() > 1e-8;
  if (hasFront) jF.normalize();
  for (const s of ["L", "R"] as const) {
    if (lost?.has(`thigh${s}`) || lost?.has(`shin${s}`)) continue;
    const hip = J[`hip${s}`];
    const knee = J[`knee${s}`];
    const foot = J[`foot${s}`];
    kneeFront(hip, knee, foot, hasFront);
    limitBend(hip, knee, foot, DEATH.kneeDeg, jF.lengthSq() > 0 ? jW.copy(jF).negate() : jW.set(0, 0, -1));
    // Swinging the foot out to the bend limit moves the hip-foot line: check the knee against it again.
    kneeFront(hip, knee, foot, hasFront);
  }
  for (const s of ["L", "R"] as const) {
    if (lost?.has(`upperArm${s}`) || lost?.has(`forearm${s}`)) continue;
    limitBend(J[`shoulder${s}`], J[`elbow${s}`], J[`hand${s}`], DEATH.elbowDeg, hasFront ? jW.copy(jF) : jW.set(0, 0, 1));
  }
  if (!lost?.has("head")) {
    // The neck: the head within 70 degrees of the spine's line through the neck.
    jU.subVectors(J.neck, J.chest);
    jV.subVectors(J.head, J.neck);
    const lu = jU.length();
    const lv = jV.length();
    if (lu > 1e-6 && lv > 1e-6) {
      jU.multiplyScalar(1 / lu);
      jV.multiplyScalar(1 / lv);
      const cosMax = Math.cos((DEATH.neckDeg * Math.PI) / 180);
      const d = jU.dot(jV);
      if (d < cosMax) {
        jW.copy(jV).addScaledVector(jU, -d);
        if (jW.lengthSq() < 1e-8) jW.copy(jF);
        if (jW.lengthSq() > 1e-8) {
          jW.normalize();
          const sinMax = Math.sin((DEATH.neckDeg * Math.PI) / 180);
          J.head
            .copy(J.neck)
            .addScaledVector(jU, cosMax * lv)
            .addScaledVector(jW, sinMax * lv);
        }
      }
    }
  }
}

/** Interior knee angle (degrees) and whether the knee is in front of the hip-foot line: for tests. */
export function kneeInfo(J: Record<Joint, THREE.Vector3>, s: "L" | "R"): { interiorDeg: number; front: number } {
  const hip = J[`hip${s}`];
  const knee = J[`knee${s}`];
  const foot = J[`foot${s}`];
  const u = new THREE.Vector3().subVectors(hip, knee).normalize();
  const v = new THREE.Vector3().subVectors(foot, knee).normalize();
  const interiorDeg = (Math.acos(Math.max(-1, Math.min(1, u.dot(v)))) * 180) / Math.PI;
  const f = new THREE.Vector3().crossVectors(new THREE.Vector3().subVectors(J.hipL, J.hipR), new THREE.Vector3().subVectors(J.chest, J.pelvis)).normalize();
  const leg = new THREE.Vector3().subVectors(foot, hip).normalize();
  f.addScaledVector(leg, -f.dot(leg)).normalize();
  return {
    interiorDeg,
    front: new THREE.Vector3().subVectors(knee, hip).dot(f),
  };
}

// ------------------------------------------------------------------ the dropped weapon (two-point rigid body)

/**
 * A dropped long gun as two Verlet points held at its length: one end lands, then the other, so it clatters twice
 * or three times and lies flat. `onClatter` gets the impact speed (m/s).
 */
export class DroppedProp {
  readonly a = new THREE.Vector3();
  readonly b = new THREE.Vector3();
  private readonly pa = new THREE.Vector3();
  private readonly pb = new THREE.Vector3();
  private readonly len: number;
  clatters = 0;
  asleep = false;
  /** How high its points rest over the street (m): a rifle lies flat, a helmet rolls on its shell (C9). */
  lift = 0.03;
  private still = 0;
  private lastClatter = -1;
  private t = 0;
  constructor(
    a: THREE.Vector3,
    b: THREE.Vector3,
    vel: THREE.Vector3,
    spin: number,
    private readonly onClatter?: (speed: number, at: THREE.Vector3) => void,
  ) {
    this.a.copy(a);
    this.b.copy(b);
    this.len = Math.max(0.05, a.distanceTo(b));
    const dt = 1 / 60;
    this.pa.copy(a).addScaledVector(vel, -dt);
    // Spin: the far end moves sideways against the near one.
    jA.subVectors(b, a).cross(jB.set(0, 1, 0));
    if (jA.lengthSq() < 1e-6) jA.set(1, 0, 0);
    jA.normalize();
    this.pb
      .copy(b)
      .addScaledVector(vel, -dt)
      .addScaledVector(jA, -spin * this.len * dt);
  }
  step(dt: number, ground: (x: number, z: number) => number, colliders: readonly THREE.Box3[] = []): void {
    if (this.asleep) return;
    this.t += dt;
    const g = -9.8 * dt * dt;
    let moved = 0;
    for (const [p, q] of [
      [this.a, this.pa],
      [this.b, this.pb],
    ] as const) {
      const vx = (p.x - q.x) * 0.995;
      const vy = (p.y - q.y) * 0.995;
      const vz = (p.z - q.z) * 0.995;
      q.copy(p);
      p.x += vx;
      p.y += vy + g;
      p.z += vz;
      moved = Math.max(moved, Math.hypot(vx, vy, vz));
    }
    for (let it = 0; it < 3; it++) {
      jA.subVectors(this.b, this.a);
      const d = jA.length();
      if (d > 1e-6) {
        const k = ((d - this.len) / d) * 0.5;
        this.a.addScaledVector(jA, k);
        this.b.addScaledVector(jA, -k);
      }
      for (const [p, q] of [
        [this.a, this.pa],
        [this.b, this.pb],
      ] as const) {
        const fl = ground(p.x, p.z) + this.lift;
        if (p.y < fl) {
          const vy = (q.y - p.y) / Math.max(1e-4, dt);
          p.y = fl;
          if (it === 0 && vy > 1 && this.t - this.lastClatter > 0.07 && this.clatters < 4) {
            this.clatters++;
            this.lastClatter = this.t;
            this.onClatter?.(vy, p);
          }
          // A bounce of a third, and the floor grips.
          q.y = p.y - Math.max(0, vy) * dt * 0.3;
          q.x = p.x - (p.x - q.x) * 0.45;
          q.z = p.z - (p.z - q.z) * 0.45;
        }
        for (const c of colliders) {
          if (p.x <= c.min.x || p.x >= c.max.x || p.y <= c.min.y || p.y >= c.max.y || p.z <= c.min.z || p.z >= c.max.z) continue;
          p.y = c.max.y + this.lift;
          q.y = p.y;
        }
      }
    }
    if (moved < 0.0015 * (dt * 60)) this.still++;
    else this.still = 0;
    if (this.still > 20 || this.t > 4) this.asleep = true;
  }
}

// ------------------------------------------------------------------ the light going out

/** Session-wide death presentation: with reduced motion the light goes out without flickering (set by session.ts). */
export const deathFx = { steady: false };

/**
 * The visor's light `tMs` after death: 1 fading to 0 over 900 ms, flicking back up at 300 and 550 ms (a steady
 * fade with `steady`, for reduced motion).
 */
export function visorLevel(tMs: number, steady = deathFx.steady): number {
  const L = DEATH.lightOut;
  if (tMs <= 0) return 1;
  if (tMs >= L.ms) return 0;
  let k = (1 - tMs / L.ms) ** 1.6;
  if (steady) return k;
  for (const f of L.flickers) {
    // Off for a beat, then a stutter back on.
    if (tMs >= f - L.flickerMs && tMs < f) k *= 0.1;
    else if (tMs >= f && tMs < f + L.flickerMs) k = Math.min(1, k * 1.9 + 0.12);
  }
  return Math.max(0, Math.min(1, k));
}
