// The humanoid rig every Body shares: its joints, rest pose and hit zones (split out of body.ts so death.ts can
// read the rest pose without an import cycle).

import * as THREE from "three";

export const JOINTS = ["pelvis", "chest", "neck", "head", "shoulderL", "elbowL", "handL", "shoulderR", "elbowR", "handR", "hipL", "kneeL", "footL", "hipR", "kneeR", "footR"] as const;
export type Joint = (typeof JOINTS)[number];

export type Zone = "head" | "torso" | "armL" | "armR" | "legL" | "legR";

/** Joint positions in body space (feet on y=0, facing +Z), for the rest pose and as animation anchors. */
export const REST: Record<Joint, THREE.Vector3> = {
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
};
