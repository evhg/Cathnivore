// Cath's hands and weapons in first person, built in code: black leather gloves, the charcoal trench cuff
// over a cream silk blouse cuff, a pearl bracelet on her left wrist, and four weapons for the slice. Every
// motion is procedural: look sway, walk bob, recoil springs, reloads, the bolt, aiming down the sights.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { adoptMeshes, collapse, FIN, fistGrip, GunKit } from "./gunkit";
import { KESTREL_DOT, buildKestrel } from "./kestrel";
import { POSES, type HandPose } from "./hands";
import { ARSENAL, isHero, type FlashKind, type HeroModel } from "./feel/arsenal";
import { buildRevolver as heroRevolver, REVOLVER_SIGHT } from "./guns/revolver";
import { buildSmg, SMG_SIGHT } from "./guns/smg";
import { buildRifle, RIFLE_SIGHT } from "./guns/rifle";
import { buildShotgun as heroShotgun, SHOTGUN_SIGHT } from "./guns/shotgun";
import { buildSniper as heroSniper, SNIPER_SIGHT } from "./guns/sniper";
import { buildLauncher as heroLauncher, LAUNCHER_SIGHT } from "./guns/launcher";

export type GunModel = "pin" | "pistol" | "shotgun" | "sniper" | "revolver" | "smg" | "rifle" | "launcher" | "sledge" | "blade" | "wire";

const M = {
  glove: new THREE.MeshStandardMaterial({ color: 0x0d0c0c, roughness: 0.42, metalness: 0.0 }),
  coat: new THREE.MeshStandardMaterial({ color: 0x26262b, roughness: 0.92 }),
  silk: new THREE.MeshStandardMaterial({ color: 0xe9e1d2, roughness: 0.5 }),
  pearl: new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.18, metalness: 0.05 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xc9a25a, roughness: 0.25, metalness: 1 }),
  blued: new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.3, metalness: 0.9 }),
  steel: new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.22, metalness: 1 }),
  polymer: new THREE.MeshStandardMaterial({ color: 0x1b1c1f, roughness: 0.7, metalness: 0.05 }),
  walnut: new THREE.MeshStandardMaterial({ color: 0x3b2116, roughness: 0.48, metalness: 0 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.9 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x0a1a24, roughness: 0.05, metalness: 0.4, emissive: 0x041016 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xb08d3c, roughness: 0.3, metalness: 1 }),
  red: new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2a47, emissiveIntensity: 4 }),
  /** Glossy red nail polish showing at the finger tips. */
  polish: new THREE.MeshStandardMaterial({ color: 0x9a0f2a, roughness: 0.12, metalness: 0.2, emissive: 0x2a0309 }),
  /** A thin neon rim along the Pin's shaft, so the baton reads against the dark. */
  rim: new THREE.MeshStandardMaterial({ color: 0x111418, roughness: 0.3, emissive: 0x2ad8ff, emissiveIntensity: 1.6 }),
};

function box(w: number, h: number, d: number, m: THREE.Material, r = 0.004): THREE.Mesh {
  return new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2)), m);
}
function cyl(r: number, len: number, m: THREE.Material, seg = 16, r2 = r): THREE.Mesh {
  const g = new THREE.CylinderGeometry(r, r2, len, seg);
  g.rotateX(Math.PI / 2); // along -Z/+Z (the barrel axis)
  return new THREE.Mesh(g, m);
}
function at<T extends THREE.Object3D>(o: T, x: number, y: number, z: number): T {
  o.position.set(x, y, z);
  return o;
}

export interface GunRig {
  root: THREE.Group;
  /** Where rounds leave, in rig space. */
  muzzle: THREE.Object3D;
  /** Ejection port, in rig space. */
  port: THREE.Object3D;
  /** Parts that move: the slide, the pump, the bolt. */
  action?: THREE.Object3D;
  mag?: THREE.Object3D;
  /** A first-person muzzle flash the weapon shows briefly on each shot. */
  flashMesh?: THREE.Object3D;
  /** Position of the rig when hip-firing and when aiming down the sights (camera space). */
  hip: THREE.Vector3;
  ads: THREE.Vector3;
  /** Field of view when aiming (the sniper's is its scope). */
  adsFov: number;
  /** A scoped weapon hides the rig and shows the scope overlay at full aim. */
  scoped?: boolean;
  /** The viewmodel camera's FOV at full aim (default 54, the hip FOV). */
  adsVmFov?: number;
  /** A rest rotation at the hip (radians, XYZ), blended out as she aims: the muzzle turned a touch out and the
   * slide canted in, so the left flank and the top read instead of the slide's back plate. */
  hipRot?: [number, number, number];
  /** The firing arm's shoulder at the hip (camera space), when this gun wants its own (default hands.ts's). */
  shoulderR?: THREE.Vector3;
  /** C18: the support arm's shoulder at the hip, when this gun wants its own. */
  shoulderL?: THREE.Vector3;
  /** Wrist frames for Cath's hands (hands.ts): Y toward the knuckles, Z the back of the hand. No gripL = one-handed. */
  gripR: THREE.Object3D;
  gripL: THREE.Object3D | null;
  poseR: HandPose;
  poseL: HandPose | null;
  /** Named part nodes and empties (the Kestrel's full list; older guns name what they have). */
  parts: Record<string, THREE.Object3D>;
}

