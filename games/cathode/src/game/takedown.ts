// C11 "Takedowns" (docs/design/cathode-combat.md S5.1, S5.2): the paired sequence. The rules (who, which variant,
// where she is pulled to, what drops) are in sim/takedown.ts; this is the 1.2 s that plays.
//
// `Takedown` is the director. On the press it turns the target to the approach, hands his body to an authored
// script (death.ts's DeathScript: kinematic while she holds him, a powered ragdoll as she lets him down, then
// asleep), pulls Cath to the sync point over 120 to 300 ms, and runs its own clock (the hit-stop freezes it; the
// world around runs at 0.4). Each frame it poses her arms in the street (hands.ts's skinned arms, a second pair
// that lives in the world scene, with the Pin or the Kestrel in the right hand), and frames the camera: a paired
// first-person shot from her eyes (C11 review: an over-the-shoulder view put a blockout bust of her in the
// foreground), turned onto him over 120 ms, FOV +10, leaning in with her, a 3 degree kick down on each blow, a
// 4 degree dutch tilt after the lethal one, and 200 ms back to her own view at the end. Reduced motion cuts the
// turns, the kick and the tilt.
//
// The session reads `events` each frame (grab, impact, lethal, release, lay, end) and plays them: the hit-stop,
// the trauma, the thud and its sub, the blood mist, the kill, the orbs.

import * as THREE from "three";
import { LEN, STANCE_L, STANCE_R, buildPose, type DeathScript, type PoseP } from "./death";
import { REST, type Joint } from "./rig";
import { Arms, POSES, type HandPose } from "./hands";
import { buildGun, type GunRig } from "./viewmodel";
import { gripFrame, patchKitMaterial } from "./gunkit";
import { TAKEDOWN, blowsInOrder, lethalMs, orbPull, type OrbDrop, type TakedownApproach, type TakedownVariant } from "../sim/takedown";

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
/** smoothstep of t between a and b (ms). */
const ss = (t: number, a: number, b: number) => smooth((t - a) / (b - a));
const easeOut = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return 1 - (1 - t) * (1 - t) * (1 - t);
};
/** A snap: fast out of `a`, settled by `b`, with a little overshoot (a head knocked sideways). */
const snap = (t: number, a: number, b: number) => {
  const u = Math.min(1, Math.max(0, (t - a) / (b - a)));
  if (u <= 0) return 0;
  return 1 + Math.sin(u * Math.PI) * 0.18 * (1 - u) - Math.pow(1 - u, 3);
};

/** Feel numbers (S5.2), here so the tests and the session read one table. */
export const TD = {
  /**
   * The paired framing (C11 review 2): not her eyes (a lens 1.7 m up looked down onto the top of his helmet), but a
   * lens per variant (`lens` below) lowered to his ear line and kept off his head. The FOV it adds (degrees), the
   * eases, the kick, the dutch tilt after the lethal blow, the pitch window (degrees: never down onto the crown, never
   * up his nose), and the nearest the lens may come to his head's centre (m: closer, a helmet ring fills the frame).
   */
  cam: { fovAdd: 10, easeInMs: 120, easeOutMs: 200, kickDeg: 3, rollDeg: 4, pitchMinDeg: -20, pitchMaxDeg: 14, minHeadM: 0.42, overHeadM: 0.06, minEyeM: 1.0 },
  /**
   * The lens per variant, from her eye in her frame (m: right, up, forward), and what it looks at: his neck pulled
   * `head` of the way to his head, then `wrist` of the way to her striking hand (so the blow is in the shot);
   * `pitchMin` overrides the window's floor (the man on the floor is looked down on, S5.2: -35 degrees).
   */
  lens: {
    behind: { r: -0.2, u: -0.02, f: 0.0, head: 0.55, wrist: 0.35 },
    behindChoke: { r: -0.26, u: -0.1, f: 0.0, head: 0.6, wrist: 0.1, overHead: -0.06 },
    behindPistol: { r: 0.22, u: -0.08, f: 0.08, head: 0.35, wrist: 0.5 },
    front: { r: 0.12, u: 0.0, f: 0.0, head: 0.3, wrist: 0.35, overHead: 0.0 },
    frontKick: { r: 0.08, u: -0.06, f: -0.05, head: 0.3, wrist: 0.2 },
    side: { r: 0.06, u: -0.08, f: 0.0, head: 0.45, wrist: 0.3 },
    down: { r: 0.1, u: -0.05, f: -0.05, head: 0.6, wrist: 0.3, pitchMin: -40 },
    surrender: { r: 0.08, u: -0.1, f: 0.0, head: 0.5, wrist: 0.3, pitchMin: -30 },
  } as Record<string, Lens>,
  /** The letterbox (share of the boss intro's 11vh bars). */
  bars: 0.75,
  /** Hit-stop on the lethal blow and on any other (ms); trauma per blow. */
  stopMs: 80,
  /** A shot finisher's lethal round (S5.2 Front A: 110 ms, a headshot kill's stop). */
  stopShotMs: 110,
  stopMinorMs: 60,
  trauma: 0.35,
  traumaMinor: 0.22,
  /** Her eye over the street while she holds him, and her shoulders under it. */
  eye: 1.62,
  shoulderDrop: 0.24,
  shoulderW: 0.17,
  /** How far she leans into a hold (m along her forward). */
  lean: 0.08,
  /** The neck wrap: her left wrist on the near side of his neck (her frame from his neck joint, m), and her elbow. */
  wrap: { r: -0.08, u: 0.02, f: 0.0, poleR: -0.42, poleU: 0.4, poleF: 0.1 },
  /** Her arms' albedo in the street (a share of the viewmodel's). */
  armTone: 0.4,
  /** Her arms' dielectric specular in the street (of the kit's). */
  armSpec: 0.3,
};

/** One variant's lens (TD.lens). */
export interface Lens {
  r: number;
  u: number;
  f: number;
  head: number;
  wrist: number;
  pitchMin?: number;
  /** How far over his head's centre the lens may be (m; TD.cam.overHeadM). */
  overHead?: number;
}
/** The lens for a variant: its own, or its approach's. */
export function lensFor(v: TakedownVariant): Lens {
  return TD.lens[v.id] ?? TD.lens[v.approach]!;
}

export type TakedownEventKind = "grab" | "impact" | "lethal" | "release" | "lay" | "end" | "line";
export interface TakedownEvent {
  kind: TakedownEventKind;
  /** The blow's point (impact), the body (lay), etc. */
  at?: THREE.Vector3;
  /** Direction the blow travels (impact). */
  dir?: THREE.Vector3;
  /** The first (lethal) blow, or another. */
  lethal?: boolean;
}

/** What the director needs of the man she takes down. */
export interface TakedownTarget {
  readonly id: number;
  readonly body: { joints: Record<Joint, THREE.Vector3>; flash(seg: string): void; asleep: boolean };
  readonly motion: { pos: THREE.Vector3; yaw: number };
}

// ------------------------------------------------------------------ his body: the script per variant (body space)

const P0: PoseP = {
  h: 0,
  fx: 0,
  fz: 0,
  pitch: 0,
  roll: 0,
  yaw: 0,
  twist: 0,
  head: 0,
  headRoll: 0,
  kneeUp: 0,
  kneeOut: 0,
  footL: new THREE.Vector3(),
  footR: new THREE.Vector3(),
  handL: null,
  handR: null,
};
const hLt = new THREE.Vector3();
const hRt = new THREE.Vector3();
const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const nkV = new THREE.Vector3();

function blank(p: PoseP): PoseP {
  p.h = REST.pelvis.y;
  p.fx = p.fz = p.pitch = p.roll = p.yaw = p.twist = p.head = p.kneeUp = p.kneeOut = 0;
  p.headRoll = 0;
  p.footL.copy(STANCE_L);
  p.footR.copy(STANCE_R);
  p.handL = p.handR = null;
  return p;
}

