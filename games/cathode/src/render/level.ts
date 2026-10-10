// The Drowned Market: act 1's hub street in Hollowell Proper. A canal-side fish market under a concrete
// flyover, at night, in the rain. Authored in code (deterministic), in metres:
//
//   x: west facades at -10 · west pavement -10..-6.5 · road -6.5..3.5 · market quay 3.5..9 · canal 9..16
//      · east facades rising out of the canal at 16.
//   z: the player starts at the north end (+57) looking south (-z); the flyover crosses at -1..13; the
//      street floods between -10 and -34; the extract (water taxi) is at the south end (-62).
//
// The builder (builder.ts) merges everything static per material; this file only says what goes where,
// plus the authored data the rest of the renderer needs: lights, signs, windows, vents, drips, cones.

import * as THREE from "three";
import { Builder, carBodyGeometry, jerseyGeometry } from "./builder";
import { FLOOD, floodT } from "./shading";
import { prng, WIN_COLS, WIN_ROWS } from "./textures";

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export const L = {
  westFacade: -10,
  roadW: FLOOD.roadWest,
  roadE: 3.5,
  quayEdge: FLOOD.quayEdge,
  canalE: FLOOD.canalEast,
  zNorth: 64,
  zSouth: -68,
  kerb: 0.15,
  /** Flyover deck footprint and underside height. */
  fly: { z0: -1, z1: 13, under: 9, top: 10.4 },
  groundFloor: 4.4,
  storey: 3.3,
  alleys: [
    { z0: 21, z1: 25 },
    { z0: -45, z1: -41 },
  ],
} as const;

/** A light the district bakes into its light volume; the nearest ones also drive the real-light pool. */
export interface VLight {
  pos: THREE.Vector3;
  /** Linear RGB. */
  color: THREE.Color;
  intensity: number;
  range: number;
  /** Hemisphere the light faces (signs on walls); null = all round. */
  normal: THREE.Vector3 | null;
  /** 0 steady, 1 buzz, 2 failing fluorescent, 3 hazard blink. */
  flicker: number;
  seed: number;
  /** Whether it may be promoted to a real three.js light near the camera. */
  real: boolean;
}

export type SignStyle = "tube" | "box" | "blade" | "bladeTube" | "screen";

export interface SignDef {
  text: string;
  sub?: string;
  style: SignStyle;
  color: string;
  w: number;
  h: number;
  center: THREE.Vector3;
  normal: THREE.Vector3;
  flicker: number;
  /** HDR multiplier. */
  intensity: number;
  cjk?: boolean;
  /** Part of the sign (0..1 along its width) whose letters fail and stutter. */
  broken?: [number, number];
  /** Signs sharing an atlas cell (double-sided blades). */
  key?: string;
}

export interface WindowDef {
  pos: THREE.Vector3;
  normal: THREE.Vector3;
  w: number;
  h: number;
  tile: number;
  /** Emissive strength (0 for dark windows). */
  lit: number;
}

export interface ConeDef {
  top: THREE.Vector3;
  /** Direction the cone points (default straight down). */
  dir?: THREE.Vector3;
  length: number;
  radius: number;
  color: THREE.Color;
  strength: number;
}

export interface PosterDef {
  pos: THREE.Vector3;
  normal: THREE.Vector3;
  w: number;
  h: number;
  idx: number;
}

export interface VendDef {
  pos: THREE.Vector3;
  normal: THREE.Vector3;
  title: string;
  hue: number;
}

export interface Level {
  builder: Builder;
  markers: Record<string, THREE.Vector3[]>;
  lights: VLight[];
  signs: SignDef[];
  windows: WindowDef[];
  cones: ConeDef[];
  posters: PosterDef[];
  vending: VendDef[];
  interiors: Array<{ pos: THREE.Vector3; normal: THREE.Vector3; w: number; h: number; tint: string; seed: number }>;
  vents: THREE.Vector3[];
  drips: THREE.Vector3[];
  bulbs: THREE.Vector3[];
  /** Places rain doesn't fall (under the flyover). */
  shelters: THREE.Box3[];
  /** The shadow-casting key light: a security floodlight at the south end, raking up the street. */
  key: { pos: THREE.Vector3; target: THREE.Vector3; color: THREE.Color };
  groundHeight(x: number, z: number): number;
  /** Optional per-district look; the Drowned Market's defaults apply when absent. */
  theme?: DistrictTheme;
}

export interface DistrictTheme {
  name: string;
  /** Signature lighting moment that rolls through the district's lights (see lighting.ts signatureGain). */
  signature?: "brownout" | "alarm" | "surge";
  loading: string;
  /** Linear RGB fog colour. */
  fog: [number, number, number];
  fogDensity: number;
  volMin: THREE.Vector3;
  volMax: THREE.Vector3;
  /** Where the reflection probe sits. */
  probe: THREE.Vector3;
  /** False for interiors: no flood water, canal or skyline. */
  outdoor: boolean;
  /** False for outdoor districts without the market's canal and flood plane. */
  water?: boolean;
  /** Walkable bounds the session clamps the player to. */
  bounds: { xMin: number; xMax: number; zMin: number; zMax: number };
  len?: number;
}

const C = (hex: string) => new THREE.Color(hex);

export const NEON = {
  pink: "#ff2e88",
  cyan: "#2ee6ff",
  violet: "#a64dff",
  green: "#47ff8f",
  red: "#ff2a2a",
  amber: "#ffb03a",
  sodium: "#ff8f2e",
  ice: "#bfe9ff",
  white: "#fff3e0",
  yellow: "#ffe14a",
} as const;

export function groundHeight(x: number, z: number): number {
  const t = floodT(z);
  if (x >= L.roadW && x <= L.roadE) return -FLOOD.depth * t;
  if (x > L.roadE && x <= L.quayEdge) return L.kerb - (L.kerb + FLOOD.depth) * t;
  if (x > L.quayEdge && x < L.canalE && z < L.zNorth && z > L.zSouth) return -3;
  return L.kerb;
}

