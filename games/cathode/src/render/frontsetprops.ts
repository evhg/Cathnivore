// Plan item 498: each class's set dressed with its own props in 3D, round her on the pick's stage, so the set reads
// as a place (the critique saw a grey box with a tripod, a bottle and a crate). The stoop's one prop per class (item
// 338) stays; these add three more each:
//   Ghost: a wet parapet ledge, a rooftop gooseneck vent and a rifle case leaning on the ledge.
//   Butcher: an overhead rail of hooks with sides on them, a steel locker and a chopping block with its cleaver.
//   Gunslinger: a card table (cards, chips) under a hanging green-shaded lamp, and a bentwood chair.
//   Wirewitch: cable runs (overhead and on the floor), a terminal on a crate, a server rack with its lights.
//   Fixer: a workbench under a pegboard, a bundle of charges with a lit timer on it, and two jerrycans.
// Built as pure geometry (testable without a canvas): per class one lit body (vertex-coloured) and one glowing part
// (HDR vertex colours, unlit), so a class costs two draw calls; only one class shows at a time. Coordinates are the
// stoop's local frame (x across, y up, z toward the lens; she stands at the origin, the door 2.1 m behind her). The
// test-fire crate stands at (0.42, -0.6) (upright at (0.42, -0.9)), so nothing here stands in x 0.1-0.8 near her.

import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export interface SetPropsBuild {
  /** The props' names, for the pick's checks (`data-set-props`). */
  names: string[];
  /** Each prop's local box (the stoop's frame), for its projected box on the pick. */
  boxes: Record<string, THREE.Box3>;
  body: THREE.BufferGeometry;
  glow: THREE.BufferGeometry | null;
}

/** The stoop's own prop per class (item 338), counted with these. */
export const STOOP_PROP: Record<string, string> = {
  ghost: "spotting-scope",
  butcher: "meat-hook",
  gunslinger: "wanted-bill",
  wirewitch: "junction-box",
  fixer: "cash-case",
};

class Kit {
  readonly body: THREE.BufferGeometry[] = [];
  readonly glow: THREE.BufferGeometry[] = [];
  private readonly c = new THREE.Color();
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  readonly boxes: Record<string, THREE.Box3> = {};
  private cur = "";
  /** The parts added from here on belong to prop `name`. */
  begin(name: string): this {
    this.cur = name;
    return this;
  }

  /** Adds `g` coloured `hex` (sRGB; `gain` scales it past 1 for the glowing parts), rotated (x, y, z) then moved. */
  add(g: THREE.BufferGeometry, hex: number, at: [number, number, number], rot: [number, number, number] = [0, 0, 0], glow = 0): this {
    this.q.setFromEuler(this.e.set(rot[0], rot[1], rot[2]));
    this.m.compose(new THREE.Vector3(...at), this.q, new THREE.Vector3(1, 1, 1));
    const geo = g;
    geo.applyMatrix4(this.m);
    this.c.setHex(hex);
    if (glow) this.c.multiplyScalar(glow);
    const n = geo.getAttribute("position").count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      col[i * 3] = this.c.r;
      col[i * 3 + 1] = this.c.g;
      col[i * 3 + 2] = this.c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    (glow ? this.glow : this.body).push(geo);
    geo.computeBoundingBox();
    if (this.cur && geo.boundingBox) (this.boxes[this.cur] ??= new THREE.Box3()).union(geo.boundingBox);
    return this;
  }
  box(w: number, h: number, d: number, hex: number, at: [number, number, number], rot?: [number, number, number], glow = 0): this {
    return this.add(new THREE.BoxGeometry(w, h, d), hex, at, rot, glow);
  }
  cyl(rt: number, rb: number, h: number, hex: number, at: [number, number, number], rot?: [number, number, number], seg = 12, glow = 0): this {
    return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), hex, at, rot, glow);
  }
  /** A tube along `pts`. */
  tube(pts: Array<[number, number, number]>, r: number, hex: number, glow = 0): this {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    return this.add(new THREE.TubeGeometry(curve, Math.max(8, pts.length * 6), r, 6), hex, [0, 0, 0], [0, 0, 0], glow);
  }
}

