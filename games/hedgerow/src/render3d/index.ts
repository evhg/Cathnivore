// Hedgerow's 3D renderer (three.js): the owner asked for "StarCraft 2 type visuals" (2026-10-02). A lit,
// shadowed, tone-mapped battlefield with bloom; procedural models (models.ts) for every tower tier and
// specialisation, every enemy, Cath and the farmhouse; effects (fx.ts) for every engine event. It only
// reads the Game. Same interface as the 2D Renderer (render.ts), which stays as the fallback when WebGL
// isn't available.

import { fitCamera3d } from "./camerafit";
import { brambleGeometry } from "./bramble";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { BACKDROP_SKY_Y, BACKDROP_Z, buildBackdrop } from "./backdrop";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
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
  pointAt,
  maxHpOf,
  postMarker,
  towerAt,
  towerStats,
  type Enemy,
  type EnemyKind,
  type Game,
  type GameEvent,
  type Tower,
  type TowerKind,
} from "../engine";
import { actLight, actMood, dayKey, matte, nightLight, setDuskLamps, shoreFade, shoreFoam } from "./palette";
import { dayAzFor, dayLamps, dayPhase, dayShadowLength, dayWarmth } from "../sunlight";
import { fordMiddle } from "../landmarks";
import { CATH_HEAD_Y, buildCath, cathFaceTexture, dressCath, liftCath, buildEnemy, buildRung, buildBarn, buildLandmark, buildMega, buildOak, buildThornPile, buildTower, crownTopper, enemyLift, enemyScale } from "./models";

/** Path tier 3 looks that throw like an old specialisation's shot. */
const LOOK_SPEC: Record<string, 0 | 1> = { crow: 1, hawk: 1, pumpkin: 0, scatter: 1, queen: 0, honey: 1 };
import { buildGround, regionShapes, waterNormalTexture, type Ground, setCloudShadows } from "./terrain";
import { Crops } from "./crops";
import { Birds, Debris, Floaters, Motes, Puffs, Sparks, Transients, disposeOwn, sharedGeometry } from "./fx";
import { PUFF, fireTint } from "../firetint";
import { RungInstances, liveryOf } from "./rungs";
import { RUNGS, crackStage } from "../fleet";
import { swarms } from "../swarm";
import { ABREAST, columnNear, layOutField, SLOT_LEN, noConvoy, placeOnLane, type Convoy, type ConvoyColumn } from "../convoy";
import { enemyIcon } from "../icons";
import { gateQueue, type GateQueue } from "../gatequeue";
import { FarmFolk, type Folk } from "../farmfolk";
import { FolkMeshes, inkFigure } from "./folk";
import { clearUnder, shadowUpright } from "./upright";
import { Doorstep3D } from "./doorstep";
import type { DoorstepView } from "../doorstepart";
import { driverFace } from "../fleetfaces";
/** Plan item 703: the share of the sun a shadow takes at noon (1 a black-hard shadow); 0.68 at morning and dusk. */
const SHADOW_NOON = 0.8;

interface TowerView {
  obj: THREE.Group;
  sig: string;
  fired: number;
  /** Seconds since it was built or upgraded. */
  pop: number;
  /** Plan item 676: the model's top in world y, measured on its first shot (the muzzle puff rises from there). */
  top?: number;
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
/** Plan item 280: how much larger the gate queue's models stand than the lane's traffic. */
const QUEUE_SCALE_3D = 1.45;
/** Plan item 743: the depot and queue plates stand this many CSS px inside the frame (at 4 px the phone l27's
 *  "86 TO GO" read as cut by the left edge beside its half-shown depot); the 2D field keeps its numbers 12 px in too. */
const PLATE_EDGE = 12;
/** Plan item 410: the queue's contact shadow, a radial fade on a unit disc (shared by every queued model). */
const QUEUE_SHADOW_GEO = new THREE.CircleGeometry(1, 20);
QUEUE_SHADOW_GEO.userData.shared = true;
let shadowMat: THREE.MeshBasicMaterial | null = null;
function queueShadowMat(): THREE.MeshBasicMaterial {
  if (shadowMat) return shadowMat;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  if (ctx) {
    const gr = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
    gr.addColorStop(0, "rgba(20,16,14,0.55)");
    gr.addColorStop(0.6, "rgba(20,16,14,0.3)");
    gr.addColorStop(1, "rgba(20,16,14,0)");
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, 64, 64);
  }
  shadowMat = Object.assign(new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }), { shared: true });
  return shadowMat;
}
/** Plan item 657: a vehicle's 3D slot along the lane, as a share of its model's length (a sliver of road between). */
const GAP_3D = 1.08;
/**
 * How many of a column's vehicles 3D draws; the rest are its '+N'. Plan item 684: its head alone, in the file (item
 * 657's jam of three staggered two of them off the road, over the plots).
 */
const JAM_3D = 1;
/** Furthest a file of two abreast stands off the lane's middle, in cells. */
const ROAD_HALF = 0.3;
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

/** Plan item 561: the field's grade (display-referred): warm, a mild S-curve and a soft vignette. */
const FIELD_GRADE = {
  // Plan item 604: `shape` scales the vignette's reach per axis by the frame's sides over its long side, so an upright
  // phone's narrow frame isn't darkened down both sides (in plain UV space its sides took the corners' falloff, a
  // dark band over the lane and Cath; a 1440x900 frame keeps its old (1, 0.8)).
  uniforms: { tDiffuse: { value: null as THREE.Texture | null }, shape: { value: new THREE.Vector2(1, 0.8) } },
  vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: [
    "uniform sampler2D tDiffuse; uniform vec2 shape; varying vec2 vUv;",
    "void main() {",
    "  vec4 t = texture2D(tDiffuse, vUv);",
    "  vec3 c = clamp(t.rgb, 0.0, 1.0);",
    "  c = mix(c, c * c * (3.0 - 2.0 * c), 0.3);",
    "  c *= vec3(1.03, 1.0, 0.94);",
    "  vec2 d = (vUv - 0.5) * shape;",
    "  c *= 1.0 - 0.22 * smoothstep(0.3, 0.72, length(d));",
    "  gl_FragColor = vec4(clamp(c, 0.0, 1.0), t.a);",
    "}",
  ].join("\n"),
};

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
/** Plan item 730: an instanced vehicle's hit flash, a little longer (it fades rather than swaps). */
const RUNG_FLASH = 0.14;

const SHOT_COLOURS: Record<string, string> = {
  scarecrow: "#ffe08a",
  beehive: "#ffd23f",
  pond: "#8fd8ff",
  barn: "#f2c94c",
  silo: "#ffcf5a",
};

/** Plan item 310: her between-rounds gesture comes every HERO_IDLE_CYCLE seconds and lasts HERO_IDLE_GESTURE. */
const HERO_IDLE_CYCLE = 7;
const HERO_IDLE_GESTURE = 2.2;
/** Plan item 310: her free shoulder's swing for a point (forward, a little over level) and a wave (forward and high),
 * and how far it swings out toward the lens, so the far arm shows in front of her body at the field camera (tried
 * at l21 D: raised back and up, or forward and high, it stayed behind her hair). The wave lifts the forearm. */
const HERO_POINT_ARM = 1.7;
const HERO_WAVE_ARM = 1.6;
const HERO_REACH_X = 1.3;
/** Plan item 78: Cath's 3D figure at twice her old size (0.98). */
// Plan item 346: one scale for the farm: she stands about 1.2x a farmer (1.15 model units at 1.15 against a farmer's
// 0.86 at FOLK_3D_SCALE); at 1.9 she was a giant doll at the field's edge, 2.5x them.
// Plan item 557: 1.15x again (1.15 -> 1.32, about 1.4x a farmer): at 1.15 her face was a 15 px smudge in the field's
// wide frame at D, the weakest figure on the farm; the hero reads a size up from the folk.
export const CATH_3D_SCALE = 1.32;
/** Plan item 459: her extra size on a phone's canvas (under 600 px wide). */
const CATH_PHONE_GROW = 1.25;
/** Plan item 485: the dusk the day's light runs toward (key, sky fill, ground bounce, the frame's sky and horizon). */
const DUSK_SUN = new THREE.Color("#ff965c");
const DUSK_FILL = new THREE.Color("#e8a888");
const DUSK_BOUNCE = new THREE.Color("#8a5434");
const DUSK_SKY = new THREE.Color("#5c5a8c");
const DUSK_HORIZON = new THREE.Color("#ee7440");

/** Plan item 98: the camera elevation (radians above the horizon) past which Cath leans back towards the lens. */
const CATH_LEAN_FROM = 0.95;

/** Plan item 515: how much each 3D tower's body is scaled over its model (its plinth isn't), so the defences stand
 * as the field's landmarks: the tall ones about 1.3-1.5x a farmer, the squat ones as tall as a farmer, each body
 * still inside its plot. The 2D sprites are unchanged. */
const TOWER_STAND: Partial<Record<string, number>> = {
  hedgerow: 1.45, scarecrow: 1.6, beehive: 1.5, stall: 1.4, pond: 1.25, windmill: 1.55, mast: 1.3, cannon: 1.55, silo: 1.55,
};
/** The squat towers also stand a little taller than wide (their footprint kept): the hedge grows up, the skep and the
 * stall's canopy rise, the cannon sits higher on its carriage. */
const TOWER_RISE: Partial<Record<string, number>> = { hedgerow: 1.3, beehive: 1.25, stall: 1.25, cannon: 1.3 };

export class Renderer3D {
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private grade: ShaderPass;
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
  /** Plan item 485: the day across a level (0 morning to 1 dusk), eased on wall-clock time, and the level's noon light. */
  private day = -1;
  private dayAt = 0;
  /** Plan item 703: the ground's off-field objects (the depot, verge trees, posts) and their own shadow casters. */
  private offField: Array<{ box: THREE.Box3; meshes: THREE.Mesh[] }> = [];
  private fieldRect = { x0: 0, z0: 0, x1: 0, z1: 0 };
  private dayBase: { levelId: number; night: boolean; el: number; cx: number; cz: number; sun: THREE.Color; sunI: number; hemi: THREE.Color; hemiG: THREE.Color; sky: THREE.Color; horizon: THREE.Color; exposure: number; lamps: number } | null = null;
  /** Plan item 59: the growing field. */
  private crops: Crops | null = null;
  private levelId = -1;
  private towers = new Map<number, TowerView>();
  private enemies = new Map<number, EnemyView>();
  /** Plan item 730: when each instanced vehicle was last hit (this.clock), for its flash. */
  private rungHit = new Map<number, number>();
  /** Fleet levels: every rung kind is one InstancedMesh (Hedgerow 2 M2); built on the first fleet level. */
  private rungs: RungInstances | null = null;
  /** Fleet knocks' Marks not yet floated: one "+N" every GOLD_WINDOW seconds. */
  private gold = { n: 0, x: 0, y: 0, age: 0 };
  private cath: THREE.Group | null = null;
  private faceTex: THREE.Texture | null = null;
  private sparks = new Sparks();
  /** Plan item 676: muzzle puffs and shot trails that linger, so a still frame shows the fight. */
  private puffs = new Puffs();
  /** Plan item 676: projectiles in the air now (not the silo's beams). */
  private inFlight = 0;
  private motes: Motes[] = [];
  private birds: Birds | null = null;
  private pxScale = 300;
  private kit: ShotKit | null = null;
  private flashMat = Object.assign(new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#fff0dc", emissiveIntensity: 0.9, roughness: 0.6 }), { shared: true });
  private gustLeaves: string[] = ["#6ea04c", "#8fbd57", "#c9a640"];
  private v1 = new THREE.Vector3();
  private qBox = new THREE.Box3();
  private q1 = new THREE.Quaternion();
  private v2 = new THREE.Vector3();
  private v3 = new THREE.Vector3();
  private debris = new Debris();
  private fx: Transients;
  private floaters: Floaters;
  private selection: THREE.Group;
  private rangeRing: THREE.Mesh;
  private brambles!: THREE.InstancedMesh;
  private brambleM = new THREE.Matrix4();
  private brambleQ = new THREE.Quaternion();
  private brambleE = new THREE.Euler();
  private brambleS = new THREE.Vector3();
  private brambleP = new THREE.Vector3();
  private aimDisc: THREE.Mesh;
  /** Cath's post between rounds: green when a tower reaches it, amber when nothing does. */
  private postRing: THREE.Mesh;
  /** A halo on Cath while she's picked up. */
  private heroHalo: THREE.Mesh;
  /** Plan item 297: the plot Cath's coaching points at, a glowing ring (with the advised tower's ghost). */
  private coachRing: THREE.Mesh;
  private ghost: THREE.Group | null = null;
  private ghostKey = "";
  private ghostDepth = new THREE.MeshBasicMaterial({ colorWrite: false });
  private ghostTint = new THREE.MeshLambertMaterial({ color: "#fff2c8", emissive: "#5a4a20", transparent: true, opacity: 0.6, depthFunc: THREE.LessEqualDepth, depthWrite: false });
  private bossBar: HTMLElement;
  /** Swarm badges (plan item 10), one per queue of more than 12, pooled; `key` is what each one shows. */
  private swarmEls: Array<{ el: HTMLElement; key: string }> = [];
  /** Plan item 657: a '+N' plate per column no swarm badge rides. */
  private columnEls: HTMLElement[] = [];
  /** Plan item 657: the columns counted on screen last frame (by a swarm badge or their own plate). */
  private countedCols = new Set<ConvoyColumn>();
  /** Plan item 657: how many of each column's vehicles were drawn last frame. */
  private jamDrawn = new Map<ConvoyColumn, number>();
  /** Plan item 45: this frame's convoy layout (syncEnemies), which the swarm badges ride. */
  private lay: Convoy = noConvoy();
  /** Plan item 45: each tower's pooled Marks and its "+N" label. */
  private towerMarks = new Map<number, { n: number; quiet: number; el: HTMLElement | null; box?: Rect; own?: Rect }>();
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
  /** When the camera last eased (performance.now ms). */
  private camWall = performance.now();
  /** Plan item 479: where the last van went down, and the win's held knockout: the camera leans in on it until
   *  `koUntil` (wall-clock ms), eased by `koEase` (0 = the play view). */
  private lastDown: { x: number; z: number } | null = null;
  private koUntil = 0;
  private koEase = 0;
  private koAt = { x: 0, z: 0 };
  private camBase = new THREE.Vector3();
  private camTarget = new THREE.Vector3();
  private heroSwung = 9;
  private heroPie = 9;
  /** Plan item 102: seconds since she cheered a cleared round, and since a vehicle leaked (her worried hand). */
  private heroCheer = 9;
  /** Seconds since a tower went in (she stoops to plant it), and the tower count she last saw. */
  private heroPlant = 9;
  /** Plan item 255: her turn about world y toward the camera while she stands (radians, eased). */
  private rootYaw = 0;
  /** Plan item 208: seconds since she last gave a hint (she points out over the field while it is fresh). */
  private heroPoint = 9;
  /** Plan item 310: how far her free arm swings out toward the lens (shoulder rotation.x) for a point or a wave. */
  private heroReach = 0;
  private towersSeen = -1;
  /** What her body says right now (read by the sandbox e2e). */
  heroMood: "rest" | "cheer" | "worried" | "plant" | "point" | "wave" = "rest";

  /** Plan item 208: she has just given a hint: she points out over the field with her free hand. */
  cathPoints(): void {
    this.heroPoint = 0;
  }
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
  /** Plan item 297: the plot Cath's coaching points at, and the tower she advises there (null when none). */
  coach: { col: number; row: number; kind: TowerKind } | null = null;
  /** Plan item 392: when the player last tapped Cath's plate (ms): the plot she means swells and flares. */
  coachPulseAt = -1e9;
  cursor: { col: number; row: number } | null = null;
  heroSelected = false;
  /** While Cath is picked up: where she'd stand if put down here. */
  postPreview: { x: number; y: number } | null = null;
  aim: { x: number; y: number; r: number } | null = null;
  preview: TowerKind | null = null;
  reducedMotion = false;
  /** Plan item 480: the farmhouse step's parcels, card and sale board, set by main.ts (`doorstep.ts`). */
  doorstep: DoorstepView | null = null;
  private door: Doorstep3D | null = null;
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
    this.sun.shadow.intensity = SHADOW_NOON;
    this.dynamic.add(this.sparks.points, this.puffs.points, this.debris.mesh);
    this.fx = new Transients(this.dynamic);
    this.floaters = new Floaters(overlay);
    // Plan item 691: callouts ('Bridge up!' over the windmill) rise clear of the towers.
    this.floaters.avoid = () => this.towerRects();
    this.overlayEl = overlay;
    // Plan item 469: the composer draws into a multisampled target (the renderer's own antialias does nothing once
    // a composer renders the scene, so every hedge, kerb and roof edge stair-stepped and the phone frame read soft).
    this.composer = new EffectComposer(this.renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // Plan item 561: a light bloom (0.35 over 0.88, was 0.7 over 0.8): only lamps, logos and magic glow now; the old
    // strength lifted the whole sunlit field into a milky haze, so plots, hedges and the lane shared one brightness.
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.5, 0.88);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    // Plan item 561: the field's grade, in display space after the tone map: a warm, gently S-shaped curve and a soft
    // vignette to the frame's edges, so the board reads as a printed poster on warm paper.
    this.grade = new ShaderPass(FIELD_GRADE);
    this.composer.addPass(this.grade);

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
    this.coachRing = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 0.48, 48),
      new THREE.MeshBasicMaterial({ color: "#ffe9a0", transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.coachRing.rotation.x = -Math.PI / 2;
    this.coachRing.visible = false;
    this.scene.add(this.selection, this.rangeRing, this.aimDisc, this.postRing, this.heroHalo, this.coachRing);
    // Plan item 468: a slowed vehicle is caught in brambles, a thorny tangle round its wheels (one instanced draw call).
    {
      this.brambles = new THREE.InstancedMesh(brambleGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true, emissive: "#14280a" }), 160);
      this.brambles.count = 0;
      this.brambles.frustumCulled = false;
      this.scene.add(this.brambles);
    }

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

