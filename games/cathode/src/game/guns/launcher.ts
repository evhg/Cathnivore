// The Bargain Bin (C18, S2.6): a break-open 40 mm launcher. An olive tube that hinges down off a Cerakote breech
// block, a ladder sight, a forend for the support hand, a rear venturi that throws the back-blast, a pistol grip
// and a padded stock. The spent case kicks out of the opened breech and the next finned round is seen going in.
// Gun space: -Z the muzzle, +Y up, the bore on y = 0.03.

import * as THREE from "three";
import { FIN, GLOW, GunKit, facade, lathe, profile, rounded, type P2 } from "../gunkit";
import { faction, foreGripL, optsOf, pinchHand, rifleGripR, trim } from "./common";

const BORE = 0.03;
const TUBE_R = 0.026;
const HINGE: [number, number, number] = [0, BORE - TUBE_R - 0.006, -0.062];
/** The rear peep: aimed, on the camera axis. */
export const LAUNCHER_SIGHT: readonly [number, number, number] = [0, 0.078, 0.034];

/** The 40 mm round along -Z from its case head at p: brass head, aluminium body, olive ogive with a hazard band, fins. */
function grenade(kit: GunKit, part: THREE.Object3D, p: [number, number, number], phone: boolean, caseOnly = false): void {
  const seg = phone ? 12 : 20;
  kit.add(lathe([[0.0215, 0], [0.0215, -0.004], [0.0198, -0.006], [0.0198, -0.05]], { seg }), FIN.brass, { p }, part);
  kit.add(new THREE.CircleGeometry(0.0215, seg), FIN.brass, { p }, part);
  if (!phone) kit.add(new THREE.CircleGeometry(0.006, 10), FIN.pins, { p: [p[0], p[1], p[2] + 0.0004] }, part);
  if (caseOnly) return;
  kit.add(lathe([[0.0196, -0.05], [0.0196, -0.058]], { seg }), FIN.hazard, { p }, part);
  kit.add(lathe([[0.0196, -0.058], [0.0192, -0.07], [0.016, -0.088], [0.009, -0.1], [0, -0.104]], { seg }), FIN.olive, { p }, part);
  // Four stub fins at the waist.
  if (!phone) for (let i = 0; i < 4; i++) kit.add(rounded(0.0016, 0.007, 0.016, 0.0005), FIN.pins, { p: [p[0] + Math.cos((i * Math.PI) / 2) * 0.021, p[1] + Math.sin((i * Math.PI) / 2) * 0.021, p[2] - 0.042], r: [0, 0, (i * Math.PI) / 2] }, part);
}