/** The neck joint (body space) for the pose numbers so far, before the hands are set. */
function neckOf(p: PoseP, out: THREE.Vector3): THREE.Vector3 {
  // Spine: (0, cos, sin) of pitch, leaned by roll toward his right (-x).
  const sx = -Math.sin(p.roll) * Math.cos(p.pitch);
  return out.set(p.fx + sx * LEN.neck, p.h + Math.cos(p.pitch) * Math.cos(p.roll) * LEN.neck, p.fz + Math.sin(p.pitch) * LEN.neck);
}

/** Hands from hanging (null) toward a target, by `k` (0 hangs). Body space. */
function reach(p: PoseP, side: "L" | "R", target: THREE.Vector3, k: number): void {
  if (k <= 0.001) return;
  const out = side === "L" ? hLt : hRt;
  // Where the hand hangs: the shoulder straight down along the spine.
  const sx = side === "L" ? LEN.shoulderW : -LEN.shoulderW;
  out.set(p.fx + sx, p.h + LEN.neck - LEN.shoulderDrop - (LEN.upper + LEN.fore) * 0.95, p.fz + 0.04).lerp(target, Math.min(1, k));
  if (side === "L") p.handL = out;
  else p.handR = out;
}

/**
 * The crumple every lethal variant ends in: knees go from `t0`, he sinks to kneel by `t1` (pelvis 0.55 m down),
 * then from `t1` to `t2` he is laid forward onto his front (or back onto his back with `back`), slowly: no crash.
 */
function crumple(p: PoseP, t: number, t0: number, t1: number, t2: number, back = false, drop = 0.5): void {
  const k = ss(t, t0, t1);
  const lay = ss(t, t1, t2);
  if (k <= 0 && lay <= 0) return;
  // Kneel: the pelvis down, knees forward over still feet.
  p.h -= drop * k * (1 - lay);
  if (!back) {
    p.pitch = (p.pitch + 0.3 * k) * (1 - lay) + 1.38 * lay;
    p.fz += 0.32 * lay;
    p.h = p.h * (1 - lay) + 0.2 * lay;
    p.head = p.head * (1 - lay) + 0.05 * lay;
    for (const f of [p.footL, p.footR]) {
      f.z += (-0.18 * k) * (1 - lay) - 0.62 * lay;
      f.y = REST.footL.y + 0.02 * lay;
    }
    p.kneeUp = -0.5 * lay;
  } else {
    p.pitch = p.pitch * (1 - lay) - 1.4 * lay;
    p.fz -= 0.3 * lay;
    p.h = p.h * (1 - lay) + 0.19 * lay;
    p.head = p.head * (1 - lay) + 0.2 * lay;
    p.footL.z += 0.18 * lay;
    p.footR.z += 0.3 * lay;
    p.kneeUp = 0.6 * lay;
    p.kneeOut = 0.4 * lay;
  }
}

/**
 * His pose `t` ms into the variant, body space (feet on y = 0, facing +z, +x his left), for Cath standing on
 * `side` (+1 his left, -1 his right) for the side approaches. `wallM`: the wall on his far side (sideWall).
 */