export function buildLevel(quality: "phone" | "high" | "ultra"): Level {
  const b = new Builder();
  const rand = prng(2079);
  const r = (a: number, c: number) => a + rand() * (c - a);
  const pick = <T>(a: readonly T[]): T => a[Math.floor(rand() * a.length)]!;
  const lights: VLight[] = [];
  const signs: SignDef[] = [];
  const windows: WindowDef[] = [];
  const cones: ConeDef[] = [];
  const posters: PosterDef[] = [];
  const vending: VendDef[] = [];
  const interiors: Level["interiors"] = [];
  const vents: THREE.Vector3[] = [];
  const drips: THREE.Vector3[] = [];
  const bulbs: THREE.Vector3[] = [];
  let seed = 1;
  const light = (pos: THREE.Vector3, color: string, intensity: number, range: number, normal: THREE.Vector3 | null = null, flicker = 0, real = true) =>
    lights.push({ pos, color: C(color), intensity, range, normal, flicker, seed: seed++, real });

  const sign = (s: SignDef, glow = 1) => {
    signs.push(s);
    // Each sign lights the wall and air in front of it.
    const area = Math.min(8, s.w * s.h);
    const lpos = s.center.clone().addScaledVector(s.normal, 0.7);
    light(lpos, s.color, (2.2 + area * 1.1) * glow * (s.style === "box" ? 0.8 : 1), 5 + Math.sqrt(area) * 3.2, s.normal.clone(), s.flicker);
  };
  /** A double-sided blade sign sticking out of a wall, visible up and down the street. */
  const blade = (text: string, color: string, center: THREE.Vector3, h: number, w: number, style: SignStyle = "blade", flicker = 1, broken?: [number, number]) => {
    const key = `${text}|${color}|${style}`;
    for (const n of [1, -1]) {
      signs.push({ text, style, color, w, h, center: center.clone().add(V(0, 0, 0.09 * n)), normal: V(0, 0, n), flicker, intensity: style === "bladeTube" ? 5 : 3, cjk: true, key, broken });
    }
    // Housing.
    b.box("blackPaint", center.x, center.y, center.z, w + 0.12, h + 0.12, 0.16);
    light(center.clone(), color, 3.5 + h * w, 6 + h * 1.5, null, flicker);
  };

  // ------------------------------------------------------------------ ground
  const zN = L.zNorth;
  const zS = L.zSouth;
  {
    // Road: a strip subdivided along z so the flooded dip can bend it.
    const segZ = Math.round(zN - zS);
    const road = new THREE.PlaneGeometry(L.roadE - L.roadW, zN - zS, 2, segZ);
    road.rotateX(-Math.PI / 2);
    road.translate((L.roadE + L.roadW) / 2, 0, (zN + zS) / 2);
    bend(road, (x, z) => groundHeight(Math.min(L.roadE - 0.01, Math.max(L.roadW + 0.01, x)), z));
    b.add("asphalt", road, 4);
    // Quay (market pavement) with the same dip.
    const quay = new THREE.PlaneGeometry(L.quayEdge - L.roadE, zN - zS, 2, segZ);
    quay.rotateX(-Math.PI / 2);
    quay.translate((L.quayEdge + L.roadE) / 2, 0, (zN + zS) / 2);
    bend(quay, (x, z) => groundHeight(Math.min(L.quayEdge - 0.01, Math.max(L.roadE + 0.01, x)), z));
    b.add("pavement", quay, 3);
    // West pavement and the alleys.
    b.boxMinMax("pavement", -24, -0.5, zS, L.roadW, L.kerb, zN, { uv: 3, skip: ["bottom"] });
    // Kerbs: the west kerb face is part of the pavement box; the east kerb face follows the dip.
    const kerb = new THREE.PlaneGeometry(zN - zS, 1, segZ, 1);
    kerb.rotateY(-Math.PI / 2);
    kerb.translate(L.roadE, 0.5, (zN + zS) / 2);
    const kp = kerb.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < kp.count; i++) {
      const z = kp.getZ(i);
      kp.setY(i, kp.getY(i) > 0.5 ? groundHeight(L.roadE + 0.1, z) : groundHeight(L.roadE - 0.1, z) - 0.02);
    }
    kerb.computeVertexNormals();
    b.add("concreteB", kerb, 1);
    // Canal: quay wall face, a dark bed, the far wall is the east buildings.
    b.boxMinMax("concreteA", L.quayEdge, -3.2, zS, L.quayEdge + 0.4, -0.25, zN, { uv: 3, skip: ["top"] });
    b.boxMinMax("blackPaint", L.quayEdge, -3.3, zS, L.canalE, -3.2, zN);
    // A coping stone along the quay edge.
    for (let z = zS; z < zN; z += 4) {
      const y0 = groundHeight(L.quayEdge - 0.2, z + 2);
      b.boxMinMax("concreteB", L.quayEdge - 0.25, y0 - 0.25, z, L.quayEdge + 0.05, y0 + 0.06, z + 3.98, { uv: 1 });
    }
  }

  // Quay railing: posts and two rails, with a gap at the water-taxi steps.
  {
    const x = L.quayEdge - 0.1;
    for (let z = zS + 1; z < zN; z += 2.5) {
      if (z > -63 && z < -58) continue;
      const y = groundHeight(x - 0.2, z);
      b.cylinder("darkMetal", V(x, y, z), V(x, y + 1.1, z), 0.035, 6);
    }
    for (const [z0, z1] of [
      [zS + 1, -63],
      [-58, zN - 1],
    ] as const) {
      // Rails follow the dip in short straight pieces.
      for (let z = z0; z < z1; z += 2) {
        const za = z;
        const zb = Math.min(z1, z + 2);
        for (const h of [0.55, 1.1]) b.cylinder("darkMetal", V(x, groundHeight(x - 0.2, za) + h, za), V(x, groundHeight(x - 0.2, zb) + h, zb), 0.03, 5);
      }
      b.collide(new THREE.Box3(V(x - 0.08, -1, z0), V(x + 0.6, 1.25, z1)), "metal");
    }
    // The steps' gap is closed lower down by a chain (stops the player wandering into the canal).
    b.collide(new THREE.Box3(V(x, -1, -63), V(x + 0.6, 1.25, -58)), "metal");
  }

  // ------------------------------------------------------------------ west buildings
  const westMats = ["brickDark", "concreteA", "plasterGreen", "brickRed", "concreteB", "plasterPink", "tiles"] as const;
  interface Bld {
    z0: number;
    z1: number;
    storeys: number;
    mat: string;
    shop: "shutter" | "glass" | "halfShutter" | "dark";
    fascia?: { text: string; color: string; style: SignStyle; broken?: [number, number]; flicker?: number };
    blade?: { text: string; color: string; style?: SignStyle };
    fire?: boolean;
    interior?: string;
  }
  const west: Bld[] = [
    { z0: 55, z1: 64, storeys: 5, mat: "brickDark", shop: "glass", fascia: { text: "HOTEL MARROW", color: NEON.amber, style: "tube" }, blade: { text: "ホテル", color: NEON.pink, style: "bladeTube" }, interior: "#ffb070" },
    { z0: 45.5, z1: 55, storeys: 4, mat: "plasterGreen", shop: "shutter", fascia: { text: "TOMAS EGGS", color: NEON.white, style: "box", flicker: 2, broken: [0, 1] }, fire: true },
    { z0: 35.5, z1: 45.5, storeys: 6, mat: "concreteA", shop: "glass", fascia: { text: "0.99 NOODLE", color: NEON.green, style: "tube" }, blade: { text: "拉麺", color: NEON.green, style: "bladeTube" }, interior: "#ffd08a" },
    { z0: 25, z1: 35.5, storeys: 4, mat: "brickRed", shop: "halfShutter", fascia: { text: "PAWN · CASH · CHIPS", color: NEON.yellow, style: "box" }, blade: { text: "質屋", color: NEON.amber } },
    { z0: 15, z1: 21, storeys: 5, mat: "plasterPink", shop: "glass", fascia: { text: "KARAOKE 노래방", color: NEON.violet, style: "tube", broken: [0.62, 1] }, interior: "#ff70d0" },
    { z0: 5, z1: 15, storeys: 2, mat: "concreteB", shop: "shutter", fascia: { text: "RUIZ REPAIRS", color: NEON.cyan, style: "tube" } },
    { z0: -3, z1: 5, storeys: 2, mat: "corrugatedWall", shop: "dark" },
    { z0: -14, z1: -3, storeys: 5, mat: "brickDark", shop: "glass", fascia: { text: "CANDOR CLINIC", color: NEON.cyan, style: "tube", broken: [0.55, 1], flicker: 2 }, blade: { text: "診療所", color: NEON.ice }, interior: "#9dffe0", fire: true },
    { z0: -26, z1: -14, storeys: 6, mat: "concreteA", shop: "halfShutter", fascia: { text: "LUCKY 8 MAHJONG", color: NEON.red, style: "tube" }, blade: { text: "麻雀", color: NEON.red, style: "bladeTube" } },
    { z0: -41, z1: -26, storeys: 4, mat: "plasterGreen", shop: "glass", fascia: { text: "BAR LOW TIDE", color: NEON.pink, style: "tube" }, blade: { text: "酒場", color: NEON.pink }, interior: "#ff6080" },
    { z0: -55, z1: -45, storeys: 5, mat: "brickRed", shop: "shutter", fascia: { text: "DRY CLEAN 洗濯", color: NEON.ice, style: "box" }, fire: true },
    { z0: -68, z1: -55, storeys: 6, mat: "concreteB", shop: "glass", fascia: { text: "WHOLESOME HOLLOW FRESH", color: NEON.amber, style: "box" }, blade: { text: "薬局", color: NEON.green }, interior: "#fff0d0" },
  ];
  void westMats;
  const W = L.westFacade;
  const gf = L.groundFloor;
  const st = L.storey;
  for (const bd of west) {
    const H = gf + st * (bd.storeys - 1);
    const len = bd.z1 - bd.z0;
    const zc = (bd.z0 + bd.z1) / 2;
    // Upper mass and ground floor (recessed shopfront).
    b.boxMinMax(bd.mat, W - 12, gf, bd.z0, W, H, bd.z1, { uv: 3, collide: "concrete", skip: ["bottom"] });
    b.boxMinMax(bd.mat, W - 12, 0, bd.z0, W - 0.6, gf, bd.z1, { uv: 3, collide: "concrete", skip: ["top", "bottom"] });
    // End piers framing the shop.
    for (const z of [bd.z0 + 0.3, bd.z1 - 0.3]) b.box(bd.mat, W - 0.3, gf / 2, z, 0.6, gf, 0.6, { uv: 3, collide: "concrete" });
    // Fascia band above the shopfront.
    b.boxMinMax("blackPaint", W - 0.6, gf - 0.85, bd.z0 + 0.6, W + 0.12, gf - 0.05, bd.z1 - 0.6);
    for (let z = bd.z0 + 1; z < bd.z1 - 0.8; z += r(2.4, 4)) drips.push(V(W + 0.12, gf - 0.85, z));
    // Floor bands and cornice.
    for (let k = 1; k < bd.storeys; k++) b.boxMinMax("concreteB", W, gf + st * (k - 1) - 0.1, bd.z0, W + 0.14, gf + st * (k - 1) + 0.1, bd.z1, { uv: 1 });
    b.boxMinMax("concreteB", W - 12.2, H, bd.z0 - 0.1, W + 0.3, H + 0.45, bd.z1 + 0.1, { uv: 1 });
    b.boxMinMax(bd.mat, W - 12, H + 0.45, bd.z0, W - 11.6, H + 1.3, bd.z1, { uv: 2 });
    b.boxMinMax(bd.mat, W - 0.4, H + 0.45, bd.z0, W, H + 1.1, bd.z1, { uv: 2 });
    drips.push(V(W + 0.3, H, zc), V(W + 0.3, H, bd.z0 + 1));
    // Shopfront.
    const shopZ0 = bd.z0 + 0.6;
    const shopZ1 = bd.z1 - 0.6;
    const sx = W - 0.55;
    if (bd.shop === "shutter" || bd.shop === "halfShutter") {
      const top = bd.shop === "shutter" ? gf - 0.85 : gf - 0.85;
      const bottom = bd.shop === "shutter" ? 0 : 1.15;
      b.boxMinMax("shutter", sx, bottom, shopZ0, sx + 0.05, top, shopZ1, { uv: 2.5 });
      b.boxMinMax("darkMetal", sx - 0.05, top - 0.35, shopZ0, sx + 0.12, top, shopZ1);
      if (bd.shop === "halfShutter") {
        interiors.push({ pos: V(sx - 0.4, bottom / 2 + 0.05, (shopZ0 + shopZ1) / 2), normal: V(1, 0, 0), w: shopZ1 - shopZ0, h: bottom, tint: "#7a4a22", seed: seed++ });
        light(V(W + 0.3, 0.4, (shopZ0 + shopZ1) / 2), "#ffb070", 2.2, 5, V(1, 0, 0));
      }
    } else if (bd.shop === "glass") {
      interiors.push({ pos: V(sx - 0.25, (gf - 0.85) / 2, (shopZ0 + shopZ1) / 2), normal: V(1, 0, 0), w: shopZ1 - shopZ0, h: gf - 0.85, tint: bd.interior ?? "#ffd090", seed: seed++ });
      b.boxMinMax("glass", sx, 0.3, shopZ0, sx + 0.03, gf - 0.9, shopZ1);
      b.boxMinMax("darkMetal", sx - 0.02, 0, shopZ0, sx + 0.08, 0.3, shopZ1);
      for (let z = shopZ0; z <= shopZ1 + 0.01; z += (shopZ1 - shopZ0) / 3) b.boxMinMax("darkMetal", sx - 0.02, 0, z - 0.04, sx + 0.08, gf - 0.85, z + 0.04);
      light(V(W + 0.9, 1.6, (shopZ0 + shopZ1) / 2), bd.interior ?? "#ffd090", 4.5, 8, V(1, 0, 0));
    } else {
      b.boxMinMax("rust", sx, 0, shopZ0, sx + 0.05, gf - 0.85, shopZ1, { uv: 2 });
    }
    // The fascia sign.
    if (bd.fascia) {
      const w = Math.min(len - 2.2, bd.fascia.text.length * 0.42 + 0.8);
      sign({
        text: bd.fascia.text,
        style: bd.fascia.style,
        color: bd.fascia.color,
        w,
        h: 0.72,
        center: V(W + 0.14, gf - 0.45, zc),
        normal: V(1, 0, 0),
        flicker: bd.fascia.flicker ?? 1,
        intensity: bd.fascia.style === "tube" ? 5.5 : 2.4,
        broken: bd.fascia.broken,
      });
    }
    // Awnings over lit shopfronts, and a low stack of small blade signs at the south corner.
    if (bd.shop === "glass") {
      const aw = new THREE.PlaneGeometry(1.5, len - 1.6, 1, 1);
      aw.rotateX(-Math.PI / 2);
      aw.rotateZ(-0.32);
      aw.translate(W + 0.7, gf - 0.95, zc);
      b.add("tarp", aw, 0);
      for (let z = bd.z0 + 1.2; z < bd.z1 - 1; z += r(1.5, 3)) drips.push(V(W + 1.4, gf - 1.2, z));
    }
    if (rand() < 0.75 && bd.storeys > 2 && !(bd.z0 < 52 && bd.z1 > 25)) {
      const stack = [pick(["酒", "鮨", "薬", "宿", "麺", "茶", "灯"]), pick(["BAR", "24H", "ATM", "OPEN", "VAPE"]), pick(["占", "魚", "肉", "湯"])];
      stack.forEach((t, i) => {
        const c = pick([NEON.pink, NEON.cyan, NEON.amber, NEON.green, NEON.violet, NEON.white]);
        blade(t, c, V(W + 0.62, 6.4 - i * 0.62, bd.z0 + 1.0), 0.52, 0.86, "blade", i === 1 ? 2 : 1);
      });
    }
    // A blade sign near the north corner, high.
    if (bd.blade) {
      const h = Math.min(H - gf - 1.2, bd.blade.text.length * 1.15 + 0.6);
      blade(bd.blade.text, bd.blade.color, V(W + 1.05, gf + 0.9 + h / 2, bd.z1 - 1.2), h, 1.15, bd.blade.style ?? "blade", 1);
      b.box("darkMetal", W + 0.3, gf + 1.0, bd.z1 - 1.2, 0.6, 0.08, 0.08);
      b.box("darkMetal", W + 0.3, gf + 0.8 + h, bd.z1 - 1.2, 0.6, 0.08, 0.08);
    }
    // Windows, AC units and a downpipe.
    const bays = Math.max(2, Math.floor(len / 2.7));
    const bay = len / bays;
    for (let k = 1; k < bd.storeys; k++) {
      const y = gf + st * (k - 1) + 0.9;
      for (let i = 0; i < bays; i++) {
        const z = bd.z0 + bay * (i + 0.5);
        const lit = rand() < 0.36;
        windows.push({ pos: V(W + 0.03, y + 0.85, z), normal: V(1, 0, 0), w: 1.25, h: 1.75, tile: winTile(rand, lit), lit: lit ? r(1.1, 2.4) : 0 });
        const onWalkway = k === 1 && z > 25 && z < 52;
        if (rand() < 0.22 && !onWalkway) {
          b.box("acUnit", W + 0.32, y - 0.25, z + r(-0.3, 0.3), 0.62, 0.55, 0.85, { uv: 1 });
          drips.push(V(W + 0.55, y - 0.55, z));
        }
        b.box("concreteB", W + 0.06, y - 0.06, z, 0.12, 0.1, 1.45, { uv: 1 });
      }
    }
    b.cylinder("pipe", V(W + 0.12, 0, bd.z0 + 0.15), V(W + 0.12, H, bd.z0 + 0.15), 0.07, 6);
    // Rooftop clutter: a water tank, vents, an aerial.
    if (rand() < 0.7) {
      const tz = bd.z0 + r(2, len - 2);
      b.cylinder("wood", V(W - 6, H + 1.6, tz), V(W - 6, H + 4.2, tz), 1.3, 12);
      b.box("darkMetal", W - 6, H + 1.0, tz, 2.4, 0.15, 2.4);
      for (const [dx, dz] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ] as const)
        b.cylinder("darkMetal", V(W - 6 + dx, H + 0.4, tz + dz), V(W - 6 + dx, H + 1.0, tz + dz), 0.06, 5);
    }
    if (rand() < 0.6) b.cylinder("darkMetal", V(W - 2, H + 0.4, zc), V(W - 2, H + r(4, 8), zc), 0.04, 4);
    // Fire escape: a platform per floor, rails and zig-zag stairs.
    if (bd.fire) fireEscape(b, W, bd.z0 + 1.5, bd.z0 + 5.2, bd.storeys, drips);
  }

  // Alleys: side walls exist (building boxes); a back wall, dumpster, bags, a lamp over a door.
  for (const al of L.alleys) {
    const zc = (al.z0 + al.z1) / 2;
    b.boxMinMax("brickDark", -24.5, 0, al.z0 - 0.5, -22, 14, al.z1 + 0.5, { uv: 3, collide: "concrete" });
    // A chain-link-ish fence across the alley mouth? No: alleys stay open for flanking. A dumpster:
    b.box("rust", -19.5, 0.8, al.z0 + 1.0, 1.1, 1.3, 1.9, { uv: 1.5, collide: "metal" });
    b.box("darkMetal", -19.5, 1.5, al.z0 + 1.0, 1.2, 0.08, 2.0);
    for (let i = 0; i < 6; i++) b.shape("bag", new THREE.SphereGeometry(0.4, 8, 6), V(-21 + r(-0.6, 1.4), 0.35, al.z1 - 0.7 - r(0, 1.2)), r(0, 6), V(1, r(0.6, 0.9), r(0.8, 1.2)));
    b.box("wood", -14, 0.32, al.z1 - 0.6, 1.2, 0.35, 1.0, { uv: 1, collide: "wood" });
    // A door with a caged bulb: the only light back here (dark corners on purpose).
    b.boxMinMax("rust", -22.0, 0, zc - 0.6, -21.95, 2.3, zc + 0.6, { uv: 1 });
    const lamp = V(-21.6, 2.75, zc);
    b.box("glowWarm", lamp.x, lamp.y, lamp.z, 0.16, 0.16, 0.16);
    bulbs.push(lamp);
    light(lamp, "#ffb36b", 3.0, 7, V(1, 0, 0), al.z0 > 0 ? 2 : 0);
    cones.push({ top: lamp, length: 2.9, radius: 1.6, color: C("#ffb36b"), strength: 0.55 });
    vents.push(V(-16.5, L.kerb, zc + 0.6));
    b.box("grate", -16.5, L.kerb + 0.015, zc + 0.6, 0.9, 0.03, 0.9, { uv: 1 });
    posters.push({ pos: V(-17, 1.7, al.z1 - 0.02), normal: V(0, 0, -1), w: 0.9, h: 1.35, idx: 6 });
  }

  // ------------------------------------------------------------------ the raised walkway (perch A)
  {
    const x0 = W;
    const x1 = W + 1.6;
    const y = 4.2;
    const zA = 27;
    const zB = 44;
    b.boxMinMax("grate", x0, y - 0.1, zA, x1, y, zB, { uv: 1.5, collide: "metal" });
    b.boxMinMax("darkMetal", x0, y - 0.32, zA, x1, y - 0.1, zA + 0.12);
    for (let z = zA + 0.2; z < zB; z += 4) {
      b.cylinder("darkMetal", V(x1 - 0.08, 0.15, z), V(x1 - 0.08, y - 0.1, z), 0.06, 6, "metal");
      b.box("darkMetal", (x0 + x1) / 2, y - 0.22, z, 1.6, 0.18, 0.1);
    }
    // Rails (and colliders) on the open side and the far end.
    for (let z = zA; z <= zB; z += 1.4) b.cylinder("darkMetal", V(x1 - 0.05, y, z), V(x1 - 0.05, y + 1.05, z), 0.025, 4);
    b.cylinder("darkMetal", V(x1 - 0.05, y + 1.05, zA), V(x1 - 0.05, y + 1.05, zB), 0.03, 5);
    b.cylinder("darkMetal", V(x1 - 0.05, y + 0.55, zA), V(x1 - 0.05, y + 0.55, zB), 0.025, 5);
    b.collide(new THREE.Box3(V(x1 - 0.1, y, zA), V(x1 + 0.02, y + 1.1, zB)), "metal");
    b.cylinder("darkMetal", V(x0, y + 1.05, zA + 0.05), V(x1, y + 1.05, zA + 0.05), 0.03, 5);
    b.collide(new THREE.Box3(V(x0, y, zA - 0.05), V(x1, y + 1.1, zA + 0.1)), "metal");
    // Stairs: 24 steps of 0.175 m rising toward -z from z = 51.2.
    const steps = 24;
    const rise = y / steps;
    const run = 0.3;
    const zTop = zB;
    const zStart = zTop + steps * run;
    for (let i = 0; i < steps; i++) {
      const top = (i + 1) * rise;
      const za = zStart - (i + 1) * run;
      const zb = zStart - i * run;
      b.boxMinMax("grate", x0 + 0.05, top - 0.05, za, x1 - 0.15, top, zb, { uv: 1 });
      b.collide(new THREE.Box3(V(x0, 0, za), V(x1 - 0.12, top, zb)), "metal");
      b.collide(new THREE.Box3(V(x1 - 0.12, top, za), V(x1, top + 1.0, zb)), "metal");
    }
    // Stringers and a handrail.
    b.cylinder("darkMetal", V(x1 - 0.1, 0.1, zStart), V(x1 - 0.1, y, zTop), 0.07, 4);
    b.cylinder("darkMetal", V(x1 - 0.06, 1.0, zStart), V(x1 - 0.06, y + 1.0, zTop), 0.025, 4);
    for (let i = 0; i <= steps; i += 4) {
      const z = zStart - i * run;
      b.cylinder("darkMetal", V(x1 - 0.06, i * rise, z), V(x1 - 0.06, i * rise + 1.0, z), 0.02, 4);
    }
    // A lamp halfway along the walkway, and one at the top of the stairs.
    for (const z of [zB - 1, 33]) {
      const p = V(x0 + 0.25, y + 2.3, z);
      b.box("glowCool", p.x, p.y, p.z, 0.12, 0.08, 0.6);
      light(p.clone().add(V(0.4, -0.3, 0)), NEON.ice, 2.4, 6, null, z === 33 ? 2 : 0);
    }
  }

  // ------------------------------------------------------------------ the flyover
  {
    const f = L.fly;
    b.boxMinMax("concreteB", -90, f.under, f.z0, 100, f.top, f.z1, { uv: 4, collide: "concrete" });
    for (const z of [f.z0, f.z1]) {
      b.boxMinMax("concreteA", -90, f.top, z - (z === f.z0 ? 0 : 0.35), 100, f.top + 1.0, z + (z === f.z0 ? 0.35 : 0), { uv: 3 });
      // Drips all along both edges.
      for (let x = -20; x < 30; x += r(0.7, 1.6)) drips.push(V(x, f.under, z));
    }
    // Girders under the deck and the piers.
    for (const z of [f.z0 + 1.2, (f.z0 + f.z1) / 2, f.z1 - 1.2]) b.boxMinMax("concreteB", -90, f.under - 0.75, z - 0.35, 100, f.under, z + 0.35, { uv: 3 });
    for (const x of [-1.5, 6.2, 12.5, -40, -70, 45, 75]) {
      const zc = (f.z0 + f.z1) / 2;
      const y0 = x > L.quayEdge && x < L.canalE ? -3 : groundHeight(x, zc);
      b.boxMinMax("concreteA", x - 0.8, y0, zc - 1.2, x + 0.8, f.under - 0.75, zc + 1.2, { uv: 3, collide: "concrete" });
      b.boxMinMax("concreteB", x - 1.3, f.under - 1.6, zc - 1.8, x + 1.3, f.under - 0.75, zc + 1.8, { uv: 3 });
      if (Math.abs(x) < 20) {
        posters.push({ pos: V(x, 1.75, zc + 1.21), normal: V(0, 0, 1), w: 0.95, h: 1.4, idx: x < 0 ? 0 : 2 });
        posters.push({ pos: V(x, 1.65, zc - 1.21), normal: V(0, 0, -1), w: 0.95, h: 1.4, idx: x < 0 ? 4 : 1 });
        posters.push({ pos: V(x + (x < 5 ? 0.81 : -0.81), 1.8, zc + 0.4), normal: V(x < 5 ? 1 : -1, 0, 0), w: 0.9, h: 1.35, idx: x < 0 ? 7 : 5 });
      }
    }
    // Lamps under the deck: sodium, one dying.
    for (const [x, z, fl] of [
      [-4.5, 2, 0],
      [1.5, 2, 0],
      [-4.5, 10, 2],
      [1.5, 10, 0],
      [6.5, 6, 0],
    ] as const) {
      const p = V(x, f.under - 0.85, z);
      b.box("glowSodium", p.x, p.y, p.z, 0.5, 0.1, 0.25);
      b.box("darkMetal", p.x, p.y + 0.1, p.z, 0.6, 0.12, 0.35);
      light(p.clone().add(V(0, -0.4, 0)), NEON.sodium, 7, 11, null, fl);
      cones.push({ top: p.clone(), length: f.under - 0.9, radius: 2.8, color: C(NEON.sodium), strength: 0.5 });
    }
    // Expressway signage on both faces of the deck.
    sign({ text: "HOLLOWELL EXPRESSWAY 7 · ALL LANES TOLLED", style: "box", color: NEON.ice, w: 14, h: 0.9, center: V(-1.5, f.top - 0.7, f.z1 + 0.02), normal: V(0, 0, 1), flicker: 0, intensity: 2.0 }, 0.6);
    sign({ text: "配達します · WE DELIVER", style: "tube", color: NEON.cyan, w: 9, h: 0.9, center: V(-2, f.top - 0.7, f.z0 - 0.02), normal: V(0, 0, -1), flicker: 1, intensity: 5 }, 0.6);
  }

  // ------------------------------------------------------------------ streetlamps
  const lamp = (x: number, z: number, armX: number, h: number, color: string, flicker = 0, dead = false) => {
    const y0 = groundHeight(x, z);
    b.cylinder("darkMetal", V(x, y0, z), V(x, y0 + h, z), 0.09, 8, "metal");
    b.cylinder("darkMetal", V(x, y0 + h, z), V(x + armX, y0 + h + 0.3, z), 0.05, 6);
    const head = V(x + armX, y0 + h + 0.15, z);
    b.box("darkMetal", head.x, head.y + 0.08, head.z, 0.9, 0.16, 0.4);
    if (dead) {
      b.box("glass", head.x, head.y - 0.04, head.z, 0.7, 0.05, 0.3);
      return;
    }
    b.box(color === NEON.sodium ? "glowSodium" : "glowCool", head.x, head.y - 0.04, head.z, 0.7, 0.05, 0.3);
    light(head.clone().add(V(0, -0.5, 0)), color, 9, 13, null, flicker);
    cones.push({ top: head.clone().add(V(0, -0.06, 0)), length: head.y - groundHeight(head.x, head.z), radius: 3.6, color: C(color), strength: 0.7 });
  };
  lamp(-7.0, 50, 2.0, 7.2, NEON.sodium);
  lamp(-7.0, 30, 2.0, 7.2, NEON.sodium, 2);
  lamp(-7.0, -20, 2.0, 7.2, NEON.sodium, 0, true);
  lamp(-7.0, -38, 2.0, 7.2, NEON.ice);
  lamp(-7.0, -58, 2.0, 7.2, NEON.sodium);
  lamp(8.4, 42, -1.4, 5.2, NEON.ice);
  lamp(8.4, 22, -1.4, 5.2, NEON.sodium);
  lamp(8.4, -26, -1.4, 5.2, NEON.ice, 2);
  lamp(8.4, -55, -1.4, 5.2, NEON.sodium);

  // ------------------------------------------------------------------ market stalls on the quay
  const stall = (z: number, abandoned: boolean, tarpTilt = 0) => {
    const y0 = groundHeight(6, z);
    const x0 = 4.2;
    const x1 = 8.2;
    const w = 3.2;
    const front = 2.65;
    const back = 2.25;
    for (const [x, h] of [
      [x0, front],
      [x1, back],
    ] as const)
      for (const dz of [-w / 2, w / 2]) b.cylinder("darkMetal", V(x, y0, z + dz), V(x, y0 + h, z + dz), 0.04, 5, dz < 0 && x === x0 ? "metal" : undefined);
    // Tarp roof: a sagging plane from front to back.
    const tarp = new THREE.PlaneGeometry(x1 - x0 + 0.6, w + 0.4, 6, 4);
    tarp.rotateX(-Math.PI / 2);
    const tp = tarp.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < tp.count; i++) {
      const lx = tp.getX(i);
      const lz = tp.getZ(i);
      const u = (lx + (x1 - x0 + 0.6) / 2) / (x1 - x0 + 0.6);
      const sag = Math.sin(u * Math.PI) * 0.12 + Math.cos((lz / (w + 0.4)) * Math.PI) * 0.06;
      tp.setY(i, front + (back - front) * u - sag + tarpTilt * lz * 0.05);
    }
    tarp.computeVertexNormals();
    tarp.translate((x0 + x1) / 2, y0, z);
    b.add("tarp", tarp, 0);
    drips.push(V(x0 - 0.3, y0 + front - 0.05, z - 1.0), V(x0 - 0.3, y0 + front - 0.05, z + 0.6), V(x0 - 0.3, y0 + front - 0.05, z + 1.5));
    // Counter with an ice tray and fish (or empty and wet, when abandoned).
    b.boxMinMax("wood", x0 + 0.1, y0, z - w / 2 + 0.1, x0 + 1.1, y0 + 0.9, z + w / 2 - 0.1, { uv: 1, collide: "wood" });
    b.boxMinMax("ice", x0 + 0.05, y0 + 0.9, z - w / 2 + 0.15, x0 + 1.15, y0 + 1.02, z + w / 2 - 0.15, { uv: 0.5 });
    if (!abandoned) {
      for (let i = 0; i < 18; i++) {
        const fx = x0 + 0.25 + rand() * 0.7;
        const fz = z - w / 2 + 0.3 + rand() * (w - 0.6);
        const fish = new THREE.SphereGeometry(1, 7, 5);
        fish.scale(0.2, 0.04, 0.06);
        b.shape("fish", fish, V(fx, y0 + 1.05, fz), r(0, Math.PI), undefined, 0.3);
        const tail = new THREE.ConeGeometry(0.05, 0.1, 4);
        tail.rotateZ(Math.PI / 2);
        tail.scale(1, 1, 0.3);
        const a = r(0, Math.PI);
        b.shape("fish", tail, V(fx + Math.cos(a) * 0.22, y0 + 1.05, fz - Math.sin(a) * 0.22), a, undefined, 0.3);
      }
      // A bulb under the tarp: the warm heart of every stall.
      const bulb = V(x0 + 0.9, y0 + front - 0.45, z);
      b.cylinder("cable", V(bulb.x, bulb.y + 0.05, z), V(bulb.x, y0 + front - 0.08, z), 0.006, 3);
      b.shape("glowWarm", new THREE.SphereGeometry(0.07, 8, 6), bulb);
      bulbs.push(bulb);
      light(bulb.clone(), "#ffc27a", 3.6, 6.5, null, 1);
    }
    // Crates and styrofoam boxes behind.
    for (let i = 0; i < 4; i++) {
      const cz = z - 1.1 + i * 0.75 + r(-0.1, 0.1);
      const stack = 1 + Math.floor(rand() * 3);
      for (let k = 0; k < stack; k++) b.box(rand() < 0.5 ? "styro" : "wood", r(6.9, 7.4), y0 + 0.22 + k * 0.44, cz, 0.62, 0.42, 0.5, { rotY: r(-0.15, 0.15), uv: 0.8, collide: k === 0 ? "wood" : undefined });
    }
    // A price board.
    if (!abandoned)
      sign({ text: pick(["鮮魚 4.50", "생선 SALE", "EEL 9.99", "SQUID 3", "FRESH 新鮮"]), style: "box", color: pick([NEON.white, NEON.yellow, NEON.ice]), w: 1.2, h: 0.36, center: V(x0 - 0.02, y0 + 2.3, z + 0.3), normal: V(-1, 0, 0), flicker: 0, intensity: 1.8, cjk: true }, 0.35);
  };
  for (const z of [39, 33.5, 27.5, 14.5, 8.5, -5]) stall(z, false, r(-1, 1));
  for (const z of [-17, -24]) stall(z, true, r(-1, 1));
  // A noodle cart under the flyover with stools and steam.
  {
    const p = V(-4.2, 0, 4.5);
    b.box("paintRed", p.x, 0.55, p.z, 1.2, 1.0, 2.2, { uv: 1, collide: "metal" });
    b.box("darkMetal", p.x, 1.08, p.z, 1.3, 0.06, 2.3);
    b.cylinder("chrome", V(p.x, 1.1, p.z - 0.5), V(p.x, 1.45, p.z - 0.5), 0.22, 10);
    for (const dz of [-0.8, 0, 0.8]) b.cylinder("darkMetal", V(p.x + 1.0, 0, p.z + dz), V(p.x + 1.0, 0.65, p.z + dz), 0.18, 8);
    vents.push(V(p.x, 1.45, p.z - 0.5));
    // A tiny awning with a lantern row.
    b.boxMinMax("tarp", p.x - 0.8, 2.3, p.z - 1.3, p.x + 1.0, 2.36, p.z + 1.3, { uv: 0 });
    for (const dz of [-0.9, -0.3, 0.3, 0.9]) {
      const q = V(p.x + 0.95, 2.05, p.z + dz);
      b.shape("glowRed", new THREE.SphereGeometry(0.11, 8, 6), q, 0, V(1, 1.3, 1));
    }
    light(V(p.x + 1, 1.9, p.z), "#ff5a3a", 4, 7);
    sign({ text: "0.99 拉麺", style: "box", color: NEON.red, w: 1.5, h: 0.4, center: V(p.x + 0.66, 1.6, p.z), normal: V(1, 0, 0), flicker: 1, intensity: 2.4, cjk: true }, 0.4);
  }

  // ------------------------------------------------------------------ the market office (perch B)
  {
    const x0 = 3.9;
    const x1 = 8.75;
    const z0 = -52;
    const z1 = -44;
    const y0 = L.kerb;
    const steps = 24;
    const rise = 0.18;
    const roof = y0 + steps * rise;
    b.boxMinMax("corrugatedWall", x0, y0, z0, x1, roof - 0.15, z1, { uv: 2, collide: "metal", skip: ["bottom"] });
    b.boxMinMax("concreteB", x0 - 0.1, roof - 0.15, z0 - 0.1, x1, roof, z1 + 0.1, { uv: 2, collide: "concrete" });
    // Parapet (open where the stairs land).
    b.boxMinMax("concreteB", x0 - 0.1, roof, z0 - 0.1, x0 + 0.15, roof + 0.55, z1 + 0.1, { collide: "concrete" });
    b.boxMinMax("concreteB", x0 - 0.1, roof, z0 - 0.1, x1, roof + 0.55, z0 + 0.15, { collide: "concrete" });
    b.boxMinMax("concreteB", x0 - 0.1, roof, z1 - 0.15, x1 - 1.3, roof + 0.55, z1 + 0.1, { collide: "concrete" });
    // Windows and door facing the road, a lit office inside.
    interiors.push({ pos: V(x0 - 0.02, 1.6, -48), normal: V(-1, 0, 0), w: 3.2, h: 1.4, tint: "#a8ffd0", seed: seed++ });
    b.boxMinMax("glass", x0 - 0.04, 0.9, -49.6, x0 - 0.01, 2.3, -46.4);
    light(V(x0 - 0.8, 1.8, -48), "#a8ffd0", 3.2, 7, V(-1, 0, 0), 2);
    sign({ text: "MARKET OFFICE 管理", style: "box", color: NEON.ice, w: 3.2, h: 0.5, center: V(x0 - 0.03, 3.3, -48), normal: V(-1, 0, 0), flicker: 0, intensity: 2, cjk: true }, 0.5);
    // Stairs up the north side, rising toward -z from z = -36.6.
    const sx0 = 7.55;
    const sx1 = 8.75;
    const zStart = -36.6;
    for (let i = 0; i < steps; i++) {
      const top = y0 + (i + 1) * rise;
      const za = zStart - (i + 1) * 0.3;
      const zb = zStart - i * 0.3;
      b.boxMinMax("grate", sx0, top - 0.05, za, sx1, top, zb, { uv: 1 });
      b.collide(new THREE.Box3(V(sx0, 0, za), V(sx1, top, zb)), "metal");
      b.collide(new THREE.Box3(V(sx0 - 0.12, top, za), V(sx0, top + 1.0, zb)), "metal");
    }
    b.boxMinMax("grate", sx0, roof - 0.05, zStart - steps * 0.3, sx1, roof, z1, { collide: "metal" });
    b.cylinder("darkMetal", V(sx0, y0, zStart), V(sx0, roof, zStart - steps * 0.3), 0.07, 4);
    b.cylinder("darkMetal", V(sx0 - 0.05, y0 + 1.0, zStart), V(sx0 - 0.05, roof + 1.0, zStart - steps * 0.3), 0.025, 4);
    // Rooftop: an AC unit and a satellite dish for cover.
    b.box("acUnit", 5.2, roof + 0.45, -50.5, 1.2, 0.9, 1.0, { uv: 1, collide: "metal" });
    b.cylinder("darkMetal", V(4.6, roof, -45.6), V(4.6, roof + 1.2, -45.6), 0.05, 5);
    const dish = new THREE.SphereGeometry(0.6, 12, 6, 0, Math.PI * 2, 0, 0.9);
    b.shape("paintMetal", dish, V(4.6, roof + 1.3, -45.6), 0, undefined, 1, 1.1);
    // A rooftop sign facing up the street.
    sign({ text: "生鮮", style: "tube", color: NEON.pink, w: 2.6, h: 1.3, center: V(6.2, roof + 1.6, z0 + 0.1), normal: V(0, 0, 1), flicker: 1, intensity: 5, cjk: true });
    b.boxMinMax("darkMetal", 5.0, roof, z0 + 0.0, 7.4, roof + 2.3, z0 + 0.08);
  }

  // ------------------------------------------------------------------ east buildings, out of the canal
  const E = L.canalE;
  const eastDefs: Array<{ z0: number; z1: number; storeys: number; mat: string; sign?: [string, string, SignStyle]; blade?: [string, string] }> = [
    { z0: 50, z1: 64, storeys: 8, mat: "concreteA", sign: ["HOLLOWELL CREDIT · 0%", NEON.cyan, "box"], blade: ["電脳", NEON.cyan] },
    { z0: 38, z1: 50, storeys: 6, mat: "brickRed", blade: ["생선", NEON.amber] },
    { z0: 26, z1: 38, storeys: 9, mat: "concreteB", sign: ["CANDOR", NEON.pink, "tube"] },
    { z0: 15, z1: 26, storeys: 7, mat: "plasterPink", blade: ["ホテル", NEON.violet] },
    { z0: -3, z1: 15, storeys: 2, mat: "corrugatedWall" },
    { z0: -16, z1: -3, storeys: 8, mat: "brickDark", sign: ["LOW TIDE ROOMS", NEON.red, "tube"], blade: ["酒", NEON.red] },
    { z0: -30, z1: -16, storeys: 6, mat: "concreteA", blade: ["鮮魚市場", NEON.cyan] },
    { z0: -44, z1: -30, storeys: 10, mat: "plasterGreen", sign: ["CANDOR CLINIC · BE MORE", NEON.ice, "box"] },
    { z0: -56, z1: -44, storeys: 7, mat: "brickRed", blade: ["노래방", NEON.pink] },
    { z0: -70, z1: -56, storeys: 8, mat: "concreteB", sign: ["WATER TAXI 水上タクシー", NEON.green, "tube"] },
  ];
  for (const ed of eastDefs) {
    const H = gf + st * (ed.storeys - 1);
    const len = ed.z1 - ed.z0;
    const zc = (ed.z0 + ed.z1) / 2;
    b.boxMinMax(ed.mat, E, -3.2, ed.z0, E + 14, H, ed.z1, { uv: 3, collide: "concrete", skip: ["bottom"] });
    b.boxMinMax("concreteB", E - 0.3, H, ed.z0 - 0.1, E + 14.2, H + 0.5, ed.z1 + 0.1, { uv: 1 });
    // Water-stained base and a lit doorway at the waterline.
    b.boxMinMax("concreteA", E - 0.12, -0.6, ed.z0, E, 0.6, ed.z1, { uv: 2 });
    if (rand() < 0.6) {
      const dz = ed.z0 + r(1.5, len - 1.5);
      b.boxMinMax("rust", E - 0.05, 0.6, dz - 0.7, E, 2.8, dz + 0.7);
      const p = V(E - 0.3, 3.1, dz);
      b.box("glowWarm", p.x, p.y, p.z, 0.15, 0.15, 0.4);
      light(p, "#ffbb77", 2.6, 6, V(-1, 0, 0));
    }
    const bays = Math.max(2, Math.floor(len / 2.6));
    const bay = len / bays;
    for (let k = 1; k <= ed.storeys - 1; k++) {
      const y = gf + st * (k - 1) + 0.9;
      for (let i = 0; i < bays; i++) {
        const z = ed.z0 + bay * (i + 0.5);
        const lit = rand() < 0.4;
        windows.push({ pos: V(E - 0.03, y + 0.85, z), normal: V(-1, 0, 0), w: 1.25, h: 1.75, tile: winTile(rand, lit), lit: lit ? r(1.0, 2.6) : 0 });
        if (rand() < 0.18) b.box("acUnit", E - 0.32, y - 0.25, z, 0.62, 0.55, 0.85, { uv: 1 });
      }
    }
    // Ground floor windows over the canal.
    for (let i = 0; i < bays; i++) {
      const lit = rand() < 0.5;
      windows.push({ pos: V(E - 0.03, 2.4, ed.z0 + bay * (i + 0.5)), normal: V(-1, 0, 0), w: 1.25, h: 1.75, tile: winTile(rand, lit), lit: lit ? r(0.8, 2) : 0 });
    }
    for (let k = 1; k < ed.storeys; k++) b.boxMinMax("concreteB", E - 0.14, gf + st * (k - 1) - 0.1, ed.z0, E, gf + st * (k - 1) + 0.1, ed.z1, { uv: 1 });
    if (ed.sign) {
      const [text, color, style] = ed.sign;
      const big = style === "tube" && text.length < 8;
      const w = big ? 9 : Math.min(len - 1.5, text.length * 0.55 + 1);
      const h = big ? 2.4 : 1.1;
      sign({ text, style, color, w, h, center: V(E - 0.15, big ? H - 3 : gf + 0.2, zc), normal: V(-1, 0, 0), flicker: 1, intensity: style === "tube" ? 6 : 2.6 }, big ? 1.6 : 1);
    }
    if (ed.blade) {
      const [text, color] = ed.blade;
      const h = Math.min(H - 6, text.length * 1.6 + 0.8);
      blade(text, color, V(E - 1.3, gf + 2 + h / 2, ed.z1 - 1.0), h, 1.6, rand() < 0.5 ? "bladeTube" : "blade", 1);
      b.box("darkMetal", E - 0.6, gf + 2.2, ed.z1 - 1.0, 1.2, 0.08, 0.08);
      b.box("darkMetal", E - 0.6, gf + 1.8 + h, ed.z1 - 1.0, 1.2, 0.08, 0.08);
    }
    // LED strips along some floor bands (a cheap, very Hollowell glow).
    if (rand() < 0.55) {
      const col = pick([NEON.pink, NEON.cyan, NEON.violet, NEON.red]);
      const key = col === NEON.pink ? "glowPink" : col === NEON.cyan ? "glowCyan" : col === NEON.violet ? "glowViolet" : "glowRed";
      for (let k = 2; k < ed.storeys; k += 2 + Math.floor(rand() * 2)) {
        const y = gf + st * (k - 1) + 0.12;
        b.boxMinMax(key, E - 0.2, y, ed.z0 + 0.2, E - 0.14, y + 0.07, ed.z1 - 0.2);
        for (let z = ed.z0 + 2; z < ed.z1; z += 5) light(V(E - 0.8, y, z), col, 1.6, 5, V(-1, 0, 0), 0, false);
      }
    }
    // Rooftop: aerials, a billboard frame now and then.
    if (rand() < 0.5) b.cylinder("darkMetal", V(E + 4, H + 0.5, zc), V(E + 4, H + r(5, 11), zc), 0.05, 4);
  }
  // A small water taxi moored at the south steps (the extract), with a lantern.
  {
    const hull = new THREE.Shape();
    hull.moveTo(-2.6, 0);
    hull.quadraticCurveTo(-2.2, -0.55, 0, -0.6);
    hull.quadraticCurveTo(2.3, -0.55, 2.9, 0.15);
    hull.lineTo(-2.6, 0.15);
    const g = new THREE.ExtrudeGeometry(hull, { depth: 1.8, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2 });
    g.translate(0, 0, -0.9);
    b.shape("paintTeal", g, V(11.2, FLOOD.water + 0.15, -60.5), Math.PI / 2 + 0.06);
    b.box("blackPaint", 11.2, FLOOD.water + 0.75, -60, 1.5, 0.9, 1.6);
    const p = V(11.2, FLOOD.water + 1.5, -59.2);
    b.shape("glowAmber", new THREE.SphereGeometry(0.1, 8, 6), p);
    light(p, NEON.amber, 3, 6);
    // Steps down from the quay.
    for (let i = 0; i < 4; i++) b.boxMinMax("concreteB", L.quayEdge - 0.1, -0.1 - i * 0.12, -62.5, L.quayEdge + 0.7 + i * 0.35, 0.05 - i * 0.12, -58.5, { uv: 1 });
  }

  // ------------------------------------------------------------------ end walls
  {
    // North: a tall block across everything (the player's back).
    b.boxMinMax("brickDark", -40, 0, zN, 40, 26, zN + 10, { uv: 3, collide: "concrete" });
    for (let x = -9; x < 15; x += 2.8)
      for (let k = 0; k < 6; k++) {
        const lit = rand() < 0.35;
        windows.push({ pos: V(x, gf + 0.9 + k * st + 0.85, zN - 0.03), normal: V(0, 0, -1), w: 1.25, h: 1.75, tile: winTile(rand, lit), lit: lit ? r(1, 2.2) : 0 });
      }
    sign({ text: "HOLLOWELL — WE DELIVER", style: "box", color: NEON.cyan, w: 8, h: 1.1, center: V(-1.5, gf - 0.2, zN - 0.05), normal: V(0, 0, -1), flicker: 0, intensity: 2.2 });
    // South: a block with a gated underpass over the road.
    b.boxMinMax("concreteA", -40, 0, zS - 10, L.roadW, 22, zS, { uv: 3, collide: "concrete" });
    b.boxMinMax("concreteA", L.roadE, 0, zS - 10, L.quayEdge, 22, zS, { uv: 3, collide: "concrete" });
    b.boxMinMax("concreteA", L.quayEdge, 3, zS - 10, 40, 22, zS, { uv: 3, collide: "concrete" });
    b.boxMinMax("concreteA", L.canalE, -3.2, zS - 10, 40, 3, zS, { uv: 3, collide: "concrete" });
    b.boxMinMax("concreteA", L.roadW, 6, zS - 10, L.roadE, 22, zS, { uv: 3, collide: "concrete" });
    b.boxMinMax("blackPaint", L.roadW, 0, zS - 10, L.roadE, 6, zS - 9.5);
    // The checkpoint gate: a grille the light leaks through.
    for (let x = L.roadW + 0.3; x < L.roadE; x += 0.45) b.cylinder("darkMetal", V(x, 0, zS - 0.5), V(x, 6, zS - 0.5), 0.03, 4);
    for (const y of [1, 3, 5]) b.cylinder("darkMetal", V(L.roadW, y, zS - 0.5), V(L.roadE, y, zS - 0.5), 0.04, 4);
    b.collide(new THREE.Box3(V(L.roadW, 0, zS - 0.6), V(L.roadE, 6, zS)), "metal");
    light(V(-1.5, 3, zS - 4), NEON.red, 6, 10);
    sign({ text: "CHECKPOINT 7 · CLOSED", style: "box", color: NEON.red, w: 5, h: 0.6, center: V(-1.5, 6.6, zS + 0.03), normal: V(0, 0, 1), flicker: 2, intensity: 2.6, broken: [0.55, 1] });
    for (let x = -9; x < 9; x += 2.8)
      for (let k = 1; k < 6; k++) {
        const lit = rand() < 0.3;
        windows.push({ pos: V(x, gf + 0.9 + (k - 1) * st + 0.85, zS + 0.03), normal: V(0, 0, 1), w: 1.25, h: 1.75, tile: winTile(rand, lit), lit: lit ? r(1, 2.2) : 0 });
      }
  }

  // ------------------------------------------------------------------ cover: cars, a van, Jersey blocks
  const car = (kind: "sedan" | "van" | "hatch", x: number, z: number, rotY: number, paint: string, hazards = false) => {
    const y0 = groundHeight(x, z);
    const { body, glass, width, length } = carBodyGeometry(kind);
    const pos = V(x, y0, z);
    b.shape(paint, body, pos.clone(), rotY, undefined, 1);
    b.shape("carGlass", glass, pos.clone(), rotY, undefined, 1);
    const cos = Math.cos(rotY);
    const sin = Math.sin(rotY);
    const local = (lx: number, ly: number, lz: number) => V(x + lx * cos + lz * sin, y0 + ly, z - lx * sin + lz * cos);
    const wr = kind === "van" ? 0.38 : 0.33;
    for (const lx of [-length / 2 + 0.85, length / 2 - 0.85])
      for (const lz of [-width / 2 + 0.12, width / 2 - 0.12]) {
        const wheel = new THREE.CylinderGeometry(wr, wr, 0.24, 14);
        wheel.rotateX(Math.PI / 2);
        b.shape("rubber", wheel, local(lx, wr, lz), rotY, undefined, 1);
        const hub = new THREE.CylinderGeometry(wr * 0.55, wr * 0.55, 0.26, 10);
        hub.rotateX(Math.PI / 2);
        b.shape("chrome", hub, local(lx, wr, lz), rotY, undefined, 1);
      }
    // Lights: tail (red), head (dim cool), optional hazards.
    for (const lz of [-width / 2 + 0.25, width / 2 - 0.25]) {
      const tail = local(-length / 2 - 0.02, kind === "van" ? 1.0 : 0.82, lz);
      b.box("glowRed", tail.x, tail.y, tail.z, 0.22, 0.12, 0.22, { rotY });
      const head = local(length / 2 + 0.0, kind === "van" ? 0.9 : 0.72, lz * 0.9);
      b.box(hazards ? "glowAmber" : "glowCoolDim", head.x, head.y, head.z, 0.15, 0.1, 0.32, { rotY });
    }
    if (hazards) light(local(-length / 2 - 0.4, 0.8, 0), NEON.amber, 3, 6, null, 3);
    light(local(-length / 2 - 0.5, 0.7, 0), "#ff2020", 1.2, 3.5, null, 0, false);
    // Collider: the car's footprint (axis-aligned bounds of the rotated box).
    const half = V(length / 2, 0, width / 2);
    const hx = Math.abs(half.x * cos) + Math.abs(half.z * sin);
    const hz = Math.abs(half.x * sin) + Math.abs(half.z * cos);
    const roofH = kind === "van" ? 2.42 : kind === "hatch" ? 1.5 : 1.46;
    b.collide(new THREE.Box3(V(x - hx * 0.95, y0, z - hz * 0.95), V(x + hx * 0.95, y0 + roofH * 0.68, z + hz * 0.95)), "metal");
    b.collide(new THREE.Box3(V(x - hx * 0.55, y0, z - hz * 0.55), V(x + hx * 0.55, y0 + roofH, z + hz * 0.55)), "metal");
    return local;
  };
  car("sedan", -5.3, 37, Math.PI / 2 + 0.03, "carRed");
  car("hatch", -5.3, 12.5, Math.PI / 2 - 0.05, "carTeal");
  car("sedan", -5.2, -47, Math.PI / 2, "carWhite", true);
  car("sedan", 1.8, -27, -Math.PI / 2 + 0.5, "carBlack");
  {
    const local = car("van", 1.9, 25.5, -Math.PI / 2 + 0.12, "vanWhite");
    // Livery on both sides.
    for (const side of [1, -1]) {
      const c = local(-0.6, 1.55, side * 1.02);
      const n = local(-0.6, 1.55, side * 2).sub(c).normalize();
      sign({ text: "HOLLOWELL — WE DELIVER", style: "box", color: NEON.cyan, w: 3.4, h: 0.55, center: c, normal: n, flicker: 0, intensity: 1.1 }, 0.25);
    }
  }
  const jersey = (x: number, z: number, rotY: number) => {
    const y0 = groundHeight(x, z);
    b.shape("jersey", jerseyGeometry(3.0), V(x, y0, z), rotY, undefined, 1.5);
    const cos = Math.cos(rotY);
    const sin = Math.sin(rotY);
    const hx = Math.abs(1.5 * sin) + Math.abs(0.31 * cos);
    const hz = Math.abs(1.5 * cos) + Math.abs(0.31 * sin);
    b.collide(new THREE.Box3(V(x - hx, y0, z - hz), V(x + hx, y0 + 0.81, z + hz)), "concrete");
  };
  jersey(-2.5, 46, Math.PI / 2 + 0.2);
  jersey(0.6, 45.2, Math.PI / 2 - 0.15);
  jersey(-3.5, 1.5, Math.PI / 2);
  jersey(-0.2, 1.4, Math.PI / 2);
  jersey(-1.2, -9, 0.4);
  jersey(-4.4, -38, Math.PI / 2 - 0.3);
  jersey(-0.8, -39.5, Math.PI / 2 + 0.1);
  jersey(-3.2, -56, Math.PI / 2);
  jersey(0.2, -56.5, Math.PI / 2 + 0.05);
  // Water-filled plastic barriers by the checkpoint.
  for (let i = 0; i < 5; i++) {
    const x = -6 + i * 1.25;
    b.box(i % 2 ? "plasticWhite" : "plasticRed", x, 0.45, -63.5, 1.2, 0.9, 0.5, { collide: "wood", uv: 1 });
  }

  // Vending machines along the west pavement.
  for (const [z, title, hue] of [
    [33.2, "COLD", 200],
    [34.3, "NOODLE", 120],
    [-6.5, "DRINK", 330],
    [-28.5, "SMOKES", 40],
    [-29.6, "STIMS", 280],
  ] as const) {
    b.box("paintMetal", W + 0.42, L.kerb + 0.95, z, 0.8, 1.9, 1.0, { collide: "metal", uv: 1 });
    vending.push({ pos: V(W + 0.83, L.kerb + 1.05, z), normal: V(1, 0, 0), title, hue });
    light(V(W + 1.5, 1.2, z), `hsl(${hue},80%,70%)`, 2.0, 4.5, V(1, 0, 0));
  }

  // Steam vents in the road (manhole grates) and under the flyover.
  for (const p of [V(-3.6, 0, 47.5), V(0.4, 0, 21.5), V(-2.2, 0, 7.5), V(1.2, 0, -41), V(-4, 0, -52)]) {
    vents.push(p);
    b.box("grate", p.x, 0.012, p.z, 0.9, 0.025, 0.9, { uv: 1 });
  }

  // Cables strung across the street and canal, and along facades.
  for (let i = 0; i < 26; i++) {
    const z = zN - 4 - i * 4.8 + r(-1.5, 1.5);
    if (z > L.fly.z0 - 2 && z < L.fly.z1 + 2) continue;
    const ya = r(6.5, 13);
    const yb = r(6.5, 15);
    b.cable("cable", V(W, ya, z), V(E, yb, z + r(-6, 6)), r(0.6, 1.8), 0.018);
    if (rand() < 0.4) b.cable("cable", V(W, ya + 0.3, z), V(L.quayEdge - 0.1, 5.2, z + r(-3, 3)), r(0.3, 0.8), 0.012);
  }
  // String lights over the market (warm bulbs on sagging cables).
  for (const [za, zb] of [
    [41, 30],
    [29, 16],
    [16, 5],
  ] as const) {
    const a = V(4.0, 4.3, za);
    const c = V(8.6, 4.6, zb);
    b.cable("cable", a, c, 0.7, 0.008);
    for (let k = 1; k < 10; k++) {
      const t = k / 10;
      const p = new THREE.Vector3().lerpVectors(a, c, t);
      p.y -= 0.7 * 4 * t * (1 - t) + 0.05;
      b.shape(k % 3 ? "glowWarm" : "glowPink", new THREE.SphereGeometry(0.05, 6, 4), p);
      if (k % 3 === 1) light(p.clone(), k % 3 ? "#ffc27a" : NEON.pink, 1.2, 4, null, 0, false);
    }
  }
  // Puddle-catching litter: crates and pallets along the road edge and in the flood.
  for (let i = 0; i < 14; i++) {
    const z = r(-60, 55);
    const x = rand() < 0.5 ? r(-9.6, -8.4) : r(4.0, 4.6);
    const y0 = groundHeight(x, z);
    if (z > L.fly.z0 && z < L.fly.z1) continue;
    b.box(rand() < 0.5 ? "wood" : "styro", x, y0 + 0.2, z, 0.6, 0.4, 0.5, { rotY: r(0, 3), uv: 0.8, collide: "wood" });
  }
  // Trash bags against the facades.
  for (let i = 0; i < 18; i++) {
    const z = r(-64, 60);
    b.shape("bag", new THREE.SphereGeometry(0.36, 8, 6), V(W + 0.4, 0.38, z), r(0, 6), V(1, r(0.6, 0.85), r(0.8, 1.2)));
  }
  // Bollards along the quay kerb.
  for (let z = -60; z < 60; z += 6) {
    if (Math.abs(z - 6) < 8 || floodT(z) > 0) continue;
    b.cylinder("yellowPaint", V(L.roadE + 0.3, L.kerb, z), V(L.roadE + 0.3, L.kerb + 0.9, z), 0.1, 8, "metal");
  }
  // Posters on facades.
  for (let i = 0; i < 16; i++) {
    const z = r(-64, 60);
    if (z > -3 && z < 15) continue;
    posters.push({ pos: V(W + 0.01, r(1.4, 2.6), z), normal: V(1, 0, 0), w: 0.85, h: 1.25, idx: Math.floor(rand() * 8) });
  }

  // The flooded stretch: abandoned stall frames are already placed; add half-sunk debris.
  for (let i = 0; i < 6; i++) {
    const z = r(-30, -14);
    const x = r(-5, 3);
    b.box("wood", x, -0.45, z, 1.2, 0.12, 1.0, { rotY: r(0, 3), uv: 1 });
  }

  // Shelters: the flyover deck (no rain under it).
  const shelters = [new THREE.Box3(V(-90, -5, L.fly.z0 + 0.4), V(100, L.fly.under, L.fly.z1 - 0.4))];

  const key = { pos: V(-2, 15, -63), target: V(0, 0, 18), color: C("#cfe3ff") };
  // The floodlight itself on a mast against the south block.
  b.cylinder("darkMetal", V(-3.5, 6, zS + 0.3), V(-2, 15.2, -63.4), 0.12, 6);
  b.box("darkMetal", key.pos.x, key.pos.y + 0.2, key.pos.z - 0.3, 1.2, 0.8, 0.6);
  b.box("glowWhite", key.pos.x, key.pos.y + 0.2, key.pos.z + 0.02, 1.0, 0.6, 0.05);
  cones.push({ top: key.pos.clone().add(V(0, 0.2, 0.1)), dir: key.target.clone().sub(key.pos).normalize(), length: 60, radius: 14, color: C("#cfe3ff"), strength: 0.12 });

  const gh = (x: number, z: number) => groundHeight(x, z);
  const P = (x: number, z: number) => V(x, gh(x, z), z);
  const markers: Record<string, THREE.Vector3[]> = {
    player: [P(-2.5, 57)],
    perch: [V(-9.2, 4.2, 28.5), V(5.6, L.kerb + 24 * 0.18, -45.6)],
    extract: [P(6.6, -60.5)],
    "patrol:street": [P(-3, 40), P(-3, 18), P(-0.5, -6), P(-1, -22), P(-2.5, -44), P(-1, -22), P(-0.5, -6), P(-3, 18)],
    "patrol:market": [P(5.0, 36), P(5.0, 17), P(4.8, -2), P(5.0, 17)],
    "patrol:alley": [P(-8, 23), P(-19, 23.5), P(-12, 22), P(-8.5, 30)],
    "patrol:south": [P(-8, -42.5), P(-16.5, -42.2), P(-8, -42.5), P(1.5, -54), P(6.6, -58), P(1.5, -54)],
  };
  void quality;

  return {
    builder: b,
    markers,
    lights,
    signs,
    windows,
    cones,
    posters,
    vending,
    interiors,
    vents,
    drips,
    bulbs,
    shelters,
    key,
    groundHeight: gh,
  };
}

