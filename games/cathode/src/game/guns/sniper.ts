// The Widowmaker (C18, S2.6): a bolt-action .338 on a polymer chassis. A round Cerakote receiver, a long tapered
// barrel with a side-port brake, a 30 mm scope with a coated objective (what the enemy sees glint), a bolt that
// lifts 60° and runs 90 mm under her right hand, a five-round box mag and a folded bipod. Gun space: -Z the
// muzzle, +Y up, the bore on y = 0.03.

import * as THREE from "three";
import { FIN, GLOW, GunKit, lathe, profile, rounded, sphere, type P2 } from "../gunkit";
import { crown, faction, foreGripL, magHand, optsOf, pinchHand, rifleGripR, round, trim } from "./common";

const BORE = 0.03;
const SCOPE_Y = 0.084;
/** The scope's eyepiece: aimed, on the camera axis. */
export const SNIPER_SIGHT: readonly [number, number, number] = [0, SCOPE_Y, 0.12];

export function buildSniper(phone = false, lod = false): { root: THREE.Group; kit: GunKit } {
  const root = new THREE.Group();
  root.name = "widowmaker";
  const kit = new GunKit(root, phone || lod);
  const o = optsOf(phone, lod);
  const body = kit.part("stock");
  for (const n of ["receiver", "barrel", "brake", "scope"]) kit.empty(n, [0, BORE, 0], body);

  // ---- Receiver: a round action with its ejection port on the right, a rail for the scope.
  kit.add(lathe([[0.0165, 0.075], [0.018, 0.07], [0.018, -0.13], [0.0165, -0.134]], { phone: o.phone, seg: o.phone ? 16 : 24 }), FIN.receiver, { p: [0, BORE, 0] }, body);
  kit.add(rounded(0.016, 0.006, 0.2, 0.0015, o.phone), FIN.receiver, { p: [0, BORE + 0.02, -0.03] }, body);
  // The port: a dark window on the right.
  kit.add(rounded(0.002, 0.012, 0.05, 0.001, o.phone), FIN.bore, { p: [0.0175, BORE + 0.004, -0.0] }, body);
  faction(kit, body, -0.0181, BORE - 0.002, -0.07, 0.07);
  // ---- Barrel: tapering, then the brake with two big side ports.
  kit.add(lathe([[0.0128, -0.134], [0.0112, -0.3], [0.0094, -0.66]], { phone: o.phone }), FIN.receiver, { p: [0, BORE, 0] }, body);
  kit.add(lathe([[0.0145, -0.66], [0.0145, -0.735], [0.0132, -0.74]], { phone: o.phone, seg: o.phone ? 16 : 24 }), FIN.receiver, { p: [0, BORE, 0] }, body);
  if (!o.lod) for (const x of [-1, 1]) for (const z of [-0.678, -0.7, -0.722]) kit.add(rounded(0.004, 0.016, 0.012, 0.0015, o.phone), FIN.bore, { p: [x * 0.0128, BORE, z] }, body);
  crown(kit, body, BORE, -0.7412, 0.0132, 0.0048, o.phone);

  // ---- The chassis: forend under the barrel, a vertical grip, a skeleton butt with a cheek riser and pad.
  const chassis: P2[] = [
    [-0.4, 0.024],
    [-0.4, 0.002],
    [-0.39, -0.012],
    [-0.08, -0.016],
    [-0.06, -0.034],
    [-0.004, -0.044],
    [0.018, -0.03],
    [0.03, -0.112],
    [0.064, -0.116],
    [0.06, -0.034],
    [0.09, -0.02],
    [0.18, -0.03],
    [0.33, -0.05],
    [0.336, -0.056],
    [0.336, 0.058],
    [0.316, 0.066],
    [0.2, 0.066],
    [0.18, 0.04],
    [0.08, 0.026],
    [0.07, 0.016],
    [-0.13, 0.014],
    [-0.14, 0.024],
  ];
  const guard: P2[] = [[-0.052, -0.02], [-0.048, -0.036], [-0.008, -0.038], [0.012, -0.026], [0.01, -0.016]];
  const butt: P2[] = [[0.2, -0.026], [0.31, -0.042], [0.31, 0.036], [0.21, 0.036]];
  kit.add(profile(chassis, 0.042, { bevel: 0.0026, holes: o.lod ? [guard] : [guard, butt], ...o }), FIN.stock, undefined, body);
  kit.add(profile([[0.034, -0.038], [0.038, -0.106], [0.06, -0.109], [0.058, -0.038]], 0.0435, { bevel: 0.001, ...o }), FIN.grip, undefined, body);
  kit.add(rounded(0.03, 0.022, 0.12, 0.006, o.phone), FIN.webbing, { p: [0, 0.074, 0.25] }, body);
  kit.add(rounded(0.044, 0.124, 0.014, 0.005, o.phone), FIN.rubber, { p: [0, 0.004, 0.342] }, body);
  trim(kit, body, -0.0212, -0.004, -0.13, 0.25, o.phone);

  // ---- The scope: rings, the 30 mm tube, turrets, the bells, glass, the coated objective.
  const sy = SCOPE_Y;
  kit.add(lathe([[0.0185, 0.15], [0.0195, 0.14], [0.0195, 0.1], [0.0128, 0.078], [0.0128, -0.17], [0.024, -0.2], [0.026, -0.262], [0.0245, -0.266]], { phone: o.phone, seg: o.phone ? 20 : 28 }), FIN.housing, { p: [0, sy, 0] }, body);
  kit.add(lathe([[0.0085, 0.009], [0.0085, -0.009]], { seg: o.phone ? 10 : 18 }), FIN.knurl, { p: [0, sy + 0.022, -0.04], r: [-Math.PI / 2, 0, 0] }, body);
  kit.add(lathe([[0.0085, 0.008], [0.0085, -0.008]], { seg: o.phone ? 10 : 18 }), FIN.knurl, { p: [0.022, sy, -0.04], r: [0, Math.PI / 2, 0] }, body);
  for (const z of [0.03, -0.11]) {
    kit.add(lathe([[0.0158, 0.008], [0.0158, -0.008]], { seg: o.phone ? 16 : 20 }), FIN.receiver, { p: [0, sy, z] }, body);
    kit.add(rounded(0.018, sy - BORE - 0.02, 0.016, 0.002, o.phone), FIN.receiver, { p: [0, (sy + BORE + 0.02) / 2 - 0.006, z] }, body);
  }
  kit.add(new THREE.CircleGeometry(0.0235, o.phone ? 14 : 28), GLOW.lens, { p: [0, sy, -0.263], r: [0, Math.PI, 0] }, body);
  kit.add(new THREE.CircleGeometry(0.0235, o.phone ? 14 : 28), "glass", { p: [0, sy, -0.2655], r: [0, Math.PI, 0] }, body);
  kit.add(new THREE.CircleGeometry(0.017, o.phone ? 14 : 24), FIN.bore, { p: [0, sy, 0.148] }, body);
  kit.empty("sight", [...SNIPER_SIGHT], body);

  // ---- The bolt: its body runs in the receiver, the handle out to the right with a bronze knob.
  const bolt = kit.part("bolt", [0, BORE, 0]);
  kit.add(lathe([[0.0088, 0.1], [0.0098, 0.09], [0.0098, 0.06], [0.0088, -0.02]], { phone: o.phone }), FIN.pins, undefined, bolt);
  kit.add(lathe([[0.0026, 0.0], [0.0026, -0.042]], { seg: 10 }).rotateY(-Math.PI / 2).rotateZ(-0.36), FIN.receiver, { p: [0.004, 0, 0.07] }, bolt);
  kit.add(sphere(0.0085, o.phone), FIN.bronze, { p: [0.043, -0.016, 0.07] }, bolt);
  pinchHand(kit, bolt, "boltHand", [0.043, -0.016, 0.07], [0.6, -0.3, 0.75]);

  // ---- Mag: a five-round box under the action.
  const mag = kit.part("mag");
  kit.add(profile([[-0.012, 0.0], [-0.098, 0.0], [-0.096, -0.07], [-0.014, -0.07]], 0.028, { bevel: 0.0014, ...o }), FIN.magBody, undefined, mag);
  kit.add(rounded(0.032, 0.008, 0.09, 0.002, o.phone), FIN.grip, { p: [0, -0.072, -0.055] }, mag);
  const top = kit.part("magRound", [0, 0, 0], mag);
  round(kit, top, [0, 0.006, -0.012], 0.0058, 0.085, o.phone);
  magHand(kit, mag, [0, -0.06, -0.055]);
  kit.empty("magwell", [0, 0, -0.055], body);

  // ---- The bipod, folded along the forend.
  const bipod = kit.part("bipod", [0, -0.014, -0.36]);
  for (const x of [-0.009, 0.009]) kit.add(lathe([[0.0042, 0.0], [0.0042, 0.16], [0.006, 0.165], [0.006, 0.175]], { seg: 10 }), FIN.receiver, { p: [x, -0.004, 0], r: [0, Math.PI, 0] }, bipod);
  kit.add(rounded(0.03, 0.012, 0.024, 0.004, o.phone), FIN.receiver, { p: [0, 0, 0] }, bipod);

  // ---- Trigger.
  const trigger = o.phone ? kit.empty("trigger", [0, -0.018, -0.02], body) : kit.part("trigger", [0, -0.018, -0.02]);
  if (!o.phone) kit.add(profile([[0.002, 0], [-0.003, 0], [-0.005, -0.013], [-0.002, -0.017], [-0.001, -0.011], [0.0025, -0.004]], 0.0058, { bevel: 0.0006, ...o }), FIN.control, undefined, trigger);

  kit.empty("muzzle", [0, BORE, -0.744]);
  kit.empty("port", [0.02, BORE + 0.004, 0.0]);
  rifleGripR(kit, root, [0, -0.07, 0.048]);
  foreGripL(kit, root, [0, 0.004, -0.24], 0.021);
  kit.finish();
  for (const n of ["bolt", "mag", "trigger", "bipod"]) {
    const p = kit.parts[n];
    if (p) p.userData.rest = { pos: p.position.toArray(), rot: [p.rotation.x, p.rotation.y, p.rotation.z] };
  }
  return { root, kit };
}
