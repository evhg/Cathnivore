// The Board Tower (act 4, the Chair): a climb. A marble lobby with the courier's safe, a grand stair up to an office
// floor (cubicles, a glass-walled server room), a second stair up to the boardroom where the Chair sits at the head
// of a long table with the whole city below the glass. The player starts at the south doors (+z) and goes north (-z),
// two floors up. Each stair is a run of 35 cm risers, like the plaza steps.

import * as THREE from "three";
import { Builder } from "../builder";
import { prng, WIN_COLS, WIN_ROWS } from "../textures";
import type { Level, SignDef, VLight, WindowDef } from "../level";

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const C = (hex: string) => new THREE.Color(hex);

export const TOWER = {
  xW: -14,
  xE: 14,
  zS: 52,
  zN: -60,
  /** Grand stair one: lobby to offices; stair two: offices to boardroom. */
  stair1: 18,
  stair2: -28,
  run: 1.4,
  rise: 0.35,
  count: 13,
} as const;
export const TOWER_H1 = TOWER.count * TOWER.rise;
export const TOWER_H2 = 2 * TOWER_H1;

/** Floor height under (x, z): the lobby, the two stairs (|x| <= 5) and the two upper floors. */
export function towerGround(x: number, z: number): number {
  const { stair1, stair2, run, rise, count } = TOWER;
  const end1 = stair1 - count * run;
  const end2 = stair2 - count * run;
  if (z > stair1) return 0;
  if (z > end1) return Math.abs(x) <= 5 ? Math.min(count, Math.floor((stair1 - z) / run) + 1) * rise : TOWER_H1;
  if (z > stair2) return TOWER_H1;
  if (z > end2) return Math.abs(x) <= 5 ? TOWER_H1 + Math.min(count, Math.floor((stair2 - z) / run) + 1) * rise : TOWER_H2;
  return TOWER_H2;
}

