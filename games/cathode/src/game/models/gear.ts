// C10 (S3.2): what the Enforcers carry, on the weapon kit. The Hollowell-issue carbine is a real hand-held rifle
// of 16 parts (pistol grip, receiver, rail, handguard with vents, barrel, brake, foregrip, curved magazine,
// skeleton stock, optic, trigger guard, charging handle) that holds up at 3 m (the takedown camera frames it), with
// a bolt that kicks 15 mm when he fires. The sniper's is longer with a 0.35 m scope. The riot shield is a curved
// 0.62 x 1.2 m extrude with a tinted viewport and the Hollowell mark.
//
// The rifle is built in gun space (the kit's: y up, -z toward the muzzle) under a node turned so that the body's
// `place(rifle, handR, handL)` frame (local +Y from the right hand toward the left, +Z up) carries it: the pistol
// grip's centre on the right hand, the foregrip's centre FOREGRIP_M up the line, on the left.

import * as THREE from "three";
import { GunKit, collapse, profile, lathe, rounded, type Finish, type P2 } from "../gunkit";
import { box, chamfer, cyl, plate } from "./parts";

/** Where the support hand holds the foregrip, metres up the line from the right hand (animate.ts reads it). */
export const FOREGRIP_M = 0.3;
/** The bolt's kick when he fires (m). */
export const BOLT_KICK_M = 0.015;

const F = {
  polymer: { color: 0x1b1d21, metal: 0, rough: 0.62, band: "grain", wear: 0.5 },
  steel: { color: 0x2c2f34, metal: 1, rough: 0.36, coat: 0.6, band: "peel", wear: 1 },
  dark: { color: 0x141518, metal: 0.8, rough: 0.45, band: "brushed", wear: 0.6 },
  grip: { color: 0x17181b, metal: 0, rough: 0.7, band: "stipple", wear: 0.3 },
  bore: { color: 0x050506, metal: 0.6, rough: 0.6, wear: 0 },
} satisfies Record<string, Finish>;

export interface Rifle {
  root: THREE.Group;
  bolt: THREE.Object3D;
  muzzle: THREE.Object3D;
  /** The full gun (LOD0), its one-mesh stand-in (LOD1); at LOD2 neither draws (S3.1: capsules and the silhouette). */
  near: THREE.Object3D;
  far: THREE.Object3D;
}

/** Shows the rifle's LOD (the body's): the full gun up close, one mesh at mid range, nothing far off. */
export function rifleLod(r: Rifle, lod: number): void {
  r.near.visible = lod === 0;
  r.far.visible = lod === 1;
}

