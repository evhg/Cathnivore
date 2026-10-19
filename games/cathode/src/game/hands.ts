// Cath's arms in first person (S2.1 "Hands"): black leather dress gloves with three-point stitching, a cream
// silk blouse cuff under the turned-back cuff of her charcoal gabardine trench, and the pearl bracelet on her
// left wrist (VISION.md's character bible; shared/cath's trench palette). Each arm is ONE skinned mesh (one
// draw call): upper arm, forearm, hand, four fingers of three phalanges and a three-phalanx thumb, rigidly
// weighted to their bones. The wrists go where the gun's `gripR`/`gripL` empties say, the elbows are solved by
// feel/ik.ts from shoulder anchors behind the camera, and each finger curls with one scalar per joint chain.

import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { FIN, bake, kitMaterials, placeMatrix, sphere, tube, type Finish, type Place } from "./gunkit";
import { solveTwoBone, boneQuat, type TwoBoneResult } from "./feel/ik";

/** Bone lengths (m): a slim woman's arm, a touch long so the viewmodel reaches comfortably. */
export const ARM = { upper: 0.31, fore: 0.27 };
/** Shoulder anchors in camera space (S2.1), right and left. */
export const SHOULDER_R = new THREE.Vector3(0.18, -0.28, 0.35);
export const SHOULDER_L = new THREE.Vector3(-0.18, -0.28, 0.35);
/** Aimed, the shoulders sit lower and closer so the forearms fall away under the sights. */
// Out and well down (C4 review: at 0.46 m the sleeves were 80% of the aimed viewmodel, a wall of cloth): now
// the wrists and cuffs show under the gun and the forearms fall out of frame.
export const SHOULDER_R_ADS = new THREE.Vector3(0.21, -0.58, 0.22);
export const SHOULDER_L_ADS = new THREE.Vector3(-0.24, -0.6, 0.22);

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
const THUMB: [number, number, number] = [0.032, 0.027, 0.023];

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
  pistolR: { curl: [0.12, 1.3, 1.35, 1.4], wrap: 0.4, thumb: [-0.55, 0.15, 0.55], thumbCurl: [0.22, 0.18], indexLift: 0.85 },
  /** The support hand wrapped over the firing hand's fingers, thumb forward under the slide. */
  /** The support hand (thumbs-forward): heel on the left panel, index tight under the trigger guard's front, the
   * other three wrapped round the front of the firing hand's fingers, thumb laid forward along the frame. */
  pistolL: { curl: [1.05, 0.85, 0.9, 0.95], wrap: 0.35, thumb: [-0.25, 0.1, 0.25], thumbCurl: [0.2, 0.16] },
  /** A rifle's pistol grip. */
  rifleR: { curl: [0.15, 1.3, 1.35, 1.4], wrap: 0.35, thumb: [-0.9, 0.2, 0.7], thumbCurl: [0.4, 0.3] },
  /** Under a handguard: fingers up the far side, thumb along the near side. */
  foreL: { curl: [1.05, 1.1, 1.15, 1.2], wrap: 0.2, thumb: [-0.3, 0.1, 0.3], thumbCurl: [0.1, 0.1] },
  /** C5: the support hand round a magazine (palm under the floorplate, fingers up its front, thumb behind). */
  magL: { curl: [0.95, 1.05, 1.1, 1.2], wrap: 0.3, thumb: [-0.6, 0.15, 0.5], thumbCurl: [0.35, 0.3] },
  /** C5: the support hand over the slide's rear for a rack or a press-check (fingers curled over the top). */
  rackL: { curl: [1.1, 1.15, 1.2, 1.25], wrap: 0.25, thumb: [-0.5, 0.1, 0.45], thumbCurl: [0.3, 0.25] },
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
    /**
     * Adds a piece in bone `b`'s frame. Rigid by default; `skin(i)` instead gives vertex i (in the piece's own,
     * pre-placement order) up to four [bone, weight] pairs, for the digits and the wrist that bend smoothly.
     */
    const add = (b: THREE.Bone, g: THREE.BufferGeometry, fin: Finish, pl?: Place, skin?: (i: number) => [THREE.Bone, number][]) => {
      const m = new THREE.Matrix4().multiplyMatrices(b.matrixWorld, placeMatrix(pl));
      const baked = bake(g, fin, m);
      const n = baked.getAttribute("position").count;
      const idx = all.indexOf(b);
      const si = new Uint16Array(n * 4);
      const sw = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        if (!skin) {
          si[i * 4] = idx;
          sw[i * 4] = 1;
          continue;
        }
        const ws = skin(i);
        let sum = 0;
        for (const [, w] of ws) sum += w;
        ws.slice(0, 4).forEach(([bn, w], k) => {
          si[i * 4 + k] = all.indexOf(bn);
          sw[i * 4 + k] = w / sum;
        });
      }
      baked.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4));
      baked.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4));
      pieces.push(baked);
    };
    /** Blends a digit's vertices across its joints: `parent` below 0, then each bone of the chain. */
    const chainSkin = (parent: THREE.Bone, chain: THREE.Bone[], joints: number[], along: Float32Array, w: number) => (i: number): [THREE.Bone, number][] => {
      const y = along[i]!;
      const t0 = THREE.MathUtils.smoothstep(y, -w * 1.2, w * 0.6);
      const t1 = THREE.MathUtils.smoothstep(y, joints[0]! - w, joints[0]! + w);
      const t2 = THREE.MathUtils.smoothstep(y, joints[1]! - w, joints[1]! + w);
      return [
        [parent, 1 - t0],
        [chain[0]!, t0 * (1 - t1)],
        [chain[1]!, t0 * t1 * (1 - t2)],
        [chain[2]!, t0 * t1 * t2],
      ];
    };
    const seg = phone ? 20 : 36;
    // Upper arm and forearm: the trench sleeve, tapering to the wrist, with a turned-back cuff and a button.
    // C5 review: the forearm read as "a featureless matte cylinder" once the reload turned it to the eye. Now
    // the gabardine tapers hard to the wrist, bunches in soft rings above the turned-back cuff, twists in long
    // diagonal folds down the forearm and creases at the elbow, with a sunk seam along the underside.
    // The upper arm is rarely on screen: a plain tube keeps the triangles for the forearm.
    add(upper, tube(ARM.upper + 0.03, 0.046, 0.043, { seg: phone ? 12 : 20, caps: false, phone }), FIN.sleeve, { p: [0, -0.01, 0] });
    add(fore, sphere(0.044, phone), FIN.sleeve);
    add(fore, sleeve(ARM.fore - 0.055, 0.045, 0.033, { seg: phone ? 16 : 28, phone, side, elbowAt: 0 }), FIN.sleeve);
    // The turned-back trench cuff: a wider band with a rolled lip, and its button on the outside.
    add(fore, tube(0.05, 0.0375, 0.04, { seg, caps: false, phone }), FIN.sleeve, { p: [0, ARM.fore - 0.09, 0] });
    add(fore, tube(0.006, 0.0405, 0.0405, { seg, caps: true, phone }), FIN.sleeve, { p: [0, ARM.fore - 0.044, 0] });
    add(fore, sphere(0.0062, phone), { color: 0x16171a, metal: 0.2, rough: 0.35, coat: 1 }, { p: [s * 0.026, ARM.fore - 0.065, 0.029] });
    // The cream silk blouse cuff: a soft roll out from under the trench's lip, draping down onto the gauntlet
    // (C5 review: a 2 cm straight cylinder of cream read as a flat white stripe round the wrist).
    add(fore, silkCuff(phone), FIN.silk, { p: [0, ARM.fore - 0.046, 0], s: [1.1, 1, 0.86] });
    if (side < 0) {
      // The pearl bracelet (C4 review: big pearls read as teeth): a strand of small pearls sitting snug on the
      // gauntlet, tucked half under the silk cuff, with a small gold clasp underneath.
      const n = phone ? 14 : 22;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        add(fore, sphere(0.0031, true), FIN.pearl, { p: [Math.cos(a) * 0.0281, ARM.fore - 0.0215 + Math.sin(a * 2) * 0.0007, Math.sin(a) * 0.0281] });
      }
      add(fore, sphere(0.0028, phone), FIN.gold, { p: [0, ARM.fore - 0.0215, -0.0298], s: [1.4, 0.9, 0.8] });
    }
    // The glove: gauntlet over the wrist, the palm, knuckles, the three-point stitching on the back.
    // The gauntlet rides the forearm (so it follows the arm, not the hand's angle); a short cuff joins it to the palm.
    // C5 review: a hard cylinder with a ring seam read as blockout. Now it flares from the wrist to a rolled hem,
    // oval like the wrist (wider than thick), with a stitched welt above the hem and a short vent on the inside.
    add(fore, gauntlet(phone), FIN.glove, { p: [0, ARM.fore - 0.039, 0], s: [1.1, 1, 0.86] });
    // The wrist joint fills the gap between the gauntlet and the heel of the hand, flush with the back of the
    // hand (C5 review: a full sphere here stood proud of the palm as a smooth dome).
    add(hand, sphere(0.0245, phone), FIN.glove, { p: [0, -0.002, -0.001], s: [1.04, 1.05, 0.62] });
    {
      // The palm: a soft, tapered slab (narrower at the wrist, the back domed), its heel bending with the wrist.
      const pg = palm(phone, side);
      const pp = pg.getAttribute("position");
      add(hand, pg, FIN.glove, undefined, (i) => {
        const y = pp.getY(i);
        const k = (1 - THREE.MathUtils.smoothstep(y, 0.0, 0.024)) * 0.55;
        return [
          [fore, k],
          [hand, 1 - k],
        ];
      });
    }
    for (let f = 0; f < 3; f++) {
      // The stitching points run from the wrist toward the index, middle and ring knuckles.
      add(hand, tube(0.034, 0.00115, 0.00095, { seg: 4, caps: true, phone }), FIN.gloveSeam, { p: [s * FINGER_X[f]! * 0.72, 0.022, 0.0134 - Math.abs(FINGER_X[f]!) * 0.09], r: [0, 0, s * -FINGER_X[f]! * 2] });
    }
    // The thumb's pad, filling the web between the thumb and the palm.
    add(hand, sphere(0.016, phone), FIN.glove, { p: [s * -0.022, 0.026, -0.004], s: [1, 1.6, 0.9] });
    // Each digit is one smooth glove finger from inside the palm to a domed tip, bending over its knuckles.
    const dSeg = phone ? 8 : 14;
    const dStep = phone ? 0.008 : 0.0055;
    fingers.forEach((chain, f) => {
      const r = FINGER_R[f]!;
      const lens = FINGERS[f]!;
      const d = digit([...lens], [r, r * 0.93, r * 0.86, r * 0.8], { seg: dSeg, step: dStep, detail: !phone });
      add(chain[0]!, d.geo, FIN.glove, undefined, chainSkin(hand, chain, [lens[0], lens[0] + lens[1]], d.along, r * 0.75));
    });
    {
      const d = digit([...THUMB], [0.0108, 0.0095, 0.0088, 0.0079], { seg: dSeg, step: dStep, root: 0.012, flat: 0.84, detail: !phone });
      add(thumb[0]!, d.geo, FIN.glove, undefined, chainSkin(hand, thumb, [THUMB[0], THUMB[0] + THUMB[1]], d.along, 0.009));
    }

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
  pose(grip: THREE.Object3D, shoulder: THREE.Vector3, hp: HandPose, trigger = 0, poleOff?: THREE.Vector3): void {
    grip.updateWorldMatrix(true, false);
    const parentInv = this.mesh.parent ? new THREE.Matrix4().copy(this.mesh.parent.matrixWorld).invert() : new THREE.Matrix4();
    const m = new THREE.Matrix4().multiplyMatrices(parentInv, grip.matrixWorld);
    m.decompose(this._w, this._q, new THREE.Vector3());
    const b = this.bones;
    this._z.set(0, 0, 1).applyQuaternion(this._q);
    // The elbow hangs down and out.
    // (C11's world-space takedown arms pass their own offset, in her frame: out and down from her shoulders.)
    this._pole.copy(shoulder).lerp(this._w, 0.5).add(poleOff ?? new THREE.Vector3(this.side * 0.35, -0.6, 0.1));
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
    const aim = grip.userData.thumb as THREE.Object3D | undefined;
    if (aim) this.aimThumb(aim, hp);
    else {
      const [tx, ty, tz] = hp.thumb;
      this._e.set(tx, s * ty, s * tz);
      b.thumb[0]!.quaternion.setFromEuler(this._e);
    }
    b.thumb[1]!.rotation.set(-hp.thumbCurl[0], 0, 0);
    b.thumb[2]!.rotation.set(-hp.thumbCurl[1], 0, 0);
  }

  private readonly _m = new THREE.Matrix4();
  private readonly _a = new THREE.Vector3();
  private readonly _b = new THREE.Vector3();
  private readonly _c = new THREE.Vector3();
  private readonly _hq = new THREE.Quaternion();

  /**
   * Thumbs-forward (C4 review): the thumb's base swings so the digit runs from its root toward `aim` (an empty
   * on the gun's left flank, set where the thumb lies along the frame), the nail turned out, away from the gun.
   * The empty's own +Z (in gun space) says where the nail faces.
   */
  private aimThumb(aim: THREE.Object3D, hp: HandPose): void {
    const t0 = this.bones.thumb[0]!;
    const hand = this.bones.hand;
    this.mesh.updateMatrixWorld(true);
    t0.quaternion.identity();
    t0.updateMatrixWorld(true);
    const root = this._a.setFromMatrixPosition(t0.matrixWorld);
    aim.updateWorldMatrix(true, false);
    const tgt = this._b.setFromMatrixPosition(aim.matrixWorld);
    const y = tgt.sub(root).normalize();
    // The curls bend the tip toward the pad (-Z): lift the base by about half the curl to keep the line.
    const nail = this._c.set(0, 0, 1).transformDirection(aim.matrixWorld);
    nail.addScaledVector(y, -nail.dot(y)).normalize();
    const lift = (hp.thumbCurl[0] + hp.thumbCurl[1]) * 0.45;
    y.applyAxisAngle(new THREE.Vector3().crossVectors(y, nail).normalize(), lift).normalize();
    nail.addScaledVector(y, -nail.dot(y)).normalize();
    const x = new THREE.Vector3().crossVectors(y, nail).normalize();
    this._m.makeBasis(x, y, nail);
    const qW = new THREE.Quaternion().setFromRotationMatrix(this._m);
    hand.getWorldQuaternion(this._hq);
    t0.quaternion.copy(this._hq.invert().multiply(qW));
  }
}

