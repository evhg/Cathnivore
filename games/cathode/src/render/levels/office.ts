// Plan item 16: Cath's office, the hub between cases. One rented room over Tomas's egg stall on the Drowned Market:
// wet neon through a long window on the street side, a cork wall for the case board, a gun bench under a lamp, a
// wardrobe with a long mirror, the desk with the phone Bea calls on, and the stair door down to the water taxi.
// No patrols, no rain inside. Each station is a marker (`station:<id>`) the hub walks her to.

import * as THREE from "three";
import { Builder } from "../builder";
import type { Level, SignDef, VLight, WindowDef } from "../level";

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const C = (hex: string) => new THREE.Color(hex);

/** Room extents (metres): x west to east, z north (the cork wall) to south (the stair door). */
export const OFFICE = { xW: -5, xE: 5, zN: -4, zS: 4, ceil: 3 } as const;

export type StationId = "board" | "bench" | "wardrobe" | "phone" | "door";

/** Where she stands to use each station, and what she faces (yaw 0 looks down -z). */
export const STATIONS: Record<StationId, { x: number; z: number; label: string }> = {
  board: { x: 0, z: -2.6, label: "Case board" },
  bench: { x: 3.4, z: -0.6, label: "Gun bench" },
  wardrobe: { x: -3.4, z: -1.6, label: "Wardrobe" },
  phone: { x: -2.6, z: 1.6, label: "Bea's line" },
  door: { x: 3.2, z: 2.9, label: "Water taxi" },
};

export function officeGround(): number {
  return 0;
}

