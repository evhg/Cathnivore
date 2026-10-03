// Hedgerow's 3D renderer (three.js): the owner asked for "StarCraft 2 type visuals" (2026-10-02). A lit,
// shadowed, tone-mapped battlefield with bloom; procedural models (models.ts) for every tower tier and
// specialisation, every enemy, Cath and the farmhouse; effects (fx.ts) for every engine event. It only
// reads the Game. Same interface as the 2D Renderer (render.ts), which stays as the fallback when WebGL
// isn't available.

import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { cathSvg } from "../../../../shared/cath/cath";
import {
  ENEMIES,
  MEGAS,
  bridgeOpen,
  setPiece,
  charmed,
  enemyPoint,
  hasTwist,
  isBig,
  isRevealed,
  maxHpOf,
  towerAt,
  towerStats,
  type Enemy,
  type Game,
  type GameEvent,
  type Tower,
  type TowerKind,
} from "../engine";
import { actLight, actMood, matte } from "./palette";
import { buildCath, dressCath, buildEnemy, buildMega, buildTower, enemyLift, enemyScale } from "./models";
import { buildGround, type Ground } from "./terrain";
import { Birds, Debris, Floaters, Motes, Sparks, Transients, disposeOwn, sharedGeometry } from "./fx";

interface TowerView {
  obj: THREE.Group;
  sig: string;
  fired: number;
  pop: number;
}

interface EnemyView {
  obj: THREE.Group;
  bar: THREE.Group;
  fill: THREE.Mesh;
  last: THREE.Vector3;
  heading: number;
  hit: number;
  /** Banking into corners (radians about the direction of travel). */
  lean: number;
  /** The model's opaque meshes and their own materials, for the hit flash (which swaps, never mutates). */
  meshes: THREE.Mesh[];
  mats: Array<THREE.Material | THREE.Material[]>;
  flashing: boolean;
}

/** Geometry and materials every projectile of a kind borrows (created once, never disposed by an effect). */
interface ShotKit {
  turnip: THREE.BufferGeometry;
  turnipTop: THREE.BufferGeometry;
  sprout: THREE.BufferGeometry;
  pumpkin: THREE.BufferGeometry;
  stalk: THREE.BufferGeometry;
  sack: THREE.BufferGeometry;
  tie: THREE.BufferGeometry;
  bee: THREE.BufferGeometry;
  orb: THREE.BufferGeometry;
  crowBody: THREE.BufferGeometry;
  crowWing: THREE.BufferGeometry;
  wingMat: THREE.Material;
  beeRed: THREE.Material;
  beeGold: THREE.Material;
  drop: THREE.Material;
}

/** How long a hit flash lasts, in seconds. */
const FLASH = 0.07;

const SHOT_COLOURS: Record<string, string> = {
  scarecrow: "#ffe08a",
  beehive: "#ffd23f",
  pond: "#8fd8ff",
  barn: "#f2c94c",
  silo: "#ffcf5a",
};