/** Merges a list (indexed and non-indexed alike), keeping position, normal and colour only. */
function merge(list: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  if (!list.length) return null;
  const flat = list.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(n.attributes)) if (k !== "position" && k !== "normal" && k !== "color") n.deleteAttribute(k);
    return n;
  });
  const out = mergeGeometries(flat, false);
  for (const g of list) g.dispose();
  for (const g of flat) g.dispose();
  return out;
}

const CONCRETE = 0x5d6266;
const WET = 0x8a9399;
const STEEL = 0x8c9196;
const DARK = 0x1b1c1f;

function ghost(k: Kit): string[] {
  k.begin("parapet-ledge");
  // The parapet she stands inside: a low wall each side, its coping a lighter wet stone.
  for (const [x0, x1] of [
    [-2.8, -0.55],
    [0.75, 2.8],
  ] as const) {
    const w = x1 - x0;
    const z = x0 < 0 ? -1.5 : -1.75;
    k.box(w, 0.62, 0.3, CONCRETE, [(x0 + x1) / 2, 0.31, z]);
    k.box(w + 0.06, 0.06, 0.38, WET, [(x0 + x1) / 2, 0.65, z]);
    // Puddles' sheen along the coping, catching the city's cyan.
    k.box(w * 0.6, 0.006, 0.14, 0x5fd6ee, [(x0 + x1) / 2, 0.684, z + 0.04], [0, 0, 0], 1.6);
  }
  k.begin("gooseneck-vent");
  // A rooftop gooseneck vent behind the right wall: a pipe and its hooded bend.
  const vx = 0.42;
  const vz = -2.0;
  k.cyl(0.11, 0.11, 1.6, STEEL, [vx, 0.8, vz]);
  k.add(new THREE.TorusGeometry(0.16, 0.11, 8, 12, Math.PI), STEEL, [vx + 0.16, 1.6, vz]);
  k.cyl(0.13, 0.15, 0.12, DARK, [vx + 0.32, 1.54, vz]);
  // A red aircraft lamp on the vent's crown.
  k.add(new THREE.SphereGeometry(0.035, 8, 6), 0xff3040, [vx + 0.16, 1.8, vz], [0, 0, 0], 6);
  k.begin("rifle-case");
  // The rifle case leaning on the left wall, its latches catching the light.
  k.box(0.26, 1.15, 0.09, 0x3a3e42, [-0.75, 0.56, -1.25], [0, 0.2, 0.22]);
  k.box(0.05, 0.03, 0.1, STEEL, [-0.78, 0.72, -1.2], [0, 0.2, 0.22]);
  k.box(0.05, 0.03, 0.1, STEEL, [-0.68, 0.32, -1.2], [0, 0.2, 0.22]);
  return ["parapet-ledge", "gooseneck-vent", "rifle-case"];
}

