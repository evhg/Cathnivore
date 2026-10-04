// Cath's hands and weapons in first person, built in code: black leather gloves, the charcoal trench cuff
// over a cream silk blouse cuff, a pearl bracelet on her left wrist, and four weapons for the slice. Every
// motion is procedural: look sway, walk bob, recoil springs, reloads, the bolt, aiming down the sights.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

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

/** A gloved hand gripping: palm block, four curled fingers, a thumb. Right hand by default. */
function hand(left = false): THREE.Group {
  const g = new THREE.Group();
  const s = left ? -1 : 1;
  g.add(at(box(0.046, 0.034, 0.075, M.glove, 0.012), 0, 0, 0));
  for (let i = 0; i < 4; i++) {
    const f = box(0.017, 0.019, 0.05, M.glove, 0.008);
    f.position.set(s * (-0.018 + i * 0.0125), -0.02, -0.03);
    f.rotation.x = 1.2;
    g.add(f);
  }
  const thumb = box(0.016, 0.017, 0.045, M.glove, 0.008);
  thumb.position.set(s * 0.028, 0.01, -0.025);
  thumb.rotation.set(0.2, s * 0.6, 0);
  g.add(thumb);
  // Stitching seam on the back of the glove, a little sheen.
  g.add(at(box(0.004, 0.002, 0.05, M.steel, 0.001), 0, 0.018, 0));
  return g;
}

/** Forearm from wrist back towards the elbow: glove cuff, silk blouse cuff, then the trench sleeve. */
function forearm(left = false): THREE.Group {
  const g = new THREE.Group();
  g.add(at(cyl(0.028, 0.03, M.glove, 14), 0, 0, 0.035));
  g.add(at(cyl(0.034, 0.02, M.silk, 14), 0, 0, 0.06));
  const sleeve = cyl(0.05, 0.34, M.coat, 16, 0.042);
  sleeve.position.set(0, 0, 0.24);
  g.add(sleeve);
  // The trench's turned-back cuff and its button.
  g.add(at(cyl(0.053, 0.05, M.coat, 16), 0, 0, 0.09));
  g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.007, 10, 8), M.polymer), 0, 0.05, 0.1));
  if (left) {
    // The pearl bracelet, with a small gold clasp.
    const ring = new THREE.Group();
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      ring.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.0065, 10, 8), M.pearl), Math.cos(a) * 0.031, Math.sin(a) * 0.031, 0));
    }
    ring.add(at(box(0.008, 0.006, 0.008, M.gold, 0.002), 0, -0.033, 0));
    ring.position.z = 0.045;
    g.add(ring);
  }
  return g;
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
  /** Position of the rig when hip-firing and when aiming down the sights (camera space). */
  hip: THREE.Vector3;
  ads: THREE.Vector3;
  /** Field of view when aiming (the sniper's is its scope). */
  adsFov: number;
  /** A scoped weapon hides the rig and shows the scope overlay at full aim. */
  scoped?: boolean;
  leftHand: THREE.Group;
  rightHand: THREE.Group;
}

function rig(hip: THREE.Vector3, ads: THREE.Vector3, adsFov: number): GunRig {
  const root = new THREE.Group();
  const muzzle = new THREE.Object3D();
  const port = new THREE.Object3D();
  root.add(muzzle, port);
  return { root, muzzle, port, hip, ads, adsFov, leftHand: new THREE.Group(), rightHand: new THREE.Group() };
}

/** Right and left elbows in rig space: the forearms run from each hand back to these, off the screen's edges. */
const ELBOW_R = new THREE.Vector3(0.2, -0.32, 0.3);
const ELBOW_L = new THREE.Vector3(-0.22, -0.36, 0.1);