export function buildTower(quality: "phone" | "high" | "ultra"): Level {
  void quality;
  const b = new Builder();
  const lights: VLight[] = [];
  const signs: SignDef[] = [];
  const windows: WindowDef[] = [];
  const rand = prng(5521);
  let seed = 1;
  const light = (pos: THREE.Vector3, color: string, intensity: number, range: number, flicker = 0, real = true) =>
    lights.push({ pos, color: C(color), intensity, range, normal: null, flicker, seed: seed++, real });
  const { xW, xE, zS, zN, stair1, stair2, run, rise, count } = TOWER;
  const end1 = stair1 - count * run;
  const end2 = stair2 - count * run;
  const ceil = TOWER_H2 + 5;
  const H1 = TOWER_H1;
  const H2 = TOWER_H2;

  // Shell.
  b.boxMinMax("tiles", xW, -0.5, end1 + 0.001, xE, 0, zS, { uv: 3, skip: ["bottom"] }); // lobby floor (z > stair1)
  b.boxMinMax("concreteB", xW, ceil, zN, xE, ceil + 0.5, zS, { uv: 2, collide: "concrete" });
  b.boxMinMax("concreteA", xW - 0.5, -0.5, zN, xW, ceil + 0.5, zS, { uv: 2, collide: "concrete" });
  b.boxMinMax("concreteA", xE, -0.5, zN, xE + 0.5, ceil + 0.5, zS, { uv: 2, collide: "concrete" });
  b.boxMinMax("concreteA", xW, -0.5, zS, xE, ceil + 0.5, zS + 0.5, { uv: 2, collide: "concrete" });
  b.boxMinMax("concreteA", xW, -0.5, zN - 0.5, xE, TOWER_H2, zN, { uv: 2, collide: "concrete" });
  b.boxMinMax("concreteA", xW, TOWER_H2 + 5, zN - 0.5, xE, ceil + 0.5, zN, { uv: 2, collide: "concrete" });
  // Solid masses under the upper floors, with the stairs notched into them.
  b.boxMinMax("tiles", xW, -0.5, end1, xE, H1, end2, { uv: 3, collide: "concrete" });
  b.boxMinMax("tiles", xW, -0.5, zN, xE, H2, end2, { uv: 3, collide: "concrete" });
  for (const [z0, base] of [[stair1, 0], [stair2, H1]] as const) {
    for (let i = 0; i < count; i++) {
      const zi = z0 - i * run;
      b.boxMinMax("tiles", -5, base, zi - run, 5, base + (i + 1) * rise, zi, { uv: 2, collide: "concrete" });
    }
    for (const s of [-1, 1]) b.boxMinMax("tiles", s === -1 ? xW : 5, base, z0 - count * run, s === -1 ? -5 : xE, base + count * rise, z0, { uv: 2, collide: "concrete" });
  }
  // The stairs' side masses fill the gap to the walls; glass rails along the stair edges.
  for (const [z0, base] of [[stair1, 0], [stair2, H1]] as const) {
    for (const s of [-1, 1]) b.boxMinMax("glass", s * 5 - 0.03, base + 0.4, z0 - count * run, s * 5 + 0.03, base + count * rise + 1.1, z0);
  }

  // Lobby: marble columns with glow strips, a reception desk, the courier's safe, a revolving door at the south.
  for (const x of [-9, -4.5, 4.5, 9]) for (const z of [44, 32]) {
    b.box("concreteA", x, ceil / 2, z, 1.2, ceil, 1.2, { collide: "concrete" });
    b.box("glowCool", x, 2.6, z + 0.62, 0.3, 4, 0.04);
  }
  b.box("plasticWhite", 0, 0.6, 24, 7, 1.2, 1.2, { collide: "metal" });
  b.box("glowCoolDim", 0, 1.3, 23.3, 6.2, 0.1, 0.05);
  b.box("darkMetal", 9.5, 0.6, 33, 1.2, 1.2, 1.2, { collide: "metal" }); // the courier's lobby safe
  b.box("glowAmber", 9.5, 1.15, 32.38, 0.5, 0.12, 0.04);
  signs.push({ text: "VANTAGE GROUP", sub: "VISITORS REGISTER AT DESK", style: "screen", color: "#bfe9ff", w: 7, h: 1.8, center: V(0, 5.2, 21.3), normal: V(0, 0, 1), flicker: 0, intensity: 2.2 });
  b.box("glass", 0, 1.6, zS - 0.1, 6, 3.2, 0.08);
  b.box("glowRed", 0, 3.6, zS - 0.05, 1.4, 0.3, 0.05);

  // Offices: cubicle rows, glowing monitors and the server room behind a glass wall in the east.
  for (let r = 0; r < 4; r++) {
    for (const x of [-10.5, -8, 8]) {
      const z = -4 - r * 6;
      b.box("plasticWhite", x, H1 + 0.38, z, 2.0, 0.76, 0.9, { collide: "metal" });
      b.box("glowCool", x, H1 + 1.0, z - 0.3, 0.7, 0.4, 0.04);
      b.box("paintMetal", x, H1 + 0.7, z + 0.55, 2.0, 1.4, 0.06, { collide: "metal" });
    }
  }
  b.boxMinMax("glass", 9, H1, -10, 9.06, H1 + 3.6, -26);
  for (let i = 0; i < 6; i++) {
    const z = -12 - i * 2.2;
    b.box("darkMetal", 12.8, H1 + 1.2, z, 0.9, 2.4, 1.2, { collide: "metal" });
    b.box("glowCyan", 12.33, H1 + 1.2, z, 0.04, 1.8, 0.8);
  }
  light(V(11.5, H1 + 3, -17), "#2ee6ff", 16, 9, 1);
  signs.push({ text: "SERVER ROOM", sub: "AUTHORISED KEYHOLDERS", style: "box", color: "#2ee6ff", w: 2.2, h: 0.4, center: V(8.9, H1 + 2.8, -9.4), normal: V(-1, 0, 0), flicker: 1, intensity: 3 });

  // Boardroom: a long table, chairs, the Chair's seat and a wall of glass over the city.
  b.box("wood", 0, H2 + 0.75, -52, 3.4, 0.15, 13, { collide: "metal" });
  b.box("darkMetal", 0, H2 + 0.35, -52, 1.2, 0.7, 11);
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) b.box("blackPaint", s * 2.4, H2 + 0.45, -57 + i * 2, 0.7, 0.9, 0.7, { collide: "metal" });
  b.box("chrome", 0, H2 + 0.7, -58.6, 0.9, 1.4, 0.9);
  b.boxMinMax("glass", xW, H2, zN, xE, H2 + 5, zN + 0.1, { collide: "metal" });
  signs.push({ text: "THE BOARD", sub: "QUARTERLY SESSION", style: "screen", color: "#ffd9a0", w: 4, h: 1.2, center: V(-13.9, H2 + 3, -50), normal: V(1, 0, 0), flicker: 0, intensity: 2.2 });

  // The city beyond the glass: a dark backdrop of towers with lit windows, far below and far across.
  b.boxMinMax("blackPaint", -90, H2 - 60, zN - 46, 90, H2 + 50, zN - 45, { uv: 1 });
  for (let row = 0; row < 18; row++) {
    for (let i = 0; i < 40; i++) {
      if (rand() > 0.55) continue;
      windows.push({ pos: V(-78 + i * 4, H2 - 40 + row * 4.5, zN - 44.9), normal: V(0, 0, 1), w: 1.8, h: 2.4, tile: Math.floor(rand() * WIN_COLS * WIN_ROWS), lit: 1.2 + rand() * 2 });
    }
  }
  // Lights: cool lobby, office strips, a warm boardroom and a skylit glow from the city window.
  for (const z of [46, 38, 30, 22]) light(V(0, ceil - 1, z), "#d9ecff", 40, 16, 0);
  light(V(0, H1 + 5, -4), "#e8f4ff", 36, 16, 0);
  light(V(0, H1 + 5, -20), "#e8f4ff", 36, 16, 2);
  for (const z of [-40, -48, -56]) light(V(0, H2 + 4.5, z), "#ffe2b8", 80, 16, 0);
  light(V(0, H2 + 2, zN + 1), "#6fa8ff", 22, 14, 0, false);
  for (const z of [0, -8, -16, -24, -32, -40, -48, -56]) b.box("glowCool", 0, ceil - 0.05, z, 0.3, 0.05, 3);

  const markers: Level["markers"] = {
    player: [V(0, 0, zS - 4)],
    perch: [V(-12, H1, -4), V(12, H1, -20)],
    extract: [V(0, 0, zS - 1.5)],
    "lead:register": [V(9.5, 0, 31)],
    "lead:guard": [V(7, 0, 28), V(7, 0, 36), V(11, 0, 28), V(12, 0, 36)],
    "lead:sniper": [V(-12, H1, 0)],
    "boss:chair": [V(0, H2, -57), V(2, H2, -56)],
    "boss:guard": [V(-3, H2, -50), V(3, H2, -50), V(-6, H2, -52), V(6, H2, -52)],
    "boss:sniper": [V(-12, H2, -48), V(12, H2, -48)],
    "boss:reinforce": [V(-9, H2, -48), V(-7, H2, -50), V(9, H2, -48), V(7, H2, -50), V(-4, H2, -47), V(4, H2, -47)],
    "patrol:lobby": [V(-10, 0, 40), V(10, 0, 40), V(10, 0, 26), V(-10, 0, 26)],
    "patrol:shield-lobby": [V(-8, 0, 28), V(8, 0, 28)],
    "patrol:offices-a": [V(-6, H1, -2), V(6, H1, -2), V(6, H1, -22), V(-6, H1, -22)],
    "patrol:shield-offices": [V(-9, H1, -14), V(-9, H1, -4)],
    "patrol:server": [V(11, H1, -12), V(11, H1, -24)],
    "patrol:boardroom": [V(-9, H2, -52), V(9, H2, -52)],
    "patrol:sniper-mezz": [V(-12, H1, -8)],
    // Laser grids across the office floor: they pulse, alternating, so a run through can be timed.
    "laser:offices-a": [V(-7, H1, -7), V(7, H1, -7)],
    "laser:offices-b": [V(-7, H1, -15), V(7, H1, -15)],
    "laser:offices-c": [V(-7, H1, -23), V(7, H1, -23)],
  };

  return {
    builder: b,
    markers,
    lights,
    signs,
    windows,
    cones: [],
    posters: [],
    vending: [],
    interiors: [],
    vents: [V(0, ceil - 0.2, 0)],
    drips: [],
    bulbs: [],
    // Indoors throughout: no rain anywhere.
    shelters: [new THREE.Box3(V(xW - 20, -5, zN - 20), V(xE + 20, 40, zS + 20))],
    key: { pos: V(0, ceil - 0.6, 20), target: V(0, 0, 36), color: C("#e8f4ff") },
    groundHeight: towerGround,
    theme: {
      name: "The Board Tower",
      loading: "Glass, marble, a private lift…",
      fog: [0.004, 0.006, 0.009],
      fogDensity: 0.006,
      volMin: V(xW - 2, -1, zN - 4),
      volMax: V(xE + 2, ceil + 2, zS + 4),
      probe: V(0, 2, 36),
      outdoor: false,
      bounds: { xMin: xW + 0.4, xMax: xE - 0.4, zMin: zN + 0.6, zMax: zS - 0.6 },
      len: zS - zN,
    },
  };
}