function butcher(k: Kit): string[] {
  k.begin("hook-rail");
  // The rail overhead, across the locker, and its hooks; sides of meat on the far ones.
  k.box(5.2, 0.06, 0.06, STEEL, [0, 2.5, -1.35]);
  for (const x of [-1.9, -1.3, 0.85, 1.35, 1.9]) {
    k.cyl(0.008, 0.008, 0.3, STEEL, [x, 2.33, -1.35], [0, 0, 0], 5);
    k.add(new THREE.TorusGeometry(0.06, 0.011, 6, 12, Math.PI * 1.4), STEEL, [x, 2.13, -1.35], [0, 0, Math.PI * 0.8]);
  }
  for (const x of [-1.3, 0.85]) {
    const side = new THREE.SphereGeometry(0.22, 12, 10);
    side.scale(1, 2.4, 0.45);
    k.add(side, 0x8a2a24, [x, 1.55, -1.35]);
    const fat = new THREE.SphereGeometry(0.2, 10, 8);
    fat.scale(0.4, 2.2, 0.5);
    k.add(fat, 0xe6d6c0, [x + 0.12, 1.53, -1.3]);
  }
  k.begin("steel-locker");
  // A tall steel locker right of the door, two doors, vents, a padlock.
  const lx = 0.5;
  const lz = -1.95;
  k.box(0.7, 1.9, 0.45, 0x8a9298, [lx, 0.95, lz]);
  k.box(0.01, 1.84, 0.01, DARK, [lx, 0.95, lz + 0.23]);
  for (let i = 0; i < 4; i++) for (const dx of [-0.17, 0.17]) k.box(0.22, 0.02, 0.01, DARK, [lx + dx, 1.7 - i * 0.06, lz + 0.23]);
  k.box(0.05, 0.07, 0.03, 0xc8a040, [lx + 0.05, 1.05, lz + 0.24]);
  k.begin("chopping-block");
  // The chopping block left of her, a cleaver bitten into it.
  const cx = -0.8;
  const cz = -1.4;
  k.cyl(0.24, 0.27, 0.72, 0x6a4428, [cx, 0.36, cz], [0, 0, 0], 16);
  k.cyl(0.235, 0.235, 0.02, 0xb07a50, [cx, 0.73, cz], [0, 0, 0], 16);
  k.box(0.26, 0.15, 0.012, 0xd0d6dc, [cx + 0.05, 0.81, cz], [0, 0.4, -0.15]);
  k.box(0.14, 0.03, 0.03, 0x2a1810, [cx + 0.22, 0.89, cz + 0.08], [0, 0.4, -0.15]);
  return ["hook-rail", "steel-locker", "chopping-block"];
}

function gunslinger(k: Kit): string[] {
  k.begin("card-table");
  // The card table: a round baize top on a pedestal, a hand of cards and a stack of chips.
  const tx = 0.55;
  const tz = -1.85;
  k.cyl(0.5, 0.5, 0.05, 0x1f5a34, [tx, 0.76, tz], [0, 0, 0], 24);
  k.cyl(0.52, 0.52, 0.03, 0x4a2a16, [tx, 0.73, tz], [0, 0, 0], 24);
  k.cyl(0.05, 0.07, 0.7, 0x3a2010, [tx, 0.36, tz]);
  k.cyl(0.28, 0.3, 0.03, 0x3a2010, [tx, 0.015, tz]);
  for (let i = 0; i < 5; i++) k.box(0.07, 0.003, 0.1, 0xf4ecd8, [tx - 0.2 + i * 0.05, 0.79, tz + 0.15], [0, 0.25 * (i - 2), 0]);
  for (const [dx, dz, n, hex] of [
    [0.15, -0.05, 6, 0xc02028],
    [0.24, 0.05, 4, 0x1a1a1a],
    [0.08, 0.12, 3, 0xe8e0d0],
  ] as const)
    for (let i = 0; i < n; i++) k.cyl(0.03, 0.03, 0.012, hex, [tx + dx, 0.795 + i * 0.013, tz + dz], [0, 0, 0], 10);
  // A whisky bottle.
  k.cyl(0.035, 0.04, 0.2, 0x6a3a10, [tx - 0.25, 0.88, tz - 0.12]);
  k.cyl(0.012, 0.02, 0.07, 0x6a3a10, [tx - 0.25, 1.0, tz - 0.12]);
  k.begin("bentwood-chair");
  // A bentwood chair at her left, turned toward the table.
  const cx = -0.85;
  const cz = -1.3;
  k.cyl(0.21, 0.21, 0.04, 0x5a3418, [cx, 0.46, cz], [0, 0, 0], 16);
  for (const [dx, dz] of [
    [-0.15, -0.15],
    [0.15, -0.15],
    [-0.15, 0.15],
    [0.15, 0.15],
  ] as const)
    k.cyl(0.015, 0.02, 0.46, 0x3a2010, [cx + dx * 1.05, 0.23, cz + dz * 1.05], [dz * 0.4, 0, -dx * 0.4], 6);
  k.add(new THREE.TorusGeometry(0.19, 0.018, 6, 16, Math.PI), 0x3a2010, [cx, 0.68, cz - 0.18], [0, 0, 0]);
  k.cyl(0.015, 0.015, 0.24, 0x3a2010, [cx - 0.19, 0.58, cz - 0.18], [0, 0, 0], 6);
  k.cyl(0.015, 0.015, 0.24, 0x3a2010, [cx + 0.19, 0.58, cz - 0.18], [0, 0, 0], 6);
  k.begin("hanging-lamp");
  // A lamp on its cord over the chair: a green glass shade, the bulb under it glowing, its pool on the seat.
  k.cyl(0.006, 0.006, 0.9, DARK, [cx, 2.35, cz], [0, 0, 0], 4);
  k.add(new THREE.ConeGeometry(0.24, 0.15, 18, 1, true), 0x2a9a50, [cx, 1.85, cz]);
  k.add(new THREE.SphereGeometry(0.05, 10, 8), 0xffd890, [cx, 1.78, cz], [0, 0, 0], 8);
  k.cyl(0.2, 0.2, 0.003, 0xffc860, [cx, 0.483, cz], [0, 0, 0], 20, 0.45);
  return ["card-table", "bentwood-chair", "hanging-lamp"];
}

