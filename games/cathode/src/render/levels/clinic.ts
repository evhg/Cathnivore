// The Candor Clinic (act 2, Dr Vane): a sterile interior. A long corridor of white tile under failing
// fluorescents, a waiting room to the west, a flooded morgue stair to the east and the main theatre at the
// north end, lit by surgical lamps. The player starts at the south door (+z), the theatre is at -z.

import * as THREE from "three";
import { Builder } from "../builder";
import { FLOOD } from "../shading";
import { prng } from "../textures";
import type { Level, VLight } from "../level";

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const C = (hex: string) => new THREE.Color(hex);

/** The failing tubes' circuit: their lights and their emissive (world.ts glowFail) stutter on this one seed. */
export const FAIL_SEED = 91;

export const CLINIC = { xW: -9, xE: 9, zS: 44, zN: -52, ceil: 3.6 } as const;

export function buildClinic(quality: "phone" | "high" | "ultra"): Level {
  void quality;
  const b = new Builder();
  const rand = prng(3311);
  const lights: VLight[] = [];
  let seed = 1;
  const light = (pos: THREE.Vector3, color: string, intensity: number, range: number, flicker = 0, real = true, fixedSeed?: number) =>
    lights.push({ pos, color: C(color), intensity, range, normal: null, flicker, seed: fixedSeed ?? seed++, real });
  const { xW, xE, zS, zN, ceil } = CLINIC;
  const cx = (xW + xE) / 2;
  const cz = (zS + zN) / 2;
  const len = zS - zN;

  // Shell: tile floor, ceiling, outer walls.
  b.boxMinMax("clinicFloor", xW, -0.5, zN, xE, 0, zS, { uv: 2, skip: ["bottom"] });
  b.boxMinMax("ceilingPanel", xW, ceil, zN, xE, ceil + 0.4, zS, { uv: 2, collide: "concrete" });
  b.boxMinMax("tileWhite", xW - 0.5, -0.5, zN, xW, ceil + 0.4, zS, { uv: 2, collide: "concrete" });
  b.boxMinMax("tileWhite", xE, -0.5, zN, xE + 0.5, ceil + 0.4, zS, { uv: 2, collide: "concrete" });
  b.boxMinMax("tileWhite", xW, -0.5, zS, xE, ceil + 0.4, zS + 0.5, { uv: 2, collide: "concrete" });
  b.boxMinMax("tileWhite", xW, -0.5, zN - 0.5, xE, ceil + 0.4, zN, { uv: 2, collide: "concrete" });

  // A green tile wainscot to 1.2 m along the outer walls, proud of the white tile, capped by a steel rail.
  for (const x of [xW + 0.03, xE - 0.03]) {
    b.box("tileGreen", x, 0.6, cz, 0.06, 1.2, len - 0.2);
    b.box("chrome", x + Math.sign(-x) * 0.02, 1.22, cz, 0.06, 0.05, len - 0.2);
  }

  // Corridor dividers with door gaps: waiting room (west), wards (east). Walking north from the south door (z
  // falls), each gap [g0, g1] (g0 < g1) ends one wall segment at its south jamb g1 and the next starts at g0.
  // (Until 2026-11-01 each segment ran across its own gap, sealing every side room.) Stretches listed in
  // `glazed` get a tiled sill, wired-glass panes in chrome mullions and a tiled header instead (plan item 1).
  const glazed: Array<[number, number, number]> = [[-3.2, 10, 26], [3.2, -2, 18]];
  const seg = (x: number, z0: number, z1: number) => {
    const gl = glazed.find(([gx, a, c]) => gx === x && a >= z0 && c <= z1);
    if (!gl) {
      b.boxMinMax("tileWhite", x - 0.12, 0, z0, x + 0.12, ceil, z1, { uv: 2, collide: "concrete" });
      return;
    }
    const [, a, c] = gl;
    b.boxMinMax("tileWhite", x - 0.12, 0, z0, x + 0.12, ceil, a, { uv: 2, collide: "concrete" });
    b.boxMinMax("tileWhite", x - 0.12, 0, c, x + 0.12, ceil, z1, { uv: 2, collide: "concrete" });
    b.boxMinMax("tileGreen", x - 0.14, 0, a, x + 0.14, 1.0, c, { uv: 2, collide: "concrete" });
    b.boxMinMax("chrome", x - 0.16, 1.0, a, x + 0.16, 1.05, c);
    b.boxMinMax("clearGlass", x - 0.03, 1.05, a, x + 0.03, 2.5, c, { collide: "glass" });
    b.boxMinMax("tileWhite", x - 0.12, 2.5, a, x + 0.12, ceil, c, { uv: 2, collide: "concrete" });
    for (let z = a; z <= c + 0.01; z += (c - a) / Math.round((c - a) / 1.6)) b.box("chrome", x, 1.78, z, 0.08, 1.45, 0.06, { cover: "none" });
  };
  const wall = (x: number, gaps: Array<[number, number]>) => {
    let z: number = zS;
    for (const [g0, g1] of gaps) {
      seg(x, g1, z);
      z = g0;
    }
    seg(x, zN, z);
  };
  wall(-3.2, [[28, 32], [4, 8], [-24, -20]]);
  wall(3.2, [[20, 24], [-8, -4], [-32, -28]]);

  const signs: Level["signs"] = [];
  // Door frames at every gap in the dividers: dark jambs and a lintel, a green status strip and a bay number.
  const doors: Array<[number, number, number, string]> = [
    [-3.2, 30, 1, "#7dffc0"], [-3.2, 6, 2, "#7dffc0"], [-3.2, -22, 3, "#ffb347"],
    [3.2, 22, 4, "#7dffc0"], [3.2, -6, 5, "#7dffc0"], [3.2, -30, 6, "#2ee6ff"],
  ];
  for (const [x, zc, n, col] of doors) {
    const face = x < 0 ? 1 : -1; // faces the corridor
    for (const dz of [-2.05, 2.05]) b.box("darkMetal", x, ceil / 2, zc + dz, 0.4, ceil, 0.12, { collide: "metal" });
    b.box("darkMetal", x, 2.7, zc, 0.4, 0.14, 4.2);
    b.box("glowCoolDim", x + face * 0.2, 2.95, zc, 0.04, 0.16, 3.2);
    signs.push({ text: `BAY ${n}`, sub: n === 3 ? "STAFF ONLY" : "ADMITTANCE", style: "box", color: col, w: 1.2, h: 0.32, center: V(x + face * 0.22, 3.2, zc), normal: V(face, 0, 0), flicker: n === 2 ? 2 : 0, intensity: 2.4 });
  }

  // Reception desk, waiting-room benches, ward beds, theatre table.
  b.box("plasticWhite", -1.4, 0.55, 36, 2.6, 1.1, 0.7, { collide: "metal" });
  // Back-to-back moulded benches down the middle of the waiting room.
  for (let i = 0; i < 5; i++) {
    const z = 20 + i * 1.6;
    b.box("chrome", -6.2, 0.2, z, 0.7, 0.4, 0.08, { collide: "metal" });
    for (const dx of [-0.22, 0.22]) {
      b.box("plasticSeat", -6.2 + dx, 0.44, z, 0.4, 0.06, 1.2);
      b.box("plasticSeat", -6.2 + dx * 0.25, 0.72, z, 0.05, 0.5, 1.2);
    }
  }
  for (let i = 0; i < 4; i++) b.box("plasticWhite", 6.2, 0.4, 18 - i * 14 + (i > 1 ? 4 : 0), 1.0, 0.8, 2.0, { collide: "metal" });
  // The operating table: the old 1.0 x 1.1 x 2.2 m cover box stays as a collider; the table itself is a
  // pedestal, a steel top, a padded mattress and a head rest.
  b.collide(new THREE.Box3(V(-0.5, 0, -45.1), V(0.5, 1.1, -42.9)), "metal", "metal");
  b.box("darkMetal", 0, 0.05, -44, 0.8, 0.1, 1.2);
  b.box("chrome", 0, 0.45, -44, 0.35, 0.8, 0.5);
  b.box("chrome", 0, 0.9, -44, 0.7, 0.08, 2.0);
  b.box("rubber", 0, 0.99, -43.9, 0.62, 0.1, 1.7);
  b.box("rubber", 0, 1.0, -45.0, 0.3, 0.1, 0.3);

  // Cover columns so fights have shape.
  // Tile-clad like the walls, a green dado skirt and chrome corner guards where the gurneys bang into them.
  const column = (x: number, z: number) => {
    b.box("tileWhite", x, ceil / 2, z, 0.5, ceil, 0.5, { collide: "concrete", uv: 2 });
    b.box("tileGreen", x, 0.5, z, 0.54, 1.0, 0.54, { uv: 2 });
    for (const dx of [-0.26, 0.26]) for (const dz of [-0.26, 0.26]) b.box("chrome", x + dx, 0.75, z + dz, 0.05, 1.5, 0.05, { cover: "none" });
  };
  for (let z: number = 36; z > zN + 6; z -= 14) {
    column(-1.4, z + rand() * 3);
    column(1.4, z - 3 - rand() * 3);
  }

  // Fluorescent tubes down the ceiling, some failing; green-white surgical wash.
  for (let z: number = zS - 3, i = 0; z > zN; z -= 6, i++) {
    const failing = i % 3 === 1;
    b.box("darkMetal", 0, ceil - 0.02, z, 0.7, 0.04, 1.3);
    b.box(failing ? "glowFail" : "glowCool", 0, ceil - 0.045, z, 0.6, 0.02, 1.2);
    for (const dz of [-0.3, 0, 0.3]) b.box("ceilingPanel", 0, ceil - 0.06, z + dz, 0.6, 0.012, 0.03);
    light(V(0, ceil - 0.4, z), failing ? "#b8ffd8" : "#d6fff0", failing ? 14 : 22, 11, failing ? 2 : 0, true, failing ? FAIL_SEED : undefined);
  }
  // Wall washers: soft baked lights near each side wall so the white tile reads white, not grey.
  for (let z: number = zS - 6; z > zN + 4; z -= 9) {
    light(V(xW + 2.2, 2.4, z), "#dfffee", 9, 8, 0, false);
    light(V(xE - 2.2, 2.4, z - 4), "#dfffee", 9, 8, 0, false);
  }
  // Waiting room and ward lamps, dimmer and greener.
  for (const z of [20, 6, -22]) light(V(-6, ceil - 0.4, z), "#9fe8c0", 10, 7, 1);
  for (const z of [18, -6, -30]) light(V(6, ceil - 0.4, z), "#9fe8c0", 10, 7, 0);
  // Surgical lamps over the theatre table.
  // Twin lamp heads on a ceiling boom: a dark shell with a bright lens ring underneath.
  b.box("chrome", 0, ceil - 0.25, -44, 0.08, 0.5, 0.08);
  b.box("chrome", 0, ceil - 0.5, -44, 1.6, 0.06, 0.06);
  for (const dx of [-0.75, 0.75]) {
    b.box("paintMetal", dx, ceil - 0.72, -44, 0.6, 0.18, 0.6);
    b.box("glowWhite", dx, ceil - 0.815, -44, 0.48, 0.01, 0.48);
  }
  light(V(0, ceil - 0.9, -44), "#f4fff8", 48, 10, 0);
  // The flooded morgue stair glows blue-green at the east end.
  b.box("glowCyan", xE - 0.1, 1.2, -16, 0.06, 1.4, 3);
  light(V(xE - 1, 1.2, -16), "#2ee6ff", 14, 8, 1, false);
  // A red exit sign at the extract door.
  b.box("glowRed", 0, 3.0, zS - 0.05, 1.2, 0.3, 0.05);
  light(V(0, 2.8, zS - 1), "#ff2a2a", 8, 6, 0, false);

  // Waiting room (west): rows of chairs facing a debt-tag screen, a drinks cooler, a dead plant.
  for (let row = 0; row < 3; row++) {
    const z0 = 16 - row * 7;
    b.box("chrome", -7.45, 0.3, z0 - 1.35, 0.08, 0.06, 3.4, { collide: "metal" });
    for (const dz of [0.1, -2.8]) b.box("chrome", -7.45, 0.15, z0 + dz, 0.5, 0.3, 0.06);
    for (let i = 0; i < 4; i++) {
      const z = z0 - i * 0.9;
      b.box("plasticSeat", -7.4, 0.42, z, 0.5, 0.06, 0.52, { collide: "metal" });
      b.box("plasticSeat", -7.68, 0.72, z, 0.06, 0.55, 0.52);
      b.box("chrome", -7.4, 0.36, z - 0.29, 0.44, 0.04, 0.04);
    }
  }
  // A dark bezel behind the screen (a bright tube box here blew the screen's text out to white).
  b.box("darkMetal", xW + 0.02, 2.1, 18, 0.04, 1.0, 2.5);
  signs.push({ text: "DEBT BEFORE DIGNITY", sub: "NOW SERVING 0412", style: "screen", color: "#7dffc0", w: 2.4, h: 0.9, center: V(xW + 0.06, 2.1, 18), normal: V(1, 0, 0), flicker: 2, intensity: 2.5 });
  b.box("chrome", -8.4, 0.5, 30, 0.5, 1.0, 0.5, { collide: "metal" });

  // Flooded morgue (east, behind the far ward): steel drawer wall, gurneys, a shin-deep slick of water.
  b.boxMinMax("steelDark", xE - 0.9, 0, -23, xE - 0.1, 2.4, -9, { collide: "metal" });
  // Drawer fronts: brushed steel doors, a lever handle and a paper name card each.
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 6; c++) {
      const y = 0.45 + r * 0.7;
      const z = -22 + c * 2.2;
      b.box("steel", xE - 1.0, y, z, 0.06, 0.55, 1.9);
      b.box("darkMetal", xE - 1.05, y + 0.08, z + 0.6, 0.06, 0.06, 0.4);
      b.box("plasticWhite", xE - 1.04, y + 0.08, z - 0.5, 0.02, 0.12, 0.2);
    }
  }
  for (const z of [-14, -19]) {
    b.box("chrome", 6.4, 0.45, z, 0.8, 0.1, 2.0, { collide: "metal" });
    b.box("darkMetal", 6.4, 0.2, z, 0.5, 0.4, 1.6);
  }
  b.box("water", 6.5, 0.1, -16, 4.6, 0.02, 12);
  signs.push({ text: "MORGUE", sub: "LEVEL B", style: "box", color: "#2ee6ff", w: 1.6, h: 0.4, center: V(xE - 0.08, 2.7, -16), normal: V(-1, 0, 0), flicker: 1, intensity: 3 });

  // Main theatre: glass gallery wall, instrument trolleys, IV stands, vital-sign monitors.
  b.boxMinMax("clearGlass", -3.1, 0.9, -52, -3.0, 3.0, -38, { cover: "thin", mat: "glass" });
  b.boxMinMax("clearGlass", 3.0, 0.9, -52, 3.1, 3.0, -38, { cover: "thin", mat: "glass" });
  for (const x of [-3.05, 3.05]) {
    b.boxMinMax("chrome", x - 0.07, 3.0, -52, x + 0.07, 3.08, -38);
    b.boxMinMax("chrome", x - 0.07, 0.84, -52, x + 0.07, 0.9, -38);
    for (let z = -50; z <= -40; z += 2) b.box("chrome", x, 1.95, z, 0.12, 2.1, 0.06, { cover: "none" });
  }
  for (const x of [-1.6, 1.6]) {
    b.box("chrome", x, 0.45, -44, 0.5, 0.9, 0.8, { collide: "metal" });
    b.box("chrome", x * 1.5, 0.9, -46, 0.05, 1.8, 0.05, { cover: "thin", mat: "metal" });
  }
  b.box("glowCoolDim", 0, 1.6, zN + 0.05, 1.4, 0.7, 0.05);
  signs.push({ text: "VITALS 61 BPM", sub: "SEDATED", style: "screen", color: "#7dffc0", w: 1.4, h: 0.7, center: V(0, 1.6, zN + 0.09), normal: V(0, 0, 1), flicker: 1, intensity: 2.5 });
  light(V(0, 1.6, zN + 1), "#7dffc0", 8, 6, 1, false);

  // Set dressing: privacy curtains in the wards, wheelchairs in the waiting room, shrouded gurneys in the morgue,
  // a hanging bag of fluid at every bed, and a hazard stripe down the theatre approach.
  for (let i = 0; i < 4; i++) {
    const z = 18 - i * 14 + (i > 1 ? 4 : 0);
    b.box("plasticWhite", 5.1, 1.5, z, 0.04, 2.0, 2.6, { cover: "thin", mat: "cloth" });
    b.box("glowCoolDim", 6.2, 1.7, z + 0.6, 0.08, 0.3, 0.08);
  }
  for (const z of [10, 12.5]) {
    b.box("darkMetal", -6.9, 0.45, z, 0.6, 0.12, 0.6, { collide: "metal" });
    b.box("darkMetal", -6.9, 0.85, z - 0.28, 0.6, 0.7, 0.06);
    for (const dz of [-0.3, 0.3]) b.box("chrome", -6.9, 0.2, z + dz, 0.08, 0.4, 0.4);
  }
  // The morgue's dead lie under sheets (crowd.ts addShrouds), toe tags lit; one more waits on a corridor gurney.
  const bodies: NonNullable<Level["bodies"]> = [
    { x: 6.4, y: 0.5, z: -14, yaw: Math.PI / 2 },
    { x: 6.4, y: 0.5, z: -19, yaw: -Math.PI / 2 },
    { x: 2.55, y: 0.91, z: -17, yaw: Math.PI / 2 },
  ];
  b.box("glowCoolDim", 0, 0.01, -41, 0.08, 0.02, 12);
  for (let z = -33; z > -41; z -= 2) b.box("glowRed", 1.2, 0.01, z, 0.5, 0.02, 0.5);

  // Corridor dressing (plan item 1): parked gurneys and IV stands along the divider walls, steel cabinets in the
  // wards, and wayfinding signs hung from the ceiling so the floor plan reads at a glance.
  const gurney = (x: number, z: number, sheet: boolean) => {
    b.box("chrome", x, 0.78, z, 0.7, 0.05, 1.95, { cover: "thin", mat: "metal" });
    b.box(sheet ? "plasticWhite" : "rubber", x, 0.86, z, 0.66, 0.1, 1.85);
    b.box("chrome", x, 0.4, z, 0.08, 0.05, 1.7);
    for (const dz of [-0.85, 0.85]) {
      b.box("chrome", x, 0.4, z + dz, 0.6, 0.76, 0.04);
      for (const dx of [-0.28, 0.28]) b.box("rubber", x + dx, 0.06, z + dz, 0.05, 0.12, 0.12);
    }
  };
  const ivStand = (x: number, z: number) => {
    b.box("chrome", x, 0.95, z, 0.03, 1.9, 0.03);
    b.box("chrome", x, 1.85, z, 0.4, 0.02, 0.02);
    b.box("chrome", x, 0.03, z, 0.5, 0.04, 0.06);
    b.box("chrome", x, 0.03, z, 0.06, 0.04, 0.5);
    b.box("glass", x + 0.15, 1.65, z, 0.1, 0.25, 0.04);
  };
  gurney(2.55, 27, true);
  gurney(-2.55, -12, false);
  gurney(2.55, -17, true);
  ivStand(2.6, 25.4);
  ivStand(-2.6, -10.2);
  for (let i = 0; i < 4; i++) ivStand(7.6, 19 - i * 14 + (i > 1 ? 4 : 0));
  // Steel instrument cabinets with glass doors on the ward's outer wall.
  for (const z of [11, 3, -25]) {
    b.box("steel", xE - 0.3, 0.95, z, 0.5, 1.9, 1.0, { collide: "metal" });
    b.box("glass", xE - 0.56, 1.35, z, 0.02, 0.9, 0.86);
    b.box("glowCoolDim", xE - 0.52, 1.35, z, 0.01, 0.82, 0.78);
  }
  const hang = (z: number, text: string, sub: string, color: string) => {
    for (const dx of [-0.6, 0.6]) b.box("chrome", dx, ceil - 0.2, z, 0.02, 0.4, 0.02);
    b.box("paintTeal", 0, ceil - 0.55, z, 1.6, 0.36, 0.06);
    for (const nz of [1, -1]) signs.push({ text, sub, style: "box", color, w: 1.5, h: 0.32, center: V(0, ceil - 0.55, z + nz * 0.035), normal: V(0, 0, nz), flicker: 0, intensity: 1.6 });
  };
  hang(33, "WAITING · WARDS", "THEATRE AHEAD", "#d6fff0");
  hang(-1, "MORGUE · LEVEL B", "THEATRE AHEAD", "#d6fff0");
  hang(-27, "THEATRE · STERILE", "STAFF ONLY", "#ffb347");

  // The waiting room's debtors (plan item 1): seated in the rows and the benches, about two in three seats taken.
  const seats: NonNullable<Level["seats"]> = [];
  const take = () => rand() < 0.68;
  for (let row = 0; row < 3; row++) for (let i = 0; i < 4; i++) if (take()) seats.push({ x: -7.36, z: 16 - row * 7 - i * 0.9, yaw: 0 });
  for (let i = 0; i < 5; i++) {
    for (const sd of [-1, 1]) for (const dz of [-0.35, 0.35]) if (take()) seats.push({ x: -6.2 + sd * 0.24, z: 20 + i * 1.6 + dz, yaw: sd > 0 ? 0 : Math.PI });
  }

  const gh = () => 0;
  const markers: Level["markers"] = {
    player: [V(0, 0, zS - 3)],
    perch: [V(-6.2, 0.5, 8), V(0, 0, zN + 6)],
    extract: [V(0, 0, zS - 1.5)],
    // Vane works at the table under the surgical lamps; guards flank her, reinforcements come through the doors.
    // The night register sits in a cabinet in the east ward, two guards on it.
    "lead:register": [V(7.2, 0, -14)],
    "lead:guard": [V(5, 0, -12), V(5, 0, -16), V(6, 0, -10), V(6, 0, -18)],
    "boss:vane": [V(0, 0, -47), V(1.5, 0, -46)],
    "boss:guard": [V(-4, 0, -42), V(-4, 0, -47), V(4, 0, -42), V(4, 0, -47)],
    "boss:reinforce": [V(-2, 0, -30), V(-2, 0, -36), V(2, 0, -30), V(2, 0, -36)],
    "patrol:hall": [V(0, 0, 30), V(0, 0, 10), V(0, 0, -10), V(0, 0, -30), V(0, 0, -10), V(0, 0, 10)],
    "patrol:wards": [V(6, 0, 18), V(6, 0, 2), V(6, 0, -18), V(6, 0, 2)],
    "patrol:orderly-ward": [V(6, 0, 10), V(6, 0, -10), V(6, 0, -30), V(6, 0, -10)],
    "patrol:nurse-ward": [V(6, 0, -14), V(6, 0, -24)],
    "patrol:nurse-hall": [V(-1, 0, -20), V(1, 0, -24)],
    "patrol:orderly-theatre": [V(-2, 0, -36), V(2, 0, -36)],
    "patrol:waiting": [V(-6, 0, 24), V(-6, 0, 8), V(-6, 0, -22), V(-6, 0, 8)],
  };

  const key = { pos: V(0, ceil - 0.3, -44), target: V(0, 0, -44), color: C("#f4fff8") };
  void FLOOD;
  return {
    builder: b,
    markers,
    seats,
    bodies,
    lights,
    signs,
    windows: [],
    cones: [],
    posters: [],
    vending: [],
    interiors: [],
    vents: [V(cx, ceil - 0.1, cz)],
    drips: [V(-6, ceil, 6), V(6, ceil, -14), V(0, ceil, 26)],
    bulbs: [],
    // An interior: no rain anywhere.
    shelters: [new THREE.Box3(V(xW - 20, -5, zN - 20), V(xE + 20, 30, zS + 20))],
    key,
    groundHeight: gh,
    theme: {
      name: "The Candor Clinic",
      signature: "brownout",
      loading: "Failing fluorescents, cold tile…",
      fog: [0.0035, 0.0075, 0.0065],
      fogDensity: 0.012,
      volMin: V(xW - 2, -1, zN - 4),
      volMax: V(xE + 2, ceil + 2, zS + 4),
      probe: V(0, 1.6, 10),
      outdoor: false,
      // Surgical green in the shadows and mids; the tubes' whites stay white.
      cast: [0.84, 1.04, 0.93],
      bounds: { xMin: xW + 0.4, xMax: xE - 0.4, zMin: zN + 0.6, zMax: zS - 0.6 },
      len,
    },
  };
}
