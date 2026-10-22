// The Old Testament (C18, S2.6): a six-inch .357 on a blued frame with a full underlug and a vented rib, walnut
// grips with a bronze medallion, a fluted cylinder that swings out on its crane, an ejector star that throws six
// cases, and a speedloader. Gun space as the Kestrel's: -Z the muzzle, +Y up; the bore on y = 0.036.
//
// Moving parts: frame (with the barrel), crane > cylinder > ejector > rounds, hammer, trigger, loader >
// loaderRounds. Empties: muzzle, port (the cylinder gap), sight, sightF, sightR, barrel, gripR/L, thumbR/L,
// loadHand.

import * as THREE from "three";
import { FIN, GLOW, GunKit, arc, facade, lathe, profile, rounded, sphere, type P2 } from "../gunkit";
import { crown, faction, optsOf, pinchHand, pistolGripHands, round, trim } from "./common";

const BORE = 0.036;
const CYL_R = 0.0195;
const CH_R = 0.0118; // chamber circle radius
const CYL_Y = BORE - CH_R;
const CYL_Z0 = 0.012; // rear face
const CYL_Z1 = -0.028; // front face
/** The crane's pin (its rotation axis runs along Z), and the cylinder's axis relative to it. */
export const CRANE_PIN: [number, number, number] = [-0.0105, 0.0055, 0];
const CYL_IN_CRANE: [number, number] = [0.0105, CYL_Y - 0.0055];
const CRANE_OPEN = (82 * Math.PI) / 180;
/** Rear sight notch: aimed, this point sits on the camera axis. */
export const REVOLVER_SIGHT: readonly [number, number, number] = [0, 0.0538, 0.035];
/** The front strap's top (the grip's hands hang from it). */
const FS: P2 = [0.016, -0.01];

/** The cylinder seen from behind: a circle with six flutes cut between the chambers, and the six bores. */
function cylinderOutline(seg: number): { outer: P2[]; holes: P2[][] } {
  const outer: P2[] = [];
  const rc = 0.0222;
  const rn = 0.0046;
  for (let i = 0; i < seg; i++) {
    const t = (i / seg) * Math.PI * 2;
    const ux = Math.cos(t);
    const uy = Math.sin(t);
    let r = CYL_R;
    for (let f = 0; f < 6; f++) {
      const phi = Math.PI / 2 + Math.PI / 6 + (f * Math.PI) / 3;
      const cx = Math.cos(phi) * rc;
      const cy = Math.sin(phi) * rc;
      const cu = cx * ux + cy * uy;
      const disc = rn * rn - (cx * cx + cy * cy) + cu * cu;
      if (disc > 0) r = Math.min(r, cu - Math.sqrt(disc));
    }
    outer.push([ux * r, uy * r]);
  }
  const holes: P2[][] = [];
  for (let c = 0; c < 6; c++) {
    const a = Math.PI / 2 + (c * Math.PI) / 3;
    holes.push(arc(Math.cos(a) * CH_R, Math.sin(a) * CH_R, 0.0049, 0, Math.PI * 2, seg > 40 ? 12 : 8).slice(0, -1).reverse());
  }
  return { outer, holes };
}