function attachHands(r: GunRig, right: [number, number, number], left: [number, number, number] | null, leftRot = 0): void {
  const arm = (handPos: THREE.Vector3, elbow: THREE.Vector3, isLeft: boolean) => {
    const f = forearm(isLeft);
    f.position.copy(handPos);
    f.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), elbow.clone().sub(handPos).normalize());
    return f;
  };
  const rh = hand(false);
  rh.position.set(...right);
  rh.rotation.x = -0.08;
  r.rightHand = rh;
  r.root.add(rh, arm(rh.position, ELBOW_R, false));
  if (left) {
    const lh = hand(true);
    lh.position.set(...left);
    lh.rotation.set(-0.1, 0, leftRot);
    r.leftHand = lh;
    r.root.add(lh);
    lh.userData.forearm = arm(lh.position, ELBOW_L, true);
    r.root.add(lh.userData.forearm as THREE.Object3D);
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
  b.add(at(cyl(0.01, 0.2, M.steel, 16), 0, 0, -0.37));
  b.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.014, 14, 10), M.steel), 0, 0, -0.475));
  b.rotation.x = 1.0; // held up over the shoulder, ready to swing
  b.position.set(0, 0.02, 0);
  r.root.add(b);
  r.action = b;
  r.muzzle.position.set(0, 0.3, -0.25);
  attachHands(r, [0, 0, 0.02], null);
  return r;
}

/** The Kestrel 9: a compact suppressed pistol, blued slide, a red dot. Quiet enough for the market. */
function buildPistol(): GunRig {
  const r = rig(new THREE.Vector3(0.14, -0.15, -0.36), new THREE.Vector3(0, -0.062, -0.3), 52);
  const g = new THREE.Group();
  const slide = new THREE.Group();
  slide.add(at(box(0.03, 0.032, 0.18, M.blued, 0.005), 0, 0.03, -0.06));
  for (let i = 0; i < 6; i++) slide.add(at(box(0.031, 0.022, 0.003, M.polymer, 0.001), 0, 0.03, 0.0 + i * 0.006)); // serrations
  slide.add(at(box(0.016, 0.02, 0.026, M.polymer, 0.003), 0, 0.055, -0.02)); // red dot body
  slide.add(at(box(0.012, 0.012, 0.002, M.glass, 0.001), 0, 0.058, -0.033));
  slide.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.0012, 6, 6), M.red), 0, 0.057, -0.034));
  g.add(slide);
  g.add(at(box(0.028, 0.025, 0.15, M.polymer, 0.004), 0, 0.006, -0.05)); // frame
  const grip = box(0.028, 0.1, 0.045, M.polymer, 0.006);
  grip.position.set(0, -0.04, 0.02);
  grip.rotation.x = 0.22;
  g.add(grip);
  g.add(at(box(0.004, 0.02, 0.025, M.polymer, 0.002), 0, -0.012, -0.025)); // trigger guard
  // The suppressor, long and matte.
  g.add(at(cyl(0.017, 0.16, M.polymer, 18), 0, 0.028, -0.23));
  g.add(at(cyl(0.0175, 0.01, M.steel, 18), 0, 0.028, -0.155));
  r.root.add(g);
  r.action = slide;
  r.muzzle.position.set(0, 0.028, -0.32);
  r.port.position.set(0.015, 0.035, -0.05);
  attachHands(r, [0, -0.045, 0.035], [-0.012, -0.05, 0.02], -0.5);
  return r;
}

