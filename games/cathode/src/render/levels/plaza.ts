// Hollowell Plaza (act 3, Councillor Pell): an open civic square in heavy rain. The player arrives at the
// south tram stop (+z) and looks north across a dry fountain to the council steps (-z), where Pell holds his
// rally under a giant holo-billboard of himself. Market awnings line the west side, a stalled tram sits on the
// east, statues of founders stand either side of the steps and marksmen watch from the rooftops.

import * as THREE from "three";
import { Builder } from "../builder";
import { prng, WIN_COLS, WIN_ROWS } from "../textures";
import type { Level, SignDef, VLight, WindowDef } from "../level";

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const C = (hex: string) => new THREE.Color(hex);

export const PLAZA = { xW: -30, xE: 30, zS: 52, zN: -56, stepZ0: -28, stepRun: 1.6, stepRise: 0.3, stepCount: 8 } as const;

/** Height of the council steps under (x, z): eight 30 cm risers up to a 2.4 m landing, 20 m wide. */
export function plazaGround(x: number, z: number): number {
  const { stepZ0, stepRun, stepRise, stepCount } = PLAZA;
  if (Math.abs(x) > 10 || z > stepZ0) return 0;
  const n = Math.floor((stepZ0 - z) / stepRun) + 1;
  return Math.min(stepCount, n) * stepRise;
}