/**
 * A trench sleeve along +Y from 0 to `len`, r0 at the base and r1 at the far end: a lathe with enough rings to
 * carry folds. `elbowAt` (0 or 1) says which end is the elbow, where the cloth creases across the bend; the
 * wrist end bunches above the cuff. The seam runs along the underside (-Z in the bone's frame, mirrored per side).
 */
export function sleeve(len: number, r0: number, r1: number, opts: { seg: number; phone: boolean; side: 1 | -1; elbowAt: 0 | 1 }): THREE.BufferGeometry {
  const rows = opts.phone ? 6 : 10;
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    // A soft taper (fuller over the forearm's muscle, then in to the wrist), not a straight cone.
    const r = THREE.MathUtils.lerp(r0, r1, t * t * 0.55 + t * 0.45);
    pts.push(new THREE.Vector2(r, t * len));
  }
  const g = new THREE.LatheGeometry(pts, opts.seg);
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const seamA = -Math.PI / 2 + opts.side * 0.5;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 1e-6) continue;
    const a = Math.atan2(z, x);
    const t = y / len;
    // From the elbow end (0) to the other (1).
    const e = opts.elbowAt === 1 ? 1 - t : t;
    let d = 0;
    // Long diagonal folds twisting down the forearm, fading out at both ends.
    d += 0.075 * Math.sin(3 * a + t * 9 + opts.side) * Math.sin(Math.PI * t);
    // Bunching rings above the cuff (the far end of the forearm), wobbling round the arm.
    const bunch = THREE.MathUtils.smoothstep(e, 0.55, 0.95);
    d += 0.13 * bunch * Math.max(0, Math.sin(t * len * 210 + 1.4 * Math.sin(2 * a + 0.7)));
    // The elbow's crease: two or three tight folds across the inside of the bend.
    const crease = 1 - THREE.MathUtils.smoothstep(e, 0.0, 0.22);
    d += 0.1 * crease * Math.max(0, Math.sin(t * len * 260 + Math.sin(a))) * (0.5 + 0.5 * Math.cos(a - seamA - Math.PI));
    // The seam: a narrow groove along the underside.
    let da = a - seamA;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    d -= 0.07 * Math.exp(-((da / 0.16) ** 2));
    const k = 1 + d;
    pos.setX(i, x * k);
    pos.setZ(i, z * k);
  }
  g.computeVertexNormals();
  g.deleteAttribute("uv");
  const out = g.toNonIndexed();
  out.userData.edge = new Float32Array(out.getAttribute("position").count);
  return out;
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
/**
 * One continuous gloved digit along +Y (C4 "finger shapes"): rings every `step` metres from just inside the
 * palm to a domed tip, an elliptical section (wider than thick, the pad a touch fuller than the back), slight
 * swells at the joints. Returns the geometry (non-indexed, smooth normals with no seam) and, per vertex, the
 * distance along the digit, so the caller can blend the skin weights across each joint.
 */