export function targetPose(v: TakedownVariant, t: number, side: number, out: Record<Joint, THREE.Vector3>, wallM = 1): void {
  const p = blank(P0);
  const nk = nkV;
  switch (v.id) {
    case "behindWrap":
    case "behindChoke": {
      // Pulled back into her, off balance: the pelvis 0.2 m back and a little down, knees giving, heels dragged
      // back under him, the spine leaning back, the head forced back 30 degrees.
      // (Not into her face: his head stays a forearm's length ahead of her eyes, so the shot can frame it.)
      const pull = ss(t, 40, 300);
      p.fz = -0.1 * pull;
      p.h -= 0.07 * pull;
      p.pitch = -0.13 * pull;
      p.head = -0.52 * pull;
      p.footL.z -= 0.1 * pull;
      p.footR.z -= 0.03 * pull;
      p.footR.x -= 0.04 * pull;
      // He grabs her forearm across his throat.
      neckOf(p, nk);
      const grab = ss(t, 110, 300);
      if (v.id === "behindWrap") {
        // 420: the baton to his right temple. The head snaps 40 degrees toward his left, then hangs.
        const hit = snap(t, 420, 500);
        p.headRoll = -0.7 * hit + 0.25 * ss(t, 520, 800);
        p.head = -0.52 * pull * (1 - ss(t, 430, 700)) + 0.35 * ss(t, 500, 860);
        const let_ = 1 - ss(t, 440, 560);
        reach(p, "L", tmpV.set(nk.x + 0.05, nk.y - 0.08, nk.z + 0.12), grab * let_);
        reach(p, "R", tmpV2.set(nk.x - 0.07, nk.y - 0.1, nk.z + 0.1), grab * let_);
        // The knees buckle (420 to 900), then Cath lays him forward on his front.
        crumple(p, t, 440, 800, 1190);
      } else {
        // The choke: harder back, his heels scrabbling, she sinks with him; at 900 he goes slack.
        const pull2 = ss(t, 300, 880);
        p.head = -0.52 * pull - 0.15 * pull2;
        p.h -= 0.38 * pull2;
        const kick = Math.sin(t / 55) * (1 - ss(t, 700, 900)) * ss(t, 150, 300);
        p.footL.z += 0.08 * kick;
        p.footR.z -= 0.07 * kick;
        const slack = ss(t, 890, 1120);
        p.head = p.head * (1 - slack) + 0.45 * slack;
        reach(p, "L", tmpV.set(nk.x + 0.06, nk.y - 0.09, nk.z + 0.12 + 0.02 * kick), grab * (1 - slack));
        reach(p, "R", tmpV2.set(nk.x - 0.05, nk.y - 0.08, nk.z + 0.11), grab * (1 - slack));
        crumple(p, t, 800, 990, 1345, false, 0.18);
      }
      break;
    }
    case "behindPistol": {
      // Her hand over his mouth drags the head back and up; the Kestrel under the jaw; 650 the round goes up.
      const pull = ss(t, 40, 280);
      p.fz = -0.09 * pull;
      p.h -= 0.06 * pull;
      p.pitch = -0.15 * pull;
      p.head = -0.62 * pull;
      p.footL.z -= 0.08 * pull;
      neckOf(p, nk);
      const grab = ss(t, 120, 320) * (1 - ss(t, 650, 720));
      reach(p, "L", tmpV.set(nk.x + 0.02, nk.y + 0.08, nk.z + 0.13), grab);
      reach(p, "R", tmpV2.set(nk.x - 0.1, nk.y - 0.05, nk.z + 0.08), grab * 0.8);
      const hit = snap(t, 650, 720);
      p.head -= 0.25 * hit;
      p.headRoll = -0.3 * hit;
      // Then it lolls forward as the knees go.
      p.head += 0.75 * ss(t, 720, 920);
      crumple(p, t, 660, 860, 1290);
      break;
    }
    case "frontCollar": {
      // She has him by the collar (he is dragged a step to her); 300 the pistol-whip across his left temple snaps
      // the head to his right; 650 the muzzle under his chin and he goes over backward.
      const drag = ss(t, 30, 260);
      p.fz = 0.1 * drag;
      p.pitch = 0.12 * drag;
      const whip = snap(t, 300, 380);
      p.headRoll = 0.65 * whip * (1 - ss(t, 420, 640) * 0.6);
      p.twist = -0.2 * whip;
      p.head = 0.25 * whip * (1 - ss(t, 560, 650));
      const shot = snap(t, 650, 720);
      p.head -= 0.75 * shot;
      p.pitch -= 0.2 * shot;
      neckOf(p, nk);
      reach(p, "L", tmpV.set(nk.x + 0.12, nk.y - 0.2, nk.z + 0.2), ss(t, 120, 300) * (1 - ss(t, 650, 700)));
      crumple(p, t, 660, 800, 1195, true);
      break;
    }
    case "frontKick": {
      // The boot to his chest at 200 lifts him 1.5 m back onto his back by 560; the double tap at 700 and 820.
      const u = ss(t, 200, 560);
      const air = Math.sin(Math.PI * Math.min(1, Math.max(0, (t - 200) / 340)));
      p.fz = -1.5 * easeOut((t - 200) / 380);
      p.h = REST.pelvis.y + 0.25 * air - 0.78 * u;
      p.pitch = -1.42 * ss(t, 220, 560);
      p.head = 0.45 * ss(t, 200, 320) * (1 - u) + 0.15 * u;
      p.footL.set(STANCE_L.x + 0.04, 0.06 + 0.35 * air, p.fz + 0.55 * u + 0.1);
      p.footR.set(STANCE_R.x - 0.06, 0.06 + 0.25 * air, p.fz + 0.68 * u);
      p.kneeUp = 0.8 * u;
      for (const s of [700, 820]) {
        const j = snap(t, s, s + 70) * (1 - ss(t, s + 70, s + 160));
        p.pitch += 0.06 * j;
        p.head += 0.3 * j;
      }
      // Arms flung forward in the air, then out on the street.
      neckOf(p, nk);
      reach(p, "L", tmpV.set(0.45, Math.max(0.08, p.h + 0.2 - 0.3 * u), p.fz + 0.25 + 0.2 * u), ss(t, 200, 330));
      reach(p, "R", tmpV2.set(-0.5, Math.max(0.08, p.h + 0.25 - 0.3 * u), p.fz + 0.35 + 0.25 * u), ss(t, 200, 330));
      break;
    }
    case "frontBaton": {
      // 250 the gut strike folds him over; 600 the downstrike to the back of the neck, and he goes down on his face.
      const fold = snap(t, 250, 340);
      p.pitch = 0.62 * fold;
      p.h -= 0.16 * fold;
      p.head = 0.3 * fold;
      p.fz = -0.08 * fold;
      neckOf(p, nk);
      const clutch = ss(t, 260, 380) * (1 - ss(t, 600, 680));
      reach(p, "L", tmpV.set(0.05, p.h + 0.12, p.fz + 0.22), clutch);
      reach(p, "R", tmpV2.set(-0.06, p.h + 0.15, p.fz + 0.23), clutch);
      const down = snap(t, 600, 660);
      p.head += 0.35 * down;
      crumple(p, t, 610, 760, 1100);
      break;
    }
    case "sideKnee":
    case "sideSweep":
    case "sideWall": {
      const s = side >= 0 ? 1 : -1; // her side: +1 his left
      if (v.id === "sideKnee") {
        // 250 the baton takes his near knee: down on it; 600 her elbow to his head throws it away from her.
        const knee = snap(t, 250, 330);
        p.h -= 0.32 * knee;
        p.roll = 0.12 * s * knee; // leaning toward her side (roll + is his right)
        const near = s > 0 ? p.footL : p.footR;
        near.z -= 0.34 * knee;
        near.y += 0.04 * knee;
        const elb = snap(t, 600, 670);
        p.headRoll = s * 0.75 * elb; // away from her
        p.roll -= 0.25 * s * elb;
        crumple(p, t, 620, 760, 1100);
      } else if (v.id === "sideSweep") {
        // 300 the sweep takes his legs toward her and he goes down on his back; 720 the downstrike.
        const sw = ss(t, 300, 520);
        const lift = Math.sin(Math.PI * Math.min(1, Math.max(0, (t - 300) / 260)));
        p.h = REST.pelvis.y - 0.78 * sw + 0.08 * lift;
        p.pitch = -1.38 * ss(t, 320, 560);
        p.fz = -0.3 * sw;
        for (const f of [p.footL, p.footR]) {
          f.x += s * 0.35 * sw;
          f.y += 0.3 * lift;
          f.z += 0.45 * sw;
        }
        p.kneeUp = 0.5 * sw;
        const hit = snap(t, 720, 790);
        p.headRoll = -s * 0.5 * hit;
      } else {
        // 420 she drives him sideways into the wall on his far side: the head off it, then a slump down it to sit.
        const go = easeOut((t - 120) / 300);
        const wd = Math.max(0.35, Math.min(1.5, wallM) - 0.32);
        p.fx = -s * wd * go;
        p.roll = -s * 0.32 * go;
        const bang = snap(t, 420, 480);
        p.headRoll = -s * (0.25 * go) + s * 0.5 * bang;
        const slide = ss(t, 470, 1000);
        p.h = REST.pelvis.y - 0.78 * slide;
        p.roll = -s * (0.32 - 0.22 * slide) * go;
        p.fx = -s * (wd - 0.08 * slide) * go;
        p.footL.x += s * 0.3 * slide;
        p.footR.x += s * 0.3 * slide;
        p.footL.z += 0.42 * slide;
        p.footR.z += 0.62 * slide;
        p.kneeUp = 2.4 * slide;
        p.kneeOut = 0.9 * slide;
        p.head = 0.5 * ss(t, 700, 1000);
      }
      break;
    }
    case "downStrike": {
      // He is already on his back; his head comes up to see her, 380 the baton comes down.
      p.h = 0.2;
      p.pitch = -1.42;
      p.fz = -0.4;
      p.footL.z = 0.2;
      p.footR.z = 0.32;
      p.kneeUp = 0.7;
      const look = ss(t, 0, 300) * (1 - snap(t, 380, 440));
      p.head = 0.55 * look + 0.1;
      p.headRoll = 0.45 * snap(t, 380, 440);
      reach(p, "L", tmpV.set(0.3, 0.45, -0.25), ss(t, 60, 300) * (1 - ss(t, 380, 500)));
      break;
    }
    case "surrender": {
      // On his knees, hands up; 520 the baton to the side of his head, and he topples forward.
      p.h -= 0.48;
      for (const f of [p.footL, p.footR]) f.z -= 0.2;
      p.pitch = 0.05;
      neckOf(p, nk);
      const up = 1 - ss(t, 520, 600);
      reach(p, "L", tmpV.set(0.22, nk.y + 0.25, nk.z + 0.05), up);
      reach(p, "R", tmpV2.set(-0.22, nk.y + 0.25, nk.z + 0.05), up);
      p.headRoll = 0.6 * snap(t, 520, 590);
      crumple(p, t, 540, 560, 960);
      break;
    }
  }
  buildPose(p, out);
}

/** S5.2's body script for a variant: kinematic while held, a powered ragdoll after release, his own clock. */
export function targetScript(v: TakedownVariant, side: number, wallM = 1): DeathScript {
  const relax = v.releaseMs + 120;
  return {
    durMs: v.durMs,
    // 4 per 60 Hz frame clamps to 1 (kinematic) at any frame rate; from her release it fades to nothing by the end.
    k: (t) => 4 * (1 - ss(t, relax, v.durMs)) + 0.0001,
    pose: (t, out) => targetPose(v, t, side, out, wallM),
  };
}

// ------------------------------------------------------------------ her arms in the street

/** A grip on the neck, a hand over a mouth, a fist in a collar: the left hand's shapes. */
const HANDS: Record<string, HandPose> = {
  wrap: { curl: [0.85, 0.95, 1.0, 1.05], wrap: 0.25, thumb: [-0.35, 0.1, 0.35], thumbCurl: [0.3, 0.2] },
  clamp: { curl: [0.45, 0.5, 0.55, 0.6], wrap: 0.1, thumb: [-0.6, 0.2, 0.5], thumbCurl: [0.25, 0.15] },
  rest: { curl: [0.35, 0.45, 0.55, 0.65], wrap: 0.05, thumb: [-0.4, 0.15, 0.3], thumbCurl: [0.15, 0.1] },
  fist: POSES.fist!,
};

type Prop = "pin" | "pistol" | "fist";

/** A frame for her: where she stands, which way she faces, her right, and up. World space. */
export interface CathFrame {
  feet: THREE.Vector3;
  f: THREE.Vector3;
  r: THREE.Vector3;
}

