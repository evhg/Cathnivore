// Procedural animation for Body: a gait cycle with two-bone leg IK, arms that hold a rifle at low ready or
// shouldered, aim pitch from the hips up, crouching, and hit flinches. Writes world-space joint positions.

import * as THREE from "three";
import { REST, type Body, type Joint } from "./body";
import type { Dir, Flinch } from "./anim/springs";

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
function ik(root: THREE.Vector3, end: THREE.Vector3, l1: number, l2: number, pole: THREE.Vector3, out: THREE.Vector3): void {
  const d = tmp.subVectors(end, root);
  let len = d.length();
  const max = l1 + l2 - 1e-3;
  if (len > max) {
    d.multiplyScalar(max / len);
    end.copy(root).add(d);
    len = max;
  }
  const a = (l1 * l1 - l2 * l2 + len * len) / (2 * len);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const dir = d.clone().normalize();
  const p = pole.clone().sub(root);
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
  local.pelvis.set(rootX, pelvisY - pelvisDrop, rootZ);
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
    foot.set(0.13 * s + m.crouch * 0.06 * s, 0.07 + lift, fwd + m.crouch * 0.12);
    const knee = L ? local.kneeL : local.kneeR;
    ik(hip, foot, THIGH, SHIN, tmp.set(hip.x, hip.y - 0.3, hip.z + 1), knee);
    (L ? local.footL : local.footR).copy(foot);
  }

  // Arms: the rifle. Low ready points it down and across; shouldered points it where they look.
  const aim = m.aim;
  const pitch = m.pitch * (0.4 + 0.6 * aim) - (1 - aim) * 0.6;
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const kick = m.kick * 0.06;
  // Grip points in a frame centred on the right shoulder, then pitched.
  const sh = local.shoulderR;
  const gripR = new THREE.Vector3(0.08 + 0.04 * (1 - aim), -0.12 - 0.08 * (1 - aim), 0.22 - kick);
  const gripL = new THREE.Vector3(0.2 - 0.05 * aim, -0.1 - 0.12 * (1 - aim), 0.52 - kick);
  const rot = (v: THREE.Vector3) => new THREE.Vector3(v.x, v.y * cp + v.z * sp, -v.y * sp + v.z * cp).add(sh);
  local.handR.copy(rot(gripR));
  local.handL.copy(rot(gripL));
  ik(local.shoulderR, local.handR, UPPER, FORE, tmp.set(sh.x - 0.4, sh.y - 0.6, sh.z - 0.2), local.elbowR);
  ik(local.shoulderL, local.handL, UPPER, FORE, tmp.set(local.shoulderL.x + 0.5, local.shoulderL.y - 0.6, local.shoulderL.z), local.elbowL);

  if (f) applyFlinch(f);

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

/** The muzzle and its direction for a body holding a rifle (from the hands), world space. */
export function muzzleOf(body: Body, out: THREE.Vector3, dir: THREE.Vector3): void {
  dir.subVectors(body.joints.handL, body.joints.handR).normalize();
  out.copy(body.joints.handL).addScaledVector(dir, 0.38);
}