export function digit(lens: number[], radii: number[], opts: { seg: number; step: number; root?: number; flat?: number; detail?: boolean }): { geo: THREE.BufferGeometry; along: Float32Array } {
  const seg = opts.seg;
  const total = lens.reduce((a, b) => a + b, 0);
  const rTip = radii[radii.length - 1]!;
  const y0 = -(opts.root ?? radii[0]! * 0.6);
  const yEnd = total - rTip * 0.35;
  const flat = opts.flat ?? 0.8;
  const detail = opts.detail ?? true;
  const joints = [0];
  for (const l of lens) joints.push(joints[joints.length - 1]! + l);
  /** The phalanx's own radius at y: it waists a little mid-bone and tapers into the next joint. */
  const rAt = (y: number): number => {
    let k = 0;
    while (k < lens.length - 1 && y > joints[k + 1]!) k++;
    const t = THREE.MathUtils.clamp((y - joints[k]!) / lens[k]!, 0, 1);
    const r = THREE.MathUtils.lerp(radii[k]!, radii[k + 1]!, t);
    return r * (1 - 0.09 * Math.sin(Math.PI * t));
  };
  /**
   * The section's shape at y and angle (z = sin of the angle: +1 the back of the finger, -1 the pad). Over each
   * joint the back bulges into a knuckle; just past it the pad pinches into the flexion crease; leather wrinkles
   * ring the back of each phalanx short of its next knuckle; the pads are flattened and a touch fuller.
   */
  const shape = (y: number, z: number): number => {
    let m = 1;
    for (let j = 1; j < joints.length - 1; j++) {
      const rj = radii[j]!;
      const d = (y - joints[j]!) / rj;
      // The knuckle: a bump on the back, strongest at the first knuckle.
      const kn = Math.exp(-d * d * 1.6) * (j === 1 ? 0.18 : 0.13);
      m += kn * Math.max(0, z) ** 1.5;
      // The joint's sides swell a touch too, so each phalanx reads as its own bone, not a sausage.
      m += Math.exp(-d * d * 2.2) * 0.045 * (1 - z * z);
      if (!detail) continue;
      // The flexion crease on the pad, a hair distal of the joint.
      const dc = d - 0.15;
      m -= Math.exp(-dc * dc * 22) * 0.12 * Math.max(0, -z) ** 2;
      // Two fine leather wrinkles across the back, just short of the knuckle.
      for (const off of [-0.75, -1.15]) {
        const dw = d - off;
        m -= Math.exp(-dw * dw * 60) * 0.045 * Math.max(0, z) ** 2;
      }
    }
    // The sewn side seams (the fourchettes) run along both flanks of the finger: a fine welt each side.
    if (detail && y > 0.004) m += 0.05 * Math.exp(-((z / 0.1) ** 2));
    return m;
  };
  // Rings: an even spacing, plus tight ones over each joint and its wrinkles so the creases have edges to live on.
  const ysSet: number[] = [];
  const n = Math.max(3, Math.ceil((yEnd - y0) / opts.step));
  for (let i = 0; i <= n; i++) ysSet.push(y0 + ((yEnd - y0) * i) / n);
  if (detail)
    for (let j = 1; j < joints.length - 1; j++) {
      const rj = radii[j]!;
      for (const o of [-1.4, -1.15, -0.95, -0.75, -0.5, -0.2, 0.15, 0.35, 0.7]) ysSet.push(joints[j]! + o * rj);
    }
  const ys = ysSet.filter((y) => y >= y0 && y <= yEnd).sort((a, b) => a - b).filter((y, i, a) => i === 0 || y - a[i - 1]! > 0.0006);
  // The domed tip: a quarter ellipse closing over the last radius, the nail side a little flatter.
  const capN = Math.max(3, Math.round(seg / 3));
  const capR = rAt(yEnd);
  const rings: { y: number; r: number }[] = ys.map((y) => ({ y, r: rAt(y) }));
  for (let i = 1; i < capN; i++) {
    const a = (i / capN) * (Math.PI / 2);
    rings.push({ y: yEnd + Math.sin(a) * capR * 0.95, r: Math.cos(a) * capR });
  }
  const pos: number[] = [];
  for (const ring of rings)
    for (let s = 0; s < seg; s++) {
      const a = (s / seg) * Math.PI * 2;
      const z = Math.sin(a);
      // The pad (-Z, the palm side) is flatter across and a little fuller than the back of the finger.
      const zr = z < 0 ? flat * 1.08 : flat;
      const m = shape(ring.y, z);
      const xw = z < 0 ? 1.03 : 1;
      pos.push(Math.cos(a) * ring.r * m * xw, ring.y, z * ring.r * zr * m);
    }
  const tip = rings.length * seg;
  pos.push(0, yEnd + capR * 0.95, 0);
  // The root ring is left open: it sits inside the palm.
  const idx: number[] = [];
  for (let k = 0; k < rings.length - 1; k++)
    for (let s = 0; s < seg; s++) {
      const a = k * seg + s;
      const b = k * seg + ((s + 1) % seg);
      const c = (k + 1) * seg + s;
      const d = (k + 1) * seg + ((s + 1) % seg);
      idx.push(a, c, b, b, c, d);
    }
  const last = (rings.length - 1) * seg;
  for (let s = 0; s < seg; s++) idx.push(last + s, tip, last + ((s + 1) % seg));
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const flatG = g.toNonIndexed();
  const p = flatG.getAttribute("position");
  const along = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) along[i] = p.getY(i);
  flatG.userData.edge = new Float32Array(p.count);
  return { geo: flatG, along };
}