function rig(hip: THREE.Vector3, ads: THREE.Vector3, adsFov: number): GunRig {
  const root = new THREE.Group();
  const muzzle = new THREE.Object3D();
  const port = new THREE.Object3D();
  root.add(muzzle, port);
  const gripR = new THREE.Object3D();
  root.add(gripR);
  return { root, muzzle, port, hip, ads, adsFov, gripR, gripL: null, poseR: POSES.fist!, poseL: null, parts: {} };
}

/**
 * Places the hands' grip frames on an older gun: `right` and `left` are where the old builders put each palm.
 * Long guns get a rifle grip and a support hand under the handguard; one-handed weapons a fist round the handle
 * (inside `handle`, the swinging group, so the hand rides the swing).
 */
function attachHands(r: GunRig, right: [number, number, number], left: [number, number, number] | null, _leftRot = 0, handle?: THREE.Object3D): void {
  if (handle) {
    // A fist round the handle (the handle runs along the group's Z; the butt is +Z).
    const g = fistGrip(new THREE.Vector3(...right), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0), 0.017, 1, 0.068);
    r.gripR.position.copy(g.pos);
    r.gripR.quaternion.copy(g.quat);
    handle.add(r.gripR);
    r.poseR = POSES.fist!;
    if (left) {
      const gl = fistGrip(new THREE.Vector3(...left), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0), 0.017, -1, 0.068);
      r.gripL = new THREE.Object3D();
      r.gripL.position.copy(gl.pos);
      r.gripL.quaternion.copy(gl.quat);
      handle.add(r.gripL);
      r.poseL = POSES.fist!;
    }
    return;
  }
  // A pistol grip raked about 18°, the back of the hand to the right.
  const rake = new THREE.Vector3(0, -0.95, 0.31);
  const g = fistGrip(new THREE.Vector3(right[0], right[1] + 0.01, right[2] - 0.01), rake, new THREE.Vector3(1, 0.25, 0.15), 0.022, 1, 0.062);
  r.gripR.position.copy(g.pos);
  r.gripR.quaternion.copy(g.quat);
  r.poseR = left && left[2] < right[2] - 0.1 ? POSES.rifleR! : POSES.pistolR!;
  if (left) {
    r.gripL = new THREE.Object3D();
    if (left[2] < right[2] - 0.1) {
      // Under the handguard: the rod runs along the barrel (butt toward +Z), the back of the hand down and out.
      const gl = fistGrip(new THREE.Vector3(left[0], left[1] + 0.01, left[2]), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-0.45, -1, 0), 0.02, -1, 0.066);
      r.gripL.position.copy(gl.pos);
      r.gripL.quaternion.copy(gl.quat);
      r.poseL = POSES.foreL!;
    } else {
      const gl = fistGrip(new THREE.Vector3(left[0], left[1], left[2] - 0.012), rake, new THREE.Vector3(-1, -0.55, 0.1), 0.034, -1, 0.06);
      r.gripL.position.copy(gl.pos);
      r.gripL.quaternion.copy(gl.quat);
      r.poseL = POSES.pistolL!;
    }
    r.root.add(r.gripL);
  }
}

/** The Pin: a steel telescopic baton with a knurled rubber grip and a brass end cap. Cath's since the old days. */
function buildPin(): GunRig {
  const r = rig(new THREE.Vector3(0.2, -0.2, -0.38), new THREE.Vector3(0.12, -0.16, -0.34), 70);
  const b = new THREE.Group();
  b.add(at(cyl(0.017, 0.16, M.rubber, 18), 0, 0, 0.0));
  for (let i = 0; i < 7; i++) b.add(at(cyl(0.0185, 0.004, M.rubber, 18), 0, 0, -0.07 + i * 0.022));
  b.add(at(cyl(0.019, 0.02, M.brass, 18), 0, 0, 0.09));
  b.add(at(cyl(0.013, 0.2, M.steel, 16), 0, 0, -0.18));
  b.add(at(box(0.003, 0.0035, 0.19, M.rim, 0.001), 0.0112, 0.0065, -0.18));
  b.add(at(box(0.0025, 0.003, 0.19, M.rim, 0.001), 0.0085, 0.0045, -0.37));
  b.add(at(cyl(0.01, 0.2, M.steel, 16), 0, 0, -0.37));
  b.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.014, 14, 10), M.steel), 0, 0, -0.475));
  b.rotation.x = 1.0; // held up over the shoulder, ready to swing
  b.position.set(0, 0.02, 0);
  r.root.add(b);
  r.action = b;
  r.muzzle.position.set(0, 0.42, -0.26); // the ball end: the swing trail follows it
  attachHands(r, [0, 0, 0.02], null, 0, b);
  return r;
}

