// Plan item 59: the act's crop growing on every empty plot in 3D, twelve plants a plot (item 506), as four instanced meshes
// (the plant, its ripe head, and a bare plot's seedlings and their flowers (item 506): four draw calls for the whole field). Stages come from growth.ts; a change grows
// or shrinks each plant over half a second (at once under reduced motion). Drawing only.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Game, Level } from "../engine";
import { cropOf, growthPlots, occupiedPlots, ripeCount, shownCrops, type Crop, type CropStage } from "../growth";
import { withSway } from "./terrain";

/** Plan item 539: a clump of parts as one geometry (each made non-indexed, so polyhedra and cones merge). */
function clump(...parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)))!;
}
const ico = (r: number, sx: number, sy: number, sz: number, x = 0, y = 0, z = 0) => new THREE.IcosahedronGeometry(r, 0).scale(sx, sy, sz).translate(x, y, z);
const dod = (r: number, sx: number, sy: number, sz: number, x = 0, y = 0, z = 0) => new THREE.DodecahedronGeometry(r, 0).scale(sx, sy, sz).translate(x, y, z);

interface Look {
  /** Plan item 539: three or more plant shapes, each slot picks one by a seeded hash (one draw call each), so a bed
   * reads as grown, not wallpapered. */
  plants: Array<() => THREE.BufferGeometry>;
  head: () => THREE.BufferGeometry;
  /** Plant colour at sprout, leaf and ripe; head colour. */
  green: [string, string, string];
  ripe: string;
  /** Plant scale per stage (bare is 0). */
  scale: [number, number, number];
}

const LOOKS: Record<Crop, Look> = {
  wheat: {
    plants: [
      () => new THREE.ConeGeometry(0.1, 0.3, 6).translate(0, 0.15, 0),
      () => clump(new THREE.ConeGeometry(0.07, 0.32, 5).translate(-0.035, 0.16, 0), new THREE.ConeGeometry(0.06, 0.25, 5).translate(0.04, 0.125, 0.025)),
      () => clump(new THREE.ConeGeometry(0.11, 0.26, 7).translate(0, 0.13, 0), new THREE.ConeGeometry(0.045, 0.3, 4).translate(0.05, 0.15, -0.04)),
    ],
    head: () => new THREE.ConeGeometry(0.075, 0.16, 6).rotateX(Math.PI).translate(0, 0.34, 0),
    green: ["#8cbf5a", "#5f9a3a", "#c9a24a"],
    ripe: "#f0cf62",
    scale: [0.5, 0.9, 1.2],
  },
  cabbage: {
    plants: [
      () => ico(0.11, 1, 0.55, 1, 0, 0.05),
      () => dod(0.105, 1.15, 0.5, 1, 0, 0.045),
      () => clump(ico(0.08, 1, 0.6, 1, -0.015, 0.045), ico(0.06, 1.1, 0.45, 0.9, 0.06, 0.03, 0.025), ico(0.058, 0.9, 0.45, 1.1, -0.05, 0.028, -0.04)),
    ],
    head: () => new THREE.IcosahedronGeometry(0.075, 1).translate(0, 0.09, 0),
    green: ["#8cbf5a", "#5f9a3a", "#4f8a5c"],
    ripe: "#b8dca0",
    scale: [0.45, 0.85, 1.15],
  },
  sunflower: {
    plants: [
      () => new THREE.CylinderGeometry(0.014, 0.02, 0.34, 5).translate(0, 0.17, 0),
      () => clump(new THREE.CylinderGeometry(0.014, 0.02, 0.34, 5).translate(0, 0.17, 0), ico(0.05, 1.4, 0.3, 0.8, 0.04, 0.12)),
      () => clump(new THREE.CylinderGeometry(0.013, 0.02, 0.33, 5).translate(0, 0.165, 0), ico(0.045, 1.3, 0.3, 0.8, -0.035, 0.18), ico(0.05, 0.8, 0.3, 1.4, 0, 0.07, 0.035)),
    ],
    head: () => new THREE.CylinderGeometry(0.075, 0.075, 0.025, 10).rotateX(-1.1).translate(0, 0.36, 0.02),
    green: ["#8cbf5a", "#5f9a3a", "#4f7a30"],
    ripe: "#f2c230",
    scale: [0.4, 0.75, 1.15],
  },
  pumpkin: {
    plants: [
      () => ico(0.1, 1.2, 0.45, 1.2, 0, 0.04),
      () => dod(0.1, 1.3, 0.4, 1.05, 0, 0.035),
      () => clump(ico(0.075, 1.2, 0.45, 1, -0.04, 0.035), ico(0.07, 1, 0.45, 1.2, 0.05, 0.03, 0.03), ico(0.03, 3, 0.4, 0.5, 0.02, 0.012, -0.06)),
    ],
    head: () => new THREE.SphereGeometry(0.085, 10, 6).scale(1.2, 0.8, 1.2).translate(0.03, 0.07, 0.02),
    green: ["#8cbf5a", "#5f9a3a", "#5a7a34"],
    ripe: "#e07a26",
    scale: [0.45, 0.85, 1.1],
  },
  lavender: {
    plants: [
      () => ico(0.1, 1, 0.6, 1, 0, 0.05),
      () => dod(0.095, 0.9, 0.7, 0.9, 0, 0.055),
      () => clump(ico(0.075, 1, 0.65, 1, -0.03, 0.045), ico(0.065, 1, 0.6, 1, 0.045, 0.04, 0.03)),
    ],
    head: () => new THREE.ConeGeometry(0.06, 0.16, 6).translate(0, 0.17, 0),
    green: ["#9cb890", "#7f9a76", "#7f9a76"],
    ripe: "#8a6cc0",
    scale: [0.45, 0.85, 1.05],
  },
};