/**
 * The glove's gauntlet along +Y in the forearm's frame, from the hem (y = 0, toward the elbow) to the wrist
 * (y = 0.047): a flared cuff with a rolled hem, a raised stitched welt 6 mm above it, tapering into the wrist.
 */
function gauntlet(phone: boolean): THREE.BufferGeometry {
  const prof: [number, number][] = [
    [0.0262, -0.0008],
    [0.0288, 0.0004],
    [0.0289, 0.003],
    // The welt: the hem's turned edge stitched down.
    [0.0284, 0.0052],
    [0.0287, 0.0066],
    [0.0279, 0.009],
    [0.0262, 0.026],
    [0.025, 0.047],
  ];
  const pts = prof.map(([r, y]) => new THREE.Vector2(r, y));
  let g: THREE.BufferGeometry = new THREE.LatheGeometry(pts, phone ? 16 : 24);
  g.deleteAttribute("uv");
  // Smooth normals on the indexed lathe (its seam column welded), then expanded.
  g.deleteAttribute("normal");
  g = mergeVertices(g, 1e-6);
  g.computeVertexNormals();
  g = g.toNonIndexed();
  g.userData.edge = new Float32Array(g.getAttribute("position").count);
  return g;
}

/**
 * The blouse cuff along +Y in the forearm's frame: it comes out from under the trench lip (y = 0), rolls over
 * and lies down onto the gauntlet by y = 0.013, about 8 mm of cream showing.
 */