export function buildRevolver(phone = false, lod = false): { root: THREE.Group; kit: GunKit } {
  const root = new THREE.Group();
  root.name = "oldTestament";
  const kit = new GunKit(root, phone || lod);
  const o = optsOf(phone, lod);

  // ---- Frame (blued), the barrel with its full underlug and vented rib, the walnut grips.
  const frame = kit.part("frame");
  const frameOut: P2[] = [
    [0.041, 0.05],
    [-0.031, 0.05],
    [-0.0345, 0.047],
    [-0.0345, 0.006],
    [-0.031, -0.002],
    [-0.026, -0.004],
    [-0.024, -0.026],
    ...arc(-0.014, -0.025, 0.009, Math.PI, Math.PI * 1.5, 3),
    [0.004, -0.034],
    [0.012, -0.026],
    [FS[0], FS[1]],
    [0.022, -0.04],
    [0.029, -0.074],
    [0.035, -0.097],
    [0.05, -0.102],
    [0.067, -0.098],
    [0.07, -0.072],
    [0.065, -0.032],
    [0.061, -0.006],
    [0.059, 0.012],
    [0.055, 0.027],
    [0.05, 0.038],
    [0.046, 0.046],
  ];
  const window: P2[] = [[0.0132, 0.0032], [-0.0296, 0.0032], [-0.0296, 0.0456], [0.0132, 0.0456]];
  const guardHole: P2[] = [[-0.021, -0.006], [-0.0195, -0.023], [-0.013, -0.029], [0.002, -0.029], [0.008, -0.022], [0.011, -0.008]];
  kit.add(profile(frameOut, 0.034, { bevel: 0.0012, holes: [window, guardHole], ...o }), FIN.blued, undefined, frame);
  // The recoil shield behind the cylinder (the frame's window shows it): a flat steel face with the firing-pin hole.
  kit.add(rounded(0.03, 0.04, 0.003, 0.002, o.phone), FIN.blued, { p: [0, 0.0245, 0.0148] }, frame);
  // Walnut grips, proud of the frame, a bronze medallion inset on each.
  const panel: P2[] = [
    [0.0195, -0.013],
    [0.026, -0.045],
    [0.033, -0.092],
    [0.049, -0.097],
    [0.064, -0.094],
    [0.066, -0.07],
    [0.061, -0.032],
    [0.057, -0.006],
    [0.044, -0.004],
    [0.026, -0.006],
  ];
  kit.add(profile(panel, 0.039, { bevel: 0.0022, ...o }), FIN.walnut, undefined, frame);
  for (const x of [-1, 1]) kit.add(lathe([[0.0062, 0.0006], [0.0062, -0.0004], [0.0052, -0.0008], [0, -0.0009]], { seg: o.phone ? 10 : 18 }), FIN.bronze, { p: [x * 0.0196, -0.052, 0.047], r: [0, (x * Math.PI) / 2, 0] }, frame);
  // The barrel: flat-sided, a full-length underlug enclosing the ejector rod, the crown at its face.
  const bz1 = -0.2015;
  const barrelOut: P2[] = [
    [-0.033, 0.046],
    [bz1 + 0.0035, 0.046],
    [bz1, 0.0425],
    [bz1, 0.012],
    [bz1 + 0.004, 0.0085],
    [-0.038, 0.0085],
    [-0.033, 0.012],
  ];
  kit.add(profile(barrelOut, 0.0212, { bevel: 0.001, ...o }), FIN.blued, undefined, frame);
  crown(kit, frame, BORE, bz1 - 0.0012, 0.0078, 0.0046, o.phone);
  // The vented rib: a strip on top, six windows through it.
  const ribOut: P2[] = [[-0.03, 0.046], [bz1 + 0.004, 0.046], [bz1 + 0.006, 0.0512], [-0.03, 0.0512]];
  const vents: P2[][] = o.phone ? [] : Array.from({ length: 6 }, (_, i) => {
    const z = -0.05 - i * 0.024;
    return [[z, 0.047], [z - 0.014, 0.047], [z - 0.014, 0.0496], [z, 0.0496]] as P2[];
  });
  kit.add(profile(ribOut, 0.0072, { bevel: 0.0005, holes: vents, ...o }), FIN.blued, undefined, frame);
  // The front sight: a ramp on the rib's nose with a tritium insert; the rear: a notched blade on the top strap.
  kit.add(profile([[bz1 + 0.006, 0.0512], [bz1 + 0.022, 0.0512], [bz1 + 0.009, 0.0568], [bz1 + 0.006, 0.0568]], 0.0036, { bevel: 0.0004, ...o }), FIN.blued, undefined, frame);
  kit.add(sphere(0.0011, o.phone), GLOW.tritium, { p: [0, 0.0558, bz1 + 0.0072], s: [1, 1, 0.4] }, frame);
  kit.add(facade([[-0.006, 0], [0.006, 0], [0.006, 0.0058], [0.0016, 0.0058], [0.0016, 0.0028], [-0.0016, 0.0028], [-0.0016, 0.0058], [-0.006, 0.0058]], 0.008, { ...o }), FIN.blued, { p: [0, 0.05, 0.034] }, frame);
  for (const x of [-0.0035, 0.0035]) kit.add(sphere(0.0009, o.phone), GLOW.tritium, { p: [x, 0.0535, 0.0382], s: [1, 1, 0.4] }, frame);
  // The family: the faction plate on the barrel's left flat, the cyan line along the underlug.
  faction(kit, frame, -0.0106, 0.029, -0.12, 0.07);
  trim(kit, frame, -0.0107, 0.0112, -0.045, 0.145, o.phone);
  // Side-plate screws.
  for (const [z, y] of [[0.026, 0.002], [0.03, 0.036], [-0.02, -0.002]] as P2[]) kit.add(lathe([[0.0022, 0.0009], [0.0022, 0], [0, -0.0003]], { seg: 8 }), FIN.pins, { p: [0.0171, y, z], r: [0, Math.PI / 2, 0] }, frame);
  kit.empty("barrel", [0, BORE, -0.12], frame);
  kit.empty("sightF", [0, 0.0568, bz1 + 0.008], frame);
  kit.empty("sightR", [0, 0.0538, 0.035], frame);
  kit.empty("sight", [...REVOLVER_SIGHT], frame);

  // ---- Crane > cylinder > ejector > rounds.
  const crane = kit.part("crane", CRANE_PIN);
  // The yoke: the arm from the pin up to the cylinder's axis, just ahead of its front face.
  kit.add(rounded(0.024, 0.006, 0.004, 0.0015, o.phone), FIN.blued, { p: [CYL_IN_CRANE[0] * 0.5, CYL_IN_CRANE[1] * 0.5, CYL_Z1 - 0.0035], r: [0, 0, Math.atan2(CYL_IN_CRANE[1], CYL_IN_CRANE[0])] }, crane);
  kit.add(lathe([[0.0052, CYL_Z1 - 0.001], [0.0052, CYL_Z1 - 0.007]], { seg: o.phone ? 10 : 16 }), FIN.blued, { p: [CYL_IN_CRANE[0], CYL_IN_CRANE[1], 0] }, crane);
  const cyl = kit.part("cylinder", [CYL_IN_CRANE[0], CYL_IN_CRANE[1], 0], crane);
  const co = cylinderOutline(o.phone ? 36 : 72);
  kit.add(facade(co.outer, CYL_Z0 - CYL_Z1, { bevel: 0.0009, holes: co.holes, ...o, curve: 1 }), FIN.blued, { p: [0, 0, (CYL_Z0 + CYL_Z1) / 2] }, cyl);
  // The front face's forcing ring, bronze, so the chambers' mouths read.
  const ej = kit.part("ejector", [0, 0, 0], cyl);
  // The ejector rod forward of the cylinder (inside the underlug when closed) and the extractor star at the back.
  kit.add(lathe([[0.0028, CYL_Z1 - 0.002], [0.0028, -0.07], [0.0034, -0.071], [0.0034, -0.078], [0.002, -0.079]], { seg: o.phone ? 8 : 12 }), FIN.pins, undefined, ej);
  const star: P2[] = [];
  for (let i = 0; i < 12; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 6 + Math.PI / 6;
    star.push([Math.cos(a) * (i % 2 ? 0.0098 : 0.0142), Math.sin(a) * (i % 2 ? 0.0098 : 0.0142)]);
  }
  kit.add(facade(star, 0.0016, { bevel: 0.0003, ...o }), FIN.bronze, { p: [0, 0, CYL_Z0 + 0.0002] }, ej);
  const rounds = kit.part("rounds", [0, 0, 0], ej);
  for (let c = 0; c < 6; c++) {
    const a = Math.PI / 2 + (c * Math.PI) / 3;
    round(kit, rounds, [Math.cos(a) * CH_R, Math.sin(a) * CH_R, CYL_Z0 + 0.0013], 0.0046, 0.036, o.phone);
  }

  // ---- Hammer: a checkered spur behind the top strap, down at rest (0), cocked 32° back on the pull.
  const hammer = kit.part("hammer", [0, 0.034, 0.043]);
  const spur: P2[] = [[0.0035, -0.002], [-0.003, -0.002], [-0.003, 0.012], [-0.0005, 0.0185], [0.006, 0.0215], [0.0155, 0.022], [0.0165, 0.018], [0.008, 0.0165], [0.004, 0.012]];
  kit.add(profile(spur, 0.0072, { bevel: 0.0006, ...o }), FIN.blued, undefined, hammer);
  // ---- Trigger: a smooth combat blade.
  const TP: [number, number, number] = [0, -0.004, -0.008];
  const trigger = o.phone ? kit.empty("trigger", TP, frame) : kit.part("trigger", TP);
  const tParent = o.phone ? frame : trigger;
  const tOff = (p: [number, number, number]): [number, number, number] => (o.phone ? [p[0] + TP[0], p[1] + TP[1], p[2] + TP[2]] : p);
  kit.add(profile([[0.002, 0], [-0.003, 0], [-0.007, -0.011], [-0.006, -0.02], [-0.0035, -0.0205], [-0.002, -0.012], [0.0025, -0.004]], 0.0058, { bevel: 0.0006, ...o }), FIN.blued, { p: tOff([0, 0, 0]) }, tParent);

  // ---- The speedloader: a knurled knob, six rounds in its fingers, seated at the OPEN cylinder's rear face.
  const ox = CRANE_PIN[0] + CYL_IN_CRANE[0] * Math.cos(CRANE_OPEN) - CYL_IN_CRANE[1] * Math.sin(CRANE_OPEN);
  const oy = CRANE_PIN[1] + CYL_IN_CRANE[0] * Math.sin(CRANE_OPEN) + CYL_IN_CRANE[1] * Math.cos(CRANE_OPEN);
  const loader = kit.part("loader", [ox, oy, 0]);
  loader.rotation.z = CRANE_OPEN;
  loader.userData.rest = { pos: [ox, oy, 0], rot: [0, 0, CRANE_OPEN] };
  kit.add(lathe([[0.016, CYL_Z0 + 0.0115], [0.0168, CYL_Z0 + 0.0095], [0.0168, CYL_Z0 + 0.0055], [0.0155, CYL_Z0 + 0.004], [0.006, CYL_Z0 + 0.0038]], { seg: o.phone ? 12 : 24 }), FIN.grip, undefined, loader);
  kit.add(lathe([[0.0048, CYL_Z0 + 0.03], [0.0048, CYL_Z0 + 0.0115], [0, CYL_Z0 + 0.0112]], { seg: o.phone ? 8 : 14 }), FIN.knurl, undefined, loader);
  kit.add(new THREE.CircleGeometry(0.016, o.phone ? 12 : 24), FIN.grip, { p: [0, 0, CYL_Z0 + 0.0115] }, loader);
  const lr = kit.part("loaderRounds", [0, 0, 0], loader);
  for (let c = 0; c < 6; c++) {
    const a = Math.PI / 2 + (c * Math.PI) / 3;
    round(kit, lr, [Math.cos(a) * CH_R, Math.sin(a) * CH_R, CYL_Z0 + 0.0013], 0.0046, 0.036, o.phone);
  }
  pinchHand(kit, loader, "loadHand", [0, 0, CYL_Z0 + 0.02], [-0.85, -0.45, 0.3]);
  loader.visible = false;

  // ---- Empties.
  kit.empty("muzzle", [0, BORE, bz1 - 0.004]);
  kit.empty("port", [0.012, BORE, CYL_Z1 - 0.001]);
  pistolGripHands(kit, root, FS, -0.0195, true);
  kit.finish();
  // Rest poses the clips add onto.
  for (const n of ["crane", "cylinder", "ejector", "hammer", "trigger"]) {
    const p = kit.parts[n];
    if (p && !p.userData.rest) p.userData.rest = { pos: p.position.toArray(), rot: [p.rotation.x, p.rotation.y, p.rotation.z] };
  }
  return { root, kit };
}
