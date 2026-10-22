// C18: what every hero gun shares on top of the kit: the family's marks (the faction plate on the left flank and
// the one cyan line), the hand frames (a Kestrel-style grip on any pistol grip, a support hand under a
// handguard), and a few parts more than one gun turns (a crowned muzzle, a picatinny strip, a sling swivel).

import * as THREE from "three";
import { FIN, GLOW, GunKit, decal, fistGrip, gripFrame, lathe, plan, rounded, type P2 } from "../gunkit";

export interface Opts {
  phone: boolean;
  lod: boolean;
}

export const optsOf = (phone: boolean, lod: boolean): { phone: boolean; lod: boolean } => ({ phone: phone || lod, lod });

/** The faction plate on the left flank (gun space: x = -half the part's width), `len` long, centred at (z, y). */
export function faction(kit: GunKit, part: THREE.Object3D, x: number, y: number, z: number, len: number): void {
  kit.add(decal(len, len * 0.107), FIN.faction, { p: [x - 0.0001, y, z], r: [0, Math.PI, 0] }, part);
}

/** The engraved model line (the Kestrel's band) on a flank: `x` < 0 for the left. */
export function engraving(kit: GunKit, part: THREE.Object3D, x: number, y: number, z: number, len: number): void {
  kit.add(decal(len, len * 0.1135), FIN.engraving, { p: [x - 0.0001, y, z], r: [0, Math.PI, 0] }, part);
}

/** The family's one accent: a 1 mm cyan line along -Z at (x, y), from z0 forward `len`. */
export function trim(kit: GunKit, part: THREE.Object3D, x: number, y: number, z0: number, len: number, phone: boolean): void {
  kit.add(rounded(0.0008, 0.0011, len, 0.0003, phone), GLOW.trim, { p: [x, y, z0 - len / 2] }, part);
}

/** A crowned muzzle: the bore as a dark disc inside a bronze crown ring, facing -Z at (0, y, z). */
export function crown(kit: GunKit, part: THREE.Object3D, y: number, z: number, r: number, bore: number, phone: boolean): void {
  kit.add(lathe([[r, z + 0.004], [r, z + 0.0006], [r - 0.0006, z], [bore + 0.0006, z], [bore, z + 0.0015]], { phone }), FIN.bronze, { p: [0, y, 0] }, part);
  kit.add(new THREE.CircleGeometry(bore, phone ? 10 : 16), FIN.bore, { p: [0, y, z + 0.0012], r: [0, Math.PI, 0] }, part);
}

/** A picatinny strip along -Z from z0 for `len` on top of y, `w` wide: a plan-view outline with its slots. */
export function rail(kit: GunKit, part: THREE.Object3D, y: number, z0: number, len: number, w: number, o: { phone: boolean; lod: boolean }): void {
  const n = Math.max(2, Math.round(len / 0.0052));
  const h = w / 2;
  const pts: P2[] = [];
  // Seen from above: notches along both edges at the 5.23 mm pitch.
  pts.push([-h, z0]);
  for (let i = 0; i < n; i++) {
    const z = z0 - (i + 0.25) * (len / n);
    pts.push([-h, z], [-h + 0.0016, z], [-h + 0.0016, z - (len / n) * 0.5], [-h, z - (len / n) * 0.5]);
  }
  pts.push([-h, z0 - len], [h, z0 - len]);
  for (let i = n - 1; i >= 0; i--) {
    const z = z0 - (i + 0.25) * (len / n);
    pts.push([h, z - (len / n) * 0.5], [h - 0.0016, z - (len / n) * 0.5], [h - 0.0016, z], [h, z]);
  }
  pts.push([h, z0]);
  kit.add(plan(pts, 0.004, { ...o, bevel: 0 }), FIN.receiver, { p: [0, y + 0.002, 0] }, part);
  kit.add(rounded(w * 0.62, 0.003, len, 0.0008, o.phone), FIN.receiver, { p: [0, y - 0.0005, z0 - len / 2] }, part);
}

/**
 * The firing hand on a pistol grip whose front strap tops out at `fs` = [z, y], frames as the Kestrel's (tuned
 * in C4/C5), shifted there; the support hand wraps it from the left (a two-handed pistol) when `twoHand`.
 * The thumbs ride the left flank at `thumbX` (minus half the frame's width).
 */
