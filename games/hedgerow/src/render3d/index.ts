// Hedgerow's 3D renderer (three.js): the owner asked for "StarCraft 2 type visuals" (2026-10-02). A lit,
// shadowed, tone-mapped battlefield with bloom; procedural models (models.ts) for every tower tier and
// specialisation, every enemy, Cath and the farmhouse; effects (fx.ts) for every engine event. It only
// reads the Game. Same interface as the 2D Renderer (render.ts), which stays as the fallback when WebGL
// isn't available.

import { fitCamera3d } from "./camerafit";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { BACKDROP_SKY_Y, BACKDROP_Z, buildBackdrop } from "./backdrop";
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
  betweenRounds,
  headingAt,
  waveSpawns,
  hasTwist,
  isBig,
  isFleet,
  laneCellsOf,
  isRevealed,
  landmarks,
  oakAt,
  maxHpOf,
  postMarker,
  towerAt,
  towerStats,
  type Enemy,
  type Game,
  type GameEvent,
  type Tower,
  type TowerKind,
} from "../engine";
import { actLight, actMood, matte, nightLight } from "./palette";
import { fordMiddle } from "../landmarks";
import { buildCath, dressCath, liftCath, buildEnemy, buildRung, buildBarn, buildLandmark, buildMega, buildOak, buildThornPile, buildTower, crownTopper, enemyLift, enemyScale } from "./models";

/** Path tier 3 looks that throw like an old specialisation's shot. */
const LOOK_SPEC: Record<string, 0 | 1> = { crow: 1, hawk: 1, pumpkin: 0, scatter: 1, queen: 0, honey: 1 };
import { buildGround, type Ground } from "./terrain";
import { Crops } from "./crops";
import { Birds, Debris, Floaters, Motes, Sparks, Transients, disposeOwn, sharedGeometry } from "./fx";
import { RungInstances, liveryOf } from "./rungs";
import { RUNGS, crackStage } from "../fleet";
import { swarms, SWARM_MIN } from "../swarm";
import { COLUMN_TIERS, layOutField, placeOnLane, type Convoy, type ConvoyColumn } from "../convoy";
import { enemyIcon } from "../icons";
import { gateQueue, type GateQueue } from "../gatequeue";
import { FarmFolk, type Folk } from "../farmfolk";
import { FolkMeshes } from "./folk";

interface TowerView {
  obj: THREE.Group;
  sig: string;
  fired: number;
  /** Seconds since it was built or upgraded. */
  pop: number;
  /** The build-up in progress (null once it has finished, or with reduced motion). */
  build: BuildUp | null;
}

/** A tower going up: the plinth is laid, then its parts rise into place from the bottom up. */
interface BuildUp {
  plinth: THREE.Object3D | null;
  parts: Array<{ o: THREE.Object3D; y: number; s: THREE.Vector3; delay: number }>;
  /** When the last part is in place. */
  end: number;
}

/** How long each part of a tower takes to rise into place, and the spread of their start times. */
const RISE = 0.24;
const RISE_SPREAD = 0.22;
/** How long the plinth takes to settle (parts start rising once it's down, unless it's an upgrade). */
const PLINTH = 0.12;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
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
  crack?: number;
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

/** Cath's pose: rolling-pin shoulder, elbow, wrist; free shoulder, elbow; body lean; body twist (radians). */
type Pose = [number, number, number, number, number, number, number];

/** Seconds into Cath's throw when the pie leaves her hand. */
/** Each act's weather over the field: falling leaves, drifting sea mist, embers, confetti and ash. */
const ACT_WEATHER: ({ count: number; color: string; size: number; fall: number; wind: number; alpha: number; additive?: boolean } | null)[] = [
  { count: 18, color: "#fffdf0", size: 0.07, fall: 0.12, wind: 1.8, alpha: 0.85 }, // The home hills: dandelion seed drifting by
  { count: 26, color: "#c8a8d8", size: 0.09, fall: 0.25, wind: 2.4, alpha: 0.8 }, // Highmoor: heather blown on the wind
  { count: 22, color: "#eef6f8", size: 1.3, fall: 0, wind: 0.5, alpha: 0.16 }, // Saltmarsh: sea mist
  { count: 60, color: "#dfeaf2", size: 0.05, fall: 2.6, wind: 0.3, alpha: 0.7 }, // Rivermead: fine drizzle
  { count: 34, color: "#d98a38", size: 0.12, fall: 0.5, wind: 1.2, alpha: 0.95 }, // Oakvale: falling leaves
  { count: 20, color: "#f4fafc", size: 1.1, fall: 0, wind: 1.4, alpha: 0.14 }, // Shingle Bay: spray
  { count: 40, color: "#ff8a3a", size: 0.1, fall: -0.45, wind: 0.8, alpha: 0.9, additive: true }, // The Rift: embers rise
  { count: 36, color: "#e8433a", size: 0.1, fall: 0.35, wind: 1, alpha: 0.9 }, // The Ballot: confetti
  { count: 40, color: "#9a9a9a", size: 0.08, fall: 0.3, wind: 0.8, alpha: 0.7 }, // The Merger: drifting ash
  { count: 48, color: "#f6f1e2", size: 0.13, fall: 0.4, wind: 0.6, alpha: 0.9 }, // Kingsmarket: shredded paper falling like snow
];

const HERO_PIE_RELEASE = 0.15;

/** Gold floaters from fleet knocks merge over this many seconds (section 8). */
const GOLD_WINDOW = 0.15;

/** How long a hit flash lasts, in seconds. */
const FLASH = 0.07;

const SHOT_COLOURS: Record<string, string> = {
  scarecrow: "#ffe08a",
  beehive: "#ffd23f",
  pond: "#8fd8ff",
  barn: "#f2c94c",
  silo: "#ffcf5a",
};

