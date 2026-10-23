// The Fishmonger (C18, S2.6): a 12-gauge pump. A Cerakote receiver with a ghost-ring rear and a side saddle of
// four oxblood shells, a blued barrel over its magazine tube, a ribbed polymer pump that runs 70 mm, the bronze
// carrier under the loading port, a pistol-grip stock with a rubber pad. Shells go in one at a time from the left
// hand. Gun space: -Z the muzzle, +Y up, the bore on y = 0.03.

import * as THREE from "three";
import { FIN, GLOW, GunKit, facade, lathe, profile, rounded, sphere, type P2 } from "../gunkit";
import { crown, faction, foreGripL, optsOf, pinchHand, rifleGripR, trim } from "./common";

const BORE = 0.03;
const TUBE_Y = 0.006;
/** The ghost ring's centre: aimed, on the camera axis. */
export const SHOTGUN_SIGHT: readonly [number, number, number] = [0, 0.067, 0.046];

/** A shotshell along -Z from its head at p: a brass base and an oxblood hull. */
function shell(kit: GunKit, part: THREE.Object3D, p: [number, number, number], phone: boolean, r: [number, number, number] = [0, 0, 0]): void {
  // 12 sides at least: at 8 the kit's 43° crease kept every face flat and the shells read as boxes (C18 review).
  const seg = phone ? 12 : 16;
  kit.add(lathe([[0.0105, 0], [0.0105, -0.0015], [0.0098, -0.002], [0.0098, -0.014]], { seg }), FIN.brass, { p, r }, part);
  kit.add(lathe([[0.0096, -0.014], [0.0096, -0.066], [0.0091, -0.0685], [0.0072, -0.0698], [0.003, -0.0702], [0, -0.0703]], { seg }), FIN.hull, { p, r }, part);
  kit.add(new THREE.CircleGeometry(0.0105, seg), FIN.brass, { p, r }, part);
}

