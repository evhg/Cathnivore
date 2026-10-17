// Cath's arms in first person (S2.1 "Hands"): black leather dress gloves with three-point stitching, a cream
// silk blouse cuff under the turned-back cuff of her charcoal gabardine trench, and the pearl bracelet on her
// left wrist (VISION.md's character bible; shared/cath's trench palette). Each arm is ONE skinned mesh (one
// draw call): upper arm, forearm, hand, four fingers of three phalanges and a three-phalanx thumb, rigidly
// weighted to their bones. The wrists go where the gun's `gripR`/`gripL` empties say, the elbows are solved by
// feel/ik.ts from shoulder anchors behind the camera, and each finger curls with one scalar per joint chain.

import * as THREE from "three";
import { FIN, bake, kitMaterials, placeMatrix, sphere, tube, type Finish, type Place } from "./gunkit";
import { solveTwoBone, boneQuat, type TwoBoneResult } from "./feel/ik";

/** Bone lengths (m): a slim woman's arm, a touch long so the viewmodel reaches comfortably. */
export const ARM = { upper: 0.31, fore: 0.27 };
/** Shoulder anchors in camera space (S2.1), right and left. */
export const SHOULDER_R = new THREE.Vector3(0.18, -0.28, 0.35);
export const SHOULDER_L = new THREE.Vector3(-0.18, -0.28, 0.35);
/** Aimed, the shoulders sit lower and closer so the forearms fall away under the sights. */
export const SHOULDER_R_ADS = new THREE.Vector3(0.17, -0.36, 0.3);
export const SHOULDER_L_ADS = new THREE.Vector3(-0.2, -0.38, 0.3);

/** Palm: wrist at the origin, knuckles at +Y; Z is the back of the hand. */
const PALM = { w: 0.072, len: 0.082, t: 0.026 };
/** Phalanx lengths (m) for index, middle, ring, little; and the thumb (metacarpal, proximal, distal). */
const FINGERS: [number, number, number][] = [
  [0.044, 0.026, 0.021],
  [0.048, 0.029, 0.022],
  [0.045, 0.027, 0.021],
  [0.036, 0.021, 0.019],
];
const FINGER_R: number[] = [0.0088, 0.0092, 0.0087, 0.0078];
const FINGER_X = [-0.026, -0.0088, 0.0088, 0.0255];
const THUMB: [number, number, number] = [0.036, 0.032, 0.026];

/** A hand pose: per-finger curl (radians at the first joint; the next two follow), splay, and the thumb. */
export interface HandPose {
  /** Index, middle, ring, little: flexion of the knuckle joint; the middle and end joints take 1.15x and 0.8x. */
  curl: [number, number, number, number];
  /** Extra flexion added to the middle and end joints (a tighter wrap round a thin handle). */
  wrap?: number;
  /** Thumb base rotation (XYZ, radians, for the right hand; mirrored on the left) and its two joint curls. */
  thumb: [number, number, number];
  thumbCurl: [number, number];
  /** The index finger's swing toward the thumb side at its knuckle (radians): lays it along a pistol's frame. */
  indexLift?: number;
}

export const POSES: Record<string, HandPose> = {
  /** The firing hand on a pistol grip: three fingers wrapped round the front strap, index straight along the frame, thumb forward. */
  pistolR: { curl: [0.12, 1.3, 1.35, 1.4], wrap: 0.4, thumb: [-0.55, 0.15, 0.55], thumbCurl: [0.1, 0.05], indexLift: 1.0 },
  /** The support hand wrapped over the firing hand's fingers, thumb forward under the slide. */
  pistolL: { curl: [1.0, 1.05, 1.1, 1.15], wrap: 0.3, thumb: [-0.35, 0.1, 0.35], thumbCurl: [0.05, 0.0] },
  /** A rifle's pistol grip. */
  rifleR: { curl: [0.15, 1.3, 1.35, 1.4], wrap: 0.35, thumb: [-0.9, 0.2, 0.7], thumbCurl: [0.4, 0.3] },
  /** Under a handguard: fingers up the far side, thumb along the near side. */
  foreL: { curl: [1.05, 1.1, 1.15, 1.2], wrap: 0.2, thumb: [-0.3, 0.1, 0.3], thumbCurl: [0.1, 0.1] },
  /** A fist round a handle (batons, the sledge, the blade). */
  fist: { curl: [1.35, 1.4, 1.45, 1.5], wrap: 0.45, thumb: [-1.1, 0.3, 0.6], thumbCurl: [0.6, 0.5] },
};

