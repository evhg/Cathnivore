// The humanoid rig every Body shares: its joints, rest pose and hit zones (split out of body.ts so death.ts can
// read the rest pose without an import cycle).
//
// C10 (S3.1): 21 joints. The 16 the animation and the dying poses author (pelvis to feet), plus five that ride on
// them: `spine2` halfway up the chest (the torso bends in two), the clavicles at the base of the neck (shoulders
// shrug off them), and the wrists a palm's length up the forearm from the hand (the hand is its own segment, so it
// can open). Authored poses fill the five with `deriveJoints`; the ragdoll simulates all 21.

import * as THREE from "three";

export const BASE_JOINTS = ["pelvis", "chest", "neck", "head", "shoulderL", "elbowL", "handL", "shoulderR", "elbowR", "handR", "hipL", "kneeL", "footL", "hipR", "kneeR", "footR"] as const;
export const DERIVED_JOINTS = ["spine2", "clavicleL", "clavicleR", "wristL", "wristR"] as const;
export const JOINTS = [...BASE_JOINTS, ...DERIVED_JOINTS] as const;
export type Joint = (typeof JOINTS)[number];

export type Zone = "head" | "torso" | "armL" | "armR" | "legL" | "legR";

/** The wrist sits this far back up the forearm from the hand joint (the palm's centre), metres at unit scale. */
export const WRIST_M = 0.07;
/** Spine2 is this share of the way from the chest joint to the neck; a clavicle this share from the neck to its shoulder. */
export const SPINE2_T = 0.5;
export const CLAVICLE_T = 0.32;

const dW = new THREE.Vector3();

/** Fills the five riding joints from the sixteen authored ones (in place, any space, any scale). */
export function deriveJoints(J: Record<Joint, THREE.Vector3>, scale = 1): void {
  J.spine2.lerpVectors(J.chest, J.neck, SPINE2_T);
  J.clavicleL.lerpVectors(J.neck, J.shoulderL, CLAVICLE_T);
  J.clavicleR.lerpVectors(J.neck, J.shoulderR, CLAVICLE_T);
  for (const s of ["L", "R"] as const) {
    const hand = J[`hand${s}`];
    dW.subVectors(J[`elbow${s}`], hand);
    const l = dW.length();
    if (l < 1e-6) J[`wrist${s}`].copy(hand);
    else J[`wrist${s}`].copy(hand).addScaledVector(dW, (WRIST_M * scale) / l);
  }
}

/** Joint positions in body space (feet on y=0, facing +Z), for the rest pose and as animation anchors. */
export const REST: Record<Joint, THREE.Vector3> = (() => {
  const r = {
    pelvis: new THREE.Vector3(0, 0.98, 0),
    chest: new THREE.Vector3(0, 1.2, 0),
    neck: new THREE.Vector3(0, 1.52, 0),
    head: new THREE.Vector3(0, 1.8, 0),
    shoulderL: new THREE.Vector3(0.22, 1.46, 0),
    elbowL: new THREE.Vector3(0.26, 1.16, 0),
    handL: new THREE.Vector3(0.28, 0.9, 0.04),
    shoulderR: new THREE.Vector3(-0.22, 1.46, 0),
    elbowR: new THREE.Vector3(-0.26, 1.16, 0),
    handR: new THREE.Vector3(-0.28, 0.9, 0.04),
    hipL: new THREE.Vector3(0.11, 0.94, 0),
    kneeL: new THREE.Vector3(0.12, 0.5, 0.02),
    footL: new THREE.Vector3(0.12, 0.06, 0),
    hipR: new THREE.Vector3(-0.11, 0.94, 0),
    kneeR: new THREE.Vector3(-0.12, 0.5, 0.02),
    footR: new THREE.Vector3(-0.12, 0.06, 0),
    spine2: new THREE.Vector3(),
    clavicleL: new THREE.Vector3(),
    clavicleR: new THREE.Vector3(),
    wristL: new THREE.Vector3(),
    wristR: new THREE.Vector3(),
  } as Record<Joint, THREE.Vector3>;
  deriveJoints(r);
  return r;
})();

export interface SegmentDef {
  name: string;
  from: Joint;
  to: Joint;
  zone: Zone;
  /** Hit volume radius, metres. */
  radius: number;
  /** Severing this segment also takes these (a forearm goes with the upper arm). */
  carries?: string[];
}

/**
 * The rigid segments hung between the joints. The first eleven keep their v1 order (their flash slots are i + 1);
 * C10 adds the upper chest and the hands after them.
 */
export const SEGMENTS: SegmentDef[] = [
  { name: "abdomen", from: "pelvis", to: "chest", zone: "torso", radius: 0.16 },
  { name: "chest", from: "chest", to: "spine2", zone: "torso", radius: 0.2 },
  { name: "head", from: "neck", to: "head", zone: "head", radius: 0.13 },
  { name: "upperArmL", from: "shoulderL", to: "elbowL", zone: "armL", radius: 0.07, carries: ["forearmL"] },
  { name: "forearmL", from: "elbowL", to: "wristL", zone: "armL", radius: 0.06, carries: ["handL"] },
  { name: "upperArmR", from: "shoulderR", to: "elbowR", zone: "armR", radius: 0.07, carries: ["forearmR"] },
  { name: "forearmR", from: "elbowR", to: "wristR", zone: "armR", radius: 0.06, carries: ["handR"] },
  { name: "thighL", from: "hipL", to: "kneeL", zone: "legL", radius: 0.09, carries: ["shinL"] },
  { name: "shinL", from: "kneeL", to: "footL", zone: "legL", radius: 0.075 },
  { name: "thighR", from: "hipR", to: "kneeR", zone: "legR", radius: 0.09, carries: ["shinR"] },
  { name: "shinR", from: "kneeR", to: "footR", zone: "legR", radius: 0.075 },
  { name: "upperChest", from: "spine2", to: "neck", zone: "torso", radius: 0.2 },
  { name: "handL", from: "wristL", to: "handL", zone: "armL", radius: 0.055 },
  { name: "handR", from: "wristR", to: "handR", zone: "armR", radius: 0.055 },
];

/** The accessory bones after the segments: the helmet (so a headshot can knock it off) and the two finger sets. */
export const ACCESSORY_BONES = ["helmet", "fingersL", "fingersR"] as const;
/** Bone index of a segment or accessory in every body skeleton. */
export function boneIndex(name: string): number {
  const i = SEGMENTS.findIndex((s) => s.name === name);
  if (i >= 0) return i;
  const k = (ACCESSORY_BONES as readonly string[]).indexOf(name);
  return k >= 0 ? SEGMENTS.length + k : -1;
}
/** The first fx bone (models/materials.ts) in every body skeleton. */
export const FX0 = SEGMENTS.length + ACCESSORY_BONES.length;
/** The helmet's centre up the head segment (m). */
export const HELM_Y = 0.15;
/** Where the finger bone sits along the hand segment (m past the wrist), and how far the fingers curl at rest. */
export const KNUCKLE_Y = 0.1;