export function buildOffice(quality: "phone" | "high" | "ultra"): Level {
  void quality;
  const b = new Builder();
  const lights: VLight[] = [];
  const signs: SignDef[] = [];
  const windows: WindowDef[] = [];
  let seed = 1;
  const light = (pos: THREE.Vector3, color: string, intensity: number, range: number, flicker = 0, real = true) =>
    lights.push({ pos, color: C(color), intensity, range, normal: null, flicker, seed: seed++, real });
  const { xW, xE, zN, zS, ceil } = OFFICE;
  const t = 0.25;

  // Shell: worn boards, plaster walls, a beamed ceiling. The east wall carries the long street window.
  b.boxMinMax("wood", xW, -0.3, zN, xE, 0, zS, { uv: 2, skip: ["bottom"], collide: "wood" });
  b.boxMinMax("concreteA", xW - t, -0.3, zN - t, xE + t, ceil + 0.3, zN, { uv: 2, collide: "concrete" });
  b.boxMinMax("concreteA", xW - t, -0.3, zS, xE + t, ceil + 0.3, zS + t, { uv: 2, collide: "concrete" });
  b.boxMinMax("concreteA", xW - t, -0.3, zN, xW, ceil + 0.3, zS, { uv: 2, collide: "concrete" });
  // East wall: sill and lintel round a window from z -3 to 1.2 (the street side).
  b.boxMinMax("concreteA", xE, -0.3, zN, xE + t, 0.9, zS, { uv: 2, collide: "concrete" });
  b.boxMinMax("concreteA", xE, 2.4, zN, xE + t, ceil + 0.3, zS, { uv: 2, collide: "concrete" });
  b.boxMinMax("concreteA", xE, 0.9, 1.2, xE + t, 2.4, zS, { uv: 2, collide: "concrete" });
  b.boxMinMax("concreteA", xE, 0.9, zN, xE + t, 2.4, -3, { uv: 2, collide: "concrete" });
  b.boxMinMax("clearGlass", xE + 0.08, 0.9, -3, xE + 0.12, 2.4, 1.2, { collide: "glass" });
  for (const z of [-1.6, -0.2]) b.box("blackPaint", xE + 0.1, 1.65, z, 0.06, 1.5, 0.05, { cover: "none" });
  b.box("blackPaint", xE + 0.1, 1.65, -0.9, 0.06, 0.05, 4.2, { cover: "none" });
  b.boxMinMax("ceilingPanel", xW, ceil, zN, xE, ceil + 0.3, zS, { uv: 2, collide: "concrete" });
  for (let x = xW + 1.2; x < xE; x += 2.2) b.box("wood", x, ceil - 0.12, 0, 0.18, 0.24, zS - zN, { cover: "none" });
  // Skirting along the three solid walls.
  b.box("wood", 0, 0.06, zN + 0.03, xE - xW, 0.12, 0.04, { cover: "none" });
  b.box("wood", xW + 0.03, 0.06, 0, 0.04, 0.12, zS - zN, { cover: "none" });

  // Out the window: the market across the street, neon and lit windows (drawn by the world's sign/window passes).
  windows.push({ pos: V(xE + 9, 3.5, -1), normal: V(-1, 0, 0), w: 7, h: 6, tile: 4, lit: 0.8 });
  signs.push({ text: "EGGS", sub: "T. REED", style: "tube", color: "#ff8f2e", w: 1.6, h: 0.6, center: V(xE + 1.4, 0.6, -0.8), normal: V(-1, 0, 0), flicker: 0.06, intensity: 2.2 });
  signs.push({ text: "NOODLES", style: "tube", color: "#ff2e88", w: 2.4, h: 0.7, center: V(xE + 8.5, 3.2, -2.4), normal: V(-1, 0, 0), flicker: 0.12, intensity: 2.6 });
  light(V(xE + 1.5, 1.4, -0.9), "#ff2e88", 1.6, 7, 0.1);
  light(V(xE + 2, 2.2, 0.4), "#2ee6ff", 1.0, 6, 0.04);

  // The cork wall (north): a framed cork board with pinned cards and string.
  b.box("wood", 0, 1.6, zN + 0.05, 3.4, 1.7, 0.08, { cover: "none" });
  b.box("styro", 0, 1.6, zN + 0.1, 3.2, 1.5, 0.04, { cover: "none" });
  const cards: [number, number, string][] = [[-1.2, 2.0, "plasticWhite"], [-0.4, 1.9, "plasticWhite"], [0.5, 2.05, "plasticWhite"], [1.2, 1.8, "plasticWhite"], [-0.9, 1.25, "plasticWhite"], [0.2, 1.3, "plasticWhite"], [1.0, 1.15, "plasticWhite"]];
  for (const [x, y, m] of cards) b.box(m, x, y, zN + 0.13, 0.34, 0.4, 0.01, { cover: "none" });
  b.cable("glowRed", V(-1.2, 2.15, zN + 0.14), V(0.5, 2.2, zN + 0.14), 0.05, 0.006);
  b.cable("glowRed", V(0.5, 2.2, zN + 0.14), V(1.0, 1.3, zN + 0.14), 0.05, 0.006);
  b.cable("glowRed", V(-0.4, 2.05, zN + 0.14), V(0.2, 1.45, zN + 0.14), 0.05, 0.006);
  light(V(0, 2.7, zN + 0.8), "#ffd9a0", 1.4, 4.5);
  b.box("brass", 0, 2.75, zN + 0.3, 0.6, 0.06, 0.12, { cover: "none" });

  // The gun bench (east, under the window's north end): a steel-topped bench, a vice, a pegboard of tools.
  b.boxMinMax("darkMetal", xE - 0.75, 0, -1.9, xE - 0.05, 0.86, 0.6, { collide: "metal" });
  b.boxMinMax("steel", xE - 0.8, 0.86, -1.95, xE, 0.92, 0.65, { collide: "metal" });
  b.box("paintRed", xE - 0.45, 1.0, -1.4, 0.18, 0.16, 0.12, { cover: "none" });
  b.box("glowWarm", xE - 0.4, 1.6, 0.3, 0.2, 0.05, 0.2, { cover: "none" });
  light(V(xE - 0.6, 1.5, -0.6), "#ffe6c0", 1.6, 3.5);

  // The wardrobe (west): a tall walnut wardrobe and a standing mirror beside it.
  b.boxMinMax("wood", xW + 0.05, 0, -3.6, xW + 0.7, 2.2, -2.4, { collide: "wood" });
  b.box("brass", xW + 0.72, 1.1, -3.0, 0.03, 0.2, 0.03, { cover: "none" });
  b.box("wood", xW + 0.2, 1.0, -1.7, 0.08, 1.9, 0.75, { cover: "none" });
  b.box("chrome", xW + 0.25, 1.0, -1.7, 0.02, 1.75, 0.62, { cover: "none" });
  light(V(xW + 1.2, 2.4, -2.2), "#ffd0a8", 0.9, 3.5);

  // The desk (west, south of the wardrobe): desk, chair, a green-shaded lamp and the phone.
  b.boxMinMax("wood", xW + 0.3, 0.72, 1.0, xW + 1.3, 0.78, 2.8, { collide: "wood" });
  for (const [x, z] of [[xW + 0.35, 1.05], [xW + 1.25, 1.05], [xW + 0.35, 2.75], [xW + 1.25, 2.75]] as const) b.box("wood", x, 0.36, z, 0.06, 0.72, 0.06, { cover: "none" });
  b.box("tileGreen", xW + 0.7, 1.08, 1.4, 0.3, 0.12, 0.3, { cover: "none" });
  b.box("glowWarm", xW + 0.7, 1.0, 1.4, 0.2, 0.02, 0.2, { cover: "none" });
  b.box("blackPaint", xW + 0.8, 0.82, 2.2, 0.22, 0.08, 0.16, { cover: "none" });
  b.boxMinMax("wood", xW + 1.5, 0, 1.7, xW + 1.95, 0.48, 2.15, { collide: "wood" });
  light(V(xW + 0.8, 1.2, 1.5), "#d9ffb0", 1.1, 3.2);

  // The stair door (south-east) down to the water taxi: a panelled door in a frame, a lit EXIT over it.
  b.box("wood", 3.2, 1.05, zS - 0.05, 1.0, 2.1, 0.06, { cover: "none" });
  b.box("blackPaint", 3.2, 2.15, zS - 0.04, 1.2, 0.1, 0.1, { cover: "none" });
  b.box("brass", 3.55, 1.05, zS - 0.1, 0.06, 0.06, 0.06, { cover: "none" });
  signs.push({ text: "TAXI", sub: "STAIRS", style: "box", color: "#47ff8f", w: 0.6, h: 0.22, center: V(3.2, 2.45, zS - 0.06), normal: V(0, 0, -1), flicker: 0, intensity: 1.6 });
  light(V(3.2, 2.5, zS - 0.5), "#47ff8f", 0.6, 3);

  // A rug and a battered armchair in the middle, so the room reads as lived in.
  b.box("carpetRed", -0.4, 0.01, 0.4, 3.0, 0.02, 2.2, { cover: "none" });
  b.boxMinMax("rubber", -1.2, 0, 0.8, -0.3, 0.45, 1.7, { collide: "wood" });
  b.box("rubber", -0.75, 0.75, 1.65, 0.9, 0.6, 0.15, { cover: "none" });

  const markers: Record<string, THREE.Vector3[]> = { player: [V(0, 0, 2.6)] };
  for (const [id, s] of Object.entries(STATIONS)) markers[`station:${id}`] = [V(s.x, 0, s.z)];

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
    vents: [],
    drips: [],
    bulbs: [V(0, ceil - 0.3, 0.6)],
    shelters: [new THREE.Box3(V(xW - 1, -5, zN - 1), V(xE + 0.2, 10, zS + 1))],
    key: { pos: V(xE + 3, 2.4, -0.5), target: V(-2, 0, 0), color: C("#ff6fb0") },
    groundHeight: officeGround,
    theme: {
      name: "Cath's office",
      loading: "Up the stairs over the egg stall…",
      fog: [0.004, 0.003, 0.005],
      fogDensity: 0.01,
      volMin: V(xW - 1, -1, zN - 1),
      volMax: V(xE + 12, ceil + 6, zS + 1),
      probe: V(0, 1.6, 0),
      outdoor: false,
      bounds: { xMin: xW + 0.35, xMax: xE - 0.35, zMin: zN + 0.35, zMax: zS - 0.35 },
      len: zS - zN,
      cast: [1.05, 0.96, 1.02],
    },
  };
}