interface ArmBones {
  upper: THREE.Bone;
  fore: THREE.Bone;
  hand: THREE.Bone;
  fingers: THREE.Bone[][];
  thumb: THREE.Bone[];
}

/** One arm: a skinned mesh and its bones. Side +1 right, -1 left. */
export class Arm {
  readonly mesh: THREE.SkinnedMesh;
  readonly bones: ArmBones;
  private readonly ik: TwoBoneResult = { root: new THREE.Vector3(), mid: new THREE.Vector3(), end: new THREE.Vector3(), reached: true };

  constructor(
    readonly side: 1 | -1,
    phone: boolean,
  ) {
    const s = side;
    const all: THREE.Bone[] = [];
    const bone = (name: string, p: [number, number, number], parent?: THREE.Bone) => {
      const b = new THREE.Bone();
      b.name = name;
      b.position.set(...p);
      parent?.add(b);
      all.push(b);
      return b;
    };
    // Bind pose: the whole arm laid along +Y from the shoulder, back of the hand toward +Z.
    const upper = bone("upper", [0, 0, 0]);
    const fore = bone("fore", [0, ARM.upper, 0]);
    const hand = bone("hand", [0, ARM.upper + ARM.fore, 0]);
    const fingers = FINGERS.map((lens, f) => {
      const b0 = bone(`f${f}a`, [s * FINGER_X[f]!, PALM.len - 0.004 - (f === 3 ? 0.007 : f === 0 ? 0.002 : 0), -0.002], hand);
      const b1 = bone(`f${f}b`, [0, lens[0], 0], b0);
      const b2 = bone(`f${f}c`, [0, lens[1], 0], b1);
      return [b0, b1, b2];
    });
    const t0 = bone("t0", [s * -0.027, 0.014, -0.006], hand);
    const t1 = bone("t1", [0, THUMB[0], 0], t0);
    const t2 = bone("t2", [0, THUMB[1], 0], t1);
    const thumb = [t0, t1, t2];
    this.bones = { upper, fore, hand, fingers, thumb };

    // Geometry, built per bone in the bone's own frame, then carried to the bind pose.
    const root = new THREE.Group();
    root.add(upper, fore, hand);
    root.updateMatrixWorld(true);
    const pieces: THREE.BufferGeometry[] = [];
    const add = (b: THREE.Bone, g: THREE.BufferGeometry, fin: Finish, pl?: Place) => {
      const m = new THREE.Matrix4().multiplyMatrices(b.matrixWorld, placeMatrix(pl));
      const baked = bake(g, fin, m);
      const n = baked.getAttribute("position").count;
      const idx = all.indexOf(b);
      const si = new Uint16Array(n * 4);
      const sw = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        si[i * 4] = idx;
        sw[i * 4] = 1;
      }
      baked.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4));
      baked.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4));
      pieces.push(baked);
    };
    const seg = phone ? 12 : 24;
    // Upper arm and forearm: the trench sleeve, tapering to the wrist, with a turned-back cuff and a button.
    add(upper, tube(ARM.upper + 0.03, 0.046, 0.043, { seg, caps: false, phone }), FIN.sleeve, { p: [0, -0.01, 0] });
    add(fore, sphere(0.044, phone), FIN.sleeve);
    add(fore, tube(ARM.fore - 0.055, 0.043, 0.035, { seg, caps: false, phone }), FIN.sleeve);
    // The turned-back trench cuff: a wider band with a rolled lip, and its button on the outside.
    add(fore, tube(0.05, 0.0375, 0.04, { seg, caps: false, phone }), FIN.sleeve, { p: [0, ARM.fore - 0.09, 0] });
    add(fore, tube(0.006, 0.0405, 0.0405, { seg, caps: true, phone }), FIN.sleeve, { p: [0, ARM.fore - 0.044, 0] });
    add(fore, sphere(0.0062, phone), { color: 0x16171a, metal: 0.2, rough: 0.35, coat: 1 }, { p: [s * 0.026, ARM.fore - 0.065, 0.029] });
    // The cream silk blouse cuff, a centimetre of it showing past the trench.
    add(fore, tube(0.022, 0.0315, 0.0305, { seg, caps: false, phone }), FIN.silk, { p: [0, ARM.fore - 0.042, 0] });
    if (side < 0) {
      // The pearl bracelet, with a small gold clasp, at the left wrist, over the glove's gauntlet.
      const n = phone ? 10 : 14;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        add(fore, sphere(0.0056, phone), FIN.pearl, { p: [Math.cos(a) * 0.0292, ARM.fore - 0.018, Math.sin(a) * 0.0292] });
      }
      add(fore, sphere(0.0042, phone), FIN.gold, { p: [0, ARM.fore - 0.018, -0.0318] });
    }
    // The glove: gauntlet over the wrist, the palm, knuckles, the three-point stitching on the back.
    // The gauntlet rides the forearm (so it follows the arm, not the hand's angle); a short cuff joins it to the palm.
    add(fore, tube(0.045, 0.0262, 0.0252, { seg, caps: false, phone }), FIN.glove, { p: [0, ARM.fore - 0.038, 0] });
    add(fore, tube(0.004, 0.0275, 0.0275, { seg, caps: true, phone }), FIN.gloveSeam, { p: [0, ARM.fore - 0.04, 0] });
    add(hand, sphere(0.0255, phone), FIN.glove, { p: [0, 0.002, 0], s: [1.05, 1, 0.82] });
    add(hand, tube(PALM.len - 0.006, 0.026, 0.024, { seg, caps: true, phone }), FIN.glove, { p: [0, 0.004, 0], s: [PALM.w / 0.052, 1, PALM.t / 0.052] });
    for (let f = 0; f < 4; f++) {
      add(hand, sphere(FINGER_R[f]! * 0.95, phone), FIN.glove, { p: [s * FINGER_X[f]!, PALM.len - 0.007, 0.0015], s: [1, 0.9, 0.85] });
      // The stitching points run from the wrist toward the index, middle and ring knuckles.
      if (f < 3) add(hand, tube(0.038, 0.0011, 0.0011, { seg: 4, caps: true, phone }), FIN.gloveSeam, { p: [s * FINGER_X[f]! * 0.75, 0.02, PALM.t / 2 - 0.0005], r: [0, 0, s * -FINGER_X[f]! * 2] });
    }
    // The thumb's pad, filling the web between the thumb and the palm.
    add(hand, sphere(0.016, phone), FIN.glove, { p: [s * -0.022, 0.026, -0.004], s: [1, 1.6, 0.9] });
    fingers.forEach((chain, f) => {
      const r = FINGER_R[f]!;
      chain.forEach((b, k) => {
        const len = FINGERS[f]![k]!;
        add(b, tube(len + r * 0.6, r * (1 - k * 0.06), r * (0.94 - k * 0.06), { seg: phone ? 8 : 12, phone }), FIN.glove, { p: [0, -r * 0.3, 0] });
      });
    });
    thumb.forEach((b, k) => {
      const r = 0.0112 - k * 0.0008;
      add(b, tube(THUMB[k]! + r * 0.6, r, r * 0.93, { seg: phone ? 8 : 12, phone }), FIN.glove, { p: [0, -r * 0.3, 0] });
    });

    const geo = mergeSkinned(pieces);
    const skel = new THREE.Skeleton(all);
    this.mesh = new THREE.SkinnedMesh(geo, kitMaterials(phone).opaque);
    this.mesh.name = side > 0 ? "armR" : "armL";
    this.mesh.add(upper, fore, hand);
    this.mesh.bind(skel);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
  }

  private readonly _w = new THREE.Vector3();
  private readonly _q = new THREE.Quaternion();
  private readonly _z = new THREE.Vector3();
  private readonly _pole = new THREE.Vector3();
  private readonly _e = new THREE.Euler();

  /**
   * Puts the hand on `grip` (an empty under the gun, its frame the wrist's: Y toward the knuckles, Z the back of
   * the hand) and solves the elbow. `shoulder` in the arm's parent space (the view scene, i.e. camera space).
   * `trigger` 0..1 curls the index onto the trigger.
   */
  pose(grip: THREE.Object3D, shoulder: THREE.Vector3, hp: HandPose, trigger = 0): void {
    grip.updateWorldMatrix(true, false);
    const parentInv = this.mesh.parent ? new THREE.Matrix4().copy(this.mesh.parent.matrixWorld).invert() : new THREE.Matrix4();
    const m = new THREE.Matrix4().multiplyMatrices(parentInv, grip.matrixWorld);
    m.decompose(this._w, this._q, new THREE.Vector3());
    const b = this.bones;
    this._z.set(0, 0, 1).applyQuaternion(this._q);
    // The elbow hangs down and out.
    this._pole.copy(shoulder).lerp(this._w, 0.5).add(new THREE.Vector3(this.side * 0.35, -0.6, 0.1));
    const r = solveTwoBone(shoulder, this._w, this._pole, ARM.upper, ARM.fore, true, this.ik);
    b.upper.position.copy(r.root);
    boneQuat(r.root, r.mid, this._z, b.upper.quaternion);
    b.fore.position.copy(r.mid);
    boneQuat(r.mid, r.end, this._z, b.fore.quaternion);
    b.hand.position.copy(this._w);
    b.hand.quaternion.copy(this._q);
    // Fingers: one scalar per finger, the index blending to the trigger curl.
    const s = this.side;
    b.fingers.forEach((chain, f) => {
      let c = hp.curl[f]!;
      if (f === 0) c = THREE.MathUtils.lerp(c, 0.75, trigger);
      const w = hp.wrap ?? 0;
      chain[0]!.rotation.set(-c, 0, f === 0 ? s * (hp.indexLift ?? 0) : s * (f - 1.5) * -0.04);
      chain[1]!.rotation.set(-(c * 1.15 + w) * (f === 0 ? 1 + trigger * 0.4 : 1), 0, 0);
      chain[2]!.rotation.set(-(c * 0.8 + w * 0.6), 0, 0);
    });
    const [tx, ty, tz] = hp.thumb;
    this._e.set(tx, s * ty, s * tz);
    b.thumb[0]!.quaternion.setFromEuler(this._e);
    b.thumb[1]!.rotation.set(-hp.thumbCurl[0], 0, 0);
    b.thumb[2]!.rotation.set(-hp.thumbCurl[1], 0, 0);
  }
}