export class Renderer3D {
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 0.1, 120);
  private sun = new THREE.DirectionalLight("#ffffff", 2.5);
  private hemi = new THREE.HemisphereLight("#cfe4ff", "#5c6b3a", 0.9);
  /** A cool back light that rims units against the ground (the "RTS" look). */
  private rim = new THREE.DirectionalLight("#9fc4ff", 0.9);
  private world = new THREE.Group();
  private dynamic = new THREE.Group();
  private ground: Ground | null = null;
  private levelId = -1;
  private towers = new Map<number, TowerView>();
  private enemies = new Map<number, EnemyView>();
  private cath: THREE.Group | null = null;
  private faceTex: THREE.Texture | null = null;
  private faceWorried: THREE.Texture | null = null;
  private sparks = new Sparks();
  private motes: Motes[] = [];
  private birds: Birds | null = null;
  private pxScale = 300;
  private kit: ShotKit | null = null;
  private flashMat = Object.assign(new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#fff0dc", emissiveIntensity: 0.9, roughness: 0.6 }), { shared: true });
  private gustLeaves: string[] = ["#6ea04c", "#8fbd57", "#c9a640"];
  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();
  private debris = new Debris();
  private fx: Transients;
  private floaters: Floaters;
  private selection: THREE.Group;
  private rangeRing: THREE.Mesh;
  private aimDisc: THREE.Mesh;
  private ghost: THREE.Group | null = null;
  private ghostKey = "";
  private bossBar: HTMLElement;
  private bossFill: HTMLElement;
  private bossName: HTMLElement;
  private clock = 0;
  private shake = 0;
  private camBase = new THREE.Vector3();
  private camTarget = new THREE.Vector3();
  private heroSwung = 9;
  private raycaster = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private w = 1;
  private h = 1;
  private barGeo = new THREE.PlaneGeometry(1, 1);
  private barBack = new THREE.MeshBasicMaterial({ color: "#1a1412", transparent: true, opacity: 0.75, depthTest: false });
  private fillMats = {
    good: new THREE.MeshBasicMaterial({ color: "#7fe06a", depthTest: false }),
    mid: new THREE.MeshBasicMaterial({ color: "#ffd23f", depthTest: false }),
    low: new THREE.MeshBasicMaterial({ color: "#ff5a3d", depthTest: false }),
    boss: new THREE.MeshBasicMaterial({ color: "#ff3b30", depthTest: false }),
  };
  selected: { col: number; row: number } | null = null;
  cursor: { col: number; row: number } | null = null;
  heroSelected = false;
  aim: { x: number; y: number; r: number } | null = null;
  preview: TowerKind | null = null;
  reducedMotion = false;

  static supported(): boolean {
    try {
      const c = document.createElement("canvas");
      return !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
      return false;
    }
  }

  constructor(
    private canvas: HTMLCanvasElement,
    overlay: HTMLElement,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.add(this.world, this.dynamic, this.hemi, this.sun, this.sun.target, this.rim);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.02;
    this.dynamic.add(this.sparks.points, this.debris.mesh);
    this.fx = new Transients(this.dynamic);
    this.floaters = new Floaters(overlay);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.55, 0.8);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    // Selection square, range ring and pie aim.
    const sq = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(0.86, 0.02, 0.86)),
      new THREE.LineBasicMaterial({ color: "#fff6c8", transparent: true, opacity: 0.95 }),
    );
    this.selection = new THREE.Group();
    this.selection.add(sq);
    this.selection.visible = false;
    this.rangeRing = new THREE.Mesh(
      new THREE.RingGeometry(0.96, 1, 64),
      new THREE.MeshBasicMaterial({ color: "#fffbe6", transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }),
    );
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(0.96, 64),
      new THREE.MeshBasicMaterial({ color: "#fffbe6", transparent: true, opacity: 0.12, depthWrite: false }),
    );
    this.rangeRing.add(disc);
    this.rangeRing.rotation.x = -Math.PI / 2;
    this.rangeRing.visible = false;
    this.aimDisc = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1, 48),
      new THREE.MeshBasicMaterial({ color: "#fff6d6", transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.aimDisc.add(
      new THREE.Mesh(new THREE.CircleGeometry(0.9, 48), new THREE.MeshBasicMaterial({ color: "#fff6d6", transparent: true, opacity: 0.2, depthWrite: false })),
    );
    this.aimDisc.rotation.x = -Math.PI / 2;
    this.aimDisc.visible = false;
    this.scene.add(this.selection, this.rangeRing, this.aimDisc);

    // Boss bar: HTML over the canvas.
    this.bossBar = document.createElement("div");
    this.bossBar.className = "bossbar";
    this.bossBar.hidden = true;
    this.bossName = document.createElement("span");
    const track = document.createElement("span");
    track.className = "bossbar-track";
    this.bossFill = document.createElement("span");
    this.bossFill.className = "bossbar-fill";
    track.append(this.bossFill);
    this.bossBar.append(this.bossName, track);
    overlay.append(this.bossBar);

    const loader = new THREE.TextureLoader();
    const tex = (svg: string) => {
      const t = loader.load(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    this.faceTex = tex(cathSvg({ framing: "face", expression: "determined", width: 312, height: 376 }));
    this.faceWorried = tex(cathSvg({ framing: "face", expression: "worried", width: 312, height: 376 }));
    try {
      this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      /* no matchMedia */
    }
  }

  // ---- layout ----

  resize(game: Game): void {
    const rect = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, rect.width);
    this.h = Math.max(1, rect.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(this.w, this.h, false);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(this.w, this.h);
    this.bloom.resolution.set(this.w / 2, this.h / 2);
    this.pxScale = this.h * dpr * 0.9;
    this.sparks.setScale(this.pxScale);
    this.camera.aspect = this.w / this.h;
    if (game.level.id !== this.levelId) this.buildLevel(game);
    for (const m of this.motes) m.setScale(this.pxScale);
    this.fitCamera(game);
  }

  private buildLevel(game: Game): void {
    this.levelId = game.level.id;
    // Free the last level's ground (its cached, shared materials stay for the next one).
    for (const o of [...this.world.children]) o.traverse(disposeOwn);
    for (const m of this.motes) m.dispose();
    this.birds?.dispose();
    this.motes = [];
    this.birds = null;
    this.world.clear();
    this.clearDynamic();
    const L = actLight(game.level.id);
    this.ground = buildGround(game.level);
    this.world.add(this.ground.group);
    this.buildAir(game);
    // Sky, fog and light for the act.
    const sky = document.createElement("canvas");
    sky.width = 4;
    sky.height = 256;
    const sctx = sky.getContext("2d")!;
    const grad = sctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, L.skyTop);
    grad.addColorStop(1, L.skyBottom);
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 4, 256);
    const skyTex = new THREE.CanvasTexture(sky);
    skyTex.colorSpace = THREE.SRGBColorSpace;
    this.scene.background = skyTex;
    const fogDim = hasTwist(game.level, "fog") ? 0.78 : hasTwist(game.level, "night") ? 0.85 : 1;
    this.scene.fog = new THREE.Fog(L.fog, L.fogNear * fogDim, L.fogFar * fogDim);
    const night = hasTwist(game.level, "night") || game.level.id > 90;
    this.renderer.toneMappingExposure =
      L.exposure * (hasTwist(game.level, "night") ? 0.9 : 1) * (game.level.id > 90 ? 1.25 : 1) * (setPiece(game.level, "blackout") ? 0.55 : 1);
    this.hemi.color.set(L.hemiSky);
    this.hemi.groundColor.set(L.hemiGround);
    this.hemi.intensity = L.hemiIntensity * (night ? 1.4 : 0.65);
    this.sun.color.set(L.sun);
    this.sun.intensity = L.sunIntensity * 1.25 * (hasTwist(game.level, "night") ? 0.75 : hasTwist(game.level, "rain") ? 0.7 : 1);
    // Night: a cool moon fills in from the back so everything still reads.
    this.rim.color.set(night ? "#8fb0ff" : "#9fc4ff");
    this.rim.position.set(game.level.cols / 2, 6, -8);
    this.rim.target = this.sun.target;
    this.rim.intensity = night ? 2.2 : 0.8;
    const cx = game.level.cols / 2;
    const cz = game.level.rows / 2;
    const az = (L.sunAz * Math.PI) / 180;
    const el = (L.sunEl * Math.PI) / 180;
    const d = 20;
    this.sun.position.set(cx + Math.cos(az) * Math.cos(el) * d, Math.sin(el) * d, cz + Math.sin(az) * Math.cos(el) * d);
    this.sun.target.position.set(cx, 0, cz);
    const span = Math.max(game.level.cols, game.level.rows) * 0.9 + 2;
    const sc = this.sun.shadow.camera;
    sc.left = -span;
    sc.right = span;
    sc.top = span;
    sc.bottom = -span;
    sc.near = 1;
    sc.far = 60;
    sc.updateProjectionMatrix();
    const size = Math.min(window.innerWidth, window.innerHeight) < 600 ? 1024 : 2048;
    this.sun.shadow.mapSize.set(size, size);
    this.sun.shadow.map?.dispose();
    this.sun.shadow.map = null;
    this.cath = buildCath(this.faceTex);
    this.dynamic.add(this.cath);
  }

  /** The living air: pollen and birds by day; fireflies, lantern halos and bats by night. */
  private buildAir(game: Game): void {
    const lv = game.level;
    const mood = actMood(lv.id);
    const L = actLight(lv.id);
    const night = hasTwist(lv, "night") || lv.id > 90;
    const cx = lv.cols / 2;
    const cz = lv.rows / 2;
    const span = Math.max(lv.cols, lv.rows) * 0.6;
    const box = { x0: -2, x1: lv.cols + 2, z0: -1.5, z1: lv.rows + 1.5, y0: 0.35, y1: 1.7 };
    if (night) {
      this.motes.push(new Motes(Math.round(lv.cols * lv.rows * 0.35), { kind: "fireflies", color: "#d8ff8a", size: 0.14, box: { ...box, y0: 0.15, y1: 0.8 } }));
      if (this.ground?.lamps.length) this.motes.push(new Motes(0, { kind: "glow", color: "#ffa850", size: 0.85, box, at: this.ground.lamps }));
      this.birds = new Birds(4, cx, cz, span, true);
    } else {
      if (!hasTwist(lv, "rain")) this.motes.push(new Motes(70, { kind: "pollen", color: mood.mote, size: 0.05, box, wind: hasTwist(lv, "wind") ? 3 : 1 }));
      const coast = lv.id > 20 && lv.id <= 30 ? true : lv.id > 50 && lv.id <= 60;
      if (mood.birds && !hasTwist(lv, "fog")) this.birds = new Birds(mood.birds, cx, cz, span, false, coast ? "#f4f2ec" : "#2e2a2a");
    }
    for (const m of this.motes) {
      m.setScale(this.pxScale);
      this.world.add(m.points);
    }
    if (this.birds) this.world.add(this.birds.mesh);
    // Gusts throw this act's leaves about.
    this.gustLeaves = [L.grass[2], L.grass[0], lv.id > 60 && lv.id <= 70 ? "#e0803a" : "#c9a640", "#a8c45a"];
  }

  private fitCamera(game: Game): void {
    const cols = game.level.cols;
    const rows = game.level.rows;
    const target = new THREE.Vector3(cols / 2, 0, rows / 2 + 0.2);
    // Portrait screens look down more steeply, so the map uses the height instead of empty foreground.
    const portrait = this.w / this.h < 0.8;
    const el = ((portrait ? 60 : 42) * Math.PI) / 180;
    const dir = new THREE.Vector3(0, Math.sin(el), Math.cos(el));
    const corners = [
      [-0.2, 0, -0.2],
      [cols + 0.2, 0, -0.2],
      [-0.2, 0, rows + 0.3],
      [cols + 0.2, 0, rows + 0.3],
      [-0.2, 0.9, -0.2],
      [cols + 0.2, 0.9, -0.2],
    ].map(([x, y, z]) => new THREE.Vector3(x, y, z));
    let lo = 4;
    let hi = 80;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      this.camera.position.copy(target).addScaledVector(dir, mid);
      this.camera.lookAt(target);
      this.camera.updateMatrixWorld();
      this.camera.updateProjectionMatrix();
      const fits = corners.every((c) => {
        const p = c.clone().project(this.camera);
        return Math.abs(p.x) < 0.98 && p.y > -0.97 && p.y < 0.8;
      });
      if (fits) hi = mid;
      else lo = mid;
    }
    this.camera.position.copy(target).addScaledVector(dir, hi);
    this.camera.lookAt(target);
    this.camBase.copy(this.camera.position);
    // Fog starts beyond the field whatever the camera distance (phones sit further back).
    if (this.scene.fog instanceof THREE.Fog) {
      const L = actLight(game.level.id);
      const dim = hasTwist(game.level, "fog") ? 0.78 : hasTwist(game.level, "night") ? 0.85 : 1;
      this.scene.fog.near = (hi + L.fogNear - 14) * dim;
      this.scene.fog.far = (hi + L.fogFar - 14) * dim;
    }
    this.camTarget.copy(target);
    this.fieldSize.set(cols, rows);
    this.resetView();
  }

  reset(): void {
    this.clearDynamic();
    if (this.cath) this.dynamic.add(this.cath);
    this.shake = 0;
  }

  private clearDynamic(): void {
    for (const v of this.towers.values()) this.dynamic.remove(v.obj);
    for (const v of this.enemies.values()) this.dynamic.remove(v.obj, v.bar);
    this.towers.clear();
    this.enemies.clear();
    this.fx.clear();
    this.floaters.clear();
    if (this.ghost) this.scene.remove(this.ghost);
    this.ghost = null;
    this.ghostKey = "";
    if (this.cath) this.dynamic.remove(this.cath);
  }

  // ---- input ----

  worldAt(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.plane, hit)) return { x: -1, y: -1 };
    return { x: hit.x, y: hit.z };
  }

  cellAt(clientX: number, clientY: number, game: Game): { col: number; row: number } | null {
    const p = this.worldAt(clientX, clientY);
    const col = Math.floor(p.x);
    const row = Math.floor(p.y);
    if (col < 0 || row < 0 || col >= game.level.cols || row >= game.level.rows) return null;
    return { col, row };
  }

  onHero(clientX: number, clientY: number, game: Game): boolean {
    if (hasTwist(game.level, "nocath")) return false;
    const p = this.worldAt(clientX, clientY);
    return Math.hypot(p.x - game.hero.x, p.y - game.hero.y) < 0.4;
  }

  /** The screen position of a cell's centre, in client pixels (keyboard focus, tests). */
  cellCenter(col: number, row: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const p = new THREE.Vector3(col + 0.5, this.height(col + 0.5, row + 0.5), row + 0.5).project(this.camera);
    return { x: rect.left + (p.x * 0.5 + 0.5) * rect.width, y: rect.top + (-p.y * 0.5 + 0.5) * rect.height };
  }

  private height(x: number, y: number): number {
    return this.ground ? Math.max(0, this.ground.heightAt(x, y)) : 0;
  }

  // ---- events ----

  built_(id: number, col: number, row: number, upgrade: boolean): void {
    const v = this.towers.get(id);
    if (v) v.pop = 0;
    const y = this.height(col + 0.5, row + 0.5);
    this.debris.emit(col + 0.5, y + 0.05, row + 0.5, ["#8a6a43", "#6b4a2b", "#b48a5a"], upgrade ? 6 : 12, 0.05, 1.6);
    this.sparks.emit(col + 0.5, y + 0.3, row + 0.5, upgrade ? "#ffd76a" : "#fff6d6", upgrade ? 24 : 10, 2, 0.12, 0.6, -2);
    if (upgrade) this.fx.ring(col + 0.5, y + 0.05, row + 0.5, "#ffd76a", 0.9);
  }

  celebrate(): void {
    const g = this.camTarget;
    for (let i = 0; i < 6; i++) {
      const x = g.x + (Math.random() - 0.5) * 5;
      const z = g.z + (Math.random() - 0.5) * 5;
      this.sparks.emit(x, 1.5, z, ["#ffd23f", "#ff6a5a", "#5ab0ff", "#7fe06a"][i % 4]!, 30, 3, 0.14, 1.4, -3);
    }
  }

  feed(events: GameEvent[], game: Game): void {
    for (const e of events) {
      switch (e.type) {
        case "shot": {
          const tv = this.towers.get(e.tower);
          if (tv) tv.fired = 0;
          const fy = this.height(e.fromX, e.fromY) + 0.7;
          const ty = this.height(e.toX, e.toY) + 0.25;
          this.projectile(e.kind, e.spec ?? null, e.fromX, fy, e.fromY, e.toX, ty, e.toY, !!e.crit, e.enemy);
          break;
        }
        case "kill": {
          const y = this.height(e.x, e.y);
          const big = isBig(e.kind);
          this.debris.emit(e.x, y + 0.2, e.y, ["#f4f6f8", "#c79a62", "#1f8a8a", "#2b2b30"], big ? 40 : 10, big ? 0.1 : 0.06, big ? 3.5 : 2.2);
          this.sparks.emit(e.x, y + 0.25, e.y, "#ffb04a", big ? 80 : 18, big ? 4 : 2.4, big ? 0.3 : 0.16, 0.5, -1);
          this.sparks.emit(e.x, y + 0.25, e.y, "#ffe9a8", big ? 40 : 8, 1.2, 0.2, 0.3, 0);
          this.fx.decal(e.x, y, e.y, "#2b2016", big ? 0.6 : 0.25);
          this.floaters.add(`+${e.bounty}`, new THREE.Vector3(e.x, y + 0.6, e.y), "#ffe27a", big ? 1.6 : 1);
          if (big) {
            this.kick(0.6);
            this.fx.ring(e.x, y + 0.05, e.y, "#ffb04a", 3.5, 0.7);
            this.celebrate();
          }
          break;
        }
        case "split": {
          const y = this.height(e.x, e.y);
          this.fx.ring(e.x, y + 0.05, e.y, "#ffffff", 1.2);
          this.sparks.emit(e.x, y + 0.3, e.y, "#cfe8ff", 30, 3, 0.12, 0.5);
          break;
        }
        case "leak": {
          this.kick(0.35);
          const y = this.height(e.x, e.y);
          this.sparks.emit(e.x, y + 0.5, e.y, "#ff5a3d", 30, 2.5, 0.16, 0.7);
          this.floaters.add(`-${e.lost ?? 1} Goodwill`, new THREE.Vector3(e.x, y + 1, e.y), "#ff8f80", 1.1);
          this.canvas.parentElement?.classList.remove("hurt");
          void this.canvas.offsetWidth;
          this.canvas.parentElement?.classList.add("hurt");
          break;
        }
        case "pie": {
          if (e.x === undefined || e.y === undefined) break;
          const h = game.hero;
          const from = new THREE.Vector3(h.x, this.height(h.x, h.y) + 0.8, h.y);
          const to = new THREE.Vector3(e.x, this.height(e.x, e.y) + 0.1, e.y);
          const r = e.radius ?? 1.7;
          const pie = new THREE.Group();
          const crust = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.07, 16), new THREE.MeshStandardMaterial({ color: "#e0b26a", roughness: 0.7 }));
          const cream = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#fff6e0", roughness: 0.5 }));
          cream.position.y = 0.03;
          pie.add(crust, cream);
          this.heroSwung = 0;
          this.fx.add(pie, 0.4, (k) => {
            pie.position.lerpVectors(from, to, k);
            pie.position.y += Math.sin(k * Math.PI) * 1.4;
            pie.rotation.x = k * 8;
            if (k >= 1) {
              this.kick(0.4);
              this.fx.ring(to.x, to.y + 0.04, to.z, "#fff6e0", r, 0.5);
              this.fx.decal(to.x, to.y - 0.1, to.z, "#fffaf0", r * 0.55, 5);
              this.sparks.emit(to.x, to.y + 0.1, to.z, "#fff6e0", 60, 3.2, 0.18, 0.8, -6);
              this.debris.emit(to.x, to.y + 0.1, to.z, ["#fff6e0", "#e0b26a", "#c4433a"], 14, 0.07, 2.6);
              this.floaters.add("SPLAT!", to.clone().setY(to.y + 0.8), "#fff6e0", 1.6);
            }
          });
          break;
        }
        case "swing": {
          this.heroSwung = 0;
          const y = this.height(e.x, e.y);
          this.sparks.emit(e.x, y + 0.3, e.y, "#fff6d6", 6, 1.5, 0.12, 0.25, 0);
          break;
        }
        case "heroDown":
          this.kick(0.25);
          this.floaters.add("Cath's winded!", new THREE.Vector3(game.hero.x, 1.2, game.hero.y), "#ffd0c4", 1);
          break;
        case "heroUp":
          this.fx.ring(game.hero.x, this.height(game.hero.x, game.hero.y) + 0.05, game.hero.y, "#ffd76a", 1);
          break;
        case "injunction": {
          const y = this.height(e.x, e.y);
          this.fx.ring(e.x, y + 0.1, e.y, "#ffd76a", 3, 0.7);
          this.floaters.add("INJUNCTION!", new THREE.Vector3(e.x, y + 1.3, e.y), "#fff6d6", 1.1);
          break;
        }
        case "cleared": {
          const [c, r] = game.level.path[game.level.path.length - 1]!;
          this.floaters.add(`Wave cleared +${e.reward}`, new THREE.Vector3(c + 0.5, 1.6, r + 0.5), "#ffe27a", 1.05);
          this.sparks.emit(c + 0.5, 1, r + 0.5, "#ffd23f", 40, 2.5, 0.14, 1, -3);
          break;
        }
        case "wave":
          if (e.early) this.floaters.add(`Early! +${e.early}`, new THREE.Vector3(game.hero.x, 1.4, game.hero.y), "#ffe27a", 1.1);
          break;
        case "bossMove": {
          this.kick(0.45);
          const y = this.height(e.x, e.y);
          this.fx.ring(e.x, y + 0.08, e.y, "#ff3b30", 3, 0.6);
          const short: Record<string, string> = {
            spawn: "Reinforcements!",
            charge: "CHARGE!",
            stomp: "CRUNCH!",
            pulse: "Activation!",
            mend: "Wellness drop!",
            takeover: "Hostile takeover!",
          };
          this.floaters.add(short[e.move] ?? "!", new THREE.Vector3(e.x, y + 1.4, e.y), "#ffb3a8", 1.35);
          for (const id of e.towers) {
            const t = game.towers.find((x) => x.id === id);
            if (!t) continue;
            const ty = this.height(t.col + 0.5, t.row + 0.5);
            this.fx.beam(e.x, y + 0.4, e.y, t.col + 0.5, ty + 0.5, t.row + 0.5, "#ff3b30", 0.04, 0.4);
            this.debris.emit(t.col + 0.5, ty + 0.4, t.row + 0.5, ["#9aa0a6", "#6b4a2b"], 10, 0.06, 2);
          }
          if (e.move === "mend") this.sparks.emit(e.x, y + 0.4, e.y, "#2fd19c", 60, 2, 0.14, 1, -1);
          break;
        }
        case "gust": {
          const gv = this.towers.get(e.tower);
          if (gv) gv.fired = 0;
          const y = this.height(e.x, e.y);
          this.fx.ring(e.x, y + 0.1, e.y, "#e8f4ff", e.radius * 2, 0.35);
          if (!this.reducedMotion) this.fx.swirl(e.x, y, e.y, e.radius, this.gustLeaves);
          this.sparks.emit(e.x, y + 0.15, e.y, "#f4fbff", 14, 2.4, 0.1, 0.45, 0);
          break;
        }
        case "pop": {
          const y = this.height(e.x, e.y);
          this.sparks.emit(e.x, y + 0.3, e.y, "#e6f4ff", 14, 2.2, 0.08);
          this.floaters.add("POP!", new THREE.Vector3(e.x, y + 0.9, e.y), "#d2ecff", 0.9);
          break;
        }
        case "rankUp": {
          const y = this.height(e.x, e.y);
          this.fx.ring(e.x, y + 0.05, e.y, "#ffd76a", 1.2);
          this.floaters.add(`Veteran ${"★".repeat(e.rank)}`, new THREE.Vector3(e.x, y + 1.4, e.y), "#ffd76a", 1.05);
          break;
        }
        case "merge": {
          const y = this.height(e.x, e.y);
          this.shake = Math.max(this.shake, 0.4);
          this.fx.ring(e.x, y + 0.05, e.y, "#ffd76a", 3.2, 0.8);
          this.sparks.emit(e.x, y + 0.6, e.y, "#ffd76a", 30, 3, 0.12, 0.9);
          this.floaters.add(MEGAS[e.mega].name, new THREE.Vector3(e.x, y + 2.2, e.y), "#fff2b8", 1.4);
          break;
        }
        case "ambush": {
          const y = this.height(e.x, e.y);
          this.fx.ring(e.x, y + 0.08, e.y, "#ff3b30", 2.2, 1.2);
          this.floaters.add("Ambush here!", new THREE.Vector3(e.x, y + 1.2, e.y), "#ffb3a8", 1.2);
          break;
        }
        case "flood": {
          const y = this.height(e.x, e.y);
          this.fx.ring(e.x, y + 0.1, e.y, "#4f93b8", 3.5, 0.9);
          this.floaters.add(e.warn ? "The river's rising…" : "FLOOD!", new THREE.Vector3(e.x, y + 1.4, e.y), "#bfe4ff", 1.3);
          if (!e.warn) this.shake = Math.max(this.shake, 0.4);
          break;
        }
        case "bridge": {
          const y = this.height(e.x, e.y);
          this.floaters.add(e.open ? "Bridge up!" : "Bridge down", new THREE.Vector3(e.x, y + 1.1, e.y), e.open ? "#ffb3a8" : "#e8ffd0", 0.9);
          break;
        }
        case "duelEnd":
          this.shake = Math.max(this.shake, 0.5);
          this.floaters.add(e.won ? "Cath wins the duel!" : "Cath's knocked back", new THREE.Vector3(game.hero.x, 1.6, game.hero.y), e.won ? "#fff2b8" : "#ffd0c4", 1.3);
          break;
        case "neighbours": {
          const y = this.height(e.x, e.y);
          this.fx.ring(e.x, y + 0.05, e.y, "#ffd76a", 1.2);
          this.floaters.add("Neighbours!", new THREE.Vector3(e.x, y + 1.1, e.y), "#fff6d6", 1.1);
          break;
        }
        case "rally":
          for (const t of game.towers) {
            const y = this.height(t.col + 0.5, t.row + 0.5);
            this.fx.ring(t.col + 0.5, y + 0.1, t.row + 0.5, "#ffd76a", 0.7);
          }
          this.floaters.add("Rally!", new THREE.Vector3(game.hero.x, 1.4, game.hero.y), "#ffe27a", 1.4);
          break;
      }
    }
  }

  private shotKit(): ShotKit {
    if (this.kit) return this.kit;
    const g = sharedGeometry;
    const wing = Object.assign(new THREE.MeshStandardMaterial({ color: "#1d1b22", roughness: 0.6, side: THREE.DoubleSide }), { shared: true });
    const basic = (color: string) => Object.assign(new THREE.MeshBasicMaterial({ color }), { shared: true });
    this.kit = {
      turnip: g(new THREE.IcosahedronGeometry(0.06, 1).scale(1, 0.9, 1)),
      turnipTop: g(new THREE.SphereGeometry(0.061, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2.4)),
      sprout: g(new THREE.ConeGeometry(0.025, 0.08, 4).translate(0, 0.08, 0)),
      pumpkin: g(new THREE.SphereGeometry(0.11, 10, 6).scale(1, 0.78, 1)),
      stalk: g(new THREE.CylinderGeometry(0.012, 0.016, 0.05, 5).translate(0, 0.095, 0)),
      sack: g(new THREE.IcosahedronGeometry(1, 1).scale(1, 1.2, 1)),
      tie: g(new THREE.ConeGeometry(0.45, 0.6, 5).rotateX(Math.PI).translate(0, 1.35, 0)),
      bee: g(new THREE.SphereGeometry(0.03, 6, 4)),
      orb: g(new THREE.IcosahedronGeometry(1, 1)),
      crowBody: g(new THREE.SphereGeometry(0.05, 6, 4).scale(1.4, 0.9, 0.9)),
      crowWing: g(new THREE.PlaneGeometry(0.14, 0.05)),
      wingMat: wing,
      beeRed: basic("#ff5a3a"),
      beeGold: basic("#ffd23f"),
      drop: Object.assign(new THREE.MeshStandardMaterial({ color: "#9fdcff", roughness: 0.2, emissive: "#9fdcff", emissiveIntensity: 0.35 }), { shared: true }),
    };
    return this.kit;
  }

  /** A tower's shot in flight: a little model of what it throws, a trail, and a landing to match. */
  private projectile(kind: TowerKind, spec: 0 | 1 | null, fx: number, fy: number, fz: number, tx: number, ty: number, tz: number, crit: boolean, enemy: number): void {
    const from = new THREE.Vector3(fx, fy, fz);
    const to = new THREE.Vector3(tx, ty, tz);
    const colour = SHOT_COLOURS[kind] ?? "#ffffff";
    const flash = () => {
      const ev = this.enemies.get(enemy);
      if (ev) ev.hit = 0;
    };
    if (kind === "silo") {
      this.fx.beam(fx, fy, fz, tx, ty, tz, "#ffcf5a", spec === 0 ? 0.09 : 0.06, 0.16);
      // Grain sprays along the shot and bursts on the target.
      for (let i = 1; i <= 4; i++) {
        const k = i / 5;
        this.sparks.emit(fx + (tx - fx) * k, fy + (ty - fy) * k, fz + (tz - fz) * k, "#ffe08a", 2, 0.6, 0.07, 0.3, -2);
      }
      this.sparks.emit(fx, fy, fz, "#fff2c0", 6, 1.2, 0.12, 0.2, 0);
      this.sparks.emit(tx, ty, tz, "#ffcf5a", spec === 1 ? 40 : 16, 2.5, 0.16, 0.4);
      if (spec === 1) this.fx.ring(tx, ty - 0.2, tz, "#ffcf5a", 1.1);
      flash();
      return;
    }
    const kit = this.shotKit();
    const dist = Math.hypot(tx - fx, tz - fz);
    let obj: THREE.Object3D;
    let life = 0.24;
    let arc = 0.5;
    let trail: string | null = null;
    let trailSize = 0.06;
    let spin = 1;
    const pumpkin = kind === "scarecrow" && spec === 0;
    const crow = kind === "scarecrow" && spec === 1;
    if (kind === "beehive") {
      const g = new THREE.Group();
      for (let i = 0; i < 5; i++) g.add(new THREE.Mesh(kit.bee, spec === 0 ? kit.beeRed : kit.beeGold));
      obj = g;
      life = 0.35;
      trail = spec === 0 ? "#ff9a6a" : "#ffe27a";
      trailSize = 0.04;
      spin = 0;
    } else if (crow) {
      const c = new THREE.Group();
      c.add(new THREE.Mesh(kit.crowBody, matte("#1d1b22", 0.6)));
      for (const s of [-1, 1]) {
        const w = new THREE.Mesh(kit.crowWing, kit.wingMat);
        w.position.z = s * 0.06;
        w.userData.side = s;
        c.add(w);
      }
      obj = c;
      spin = 0;
    } else if (pumpkin) {
      const p = new THREE.Group();
      p.add(new THREE.Mesh(kit.pumpkin, matte("#e98a2b", 0.6, false)), new THREE.Mesh(kit.stalk, matte("#5a7a2a")));
      obj = p;
      life = 0.4;
      arc = 0.9 + dist * 0.12;
      trail = "#ffc070";
      trailSize = 0.08;
      spin = 0.5;
    } else if (kind === "scarecrow") {
      // A turnip: white root, purple shoulders, a tuft of leaves.
      const t = new THREE.Group();
      t.add(new THREE.Mesh(kit.turnip, matte("#f2ece4", 0.6, false)), new THREE.Mesh(kit.turnipTop, matte("#9a4f9c", 0.6, false)), new THREE.Mesh(kit.sprout, matte("#5e9a3a")));
      obj = t;
      trail = "#f4ead8";
    } else if (kind === "cannon" || kind === "barn") {
      // A sack of seed potatoes (cannon) or grain (barn), tied at the neck, tumbling end over end.
      const big = kind === "cannon";
      const r = big ? 0.085 : 0.06;
      const s = new THREE.Group();
      s.add(new THREE.Mesh(kit.sack, matte(big ? "#b8955a" : "#d8b870", 0.95)), new THREE.Mesh(kit.tie, matte("#8a6a3a", 0.95)));
      s.scale.setScalar(r);
      obj = s;
      life = big ? 0.4 + dist * 0.05 : 0.28;
      arc = big ? 0.8 + dist * 0.3 : 0.6;
      trail = big ? "#e8d6a8" : "#f2d27a";
      trailSize = big ? 0.08 : 0.06;
      spin = big ? 0.6 : 0.8;
    } else if (kind === "pond") {
      obj = new THREE.Mesh(kit.orb, kit.drop);
      obj.scale.setScalar(0.06);
      arc = 0.3;
      trail = "#bfe9ff";
      trailSize = 0.05;
    } else {
      obj = new THREE.Mesh(kit.orb, matte(colour, 0.5));
      obj.scale.setScalar(0.06);
      trail = colour;
    }
    obj.traverse((o) => (o.castShadow = true));
    if (crit) {
      obj.scale.multiplyScalar(1.35);
      trail = "#fff6d6";
      trailSize *= 1.8;
    }
    // A puff at the muzzle.
    this.sparks.emit(fx, fy, fz, kind === "cannon" ? "#efe2c4" : "#fff6d6", kind === "cannon" ? 12 : 3, kind === "cannon" ? 1.4 : 0.8, kind === "cannon" ? 0.16 : 0.08, 0.25, 0);
    const p = obj.position;
    this.fx.add(obj, life, (k) => {
      p.lerpVectors(from, to, k);
      p.y += Math.sin(k * Math.PI) * arc;
      if (spin) {
        obj.rotation.x += 0.4 * spin;
        obj.rotation.y += 0.3 * spin;
      }
      if (kind === "beehive") obj.children.forEach((b, i) => b.position.set(Math.sin(k * 30 + i * 1.7) * 0.12, Math.cos(k * 26 + i) * 0.1, Math.cos(k * 22 + i * 2.1) * 0.12));
      if (crow) {
        obj.lookAt(to);
        obj.children.forEach((w, i) => {
          if (i > 0) w.rotation.x = Math.sin(k * 40) * 0.8 * (w.userData.side as number);
        });
      }
      if (trail && k < 1) {
        this.sparks.emit(p.x, p.y, p.z, trail, crit ? 2 : 1, 0.08, trailSize, crit ? 0.35 : 0.25, 0);
      }
      if (k >= 1) {
        flash();
        if (kind === "cannon") {
          // The sack bursts: a dust cloud, seed potatoes everywhere, a ring where it landed.
          const gy = to.y - 0.25;
          this.sparks.emit(to.x, gy + 0.1, to.z, "#e6d3a8", crit ? 40 : 26, 2, 0.22, 0.7, -2.5);
          this.debris.emit(to.x, gy + 0.1, to.z, ["#c9a36a", "#8a6a43", "#d8c08a"], 9, 0.05, 2.4);
          this.fx.ring(to.x, gy + 0.05, to.z, "#e6d3a8", 1.3, 0.5);
          this.fx.decal(to.x, gy, to.z, "#3a2c1c", 0.35, 3);
          this.kick(0.1);
        } else if (pumpkin) {
          this.fx.ring(to.x, to.y - 0.15, to.z, "#e98a2b", 1);
          this.debris.emit(to.x, to.y, to.z, ["#e98a2b", "#f2b34a", "#fff0c0"], 8, 0.05, 2.2);
          this.fx.decal(to.x, to.y - 0.25, to.z, "#d27a22", 0.3, 3);
        } else if (kind === "pond") {
          this.sparks.emit(to.x, to.y, to.z, "#bfe9ff", 14, 1.6, 0.08, 0.45, -5);
        }
        this.sparks.emit(to.x, to.y, to.z, colour, crit ? 30 : 8, crit ? 3 : 1.8, crit ? 0.2 : 0.1, 0.4);
        if (crit) {
          this.fx.ring(to.x, to.y - 0.2, to.z, "#fff6d6", 0.7, 0.3);
          this.floaters.add(kind === "scarecrow" ? "CAW!" : "CRIT!", to.clone().setY(to.y + 0.6), "#ffffff", 1.3);
          this.kick(0.08);
        }
      }
    });
  }

  private kick(amount: number): void {
    if (!this.reducedMotion) this.shake = Math.max(this.shake, amount);
  }

  // ---- pan and zoom (bigger fields: pinch or scroll to look closer, drag to look around) ----

  private zoom = 1;
  private pan = new THREE.Vector2();
  private fieldSize = new THREE.Vector2(8, 10);

  /** Zooms by a factor (1 = the whole field), keeping the view on the field. */
  zoomBy(f: number): void {
    this.zoom = Math.min(2.6, Math.max(1, this.zoom * f));
    this.clampPan();
  }

  /** Drags the view by a screen distance in pixels. */
  panBy(dx: number, dy: number): void {
    const d = this.camBase.distanceTo(this.camTarget) / this.zoom;
    const perPx = (2 * d * Math.tan((this.camera.fov * Math.PI) / 360)) / Math.max(1, this.h);
    this.pan.x -= dx * perPx;
    this.pan.y -= dy * perPx * 1.3;
    this.clampPan();
  }

  resetView(): void {
    this.zoom = 1;
    this.pan.set(0, 0);
  }

  get zoomed(): boolean {
    return this.zoom > 1.01;
  }

  private clampPan(): void {
    const k = 1 - 1 / this.zoom;
    const mx = (this.fieldSize.x / 2) * k;
    const mz = (this.fieldSize.y / 2) * k;
    this.pan.x = Math.max(-mx, Math.min(mx, this.pan.x));
    this.pan.y = Math.max(-mz, Math.min(mz, this.pan.y));
  }

  // ---- drawing ----

  draw(game: Game, dt: number): void {
    if (game.level.id !== this.levelId) this.resize(game);
    this.clock += dt;
    const t = this.clock;
    this.syncTowers(game, dt, t);
    this.syncEnemies(game, dt, t);
    this.syncHero(game, dt, t);
    this.syncSelection(game, t);
    this.syncBoss(game);
    this.syncSetPieces(game, t);
    // Farmhouse smoke, darker as Goodwill falls.
    if (this.ground && Math.random() < dt * 3) {
      const c = this.ground.farmhouse.localToWorld((this.ground.farmhouse.userData.chimney as THREE.Vector3).clone());
      const hurt = game.goodwill / game.maxGoodwill < 0.5;
      this.smoke(c, hurt ? "#4a4440" : "#ece6dc", hurt ? 0.09 : 0.05);
    }
    for (const sp of (this.ground?.group.userData.spin as THREE.Object3D[] | undefined) ?? []) sp.rotation.z += dt * 0.7;
    this.ground?.update(t, dt);
    for (const m of this.motes) m.update(dt, t);
    this.birds?.update(t);
    this.sparks.update(dt);
    this.debris.update(dt);
    this.fx.update(dt);
    // Camera: zoom towards the target, offset by the pan; then shake.
    const look = this.v3.copy(this.camTarget).add(this.v2.set(this.pan.x, 0, this.pan.y));
    this.camera.position.copy(this.camBase).sub(this.camTarget).multiplyScalar(1 / this.zoom).add(look);
    if (this.shake > 0) {
      const m = this.shake * 0.12;
      this.camera.position.x += (Math.random() - 0.5) * m;
      this.camera.position.y += (Math.random() - 0.5) * m;
      this.shake = Math.max(0, this.shake - dt * 1.8);
    }
    this.camera.lookAt(look);
    this.camera.updateMatrixWorld();
    this.composer.render(dt);
    this.floaters.update(dt, this.camera, this.w, this.h);
  }

  private smoke(at: THREE.Vector3, color: string, size: number): void {
    const mat = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false, roughness: 1 });
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(size, 0), mat);
    m.position.copy(at);
    const drift = new THREE.Vector3(0.15 + Math.random() * 0.1, 0.5, (Math.random() - 0.5) * 0.1);
    this.fx.add(m, 2.2, (k, dt) => {
      m.position.addScaledVector(drift, dt);
      m.scale.setScalar(1 + k * 2);
      mat.opacity = 0.45 * (1 - k);
    });
  }

  private syncTowers(game: Game, dt: number, t: number): void {
    const seen = new Set<number>();
    for (const tw of game.towers) {
      seen.add(tw.id);
      const sig = `${tw.kind}:${tw.tier}:${tw.spec ?? ""}:${tw.mega ?? ""}`;
      let v = this.towers.get(tw.id);
      if (!v || v.sig !== sig) {
        if (v) this.dynamic.remove(v.obj);
        let obj: THREE.Group;
        if (tw.mega && tw.annex) {
          // A megastructure stands across both its plots, its long side running from one to the other.
          obj = buildMega(tw.mega);
          obj.userData.scale = 1;
          const mx = (tw.col + tw.annex[0]) / 2 + 0.5;
          const mz = (tw.row + tw.annex[1]) / 2 + 0.5;
          obj.position.set(mx, Math.min(this.height(tw.col + 0.5, tw.row + 0.5), this.height(tw.annex[0] + 0.5, tw.annex[1] + 0.5)), mz);
          obj.rotation.y = tw.annex[1] !== tw.row ? -Math.PI / 2 : 0;
        } else {
          obj = buildTower(tw.kind, tw.tier, tw.spec ?? null);
          obj.userData.scale = 1.22;
          obj.position.set(tw.col + 0.5, this.height(tw.col + 0.5, tw.row + 0.5), tw.row + 0.5);
        }
        this.dynamic.add(obj);
        v = { obj, sig, fired: 9, pop: v ? 0 : 0 };
        this.towers.set(tw.id, v);
      }
      this.animateTower(game, tw, v, dt, t);
    }
    for (const [id, v] of this.towers)
      if (!seen.has(id)) {
        this.dynamic.remove(v.obj);
        this.debris.emit(v.obj.position.x, v.obj.position.y + 0.2, v.obj.position.z, ["#8a6a43", "#cfc5af"], 14, 0.07, 2);
        this.towers.delete(id);
      }
  }

  private animateTower(game: Game, tw: Tower, v: TowerView, dt: number, t: number): void {
    v.fired += dt;
    v.pop += dt;
    const ud = v.obj.userData;
    // Pop in when built or upgraded.
    const p = Math.min(1, v.pop / 0.35);
    const s = p < 1 ? 0.6 + Math.sin(p * Math.PI * 0.75) * 0.5 : 1;
    v.obj.scale.setScalar(((ud.scale as number | undefined) ?? 1.22) * (this.reducedMotion ? 1 : Math.min(1.15, s)));
    // Turn to the latest target.
    const turret = ud.turret as THREE.Group | undefined;
    const target = this.lastTarget(game, tw);
    if (turret && target) {
      const want = Math.atan2(target.x - v.obj.position.x, target.y - v.obj.position.z) - v.obj.rotation.y;
      const cur = turret.rotation.y;
      let d = want - cur;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      turret.rotation.y = cur + d * Math.min(1, dt * 10);
    }
    const kick = v.fired < 0.15 ? Math.sin((v.fired / 0.15) * Math.PI) : 0;
    const arm = ud.arm as THREE.Object3D | undefined;
    if (arm) arm.rotation.z = -kick * 0.9;
    if (turret && tw.kind === "silo") turret.position.y = 0.6 - kick * 0.03;
    // Windmill sails turn all the time, and spin up just after a gust.
    const sails = ud.sails as THREE.Object3D | undefined;
    if (sails) sails.rotation.z += dt * (1.1 + Math.max(0, 1.2 - v.fired) * 5);
    const bees = ud.bees as THREE.Group | undefined;
    if (bees) bees.children.forEach((b, i) => {
      const a = t * (2.4 + i * 0.3) + i * 2;
      b.position.set(Math.cos(a) * 0.36, Math.sin(a * 1.3) * 0.15, Math.sin(a) * 0.36);
    });
    const ducks = ud.ducks as THREE.Group | undefined;
    if (ducks) ducks.children.forEach((d) => {
      const ph = (d.userData.phase as number) + t * 0.6;
      d.position.set(Math.cos(ph) * 0.2, Math.sin(t * 3 + ph) * 0.01, Math.sin(ph) * 0.2);
      d.rotation.y = -ph;
    });
    const light = ud.light as THREE.Mesh | undefined;
    if (light) light.visible = Math.sin(t * 4 + tw.id) > -0.3;
    const flag = ud.flag as THREE.Object3D | undefined;
    if (flag) flag.rotation.y = Math.sin(t * 3 + tw.id) * 0.25;
    // Charmed or knocked out: a slow wobble and a few grey sparks.
    const dazed = (tw.out ?? 0) > 0 || (game.phase === "wave" && towerStats(tw).damage > 0 && charmed(game, tw));
    v.obj.rotation.z = dazed ? Math.sin(t * 4) * 0.08 : 0;
    if (dazed && Math.random() < dt * 6)
      this.sparks.emit(v.obj.position.x, v.obj.position.y + 0.9, v.obj.position.z, (tw.out ?? 0) > 0 ? "#b0b4bc" : "#ff9ad0", 1, 0.6, 0.12, 0.6, 0.5);
    if (game.rallyLeft > 0 && Math.random() < dt * 5)
      this.sparks.emit(v.obj.position.x, v.obj.position.y + 0.2, v.obj.position.z, "#ffd76a", 1, 1, 0.1, 0.6, 1.5);
  }

  private targets = new Map<number, { x: number; y: number }>();
  private lastTarget(game: Game, tw: Tower): { x: number; y: number } | null {
    let best: Enemy | null = null;
    let bd = Infinity;
    const range = towerStats(tw).range;
    for (const e of game.enemies) {
      const p = enemyPoint(game.level, e);
      const d = Math.hypot(p.x - tw.col - 0.5, p.y - tw.row - 0.5);
      if (d <= range && d < bd) {
        bd = d;
        best = e;
      }
    }
    if (best) {
      const p = enemyPoint(game.level, best);
      this.targets.set(tw.id, p);
      return p;
    }
    return this.targets.get(tw.id) ?? null;
  }

  private syncEnemies(game: Game, dt: number, t: number): void {
    const seen = new Set<number>();
    for (const e of game.enemies) {
      seen.add(e.id);
      let v = this.enemies.get(e.id);
      const p = enemyPoint(game.level, e);
      const gy = this.height(p.x, p.y);
      if (!v) {
        const obj = buildEnemy(e.kind);
        const bar = new THREE.Group();
        const back = new THREE.Mesh(this.barGeo, this.barBack);
        const fill = new THREE.Mesh(this.barGeo, this.fillMats.good);
        back.renderOrder = 10;
        fill.renderOrder = 11;
        fill.position.z = 0.001;
        bar.add(back, fill);
        const k = enemyScale(e.kind);
        bar.scale.set(0.5 * Math.min(1.6, k), 0.06, 1);
        this.dynamic.add(obj, bar);
        const meshes: THREE.Mesh[] = [];
        obj.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh && !(Array.isArray(m.material) ? m.material.some((x) => x.transparent) : m.material.transparent)) meshes.push(m);
        });
        // Start facing along the lane, not snapping round on the first frame.
        const ahead = enemyPoint(game.level, { dist: e.dist + 0.05, lane: e.lane });
        const heading = Math.atan2(-(ahead.y - p.y), ahead.x - p.x);
        v = { obj, bar, fill, last: new THREE.Vector3(p.x, gy, p.y), heading, hit: 9, lean: 0, meshes, mats: meshes.map((m) => m.material), flashing: false };
        this.enemies.set(e.id, v);
      }
      const pos = this.v1.set(p.x, gy, p.y);
      const lift = enemyLift(e.kind);
      const move = this.v2.copy(pos).sub(v.last);
      let turn = 0;
      if (move.lengthSq() > 1e-6) {
        const want = Math.atan2(-move.z, move.x);
        let d = want - v.heading;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        const step = d * Math.min(1, dt * 8);
        v.heading += step;
        if (dt > 0) turn = step / dt;
      }
      v.last.copy(pos);
      v.obj.position.set(p.x, gy + lift + (lift ? Math.sin(t * 3 + e.id) * 0.04 : 0), p.y);
      v.obj.rotation.y = v.heading;
      const inner = v.obj.userData.inner as THREE.Group;
      // Lean into corners: a gentle body roll on the ground, a proper bank in the air.
      const maxLean = lift ? 0.32 : 0.16;
      const wantLean = this.reducedMotion ? 0 : Math.max(-maxLean, Math.min(maxLean, -turn * (lift ? 0.08 : 0.04)));
      v.lean += (wantLean - v.lean) * Math.min(1, dt * 6);
      inner.rotation.x = v.lean;
      const shield = inner.userData.shield as THREE.Object3D | undefined;
      if (shield) shield.visible = (e.shield ?? 1) > 0;
      const moving = !(e.stun > 0 || e.held);
      if (moving) {
        inner.position.y = Math.abs(Math.sin(t * 9 + e.id)) * 0.012;
        const wheels = inner.userData.wheels as THREE.Object3D[] | undefined;
        if (wheels) for (const w of wheels) w.rotation.y += dt * 12;
        const rotors = inner.userData.rotors as THREE.Object3D[] | undefined;
        if (rotors) for (const r of rotors) r.rotation.y += dt * 40;
        const legs = (inner.userData.legs as THREE.Object3D | undefined) ?? null;
        if (legs) legs.children.forEach((l, i) => (l.rotation.z = Math.sin(t * 10 + i * Math.PI) * 0.5));
        const legsAll = inner.userData.legsAll as THREE.Object3D[] | undefined;
        if (legsAll) legsAll.forEach((lg, j) => lg.children.forEach((l, i) => (l.rotation.z = Math.sin(t * 10 + i * Math.PI + j) * 0.5)));
      }
      const rings = inner.userData.rings as THREE.Group | undefined;
      if (rings) rings.rotation.y += dt * 1.5;
      // Stealth: a cloaked shimmer until a Radio Mast sees it.
      const ghost = !isRevealed(game, e);
      v.obj.visible = !ghost || Math.sin(t * 25 + e.id) > 0.75;
      // Status effects as particles.
      const top = gy + lift + 0.62 * enemyScale(e.kind);
      if (e.stun > 0 && Math.random() < dt * 10) this.sparks.emit(p.x, top + 0.1, p.y, "#fff6b0", 1, 0.8, 0.1, 0.4, 0);
      if (e.slowed && Math.random() < dt * 4) this.sparks.emit(p.x, gy + 0.05, p.y, "#7fd06a", 1, 0.5, 0.09, 0.5, 0.5);
      if (e.poisonLeft && e.poisonLeft > 0 && Math.random() < dt * 8) this.sparks.emit(p.x, top, p.y, "#c07aff", 1, 0.4, 0.1, 0.6, 1);
      if (e.stickyLeft && e.stickyLeft > 0 && Math.random() < dt * 8) this.sparks.emit(p.x, gy + 0.15, p.y, "#ffb829", 1, 0.3, 0.1, 0.5, -2);
      if (e.held && Math.random() < dt * 8) this.sparks.emit(p.x, gy + 0.05, p.y, "#d9cbb0", 1, 0.8, 0.12, 0.5, 0.5);
      if (e.charge && e.charge > 0 && Math.random() < dt * 20) this.sparks.emit(p.x, gy + 0.1, p.y, "#ffffff", 1, 1.5, 0.12, 0.3, 0);
      // Health bar.
      v.hit += dt;
      const max = maxHpOf(e);
      const frac = Math.max(0, Math.min(1, e.hp / max));
      v.bar.visible = frac < 1 && !ghost && !isBig(e.kind);
      if (v.bar.visible) {
        v.bar.position.set(p.x, top + 0.2, p.y);
        v.bar.quaternion.copy(this.camera.quaternion);
        v.fill.scale.x = frac;
        v.fill.position.x = -(1 - frac) / 2;
        v.fill.material = frac > 0.6 ? this.fillMats.good : frac > 0.3 ? this.fillMats.mid : this.fillMats.low;
      }
      inner.scale.setScalar(enemyScale(e.kind) * 1.3 * (v.hit < 0.06 ? 1.07 : 1));
      // Hit flash: swap in one shared bright material for a moment (shared materials are never mutated).
      const flash = v.hit < FLASH && v.obj.visible;
      if (flash !== v.flashing) this.setFlash(v, flash);
    }
    for (const [id, v] of this.enemies)
      if (!seen.has(id)) {
        this.dynamic.remove(v.bar);
        if (v.flashing) this.setFlash(v, false);
        // Tip over and sink.
        const obj = v.obj;
        this.enemies.delete(id);
        this.dynamic.remove(obj);
        const startY = obj.position.y;
        this.fx.add(obj, 0.8, (k) => {
          obj.rotation.z = Math.min(1, k * 2.5) * 1.4;
          obj.position.y = startY - Math.max(0, k - 0.4) * 0.6;
          if (k >= 1) obj.visible = false;
        });
      }
  }

  private setFlash(v: EnemyView, on: boolean): void {
    v.flashing = on;
    for (let i = 0; i < v.meshes.length; i++) v.meshes[i]!.material = on ? this.flashMat : v.mats[i]!;
  }

  private syncHero(game: Game, dt: number, t: number): void {
    const c = this.cath;
    if (!c) return;
    dressCath(c);
    c.visible = !hasTwist(game.level, "nocath");
    if (!c.visible) return;
    const h = game.hero;
    const y = this.height(h.x, h.y);
    c.position.set(h.x, y, h.y);
    c.scale.setScalar(1.3);
    const walking = Math.hypot(h.tx - h.x, h.ty - h.y) > 0.03 && h.down === 0;
    const fig = c.userData.fig as THREE.Group;
    const head = c.userData.head as THREE.Sprite | undefined;
    const legs = c.userData.legs as THREE.Object3D[];
    const arm = c.userData.arm as THREE.Object3D;
    fig.rotation.y = h.facing === 1 ? 0 : Math.PI;
    if (h.down > 0) {
      fig.rotation.z = -1.2;
      fig.position.y = 0.1;
      if (head) {
        head.position.set(0, 0.28, 0);
        (head.material as THREE.SpriteMaterial).map = this.faceWorried;
      }
      if (Math.random() < dt * 6) this.sparks.emit(h.x, y + 0.6, h.y, "#ffe66b", 1, 0.4, 0.1, 0.6, 0);
      return;
    }
    fig.rotation.z = 0;
    fig.position.y = walking ? Math.abs(Math.sin(t * 12)) * 0.03 : Math.sin(t * 2) * 0.005;
    if (head) {
      head.position.set(0, 0.72 + fig.position.y, 0);
      (head.material as THREE.SpriteMaterial).map = this.faceTex;
    }
    legs.forEach((l, i) => (l.rotation.z = walking ? Math.sin(t * 12 + i * Math.PI) * 0.6 : 0));
    this.heroSwung += dt;
    const sw = this.heroSwung < 0.25 ? Math.sin((this.heroSwung / 0.25) * Math.PI) : 0;
    arm.rotation.z = -0.3 - sw * 1.8;
  }

  private syncSelection(game: Game, t: number): void {
    const sel = this.selected ?? this.cursor;
    this.selection.visible = !!sel;
    if (sel) {
      const y = this.height(sel.col + 0.5, sel.row + 0.5);
      this.selection.position.set(sel.col + 0.5, y + 0.03, sel.row + 0.5);
      this.selection.scale.setScalar(1 + Math.sin(t * 5) * 0.03);
      ((this.selection.children[0] as THREE.LineSegments).material as THREE.LineBasicMaterial).opacity = this.selected ? 0.95 : 0.5;
    }
    let range = 0;
    let at: { col: number; row: number } | null = null;
    let tint = "#fffbe6";
    let ghostKind: TowerKind | null = null;
    if (this.selected) {
      const tw = towerAt(game, this.selected.col, this.selected.row);
      if (tw) {
        const st = towerStats(tw);
        range = st.range;
        tint = st.slow < 1 ? "#a8ff8a" : "#fffbe6";
      } else if (this.preview) {
        range = towerStats({ kind: this.preview, tier: 1, spec: null }).range;
        tint = "#ffe9a0";
        ghostKind = this.preview;
      }
      at = this.selected;
    }
    this.rangeRing.visible = range > 0 && !!at;
    if (this.rangeRing.visible && at) {
      const y = this.height(at.col + 0.5, at.row + 0.5);
      this.rangeRing.position.set(at.col + 0.5, y + 0.04, at.row + 0.5);
      this.rangeRing.scale.setScalar(range);
      (this.rangeRing.material as THREE.MeshBasicMaterial).color.set(tint);
      ((this.rangeRing.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(tint);
      this.rangeRing.rotation.z = t * 0.2;
    }
    // A see-through preview of the tower about to be built.
    const gk = ghostKind && at ? `${ghostKind}:${at.col}:${at.row}` : "";
    if (gk !== this.ghostKey) {
      if (this.ghost) this.scene.remove(this.ghost);
      this.ghost = null;
      this.ghostKey = gk;
      if (ghostKind && at) {
        const g = buildTower(ghostKind, 1, null);
        g.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) {
            m.material = (m.material as THREE.Material).clone();
            (m.material as THREE.Material).transparent = true;
            (m.material as THREE.Material).opacity = 0.5;
            m.castShadow = false;
          }
        });
        g.position.set(at.col + 0.5, this.height(at.col + 0.5, at.row + 0.5), at.row + 0.5);
        this.ghost = g;
        this.scene.add(g);
      }
    }
    if (this.ghost) this.ghost.position.y = this.height(this.ghost.position.x, this.ghost.position.z) + Math.sin(t * 4) * 0.03;
    this.aimDisc.visible = !!this.aim;
    if (this.aim) {
      this.aimDisc.position.set(this.aim.x, this.height(this.aim.x, this.aim.y) + 0.05, this.aim.y);
      this.aimDisc.scale.setScalar(this.aim.r);
    }
  }

  // ---- set pieces: floodwater, the swing bridge, pools of light in a blackout ----

  private pieces: { level: number; flood?: THREE.InstancedMesh; bridge?: THREE.Group; deck?: THREE.Object3D; pools?: THREE.InstancedMesh } | null = null;

  private syncSetPieces(game: Game, t: number): void {
    const lv = game.level;
    if (this.pieces?.level !== lv.id) {
      if (this.pieces) for (const o of [this.pieces.flood, this.pieces.bridge, this.pieces.pools]) if (o) this.scene.remove(o);
      this.pieces = { level: lv.id };
      const flood = setPiece(lv, "flood");
      if (flood) {
        const m = new THREE.InstancedMesh(
          new THREE.BoxGeometry(0.98, 0.06, 0.98),
          new THREE.MeshPhysicalMaterial({ color: "#4f93b8", roughness: 0.08, transparent: true, opacity: 0.78, clearcoat: 1 }),
          flood.cells.length,
        );
        const mat = new THREE.Matrix4();
        flood.cells.forEach(([c, r], i) => {
          mat.makeTranslation(c + 0.5, this.height(c + 0.5, r + 0.5) + 0.12, r + 0.5);
          m.setMatrixAt(i, mat);
        });
        m.visible = false;
        this.scene.add(m);
        this.pieces.flood = m;
      }
      const bridge = setPiece(lv, "bridge");
      if (bridge) {
        const p = enemyPoint(lv, { dist: bridge.dist, lane: bridge.lane });
        const h = enemyPoint(lv, { dist: bridge.dist + 0.3, lane: bridge.lane });
        const g = new THREE.Group();
        g.position.set(p.x, this.height(p.x, p.y), p.y);
        g.rotation.y = Math.atan2(h.x - p.x, h.y - p.y);
        const water = new THREE.Mesh(
          new THREE.BoxGeometry(1.1, 0.04, 0.9),
          new THREE.MeshPhysicalMaterial({ color: "#3f7fa6", roughness: 0.1, clearcoat: 1 }),
        );
        water.position.y = -0.02;
        const pivot = new THREE.Group();
        pivot.position.set(-0.5, 0.06, 0);
        const deck = new THREE.Mesh(new THREE.BoxGeometry(1, 0.08, 0.86), new THREE.MeshStandardMaterial({ color: "#8a5a35", roughness: 0.8, flatShading: true }));
        deck.position.x = 0.5;
        deck.castShadow = true;
        pivot.add(deck);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshStandardMaterial({ color: "#ff3b30", emissive: "#ff3b30", emissiveIntensity: 2 }));
        lamp.position.set(-0.55, 0.45, 0.48);
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45), new THREE.MeshStandardMaterial({ color: "#2b2320" }));
        post.position.set(-0.55, 0.22, 0.48);
        g.add(water, pivot, post, lamp);
        g.userData.lamp = lamp;
        this.scene.add(g);
        this.pieces.bridge = g;
        this.pieces.deck = pivot;
      }
      if (setPiece(lv, "blackout")) {
        const c = document.createElement("canvas");
        c.width = c.height = 64;
        const x = c.getContext("2d")!;
        const grad = x.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, "rgba(255,214,140,0.9)");
        grad.addColorStop(0.7, "rgba(255,190,110,0.35)");
        grad.addColorStop(1, "rgba(255,190,110,0)");
        x.fillStyle = grad;
        x.fillRect(0, 0, 64, 64);
        const tex = new THREE.CanvasTexture(c);
        const pools = new THREE.InstancedMesh(
          new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
          new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
          96,
        );
        pools.count = 0;
        this.scene.add(pools);
        this.pieces.pools = pools;
      }
    }
    const pc = this.pieces;
    if (pc.flood) pc.flood.visible = game.wave >= (setPiece(lv, "flood")?.wave ?? 99);
    if (pc.deck && pc.bridge) {
      const open = bridgeOpen(game);
      const want = open ? -1.1 : 0;
      pc.deck.rotation.z += (want - pc.deck.rotation.z) * 0.15;
      (pc.bridge.userData.lamp as THREE.Mesh).visible = open && Math.sin(t * 8) > 0;
    }
    const dark = setPiece(lv, "blackout");
    if (pc.pools && dark) {
      const m = new THREE.Matrix4();
      let n = 0;
      const put = (x: number, z: number) => {
        if (n >= 96) return;
        const d = dark.light * 2.1;
        m.makeScale(d, 1, d).setPosition(x, this.height(x, z) + 0.05, z);
        pc.pools!.setMatrixAt(n++, m);
      };
      for (const tw of game.towers) if ((tw.out ?? 0) <= 0) put(tw.col + 0.5, tw.row + 0.5);
      if (game.hero.down <= 0) put(game.hero.x, game.hero.y);
      pc.pools.count = n;
      pc.pools.instanceMatrix.needsUpdate = true;
    }
  }

  private syncBoss(game: Game): void {
    const boss = game.enemies.filter((e) => isBig(e.kind)).sort((a, b) => b.dist - a.dist)[0];
    this.bossBar.hidden = !boss;
    if (boss) {
      this.bossName.textContent = ENEMIES[boss.kind].name;
      this.bossFill.style.setProperty("--f", String(Math.max(0, boss.hp / maxHpOf(boss))));
    }
  }
}
