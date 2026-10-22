// The Rattlecan (C18, S2.6): Hollowell's compact 9 mm SMG. A charcoal Cerakote upper with its ejection port on the
// right (the bronze bolt cycles 16 mm in it at the fire rate), a polymer lower with a raked grip, a slotted
// handguard with a vertical foregrip, a stick mag, a three-prong flash hider, a skeleton stock folded out, and a
// slap-forward charging handle on the left. Gun space: -Z the muzzle, +Y up, the bore on y = 0.03.

import * as THREE from "three";
import { FIN, GLOW, GunKit, facade, lathe, profile, rounded, sphere, type P2 } from "../gunkit";
import { crown, faction, foreGrip, magHand, optsOf, pinchHand, rail, rifleGripR, trim } from "./common";

const BORE = 0.03;
/** The rear aperture's centre: aimed, this sits on the camera axis. */
export const SMG_SIGHT: readonly [number, number, number] = [0, 0.0655, 0.052];

export function buildSmg(phone = false, lod = false): { root: THREE.Group; kit: GunKit } {
  const root = new THREE.Group();
  root.name = "rattlecan";
  const kit = new GunKit(root, phone || lod);
  const o = optsOf(phone, lod);

  // ---- Upper (Cerakote): a flat-topped receiver, the ejection port cut through on the right.
  // Everything that doesn't move is one merged body (one draw); its named pieces are empties.
  const body = kit.part("receiver");
  kit.empty("upper", [0, 0, 0], body);
  const upper = body;
  const upperOut: P2[] = [[0.088, 0.014], [0.088, 0.048], [0.084, 0.052], [-0.118, 0.052], [-0.122, 0.048], [-0.122, 0.014]];
  const portHole: P2[] = [[0.012, 0.024], [-0.032, 0.024], [-0.032, 0.041], [0.012, 0.041]];
  kit.add(profile(upperOut, 0.034, { bevel: 0.0012, holes: o.lod ? [] : [portHole], ...o }), FIN.receiver, undefined, upper);
  rail(kit, upper, 0.052, 0.08, 0.19, 0.022, o);
  // Forward assist and shell deflector bumps on the right, the brass deflector catching light.
  kit.add(rounded(0.004, 0.012, 0.016, 0.0018, o.phone), FIN.receiver, { p: [0.0185, 0.043, 0.022] }, upper);
  faction(kit, upper, -0.0171, 0.032, -0.06, 0.07);
  trim(kit, upper, -0.0172, 0.0168, 0.06, 0.17, o.phone);

  // ---- Lower (polymer): the magwell, the guard and the raked, stippled grip.
  kit.empty("lower", [0, 0, 0], body);
  const lower = body;
  const lowerOut: P2[] = [
    [0.084, 0.014],
    [-0.074, 0.014],
    [-0.074, -0.016],
    [-0.066, -0.026],
    [-0.034, -0.026],
    [-0.03, -0.018],
    // The guard.
    [-0.026, -0.044],
    [0.014, -0.046],
    [0.026, -0.03],
    // The grip, raked 18°.
    [0.034, -0.11],
    [0.068, -0.114],
    [0.064, -0.03],
    [0.084, -0.012],
  ];
  const guard: P2[] = [[-0.022, -0.02], [-0.02, -0.04], [0.01, -0.041], [0.021, -0.028], [0.02, -0.02]];
  kit.add(profile(lowerOut, 0.032, { bevel: 0.0014, holes: [guard], ...o }), FIN.frame, undefined, lower);
  kit.add(profile([[0.036, -0.036], [0.042, -0.104], [0.064, -0.107], [0.062, -0.036]], 0.0335, { bevel: 0.001, ...o }), FIN.grip, undefined, lower);
  kit.empty("magwell", [0, -0.026, -0.05], lower);

  // ---- Handguard: slotted, octagonal-ish, the barrel and a three-prong hider ahead of it.
  kit.empty("handguard", [0, 0, 0], body);
  const hg = body;
  const slots: P2[][] = o.lod ? [] : [0, 1, 2, 3].map((i) => {
    const z = -0.135 - i * 0.024;
    return [[z, 0.024], [z - 0.014, 0.024], [z - 0.014, 0.034], [z, 0.034]] as P2[];
  });
  kit.add(profile([[-0.122, 0.01], [-0.122, 0.05], [-0.236, 0.05], [-0.24, 0.046], [-0.24, 0.014], [-0.236, 0.01]], 0.036, { bevel: 0.0016, holes: slots, ...o }), FIN.frame, undefined, hg);
  rail(kit, hg, 0.05, -0.128, 0.1, 0.02, o);
  kit.empty("barrel", [0, 0, 0], body);
  const barrel = body;
  kit.add(lathe([[0.0075, -0.24], [0.0075, -0.25], [0.0095, -0.252], [0.0095, -0.286], [0.0082, -0.29]], { phone: o.phone }), FIN.receiver, { p: [0, BORE, 0] }, barrel);
  // The hider's three prongs: dark slots cut by three thin blades of bore black.
  if (!o.lod) for (let i = 0; i < 3; i++) kit.add(rounded(0.0022, 0.009, 0.026, 0.0006, o.phone), FIN.bore, { p: [Math.cos((i * 2 * Math.PI) / 3) * 0.0062, BORE + Math.sin((i * 2 * Math.PI) / 3) * 0.0062, -0.276], r: [0, 0, (i * 2 * Math.PI) / 3] }, barrel);
  crown(kit, barrel, BORE, -0.2912, 0.0082, 0.0045, o.phone);
  // The front sight: a hooded post at the handguard's nose.
  kit.add(facade([[-0.009, 0], [0.009, 0], [0.009, 0.006], [0.006, 0.016], [0.004, 0.016], [0.004, 0.004], [-0.004, 0.004], [-0.004, 0.016], [-0.006, 0.016], [-0.009, 0.006]], 0.008, { ...o }), FIN.receiver, { p: [0, 0.054, -0.222] }, hg);
  kit.add(rounded(0.0018, 0.0095, 0.0022, 0.0006, o.phone), FIN.receiver, { p: [0, 0.0605, -0.222] }, hg);
  kit.add(sphere(0.0011, o.phone), GLOW.tritium, { p: [0, 0.0655, -0.2208], s: [1, 1, 0.4] }, hg);
  kit.empty("sightF", [0, 0.0655, -0.222], hg);

  // ---- The rear aperture: a ring on a block on the rail.
  const ring: P2[] = [];
  const hole: P2[] = [];
  for (let i = 0; i < (o.phone ? 12 : 20); i++) {
    const a = (i / (o.phone ? 12 : 20)) * Math.PI * 2;
    ring.push([Math.cos(a) * 0.0068, 0.0655 - 0.054 + Math.sin(a) * 0.0068]);
    hole.unshift([Math.cos(a) * 0.0032, 0.0655 - 0.054 + Math.sin(a) * 0.0032]);
  }
  kit.add(facade(ring, 0.006, { holes: [hole], ...o }), FIN.receiver, { p: [0, 0.054, SMG_SIGHT[2]] }, upper);
  kit.add(rounded(0.016, 0.008, 0.016, 0.002, o.phone), FIN.receiver, { p: [0, 0.058, SMG_SIGHT[2] + 0.002] }, upper);
  kit.empty("sightR", [...SMG_SIGHT], upper);
  kit.empty("sight", [...SMG_SIGHT], upper);

  // ---- The bolt in the port (bronze), cycling 16 mm.
  const bolt = kit.part("bolt");
  kit.add(rounded(0.024, 0.015, 0.06, 0.003, o.phone), FIN.bronze, { p: [0, 0.0325, -0.008] }, bolt);
  kit.add(rounded(0.002, 0.004, 0.012, 0.0008, o.phone), FIN.pins, { p: [0.0122, 0.036, -0.026] }, bolt);

  // ---- The charging handle: a lever in a slot on the left of the upper, forward of the port.
  const charge = kit.part("charge", [-0.0178, 0.044, -0.088]);
  kit.add(rounded(0.004, 0.006, 0.03, 0.0015, o.phone), FIN.receiver, { p: [0, 0, 0] }, charge);
  kit.add(rounded(0.016, 0.009, 0.007, 0.003, o.phone), FIN.control, { p: [-0.009, 0.001, -0.004] }, charge);
  pinchHand(kit, charge, "chargeHand", [-0.012, 0.002, 0], [-0.8, 0.5, -0.2]);

  // ---- The stock: a skeleton strut out to a rubber pad.
  kit.empty("stock", [0, 0, 0], body);
  const stock = body;
  const strut: P2[] = [[0.084, 0.044], [0.27, 0.042], [0.276, 0.034], [0.276, -0.04], [0.262, -0.044], [0.248, -0.03], [0.12, 0.004], [0.084, 0.012]];
  const strutHole: P2[] = [[0.11, 0.032], [0.24, 0.032], [0.248, 0.02], [0.248, -0.02], [0.14, 0.012]];
  kit.add(profile(strut, 0.014, { bevel: 0.0012, holes: [strutHole], ...o }), FIN.frame, undefined, stock);
  kit.add(rounded(0.03, 0.09, 0.012, 0.004, o.phone), FIN.rubber, { p: [0, 0.0, 0.282] }, stock);

  // ---- The foregrip: a vertical grip under the handguard.
  kit.empty("foregrip", [0, 0, 0], body);
  const fg = body;
  kit.add(lathe([[0.0125, -0.0], [0.0135, -0.004], [0.0135, -0.06], [0.0118, -0.066], [0, -0.067]], { phone: o.phone }), FIN.grip, { p: [0, 0.01, -0.165], r: [Math.PI / 2, 0, 0] }, fg);
  const gl = foreGrip(kit, fg, [0, -0.025, -0.165]);
  void gl;

  // ---- The stick mag: a slight forward curve, ribbed, the top round in its lips.
  const mag = kit.part("mag");
  const magOut: P2[] = [[-0.032, -0.006], [-0.072, -0.006], [-0.078, -0.13], [-0.074, -0.15], [-0.03, -0.15], [-0.028, -0.13]];
  kit.add(profile(magOut, 0.024, { bevel: 0.0012, ...o }), FIN.magBody, undefined, mag);
  kit.add(rounded(0.028, 0.012, 0.05, 0.003, o.phone), FIN.grip, { p: [0, -0.153, -0.053] }, mag);
  const top = kit.part("magRound", [0, 0, 0], mag);
  kit.add(lathe([[0.0048, 0.0], [0.0048, -0.019], [0.0045, -0.021], [0.0042, -0.025], [0.0024, -0.0295], [0, -0.03]], { seg: o.phone ? 8 : 12 }), FIN.brass, { p: [0, -0.002, -0.036] }, top);
  magHand(kit, mag, [0, -0.13, -0.052]);

  // ---- The trigger.
  const trigger = o.phone ? kit.empty("trigger", [0, -0.02, -0.002], lower) : kit.part("trigger", [0, -0.02, -0.002]);
  if (!o.phone) kit.add(profile([[0.002, 0], [-0.003, 0], [-0.006, -0.012], [-0.005, -0.019], [-0.002, -0.019], [-0.001, -0.011], [0.0025, -0.004]], 0.0058, { bevel: 0.0006, ...o }), FIN.control, undefined, trigger);

  kit.empty("muzzle", [0, BORE, -0.294]);
  kit.empty("port", [0.018, 0.033, -0.01]);
  rifleGripR(kit, root, [0, -0.07, 0.05]);
  kit.finish();
  for (const n of ["bolt", "charge", "mag", "trigger"]) {
    const p = kit.parts[n];
    if (p) p.userData.rest = { pos: p.position.toArray(), rot: [p.rotation.x, p.rotation.y, p.rotation.z] };
  }
  return { root, kit };
}
