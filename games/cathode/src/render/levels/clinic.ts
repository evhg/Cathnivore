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

export const CLINIC = { xW: -9, xE: 9, zS: 44, zN: -52, ceil: 3.6 } as const;

export function buildClinic(quality: "phone" | "high" | "ultra"): Level {
  void quality;
  const b = new Builder();
  const rand = prng(3311);
  const lights: VLight[] = [];
  let seed = 1;
  const light = (pos: THREE.Vector3, color: string, intensity: number, range: number, flicker = 0, real = true) =>
    lights.push({ pos, color: C(color), intensity, range, normal: null, flicker, seed: seed++, real });
  const { xW, xE, zS, zN, ceil } = CLINIC;
  const cx = (xW + xE) / 2;
  const cz = (zS + zN) / 2;
  const len = zS - zN;

  // Shell: tile floor, ceiling, outer walls.
  b.boxMinMax("tiles", xW, -0.5, zN, xE, 0, zS, { uv: 2, skip: ["bottom"] });
  b.boxMinMax("concreteB", xW, ceil, zN, xE, ceil + 0.4, zS, { uv: 2, collide: "concrete" });
  b.boxMinMax("plasterGreen", xW - 0.5, -0.5, zN, xW, ceil + 0.4, zS, { uv: 2, collide: "concrete" });
  b.boxMinMax("plasterGreen", xE, -0.5, zN, xE + 0.5, ceil + 0.4, zS, { uv: 2, collide: "concrete" });
  b.boxMinMax("plasterGreen", xW, -0.5, zS, xE, ceil + 0.4, zS + 0.5, { uv: 2, collide: "concrete" });
  b.boxMinMax("plasterGreen", xW, -0.5, zN - 0.5, xE, ceil + 0.4, zN, { uv: 2, collide: "concrete" });

  // Corridor dividers with door gaps: waiting room (west), wards (east).
  const wall = (x: number, gaps: Array<[number, number]>) => {
    let z: number = zS;
    for (const [g0, g1] of gaps) {
      b.boxMinMax("tiles", x - 0.12, 0, g0, x + 0.12, ceil, z, { uv: 2, collide: "concrete" });
      z = g1;
    }
    b.boxMinMax("tiles", x - 0.12, 0, zN, x + 0.12, ceil, z, { uv: 2, collide: "concrete" });
  };
  wall(-3.2, [[28, 32], [4, 8], [-24, -20]]);
  wall(3.2, [[20, 24], [-8, -4], [-32, -28]]);

  // Reception desk, waiting-room benches, ward beds, theatre table.
  b.box("plasticWhite", -1.4, 0.55, 36, 2.6, 1.1, 0.7, { collide: "metal" });
  for (let i = 0; i < 5; i++) b.box("paintMetal", -6.2, 0.25, 20 + i * 1.6, 0.8, 0.5, 1.2, { collide: "metal" });
  for (let i = 0; i < 4; i++) b.box("plasticWhite", 6.2, 0.4, 18 - i * 14 + (i > 1 ? 4 : 0), 1.0, 0.8, 2.0, { collide: "metal" });
  b.box("chrome", 0, 0.55, -44, 1.0, 1.1, 2.2, { collide: "metal" });
  b.box("darkMetal", 0, 0.1, -44, 0.6, 0.2, 1.6);

  // Cover columns so fights have shape.
  for (let z: number = 36; z > zN + 6; z -= 14) {
    b.box("concreteA", -1.4, ceil / 2, z + rand() * 3, 0.5, ceil, 0.5, { collide: "concrete" });
    b.box("concreteA", 1.4, ceil / 2, z - 3 - rand() * 3, 0.5, ceil, 0.5, { collide: "concrete" });
  }

  // Fluorescent tubes down the ceiling, some failing; green-white surgical wash.
  for (let z: number = zS - 3, i = 0; z > zN; z -= 6, i++) {
    b.box("glowCool", 0, ceil - 0.05, z, 0.25, 0.05, 2.2);
    const failing = i % 3 === 1;
    light(V(0, ceil - 0.4, z), failing ? "#b8ffd8" : "#d6fff0", failing ? 14 : 22, 11, failing ? 2 : 0);
  }
  // Waiting room and ward lamps, dimmer and greener.
  for (const z of [20, 6, -22]) light(V(-6, ceil - 0.4, z), "#9fe8c0", 10, 7, 1);
  for (const z of [18, -6, -30]) light(V(6, ceil - 0.4, z), "#9fe8c0", 10, 7, 0);
  // Surgical lamps over the theatre table.
  b.box("chrome", 0, ceil - 0.4, -44, 1.6, 0.12, 1.6);
  light(V(0, ceil - 0.6, -44), "#f4fff8", 80, 12, 0);
  // The flooded morgue stair glows blue-green at the east end.
  b.box("glowCyan", xE - 0.1, 1.2, -16, 0.06, 1.4, 3);
  light(V(xE - 1, 1.2, -16), "#2ee6ff", 14, 8, 1, false);
  // A red exit sign at the extract door.
  b.box("glowRed", 0, 3.0, zS - 0.05, 1.2, 0.3, 0.05);
  light(V(0, 2.8, zS - 1), "#ff2a2a", 8, 6, 0, false);

  const gh = () => 0;
  const markers: Level["markers"] = {
    player: [V(0, 0, zS - 3)],
    perch: [V(-6.2, 0.5, 8), V(0, 0, zN + 6)],
    extract: [V(0, 0, zS - 1.5)],
    "patrol:hall": [V(0, 0, 30), V(0, 0, 10), V(0, 0, -10), V(0, 0, -30), V(0, 0, -10), V(0, 0, 10)],
    "patrol:wards": [V(6, 0, 18), V(6, 0, 2), V(6, 0, -18), V(6, 0, 2)],
    "patrol:waiting": [V(-6, 0, 24), V(-6, 0, 8), V(-6, 0, -22), V(-6, 0, 8)],
  };

  const key = { pos: V(0, ceil - 0.3, -44), target: V(0, 0, -44), color: C("#f4fff8") };
  void FLOOD;
  return {
    builder: b,
    markers,
    lights,
    signs: [],
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
      loading: "Failing fluorescents, cold tile…",
      fog: [0.0035, 0.0075, 0.0065],
      fogDensity: 0.012,
      volMin: V(xW - 2, -1, zN - 4),
      volMax: V(xE + 2, ceil + 2, zS + 4),
      probe: V(0, 1.6, 10),
      outdoor: false,
      bounds: { xMin: xW + 0.4, xMax: xE - 0.4, zMin: zN + 0.6, zMax: zS - 0.6 },
      len,
    },
  };
}