function silkCuff(phone: boolean): THREE.BufferGeometry {
  const prof: [number, number][] = [
    [0.0318, -0.004],
    [0.0328, 0.004],
    [0.0314, 0.0105],
    [0.0294, 0.014],
  ];
  const pts = prof.map(([r, y]) => new THREE.Vector2(r, y));
  let g: THREE.BufferGeometry = new THREE.LatheGeometry(pts, phone ? 16 : 24);
  g.deleteAttribute("uv");
  // Smooth normals on the indexed lathe (its seam column welded), then expanded.
  g.deleteAttribute("normal");
  g = mergeVertices(g, 1e-6);
  g.computeVertexNormals();
  g = g.toNonIndexed();
  g.userData.edge = new Float32Array(g.getAttribute("position").count);
  return g;
}

/**
 * The palm in the hand bone's frame (wrist at y = 0, knuckles at PALM.len, the back of the hand +Z), lofted from
 * superellipse sections (C4 review: a rounded box read as a blockout): narrow and round at the wrist, widening
 * to the knuckle line; the back domes over the metacarpals, the four knuckles stand up through the leather with
 * tendon valleys between them, the palm side has the heel and the thumb's fleshy mound (the thenar) on the
 * thumb side, and the far end rolls over under the finger roots. `side` 1 right, -1 left (the thumb is at -X*side).
 */