/** The Fishmonger: a pump shotgun, walnut furniture, a heat shield, a sling swivel. */
function buildShotgun(): GunRig {
  const r = rig(new THREE.Vector3(0.16, -0.17, -0.42), new THREE.Vector3(0, -0.085, -0.34), 58);
  const g = new THREE.Group();
  g.add(at(box(0.04, 0.06, 0.2, M.blued, 0.006), 0, 0, 0)); // receiver
  g.add(at(cyl(0.012, 0.56, M.blued, 16), 0, 0.012, -0.38)); // barrel
  g.add(at(cyl(0.011, 0.44, M.blued, 16), 0, -0.016, -0.32)); // magazine tube
  const shield = box(0.028, 0.012, 0.32, M.polymer, 0.003);
  shield.position.set(0, 0.026, -0.3);
  g.add(shield);
  for (let i = 0; i < 8; i++) g.add(at(box(0.029, 0.013, 0.012, M.blued, 0.002), 0, 0.027, -0.18 - i * 0.034)); // shield holes (ribs)
  g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.004, 8, 6), M.brass), 0, 0.022, -0.64)); // bead sight
  const pump = new THREE.Group();
  pump.add(at(box(0.042, 0.04, 0.14, M.walnut, 0.01), 0, -0.018, -0.3));
  for (let i = 0; i < 6; i++) pump.add(at(box(0.043, 0.004, 0.006, M.polymer, 0.001), 0, -0.018, -0.25 - i * 0.018));
  g.add(pump);
  const stock = box(0.038, 0.07, 0.24, M.walnut, 0.012);
  stock.position.set(0, -0.03, 0.2);
  stock.rotation.x = 0.12;
  g.add(stock);
  g.add(at(box(0.04, 0.08, 0.02, M.rubber, 0.006), 0, -0.045, 0.32)); // recoil pad
  const grip = box(0.03, 0.08, 0.04, M.walnut, 0.008);
  grip.position.set(0, -0.055, 0.07);
  grip.rotation.x = 0.35;
  g.add(grip);
  r.root.add(g);
  r.action = pump;
  r.muzzle.position.set(0, 0.012, -0.67);
  r.port.position.set(0.022, 0.01, -0.02);
  attachHands(r, [0, -0.07, 0.08], [-0.005, -0.045, -0.3], -1.2);
  // The left hand (and its forearm) ride the pump.
  pump.add(r.leftHand, r.leftHand.userData.forearm as THREE.Object3D);
  return r;
}

/** The Widowmaker: a bolt-action rifle with a long scope, a suppressor and a folding bipod. */
function buildSniper(): GunRig {
  const r = rig(new THREE.Vector3(0.2, -0.21, -0.5), new THREE.Vector3(0, -0.095, -0.28), 9);
  r.scoped = true;
  const g = new THREE.Group();
  g.add(at(cyl(0.02, 0.24, M.blued, 18), 0, 0, -0.02)); // receiver
  g.add(at(cyl(0.013, 0.62, M.blued, 16), 0, 0, -0.45)); // barrel
  g.add(at(cyl(0.02, 0.2, M.polymer, 18), 0, 0, -0.84)); // suppressor
  const stock = new THREE.Group();
  stock.add(at(box(0.05, 0.07, 0.62, M.polymer, 0.015), 0, -0.035, -0.06));
  stock.add(at(box(0.045, 0.1, 0.18, M.polymer, 0.02), 0, -0.05, 0.28));
  stock.add(at(box(0.03, 0.03, 0.12, M.polymer, 0.01), 0, 0.02, 0.24)); // cheek riser
  g.add(stock);
  // Scope: tube, bells, turrets, lens glints.
  const scope = new THREE.Group();
  scope.add(at(cyl(0.017, 0.26, M.blued, 20), 0, 0, 0));
  scope.add(at(cyl(0.026, 0.07, M.blued, 22, 0.018), 0, 0, -0.16));
  scope.add(at(cyl(0.021, 0.05, M.blued, 22, 0.017), 0, 0, 0.14));
  scope.add(at(cyl(0.024, 0.003, M.glass, 22), 0, 0, -0.196));
  scope.add(at(box(0.016, 0.022, 0.022, M.blued, 0.004), 0, 0.026, -0.01));
  scope.add(at(box(0.022, 0.016, 0.022, M.blued, 0.004), 0.026, 0, -0.01));
  scope.add(at(box(0.012, 0.03, 0.02, M.blued, 0.003), 0, -0.024, -0.08)); // rings
  scope.add(at(box(0.012, 0.03, 0.02, M.blued, 0.003), 0, -0.024, 0.06));
  scope.position.set(0, 0.052, -0.04);
  g.add(scope);
  // The bolt handle: it's what cycles after every shot.
  const bolt = new THREE.Group();
  bolt.add(at(cyl(0.006, 0.05, M.steel, 10), 0.028, 0, 0));
  bolt.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.011, 12, 10), M.steel), 0.05, -0.006, 0));
  bolt.position.set(0, 0.004, 0.06);
  g.add(bolt);
  g.add(at(box(0.04, 0.035, 0.06, M.blued, 0.006), 0, -0.07, 0.0)); // magazine
  r.root.add(g);
  r.action = bolt;
  // A long rifle up close swamps the frame: carry it a little smaller and lower.
  g.scale.setScalar(0.82);
  r.muzzle.position.set(0, 0, -0.95 * 0.82);
  r.port.position.set(0.02, 0.01, 0.02);
  attachHands(r, [0, -0.07, 0.17], [-0.005, -0.06, -0.24], -1.3);
  return r;
}

