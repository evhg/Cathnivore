// Procedural animation for Body: a gait cycle with two-bone leg IK, arms that hold a rifle at low ready or
// shouldered, aim pitch from the hips up, crouching, and hit flinches. Writes world-space joint positions.

import * as THREE from "three";
import { REST, type Body, type Joint } from "./body";
import { deriveJoints } from "./rig";
import { FOREGRIP_M } from "./models/gear";
import type { Dir, Flinch } from "./anim/springs";
import type { ReactPose } from "./anim/react";
import { WOUNDS, limpPhase, type WoundZone } from "../sim/wounds";

export interface Motion {
  pos: THREE.Vector3;
  yaw: number;
  /** Ground speed, m/s. */
  speed: number;
  /** Gait phase, advanced by distance travelled. */
  phase: number;
  /** Looking up (+) or down (-), radians. */
  pitch: number;
  /** 0 standing .. 1 crouched. */
  crouch: number;
  /** 0 low ready .. 1 shouldered and aiming. */
  aim: number;
  /** Hit flinches (S4.1): springs kicked by each hit, applied on top of the gait and the aim. */
  flinch?: Flinch;
  /** Recoil kick 0..1. */
  kick: number;
  /** C15 (S4.2): a stagger, knockdown or visor snap playing, laid over the gait and aim, under the flinch. */
  react?: ReactPose | null;
  /**
   * C15 (S4.3): the hands after a disarm, `t` ms into the mode: shaking the stung hand (400 ms), drawing the holstered
   * sidearm (900 ms), then holding it two-handed. Absent (or "rifle"): the carbine.
   */
  arms?: { mode: "rifle" | "shake" | "draw" | "pistol"; t: number } | null;
  /**
   * C15 (S4.2) wounded layers: the limping leg and how far into it (0..1), the arm that hangs, the hunch (0..1) with
   * the hand on the worst wound, and the breath clock (s).
   */
  wound?: { limp: "L" | "R" | null; limpK: number; hang: "L" | "R" | null; hangK: number; hunch: number; worst: WoundZone | null; breath: number } | null;
  /** C15 (S4.2): crawling on his front, the crawl's own phase (rad) and a blind shot back over his shoulder (0..1). */
  crawl?: { phase: number; shoot: number; blend: number } | null;
  /**
   * C16 (S3.5, S11) firefight layers, each 0..1 and eased by the tactics: `lean` rolls the spine 25 degrees out round
   * full cover (+ his left, - his right) with the hips stepping after it; `blind` lifts the carbine over the cover in
   * both hands with his head down behind it; `reload` is ms into the 2.2 s carbine reload (-1: none), the support hand
   * going to the mag well, the chest pouch and the charging handle; `hands` raises both hands open beside his head
   * (surrender), the carbine gone.
   */
  tac?: { lean: number; blind: number; reload: number; hands: number } | null;
}

const local = {} as Record<Joint, THREE.Vector3>;
for (const j of Object.keys(REST) as Joint[]) local[j] = new THREE.Vector3();
const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const tmp = new THREE.Vector3();
const hip = new THREE.Vector3();
const foot = new THREE.Vector3();

const THIGH = REST.hipL.distanceTo(REST.kneeL);
const SHIN = REST.kneeL.distanceTo(REST.footL);
const UPPER = REST.shoulderL.distanceTo(REST.elbowL);
const FORE = REST.elbowL.distanceTo(REST.handL);

/** Two-bone IK: the middle joint for a chain root→end with lengths l1, l2, bending towards `pole`. */
// C10 review: the chain's own scratch vectors. It used to share `tmp` with its callers, who pass the pole in
// `tmp`: the first line overwrote the pole with the chain, so every knee bent inwards (knock-kneed, the knees
// touching) and every elbow tucked in under the pauldrons.
const ikD = new THREE.Vector3();
const ikDir = new THREE.Vector3();
const ikP = new THREE.Vector3();
function ik(root: THREE.Vector3, end: THREE.Vector3, l1: number, l2: number, pole: THREE.Vector3, out: THREE.Vector3): void {
  const p = ikP.subVectors(pole, root);
  const d = ikD.subVectors(end, root);
  let len = d.length();
  const max = l1 + l2 - 1e-3;
  if (len > max) {
    d.multiplyScalar(max / len);
    end.copy(root).add(d);
    len = max;
  }
  const a = (l1 * l1 - l2 * l2 + len * len) / (2 * len);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const dir = ikDir.copy(d).normalize();
  p.addScaledVector(dir, -p.dot(dir)).normalize();
  out.copy(root).addScaledVector(dir, a).addScaledVector(p, h);
}

