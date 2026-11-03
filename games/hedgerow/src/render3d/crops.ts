// Plan item 59: the act's crop growing on every empty plot in 3D, four plants a plot, as two instanced meshes
// (the plant and its ripe head: two draw calls for the whole field). Stages come from growth.ts; a change grows
// or shrinks each plant over half a second (at once under reduced motion). Drawing only.

import * as THREE from "three";
import type { Game, Level } from "../engine";
import { cropOf, growthPlots, occupiedPlots, ripeCount, shownCrops, type Crop, type CropStage } from "../growth";

interface Look {
  plant: () => THREE.BufferGeometry;
  head: () => THREE.BufferGeometry;
  /** Plant colour at sprout, leaf and ripe; head colour. */
  green: [string, string, string];
  ripe: string;
  /** Plant scale per stage (bare is 0). */
  scale: [number, number, number];
}

const LOOKS: Record<Crop, Look> = {
  wheat: {
    plant: () => new THREE.ConeGeometry(0.07, 0.26, 5).translate(0, 0.13, 0),
    head: () => new THREE.ConeGeometry(0.05, 0.12, 5).rotateX(Math.PI).translate(0, 0.3, 0),
    green: ["#8cbf5a", "#5f9a3a", "#c9a24a"],
    ripe: "#e7c25a",
    scale: [0.45, 0.8, 1.1],
  },
  cabbage: {
    plant: () => new THREE.IcosahedronGeometry(0.11, 0).scale(1, 0.55, 1).translate(0, 0.05, 0),
    head: () => new THREE.IcosahedronGeometry(0.075, 1).translate(0, 0.09, 0),
    green: ["#8cbf5a", "#5f9a3a", "#4f8a5c"],
    ripe: "#b8dca0",
    scale: [0.45, 0.85, 1.15],
  },
  sunflower: {
    plant: () => new THREE.CylinderGeometry(0.014, 0.02, 0.34, 5).translate(0, 0.17, 0),
    head: () => new THREE.CylinderGeometry(0.075, 0.075, 0.025, 10).rotateX(-1.1).translate(0, 0.36, 0.02),
    green: ["#8cbf5a", "#5f9a3a", "#4f7a30"],
    ripe: "#f2c230",
    scale: [0.4, 0.75, 1.15],
  },
  pumpkin: {
    plant: () => new THREE.IcosahedronGeometry(0.1, 0).scale(1.2, 0.45, 1.2).translate(0, 0.04, 0),
    head: () => new THREE.SphereGeometry(0.085, 10, 6).scale(1.2, 0.8, 1.2).translate(0.03, 0.07, 0.02),
    green: ["#8cbf5a", "#5f9a3a", "#5a7a34"],
    ripe: "#e07a26",
    scale: [0.45, 0.85, 1.1],
  },
  lavender: {
    plant: () => new THREE.IcosahedronGeometry(0.1, 0).scale(1, 0.6, 1).translate(0, 0.05, 0),
    head: () => new THREE.ConeGeometry(0.06, 0.16, 6).translate(0, 0.17, 0),
    green: ["#9cb890", "#7f9a76", "#7f9a76"],
    ripe: "#8a6cc0",
    scale: [0.45, 0.85, 1.05],
  },
};

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
}

export class Crops {
  readonly group = new THREE.Group();
  private plants: THREE.InstancedMesh;
  private heads: THREE.InstancedMesh;
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
  ) {
    this.look = LOOKS[cropOf(level)];
    const spots: Array<[number, number]> = [
      [0.31, 0.32],
      [0.69, 0.3],
      [0.3, 0.7],
      [0.7, 0.68],
    ];
    for (const plot of growthPlots(level)) {
      spots.forEach(([u, v], i) => {
        const j = Math.abs(Math.sin(level.id * 3.1 + plot.col * 12.9898 + plot.row * 78.233 + i * 4.7)) % 1;
        const x = plot.col + u + (j - 0.5) * 0.06;
        const z = plot.row + v + (j - 0.5) * 0.05;
        this.slots.push({ key: plot.key, x, y: heightAt(plot.col + 0.5, plot.row + 0.5) + 0.03, z, ry: j * Math.PI * 2, jitter: 0.88 + j * 0.24, plant: 0, head: 0 });
      });
    }
    const n = Math.max(1, this.slots.length);
    const mat = () => new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.85, metalness: 0, flatShading: true });
    this.plants = new THREE.InstancedMesh(this.look.plant(), mat(), n);
    this.heads = new THREE.InstancedMesh(this.look.head(), mat(), n);
    for (const m of [this.plants, this.heads]) {
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
    }
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
      if (this.plants.instanceColor) this.plants.instanceColor.needsUpdate = true;
    }
    if (!this.moving) return;
    const k = this.reducedMotion ? 1 : Math.min(1, dt * 6);
    let still = true;
    this.slots.forEach((s, i) => {
      const st = (occupied.has(s.key) ? 0 : (stages.get(s.key) ?? 0)) as CropStage;
      const wantPlant = st === 0 ? 0 : this.look.scale[st - 1]! * s.jitter;
      const wantHead = st === 3 ? s.jitter : 0;
      s.plant += (wantPlant - s.plant) * k;
      s.head += (wantHead - s.head) * k;
      if (Math.abs(wantPlant - s.plant) < 0.005) s.plant = wantPlant;
      else still = false;
      if (Math.abs(wantHead - s.head) < 0.005) s.head = wantHead;
      else still = false;
      this.q.setFromAxisAngle(this.up, s.ry);
      this.p.set(s.x, s.y, s.z);
      this.mx.compose(this.p, this.q, this.sc.setScalar(Math.max(1e-4, s.plant)));
      this.plants.setMatrixAt(i, this.mx);
      // The head sits on the plant's top, so it rides the plant's scale.
      this.q.setFromAxisAngle(this.up, s.ry * 0.3);
      this.mx.compose(this.p, this.q, this.sc.set(Math.max(1e-4, s.head) * Math.max(0.6, s.plant), Math.max(1e-4, s.head) * Math.max(0.6, s.plant), Math.max(1e-4, s.head) * Math.max(0.6, s.plant)));
      this.heads.setMatrixAt(i, this.mx);
    });
    this.plants.instanceMatrix.needsUpdate = true;
    this.heads.instanceMatrix.needsUpdate = true;
    if (this.heads.instanceColor) this.heads.instanceColor.needsUpdate = true;
    this.moving = !still;
  }
}