/** Plan item 506: a bare plot's sown drills, a low leafy tuft per plant (a third instanced mesh: one more draw call). */
/** Plan item 506: the flowers the 2D field draws on a bed, as a fleck on each seedling (beds with none: absent). */
const BED_FLOWER: Record<string, string> = {
  lavender: "#b8a0e4", samphire: "#c8553a", garlic: "#f2f0e4", bluebell: "#6a78d8", thrift: "#e690b4", rape: "#e8d040",
  fallow: "#e6c838", sweetpea: "#d27ab8", meadow: "#f2e6a0", strawberry: "#d8402e", clover: "#e6a0c0", seakale: "#f0ecd8",
};
const FLECK_GEO = () => new THREE.IcosahedronGeometry(0.03, 0).scale(1.2, 0.7, 1.2).translate(0.03, 0.06, -0.02);
const hsl = { h: 0, s: 0, l: 0 };
const bedHsl = { h: 0, s: 0, l: 0 };
function seedlingColour(green: string, bed: THREE.Color | undefined): THREE.Color {
  if (!bed) return new THREE.Color(green);
  new THREE.Color(green).getHSL(hsl);
  bed.getHSL(bedHsl);
  return new THREE.Color().setHSL(hsl.h, hsl.s * 0.8, Math.min(0.8, Math.max(0.1, bedHsl.l * 0.96)));
}
/** Plan item 539: the sown drills' tufts in three shapes too. */
const SEEDLING_GEOS: Array<() => THREE.BufferGeometry> = [
  () => ico(0.085, 1.35, 0.5, 1.15, 0, 0.028),
  () => dod(0.08, 1.3, 0.45, 1.1, 0, 0.026),
  () => clump(ico(0.06, 1.2, 0.55, 1, -0.035, 0.026), ico(0.055, 1, 0.5, 1.2, 0.04, 0.022, 0.02)),
];

/** Plan item 539: one logical instanced set drawn as several InstancedMeshes, one per shape; slot i draws in shape
 * `pick[i]` at its own index there. */