/** A soft radial puff (64², generated: no canvas, so it builds in tests too), hot at the centre, gone by the rim. */
let puffTex: THREE.DataTexture | null = null;
function puffTexture(): THREE.DataTexture {
  if (puffTex) return puffTex;
  const N = 64;
  const d = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const u = (x + 0.5) / N - 0.5;
      const v = (y + 0.5) / N - 0.5;
      const r = Math.min(1, Math.hypot(u, v) * 2);
      // A bright core falling off fast, then a long soft skirt; a little angular break-up so it isn't a disc.
      const a = Math.atan2(v, u);
      const k = Math.pow(1 - r, 2.2) * (0.85 + 0.15 * Math.sin(a * 5 + r * 9));
      const o = (y * N + x) * 4;
      const c = Math.round(255 * Math.min(1, Math.max(0, k)));
      d[o] = d[o + 1] = d[o + 2] = c;
      d[o + 3] = c;
    }
  puffTex = new THREE.DataTexture(d, N, N);
  puffTex.needsUpdate = true;
  return puffTex;
}

/** The Kestrel 9 (game/kestrel.ts): built on the kit, every part its own node. */
function buildPistol(phone: boolean): GunRig {
  // Aimed, the gun sits so the red dot's point lands exactly on the camera axis (the screen centre, where rounds
  // go), 0.42 m out: derived from the dot itself, so moving the optic can never leave the dot off the aim point.
  // At the hip: a touch in and up from the corner so the ammo cluster has its own space; on a phone further in
  // and up again, clear of the RELOAD/AIM thumb buttons.
  const hip = phone ? new THREE.Vector3(0.072, -0.074, -0.28) : new THREE.Vector3(0.062, -0.074, -0.28);
  const r = rig(hip, new THREE.Vector3(-KESTREL_DOT[0], -KESTREL_DOT[1], -0.42 - KESTREL_DOT[2]), 52);
  r.hipRot = [0.03, 0.1, 0.06];
  // The firing elbow tucked low and in, so the forearm falls steeply out of the frame's bottom edge instead of
  // running out to the right under the ammo cluster (C4 review: the glove sat under "12 / 60").
  r.shoulderR = new THREE.Vector3(0.0, -0.56, 0.2);
  // Aimed, the viewmodel camera narrows so the gun sits further out (the hands drop away under the dot) at the same size.
  r.adsVmFov = 36;
  const { root, kit } = buildKestrel(phone);
  r.root = root;
  r.parts = kit.parts;
  r.action = kit.parts.slide;
  r.mag = kit.parts.mag;
  r.muzzle = kit.parts.muzzle!;
  r.port = kit.parts.port!;
  r.gripR = kit.parts.gripR!;
  r.gripL = kit.parts.gripL!;
  r.poseR = POSES.pistolR!;
  r.poseL = POSES.pistolL!;
  // A suppressed first-person flash (S2.3): two small crossed quads of hot gas and a core, one frame.
  // C5: every quad carries a soft radial falloff (a flat quad edge-on read as a white needle from the eye).
  const fm = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb070).multiplyScalar(3), map: puffTexture(), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  // Two crossed quads along the bore (gas venting from the crown, 6.5 cm) and a 4 cm core facing her, merged:
  // one draw while it shows.
  // The core sits 2.5 cm past the crown: from the eye the can hides anything closer (S2.3 acceptance: the muzzle
  // region must read brighter on the shot, without a white cross over 0.1 m).
  const quads = [0, 1].map((i) => new THREE.PlaneGeometry(0.065, 0.045).rotateY(Math.PI / 2).rotateX((i * Math.PI) / 2 + Math.PI / 4).translate(0, 0, -0.03));
  quads.push(new THREE.PlaneGeometry(0.065, 0.065).translate(0, 0, -0.025));
  const flash = new THREE.Mesh(mergeGeometries(quads)!, fm);
  flash.position.copy(r.muzzle.position).z -= 0.012;
  flash.visible = false;
  r.root.add(flash);
  r.flashMesh = flash;
  return r;
}