/** Moves a horizontal plane's vertices to a height function. */
function bend(g: THREE.BufferGeometry, h: (x: number, z: number) => number): void {
  const p = g.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setY(i, h(p.getX(i), p.getZ(i)));
  g.computeVertexNormals();
}

/** A window tile: dark tiles live in columns 0–1, lit tiles in 2–7. */
function winTile(rand: () => number, lit: boolean): number {
  const row = Math.floor(rand() * WIN_ROWS);
  const col = lit ? 2 + Math.floor(rand() * (WIN_COLS - 2)) : Math.floor(rand() * 2);
  return row * WIN_COLS + col;
}

/** A fire escape on a west facade: landings per floor, rails and stairs between them. */
function fireEscape(b: Builder, wx: number, z0: number, z1: number, storeys: number, drips: THREE.Vector3[]): void {
  const depth = 1.15;
  for (let k = 1; k < storeys; k++) {
    const y = L.groundFloor + L.storey * (k - 1) - 0.05;
    b.boxMinMax("grate", wx, y - 0.06, z0, wx + depth, y, z1, { uv: 1 });
    // Rails.
    b.cylinder("darkMetal", V(wx + depth, y + 1.0, z0), V(wx + depth, y + 1.0, z1), 0.022, 4);
    for (const z of [z0, z1]) b.cylinder("darkMetal", V(wx + depth, y, z), V(wx + depth, y + 1.0, z), 0.022, 4);
    for (let z = z0 + 0.4; z < z1; z += 0.4) b.cylinder("darkMetal", V(wx + depth, y, z), V(wx + depth, y + 1.0, z), 0.01, 3);
    drips.push(V(wx + depth, y - 0.06, (z0 + z1) / 2), V(wx + depth * 0.5, y - 0.06, z1 - 0.3));
    // Stairs to the landing above: a slanted stringer pair with treads.
    if (k < storeys - 1) {
      const ya = y;
      const yb = y + L.storey;
      const za = z0 + 0.3;
      const zb = z1 - 0.3;
      for (const x of [wx + 0.15, wx + 0.75]) b.cylinder("darkMetal", V(x, ya, zb), V(x, yb, za), 0.03, 4);
      for (let i = 1; i < 10; i++) {
        const t = i / 10;
        b.box("grate", wx + 0.45, ya + (yb - ya) * t, zb + (za - zb) * t, 0.6, 0.03, 0.25, { uv: 1 });
      }
    }
  }
  // Drop ladder.
  const yl = L.groundFloor - 0.1;
  for (const z of [z1 - 0.9, z1 - 0.45]) b.cylinder("darkMetal", V(wx + depth - 0.1, yl - 2.2, z), V(wx + depth - 0.1, yl, z), 0.018, 4);
  for (let y = yl - 2.1; y < yl; y += 0.3) b.cylinder("darkMetal", V(wx + depth - 0.1, y, z1 - 0.9), V(wx + depth - 0.1, y, z1 - 0.45), 0.012, 3);
}