/** The enemy carbine (or the sniper's long rifle), ready to be placed between the hands. */
export function buildRifle(phone: boolean, sniper = false, lod = phone): Rifle {
  const root = new THREE.Group();
  root.name = "enemyRifle";
  const gun = new THREE.Group();
  // Gun space (y up, -z muzzle) onto the hands' frame (+Y toward the left hand, +Z up).
  gun.rotation.x = Math.PI / 2;
  root.add(gun);
  const k = new GunKit(gun, phone || lod);
  const bolt = k.part("bolt", [0, 0, 0]);
  const muzzle = k.empty("muzzle", [0, 0.078, sniper ? -0.86 : -0.66]);
  // The pistol grip, raked back, its centre on the hand.
  const gripPts: P2[] = [[0.034, 0.05], [-0.004, 0.05], [-0.016, -0.04], [0.008, -0.05], [0.03, -0.046], [0.04, 0.0]];
  k.add(profile(gripPts, 0.032, { bevel: 0.004, phone, lod }), F.grip);
  // The receiver: a long low box with a slanted rear and a magwell.
  const recv: P2[] = [[0.11, 0.05], [-0.17, 0.05], [-0.17, 0.104], [0.07, 0.106], [0.11, 0.09]];
  k.add(profile(chamfer(recv, 0.006), 0.046, { bevel: 0.003, phone, lod }), F.steel);
  // The top rail and its ribs.
  k.add(rounded(0.024, 0.012, 0.3, 0.003, phone || lod), F.dark, { p: [0, 0.113, -0.04] });
  // The handguard: vented, over the barrel.
  const hg: P2[] = [[-0.165, 0.052], [-0.42, 0.056], [-0.42, 0.1], [-0.165, 0.102]];
  const vents: P2[][] = [];
  for (let i = 0; i < 5; i++) {
    const z0 = -0.2 - i * 0.042;
    vents.push([
      [z0, 0.07],
      [z0 - 0.022, 0.07],
      [z0 - 0.022, 0.086],
      [z0, 0.086],
    ]);
  }
  k.add(profile(chamfer(hg, 0.008), 0.054, { bevel: 0.003, holes: vents, phone, lod }), F.polymer);
  // Barrel and brake.
  const bl = sniper ? -0.8 : -0.6;
  k.add(lathe([[0.0095, -0.4], [0.0095, bl], [0.0075, bl - 0.002]], { phone, seg: lod ? 6 : undefined }), F.steel, { p: [0, 0.078, 0] });
  k.add(lathe([[0.015, bl], [0.015, bl - 0.06], [0.012, bl - 0.062], [0.006, bl - 0.062]], { phone, seg: lod ? 6 : undefined }), F.dark, { p: [0, 0.078, 0] });
  k.add(lathe([[0.006, bl - 0.055], [0.006, bl - 0.064]], { phone, seg: lod ? 6 : undefined }), F.bore, { p: [0, 0.078, 0] });
  // The foregrip, its centre on the support hand.
  k.add(lathe([[0.0, 0.0], [0.016, 0.003], [0.017, 0.07], [0.0145, 0.082]], { phone, seg: lod ? 6 : undefined }), F.grip, { p: [0, 0.052, -FOREGRIP_M], r: [Math.PI / 2, 0, 0] });
  // The curved magazine ahead of the trigger.
  const mag: P2[] = [[-0.032, 0.052], [-0.085, 0.052], [-0.118, -0.06], [-0.13, -0.108], [-0.078, -0.12], [-0.06, -0.06]];
  k.add(profile(chamfer(mag, 0.005), 0.03, { bevel: 0.003, phone, lod }), F.steel);
  // The trigger guard.
  const tg: P2[] = [[0.0, 0.05], [-0.004, 0.03], [-0.03, 0.022], [-0.032, 0.05], [-0.026, 0.05], [-0.024, 0.03], [-0.006, 0.036], [-0.006, 0.05]];
  k.add(profile(tg, 0.01, { bevel: 0.001, phone, lod }), F.dark);
  // The skeleton stock with its cheek riser and butt pad.
  const stock: P2[] = [[0.1, 0.055], [0.33, 0.035], [0.335, 0.102], [0.1, 0.1]];
  const hole: P2[] = [[0.14, 0.064], [0.29, 0.054], [0.29, 0.085], [0.14, 0.088]];
  k.add(profile(stock, 0.034, { bevel: 0.004, holes: [hole], phone, lod }), F.polymer);
  k.add(rounded(0.04, 0.085, 0.022, 0.008, phone || lod), F.grip, { p: [0, 0.07, 0.34] });
  // The optic (or the sniper's 0.35 m scope).
  if (sniper) {
    k.add(lathe([[0.022, 0.13], [0.019, 0.1], [0.017, -0.12], [0.024, -0.17], [0.024, -0.22]], { phone, seg: lod ? 6 : undefined }), F.dark, { p: [0, 0.145, 0] });
    k.add(rounded(0.016, 0.03, 0.03, 0.004, phone || lod), F.dark, { p: [0, 0.122, -0.04] });
    k.add(rounded(0.016, 0.03, 0.03, 0.004, phone || lod), F.dark, { p: [0, 0.122, 0.06] });
    k.add(lathe([[0.02, -0.215], [0.02, -0.219]], { phone, seg: lod ? 6 : undefined }), { emit: 0xff3b1a, intensity: 2.4 }, { p: [0, 0.145, 0] });
  } else {
    k.add(rounded(0.034, 0.04, 0.1, 0.008, phone || lod), F.dark, { p: [0, 0.14, -0.05] });
    k.add(rounded(0.026, 0.016, 0.004, 0.003, phone || lod), { emit: 0xffa040, intensity: 2.6 }, { p: [0, 0.142, -0.101] });
  }
  // The charging handle: the moving part that kicks back on each shot.
  k.add(rounded(0.022, 0.012, 0.03, 0.003, phone || lod), F.steel, { p: [0.03, 0.09, -0.02] }, bolt);
  k.add(rounded(0.012, 0.03, 0.012, 0.003, phone || lod), F.steel, { p: [0.041, 0.09, -0.02] }, bolt);
  k.finish();
  // LOD1: a blocky stand-in of the same proportions as one opaque mesh (no glow, no moving bolt).
  const far = new THREE.Group();
  {
    const lowG = new THREE.Group();
    const lk = new GunKit(lowG, true);
    const bl2 = sniper ? -0.8 : -0.6;
    lk.add(box(0.044, 0.056, 0.28, 0, 0), F.steel, { p: [0, 0.077, -0.03] });
    lk.add(box(0.05, 0.048, 0.25, 0, 0), F.polymer, { p: [0, 0.077, -0.29] });
    lk.add(cyl(0.009, 0.009, -bl2 - 0.4, 6), F.steel, { p: [0, 0.078, (bl2 - 0.4) / 2 - 0.02], r: [Math.PI / 2, 0, 0] });
    lk.add(box(0.03, 0.1, 0.035, 0, 0), F.grip, { p: [0, 0.0, 0.02], r: [-0.25, 0, 0] });
    lk.add(box(0.028, 0.12, 0.045, 0, 0), F.steel, { p: [0, -0.01, -0.07], r: [0.25, 0, 0] });
    lk.add(box(0.032, 0.06, 0.24, 0, 0), F.polymer, { p: [0, 0.075, 0.21] });
    lk.add(box(0.03, 0.04, sniper ? 0.3 : 0.1, 0, 0), F.dark, { p: [0, 0.135, -0.05] });
    lk.finish();
    const one = collapse(lowG);
    if (one) {
      one.rotation.copy(gun.rotation);
      far.add(one);
    }
  }
  far.visible = false;
  root.add(far);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.castShadow = true;
  });
  return { root, bolt, muzzle, near: gun, far };
}