export function pistolGripHands(kit: GunKit, root: THREE.Object3D, fs: P2, thumbX: number, twoHand: boolean): void {
  // The Kestrel's front strap top is (-0.004, -0.031): every frame below is the Kestrel's, offset.
  const dz = fs[0] + 0.004;
  const dy = fs[1] + 0.031;
  const gR = gripFrame(new THREE.Vector3(0.02, -0.016 + dy, 0.07 + dz), new THREE.Vector3(0.05, -0.45, -0.89), new THREE.Vector3(1, 0.2, 0));
  const gripR = kit.empty("gripR", gR.pos.toArray() as [number, number, number], root, gR.quat);
  const nail = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0.35, 0).normalize());
  gripR.userData.thumb = kit.empty("thumbR", [thumbX, 0.0045 + dy, -0.05 + dz], root, nail);
  if (twoHand) {
    const gL = gripFrame(new THREE.Vector3(-0.042, -0.041 + dy, 0.071 + dz), new THREE.Vector3(0.15, -0.35, -0.92), new THREE.Vector3(-1, -0.2, 0));
    const gripL = kit.empty("gripL", gL.pos.toArray() as [number, number, number], root, gL.quat);
    gripL.userData.thumb = kit.empty("thumbL", [thumbX - 0.001, -0.0115 + dy, -0.066 + dz], root, nail);
  }
}

/**
 * A long gun's firing hand: a fist round a pistol grip raked about 18° whose centre (where the middle finger
 * wraps) is `c`, the back of the hand to the right.
 */
export function rifleGripR(kit: GunKit, root: THREE.Object3D, c: [number, number, number], rake = 0.31, rodR = 0.016): void {
  const g = fistGrip(new THREE.Vector3(...c), new THREE.Vector3(0, -Math.cos(rake), Math.sin(rake)), new THREE.Vector3(1, 0.25, 0.15), rodR, 1, 0.062);
  kit.empty("gripR", g.pos.toArray() as [number, number, number], root, g.quat);
}

/** The support hand under a handguard whose axis passes through `c` along Z, `r` its radius. */
export function foreGripL(kit: GunKit, parent: THREE.Object3D, c: [number, number, number], r: number, name = "gripL"): THREE.Object3D {
  const g = fistGrip(new THREE.Vector3(c[0], c[1] + 0.006, c[2]), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-0.45, -1, 0), r, -1, 0.066);
  return kit.empty(name, g.pos.toArray() as [number, number, number], parent, g.quat);
}

/** The support hand round a magazine (rides it through the reload): the palm on its left, fingers round the front. */
export function magHand(kit: GunKit, mag: THREE.Object3D, base: [number, number, number]): void {
  const g = gripFrame(new THREE.Vector3(base[0] - 0.03, base[1] + 0.01, base[2] + 0.03), new THREE.Vector3(0.08, 0.55, -0.83), new THREE.Vector3(-1, -0.1, 0.1));
  kit.empty("magHand", g.pos.toArray() as [number, number, number], mag, g.quat);
}

/** A pinch on a small handle (the charging handle, the bolt knob, a shell): fingers over it from the left. */
export function pinchHand(kit: GunKit, part: THREE.Object3D, name: string, at: [number, number, number], from: [number, number, number] = [-1, 0.3, 0.4]): void {
  const f = new THREE.Vector3(...from).normalize();
  const wrist = new THREE.Vector3(...at).addScaledVector(f, 0.075);
  const g = gripFrame(wrist, f.clone().negate(), new THREE.Vector3(-0.2, 1, 0.3));
  kit.empty(name, g.pos.toArray() as [number, number, number], part, g.quat);
}

/** A cartridge (case and bullet) along -Z from z (its head) in `len`; `r` the case radius. */
export function round(kit: GunKit, part: THREE.Object3D, p: [number, number, number], r: number, len: number, phone: boolean, bullet = 0xa8673a): void {
  const seg = phone ? 8 : 12;
  const cl = len * 0.62;
  // The head, facing back: the primer reads as a small disc a step proud.
  kit.add(new THREE.CircleGeometry(r * 1.06, seg), FIN.brass, { p }, part);
  if (!phone) kit.add(new THREE.CircleGeometry(r * 0.32, 8), FIN.pins, { p: [p[0], p[1], p[2] + 0.0003] }, part);
  kit.add(lathe([[r * 1.06, 0.0], [r * 1.06, -0.0012], [r * 0.9, -0.0016], [r, -0.0024], [r, -cl]], { seg }), FIN.brass, { p }, part);
  kit.add(lathe([[r * 0.92, -cl], [r * 0.88, -cl - (len - cl) * 0.5], [r * 0.5, -len + 0.001], [0, -len]], { seg }), { color: bullet, metal: 1, rough: 0.35 }, { p }, part);
}

/** The support hand round a vertical foregrip whose axis passes through `c` (the hand's middle), down along -Y. */
export function foreGrip(kit: GunKit, parent: THREE.Object3D, c: [number, number, number], name = "gripL"): THREE.Object3D {
  const g = fistGrip(new THREE.Vector3(...c), new THREE.Vector3(0, -1, 0.12), new THREE.Vector3(-1, 0.1, -0.35), 0.0135, -1, 0.064);
  return kit.empty(name, g.pos.toArray() as [number, number, number], parent, g.quat);
}
