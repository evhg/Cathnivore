// The Board Tower (act 4, the Chair): a climb. A marble lobby with the courier's safe, a grand stair up to an office
// floor (cubicles, a glass-walled server room), a second stair up to the boardroom where the Chair sits at the head
// of a long table with the whole city below the glass. The player starts at the south doors (+z) and goes north (-z),
// two floors up. Each stair is a run of 35 cm risers, like the plaza steps.

import * as THREE from "three";
import { Builder } from "../builder";
import { prng } from "../textures";
import type { Level, SignDef, VLight, WindowDef } from "../level";
import type { CrowdGroup } from "../crowd";

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
    for (const s of [-1, 1]) b.boxMinMax("glass", s * 5 - 0.03, base + 0.4, z0 - count * run, s * 5 + 0.03, base + count * rise + 1.1, z0, { cover: "thin", mat: "glass" });
  }

  // Lobby: marble columns with glow strips, a reception desk, the courier's safe, a revolving door at the south.
  for (const x of [-9, -4.5, 4.5, 9]) for (const z of [44, 32]) {
    b.box("concreteA", x, ceil / 2, z, 1.2, ceil, 1.2, { collide: "concrete" });
    b.box("glowCool", x, 2.6, z + 0.62, 0.3, 4, 0.04);
  }
  // Plan item 4: a reception desk worth the lobby: a backlit onyx front in brass frames under a marble top, with
  // the receptionists' screens behind it.
  b.box("blackPaint", 0, 0.55, 24, 7, 1.1, 1.2, { collide: "metal" });
  b.box("tiles", 0, 1.15, 24.05, 7.3, 0.08, 1.4, { cover: "none" });
  for (let k = 0; k < 5; k++) {
    const x = -2.8 + k * 1.4;
    b.box("glowWarm", x, 0.58, 24.62, 1.2, 0.86, 0.02, { cover: "none" });
    b.box("brass", x - 0.7, 0.58, 24.64, 0.05, 1.0, 0.04, { cover: "none" });
  }
  b.box("brass", 3.5, 0.58, 24.64, 0.05, 1.0, 0.04, { cover: "none" });
  b.box("brass", 0, 0.08, 24.64, 7.0, 0.05, 0.04, { cover: "none" });
  for (const x of [-2, 0.5, 2.5]) {
    b.box("darkMetal", x, 1.45, 23.75, 0.6, 0.38, 0.03, { rotY: Math.PI, cover: "none" });
    b.box("glowCoolDim", x, 1.45, 23.73, 0.54, 0.32, 0.01, { cover: "none" });
  }
  b.box("glowCoolDim", 0, 1.3, 23.3, 6.2, 0.1, 0.05);
  // Over the runner hangs the lobby's sculpture: three chrome rings, nested and tilted, lit from below.
  for (const [r, rx, rz] of [[2.6, 0.3, 0], [2.0, -0.4, 0.5], [1.4, 0.9, -0.3]] as const) {
    b.shape("chrome", new THREE.TorusGeometry(r, 0.06, 6, 40), V(0, 8.2, 38), 0, undefined, 1, Math.PI / 2 + rx, rz);
  }
  b.cylinder("chrome", V(0, 10.9, 38), V(0, ceil, 38), 0.015, 4);
  for (const x of [-1.2, 1.2]) light(V(x, 0.3, 38), "#ffe0b0", 14, 10, 0, false);
  b.box("darkMetal", 9.5, 0.6, 33, 1.2, 1.2, 1.2, { collide: "metal" }); // the courier's lobby safe
  b.box("glowAmber", 9.5, 1.15, 32.38, 0.5, 0.12, 0.04);
  signs.push({ text: "VANTAGE GROUP", sub: "VISITORS REGISTER AT DESK", style: "screen", color: "#bfe9ff", w: 7, h: 1.8, center: V(0, 5.2, 21.3), normal: V(0, 0, 1), flicker: 0, intensity: 2.2 });
  b.box("glass", 0, 1.6, zS - 0.1, 6, 3.2, 0.08, { cover: "thin", mat: "glass" });
  b.box("glowRed", 0, 3.6, zS - 0.05, 1.4, 0.3, 0.05);

  // Lobby dressing: a red runner from the doors to the grand stair, brass trim and uplit columns, potted palms,
  // benches under the glass and a warm gold wash against the cool strips, so the lobby reads as money.
  b.boxMinMax("carpetRed", -2.2, 0.004, stair1 + 0.2, 2.2, 0.03, zS - 3, { uv: 2 });
  for (const s of [-1, 1]) b.boxMinMax("brass", s * 2.2 - 0.05, 0.03, stair1 + 0.2, s * 2.2 + 0.05, 0.07, zS - 3, { uv: 1 });
  for (const x of [-9, -4.5, 4.5, 9]) for (const z of [44, 32]) {
    b.box("brass", x, 0.25, z, 1.5, 0.5, 1.5, { collide: "metal" });
    b.box("brass", x, ceil - 0.4, z, 1.5, 0.3, 1.5);
    light(V(x, 0.4, z + 1.1), "#ffcf8a", 16, 7, 0, false);
  }
  for (const [x, z] of [[-12.4, 48], [12.4, 48], [-12.4, 20], [12.4, 20]] as const) {
    b.cylinder("brass", V(x, 0, z), V(x, 0.7, z), 0.55, 12);
    b.shape("leaf", new THREE.SphereGeometry(0.85, 10, 8), V(x, 1.5, z), 0, V(1, 1.3, 1));
    b.tagLast("thin", "cloth"); // foliage hides her, and rounds lose a little going through
  }
  for (const z of [40, 34]) for (const s of [-1, 1]) {
    b.box("brass", s * 6.6, 0.42, z, 1.8, 0.1, 0.7, { collide: "metal" });
    b.box("blackPaint", s * 6.6, 0.18, z, 1.6, 0.36, 0.5);
  }
  b.box("brass", 0, 3.1, 24.62, 7.4, 0.12, 0.1);
  light(V(0, 2.4, 25.4), "#ffcf8a", 22, 9, 0, false);
  light(V(0, 4, 8), "#ffcf8a", 20, 12, 0, false);

  // Offices: cubicle rows, glowing monitors and the server room behind a glass wall in the east.
  for (let r = 0; r < 4; r++) {
    for (const x of [-10.5, -8, 8]) {
      const z = -4 - r * 6;
      b.box("plasticWhite", x, H1 + 0.38, z, 2.0, 0.76, 0.9, { collide: "metal" });
      // Plan item 4: two monitors on arms, a keyboard, a desk lamp and a chair at each desk; a fabric screen.
      for (const dx of [-0.42, 0.42]) {
        b.box("darkMetal", x + dx, H1 + 1.06, z - 0.22, 0.66, 0.42, 0.03, { cover: "none" });
        b.box("glowCool", x + dx, H1 + 1.06, z - 0.2, 0.6, 0.36, 0.01, { cover: "none" });
        b.cylinder("darkMetal", V(x + dx, H1 + 0.76, z - 0.3), V(x + dx, H1 + 0.9, z - 0.3), 0.02, 4);
      }
      b.box("blackPaint", x, H1 + 0.775, z + 0.05, 0.5, 0.02, 0.16, { cover: "none" });
      b.box("blackPaint", x, H1 + 0.48, z + 0.85, 0.55, 0.08, 0.5, { cover: "none" }); // seat
      b.box("blackPaint", x, H1 + 0.85, z + 1.1, 0.5, 0.6, 0.06, { cover: "none" }); // back
      b.cylinder("chrome", V(x, H1 + 0.05, z + 0.85), V(x, H1 + 0.44, z + 0.85), 0.03, 5);
      b.box("glowWarm", x + 0.85, H1 + 1.12, z - 0.15, 0.12, 0.03, 0.12, { cover: "none" });
      b.box("paintMetal", x, H1 + 0.7, z + 0.55, 2.0, 1.4, 0.06, { collide: "metal" });
    }
  }
  b.boxMinMax("glass", 9, H1, -10, 9.06, H1 + 3.6, -26, { cover: "thin", mat: "glass" });
  for (let i = 0; i < 6; i++) {
    const z = -12 - i * 2.2;
    b.box("darkMetal", 12.8, H1 + 1.2, z, 0.9, 2.4, 1.2, { collide: "metal" });
    b.box("glowCyan", 12.33, H1 + 1.2, z, 0.02, 0.04, 0.8);
    // Plan item 4: rack fronts, not glowing slabs: a grille door, rows of blinking status lights, patch cables.
    b.box("grate", 12.33, H1 + 1.2, z, 0.02, 2.2, 1.0, { cover: "none" });
    for (let r = 0; r < 14; r++) {
      const y = H1 + 0.25 + r * 0.14;
      b.box(r % 5 === 2 ? "glowAmber" : rand() < 0.15 ? "glowRed" : "glowCyan", 12.31, y, z - 0.38 + rand() * 0.1, 0.01, 0.025, 0.04, { cover: "none" });
      b.box("glowCyan", 12.31, y, z + 0.3, 0.01, 0.02, 0.16, { cover: "none" });
    }
    b.cable("cable", V(12.3, H1 + 2.3, z - 0.3), V(12.3, H1 + 2.3, z + 0.3), 0.25, 0.012);
  }
  // A cable tray over the racks and a raised floor of perforated tiles.
  b.boxMinMax("grate", 11.6, H1 + 2.9, -26, 12.4, H1 + 2.95, -10, { cover: "none" });
  b.boxMinMax("grate", 9.06, H1 + 0.005, -26, xE, H1 + 0.03, -10, { uv: 1, cover: "none" });
  light(V(11.5, H1 + 3, -17), "#2ee6ff", 16, 9, 1);
  signs.push({ text: "SERVER ROOM", sub: "AUTHORISED KEYHOLDERS", style: "box", color: "#2ee6ff", w: 2.2, h: 0.4, center: V(8.9, H1 + 2.8, -9.4), normal: V(-1, 0, 0), flicker: 1, intensity: 3 });

  // Boardroom: a long table, chairs, the Chair's seat and a wall of glass over the city.
  // Plan item 4: a black marble slab on a chrome spine, brass-edged; leather chairs with high backs.
  b.box("blackPaint", 0, H2 + 0.75, -52, 3.4, 0.12, 13, { collide: "metal" });
  b.box("brass", 0, H2 + 0.7, -52, 3.44, 0.03, 13.04, { cover: "none" });
  b.box("chrome", 0, H2 + 0.35, -52, 1.2, 0.7, 11);
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) {
    const z = -57 + i * 2;
    b.box("blackPaint", s * 2.4, H2 + 0.25, z, 0.7, 0.5, 0.7, { collide: "metal" });
    b.box("rubber", s * 2.4, H2 + 0.52, z, 0.62, 0.1, 0.62, { cover: "none" });
    b.box("rubber", s * 2.72, H2 + 1.0, z, 0.1, 0.95, 0.6, { cover: "none" });
    b.box("glowWarm", s * 1.2, H2 + 0.82, z, 0.4, 0.005, 0.3, { cover: "none" }); // a lit tablet at each place
  }
  b.box("chrome", 0, H2 + 0.7, -58.6, 0.9, 1.4, 0.9);
  // The window wall is open to the skyline: chrome mullions and a transom, with an invisible collider so nobody walks out.
  b.collide(new THREE.Box3(V(xW, H2, zN), V(xE, H2 + 5, zN + 0.1)), "metal");
  for (let x = xW; x <= xE + 0.01; x += 4) b.box("chrome", x, H2 + 2.5, zN + 0.05, 0.14, 5, 0.14);
  b.box("chrome", 0, H2 + 4.9, zN + 0.05, xE - xW, 0.14, 0.14);
  signs.push({ text: "THE BOARD", sub: "QUARTERLY SESSION", style: "screen", color: "#ffd9a0", w: 4, h: 1.2, center: V(-13.9, H2 + 3, -50), normal: V(1, 0, 0), flicker: 0, intensity: 2.2 });

  // Colour pass: a carpet across the office floor with a brass-edged aisle, planters between the cubicles,
  // and a deep red boardroom carpet, oak wall panelling, bookcases and brass pendants, so the climb ends in luxury.
  b.boxMinMax("officeCarpet", -11.8, H1 + 0.004, -1, 8.8, H1 + 0.03, -26, { uv: 2 });
  for (const x of [-4.6, 4.6]) b.boxMinMax("brass", x - 0.04, H1 + 0.03, -1, x + 0.04, H1 + 0.06, -26, { uv: 1 });
  for (const z of [-3, -11, -19, -27]) {
    for (const x of [-12.3, 12.3]) {
      b.cylinder("brass", V(x, H1, z), V(x, H1 + 0.6, z), 0.45, 12);
      b.shape("leaf", new THREE.SphereGeometry(0.7, 10, 8), V(x, H1 + 1.3, z), 0, V(1, 1.2, 1));
      b.tagLast("thin", "cloth");
    }
  }
  b.boxMinMax("officeCarpet", -9, H2 + 0.004, -44, 9, H2 + 0.03, -62, { uv: 2 });
  b.boxMinMax("carpetRed", -4, H2 + 0.03, -45.5, 4, H2 + 0.045, -59.5, { uv: 3 }); // the rug under the table
  b.boxMinMax("brass", -9.05, H2 + 0.03, -44, -8.95, H2 + 0.07, -62, { uv: 1 });
  b.boxMinMax("brass", 8.95, H2 + 0.03, -44, 9.05, H2 + 0.07, -62, { uv: 1 });
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const z = -46 - i * 4.2;
      b.box("wood", s * 13.5, H2 + 1.6, z, 0.6, 3.2, 3.4, { collide: "metal" });
      b.box("brass", s * 13.18, H2 + 3.25, z, 0.06, 0.08, 3.4);
      b.box("glowWarm", s * 13.17, H2 + 1.6, z, 0.03, 0.05, 3.0);
    }
  }
  for (const z of [-44, -52, -60]) {
    b.cylinder("brass", V(0, H2 + 4.4, z), V(0, ceil, z), 0.04, 6);
    b.cylinder("brass", V(0, H2 + 3.9, z), V(0, H2 + 4.4, z), 0.7, 14);
    light(V(0, H2 + 3.7, z), "#ffd49a", 24, 9, 0, false);
  }

  // The city beyond the glass: a dark backdrop of towers with lit windows, far below and far across.
  b.boxMinMax("blackPaint", -90, H2 - 60, zN - 46, 90, H2 + 50, zN - 45, { uv: 1 });
  // Skyline: towers of varied height at two depths, their windows plain glow boxes so fog and the lighting
  // pass cannot swallow them.
  for (let i = 0; i < 40; i++) {
    const x = -88 + i * 4.5 + rand() * 2;
    const w = 3.5 + rand() * 3;
    const near = i % 2 === 0;
    const z = zN - (near ? 18 : 32) - rand() * 6;
    const top = H2 - 30 + rand() * (near ? 34 : 50);
    b.boxMinMax(near ? "paintMetal" : "darkMetal", x - w / 2, H2 - 60, z - 4, x + w / 2, top, z + 4, { uv: 1 });
    for (let wy = H2 - 28; wy < top - 1; wy += 3) {
      for (let wx = x - w / 2 + 0.8; wx < x + w / 2 - 0.5; wx += 1.6) {
        if (rand() > 0.7) continue;
        b.box(rand() > 0.3 ? "glowWarm" : "glowCool", wx, wy, z + 4.05, 0.7, 0.9, 0.05);
      }
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

  // Plan item 4: visitors in coats waiting in the lobby and at the desk (render/crowd.ts), not milling capsules.
  const crowds: CrowdGroup[] = [
    { x: -7, z: 30, count: 5, radius: 1.8, face: [0, 24], seed: 41 },
    { x: 6.5, z: 42, count: 3, radius: 1.2, seed: 42 },
    { x: -1.5, z: 26.4, count: 3, radius: 0, rect: [4, 0.8], face: [0, 24], seed: 43 },
  ];

  return {
    builder: b,
    markers,
    crowds,
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
      signature: "surge",
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