/** S3.2: the riot shield, curved, with a tinted viewport and the Hollowell mark, centred on its own origin, facing +Z. */
export function buildShield(visor: number, phone: boolean): THREE.Group {
  const root = new THREE.Group();
  root.name = "riotShield";
  const k = new GunKit(root, phone);
  const W = 0.62;
  const H = 1.2;
  const outline = chamfer(
    [
      [-W / 2, -H / 2],
      [W / 2, -H / 2],
      [W / 2, H / 2],
      [-W / 2, H / 2],
    ],
    0.07,
  );
  const port: P2[] = chamfer(
    [
      [-0.17, 0.28],
      [0.17, 0.28],
      [0.17, 0.4],
      [-0.17, 0.4],
    ],
    0.02,
  );
  const body: Finish = { color: 0x1a2028, metal: 0.15, rough: 0.28, coat: 1, band: "peel", wear: 0.9 };
  k.add(plate(outline, { depth: 0.014, bevel: phone ? 0.004 : 0.006, bend: 0.9, holes: [port] }), body, { p: [0, 0, -0.012] });
  // A raised rim round the face, the viewport's frame, and the mark below it.
  const paint: Finish = { color: 0xb9b5aa, metal: 0, rough: 0.55, band: "flat", wear: 0 };
  for (const [x, y, w, h] of [
    [0, -0.18, 0.36, 0.014],
    [0, -0.4, 0.36, 0.014],
  ] as const)
    k.add(box(w, h, 0.004, 0), paint, { p: [x, y, 0.012] });
  // The tower and its H (the pauldron's mark, shield-sized).
  const s = 0.16;
  const t = 0.016;
  for (const [x, y, len, rot] of [
    [-0.05, -0.29, 0.12, 0],
    [0.05, -0.29, 0.12, 0],
    [0, -0.35, 0.116, Math.PI / 2],
    [-0.026, -0.215, 0.07, 1.05],
    [0.026, -0.215, 0.07, -1.05],
    [-0.02, -0.29, 0.07, 0],
    [0.02, -0.29, 0.07, 0],
    [0, -0.29, 0.04, Math.PI / 2],
  ] as const)
    k.add(box(t, len, 0.004, 0), paint, { p: [x, y, 0.013], r: [0, 0, rot] });
  void s;
  k.finish();
  // The viewport: dark glass tinted with the bearer's visor.
  const c = new THREE.Color(visor).multiplyScalar(0.55);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.12), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.75, depthWrite: false }));
  glass.position.set(0, 0.34, 0.003);
  glass.name = "viewport";
  root.add(glass);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.castShadow = o !== glass;
  });
  return root;
}