export function animate(body: Body, m: Motion): void {
  const run = Math.min(1, m.speed / 5);
  const walk = Math.min(1, m.speed / 1.2);
  // C16: past 1 the crouch becomes a kneel behind cover (the left knee down, the right foot planted ahead), its
  // hips held higher than a squat would put them.
  const kneel = Math.max(0, Math.min(1, (m.crouch - 1) / 0.6));
  const crouchDrop = Math.min(1, m.crouch) * 0.38 + kneel * 0.14;
  const bob = Math.abs(Math.sin(m.phase)) * 0.05 * walk;
  const pelvisY = REST.pelvis.y - crouchDrop - 0.03 * run + bob;
  const lean = 0.08 * run + m.crouch * 0.15;

  const f = m.flinch;
  // C15 (S4.2): a limp warps the gait clock so the injured leg's stance is short, and drops the hip onto it.
  const wd = m.wound ?? null;
  const limpK = wd?.limp ? wd.limpK : 0;
  const injOff = wd?.limp === "R" ? Math.PI : 0;
  const phaseL = limpK > 0 ? limpPhase(m.phase, injOff, limpK) : m.phase;
  const injSin = Math.sin(phaseL + injOff);
  const limpDrop = limpK > 0 && injSin < 0 ? WOUNDS.limpHipDropM * limpK * -injSin * walk + 0.012 * limpK : 0;
  // A hit shoves the hips along the round (the feet stay planted, so the body leans off them) and a leg hit
  // drops the pelvis onto the buckling knee.
  const rootX = f ? f.get("rootX") : 0;
  const rootZ = f ? f.get("rootZ") : 0;
  const pelvisDrop = f ? f.get("pelvisDrop") : 0;
  // Spine: pelvis up through chest and neck, leaning forward when running.
  const r = m.react ?? null;
  local.pelvis.set(rootX + (r ? r.pelvisX : 0) + (wd?.limp === "L" ? -0.025 : wd?.limp === "R" ? 0.025 : 0) * limpK, pelvisY - pelvisDrop - limpDrop - (r ? r.pelvisDrop : 0), rootZ + (r ? r.pelvisZ : 0));
  const spineTilt = lean;
  const chestUp = REST.chest.y - REST.pelvis.y;
  const neckUp = REST.neck.y - REST.chest.y;
  local.chest.set(local.pelvis.x, local.pelvis.y + chestUp, local.pelvis.z + Math.sin(spineTilt) * chestUp);
  local.neck.set(local.chest.x, local.chest.y + neckUp * Math.cos(spineTilt), local.chest.z + Math.sin(spineTilt) * neckUp);
  const headPitch = -m.pitch * 0.6;
  local.head.set(local.neck.x, local.neck.y + 0.28 * Math.cos(headPitch), local.neck.z + 0.28 * Math.sin(headPitch) * 0.4 + 0.02);

  // C16: the lean out of full cover rolls the spine over the hips (25 degrees at full), the head staying level.
  const tc = m.tac ?? null;
  if (tc && tc.lean) {
    const roll = tc.lean * LEAN_ROLL;
    const sr = Math.sin(roll);
    const cr = Math.cos(roll);
    for (const j of [local.chest, local.neck, local.head]) {
      const dx = j.x - local.pelvis.x;
      const dy = j.y - local.pelvis.y;
      j.x = local.pelvis.x + dx * cr + dy * sr;
      j.y = local.pelvis.y - dx * sr + dy * cr;
    }
    // The head comes back toward upright (he keeps his eyes level to aim).
    local.head.x -= sr * 0.08;
  }
  // Shoulders hang off the neck, hips off the pelvis.
  for (const s of [1, -1]) {
    const L = s > 0;
    (L ? local.shoulderL : local.shoulderR).set(local.neck.x + 0.22 * s, local.neck.y - 0.06, local.neck.z - 0.02);
    (L ? local.hipL : local.hipR).set(local.pelvis.x + 0.11 * s, local.pelvis.y - 0.04, local.pelvis.z);
  }

  // Legs: feet follow a stride ellipse; the knee comes from IK, bending forward.
  const stride = 0.22 + 0.32 * run;
  for (const s of [1, -1]) {
    const L = s > 0;
    const ph = phaseL + (L ? 0 : Math.PI);
    const fwd = Math.cos(ph) * stride * walk;
    const lift = Math.max(0, Math.sin(ph)) * (0.1 + 0.12 * run) * walk;
    hip.copy(L ? local.hipL : local.hipR);
    // A heavy man's stance: feet a little wider than the hips (narrowing to the hips as the stride opens), the
    // knees over the feet and a touch outward.
    foot.set((0.155 - 0.02 * walk) * s + m.crouch * 0.06 * s, 0.07 + lift, fwd + m.crouch * 0.12);
    if (kneel > 0) foot.lerp(tmp.set(L ? 0.14 : -0.17, L ? 0.09 : 0.07, L ? -0.36 : 0.34), kneel);
    if (r) foot.add(tmp.set(L ? r.footLX : r.footRX, L ? r.footLLift : r.footRLift, L ? r.footLZ : r.footRZ));
    const knee = L ? local.kneeL : local.kneeR;
    ik(hip, foot, THIGH, SHIN, tmp.set(hip.x + 0.12 * s, hip.y - 0.3, hip.z + 1), knee);
    (L ? local.footL : local.footR).copy(foot);
  }

  // Arms: the rifle. Low ready points it down and across; shouldered points it where they look.
  const aim = m.aim;
  const pitch = m.pitch * (0.4 + 0.6 * aim) - (1 - aim) * 0.45;
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const kick = m.kick * 0.06;
  // Grip points in a frame centred on the right shoulder, then pitched.
  const sh = local.shoulderR;
  // C10: low ready holds the carbine out in front of the chest plate, muzzle forward and down, not tucked into the
  // belt with the barrel at his groin (the hands were inside the armour and the gun disappeared into him).
  const gripR = new THREE.Vector3(0.08 + 0.04 * (1 - aim), -0.12 - 0.08 * (1 - aim), 0.22 + 0.14 * (1 - aim) - kick);
  const gripL = new THREE.Vector3(0.2 - 0.05 * aim, -0.1 - 0.12 * (1 - aim), 0.52 + 0.1 * (1 - aim) - kick);
  const rot = (v: THREE.Vector3) => new THREE.Vector3(v.x, v.y * cp + v.z * sp, -v.y * sp + v.z * cp).add(sh);
  local.handR.copy(rot(gripR));
  local.handL.copy(rot(gripL));
  // C10: the support hand sits on the carbine's foregrip, a fixed distance up the line from the trigger hand.
  local.handL.sub(local.handR).setLength(FOREGRIP_M).add(local.handR);
  ik(local.shoulderR, local.handR, UPPER, FORE, tmp.set(sh.x - 0.4, sh.y - 0.6, sh.z - 0.2), local.elbowR);
  ik(local.shoulderL, local.handL, UPPER, FORE, tmp.set(local.shoulderL.x + 0.5, local.shoulderL.y - 0.6, local.shoulderL.z), local.elbowL);

  // The carbine's two holds, before anything moves a hand off them: the gun stays where it was held (body.ts grip).
  gripAt.copy(local.handR);
  foreAt.copy(local.handL);
  // The sidearm comes up to a compressed ready at chest height even at rest (a man who just lost his rifle doesn't
  // hold the pistol at his belt), and out to arm's length on her.
  if (m.arms && m.arms.mode !== "rifle") {
    const pp = m.pitch * aim - (1 - aim) * 0.12;
    const cq = Math.cos(pp);
    const sq = Math.sin(pp);
    const rotP = (v: THREE.Vector3) => new THREE.Vector3(v.x, v.y * cq + v.z * sq, -v.y * sq + v.z * cq).add(sh);
    applyArms(m.arms.mode, m.arms.t, rotP, aim);
  }
  if (wd) applyWound(wd, m.arms?.mode ?? "rifle");
  if (tc) applyTac(tc);
  if (r) applyReact(r);
  if (m.crawl) crawlPose(m.crawl.phase, m.crawl.shoot, m.crawl.blend);
  if (f) applyFlinch(f);
  deriveJoints(local);

  // Body space to world: yaw about Y, then translate. The body faces +Z locally.
  q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), m.yaw);
  m4.compose(m.pos, q, new THREE.Vector3(1, 1, 1));
  for (const j of Object.keys(local) as Joint[]) body.joints[j].copy(local[j]).applyMatrix4(m4);
  body.facing.set(0, 0, 1).applyQuaternion(q);
  // Where the carbine is held: by the hands while both hold it; otherwise where they would hold it, so one hand can
  // carry it (an arm hanging, a hand to the wound). A crawling or reeling man's gun goes with his right hand.
  const oneHanded = (!!wd && (wd.hang !== null || (wd.hunch > 0.5 && m.arms?.mode !== "pistol"))) || (!!tc && tc.reload >= 0 && !m.crawl);
  if (!oneHanded || m.crawl || (r && (r.lie > 0.05 || r.helmet > 0.05))) {
    body.grip.copy(body.joints.handR);
    body.foregrip.copy(body.joints.handL);
  } else if (wd?.hang === "R") {
    // The weapon arm hangs: the left hand holds the carbine by its foregrip, the stock tucked under his arm.
    body.foregrip.copy(body.joints.handL);
    body.grip.copy(gripAt).sub(foreAt).add(local.handL).applyMatrix4(m4);
  } else {
    body.grip.copy(body.joints.handR);
    body.foregrip.copy(foreAt).sub(gripAt).add(local.handR).applyMatrix4(m4);
  }
}