export function buildLauncher(phone = false, lod = false): { root: THREE.Group; kit: GunKit } {
  const root = new THREE.Group();
  root.name = "bargainBin";
  const kit = new GunKit(root, phone || lod);
  const o = optsOf(phone, lod);
  const body = kit.part("receiver");
  for (const n of ["grip", "stock"]) kit.empty(n, [0, 0, 0], body);

  // ---- The breech block: a Cerakote box with the hinge lug forward, the venturi behind.
  const blockOut: P2[] = [[0.08, 0.0], [0.08, 0.058], [0.072, 0.064], [-0.056, 0.064], [-0.062, 0.058], [-0.062, 0.03], [-0.074, HINGE[1] - 0.004], [-0.064, HINGE[1] - 0.012], [-0.03, -0.012], [0.03, -0.012]];
  kit.add(profile(blockOut, 0.06, { bevel: 0.002, ...o }), FIN.receiver, undefined, body);
  faction(kit, body, -0.0301, 0.034, 0.008, 0.08);
  trim(kit, body, -0.0302, 0.004, 0.07, 0.13, o.phone);
  // The venturi: a flared dark nozzle over the stock.
  kit.add(lathe([[0.017, 0.08], [0.017, 0.1], [0.022, 0.12], [0.024, 0.124], [0.019, 0.124], [0.012, 0.1]], { phone: o.phone }), FIN.can, { p: [0, 0.046 - 0.0, 0] }, body);
  kit.add(new THREE.CircleGeometry(0.012, o.phone ? 10 : 18), FIN.bore, { p: [0, 0.046, 0.1] }, body);
  kit.empty("rear", [0, 0.046, 0.13], body);
  // The rear peep on the block's top.
  const ring: P2[] = [];
  const hole: P2[] = [];
  const n = o.phone ? 12 : 20;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    ring.push([Math.cos(a) * 0.0075, LAUNCHER_SIGHT[1] - 0.064 + Math.sin(a) * 0.0075]);
    hole.unshift([Math.cos(a) * 0.004, LAUNCHER_SIGHT[1] - 0.064 + Math.sin(a) * 0.004]);
  }
  kit.add(facade(ring, 0.005, { holes: [hole], ...o }), FIN.receiver, { p: [0, 0.064, LAUNCHER_SIGHT[2]] }, body);
  kit.add(rounded(0.012, 0.006, 0.01, 0.002, o.phone), FIN.receiver, { p: [0, 0.067, LAUNCHER_SIGHT[2]] }, body);
  kit.empty("sight", [...LAUNCHER_SIGHT], body);

  // ---- Grip, guard and stock.
  const lower: P2[] = [[0.03, -0.012], [0.028, -0.044], [0.04, -0.118], [0.074, -0.122], [0.07, -0.03], [0.08, -0.012]];
  kit.add(profile(lower, 0.032, { bevel: 0.0016, ...o }), FIN.frame, undefined, body);
  kit.add(profile([[0.034, -0.04], [0.044, -0.112], [0.07, -0.114], [0.066, -0.04]], 0.0335, { bevel: 0.001, ...o }), FIN.rubber, undefined, body);
  const guardOut: P2[] = [[0.03, -0.012], [-0.03, -0.012], [-0.034, -0.03], [-0.026, -0.046], [0.012, -0.048], [0.03, -0.034]];
  const guardIn: P2[] = [[0.024, -0.016], [-0.024, -0.016], [-0.027, -0.028], [-0.021, -0.041], [0.01, -0.042], [0.024, -0.032]];
  kit.add(profile(guardOut, 0.012, { holes: [guardIn], bevel: 0.0008, ...o }), FIN.receiver, undefined, body);
  const stockOut: P2[] = [[0.08, 0.02], [0.3, 0.03], [0.306, 0.022], [0.306, -0.07], [0.29, -0.078], [0.12, -0.03], [0.08, -0.012]];
  kit.add(profile(stockOut, 0.04, { bevel: 0.003, holes: o.lod ? [] : [[[0.13, -0.006], [0.27, 0.012], [0.27, -0.05], [0.18, -0.03]]], ...o }), FIN.frame, undefined, body);
  kit.add(rounded(0.042, 0.108, 0.014, 0.005, o.phone), FIN.rubber, { p: [0, -0.024, 0.312] }, body);

  // ---- The tube: olive, hinged under its breech end, a ladder sight and the forend riding it.
  const breech = kit.part("breech", HINGE);
  const hz = HINGE[2];
  const by = BORE - HINGE[1];
  kit.add(lathe([[TUBE_R, -0.062 - hz], [TUBE_R + 0.002, -0.07 - hz], [TUBE_R + 0.002, -0.1 - hz], [TUBE_R, -0.104 - hz], [TUBE_R, -0.34 - hz], [TUBE_R + 0.003, -0.344 - hz], [TUBE_R + 0.003, -0.37 - hz], [TUBE_R + 0.001, -0.374 - hz], [0.021, -0.374 - hz], [0.021, -0.36 - hz]], { phone: o.phone, seg: o.phone ? 14 : 28 }), FIN.olive, { p: [0, by, 0] }, breech);
  // The bore seen from the breech (when open) and the muzzle.
  kit.add(new THREE.RingGeometry(0.021, TUBE_R, o.phone ? 14 : 28), FIN.olive, { p: [0, by, -0.062 - hz] }, breech);
  kit.add(new THREE.CircleGeometry(0.021, o.phone ? 14 : 28), FIN.bore, { p: [0, by, -0.36 - hz], r: [0, Math.PI, 0] }, breech);
  // The hinge lug and the latch.
  kit.add(rounded(0.03, 0.014, 0.03, 0.004, o.phone), FIN.receiver, { p: [0, 0.004, -0.014] }, breech);
  // The ladder sight: two rails and a cross bar, folded up.
  for (const x of [-0.009, 0.009]) kit.add(rounded(0.0024, 0.03, 0.004, 0.0008, o.phone), FIN.receiver, { p: [x, by + TUBE_R + 0.015, -0.13 - hz] }, breech);
  kit.add(rounded(0.02, 0.0024, 0.004, 0.0008, o.phone), FIN.receiver, { p: [0, by + TUBE_R + 0.0195, -0.13 - hz] }, breech);
  kit.add(rounded(0.0016, 0.006, 0.002, 0.0005, o.phone), FIN.receiver, { p: [0, by + TUBE_R + 0.0225, -0.13 - hz] }, breech);
  kit.add(rounded(0.0018, 0.0018, 0.003, 0.0006, o.phone), GLOW.tritium, { p: [0, by + TUBE_R + 0.026, -0.1295 - hz] }, breech);
  // The forend: a ribbed polymer sleeve under the tube.
  kit.add(profile([[-0.12 - hz, -0.006 - TUBE_R + by], [-0.12 - hz, 0.004 + by - TUBE_R + 0.008], [-0.25 - hz, 0.004 + by - TUBE_R + 0.008], [-0.25 - hz, -0.006 - TUBE_R + by], [-0.244 - hz, -0.018 - TUBE_R + by], [-0.126 - hz, -0.018 - TUBE_R + by]], 0.046, { bevel: 0.003, ...o }), FIN.frame, undefined, breech);
  foreGripL(kit, breech, [0, by - TUBE_R - 0.008, -0.185 - hz], 0.022);
  kit.empty("tube", [0, by, -0.2 - hz], breech);

  // ---- The case in the chamber (the spent one kicks out) and the round in her hand.
  const cs = kit.part("case", [0, by, -0.062 - hz], breech);
  grenade(kit, cs, [0, 0, 0.0005], o.phone, true);
  const rd = kit.part("round", [0, BORE, -0.061]);
  grenade(kit, rd, [0, 0, 0], o.phone);
  pinchHand(kit, rd, "loadHand", [-0.012, -0.01, 0.01], [-0.6, -0.6, 0.5]);
  rd.visible = false;

  // ---- Trigger.
  const trigger = o.phone ? kit.empty("trigger", [0, -0.012, 0.0], body) : kit.part("trigger", [0, -0.012, 0.0]);
  if (!o.phone) kit.add(profile([[0.002, 0], [-0.003, 0], [-0.006, -0.012], [-0.005, -0.02], [-0.002, -0.02], [-0.001, -0.011], [0.0025, -0.004]], 0.0062, { bevel: 0.0006, ...o }), FIN.control, undefined, trigger);
  kit.empty("foregrip", [0, -0.01, -0.2], body);

  kit.empty("muzzle", [0, BORE, -0.375]);
  kit.empty("port", [0, BORE, -0.06]);
  rifleGripR(kit, root, [0, -0.074, 0.052]);
  kit.finish();
  for (const nn of ["breech", "case", "round", "trigger"]) {
    const p = kit.parts[nn];
    if (p) p.userData.rest = { pos: p.position.toArray(), rot: [p.rotation.x, p.rotation.y, p.rotation.z] };
  }
  return { root, kit };
}
