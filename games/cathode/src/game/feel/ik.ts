// Two-bone analytic IK with a pole (S0): shared by Cath's viewmodel arms (C4) and, later, enemy arms. Plain
// vector maths on three's Vector3, no scene graph, so tests run it in Node.
//
// Given a root (shoulder), a target (wrist) and the two bone lengths, it finds the middle joint (elbow) on the
// side of the root-target line the pole points to. A target out of reach straightens the chain toward it; with
// `slideRoot` the root moves along the line instead, so the end still lands on the target (a viewmodel's
// shoulder is a soft anchor: the hands must stay on the grip).

import * as THREE from "three";

export interface TwoBoneResult {
  /** The root actually used (moved toward the target when `slideRoot` had to reach). */
  root: THREE.Vector3;
  mid: THREE.Vector3;
  end: THREE.Vector3;
  /** Whether the target was reachable without moving the root or straightening the chain. */
  reached: boolean;
}

const _d = new THREE.Vector3();
const _p = new THREE.Vector3();

/**
 * Solves a two-bone chain. `pole` is a world point the middle joint bends toward. Lengths in metres.
 * `slideRoot` (default false): when the target is beyond 99.5% of the chain, slide the root toward it.
 */
export function solveTwoBone(
  root: THREE.Vector3,
  target: THREE.Vector3,
  pole: THREE.Vector3,
  l1: number,
  l2: number,
  slideRoot = false,
  out?: TwoBoneResult,
): TwoBoneResult {
  const res = out ?? { root: new THREE.Vector3(), mid: new THREE.Vector3(), end: new THREE.Vector3(), reached: true };
  res.root.copy(root);
  _d.subVectors(target, root);
  let dist = _d.length();
  const reach = (l1 + l2) * 0.995;
  const minReach = Math.abs(l1 - l2) * 1.005 + 1e-6;
  res.reached = dist <= reach && dist >= minReach;
  if (dist < 1e-9) _d.set(0, 0, -1);
  else _d.multiplyScalar(1 / dist);
  if (dist > reach && slideRoot) {
    // Slide the shoulder along the line until the wrist lands exactly at full (99.5%) reach.
    res.root.copy(target).addScaledVector(_d, -reach);
    dist = reach;
  }
  dist = THREE.MathUtils.clamp(dist, minReach, reach);
  // Law of cosines: the distance along the line to the elbow's foot, and its height off the line.
  const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  // The bend direction: the pole, with its component along the line removed.
  _p.subVectors(pole, res.root);
  _p.addScaledVector(_d, -_p.dot(_d));
  if (_p.lengthSq() < 1e-12) {
    // A pole on the line: pick any perpendicular (down, unless the line is vertical).
    _p.set(0, -1, 0).addScaledVector(_d, -_d.y);
    if (_p.lengthSq() < 1e-12) _p.set(1, 0, 0);
  }
  _p.normalize();
  res.mid.copy(res.root).addScaledVector(_d, a).addScaledVector(_p, h);
  res.end.copy(res.root).addScaledVector(_d, dist);
  return res;
}

/** A quaternion that turns +Y onto the direction from `a` to `b` while keeping `up` (a hint) roughly +Z. */
export function boneQuat(a: THREE.Vector3, b: THREE.Vector3, hint: THREE.Vector3, out = new THREE.Quaternion()): THREE.Quaternion {
  const y = new THREE.Vector3().subVectors(b, a).normalize();
  const x = new THREE.Vector3().crossVectors(y, hint);
  if (x.lengthSq() < 1e-9) x.set(1, 0, 0).cross(y);
  x.normalize();
  const z = new THREE.Vector3().crossVectors(x, y).normalize();
  const m = new THREE.Matrix4().makeBasis(x, y, z);
  return out.setFromRotationMatrix(m);
}