const gripAt = new THREE.Vector3();
const foreAt = new THREE.Vector3();
const LEAN_ROLL = (25 * Math.PI) / 180;
const tacA = new THREE.Vector3();
const tacB = new THREE.Vector3();

/** S3.5's reload keys (ms): the hand reaches the mag well, the mag is out (400), the hand at the pouch, the mag in (1500), the bolt (1900), back on the foregrip (2200). */
export const RELOAD_KEYS = { reach: 250, out: 400, pouch: 900, back: 1250, in: 1500, handle: 1750, bolt: 1900, done: 2200 } as const;

/**
 * C16's firefight layers over the carbine hold (body space; `foreAt`/`gripAt` hold the gun's own two points).
 * The reload moves only the support hand (the carbine stays where the trigger hand holds it, see oneHanded);
 * the blind fire lifts both hands, and the gun with them, over his helmet; surrender opens both hands by his head.
 */
function applyTac(t: NonNullable<Motion["tac"]>): void {
  const shR = local.shoulderR;
  const shL = local.shoulderL;
  if (t.blind > 0.001) {
    const k = smooth01(t.blind);
    // Over the top: the trigger hand above the helmet and forward, the support hand a foregrip's length straight out
    // from it, so the carbine lies level (2 degrees down) over the cover. The pair slides back and down along that line
    // until both hands are in reach: an out-of-reach support hand used to be clamped short by the IK, which tipped the
    // muzzle 45 degrees up at the sky.
    const reach = (UPPER + FORE) * 0.97;
    tacA.set(shR.x + 0.13, Math.max(shR.y, shL.y) + 0.36, Math.max(shR.z, shL.z) + 0.2);
    for (let i = 0; i < 24; i++) {
      tacB.set(tacA.x + 0.05, tacA.y - 0.01, tacA.z + FOREGRIP_M);
      if (tacA.distanceTo(shR) <= reach && tacB.distanceTo(shL) <= reach) break;
      tacA.z -= 0.025;
      tacA.y -= 0.012;
    }
    local.handR.lerp(tacA, k);
    local.handL.lerp(tacB, k);
    // His head tucks down under his arms.
    local.head.y -= 0.06 * k;
    local.head.z += 0.05 * k;
  }
  if (t.reload >= 0) {
    const K = RELOAD_KEYS;
    const ms = t.reload;
    // Body-space spots on the held carbine (from where the hands hold it): the mag well under the receiver, the
    // charging handle on its left side; and the pouch on his chest rig.
    const well = tacA.copy(foreAt).lerp(gripAt, 0.62).add(armTmp.set(0.0, -0.09, 0.0));
    const pouch = new THREE.Vector3(local.chest.x + 0.1, local.chest.y - 0.2, local.chest.z + 0.2);
    const handle = tacB.copy(gripAt).lerp(foreAt, 0.25).add(armTmp.set(0.05, 0.06, 0));
    const fore = foreAt;
    let to: THREE.Vector3;
    if (ms < K.reach) to = new THREE.Vector3().copy(fore).lerp(well, smooth01(ms / K.reach));
    else if (ms < K.out) to = well.clone().add(armTmp.set(0, -0.03 * smooth01((ms - K.reach) / (K.out - K.reach)), 0));
    else if (ms < K.pouch) to = well.clone().lerp(pouch, smooth01((ms - K.out) / (K.pouch - K.out)));
    else if (ms < K.back) to = pouch.clone();
    else if (ms < K.in) to = pouch.clone().lerp(well, smooth01((ms - K.back) / (K.in - K.back)));
    else if (ms < K.handle) to = well.clone().lerp(handle, smooth01((ms - K.in) / (K.handle - K.in)));
    else if (ms < K.bolt) to = handle.clone().add(armTmp.set(0, 0, -0.06 * smooth01((ms - K.handle) / (K.bolt - K.handle))));
    else to = handle.clone().lerp(fore, smooth01((ms - K.bolt) / (K.done - K.bolt)));
    local.handL.copy(to);
  }
  if (t.hands > 0.001) {
    const k = smooth01(t.hands);
    local.handR.lerp(tacA.set(shR.x - 0.1, shR.y + 0.32, shR.z + 0.12), k);
    local.handL.lerp(tacB.set(shL.x + 0.1, shL.y + 0.32, shL.z + 0.12), k);
  }
  ik(shR, local.handR, UPPER, FORE, tmp.set(shR.x - 0.4, shR.y - 0.6, shR.z - 0.2), local.elbowR);
  ik(shL, local.handL, UPPER, FORE, tmp.set(shL.x + 0.5, shL.y - 0.6, shL.z), local.elbowL);
}
const armTmp = new THREE.Vector3();