/** The Repossessor: a long-hafted sledge with a brass-banded head, swung from over the shoulder like the Pin. */
function buildSledge(): GunRig {
  const r = rig(new THREE.Vector3(0.2, -0.22, -0.4), new THREE.Vector3(0.12, -0.16, -0.34), 70);
  const b = new THREE.Group();
  b.add(at(cyl(0.017, 0.5, M.walnut, 14), 0, 0, -0.1)); // haft
  b.add(at(cyl(0.019, 0.1, M.rubber, 14), 0, 0, 0.1)); // grip
  b.add(at(box(0.07, 0.07, 0.17, M.steel, 0.008), 0, 0, -0.4)); // head
  b.add(at(box(0.074, 0.074, 0.02, M.brass, 0.004), 0, 0, -0.33)); // band
  b.add(at(box(0.074, 0.074, 0.02, M.brass, 0.004), 0, 0, -0.47));
  b.rotation.x = 1.0;
  b.position.set(0, 0.02, 0);
  r.root.add(b);
  r.action = b;
  r.muzzle.position.set(0, 0.3, -0.3);
  attachHands(r, [0, 0, 0.1], [0, 0, -0.05], 0, b);
  return r;
}

/** Night Shift: a short black-bladed security machete, quick and quiet. */
function buildBlade(): GunRig {
  const r = rig(new THREE.Vector3(0.2, -0.2, -0.38), new THREE.Vector3(0.12, -0.16, -0.34), 70);
  const b = new THREE.Group();
  b.add(at(cyl(0.016, 0.13, M.rubber, 14), 0, 0, 0.02)); // handle
  b.add(at(box(0.07, 0.01, 0.02, M.steel, 0.003), 0, 0, -0.05)); // guard
  const blade = at(box(0.006, 0.045, 0.42, M.blued, 0.002), 0, 0.005, -0.28);
  b.add(blade);
  b.add(at(box(0.002, 0.008, 0.4, M.steel, 0.001), 0, -0.018, -0.28)); // edge
  b.rotation.x = 1.0;
  b.position.set(0, 0.02, 0);
  r.root.add(b);
  r.action = b;
  r.muzzle.position.set(0, 0.3, -0.25);
  attachHands(r, [0, 0, 0.03], null, 0, b);
  return r;
}

/** Cat's Cradle: a monowire on a knuckle ring, the filament glowing red and trailing past the fist. */
function buildWire(): GunRig {
  const r = rig(new THREE.Vector3(0.2, -0.2, -0.38), new THREE.Vector3(0.12, -0.16, -0.34), 70);
  const b = new THREE.Group();
  b.add(at(cyl(0.018, 0.1, M.rubber, 14), 0, 0, 0.02)); // grip
  b.add(at(box(0.05, 0.012, 0.02, M.steel, 0.003), 0, 0, -0.04)); // ring bar
  b.add(at(box(0.002, 0.002, 0.7, M.red, 0.001), 0, 0.01, -0.4)); // the wire
  b.rotation.x = 0.5;
  b.position.set(0, 0.02, 0);
  r.root.add(b);
  r.action = b;
  r.muzzle.position.set(0, 0.2, -0.6);
  attachHands(r, [0, 0, 0.03], null, 0, b);
  return r;
}

let starTex: THREE.DataTexture | null = null;
/** A muzzle star: a hot core and 6 tapering spikes with a little angular jitter (the unsuppressed classes, S2.3). */
function starTexture(): THREE.DataTexture {
  if (starTex) return starTex;
  const N = 128;
  const d = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const u = ((x + 0.5) / N - 0.5) * 2;
      const v = ((y + 0.5) / N - 0.5) * 2;
      const r = Math.hypot(u, v);
      const a = Math.atan2(v, u);
      // Six spikes of uneven length, narrowing to their tips.
      // C18 review r2: at 18 the spikes were hairlines and a small flash read as a stroked vector star; at 7 they
      // are filled flames, and the core is wider so the small and medium stars burn as a solid hot disc.
      const sp = Math.pow(Math.max(0, Math.cos(a * 3)), 7) * (0.75 + 0.25 * Math.sin(a * 7 + 1.3));
      const core = Math.exp(-r * r * 9);
      const spike = sp * Math.max(0, 1 - r) ** 1.4;
      const halo = Math.max(0, 1 - r) ** 3 * 0.35;
      const k = Math.min(1, core + spike + halo);
      const o = (y * N + x) * 4;
      const c = Math.round(255 * k);
      d[o] = d[o + 1] = d[o + 2] = c;
      d[o + 3] = c;
    }
  starTex = new THREE.DataTexture(d, N, N);
  starTex.needsUpdate = true;
  return starTex;
}

/**
 * The first-person flash of an open gun (S2.3, S2.6): crossed quads along the bore with the puff's soft falloff,
 * plus a star facing her, per kind. `prong` adds three comp jets, `brake` two side jets, `large` a wider cone,
 * `backblast` a second blast out of the tube's back (`rear`). One draw each while shown.
 */