class Variants {
  readonly meshes: THREE.InstancedMesh[];
  private readonly at: Array<[number, number]> = [];
  constructor(geos: Array<() => THREE.BufferGeometry>, mat: THREE.Material, pick: readonly number[]) {
    const counts = geos.map(() => 0);
    for (const v of pick) this.at.push([v % geos.length, counts[v % geos.length]!++]);
    this.meshes = geos.map((g, k) => new THREE.InstancedMesh(g(), mat, Math.max(1, counts[k]!)));
    this.meshes.forEach((m, k) => (m.count = counts[k]!));
  }
  setMatrixAt(i: number, m: THREE.Matrix4): void {
    const [k, j] = this.at[i]!;
    this.meshes[k]!.setMatrixAt(j, m);
  }
  setColorAt(i: number, c: THREE.Color): void {
    const [k, j] = this.at[i]!;
    this.meshes[k]!.setColorAt(j, c);
  }
  shapeOf(i: number): number {
    return this.at[i]![0];
  }
  touch(colour = false): void {
    for (const m of this.meshes) {
      m.instanceMatrix.needsUpdate = true;
      if (colour && m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }
}

interface Slot {
  key: string;
  x: number;
  y: number;
  z: number;
  ry: number;
  jitter: number;
  /** Shown plant and head scale, eased toward the stage's. */
  plant: number;
  head: number;
  seed: number;
}

export class Crops {
  readonly group = new THREE.Group();
  private plants: Variants;
  private heads: THREE.InstancedMesh;
  private seedlings: Variants;
  private flecks: THREE.InstancedMesh;
  /** Slots whose bed flowers (a fleck shown with the seedling). */
  private readonly flowering: boolean[] = [];
  private slots: Slot[] = [];
  private look: Look;
  private sig = "";
  private moving = true;
  private wonAt: number | null = null;
  private game: Game | null = null;
  private readonly mx = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly p = new THREE.Vector3();
  private readonly sc = new THREE.Vector3();

  constructor(
    level: Level,
    heightAt: (x: number, z: number) => number,
    private readonly canvas: HTMLCanvasElement,
    private readonly reducedMotion: boolean,
    bedTints: ReadonlyMap<string, THREE.Color> = new Map(),
    bedLooks: ReadonlyMap<string, string> = new Map(),
  ) {
    this.look = LOOKS[cropOf(level)];
    // Plan item 506: three drills of four plants a plot (were four plants, which vanished at play distance and left
    // the bed reading as bare paving), close enough that neighbours touch and each drill reads as a row.
    const spots: Array<[number, number]> = [];
    for (const v of [0.24, 0.5, 0.76]) for (const u of [0.18, 0.39, 0.61, 0.82]) spots.push([u + (v === 0.5 ? 0.04 : 0), v]);
    for (const plot of growthPlots(level)) {
      spots.forEach(([u, v], i) => {
        const j = Math.abs(Math.sin(level.id * 3.1 + plot.col * 12.9898 + plot.row * 78.233 + i * 4.7)) % 1;
        const x = plot.col + u + (j - 0.5) * 0.04;
        const z = plot.row + v + (j - 0.5) * 0.03;
        this.slots.push({ key: plot.key, x, y: heightAt(plot.col + 0.5, plot.row + 0.5) + 0.03, z, ry: j * Math.PI * 2, jitter: 0.88 + j * 0.24, plant: 0, head: 0, seed: 0 });
      });
    }
    const n = Math.max(1, this.slots.length);
    // Plan item 506: the crop sways in the breeze with the field's grass (the same clock, each plant out of step); a
    // plant and its head share the slot's phase, so the head stays on its stem.
    const mat = (key: string) => withSway(new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.85, metalness: 0, flatShading: true }), 0.008, `hedgerow-crop-${key}`);
    // Plan item 539: each slot's shape from a seeded hash of the level, plot and drill position (not its index, so
    // neighbouring plants differ); the seedling's shape is hashed apart from the plant's.
    const pick = (salt: number) => this.slots.map((s) => (Math.imul(Math.floor(s.x * 997) ^ Math.imul(Math.floor(s.z * 787), 40503) ^ (level.id + salt), 2654435761) >>> 0));
    this.plants = new Variants(this.look.plants, mat("plant"), pick(11));
    this.heads = new THREE.InstancedMesh(this.look.head(), mat("head"), n);
    this.seedlings = new Variants(SEEDLING_GEOS, mat("seedling"), pick(29));
    this.flecks = new THREE.InstancedMesh(FLECK_GEO(), mat("fleck"), n);
    for (const m of [...this.plants.meshes, this.heads, ...this.seedlings.meshes, this.flecks]) {
      m.castShadow = false;
      m.receiveShadow = true;
      m.frustumCulled = false;
      m.name = "crops";
      this.group.add(m);
    }
    const ripe = new THREE.Color(this.look.ripe);
    for (let i = 0; i < n; i++) {
      this.heads.setColorAt(i, ripe);
      this.plants.setColorAt(i, new THREE.Color(this.look.green[0]));
      // the crop's green at the bed's own lightness, so a plot keeps its value beside the lane (item 486's 1.6:1 on
      // a phone: pale leaves lifted a dark bed toward a pale lane, dark ones sank a pale bed toward a dark lane)
      this.seedlings.setColorAt(i, seedlingColour(this.look.green[0], bedTints.get(this.slots[i]?.key ?? "")));
      const flower = BED_FLOWER[bedLooks.get(this.slots[i]?.key ?? "") ?? ""];
      // two seedlings in three flower, so a bed reads as sprays among leaves
      this.flowering[i] = !!flower && i % 3 !== 1;
      this.flecks.setColorAt(i, new THREE.Color(flower ?? "#ffffff"));
    }
  }

