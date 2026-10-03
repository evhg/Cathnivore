// Procedural animation for Body: a gait cycle with two-bone leg IK, arms that hold a rifle at low ready or
// shouldered, aim pitch from the hips up, crouching, and hit flinches. Writes world-space joint positions.

import * as THREE from "three";
import { REST, type Body, type Joint } from "./body";

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
  /** Recent hit: a decaying shove, body space (x right, z forward), metres. */
  flinch: THREE.Vector3;
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

  // Spine: pelvis up through chest and neck, leaning forward when running, flinching on hits.
  local.pelvis.set(m.flinch.x * 0.3, pelvisY, m.flinch.z * 0.3);
  const spineTilt = lean - m.flinch.z * 0.8;
  const chestUp = REST.chest.y - REST.pelvis.y;
  const neckUp = REST.neck.y - REST.chest.y;
  local.chest.set(local.pelvis.x + m.flinch.x * 0.3, pelvisY + chestUp, local.pelvis.z + Math.sin(spineTilt) * chestUp);
  local.neck.set(local.chest.x + m.flinch.x * 0.5, local.chest.y + neckUp * Math.cos(spineTilt), local.chest.z + Math.sin(spineTilt) * neckUp);
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

  // Body space to world: yaw about Y, then translate. The body faces +Z locally.
  q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), m.yaw);
  m4.compose(m.pos, q, new THREE.Vector3(1, 1, 1));
  for (const j of Object.keys(local) as Joint[]) body.joints[j].copy(local[j]).applyMatrix4(m4);
  body.facing.set(0, 0, 1).applyQuaternion(q);
}

/** The muzzle and its direction for a body holding a rifle (from the hands), world space. */
export function muzzleOf(body: Body, out: THREE.Vector3, dir: THREE.Vector3): void {
  dir.subVectors(body.joints.handL, body.joints.handR).normalize();
  out.copy(body.joints.handL).addScaledVector(dir, 0.38);
}