function heroFlash(kind: FlashKind, size: number, muzzle: THREE.Object3D, root: THREE.Object3D, rear?: THREE.Vector3, phone = false): THREE.Object3D {
  // The phone's lifted grade (exposure 1.7) and its extra frame blew a one-frame star into a white sheet over the
  // middle of a small screen: smaller and dimmer there.
  const pk = phone ? 0.32 : 1;
  if (phone) size *= 0.8;
  const g = new THREE.Group();
  g.name = "flash";
  const hot = (k: number) => new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb070).multiplyScalar(k * pk), map: puffTexture(), transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const star = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd29a).multiplyScalar(4 * pk), map: starTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const len = size * (kind === "large" ? 1.3 : 1.1);
  const along: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) along.push(new THREE.PlaneGeometry(len, size * 0.55).rotateY(Math.PI / 2).rotateZ((i * Math.PI) / 3).translate(0, 0, -len * 0.45));
  if (kind === "prong") for (let i = 0; i < 3; i++) along.push(new THREE.PlaneGeometry(size * 0.18, size * 0.6).translate(0, size * 0.3, 0).rotateZ(Math.PI / 2 + (i * Math.PI * 2) / 3).translate(0, 0, -0.01));
  if (kind === "brake") for (const sx of [-1, 1]) along.push(new THREE.PlaneGeometry(size * 0.75, size * 0.22).rotateX(-Math.PI / 2).translate((sx * size * 0.42), 0, 0.012));
  const front = new THREE.Mesh(mergeGeometries(along)!, hot(kind === "large" ? 3.4 : 2.8));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(size * 0.9, size * 0.9).translate(0, 0, -size * 0.12), star);
  face.name = "flash-star";
  front.add(face);
  // A soft filled body behind the star (C18 review r2: the SMG's and rifle's stars read as outlines without it).
  front.add(new THREE.Mesh(new THREE.PlaneGeometry(size * 0.6, size * 0.6).translate(0, 0, -size * 0.1), hot(2.2)));
  g.add(front);
  g.position.copy(muzzle.position);
  if (rear) {
    const blast = new THREE.Mesh(mergeGeometries([0, 1, 2].map((i) => new THREE.PlaneGeometry(size * 2.2, size * 0.9).rotateY(Math.PI / 2).rotateZ((i * Math.PI) / 3).translate(0, 0, size * 1.05)))!, hot(2.2));
    blast.position.copy(rear).sub(muzzle.position);
    g.add(blast);
  }
  g.visible = false;
  root.add(g);
  return g;
}

/**
 * C18: a hero gun from guns/*.ts. Aimed, the sight point sits on the camera axis `sightDist` out; at the hip the
 * firing hand lands where the Kestrel's does (`hipFs` the gun's front strap top, so the grip is under her hand).
 */
/** Per class: where the gun sits at the hip (camera space), how far out its sight sits aimed, its rest cant. */
interface HeroPlace {
  build: (phone: boolean, lod?: boolean) => { root: THREE.Group; kit: GunKit };
  sight: readonly [number, number, number];
  /** One-handed-style (the revolver): the hip follows the Kestrel's hand placement from the front strap's top. */
  fs?: [number, number];
  /** Added to the front-strap hip (C18 review: the revolver sat so close behind the eye it read as a block). */
  fsHip?: [number, number, number];
  hip?: [number, number, number];
  hipPhone?: [number, number, number];
  dist: number;
  vmFov: number;
  hipRot: [number, number, number];
  long: boolean;
  scoped?: boolean;
  adsFov: number;
}
export const HERO_PLACE: Record<HeroModel, HeroPlace> = {
  revolver: { build: heroRevolver, sight: REVOLVER_SIGHT, fs: [0.016, -0.01], fsHip: [0.06, -0.045, -0.12], dist: 0.4, vmFov: 36, hipRot: [0.03, 0.5, 0.22], long: false, adsFov: 52 },
  smg: { build: buildSmg, sight: SMG_SIGHT, hip: [0.125, -0.15, -0.36], hipPhone: [0.112, -0.14, -0.36], dist: 0.2, vmFov: 42, hipRot: [0.02, 0.1, 0.05], long: true, adsFov: 54 },
  rifle: { build: buildRifle, sight: RIFLE_SIGHT, hip: [0.125, -0.165, -0.37], hipPhone: [0.112, -0.155, -0.37], dist: 0.2, vmFov: 40, hipRot: [0.02, 0.1, 0.05], long: true, adsFov: 50 },
  shotgun: { build: heroShotgun, sight: SHOTGUN_SIGHT, hip: [0.125, -0.16, -0.38], hipPhone: [0.112, -0.15, -0.38], dist: 0.22, vmFov: 44, hipRot: [0.02, 0.1, 0.06], long: true, adsFov: 58 },
  sniper: { build: heroSniper, sight: SNIPER_SIGHT, hip: [0.125, -0.175, -0.38], hipPhone: [0.088, -0.165, -0.38], dist: 0.12, vmFov: 44, hipRot: [0.02, 0.1, 0.05], long: true, scoped: true, adsFov: 9 },
  launcher: { build: heroLauncher, sight: LAUNCHER_SIGHT, hip: [0.13, -0.17, -0.38], hipPhone: [0.085, -0.165, -0.38], dist: 0.24, vmFov: 44, hipRot: [0.02, 0.1, 0.05], long: true, adsFov: 58 },
};