/** Her right and left hands this frame: wrist, a direction for the prop (or the knuckles), the back of the hand. */
interface HandsKey {
  prop: Prop;
  rW: THREE.Vector3;
  rAxis: THREE.Vector3;
  rDorsal: THREE.Vector3;
  lW: THREE.Vector3 | null;
  lKnuckles: THREE.Vector3;
  lDorsal: THREE.Vector3;
  lPose: HandPose;
  /** The gun's muzzle here (world), the wrist found from it: the Kestrel pressed under a jaw, never through it. */
  muzzleAt?: THREE.Vector3;
  /** Where the left elbow goes (her frame, from the shoulder-wrist midpoint), or the default out and down. */
  lPole?: THREE.Vector3;
  /** How far she leans in (0..1 of TD.lean). */
  lean: number;
}

const vA = new THREE.Vector3();
const vB = new THREE.Vector3();
const vC = new THREE.Vector3();
const vD = new THREE.Vector3();
/**
 * Her hands' per-frame scratch: a pool handed out in order and rewound at the top of each `cathHands` (its
 * vectors live until her arms are posed, the same frame), so a takedown allocates nothing per frame.
 */
const POOL: THREE.Vector3[] = [];
let poolAt = 0;
const tv = (): THREE.Vector3 => (POOL[poolAt++] ??= new THREE.Vector3());
const lerp3 = (a: THREE.Vector3, b: THREE.Vector3, k: number) => tv().copy(a).lerp(b, Math.min(1, Math.max(0, k)));

/** A point in her frame (right, up, forward) from `base`. */
function at(F: CathFrame, base: THREE.Vector3, r: number, u: number, f: number): THREE.Vector3 {
  return tv().copy(base).addScaledVector(F.r, r).addScaledVector(F.f, f).add(vC.set(0, u, 0));
}
function dir(F: CathFrame, r: number, u: number, f: number): THREE.Vector3 {
  return tv().set(0, u, 0).addScaledVector(F.r, r).addScaledVector(F.f, f).normalize();
}

/** Her hands `t` ms in, from his joints this frame (world) and her frame. */
function cathHands(v: TakedownVariant, t: number, J: Record<Joint, THREE.Vector3>, F: CathFrame, side: number, pistol: boolean): HandsKey {
  poolAt = 0;
  const eye = tv().copy(F.feet).add(vA.set(0, TD.eye, 0));
  // Rest: low and in front of her, as if the gun had just been lowered; once she has let him go they drop on out
  // of the lens (the session hides the rig once they are gone), so nothing hangs in the frame while the view
  // comes home and her own gun comes back up.
  const gone = ss(t, v.releaseMs + 120, v.releaseMs + 320);
  const restR = at(F, eye, 0.2, -0.45 - 0.55 * gone, 0.3 - 0.2 * gone);
  const restL = at(F, eye, -0.2, -0.45 - 0.55 * gone, 0.28 - 0.2 * gone);
  const k: HandsKey = {
    prop: v.kind === "shot" && pistol ? "pistol" : "pin",
    rW: restR,
    rAxis: dir(F, 0.1, 0.5, 0.85),
    rDorsal: dir(F, 0.7, 0.2, -0.2),
    lW: restL,
    lKnuckles: dir(F, 0.1, 0.1, 1),
    lDorsal: dir(F, -0.6, 0.6, 0),
    lPose: HANDS.rest!,
    lean: 0,
  };
  const out = 1 - ss(t, v.releaseMs, v.releaseMs + 220);
  switch (v.id) {
    case "behindWrap":
    case "behindChoke": {
      // The left forearm across his throat, the hand round the far side of his neck.
      const wrap = ss(t, 40, 240);
      k.lean = wrap * out;
      const W = TD.wrap;
      const throat = at(F, J.neck, W.r, W.u, W.f);
      k.lW = lerp3(restL, throat, wrap * out);
      k.lKnuckles = dir(F, 0.9, 0, 0.3);
      k.lDorsal = dir(F, 0.1, 0.1, 1);
      k.lPose = HANDS.wrap!;
      // The elbow out round his left shoulder, so the forearm wraps the side of his neck (in the shot), not
      // tucked under his chin out of sight.
      k.lPole = tv().set(0, W.poleU, 0).addScaledVector(F.r, W.poleR).addScaledVector(F.f, W.poleF);
      if (v.id === "behindWrap") {
        // The Pin up by 380 (cocked high, over her right shoulder), down on his temple at 420, a bounce, then lowered.
        const raise = ss(t, 120, 360);
        const swing = ss(t, 372, 420);
        const back = ss(t, 470, 620) * 0.6 + ss(t, 620, 900) * 0.4;
        const up = at(F, J.head, 0.3, 0.3, -0.1);
        const hit = at(F, J.head, 0.36, 0.2, -0.04);
        k.rW = lerp3(lerp3(lerp3(restR, up, raise), hit, swing), restR, back);
        const axUp = dir(F, -0.1, 0.85, -0.5);
        // Coming down on his temple: the Pin's tip down and across onto the side of his head.
        const axHit = dir(F, -0.68, -0.6, 0.35);
        k.rAxis = lerp3(lerp3(lerp3(k.rAxis, axUp, raise), axHit, swing), dir(F, -0.2, 0.3, 0.9), back).normalize();
        k.rDorsal = dir(F, 0.3, 0.9, 0.2);
      } else {
        // The figure-four: her right hand on the back of his head, pushing it forward into the lock.
        const lock = ss(t, 120, 320) * out;
        k.prop = "fist";
        k.rW = lerp3(restR, at(F, J.head, 0.08, -0.04, -0.13), lock);
        k.rAxis = dir(F, -0.3, 0.75, 0.55);
        k.rDorsal = dir(F, 0.2, 0.2, -1);
      }
      break;
    }
    case "behindPistol": {
      const grab = ss(t, 40, 240) * out;
      k.lean = grab;
      // The left hand over his mouth, the right with the Kestrel up under his jaw.
      k.lW = lerp3(restL, at(F, J.head, -0.06, -0.08, 0.06), grab);
      k.lKnuckles = dir(F, 0.85, 0, 0.45);
      k.lDorsal = dir(F, 0, 0.2, 1);
      k.lPose = HANDS.clamp!;
      const jaw = ss(t, 140, 420);
      const recoil = snap(t, 650, 700) * (1 - ss(t, 700, 820));
      const away = ss(t, 760, 1000);
      k.rAxis = lerp3(k.rAxis, dir(F, -0.2, 0.9, 0.3), jaw * (1 - away)).addScaledVector(F.f, -0.2 * recoil).normalize();
      // The muzzle up under the right side of his jaw (his helmet's chin), the gun hanging below it beside his neck.
      if (jaw * (1 - away) > 0.02) k.muzzleAt = lerp3(at(F, restR, 0, 0.25, 0.1), at(F, tv().copy(J.neck).lerp(J.head, 0.3), 0.07, 0, 0.04).addScaledVector(F.f, -0.01 * recoil), jaw * (1 - away));
      k.rDorsal = dir(F, 0.9, -0.2, 0.1);
      break;
    }
    case "frontCollar": {
      const grab = ss(t, 30, 240) * (1 - ss(t, 700, 900));
      k.lean = grab * 0.5;
      // A fist in his collar on her left of his throat, low, so the Kestrel comes up under his jaw in the open.
      k.lW = lerp3(restL, at(F, J.chest, -0.11, 0.12, -0.16), grab);
      k.lKnuckles = dir(F, 0, 0.6, 0.8);
      k.lDorsal = dir(F, 0, 0.1, -1);
      k.lPose = HANDS.fist!;
      if (pistol) {
        // 300: the pistol-whip, butt first, across his left temple (her right); 650 the muzzle under his chin.
        const wind = ss(t, 80, 260) * (1 - ss(t, 300, 360));
        const whip = ss(t, 280, 310);
        const chin = ss(t, 420, 620);
        const wW = at(F, J.head, 0.46, 0.14, -0.28);
        const wH = at(F, J.head, 0.12, 0, -0.14);
        k.rW = lerp3(lerp3(restR, wW, wind), wH, whip);
        const under = chin * (1 - ss(t, 760, 1000));
        k.rAxis = lerp3(dir(F, -0.6, -0.6, 0.5), dir(F, -0.45, 0.8, 0.3), under).normalize();
        // 650: the muzzle pressed up under his chin (the gun angled in from below, in the open between her fists).
        if (under > 0.02) k.muzzleAt = lerp3(at(F, k.rW, 0, 0.2, 0), at(F, tv().copy(J.neck).lerp(J.head, 0.3), 0.02, 0, -0.1), under);
        k.rDorsal = dir(F, 0.6, 0.4, -0.3);
      }
      break;
    }
    case "frontKick": {
      // Both hands come up to the Kestrel as he lands and she puts two in him.
      const aim = ss(t, 420, 640) * out;
      const target = tv().copy(J.chest).lerp(J.head, 0.3);
      const muzzleTo = tv().copy(target).sub(at(F, eye, 0.1, -0.3, 0.45)).normalize();
      const recoil = (snap(t, 700, 740) * (1 - ss(t, 740, 800)) + snap(t, 820, 860) * (1 - ss(t, 860, 920))) * 0.06;
      k.rW = lerp3(restR, at(F, eye, 0.08, -0.32 + recoil, 0.42 - recoil), aim);
      k.rAxis = lerp3(k.rAxis, muzzleTo, aim).normalize();
      k.rDorsal = dir(F, 0.9, 0.3, 0);
      k.lW = lerp3(restL, at(F, eye, 0.04, -0.36 + recoil, 0.38 - recoil), aim);
      k.lKnuckles = dir(F, 0.6, 0.2, 0.75);
      k.lDorsal = dir(F, -0.8, 0.3, 0.2);
      k.lPose = HANDS.wrap!;
      // The kick: both arms flung out for balance as she drives off.
      const kick = Math.sin(Math.PI * Math.min(1, Math.max(0, (t - 120) / 260)));
      k.rW.addScaledVector(F.r, 0.12 * kick).add(vA.set(0, 0.06 * kick, 0));
      k.lW!.addScaledVector(F.r, -0.14 * kick).add(vA.set(0, 0.08 * kick, 0));
      break;
    }
    case "frontBaton":
    case "sideKnee":
    case "sideSweep":
    case "sideWall":
    case "downStrike":
    case "surrender": {
      // The Pin: wind-ups and blows at each impact time, her left hand on him (or out for balance).
      const blows = blowsInOrder(v);
      let r = tv().copy(restR);
      let ax = tv().copy(k.rAxis);
      for (const b of blows) {
        const wind = ss(t, b - 230, b - 50);
        const hit = ss(t, b - 45, b);
        const after = ss(t, b + 40, b + 260);
        const tgt = v.id === "frontBaton" && b === 250 ? tv().copy(J.pelvis).lerp(J.chest, 0.4) : v.id === "sideKnee" && b === 250 ? tv().copy(side > 0 ? J.kneeL : J.kneeR) : tv().copy(J.head);
        const from = at(F, eye, 0.36, 0.2, 0.15);
        const contact = at(F, tgt, 0.36, 0.12, -0.18);
        const axW = dir(F, -0.1, 0.85, -0.45);
        const axH = v.id === "frontBaton" && b === 250 ? dir(F, -0.5, -0.1, 0.85) : dir(F, -0.55, -0.55, 0.6);
        r = lerp3(lerp3(lerp3(r, from, wind), contact, hit), lerp3(from, restR, 0.5), after * (b === blows[blows.length - 1] ? 1 : 0.6));
        ax = lerp3(lerp3(lerp3(ax, axW, wind), axH, hit), dir(F, 0, 0.4, 0.9), after).normalize();
      }
      if (v.id === "sideKnee") {
        // The elbow at 600 is hers, not the Pin's: the right forearm swings flat into his head.
        const e = ss(t, 480, 600) * (1 - ss(t, 680, 860));
        r = lerp3(r, at(F, J.head, 0.22, -0.02, -0.25), e);
        ax = lerp3(ax, dir(F, -0.95, 0, 0.3), e).normalize();
      }
      k.rW = lerp3(r, restR, ss(t, v.releaseMs, v.releaseMs + 260));
      k.rAxis = ax;
      k.rDorsal = dir(F, 0.4, 0.8, 0.2);
      if (v.id === "frontBaton" || v.id === "surrender") {
        const hold = ss(t, 20, 200) * (1 - ss(t, 560, 700));
        k.lW = lerp3(restL, at(F, J.chest, -0.04, 0.14, -0.15), hold);
        k.lKnuckles = dir(F, 0, 0.6, 0.8);
        k.lDorsal = dir(F, 0, 0.1, -1);
        k.lPose = HANDS.fist!;
        k.lean = hold * 0.4;
      } else if (v.id === "sideWall") {
        const shove = ss(t, 60, 260) * (1 - ss(t, 520, 700));
        k.lW = lerp3(restL, at(F, J.chest, -0.05, 0.05, -0.12), shove);
        k.lKnuckles = dir(F, 0, 1, 0.1);
        k.lDorsal = dir(F, 0, 0.1, -1);
        k.lPose = HANDS.rest!;
        k.lean = shove;
      } else k.lW = at(F, restL, -0.12, 0.12, -0.05);
      break;
    }
  }
  return k;
}