function wirewitch(k: Kit): string[] {
  k.begin("cable-runs");
  // Cable runs: three sagging overhead and a bundle snaking over the floor to the terminal.
  for (const [y, hex] of [
    [2.55, 0x111316],
    [2.4, 0x23262a],
    [2.7, 0x111316],
  ] as const)
    k.tube(
      [
        [-2.8, y, -1.6],
        [-1.2, y - 0.35, -1.5],
        [0, y - 0.45, -1.5],
        [1.2, y - 0.3, -1.5],
        [2.8, y + 0.05, -1.6],
      ],
      0.018,
      hex,
    );
  k.tube(
    [
      [-2.2, 0.03, -1.6],
      [-1.4, 0.03, -1.3],
      [-0.9, 0.03, -1.45],
      [0.2, 0.03, -1.6],
      [0.85, 0.03, -1.75],
      [0.78, 0.5, -2.0],
      [0.85, 0.96, -2.0],
    ],
    0.03,
    0x16181b,
  );
  // One lit run: a data line pulsing magenta along the floor bundle.
  k.tube(
    [
      [-2.2, 0.06, -1.55],
      [-1.4, 0.06, -1.25],
      [-0.9, 0.06, -1.4],
      [0.2, 0.06, -1.55],
      [1.0, 0.06, -1.35],
    ],
    0.008,
    0xe05cff,
    3,
  );
  k.begin("crt-terminal");
  // The terminal on a wall shelf at her right, over the crate: a beige CRT, its screen lit green.
  const tx = 0.45;
  const tz = -1.9;
  k.box(0.7, 0.04, 0.45, 0x3a3226, [tx, 0.98, tz]);
  k.box(0.04, 0.3, 0.04, 0x222222, [tx - 0.3, 0.83, tz - 0.18]);
  k.box(0.04, 0.3, 0.04, 0x222222, [tx + 0.3, 0.83, tz - 0.18]);
  k.box(0.46, 0.4, 0.42, 0xa89c84, [tx, 1.21, tz], [0, -0.3, 0]);
  k.box(0.36, 0.28, 0.01, 0x30ff9a, [tx + Math.sin(-0.3) * 0.215, 1.22, tz + Math.cos(-0.3) * 0.215], [0, -0.3, 0], 2.2);
  k.begin("server-rack");
  // A server rack at the left: a tall black cabinet with rows of status lights.
  k.box(0.6, 2.0, 0.6, 0x24272c, [-1.25, 1.0, -1.85]);
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 4; c++) {
      const lit = (r * 7 + c * 3) % 5;
      if (lit > 2) continue;
      k.box(0.03, 0.02, 0.01, lit === 0 ? 0x5ff6e8 : lit === 1 ? 0x40ff70 : 0xff9a30, [-1.45 + c * 0.1, 0.4 + r * 0.17, -1.545], [0, 0, 0], 4);
    }
  return ["cable-runs", "crt-terminal", "server-rack"];
}