/** The Old Testament: a long-barrelled revolver, walnut grip, a fluted cylinder that swings out to reload. */
function buildRevolver(): GunRig {
  const r = rig(new THREE.Vector3(0.14, -0.15, -0.36), new THREE.Vector3(0, -0.066, -0.3), 52);
  const g = new THREE.Group();
  g.add(at(box(0.03, 0.045, 0.1, M.steel, 0.006), 0, 0.01, -0.02)); // frame
  g.add(at(cyl(0.013, 0.2, M.steel, 16), 0, 0.022, -0.2)); // barrel
  g.add(at(box(0.012, 0.016, 0.2, M.steel, 0.003), 0, 0.04, -0.2)); // rib
  const cyln = at(cyl(0.024, 0.065, M.blued, 6), 0, 0.01, -0.02);
  cyln.rotation.x = Math.PI / 2;
  g.add(cyln);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.add(at(cyl(0.004, 0.066, M.brass, 8), Math.cos(a) * 0.016, 0.01 + Math.sin(a) * 0.016, -0.02)).rotation.x = Math.PI / 2;
  }
  g.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.004, 8, 6), M.brass), 0, 0.05, -0.3)); // front sight
  const hammer = at(box(0.008, 0.026, 0.014, M.steel, 0.002), 0, 0.045, 0.04);
  g.add(hammer);
  const grip = box(0.03, 0.1, 0.045, M.walnut, 0.01);
  grip.position.set(0, -0.045, 0.05);
  grip.rotation.x = 0.3;
  g.add(grip);
  g.add(at(box(0.004, 0.02, 0.03, M.steel, 0.002), 0, -0.02, 0.0)); // trigger guard
  r.root.add(g);
  r.action = hammer;
  r.muzzle.position.set(0, 0.022, -0.31);
  r.port.position.set(0.016, 0.01, -0.02);
  attachHands(r, [0, -0.05, 0.05], [-0.012, -0.055, 0.04], -0.5);
  return r;
}

/** SMGs and rifles share a build: a boxy receiver, a magazine, a short stock; `long` stretches it into the AR. */
function buildAuto(long: boolean): GunRig {
  const r = rig(new THREE.Vector3(0.17, -0.17, -0.42), new THREE.Vector3(0, -0.075, -0.32), long ? 56 : 54);
  const g = new THREE.Group();
  const len = long ? 0.52 : 0.28;
  g.add(at(box(0.04, 0.062, 0.28, M.polymer, 0.008), 0, 0, -0.02)); // receiver
  g.add(at(box(0.034, 0.02, 0.3, M.blued, 0.004), 0, 0.04, -0.02)); // top rail
  g.add(at(cyl(0.012, len, M.blued, 14), 0, 0.012, -0.16 - len / 2)); // barrel
  g.add(at(cyl(0.018, long ? 0.3 : 0.14, M.polymer, 16), 0, 0.012, -0.16 - (long ? 0.2 : 0.1))); // handguard / can
  const mag = box(0.03, 0.12, 0.05, M.polymer, 0.006);
  mag.position.set(0, -0.09, -0.06);
  mag.rotation.x = long ? 0.18 : 0.05;
  g.add(mag);
  const grip = box(0.03, 0.09, 0.04, M.polymer, 0.008);
  grip.position.set(0, -0.07, 0.1);
  grip.rotation.x = 0.3;
  g.add(grip);
  g.add(at(box(0.036, 0.06, long ? 0.26 : 0.18, M.polymer, 0.01), 0, -0.01, 0.28)); // stock
  g.add(at(box(0.012, 0.028, 0.012, M.blued, 0.002), 0, 0.066, long ? -0.5 : -0.3)); // front post
  g.add(at(box(0.016, 0.03, 0.02, M.blued, 0.003), 0, 0.066, 0.1)); // rear sight
  g.add(at(box(0.01, 0.012, 0.02, M.red, 0.002), 0, 0.083, 0.1));
  const bolt = at(box(0.008, 0.012, 0.03, M.steel, 0.002), 0.022, 0.02, 0.0); // charging handle
  g.add(bolt);
  r.root.add(g);
  r.action = bolt;
  r.muzzle.position.set(0, 0.012, -(0.16 + len + 0.02));
  r.port.position.set(0.022, 0.015, 0.0);
  attachHands(r, [0, -0.08, 0.1], [-0.005, -0.04, long ? -0.32 : -0.2], -1.2);
  return r;
}