/** Her arms and the props they hold, in the world scene (built once, shown only for a takedown). */
export class TakedownRig {
  readonly group = new THREE.Group();
  readonly arms: Arms;
  readonly props: Record<"pin" | "pistol", { rig: GunRig; grip: THREE.Matrix4; gripInv: THREE.Matrix4; axis: THREE.Vector3; dorsal: THREE.Vector3 }>;
  private readonly fistGrip = new THREE.Object3D();
  private readonly gripL = new THREE.Object3D();
  readonly muzzle = new THREE.Vector3();
  /** The prop's axis this frame (the Kestrel's barrel), for the finisher's muzzle flash. */
  readonly axis = new THREE.Vector3(0, 0, -1);
  /** Her wrists this frame (the camera keeps the blow in frame; the stages check they are on screen). */
  readonly wrist = new THREE.Vector3();
  readonly wristL = new THREE.Vector3();
  hasL = false;
  /** The last pose's anchors (world), for the review stages. */
  debug: Record<string, number[] | null> = {};
  /** Record `debug` (the review stages set it; the live game doesn't pay for it). */
  keepDebug = false;

  constructor(phone: boolean) {
    this.group.name = "takedown:rig";
    this.arms = new Arms(phone);
    // Her arms in the street take the street's lights (a lamp overhead, the sequence's rim): built for the
    // viewmodel's own soft rig, the charcoal gabardine went peach under them (C11 review). Their own copy of the
    // kit material, its albedo a step down, keeps the trench charcoal and the gloves black at 0.3 m.
    const mat = phone ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 1 }) : new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 1, metalness: 1, clearcoat: 0.3, clearcoatRoughness: 0.22, sheen: 0.25, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xd8d0cc) });
    patchKitMaterial(mat, phone);
    // What washed it out was the dielectric's grazing specular under a lamp straight ahead (a rough sleeve lit from
    // behind went pale peach), not the albedo: damp it for cloth and leather (metal keeps it).
    const kit = mat.onBeforeCompile;
    mat.onBeforeCompile = (sh, r) => {
      kit.call(mat, sh, r);
      sh.fragmentShader = sh.fragmentShader.replace(
        "#include <lights_physical_fragment>",
        `#include <lights_physical_fragment>
material.specularColor *= mix(${TD.armSpec.toFixed(3)}, 1.0, step(0.5, vMR.x));
material.specularF90 *= mix(${TD.armSpec.toFixed(3)}, 1.0, step(0.5, vMR.x));`,
      );
    };
    mat.customProgramCacheKey = () => `gunkit-${phone ? "p" : "d"}-takedown`;
    mat.color.setScalar(TD.armTone);
    this.arms.right.mesh.material = mat;
    this.arms.left.mesh.material = mat;
    this.group.add(this.arms.right.mesh, this.arms.left.mesh, this.fistGrip, this.gripL);
    const mk = (model: "pin" | "pistol") => {
      const rig = buildGun(model, phone);
      rig.flashMesh?.removeFromParent();
      rig.root.position.set(0, 0, 0);
      rig.root.quaternion.identity();
      rig.root.updateMatrixWorld(true);
      const grip = rig.gripR.matrixWorld.clone();
      const gq = new THREE.Quaternion().setFromRotationMatrix(grip);
      const gp = new THREE.Vector3().setFromMatrixPosition(grip);
      const tip = model === "pin" ? rig.muzzle.getWorldPosition(new THREE.Vector3()).sub(gp) : new THREE.Vector3(0, 0, -1);
      const inv = gq.clone().invert();
      this.group.add(rig.root);
      rig.root.visible = false;
      return { rig, grip, gripInv: grip.clone().invert(), axis: tip.normalize().applyQuaternion(inv), dorsal: new THREE.Vector3(0, 0, 1) };
    };
    this.props = { pin: mk("pin"), pistol: mk("pistol") };
    this.group.traverse((o) => {
      o.frustumCulled = false;
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = false;
    });
    this.group.visible = false;
  }

  /** Poses both arms for this frame. */
  pose(k: HandsKey, F: CathFrame): void {
    this.wrist.copy(k.rW);
    this.hasL = !!k.lW;
    if (k.lW) this.wristL.copy(k.lW);
    const eye = rE.copy(F.feet).add(vA.set(0, TD.eye, 0)).addScaledVector(F.f, TD.lean * k.lean);
    const shR = rShR.copy(eye).add(vB.set(0, -TD.shoulderDrop, 0)).addScaledVector(F.r, TD.shoulderW).addScaledVector(F.f, -0.04);
    const shL = rShL.copy(eye).add(vB.set(0, -TD.shoulderDrop, 0)).addScaledVector(F.r, -TD.shoulderW).addScaledVector(F.f, -0.04);
    // Elbows out and down, in her frame.
    const poleR = rPR.copy(F.r).multiplyScalar(0.4).add(vB.set(0, -0.55, 0)).addScaledVector(F.f, -0.1);
    const poleL = rPL.copy(F.r).multiplyScalar(-0.4).add(vB.set(0, -0.55, 0)).addScaledVector(F.f, -0.1);
    for (const id of ["pin", "pistol"] as const) this.props[id].rig.root.visible = k.prop === id;
    let grip: THREE.Object3D;
    let pose: HandPose;
    if (k.prop === "fist") {
      const g = gripFrame(k.rW, k.rAxis, k.rDorsal);
      this.fistGrip.position.copy(g.pos);
      this.fistGrip.quaternion.copy(g.quat);
      this.fistGrip.updateMatrixWorld(true);
      grip = this.fistGrip;
      pose = HANDS.fist!;
    } else {
      const P = this.props[k.prop];
      // The wrist frame that turns the prop's axis onto rAxis with the back of the hand toward rDorsal.
      const q = basisQuat(k.rAxis, k.rDorsal, rQ).multiply(basisQuat(P.axis, P.dorsal, rQ2).invert());
      const m = rM.compose(k.rW, q, ONE).multiply(P.gripInv);
      m.decompose(P.rig.root.position, P.rig.root.quaternion, P.rig.root.scale);
      P.rig.root.updateMatrixWorld(true);
      if (k.muzzleAt) {
        // Placed by its muzzle: the whole gun (and so her wrist) slides by the miss.
        P.rig.muzzle.getWorldPosition(this.muzzle);
        vD.subVectors(k.muzzleAt, this.muzzle);
        P.rig.root.position.add(vD);
        k.rW.add(vD);
        this.wrist.copy(k.rW);
        P.rig.root.updateMatrixWorld(true);
      }
      grip = P.rig.gripR;
      pose = P.rig.poseR;
      P.rig.muzzle.getWorldPosition(this.muzzle);
      this.axis.copy(k.rAxis);
    }
    if (this.keepDebug) this.debug = { shR: shR.toArray(), shL: shL.toArray(), rW: k.rW.toArray(), lW: k.lW?.toArray() ?? null };
    this.arms.right.pose(grip, shR, pose, 0, poleR);
    if (k.lW) {
      const g = gripFrame(k.lW, k.lKnuckles, k.lDorsal);
      this.gripL.position.copy(g.pos);
      this.gripL.quaternion.copy(g.quat);
      this.gripL.updateMatrixWorld(true);
      this.arms.left.mesh.visible = true;
      this.arms.left.pose(this.gripL, shL, k.lPose, 0, k.lPole ?? poleL);
    } else this.arms.left.mesh.visible = false;
  }
}

