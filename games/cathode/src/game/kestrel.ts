// The Kestrel 9 (S2.1 part list): Hollowell Arms' compact 9x21, suppressed, with a slide-mounted red dot and
// tritium irons. Built from the kit: side-profile extrudes with real cut-outs (the trigger guard's loop, the
// slide's lightening window, the rail's slots), a plan extrude for the rear serrations, turned barrel and can,
// and an engraved left flank. Gun space: -Z is the muzzle, +Y up, the bore on y = 0.03.
//
// Moving parts (each its own merged mesh): frame, slide, barrel (with the can), hammer, trigger, mag,
// slideStop. Named empties: sightF, sightR, suppressor, rail, guard, floorplate, reddot, muzzle, port, magwell,
// gripR, gripL.

import * as THREE from "three";
import { FIN, GLOW, GunKit, arc, decal, facade, gripFrame, lathe, plan, profile, rounded, sphere, type P2 } from "./gunkit";

export const KESTREL_PARTS = [
  "frame", "slide", "barrel", "hammer", "trigger", "mag", "slideStop",
  "sightF", "sightR", "suppressor", "rail", "guard", "floorplate", "reddot",
  "muzzle", "port", "magwell", "gripR", "gripL",
] as const;

/** Where the red dot's emitter projects its dot, in gun space: aimed, this point sits on the camera axis. */
export const KESTREL_DOT: readonly [number, number, number] = [0, 0.0455 + 0.0118, -0.012 - 0.0079];

/** The bore line and the grip's rake (radians off vertical). */
const BORE = 0.03;
const RAKE = 0.31;

