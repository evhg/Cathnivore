// Procedural animation for Body: a gait cycle with two-bone leg IK, arms that hold a rifle at low ready or
// shouldered, aim pitch from the hips up, crouching, and hit flinches. Writes world-space joint positions.

import * as THREE from "three";
import { REST, type Body, type Joint } from "./body";
import { deriveJoints } from "./rig";
import { FOREGRIP_M } from "./models/gear";
import type { Dir, Flinch } from "./anim/springs";
import type { ReactPose } from "./anim/react";

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
  const crouchDrop = m.crouch * 0.38;
  const bob = Math.abs(Math.sin(m.phase)) * 0.05 * walk;
  const pelvisY = REST.pelvis.y - crouchDrop - 0.03 * run + bob;
  const lean = 0.08 * run + m.crouch * 0.15;

  const f = m.flinch;
  // A hit shoves the hips along the round (the feet stay planted, so the body leans off them) and a leg hit
  // drops the pelvis onto the buckling knee.
  const rootX = f ? f.get("rootX") : 0;
  const rootZ = f ? f.get("rootZ") : 0;
  const pelvisDrop = f ? f.get("pelvisDrop") : 0;
  // Spine: pelvis up through chest and neck, leaning forward when running.
  const r = m.react ?? null;
  local.pelvis.set(rootX + (r ? r.pelvisX : 0), pelvisY - pelvisDrop - (r ? r.pelvisDrop : 0), rootZ + (r ? r.pelvisZ : 0));
  const spineTilt = lean;
  const chestUp = REST.chest.y - REST.pelvis.y;
  const neckUp = REST.neck.y - REST.chest.y;
  local.chest.set(local.pelvis.x, local.pelvis.y + chestUp, local.pelvis.z + Math.sin(spineTilt) * chestUp);
  local.neck.set(local.chest.x, local.chest.y + neckUp * Math.cos(spineTilt), local.chest.z + Math.sin(spineTilt) * neckUp);
  const headPitch = -m.pitch * 0.6;
  local.head.set(local.neck.x, local.neck.y + 0.28 * Math.cos(headPitch), local.neck.z + 0.28 * Math.sin(headPitch) * 0.4 + 0.02);

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
    const ph = m.phase + (L ? 0 : Math.PI);
    const fwd = Math.cos(ph) * stride * walk;
    const lift = Math.max(0, Math.sin(ph)) * (0.1 + 0.12 * run) * walk;
    hip.copy(L ? local.hipL : local.hipR);
    // A heavy man's stance: feet a little wider than the hips (narrowing to the hips as the stride opens), the
    // knees over the feet and a touch outward.
    foot.set((0.155 - 0.02 * walk) * s + m.crouch * 0.06 * s, 0.07 + lift, fwd + m.crouch * 0.12);
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

  if (r) applyReact(r);
  if (f) applyFlinch(f);
  deriveJoints(local);

  // Body space to world: yaw about Y, then translate. The body faces +Z locally.
  q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), m.yaw);
  m4.compose(m.pos, q, new THREE.Vector3(1, 1, 1));
  for (const j of Object.keys(local) as Joint[]) body.joints[j].copy(local[j]).applyMatrix4(m4);
  body.facing.set(0, 0, 1).applyQuaternion(q);
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
  dir.subVectors(body.joints.handL, body.joints.handR).normalize();
  out.copy(body.joints.handL).addScaledVector(dir, 0.38);
}