    // Plan item 310: the shared bible's face painted onto her 3D head.
    this.faceTex = cathFaceTexture();
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
    const long = Math.max(this.w, this.h);
    (this.grade.uniforms.shape!.value as THREE.Vector2).set(Math.max(this.w / long, 0.5), Math.max(this.h / long, 0.5) * (this.w >= this.h ? 1.05 : 1));
    this.pxScale = this.h * dpr * 0.9;
    this.sparks.setScale(this.pxScale);
    this.puffs.setScale(this.pxScale, dpr);
    this.camera.aspect = this.w / this.h;
    if (game.level.id !== this.levelId) this.buildLevel(game);
    for (const m of this.motes) m.setScale(this.pxScale);
    this.fitCamera(game);
  }

  private buildLevel(game: Game): void {
    this.levelId = game.level.id;
    // Free the last level's ground (its cached, shared materials stay for the next one).
    this.door?.dispose();
    this.door = null;
    for (const o of [...this.world.children]) o.traverse(disposeOwn);
    for (const m of this.motes) m.dispose();
    this.birds?.dispose();
    this.motes = [];
    this.birds = null;
    this.world.clear();
    this.clearDynamic();
    const L = hasTwist(game.level, "night") && game.level.id <= 90 ? nightLight(actLight(game.level.id)) : actLight(game.level.id);
    // Plan item 486: an upright phone's ground is graded for the small frame (the lane apart from the beds).
    this.ground = buildGround(game.level, { phone: this.w < 600 && this.h > this.w });
    this.world.add(this.ground.group);
    {
      // Plan item 480: the parcels pile beside the farmhouse door (left of it at the field's right edge) and the sale
      // board stands by the first lane cell, behind a lane that runs across the field or on its field side.
      const lv = game.level;
      const [ec] = lv.path[lv.path.length - 1]!;
      const [c, r] = lv.path[0]!;
      const [c2, r2] = lv.path[1]!;
      const dx = Math.sign(c - c2);
      const dy = Math.sign(r - r2);
      // Planted like an estate agent's board on the field's first corner (the gate itself often stands past the frame):
      // north of a lane that comes in across the field, beside one that comes in from the north or south, toward the middle.
      const bx = c + 0.5 - dx * 0.25 + (dx !== 0 ? 0 : c + 0.5 < lv.cols / 2 ? 0.55 : -0.55);
      const bz = r + 0.5 - dy * 0.25 + (dx !== 0 ? -0.55 : 0);
      this.door = new Doorstep3D(this.reducedMotion);
      // The pile goes on the door's camera side (the camera looks north), so it isn't hidden behind the house.
      const yawF = this.ground.farmhouse.rotation.y;
      const toCam = -Math.sin(yawF);
      const side: 1 | -1 = Math.abs(toCam) > 0.3 ? (toCam > 0 ? 1 : -1) : ec >= lv.cols - 2 ? -1 : 1;
      this.door.attach(this.ground.farmhouse, side, { x: bx, y: this.ground.heightAt(bx, bz), z: bz, yaw: 0 }, this.world);
    }
    this.crops = new Crops(game.level, this.ground.heightAt, this.canvas, this.reducedMotion, this.ground.bedTints, this.ground.bedLooks);
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
    // Plan item 307: the frame's top edge fades into the same haze, so far scenery the frame cuts (a lighthouse, a
    // tree, a moored mast) dissolves into distance instead of ending in a hard slice (styles.css .stage[data-haze]).
    const stage = this.canvas.parentElement;
    stage?.style.setProperty("--field-haze", `#${new THREE.Color(L.fog).getHexString()}`);
    // Plan item 438: the frame's top is painted sky, not only haze: the act's own sky colour above a horizon warmed
    // toward its low sun, with the sun's glow on its side of the frame (styles.css .stage[data-haze]). The fitted
    // camera looks down too steeply for the backdrop's sky to reach the frame.
    const horizon = new THREE.Color(L.skyBottom).lerp(new THREE.Color(L.sun), 0.35).lerp(new THREE.Color("#f2c98a"), hasTwist(game.level, "night") || game.level.id > 90 ? 0 : 0.3);
    stage?.style.setProperty("--field-sky", `#${new THREE.Color(L.skyTop).getHexString()}`);
    stage?.style.setProperty("--field-horizon", `#${horizon.getHexString()}`);
    stage?.style.setProperty("--field-sun-x", `${Math.round(50 + 38 * Math.sin((L.sunAz * Math.PI) / 180))}%`);
    stage?.setAttribute("data-haze", "");
    const night = hasTwist(game.level, "night") || game.level.id > 90;
    this.renderer.toneMappingExposure =
      L.exposure * (game.level.id > 90 ? 1.25 : night ? 1 : 1.06) * (setPiece(game.level, "blackout") ? 0.55 : 1);
    this.hemi.color.set(L.hemiSky);
    this.hemi.groundColor.set(L.hemiGround);
    // Plan item 66: a warm key and a soft, warm bounce by day (the 2D field's sunny poster), not overcast fill.
    // Plan item 360: a low warm key and less sky fill by day, so hedges, barns and towers cast shadows that read.
    const key = dayKey(L, night);
    this.hemi.intensity = L.hemiIntensity * key.hemi;
    if (!night) this.hemi.groundColor.lerp(new THREE.Color("#c8a46a"), 0.35);
    this.sun.color.set(L.sun);
    if (!night) this.sun.color.lerp(new THREE.Color("#ffd9a0"), key.warm);
    this.sun.intensity = L.sunIntensity * key.sun * (hasTwist(game.level, "rain") ? 0.7 : 1);
    // Night: a cool moon fills in from the back so everything still reads.
    this.rim.color.set(night ? "#8fb0ff" : "#9fc4ff");
    this.rim.position.set(game.level.cols / 2, 6, -8);
    this.rim.target = this.sun.target;
    this.rim.intensity = key.rim;
    const cx = game.level.cols / 2;
    const cz = game.level.rows / 2;
    const az = (L.sunAz * Math.PI) / 180;
    const el = (key.el * Math.PI) / 180;
    const d = 20;
    this.sun.position.set(cx + Math.cos(az) * Math.cos(el) * d, Math.sin(el) * d, cz + Math.sin(az) * Math.cos(el) * d);
    this.sun.target.position.set(cx, 0, cz);
    this.dayBase = {
      levelId: game.level.id,
      night,
      el: key.el,
      cx,
      cz,
      sun: this.sun.color.clone(),
      sunI: this.sun.intensity,
      hemi: this.hemi.color.clone(),
      hemiG: this.hemi.groundColor.clone(),
      sky: new THREE.Color(L.skyTop),
      horizon: horizon.clone(),
      exposure: this.renderer.toneMappingExposure,
      // the windows lit all level at night and in Blackout's dark
      lamps: night || setPiece(game.level, "blackout") ? 1 : -1,
    };
    this.day = -1;
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
    // Plan item 255: her figure inked like the 2D field's people, on her eight largest parts.
    inkFigure(this.cath, 8, 0.02);
    this.dynamic.add(this.cath);
    this.findOffField(game.level.cols, game.level.rows);
    this.clipFieldShadows();
  }

  /** Plan item 703: the objects beside the field (the depot, the verge's trees, posts and parked vans) whose shadow
   *  casters can reach it. The sun sinks so shadows lengthen 1.8x at the ends of the day (item 485), and a low sun
   *  laid their shadows across the field as hard dark bands from casters the frame barely shows (P l27: the depot's
   *  wedge, a verge tree's 130 px bar). Instanced batches (hedges, crops) span the field and stay as they are. */
  private findOffField(cols: number, rows: number): void {
    this.fieldRect = { x0: 0, z0: 0, x1: cols, z1: rows };
    this.offField = [];
    const group = this.ground?.group;
    if (!group) return;
    const box = new THREE.Box3();
    group.updateMatrixWorld(true);
    const r = this.fieldRect;
    const off = (b: THREE.Box3) => !b.isEmpty() && !(b.max.x > r.x0 && b.min.x < r.x1 && b.max.z > r.z0 && b.min.z < r.z1);
    for (const child of group.children) {
      const inst = child as THREE.InstancedMesh;
      if (inst.isInstancedMesh) {
        // a batch wholly beside the field (the verge's tree rows); the crop and hedge batches span it and stay
        if (!inst.castShadow) continue;
        inst.computeBoundingBox();
        if (inst.boundingBox && off(box.copy(inst.boundingBox).applyMatrix4(inst.matrixWorld))) this.offField.push({ box: box.clone(), meshes: [inst] });
        continue;
      }
      const meshes: THREE.Mesh[] = [];
      child.traverse((o) => {
        if ((o as THREE.Mesh).isMesh && o.castShadow && !(o as THREE.InstancedMesh).isInstancedMesh) meshes.push(o as THREE.Mesh);
      });
      if (meshes.length && off(box.setFromObject(child))) this.offField.push({ box: box.clone(), meshes });
    }
  }

  /** Plan item 703: an off-field object casts no shadow while the sun would lay it on the field (its footprint swept
   *  along the light by its height over tan(elevation) touches the field's rect); otherwise it keeps its shadow on
   *  the verge. Run when the sun moves. */
  private clipFieldShadows(): void {
    if (!this.offField.length) return;
    const s = this.sun.position;
    const t = this.sun.target.position;
    const hx = t.x - s.x;
    const hz = t.z - s.z;
    const hl = Math.hypot(hx, hz) || 1;
    const run = hl / Math.max(0.05, s.y - t.y); // ground distance a unit of height throws
    const dx = hx / hl;
    const dz = hz / hl;
    const r = this.fieldRect;
    const inField = (x: number, z: number) => x > r.x0 + 0.05 && x < r.x1 - 0.05 && z > r.z0 + 0.05 && z < r.z1 - 0.05;
    for (const o of this.offField) {
      const len = Math.max(0, o.box.max.y) * run;
      let hits = false;
      // a 5x5 grid over the footprint (a verge row runs the field's whole side), each point swept along the light
      for (let i = 0; i <= 4 && !hits; i++)
        for (let j = 0; j <= 4 && !hits; j++) {
          const cx = o.box.min.x + ((o.box.max.x - o.box.min.x) * i) / 4;
          const cz = o.box.min.z + ((o.box.max.z - o.box.min.z) * j) / 4;
          for (let k = 1; k <= 8 && !hits; k++) hits = inField(cx + (dx * len * k) / 8, cz + (dz * len * k) / 8);
        }
      for (const m of o.meshes) m.castShadow = !hits;
    }
  }

  /** Plan item 485: the sun crosses the sky over the level, as in 2D (render.ts): the phase follows the round under
   *  way or next up, eased over 1.2 s on wall-clock time (the game's dt is 0 between rounds), stepped under reduced
   *  motion. The sun swings about the act's noon and sinks so shadows lengthen 1.8x; after noon the key, the sky fill
   *  and the frame's horizon warm toward dusk; from the last third the farmhouse windows and the depot's neon are lit.
   *  Night levels keep their moonlit set and lit windows. */
  private syncDay(game: Game): void {
    const b = this.dayBase;
    if (!b || b.levelId !== game.level.id) return;
    const to = dayPhase(Math.max(1, game.phase === "build" ? game.wave + 1 : game.wave), game.level.waves.length);
    const now = performance.now();
    // (a slow frame may carry up to half a second, so a few-fps device still finishes the 1.2 s ease in three frames)
    const wall = this.dayAt ? Math.min(0.5, (now - this.dayAt) / 1000) : 0;
    this.dayAt = now;
    const was = this.day;
    if (this.day < 0 || this.reducedMotion) this.day = to;
    else this.day += Math.sign(to - this.day) * Math.min(Math.abs(to - this.day), wall / 1.2);
    if (this.day === was) return;
    const p = this.day;
    if (b.night) {
      setDuskLamps(1);
      this.folkMeshes.lit = true;
      return;
    }
    const az = (dayAzFor(game.level.id, p) * Math.PI) / 180;
    // a low sun: tan(elevation) falls by the shadow's lengthening, so a shadow is 1.8x noon's at morning and dusk
    const el = Math.atan(Math.tan((b.el * Math.PI) / 180) / dayShadowLength(p));
    const d = 20;
    this.sun.position.set(b.cx + Math.cos(az) * Math.cos(el) * d, Math.sin(el) * d, b.cz + Math.sin(az) * Math.cos(el) * d);
    this.clipFieldShadows();
    const warm = dayWarmth(p);
    const low = 2 * Math.abs(p - 0.5);
    this.sun.color.copy(b.sun).lerp(DUSK_SUN, 0.6 * warm);
    // The ground's sunlight goes as sin(elevation): a sun sunk to lengthen the shadows 1.8x lit the morning field at
    // about half of noon's (lane B's measure, l21's lane 0.27 -> 0.11 on a phone), so the key is raised by the sine it
    // lost and only a light softening at the ends of the day is kept: the long shadows and warmth carry the hour.
    const sinRatio = Math.sin((b.el * Math.PI) / 180) / Math.max(0.15, Math.sin(el));
    this.sun.intensity = b.sunI * sinRatio * (1 - 0.06 * low * low);
    // Plan item 703: that raised key also deepened every shadow: at round 15 of 30 on a phone the lorries', hedges'
    // and towers' 1.8x shadows fell under half the lit field's light, hard dark bands that hid the convoy (6% of the
    // field, runs 76 px wide). The shadow keeps some light, more so as the sun sinks: under 0.6% of the field below
    // half after, the long shadows still drawn (scratchpad s703 ratio masks).
    this.sun.shadow.intensity = SHADOW_NOON - 0.12 * low * low;
    this.hemi.color.copy(b.hemi).lerp(DUSK_FILL, 0.35 * warm);
    this.hemi.groundColor.copy(b.hemiG).lerp(DUSK_BOUNCE, 0.3 * warm);
    this.renderer.toneMappingExposure = b.exposure * (1 - 0.06 * warm);
    const lit = b.lamps > 0 ? 1 : dayLamps(p) ? Math.min(1, (p - 2 / 3) * 6 + 0.4) : 0;
    setDuskLamps(lit);
    this.folkMeshes.lit = lit > 0;
    const stage = this.canvas.parentElement;
    if (stage) {
      stage.style.setProperty("--field-sky", `#${b.sky.clone().lerp(DUSK_SKY, 0.45 * warm).getHexString()}`);
      stage.style.setProperty("--field-horizon", `#${b.horizon.clone().lerp(DUSK_HORIZON, 0.8 * warm).getHexString()}`);
      stage.style.setProperty("--field-sun-x", `${Math.round(50 + 38 * Math.sin(az))}%`);
    }
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
      // Plan item 288: a phone's small canvas shows the air's motes large and many, like snow over the field; it
      // keeps about two in five of them.
      const airK = this.canvas.clientWidth > 0 && this.canvas.clientWidth < 600 ? 0.4 : 1;
      if (!hasTwist(lv, "rain")) this.motes.push(new Motes(Math.round(70 * airK), { kind: "pollen", color: mood.mote, size: 0.05, box, wind }));
      if (weather && !this.reducedMotion) {
        // Plan item 307: the coast's sea mist and spray (soft puffs a cell across) drift over the water, not the plots,
        // where they read as white blobs in front of the field.
        const still = weather.size >= 1 ? { ...box, x0: -5, x1: -0.7, y0: 0.1, y1: 0.9 } : { ...box, y0: 0.1, y1: 0.9 };
        this.motes.push(new Motes(Math.round(weather.count * airK), { kind: "pollen", color: weather.color, size: weather.size, box: weather.fall && weather.fall < 0 ? { ...sky, y1: 2.2 } : weather.fall ? sky : still, wind: weather.wind * wind, fall: weather.fall, alphaMax: weather.size >= 1 ? weather.alpha * 1.6 : weather.alpha, additive: weather.additive, soft: weather.size >= 1 }));
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
    this.fogLevel = game.level;
    this.fitFog();
    this.camTarget.copy(target);
    this.fieldSize.set(cols, rows);
    this.homePanX = 0;
    this.resetView();
    // Plan item 215: an upright phone has a closer frame on the lane's busy half (the gate towards the field's
    // middle). Plan item 439: it opens on the whole field (the whole lane and Cath in view, no verge-filled close
    // frame); the Closer button (and a double-tap or pinch) pushes in.
    const gate = game.level.path[0];
    this.openFrame =
      this.w < 600 && this.h > this.w && gate
        ? { zoom: 1.6, ...this.gateLook(gate[0] + 0.5, gate[1] + 0.5, cols, rows, 1.6) }
        : null;
    // Plan item 710: every view fits once the depots stand (a desktop's depot could stand off the side too).
    this.openFramePending = true;
  }

  private fogLevel: Game["level"] | null = null;
  /** The fog fitted to the base view's distance from the field (plan items 66, 78, 242, 469). Plan item 735: refitted
   *  once the depots stand, since items 591 and 710 may step the view back and the field then sat in the haze. */
  private fitFog(): void {
    // Fog starts beyond the field whatever the camera distance (phones sit further back).
    const level = this.fogLevel;
    if (level && this.scene.fog instanceof THREE.Fog) {
      const cols = level.cols;
      const L = actLight(level.id);
      const dim = hasTwist(level, "fog") ? 0.78 : hasTwist(level, "night") ? 0.85 : 1;
      // Plan item 66: clear air over the field by day; the haze only gathers out towards the hills.
      const clear = dim === 1 && level.id <= 90 ? 4 : 0;
      // Plan item 78: measured from the field's far edge (the fitted camera sits much closer than before), so the
      // field itself stands in clear air and the haze gathers over the hills beyond it.
      const farEdge = this.camBase.distanceTo(this.v1.set(cols / 2, 0, -0.5));
      const near = farEdge + (L.fogNear - 14) * 0.5 + clear;
      // Plan item 242: the country past the far verge fades into the act's air within a few cells, so the far
      // houses, boats and slabs at the frame's top read as distance, not as props sliced by the frame. The field
      // itself (to its far edge) stays in clear air.
      // Plan item 469: a wide frame's haze starts a cell further out and thins over 14 cells, not 8 (a critique read
      // the far edge at D as a white haze over the country, 0-120 px); a phone keeps its short fade.
      const wide = this.w >= 900;
      // Plan item 735: on a clear day the haze never starts inside the field. A phone's steep, distant camera puts the
      // field's near and far edges at much the same range (29 and 32 at level 27), and the act's short fog put its
      // start at 30: the back half of the field stood in up to half fog, the whole frame milky against D's.
      const hazeNear = Math.max(dim === 1 ? farEdge + 0.4 : 0, Math.min(near, farEdge + (wide ? 1.8 : 0.8)));
      // Plan item 290: over 8 cells, not 4.5: the far country (houses, trees, the shore) shows softened at a wide
      // frame's top instead of a blank band of haze.
      const hazeFar = Math.min(near + (L.fogFar - L.fogNear), hazeNear + (wide ? 14 : 4.5));
      this.scene.fog.near = hazeNear * dim;
      this.scene.fog.far = hazeFar * dim;
    }
  }

  /** Where the close frame looks: towards the field's middle from the gate, as far as keeps the gate (and its
   * depot beyond the edge) about a cell and a half inside the view on each axis. */
  private gateLook(gx: number, gz: number, cols: number, rows: number, zoom: number): { x: number; z: number } {
    const axis = (g: number, mid: number, half: number) => {
      const d = mid - g;
      const k = Math.max(0, half - 1.5);
      return Math.abs(d) <= k ? mid : g + Math.sign(d) * k;
    };
    return { x: axis(gx, cols / 2, cols / (2 * zoom)), z: axis(gz, rows / 2, rows / (2 * zoom)) };
  }

  private openFrame: { zoom: number; x: number; z: number } | null = null;
  private openFramePending = false;
  /** Plan item 215: once the depots stand (the first frame after a resize), slide the close frame towards the
   * first gate's depot until at least 80% of it is in view, so the next round's count still hangs on it. */
  private fitOpenFrame(): void {
    this.openFramePending = false;
    const close = this.zoomed;
    const f = this.openFrame;
    const d = ((this.ground?.group.userData.depots as THREE.Object3D[] | undefined) ?? [])[0];
    this.dropToDepots();
    this.widenToDepots();
    this.fitFog();
    if (!d) return;
    const box = new THREE.Box3().setFromObject(d);
    if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3());
    if (f) {
      const look = new THREE.Vector3();
      const p = new THREE.Vector3();
      for (let i = 0; i < 40; i++) {
        look.set(f.x, this.camTarget.y, f.z);
        this.camera.position.copy(this.camBase).sub(this.camTarget).multiplyScalar(1 / f.zoom).add(look);
        this.camera.lookAt(look);
        this.camera.updateMatrixWorld();
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (let k = 0; k < 8; k++) {
          p.set(k & 1 ? box.max.x : box.min.x, k & 2 ? box.max.y : box.min.y, k & 4 ? box.max.z : box.min.z).project(this.camera);
          x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
        }
        const seen = (Math.max(0, Math.min(1, x1) - Math.max(-1, x0)) * Math.max(0, Math.min(1, y1) - Math.max(-1, y0))) / Math.max(1e-6, (x1 - x0) * (y1 - y0));
        if (seen >= 0.8) break;
        const dx = c.x - f.x, dz = c.z - f.z;
        const len = Math.hypot(dx, dz);
        if (len < 0.3) break;
        f.x += (dx / len) * 0.25;
        f.z += (dz / len) * 0.25;
      }
    }
    // Plan item 735: lean for every depot, not the first gate's alone (level 34's second depot stood a third off the
    // phone's left edge: item 710's step-back made room for it, but the lean never spent it).
    const all = ((this.ground?.group.userData.depots as THREE.Object3D[] | undefined) ?? []).map((o) => new THREE.Box3().setFromObject(o)).filter((b) => !b.isEmpty());
    this.homePanX = this.leanToDepot(all.reduce((u, b) => u.union(b), box.clone()));
    // The search moved the camera: put it back on the view the player has (item 439: the whole field by default).
    if (close) this.frameClose();
    else this.resetView();
  }
  /** Plan item 591: on an upright phone a gate on the field's far edge put its depot past the canvas's top (level 21:
   *  9 px cut off, its roof under the HUD). Once the depots stand, the fitted view steps back and slides towards the
   *  far edge, by the least that brings every depot's top 3 px inside the canvas (the canvas starts 6 px under the HUD) while the field's near edge stays
   *  3 px above its foot. The fitted base itself moves, so the whole-field view, the close frame and Reset agree. */
  private dropToDepots(): void {
    const depots = (this.ground?.group.userData.depots as THREE.Object3D[] | undefined) ?? [];
    const boxes = depots.map((o) => new THREE.Box3().setFromObject(o)).filter((b) => !b.isEmpty());
    if (!boxes.length) return;
    const h = this.h;
    const cols = this.fieldSize.x, rows = this.fieldSize.y;
    const tgt = this.camTarget.clone();
    const off = this.camBase.clone().sub(tgt);
    const look = new THREE.Vector3();
    const p = new THREE.Vector3();
    const place = (s: number, dz: number) => {
      look.set(tgt.x, tgt.y, tgt.z + dz);
      this.camera.position.copy(off).multiplyScalar(s).add(look);
      this.camera.lookAt(look);
      this.camera.updateMatrixWorld();
    };
    const py = (x: number, y: number, z: number) => (-p.set(x, y, z).project(this.camera).y * 0.5 + 0.5) * h;
    const top = () => {
      let t = Infinity;
      for (const b of boxes) for (let k = 0; k < 8; k++) t = Math.min(t, py(k & 1 ? b.max.x : b.min.x, k & 2 ? b.max.y : b.min.y, k & 4 ? b.max.z : b.min.z));
      return t;
    };
    const foot = () => Math.max(py(0, 0, rows + 0.25), py(cols, 0, rows + 0.25));
    // (6 px: since item 637's tighter phone dock the canvas starts ~4.5 px under the HUD, not 6, and 3 left the depot 7 px
    // under it where 8 is wanted)
    const TOP = 6, FOOT = h - 3;
    place(1, 0);
    if (top() >= TOP) return;
    for (let s = 1; s <= 1.4001; s += 0.004) {
      // Looking further towards the far edge (dz < 0) moves everything down the frame.
      let lo = -rows, hi = 0;
      place(s, 0);
      if (top() < TOP) {
        for (let i = 0; i < 24; i++) {
          const mid = (lo + hi) / 2;
          place(s, mid);
          if (top() >= TOP) lo = mid;
          else hi = mid;
        }
        place(s, lo);
      } else lo = 0;
      if (top() >= TOP - 0.5 && foot() <= FOOT) {
        this.camTarget.set(tgt.x, tgt.y, tgt.z + lo);
        this.camBase.copy(off).multiplyScalar(s).add(this.camTarget);
        break;
      }
    }
    this.camera.position.copy(this.camBase);
    this.camera.lookAt(this.camTarget);
    this.camera.updateMatrixWorld();
  }
  /** Plan item 710: a gate on the field's side edge put its depot past the canvas's side (level 27: D 205 px wide at
   *  x -36, P 72 px wide at x -37) where the lean (item 486) had no field margin to spend. The fitted view steps
   *  back by the least that lets the lean bring every depot whole inside the canvas, 6 px clear of its sides. */
  private widenToDepots(): void {
    const depots = (this.ground?.group.userData.depots as THREE.Object3D[] | undefined) ?? [];
    const boxes = depots.map((o) => new THREE.Box3().setFromObject(o)).filter((b) => !b.isEmpty());
    if (!boxes.length) return;
    const w = this.w;
    const cols = this.fieldSize.x, rows = this.fieldSize.y;
    const tgt = this.camTarget.clone();
    const off = this.camBase.clone().sub(tgt);
    const edge: Array<[number, number, number]> = [];
    for (const z of [0, rows]) for (const x of [0, cols]) edge.push([x, this.height(Math.min(cols - 0.5, Math.max(0.5, x)), Math.min(rows - 0.5, Math.max(0.5, z))), z]);
    const sx = (x: number, y: number, z: number) => (this.v1.set(x, y, z).project(this.camera).x * 0.5 + 0.5) * w;
    const fits = (): boolean => {
      const fx = edge.map(([x, y, z]) => sx(x, y, z));
      let spareL = Math.min(...fx) - 6, spareR = w - 6 - Math.max(...fx);
      for (const b of boxes) {
        let d0 = Infinity, d1 = -Infinity;
        for (let k = 0; k < 8; k++) {
          const x = sx(k & 1 ? b.max.x : b.min.x, k & 2 ? b.max.y : b.min.y, k & 4 ? b.max.z : b.min.z);
          d0 = Math.min(d0, x); d1 = Math.max(d1, x);
        }
        // A lean one way spends the other side's margin; two depots off opposite sides can't both lean.
        if (d0 < 6) { const need = 6 - d0; if (need > spareR) return false; spareR -= need; spareL += need; }
        if (d1 > w - 6) { const need = d1 - (w - 6); if (need > spareL) return false; spareL -= need; spareR += need; }
      }
      return true;
    };
    for (let s = 1; s <= 1.3001; s += 0.004) {
      this.camera.position.copy(off).multiplyScalar(s).add(tgt);
      this.camera.lookAt(tgt);
      this.camera.updateMatrixWorld();
      if (fits()) {
        if (s > 1) this.camBase.copy(off).multiplyScalar(s).add(tgt);
        break;
      }
    }
    this.camera.position.copy(this.camBase);
    this.camera.lookAt(this.camTarget);
    this.camera.updateMatrixWorld();
  }
  /** Plan item 486: the whole-field view's sideways lean (world x) that brings the depot's `box` furthest into frame
   *  while the field's edge columns keep 6 px inside the canvas; 0 when the depot is already in. */
  private leanToDepot(box: THREE.Box3): number {
    const w = this.w;
    this.camera.position.copy(this.camBase);
    this.camera.lookAt(this.camTarget);
    this.camera.updateMatrixWorld();
    const cols = this.fieldSize.x, rows = this.fieldSize.y;
    const xs = (pts: Array<[number, number, number]>) => pts.map(([x, y, z]) => (this.v1.set(x, y, z).project(this.camera).x * 0.5 + 0.5) * w);
    // The field's left and right edges on screen, at its near and far rows (the near row is the widest).
    const edge: Array<[number, number, number]> = [];
    for (const z of [0, rows]) for (const x of [0, cols]) edge.push([x, this.height(Math.min(cols - 0.5, Math.max(0.5, x)), Math.min(rows - 0.5, Math.max(0.5, z))), z]);
    const fx = xs(edge);
    const spareL = Math.min(...fx) - 6, spareR = w - 6 - Math.max(...fx);
    // Plan item 710: every corner, roof and all (its base at mid-depth read level 27's depot inside at D while its
    // near roof stood 36 px past the canvas's left edge).
    const corners: Array<[number, number, number]> = [];
    for (let k = 0; k < 8; k++) corners.push([k & 1 ? box.max.x : box.min.x, k & 2 ? box.max.y : box.min.y, k & 4 ? box.max.z : box.min.z]);
    const dx = xs(corners);
    const d0 = Math.min(...dx), d1 = Math.max(...dx);
    const inside = (Math.max(0, Math.min(w, d1) - Math.max(0, d0))) / Math.max(1, d1 - d0);
    // Plan item 622: lean until it stands whole (was: half in, which left level 21's depot cut by the frame at D),
    // as far as the field's own edges allow.
    if (inside >= 0.98) return 0;
    // Depots off both sides at once: no lean serves both.
    if (d0 < 0 && d1 > w) return 0;
    // Screen px to world x at the field's middle row.
    const [a, b] = xs([[0, 0, rows / 2], [cols, 0, rows / 2]]);
    const perPx = cols / Math.max(1, b! - a!);
    // Content moves right (the view leans left) for a depot off the left edge, and the other way for the right.
    const need = d0 < 0 ? 6 - d0 : d1 - w + 6;
    const room = d0 < 0 ? spareR : spareL;
    const shift = Math.max(0, Math.min(need, room));
    return (d0 < 0 ? -shift : shift) * perPx;
  }
  /** Plan item 215: whether this view opens closer than the whole field (an upright phone). */
  get hasCloseFrame(): boolean {
    return !!this.openFrame || this.wideClose;
  }
  /** Plan item 651: a desktop opens on the whole field (the whole lane, depot to farmhouse, while a round runs) and
   *  has a Closer key too: it pushes in 1.45x and, while a round runs, drifts with the lead vehicle. */
  private get wideClose(): boolean {
    return this.w >= 900 && this.w > this.h;
  }
  private follow = false;
  /** Tests: whether the Closer view is following the lead vehicle, and where it looks (world cells). */
  followView(): { on: boolean; x: number; z: number } {
    return { on: this.follow && this.zoomed, x: this.camTarget.x + this.pan.x, z: this.camTarget.z + this.pan.y };
  }
  /** Plan item 651: the Closer view's look eases towards the lead vehicle on the lane (the one furthest along), or
   *  towards the gate's side of the field between rounds; clamped so the frame stays on the field. */
  private followLead(game: Game, camDt: number): void {
    if (!this.follow || !this.zoomed) return;
    let lead: Enemy | null = null;
    for (const e of game.enemies) if (!lead || e.dist > lead.dist) lead = e;
    let at: { x: number; y: number };
    if (lead) at = pointAt(lead.lane === 1 && game.level.path2 ? game.level.path2 : game.level.path, Math.max(0, lead.dist));
    else {
      const gate = game.level.path[0] ?? [0, 0];
      const g = this.gateLook(gate[0] + 0.5, gate[1] + 0.5, this.fieldSize.x, this.fieldSize.y, this.zoom);
      at = { x: g.x, y: g.z };
    }
    const k = this.reducedMotion ? 1 : Math.min(1, camDt * 1.4);
    this.pan.x += (at.x - this.camTarget.x - this.pan.x) * k;
    this.pan.y += (at.y - this.camTarget.z - this.pan.y) * k;
    this.clampPan();
  }
  /** Plan item 215: back to the opening close frame (no-op where the view opens on the whole field). */
  frameClose(): void {
    const f = this.openFrame;
    if (!f && this.wideClose) {
      this.zoom = 1.45;
      this.follow = true;
      return;
    }
    if (!f) return;
    this.zoom = f.zoom;
    // Not clamped to the field: the frame may lean past its edge to keep the gate's depot in view.
    this.pan.set(f.x - this.camTarget.x, f.z - this.camTarget.z);
  }

  /** Plan item 78: the share of the frame the field's projected bounding box covers (0..1), at the fitted view. */
  /** Plan item 284: her whole figure's box on the page in CSS px, so shot scripts can crop round her on any level. */
  /** Plan item 515: on-screen heights (CSS px) of each built tower, each farmer and Cath, for the towers' scale checks. */
  towerHeights(): { towers: Array<{ kind: string; h: number; w: number; world: number }>; folk: number[]; folkWorld: number[]; cath: number | null; cathWorld: number | null } {
    const r = this.canvas.getBoundingClientRect();
    const box = (o: THREE.Object3D) => new THREE.Box3().setFromObject(o);
    const hOf = (o: THREE.Object3D) => this.boxRect(box(o), r.width, r.height);
    const tall = (o: THREE.Object3D) => { const b = box(o); return b.max.y - b.min.y; };
    const towers: Array<{ kind: string; h: number; w: number; world: number }> = [];
    for (const [, v] of this.towers) {
      const lean = (v.obj.userData.lean as THREE.Object3D | undefined) ?? v.obj;
      const b = hOf(lean);
      towers.push({ kind: String(v.sig.split(":")[0]), h: b.h, w: b.w, world: tall(lean) });
    }
    const people = this.folkMeshes.people();
    return {
      towers,
      folk: people.map((o) => hOf(o).h),
      folkWorld: people.map(tall),
      cath: this.cath?.visible ? hOf(this.cath).h : null,
      cathWorld: this.cath?.visible ? tall(this.cath) : null,
    };
  }
  /** Plan item 515: each built tower drawn alone in flat black on white from the game camera, as an n x n mask of 0/1
   * (the tower's screen box scaled to fit), so a test can tell the nine apart by silhouette. Test hook only. */
  towerMasks(n = 48): Array<{ kind: string; mask: number[] }> {
    const out: Array<{ kind: string; mask: number[] }> = [];
    const r = this.canvas.getBoundingClientRect();
    const rt = new THREE.WebGLRenderTarget(n, n);
    const black = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const prev = { bg: this.scene.background, over: this.scene.overrideMaterial, fog: this.scene.fog };
    const shown = new Map<THREE.Object3D, boolean>();
    for (const o of this.scene.children) shown.set(o, o.visible);
    const cam = this.camera.clone() as THREE.PerspectiveCamera;
    const buf = new Uint8Array(n * n * 4);
    try {
      this.scene.background = new THREE.Color(0xffffff);
      this.scene.overrideMaterial = black;
      this.scene.fog = null;
      for (const o of this.scene.children) o.visible = o === this.dynamic;
      const dynShown = new Map<THREE.Object3D, boolean>();
      for (const o of this.dynamic.children) dynShown.set(o, o.visible);
      for (const [, v] of this.towers) {
        for (const o of this.dynamic.children) o.visible = o === v.obj;
        const b = this.boxRect(new THREE.Box3().setFromObject(v.obj), r.width, r.height);
        // a view offset that crops the camera to the tower's box, squared up
        const side = Math.max(b.w, b.h) * 1.05;
        cam.setViewOffset(r.width, r.height, b.x + b.w / 2 - side / 2, b.y + b.h / 2 - side / 2, side, side);
        cam.updateProjectionMatrix();
        this.renderer.setRenderTarget(rt);
        this.renderer.render(this.scene, cam);
        this.renderer.readRenderTargetPixels(rt, 0, 0, n, n, buf);
        const mask: number[] = [];
        for (let y = n - 1; y >= 0; y--) for (let x = 0; x < n; x++) mask.push(buf[(y * n + x) * 4]! < 128 ? 1 : 0);
        out.push({ kind: String(v.sig.split(":")[0]), mask });
      }
      for (const [o, vis] of dynShown) o.visible = vis;
    } finally {
      this.renderer.setRenderTarget(null);
      this.scene.background = prev.bg;
      this.scene.overrideMaterial = prev.over;
      this.scene.fog = prev.fog;
      for (const [o, vis] of shown) o.visible = vis;
      rt.dispose();
      black.dispose();
    }
    return out;
  }
  cathScreenBox(): Rect | null {
    if (!this.cath?.visible) return null;
    const r = this.canvas.getBoundingClientRect();
    const b = this.boxRect(new THREE.Box3().setFromObject(this.cath), r.width, r.height);
    return { x: b.x + r.left, y: b.y + r.top, w: b.w, h: b.h };
  }
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

  /** Plan item 657: the 3D convoy for the e2e tests: how many each column holds and draws (a jam, never a stack)
   * and whether its count is on screen. */
  convoyStats(): { drawn: number; column: number; cols: Array<{ dist: number; count: number; lane: number; shown: number; counted: boolean }> } {
    const cols = this.lay.columns.map((c) => ({ dist: c.dist, count: c.count, lane: c.lane ?? 0, shown: this.jamDrawn.get(c) ?? 0, counted: this.countedCols.has(c) }));
    return { drawn: this.lay.slots.size, column: this.lay.inColumn.size, cols };
  }

  /** Plan item 730: the instanced vehicles drawn this frame, kind and body box (CSS px, the canvas's frame). */
  rungBoxes(): Array<{ kind: EnemyKind; x: number; y: number; w: number; h: number }> {
    const r = this.canvas.getBoundingClientRect();
    return this.rungs?.drawnBoxes(this.camera, r.width, r.height) ?? [];
  }

  /** Plan item 215: each vehicle's box on screen (CSS px, the canvas's own frame), for the size checks: its
   * convoy footprint (the instanced fleet has no per-vehicle object), 0.55 units a size class long, 0.4 high. */
  vehicleBoxes(game: Game): Array<{ x: number; y: number; w: number; h: number }> {
    const r = this.canvas.getBoundingClientRect();
    const v = new THREE.Vector3();
    const out: Array<{ x: number; y: number; w: number; h: number }> = [];
    if (!this.lay) return out;
    for (const e of game.enemies) {
      const at = placeOnLane(game.level, e, this.lay);
      const half = 0.275 * enemyScale(e.kind);
      const gy = this.height(at.x, at.y);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (let k = 0; k < 8; k++) {
        v.set(at.x + (k & 1 ? half : -half), gy + (k & 2 ? 0.4 * enemyScale(e.kind) : 0), at.y + (k & 4 ? half : -half)).project(this.camera);
        const x = ((v.x + 1) / 2) * r.width, y = ((1 - v.y) / 2) * r.height;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      out.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
    }
    return out;
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

  /** Plan item 419: the share of the land past the hedge still in the field's plain grass, and the props on it. */
  margin3d(): { plainShare: number; props: number } | null {
    const m = this.ground?.group.userData.margin as { land: number; plain: number; props: number } | undefined;
    return m ? { plainShare: m.land ? m.plain / m.land : 0, props: m.props } : null;
  }

  /** Plan item 439: the share of the canvas beside the field on the rows it spans (the verge left and right of its
   * projected quad), through the live camera. On an upright phone it is mostly the 74 deg view's keystone. */
  fieldVerge(): number {
    const { x: cols, y: rows } = this.fieldSize;
    this.camera.updateMatrixWorld();
    const q = ([[0, 0], [cols, 0], [cols, rows], [0, rows]] as const).map(([x, z]) => {
      const p = this.v1.set(x, 0, z).project(this.camera);
      return { x: (p.x + 1) / 2, y: (1 - p.y) / 2 };
    });
    const N = 400;
    let side = 0;
    for (let i = 0; i < N; i++) {
      const y = (i + 0.5) / N;
      let lo = Infinity, hi = -Infinity;
      for (let k = 0; k < 4; k++) {
        const a = q[k]!, b = q[(k + 1) % 4]!;
        if (a.y === b.y) continue;
        const t = (y - a.y) / (b.y - a.y);
        if (t < 0 || t > 1) continue;
        const x = a.x + t * (b.x - a.x);
        lo = Math.min(lo, x);
        hi = Math.max(hi, x);
      }
      if (hi > lo) side += Math.max(0, Math.min(1, lo)) + Math.max(0, 1 - Math.max(0, hi));
    }
    return side / N;
  }

  /** Plan item 735: each depot's box as the live camera projects it, in canvas CSS px ([x0, y0, x1, y1]), and how
   *  much of it (0..1 of its projected area) the canvas holds. Tests and screenshot scripts read it. */
  /** Plan item 735: the fog's near and far against the fitted camera's distance to the field's near and far edges. */
  fogFrame(): { near: number; far: number; nearEdge: number; farEdge: number } | null {
    const fog = this.scene.fog;
    if (!(fog instanceof THREE.Fog)) return null;
    const { x: cols, y: rows } = this.fieldSize;
    const r = (v: number) => Math.round(v * 100) / 100;
    return { near: r(fog.near), far: r(fog.far), nearEdge: r(this.camBase.distanceTo(this.v1.set(cols / 2, 0, rows))), farEdge: r(this.camBase.distanceTo(this.v1.set(cols / 2, 0, -0.5))) };
  }
  depotFrames(): Array<{ box: [number, number, number, number]; inside: number }> {
    const depots = (this.ground?.group.userData.depots as THREE.Object3D[] | undefined) ?? [];
    return depots.map((o) => new THREE.Box3().setFromObject(o)).filter((b) => !b.isEmpty()).map((b) => {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i < 8; i++) {
        const p = this.v1.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).project(this.camera);
        const x = ((p.x + 1) / 2) * this.w, y = ((1 - p.y) / 2) * this.h;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      const iw = Math.max(0, Math.min(x1, this.w) - Math.max(x0, 0)), ih = Math.max(0, Math.min(y1, this.h) - Math.max(y0, 0));
      const area = Math.max(1e-6, (x1 - x0) * (y1 - y0));
      return { box: [x0, y0, x1, y1].map((v) => Math.round(v)) as [number, number, number, number], inside: Math.round(((iw * ih) / area) * 100) / 100 };
    });
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
    const depots = (this.ground?.group.userData.depots as THREE.Object3D[] | undefined) ?? [];
    let lane = -1;
    for (const sign of (this.ground?.group.userData.gateSigns as THREE.Object3D[] | undefined) ?? []) {
      lane++;
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
      // Plan item 215: an upright phone's close frame needs no growth, but the board still stands on the plots; on a
      // phone it steps down whatever the zoom, so the town stays on the plate as the view goes close and back.
      // Plan item 450: one HOLLOWELL per view: while the lane's depot stands in the frame, its fascia names the
      // town on its plate, so the gate steps down (the board and the plate both read HOLLOWELL, and the depot and the
      // arch read as two gates).
      const depot = depots[lane];
      const fascia = !!depot && this.inFrame(depot);
      sign.updateMatrixWorld();
      // Plan item 691: a board cut by the frame's edge (an upright phone's l27 read 'HOLL' at the canvas foot, under
      // the tray's tab) steps down too, and the plate carries the town.
      sign.visible = !fascia && !((grow > 1 || this.openFrame) && sign.userData.inField) && this.wholeInFrame(sign);
      // The depot's count plate covers its fascia's lettering, so with the board down the plate names the town.
      if (!sign.visible) this.plateTown = sign.userData.town as string;
      // With the depot in frame the lane leaves from it: the gate's bare posts go too (alone they read as stray
      // dark sticks).
      parent.visible = !fascia;
      const bar = parent.userData.bar as THREE.Object3D | undefined;
      if (bar) bar.visible = sign.visible;
      sign.updateMatrixWorld();
    }
  }

  /** Plan item 691: each built tower's screen box (CSS px on the canvas), for the callouts to keep off. */
  towerRects(): Rect[] {
    const out: Rect[] = [];
    for (const [, v] of this.towers) {
      const lean = (v.obj.userData.lean as THREE.Object3D | undefined) ?? v.obj;
      out.push(this.boxRect(new THREE.Box3().setFromObject(lean), this.w, this.h));
    }
    return out;
  }

  /** Plan item 691 (tests): a callout rising from the i-th built tower's foot, as 'Bridge up!' does from a bridge
   * beside one. */
  testCallout(text: string, i = 0): boolean {
    const v = [...this.towers.values()][i];
    if (!v) return false;
    const p = v.obj.getWorldPosition(new THREE.Vector3());
    this.floaters.add(text, p.setY(p.y + 1.1), "#ffb3a8", 0.9);
    return true;
  }

  /** Plan item 691 (tests): the live callouts' boxes and the towers' boxes, CSS px on the canvas. */
  calloutCheck(): { callouts: Array<{ text: string; x: number; y: number; w: number; h: number }>; towers: Rect[]; marks: Array<Rect & { own: Rect | null }> } {
    // Plan item 748: and each tower's pooled '+N' as placed last frame.
    const marks = [...this.towerMarks.values()].flatMap((m) => (m.box && m.el && Number(m.el.style.opacity) > 0.2 ? [{ ...m.box, own: m.own ? { ...m.own } : null }] : []));
    return { callouts: this.floaters.boxes(), towers: this.towerRects(), marks };
  }

  /** Plan item 691: whether an object's projected box lies wholly inside the canvas (with a margin, CSS px). */
  private wholeInFrame(o: THREE.Object3D, margin = 6): boolean {
    const b = new THREE.Box3().setFromObject(o);
    if (b.isEmpty()) return true;
    for (let i = 0; i < 8; i++) {
      const v = this.v2.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).project(this.camera);
      const px = (v.x * 0.5 + 0.5) * this.w;
      const py = (-v.y * 0.5 + 0.5) * this.h;
      if (v.z > 1 || px < margin || px > this.w - margin || py < margin || py > this.h - margin) return false;
    }
    return true;
  }

  /** Plan item 450: whether an object (all its ancestors shown) has its centre inside the frame, off its very edge. */
  private inFrame(o: THREE.Object3D): boolean {
    for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
    o.updateMatrixWorld();
    const v = o.getWorldPosition(this.v2).project(this.camera);
    return Math.abs(v.x) < 0.94 && Math.abs(v.y) < 0.94 && v.z < 1;
  }

  /** A gate sign's letter cap height on screen, in CSS px. */
  private signCap(o: THREE.Object3D): number {
    const cap = (o.userData.gateSignCap as number | undefined) ?? 0;
    const a = o.localToWorld(this.v1.set(0, cap / 2, 0)).project(this.camera).y;
    const b = o.localToWorld(this.v1.set(0, -cap / 2, 0)).project(this.camera).y;
    return (Math.abs(a - b) / 2) * this.h;
  }

  /** Plan item 539 (tests): each lane vehicle's wheel count and distinct materials, and the crop shapes on the field. */
  lookStats(): { vehicles: Array<{ kind: string; wheels: number; mats: number }>; cropShapes: number } {
    const vehicles: Array<{ kind: string; wheels: number; mats: number }> = [];
    for (const v of this.enemies.values()) {
      const wheels = (v.obj.userData.wheels as THREE.Object3D[] | undefined) ?? ((v.obj.userData.inner as THREE.Object3D | undefined)?.userData.wheels as THREE.Object3D[] | undefined);
      if (!wheels) continue;
      const mats = new Set<THREE.Material>();
      v.obj.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) for (const x of Array.isArray(m.material) ? m.material : [m.material]) mats.add(x);
      });
      vehicles.push({ kind: String(v.obj.userData.kind ?? ""), wheels: wheels.length, mats: mats.size });
    }
    return { vehicles, cropShapes: this.crops?.shapesShown() ?? 0 };
  }

  /** Plan item 98: each gate sign's on-screen centre and letter cap height, in CSS px (tests hold it at 11 px). */
  /** Plan item 410 (tests): the roughness of each queued vehicle's and depot's main surface (its biggest unlit
   * mesh), and the median over the farm's scenery, so a spec can hold the corporations glossy against the farm. */
  materialLook(): { queue: number[]; kinds: string[]; depots: number[]; farm: number } {
    const size = new THREE.Vector3();
    const scl = new THREE.Vector3();
    // A lamp, logo or glow (three's emissiveIntensity defaults to 1, so a black emissive counts as unlit).
    const lit = (mat: THREE.MeshStandardMaterial) => !!mat.emissive && mat.emissive.getHex() !== 0 && (mat.emissiveIntensity ?? 0) > 0.5;
    const main = (root: THREE.Object3D): number => {
      let best = -1;
      let rough = 1;
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial | undefined;
        if (!m.isMesh || !mat || mat.roughness === undefined || mat.transparent || lit(mat)) return;
        m.geometry.computeBoundingBox();
        m.geometry.boundingBox!.getSize(size);
        m.getWorldScale(scl);
        const v = size.x * scl.x * size.y * scl.y + size.y * scl.y * size.z * scl.z + size.x * scl.x * size.z * scl.z;
        if (v > best) {
          best = v;
          rough = mat.roughness;
        }
      });
      return rough;
    };
    const depots = (this.ground?.group.userData.depots as THREE.Object3D[] | undefined) ?? [];
    const inDepot = new Set<THREE.Object3D>();
    for (const d of depots) d.traverse((o) => inDepot.add(o));
    const farm: number[] = [];
    this.ground?.group.traverse((o) => {
      const m = o as THREE.Mesh;
      const mat = m.isMesh ? ((Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial) : null;
      if (mat && mat.roughness !== undefined && !inDepot.has(o) && !lit(mat) && !mat.transparent) farm.push(mat.roughness);
    });
    farm.sort((a, b) => a - b);
    return { queue: this.queueModels.map((m) => main(m.obj)), kinds: this.queueModels.map((m) => String(m.obj.userData.kind)), depots: depots.map(main), farm: farm[Math.floor(farm.length / 2)] ?? 1 };
  }

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
    this.inFlight = 0;
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
          // Plan item 676: a muzzle puff in the tower's tint that hangs about its top for most of a second (the
          // sparks below last a quarter of one), so a still frame shows which towers are firing.
          // (from the model's top, cached on it: a windmill's puff at a scarecrow's height hid behind its tower)
          // (four fifths of the way up: a windmill's sail tips stand well above its cap)
          let top = fy + 0.15;
          if (tv) {
            if (tv.top === undefined && !tv.build) tv.top = this.qBox.setFromObject(tv.obj).max.y;
            const ground = fy - 0.7;
            if (tv.top !== undefined && Number.isFinite(tv.top)) top = ground + Math.min(2.4, Math.max(0.8, (tv.top - ground) * 0.8));
          }
          this.puffs.emit(e.fromX, top, e.fromY, fireTint(e.kind, spec), 4, 0.55, PUFF, this.reducedMotion ? 0 : 0.35, 0.18);
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
          this.lastDown = { x: e.x, z: e.y };
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
          this.lastDown = { x: e.x, z: e.y };
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
          this.heroCheer = 0;
          const y = this.height(e.x, e.y);
          this.fx.ring(e.x, y + 0.05, e.y, "#ffd76a", 1.2);
          this.floaters.add("Neighbours!", new THREE.Vector3(e.x, y + 1.1, e.y), "#fff6d6", 1.1);
          break;
        }
        case "rally":
          // Plan item 713: her cast: both arms up (her cheer) as the rings go out.
          this.heroCheer = 0;
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
      // Plan item 730: an instanced vehicle has no view of its own; its hit flash is kept by id.
      else this.rungHit.set(enemy, this.clock);
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
    const tint = fireTint(kind, spec);
    let lastTrail = -1;
    this.inFlight++;
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
        // Plan item 676: a soft trail along the arc that lingers after the shot lands, so a still reads who shoots what.
        if (k - lastTrail >= 0.08) {
          lastTrail = k;
          this.puffs.emit(p.x, p.y, p.z, tint, 1, trailSize * 1.6, 0.55, 0.05, 0);
        }
      }
      if (k >= 1) {
        this.inFlight = Math.max(0, this.inFlight - 1);
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
          // Plan item 468: Splash marks the ground it covers: a ripple ring where the water lands.
          if (this.splashRingOk()) this.fx.ring(to.x, to.y - 0.2, to.z, "#bfe9ff", 0.8, 0.4);
        } else if (kind === "beehive") {
          // The swarm settles over the lane in an amber ring.
          if (this.splashRingOk()) this.fx.ring(to.x, to.y - 0.2, to.z, "#f0b429", 0.8, 0.4);
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

  /** Plan item 468: Splash rings at most one every 120 ms in all (each is a draw call for its 0.4 s). */
  private lastSplashRing = 0;
  private splashRingOk(): boolean {
    const now = performance.now();
    if (now - this.lastSplashRing < 120) return false;
    this.lastSplashRing = now;
    return true;
  }

  /** A thorny tangle round a slowed vehicle's wheels at (x, y, z), swaying a touch (still under reduced motion). */
  private addBramble(x: number, y: number, z: number, heading: number, scale: number, id: number, t: number): void {
    const b = this.brambles;
    if (b.count + 2 > b.instanceMatrix.count) return;
    const sway = this.reducedMotion ? 0 : Math.sin(t * 2.2 + id) * 0.08;
    for (const side of [-1, 1]) {
      // Two half hoops lie round the wheels, one each side, tipped up a little so they catch the light: a tangle
      // on the lane the vehicle is stuck in, the same at any vehicle size or camera.
      this.brambleE.set(-Math.PI / 2 + 0.35 + sway, heading + (side > 0 ? 0 : Math.PI), 0, "YXZ");
      this.brambleQ.setFromEuler(this.brambleE);
      this.brambleS.set(scale * 1.2, scale * 0.85, scale * 2);
      this.brambleP.set(x, y + 0.04, z);
      this.brambleM.compose(this.brambleP, this.brambleQ, this.brambleS);
      b.setMatrixAt(b.count++, this.brambleM);
    }
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
    this.follow = false;
    const d = this.camBase.distanceTo(this.camTarget) / this.zoom;
    const perPx = (2 * d * Math.tan((this.camera.fov * Math.PI) / 360)) / Math.max(1, this.h);
    this.pan.x -= dx * perPx;
    this.pan.y -= dy * perPx * 1.3;
    this.clampPan();
  }

  resetView(): void {
    this.zoom = 1;
    this.follow = false;
    this.pan.set(this.homePanX, 0);
  }
  /** Plan item 486: on an upright phone the whole-field view leans sideways toward the first gate's depot, by no more
   *  than the verge beside the field (so every plot stays in frame), so its board and more of its shed show. */
  private homePanX = 0;

  /** Plan item 191: a double-tap pushes in on the plot under it (a second double-tap, resetView, comes back). */
  pushTo(clientX: number, clientY: number): void {
    const w = this.worldAt(clientX, clientY);
    this.follow = false;
    this.zoom = 2;
    this.pan.set(w.x - this.camTarget.x, w.y - this.camTarget.z);
    this.clampPan();
  }

  // ---- the director (plan item 191): a dolly from the depot along the lane on Go, and at most one close-up a
  // round (a megastructure's merge, or the house at a leak). Reduced motion and phones get no moves at all.
  private shot: { x: number; z: number; zoom: number; dur: number; t: number; dolly: boolean; hold?: boolean; started?: boolean } | null = null;
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
    // Plan item 613: a win settles the camera on the farmhouse she kept, and holds there while the result shows.
    if (game.phase === "won" && this.lastPhase !== "won" && this.directs && !this.zoomed && this.ground) {
      const house = this.ground.farmhouse.position;
      this.shot = { x: house.x, z: house.z, zoom: 1.3, dur: 1.4, t: 0, dolly: false, hold: true };
    } else if (game.phase !== "won" && this.shot?.hold) this.shot = null;
    this.lastPhase = game.phase;
    // (a shot starts at its opening frame: the send's own stall step, up to 1 s, would otherwise skip most of the
    // 1.5 s dolly before it was ever drawn; E2E red on 2e30b8ca, camera3d)
    if (this.shot && this.shot.started) {
      this.shot.t += dt;
      if (this.shot.t >= this.shot.dur && !this.shot.hold) this.shot = null;
    } else if (this.shot) this.shot.started = true;
  }
  /** Plan item 479: hold the camera on the last knockout for `ms` (wall clock): it leans in over about 0.2 s and
   *  eases back after. Any directed shot gives way to it. Not under reduced motion (main.ts doesn't call it then). */
  holdKnockout(ms: number): void {
    if (this.reducedMotion) return;
    const at = this.lastDown ?? { x: this.camTarget.x, z: this.camTarget.z };
    this.koAt = { x: at.x, z: at.z };
    this.koUntil = performance.now() + ms;
    this.shot = null;
  }
  /** Plan item 676, for the staged battle shots: projectiles in the air, towers still showing their muzzle puff, and
   *  puffs (muzzle and trail) alive. */
  fxCounts(): { shots: number; parts: number; cues: number; trails: number } {
    const cues = [...this.towers.values()].filter((v) => v.fired < PUFF).length;
    return { shots: this.inFlight, parts: this.puffs.live, cues, trails: this.puffs.live };
  }

  /** Tests: how far the camera leans into the held knockout (0 to 1), and where. */
  knockoutView(): { ease: number; held: boolean; until: number; x: number; z: number } {
    return { ease: this.koEase, held: performance.now() < this.koUntil, until: this.koUntil, x: this.koAt.x, z: this.koAt.z };
  }
  /** A close-up on (x, z), at most one a round and never over a move already running. */
  private closeUp(game: Game, x: number, z: number): void {
    if (!this.directs || this.shot || this.zoomed || this.shotRound === game.wave || performance.now() < this.koUntil) return;
    this.shotRound = game.wave;
    this.shot = { x, z, zoom: 1.5, dur: 1.6, t: 0, dolly: false };
  }
  /** How far the director has the camera away from the play view (0 = the play view). */
  private shotWeight(): number {
    const s = this.shot;
    if (!s) return 0;
    const k = Math.min(1, s.t / s.dur);
    if (s.hold) return k * k * (3 - 2 * k);
    if (s.dolly) return 1 - k * k * (3 - 2 * k);
    return s.t < 0.3 ? s.t / 0.3 : s.t > s.dur - 0.6 ? Math.max(0, (s.dur - s.t) / 0.6) : 1;
  }
  /** Plan item 486 (tests): a cell's centre on the canvas (CSS px from its corner) at the current view. */
  noCloudShadows(): void {
    setCloudShadows(0);
  }
  cellToCanvas(col: number, row: number): { x: number; y: number } {
    const v = new THREE.Vector3(col + 0.5, this.height(col + 0.5, row + 0.5), row + 0.5).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * this.canvas.clientWidth, y: (-v.y * 0.5 + 0.5) * this.canvas.clientHeight };
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
    this.pan.x = Math.max(Math.min(-mx, this.homePanX), Math.min(Math.max(mx, this.homePanX), this.pan.x));
    this.pan.y = Math.max(-mz, Math.min(mz, this.pan.y));
  }

  // ---- drawing ----

  draw(game: Game, dt: number): void {
    if (game.level.id !== this.levelId) this.resize(game);
    this.syncDay(game);
    this.clock += dt;
    const t = this.clock;
    this.syncTowers(game, dt, t);
    this.syncEnemies(game, dt, t);
    if (this.rungHit.size > 256) for (const [id, at] of this.rungHit) if (t - at > RUNG_FLASH) this.rungHit.delete(id);
    this.syncHero(game, dt, t);
    this.shownFolk = this.farm.step(game, dt, this.reducedMotion);
    this.folkMeshes.update(this.shownFolk, (x, z) => this.height(x, z), t);
    this.syncSelection(game, t);
    this.syncBoss(game);
    this.syncSwarms(game);
    this.syncTowerMarks(game, dt);
    this.placeDepots(game);
    // Plan item 710: once the depots stand where placeDepots put them (it waits for the camera to settle; fitting
    // before that measured the depot at its first spot, and level 27's at D then stood 36 px off the canvas).
    if (this.openFramePending && this.depotKey === `${game.level.id}:${this.canvas.clientWidth}x${this.canvas.clientHeight}`) this.fitOpenFrame();
    this.settleFar(game);
    this.syncDepotShutters(game, dt);
    this.syncQueue(game);
    if (game.phase !== "wave" && this.debrisLying) {
      this.debris.clearStaying();
      this.debrisLying = false;
    }
    this.syncSetPieces(game, t);
    this.syncPiles(game);
    this.door?.update(this.doorstep, dt, this.steepTilt() * 1.2);
    this.syncOaks(game);
    if (!this.reducedMotion) for (const sails of this.landmarkSails) sails.rotation.z -= dt * 0.9;
    // Plan item 469: on a steep lens (an upright phone) the farmhouse leans back towards it a little, as towers and
    // vans do, so it shows its walls, door and lit window, not a red roof slab from straight above.
    if (this.ground) {
      const fh = this.ground.farmhouse;
      const yaw = (fh.userData.yaw as number | undefined) ?? (fh.userData.yaw = fh.rotation.y);
      fh.rotation.set(-this.steepTilt() * 0.75, yaw, 0, "XYZ");
      if (!fh.userData.shadowUpright) {
        fh.userData.shadowUpright = true;
        const q = new THREE.Quaternion();
        const up = new THREE.Vector3(0, 1, 0);
        shadowUpright(fh, (m) => m.compose(fh.position, q.setFromAxisAngle(up, yaw), fh.scale));
      }
    }
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
    this.puffs.update(dt);
    this.debris.update(dt);
    this.fx.update(dt);
    // Camera: zoom towards the target, offset by the pan; then shake.
    const look = this.v3.copy(this.camTarget).add(this.v2.set(this.pan.x, 0, this.pan.y));
    // (Plan item 191: under reduced motion these cut rather than ease.)
    // The camera's looks run on wall-clock seconds, not the game's capped frame step: at a few frames a second
    // (a slow device, headless WebGL) a 2.6 s gate look otherwise lasted a minute. Paused (dt 0), they hold.
    const wall = performance.now();
    const camDt = dt > 0 ? Math.min(1, Math.max(dt, (wall - this.camWall) / 1000)) : 0;
    this.camWall = wall;
    const ease = (k: number) => (this.reducedMotion ? 1 : Math.min(1, camDt * k));
    this.followLead(game, camDt);
    this.bossEase += (this.bossPush - this.bossEase) * ease(1.2);
    // Plan item 72: a boss round's queue draws the eye to the gate for a few seconds, then lets it go.
    this.gateHold = Math.max(0, this.gateHold - camDt);
    this.gateEase += ((this.gateHold > 0 ? 1 : 0) - this.gateEase) * ease(1.6);
    if (this.gateEase > 0.001) look.lerp(this.v2.set(this.gateAt.x, this.camTarget.y, this.gateAt.y), this.gateEase * 0.38);
    // Plan item 651: the director's moves run on the same wall clock (at a few fps the 1.5 s depot dolly held for 20 s).
    // (A 0.25 s cap per frame, tried for camera3d, held the dolly 5 s+ at CI's frame rate: closeframe red on 04a93c01;
    // a shot now holds its opening frame instead, below.)
    this.direct(game, camDt);
    const sw = this.shotWeight();
    if (sw > 0 && this.shot) look.lerp(this.v2.set(this.shot.x, this.camTarget.y, this.shot.z), sw * (this.shot.dolly ? 0.85 : 0.6));
    const shotZoom = this.shot ? 1 + (this.shot.zoom - 1) * sw : 1;
    const koOn = wall < this.koUntil;
    this.koEase += ((koOn ? 1 : 0) - this.koEase) * ease(koOn ? 9 : 2.5);
    if (this.koEase < 0.002) this.koEase = 0;
    if (this.koEase > 0) look.lerp(this.v2.set(this.koAt.x, this.camTarget.y, this.koAt.z), this.koEase * 0.55);
    const koZoom = 1 + this.koEase * 0.32;
    this.camera.position.copy(this.camBase).sub(this.camTarget).multiplyScalar(1 / (this.zoom * shotZoom * koZoom * (1 + this.bossEase * 0.07 + this.gateEase * 0.14))).add(look);
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
          // Plan item 469: everything but the plinth stands in a lean group, so on a steep lens (an upright phone)
          // the tower leans back towards it like item 439's vehicles: its front turns up to the eye instead of
          // reading as a hat seen from above on a pale disc. The plinth stays flat on the plot.
          const lean = new THREE.Group();
          lean.name = "lean";
          for (const c of obj.children.filter((o) => o.name !== "plinth")) lean.add(c);
          obj.add(lean);
          obj.userData.lean = lean;
          // Plan item 515: the tower's body stands up as the field's landmark (the plinth stays on its plot)
          lean.scale.setScalar(TOWER_STAND[tw.kind] ?? 1);
          lean.scale.y *= TOWER_RISE[tw.kind] ?? 1;
          shadowUpright(lean, (m) => m.identity());
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
    const lean = ud.lean as THREE.Object3D | undefined;
    if (lean) lean.rotation.x = -this.steepTilt();
    // Plan item 515: the scarecrow sways in the breeze on its pole (off under reduced motion)
    if (lean && tw.kind === "scarecrow") lean.rotation.z = this.reducedMotion ? 0 : Math.sin(t * 1.3 + tw.id) * 0.045;
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
    const items = ((obj.userData.lean as THREE.Group | undefined)?.children ?? obj.children)
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
    this.brambles.count = 0;
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
    // Plan item 657: spaced by each model's own length plus a sliver of road, so every vehicle keeps its silhouette.
    const rungs = fleet ? this.rungs : null;
    const lay = (this.lay = layOutField(
      game.enemies,
      (k) => {
        const l = rungs?.drawnLength(k as Enemy["kind"]);
        return l === undefined ? SLOT_LEN * enemyScale(k as Enemy["kind"]) : l * GAP_3D;
      },
    ));
    // Plan item 439: on a steep view (an upright phone) the vehicles lean back from the lens like item 98's Cath,
    // so their near side, cab and wheels turn up to it instead of reading as roofs (stacked boxes).
    const tilt = this.steepTilt();
    if (this.rungs) this.rungs.tilt = tilt;
    this.jamDrawn.clear();
    for (const e of game.enemies) {
      const at = placeOnLane(game.level, e, lay);
      // Plan item 657: in 3D a column shows JAM_3D on the road (item 684: its head alone, in the file), not a tower
      // eight vehicles high (a stack of lorries, the quads a pile of discs); the rest wait in it unseen, counted on
      // the swarm badge or the column's own '+N' plate (syncSwarms).
      const ci = lay.inColumn.get(e.id);
      // Plan item 684: and a column whose head would stand behind the gate shows none (its count waits at the depot).
      const hidden = ci !== undefined && (ci >= JAM_3D || lay.columnOf.get(e.id)?.at === undefined);
      if (ci !== undefined && !hidden) {
        const col = lay.columnOf.get(e.id);
        if (col) this.jamDrawn.set(col, (this.jamDrawn.get(col) ?? 0) + 1);
      }
      // Plan item 657: two abreast, each file stands half the model's width off the lane's middle (ABREAST, 0.2 cells,
      // overlapped the quads' rotor spans into one pile of discs), within the road's edge.
      const sl = lay.slots.get(e.id);
      const wd = sl?.side ? rungs?.drawnWidth(e.kind) : undefined;
      if (sl?.side && wd !== undefined && wd / 2 > ABREAST) {
        const ln = e.lane ? { lane: e.lane } : {};
        const q = enemyPoint(game.level, { dist: sl.dist, ...ln });
        const r = enemyPoint(game.level, { dist: sl.dist + 0.05, ...ln });
        const l = Math.hypot(r.x - q.x, r.y - q.y) || 1;
        const off = Math.min(ROAD_HALF, (wd / 2) * 1.04) * sl.side;
        at.x = q.x - ((r.y - q.y) / l) * off;
        at.y = q.y + ((r.x - q.x) / l) * off;
      }
      const tierUp = 0;
      if (fleet && this.rungs?.has(e.kind)) {
        if (hidden) continue;
        // Instanced: heading from the lane's direction, a little bob, no per-vehicle objects.
        const p = at;
        // Plan item 657: along the run it is drawn on (from its true place, one held back round a bend sat askew).
        const dd = lay.slots.get(e.id)?.dist ?? lay.columnOf.get(e.id)?.dist ?? e.dist;
        const here = enemyPoint(game.level, { dist: dd, lane: e.lane });
        const ahead = enemyPoint(game.level, { dist: dd + 0.08, lane: e.lane });
        const heading = Math.atan2(-(ahead.y - here.y), ahead.x - here.x);
        const moving = !(e.stun > 0 || e.held);
        const bob = moving ? Math.abs(Math.sin(t * 9 + e.id)) * 0.012 + (enemyLift(e.kind) ? Math.sin(t * 3 + e.id) * 0.04 : 0) : 0;
        const ghost = !isRevealed(game, e);
        // Unrevealed stealth is drawn see-through in hedge-camo, never blinked out (its icons stay over it).
        const hitAgo = t - (this.rungHit.get(e.id) ?? -9);
        this.rungs.add(e.kind, p.x, this.height(p.x, p.y) + tierUp, p.y, heading, bob, ghost, e.pm, liveryOf(Math.ceil(game.level.id / 10), e.id), hitAgo < RUNG_FLASH ? 1 - hitAgo / RUNG_FLASH : 0);
        // Its property icons (section 2): a row of roundels over the vehicle.
        if (e.pm) this.rungs.addIcons(e.pm, p.x, this.height(p.x, p.y) + enemyLift(e.kind) + 0.95 * enemyScale(e.kind), p.y);
        if (e.stun > 0 && Math.random() < dt * 6) this.sparks.emit(p.x, this.height(p.x, p.y) + 0.6, p.y, "#fff6b0", 1, 0.8, 0.1, 0.4, 0);
        if (e.slowed && Math.random() < dt * 2) this.sparks.emit(p.x, this.height(p.x, p.y) + 0.05, p.y, "#7fd06a", 1, 0.5, 0.09, 0.5, 0.5);
        if (e.slowed && e.stun <= 0) this.addBramble(p.x, this.height(p.x, p.y) + tierUp, p.y, heading, enemyScale(e.kind), e.id, t);
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
        // Item 439's lean back to a steep lens is for the eye: the van's shadow is cast as it stands on its wheels.
        const yq = new THREE.Quaternion();
        const ye = new THREE.Euler();
        shadowUpright(obj, (m) => m.compose(obj.position, yq.setFromEuler(ye.set(0, obj.rotation.y, 0)), obj.scale));
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
      // Yaw first, then item 439's lean about the world's x axis (Euler XYZ applies x last).
      v.obj.rotation.set(-tilt, v.heading, 0, "XYZ");
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
      v.obj.visible = !hidden && (!ghost || Math.sin(t * 25 + e.id) > 0.75);
      // Status effects as particles.
      const top = gy + lift + 0.62 * enemyScale(e.kind);
      if (e.stun > 0 && Math.random() < dt * 10) this.sparks.emit(p.x, top + 0.1, p.y, "#fff6b0", 1, 0.8, 0.1, 0.4, 0);
      if (e.slowed && Math.random() < dt * 4) this.sparks.emit(p.x, gy + 0.05, p.y, "#7fd06a", 1, 0.5, 0.09, 0.5, 0.5);
      if (e.slowed && e.stun <= 0 && !lift) this.addBramble(p.x, gy, p.y, v.heading, enemyScale(e.kind), e.id, t);
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
      if (fleet && e.pm && !hidden) this.rungs?.addIcons(e.pm, p.x, top + 0.34, p.y);
      v.bar.visible = frac < 1 && !ghost && !hidden && !isBig(e.kind);
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
    this.brambles.instanceMatrix.needsUpdate = true;
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

  /** Plan item 492: on the Fleet her run level is an inked rosette at her feet (one sprite, kept in the scene, not the
   *  world the levels rebuild); a level-up stamps it down from 1.7x over 0.25 s (the number alone under reduced motion). */
  private rosette: THREE.Sprite | null = null;
  private rosetteLv = 0;
  private levelBeat = 9;
  levelUp(): void {
    this.levelBeat = 0;
  }
  /** Tests: the rosette's level and whether it shows. */
  rosette3d(): { level: number; visible: boolean } {
    return { level: this.rosetteLv, visible: !!this.rosette?.visible };
  }
  private syncRosette(game: Game, show: boolean, x: number, y: number, z: number, dt: number): void {
    this.levelBeat += dt;
    if (!show || game.level.rules !== "fleet") {
      if (this.rosette) this.rosette.visible = false;
      return;
    }
    if (!this.rosette) {
      const cv = document.createElement("canvas");
      cv.width = cv.height = 128;
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      this.rosette = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, fog: false }));
      this.rosette.renderOrder = 5;
      this.scene.add(this.rosette);
      this.rosetteLv = 0;
    }
    const lv = game.hero.level;
    if (this.rosetteLv !== lv) {
      const mat = this.rosette.material;
      const cv = (mat.map as THREE.CanvasTexture).image as HTMLCanvasElement;
      const g2 = cv.getContext("2d")!;
      g2.clearRect(0, 0, 128, 128);
      g2.beginPath();
      for (let i = 0; i <= 20; i++) {
        const a = (i / 20) * Math.PI * 2;
        const r = 54 * (i % 2 ? 0.86 : 1);
        if (i === 0) g2.moveTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
        else g2.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
      }
      g2.closePath();
      g2.fillStyle = "#e7c36a";
      g2.fill();
      g2.lineWidth = 8;
      g2.strokeStyle = "#3a2716";
      g2.stroke();
      g2.fillStyle = "#3a2716";
      g2.font = "800 60px system-ui, sans-serif";
      g2.textAlign = "center";
      g2.textBaseline = "middle";
      g2.fillText(String(lv), 64, 68);
      (mat.map as THREE.CanvasTexture).needsUpdate = true;
      this.rosetteLv = lv;
    }
    const k = this.levelBeat < 0.25 && !this.reducedMotion ? 1.7 - (this.levelBeat / 0.25) * 0.7 : 1;
    const size = 0.27 * (this.canvas.clientWidth < 600 ? 1.3 : 1) * k;
    this.rosette.scale.set(size, size, 1);
    this.rosette.position.set(x + 0.2, y + 0.11, z + 0.14);
    this.rosette.visible = true;
  }
  /** Plan item 492: her footprints in 3D as she walks the field: one instanced mesh of small dark ovals (one draw
   *  call, kept in the scene), left and right about every 0.16 of a cell, each shrinking away over 1 s; none under
   *  reduced motion. */
  private prints3: { x: number; z: number; a: number; ang: number }[] = [];
  private printFrom3: { x: number; z: number } | null = null;
  private printLeft3 = false;
  private printMesh: THREE.InstancedMesh | null = null;
  footprints3d(): number {
    return this.prints3.length;
  }
  private syncPrints(h: Game["hero"], walking: boolean, dt: number): void {
    if (walking && !this.reducedMotion) {
      if (!this.printFrom3 || Math.hypot(h.x - this.printFrom3.x, h.y - this.printFrom3.z) > 0.16) {
        const ang = Math.atan2(h.ty - h.y, h.tx - h.x);
        this.printLeft3 = !this.printLeft3;
        const off = (this.printLeft3 ? 1 : -1) * 0.05;
        this.prints3.push({ x: h.x - Math.sin(ang) * off, z: h.y + Math.cos(ang) * off, a: 0, ang });
        if (this.prints3.length > 24) this.prints3.shift();
        this.printFrom3 = { x: h.x, z: h.y };
      }
    } else if (!walking) this.printFrom3 = null;
    for (const fp of this.prints3) fp.a += dt;
    this.prints3 = this.prints3.filter((fp) => fp.a < 1);
    if (!this.printMesh) {
      const geo = new THREE.CircleGeometry(1, 10).scale(0.06, 0.028, 1).rotateX(-Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({ color: "#2e1f12", transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
      this.printMesh = new THREE.InstancedMesh(geo, mat, 24);
      this.printMesh.frustumCulled = false;
      this.printMesh.renderOrder = 2;
      this.scene.add(this.printMesh);
    }
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    this.prints3.forEach((fp, i) => {
      const k = 1 - fp.a * fp.a;
      m.compose(new THREE.Vector3(fp.x, this.height(fp.x, fp.z) + 0.036, fp.z), q.setFromAxisAngle(up, -fp.ang), new THREE.Vector3(k, 1, k));
      this.printMesh!.setMatrixAt(i, m);
    });
    this.printMesh.count = this.prints3.length;
    this.printMesh.visible = this.prints3.length > 0;
    this.printMesh.instanceMatrix.needsUpdate = true;
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
    const h = game.hero;
    const y = this.height(h.x, h.y);
    this.syncRosette(game, c.visible, h.x, y, h.y, dt);
    if (!c.visible) return;
    c.position.set(h.x, y, h.y);
    // Plan item 78 made her twice her old size; item 346 brings her back to the farm's one scale. Plan item 459: on a
    // phone's small canvas she stands a quarter larger (about 1.5x a farmer there), as the gate's sign grows on it:
    // at the farm's one scale her whole figure read 48 px tall at 390x844, a smudge by the lane.
    c.scale.setScalar(CATH_3D_SCALE * (this.canvas.clientWidth < 600 ? CATH_PHONE_GROW : 1));
    // Plan item 98: a phone's camera looks down so steeply that she read as the crown of her head (a dark blob).
    // On a steep view she leans back a little, like a paper doll on a board, so her face and coat turn up to it.
    const elev = Math.atan2(this.camera.position.y - y, Math.hypot(this.camera.position.x - h.x, this.camera.position.z - h.y));
    c.rotation.x = -Math.min(0.55, Math.max(0, (elev - CATH_LEAN_FROM) * 1.1));
    const walking = Math.hypot(h.tx - h.x, h.ty - h.y) > 0.03 && h.down === 0;
    this.syncPrints(h, walking, dt);
    // Plan item 255: standing, she turns to face the camera (her figure is drawn for a lens on +z; an upright phone's
    // looks from her side, 44-120 deg off her face); walking she faces her path. The lean back stays toward the lens.
    {
      const cam = this.camera.getWorldPosition(this.v2);
      const az = Math.atan2(cam.x - h.x, cam.z - h.y);
      // (her face is set three-quarters, 30 deg toward her facing side of the lens, so that much less)
      const want = walking || h.down > 0 ? 0 : Math.max(-2.2, Math.min(2.2, az - h.facing * 0.52));
      this.rootYaw += (want - this.rootYaw) * Math.min(1, this.reducedMotion ? 1 : dt * 4);
      c.rotation.order = "YXZ";
      c.rotation.y = this.rootYaw;
    }
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
    this.heroPoint += dt;
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
    (ud.arm2 as THREE.Object3D).rotation.set(0.08 + this.heroReach, 0, sh2 + (still ? Math.sin(t * 1.4) * 0.12 : 0));
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
      head.position.set(-Math.sin(lean) * CATH_HEAD_Y * h.facing, CATH_HEAD_Y * Math.cos(lean) + bob, 0);
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
    // Plan item 208: a fresh hint: her free arm rises out over the field, the hand open, for about two seconds.
    const pointAge = this.heroPoint;
    const point = cheer > 0 || worry > 0 || plant > 0 ? 0 : pointAge < 0.25 ? ease(pointAge / 0.25) : pointAge < 1.9 ? 1 : pointAge < 2.3 ? 1 - ease((pointAge - 1.9) / 0.4) : 0;
    // Plan item 310: the free arm is her far one, so it reaches out level toward her facing side and swings toward the
    // lens (heroReach), clear of her body; raised back and up (-2.05) it hid behind her hair.
    if (point > 0) pose = mix(pose, [pose[0], pose[1], pose[2], HERO_POINT_ARM, 0.1, -0.04, 0], point);
    // Plan item 310: between rounds her free hand talks. Every few seconds she points out over the field again while
    // her line advises a plot (its ring glows); with nothing to advise she gives a little wave. Never mid-round, mid-swing,
    // mid-throw, on the move or under reduced motion.
    let gesture = 0;
    let waving = false;
    // On the render clock (frame dt can be clamped or step back on a slow device).
    const idleAt = (((t % HERO_IDLE_CYCLE) + HERO_IDLE_CYCLE) % HERO_IDLE_CYCLE) - (HERO_IDLE_CYCLE - HERO_IDLE_GESTURE);
    if (game.phase === "build" && !walking && !this.reducedMotion && cheer + worry + plant + point === 0 && s >= 0.45 && this.heroPie >= 0.5 && idleAt >= 0) {
      gesture = idleAt < 0.3 ? ease(idleAt / 0.3) : idleAt < HERO_IDLE_GESTURE - 0.4 ? 1 : 1 - ease((idleAt - (HERO_IDLE_GESTURE - 0.4)) / 0.4);
      if (this.coach) {
        // Item 208's hint point, the hand beating gently. Turning her toward the plot was tried: the pointing arm is
        // on her far side, so toward a plot near the lens it hid behind her.
        pose = mix(pose, [pose[0], pose[1], pose[2], HERO_POINT_ARM + Math.sin(t * 5) * 0.08, 0.1, -0.04, 0], gesture);
      } else {
        waving = true;
        pose = mix(pose, [pose[0], pose[1], pose[2], HERO_WAVE_ARM, -1.4 + Math.sin(t * 9) * 0.35, 0, 0], gesture);
      }
    }
    const idle = gesture > 0.5 ? (waving ? "wave" : "point") : null;
    this.heroReach = this.heroPie < 0.5 ? 0 : HERO_REACH_X * Math.max(point, gesture);
    this.heroMood = cheer > 0.5 ? "cheer" : worry > 0.5 ? "worried" : plant > 0.5 ? "plant" : point > 0.5 ? "point" : (idle ?? "rest");
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
    // Plan item 297: with nothing picked, the plot her line means glows, the advised tower standing there as a ghost.
    const coach = !this.selected && game.phase === "build" ? this.coach : null;
    this.coachRing.visible = !!coach;
    if (coach) {
      const pulse = this.reducedMotion ? 0.5 : (Math.sin(t * 4) + 1) / 2;
      this.coachRing.position.set(coach.col + 0.5, this.height(coach.col + 0.5, coach.row + 0.5) + 0.05, coach.row + 0.5);
      const since = (performance.now() - this.coachPulseAt) / 1000;
      const flare = since >= 0 && since < 0.9 ? Math.sin((since / 0.9) * Math.PI) : 0;
      this.coachRing.scale.setScalar(1 + pulse * 0.06 + flare * 0.45);
      (this.coachRing.material as THREE.MeshBasicMaterial).opacity = 0.7 + pulse * 0.3;
      ghostKind = coach.kind;
      at = coach;
    }
    this.rangeRing.visible = range > 0 && !!at && !coach;
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
        // Plan item 603: one soft cream silhouette, not each part at half opacity (the tower's inner faces showed
        // through each other and its red roof read as a glitch over the farmhouse at D l21): a depth-only pass of the
        // tower first, then the tint over its front faces alone.
        const g = new THREE.Group();
        const depth = buildTower(ghostKind, 1, null);
        const tint = buildTower(ghostKind, 1, null);
        depth.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) {
            m.material = this.ghostDepth;
            m.castShadow = false;
            m.renderOrder = 1;
          }
        });
        tint.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) {
            m.material = this.ghostTint;
            m.castShadow = false;
            m.renderOrder = 2;
          }
        });
        g.add(depth, tint);
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
        // Plan item 429: the ford's water is one ribbon along the lane whose two banks wander (a row of 0.98-wide
        // rectangles drew the lane's straight edges, four cells long, as a box).
        const ribbon: number[] = [];
        const ridx: number[] = [];
        for (let d = f.from - 0.1, k = 0; d <= f.to + 0.1 + 1e-6; d += 0.06, k++) {
          const q = enemyPoint(game.level, { dist: d });
          const a = enemyPoint(game.level, { dist: d + 0.05 });
          const ang = Math.atan2(a.y - q.y, a.x - q.x);
          const nx = -Math.sin(ang);
          const nz = Math.cos(ang);
          const wl = 0.47 + 0.05 * Math.sin(d * 4.1 + 0.7) + 0.025 * Math.sin(d * 9.3);
          const wr = 0.47 + 0.05 * Math.sin(d * 3.3 + 2.1) + 0.025 * Math.sin(d * 8.1 + 1.3);
          const y = this.height(q.x, q.y) + 0.04;
          ribbon.push(q.x + nx * wl, y, q.y + nz * wl, q.x - nx * wr, y, q.y - nz * wr);
          if (k > 0) {
            const b = (k - 1) * 2;
            ridx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
          }
        }
        // Plan item 432: the pale shallows follow the same wandering banks (the old straight rim planes read as boxes):
        // a ribbon 0.07 wider each side, just under the water.
        const fringe: number[] = [];
        for (let k = 0; k < ribbon.length; k += 6) {
          const lx = ribbon[k]!, lz = ribbon[k + 2]!, rx = ribbon[k + 3]!, rz = ribbon[k + 5]!;
          const mx = (lx + rx) / 2, mz = (lz + rz) / 2;
          const hw = Math.hypot(lx - mx, lz - mz) || 1;
          const hr = Math.hypot(rx - mx, rz - mz) || 1;
          const y = ribbon[k + 1]! - 0.006;
          fringe.push(mx + ((lx - mx) * (hw + 0.07)) / hw, y, mz + ((lz - mz) * (hw + 0.07)) / hw, mx + ((rx - mx) * (hr + 0.07)) / hr, y, mz + ((rz - mz) * (hr + 0.07)) / hr);
        }
        const fgeo = new THREE.BufferGeometry();
        fgeo.setAttribute("position", new THREE.Float32BufferAttribute(fringe, 3));
        fgeo.setAttribute("normal", new THREE.Float32BufferAttribute(fringe.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
        fgeo.setIndex(ridx);
        const shallows = new THREE.Mesh(fgeo, new THREE.MeshStandardMaterial({ color: "#a9d2c8", roughness: 0.4, transparent: true, opacity: 0.75, depthWrite: false }));
        shallows.renderOrder = 1;
        const rgeo = new THREE.BufferGeometry();
        rgeo.setAttribute("position", new THREE.Float32BufferAttribute(ribbon, 3));
        rgeo.setAttribute("uv", new THREE.Float32BufferAttribute(ribbon.flatMap((_, i) => (i % 3 === 0 ? [ribbon[i]!, ribbon[i + 2]!] : [])), 2));
        rgeo.setIndex(ridx);
        // Flat water: every normal up (at a bend the inner edge folds over itself, and computed normals there flip and
        // draw dark wedges).
        rgeo.setAttribute("normal", new THREE.Float32BufferAttribute(ribbon.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
        const water = new THREE.Mesh(
          rgeo,
          new THREE.MeshStandardMaterial({ color: "#2f6f86", roughness: 0.28, metalness: 0.1, normalMap: waterNormalTexture(), normalScale: new THREE.Vector2(0.4, 0.4) }), // plan item 330: the ponds' deeper water, rippled
        );
        const stones = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.06, 0), new THREE.MeshStandardMaterial({ color: "#8d8a80", roughness: 0.9, flatShading: true }), steps.length * 2);
        /** Is (x, z) on another step's water? (On a bend the steps overlap.) */
        const inOtherStep = (x: number, z: number, i: number): boolean =>
          steps.some((o, j) => {
            if (j === i) return false;
            const dx = x - o.x;
            const dz = z - o.y;
            return Math.abs(dx * Math.cos(o.a) + dz * Math.sin(o.a)) < 0.24 && Math.abs(-dx * Math.sin(o.a) + dz * Math.cos(o.a)) < 0.46;
          });
        const m4 = new THREE.Matrix4();
        const q4 = new THREE.Quaternion();
        const up = new THREE.Vector3(0, 1, 0);
        const sc = new THREE.Vector3(1, 1, 1);
        const v = new THREE.Vector3();
        steps.forEach((st, i) => {
          q4.setFromAxisAngle(up, -st.a);
          for (const side of [-1, 1]) {
            const ox = -Math.sin(st.a) * 0.47 * side;
            const oz = Math.cos(st.a) * 0.47 * side;
            const s2 = 0.8 + ((i * 7 + side * 3) % 5) * 0.1;
            // Plan item 330: on a bend a step's edge stone lands inside the next steps' water, where the stones read as
            // grey lumps scattered on the pond (critique, P); such a stone is left out.
            const sx = st.x + ox;
            const sz = st.y + oz;
            if (inOtherStep(sx, sz, i)) {
              stones.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), m4.makeScale(0, 0, 0));
              continue;
            }
            stones.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), m4.compose(v.set(st.x + ox, this.height(st.x + ox, st.y + oz) + 0.03, st.y + oz), q4, sc.set(s2, 0.6 * s2, s2)));
            sc.set(1, 1, 1);
          }
        });
        // Plan item 262: pale shallows fading in from both banks of the ford (it was a hard blue band), as round the ponds.
        const SW = 0.3;
        const rim = new THREE.InstancedMesh(
          new THREE.PlaneGeometry(0.3, SW).rotateX(-Math.PI / 2),
          new THREE.MeshStandardMaterial({ map: shoreFoam(), alphaMap: shoreFade(), transparent: true, opacity: 0.75, roughness: 0.5, depthWrite: false }),
          steps.length * 2,
        );
        const flip = new THREE.Quaternion().setFromAxisAngle(up, Math.PI);
        // Plan item 296: no rim on a bend's steps (turning with the lane, they stacked into pale squares at the joins).
        const bend = (i: number) => [i - 1, i + 1].some((j) => steps[j] && Math.abs(Math.atan2(Math.sin(steps[j]!.a - steps[i]!.a), Math.cos(steps[j]!.a - steps[i]!.a))) > 0.15);
        steps.forEach((st, i) => {
          q4.setFromAxisAngle(up, -st.a);
          for (const side of [-1, 1]) {
            if (bend(i)) {
              rim.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), m4.makeScale(0, 0, 0));
              continue;
            }
            const off = (0.49 - SW / 2) * side;
            const x = st.x - Math.sin(st.a) * off;
            const z = st.y + Math.cos(st.a) * off;
            // Plan item 330: a rim lying on a neighbouring step's water drew a hard pale rectangle in the pond.
            if (inOtherStep(x, z, i)) {
              rim.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), m4.makeScale(0, 0, 0));
              continue;
            }
            const q = side < 0 ? q4 : q4.clone().multiply(flip);
            rim.setMatrixAt(i * 2 + (side > 0 ? 1 : 0), m4.compose(v.set(x, this.height(st.x, st.y) + 0.044, z), q, sc.set(1, 1, 1)));
          }
        });
        rim.renderOrder = 3;
        water.renderOrder = 2;
        stones.castShadow = true;
        void rim;
        grp.add(shallows, water, stones);
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
        const b = buildBarn(c * 7 + r * 13 + game.level.id);
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
        // Plan item 346: one rounded sheet over the flooded cells (its extent exact, so the drowned plots read), over a
        // rounded margin of wet earth, not a square per cell with pale bands at each edge.
        const wetSet = new Set(flood.cells.map(([c, r]) => `${c},${r}`));
        // Level with the highest ground under the flood, so no grass pokes through the sheet.
        let y = -Infinity;
        for (const [c, r] of flood.cells) y = Math.max(y, this.height(c + 0.5, r + 0.5), this.height(c + 0.1, r + 0.1), this.height(c + 0.9, r + 0.9), this.height(c + 0.1, r + 0.9), this.height(c + 0.9, r + 0.1));
        const water = new THREE.Mesh(
          new THREE.ShapeGeometry(regionShapes(wetSet, 0.005, 0.28), 4).rotateX(-Math.PI / 2),
          new THREE.MeshStandardMaterial({ color: "#2f6f86", roughness: 0.12, metalness: 0.15, transparent: true, opacity: 0.9, depthWrite: false, normalMap: waterNormalTexture(), normalScale: new THREE.Vector2(0.35, 0.35) }), // plan item 330: the ponds' deeper water
        );
        const mud = new THREE.Mesh(
          new THREE.ShapeGeometry(regionShapes(wetSet, 0.09, 0.36), 4).rotateX(-Math.PI / 2),
          new THREE.MeshStandardMaterial({ color: "#4a3a26", roughness: 0.9, transparent: true, opacity: 0.55, depthWrite: false }),
        );
        water.position.y = y + 0.03;
        mud.position.y = y + 0.015;
        water.renderOrder = 2;
        mud.renderOrder = 1;
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
    const ridden = new Set<ConvoyColumn>();
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
      const col: ConvoyColumn | undefined = columnNear(this.lay, sw.lane, sw.dist);
      const p = enemyPoint(game.level, col ? { dist: col.dist, ...(col.lane ? { lane: col.lane } : {}) } : sw);
      if (col) ridden.add(col);
      const up = 1.1;
      const v = new THREE.Vector3(p.x, this.height(p.x, p.y) + up, p.y).project(this.camera);
      slot.el.hidden = false;
      slot.el.style.transform = `translate(${((v.x * 0.5 + 0.5) * w).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * h).toFixed(1)}px) translate(-50%, -100%)`;
    });
    for (let i = list.length; i < this.swarmEls.length; i++) this.swarmEls[i]!.el.hidden = true;
    // Plan item 657: a column no badge rides shows how many wait in it past the JAM_3D drawn.
    let n = 0;
    this.countedCols = new Set(ridden);
    if (game.phase === "wave")
      for (const col of this.lay.columns) {
        const shown = this.jamDrawn.get(col) ?? 0;
        if (ridden.has(col) || col.count <= shown) continue;
        let el = this.columnEls[n];
        if (!el) {
          el = document.createElement("div");
          el.className = "swarm-badge column-count";
          el.setAttribute("aria-hidden", "true");
          el.append(document.createElement("b"));
          this.overlayEl.append(el);
          this.columnEls.push(el);
        }
        n++;
        this.countedCols.add(col);
        el.firstElementChild!.textContent = `+${col.count - shown}`;
        const p = enemyPoint(game.level, { dist: col.at ?? Math.max(0, col.dist), ...(col.lane ? { lane: col.lane } : {}) });
        const v = new THREE.Vector3(p.x, this.height(p.x, p.y) + 0.9, p.y).project(this.camera);
        el.hidden = false;
        el.style.transform = `translate(${((v.x * 0.5 + 0.5) * w).toFixed(1)}px, ${((-v.y * 0.5 + 0.5) * h).toFixed(1)}px) translate(-50%, -100%)`;
      }
    for (let i = n; i < this.columnEls.length; i++) this.columnEls[i]!.hidden = true;
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
      const text = `+${Math.floor(m.n)}`;
      if (m.el.textContent !== text) m.el.textContent = text;
      // Plan item 748: it stands on the tower's drawn top, not 1.25 units up its body (the gold '+33' sat on the gold
      // beehive, '+8' on the scarecrow's chest, at l27 D and P); a top too near the frame's edge puts it beside.
      const view = this.towers.get(id);
      const lean = (view?.obj.userData.lean as THREE.Object3D | undefined) ?? view?.obj;
      const rise = this.reducedMotion ? 0 : m.quiet * 14;
      const lw = m.el.offsetWidth;
      const lh = m.el.offsetHeight;
      let px: number, py: number;
      if (lean) {
        const b = this.boxRect(new THREE.Box3().setFromObject(lean), w, h);
        m.own = b;
        px = b.x + b.w / 2;
        py = b.y - 3 - rise;
        if (py - lh < PLATE_EDGE) {
          py = Math.max(PLATE_EDGE + lh, b.y + lh + 4);
          px = b.x + b.w + 4 + lw / 2 <= w - PLATE_EDGE ? b.x + b.w + 4 + lw / 2 : b.x - 4 - lw / 2;
        }
      } else {
        const v = new THREE.Vector3(tw.col + 0.5, this.height(tw.col + 0.5, tw.row + 0.5) + 1.25, tw.row + 0.5).project(this.camera);
        px = (v.x * 0.5 + 0.5) * w;
        py = (-v.y * 0.5 + 0.5) * h - rise;
      }
      px = Math.max(PLATE_EDGE + lw / 2, Math.min(w - PLATE_EDGE - lw / 2, px));
      m.box = { x: px - lw / 2, y: py - lh, w: lw, h: lh };
      m.el.style.opacity = String(1 - Math.max(0, (m.quiet - 0.5) / 0.4));
      m.el.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) translate(-50%, -100%)`;
    }
  }

  /** Plan item 72: the queue drawn last frame (CSS px from the canvas corner), for the e2e tests; null when nothing waits at the gate. */
  shownQueue: { leads: Rect[]; plates: Rect[]; names: Rect[]; boxes: Rect[] } | null = null;
  /** Plan item 410: the lead vehicle's name chip on each lane. */
  private queueNames: Array<{ el: HTMLElement; model: number }> = [];
  private queueKey = "";
  private queueGroup: THREE.Group | null = null;
  private queuePlates: HTMLElement[] = [];
  /** Plan item 103: the town named on the gate plate when its 3D board steps down on a phone. */
  private plateTown = "";
  private queueAnchors: Array<{ x: number; z: number; up: number; gx: number; gz: number }> = [];
  private queueModels: Array<{ obj: THREE.Object3D; x: number; z: number; up: number; r: number; s: number; yaw: number; shadow: THREE.Object3D }> = [];
  private gateHold = 0;
  private gateEase = 0;
  /** Plan item 160 (tests): the gate's look has let go and the boss push has eased out. */
  camSettled(): boolean {
    return this.gateHold === 0 && this.gateEase < 0.001 && Math.abs(this.bossPush - this.bossEase) < 0.001;
  }
  private gateAt = { x: 0, y: 0 };

  /** Plan item 439: how far vehicles lean back from a steep lens (0 on a desktop's low view). */
  private steepTilt(): number {
    const c = this.camera.position, t = this.camTarget;
    const elev = Math.atan2(c.y - t.y, Math.hypot(c.x - t.x, c.z - t.z));
    return Math.min(0.6, Math.max(0, (elev - CATH_LEAN_FROM) * 1.7));
  }
  private readonly flatQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);

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
    this.syncLeaving(game);
    if (!this.queueGroup) {
      this.shownQueue = null;
      return;
    }
    // Wall time, not the frame's dt: the field's clock can run slow or stand still between rounds.
    const k = Math.max(0, Math.min(1, (performance.now() - (this.queueGroup.userData.born as number)) / 400));
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const shown: { leads: Rect[]; plates: Rect[]; names: Rect[]; boxes: Rect[] } = { leads: [], plates: [], names: [], boxes: [] };
    const tilt = this.steepTilt();
    const now = performance.now() / 1000;
    let qi = 0;
    for (const m of this.queueModels) {
      m.obj.scale.setScalar(Math.max(0.001, k) * m.s);
      // Plan item 450: the queue idles with its engines running: a small shiver, each van out of step with the
      // next, and now and then a puff of exhaust from its tail (still under reduced motion).
      const baseY = (m.obj.userData.baseY as number | undefined) ?? (m.obj.userData.baseY = m.obj.position.y);
      if (!this.reducedMotion) {
        const ph = qi * 1.7;
        m.obj.position.y = baseY + Math.abs(Math.sin(now * 14 + ph)) * 0.012 * m.r + Math.sin(now * 2.2 + ph) * 0.006 * m.r;
        if (Math.random() < 0.012) {
          const back = this.v2.set(-0.45 * m.r, 0.12 * m.r, 0).applyAxisAngle(this.v1.set(0, 1, 0), m.yaw);
          this.sparks.emit(m.x + back.x, this.height(m.x, m.z) + back.y + 0.05, m.z + back.z, "#cfcac0", 2, 0.35, 0.08, 0.9, 0.4);
        }
      }
      qi++;
      // Item 439: the steep-view lean (yaw, then a tilt about the world's x); the contact shadow stays flat.
      m.obj.rotation.set(-tilt, m.yaw, 0, "XYZ");
      m.shadow.quaternion.copy(m.obj.quaternion).invert().multiply(this.flatQ);
      // Plan item 410 (tests): the model's true projected box, its bounding box's eight corners on the canvas.
      m.obj.updateMatrixWorld(true);
      const bb = this.qBox.setFromObject(m.obj, true);
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let c = 0; c < 8; c++) {
        const v = this.v1.set(c & 1 ? bb.max.x : bb.min.x, c & 2 ? bb.max.y : bb.min.y, c & 4 ? bb.max.z : bb.min.z).project(this.camera);
        const px = (v.x * 0.5 + 0.5) * w;
        const py = (-v.y * 0.5 + 0.5) * h;
        x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
      }
      shown.boxes.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
      const a = this.v1.set(m.x, this.height(m.x, m.z) + m.up, m.z).project(this.camera);
      const b = this.v2.set(m.x, this.height(m.x, m.z), m.z).project(this.camera);
      const cx = (a.x * 0.5 + 0.5) * w;
      const top = (-a.y * 0.5 + 0.5) * h;
      const foot = (-b.y * 0.5 + 0.5) * h;
      const half = Math.max(8, (foot - top) * 0.6);
      shown.leads.push({ x: cx - half, y: top, w: half * 2, h: Math.max(8, foot - top) });
    }
    this.queuePlates.forEach((el, i) => {
      // Plan item 240: the plate names the town only while the gate's board is stepped down; it took the name once
      // (say in the opening frame) and kept it, so at D the board and the plate both read HOLLOWELL, stacked.
      if ((el.dataset.town ?? "") !== this.plateTown) {
        el.querySelector(".gate-plate-town")?.remove();
        delete el.dataset.town;
        if (this.plateTown) {
          el.dataset.town = this.plateTown;
          const town = document.createElement("span");
          town.className = "gate-plate-town";
          town.textContent = this.plateTown;
          el.prepend(town);
        }
      }
      const at = this.queueAnchors[i]!;
      // Plan item 179: the count hangs on its depot's fascia while the depot is in the frame; the plate keeps
      // to the gate (items 72-139) only when it isn't.
      const onDepot = this.depotDock(Number(el.dataset.lane ?? 0), w, h);
      el.toggleAttribute("data-on-depot", !!onDepot);
      if (onDepot) {
        const pw = el.offsetWidth;
        const ph = el.offsetHeight;
        let x = Math.max(PLATE_EDGE, Math.min(w - pw - PLATE_EDGE, onDepot.x - pw / 2));
        // Plan item 391: the board stands on its posts on the roof's front edge (7 px legs under it, components.css).
        el.toggleAttribute("data-under", onDepot.under !== undefined);
        let y = Math.max(PLATE_EDGE, Math.min(h - ph - PLATE_EDGE, onDepot.under ?? onDepot.y - ph - 7));
        // Plan item 391: a docked plate never covers the gate's sign (the flat-roofed depot stands nearer it on a
        // phone's l13): it steps right of the sign, or else under it.
        for (const sg of this.gateSignRects()) {
          if (!(x < sg.x + sg.w && x + pw > sg.x && y < sg.y + sg.h && y + ph > sg.y)) continue;
          if (sg.x + sg.w + 6 + pw <= w - 4) x = sg.x + sg.w + 6;
          else y = Math.min(h - ph - 4, sg.y + sg.h + 4);
        }
        // Plan item 409: nor under the field's own buttons (a phone's 'Whole field' over the depot's right): it steps
        // left of them, clamped to the frame.
        const cr = this.canvas.getBoundingClientRect();
        for (const bt of document.querySelectorAll<HTMLElement>(".field-fit")) {
          const b = bt.getBoundingClientRect();
          if (!b.width) continue;
          const bx = b.left - cr.left;
          const by = b.top - cr.top;
          if (x < bx + b.width && x + pw > bx && y < by + b.height && y + ph > by) x = Math.max(4, bx - pw - 6);
        }
        el.style.opacity = String(k);
        el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        shown.plates.push({ x, y, w: pw, h: ph });
        return;
      }
      const v = this.v1.set(at.x, this.height(at.x, at.z) + at.up, at.z).project(this.camera);
      const pw = el.offsetWidth;
      const ph = el.offsetHeight;
      let x = Math.max(PLATE_EDGE, Math.min(w - pw - PLATE_EDGE, (v.x * 0.5 + 0.5) * w - pw / 2));
      let y = Math.max(PLATE_EDGE, Math.min(h - ph - PLATE_EDGE, (-v.y * 0.5 + 0.5) * h));
      // Plan item 115: a wide plate (a phone's, with the town's name) clamped at the field's edge could land on the
      // queue itself; it steps clear of the vehicles, to their right or else below them.
      // Item 430: against the vehicles' true projected boxes too: from a phone's high camera a van's lead rect (its
      // height on screen) is a sliver, so the plate settled on the third van's roof.
      const cars = [...shown.leads, ...shown.boxes];
      const hits = (px: number, py: number) => cars.some((l) => px < l.x + l.w && px + pw > l.x && py < l.y + l.h && py + ph > l.y);
      if (cars.length && hits(x, y)) {
        const right = Math.max(...cars.map((l) => l.x + l.w)) + 6;
        const below = Math.max(...cars.map((l) => l.y + l.h)) + 4;
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
      for (const d of dock) d.x = Math.max(PLATE_EDGE, Math.min(w - pw - PLATE_EDGE, d.x));
      ({ x, y } = this.clearPlateSpot({ x, y, w: pw, h: ph }, game, [...cars, ...shown.plates, ...signs], w, h, dock));
      el.style.opacity = String(k);
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      shown.plates.push({ x, y, w: pw, h: ph });
    });
    // Plan item 410: the first to pull out carries its name beside it (as in 2D, item 256), clear of the queue,
    // the count plates, the gate signs and, where it can, the plots.
    const signs = this.queueNames.length ? this.gateSignRects() : [];
    for (const qn of this.queueNames) {
      const lead = shown.leads[qn.model];
      if (!lead) continue;
      const nw = qn.el.offsetWidth;
      const nh = qn.el.offsetHeight;
      const prefer = [
        { x: lead.x + lead.w + 6, y: lead.y + lead.h / 2 - nh / 2 },
        { x: lead.x - nw - 6, y: lead.y + lead.h / 2 - nh / 2 },
        { x: lead.x + lead.w / 2 - nw / 2, y: lead.y + lead.h + 4 },
      ].map((q) => ({ x: Math.max(4, Math.min(w - nw - 4, q.x)), y: Math.max(4, Math.min(h - nh - 4, q.y)) }));
      const { x, y } = this.clearPlateSpot({ x: prefer[0]!.x, y: prefer[0]!.y, w: nw, h: nh }, game, [...shown.leads, ...shown.plates, ...shown.names, ...signs], w, h, prefer);
      qn.el.style.opacity = String(k);
      qn.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      shown.names.push({ x, y, w: nw, h: nh });
    }
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
  /** A mesh's own vertices projected (tight for a turned plane, where its world box is not). */
  private meshRect(o: THREE.Object3D, w: number, h: number, cam: THREE.Camera): Rect {
    // an advert board: the painted panel's four corners (terrain.ts measures them on its texture)
    const pn = o.userData.panel as [number, number, number, number] | undefined;
    if (!pn) return this.boxRect(new THREE.Box3().setFromObject(o), w, h, cam);
    o.updateMatrixWorld(true);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < 4; i++) {
      const v = this.v2.set(i & 1 ? pn[2] : pn[0], i & 2 ? pn[3] : pn[1], 0).applyMatrix4(o.matrixWorld).project(cam);
      const px = (v.x * 0.5 + 0.5) * w;
      const py = (-v.y * 0.5 + 0.5) * h;
      x0 = Math.min(x0, px); y0 = Math.min(y0, py); x1 = Math.max(x1, px); y1 = Math.max(y1, py);
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  private boxRect(b: THREE.Box3, w: number, h: number, cam: THREE.Camera = this.camera): Rect {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < 8; i++) {
      const v = this.v2.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).project(cam);
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
      let best: { sp: (typeof spots)[number]; score: number; r: Rect; inside: number } | null = null;
      // Plan item 584: the depot at its full size where a spot keeps it in frame, else a step smaller each time, down
      // to item 179's 0.8 (level 1 at D has no spot wholly in frame for the bigger building).
      const base = (d.userData.baseScale as number | undefined) ?? d.scale.x;
      for (const k of [1, 0.9, 0.8, 0.71]) {
        d.scale.setScalar(base * k);
        best = null;
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
          // Plan item 391: off the frame weighs double what it did (40): at D on level 1 a fifth of the depot stood past
          // the canvas's right edge (8) rather than lean its roof over the lane's first row from the north verge.
          const score = (1 - inside) * 90 + blocked * 30 + field * 12 + sp.d * 0.6;
          if (!best || score < best.score) best = { sp, score, r, inside };
        }
        if (!best || best.inside >= 0.92) break;
      }
      if (!best) continue;
      d.position.set(best.sp.x, best.sp.y, best.sp.z);
      d.updateMatrixWorld(true);
      taken.push(best.r);
    }
    // Plan item 469: no flowers, tufts or stones through a depot's floor or its bay.
    const feet = depots.map((d) => new THREE.Box3().setFromObject(d).expandByScalar(0.06));
    for (const m of (this.ground?.group.userData.verge as THREE.InstancedMesh[] | undefined) ?? []) clearUnder(m, feet);
  }
  /** Plan item 201: the frame the far houses were settled for (level, canvas size). */
  private farKey = "";
  /**
   * Plan item 201: a far house cut by the frame's top (a wide frame sliced l21's through their roofs) steps toward the
   * field, no nearer than its band allows, until it stands wholly in the frame; one that can't is set back out of it.
   * Once per level and canvas size, at the fitted camera, like the depots.
   */
  private settleFar(game: Game): void {
    const far = (this.ground?.group.userData.far as THREE.Object3D[] | undefined) ?? [];
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const key = `${game.level.id}:${w}x${h}`;
    const anyMoored = !!(this.ground?.group.userData.moored as unknown[] | undefined)?.length;
    const adverts = (this.ground?.group.userData.adverts as THREE.Object3D[] | undefined) ?? [];
    if ((!far.length && !anyMoored && !adverts.length) || !w || !h || key === this.farKey) return;
    this.farKey = key;
    const cam = this.fittedCamera();
    const at = (o: THREE.Object3D, z: number): Rect => {
      o.position.set(o.position.x, Math.max(0, this.height(o.position.x, z)), z);
      o.updateMatrixWorld(true);
      return this.boxRect(new THREE.Box3().setFromObject(o), w, h, cam);
    };
    for (const o of far) {
      const home = o.userData.home as number;
      const near = o.userData.near as number;
      let z = home;
      let r = at(o, z);
      if (r.y >= 2 || r.y + r.h <= 0) continue;
      while (r.y < 2 && z + 0.1 <= near) r = at(o, (z += 0.1));
      if (r.y >= 2) continue;
      // No room in front: back out of the frame instead of showing a sliced roof.
      z = home;
      do r = at(o, (z -= 0.25));
      while (r.y + r.h > 0 && z > home - 8);
    }
    // Plan item 228: Saltmarsh's moored boats, likewise across the frame's left edge: in toward the flats (no nearer
    // than -2.55, out past the beach and its surf) until wholly in, or out to sea until wholly out.
    const moored = (this.ground?.group.userData.moored as THREE.Object3D[] | undefined) ?? [];
    const boat = (o: THREE.Object3D, x: number): Rect => {
      o.position.x = x;
      o.updateMatrixWorld(true);
      return this.boxRect(new THREE.Box3().setFromObject(o), w, h, cam);
    };
    const cut = (r: Rect) => (r.x < 2 && r.x + r.w > 0) || (r.y < 2 && r.y + r.h > 0);
    for (const o of moored) {
      const home = o.userData.home as number;
      let x = home;
      let r = boat(o, x);
      if (!cut(r)) continue;
      while (cut(r) && x + 0.1 <= -2.55) r = boat(o, (x += 0.1));
      if (!cut(r)) continue;
      x = home;
      do r = boat(o, (x -= 0.25));
      while (cut(r) && x > home - 10);
    }
    // Plan item 224: the side verges' advert boards, likewise wholly in the frame: in toward the field (to the verge's
    // inner edge) until whole, else not shown (a board sliced by the frame's edge read as a stray block).
    const sliced = (r: Rect) => r.x < 2 || r.y < 2 || r.x + r.w > w - 2 || r.y + r.h > h - 2;
    for (const o of adverts) {
      const home = o.userData.home as number;
      const inner = o.userData.inner as number;
      const step = inner > home ? 0.1 : -0.1;
      o.visible = true;
      const board = (x: number): Rect => {
        o.position.x = x;
        return this.meshRect(o, w, h, cam);
      };
      let x = home;
      let r = board(x);
      while (sliced(r) && (inner - x) * Math.sign(step) >= 0.1) r = board((x += step));
      if (sliced(r)) o.visible = false;
    }
  }
  /** Plan item 224 (tests): the shown advert boards' boxes on the canvas (CSS px) at the fitted view. */
  advertRects(): Rect[] {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const cam = this.fittedCamera();
    return ((this.ground?.group.userData.adverts as THREE.Object3D[] | undefined) ?? []).filter((o) => o.visible).map((o) => this.meshRect(o, w, h, cam));
  }
  /** Plan item 228 (tests): the moored boats' boxes on the canvas (CSS px) at the fitted view. */
  /** Plan item 255: the signed angle (radians, seen from above) a turn of her head about +y needs to face the camera,
   *  as she stands now. */
  private faceError(): number | null {
    const head = this.cath?.userData.head as THREE.Object3D | undefined;
    const yaw = head?.children[0];
    if (!head || !yaw) return null;
    this.cath!.updateMatrixWorld(true);
    const fwd = new THREE.Vector3(1, 0, 0).transformDirection(yaw.matrixWorld);
    const at = new THREE.Vector3().setFromMatrixPosition(head.matrixWorld);
    const to = this.camera.getWorldPosition(new THREE.Vector3()).sub(at);
    const a = Math.atan2(fwd.z, fwd.x) - Math.atan2(to.z, to.x);
    return Math.atan2(Math.sin(a), Math.cos(a));
  }
  /** Plan item 255 (tests): the angle (degrees) between where her face looks and the camera, seen from above. */
  faceToCamera(): number | null {
    const e = this.faceError();
    return e === null ? null : Math.abs((e * 180) / Math.PI);
  }
  /** Plan item 255 (tests): Cath's ink hulls, and whether the farmfolk are toon-shaded with a baked ink hull. */
  people3d(): { cathInk: number; folkToon: number; folkPlain: number } {
    let cathInk = 0;
    this.cath?.traverse((o) => {
      if (o.userData.ink) cathInk++;
    });
    let folkToon = 0;
    let folkPlain = 0;
    this.folkMeshes.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || m.userData.prop) return;
      if ((m.material as THREE.Material).type === "MeshToonMaterial") folkToon++;
      else folkPlain++;
    });
    return { cathInk, folkToon, folkPlain };
  }
  mooredRects(): Rect[] {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const cam = this.fittedCamera();
    return ((this.ground?.group.userData.moored as THREE.Object3D[] | undefined) ?? []).map((o) => this.boxRect(new THREE.Box3().setFromObject(o), w, h, cam));
  }
  /** The fitted base view (no zoom, pan, gate look or directed shot), as `fieldShare` measures it. */
  private fittedCamera(): THREE.PerspectiveCamera {
    const cam = this.camera.clone();
    cam.aspect = this.w / this.h;
    cam.updateProjectionMatrix();
    cam.position.copy(this.camBase);
    cam.lookAt(this.camTarget);
    cam.updateMatrixWorld();
    return cam;
  }
  /** Plan item 201 (tests): the far houses' boxes on the canvas (CSS px) at the fitted view. */
  farRects(): Rect[] {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const cam = this.fittedCamera();
    return ((this.ground?.group.userData.far as THREE.Object3D[] | undefined) ?? []).map((o) => this.boxRect(new THREE.Box3().setFromObject(o), w, h, cam));
  }
  /** Plan item 179: the shutter rolls up as a round's convoy leaves (the first 2.5 s of a round), and down again. */
  private depotOpen = 0;
  /** Plan item 479: the last round is a showdown (set by main.ts): the shutters stay fully up through it. */
  showdown = false;
  private syncDepotShutters(game: Game, dt: number): void {
    const want = game.phase === "wave" && (game.waveClock < 2.5 || this.showdown) ? 1 : 0;
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
    if (r && r.y < 0) {
      // Plan item 409: hung from the depot's own foot (its base, projected), on two chains (components.css), not
      // 4 px under the box, which takes in the forecourt and left the board floating over the road on a phone.
      const under = r.footY > 0 && r.footY < r.y + r.h ? r.footY + 10 : r.y + r.h + 4;
      return { x: r.x + r.w / 2, y, under };
    }
    return { x, y };
  }

  /** Plan item 157: the depots by the gates as boxes on the canvas (CSS px), and their world footprint (x, z). */
  /** Plan item 198: the act's biome in 3D ('saltmarsh', or 'farm' where none is built yet). */
  get biome(): string {
    return (this.ground?.group.userData.biome as string | undefined) ?? "farm";
  }

  /** Plan item 185: the field's standing dressing (plots dressed, lane edges hedged), for the e2e. */
  /** Plan item 360: the sun's cast shadows off or on, so a check can measure how dark a shadow reads against the
   * same pixels lit. */
  setShadows(on: boolean): void {
    this.sun.castShadow = on;
  }

  dressing(): { plots: number; dressed: number; laneEdges: number; hedgedEdges: number; meshes: number } | null {
    return (this.ground?.group.userData.dressing as ReturnType<Renderer3D["dressing"]>) ?? null;
  }

  depotRects(): Array<Rect & { wx0: number; wx1: number; wz0: number; wz1: number; roofX: number; roofY: number; footY: number; doorX: number; doorY: number }> {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const out: Array<Rect & { wx0: number; wx1: number; wz0: number; wz1: number; roofX: number; roofY: number; footY: number; doorX: number; doorY: number }> = [];
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
      // Plan item 369: and the box's centre isn't the roof's: the loading bay and the floodlight's pole pull it off the
      // shed, so the rep's hatch hung past the roof's edge and read as a head poking up behind it. The hatch sits on
      // the shed's own roof, just under its ridge (buildDepot: the pyramid roof's apex at 1.22 over the shed's centre).
      d.updateMatrixWorld(true);
      // Plan item 391: the roof is flat now (its membrane at 0.95); the hatch stands at its centre, behind the logotype.
      // (Its own vector: sharing this.v2 with `foot` below put the roof on the foot from 2026-11-15 to 11-17.)
      const roof = d.localToWorld(new THREE.Vector3(0, 0.95, 0)).project(this.camera);
      // Plan item 409: the depot's foot (its origin, at its door) on screen, where a board hung under it starts.
      const foot = this.v2.set(0, 0, 0).applyMatrix4(d.matrixWorld).project(this.camera);
      // Plan item 479: the threshold of its door (buildDepot: the shutter in the shed's +x face at 0.735), where the rep
      // stands in the showdown; the origin is the shed's centre, so a figure stood there sat behind the door's top.
      const door = d.localToWorld(new THREE.Vector3(0.86, 0.04, 0)).project(this.camera);
      out.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, wx0: b.min.x, wx1: b.max.x, wz0: b.min.z, wz1: b.max.z, roofX: (roof.x * 0.5 + 0.5) * w, roofY: (-roof.y * 0.5 + 0.5) * h, footY: (-foot.y * 0.5 + 0.5) * h, doorX: (door.x * 0.5 + 0.5) * w, doorY: (-door.y * 0.5 + 0.5) * h });
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
        if (i > 0) d += (0.42 * (enemyScale(ln.leads[i]!) + enemyScale(ln.leads[i - 1]!)) + 0.06) * QUEUE_SCALE_3D;
      }
      if (ln.leads.length) {
        const el = document.createElement("div");
        el.className = "queue-name";
        el.dataset.lane = String(ln.lane ?? 0);
        el.setAttribute("aria-hidden", "true");
        // Plan item 529: led by its driver's face, as the 2D tag is.
        // (an image, so the tag's text stays its name alone)
        const face = document.createElement("img");
        face.className = "queue-driver";
        face.alt = "";
        face.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(driverFace(ln.leads[0]!))}`;
        el.append(face, ENEMIES[ln.leads[0]!].name);
        this.overlayEl.append(el);
        this.queueNames.push({ el, model: this.queueModels.length });
      }
      ln.leads.forEach((kind, i) => {
        const p = enemyPoint(level, { dist: dists[i]!, ...(ln.lane ? { lane: ln.lane } : {}) });
        const hd = headingAt(path, dists[i]!);
        const obj = buildRung(kind) ?? buildEnemy(kind);
        // Plan item 280: the queue stands larger than the lane's traffic (as the 2D queue does, item 256), so its
        // models read as cars, vans and lorries from the field camera, not coloured boxes.
        obj.scale.multiplyScalar(QUEUE_SCALE_3D);
        const foot = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
        const lift = enemyLift(kind) * QUEUE_SCALE_3D;
        obj.position.set(p.x, this.height(p.x, p.y) + lift, p.y);
        obj.userData.kind = kind;
        obj.rotation.y = Math.atan2(-hd.dy, hd.dx);
        // Plan item 410: a soft contact shadow under each, so the glossy fleet stands on the dirt, not floats over it.
        const shadow = new THREE.Mesh(QUEUE_SHADOW_GEO, queueShadowMat());
        shadow.rotation.x = -Math.PI / 2;
        shadow.scale.set((foot.x * 0.62) / obj.scale.x, (foot.z * 0.7) / obj.scale.z, 1);
        shadow.position.y = (0.012 - lift) / obj.scale.y;
        shadow.renderOrder = 2;
        obj.add(shadow);
        group.add(obj);
        this.queueModels.push({ obj, x: p.x, z: p.y, up: lift + 0.75 * enemyScale(kind) * QUEUE_SCALE_3D, r: enemyScale(kind) * QUEUE_SCALE_3D, s: obj.scale.x, yaw: obj.rotation.y, shadow });
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
      // Plan item 403: the depot's board says what the 2D depot's says ('216 next'; it read 'coming' in 3D only).
      el.textContent = `${ln.count} next`;
      this.overlayEl.append(el);
      this.queuePlates.push(el);
      if (!ln.lane) this.gateAt = { x: tail.x, y: tail.y };
    }
    this.queueGroup = group;
    this.dynamic.add(group);
    // A boss or other heavy plant in the round: the camera eases to the gate, then back.
    if (q.boss && !this.reducedMotion) this.gateHold = 2.6;
  }

  /** Plan item 450: during a round each depot's board counts its lane's vehicles still to leave, ticking down as
   *  each pulls out and gone once the last has left (between rounds the queue's plate says what comes next). */
  private leavePlates: HTMLElement[] = [];
  private syncLeaving(game: Game): void {
    const going = game.phase === "wave" && !!game.spawnQueue.length;
    const depots = ((this.ground?.group.userData.depots as THREE.Object3D[] | undefined) ?? []).length;
    if (!going || !this.overlayEl) {
      for (const el of this.leavePlates) el.remove();
      this.leavePlates = [];
      return;
    }
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    for (let lane = 0; lane < depots; lane++) {
      const left = game.spawnQueue.filter((q) => (q.lane ?? 0) === lane).length;
      let el = this.leavePlates[lane];
      if (!el) {
        el = document.createElement("div");
        el.className = "gate-plate";
        el.dataset.leaving = "";
        el.dataset.onDepot = "";
        el.setAttribute("aria-hidden", "true");
        this.overlayEl.append(el);
        this.leavePlates[lane] = el;
      }
      const dock = left ? this.depotDock(lane, w, h) : null;
      el.hidden = !dock;
      if (!dock) continue;
      const text = `${left} to go`;
      if (el.textContent !== text) el.textContent = text;
      el.dataset.left = String(left);
      el.toggleAttribute("data-on-depot", true);
      el.toggleAttribute("data-under", dock.under !== undefined);
      const pw = el.offsetWidth;
      const ph = el.offsetHeight;
      const x = Math.max(PLATE_EDGE, Math.min(w - pw - PLATE_EDGE, dock.x - pw / 2));
      const y = Math.max(PLATE_EDGE, Math.min(h - ph - PLATE_EDGE, dock.under ?? dock.y - ph - 7));
      el.style.opacity = "1";
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    }
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
    for (const qn of this.queueNames) qn.el.remove();
    this.queueNames = [];
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