/** A rotation whose Y goes along `y` and whose Z is as near `z` as it can be (an orthonormal basis). */
function basisQuat(y: THREE.Vector3, z: THREE.Vector3, out: THREE.Quaternion): THREE.Quaternion {
  const Y = bY.copy(y).normalize();
  const Z = bZ.copy(z).addScaledVector(Y, -z.dot(Y));
  if (Z.lengthSq() < 1e-8) Z.set(0, 0, 1).addScaledVector(Y, -Y.z);
  Z.normalize();
  const X = bX.crossVectors(Y, Z).normalize();
  return out.setFromRotationMatrix(bM.makeBasis(X, Y, Z));
}
const bX = new THREE.Vector3();
const bY = new THREE.Vector3();
const bZ = new THREE.Vector3();
const bM = new THREE.Matrix4();
/** The rig's pose scratch. */
const rE = new THREE.Vector3();
const rShR = new THREE.Vector3();
const rShL = new THREE.Vector3();
const rPR = new THREE.Vector3();
const rPL = new THREE.Vector3();
const rQ = new THREE.Quaternion();
const rQ2 = new THREE.Quaternion();
const rM = new THREE.Matrix4();
const ONE = new THREE.Vector3(1, 1, 1);

// ------------------------------------------------------------------ the director

/** The camera's scratch (no allocations per frame). */
const cE = new THREE.Vector3();
const cP = new THREE.Vector3();
const cD = new THREE.Vector3();
const cQ = new THREE.Quaternion();
const cQ2 = new THREE.Quaternion();
const cEu = new THREE.Euler();

export interface TakedownStart {
  target: TakedownTarget;
  variant: TakedownVariant;
  approach: TakedownApproach;
  /** Her feet now and at the sync point (world), and the camera she starts from. */
  from: THREE.Vector3;
  sync: THREE.Vector3;
  /** +1 she is on his left, -1 his right (side approaches). */
  side: number;
  pistol: boolean;
  /** The first takedown of a new save (S5.2: forced Behind A at 0.3, the Cath line at 1,000 ms). */
  first: boolean;
  wallM?: number;
}