/** S4.3's disarm, body space: the stung hand shaken, the draw from the right thigh, the two-handed pistol hold. */
function applyArms(mode: "shake" | "draw" | "pistol", t: number, rot: (v: THREE.Vector3) => THREE.Vector3, aim: number): void {
  const shR = local.shoulderR;
  const shL = local.shoulderL;
  // The stung hand pulled in against his chest, shaking hard and settling; the other hand cups its wrist.
  const sting = (u: number) => armTmp.set(shR.x + 0.08 + 0.035 * Math.sin(u * 0.06) * Math.max(0, 1 - u / 450), shR.y - 0.3 + 0.025 * Math.cos(u * 0.083) * Math.max(0, 1 - u / 450), shR.z + 0.26);
  const holster = new THREE.Vector3(local.hipR.x - 0.12, local.hipR.y - 0.14, local.hipR.z + 0.02);
  const hold = rot(new THREE.Vector3(0.15, -0.1 + 0.06 * aim, 0.36 + 0.2 * aim));
  const hang = new THREE.Vector3(shL.x + 0.07, shL.y - 0.55, shL.z + 0.08);
  if (mode === "shake") {
    local.handR.copy(sting(t));
    local.handL.copy(local.handR).add(armTmp.set(0.07, -0.03, -0.02));
  } else if (mode === "draw") {
    // Down to the holster (0 to 380 ms), then up and out to the hold, the support hand meeting it from 520 ms.
    if (t < 380) local.handR.copy(sting(450)).lerp(holster, smooth01(t / 380));
    else local.handR.copy(holster).lerp(hold, smooth01((t - 380) / 520));
    const join = smooth01((t - 520) / 380);
    local.handL.copy(hang).lerp(armTmp.copy(local.handR).add(new THREE.Vector3(0.04, -0.025, 0.0)), join);
  } else {
    local.handR.copy(hold);
    local.handL.copy(hold).add(armTmp.set(0.04, -0.025, 0.0));
  }
  ik(shR, local.handR, UPPER, FORE, tmp.set(shR.x - 0.4, shR.y - 0.6, shR.z - 0.2), local.elbowR);
  ik(shL, local.handL, UPPER, FORE, tmp.set(shL.x + 0.5, shL.y - 0.6, shL.z), local.elbowL);
}