export function buildShotgun(phone = false, lod = false): { root: THREE.Group; kit: GunKit } {
  const root = new THREE.Group();
  root.name = "fishmonger";
  const kit = new GunKit(root, phone || lod);
  const o = optsOf(phone, lod);
  const body = kit.part("receiver");
  for (const n of ["barrel", "tube", "stock", "bead"]) kit.empty(n, [0, n === "bead" ? 0.064 : 0, n === "bead" ? -0.6 : 0], body);

  // ---- Receiver: the port on the right, the loading port's mouth under it, a saddle of shells on the left.
  const recOut: P2[] = [[0.072, -0.004], [0.072, 0.05], [0.066, 0.056], [-0.118, 0.056], [-0.122, 0.05], [-0.122, -0.004], [-0.096, -0.012], [-0.03, -0.012]];
  const port: P2[] = [[0.0, 0.026], [-0.06, 0.026], [-0.06, 0.046], [0.0, 0.046]];
  kit.add(profile(recOut, 0.034, { bevel: 0.0014, holes: o.lod ? [] : [port], ...o }), FIN.receiver, undefined, body);
  faction(kit, body, -0.0171, 0.03, -0.02, 0.08);
  trim(kit, body, -0.0172, 0.0018, 0.06, 0.17, o.phone);
  // The saddle: a plate on the left with four shells, brass to the back.
  kit.add(rounded(0.004, 0.034, 0.1, 0.002, o.phone), FIN.receiver, { p: [-0.0195, 0.025, -0.045] }, body);
  // The saddle's shells stand brass-up in a row along the plate.
  if (!o.lod) for (let i = 0; i < 4; i++) shell(kit, body, [-0.032, 0.06, -0.012 - i * 0.023], o.phone, [-Math.PI / 2, 0, 0]);
  // The ghost ring: a protected aperture on the receiver's rear.
  const ring: P2[] = [];
  const hole: P2[] = [];
  const n = o.phone ? 12 : 20;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    ring.push([Math.cos(a) * 0.0085, SHOTGUN_SIGHT[1] - 0.056 + Math.sin(a) * 0.0085]);
    hole.unshift([Math.cos(a) * 0.0055, SHOTGUN_SIGHT[1] - 0.056 + Math.sin(a) * 0.0055]);
  }
  kit.add(facade(ring, 0.005, { holes: [hole], ...o }), FIN.receiver, { p: [0, 0.056, SHOTGUN_SIGHT[2]] }, body);
  kit.add(facade([[-0.014, 0], [0.014, 0], [0.014, 0.016], [0.011, 0.016], [0.0095, 0.004], [-0.0095, 0.004], [-0.011, 0.016], [-0.014, 0.016]], 0.012, { ...o }), FIN.receiver, { p: [0, 0.056, SHOTGUN_SIGHT[2]] }, body);
  kit.empty("sight", [...SHOTGUN_SIGHT], body);

  // ---- Barrel (blued) on top of the tube, a vented rib, the bead on a ramp; the tube's end cap and swivel.
  kit.add(lathe([[0.0118, -0.12], [0.0118, -0.6], [0.0112, -0.606]], { phone: o.phone }), FIN.blued, { p: [0, BORE, 0] }, body);
  crown(kit, body, BORE, -0.6072, 0.0112, 0.0092, o.phone);
  kit.add(lathe([[0.0118, -0.12], [0.0118, -0.52], [0.0124, -0.522], [0.0124, -0.54], [0.009, -0.546]], { phone: o.phone }), FIN.blued, { p: [0, TUBE_Y, 0] }, body);
  kit.add(rounded(0.014, 0.012, 0.03, 0.003, o.phone), FIN.receiver, { p: [0, (BORE + TUBE_Y) / 2, -0.52] }, body);
  const ribVents: P2[][] = o.lod ? [] : Array.from({ length: 10 }, (_, i) => {
    const z = -0.13 - i * 0.045;
    return [[z, 0.0428], [z - 0.03, 0.0428], [z - 0.03, 0.0458], [z, 0.0458]] as P2[];
  });
  kit.add(profile([[-0.12, 0.041], [-0.598, 0.041], [-0.598, 0.0475], [-0.12, 0.0475]], 0.008, { bevel: 0.0004, holes: ribVents, ...o }), FIN.blued, undefined, body);
  kit.add(profile([[-0.585, 0.0475], [-0.6, 0.0475], [-0.6, 0.061], [-0.594, 0.061]], 0.004, { bevel: 0.0004, ...o }), FIN.blued, undefined, body);
  kit.add(sphere(0.0022, o.phone), FIN.bronze, { p: [0, 0.0635, -0.597] }, body);
  kit.add(sphere(0.0009, o.phone), GLOW.tritium, { p: [0, 0.0635, -0.595], s: [1, 1, 0.4] }, body);
  kit.empty("sightF", [0, 0.064, -0.597], body);

  // ---- Stock: a pistol-grip stock in polymer, stippled grip, rubber pad.
  const stockOut: P2[] = [
    [0.072, 0.048],
    [0.32, 0.034],
    [0.326, 0.026],
    [0.326, -0.07],
    [0.312, -0.078],
    [0.2, -0.04],
    [0.11, -0.03],
    [0.098, -0.112],
    [0.066, -0.114],
    [0.06, -0.03],
    [0.072, -0.004],
  ];
  kit.add(profile(stockOut, 0.034, { bevel: 0.0024, ...o }), FIN.frame, undefined, body);
  kit.add(profile([[0.07, -0.036], [0.064, -0.106], [0.094, -0.108], [0.1, -0.036]], 0.0355, { bevel: 0.001, ...o }), FIN.grip, undefined, body);
  kit.add(rounded(0.036, 0.112, 0.014, 0.005, o.phone), FIN.rubber, { p: [0, -0.022, 0.332] }, body);
  // The guard: a loop under the receiver.
  const guardOut: P2[] = [[0.06, -0.004], [0.06, -0.03], [0.05, -0.04], [0.012, -0.04], [0.004, -0.012], [0.004, -0.004]];
  const guardIn: P2[] = [[0.054, -0.008], [0.054, -0.028], [0.047, -0.034], [0.016, -0.034], [0.01, -0.012], [0.01, -0.008]];
  kit.add(profile(guardOut, 0.012, { holes: [guardIn], bevel: 0.0008, ...o }), FIN.receiver, undefined, body);

  // ---- The carrier (the shell lifter) under the loading port.
  const carrier = kit.part("carrier", [0, -0.006, -0.02]);
  kit.add(rounded(0.022, 0.003, 0.07, 0.0012, o.phone), FIN.bronze, { p: [0, 0, -0.035] }, carrier);

  // ---- The pump: ribbed polymer round the tube, the support hand rides it.
  const pump = kit.part("pump");
  const pumpOut: P2[] = [[-0.2, -0.012], [-0.2, 0.024], [-0.212, 0.03], [-0.338, 0.03], [-0.346, 0.024], [-0.346, -0.012], [-0.338, -0.018], [-0.208, -0.018]];
  kit.add(profile(pumpOut, 0.04, { bevel: 0.003, ...o }), FIN.frame, undefined, pump);
  if (!o.lod) for (let i = 0; i < 8; i++) kit.add(rounded(0.0415, 0.004, 0.006, 0.0015, o.phone), FIN.grip, { p: [0, -0.012, -0.226 - i * 0.015] }, pump);
  foreGripL(kit, pump, [0, TUBE_Y - 0.004, -0.27], 0.02);

  // ---- The shell in her fingers (reloads): it rests at the loading port, nose forward.
  const sh = kit.part("shell", [0, -0.004, -0.03]);
  shell(kit, sh, [0, 0, 0], o.phone);
  pinchHand(kit, sh, "loadHand", [-0.004, -0.008, 0.004], [-0.6, -0.7, 0.4]);
  sh.visible = false;

  // ---- The trigger.
  const trigger = o.phone ? kit.empty("trigger", [0, -0.008, 0.034], body) : kit.part("trigger", [0, -0.008, 0.034]);
  if (!o.phone) kit.add(profile([[0.002, 0], [-0.003, 0], [-0.006, -0.012], [-0.005, -0.02], [-0.002, -0.02], [-0.001, -0.011], [0.0025, -0.004]], 0.0058, { bevel: 0.0006, ...o }), FIN.control, undefined, trigger);

  kit.empty("muzzle", [0, BORE, -0.61]);
  kit.empty("port", [0.018, 0.036, -0.03]);
  rifleGripR(kit, root, [0, -0.07, 0.085]);
  kit.finish();
  for (const nn of ["pump", "carrier", "shell", "trigger"]) {
    const p = kit.parts[nn];
    if (p) p.userData.rest = { pos: p.position.toArray(), rot: [p.rotation.x, p.rotation.y, p.rotation.z] };
  }
  return { root, kit };
}