export class Takedown {
  active = false;
  target: TakedownTarget | null = null;
  variant: TakedownVariant | null = null;
  /** The sequence clock (ms; stops during a hit-stop), and real ms since the press. */
  t = 0;
  real = 0;
  /** Real ms the last sequence locked input for (for the e2e). */
  lockMs = 0;
  readonly events: TakedownEvent[] = [];
  readonly rig: TakedownRig;
  private stopLeft = 0;
  private fired = new Set<string>();
  private start0: TakedownStart | null = null;
  readonly frame: CathFrame = { feet: new THREE.Vector3(), f: new THREE.Vector3(), r: new THREE.Vector3() };
  /** Where her feet are this frame (the magnet), and the way she faces (player yaw). */
  readonly feet = new THREE.Vector3();
  yaw = 0;
  private magnet = 120;
  /** The camera at the press (eased from) and the one the session gives back (eased to). */
  private readonly camFrom = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), fov: 75 };
  private readonly look = new THREE.Vector3();
  private lookInit = false;
  /** Recent variants (no repeat of the last two). */
  readonly recent: TakedownVariant["id"][] = [];
  /** World time while it plays (0.4; 0.3 for the first). */
  worldScale: number = TAKEDOWN.worldScale;
  private kick = 0;
  private kickV = 0;
  /** How far she leans in this frame (0..1 of TD.lean), from her hands' last pose. */
  private leanK = 0;
  /** The feel numbers, for the review harness to tune live (window.cathode.takedown.tune). */
  readonly tune = TD;
  /** Reduced motion (set by the session): no camera ease, kick, tilt or letterbox slide; the magnet is a cut. */
  reduced = false;
  /** Camera collision (set by the session): the free distance along a ray, or null. */
  castRay: ((from: THREE.Vector3, dir: THREE.Vector3, len: number) => number | null) | null = null;

  constructor(scene: THREE.Object3D, phone: boolean) {
    this.rig = new TakedownRig(phone);
    scene.add(this.rig.group);
  }

  get first(): boolean {
    return !!this.start0?.first;
  }

  begin(s: TakedownStart, cam: THREE.PerspectiveCamera): void {
    this.active = true;
    this.start0 = s;
    this.target = s.target;
    this.variant = s.variant;
    this.t = 0;
    this.real = 0;
    this.stopLeft = 0;
    this.fired.clear();
    this.events.length = 0;
    this.recent.push(s.variant.id);
    if (this.recent.length > 4) this.recent.shift();
    this.worldScale = s.first ? TAKEDOWN.firstScale : TAKEDOWN.worldScale;
    this.magnet = Math.max(TAKEDOWN.magnetMs.min, Math.min(TAKEDOWN.magnetMs.max, TAKEDOWN.magnetMs.min + s.from.distanceTo(s.sync) * TAKEDOWN.magnetMs.perM));
    cam.updateMatrixWorld();
    cam.getWorldPosition(this.camFrom.pos);
    cam.getWorldQuaternion(this.camFrom.quat);
    this.camFrom.fov = cam.fov;
    this.feet.copy(s.from);
    const to = new THREE.Vector3().subVectors(s.target.motion.pos, s.sync).setY(0);
    if (to.lengthSq() < 1e-6) to.set(0, 0, -1);
    to.normalize();
    // Player convention: forward = (-sin yaw, 0, -cos yaw).
    this.yaw = Math.atan2(-to.x, -to.z);
    this.frame.f.copy(to);
    this.frame.r.set(-to.z, 0, to.x);
    this.kick = this.kickV = 0;
    this.lookInit = false;
    this.rig.group.visible = true;
    this.emit("grab");
  }

  private emit(kind: TakedownEventKind, e: Omit<TakedownEvent, "kind"> = {}): void {
    this.events.push({ kind, ...e });
  }

  /** A blow lands: the director's own hit-stop (the session adds the world's). */
  private once(key: string): boolean {
    if (this.fired.has(key)) return false;
    this.fired.add(key);
    return true;
  }

  /**
   * Advances the sequence by real `dtMs`. Returns the ms his body should step this frame (0 during a hit-stop).
   * Events land in `events` (the session drains them).
   */
  update(dtMs: number): number {
    if (!this.active || !this.variant || !this.start0) return 0;
    const v = this.variant;
    this.real += dtMs;
    let seq = dtMs;
    if (this.stopLeft > 0) {
      const used = Math.min(this.stopLeft, seq);
      this.stopLeft -= used;
      seq -= used;
    }
    const t0 = this.t;
    this.t = Math.min(v.durMs, this.t + seq);
    // The magnet: her feet to the sync point.
    const m = this.reduced ? 1 : easeOut(this.real / this.magnet);
    this.feet.lerpVectors(this.start0.from, this.start0.sync, m);
    this.frame.feet.copy(this.feet);
    const J = this.start0.target.body.joints;
    // The blows.
    const lethal = lethalMs(v);
    for (const b of blowsInOrder(v)) {
      if (t0 < b && this.t >= b && this.once(`b${b}`)) {
        const isLethal = b === lethal;
        const head = J.head.clone();
        const at = v.id === "frontBaton" && b === 250 ? J.pelvis.clone().lerp(J.chest, 0.5) : v.id === "sideKnee" && b === 250 ? (this.start0.side > 0 ? J.kneeL : J.kneeR).clone() : head.addScaledVector(this.frame.r, v.approach === "front" ? -0.08 : 0.08);
        const d = v.kind === "shot" ? new THREE.Vector3(0, 1, 0).addScaledVector(this.frame.f, 0.4).normalize() : this.frame.r.clone().multiplyScalar(-1).addScaledVector(this.frame.f, 0.3).normalize();
        this.emit("impact", { at, dir: d, lethal: isLethal });
        if (isLethal) this.emit("lethal", { at });
        // (The choke is a squeeze, not a blow: no hold.)
        if (v.kind !== "choke") this.stopLeft += isLethal ? (v.kind === "shot" ? TD.stopShotMs : TD.stopMs) : TD.stopMinorMs;
        this.kickV += ((TD.cam.kickDeg * Math.PI) / 180) * (isLethal ? 1 : 0.6) * 14;
      }
    }
    if (t0 < v.releaseMs && this.t >= v.releaseMs && this.once("release")) this.emit("release");
    if (t0 < v.releaseMs + 160 && this.t >= v.releaseMs + 160 && this.once("lay")) this.emit("lay", { at: J.pelvis.clone() });
    if (this.start0.first && t0 < 1000 && this.t >= 1000 && this.once("line")) this.emit("line");
    // The camera kick: a spring pulled down on each blow (12 Hz, critically damped-ish).
    const dt = dtMs / 1000;
    const w = 2 * Math.PI * 7;
    this.kickV += (-w * w * this.kick - 2 * 0.75 * w * this.kickV) * dt;
    this.kick += this.kickV * dt;
    // Her arms (gone from the lens once they have dropped away after the release).
    const hk = cathHands(v, this.t, J, this.frame, this.start0.side, this.start0.pistol);
    this.leanK = hk.lean;
    this.rig.pose(hk, this.frame);
    this.rig.group.visible = this.t < v.releaseMs + 320;
    if (this.t >= v.durMs && this.stopLeft <= 0) {
      this.lockMs = this.real;
      this.emit("end");
      this.finish();
    }
    return seq;
  }

  /** Ends now (a stage reset, a death): the rig hides, nothing more fires. */
  finish(): void {
    this.active = false;
    this.rig.group.visible = false;
    this.target = null;
  }

  /**
   * Places the camera for this frame. `fp` is where first person would put it (her eyes at the sync point, her
   * yaw). The sequence's own view is first person too: from her eyes (leaning in with her), turned onto him over
   * 120 ms and back to `fp` over the last 200 (cuts under reduced motion).
   */
  applyCamera(cam: THREE.PerspectiveCamera, fp: { pos: THREE.Vector3; quat: THREE.Quaternion; fov: number }): void {
    if (!this.variant || !this.start0) return;
    const v = this.variant;
    const C = TD.cam;
    const F = this.frame;
    const J = this.start0.target.body.joints;
    const rm = this.reduced;
    const L = lensFor(v);
    const eye = cE.copy(F.feet).add(vA.set(0, TD.eye, 0)).addScaledVector(F.f, TD.lean * this.leanK);
    // What the shot is about: his neck toward his head, pulled toward her right hand so the blow is in frame; after
    // the lethal blow it drops toward his pelvis, so the knees going and the body settling stay in the shot.
    const lethal = lethalMs(v);
    const want = vB.copy(J.neck).lerp(J.head, L.head).lerp(this.rig.wrist, L.wrist);
    want.lerp(J.pelvis, 0.4 * ss(this.t, lethal + 60, lethal + 420));
    if (!this.lookInit || rm) {
      this.look.copy(want);
      this.lookInit = true;
    } else this.look.lerp(want, 0.25);
    // The lens: from her eye by the variant's offsets, then kept off his head (a lens inside the helmet is a
    // clipping bug, not a close-up): pushed back out along the line from his head.
    const camPos = cP.copy(eye).addScaledVector(F.r, L.r).addScaledVector(F.f, L.f).add(vC.set(0, L.u, 0));
    // At his ear line, not over his crown: as he sinks (the choke, the knees going) she goes down with him, to a
    // crouch at most; the man on the floor is the exception (looked down on).
    if (v.approach !== "down") camPos.y = Math.max(F.feet.y + C.minEyeM, Math.min(camPos.y, J.head.y + (L.overHead ?? C.overHeadM)));
    const away = cD.subVectors(camPos, J.head);
    const dh = away.length();
    if (dh < C.minHeadM) camPos.copy(J.head).addScaledVector(dh > 1e-4 ? away.multiplyScalar(1 / dh) : vC.copy(F.f).negate(), C.minHeadM);
    // Never through a wall behind her.
    if (this.castRay) {
      const d = cD.subVectors(camPos, eye);
      const len = d.length();
      const hit = len > 1e-4 ? this.castRay(eye, d.normalize(), len + 0.05) : null;
      if (hit !== null && hit < len + 0.05) camPos.copy(eye).addScaledVector(d, Math.max(0, hit - 0.05));
    }
    // Yaw and pitch onto him (the pitch in its window: framed, never looked straight down on).
    const d = vC.subVectors(this.look, camPos);
    const yaw = Math.atan2(-d.x, -d.z);
    const flat = Math.hypot(d.x, d.z);
    const deg = Math.PI / 180;
    const pitch = THREE.MathUtils.clamp(Math.atan2(d.y, Math.max(1e-4, flat)), (L.pitchMin ?? C.pitchMinDeg) * deg, C.pitchMaxDeg * deg);
    // The dutch tilt after the lethal blow (toward her side of him), and the kick down on each blow.
    const roll = rm ? 0 : C.rollDeg * deg * ss(this.t, lethal, v.durMs - C.easeOutMs) * (this.start0.side >= 0 ? -1 : 1);
    const q = cQ.setFromEuler(cEu.set(pitch - (rm ? 0 : this.kick), yaw, roll, "YXZ"));
    let fov = fp.fov + C.fovAdd;
    // In from first person over 120 ms; back to her own view over the last 200 (cuts under reduced motion).
    const kin = rm ? 1 : easeOut(this.real / C.easeInMs);
    const kout = rm ? (this.t >= v.durMs - C.easeOutMs ? 1 : 0) : ss(this.t, v.durMs - C.easeOutMs, v.durMs);
    const pos = cD.copy(this.camFrom.pos).lerp(camPos, kin);
    const quat = cQ2.copy(this.camFrom.quat).slerp(q, kin);
    fov = THREE.MathUtils.lerp(this.camFrom.fov, fov, kin);
    pos.lerp(fp.pos, kout);
    quat.slerp(fp.quat, kout);
    fov = THREE.MathUtils.lerp(fov, fp.fov, kout);
    cam.position.copy(pos);
    cam.quaternion.copy(quat);
    cam.fov = fov;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  }

  /** The letterbox (0..1 of the boss intro's bars); under reduced motion it is simply there, no slide. */
  bars(): number {
    if (!this.variant) return 0;
    const v = this.variant;
    if (this.reduced) return this.active && this.t < v.durMs - TD.cam.easeOutMs ? TD.bars : 0;
    return TD.bars * Math.min(easeOut(this.real / TD.cam.easeInMs), 1 - ss(this.t, v.durMs - TD.cam.easeOutMs, v.durMs));
  }
}