function heroRig(model: HeroModel, phone: boolean): GunRig {
  const P = HERO_PLACE[model];
  const { root, kit } = P.build(phone);
  const sight = P.sight;
  let hip: THREE.Vector3;
  if (P.fs) {
    // The Kestrel's hip with its front strap top at (-0.004, -0.031): the hand stays where C4 placed it.
    const kHip = phone ? new THREE.Vector3(0.072, -0.074, -0.28) : new THREE.Vector3(0.062, -0.074, -0.28);
    hip = kHip.clone().add(new THREE.Vector3(0, -(P.fs[1] + 0.031), -(P.fs[0] + 0.004)));
    if (P.fsHip) hip.add(new THREE.Vector3(...P.fsHip));
    // C18 review r2: on a phone the long revolver's frame ran under the AIM button, and on desktop its recoil
    // carried the firing glove into the weapon's name: in and left of both.
    hip.x -= phone ? 0.018 : 0.01;
  // C18 review r2: on a phone the long guns' hips sit in and left of the desktop's (the sniper's scope furthest),
  // so no receiver or optic runs under the AIM thumb button (the C18 shots check the HUD clusters).
  } else hip = new THREE.Vector3(...((phone ? P.hipPhone : P.hip) ?? [0.13, -0.15, -0.3]));
  const r = rig(hip, new THREE.Vector3(-sight[0], -sight[1], -P.dist - sight[2]), P.adsFov);
  r.root = root;
  r.parts = kit.parts;
  r.hipRot = P.hipRot;
  if (!P.long) r.shoulderR = new THREE.Vector3(0.0, -0.56, 0.2);
  // A long gun's support arm comes up from the bottom-left corner, not the middle of the frame.
  else r.shoulderL = new THREE.Vector3(-0.34, -0.5, 0.2);
  r.adsVmFov = P.vmFov;
  r.scoped = !!P.scoped;
  r.muzzle = kit.parts.muzzle!;
  r.port = kit.parts.port!;
  r.gripR = kit.parts.gripR!;
  r.gripL = kit.parts.gripL ?? null;
  r.poseR = P.long ? POSES.rifleR! : POSES.pistolR!;
  r.poseL = P.long ? POSES.foreL! : POSES.pistolL!;
  r.mag = kit.parts.mag;
  r.action = kit.parts.bolt ?? kit.parts.pump ?? kit.parts.hammer;
  const f = ARSENAL[model].flash;
  r.flashMesh = heroFlash(f.kind, f.sizeM, r.muzzle, root, kit.parts.rear?.position, phone);
  r.parts.hero = root;
  return r;
}

export function buildGun(model: GunModel, phone = false): GunRig {
  if (isHero(model)) {
    const h = heroRig(model, phone);
    h.root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = false;
    });
    return h;
  }
  const r =
    model === "pin" ? buildPin()
    : model === "pistol" ? buildPistol(phone)
    : model === "sledge" ? buildSledge()
    : model === "blade" ? buildBlade()
    : buildWire();
  // Older builds fold into the kit: a few merged meshes per moving part, the kit's shading and wear.
  if (model !== "pistol") {
    adoptMeshes(r.root, [r.action, r.mag].filter((x): x is THREE.Object3D => !!x), phone);
    if (r.action) r.parts.action = r.action;
    if (r.mag) r.parts.mag = r.mag;
    r.parts.muzzle = r.muzzle;
    r.parts.port = r.port;
    r.parts.gripR = r.gripR;
    if (r.gripL) r.parts.gripL = r.gripL;
  }
  r.root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = false;
      o.receiveShadow = false;
    }
  });
  return r;
}

/**
 * The gun on its own, for display in the world (the first gun's case, S7.1, and dropped guns): no flash. Hands
 * live outside the rig (hands.ts), so nothing else to strip. Materials are the kit's own and shared.
 */
export function buildGunDisplay(model: GunModel, phone = false): THREE.Group {
  const r = buildGun(model, phone);
  r.flashMesh?.removeFromParent();
  return r.root;
}

/**
 * A world gun (S2.1): THREE.LOD over the same kit. LOD0 is the full display model; LOD1 past 8 m is one mesh
 * with no bevels or cut-outs; LOD2 past 30 m is one box in the frame's finish. The first job's stall and dropped
 * guns use it.
 */
