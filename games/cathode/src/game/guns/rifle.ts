// The Corridor AR (C18, S2.6): a Hollowell 5.56 carbine. A Cerakote upper with a flat-top rail and a prism optic
// (an amber chevron behind real glass), a vented free-float handguard, a three-prong compensator, a polymer lower
// with a raked grip, a curved mag, the dust cover sprung open, the carrier cycling 30 mm in the port, and the
// T-handle that charges it on an empty mag. Gun space: -Z the muzzle, +Y up, the bore on y = 0.03.

import * as THREE from "three";
import { FIN, GLOW, GunKit, arc, facade, lathe, profile, rounded, type P2 } from "../gunkit";
import { crown, faction, foreGripL, magHand, optsOf, pinchHand, rail, rifleGripR, trim } from "./common";

const BORE = 0.03;
/** The optic's chevron: aimed, this point sits on the camera axis. */
export const RIFLE_SIGHT: readonly [number, number, number] = [0, 0.0835, 0.004];

export function buildRifle(phone = false, lod = false): { root: THREE.Group; kit: GunKit } {
  const root = new THREE.Group();
  root.name = "corridorAR";
  const kit = new GunKit(root, phone || lod);
  const o = optsOf(phone, lod);
  const body = kit.part("receiver");
  for (const n of ["upper", "lower", "handguard", "barrel", "comp", "stock", "optic", "dustCover"]) kit.empty(n, [0, 0, 0], body);

  // ---- Upper: the flat top, the port on the right (the dust cover hangs open under it), the forward assist.
  const upperOut: P2[] = [[0.09, 0.014], [0.09, 0.048], [0.086, 0.052], [-0.098, 0.052], [-0.102, 0.046], [-0.102, 0.014]];
  const portHole: P2[] = [[0.016, 0.022], [-0.034, 0.022], [-0.034, 0.04], [0.016, 0.04]];
  kit.add(profile(upperOut, 0.033, { bevel: 0.0012, holes: o.lod ? [] : [portHole], ...o }), FIN.receiver, undefined, body);
  rail(kit, body, 0.052, 0.086, 0.18, 0.022, o);
  kit.add(lathe([[0.0055, 0.0], [0.0055, -0.016], [0.004, -0.018]], { phone: o.phone }), FIN.receiver, { p: [0.019, 0.042, 0.04], r: [0, -0.35, 0] }, body);
  // The dust cover, sprung open on its hinge below the port.
  kit.add(rounded(0.0016, 0.016, 0.05, 0.0006, o.phone), FIN.receiver, { p: [0.0225, 0.014, -0.009], r: [0, 0, -0.9] }, body);
  faction(kit, body, -0.0166, 0.033, -0.04, 0.075);
  // ---- Lower: the magwell's flare, the guard, the raked grip.
  const lowerOut: P2[] = [
    [0.086, 0.014],
    [-0.1, 0.014],
    [-0.1, -0.012],
    [-0.094, -0.028],
    [-0.044, -0.028],
    [-0.04, -0.016],
    [-0.034, -0.044],
    [0.012, -0.046],
    [0.024, -0.03],
    [0.03, -0.112],
    [0.066, -0.116],
    [0.064, -0.03],
    [0.086, -0.012],
  ];
  const guard: P2[] = [[-0.03, -0.018], [-0.028, -0.04], [0.008, -0.041], [0.019, -0.027], [0.018, -0.018]];
  kit.add(profile(lowerOut, 0.031, { bevel: 0.0014, holes: [guard], ...o }), FIN.frame, undefined, body);
  kit.add(profile([[0.033, -0.036], [0.038, -0.106], [0.062, -0.109], [0.061, -0.036]], 0.0325, { bevel: 0.001, ...o }), FIN.grip, undefined, body);
  trim(kit, body, -0.0157, -0.0085, 0.07, 0.16, o.phone);
  kit.empty("magwell", [0, -0.028, -0.068], body);

  // ---- Handguard: a long free-float tube, vented, a rail strip on top.
  const vents: P2[][] = o.lod ? [] : Array.from({ length: 6 }, (_, i) => {
    const z = -0.122 - i * 0.036;
    return [[z, 0.02], [z - 0.024, 0.02], [z - 0.024, 0.038], [z, 0.038]] as P2[];
  });
  kit.add(profile([[-0.1, 0.01], [-0.1, 0.05], [-0.346, 0.05], [-0.352, 0.044], [-0.352, 0.016], [-0.346, 0.01]], 0.038, { bevel: 0.002, holes: vents, ...o }), FIN.receiver, undefined, body);
  rail(kit, body, 0.05, -0.104, 0.24, 0.02, o);
  // The barrel and the compensator: three prongs at the muzzle.
  // C18 review: a rifle-length barrel (the gun read as a short PDW), a gas block and the comp past the handguard.
  const BX = -0.07;
  kit.add(lathe([[0.0085, -0.352], [0.0085, -0.4 + BX]], { phone: o.phone }), FIN.receiver, { p: [0, BORE, 0] }, body);
  kit.add(rounded(0.022, 0.024, 0.018, 0.003, o.phone), FIN.receiver, { p: [0, BORE + 0.002, -0.37] }, body);
  kit.add(lathe([[0.0108, -0.4 + BX], [0.0108, -0.448 + BX], [0.0098, -0.452 + BX]], { phone: o.phone }), FIN.receiver, { p: [0, BORE, 0] }, body);
  if (!o.lod) for (let i = 0; i < 3; i++) kit.add(rounded(0.0026, 0.012, 0.03, 0.0006, o.phone), FIN.bore, { p: [Math.cos(Math.PI / 2 + (i * 2 * Math.PI) / 3) * 0.0086, BORE + Math.sin(Math.PI / 2 + (i * 2 * Math.PI) / 3) * 0.0086, -0.434 + BX], r: [0, 0, (i * 2 * Math.PI) / 3] }, body);
  crown(kit, body, BORE, -0.4532 + BX, 0.0098, 0.0042, o.phone);

  // ---- The optic: a prism housing on the rail, glass front and back, an amber chevron at the sight line.
  const oz = RIFLE_SIGHT[2];
  const housing: P2[] = [[-0.017, 0], [0.017, 0], [0.017, 0.03], [0.012, 0.042], [-0.012, 0.042], [-0.017, 0.03]];
  const window: P2[] = [[-0.0125, 0.012], [0.0125, 0.012], [0.0125, 0.028], [0.009, 0.036], [-0.009, 0.036], [-0.0125, 0.028]];
  kit.add(facade(housing, 0.05, { holes: [window], bevel: 0.0012, ...o }), FIN.housing, { p: [0, 0.058, oz - 0.012] }, body);
  kit.add(rounded(0.03, 0.01, 0.05, 0.002, o.phone), FIN.housing, { p: [0, 0.061, oz - 0.012] }, body);
  // Turrets on the top and the right.
  kit.add(lathe([[0.0075, 0.004], [0.0075, -0.004]], { seg: o.phone ? 10 : 16 }), FIN.knurl, { p: [0, 0.101, oz - 0.012], r: [-Math.PI / 2, 0, 0] }, body);
  kit.add(lathe([[0.0075, 0.004], [0.0075, -0.004]], { seg: o.phone ? 10 : 16 }), FIN.knurl, { p: [0.021, 0.081, oz - 0.012], r: [0, Math.PI / 2, 0] }, body);
  kit.add(new THREE.PlaneGeometry(0.025, 0.024), "glass", { p: [0, 0.082, oz - 0.036] }, body);
  // The chevron, a few arc-minutes, floating on the sight line just inside the rear glass.
  const chev: P2[] = [[-0.0022, -0.0012], [0, 0.0006], [0.0022, -0.0012], [0.0022, -0.0004], [0, 0.0014], [-0.0022, -0.0004]];
  kit.add(facade(chev, 0.0003, { ...o }), GLOW.chevron, { p: [0, RIFLE_SIGHT[1] - 0.0004, oz] }, body);
  kit.empty("sight", [...RIFLE_SIGHT], body);

  // ---- The stock: a buffer tube and an adjustable polymer stock with a cheek weld and a rubber pad.
  kit.add(lathe([[0.0145, 0.09], [0.0145, 0.25]], { phone: o.phone }), FIN.receiver, { p: [0, 0.03, 0] }, body);
  const stockOut: P2[] = [[0.17, 0.05], [0.29, 0.05], [0.296, 0.044], [0.296, -0.05], [0.282, -0.056], [0.25, -0.034], [0.19, 0.008], [0.17, 0.012]];
  kit.add(profile(stockOut, 0.036, { bevel: 0.002, holes: o.lod ? [] : [[[0.215, 0.002], [0.262, -0.03], [0.27, -0.03], [0.27, 0.0], [0.24, 0.002]]], ...o }), FIN.frame, undefined, body);
  kit.add(rounded(0.034, 0.104, 0.012, 0.004, o.phone), FIN.rubber, { p: [0, -0.003, 0.302] }, body);

  // ---- The carrier in the port: bronze, cycling 30 mm.
  const bolt = kit.part("bolt");
  kit.add(rounded(0.022, 0.016, 0.074, 0.003, o.phone), FIN.bronze, { p: [0, 0.031, -0.004] }, bolt);
  kit.add(lathe([[0.0042, -0.04], [0.0042, -0.048], [0.003, -0.05]], { seg: 10 }), FIN.pins, { p: [0, 0.03, 0] }, bolt);
  // ---- The T-handle at the back of the upper.
  const charge = kit.part("charge", [0, 0.045, 0.092]);
  kit.add(rounded(0.008, 0.006, 0.05, 0.002, o.phone), FIN.receiver, { p: [0, 0, -0.02] }, charge);
  kit.add(rounded(0.04, 0.007, 0.01, 0.003, o.phone), FIN.receiver, { p: [0, 0, 0.004] }, charge);
  pinchHand(kit, charge, "chargeHand", [-0.016, 0.002, 0.004], [-0.6, 0.7, 0.4]);

  // ---- The curved mag.
  const mag = kit.part("mag");
  const curve = (t: number): P2 => [-0.068 - 0.03 * t * t, -0.006 - 0.17 * t];
  const front: P2[] = [];
  const back: P2[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const c = curve(t);
    front.push([c[0] - 0.026, c[1]]);
    back.unshift([c[0] + 0.026, c[1]]);
  }
  kit.add(profile([...front, ...back], 0.022, { bevel: 0.0012, ...o }), FIN.magBody, undefined, mag);
  const c1 = curve(1);
  kit.add(rounded(0.026, 0.01, 0.06, 0.003, o.phone), FIN.grip, { p: [0, c1[1] - 0.004, c1[0]], r: [-0.3, 0, 0] }, mag);
  const top = kit.part("magRound", [0, 0, 0], mag);
  kit.add(lathe([[0.0048, 0.0], [0.0048, -0.024], [0.0034, -0.03], [0.0024, -0.04], [0, -0.046]], { seg: o.phone ? 8 : 12 }), FIN.brass, { p: [0, -0.002, -0.05] }, top);
  magHand(kit, mag, [0, -0.15, -0.088]);

  // ---- The trigger.
  const trigger = o.phone ? kit.empty("trigger", [0, -0.02, -0.01], body) : kit.part("trigger", [0, -0.02, -0.01]);
  if (!o.phone) kit.add(profile([[0.002, 0], [-0.003, 0], [-0.006, -0.012], [-0.005, -0.019], [-0.002, -0.019], [-0.001, -0.011], [0.0025, -0.004]], 0.0058, { bevel: 0.0006, ...o }), FIN.control, undefined, trigger);

  kit.empty("muzzle", [0, BORE, -0.526]);
  kit.empty("port", [0.018, 0.031, -0.01]);
  rifleGripR(kit, root, [0, -0.07, 0.048]);
  foreGripL(kit, root, [0, 0.03, -0.25], 0.019);
  void arc;
  kit.finish();
  for (const n of ["bolt", "charge", "mag", "trigger"]) {
    const p = kit.parts[n];
    if (p) p.userData.rest = { pos: p.position.toArray(), rot: [p.rotation.x, p.rotation.y, p.rotation.z] };
  }
  return { root, kit };
}