const smooth01 = (x: number) => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};

/** Where a hand presses on a wound (body space), for the hunch. */
function woundPoint(z: WoundZone | null, out: THREE.Vector3): THREE.Vector3 {
  const c = local.chest;
  switch (z) {
    case "legL":
      return out.copy(local.hipL).lerp(local.kneeL, 0.4).add(armTmp.set(0.02, 0, 0.09));
    case "legR":
      return out.copy(local.hipR).lerp(local.kneeR, 0.4).add(armTmp.set(-0.02, 0, 0.09));
    case "head":
      return out.set(local.neck.x + 0.05, local.neck.y + 0.02, local.neck.z + 0.12);
    case "armR":
      return out.copy(local.shoulderR).lerp(local.elbowR, 0.45).add(armTmp.set(0.05, 0, 0.06));
    default:
      // The gut, under the chest plate's edge.
      return out.set(c.x + 0.04, c.y - 0.16, c.z + 0.17);
  }
}

/**
 * S4.2's wounded layers over the hold: a hurt arm hangs (the gun in the other hand), and below 25% health he hunches
 * 10 degrees with his free hand pressed to the worst wound, his shoulders rising and falling at 0.6 Hz.
 */
function applyWound(w: NonNullable<Motion["wound"]>, arms: string): void {
  if (w.hang && w.hangK > 0) {
    const L = w.hang === "L";
    const sh = L ? local.shoulderL : local.shoulderR;
    const hand = L ? local.handL : local.handR;
    hand.lerp(armTmp.set(sh.x + (L ? 0.06 : -0.06), sh.y - 0.56, sh.z + 0.1), w.hangK);
    ik(sh, hand, UPPER, FORE, tmp.set(sh.x + (L ? 0.3 : -0.3), sh.y - 0.3, sh.z - 0.4), L ? local.elbowL : local.elbowR);
    // The good hand carries the gun lower and out to the side, one-handed.
    const other = L ? local.handR : local.handL;
    other.y -= 0.05 * w.hangK;
    const osh = L ? local.shoulderR : local.shoulderL;
    ik(osh, other, UPPER, FORE, tmp.set(osh.x + (L ? -0.4 : 0.5), osh.y - 0.6, osh.z - 0.2), L ? local.elbowR : local.elbowL);
  }
  if (w.hunch > 0) {
    const k = w.hunch;
    const bob = Math.sin(w.breath * Math.PI * 2 * WOUNDS.breathHz) * WOUNDS.breathM * k;
    for (const j of ["chest", "neck", "head", "shoulderL", "elbowL", "handL", "shoulderR", "elbowR", "handR"] as Joint[]) local[j].y += bob * (j === "chest" ? 0.5 : 1);
    turn(UPPER_BODY, local.pelvis.clone(), rq.setFromAxisAngle(axis.set(1, 0, 0), WOUNDS.hunchDeg * (Math.PI / 180) * k));
    // The free hand (the left, unless that's the arm that hangs; with a pistol up it stays on the gun).
    if (!w.hang && arms !== "pistol") {
      const p = woundPoint(w.worst === "armL" ? "torso" : w.worst, new THREE.Vector3());
      local.handL.lerp(p, Math.min(1, k * 1.2));
      ik(local.shoulderL, local.handL, UPPER, FORE, pole.set(local.shoulderL.x + 0.45, local.shoulderL.y - 0.5, local.shoulderL.z - 0.15), local.elbowL);
    }
  }
}