/** Merges skinned pieces (all with the kit attributes plus skinIndex/skinWeight). */
function mergeSkinned(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const names = Object.keys(list[0]!.attributes);
  const out = new THREE.BufferGeometry();
  for (const name of names) {
    const first = list[0]!.getAttribute(name) as THREE.BufferAttribute;
    const total = list.reduce((a, g) => a + g.getAttribute(name).count, 0);
    const Arr = first.array.constructor as new (n: number) => Float32Array | Uint16Array;
    const arr = new Arr(total * first.itemSize);
    let o = 0;
    for (const g of list) {
      const a = g.getAttribute(name).array as Float32Array | Uint16Array;
      arr.set(a, o);
      o += a.length;
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, first.itemSize));
  }
  out.computeBoundingSphere();
  return out;
}

/**
 * Both arms. They live inside the held gun's root (so they hide with it for the scope and the kill-cam), and
 * are posed each frame onto its grip empties from shoulder anchors given in camera space.
 */
export class Arms {
  readonly right: Arm;
  readonly left: Arm;
  private readonly sR = new THREE.Vector3();
  private readonly sL = new THREE.Vector3();

  constructor(phone = false) {
    this.right = new Arm(1, phone);
    this.left = new Arm(-1, phone);
  }

  /** Moves both arms into `root` (the gun now in hand). */
  attach(root: THREE.Object3D): void {
    root.add(this.right.mesh, this.left.mesh);
  }

  /**
   * Poses both hands on `gripR`/`gripL` (no gripL: the left arm hides). Shoulders are in the space of the
   * root's parent (the view scene, i.e. camera space).
   */
  pose(root: THREE.Object3D, gripR: THREE.Object3D, gripL: THREE.Object3D | null, poseR: HandPose, poseL: HandPose | null, trigger = 0, shoulderR = SHOULDER_R, shoulderL = SHOULDER_L): void {
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const parent = root.parent?.matrixWorld ?? new THREE.Matrix4();
    this.sR.copy(shoulderR).applyMatrix4(parent).applyMatrix4(inv);
    this.sL.copy(shoulderL).applyMatrix4(parent).applyMatrix4(inv);
    this.right.pose(gripR, this.sR, poseR, trigger);
    this.left.mesh.visible = !!gripL;
    if (gripL && poseL) this.left.pose(gripL, this.sL, poseL);
  }
}