export function buildPlaza(quality: "phone" | "high" | "ultra"): Level {
  void quality;
  const b = new Builder();
  const rand = prng(4407);
  const lights: VLight[] = [];
  const signs: SignDef[] = [];
  const windows: WindowDef[] = [];
  const cones: Level["cones"] = [];
  let seed = 1;
  const light = (pos: THREE.Vector3, color: string, intensity: number, range: number, flicker = 0, real = false) =>
    lights.push({ pos, color: C(color), intensity, range, normal: null, flicker, seed: seed++, real });
  const { xW, xE, zS, zN, stepZ0, stepRun, stepRise, stepCount } = PLAZA;
  const top = stepCount * stepRise;

  // Ground: wet stone square, a tram road along the east side.
  b.boxMinMax("pavement", xW, -0.5, zN, xE, 0, zS, { uv: 3, skip: ["bottom"] });
  b.boxMinMax("asphalt", 17, -0.49, zN + 4, 27, 0.005, zS, { uv: 4, skip: ["bottom"] });
  for (const x of [21.2, 22.8]) b.boxMinMax("rust", x - 0.04, 0.005, zN + 4, x + 0.04, 0.03, zS);

  // Perimeter buildings: tall facades with lit and dark windows, and flat roofs the marksmen use.
  const facade = (x0: number, x1: number, z0: number, z1: number, h: number, key: string, face: THREE.Vector3) => {
    b.boxMinMax(key, x0, -0.5, z0, x1, h, z1, { uv: 2, collide: "concrete" });
    const alongZ = face.x !== 0;
    const span = alongZ ? z1 - z0 : x1 - x0;
    const n = Math.floor(span / 3.2);
    for (let row = 0; row < Math.floor(h / 3.3); row++) {
      for (let i = 0; i < n; i++) {
        const lit = rand() < 0.3;
        const t = z0 + (i + 0.5) * (span / n);
        const px = alongZ ? (face.x > 0 ? x1 + 0.03 : x0 - 0.03) : x0 + (i + 0.5) * (span / n);
        const pz = alongZ ? t : face.z > 0 ? z1 + 0.03 : z0 - 0.03;
        windows.push({ pos: V(px, 2.4 + row * 3.3, pz), normal: face, w: 1.25, h: 1.75, tile: Math.floor(rand() * WIN_COLS * WIN_ROWS), lit: lit ? 0.8 + rand() * 1.6 : 0 });
      }
    }
  };
  facade(xW - 8, xW, zN, 10, 9, "brickDark", V(1, 0, 0)); // west block, north half
  facade(xW - 8, xW, 14, zS + 6, 12, "brickRed", V(1, 0, 0)); // west block, market side
  facade(xE, xE + 8, zN, -14, 8, "concreteB", V(-1, 0, 0)); // east block, north
  facade(xE, xE + 8, -10, zS + 6, 14, "brickDark", V(-1, 0, 0)); // east block, tram side
  facade(xW - 8, xE + 8, zS, zS + 6, 10, "concreteB", V(0, 0, -1)); // the tram-stop hoarding
  // The council hall closes the north end: a portico on columns over the landing.
  b.boxMinMax("concreteA", xW - 8, -0.5, zN - 8, xE + 8, 20, zN, { uv: 2, collide: "concrete" });
  b.boxMinMax("concreteB", -12, top - 0.3, zN, 12, top, -41, { uv: 2, collide: "concrete" });
  b.boxMinMax("concreteA", -12, top + 6.2, zN, 12, top + 7, -46, { uv: 2, collide: "concrete" });
  for (const x of [-10, -5, 0, 5, 10]) b.box("concreteA", x, top + 3.1, -47, 0.9, 6.2, 0.9, { collide: "concrete" });
  b.box("wood", 0, top + 0.55, -50, 1.2, 1.1, 0.7, { collide: "metal" }); // Pell's lectern

  // The steps: eight risers, each a full-width block so the player climbs by stepping.
  for (let i = 0; i < stepCount; i++) {
    const z0 = stepZ0 - i * stepRun;
    b.boxMinMax("concreteA", -10, 0, -41, 10, (i + 1) * stepRise, z0, { uv: 2, collide: "concrete" });
  }
  // Flank walls with brazier bins and the police line.
  for (const s of [-1, 1]) {
    b.boxMinMax("concreteB", s * 10, 0, -41, s * 10.5, 1.2, stepZ0, { collide: "concrete" });
    b.box("jersey", s * 7, 0.4, stepZ0 + 3, 2.4, 0.8, 0.5, { collide: "concrete" });
    b.box("jersey", s * 3, 0.4, stepZ0 + 3, 2.4, 0.8, 0.5, { collide: "concrete" });
  }

  // The dry fountain: a shallow basin, a stained column and a founder on top.
  b.cylinder("concreteB", V(0, 0, 8), V(0, 0.8, 8), 4.6, 20, "concrete");
  b.cylinder("darkMetal", V(0, 0.2, 8), V(0, 0.82, 8), 4.0, 20);
  b.cylinder("concreteA", V(0, 0, 8), V(0, 3.2, 8), 0.7, 10, "concrete");
  b.box("darkMetal", 0, 4.0, 8, 0.7, 1.6, 0.7);
  b.box("darkMetal", 0, 5.0, 8, 0.45, 0.45, 0.45);

  // Statues of founders either side of the approach, pigeon-streaked.
  for (const x of [-14, 14]) {
    b.box("concreteA", x, 0.8, -12, 2.2, 1.6, 2.2, { collide: "concrete" });
    b.box("darkMetal", x, 2.6, -12, 0.9, 2.2, 0.7);
    b.box("darkMetal", x, 3.9, -12, 0.5, 0.5, 0.5);
    b.box("darkMetal", x + (x < 0 ? 0.9 : -0.9), 3.0, -12, 0.2, 0.2, 1.4);
  }

  // Market awnings (west): four stalls under tarp, counters, crates and warm bulbs.
  const shelters: THREE.Box3[] = [new THREE.Box3(V(-12, 6, -52), V(12, 30, -40))];
  for (let i = 0; i < 4; i++) {
    const z = 22 + i * 7;
    b.box("tarp", -22, 2.7, z, 5.2, 0.12, 4, { uv: 1 });
    for (const dz of [-1.8, 1.8]) for (const dx of [-2.4, 2.4]) b.cylinder("pipe", V(-22 + dx, 0, z + dz), V(-22 + dx, 2.65, z + dz), 0.05);
    b.box("wood", -22, 0.5, z, 3.6, 1, 0.8, { collide: "metal" });
    b.box("styro", -23.2, 0.2, z + 1.4, 0.8, 0.4, 0.5, { collide: "metal" });
    b.box("glowWarm", -22, 2.5, z, 0.3, 0.08, 0.3);
    light(V(-22, 2.3, z), "#ffb86a", 12, 7, 1);
    shelters.push(new THREE.Box3(V(-25, 0, z - 2), V(-19, 3, z + 2)));
  }

  // The tram line (east): a stalled tram, its windows lit, overhead cable on poles.
  b.box("vanWhite", 22, 1.7, -2, 3.0, 3.2, 14, { collide: "metal" });
  b.box("glowWarm", 22, 2.2, -2, 3.04, 0.7, 12);
  b.box("darkMetal", 22, 0.35, -2, 2.6, 0.5, 13);
  for (let z = 44; z >= -40; z -= 14) {
    b.cylinder("pipe", V(26.2, 0, z), V(26.2, 6.4, z), 0.09, 8, "metal");
    b.cylinder("pipe", V(26.2, 6.2, z), V(22, 6.2, z), 0.05);
    if (z > -36) b.cable("cable", V(22, 6.2, z), V(22, 6.2, z - 14), 0.35);
  }
  b.box("paintTeal", 24.6, 1.2, 46, 0.1, 2.4, 3, { uv: 1 }); // tram shelter panel
  b.box("glowCool", 24.55, 1.6, 46, 0.04, 1.4, 2.6);
  signs.push({ text: "LINE 9", sub: "SUSPENDED · COUNCIL DIRECTIVE", style: "box", color: "#2ee6ff", w: 2.4, h: 0.5, center: V(24.5, 2.8, 46), normal: V(-1, 0, 0), flicker: 1, intensity: 3 });
  light(V(24, 2, 46), "#7fe9ff", 10, 8, 1);

  // Street lamps along both sides of the square, sodium and wet.
  for (let z = 44; z > zN + 8; z -= 12) {
    for (const x of [-16, 16]) {
      b.cylinder("pipe", V(x, 0, z), V(x, 5.2, z), 0.07, 8, "metal");
      b.box("glowSodium", x, 5.25, z, 0.5, 0.1, 0.5);
      light(V(x, 5, z), "#ff9a3a", 20, 12, z % 24 === 0 ? 1 : 0, Math.abs(z) < 30);
      cones.push({ top: V(x, 5.2, z), length: 5.2, radius: 2.4, color: C("#ff9a3a"), strength: 0.5 });
    }
  }

  // Pell's holo-billboard on the hall's face, and flanking campaign screens.
  b.boxMinMax("blackPaint", -9, 8.8, zN - 0.02, 9, 16.2, zN + 0.2, { uv: 1 });
  signs.push({ text: "PELL", sub: "A SAFER HOLLOWELL", style: "screen", color: "#ffd9a0", w: 17, h: 7, center: V(0, 12.5, zN + 0.24), normal: V(0, 0, 1), flicker: 1, intensity: 1.7 });
  light(V(0, 11, zN + 6), "#ffcf9a", 90, 28, 1);
  for (const x of [-18, 18]) {
    signs.push({ text: "VOTE ORDER", sub: "PAID FOR BY CANDOR", style: "screen", color: "#ff7fb0", w: 5, h: 2.4, center: V(x, 6, zN + 0.24), normal: V(0, 0, 1), flicker: 2, intensity: 2.6 });
    light(V(x, 5, zN + 3), "#ff5f9a", 16, 10, 2);
  }
  // Police cruiser lights at the foot of the steps.
  for (const x of [-9, 9]) {
    b.box("carBlack", x, 0.7, stepZ0 + 7, 2.0, 1.2, 4.6, { collide: "metal" });
    b.box("glowRed", x - 0.5, 1.4, stepZ0 + 7, 0.5, 0.12, 0.2);
    b.box("glowCyan", x + 0.5, 1.4, stepZ0 + 7, 0.5, 0.12, 0.2);
    light(V(x - 0.5, 1.6, stepZ0 + 7), "#ff2a2a", 14, 9, 3);
    light(V(x + 0.5, 1.6, stepZ0 + 7), "#2e8bff", 14, 9, 3);
  }
  // Police searchlights from the hall roof rake the square through the rain.
  for (const [x, tx] of [[-12, -4], [12, 6]] as const) {
    const top = V(x, 21, zN + 2);
    const dir = V(tx - x, -21, 14 - (zN + 2)).normalize();
    cones.push({ top, dir, length: 46, radius: 5, color: C("#cfe6ff"), strength: 0.7 });
  }
  // Barriers and cover across the square.
  for (const [x, z] of [[-8, 30], [8, 24], [-6, -2], [6, 16], [0, -18], [-12, 14], [12, -22]] as const) {
    b.box("jersey", x, 0.45, z, 2.6, 0.9, 0.6, { collide: "concrete" });
  }
  // The tram stop at the south end is the way out.
  b.box("glowRed", 0, 3.2, zS - 0.05, 1.2, 0.3, 0.05);
  light(V(0, 2.8, zS - 1.5), "#ff2a2a", 8, 6, 0);

  const markers: Level["markers"] = {
    player: [V(0, 0, zS - 4)],
    // Rooftop marksmen: the west market block and the north-east block.
    perch: [V(-34, 12, 28), V(34, 8, -24)],
    extract: [V(0, 0, zS - 1.5)],
    // Pell's permit strongbox sits at the back of the market awnings, guards around it.
    "lead:register": [V(-24.2, 0, 31)],
    "lead:guard": [V(-20, 0, 26), V(-20, 0, 34), V(-26, 0, 36), V(-16, 0, 30)],
    "lead:sniper": [V(-34, 12, 20)],
    // Pell on the landing behind his shield line; the ambush comes from both flanks and the square.
    "boss:pell": [V(0, top, -52), V(2, top, -52)],
    "boss:guard": [V(-5, top, -44), V(5, top, -44), V(-8, top, -46), V(8, top, -46)],
    "boss:reinforce": [V(-26, 0, -6), V(-24, 0, -10), V(24, 0, -30), V(26, 0, -26), V(0, 0, -14), V(-2, 0, -16)],
    "patrol:plaza-a": [V(-6, 0, 36), V(6, 0, 36), V(6, 0, 18), V(-6, 0, 18)],
    "patrol:plaza-b": [V(10, 0, 4), V(-10, 0, 4), V(-10, 0, -8), V(10, 0, -8)],
    "patrol:shield-steps": [V(-6, 0, -22), V(6, 0, -22)],
    "patrol:market": [V(-14, 0, 24), V(-14, 0, 38), V(-8, 0, 38), V(-8, 0, 24)],
    // The rally crowd: bystanders drifting round the fountain, the stalls, the tram stop and the steps.
    "patrol:civ-fountain-a": [V(5, 0, 8), V(0, 0, 13), V(-5, 0, 8), V(0, 0, 3)],
    "patrol:civ-fountain-b": [V(-6, 0, 12), V(6, 0, 12), V(6, 0, 4), V(-6, 0, 4)],
    "patrol:civ-market-a": [V(-17, 0, 22), V(-17, 0, 34)],
    "patrol:civ-market-b": [V(-19, 0, 40), V(-12, 0, 40)],
    "patrol:civ-tram-a": [V(24, 0, 40), V(24, 0, 48)],
    "patrol:civ-tram-b": [V(18, 0, 30), V(18, 0, 38)],
    "patrol:civ-rally-a": [V(-6, 0, -20), V(-3, 0, -17), V(-6, 0, -14)],
    "patrol:civ-rally-b": [V(4, 0, -20), V(7, 0, -16), V(3, 0, -14)],
    "patrol:civ-rally-c": [V(-1, 0, -24), V(2, 0, -21)],
    "patrol:police-a": [V(-12, 0, 14), V(12, 0, 14), V(12, 0, -2), V(-12, 0, -2)],
    "patrol:police-b": [V(20, 0, 44), V(20, 0, 24), V(-4, 0, 30)],
    "patrol:sniper-roof": [V(34, 8, -4)],
  };

  const key = { pos: V(-14, 17, 46), target: V(0, 0, -6), color: C("#ffe9c8") };
  return {
    builder: b,
    markers,
    lights,
    signs,
    windows,
    cones,
    posters: [],
    vending: [],
    interiors: [],
    vents: [V(-22, 3, 28), V(26, 8, -6)],
    drips: [V(-22, 2.6, 22), V(-22, 2.6, 36), V(24, 6.2, 20)],
    bulbs: [],
    shelters,
    key,
    groundHeight: plazaGround,
    theme: {
      name: "Hollowell Plaza",
      loading: "Rain on stone, a rally waiting…",
      fog: [0.006, 0.008, 0.012],
      fogDensity: 0.011,
      volMin: V(xW - 8, -1, zN - 8),
      volMax: V(xE + 8, 22, zS + 6),
      probe: V(0, 2, 10),
      outdoor: true,
      water: false,
      bounds: { xMin: xW + 0.5, xMax: xE - 0.5, zMin: zN + 0.6, zMax: zS - 0.6 },
      len: zS - zN,
    },
  };
}