/**
 * S4.2's crawl: face down, propped on his forearms, dragging himself along with alternate arms, the legs trailing
 * (one knee drawn up on each pull). `shoot` (0..1) twists his right arm back over his shoulder with the sidearm.
 * Body space, heading +z (he crawls the way he faces).
 */
const CRAWL_FROM = {} as Record<Joint, THREE.Vector3>;
function crawlPose(phase: number, shoot: number, blend: number): void {
  // Blending in, it goes from whatever pose he was in (half up off the street) to the crawl.
  if (blend < 1) for (const j of Object.keys(local) as Joint[]) (CRAWL_FROM[j] ??= new THREE.Vector3()).copy(local[j]);
  crawlTargets(phase, shoot);
  if (blend < 1) {
    const k = blend * blend * (3 - 2 * blend);
    for (const j of Object.keys(local) as Joint[]) local[j].lerpVectors(CRAWL_FROM[j], local[j], k);
  }
}

function crawlTargets(phase: number, shoot: number): void {
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  local.pelvis.set(0.02 * s, 0.17, 0);
  local.chest.set(0.03 * s, 0.27, 0.3);
  local.neck.set(0.03 * s, 0.34, 0.52);
  local.head.set(0.02 * s, 0.44, 0.7);
  local.shoulderL.set(0.2, 0.31, 0.47 + 0.03 * s);
  local.shoulderR.set(-0.2, 0.31, 0.47 - 0.03 * s);
  local.hipL.set(0.11, 0.16, -0.02);
  local.hipR.set(-0.11, 0.16, -0.02);
  // Each forearm reaches ahead and drags back, in turn.
  local.handL.set(0.24, 0.05, 0.62 + 0.16 * s);
  local.handR.set(-0.24, 0.05, 0.62 - 0.16 * s);
  if (shoot > 0) local.handR.lerp(armTmp.set(-0.42, 0.42, 0.25), shoot);
  ik(local.shoulderL, local.handL, UPPER, FORE, tmp.set(local.shoulderL.x + 0.5, -0.4, local.shoulderL.z - 0.2), local.elbowL);
  ik(local.shoulderR, local.handR, UPPER, FORE, tmp.set(local.shoulderR.x - 0.5, shoot > 0.5 ? 1 : -0.4, local.shoulderR.z - 0.2), local.elbowR);
  // The legs trail; the knee on the pulling side draws up and out.
  local.footL.set(0.2 + 0.08 * Math.max(0, c), 0.07, -0.86 + 0.18 * Math.max(0, c));
  local.footR.set(-0.18 - 0.08 * Math.max(0, -c), 0.07, -0.88 + 0.18 * Math.max(0, -c));
  ik(local.hipL, local.footL, THIGH, SHIN, tmp.set(local.hipL.x + 0.5, -1, local.hipL.z - 0.2), local.kneeL);
  ik(local.hipR, local.footR, THIGH, SHIN, tmp.set(local.hipR.x - 0.5, -1, local.hipR.z - 0.2), local.kneeR);
}

const rq = new THREE.Quaternion();
const axis = new THREE.Vector3();
const arm = new THREE.Vector3();
const dv = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);
const UPPER_BODY: Joint[] = ["chest", "neck", "head", "shoulderL", "elbowL", "handL", "shoulderR", "elbowR", "handR"];

/** Rotates joints about a pivot by `rq`. */
function turn(joints: Joint[], pivot: THREE.Vector3, quat: THREE.Quaternion): void {
  for (const j of joints) local[j].sub(pivot).applyQuaternion(quat).add(pivot);
}

/** Tips a chain about its pivot by `angle`, so its end moves along `dir` (the round's travel). */
function tip(joints: Joint[], pivot: THREE.Vector3, end: THREE.Vector3, dir: Dir, angle: number): void {
  if (Math.abs(angle) < 1e-5) return;
  arm.subVectors(end, pivot);
  axis.crossVectors(arm, dv.set(dir.x, 0, dir.z));
  if (axis.lengthSq() < 1e-8) return;
  rq.setFromAxisAngle(axis.normalize(), angle);
  turn(joints, pivot, rq);
}