export function buildGunLOD(model: GunModel, phone = false): THREE.LOD {
  const lod = new THREE.LOD();
  lod.name = `${model}:lod`;
  const near = buildGunDisplay(model, phone);
  lod.addLevel(near, 0);
  const mid = model === "pistol" ? buildKestrel(true, true).root : isHero(model) ? HERO_PLACE[model].build(true, true).root : buildGunDisplay(model, true);
  const one = collapse(mid);
  if (one) lod.addLevel(one, 8);
  const box = new THREE.Box3().setFromObject(near);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const far = new THREE.Group();
  const kit = new GunKit(far, true);
  kit.add(new THREE.BoxGeometry(Math.max(0.01, size.x), Math.max(0.01, size.y * 0.6), Math.max(0.01, size.z)), FIN.frame, { p: [centre.x, centre.y, centre.z] });
  kit.finish();
  lod.addLevel(far, 30);
  return lod;
}

/**
 * A melee swing as keyframes (seconds, rig offset, rig rotation), forehand: wind up and back over the
 * shoulder, then a fast diagonal chop down and across the screen through the hit at 0.12 s, a heavy
 * follow-through, and the recovery. Backhands mirror it (owner, 2026-10-04: "the animation when firing a
 * baton is super basic").
 */
type Key = [number, [number, number, number], [number, number, number]];
// Tuned by projecting the tip through the view camera: each arc starts just past a top corner and cuts
// through the middle of the screen at the hit.
const SWING_FORE: Key[] = [
  [0, [0, 0, 0], [0, 0, 0]],
  [0.07, [0.05, 0.05, 0.04], [-0.35, -0.15, -0.3]],
  [0.1, [0, 0, -0.08], [0.35, 0.3, 0.3]],
  [0.12, [-0.1, -0.03, -0.14], [0.85, 0.5, 0.4]],
  [0.18, [-0.25, -0.17, -0.07], [1.4, 0.8, 0.65]],
  [0.3, [-0.17, -0.13, 0], [1.0, 0.5, 0.45]],
  [0.5, [0, 0, 0], [0, 0, 0]],
];
/** The backhand: the arm crosses her body, so the hand starts on the left and cuts back to the right. */
const SWING_BACK: Key[] = [
  [0, [0, 0, 0], [0, 0, 0]],
  [0.07, [-0.32, 0.05, 0.04], [-0.35, 0.35, 0.5]],
  [0.1, [-0.3, 0, -0.08], [0.35, 0.1, 0.1]],
  [0.12, [-0.16, -0.03, -0.14], [0.85, -0.35, -0.4]],
  [0.18, [0, -0.17, -0.07], [1.4, -0.75, -0.65]],
  [0.3, [0, -0.13, 0], [1.0, -0.5, -0.45]],
  [0.5, [0, 0, 0], [0, 0, 0]],
];
const ease = (t: number) => t * t * (3 - 2 * t);

/** Springs that drive the rig's offsets: sway from looking, bob from walking, recoil from firing. */
export class ViewAnim {
  readonly pos = new THREE.Vector3();
  readonly rot = new THREE.Euler();
  private sway = new THREE.Vector2();
  private swayVel = new THREE.Vector2();
  private kick = 0;
  private kickVel = 0;
  private kickRot = 0;
  private kickRotVel = 0;
  /** 0 hip .. 1 aimed. */
  aim = 0;
  /** -1..0..1 reload/raise curves set by the weapon. */
  dip = 0;
  roll = 0;
  /** Pump/slide/bolt travel 0..1. */
  action = 0;
  swing = 0;
  /** Seconds into a melee swing (-1 when not swinging), and which way: 1 forehand, -1 backhand. */
  meleeT = -1;
  meleeSide = -1; // flips before each swing, so the first is a forehand
  private readonly mPos = new THREE.Vector3();
  private readonly mRot = new THREE.Vector3();

  private meleePose(): void {
    this.mPos.set(0, 0, 0);
    this.mRot.set(0, 0, 0);
    const t = this.meleeT;
    if (t < 0) return;
    const K = this.meleeSide > 0 ? SWING_FORE : SWING_BACK;
    for (let i = 1; i < K.length; i++) {
      const [t1, p1, r1] = K[i]!;
      if (t > t1 && i < K.length - 1) continue;
      const [t0, p0, r0] = K[i - 1]!;
      const u = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
      // Accelerate out of the wind-up, full speed through the hit, decelerate into the follow-through.
      const k = i === 2 ? u * u : i === 3 ? u : i === 4 ? 1 - (1 - u) * (1 - u) : ease(u);
      this.mPos.set(p0[0] + (p1[0] - p0[0]) * k, p0[1] + (p1[1] - p0[1]) * k, p0[2] + (p1[2] - p0[2]) * k);
      this.mRot.set(r0[0] + (r1[0] - r0[0]) * k, r0[1] + (r1[1] - r0[1]) * k, r0[2] + (r1[2] - r0[2]) * k);
      break;
    }
  }

  fire(strength: number): void {
    this.kickVel += strength * 3.2;
    this.kickRotVel += strength * 9;
  }