function fixer(k: Kit): string[] {
  k.begin("workbench");
  // The workbench at her right, a pegboard of tools over it.
  const bx = 0.6;
  const bz = -1.8;
  k.box(1.2, 0.07, 0.6, 0x8a6440, [bx, 0.9, bz]);
  for (const dx of [-0.54, 0.54]) for (const dz of [-0.24, 0.24]) k.box(0.06, 0.88, 0.06, 0x4a3420, [bx + dx, 0.44, bz + dz]);
  k.box(1.1, 0.04, 0.5, 0x4a3420, [bx, 0.25, bz]);
  k.box(1.3, 0.85, 0.03, 0x9a8a68, [bx, 1.55, bz - 0.32]);
  for (const [dx, dy, w, h, hex] of [
    [-0.4, 0.15, 0.04, 0.38, STEEL],
    [-0.25, 0.1, 0.22, 0.05, 0xc02020],
    [0.05, 0.2, 0.05, 0.3, STEEL],
    [0.3, 0.05, 0.28, 0.1, 0x2a2a2a],
    [-0.1, -0.2, 0.3, 0.04, 0xc8a040],
  ] as const)
    k.box(w, h, 0.03, hex, [bx + dx, 1.55 + dy, bz - 0.29]);
  // A vice on the bench's end.
  k.box(0.14, 0.12, 0.16, 0x3a5a70, [bx + 0.5, 1.0, bz + 0.15]);
  k.begin("charges");
  // The charges: three red sticks taped together, a timer strapped on, its digits lit.
  for (const dx of [-0.05, 0, 0.05]) k.cyl(0.026, 0.026, 0.32, 0xb8221c, [bx - 0.2 + dx, 0.96, bz + 0.1], [0, 0, Math.PI / 2], 10);
  k.box(0.04, 0.09, 0.09, 0x222222, [bx - 0.28, 0.96, bz + 0.1]);
  k.box(0.04, 0.09, 0.09, 0x222222, [bx - 0.12, 0.96, bz + 0.1]);
  k.box(0.12, 0.07, 0.03, 0x111111, [bx - 0.2, 1.0, bz + 0.15]);
  k.box(0.09, 0.035, 0.005, 0xff2a20, [bx - 0.2, 1.0, bz + 0.167], [0, 0, 0], 5);
  k.begin("jerrycans");
  // Two jerrycans at her left.
  for (const [x, z, ry] of [
    [-0.8, -1.2, 0.3],
    [-1.1, -1.45, -0.2],
  ] as const) {
    k.box(0.3, 0.45, 0.16, 0x9a2018, [x, 0.225, z], [0, ry, 0]);
    k.box(0.16, 0.04, 0.05, 0x2a2a2a, [x, 0.47, z], [0, ry, 0]);
    k.cyl(0.03, 0.03, 0.06, 0xc8b040, [x + 0.08, 0.48, z], [0, ry, 0], 8);
  }
  return ["workbench", "charges", "jerrycans"];
}

const BUILD: Record<string, (k: Kit) => string[]> = { ghost, butcher, gunslinger, wirewitch, fixer };

export function buildSetProps(cls: string): SetPropsBuild {
  const k = new Kit();
  const names = BUILD[cls]?.(k) ?? [];
  const body = merge(k.body) ?? new THREE.BufferGeometry();
  return { names: [STOOP_PROP[cls] ?? "", ...names].filter(Boolean), boxes: k.boxes, body, glow: merge(k.glow) };
}