/**
 * The flinch on top of the pose (S4.1), in body space, innermost chain first so each rides its parent: the
 * arm swings about its shoulder and the muzzle drops, the shoulders shrug, the head tips and turns on the neck,
 * a knee buckles, then the whole upper body tips and twists about the pelvis.
 */
function applyFlinch(f: Flinch): void {
  const drop = f.get("muzzleDrop");
  if (Math.abs(drop) > 1e-5) {
    // The rifle hands rotate down about the firing shoulder: the muzzle dips.
    rq.setFromAxisAngle(axis.set(1, 0, 0), drop);
    turn(["elbowR", "handR", "elbowL", "handL"], local.shoulderR.clone(), rq);
  }
  tip(["elbowL", "handL"], local.shoulderL, local.handL, f.armDirL, f.get("armL"));
  tip(["elbowR", "handR"], local.shoulderR, local.handR, f.armDirR, f.get("armR"));
  const shrug = f.get("shrug");
  if (shrug) for (const j of ["shoulderL", "elbowL", "handL", "shoulderR", "elbowR", "handR"] as Joint[]) local[j].y += shrug;
  tip(["head"], local.neck, local.head, f.headDir, f.get("headTip"));
  const yaw = f.get("headYaw");
  if (Math.abs(yaw) > 1e-5) turn(["head"], local.neck, rq.setFromAxisAngle(Y, yaw));
  for (const [knee, hip, angle] of [
    [local.kneeL, local.hipL, f.get("kneeL")],
    [local.kneeR, local.hipR, f.get("kneeR")],
  ] as const) {
    // The knee pitches forward about the hip (the foot stays where it stands).
    if (Math.abs(angle) > 1e-5) knee.sub(hip).applyQuaternion(rq.setFromAxisAngle(axis.set(1, 0, 0), -angle)).add(hip);
  }
  const pelvis = local.pelvis.clone();
  tip(UPPER_BODY, pelvis, local.neck, f.torsoDir, f.get("torsoTip"));
  const twist = f.get("twist");
  if (Math.abs(twist) > 1e-5) turn(UPPER_BODY, pelvis, rq.setFromAxisAngle(Y, twist));
}

const LIE: Partial<Record<Joint, THREE.Vector3>> = {};
const lieTmp = new THREE.Vector3();
const pole = new THREE.Vector3();
const SPINE: Array<[Joint, Joint]> = [
  ["pelvis", "chest"],
  ["chest", "neck"],
  ["neck", "head"],
];
const SPINE_LEN = SPINE.map(([a, b]) => REST[a].distanceTo(REST[b]));

/**
 * The knockdown's resting pose (S4.2), body space, falling toward -z: down on his back, the torso propped up on his
 * left elbow at about 25 degrees, the knees up, the rifle hand across his chest, the head lifted to look back at her.
 */
function lyingPose(breathe: number): void {
  const set = (j: Joint, x: number, y: number, z: number) => (LIE[j] ??= new THREE.Vector3()).set(x, y, z);
  const el = 25 * (Math.PI / 180);
  const c = Math.cos(el);
  const sn = Math.sin(el);
  const px = 0.0;
  const py = 0.17;
  const pz = -0.52;
  const up = (d: number, off: number) => [px, py + sn * d + off, pz - c * d] as const;
  set("pelvis", px, py, pz);
  const [cx, cy, cz] = up(SPINE_LEN[0]!, breathe);
  set("chest", cx, cy, cz);
  const [nx, ny, nz] = up(SPINE_LEN[0]! + SPINE_LEN[1]!, breathe);
  set("neck", nx, ny, nz);
  // The head lifts off the street (chin to chest), looking back down his body at her.
  set("head", nx, ny + 0.2, nz - 0.2);
  set("shoulderL", nx + 0.22, ny - 0.04, nz + 0.03);
  set("shoulderR", nx - 0.22, ny - 0.04, nz + 0.03);
  set("hipL", px + 0.11, py, pz + 0.02);
  set("hipR", px - 0.11, py, pz + 0.02);
  // Feet flat, drawn up toward him, a little apart; one leg further out.
  set("footL", 0.2, 0.07, 0.05);
  set("footR", -0.24, 0.07, -0.08);
  // The left hand props him up behind; the right holds the rifle across his chest.
  set("handL", 0.3, 0.05, -0.86);
  set("handR", -0.08, cy + 0.12, cz + 0.12);
}