function palm(phone: boolean, side: 1 | -1): THREE.BufferGeometry {
  const len = PALM.len;
  const seg = phone ? 14 : 28;
  const nr = phone ? 9 : 20;
  const pos: number[] = [];
  const ts: number[] = [];
  for (let i = 0; i <= nr; i++) ts.push(i / nr);
  const rows: number[][] = [];
  const ss = (t: number) => t * t * (3 - 2 * t);
  for (const t of ts) {
    const y = -0.006 + t * (len + 0.002);
    // Half width: the wrist's 2.6 cm swells to 3.5 cm across the knuckles; the far end rounds off.
    let hw = THREE.MathUtils.lerp(0.025, PALM.w * 0.5, ss(Math.min(1, t * 1.35)));
    // Half thickness, back and palm sides: thick at the heel, thinning toward the knuckles, the far end rolled.
    let hb = THREE.MathUtils.lerp(0.0125, 0.0105, t);
    let hp = THREE.MathUtils.lerp(0.0135, 0.0095, ss(t));
    const roll = Math.max(0, (t - 0.86) / 0.14);
    const rk = Math.sqrt(Math.max(0, 1 - roll * roll));
    hw *= THREE.MathUtils.lerp(1, 0.86, roll * roll);
    hb *= THREE.MathUtils.lerp(1, 0.78, roll);
    hp *= THREE.MathUtils.lerp(1, 0.55, roll);
    const row: number[] = [];
    for (let k = 0; k < seg; k++) {
      const a = (k / seg) * Math.PI * 2;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      // A superellipse: flatter flanks than an ellipse, so it reads as a hand, not a sausage.
      const e = 2 / 2.6;
      const x = Math.sign(c) * Math.abs(c) ** e * hw;
      let z = Math.sign(sn) * Math.abs(sn) ** e * (sn > 0 ? hb : hp);
      const u = x / (PALM.w * 0.5);
      if (z > 0) {
        // The back domes across the metacarpals.
        z *= 1 + 0.18 * (1 - u * u);
        // Knuckles and tendon valleys at the knuckle line.
        let kn = 0;
        for (const fx of FINGER_X) {
          const dx = (x - fx * 0.96) / 0.0072;
          const dy = (t - 0.84) / 0.085;
          kn += Math.exp(-dx * dx - dy * dy);
        }
        const tendon = Math.max(0, Math.cos(u * Math.PI * 1.9)) * Math.exp(-(((t - 0.55) / 0.25) ** 2));
        z += (0.0034 * kn + 0.0006 * tendon) * Math.min(1, z / 0.004);
      } else {
        // The heel of the hand and the thenar mound on the thumb side, the hollow of the palm between.
        const th = Math.exp(-((((x * side) + 0.012) / 0.012) ** 2) - ((t - 0.3) / 0.24) ** 2);
        const heel = Math.exp(-(((t - 0.12) / 0.14) ** 2)) * 0.12;
        const hollow = Math.exp(-((x / 0.012) ** 2) - ((t - 0.58) / 0.18) ** 2) * 0.16;
        z *= 1 + 0.42 * th + heel - hollow;
      }
      // The far end rolls over under the finger roots.
      z *= THREE.MathUtils.lerp(1, rk, 0.5);
      row.push(pos.length / 3);
      pos.push(x, y + roll * 0.004, z);
    }
    rows.push(row);
  }
  const idx: number[] = [];
  for (let i = 0; i < rows.length - 1; i++)
    for (let k = 0; k < seg; k++) {
      const a = rows[i]![k]!;
      const b = rows[i]![(k + 1) % seg]!;
      const c = rows[i + 1]![k]!;
      const d = rows[i + 1]![(k + 1) % seg]!;
      idx.push(a, c, b, b, c, d);
    }
  // Close the far end with a fan to its centre (the wrist end sits inside the gauntlet).
  const last = rows[rows.length - 1]!;
  let cx = 0, cy = 0, cz = 0;
  for (const v of last) {
    cx += pos[v * 3]!;
    cy += pos[v * 3 + 1]!;
    cz += pos[v * 3 + 2]!;
  }
  const ci = pos.length / 3;
  pos.push(cx / seg, cy / seg + 0.002, cz / seg);
  for (let k = 0; k < seg; k++) idx.push(last[k]!, ci, last[(k + 1) % seg]!);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const flat = g.toNonIndexed();
  flat.userData.edge = new Float32Array(flat.getAttribute("position").count);
  return flat;
}

/** Blends two hand poses (C5: the support hand moving from the grip to the mag or the slide). */
export function lerpPose(a: HandPose, b: HandPose, t: number, out: HandPose): HandPose {
  const l = (x: number, y: number) => x + (y - x) * t;
  for (let i = 0; i < 4; i++) out.curl[i] = l(a.curl[i]!, b.curl[i]!);
  out.wrap = l(a.wrap ?? 0, b.wrap ?? 0);
  for (let i = 0; i < 3; i++) out.thumb[i] = l(a.thumb[i]!, b.thumb[i]!);
  out.thumbCurl[0] = l(a.thumbCurl[0], b.thumbCurl[0]);
  out.thumbCurl[1] = l(a.thumbCurl[1], b.thumbCurl[1]);
  out.indexLift = l(a.indexLift ?? 0, b.indexLift ?? 0);
  return out;
}