export function buildKestrel(phone = false, lod = false): { root: THREE.Group; kit: GunKit } {
  const root = new THREE.Group();
  root.name = "kestrel9";
  const kit = new GunKit(root, phone || lod);
  // LOD1 (a world gun past 8 m): no bevels, no cut-outs, phone tessellation.
  const o = { phone: phone || lod, lod };

  // ---- Frame (polymer): dust cover with a 3-slot rail, the trigger guard's loop, the raked grip, beavertail.
  const frame = kit.part("frame");
  const gripDir: P2 = [Math.sin(RAKE), -Math.cos(RAKE)]; // down the front strap, in (z, y)
  const gripN: P2 = [Math.cos(RAKE), Math.sin(RAKE)]; // across the grip, front to back
  const fs: P2 = [-0.004, -0.031]; // front strap top
  const fb: P2 = [fs[0] + gripDir[0] * 0.084, fs[1] + gripDir[1] * 0.084]; // front strap bottom
  const bb: P2 = [fb[0] + gripN[0] * 0.047, fb[1] + gripN[1] * 0.047]; // back strap bottom
  const frameOutline: P2[] = [
    [0.034, 0.013],
    [-0.136, 0.013],
    [-0.138, 0.002],
    // The rail's underside, with three cross slots.
    [-0.134, -0.004],
    ...[-0.124, -0.108, -0.092].flatMap((z): P2[] => [[z, -0.004], [z, -0.0015], [z + 0.005, -0.0015], [z + 0.005, -0.004]]),
    [-0.072, -0.004],
    // The trigger guard: a squared front for a support finger, a flat bottom, back into the front strap.
    [-0.066, -0.006],
    [-0.064, -0.03],
    [-0.058, -0.036],
    [-0.012, -0.036],
    ...arc(-0.006, -0.03, 0.006, -Math.PI / 2, -Math.PI * 0.12, 3).map(([z, y]): P2 => [z, y]),
    fs,
    [fs[0] + gripDir[0] * 0.03 - 0.0015, fs[1] + gripDir[1] * 0.03],
    [fs[0] + gripDir[0] * 0.06 - 0.001, fs[1] + gripDir[1] * 0.06],
    fb,
    [fb[0] + gripN[0] * 0.012, fb[1] + gripN[1] * 0.012 - 0.002],
    [bb[0] - gripN[0] * 0.01, bb[1] - gripN[1] * 0.01 - 0.001],
    bb,
    // The back strap, swelling into the palm, up to the beavertail.
    [bb[0] - gripDir[0] * 0.04 + 0.003, bb[1] - gripDir[1] * 0.04],
    [0.05, -0.012],
    [0.053, -0.002],
    [0.058, 0.006],
    [0.052, 0.01],
    [0.04, 0.009],
  ];
  const guardHole: P2[] = [
    [-0.06, -0.006],
    [-0.059, -0.028],
    [-0.055, -0.031],
    [-0.016, -0.031],
    [-0.011, -0.026],
    [-0.011, -0.006],
  ];
  kit.add(profile(frameOutline, 0.025, { bevel: 0.0012, holes: [guardHole], ...o }), FIN.frame, undefined, frame);
  // Stippled grip panels, proud of the frame by half a millimetre a side.
  const panel: P2[] = [
    [fs[0] + gripDir[0] * 0.01 + 0.002, fs[1] + gripDir[1] * 0.01],
    [fb[0] + 0.003, fb[1] + 0.006],
    [bb[0] - 0.006, bb[1] + 0.006],
    [0.046, -0.014],
    [0.041, -0.004],
    [0.012, -0.006],
  ];
  kit.add(profile(panel, 0.026, { bevel: 0.0008, ...o }), FIN.grip, undefined, frame);
  // The faction mark on the left of the dust cover, and the pins through the frame.
  kit.add(decal(0.058, 0.0062), FIN.faction, { p: [-0.01261, 0.0055, -0.098], r: [0, Math.PI, 0] }, frame);
  for (const [z, y] of [[-0.03, -0.001], [-0.045, 0.007], [0.022, 0.004]] as P2[]) {
    kit.add(lathe([[0.0018, 0.0128], [0.0018, -0.0128]], { seg: o.phone ? 8 : 12 }), FIN.pins, { p: [0, y, z], r: [0, Math.PI / 2, 0] }, frame);
  }
  // The takedown lever: a small steel tab on the left above the guard.
  kit.add(rounded(0.0016, 0.004, 0.009, 0.0007, o.phone), FIN.control, { p: [-0.0133, 0.0075, -0.058] }, frame);
  kit.empty("rail", [0, -0.004, -0.108], frame);
  kit.empty("guard", [0, -0.034, -0.035], frame);

  // ---- Slide (Cerakote over steel): rear serrations, a top port notch, a lightening window, engraving, trim.
  const slide = kit.part("slide");
  const slideOutline: P2[] = [
    [0.036, 0.0135],
    [0.036, 0.041],
    [0.032, 0.0455],
    [0.0, 0.0455],
    // The ejection port: an open notch in the top, the barrel's hood shows through it.
    [-0.0015, 0.0375],
    [-0.042, 0.0375],
    [-0.0435, 0.0455],
    [-0.139, 0.0455],
    [-0.1445, 0.042],
    [-0.1455, 0.03],
    [-0.1445, 0.016],
    [-0.141, 0.0135],
  ];
  const windowHole: P2[] = [
    [-0.098, 0.031],
    [-0.13, 0.031],
    [-0.132, 0.038],
    [-0.1, 0.038],
  ];
  kit.add(profile(slideOutline, 0.0235, { bevel: 0.0011, holes: [windowHole], ...o }), FIN.slide, undefined, slide);
  // Rear cocking serrations: seen from above, teeth on both flanks.
  const teeth: P2[] = [];
  const half = 0.0125;
  const zs: [number, number] = [0.031, 0.006];
  const nT = 7;
  teeth.push([-half + 0.0004, zs[0]]);
  for (let i = 0; i <= nT; i++) {
    const z = zs[0] + ((zs[1] - zs[0]) * i) / nT;
    teeth.push([-half, z - 0.0012], [-half - 0.0003, z]);
  }
  teeth.push([-half + 0.0004, zs[1]], [half - 0.0004, zs[1]]);
  for (let i = nT; i >= 0; i--) {
    const z = zs[0] + ((zs[1] - zs[0]) * i) / nT;
    teeth.push([half + 0.0003, z], [half, z + 0.0012]);
  }
  teeth.push([half - 0.0004, zs[0]]);
  kit.add(plan(teeth, 0.022, { ...o }), FIN.serration, { p: [0, 0.029, 0] }, slide);
  // The engraving on the left flank, readable at inspect.
  kit.add(decal(0.06, 0.0064), FIN.engraving, { p: [-0.01182, 0.023, -0.068], r: [0, Math.PI, 0] }, slide);
  // The one accent line: Hollowell cyan along the lower left edge.
  kit.add(rounded(0.0008, 0.0011, 0.118, 0.0003, o.phone), GLOW.trim, { p: [-0.0118, 0.0158, -0.07] }, slide);
  // The slide's back face: a brushed striker cover plate with its retaining pin and a shallow relief groove,
  // so the face she looks at most at the hip reads as machined, not a flat block.
  kit.add(rounded(0.0158, 0.0196, 0.0016, 0.0012, o.phone), FIN.control, { p: [0, 0.0262, 0.0362] }, slide);
  kit.add(rounded(0.0042, 0.0042, 0.0012, 0.0006, o.phone), FIN.pins, { p: [0, 0.0222, 0.0372] }, slide);
  kit.add(rounded(0.012, 0.0008, 0.0008, 0.0003, o.phone), FIN.bore, { p: [0, 0.0318, 0.0371] }, slide);
  // The extractor on the right of the port.
  kit.add(rounded(0.0016, 0.004, 0.018, 0.0006, o.phone), FIN.pins, { p: [0.0118, 0.035, -0.008] }, slide);

  // Sights: a tall rear sight with two tritium dots, the front post with one, co-witnessing through the dot.
  const sightR = kit.empty("sightR", [0, 0.0455, 0.028], slide);
  // Both irons are cut low (10.5 mm rear, 10.2 mm front) so through the optic they co-witness in the lower third
  // of the window, under the dot, instead of filling it.
  const rearSight: P2[] = [[-0.0085, 0], [0.0085, 0], [0.0085, 0.0105], [0.0021, 0.0105], [0.0021, 0.0058], [-0.0021, 0.0058], [-0.0021, 0.0105], [-0.0085, 0.0105]];
  kit.add(facade(rearSight, 0.0065, { ...o }), FIN.slide, { p: [0, 0.0455, 0.028] }, slide);
  for (const x of [-0.0053, 0.0053]) kit.add(sphere(0.0011, o.phone), GLOW.tritium, { p: [x, 0.0455 + 0.0077, 0.0313], s: [1, 1, 0.4] }, slide);
  kit.add(rounded(0.0034, 0.0102, 0.006, 0.0008, o.phone), FIN.slide, { p: [0, 0.0455 + 0.0051, -0.136] }, slide);
  kit.add(sphere(0.00115, o.phone), GLOW.tritium, { p: [0, 0.0455 + 0.0078, -0.1328], s: [1, 1, 0.4] }, slide);
  const sightF = kit.empty("sightF", [0, 0.0455, -0.136], slide);
  void sightR;
  void sightF;

  // The red dot: a machined hood with a window, physical glass, the dot itself.
  const dotZ = -0.012;
  kit.empty("reddot", [0, 0.0455, dotZ], slide);
  const hoodOut: P2[] = [
    [-0.0125, 0],
    [0.0125, 0],
    [0.0125, 0.006],
    [0.0118, 0.0105],
    ...arc(0, 0.0105, 0.0118, 0, Math.PI, o.phone ? 6 : 10),
    [-0.0118, 0.0105],
    [-0.0125, 0.006],
  ];
  const hoodWin: P2[] = [[-0.0098, 0.0058], [0.0098, 0.0058], [0.0098, 0.0105], ...arc(0, 0.0105, 0.0098, 0, Math.PI, o.phone ? 6 : 10).slice(1, -1), [-0.0098, 0.0105]];
  kit.add(facade(hoodOut, 0.028, { holes: [hoodWin], bevel: 0.0008, ...o }), FIN.housing, { p: [0, 0.0455, dotZ] }, slide);
  // The base under the window, with the emitter bump at the back.
  kit.add(rounded(0.0222, 0.006, 0.026, 0.0012, o.phone), FIN.housing, { p: [0, 0.0455 + 0.003, dotZ] }, slide);
  kit.add(rounded(0.006, 0.004, 0.005, 0.0015, o.phone), FIN.housing, { p: [0, 0.0455 + 0.007, dotZ + 0.009] }, slide);
  kit.add(new THREE.CircleGeometry(0.0118, phone ? 12 : 24).translate(0, 0.0105 - 0.0118, 0), "glass", { p: [0, 0.0455 + 0.0118, dotZ - 0.008], r: [-0.12, 0, 0] }, slide);
  kit.add(sphere(0.00075, o.phone), GLOW.dot, { p: [...KESTREL_DOT] }, slide);

  // ---- Barrel (TiN bronze) with the hood showing through the port, and the suppressor threaded on the crown.
  const barrel = kit.part("barrel", [0, BORE, -0.143]);
  // The barrel pivots at the muzzle bushing (the breech drops as it unlocks): pieces sit `bz` behind the pivot.
  const bz = 0.163;
  kit.add(lathe([[0.0064, 0.0], [0.0064, -0.162], [0.0058, -0.1655], [0.0045, -0.1655]], { ...o }), FIN.bronze, { p: [0, 0, bz] }, barrel);
  kit.add(rounded(0.0175, 0.0146, 0.042, 0.0016, o.phone), FIN.bronze, { p: [0, 0.0018, -0.0425 + bz] }, barrel);
  const can = kit.empty("suppressor", [0, 0, -0.165 + bz], barrel);
  const grooves: [number, number][] = [];
  const c0 = -0.168;
  const c1 = -0.33;
  grooves.push([0.0172, c0 + 0.006], [0.0178, c0], [0.0178, c0 - 0.026]);
  // The knurled grip band.
  for (let i = 0; i < 6; i++) {
    const z = c0 - 0.04 - i * 0.012;
    grooves.push([0.0178, z + 0.0035], [0.0166, z + 0.0025], [0.0166, z - 0.0025], [0.0178, z - 0.0035]);
  }
  grooves.push([0.0178, c1 + 0.008], [0.0172, c1 + 0.003], [0.0158, c1], [0.0062, c1], [0.0058, c1 + 0.004]);
  kit.add(lathe(grooves, { ...o }), FIN.can, { p: [0, 0, bz] }, barrel);
  // A thread collar, knurled, where the can meets the barrel.
  kit.add(lathe([[0.0105, -0.164], [0.012, -0.166], [0.012, -0.184], [0.0105, -0.186]], { ...o }), FIN.knurl, { p: [0, 0, -0.003 + bz] }, barrel);
  kit.add(new THREE.CircleGeometry(0.006, o.phone ? 10 : 16), FIN.bore, { p: [0, 0, c1 + 0.0035 + bz] }, barrel);
  void can;

  // ---- Hammer: a skeletonised spur behind the slide, cocked back (0 = down on the pin, 55° = cocked).
  const hammer = kit.part("hammer", [0, 0.012, 0.04]);
  const spur: P2[] = [[0.003, 0], [-0.003, 0], [-0.002, 0.011], [0.0, 0.016], [0.006, 0.0185], [0.0075, 0.015], [0.004, 0.011]];
  kit.add(profile(spur, 0.0062, { bevel: 0.0006, holes: [[[0.0, 0.0045], [0.0015, 0.0085], [0.0002, 0.0095], [-0.001, 0.006]]], ...o }), FIN.control, undefined, hammer);
  hammer.rotation.x = 0.96;

  // ---- Trigger: a flat-faced blade with a safety tab, pivoting in the guard (5 mm travel at the shoe).
  const trigger = kit.part("trigger", [0, -0.002, -0.034]);
  const blade: P2[] = [[0.002, 0], [-0.003, 0], [-0.0085, -0.012], [-0.0095, -0.022], [-0.006, -0.0235], [-0.004, -0.013], [0.0025, -0.004]];
  kit.add(profile(blade, 0.0058, { bevel: 0.0006, ...o }), FIN.control, undefined, trigger);
  kit.add(rounded(0.0016, 0.007, 0.0016, 0.0006, o.phone), FIN.frame, { p: [0, -0.012, -0.0072] }, trigger);

  // ---- Slide stop: a lever on the left, pivoting at its back end.
  const stop = kit.part("slideStop", [-0.0135, 0.009, 0.006]);
  kit.add(profile([[0, -0.002], [-0.032, -0.002], [-0.036, 0.001], [-0.034, 0.0045], [-0.022, 0.0045], [0.0, 0.002]], 0.0022, { bevel: 0.0004, ...o }), FIN.control, undefined, stop);
  kit.add(rounded(0.0024, 0.006, 0.008, 0.001, o.phone), FIN.control, { p: [-0.0005, 0.002, -0.03] }, stop);

  // ---- Magazine: the body inside the grip, a polymer floorplate below it, and the top round in its lips.
  const mag = kit.part("mag");
  const mT: P2 = [fs[0] + 0.004, 0.006];
  const mB: P2 = [fb[0] + 0.003, fb[1] - 0.001];
  const magOutline: P2[] = [mT, mB, [mB[0] + gripN[0] * 0.034, mB[1] + gripN[1] * 0.034], [mT[0] + 0.034, mT[1]]];
  kit.add(profile(magOutline, 0.021, { bevel: 0.0008, ...o }), FIN.pins, undefined, mag);
  const fpA: P2 = [fb[0] - 0.002, fb[1] - 0.0005];
  const fpB: P2 = [bb[0] + 0.0025, bb[1] + 0.0005];
  const floor: P2[] = [fpA, [fpA[0] + 0.002, fpA[1] - 0.009], [fpB[0] - 0.002, fpB[1] - 0.009], fpB];
  kit.add(profile(floor, 0.0285, { bevel: 0.0012, ...o }), FIN.grip, undefined, mag);
  kit.empty("floorplate", [0, (fpA[1] + fpB[1]) / 2 - 0.005, (fpA[0] + fpB[0]) / 2], mag);
  kit.add(lathe([[0.0048, 0.0], [0.0048, -0.019], [0.0045, -0.021]], { seg: o.phone ? 8 : 14 }), FIN.brass, { p: [0, 0.0105, mT[0] + 0.004] }, mag);
  kit.add(lathe([[0.0045, -0.021], [0.0042, -0.025], [0.0024, -0.0295], [0, -0.03]], { seg: o.phone ? 8 : 14 }), { color: 0xa8673a, metal: 1, rough: 0.35 }, { p: [0, 0.0105, mT[0] + 0.004] }, mag);

  // ---- Empties.
  kit.empty("muzzle", [0, BORE, -0.311]);
  kit.empty("port", [0.012, 0.042, -0.02]);
  kit.empty("magwell", [mT[0] + 0.017, -0.004, 0]);
  // The firing hand: wrist high behind the beavertail, knuckles down the front strap, back of the hand to the
  // right and a little up. The support hand: palm on the left panel, fingers round the front of the firing hand.
  const gR = gripFrame(new THREE.Vector3(0.02, -0.016, 0.07), new THREE.Vector3(0.05, -0.45, -0.89), new THREE.Vector3(1, 0.2, 0));
  kit.empty("gripR", gR.pos.toArray() as [number, number, number], root, gR.quat);
  const gL = gripFrame(new THREE.Vector3(-0.042, -0.041, 0.071), new THREE.Vector3(0.15, -0.35, -0.92), new THREE.Vector3(-1, -0.2, 0));
  kit.empty("gripL", gL.pos.toArray() as [number, number, number], root, gL.quat);

  kit.finish();
  return { root, kit };
}