/** C15 (S4.2): the stagger set, the knockdown and the visor snap, over the pose (body space). */
function applyReact(r: ReactPose): void {
  const D = Math.PI / 180;
  // The weapon arm and the rifle in it drop about the shoulder.
  if (Math.abs(r.armDrop) > 1e-5) turn(["elbowR", "handR", "elbowL", "handL"], local.shoulderR.clone(), rq.setFromAxisAngle(axis.set(1, 0, 0), r.armDrop));
  // Arms flung out to the side, or up for balance (about the body's forward axis).
  const outL = r.flailL + r.upL;
  const outR = r.flailR + r.upR;
  if (Math.abs(outL) > 1e-5) turn(["elbowL", "handL"], local.shoulderL.clone(), rq.setFromAxisAngle(axis.set(0, 0, 1), outL));
  if (Math.abs(outR) > 1e-5) turn(["elbowR", "handR"], local.shoulderR.clone(), rq.setFromAxisAngle(axis.set(0, 0, 1), -outR));
  // The off hand to the wound (on the chest plate, his left of centre), the elbow re-solved.
  if (r.clutch > 1e-3) {
    lieTmp.set(local.chest.x + 0.03, local.chest.y + 0.1, local.chest.z + 0.2);
    local.handL.lerp(lieTmp, r.clutch);
    ik(local.shoulderL, local.handL, UPPER, FORE, pole.set(local.shoulderL.x + 0.4, local.shoulderL.y - 0.5, local.shoulderL.z - 0.1), local.elbowL);
  }
  // The visor snap: the off hand to the broken visor (the gun hand drops the muzzle, in armDrop).
  if (r.helmet > 1e-3) {
    for (const s of [1]) {
      const hand = s > 0 ? local.handL : local.handR;
      const sh = s > 0 ? local.shoulderL : local.shoulderR;
      // To the side of the helmet, at the temple: the palm on the shell, the face (behind the broken visor) left open.
      lieTmp.set(local.head.x + 0.16 * s, local.head.y + 0.02, local.head.z - 0.02);
      hand.lerp(lieTmp, r.helmet);
      ik(sh, hand, UPPER, FORE, pole.set(sh.x + 0.5 * s, sh.y - 0.3, sh.z - 0.1), s > 0 ? local.elbowL : local.elbowR);
    }
  }
  if (Math.abs(r.headPitch) > 1e-5) turn(["head"], local.neck.clone(), rq.setFromAxisAngle(axis.set(1, 0, 0), r.headPitch));
  const pelvis = local.pelvis.clone();
  if (Math.abs(r.pitch) > 1e-5) turn(UPPER_BODY, pelvis, rq.setFromAxisAngle(axis.set(1, 0, 0), r.pitch));
  if (Math.abs(r.roll) > 1e-5) turn(UPPER_BODY, pelvis, rq.setFromAxisAngle(axis.set(0, 0, 1), -r.roll));
  if (r.lie > 1e-3) {
    lyingPose(r.breathe);
    const k = Math.min(1, r.lie);
    rq.setFromAxisAngle(Y, r.lieYaw);
    for (const j of Object.keys(LIE) as Joint[]) local[j].lerp(lieTmp.copy(LIE[j]!).applyQuaternion(rq), k);
    // Keep the bones their length through the blend: the spine re-laid from the pelvis, the limbs re-solved.
    for (let i = 0; i < SPINE.length; i++) {
      const [a, b] = SPINE[i]!;
      lieTmp.subVectors(local[b], local[a]);
      if (lieTmp.lengthSq() > 1e-8) local[b].copy(local[a]).addScaledVector(lieTmp.normalize(), SPINE_LEN[i]!);
    }
    const fwdUp = pole.set(0, 1, 0.6).applyQuaternion(rq);
    for (const s of [1, -1]) {
      const L = s > 0;
      const hipJ = L ? local.hipL : local.hipR;
      const footJ = L ? local.footL : local.footR;
      ik(hipJ, footJ, THIGH, SHIN, tmp.copy(hipJ).add(fwdUp).add(lieTmp.set(0.15 * s, 0, 0).applyQuaternion(rq)), L ? local.kneeL : local.kneeR);
      const shJ = L ? local.shoulderL : local.shoulderR;
      const handJ = L ? local.handL : local.handR;
      ik(shJ, handJ, UPPER, FORE, tmp.copy(shJ).add(lieTmp.set(0.5 * s, 0.3, -0.2).applyQuaternion(rq)), L ? local.elbowL : local.elbowR);
    }
  }
  void D;
}

/** The muzzle and its direction for a body holding a rifle (from the hands), world space. */
export function muzzleOf(body: Body, out: THREE.Vector3, dir: THREE.Vector3): void {
  dir.subVectors(body.foregrip, body.grip).normalize();
  out.copy(body.foregrip).addScaledVector(dir, 0.38);
}