  update(dt: number, look: { yaw: number; pitch: number }, stride: number, speed: number, sprint: boolean, landed: number): void {
    // Springs integrate in fixed small steps so they stay stable at any frame rate.
    this.sway.x += -look.yaw * 0.9;
    this.sway.y += look.pitch * 0.9;
    this.sway.clampScalar(-0.6, 0.6);
    let left = dt;
    while (left > 0) {
      const h = Math.min(left, 1 / 240);
      left -= h;
      // Sway: lags behind where she looks, then settles (stiff, well damped).
      this.swayVel.x += (-this.sway.x * 90 - this.swayVel.x * 16) * h;
      this.swayVel.y += (-this.sway.y * 90 - this.swayVel.y * 16) * h;
      this.sway.x += this.swayVel.x * h;
      this.sway.y += this.swayVel.y * h;
      // Recoil: back and up, springing home.
      this.kickVel += (-this.kick * 220 - this.kickVel * 22) * h;
      this.kick += this.kickVel * h;
      this.kickRotVel += (-this.kickRot * 200 - this.kickRotVel * 20) * h;
      this.kickRot += this.kickRotVel * h;
    }
    const steady = 1 - this.aim * 0.85;
    const bob = Math.min(1, speed / 7) * steady;
    const sprintTilt = sprint ? 1 : 0;
    this.meleePose();
    const m = this.mPos;
    const mr = this.mRot;
    this.pos.set(
      m.x + this.sway.x * 0.02 * steady + Math.cos(stride * 0.95) * 0.012 * bob,
      this.sway.y * 0.02 * steady - Math.abs(Math.sin(stride * 0.95)) * 0.014 * bob - landed * 0.03 - this.dip * 0.25 - sprintTilt * 0.03,
      m.z + this.kick * 0.06,
    );
    this.pos.y += m.y;
    this.rot.set(
      -mr.x + this.kickRot * 0.09 + this.sway.y * 0.04 * steady - this.dip * 0.9 + this.swing * 1.4,
      mr.y + this.sway.x * 0.05 * steady + sprintTilt * 0.5 - this.swing * 0.6,
      mr.z + this.roll + this.sway.x * 0.03 * steady + sprintTilt * 0.25,
    );
  }
}

/**
 * The swing's smear: a ribbon traced by the weapon's tip and mid-shaft over the last few hundredths of a
 * second, bright at the head and fading behind, in the first-person layer so it blooms like the street.
 */
export class SwingTrail {
  private static readonly N = 18;
  readonly mesh: THREE.Mesh;
  private readonly pos: Float32Array;
  private readonly col: Float32Array;
  private readonly samples: Array<{ a: THREE.Vector3; b: THREE.Vector3; t: number }> = [];
  private time = 0;
  private readonly tint = new THREE.Color(0.75, 0.9, 1.4);

  constructor(scene: THREE.Scene) {
    const n = SwingTrail.N;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 2 * 3);
    this.col = new Float32Array(n * 2 * 3);
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(this.col, 3));
    const idx: number[] = [];
    for (let i = 0; i < n - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(
      g,
      new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    scene.add(this.mesh);
  }

  /** Each frame: `tip` and `mid` in view-scene space while the swing is live, else null to let it fade. */
  update(dt: number, tip: THREE.Vector3 | null, mid: THREE.Vector3 | null): void {
    this.time += dt;
    if (tip && mid) {
      this.samples.unshift({ a: tip.clone(), b: mid.clone(), t: this.time });
      if (this.samples.length > SwingTrail.N) this.samples.length = SwingTrail.N;
    }
    const LIFE = 0.11;
    while (this.samples.length && this.time - this.samples[this.samples.length - 1]!.t > LIFE) this.samples.pop();
    const n = SwingTrail.N;
    for (let i = 0; i < n; i++) {
      const sm = this.samples[Math.min(i, this.samples.length - 1)];
      const o = i * 6;
      if (!sm) {
        this.pos.fill(0, o, o + 6);
        this.col.fill(0, o, o + 6);
        continue;
      }
      sm.a.toArray(this.pos, o);
      sm.b.toArray(this.pos, o + 3);
      const k = i < this.samples.length ? Math.max(0, 1 - (this.time - sm.t) / LIFE) ** 1.5 * 0.55 : 0;
      this.col[o] = this.tint.r * k;
      this.col[o + 1] = this.tint.g * k;
      this.col[o + 2] = this.tint.b * k;
      // The inner edge fades out, so the smear thins toward the hand.
      this.col[o + 3] = this.tint.r * k * 0.15;
      this.col[o + 4] = this.tint.g * k * 0.15;
      this.col[o + 5] = this.tint.b * k * 0.15;
    }
    const g = this.mesh.geometry;
    g.attributes.position!.needsUpdate = true;
    g.attributes.color!.needsUpdate = true;
    this.mesh.visible = this.samples.length > 1;
  }
}