/** Plan item 78: Cath's 3D figure at twice her old size (0.98). */
export const CATH_3D_SCALE = 1.9;
/** Plan item 98: the camera elevation (radians above the horizon) past which Cath leans back towards the lens. */
const CATH_LEAN_FROM = 0.95;

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
  /** Plan item 59: the growing field. */
  private crops: Crops | null = null;
  private levelId = -1;
  private towers = new Map<number, TowerView>();
  private enemies = new Map<number, EnemyView>();
  /** Fleet levels: every rung kind is one InstancedMesh (Hedgerow 2 M2); built on the first fleet level. */
  private rungs: RungInstances | null = null;
  /** Fleet knocks' Marks not yet floated: one "+N" every GOLD_WINDOW seconds. */
  private gold = { n: 0, x: 0, y: 0, age: 0 };
  private cath: THREE.Group | null = null;
  private faceTex: THREE.Texture | null = null;
  private sparks = new Sparks();
  private motes: Motes[] = [];
  private birds: Birds | null = null;
  private pxScale = 300;
  private kit: ShotKit | null = null;
  private flashMat = Object.assign(new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#fff0dc", emissiveIntensity: 0.9, roughness: 0.6 }), { shared: true });
  private gustLeaves: string[] = ["#6ea04c", "#8fbd57", "#c9a640"];
  private v1 = new THREE.Vector3();
  private q1 = new THREE.Quaternion();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();
  private debris = new Debris();
  private fx: Transients;
  private floaters: Floaters;
  private selection: THREE.Group;
  private rangeRing: THREE.Mesh;
  private aimDisc: THREE.Mesh;
  /** Cath's post between rounds: green when a tower reaches it, amber when nothing does. */
  private postRing: THREE.Mesh;
  /** A halo on Cath while she's picked up. */
  private heroHalo: THREE.Mesh;
  private ghost: THREE.Group | null = null;
  private ghostKey = "";
  private bossBar: HTMLElement;
  /** Swarm badges (plan item 10), one per queue of more than 12, pooled; `key` is what each one shows. */
  private swarmEls: Array<{ el: HTMLElement; key: string }> = [];
  /** Plan item 45: this frame's convoy layout (syncEnemies), which the swarm badges ride. */
  private lay: Convoy = { slots: new Map(), inColumn: new Map(), columns: [] };
  /** Plan item 45: each tower's pooled Marks and its "+N" label. */
  private towerMarks = new Map<number, { n: number; quiet: number; el: HTMLElement | null }>();
  /** Wreck panels are lying on the field (cleared once the round is over). */
  private debrisLying = false;
  private overlayEl: HTMLElement;
  private bossFill: HTMLElement;
  private bossName: HTMLElement;
  private clock = 0;
  private shake = 0;
  /** 1 while a big enemy is on the field: the camera eases in a few percent (the boss-wave nudge). */
  private bossPush = 0;
  private bossEase = 0;
  private camBase = new THREE.Vector3();
  private camTarget = new THREE.Vector3();
  private heroSwung = 9;
  private heroPie = 9;
  /** Plan item 102: seconds since she cheered a cleared round, and since a vehicle leaked (her worried hand). */
  private heroCheer = 9;
  /** Seconds since a tower went in (she stoops to plant it), and the tower count she last saw. */
  private heroPlant = 9;
  private towersSeen = -1;
  /** What her body says right now (read by the sandbox e2e). */
  heroMood: "rest" | "cheer" | "worried" | "plant" = "rest";
  private heroWorry = 9;
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
  /** While Cath is picked up: where she'd stand if put down here. */
  postPreview: { x: number; y: number } | null = null;
  aim: { x: number; y: number; r: number } | null = null;
  preview: TowerKind | null = null;
  reducedMotion = false;
  /** Plan item 143: the people and animals working the farm. */
  readonly farm = new FarmFolk();
  shownFolk: Folk[] = [];
  private folkMeshes = new FolkMeshes();
  /** Plan item 59: the harvest's Cath walks the beds over the field, so the field's own Cath steps out. */
  harvesting = false;

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
    this.overlayEl = overlay;
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
    this.postRing = new THREE.Mesh(
      new THREE.RingGeometry(0.34, 0.44, 40),
      new THREE.MeshBasicMaterial({ color: "#8dff8a", transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.postRing.add(
      new THREE.Mesh(new THREE.CircleGeometry(0.34, 40), new THREE.MeshBasicMaterial({ color: "#8dff8a", transparent: true, opacity: 0.16, depthWrite: false })),
    );
    this.postRing.rotation.x = -Math.PI / 2;
    this.postRing.visible = false;
    this.heroHalo = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.5, 40),
      new THREE.MeshBasicMaterial({ color: "#ffd76a", transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.heroHalo.rotation.x = -Math.PI / 2;
    this.heroHalo.visible = false;
    this.scene.add(this.selection, this.rangeRing, this.aimDisc, this.postRing, this.heroHalo);

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

    // Her portrait, with its bottom edge faded out so the cut ends of her hair blend into her 3D hair.
    const tex = (svg: string) => {
      const c = document.createElement("canvas");
      c.width = 312;
      c.height = 376;
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      const img = new Image();
      img.onload = () => {
        const ctx = c.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, c.width, c.height);
        ctx.globalCompositeOperation = "destination-in";
        const g = ctx.createLinearGradient(0, c.height * 0.8, 0, c.height);
        g.addColorStop(0, "rgba(0,0,0,1)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, c.width, c.height);
        t.needsUpdate = true;
      };
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      return t;
    };
    this.faceTex = tex(cathSvg({ framing: "face", expression: "determined", width: 312, height: 376 }));
    // Sandbox only: a handle for screenshot scripts (zoom on Cath, freeze a swing).
    if (new URLSearchParams(location.search).has("sandbox")) (window as unknown as { hedgerow3d: Renderer3D }).hedgerow3d = this;
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
    const L = hasTwist(game.level, "night") && game.level.id <= 90 ? nightLight(actLight(game.level.id)) : actLight(game.level.id);
    this.ground = buildGround(game.level);
    this.world.add(this.ground.group);
    this.crops = new Crops(game.level, this.ground.heightAt, this.canvas, this.reducedMotion);
    this.world.add(this.crops.group);
    this.folkMeshes = new FolkMeshes();
    this.world.add(this.folkMeshes.group);
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
    // Plan item 66: the painted sky and horizon behind the far scenery.
    this.world.add(buildBackdrop(game.level.cols, L, hasTwist(game.level, "night") || game.level.id > 90, hasTwist(game.level, "fog")));
    const fogDim = hasTwist(game.level, "fog") ? 0.78 : hasTwist(game.level, "night") ? 0.85 : 1;
    this.scene.fog = new THREE.Fog(L.fog, L.fogNear * fogDim, L.fogFar * fogDim);
    const night = hasTwist(game.level, "night") || game.level.id > 90;
    this.renderer.toneMappingExposure =
      L.exposure * (game.level.id > 90 ? 1.25 : night ? 1 : 1.06) * (setPiece(game.level, "blackout") ? 0.55 : 1);
    this.hemi.color.set(L.hemiSky);
    this.hemi.groundColor.set(L.hemiGround);
    // Plan item 66: a warm key and a soft, warm bounce by day (the 2D field's sunny poster), not overcast fill.
    this.hemi.intensity = L.hemiIntensity * (night ? 1.4 : 0.8);
    if (!night) this.hemi.groundColor.lerp(new THREE.Color("#c8a46a"), 0.35);
    this.sun.color.set(L.sun);
    if (!night) this.sun.color.lerp(new THREE.Color("#ffd9a0"), 0.3);
    this.sun.intensity = L.sunIntensity * (night ? 1.25 : 1.4) * (hasTwist(game.level, "rain") ? 0.7 : 1);
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
    liftCath(this.cath);
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
      const wind = hasTwist(lv, "wind") ? 3 : 1;
      const act = Math.min(9, Math.floor((lv.id - 1) / 10));
      const weather = ACT_WEATHER[act]!;
      const sky = { ...box, y0: 0.1, y1: 3.2 };
      if (!hasTwist(lv, "rain")) this.motes.push(new Motes(70, { kind: "pollen", color: mood.mote, size: 0.05, box, wind }));
      if (weather && !this.reducedMotion) {
        this.motes.push(new Motes(weather.count, { kind: "pollen", color: weather.color, size: weather.size, box: weather.fall && weather.fall < 0 ? { ...sky, y1: 2.2 } : weather.fall ? sky : { ...box, y0: 0.1, y1: 0.9 }, wind: weather.wind * wind, fall: weather.fall, alphaMax: weather.alpha, additive: weather.additive }));
      }
      const coast = lv.id > 20 && lv.id <= 30 ? true : lv.id > 50 && lv.id <= 60;
      if (mood.birds && !hasTwist(lv, "fog")) this.birds = new Birds(mood.birds, cx, cz, span, false, coast ? "#f4f2ec" : "#3b3540");
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
    // Plan item 78: fitted to the field per aspect ratio (camerafit.ts), the field filling the frame with a band of
    // hills and sky above it.
    const fit = fitCamera3d(cols, rows, this.w / this.h);
    const target = new THREE.Vector3(...fit.target);
    const dir = new THREE.Vector3(0, Math.sin(fit.el), Math.cos(fit.el));
    const hi = fit.dist;
    // resize() set the aspect; the projection has to follow it (the old search loop refreshed it as a side effect).
    this.camera.aspect = this.w / this.h;
    this.camera.updateProjectionMatrix();
    this.camera.position.copy(target).addScaledVector(dir, hi);
    this.camera.lookAt(target);
    this.camBase.copy(this.camera.position);
    // Fog starts beyond the field whatever the camera distance (phones sit further back).
    if (this.scene.fog instanceof THREE.Fog) {
      const L = actLight(game.level.id);
      const dim = hasTwist(game.level, "fog") ? 0.78 : hasTwist(game.level, "night") ? 0.85 : 1;
      // Plan item 66: clear air over the field by day; the haze only gathers out towards the hills.
      const clear = dim === 1 && game.level.id <= 90 ? 4 : 0;
      // Plan item 78: measured from the field's far edge (the fitted camera sits much closer than before), so the
      // field itself stands in clear air and the haze gathers over the hills beyond it.
      const farEdge = this.camera.position.distanceTo(this.v1.set(cols / 2, 0, -0.5));
      const near = farEdge + (L.fogNear - 14) * 0.5 + clear;
      this.scene.fog.near = near * dim;
      this.scene.fog.far = (near + (L.fogFar - L.fogNear)) * dim;
    }
    this.camTarget.copy(target);
    this.fieldSize.set(cols, rows);
    this.resetView();
  }

  /** Plan item 78: the share of the frame the field's projected bounding box covers (0..1), at the fitted view. */
  /** Plan item 102: her face's box on screen in CSS px (the modelled head's face sphere), for the size checks. */
  faceBox(): { w: number; h: number } | null {
    const face = this.faceMesh();
    if (!face) return null;
    const box = new THREE.Box3().setFromObject(face);
    const r = this.canvas.getBoundingClientRect();
    const xs: number[] = [];
    const ys: number[] = [];
    const v = new THREE.Vector3();
    for (let k = 0; k < 8; k++) {
      v.set(k & 1 ? box.max.x : box.min.x, k & 2 ? box.max.y : box.min.y, k & 4 ? box.max.z : box.min.z).project(this.camera);
      xs.push(((v.x + 1) / 2) * r.width);
      ys.push(((1 - v.y) / 2) * r.height);
    }
    return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  }

  /** Plan item 162: the lit brightness (0..1) of her face's and her hair's materials: colour plus emission. */
  faceTone(): { face: number; hair: number } | null {
    let face: number | null = null, hair: number | null = null;
    const lum = (m: THREE.MeshStandardMaterial) => {
      const c = m.color.clone().add(m.emissive.clone().multiplyScalar(m.emissiveIntensity));
      return 0.2126 * Math.min(1, c.r) + 0.7152 * Math.min(1, c.g) + 0.0722 * Math.min(1, c.b);
    };
    this.cath?.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || Array.isArray(m.material)) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat.name === "face" && face === null) face = lum(mat);
      if (mat.name === "hair" && hair === null) hair = lum(mat);
    });
    return face === null || hair === null ? null : { face, hair };
  }

  private faceCache: THREE.Mesh | null = null;
  private faceKey = new THREE.Color("#e8a383");
  private faceMesh(): THREE.Mesh | null {
    if (this.faceCache?.parent) return this.faceCache;
    this.faceCache = null;
    this.cath?.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!this.faceCache && m.isMesh && !Array.isArray(m.material) && m.material.name === "face") this.faceCache = m;
    });
    return this.faceCache;
  }

  fieldShare(): number {
    const { x: cols, y: rows } = this.fieldSize;
    // The fitted base view, not the live camera (which carries the player's zoom and pan and the gate's ease).
    const cam = this.camera.clone();
    cam.position.copy(this.camBase);
    cam.lookAt(this.camTarget);
    cam.updateMatrixWorld();
    let x0 = 1, x1 = -1, y0 = 1, y1 = -1;
    for (const [x, z] of [[0, 0], [cols, 0], [0, rows], [cols, rows]] as const) {
      const p = this.v1.set(x, 0, z).project(cam);
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    }
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    return ((clamp(x1) - clamp(x0)) / 2) * ((clamp(y1) - clamp(y0)) / 2);
  }

  /** Plan item 66: the share of the frame's height above the backdrop's painted hills (its sky), at the view's centre. */
  /** Plan item 98: the gate signs turn to face the camera, so the town's name reads at every framing. */
  private faceGateSigns(): void {
    this.plateTown = "";
    for (const sign of (this.ground?.group.userData.gateSigns as THREE.Object3D[] | undefined) ?? []) {
      const parent = sign.parent;
      if (!parent) continue;
      parent.getWorldQuaternion(this.q1).invert();
      sign.quaternion.copy(this.q1).multiply(this.camera.quaternion);
      // Turned back towards a high camera, the board's foot would sink behind the crossbar: stand it a little out
      // in front of the bar, towards the camera.
      const home = (sign.userData.home as THREE.Vector3 | undefined) ?? (sign.userData.home = sign.position.clone());
      this.v1.set(0, 0, 1).applyQuaternion(this.camera.quaternion).applyQuaternion(this.q1).multiplyScalar(0.16);
      sign.position.copy(home).add(this.v1);
      // On a phone the whole field is small: grow the board until its letters stand 8.5 px (about 12 px type), up to
      // 1.6 times its size.
      sign.scale.setScalar(1);
      sign.updateMatrixWorld();
      const cap = this.signCap(sign);
      const grow = cap > 0 ? Math.min(1.6, Math.max(1, 8.5 / cap)) : 1;
      sign.scale.setScalar(grow);
      // Plan item 103: grown on a phone, a board standing on the field covered the next column's plots; there it
      // steps down and the queue's plate carries the town's name instead.
      sign.visible = !(grow > 1 && sign.userData.inField);
      if (!sign.visible) this.plateTown = sign.userData.town as string;
      sign.updateMatrixWorld();
    }
  }

  /** A gate sign's letter cap height on screen, in CSS px. */
  private signCap(o: THREE.Object3D): number {
    const cap = (o.userData.gateSignCap as number | undefined) ?? 0;
    const a = o.localToWorld(this.v1.set(0, cap / 2, 0)).project(this.camera).y;
    const b = o.localToWorld(this.v1.set(0, -cap / 2, 0)).project(this.camera).y;
    return (Math.abs(a - b) / 2) * this.h;
  }

  /** Plan item 98: each gate sign's on-screen centre and letter cap height, in CSS px (tests hold it at 11 px). */
  gateSigns(): Array<{ x: number; y: number; cap: number }> {
    const rect = this.canvas.getBoundingClientRect();
    const out: Array<{ x: number; y: number; cap: number }> = [];
    const toPx = (v: THREE.Vector3) => ({ x: rect.left + (v.x * 0.5 + 0.5) * rect.width, y: rect.top + (-v.y * 0.5 + 0.5) * rect.height });
    this.scene.updateMatrixWorld();
    this.scene.traverse((o) => {
      const cap = o.userData.gateSignCap as number | undefined;
      if (!cap || !o.visible) return;
      const mid = toPx(o.localToWorld(new THREE.Vector3(0, 0, 0)).project(this.camera));
      const a = toPx(o.localToWorld(new THREE.Vector3(0, cap / 2, 0)).project(this.camera));
      const b = toPx(o.localToWorld(new THREE.Vector3(0, -cap / 2, 0)).project(this.camera));
      out.push({ x: mid.x, y: mid.y, cap: Math.hypot(a.x - b.x, a.y - b.y) });
    });
    return out;
  }

  skyBand(): number {
    const p = this.v1.set(this.fieldSize.x / 2, BACKDROP_SKY_Y, BACKDROP_Z).project(this.camera);
    return Math.max(0, Math.min(1, (1 - p.y) / 2));
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
    // Wood and stone chips, and dust rolling out from the plinth as it goes down.
    this.debris.emit(col + 0.5, y + 0.05, row + 0.5, ["#8a6a43", "#9a9183", "#6b4a2b", "#c8bfae", "#b48a5a"], upgrade ? 6 : 12, 0.05, 1.6);
    if (!this.reducedMotion) this.fx.dust(col + 0.5, y, row + 0.5, upgrade ? 0.45 : 0.6, "#cdbb98", upgrade ? 7 : 11);
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
    this.farm.feed(events, game);
    for (const e of events) {
      switch (e.type) {
        case "shot": {
          const tv = this.towers.get(e.tower);
          if (tv) tv.fired = 0;
          const fy = this.height(e.fromX, e.fromY) + 0.7;
          const ty = this.height(e.toX, e.toY) + 0.25;
          // A path tower's tier 3 throws like the old specialisation it grew from (Crow Caller's crows...).
          const spec = e.spec ?? (e.look ? (LOOK_SPEC[e.look] ?? null) : null);
          this.projectile(e.kind, spec, e.fromX, fy, e.fromY, e.toX, ty, e.toY, !!e.crit, e.enemy);
          break;
        }
        case "bale": {
          const bv = this.towers.get(e.tower);
          if (bv) bv.fired = 0;
          const y = this.height(e.x, e.y);
          this.fx.ring(e.x, y + 0.08, e.y, "#e2c06a", 1.0, 0.4);
          this.debris.emit(e.x, y + 0.3, e.y, ["#d8b45a", "#e2c06a"], 10, 0.05, 1.5);
          break;
        }
        case "pile": {
          const y = this.height(e.x, e.y);
          this.debris.emit(e.x, y + 0.2, e.y, ["#e9e1cf", "#5b4330"], 6, 0.04, 1.2);
          break;
        }
        case "knock": {
          // A layer off: a burst of chips in the colour of the rung underneath (12 for a lorry's box).
          const y = this.height(e.x, e.y);
          const under = (e.to ? RUNGS[e.to]?.colour : RUNGS[e.from]?.colour) ?? "#f4f6f8";
          if (!this.reducedMotion) this.sparks.emit(e.x, y + 0.3, e.y, under, e.from === "lorry" && e.to ? 12 : 4, 2.2, 0.1, 0.45, -5);
          // Plan item 45: a tower's Marks pool into one +N over it (syncTowerMarks).
          if (e.tower !== undefined) {
            const m = this.towerMarks.get(e.tower) ?? { n: 0, quiet: 0, el: null };
            m.n += e.n;
            m.quiet = 0;
            this.towerMarks.set(e.tower, m);
          } else {
            this.gold.n += e.n;
            this.gold.x = e.x;
            this.gold.y = e.y;
          }
          break;
        }
        case "wreck": {
          const y = this.height(e.x, e.y);
          if (!this.reducedMotion) {
            this.debris.emit(e.x, y + 0.3, e.y, [RUNGS[e.kind]?.colour ?? "#f2c230", "#3b3f44", "#c79a62", "#f4f6f8"], 36, 0.09, 3.2);
            this.sparks.emit(e.x, y + 0.3, e.y, "#ffb04a", 50, 3.6, 0.25, 0.5, -1);
          }
          // Plan item 45: a few panels stay lying by the lane until the round is over.
          this.debris.emit(e.x, y + 0.15, e.y, [RUNGS[e.kind]?.colour ?? "#f2c230", "#3b3f44"], 5, 0.08, this.reducedMotion ? 0.2 : 1.1, true);
          this.debrisLying = true;
          // Comic death (H13): a hubcap rolls off, a sound-word pops up.
          this.fx.ring(e.x, y + 0.04, e.y, "#d8dde2", 0.5, 0.6);
          // The wreck leaves a scorch mark and a lazy column of grey smoke.
          this.fx.decal(e.x, y, e.y, "#1c1814", 0.7);
          this.sparks.emit(e.x, y + 0.3, e.y, "#8a8d92", 14, 0.6, 0.3, 1.6, 0.5);
          // Vans and lorries fold up: a second, wider ring and a slab of flat panels falling out of the roof.
          if (e.kind === "van" || e.kind === "lorry" || e.kind === "artic") {
            this.fx.ring(e.x, y + 0.05, e.y, "#b8bec6", 1.1, 0.8);
            this.debris.emit(e.x, y + 0.6, e.y, [RUNGS[e.kind]?.colour ?? "#f2c230", "#d8dde2"], 14, 0.12, 1.0);
          }
          this.floaters.add(["CRUNCH!", "KA-THUNK!", "CLANG!", "SPLAT!"][(Math.floor(e.x * 7 + e.y * 3) >>> 0) % 4]!, new THREE.Vector3(e.x, y + 0.9, e.y), "#fff3c4", 1.5);
          break;
        }
        case "kill": {
          const y = this.height(e.x, e.y);
          const big = isBig(e.kind);
          if (e.bounty === 0 && !big) {
            // Fleet: the last layer's pop already paid; leave a scrap of parcel tape, no decal or floater.
            this.debris.emit(e.x, y + 0.2, e.y, ["#c79a62", "#ffe27a"], 3, 0.05, 1.6);
            break;
          }
          // A lawyer's briefcase bursts: papers everywhere, drifting down slowly.
          if (e.kind === "lawyer") {
            this.debris.emit(e.x, y + 0.5, e.y, ["#ffffff", "#f4f1e6", "#fffbe8"], 22, 0.07, 1.4);
            this.floaters.add("OBJECTION!", new THREE.Vector3(e.x, y + 0.9, e.y), "#fff3c4", 1.3);
          }
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
          if (this.ground) this.closeUp(game, this.ground.farmhouse.position.x, this.ground.farmhouse.position.z);
          if (this.heroCheer > 1.2) this.heroWorry = 0;
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
          this.heroPie = 0;
          // It leaves her hand as her arm comes over (HERO_PIE_RELEASE s in), from in front of her shoulder.
          from.x += h.facing * 0.3;
          pie.visible = false;
          const lead = HERO_PIE_RELEASE / (HERO_PIE_RELEASE + 0.4);
          this.fx.add(pie, HERO_PIE_RELEASE + 0.4, (kk) => {
            const k = Math.max(0, (kk - lead) / (1 - lead));
            pie.visible = kk >= lead;
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
          this.heroCheer = 0;
          const [c, r] = game.level.path[game.level.path.length - 1]!;
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
          if (e.phase) {
            // Phase change: a shockwave, a gold second ring and a loud label so the player sees the fight turn.
            this.kick(0.9);
            this.fx.ring(e.x, y + 0.1, e.y, "#ffd76a", 5.5, 0.9);
            this.fx.ring(e.x, y + 0.12, e.y, "#ffffff", 2.5, 0.45);
            this.floaters.add(`PHASE ${e.phase}`, new THREE.Vector3(e.x, y + 2, e.y), "#ffd76a", 1.7);
            this.sparks.emit(e.x, y + 0.5, e.y, "#ffd76a", 70, 3, 0.16, 1, -2);
          }
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
          if (e.sweep) {
            // Whirling Scythe: a ring of cut straw round the scarecrow.
            this.fx.ring(e.x, y + 0.3, e.y, "#e2c06a", e.radius * 2, 0.25);
            this.sparks.emit(e.x, y + 0.5, e.y, "#f2d98a", 10, 2.6, 0.08, 0.35, -3);
            break;
          }
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
          this.closeUp(game, e.x, e.y);
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

  /** Plan item 191: a double-tap pushes in on the plot under it (a second double-tap, resetView, comes back). */
  pushTo(clientX: number, clientY: number): void {
    const w = this.worldAt(clientX, clientY);
    this.zoom = 2;
    this.pan.set(w.x - this.camTarget.x, w.y - this.camTarget.z);
    this.clampPan();
  }

  // ---- the director (plan item 191): a dolly from the depot along the lane on Go, and at most one close-up a
  // round (a megastructure's merge, or the house at a leak). Reduced motion and phones get no moves at all.
  private shot: { x: number; z: number; zoom: number; dur: number; t: number; dolly: boolean } | null = null;
  private shotRound = -1;
  private lastPhase = "";
  private get directs(): boolean {
    return !this.reducedMotion && this.w >= 600;
  }
  private direct(game: Game, dt: number): void {
    if (game.phase === "wave" && this.lastPhase && this.lastPhase !== "wave" && this.directs && !this.zoomed) {
      const depot = ((this.ground?.group.userData.depots as THREE.Object3D[] | undefined) ?? [])[0];
      const [c, r] = game.level.path[0] ?? [0, 0];
      this.shot = { x: depot ? depot.position.x : c + 0.5, z: depot ? depot.position.z : r + 0.5, zoom: 1.35, dur: 1.5, t: 0, dolly: true };
    }
    this.lastPhase = game.phase;
    if (this.shot) {
      this.shot.t += dt;
      if (this.shot.t >= this.shot.dur) this.shot = null;
    }
  }
  /** A close-up on (x, z), at most one a round and never over a move already running. */
  private closeUp(game: Game, x: number, z: number): void {
    if (!this.directs || this.shot || this.zoomed || this.shotRound === game.wave) return;
    this.shotRound = game.wave;
    this.shot = { x, z, zoom: 1.5, dur: 1.6, t: 0, dolly: false };
  }
  /** How far the director has the camera away from the play view (0 = the play view). */
  private shotWeight(): number {
    const s = this.shot;
    if (!s) return 0;
    const k = Math.min(1, s.t / s.dur);
    if (s.dolly) return 1 - k * k * (3 - 2 * k);
    return s.t < 0.3 ? s.t / 0.3 : s.t > s.dur - 0.6 ? Math.max(0, (s.dur - s.t) / 0.6) : 1;
  }
  /** Tests: the camera's position, and whether a directed move is running. */
  camState(): { x: number; y: number; z: number; moving: boolean } {
    const p = this.camera.position;
    return { x: p.x, y: p.y, z: p.z, moving: !!this.shot };
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
    this.shownFolk = this.farm.step(game, dt, this.reducedMotion);
    this.folkMeshes.update(this.shownFolk, (x, z) => this.height(x, z), t);
    this.syncSelection(game, t);
    this.syncBoss(game);
    this.syncSwarms(game);
    this.syncTowerMarks(game, dt);
    this.placeDepots(game);
    this.syncDepotShutters(game, dt);
    this.syncQueue(game);
    if (game.phase !== "wave" && this.debrisLying) {
      this.debris.clearStaying();
      this.debrisLying = false;
    }
    this.syncSetPieces(game, t);
    this.syncPiles(game);
    this.syncOaks(game);
    if (!this.reducedMotion) for (const sails of this.landmarkSails) sails.rotation.z -= dt * 0.9;
    // Farmhouse smoke, darker as Goodwill falls.
    if (this.ground && Math.random() < dt * 3) {
      const c = this.ground.farmhouse.localToWorld((this.ground.farmhouse.userData.chimney as THREE.Vector3).clone());
      const hurt = game.goodwill / game.maxGoodwill < 0.5;
      this.smoke(c, hurt ? "#4a4440" : "#ece6dc", hurt ? 0.09 : 0.05);
    }
    for (const sp of (this.ground?.group.userData.spin as THREE.Object3D[] | undefined) ?? []) sp.rotation.z += dt * 0.7;
    this.ground?.update(t, dt);
    this.crops?.sync(game, t, dt);
    for (const m of this.motes) m.update(dt, t);
    this.birds?.update(t);
    this.sparks.update(dt);
    this.debris.update(dt);
    this.fx.update(dt);
    // Camera: zoom towards the target, offset by the pan; then shake.
    const look = this.v3.copy(this.camTarget).add(this.v2.set(this.pan.x, 0, this.pan.y));
    // (Plan item 191: under reduced motion these cut rather than ease.)
    const ease = (k: number) => (this.reducedMotion ? 1 : Math.min(1, dt * k));
    this.bossEase += (this.bossPush - this.bossEase) * ease(1.2);
    // Plan item 72: a boss round's queue draws the eye to the gate for a few seconds, then lets it go.
    this.gateHold = Math.max(0, this.gateHold - dt);
    this.gateEase += ((this.gateHold > 0 ? 1 : 0) - this.gateEase) * ease(1.6);
    if (this.gateEase > 0.001) look.lerp(this.v2.set(this.gateAt.x, this.camTarget.y, this.gateAt.y), this.gateEase * 0.38);
    this.direct(game, dt);
    const sw = this.shotWeight();
    if (sw > 0 && this.shot) look.lerp(this.v2.set(this.shot.x, this.camTarget.y, this.shot.z), sw * (this.shot.dolly ? 0.85 : 0.6));
    const shotZoom = this.shot ? 1 + (this.shot.zoom - 1) * sw : 1;
    this.camera.position.copy(this.camBase).sub(this.camTarget).multiplyScalar(1 / (this.zoom * shotZoom * (1 + this.bossEase * 0.07 + this.gateEase * 0.14))).add(look);
    if (this.shake > 0) {
      const m = this.shake * 0.12;
      this.camera.position.x += (Math.random() - 0.5) * m;
      this.camera.position.y += (Math.random() - 0.5) * m;
      this.shake = Math.max(0, this.shake - dt * 1.8);
    }
    this.camera.lookAt(look);
    this.camera.updateMatrixWorld();
    this.faceGateSigns();
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
      const sig = `${tw.kind}:${tw.tier}:${tw.spec ?? ""}:${tw.mega ?? ""}:${tw.path?.join("") ?? ""}:${tw.crown ?? ""}`;
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
          obj = buildTower(tw.kind, tw.tier, tw.spec ?? null, tw.path);
          if (tw.crown !== undefined) {
            const top = crownTopper();
            obj.add(top);
            obj.userData.crownTop = top;
          }
          obj.userData.scale = tw.crown !== undefined ? 1.4 : 1.22;
          obj.position.set(tw.col + 0.5, this.height(tw.col + 0.5, tw.row + 0.5), tw.row + 0.5);
        }
        this.dynamic.add(obj);
        obj.scale.setScalar(obj.userData.scale as number);
        v = { obj, sig, fired: 9, pop: 0, build: this.reducedMotion ? null : this.buildUp(obj, !!v) };
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
    if (v.build && !this.animateBuild(v.build, v.pop)) v.build = null;
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
    // Plan item 19: every tower breathes when idle and squashes as it lets go (as in 2D).
    if (!this.reducedMotion) {
      const s0 = (ud.scale as number) ?? 1;
      const breath = Math.sin(t * 2.2 + tw.id) * 0.012;
      v.obj.scale.set(s0 * (1 + kick * 0.06), s0 * (1 + breath - kick * 0.09), s0 * (1 + kick * 0.06));
    }
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
    // A Crown's circlet turns slowly and bobs; its ring breathes (H13 idle).
    const top = ud.crownTop as THREE.Object3D | undefined;
    if (top && !this.reducedMotion) {
      top.rotation.y = t * 0.9 + tw.id;
      top.position.y = Math.sin(t * 2 + tw.id) * 0.03;
      top.scale.setScalar(1 + Math.sin(t * 3 + tw.id) * 0.04);
    }
    // An Heirloom (merged megastructure) sheds slow gold motes (H13 idle).
    if (tw.mega && !this.reducedMotion) {
      if (Math.random() < dt * 3) {
        const a = Math.random() * Math.PI * 2;
        this.sparks.emit(v.obj.position.x + Math.cos(a) * 0.5, v.obj.position.y + 0.3, v.obj.position.z + Math.sin(a) * 0.5, "#ffd76a", 1, 0.5, 0.09, 1.4, 0.6);
      }
    }
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

  /** Plans a tower's build-up: its parts (merged meshes and moving pieces) rise in order of height. */
  private buildUp(obj: THREE.Group, upgrade: boolean): BuildUp {
    const plinth = upgrade ? null : (obj.children.find((c) => c.name === "plinth") ?? null);
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3();
    const items = obj.children
      .filter((c) => c.name !== "plinth")
      .map((o) => {
        box.setFromObject(o);
        return { o, y: o.position.y, s: o.scale.clone(), h: box.isEmpty() ? 0 : (box.min.y + box.max.y) / 2 };
      });
    const lo = Math.min(...items.map((i) => i.h));
    const hi = Math.max(...items.map((i) => i.h));
    const start = upgrade ? 0 : PLINTH * 0.7;
    const parts = items.map((i) => ({ o: i.o, y: i.y, s: i.s, delay: start + (hi > lo ? (i.h - lo) / (hi - lo) : 0) * RISE_SPREAD }));
    const b: BuildUp = { plinth, parts, end: start + RISE_SPREAD + RISE };
    this.animateBuild(b, 0);
    return b;
  }

  /** Poses a build-up at time p; false once it has finished (everything is back exactly where it was built). */
  private animateBuild(b: BuildUp, p: number): boolean {
    const done = p >= b.end;
    if (b.plinth) {
      const q = done ? 1 : Math.min(1, p / PLINTH);
      const e = 1 - (1 - q) * (1 - q);
      b.plinth.scale.set(0.75 + 0.25 * e, Math.max(0.001, e), 0.75 + 0.25 * e);
    }
    for (const it of b.parts) {
      const q = done ? 1 : Math.max(0, Math.min(1, (p - it.delay) / RISE));
      // Ease out with a little overshoot, so each part lands with a bounce.
      const c = 1.6;
      const e = q <= 0 ? 0 : 1 + (c + 1) * (q - 1) ** 3 + c * (q - 1) ** 2;
      it.o.scale.set(it.s.x * Math.max(0.001, 0.55 + 0.45 * e), it.s.y * Math.max(0.001, e), it.s.z * Math.max(0.001, 0.55 + 0.45 * e));
      it.o.position.y = it.y - (1 - Math.min(1, e)) * 0.12;
    }
    return !done;
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
    const fleet = isFleet(game.level);
    if (fleet && !this.rungs) {
      this.rungs = new RungInstances();
      this.dynamic.add(this.rungs.group);
    }
    this.rungs?.begin(this.camera);
    // Gold floaters for the Marks the knocks paid, merged into one every GOLD_WINDOW.
    this.gold.age += dt;
    if (this.gold.age >= GOLD_WINDOW) {
      const n = Math.floor(this.gold.n);
      if (n >= 1) {
        this.floaters.add(`+${n}`, new THREE.Vector3(this.gold.x, this.height(this.gold.x, this.gold.y) + 0.7, this.gold.y), "#ffe27a", Math.min(1.4, 0.7 + Math.log10(n) * 0.4));
        this.gold.n -= n;
      }
      this.gold.age = 0;
    }
    // Plan item 45: the queue laid out as a convoy (convoy.ts); the overflow stacks up as a column at its tail.
    const lay = (this.lay = layOutField(game.enemies, (k) => 0.55 * enemyScale(k as Enemy["kind"]), SWARM_MIN));
    for (const e of game.enemies) {
      const at = placeOnLane(game.level, e, lay);
      const tierUp = at.tier * 0.26 * enemyScale(e.kind);
      if (fleet && this.rungs?.has(e.kind)) {
        // Instanced: heading from the lane's direction, a little bob, no per-vehicle objects.
        const p = at;
        const ahead = enemyPoint(game.level, { dist: e.dist + 0.08, lane: e.lane });
        const heading = Math.atan2(-(ahead.y - p.y), ahead.x - p.x);
        const moving = !(e.stun > 0 || e.held);
        const bob = moving ? Math.abs(Math.sin(t * 9 + e.id)) * 0.012 + (enemyLift(e.kind) ? Math.sin(t * 3 + e.id) * 0.04 : 0) : 0;
        const ghost = !isRevealed(game, e);
        // Unrevealed stealth is drawn see-through in hedge-camo, never blinked out (its icons stay over it).
        this.rungs.add(e.kind, p.x, this.height(p.x, p.y) + tierUp, p.y, heading, bob, ghost, e.pm, liveryOf(Math.ceil(game.level.id / 10), e.id));
        // Its property icons (section 2): a row of roundels over the vehicle.
        if (e.pm) this.rungs.addIcons(e.pm, p.x, this.height(p.x, p.y) + enemyLift(e.kind) + 0.95 * enemyScale(e.kind), p.y);
        if (e.stun > 0 && Math.random() < dt * 6) this.sparks.emit(p.x, this.height(p.x, p.y) + 0.6, p.y, "#fff6b0", 1, 0.8, 0.1, 0.4, 0);
        if (e.slowed && Math.random() < dt * 2) this.sparks.emit(p.x, this.height(p.x, p.y) + 0.05, p.y, "#7fd06a", 1, 0.5, 0.09, 0.5, 0.5);
        continue;
      }
      seen.add(e.id);
      let v = this.enemies.get(e.id);
      const p = at;
      const gy = this.height(p.x, p.y) + tierUp;
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
      // Crack stages (M5): a Heavy Plant sparks as it passes each stage, and smokes from the last.
      const crack = crackStage(e.kind, e.hp, max);
      if (crack > (v.crack ?? 0)) this.sparks.emit(p.x, top, p.y, "#2a2a2a", 10 + crack * 4, 2.4, 0.16, 0.7, -2);
      v.crack = crack;
      if (crack >= 3 && Math.random() < dt * 7) this.sparks.emit(p.x, top + 0.15, p.y, "#7a7a7a", 1, 0.3, 0.18, 1.1, 1.2);
      else if (crack === 2 && Math.random() < dt * 2) this.sparks.emit(p.x, top, p.y, "#555", 1, 0.3, 0.12, 0.8, 0.6);
      const frac = Math.max(0, Math.min(1, e.hp / max));
      if (fleet && e.pm) this.rungs?.addIcons(e.pm, p.x, top + 0.34, p.y);
      v.bar.visible = frac < 1 && !ghost && !isBig(e.kind);
      if (v.bar.visible) {
        v.bar.position.set(p.x, top + 0.2, p.y);
        v.bar.quaternion.copy(this.camera.quaternion);
        v.fill.scale.x = frac;
        v.fill.position.x = -(1 - frac) / 2;
        v.fill.material = frac > 0.6 ? this.fillMats.good : frac > 0.3 ? this.fillMats.mid : this.fillMats.low;
      }
      // Weight: a hit squashes the body down and out, then it springs back past rest and settles (heavier kinds move less).
      const base = enemyScale(e.kind) * 1.3;
      const sq = this.reducedMotion || v.hit > 0.35 ? 0 : Math.exp(-v.hit * 14) * Math.cos(v.hit * 38) * 0.16 / Math.max(1, enemyScale(e.kind) * 0.9);
      inner.scale.set(base * (1 + sq * 0.6), base * (1 - sq), base * (1 + sq * 0.6));
      // Hit flash: swap in one shared bright material for a moment (shared materials are never mutated).
      const flash = v.hit < FLASH && v.obj.visible;
      if (flash !== v.flashing) this.setFlash(v, flash);
    }
    this.rungs?.end();
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
    // Plan item 102: a warm key on her face when the camera comes in close to her (a lift of the face's own
    // material, not another scene light: no extra cost per pixel and no shader change as it fades).
    const face = this.faceMesh();
    if (face) {
      const mat = face.material as THREE.MeshStandardMaterial;
      mat.userData.base ??= mat.emissive.clone();
      const framed = Math.min(1, Math.max(0, (this.zoom - 1.25) / 0.6));
      mat.emissive.copy(mat.userData.base as THREE.Color).lerp(this.faceKey, 0.1 * framed);
    }
    const c = this.cath;
    if (!c) return;
    dressCath(c);
    c.visible = !hasTwist(game.level, "nocath") && !this.harvesting;
    if (!c.visible) return;
    const h = game.hero;
    const y = this.height(h.x, h.y);
    c.position.set(h.x, y, h.y);
    // Plan item 78: twice her old size (0.98), so she reads as the farm's hero at a glance.
    c.scale.setScalar(CATH_3D_SCALE);
    // Plan item 98: a phone's camera looks down so steeply that she read as the crown of her head (a dark blob).
    // On a steep view she leans back a little, like a paper doll on a board, so her face and coat turn up to it.
    const elev = Math.atan2(this.camera.position.y - y, Math.hypot(this.camera.position.x - h.x, this.camera.position.z - h.y));
    c.rotation.x = -Math.min(0.55, Math.max(0, (elev - CATH_LEAN_FROM) * 1.1));
    const walking = Math.hypot(h.tx - h.x, h.ty - h.y) > 0.03 && h.down === 0;
    const ud = c.userData;
    const fig = ud.fig as THREE.Group;
    const head = ud.head as THREE.Object3D | undefined;
    const legs = ud.legs as THREE.Object3D[];
    // Mirrored, not turned, to face left: her rolling-pin arm is always the one nearer the camera.
    fig.scale.x = h.facing;
    fig.rotation.y = 0;
    this.heroSwung += dt;
    this.heroPie += dt;
    this.heroCheer += dt;
    this.heroWorry += dt;
    this.heroPlant += dt;
    if (game.towers.length > this.towersSeen && this.towersSeen >= 0) this.heroPlant = 0;
    this.towersSeen = game.towers.length;
    if (h.down > 0) {
      fig.rotation.set(0, 0, -1.2 * h.facing);
      fig.position.y = 0.1;
      if (head) {
        // Winded: her head down on the grass, turned up to the sky.
        head.position.set(-0.6 * h.facing, 0.2, 0);
        head.scale.x = h.facing;
        head.rotation.set(0, 0, -1.2 * h.facing);
      }
      if (Math.random() < dt * 6) this.sparks.emit(h.x, y + 0.6, h.y, "#ffe66b", 1, 0.4, 0.1, 0.6, 0);
      this.swayHair(ud, dt, 0, t);
      return;
    }
    const [sh, el, wr, sh2, el2, lean0, twist0] = this.heroPose(game, t, walking);
    // Plan item 78: standing about she shifts her weight, breathes and lets her free arm swing a little.
    const still = !walking && this.heroSwung >= 0.45 && this.heroPie >= 0.5 && !this.reducedMotion;
    const lean = lean0 + (still ? Math.sin(t * 0.9) * 0.035 : 0);
    const twist = twist0 + (still ? Math.sin(t * 0.6 + 1) * 0.12 : 0);
    const arm = ud.arm as THREE.Object3D;
    arm.rotation.set(-0.08, 0, sh);
    (ud.elbow as THREE.Object3D).rotation.z = el;
    (ud.wrist as THREE.Object3D).rotation.z = wr;
    (ud.arm2 as THREE.Object3D).rotation.set(0.08, 0, sh2 + (still ? Math.sin(t * 1.4) * 0.12 : 0));
    (ud.elbow2 as THREE.Object3D).rotation.z = el2;
    // A light step: a bob twice a stride, and a little forward lean while she walks.
    const idle = !walking && this.heroSwung >= 0.45 && this.heroPie >= 0.5 && !this.reducedMotion;
    const bob = walking ? Math.abs(Math.sin(t * 12)) * 0.028 : Math.sin(t * 2) * (idle ? 0.012 : 0.005);
    fig.rotation.set(0, twist * h.facing, lean * h.facing);
    fig.position.y = bob;
    const held = ud.pie as THREE.Object3D | undefined;
    if (held) held.visible = this.heroPie < HERO_PIE_RELEASE;
    if (head) {
      // The portrait rides on her shoulders: it follows the lean and the bob.
      head.position.set(-Math.sin(lean) * 0.72 * h.facing, 0.72 * Math.cos(lean) + bob, 0);
      // Mirrored with her body; it follows her lean and a little of her twist.
      head.scale.x = h.facing;
      head.rotation.set(0, twist * 0.5 * h.facing, lean * h.facing);
    }
    legs.forEach((l, i) => (l.rotation.z = walking ? Math.sin(t * 12 + i * Math.PI) * 0.6 : 0));
    this.swayHair(ud, dt, (walking ? -0.32 + Math.sin(t * 24) * 0.05 : Math.sin(t * 1.3) * 0.03) - lean * 1.6, t);
  }

  /**
   * Cath's pose: [rolling-pin shoulder, elbow, wrist, free shoulder, free elbow, body lean] (radians; positive
   * swings an arm forward and leans her back). A swing winds back while her next blow comes due, sweeps through
   * on the "swing" event and follows through; a pie is thrown overarm with the free hand; she swings her arms
   * as she walks.
   */
  private heroPose(game: Game, t: number, walking: boolean): Pose {
    const h = game.hero;
    const REST: Pose = [0.35, 1.15, 0.55, -0.08, 0.35, 0, 0];
    const WIND: Pose = [-1.9, 0.3, -0.7, 0.6, 0.5, 0.1, -0.15];
    const STRIKE: Pose = [1.25, 0.1, 0.25, -0.6, 0.4, -0.18, 0.2];
    const FOLLOW: Pose = [0.2, 0.2, 0.1, -0.3, 0.3, -0.1, 0.1];
    const mix = <T extends number[]>(a: T, b: T, k: number): T => a.map((v, i) => v + (b[i]! - v) * k) as T;
    const ease = (k: number) => k * k * (3 - 2 * k);
    let pose = REST;
    const s = this.heroSwung;
    if (s < 0.08) pose = mix(WIND, STRIKE, (s / 0.08) ** 2);
    else if (s < 0.2) pose = mix(STRIKE, FOLLOW, ease((s - 0.08) / 0.12));
    else if (s < 0.45) pose = mix(FOLLOW, REST, ease((s - 0.2) / 0.25));
    else if (h.cd > 0 && h.cd < 0.25 && (h.holding.length > 0 || this.enemyNearHero(game, 0.8))) {
      // Her next blow is due: wind up for it.
      pose = mix(REST, WIND, ease(1 - h.cd / 0.25));
    }
    pose = [...pose];
    // Plan item 102: she cheers a cleared round (both arms up, a little bounce of the lean), and raises a worried
    // hand to her face when a vehicle gets through. Each eases in over 0.15 s and out by 1.4 s.
    const react = (age: number) => (age < 0.15 ? ease(age / 0.15) : age < 1.1 ? 1 : age < 1.4 ? 1 - ease((age - 1.1) / 0.3) : 0);
    const cheer = react(this.heroCheer);
    if (cheer > 0) pose = mix(pose, [-3.0, 0.25, 0.1, -2.95, 0.3, 0.06 * Math.sin(this.heroCheer * 14), 0], cheer);
    const worry = cheer > 0 ? 0 : react(this.heroWorry);
    if (worry > 0) pose = mix(pose, [pose[0], pose[1], pose[2], -1.35, 2.1, -0.05, 0.12], worry);
    // ...and stoops to plant a new tower: a lean forward, her free hand down to the soil.
    const plant = cheer > 0 || worry > 0 ? 0 : react(this.heroPlant);
    if (plant > 0) pose = mix(pose, [pose[0], pose[1], pose[2], 1.1, 0.5, 0.42, 0.1], plant);
    this.heroMood = cheer > 0.5 ? "cheer" : worry > 0.5 ? "worried" : plant > 0.5 ? "plant" : "rest";
    // The free hand throws a pie overarm: back, over and through. She twists into it, which brings her
    // throwing arm (on her far side) round where it can be seen.
    const p = this.heroPie;
    if (p < 0.5) {
      type Arm = [number, number, number, number];
      const BACK: Arm = [-1.8, 0.4, 0.1, 0.8];
      const RELEASE: Arm = [1.9, 0.1, -0.12, -0.35];
      const DOWN: Arm = [0.4, 0.4, -0.04, -0.15];
      const rest: Arm = [pose[3], pose[4], 0, 0];
      const r = HERO_PIE_RELEASE;
      const q =
        p < 0.1 ? mix(rest, BACK, ease(p / 0.1)) : p < r ? mix(BACK, RELEASE, ((p - 0.1) / (r - 0.1)) ** 2) : p < 0.3 ? mix(RELEASE, DOWN, ease((p - r) / (0.3 - r))) : mix(DOWN, rest, ease((p - 0.3) / 0.2));
      [pose[3], pose[4], pose[5], pose[6]] = [q[0], q[1], pose[5] + q[2], pose[6] + q[3]];
    }
    if (walking) {
      // Arms swing against her stride (the swing itself overrides the pin arm).
      const w = Math.sin(t * 12);
      if (s >= 0.45) pose[0] -= w * 0.3;
      if (p >= 0.5) pose[3] += w * 0.45;
      pose[5] -= 0.06;
    }
    return pose;
  }

  private enemyNearHero(game: Game, r: number): boolean {
    const h = game.hero;
    for (const e of game.enemies) {
      if (e.hp <= 0) continue;
      const p = enemyPoint(game.level, e);
      if (Math.abs(p.x - h.x) < r && Math.abs(p.y - h.y) < r) return true;
    }
    return false;
  }

  /** Her hair trails behind on a spring, each layer a little slower than the one beneath. */
  private swayHair(ud: Record<string, unknown>, dt: number, target: number, t: number): void {
    const hair = ud.hair as THREE.Object3D[] | undefined;
    const vel = ud.hairVel as number[] | undefined;
    if (!hair || !vel) return;
    // Plan item 84: a frame with a negative (or missing) dt ran the spring backwards, which pumps it, and her
    // hair swung out level with her shoulders like a pair of wings; the step never runs backwards and the swing
    // stays within what hair does.
    const step = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 1 / 30)) : 0;
    hair.forEach((p, i) => {
      const k = 70 - i * 16;
      const a = Number.isFinite(p.rotation.z) ? p.rotation.z : 0;
      const want = Math.max(-0.8, Math.min(0.5, target * (1 + i * 0.15)));
      vel[i] = Math.max(-12, Math.min(12, (Number.isFinite(vel[i]) ? vel[i]! : 0) + ((want - a) * k - (vel[i] ?? 0) * 7) * step));
      p.rotation.z = Math.max(-1.1, Math.min(0.8, a + vel[i]! * step));
      p.rotation.x = Math.sin(t * 1.7 + i) * 0.03;
    });
    for (const [i, l] of ((ud.locks as THREE.Object3D[] | undefined) ?? []).entries()) {
      l.rotation.z = hair[0]!.rotation.z * 0.6;
      l.rotation.x = (i ? 1 : -1) * 0.06;
    }
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
    // Cath's post between rounds, and her halo (plus where she'd go) while she's picked up.
    const post = postMarker(game, this.heroSelected ? this.postPreview : null);
    this.postRing.visible = !!post;
    if (post) {
      const col = post.covered ? "#8dff8a" : "#ffb347";
      this.postRing.position.set(post.x, this.height(post.x, post.y) + 0.06, post.y);
      this.postRing.scale.setScalar(this.heroSelected ? 1 + Math.sin(t * 6) * 0.08 : 1);
      (this.postRing.material as THREE.MeshBasicMaterial).color.set(col);
      ((this.postRing.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(col);
    }
    const h = game.hero;
    this.heroHalo.visible = this.heroSelected && h.down <= 0;
    if (this.heroHalo.visible) {
      this.heroHalo.position.set(h.x, this.height(h.x, h.y) + 0.07, h.y);
      this.heroHalo.scale.setScalar(1 + Math.sin(t * 8) * 0.1);
    }
  }

  // ---- set pieces: floodwater, the swing bridge, pools of light in a blackout ----

  private pieces: { level: number; flood?: THREE.Group; bridge?: THREE.Group; deck?: THREE.Object3D; pools?: THREE.InstancedMesh } | null = null;

  /** Thorn piles on the lane (Blackthorn path): one small heap of cut thorn each, shrinking as it's used. */
  private pileObjs = new Map<number, THREE.Object3D>();
  private syncPiles(game: Game): void {
    const live = new Set<number>();
    for (const p of game.piles) {
      live.add(p.id);
      let o = this.pileObjs.get(p.id);
      if (!o) {
        o = buildThornPile();
        const q = enemyPoint(game.level, { dist: p.dist, lane: p.lane });
        o.position.set(q.x, this.height(q.x, q.y) + 0.02, q.y);
        o.rotation.y = (p.id * 2.399) % (Math.PI * 2);
        this.dynamic.add(o);
        this.pileObjs.set(p.id, o);
      }
      o.scale.setScalar(0.6 + Math.min(1, p.hits / 20) * 0.5);
    }
    for (const [id, o] of this.pileObjs)
      if (!live.has(id)) {
        this.dynamic.remove(o);
        this.pileObjs.delete(id);
      }
  }

  /** Fallen oaks lie on their plots until cleared. */
  private oakObjs = new Map<string, THREE.Object3D>();
  private oakLevel = -1;
  /** A landmark windmill's sails, turned every frame. */
  private landmarkSails: THREE.Object3D[] = [];
  private syncOaks(game: Game): void {
    if (this.oakLevel !== game.level.id) {
      for (const o of this.oakObjs.values()) this.dynamic.remove(o);
      this.oakObjs.clear();
      this.oakLevel = game.level.id;
      for (const f of game.level.fords ?? []) {
        // Plan item 94: the ford is shallow water running over the lane (lit, the 2D water's blue) with a line of
        // stepping stones along each edge; it was unlit pale-blue planes that read as a selection overlay. Two
        // instanced meshes (it was a mesh per step).
        const steps: Array<{ x: number; y: number; a: number }> = [];
        for (let d = f.from; d <= f.to; d += 0.3) {
          const q = enemyPoint(game.level, { dist: d });
          const a = enemyPoint(game.level, { dist: d + 0.1 });
          steps.push({ x: q.x, y: q.y, a: Math.atan2(a.y - q.y, a.x - q.x) });
        }
        const grp = new THREE.Group();
        const water = new THREE.InstancedMesh(
          new THREE.PlaneGeometry(0.42, 0.98).rotateX(-Math.PI / 2),
          new THREE.MeshStandardMaterial({ color: "#3f7fa6", roughness: 0.15, metalness: 0.1 }),
          steps.length,
        );
        const stones = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.06, 0), new THREE.MeshStandardMaterial({ color: "#8d8a80", roughness: 0.9, flatShading: true }), steps.length * 2);
        const m4 = new THREE.Matrix4();
        const q4 = new THREE.Quaternion();
        const up = new THREE.Vector3(0, 1, 0);
        const sc = new THREE.Vector3(1, 1, 1);
        const v = new THREE.Vector3();
        steps.forEach((st, i) => {
          q4.setFromAxisAngle(up, -st.a);
          water.setMatrixAt(i, m4.compose(v.set(st.x, this.height(st.x, st.y) + 0.04, st.y), q4, sc));
          for (const side of [-1, 1]) {
            const ox = -Math.sin(st.a) * 0.47 * side;
            const oz = Math.cos(st.a) * 0.47 * side;
            const s2 = 0.8 + ((i * 7 + side * 3) % 5) * 0.1;
            stones.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), m4.compose(v.set(st.x + ox, this.height(st.x + ox, st.y + oz) + 0.03, st.y + oz), q4, sc.set(s2, 0.6 * s2, s2)));
            sc.set(1, 1, 1);
          }
        });
        water.renderOrder = 2;
        stones.castShadow = true;
        grp.add(water, stones);
        this.dynamic.add(grp);
        this.oakObjs.set(`ford${f.from}`, grp);
      }
      this.landmarkSails = [];
      for (const [n, m] of landmarks(game.level).entries()) {
        if (m.type === "bank") continue;
        const cs = m.cells.map(([c]) => c);
        const rs = m.cells.map(([, r]) => r);
        const c0 = Math.min(...cs);
        const r0 = Math.min(...rs);
        const w = Math.max(...cs) - c0 + 1;
        const d = Math.max(...rs) - r0 + 1;
        const o = buildLandmark(m.type, w, d, game.level.id * 97 + n * 13 + 5);
        const x = c0 + w / 2;
        const z = r0 + d / 2;
        o.position.set(x, this.height(x, z) + 0.01, z);
        this.dynamic.add(o);
        this.oakObjs.set(`landmark${n}`, o);
        const sails = o.userData.sails as THREE.Object3D | undefined;
        if (sails) this.landmarkSails.push(sails);
      }
      const fordAt = landmarks(game.level).some((m) => m.type === "ford") ? fordMiddle(game.level) : null;
      if (fordAt !== null) {
        const p = enemyPoint(game.level, { dist: fordAt });
        const q = enemyPoint(game.level, { dist: fordAt + 0.2 });
        const plank = matte("#9a6a3e");
        const fb = new THREE.Group();
        for (let i = -4; i <= 4; i++) {
          const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.3), plank);
          m.position.set(0, 0.32 + Math.cos((i / 4) * 1.2) * 0.08, i * 0.12);
          m.castShadow = true;
          fb.add(m);
        }
        for (const side of [-1, 1]) {
          const rail = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 1.1), matte("#6b4a2c"));
          rail.position.set(side * 0.14, 0.5, 0);
          fb.add(rail);
          for (const end of [-1, 1]) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.5, 0.03), matte("#6b4a2c"));
            post.position.set(side * 0.14, 0.25, end * 0.52);
            fb.add(post);
          }
        }
        fb.position.set(p.x, this.height(p.x, p.y), p.y);
        // Across the lane: the lane runs p to q, the bridge's length (local z) is at right angles to it.
        fb.rotation.y = Math.atan2(q.x - p.x, q.y - p.y) + Math.PI / 2;
        this.dynamic.add(fb);
        this.oakObjs.set("footbridge", fb);
      }
      for (const [c, r] of game.level.barns ?? []) {
        const b = buildBarn();
        b.position.set(c + 0.5, this.height(c + 0.5, r + 0.5) + 0.02, r + 0.5);
        this.dynamic.add(b);
        this.oakObjs.set(`barn${c},${r}`, b);
      }
    }
    for (const [c, r] of game.level.oaks ?? []) {
      const key = `${c},${r}`;
      const here = oakAt(game, c, r);
      const o = this.oakObjs.get(key);
      if (here && !o) {
        const m = buildOak();
        m.position.set(c + 0.5, this.height(c + 0.5, r + 0.5) + 0.02, r + 0.5);
        m.rotation.y = ((c * 7 + r * 13) % 8) * 0.4;
        this.dynamic.add(m);
        this.oakObjs.set(key, m);
      } else if (!here && o) {
        this.dynamic.remove(o);
        this.oakObjs.delete(key);
      }
    }
  }

  private syncSetPieces(game: Game, t: number): void {
    const lv = game.level;
    if (this.pieces?.level !== lv.id) {
      if (this.pieces) for (const o of [this.pieces.flood, this.pieces.bridge, this.pieces.pools]) if (o) this.scene.remove(o);
      this.pieces = { level: lv.id };
      const flood = setPiece(lv, "flood");
      if (flood) {
        // Plan item 94: floodwater lying on the field, not floating slabs (a box per cell 0.12 up read as a
        // selection overlay): a sheet of deep water flush with the ground, the cells meeting without seams, over a
        // margin of wet, darkened earth where it spills onto the grass. Two instanced meshes, two draw calls.
        const g = new THREE.Group();
        const sheet = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
        const water = new THREE.InstancedMesh(
          sheet,
          new THREE.MeshStandardMaterial({ color: "#3f7fa6", roughness: 0.12, metalness: 0.15, transparent: true, opacity: 0.86, depthWrite: false }),
          flood.cells.length,
        );
        const mud = new THREE.InstancedMesh(
          sheet,
          new THREE.MeshStandardMaterial({ color: "#4a3a26", roughness: 0.9, transparent: true, opacity: 0.55, depthWrite: false }),
          flood.cells.length,
        );
        water.renderOrder = 2;
        mud.renderOrder = 1;
        const mat = new THREE.Matrix4();
        flood.cells.forEach(([c, r], i) => {
          const x = c + 0.5;
          const z = r + 0.5;
          // Level with the highest ground under the cell, so no grass pokes through the sheet.
          const y = Math.max(this.height(x, z), this.height(c + 0.1, r + 0.1), this.height(c + 0.9, r + 0.9), this.height(c + 0.1, r + 0.9), this.height(c + 0.9, r + 0.1));
          water.setMatrixAt(i, mat.makeScale(1.01, 1, 1.01).setPosition(x, y + 0.03, z));
          mud.setMatrixAt(i, mat.makeScale(1.16, 1, 1.16).setPosition(x, y + 0.015, z));
        });
        water.receiveShadow = true;
        g.add(mud, water);
        g.visible = false;
        this.scene.add(g);
        this.pieces.flood = g;
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

  /** A badge over each swarm: its total and its make-up by type, pinned above the middle of the queue. */
  private syncSwarms(game: Game): void {
    const list = game.phase === "wave" ? swarms(game.enemies) : [];
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    list.forEach((sw, i) => {
      let slot = this.swarmEls[i];
      if (!slot) {
        const el = document.createElement("div");
        el.className = "swarm-badge";
        el.setAttribute("aria-hidden", "true");
        this.overlayEl.append(el);
        slot = { el, key: "" };
        this.swarmEls.push(slot);
      }
      const key = `${sw.count}|${sw.kinds.map((k) => `${k.kind}:${k.n}`).join(",")}`;
      if (key !== slot.key) {
        slot.key = key;
        const total = document.createElement("b");
        total.textContent = String(sw.count);
        slot.el.replaceChildren(total);
        for (const k of sw.kinds.slice(0, 3)) {
          const part = document.createElement("span");
          const im = document.createElement("img");
          im.src = enemyIcon(k.kind);
          im.alt = "";
          // One type: the total says it all.
          part.append(im, sw.kinds.length > 1 ? String(k.n) : "");
          slot.el.append(part);
        }
        // Plan item 45: the whole make-up as one stacked bar along the badge's foot.
        const bar = document.createElement("i");
        bar.className = "swarm-mix";
        for (const k of sw.kinds) {
          const seg = document.createElement("i");
          seg.style.flexGrow = String(k.n);
          seg.style.background = RUNGS[k.kind]?.colour ?? "#8a7a66";
          bar.append(seg);
        }
        slot.el.append(bar);
      }
      // Where the queue has a column (convoy.ts), the badge rides its head.
      const col: ConvoyColumn | undefined = this.lay.columns.find((c) => (c.lane ?? undefined) === (sw.lane ?? undefined));
      const p = enemyPoint(game.level, col ? { dist: col.dist, ...(col.lane ? { lane: col.lane } : {}) } : sw);
      const up = col ? 1.1 + Math.min(col.count, COLUMN_TIERS) * 0.26 : 1.1;
      const v = new THREE.Vector3(p.x, this.height(p.x, p.y) + up, p.y).project(this.camera);
      slot.el.hidden = false;
      slot.el.style.transform = `translate(${((v.x * 0.5 + 0.5) * w).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * h).toFixed(1)}px) translate(-50%, -100%)`;
    });
    for (let i = list.length; i < this.swarmEls.length; i++) this.swarmEls[i]!.el.hidden = true;
  }

  /** Plan item 45: each tower's pooled Marks, one "+N" over it that counts up while it knocks and fades once it stops. */
  private syncTowerMarks(game: Game, dt: number): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    for (const [id, m] of this.towerMarks) {
      m.quiet += dt;
      const tw = game.towers.find((x) => x.id === id);
      if (!tw || m.quiet > 0.9) {
        m.el?.remove();
        this.towerMarks.delete(id);
        continue;
      }
      if (!m.el) {
        m.el = document.createElement("div");
        m.el.className = "tower-marks";
        m.el.setAttribute("aria-hidden", "true");
        this.overlayEl.append(m.el);
      }
      m.el.textContent = `+${Math.floor(m.n)}`;
      const x = tw.col + 0.5;
      const z = tw.row + 0.5;
      const v = new THREE.Vector3(x, this.height(x, z) + 1.25 + (this.reducedMotion ? 0 : m.quiet * 0.4), z).project(this.camera);
      m.el.style.opacity = String(1 - Math.max(0, (m.quiet - 0.5) / 0.4));
      m.el.style.transform = `translate(${((v.x * 0.5 + 0.5) * w).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * h).toFixed(1)}px) translate(-50%, -100%)`;
    }
  }

  /** Plan item 72: the queue drawn last frame (CSS px from the canvas corner), for the e2e tests; null when nothing waits at the gate. */
  shownQueue: { leads: Rect[]; plates: Rect[] } | null = null;
  private queueKey = "";
  private queueGroup: THREE.Group | null = null;
  private queuePlates: HTMLElement[] = [];
  /** Plan item 103: the town named on the gate plate when its 3D board steps down on a phone. */
  private plateTown = "";
  private queueAnchors: Array<{ x: number; z: number; up: number; gx: number; gz: number }> = [];
  private queueModels: Array<{ obj: THREE.Object3D; x: number; z: number; up: number; r: number }> = [];
  private gateHold = 0;
  private gateEase = 0;
  /** Plan item 160 (tests): the gate's look has let go and the boss push has eased out. */
  camSettled(): boolean {
    return this.gateHold === 0 && this.gateEase < 0.001 && Math.abs(this.bossPush - this.bossEase) < 0.001;
  }
  private gateAt = { x: 0, y: 0 };

  /** Between rounds the next round queues at the Hollowell gate: its leads as models on the lane, a count plate. */
  private syncQueue(game: Game): void {
    const groups = game.level.waves[game.wave];
    const live = game.phase !== "won" && game.phase !== "lost" && betweenRounds(game) && !!groups;
    const key = live ? `${game.level.id}:${game.wave}` : "";
    if (key !== this.queueKey) {
      this.queueKey = key;
      this.clearQueue();
      const q = live ? gateQueue(waveSpawns(game, groups, game.wave + 1), isBig) : null;
      if (q) this.buildQueue(game, q);
    }
    if (!this.queueGroup) {
      this.shownQueue = null;
      return;
    }
    // Wall time, not the frame's dt: the field's clock can run slow or stand still between rounds.
    const k = Math.max(0, Math.min(1, (performance.now() - (this.queueGroup.userData.born as number)) / 400));
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const shown: { leads: Rect[]; plates: Rect[] } = { leads: [], plates: [] };
    for (const m of this.queueModels) {
      m.obj.scale.setScalar(Math.max(0.001, k));
      const a = this.v1.set(m.x, this.height(m.x, m.z) + m.up, m.z).project(this.camera);
      const b = this.v2.set(m.x, this.height(m.x, m.z), m.z).project(this.camera);
      const cx = (a.x * 0.5 + 0.5) * w;
      const top = (-a.y * 0.5 + 0.5) * h;
      const foot = (-b.y * 0.5 + 0.5) * h;
      const half = Math.max(8, (foot - top) * 0.6);
      shown.leads.push({ x: cx - half, y: top, w: half * 2, h: Math.max(8, foot - top) });
    }
    this.queuePlates.forEach((el, i) => {
      if (this.plateTown && !el.dataset.town) {
        el.dataset.town = this.plateTown;
        const town = document.createElement("span");
        town.className = "gate-plate-town";
        town.textContent = this.plateTown;
        el.prepend(town);
      }
      const at = this.queueAnchors[i]!;
      // Plan item 179: the count hangs on its depot's fascia while the depot is in the frame; the plate keeps
      // to the gate (items 72-139) only when it isn't.
      const onDepot = this.depotDock(Number(el.dataset.lane ?? 0), w, h);
      el.toggleAttribute("data-on-depot", !!onDepot);
      if (onDepot) {
        const pw = el.offsetWidth;
        const ph = el.offsetHeight;
        const x = Math.max(4, Math.min(w - pw - 4, onDepot.x - pw / 2));
        const y = Math.max(4, Math.min(h - ph - 4, onDepot.under ?? onDepot.y - ph * 0.5));
        el.style.opacity = String(k);
        el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        shown.plates.push({ x, y, w: pw, h: ph });
        return;
      }
      const v = this.v1.set(at.x, this.height(at.x, at.z) + at.up, at.z).project(this.camera);
      const pw = el.offsetWidth;
      const ph = el.offsetHeight;
      let x = Math.max(4, Math.min(w - pw - 4, (v.x * 0.5 + 0.5) * w - pw / 2));
      let y = Math.max(4, Math.min(h - ph - 4, (-v.y * 0.5 + 0.5) * h));
      // Plan item 115: a wide plate (a phone's, with the town's name) clamped at the field's edge could land on the
      // queue itself; it steps clear of the vehicles, to their right or else below them.
      const hits = (px: number, py: number) => shown.leads.some((l) => px < l.x + l.w && px + pw > l.x && py < l.y + l.h && py + ph > l.y);
      if (shown.leads.length && hits(x, y)) {
        const right = Math.max(...shown.leads.map((l) => l.x + l.w)) + 6;
        const below = Math.max(...shown.leads.map((l) => l.y + l.h)) + 4;
        if (right + pw <= w - 4 && !hits(right, y)) x = right;
        else y = Math.min(h - ph - 4, below);
      }
      // Plan item 132: the plate sat on plots and the pond (and could meet the gate's own sign). It steps to the
      // nearest spot, within about two cells, that covers no plot, sign, vehicle or earlier plate.
      // Plan item 139: first it tries to dock on its own gate's sign (the board nearest the gate, under it, then
      // beside it, then over it), so the count reads as the gate's, not as a label floating over the field.
      const signs = this.gateSignRects();
      const g = this.v2.set(at.gx, this.height(at.gx, at.gz), at.gz).project(this.camera);
      const gx = (g.x * 0.5 + 0.5) * w;
      const gy = (-g.y * 0.5 + 0.5) * h;
      const sign = signs.slice().sort((a, b) => Math.hypot(a.x + a.w / 2 - gx, a.y + a.h / 2 - gy) - Math.hypot(b.x + b.w / 2 - gx, b.y + b.h / 2 - gy))[0];
      // An edge-on board (a phone's upright frame shows it as a 2 px bar) is no anchor: keep item 132's search.
      const dock = sign && sign.h >= 10 && Math.hypot(sign.x + sign.w / 2 - gx, sign.y + sign.h / 2 - gy) < Math.max(w, h) * 0.25
        ? [
            { x: sign.x + sign.w / 2 - pw / 2, y: sign.y + sign.h + 4 },
            { x: sign.x + sign.w + 6, y: sign.y + sign.h / 2 - ph / 2 },
            { x: sign.x - pw - 6, y: sign.y + sign.h / 2 - ph / 2 },
            { x: sign.x + sign.w / 2 - pw / 2, y: sign.y - ph - 4 },
          ]
        : [];
      for (const d of dock) d.x = Math.max(4, Math.min(w - pw - 4, d.x));
      ({ x, y } = this.clearPlateSpot({ x, y, w: pw, h: ph }, game, [...shown.leads, ...shown.plates, ...signs], w, h, dock));
      el.style.opacity = String(k);
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      shown.plates.push({ x, y, w: pw, h: ph });
    });
    this.shownQueue = shown;
  }

  /** The field's non-lane cells (plots, pond, scenery) as boxes on the canvas (CSS px from its corner), cached per camera pose and size. */
  private plotRectsKey = "";
  private plotRectsCache: Rect[] = [];
  private plotRects(game: Game, w: number, h: number): Rect[] {
    const e = this.camera.matrixWorld.elements;
    const key = `${game.level.id}:${w}x${h}:${e.map((v) => v.toFixed(3)).join(",")}`;
    if (key === this.plotRectsKey) return this.plotRectsCache;
    const out: Rect[] = [];
    const lv = game.level;
    const lane = new Set(laneCellsOf(lv));
    // A ford is lane under water: the plate keeps off it like the pond around it.
    for (const f of lv.fords ?? [])
      for (let d = f.from; d <= f.to; d += 0.25) {
        const q = enemyPoint(lv, { dist: d });
        lane.delete(`${Math.floor(q.x)},${Math.floor(q.y)}`);
      }
    // A plot's tile stands inset in its cell; 0.08 of a cell each side is the border of grass between tiles.
    const inset = 0.08;
    for (let r = 0; r < lv.rows; r++)
      for (let c = 0; c < lv.cols; c++) {
        // Plots, the pond, fords and the scenery: everything on the field but the dry lane.
        if (lane.has(`${c},${r}`)) continue;
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const [dx, dz] of [[inset, inset], [1 - inset, inset], [inset, 1 - inset], [1 - inset, 1 - inset]] as const) {
          const v = this.v2.set(c + dx, this.height(c + 0.5, r + 0.5), r + dz).project(this.camera);
          const px = (v.x * 0.5 + 0.5) * w;
          const py = (-v.y * 0.5 + 0.5) * h;
          x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py);
        }
        out.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
      }
    this.plotRectsKey = key;
    this.plotRectsCache = out;
    return out;
  }

  /** Plan item 179: the frame the depots were placed for (level, canvas size). */
  private depotKey = "";
  private boxRect(b: THREE.Box3, w: number, h: number): Rect {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < 8; i++) {
      const v = this.v2.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).project(this.camera);
      const px = (v.x * 0.5 + 0.5) * w;
      const py = (-v.y * 0.5 + 0.5) * h;
      x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py);
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  /**
   * Plan item 179: each depot takes the spot (of the verge spots terrain.ts lists, nearest its gate first) that shows
   * it whole in the fitted frame, covering no cell of the field, no gate's sign and not Cath where she stands, the
   * nearest such spot to its gate. Placed once per level and canvas size, at the fitted camera.
   */
  private placeDepots(game: Game): void {
    const depots = (this.ground?.group.userData.depots as THREE.Object3D[] | undefined) ?? [];
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const key = `${game.level.id}:${w}x${h}`;
    if (!depots.length || !w || !h || key === this.depotKey || !this.camSettled()) return;
    this.depotKey = key;
    this.camera.updateMatrixWorld();
    const lv = game.level;
    const cells: Rect[] = [];
    for (let r = 0; r < lv.rows; r++)
      for (let c = 0; c < lv.cols; c++) {
        const b = new THREE.Box3(new THREE.Vector3(c + 0.06, this.height(c + 0.5, r + 0.5), r + 0.06), new THREE.Vector3(c + 0.94, this.height(c + 0.5, r + 0.5) + 0.05, r + 0.94));
        cells.push(this.boxRect(b, w, h));
      }
    const hx = game.hero.x, hz = game.hero.y, hy = this.height(hx, hz);
    const cath = hasTwist(lv, "nocath") ? null : this.boxRect(new THREE.Box3(new THREE.Vector3(hx - 0.45, hy, hz - 0.45), new THREE.Vector3(hx + 0.45, hy + 1.8, hz + 0.45)), w, h);
    const signs = this.gateSignRects();
    const meet = (a: Rect, b: Rect) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    const taken: Rect[] = [];
    for (const d of depots) {
      const spots = (d.userData.spots as Array<{ x: number; y: number; z: number; d: number }> | undefined) ?? [];
      let best: { sp: (typeof spots)[number]; score: number; r: Rect } | null = null;
      for (const sp of spots) {
        d.position.set(sp.x, sp.y, sp.z);
        d.updateMatrixWorld(true);
        const r = this.boxRect(new THREE.Box3().setFromObject(d), w, h);
        const area = Math.max(1, r.w * r.h);
        const inside = meet(r, { x: 0, y: 0, w, h }) / area;
        const field = cells.reduce((a, c) => a + meet(r, c), 0) / area;
        const blocked = [...signs, ...taken, ...(cath ? [cath] : [])].reduce((a, c) => a + meet(r, c), 0) / area;
        // Off the frame weighs most, then over Cath, a sign or the other depot, then over the field; the gate's
        // distance (in cells) settles the rest.
        const score = (1 - inside) * 40 + blocked * 30 + field * 12 + sp.d * 0.6;
        if (!best || score < best.score) best = { sp, score, r };
      }
      if (!best) continue;
      d.position.set(best.sp.x, best.sp.y, best.sp.z);
      d.updateMatrixWorld(true);
      taken.push(best.r);
    }
  }
  /** Plan item 179: the shutter rolls up as a round's convoy leaves (the first 2.5 s of a round), and down again. */
  private depotOpen = 0;
  private syncDepotShutters(game: Game, dt: number): void {
    const want = game.phase === "wave" && game.waveClock < 2.5 ? 1 : 0;
    this.depotOpen = this.reducedMotion ? want : want > this.depotOpen ? Math.min(1, this.depotOpen + dt / 0.6) : Math.max(0, this.depotOpen - dt / 0.9);
    for (const d of (this.ground?.group.userData.depots as THREE.Object3D[] | undefined) ?? []) {
      const sh = d.userData.shutter as THREE.Object3D | undefined;
      if (!sh) continue;
      // Rolled up into the fascia: the slats shorten from the foot.
      const k = this.depotOpen * this.depotOpen * (3 - 2 * this.depotOpen);
      sh.scale.y = Math.max(0.04, 1 - k * 0.96);
      sh.position.y = 0.08 + 0.6 * (1 - sh.scale.y);
    }
  }
  /** Plan item 179 (tests): how far the depots' shutters are up (0 shut, 1 open). */
  depotShutter(): number {
    return this.depotOpen;
  }
  /** Plan item 179: where a lane's depot docks its count (CSS px on the canvas), or null when it isn't in the frame. */
  private depotDock(lane: number, w: number, h: number): { x: number; y: number; under?: number } | null {
    const d = ((this.ground?.group.userData.depots as THREE.Object3D[] | undefined) ?? [])[lane];
    const f = d?.userData.fascia as THREE.Vector3 | undefined;
    if (!d || !f) return null;
    d.updateMatrixWorld(true);
    const v = this.v2.copy(f).applyMatrix4(d.matrixWorld).project(this.camera);
    const x = (v.x * 0.5 + 0.5) * w;
    const y = (-v.y * 0.5 + 0.5) * h;
    if (!(x > 0 && x < w && y > 0 && y < h)) return null;
    // Plan item 194: a depot cut by the frame's top (a phone's upright view of l21) shows only its face under the
    // HUD, and a plate on its fascia hid the rest: the plate hangs under its door instead, on the lane's mouth.
    const r = this.depotRects()[lane];
    if (r && r.y < 0) return { x: r.x + r.w / 2, y, under: r.y + r.h + 4 };
    return { x, y };
  }

  /** Plan item 157: the depots by the gates as boxes on the canvas (CSS px), and their world footprint (x, z). */
  /** Plan item 198: the act's biome in 3D ('saltmarsh', or 'farm' where none is built yet). */
  get biome(): string {
    return (this.ground?.group.userData.biome as string | undefined) ?? "farm";
  }

  /** Plan item 185: the field's standing dressing (plots dressed, lane edges hedged), for the e2e. */
  dressing(): { plots: number; dressed: number; laneEdges: number; hedgedEdges: number; meshes: number } | null {
    return (this.ground?.group.userData.dressing as ReturnType<Renderer3D["dressing"]>) ?? null;
  }

  depotRects(): Array<Rect & { wx0: number; wx1: number; wz0: number; wz1: number; roofX: number; roofY: number }> {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const out: Array<Rect & { wx0: number; wx1: number; wz0: number; wz1: number; roofX: number; roofY: number }> = [];
    for (const d of (this.ground?.group.userData.depots as THREE.Object3D[] | undefined) ?? []) {
      const b = new THREE.Box3().setFromObject(d);
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i < 8; i++) {
        const v = this.v2.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).project(this.camera);
        const px = (v.x * 0.5 + 0.5) * w;
        const py = (-v.y * 0.5 + 0.5) * h;
        x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py);
      }
      // Plan item 200: the roof's centre on screen. The box's far top corners project well above the roof itself
      // (40 px at D on l21), so a figure stood on the box's top floated over the depot.
      const roof = this.v2.set((b.min.x + b.max.x) / 2, b.max.y, (b.min.z + b.max.z) / 2).project(this.camera);
      out.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, wx0: b.min.x, wx1: b.max.x, wz0: b.min.z, wz1: b.max.z, roofX: (roof.x * 0.5 + 0.5) * w, roofY: (-roof.y * 0.5 + 0.5) * h });
    }
    return out;
  }

  /** Visible gate signs' boards as boxes on the canvas (CSS px from its corner); Cath's bubble keeps off them too. */
  gateSignRects(): Rect[] {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const out: Rect[] = [];
    for (const sign of (this.ground?.group.userData.gateSigns as THREE.Object3D[] | undefined) ?? []) {
      if (!sign.visible) continue;
      const b = new THREE.Box3().setFromObject(sign);
      if (b.isEmpty()) continue;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i < 8; i++) {
        const v = this.v2.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).project(this.camera);
        const px = (v.x * 0.5 + 0.5) * w;
        const py = (-v.y * 0.5 + 0.5) * h;
        x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py);
      }
      out.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
    }
    return out;
  }

  /** Plan item 132: the spot nearest `at` (up to about two cells away) where the plate covers the least plot. */
  private clearPlateSpot(at: Rect, game: Game, keepOff: Rect[], w: number, h: number, prefer: Array<{ x: number; y: number }> = []): { x: number; y: number } {
    const plots = this.plotRects(game, w, h);
    const area = (x: number, y: number) => {
      let a = 0;
      for (const p of plots) {
        const ox = Math.min(x + at.w, p.x + p.w) - Math.max(x, p.x);
        const oy = Math.min(y + at.h, p.y + p.h) - Math.max(y, p.y);
        if (ox > 0 && oy > 0) a += ox * oy;
      }
      return a;
    };
    const meets = (x: number, y: number) => keepOff.some((o) => x < o.x + o.w && x + at.w > o.x && y < o.y + o.h && y + at.h > o.y);
    // Plan item 139: a preferred spot (docked on the gate's sign) wins outright when it is clear of everything.
    for (const p of prefer)
      if (p.x >= 4 && p.y >= 4 && p.x + at.w <= w - 4 && p.y + at.h <= h - 4 && !meets(p.x, p.y) && area(p.x, p.y) === 0) return p;
    const cell = Math.max(16, plots.length ? Math.max(...plots.slice(0, 4).map((p) => p.w)) : 40);
    const reach = cell * 2;
    let best = { x: at.x, y: at.y, cost: meets(at.x, at.y) ? Infinity : area(at.x, at.y) };
    if (best.cost === 0) return best;
    const step = 4;
    for (let dy = -reach; dy <= reach; dy += step)
      for (let dx = -reach * 1.5; dx <= reach * 1.5; dx += step) {
        const x = at.x + dx;
        const y = at.y + dy;
        if (x < 4 || y < 4 || x + at.w > w - 4 || y + at.h > h - 4 || meets(x, y)) continue;
        // Covered plot area first, then distance from where the plate belongs.
        const cost = area(x, y) + Math.hypot(dx, dy) * 0.5;
        if (cost < best.cost) best = { x, y, cost };
      }
    return best;
  }

  private buildQueue(game: Game, q: GateQueue): void {
    const level = game.level;
    const group = new THREE.Group();
    group.userData.born = performance.now() - (this.reducedMotion ? 400 : 0);
    const lanes: Array<{ leads: GateQueue["leads"]; count: number; lane?: 1 }> = [{ leads: q.leads, count: q.count }];
    if (level.path2) lanes.push({ leads: q.leads2, count: q.count2, lane: 1 });
    for (const ln of lanes) {
      if (!ln.count) continue;
      const path = ln.lane ? level.path2! : level.path;
      // The first to pull out furthest down the lane, the rest bumper to bumper behind it towards the gate.
      const dists: number[] = [];
      let d = 0.15;
      for (let i = ln.leads.length - 1; i >= 0; i--) {
        dists[i] = d;
        if (i > 0) d += 0.42 * (enemyScale(ln.leads[i]!) + enemyScale(ln.leads[i - 1]!)) + 0.06;
      }
      ln.leads.forEach((kind, i) => {
        const p = enemyPoint(level, { dist: dists[i]!, ...(ln.lane ? { lane: ln.lane } : {}) });
        const hd = headingAt(path, dists[i]!);
        const obj = buildRung(kind) ?? buildEnemy(kind);
        const lift = enemyLift(kind);
        obj.position.set(p.x, this.height(p.x, p.y) + lift, p.y);
        obj.rotation.y = Math.atan2(-hd.dy, hd.dx);
        group.add(obj);
        this.queueModels.push({ obj, x: p.x, z: p.y, up: lift + 0.75 * enemyScale(kind), r: enemyScale(kind) });
      });
      const tail = enemyPoint(level, { dist: 0, ...(ln.lane ? { lane: ln.lane } : {}) });
      const hd = headingAt(path, 0);
      // Beside the lane at the queue's tail, never on it; plan item 84: and 1.4 cells into the field, so it
      // clears the gate's sign (which stands 1.1 cells outside the field) rather than sitting on its end.
      const ax = tail.x + hd.dx * 1.4;
      const az = tail.y + hd.dy * 1.4;
      this.queueAnchors.push(hd.dx === 0 ? { x: ax + 0.85, z: az, up: 0.1, gx: tail.x, gz: tail.y } : { x: ax, z: az + 0.55, up: 0, gx: tail.x, gz: tail.y });
      const el = document.createElement("div");
      el.className = "gate-plate";
      el.dataset.lane = String(ln.lane ?? 0);
      el.setAttribute("aria-hidden", "true");
      el.textContent = `${ln.count} coming`;
      this.overlayEl.append(el);
      this.queuePlates.push(el);
      if (!ln.lane) this.gateAt = { x: tail.x, y: tail.y };
    }
    this.queueGroup = group;
    this.dynamic.add(group);
    // A boss or other heavy plant in the round: the camera eases to the gate, then back.
    if (q.boss && !this.reducedMotion) this.gateHold = 2.6;
  }

  private clearQueue(): void {
    if (this.queueGroup) {
      this.dynamic.remove(this.queueGroup);
      this.queueGroup.traverse(disposeOwn);
    }
    this.queueGroup = null;
    this.queueModels = [];
    this.queueAnchors = [];
    for (const el of this.queuePlates) el.remove();
    this.queuePlates = [];
    this.shownQueue = null;
  }

  private syncBoss(game: Game): void {
    const boss = game.enemies.filter((e) => isBig(e.kind)).sort((a, b) => b.dist - a.dist)[0];
    this.bossBar.hidden = !boss;
    this.bossPush = boss && !this.reducedMotion ? 1 : 0;
    if (boss) {
      this.bossName.textContent = ENEMIES[boss.kind].name;
      this.bossFill.style.setProperty("--f", String(Math.max(0, boss.hp / maxHpOf(boss))));
    }
  }
}