// ------------------------------------------------------------------ the reward orbs (S5.2)

const ORB_COLOR: Record<OrbDrop["kind"], number> = { health: 0xff3048, guard: 0x40e0ff, ammo: 0xffc860 };

let glowTex: THREE.DataTexture | null = null;
function glowTexture(): THREE.DataTexture {
  if (glowTex) return glowTex;
  const N = 32;
  const d = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const r = Math.min(1, Math.hypot((x + 0.5) / N - 0.5, (y + 0.5) / N - 0.5) * 2);
      const k = Math.pow(1 - r, 2.4);
      const o = (y * N + x) * 4;
      d[o] = d[o + 1] = d[o + 2] = 255;
      d[o + 3] = Math.round(255 * k);
    }
  glowTex = new THREE.DataTexture(d, N, N);
  glowTex.needsUpdate = true;
  return glowTex;
}

interface Orb {
  kind: OrbDrop["kind"];
  amount: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  obj: THREE.Group;
}

/** Health, Guard and ammo orbs: they pop from the body, bounce, and after 400 ms home in on her within 4 m. */
export class Orbs {
  readonly list: Orb[] = [];
  private readonly core: THREE.SphereGeometry;
  constructor(
    private readonly scene: THREE.Object3D,
    private readonly ground: (x: number, z: number) => number,
  ) {
    this.core = new THREE.SphereGeometry(0.045, 12, 8);
  }

  spawn(drops: OrbDrop[], at: THREE.Vector3, seed: number): void {
    drops.forEach((d, i) => {
      const a = seed * 2.1 + i * 2.4;
      const vel = new THREE.Vector3(Math.cos(a) * 1.2, 2.6 + (i % 2) * 0.6, Math.sin(a) * 1.2);
      const obj = new THREE.Group();
      obj.name = "takedown:orb";
      const c = ORB_COLOR[d.kind];
      const core = new THREE.Mesh(this.core, new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(2.2), toneMapped: false }));
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: c, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      glow.scale.setScalar(0.42);
      obj.add(core, glow);
      obj.position.copy(at);
      this.scene.add(obj);
      this.list.push({ kind: d.kind, amount: d.amount, pos: at.clone(), vel, age: 0, obj });
    });
  }

  /** Steps the orbs (sim seconds); returns those she collected this frame. */
  update(dt: number, cath: THREE.Vector3): Orb[] {
    const got: Orb[] = [];
    for (let i = this.list.length - 1; i >= 0; i--) {
      const o = this.list[i]!;
      o.age += dt * 1000;
      const to = vA.subVectors(cath, o.pos);
      const d = to.length();
      const pull = orbPull(o.age, d);
      if (pull > 0) {
        o.vel.lerp(to.normalize().multiplyScalar(pull), Math.min(1, dt * 8));
      } else {
        o.vel.y -= 9.8 * dt;
        o.vel.multiplyScalar(Math.exp(-dt * 0.8));
      }
      o.pos.addScaledVector(o.vel, dt);
      const g = this.ground(o.pos.x, o.pos.z) + 0.12;
      if (pull <= 0 && o.pos.y < g) {
        o.pos.y = g;
        o.vel.y = Math.abs(o.vel.y) * 0.45;
        o.vel.x *= 0.7;
        o.vel.z *= 0.7;
      }
      o.obj.position.copy(o.pos);
      o.obj.position.y += Math.sin(o.age / 180) * 0.015;
      const s = 1 + 0.12 * Math.sin(o.age / 90);
      o.obj.scale.setScalar(s);
      if (d < TAKEDOWN.orb.collectM || o.age > 30000) {
        if (d < TAKEDOWN.orb.collectM) got.push(o);
        this.remove(i);
      }
    }
    return got;
  }

  private remove(i: number): void {
    const o = this.list[i]!;
    o.obj.removeFromParent();
    o.obj.traverse((c) => {
      const m = (c as THREE.Mesh).material as THREE.Material | undefined;
      m?.dispose();
    });
    this.list.splice(i, 1);
  }

  clear(): void {
    for (let i = this.list.length - 1; i >= 0; i--) this.remove(i);
  }
}