/** The Bargain Bin: a fat tube launcher with a drum, a top sight and a pistol grip. */
function buildLauncher(): GunRig {
  const r = rig(new THREE.Vector3(0.17, -0.18, -0.44), new THREE.Vector3(0, -0.08, -0.34), 58);
  const g = new THREE.Group();
  g.add(at(cyl(0.04, 0.5, M.blued, 20), 0, 0.01, -0.2)); // tube
  g.add(at(cyl(0.05, 0.05, M.steel, 20), 0, 0.01, -0.46)); // muzzle collar
  const drum = at(cyl(0.05, 0.12, M.polymer, 6), 0, -0.01, 0.0);
  drum.rotation.x = Math.PI / 2;
  g.add(drum);
  g.add(at(box(0.012, 0.04, 0.03, M.blued, 0.003), 0, 0.07, -0.1)); // sight
  const grip = box(0.03, 0.09, 0.04, M.polymer, 0.008);
  grip.position.set(0, -0.08, 0.06);
  grip.rotation.x = 0.3;
  g.add(grip);
  g.add(at(box(0.03, 0.09, 0.03, M.polymer, 0.006), 0, -0.07, -0.2)); // foregrip
  g.add(at(box(0.034, 0.06, 0.2, M.polymer, 0.01), 0, -0.01, 0.22)); // stock
  r.root.add(g);
  r.muzzle.position.set(0, 0.01, -0.5);
  r.port.position.set(0.03, 0.01, 0.0);
  attachHands(r, [0, -0.08, 0.06], [-0.005, -0.06, -0.2], -1.2);
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
  attachHands(r, [0, 0, 0.1], [0, 0, -0.05], 0);
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
  attachHands(r, [0, 0, 0.03], null);
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
  attachHands(r, [0, 0, 0.03], null);
  return r;
}

export function buildGun(model: GunModel): GunRig {
  const r =
    model === "pin" ? buildPin()
    : model === "pistol" ? buildPistol()
    : model === "shotgun" ? buildShotgun()
    : model === "revolver" ? buildRevolver()
    : model === "smg" ? buildAuto(false)
    : model === "rifle" ? buildAuto(true)
    : model === "launcher" ? buildLauncher()
    : model === "sledge" ? buildSledge()
    : model === "blade" ? buildBlade()
    : model === "wire" ? buildWire()
    : buildSniper();
  r.root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = false;
      o.receiveShadow = false;
    }
  });
  return r;
}

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
    this.pos.set(
      this.sway.x * 0.02 * steady + Math.cos(stride * 0.95) * 0.012 * bob,
      this.sway.y * 0.02 * steady - Math.abs(Math.sin(stride * 0.95)) * 0.014 * bob - landed * 0.03 - this.dip * 0.25 - sprintTilt * 0.03,
      this.kick * 0.06,
    );
    this.rot.set(
      this.kickRot * 0.09 + this.sway.y * 0.04 * steady - this.dip * 0.9 + this.swing * 1.4,
      this.sway.x * 0.05 * steady + sprintTilt * 0.5 - this.swing * 0.6,
      this.roll + this.sway.x * 0.03 * steady + sprintTilt * 0.25,
    );
  }
}