  /** Plan item 539 (tests): how many distinct plant and seedling shapes stand on the field (any slot shown). */
  shapesShown(): number {
    let n = 0;
    for (const set of [this.plants, this.seedlings]) {
      const shown = new Set<number>();
      this.slots.forEach((s, i) => {
        if ((set === this.plants ? s.plant : s.seed) > 0.05) shown.add(set.shapeOf(i));
      });
      n += shown.size;
    }
    return n;
  }

  /** Reads the field off the game, retargets each plant, eases them and writes the matrices that moved. */
  sync(game: Game, t: number, dt: number): void {
    if (this.game !== game) {
      this.game = game;
      this.wonAt = null;
      this.sig = "";
    }
    if (game.phase === "won") this.wonAt ??= t;
    else this.wonAt = null;
    const stages = shownCrops(game, this.wonAt === null ? null : t - this.wonAt);
    const occupied = occupiedPlots(game);
    let sig = "";
    for (const [k, st] of stages) sig += occupied.has(k) ? "x" : st;
    if (sig !== this.sig) {
      this.sig = sig;
      this.moving = true;
      this.canvas.dataset.ripe = String(ripeCount(stages, occupied));
      this.canvas.dataset.cropSig = sig;
      this.canvas.dataset.harvest = this.wonAt === null ? "" : "1";
      const col = new THREE.Color();
      this.slots.forEach((s, i) => {
        const st = occupied.has(s.key) ? 0 : (stages.get(s.key) ?? 0);
        this.plants.setColorAt(i, col.set(this.look.green[Math.max(0, st - 1)]!));
      });
      this.plants.touch(true);
    }
    if (!this.moving) return;
    const k = this.reducedMotion ? 1 : Math.min(1, dt * 6);
    let still = true;
    this.slots.forEach((s, i) => {
      const st = (occupied.has(s.key) ? 0 : (stages.get(s.key) ?? 0)) as CropStage;
      // Plan item 506: a bare plot shows its sown drills as seedlings (the 2D field draws planted rows from the start;
      // with nothing on them the 3D beds read as paving); a tower's plot stays clear.
      const wantPlant = st === 0 ? 0 : this.look.scale[st - 1]! * s.jitter;
      const wantSeed = st === 0 && !occupied.has(s.key) ? s.jitter : 0;
      const wantHead = st === 3 ? s.jitter : 0;
      s.plant += (wantPlant - s.plant) * k;
      s.head += (wantHead - s.head) * k;
      if (Math.abs(wantPlant - s.plant) < 0.005) s.plant = wantPlant;
      else still = false;
      if (Math.abs(wantHead - s.head) < 0.005) s.head = wantHead;
      else still = false;
      s.seed += (wantSeed - s.seed) * k;
      if (Math.abs(wantSeed - s.seed) < 0.005) s.seed = wantSeed;
      else still = false;
      this.q.setFromAxisAngle(this.up, s.ry);
      this.p.set(s.x, s.y, s.z);
      this.mx.compose(this.p, this.q, this.sc.setScalar(Math.max(1e-4, s.plant)));
      this.plants.setMatrixAt(i, this.mx);
      this.mx.compose(this.p, this.q, this.sc.setScalar(Math.max(1e-4, s.seed)));
      this.seedlings.setMatrixAt(i, this.mx);
      this.mx.compose(this.p, this.q, this.sc.setScalar(this.flowering[i] ? Math.max(1e-4, s.seed) : 1e-4));
      this.flecks.setMatrixAt(i, this.mx);
      // The head sits on the plant's top, so it rides the plant's scale.
      this.q.setFromAxisAngle(this.up, s.ry * 0.3);
      this.mx.compose(this.p, this.q, this.sc.set(Math.max(1e-4, s.head) * Math.max(0.6, s.plant), Math.max(1e-4, s.head) * Math.max(0.6, s.plant), Math.max(1e-4, s.head) * Math.max(0.6, s.plant)));
      this.heads.setMatrixAt(i, this.mx);
    });
    this.plants.touch();
    this.heads.instanceMatrix.needsUpdate = true;
    this.seedlings.touch();
    this.flecks.instanceMatrix.needsUpdate = true;
    if (this.heads.instanceColor) this.heads.instanceColor.needsUpdate = true;
    this.moving = !still;
  }
}
