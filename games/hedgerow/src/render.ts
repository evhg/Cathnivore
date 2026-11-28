// Canvas 2D renderer for Hedgerow. It only reads the Game; it never changes it. The painted battlefield
// (theme.ts) is cached in an offscreen canvas; every frame draws the sprites (sprites.ts) in depth order,
// then projectiles, particles, floating numbers and the overlays (cloud shadows, flashes, screen shake).
// Projectiles and particles are fed from the engine's event list: the engine is hitscan, so the flight
// times here are short and only for show.

import { CART_SECONDS, drawCart, drawDoorstep, drawSaleBoard, drawSweep, SWEEP_SECONDS, type DoorstepView } from "./doorstepart";
import { P, PROPERTIES, RUNGS, crackStage } from "./fleet";
import { PLOT_STITCH, PLOT_STITCH_UNDER } from "./plotlook";
import { kitFor } from "./fieldkit";
import { drawKitBarn } from "./fieldkitart";
import {
  ENEMIES,
  MEGAS,
  bridgeOpen,
  setPiece,
  hasTwist,
  maxHpOf,
  charmed,
  isBig,
  isRevealed,
  enemyPoint,
  headingAt,
  pointAt,
  pathLength,
  betweenRounds,
  waveSpawns,
  postMarker,
  towerAt,
  towerStats,
  plotKind,
  barnAt,
  isPlot,
  isProtected,
  oakAt,
  type EnemyKind,
  type Game,
  type GameEvent,
  type TowerKind,
  type Enemy,
  type Level,
} from "./engine";
import { PUFF, fireTint } from "./firetint";
import { cathSvg } from "../../../shared/cath/cath";
import { crayonNextBillboard, gateSignRect, isWonLevel, paintBackground, rng, themeFor } from "./theme";
import { LIVE_PIECES, drawMarginLife, lastMargin, type Placed } from "./margins";
import { cropOf, occupiedPlots, ripeCount, shownCrops } from "./growth";
import { drawCrop } from "./cropart";
import { swarms, type Swarm } from "./swarm";
import { layOutField, noConvoy, placeOnLane, type Convoy, type ConvoyColumn } from "./convoy";
import { gateQueue, type GateQueue } from "./gatequeue";
import { FarmFolk, type Folk } from "./farmfolk";
import { drawFolk } from "./folkart";
import {

  INK,
  drawEnemy,
  TOP_DOWN,
  FLEET_TOP,
  drawPropIcon,
  propIconsFor,
  drawFarmhouse,
  drawHero,
  heroSize,
  HERO_SCALE,
  drawTower,
  towerReach,
  fieldFit,
  towerFoot,
  enemyLift,
  enemyScale,
  drawnLen,
  ROAD_GAP,
  star,
  drawThornPile,
  castShadow,
  setLamps,
  setShadowSun,
} from "./sprites";
import { dayLamps, dayPhase, dayShadowDir, dayShadowLength, daySunRgb, dayWarmth } from "./sunlight";
import { driverFace } from "./fleetfaces";

/** Plan item 322: a tower on the field is drawn this much over its cell's size. */
// Plan item 431: 1.4 cells (was 1.2): a tower is the thing worth looking at on the field, not a token on its plot (at
// 1.56, the item's 1.3x, neighbours on adjacent plots overlapped and the top row met the frame).
export const FIELD_TOWER = 1.4;

/**
 * Plan item 742: a field tower's drawn reach from its plot's centre, in cells (up and either side), once its solid foot
 * is fitted inside the plot (`fieldFit`), and the fit itself.
 */
export function fieldReach(kind: TowerKind, tier: number, path?: readonly number[]): { up: number; half: number; fit: ReturnType<typeof fieldFit> } {
  const fit = fieldFit(kind, tier, path, FIELD_TOWER);
  const r = towerReach(kind, tier, path);
  return { up: r.up * FIELD_TOWER * fit.scale + fit.lift, half: r.half * FIELD_TOWER * fit.scale * fit.squeeze, fit };
}

interface Shot {
  kind: TowerKind;
  spec: 0 | 1 | null;
  /** A path tower's tier 3 look (engine.ts shotLook): "crow", "hawk", "pumpkin", "scatter", "wreck", "ram"... */
  look?: string;
  x: number;
  y: number;
  toX: number;
  toY: number;
  age: number;
  life: number;
  crit: boolean;
  /** The enemy it is thrown at: it flinches when the shot lands, not when it leaves (plan item 19). */
  enemy: number;
  /** Plan item 676: landed (the hit is played once); the shot's trail then fades over TRAIL seconds. */
  landed?: boolean;
}

/** Plan item 676: how long a shot's trail lingers after it lands, so a fight reads in a still (puffs: `PUFF`). */
const TRAIL = 0.45;

/** Path tier 3 looks that draw like an old specialisation's shot (the rest have their own). */
const LOOK_SPEC: Record<string, 0 | 1> = { crow: 1, hawk: 1, pumpkin: 0, scatter: 1, queen: 0, honey: 1 };

/** Gold floaters from fleet knocks merge over this many seconds. */
const GOLD_WINDOW = 0.15;
/** Plan item 706: gains this close (CSS px) to a live number join it; a number holds GAIN_HOLD s, gone at GAIN_LIFE. */
const GAIN_MERGE_PX = 120;
const GAIN_HOLD = 0.4;
const GAIN_LIFE = 0.7;
const GAIN_MIN_PX = 14;
/** Plan item 736: every number and text float stands this far (CSS px) inside the field's edge, at most MAX_FLOATS live. */
const FIELD_MARGIN = 12;
const MAX_FLOATS = 6;
/** Classic levels' vehicles have no rung colour: a tint per type for the swarm badge's make-up bar. */
/** Plan item 256: queued vehicles at the gate drawn larger than on the lane (they're parked, the round's cast). */
const QUEUE_SCALE = 1.4;
const SWARM_TINT: Partial<Record<EnemyKind, string>> = { hatchback: "#e0b13a", courier: "#d2694a", quad: "#7a9c4a", lorry: "#4f6fa0", drone: "#9a8fb5" };

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  age: number;
  life: number;
  size: number;
  color: string;
  shape: "dot" | "square" | "star" | "ring" | "leaf" | "text" | "bee" | "puff";
  rot: number;
  vr: number;
  text?: string;
  /** Text size multiplier. */
  big?: number;
}

/** Plan item 706: one pooled gain on the field (cells; dx, dy the step aside it took when first drawn). */
interface Gain {
  x: number;
  y: number;
  dx: number;
  dy: number;
  n: number;
  quiet: number;
  big: number;
  placed: boolean;
  tower?: number;
}

interface Decal {
  x: number;
  y: number;
  r: number;
  color: string;
  age: number;
  life: number;
}

interface PieFlight {
  fromX: number;
  fromY: number;
  x: number;
  y: number;
  r: number;
  age: number;
  life: number;
  landed: boolean;
}

/** Desktop framing (item 431): the field's share of the board's width, the side panel's range and the grid gap. */
const FIELD_SHARE = 0.705;
const PANEL_MIN = 320;
const PANEL_MAX = 400;
const PANEL_SHARE = 0.26;
const STAGE_GAP = 14;
/** Margin, in cells, beside a gate (room for its depot) and on a side with none. */
const DEPOT_ROOM = 2.5;
const EDGE_ROOM = 0.7;

/** Plan item 576: the act's strip at an upright phone field's gate side, px. */
const PHONE_STRIP = 41;

export interface View {
  cellSize: number;
  offX: number;
  offY: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
const FONT = "'Hedgerow UI', system-ui, sans-serif";

/** Plan item 707: furthest along the lane (cells) a vehicle waits in the depot's column before it is drawn. */
const DEPOT_CLEAR_MAX = 1.5;

/** Overshoot ease for a tower popping in: 0 -> 1 with a small bounce. */
function popScale(k: number): number {
  const c = 1.9;
  const x = k - 1;
  return 1 + (c + 1) * x * x * x + c * x * x;
}

/** Plan item 285: which way the lane runs where this enemy is: "up" or "down" on a vertical run (drawn from
 *  above), else undefined (the side view). */
function runOf(level: Level, e: { dist: number; lane?: number | null }): "up" | "down" | undefined {
  const path = e.lane && level.path2 ? level.path2 : level.path;
  const h = headingAt(path, e.dist);
  if (h.dy === 0 || Math.abs(h.dx) >= Math.abs(h.dy)) return undefined;
  return h.dy > 0 ? "down" : "up";
}

/** Plan item 713: Cath's least drawn height on the 2D field, in CSS px. */
const HERO_MIN_PX = 50;
/** Plan item 713: her cast's staged moment, in seconds. */
const CAST_S = 0.8;

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private bg: HTMLCanvasElement | null = null;
  private bgKey = "";
  private marginPieces: readonly Placed[] = [];
  /** Plan item 59: the crops drawn on the field (cached; a change cross-fades from the old layer). */
  private crops: HTMLCanvasElement | null = null;
  private cropsOld: HTMLCanvasElement | null = null;
  private cropKey = "";
  private cropFade = 1;
  private cropGame: Game | null = null;
  private wonAt: number | null = null;
  private shots: Shot[] = [];
  private parts: Particle[] = [];
  /** Plan item 497 (tests): how many vehicles have kicked up dust pulling out of the gate. */
  rolloutDust = 0;
  /** Fleet levels: Marks from knocks not yet shown, flushed as one "+N" floater every GOLD_WINDOW seconds. */
  private gold = { n: 0, x: 0, y: 0, age: 0 };
  /**
   * Plan item 706: every gain on the field (a tower's Marks from knocks, a kill's bounty, the loose Marks) is one
   * pooled "+N": a gain within GAIN_MERGE_PX of a live number adds to it, so no two numbers stand within that of each
   * other; each is gone GAIN_LIFE s after its last gain, and steps aside from vehicles and other towers when placed.
   * (Plan item 45's per-tower marks, the bounty text floats and the gold floater, merged.)
   */
  private gains: Gain[] = [];
  /** The last frame's cell size in CSS px, for the gain pool's merge radius. */
  private cellPx = 40;
  /** Plan item 45: wreck debris left on the verge for the round (oldest culled past 140 pieces). */
  private debris: Array<{ x: number; y: number; color: string; rot: number; size: number }> = [];
  private decals: Decal[] = [];
  private pies: PieFlight[] = [];
  /** Defeated enemies tipping over and fading where they fell. */
  private fallen: { kind: EnemyKind; x: number; y: number; facing: 1 | -1; age: number }[] = [];
  private zaps: Array<{ x: number; y: number; toX: number; toY: number; age: number; life: number }> = [];
  private fired = new Map<number, number>();
  private hitAt = new Map<number, number>();
  private facing = new Map<number, 1 | -1>();
  private lastX = new Map<number, number>();
  private heroSwung = 9;
  private heroThrew = 9;
  /** Plan item 713: seconds since her Rally or the neighbours' call (her cast: arms up, a gold burst behind her). */
  private heroCast = 9;
  private castPie = false;
  private shake = 0;
  private flash = 0;
  private flashColor = "255,60,40";
  private clock = 0;
  private rand = rng(99);
  /** Plan item 114: Cath's drawn size on this field (px), for the e2e. */
  heroPx(): { h: number; w: number } {
    const key = `${this.view.cellSize}|${this.face?.complete ? 1 : 0}`;
    if (this.heroPxKey !== key) {
      // Plan item 713: on a small field (a phone's level 34) she keeps 50 CSS px of figure: her scale grows, up to
      // a third more, until she does.
      const base = heroSize(this.view.cellSize * HERO_SCALE, this.face);
      const k = base.h > 0 ? Math.min(1.34, Math.max(1, HERO_MIN_PX / base.h)) : 1;
      this.heroK = k;
      this.heroPxAt = k > 1 ? heroSize(this.view.cellSize * HERO_SCALE * k, this.face) : base;
      this.heroPxKey = key;
    }
    return this.heroPxAt!;
  }
  /** Plan item 713: her drawn scale over a cell's (HERO_SCALE, more on a small field). */
  private heroScale(): number {
    this.heroPx();
    return HERO_SCALE * this.heroK;
  }
  private heroK = 1;
  private heroPxKey = "";
  private heroPxAt: { h: number; w: number } | null = null;
  private face: HTMLImageElement | null = null;
  private faceWorried: HTMLImageElement | null = null;
  private faceCheer: HTMLImageElement | null = null;
  /** Seconds left of Cath's cheer after a clean wave. */
  private cheer = 0;
  /** Plan item 114: seconds since a wave cleared, a leak and a tower went in (her poses), as in 3D (item 102). */
  private moodCheer = 9;
  private moodWorry = 9;
  private moodPlant = 9;
  private towersSeen = -1;
  /** Her pose for tests and CSS (item 162's moods, plus item 492's crook swing while it lands). */
  heroMood: "rest" | "cheer" | "worried" | "plant" | "swing" = "rest";
  /** Plan item 492: seconds since her last level-up (the rosette's stamp and the leaves run 0.7 s). */
  private levelBeat = 9;
  /** Plan item 492: her footprints as she's moved across the field, each fading out over 1 s (none under reduced
   *  motion). Left and right in turn, about every 0.16 of a cell. */
  private prints: { x: number; y: number; a: number; ang: number }[] = [];
  private printFrom: { x: number; y: number } | null = null;
  private printLeft = false;
  get printCount(): number {
    return this.prints.length;
  }
  levelUp(): void {
    this.levelBeat = 0;
  }
  private leaksThisWave = 0;
  /** Tower id -> seconds since it was built or upgraded (drives the pop-in). */
  private built = new Map<number, number>();
  /** Seconds of victory confetti still to fall. */
  private parade = 0;
  view: View = { cellSize: 40, offX: 0, offY: 0 };
  /** The share of the canvas's spare width left of the field (frameStage: the depot's side gets the room). */
  private frameLeft = 0.5;
  selected: { col: number; row: number } | null = null;
  cursor: { col: number; row: number } | null = null;
  /** Cath is selected: the next tap moves her. */
  heroSelected = false;
  /** While Cath is picked up: where she'd stand if put down here. */
  postPreview: { x: number; y: number } | null = null;
  /** Pie aiming: a splash preview under the pointer. */
  aim: { x: number; y: number; r: number } | null = null;
  /** The tower being considered for the selected plot: its range is previewed. */
  preview: TowerKind | null = null;
  /** Plan item 297: the plot Cath's coaching points at, and the tower she advises there (null when none). */
  coach: { col: number; row: number; kind: TowerKind } | null = null;
  /** Plan item 392: when the player last tapped Cath's plate (ms, performance.now()): the plot she means rings out. */
  coachPulseAt = -1e9;
  /** Plan item 31: the range ring drawn last frame (cells and pixels), for tests; null when none. */
  shownRing: { range: number; px: number; cell: number } | null = null;
  /** Plan item 345: the free plots outlined last frame while building (their cells and stroke width, CSS px), for tests. */
  shownOutlines: Array<{ col: number; row: number; width: number }> = [];
  private darkCanvas: HTMLCanvasElement | null = null;
  reducedMotion = false;
  /** Plan item 485: the day's phase as drawn (eased toward the round's), and the level it belongs to. */
  day = -1;
  private dayLevel = 0;
  private dayAt = 0;
  /** Plan item 480: the farmhouse step (parcels, the door card, the sale board), set by main.ts each frame. */
  doorstep: DoorstepView | null = null;
  /** Plan item 480: parcels in the air, from where each leak got through (cells), and their age in seconds. */
  private tossed: Array<{ x: number; y: number; age: number }> = [];
  /** Plan item 480: handcarts heading up the lane with a parcel (their age in seconds), the returns seen so far, and
   *  the win's sweep (the parcels it clears and its age). */
  private carts: number[] = [];
  private cartsSeen = 0;
  private sweep: { n: number; age: number } | null = null;
  private stepWas: DoorstepView | null = null;
  /** Plan item 59: the harvest's Cath walks the beds over the field, so the field's own Cath steps out. */
  harvesting = false;
  /** Plan item 143: the people and animals working the farm. */
  readonly farm = new FarmFolk();
  /** The farmfolk drawn last frame (the sandbox hook reads it). */
  shownFolk: Folk[] = [];
  private dpr = 1;
  private cssW = 1;
  private cssH = 1;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    // Sandbox only: shot scripts stage a moment (plan item 285: a van tipping with its parcels) through this hook.
    if (new URLSearchParams(location.search).has("sandbox"))
      (window as unknown as { hedgerow2d: { tip(kind: EnemyKind, x: number, y: number): void } }).hedgerow2d = {
        tip: (kind, x, y) => this.fallen.push({ kind, x, y, facing: 1, age: 0 }),
      };
    // A shrinking ring or a pulse a frame past its end can ask for a hair under zero radius, which throws
    // (IndexSizeError) and drops the frame: clamp every arc and ellipse on this canvas (sprites.ts draws on it too).
    const arc = this.ctx.arc.bind(this.ctx);
    this.ctx.arc = (x: number, y: number, r: number, a0: number, a1: number, ccw?: boolean) => arc(x, y, Math.max(0, r), a0, a1, ccw);
    const ellipse = this.ctx.ellipse.bind(this.ctx);
    this.ctx.ellipse = (x: number, y: number, rx: number, ry: number, rot: number, a0: number, a1: number, ccw?: boolean) =>
      ellipse(x, y, Math.max(0, rx), Math.max(0, ry), rot, a0, a1, ccw);
    this.face = svgImage(cathSvg({ framing: "face", expression: "determined" }));
    this.faceWorried = svgImage(cathSvg({ framing: "face", expression: "worried" }));
    this.faceCheer = svgImage(cathSvg({ framing: "face", expression: "delighted" }));
    try {
      this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      /* no matchMedia */
    }
  }

  resize(game: Game): void {
    this.frameStage(game);
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cssW = Math.max(1, rect.width);
    this.cssH = Math.max(1, rect.height);
    this.canvas.width = Math.max(1, Math.round(rect.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * this.dpr));
    // Leave a margin so the scenery frames the field and tall sprites don't clip at the top.
    // Plan item 576: an upright phone's field filled the width, so the act's place (Saltmarsh's shore, Rivermead's
    // river) never showed and the depot stood on the lane; the gate's side keeps a strip of the act's land for both.
    const strip = this.phoneStrip(game, rect.width);
    const cell = Math.floor(
      Math.min((rect.width - Math.abs(strip)) / (game.level.cols + 0.3), rect.height / (game.level.rows + 0.6)),
    );
    const spare = rect.width - cell * game.level.cols;
    this.view = {
      cellSize: cell,
      offX: Math.floor(strip > 0 ? strip + (spare - strip) / 2 : strip < 0 ? (spare + strip) / 2 : spare * this.frameLeft),
      offY: Math.floor((rect.height - cell * game.level.rows) / 2 + cell * 0.15),
    };
    this.bgKey = "";
  }

  /** Plan item 576: px of the act's land kept on an upright phone's gate side (+ left, - right, 0 none). */
  private phoneStrip(game: Game, width: number): number {
    if (width >= 600 || window.innerHeight <= window.innerWidth) return 0;
    const { cols } = game.level;
    const gates = [game.level.path[0], game.level.path2?.[0]].filter((g): g is [number, number] => !!g);
    if (gates.some(([c]) => c <= 1)) return PHONE_STRIP;
    if (gates.some(([c]) => c >= cols - 2)) return -PHONE_STRIP;
    return 0;
  }

  /**
   * Desktop (item 431): the board's column is sized to the field, so its plots span 70%+ of the canvas width
   * instead of a portrait field standing in a wide strip of margin; the side panel takes the room it frees (to
   * PANEL_MAX) and the play grid centres what is left. The field's size is unchanged (it is bound by the height).
   */
  private frameStage(game: Game): void {
    const play = this.canvas.closest<HTMLElement>(".play");
    const stage = this.canvas.parentElement;
    if (!play || !stage) return;
    let wide = false;
    try {
      wide = window.matchMedia("(min-width: 900px) and (min-height: 600px)").matches;
    } catch {
      /* no matchMedia */
    }
    this.frameLeft = 0.5;
    if (!wide) {
      play.style.removeProperty("--stage-w");
      play.style.removeProperty("--panel-w");
      return;
    }
    const { cols, rows } = game.level;
    const room = play.clientWidth - STAGE_GAP;
    const cell = stage.getBoundingClientRect().height / (rows + 0.6);
    // The depot stands beside its gate (depot.ts): a side within two cells of a gate keeps DEPOT_ROOM cells of
    // margin, the other a slim edge of country.
    const gates = [game.level.path[0], game.level.path2?.[0]].filter((g): g is [number, number] => !!g);
    const near = (left: boolean) => gates.some(([c]) => (left ? c <= 1 : c >= cols - 2));
    let mL = near(true) ? DEPOT_ROOM : EDGE_ROOM;
    let mR = near(false) ? DEPOT_ROOM : EDGE_ROOM;
    if (mL === EDGE_ROOM && mR === EDGE_ROOM) mL = mR = (cols / FIELD_SHARE - cols) / 2;
    const fit = Math.ceil(cell * (cols + mL + mR));
    this.frameLeft = mL / (mL + mR);
    // Plan item 692: the panel serves the field: at most 26% of the window (400 px was 28% of 1440).
    const cap = Math.max(PANEL_MIN, Math.min(PANEL_MAX, Math.floor(window.innerWidth * PANEL_SHARE)));
    const panel = Math.max(PANEL_MIN, Math.min(cap, room - fit));
    // Plan item 641: the stage takes all the room the panel leaves (it was the field's fit, centred in felt): the act's
    // scenery runs on to the window's edge, the field where the depot margins put it.
    const w = Math.max(0, room - panel);
    play.style.setProperty("--stage-w", `${w}px`);
    play.style.setProperty("--panel-w", `${panel}px`);
  }

  /** Clears effects when a level starts. */
  reset(): void {
    this.shots = [];
    this.parts = [];
    this.decals = [];
    this.pies = [];
    this.fallen = [];
    this.zaps = [];
    this.fired.clear();
    this.hitAt.clear();
    this.facing.clear();
    this.lastX.clear();
    this.shake = 0;
    this.flash = 0;
    this.built.clear();
    this.cheer = 0;
    this.parade = 0;
    this.leaksThisWave = 0;
  }

  /** A tower was built or upgraded at (col, row): dust, sparkle and a pop-in. */
  built_(id: number, col: number, row: number, upgrade: boolean): void {
    this.built.set(id, 0);
    const x = col + 0.5;
    const y = row + 0.75;
    for (let i = 0; i < 9; i++) this.parts.push(this.particle(x, y, i % 2 ? "#c79a62" : "#e8ddc8", "dot", 0.07, 0.6));
    if (upgrade) {
      this.ring(x, row + 0.5, "#f2c94c", 0.9);
      for (let i = 0; i < 5; i++) this.parts.push(this.particle(x, row + 0.4, "#ffe27a", "star", 0.07, 0.8));
    }
  }

  /** Victory: confetti rains over the field for a couple of seconds and Cath cheers. */
  celebrate(): void {
    this.parade = 2.2;
    this.cheer = 4;
  }

  /** The point under the pointer, in cell units. */
  worldAt(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - this.view.offX) / this.view.cellSize,
      y: (clientY - rect.top - this.view.offY) / this.view.cellSize,
    };
  }

  /** The screen position of a cell's centre, in client pixels. */
  cellCenter(col: number, row: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: rect.left + this.view.offX + (col + 0.5) * this.view.cellSize, y: rect.top + this.view.offY + (row + 0.5) * this.view.cellSize };
  }

  /** Which way the enemy nearest this x was walking, so a fallen one tips forward. */
  private lastFacing(x: number): 1 | -1 {
    let best: 1 | -1 = 1;
    let bd = Infinity;
    for (const [id, lx] of this.lastX) {
      const d = Math.abs(lx - x);
      if (d < bd) {
        bd = d;
        best = this.facing.get(id) ?? 1;
      }
    }
    return best;
  }

  cellAt(clientX: number, clientY: number, game: Game): { col: number; row: number } | null {
    const p = this.worldAt(clientX, clientY);
    const col = Math.floor(p.x);
    const row = Math.floor(p.y);
    if (col < 0 || row < 0 || col >= game.level.cols || row >= game.level.rows) return null;
    return { col, row };
  }

  /** Is (clientX, clientY) on Cath? */
  onHero(clientX: number, clientY: number, game: Game): boolean {
    const p = this.worldAt(clientX, clientY);
    const h = game.hero;
    return Math.abs(p.x - h.x) < 0.35 && p.y > h.y - 0.75 && p.y < h.y + 0.25;
  }

  feed(events: GameEvent[], game: Game): void {
    this.farm.feed(events, game);
    for (const e of events) {
      switch (e.type) {
        case "shot": {
          this.fired.set(e.tower, 0);
          const spec = e.spec ?? (e.look ? (LOOK_SPEC[e.look] ?? null) : null);
          const life =
            e.look === "hawk" ? 0.16 : e.kind === "silo" ? 0.12 : e.kind === "beehive" ? 0.35 : e.kind === "cannon" ? 0.4 : e.kind === "scarecrow" && spec === 0 ? 0.32 : 0.22;
          this.shots.push({
            kind: e.kind,
            spec,
            ...(e.look ? { look: e.look } : {}),
            x: e.fromX,
            y: e.fromY - 0.35,
            toX: e.toX,
            toY: e.toY - 0.1,
            age: 0,
            life,
            crit: !!e.crit,
            enemy: e.enemy,
          });
          // Plan item 676: a muzzle puff that hangs about the tower's top for most of a second, so a still frame
          // shows which towers are firing (the shot itself lives a fifth of a second).
          if (this.parts.length < 400) {
            const tint = fireTint(e.kind, spec);
            for (let i = 0; i < 3; i++) {
              const p = this.particle(e.fromX + (i - 1) * 0.11, e.fromY - 0.42 - (i % 2) * 0.07, tint, "puff", 0.14 + (i === 1 ? 0.05 : 0), PUFF);
              p.vx = (i - 1) * 0.12;
              p.vy = this.reducedMotion ? 0 : -0.45 - i * 0.08;
              p.g = 0;
              this.parts.push(p);
            }
          }
          break;
        }
        case "knock": {
          // A layer (or several) knocked off: a puff in the colour of the rung underneath, and the Marks it paid
          // gathered into one gold floater per moment (merged over GOLD_WINDOW).
          const under = e.to ? RUNGS[e.to]?.colour : RUNGS[e.from]?.colour;
          // Plan item 19: a pop bursts. Flakes of the shell knocked off, a white shock ring, a couple of sparks.
          if (this.parts.length < 400 && !this.reducedMotion) {
            const n = e.from === "lorry" && e.to ? 12 : 7;
            this.shardBursts++;
            const shell = RUNGS[e.from]?.colour ?? "#f4f6f8";
            for (let i = 0; i < n; i++) this.parts.push(this.particle(e.x, e.y - 0.15, i % 2 ? shell : (under ?? "#f4f6f8"), "square", 0.065, 0.5));
            for (let i = 0; i < 2; i++) this.parts.push(this.particle(e.x, e.y - 0.2, "#ffe27a", "star", 0.05, 0.4));
            const ring = this.particle(e.x, e.y - 0.12, "rgba(255,255,255,0.85)", "ring", 0.42, 0.22);
            ring.vx = ring.vy = ring.g = 0;
            this.parts.push(ring);
          }
          const tw = e.tower !== undefined ? game.towers.find((x) => x.id === e.tower) : undefined;
          if (tw) this.gain(tw.col + 0.5, tw.row + 0.5 - 0.95, e.n, tw.id);
          else {
            this.gold.n += e.n;
            this.gold.x = e.x;
            this.gold.y = e.y;
          }
          break;
        }
        case "wreck": {
          if (this.parts.length < 400 && !this.reducedMotion) for (let i = 0; i < 24; i++) this.parts.push(this.particle(e.x, e.y - 0.15, i % 3 ? (RUNGS[e.kind]?.colour ?? "#f2c230") : "#3b3f44", "square", 0.09, 0.8));
          // Its wreckage stays on the verge until the round is over.
          for (let i = 0; i < 4; i++) {
            const a = this.rand() * Math.PI * 2;
            const r = 0.25 + this.rand() * 0.25;
            this.debris.push({ x: e.x + Math.cos(a) * r, y: e.y + Math.sin(a) * r * 0.6, color: i % 2 ? (RUNGS[e.kind]?.colour ?? "#f2c230") : "#3b3f44", rot: this.rand() * Math.PI, size: 0.05 + this.rand() * 0.05 });
          }
          if (this.debris.length > 140) this.debris.splice(0, this.debris.length - 140);
          break;
        }
        case "kill": {
          if (e.bounty === 0) {
            // Fleet: the last layer just leaves a scrap of parcel tape (its Mark came with the knock).
            if (this.parts.length < 400) this.burst(e.x, e.y - 0.05, 0.7);
            break;
          }
          if (this.fallen.length < 24)
            this.fallen.push({ kind: e.kind, x: e.x, y: e.y, facing: this.lastFacing(e.x), age: 0 });
          this.burst(e.x, e.y, isBig(e.kind) ? 2.5 : 1);
          this.gain(e.x, e.y - 0.3, e.bounty, undefined, isBig(e.kind) ? 1.4 : 1);
          if (isBig(e.kind)) {
            this.kick(0.5);
            this.flashOnce("255,240,200", 0.5);
            this.confetti(e.x, e.y);
          }
          break;
        }
        case "split":
          this.ring(e.x, e.y, "#ffffff", 0.9);
          break;
        case "leak":
          this.leaksThisWave++;
          if (!this.reducedMotion) this.tossed.push({ x: e.x, y: e.y, age: 0 });
          if (this.moodCheer > 1.2) this.moodWorry = 0;
          this.kick(0.3);
          this.flashOnce("220,40,30", 0.35);
          this.float(e.x, e.y - 0.4, `-${e.lost ?? 1} Goodwill`, "#ff8f80", 1.1);
          break;
        case "rally":
        case "neighbours":
          this.heroCast = 0;
          this.castPie = false;
          break;
        case "pie": {
          const h = game.hero;
          this.heroThrew = 0;
          this.heroCast = 0;
          this.castPie = true;
          if (e.x !== undefined && e.y !== undefined)
            this.pies.push({
              fromX: h.x,
              fromY: h.y - 0.6,
              x: e.x,
              y: e.y,
              r: e.radius ?? 1.7,
              age: 0,
              life: 0.35,
              landed: false,
            });
          break;
        }
        case "swing":
          this.heroSwung = 0;
          this.impact(e.x, e.y - 0.15);
          break;
        case "heroDown":
          this.kick(0.25);
          this.float(game.hero.x, game.hero.y - 1, "Cath's winded!", "#ffd0c4", 1);
          break;
        case "heroUp":
          this.float(game.hero.x, game.hero.y - 1, "Back on her feet", "#e8ffd0", 0.9);
          this.ring(game.hero.x, game.hero.y - 0.3, "#f2c94c", 0.8);
          break;
        case "injunction":
          this.float(e.x, e.y - 0.9, "INJUNCTION!", "#fff6d6", 1.1);
          for (let i = 0; i < 6; i++)
            this.parts.push(this.particle(e.x, e.y - 0.6, "#fffdf6", "square", 0.12, 0.9));
          break;
        case "cleared": {
          const end = game.level.path[game.level.path.length - 1]!;
          // Plan item 64: the round's words and Marks are main.ts's rosette (clear of plots); the field cheers.
          if (this.leaksThisWave === 0) this.cheer = 2.5;
          this.moodCheer = 0;
          for (let i = 0; i < 14; i++) this.parts.push(this.particle(end[0] + 0.5, end[1] + 0.2, "#f2c94c", "star", 0.08, 1));
          break;
        }
        case "bossMove": {
          this.kick(0.35);
          this.ring(e.x, e.y - 0.3, "#d93a2f", 2.2);
          const short: Record<string, string> = {
            spawn: "Reinforcements!",
            charge: "CHARGE!",
            stomp: "CRUNCH!",
            pulse: "Activation!",
            mend: "Wellness drop!",
            takeover: "Hostile takeover!",
          };
          this.float(e.x, e.y - 1.1, short[e.move] ?? "!", "#ffb3a8", 1.35);
          for (const id of e.towers) {
            const t = game.towers.find((x) => x.id === id);
            if (!t) continue;
            this.zaps.push({ x: e.x, y: e.y - 0.3, toX: t.col + 0.5, toY: t.row + 0.2, age: 0, life: 0.45 });
            for (let i = 0; i < 8; i++) this.parts.push(this.particle(t.col + 0.5, t.row + 0.4, "#9aa0a6", "square", 0.07, 0.7));
          }
          if (e.move === "mend") for (let i = 0; i < 16; i++) this.parts.push(this.particle(e.x, e.y - 0.3, "#7fd1b9", "star", 0.07, 0.9));
          break;
        }
        case "gust":
          if (e.sweep) {
            // Whirling Scythe: a ring of cut straw.
            this.ring(e.x, e.y, "#e2c06a", e.radius);
            for (let i = 0; i < 10; i++) this.parts.push(this.particle(e.x, e.y - 0.3, "#e2c06a", "square", 0.05, 0.5));
            this.fired.set(e.tower, 0);
            break;
          }
          this.ring(e.x, e.y, "#e8f4ff", e.radius);
          for (let i = 0; i < 8; i++) this.parts.push(this.particle(e.x, e.y - 0.2, "#ffffff", "dot", 0.06, 0.6));
          break;
        case "bale":
          // A round bale rolls out: straw flies where it lands.
          this.ring(e.x, e.y, "#d8b45a", 0.5);
          for (let i = 0; i < 8; i++) this.parts.push(this.particle(e.x, e.y - 0.2, "#d8b45a", "square", 0.05, 0.6));
          this.fired.set(e.tower, 0);
          break;
        case "pile":
          for (let i = 0; i < 5; i++) this.parts.push(this.particle(e.x, e.y - 0.1, "#e9e1cf", "dot", 0.04, 0.4));
          break;
        case "pop":
          this.float(e.x, e.y - 0.5, "POP!", "#d2ecff", 0.9);
          for (let i = 0; i < 10; i++) this.parts.push(this.particle(e.x, e.y - 0.2, "#e6f4ff", "dot", 0.05, 0.6));
          break;
        case "rankUp":
          this.float(e.x, e.y - 0.9, `Veteran ${"★".repeat(e.rank)}`, "#f2c94c", 1.05);
          this.ring(e.x, e.y, "#f2c94c", 0.8);
          break;
        case "merge":
          this.kick(0.3);
          this.ring(e.x, e.y, "#f2c94c", 1.6);
          this.float(e.x, e.y - 1, MEGAS[e.mega].name, "#fff2b8", 1.3);
          for (let i = 0; i < 20; i++) this.parts.push(this.particle(e.x, e.y - 0.3, "#f2c94c", "star", 0.08, 1));
          break;
        case "ambush":
          this.ring(e.x, e.y, "#d93a2f", 1.2);
          this.float(e.x, e.y - 0.8, "Ambush here!", "#ffb3a8", 1.2);
          break;
        case "duelEnd":
          this.kick(0.4);
          this.float(game.hero.x, game.hero.y - 1.2, e.won ? "Cath wins the duel!" : "Cath's knocked back", e.won ? "#fff2b8" : "#ffd0c4", 1.3);
          break;
        case "flood":
          this.ring(e.x, e.y, "#4f93b8", 3);
          this.float(e.x, e.y - 0.8, e.warn ? "The river's rising…" : "FLOOD!", "#bfe4ff", 1.2);
          break;
        case "bridge":
          this.float(e.x, e.y - 0.7, e.open ? "Bridge up!" : "Bridge down", e.open ? "#ffb3a8" : "#e8ffd0", 0.9);
          break;
        case "wave":
          this.leaksThisWave = 0;
          if (e.early) {
            const h = game.hero;
            this.float(h.x, h.y - 1.1, `Early! +${e.early}`, "#ffe27a", 1.1);
          }
          break;
      }
    }
  }

  private particle(x: number, y: number, color: string, shape: Particle["shape"], size: number, life: number): Particle {
    const a = this.rand() * Math.PI * 2;
    const v = 0.6 + this.rand() * 1.8;
    return {
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 1.6,
      g: 5,
      age: 0,
      life: life * (0.7 + this.rand() * 0.6),
      size: size * (0.7 + this.rand() * 0.6),
      color,
      shape,
      rot: this.rand() * 6,
      vr: (this.rand() - 0.5) * 12,
    };
  }

  private burst(x: number, y: number, scale: number): void {
    const n = Math.round(9 * scale);
    for (let i = 0; i < n; i++) this.parts.push(this.particle(x, y, i % 3 ? "#c79a62" : "#f4f6f8", "square", 0.09 * scale, 0.8));
    for (let i = 0; i < 4 * scale; i++) this.parts.push(this.particle(x, y, "#ffe27a", "star", 0.07, 0.6));
    const p = this.particle(x, y, "rgba(255,255,255,0.8)", "ring", 0.6 * scale, 0.35);
    p.vx = p.vy = p.g = 0;
    this.parts.push(p);
    if (this.decals.length < 120) this.decals.push({ x, y: y + 0.1, r: 0.22 * scale, color: "rgba(60,45,30,0.25)", age: 0, life: 6 });
  }

  private confetti(x: number, y: number): void {
    const cols = ["#c4433a", "#f2c94c", "#3f6fb5", "#5f8f3f", "#e8748b"];
    for (let i = 0; i < 40; i++) {
      const p = this.particle(x, y, cols[i % cols.length]!, "square", 0.08, 1.6);
      p.vy -= 2;
      p.g = 3;
      this.parts.push(p);
    }
  }

  private ring(x: number, y: number, color: string, size: number): void {
    const p = this.particle(x, y, color, "ring", size, 0.4);
    p.vx = p.vy = p.g = 0;
    this.parts.push(p);
  }

  private impact(x: number, y: number): void {
    const p = this.particle(x, y, "#fff6d6", "star", 0.16, 0.25);
    p.vx = p.vy = p.g = 0;
    this.parts.push(p);
    for (let i = 0; i < 3; i++) this.parts.push(this.particle(x, y, "#e8ddc8", "dot", 0.05, 0.4));
  }

  /** Plan item 706: adds a gain to the live number within GAIN_MERGE_PX of (x, y) (cells), else starts one there. */
  private gain(x: number, y: number, n: number, tower?: number, big = 1): void {
    if (!(n > 0)) return;
    const r = GAIN_MERGE_PX / Math.max(1, this.cellPx);
    const near = this.gains.find((g) => Math.hypot(g.x + g.dx - x, g.y + g.dy - y) < r || Math.hypot(g.x - x, g.y - y) < r);
    if (near) {
      near.n += n;
      near.quiet = 0;
      near.big = Math.max(near.big, big);
      return;
    }
    this.gains.push({ x, y, dx: 0, dy: 0, n, quiet: 0, big, placed: false, ...(tower !== undefined ? { tower } : {}) });
  }

  /** Plan item 706: the live gains as drawn last frame (CSS px from the canvas corner), for the e2e tests. */
  gainRects(): Array<{ x: number; y: number; w: number; h: number; n: number; size: number }> {
    return this.gainDrawn.map((g) => ({ ...g }));
  }

  /** Plan item 736 (tests): the text floats as drawn last frame (CSS px from the canvas corner). */
  floatRects(): Array<{ x: number; y: number; w: number; h: number; text: string }> {
    return this.floatDrawn.map((f) => ({ ...f }));
  }

  private floatDrawn: Array<{ x: number; y: number; w: number; h: number; text: string }> = [];

  /** Plan item 736 (tests): vehicles drawn again last frame over a tower sprite that covered them. */
  redrawn = 0;
  /** Plan item 736 (tests): vehicles a tower sprite still covers last frame (0). */
  underSprite = 0;

  /** Plan item 743: each tower sprite's drawn box this frame (CSS px), kept clear by the gains. */
  private towerCovers: Rect[] = [];

  /** Plan item 742: each tower sprite's solid foot on the ground this frame (CSS px). */
  private towerFeet: Rect[] = [];

  /** Plan item 742 (tests): the tower sprites' solid feet last frame. */
  footRects(): Rect[] {
    return this.towerFeet.map((r) => ({ ...r }));
  }

  /** Plan item 743 (tests): the tower sprites' drawn boxes last frame. */
  towerRects(): Rect[] {
    return this.towerCovers.map((r) => ({ ...r }));
  }

  private gainDrawn: Array<{ x: number; y: number; w: number; h: number; n: number; size: number }> = [];

  private drawGains(game: Game, dt: number, X: (v: number) => number, Y: (v: number) => number, s: number): void {
    const { ctx } = this;
    this.cellPx = s;
    this.gainDrawn = [];
    const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    for (const g of this.gains) g.quiet += dt;
    this.gains = this.gains.filter((g) => g.quiet <= GAIN_LIFE && (g.tower === undefined || game.towers.some((tw) => tw.id === g.tower)));
    // Plan item 736: at most MAX_FLOATS numbers (text floats included); past that the oldest fades out first.
    const texts = this.parts.filter((p) => p.shape === "text").length;
    for (let i = 0, over = this.gains.length + texts - MAX_FLOATS; i < this.gains.length && over > 0; i++, over--) this.gains[i]!.quiet = Math.max(this.gains[i]!.quiet, GAIN_HOLD);
    const M = FIELD_MARGIN;
    const merged = new Set<Gain>();
    for (const g of this.gains) {
      const text = `+${Math.floor(g.n)}`;
      const fs = Math.max(GAIN_MIN_PX, Math.round(s * (0.26 + Math.min(0.14, Math.log10(1 + g.n) * 0.06)) * g.big));
      ctx.save();
      ctx.font = `800 ${fs}px ${FONT}`;
      const w = ctx.measureText(text).width + fs * 0.3;
      const h = fs * 1.1;
      const box = (cx: number, cy: number): Rect => ({ x: X(cx) - w / 2, y: Y(cy) - h / 2, w, h });
      if (!g.placed) {
        // Where it first shows: the spot as given, else the nearest of a few steps up and aside that covers no vehicle,
        // no other tower, no badge, no barn, and stands GAIN_MERGE_PX clear of the other numbers.
        g.placed = true;
        // Plan item 743: every tower's drawn sprite, its own included ('+99' sat on its scarecrow's hat at P l34,
        // '+29' under a hedge's canopy at P l27, when the keep-clear was one cell and skipped the paying tower).
        const towers = this.towerCovers;
        const others = this.gains.filter((o) => o !== g && o.placed);
        const clear = (dx: number, dy: number) => {
          const b = box(g.x + dx, g.y + dy);
          if (b.x < M || b.y < M || b.x + b.w > this.cssW - M || b.y + b.h > this.cssH - M) return false;
          if ([this.vehicleBoxes, towers, this.badgeBoxes, this.barnBoxes, this.depotBoxes].some((boxes) => boxes.some((v) => overlaps(b, v)))) return false;
          return others.every((o) => Math.hypot(X(o.x + o.dx) - X(g.x + dx), Y(o.y + o.dy) - Y(g.y + dy)) >= GAIN_MERGE_PX);
        };
        const steps: Array<[number, number]> = [[0, 0], [0, -0.5], [0, -1], [-0.9, -0.4], [0.9, -0.4], [-1.3, 0], [1.3, 0], [0, -1.6], [0, 0.8], [-1.2, -1.2], [1.2, -1.2],
          // plan item 743: wide sprites and a tower on the top row (no room above): further aside, then below it
          [-1.8, 0], [1.8, 0], [-1.8, -0.8], [1.8, -0.8], [0, 1.7], [-1.3, 1.2], [1.3, 1.2], [0, 2.2]];
        const ok = steps.find(([dx, dy]) => clear(dx, dy));
        if (ok) [g.dx, g.dy] = ok;
        else {
          // Plan item 736: nowhere clear (two '+107's stood side by side at P l34): it joins the nearest number.
          const host = others.filter((o) => !merged.has(o)).sort((a, b) => Math.hypot(a.x - g.x, a.y - g.y) - Math.hypot(b.x - g.x, b.y - g.y))[0];
          if (host) {
            host.n += g.n;
            host.quiet = Math.min(host.quiet, g.quiet);
            merged.add(g);
            ctx.restore();
            continue;
          }
        }
      }
      const rise = this.reducedMotion ? 0 : Math.max(0, g.quiet - GAIN_HOLD) * 0.9;
      // Kept FIELD_MARGIN inside the field as it rises (l27's '+57' stood cut at the phone's left edge).
      let cx = Math.max(M + w / 2, Math.min(this.cssW - M - w / 2, X(g.x + g.dx)));
      // Plan item 743: a number that widened as it counted up (P l34's '+103') steps sideways off the sprite it met.
      for (const t of this.towerCovers) {
        const top = Y(g.y + g.dy) - h / 2;
        if (!(cx - w / 2 < t.x + t.w && cx + w / 2 > t.x && top < t.y + t.h && top + h > t.y)) continue;
        const left = t.x - w / 2 - 1;
        const right = t.x + t.w + w / 2 + 1;
        const fits = (c: number) => c >= M + w / 2 && c <= this.cssW - M - w / 2;
        const best = [left, right].filter(fits).sort((a, b) => Math.abs(a - cx) - Math.abs(b - cx))[0];
        if (best !== undefined && Math.abs(best - cx) < w) cx = best;
      }
      let cy = Math.max(M + h / 2, Math.min(this.cssH - M - h / 2, Y(g.y + g.dy) - rise * s));
      // Plan item 742: and one that grew as it counted into a sprite (l34 D's '+56' came to rest 0.3 px into the
      // scarecrow under it, '+103' between two stacked towers) moves to the nearest spot just off that sprite that meets
      // no tower and stays inside the field.
      {
        const meets = (x: number, y: number) => this.towerCovers.some((t) => x - w / 2 < t.x + t.w && x + w / 2 > t.x && y - h / 2 < t.y + t.h && y + h / 2 > t.y);
        const inside = (x: number, y: number) => x >= M + w / 2 && x <= this.cssW - M - w / 2 && y >= M + h / 2 && y <= this.cssH - M - h / 2;
        if (meets(cx, cy)) {
          const spots: Array<[number, number]> = [];
          for (const t of this.towerCovers) {
            if (!(cx - w / 2 < t.x + t.w && cx + w / 2 > t.x && cy - h / 2 < t.y + t.h && cy + h / 2 > t.y)) continue;
            spots.push([cx, t.y - h / 2 - 0.5], [cx, t.y + t.h + h / 2 + 0.5], [t.x - w / 2 - 0.5, cy], [t.x + t.w + w / 2 + 0.5, cy]);
          }
          const best = spots.filter(([x, y]) => inside(x, y) && !meets(x, y)).sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy))[0];
          if (best && Math.hypot(best[0] - cx, best[1] - cy) < s * 1.5) [cx, cy] = best;
        }
      }
      // and it never rises into a lane's badge or a depot (P l34's '+236' rose into the badge over Hollowell).
      const risen = { x: cx - w / 2, y: cy - h / 2, w, h };
      if (rise > 0 && [this.badgeBoxes, this.depotBoxes].some((boxes) => boxes.some((v) => overlaps(risen, v)))) cy = Math.max(M + h / 2, Math.min(this.cssH - M - h / 2, Y(g.y + g.dy)));
      ctx.globalAlpha = 1 - Math.max(0, (g.quiet - GAIN_HOLD) / (GAIN_LIFE - GAIN_HOLD));
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.lineWidth = Math.max(3, fs * 0.22);
      ctx.strokeStyle = "rgba(43,30,8,0.9)";
      ctx.fillStyle = "#ffe27a";
      ctx.strokeText(text, cx, cy);
      ctx.fillText(text, cx, cy);
      ctx.restore();
      this.gainDrawn.push({ x: cx - w / 2, y: cy - h / 2, w, h, n: Math.floor(g.n), size: fs });
    }
    if (merged.size) this.gains = this.gains.filter((g) => !merged.has(g));
  }

  private float(x: number, y: number, text: string, color: string, big = 1): void {
    // Plan item 736: at most MAX_FLOATS text floats; a new one retires the oldest.
    const live = this.parts.filter((p) => p.shape === "text");
    if (live.length >= MAX_FLOATS) live[0]!.age = live[0]!.life;
    this.parts.push({ x, y, vx: 0, vy: -0.9, g: 0, age: 0, life: 1.1, size: 0.3, color, shape: "text", rot: 0, vr: 0, text, big });
  }

  /** Plan item 480: the doorstep's animations running now (handcarts up the lane, the win's sweep), for tests. */
  stepAnims(): { carts: number; sweep: boolean } {
    return { carts: this.carts.length, sweep: !!this.sweep };
  }

  /** Plan item 480: starts a handcart for each new return and the sweep when the win clears the step. */
  private watchStep(d: DoorstepView | null): void {
    const returned = d?.returned ?? 0;
    if (returned < this.cartsSeen) this.cartsSeen = returned;
    while (this.cartsSeen < returned) {
      this.cartsSeen++;
      if (!this.reducedMotion) this.carts.push(0);
    }
    const was = this.stepWas;
    if (d?.won && was && was.shown > 0 && d.shown === 0 && !this.reducedMotion) this.sweep = { n: was.shown, age: 0 };
    this.stepWas = d ? { ...d } : null;
  }

  private kick(amount: number): void {
    if (!this.reducedMotion) this.shake = Math.max(this.shake, amount);
  }

  private flashOnce(rgb: string, amount: number): void {
    this.flashColor = rgb;
    this.flash = Math.max(this.flash, amount);
  }

  /** Plan item 59: the act's crop on every empty plot at its stage, the win's harvest wave, cross-faded. */
  private drawCrops(game: Game, bgKey: string, dt: number): void {
    if (this.cropGame !== game) {
      this.cropGame = game;
      this.wonAt = null;
      this.cropKey = "";
      this.cropsOld = null;
    }
    if (game.phase === "won") this.wonAt ??= this.clock;
    else this.wonAt = null;
    const stages = shownCrops(game, this.wonAt === null ? null : this.clock - this.wonAt);
    const occupied = occupiedPlots(game);
    let sig = "";
    for (const [k, st] of stages) sig += occupied.has(k) ? "x" : st;
    const ck = `${bgKey}|${sig}`;
    if (ck !== this.cropKey) {
      const resized = !this.cropKey.startsWith(`${bgKey}|`);
      this.cropsOld = resized ? null : this.crops;
      this.cropFade = resized ? 1 : 0;
      const c = document.createElement("canvas");
      c.width = this.canvas.width;
      c.height = this.canvas.height;
      const cctx = c.getContext("2d")!;
      cctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      const { cellSize: s, offX, offY } = this.view;
      const crop = cropOf(game.level);
      for (const [k, st] of stages) {
        if (st === 0 || occupied.has(k)) continue;
        const [col, row] = k.split(",").map(Number) as [number, number];
        drawCrop(cctx, crop, st, offX + col * s, offY + row * s, s, col * 31 + row * 17 + game.level.id);
      }
      this.crops = c;
      this.cropKey = ck;
      this.canvas.dataset.ripe = String(ripeCount(stages, occupied));
      this.canvas.dataset.cropSig = sig;
      this.canvas.dataset.harvest = this.wonAt === null ? "" : "1";
    }
    const { ctx } = this;
    this.cropFade = Math.min(1, this.cropFade + dt / 0.45);
    if (this.cropsOld && this.cropFade < 1) {
      ctx.globalAlpha = 1 - this.cropFade;
      ctx.drawImage(this.cropsOld, 0, 0, this.cssW, this.cssH);
    }
    if (this.crops) {
      ctx.globalAlpha = this.cropFade;
      ctx.drawImage(this.crops, 0, 0, this.cssW, this.cssH);
    }
    ctx.globalAlpha = 1;
  }

  draw(game: Game, dt: number): void {
    const { ctx } = this;
    const { cellSize: s, offX, offY } = this.view;
    // Plan item 370: cast shadows fall away from this act's sun, as in the 3D view.
    // Plan item 485: and the sun crosses the sky over the level, morning to dusk: the phase moves on as a round ends
    // (the build phase shows the next round's light, so it never turns mid-wave), eased over 1.2 s, stepped under
    // reduced motion; low sun, longer shadows.
    const dayTo = dayPhase(Math.max(1, game.phase === "build" ? game.wave + 1 : game.wave), game.level.waves.length);
    // (on wall-clock time: between rounds the game's dt is 0 while it waits on Go, and the light would never move on)
    const nowMs = performance.now();
    const wall = this.dayAt ? Math.min(0.1, (nowMs - this.dayAt) / 1000) : 0;
    this.dayAt = nowMs;
    if (this.day < 0 || this.reducedMotion || game.level.id !== this.dayLevel) this.day = dayTo;
    else this.day += Math.sign(dayTo - this.day) * Math.min(Math.abs(dayTo - this.day), wall / 1.2);
    this.dayLevel = game.level.id;
    const away = dayShadowDir(game.level.id, this.day);
    const len = dayShadowLength(this.day);
    setShadowSun({ x: away.x * len, y: away.y * len });
    setLamps(dayLamps(this.day));
    this.clock += dt;
    this.cheer = Math.max(0, this.cheer - dt);
    this.gold.age += dt;
    if (this.gold.age >= GOLD_WINDOW) {
      const n = Math.floor(this.gold.n);
      if (n >= 1) {
        this.gain(this.gold.x, this.gold.y - 0.3, n);
        this.gold.n -= n;
      }
      this.gold.age = 0;
    }
    if (this.parade > 0) {
      this.parade -= dt;
      const cols = ["#f2c94c", "#d93a2f", "#7fd1b9", "#fff6d6", "#e58fb3"];
      for (let i = 0; i < Math.ceil(dt * 40); i++) {
        const p = this.particle(this.rand() * game.level.cols, -0.3, cols[i % cols.length]!, i % 2 ? "square" : "star", 0.09, 1.8);
        p.vx *= 0.3;
        p.vy = 0.8 + this.rand();
        p.g = 0.8;
        this.parts.push(p);
      }
    }
    const t = this.clock;
    const level = game.level;
    const W = this.cssW;
    const H = this.cssH;
    const X = (v: number) => offX + v * s;
    const Y = (v: number) => offY + v * s;

    // The painted field, cached.
    const key = `${level.id}:${W}x${H}:${s}:${this.dpr}:${isWonLevel(level.id) ? "won" : ""}`;
    if (key !== this.bgKey) {
      this.bg = document.createElement("canvas");
      this.bg.width = this.canvas.width;
      this.bg.height = this.canvas.height;
      const bctx = this.bg.getContext("2d")!;
      bctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      paintBackground(bctx, level, { width: W, height: H, cell: s, offX, offY });
      // Plan item 568: the field in the 3D diorama's colour: the painted beds read grey-teal beside it (saturation 0.24
      // against 0.42 at level 21), so the baked ground is lifted once here (no per-frame filter).
      {
        const grade = document.createElement("canvas");
        grade.width = this.bg.width;
        grade.height = this.bg.height;
        const gctx = grade.getContext("2d");
        if (gctx && "filter" in gctx) {
          gctx.filter = `saturate(${BG_SATURATE})`;
          gctx.drawImage(this.bg, 0, 0);
          bctx.save();
          bctx.setTransform(1, 0, 0, 1, 0, 0);
          bctx.clearRect(0, 0, this.bg.width, this.bg.height);
          bctx.drawImage(grade, 0, 0);
          bctx.restore();
        }
      }
      // Plan item 497: the country round the field steps back: a soft warm veil over everything outside the field's
      // own rectangle (14%, deepening a little toward the frame's edges), so the lane, plots and towers lead and the
      // margins' huts, boats and trees read as setting, as the 3D diorama's haze does. Baked once with the field.
      {
        const fx0 = X(0), fy0 = Y(0), fx1 = X(level.cols), fy1 = Y(level.rows);
        bctx.save();
        bctx.beginPath();
        bctx.rect(0, 0, W, H);
        bctx.rect(fx0 - s * 0.12, fy0 - s * 0.12, fx1 - fx0 + s * 0.24, fy1 - fy0 + s * 0.24);
        bctx.clip("evenodd");
        bctx.fillStyle = "rgba(246, 238, 218, 0.14)";
        bctx.fillRect(0, 0, W, H);
        const edge = bctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.hypot(W, H) * 0.6);
        edge.addColorStop(0, "rgba(246, 238, 218, 0)");
        edge.addColorStop(1, "rgba(246, 238, 218, 0.12)");
        bctx.fillStyle = edge;
        bctx.fillRect(0, 0, W, H);
        bctx.restore();
      }
      crayonNextBillboard(false);
      this.marginPieces = (lastMargin?.pieces ?? []).filter((p) => LIVE_PIECES.has(p.kind));
      this.bgKey = key;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.save();
    if (this.shake > 0) {
      const m = this.shake * s * 0.12;
      ctx.translate((this.rand() - 0.5) * m, (this.rand() - 0.5) * m);
      this.shake = Math.max(0, this.shake - dt * 1.6);
    }
    if (this.bg) ctx.drawImage(this.bg, 0, 0, W, H);
    this.drawCrops(game, key, dt);
    // Plan item 202: the margins' gulls wheel and the mill's wheel turns.
    if (!this.reducedMotion && this.marginPieces.length) drawMarginLife(ctx, this.marginPieces, s, t);

    // Decals: crumbs, cream, scorch.
    for (const d of this.decals) {
      d.age += dt;
      ctx.globalAlpha = Math.max(0, 1 - d.age / d.life);
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.ellipse(X(d.x), Y(d.y), d.r * s, d.r * s * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    this.decals = this.decals.filter((d) => d.age < d.life);

    this.drawSelection(game, X, Y, s, t);
    // Plan item 297: the plot her line means: a pulsing dashed ring and a ghost of the tower she advises.
    if (this.coach && !this.selected && game.phase === "build") {
      const cx = X(this.coach.col + 0.5);
      const cy = Y(this.coach.row + 0.5);
      const pulse = this.reducedMotion ? 0.5 : (Math.sin(t * 4) + 1) / 2;
      ctx.save();
      // Plan item 447: a faint dotted line from Cath to the plot she means, so her tip reads as her pointing there
      // (it stops at the ring; none when she stands on the plot itself).
      const hx = X(game.hero.x);
      const hy = Y(game.hero.y - 0.45);
      const len = Math.hypot(cx - hx, cy - hy);
      if (len > s * 0.9) {
        const ex = cx - ((cx - hx) / len) * s * 0.52;
        const ey = cy - ((cy - hy) / len) * s * 0.52;
        ctx.setLineDash([s * 0.05, s * 0.11]);
        ctx.lineDashOffset = this.reducedMotion ? 0 : -t * s * 0.3;
        ctx.lineCap = "round";
        ctx.lineWidth = Math.max(2, s * 0.045);
        ctx.strokeStyle = `rgba(255, 236, 160, ${0.45 + pulse * 0.2})`;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.globalAlpha = 0.42;
      drawTower(ctx, { kind: this.coach.kind, tier: 1, spec: null, fired: 9, dazed: false, still: true }, cx, cy, s, 0);
      ctx.globalAlpha = 1;
      ctx.lineWidth = Math.max(2.5, s * 0.05);
      ctx.setLineDash([s * 0.12, s * 0.08]);
      ctx.lineDashOffset = this.reducedMotion ? 0 : -t * s * 0.4;
      ctx.strokeStyle = `rgba(255, 236, 160, ${0.75 + pulse * 0.25})`;
      ctx.shadowColor = "rgba(255, 210, 90, 0.8)";
      ctx.shadowBlur = 6 + pulse * 6;
      ctx.beginPath();
      ctx.arc(cx, cy, s * (0.48 + pulse * 0.03), 0, Math.PI * 2);
      ctx.stroke();
      // Plan item 392: a tap on her plate sends two rings out from the plot she means.
      const since = (performance.now() - this.coachPulseAt) / 1000;
      if (since >= 0 && since < 1.2) {
        ctx.setLineDash([]);
        for (const k of [0, 0.35]) {
          const f = (since - k) / 0.85;
          if (f < 0 || f > 1) continue;
          ctx.strokeStyle = `rgba(255, 236, 160, ${1 - f})`;
          ctx.lineWidth = Math.max(3, s * 0.07) * (1 - f * 0.5);
          ctx.beginPath();
          ctx.arc(cx, cy, s * (0.5 + f * (this.reducedMotion ? 0.2 : 0.9)), 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // Sprites in depth order.
    // Plan item 736: a vehicle's box (`veh`) and a tower's sprite box (`cover`): a vehicle a tower sprite drawn later
    // covers is drawn again over it (l34's lorries passed under the hedge and the duck pond at the junction).
    const items: Array<{ y: number; draw: () => void; veh?: Rect; cover?: Rect }> = [];
    const end = level.path[level.path.length - 1]!;
    const side = end[0] >= level.cols - 2 ? -1 : 1;
    items.push({
      y: end[1] + 0.84,
      draw: () => {
        drawFarmhouse(ctx, X(end[0] + 0.5), Y(end[1] + 0.5), s, t, game.goodwill / game.maxGoodwill, kitFor(level).house);
        // Plan item 480: Hollowell's parcels on the step, the newest still arcing in over 400 ms.
        const d = this.doorstep;
        this.watchStep(d);
        for (const p of this.tossed) p.age += dt;
        this.tossed = this.tossed.filter((p) => p.age < 0.4).slice(-Math.max(0, d?.shown ?? 0));
        if (d && (d.shown || d.card)) {
          const flying = this.tossed.map((p) => ({ from: [X(p.x), Y(p.y)] as [number, number], p: p.age / 0.4 }));
          drawDoorstep(ctx, d, X(end[0] + 0.5), Y(end[1] + 0.5), s, flying, side);
        }
        // Plan item 480: the win's harvest sweeps the step clear.
        if (this.sweep) {
          this.sweep.age += dt;
          if (this.sweep.age >= SWEEP_SECONDS) this.sweep = null;
          else drawSweep(ctx, this.sweep.n, X(end[0] + 0.5), Y(end[1] + 0.5), s, this.sweep.age / SWEEP_SECONDS, side);
        }
      },
    });
    // Plan item 480: after a clean round two neighbours cart a parcel off the step and up the lane toward the depot.
    if (this.carts.length) {
      for (let k = 0; k < this.carts.length; k++) this.carts[k]! += dt;
      this.carts = this.carts.filter((a) => a < CART_SECONDS);
      const len = pathLength(level.path);
      for (const age of this.carts) {
        const p = age / CART_SECONDS;
        const back = Math.min(len, 0.35 + p * 2.6);
        const at = pointAt(level.path, len - back);
        const ahead = pointAt(level.path, len - back - 0.3);
        const dir = ahead.x < at.x - 0.01 ? -1 : ahead.x > at.x + 0.01 ? 1 : side;
        const alpha = Math.min(1, age / 0.25) * Math.min(1, (CART_SECONDS - age) / 0.6);
        items.push({ y: at.y + 0.3, draw: () => drawCart(ctx, X(at.x), Y(at.y + 0.3), s, age, dir, alpha) });
      }
    }
    if (this.doorstep?.sale) {
      const gate = level.path[0]!;
      items.push({ y: gate[1] + 0.5, draw: () => drawSaleBoard(ctx, X(gate[0] + 0.5), Y(gate[1] + 0.5), s) });
    }
    this.towerCovers = [];
    this.towerFeet = [];
    for (const tw of game.towers) {
      const since = this.fired.get(tw.id) ?? 9;
      const age = this.built.get(tw.id);
      if (age !== undefined) this.built.set(tw.id, age + dt);
      const pop = age !== undefined && age < 0.35 && !this.reducedMotion ? popScale(age / 0.35) : 1;
      this.fired.set(tw.id, since + dt);
      const reach = fieldReach(tw.kind, tw.tier, tw.path);
      const fit = reach.fit;
      const up = Math.max(1.05, reach.up) * s;
      const half = Math.max(0.5, reach.half) * s;
      const cover = { x: X(tw.col + 0.5) - half, y: Y(tw.row + 0.5) - up, w: half * 2, h: s * 0.5 + up };
      this.towerCovers.push(cover);
      {
        const f = towerFoot(tw.kind, tw.tier, tw.path);
        const k = FIELD_TOWER * fit.scale * s;
        const cy = Y(tw.row + 0.5) - fit.lift * s;
        this.towerFeet.push({ x: X(tw.col + 0.5) - f.half * k * fit.squeeze, y: cy + 0.05 * k, w: f.half * k * fit.squeeze * 2, h: (f.below - 0.05) * k });
      }
      items.push({
        y: tw.row + 0.8,
        cover,
        draw: () => {
          if (pop !== 1) {
            ctx.save();
            ctx.translate(X(tw.col + 0.5), Y(tw.row + 0.8));
            ctx.scale(pop, pop);
            ctx.translate(-X(tw.col + 0.5), -Y(tw.row + 0.8));
          }
          if (tw.mega && tw.annex) {
            // A megastructure: its partner stands on the annex plot, both on one gilded plinth.
            const other = MEGAS[tw.mega].from[0] === tw.kind ? MEGAS[tw.mega].from[1] : MEGAS[tw.mega].from[0];
            ctx.save();
            ctx.fillStyle = "rgba(242,201,76,0.35)";
            ctx.strokeStyle = "#d4ae58";
            const ax = Math.min(tw.col, tw.annex[0]);
            const ay = Math.min(tw.row, tw.annex[1]);
            const w = Math.abs(tw.col - tw.annex[0]) + 1;
            const h = Math.abs(tw.row - tw.annex[1]) + 1;
            ctx.beginPath();
            ctx.roundRect(X(ax + 0.08), Y(ay + 0.08), X(ax + w - 0.08) - X(ax + 0.08), Y(ay + h - 0.08) - Y(ay + 0.08), s * 0.15);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
            drawTower(ctx, { kind: other, tier: 4, spec: null, fired: since, dazed: false }, X(tw.annex[0] + 0.5), Y(tw.annex[1] + 0.5), s, t + tw.id);
          }
          // Plan item 742: its solid foot fitted inside the plot (a little smaller and narrower where it was wider).
          const fitted = fit.scale !== 1 || fit.lift !== 0;
          if (fitted) {
            ctx.save();
            ctx.translate(X(tw.col + 0.5), Y(tw.row + 0.5) - fit.lift * s);
            ctx.scale(fit.squeeze, 1);
            ctx.translate(-X(tw.col + 0.5), -Y(tw.row + 0.5));
          }
          drawTower(
            ctx,
            {
              kind: tw.kind,
              tier: tw.tier,
              spec: tw.spec ?? null,
              fired: since,
              dazed: game.phase === "wave" && towerStats(tw).damage > 0 && charmed(game, tw),
              ...(tw.path ? { path: tw.path } : {}),
              still: this.reducedMotion,
            },
            X(tw.col + 0.5),
            Y(tw.row + 0.5),
            // Plan item 322: on the field a tower stands 1.2x its cell, so it rises proud over the plot's edge
            s * FIELD_TOWER * fit.scale,
            t + tw.id * 0.37,
          );
          if (fitted) ctx.restore();
          if (tw.crown !== undefined) {
            // A Crown (M5): a gold ring under the tower and a little crown over it.
            ctx.save();
            ctx.strokeStyle = "#ffd35a";
            ctx.lineWidth = Math.max(2, s * 0.05);
            ctx.beginPath();
            ctx.ellipse(X(tw.col + 0.5), Y(tw.row + 0.5) + s * 0.3, s * 0.42, s * 0.16, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = "#ffd35a";
            const cx = X(tw.col + 0.5);
            const cy = Y(tw.row + 0.5) - s * 0.62;
            ctx.beginPath();
            ctx.moveTo(cx - s * 0.14, cy + s * 0.1);
            ctx.lineTo(cx - s * 0.14, cy - s * 0.04);
            ctx.lineTo(cx - s * 0.07, cy + s * 0.03);
            ctx.lineTo(cx, cy - s * 0.08);
            ctx.lineTo(cx + s * 0.07, cy + s * 0.03);
            ctx.lineTo(cx + s * 0.14, cy - s * 0.04);
            ctx.lineTo(cx + s * 0.14, cy + s * 0.1);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }
          if (pop !== 1) ctx.restore();
          this.knockedOut(tw.out ?? 0, X(tw.col + 0.5), Y(tw.row + 0.5), s, t);
        },
      });
    }
    this.fallen = this.fallen.filter((f) => (f.age += dt) < 0.7);
    for (const f of this.fallen) {
      const k = Math.min(1, f.age / 0.28);
      const ease = 1 - (1 - k) * (1 - k);
      items.push({
        y: f.y + 0.2,
        draw: () => {
          const fx = X(f.x);
          const fy = Y(f.y + 0.2);
          ctx.save();
          ctx.globalAlpha = Math.max(0, Math.min(1, (0.7 - f.age) / 0.35));
          ctx.translate(fx, fy);
          ctx.rotate(-f.facing * ease * 1.45);
          ctx.translate(-fx, -fy);
          drawEnemy(ctx, { kind: f.kind, facing: f.facing, hit: 9, ghost: false, phase: 0 }, fx, fy, s, 0);
          ctx.restore();
          // Plan item 285: as it tips, its parcels spill out of the back and tumble across the lane (not under
          // reduced motion: the tip alone tells it).
          if (!this.reducedMotion) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, Math.min(1, (0.7 - f.age) / 0.3));
            const u = Math.min(1, f.age / 0.5);
            for (let i = 0; i < 3; i++) {
              const dir = -f.facing * (0.5 + i * 0.35);
              const px = fx + dir * s * 0.7 * u;
              const py = fy - s * 0.18 - Math.sin(u * Math.PI) * s * (0.22 + i * 0.07);
              const b = s * (0.17 - i * 0.025);
              ctx.save();
              ctx.translate(px, py);
              ctx.rotate(dir * u * 2.4);
              ctx.fillStyle = "#c79a62";
              ctx.strokeStyle = INK;
              ctx.lineWidth = Math.max(1, s * 0.015);
              ctx.fillRect(-b / 2, -b / 2, b, b * 0.8);
              ctx.strokeRect(-b / 2, -b / 2, b, b * 0.8);
              ctx.fillStyle = "#e6d3a6";
              ctx.fillRect(-b * 0.08, -b / 2, b * 0.16, b * 0.8);
              ctx.restore();
            }
            ctx.restore();
          }
        },
      });
    }
    const alive = new Set<number>();
    this.layOut(game, X, Y, s);
    this.clearBends(game, X, Y, s);
    for (const col of this.lay.columns) {
      const cp = enemyPoint(level, { dist: col.dist, ...(col.lane ? { lane: col.lane } : {}) });
      items.push({ y: cp.y + 0.2, draw: () => this.drawColumns(game, ctx, X, Y, s, t, col) });
    }
    // Plan item 72: between rounds the next round queues at the Hollowell gate (its leads on the lane, a count
    // plate), so the threat is on screen before Go. Go clears it: the real convoy pulls out from the same spot.
    this.shownQueue = null;
    const queue = this.nextQueue(game);
    if (queue) {
      this.queueAge = Math.min(1, this.queueAge + dt / 0.4);
      const shown: { leads: Rect[]; plates: Rect[]; names: Rect[] } = { leads: [], plates: [], names: [] };
      this.shownQueue = shown;
      const lanes: Array<{ leads: GateQueue["leads"]; count: number; lane?: 1 }> = [{ leads: queue.leads, count: queue.count }];
      if (level.path2) lanes.push({ leads: queue.leads2, count: queue.count2, lane: 1 });
      // Plan item 259: the plots' boxes (as drawn, inset in their cells), so the count plate keeps off them.
      let plotRects: Rect[] | null = null;
      const plots = (): Rect[] => {
        if (plotRects) return plotRects;
        plotRects = [];
        for (let r = 0; r < level.rows; r++)
          for (let c = 0; c < level.cols; c++)
            if (isPlot(level, c, r)) plotRects.push({ x: X(c) + s * 0.1, y: Y(r) + s * 0.1, w: s * 0.8, h: s * 0.8 });
        return plotRects;
      };
      // Plan item 378: and off the gate's sign (item 259 keeps it on the lane by the gate rather than on plots).
      let signRects: Rect[] | null = null;
      const signs = (): Rect[] => {
        if (signRects) return signRects;
        ctx.save();
        signRects = (level.path2 ? [level.path, level.path2] : [level.path]).map((pth) => {
          const g = gateSignRect(level, pth, { width: this.cssW, height: this.cssH, cell: s, offX: X(0), offY: Y(0) }, ctx);
          return { x: g.sx, y: g.sy, w: g.sw, h: g.sh };
        });
        ctx.restore();
        return signRects;
      };
      for (const ln of lanes) {
        if (!ln.count) continue;
        const path = ln.lane ? level.path2! : level.path;
        // The first to pull out stands furthest down the lane; the rest wait bumper to bumper behind it, towards
        // the gate (spaced by their sprites' lengths, so lorries don't overlap).
        // Plan item 266: the 1.4x size only where the lane runs across, straight, for the sprite's length: the sprites
        // are drawn side-on, so on a lane running up or down, or at a bend, a bigger one overhung the plots.
        const across = (dd: number) => [dd - 0.4, dd, dd + 0.4].every((x) => {
          const hh = headingAt(path, Math.max(0, x));
          return Math.abs(hh.dx) > Math.abs(hh.dy);
        });
        // Plan item 273: one size per queue (a queue in two sizes at a bend read as two convoys): the bigger only when
        // every vehicle of it stands on a straight run across.
        // Plan item 380: spaced along the path, two side-on sprites round a bend stood closer in a straight line than
        // their length and overlapped (level 34's Same-Day vans); each is pushed on along the lane until the straight
        // gap to the one behind it holds too.
        const at = (dd: number) => enemyPoint(level, { dist: dd, ...(ln.lane ? { lane: ln.lane } : {}) });
        const lay = (q: number) => {
          const ds: number[] = [];
          let d = this.depotMouths.get(ln.lane ?? 0) ?? 0.15;
          for (let i = ln.leads.length - 1; i >= 0; i--) {
            if (i < ln.leads.length - 1) {
              const need = (0.42 * (enemyScale(ln.leads[i]!) + enemyScale(ln.leads[i + 1]!)) + 0.06) * q;
              const prev = at(ds[i + 1]!);
              for (let k = 0; k < 30; k++) {
                const p = at(d);
                if (Math.hypot(p.x - prev.x, p.y - prev.y) >= need * 0.98) break;
                d += 0.05;
              }
            }
            ds[i] = d;
            if (i > 0) d += (0.42 * (enemyScale(ln.leads[i]!) + enemyScale(ln.leads[i - 1]!)) + 0.06) * q;
          }
          return ds;
        };
        const big = lay(QUEUE_SCALE);
        const allAcross = big.every((d) => across(d));
        const dists = allAcross ? big : lay(1);
        const qs = dists.map(() => (allAcross ? QUEUE_SCALE : 1));
        ln.leads.forEach((kind, i) => {
          const d = dists[i]!;
          const p = enemyPoint(level, { dist: d, ...(ln.lane ? { lane: ln.lane } : {}) });
          const hd = headingAt(path, d);
          // Plan item 497: staggered a touch across the lane (parked, not on rails)
          const gy = p.y + 0.2 + (i % 2 ? 0.05 : -0.03) * (Math.abs(hd.dx) > Math.abs(hd.dy) ? 1 : 0);
          const q = qs[i]!;
          const sc = s * q * enemyScale(kind) * 0.55;
          const box = { x: X(p.x) - sc / 2, y: Y(gy) - sc, w: sc, h: sc, big: q > 1 };
          const at = shown.leads.push(box);
          // Plan item 256: the first to pull out carries its name, on its far side from the one behind it, clear of
          // the rest of the queue.
          if (i === 0)
            items.push({
              y: 99.5,
              draw: () => {
                const behind = ln.leads.length > 1 ? shown.leads[at] : undefined;
                // ...and off Cath's figure.
                const hp = this.heroPx();
                const cath = { x: X(game.hero.x) - hp.w / 2, y: Y(game.hero.y) - hp.h, w: hp.w, h: hp.h + s * 0.3 };
                const r = this.namePlate(ctx, ENEMIES[kind].name, box, s, [...shown.leads, ...shown.plates, cath, ...this.depotBoxes], behind, plots(), this.driverImg(kind));
                if (r) shown.names.push(r);
              },
            });
          items.push({
            y: gy,
            draw: () => {
              ctx.save();
              ctx.globalAlpha = this.queueAge;
              drawEnemy(ctx, { kind, facing: hd.dx < 0 ? -1 : 1, hit: 9, ghost: false, phase: i * 0.37, still: true }, X(p.x), Y(gy), s * q, t);
              ctx.restore();
            },
          });
        });
        const tail = enemyPoint(level, { dist: 0, ...(ln.lane ? { lane: ln.lane } : {}) });
        const upright = headingAt(path, 0).dx === 0;
        // Plan item 157: where Hollowell's depot stands by this gate its departures board carries the count instead.
        if (!this.depotLanes.has(ln.lane ?? 0))
          items.push({ y: 99, draw: () => shown.plates.push(this.countPlate(ctx, ln.count, X(tail.x), Y(tail.y), s, upright, plots(), [...shown.leads, ...signs()])) });
      }
    } else this.queueAge = 0;
    for (const e of game.enemies) {
      alive.add(e.id);
      if (this.lay.inColumn.has(e.id)) continue;
      const p = this.placeEnemy(level, e);
      const lx = this.lastX.get(e.id);
      // Plan item 497: a vehicle's first frame near the gate (it pulls out of the queue) kicks up a puff of lane dust.
      if (lx === undefined && e.dist < 1.2 && !this.reducedMotion && this.parts.length < 380) {
        this.rolloutDust++;
        for (let i = 0; i < 6; i++) this.parts.push(this.particle(p.x, p.y + 0.22, i % 2 ? "#a8875a" : "#8a6a44", "dot", 0.085, 0.6));
      }
      if (lx !== undefined && Math.abs(p.x - lx) > 0.0005) this.facing.set(e.id, p.x > lx ? 1 : -1);
      this.lastX.set(e.id, p.x);
      const since = this.hitAt.get(e.id) ?? 9;
      this.hitAt.set(e.id, since + dt);
      const gy = p.y + 0.2;
      // Plan item 657: turned for the run it is drawn on (a vehicle the convoy holds back round a bend stood upright
      // on a level run when this used its true place).
      const heading = runOf(level, { dist: this.lay.slots.get(e.id)?.dist ?? e.dist, lane: e.lane ?? null });
      items.push({
        y: gy,
        veh: this.vehicleBox(level, e, X, Y, s),
        draw: () => {
          drawEnemy(
            ctx,
            {
              kind: e.kind,
              facing: this.facing.get(e.id) ?? 1,
              hit: since,
              ghost: !isRevealed(game, e),
              phase: (e.id % 7) * 0.31,
              shield: e.shield,
              still: this.reducedMotion,
              heading,
            },
            X(p.x),
            Y(gy),
            s,
            e.stun > 0 || e.held ? t * 0.15 : t,
          );
          this.drawStatus(e, X(p.x), Y(gy), s, t);
          // Plan item 285: from above (an up/down run, `drawEnemy` turns the body a quarter about its centre), the
          // body's overlays turn with it.
          const run = TOP_DOWN.has(e.kind) ? heading : undefined;
          // Plan item 707: a Fleet rung on a level run is drawn from above too; its overlays lie over the roof.
          const level2 = !run && FLEET_TOP[e.kind] !== undefined;
          if (run || level2) {
            const cy = Y(gy) - s * enemyScale(e.kind) * 0.2;
            ctx.save();
            ctx.translate(X(p.x), cy);
            if (run) ctx.rotate(run === "down" ? Math.PI / 2 : -Math.PI / 2);
            else ctx.translate(0, s * enemyScale(e.kind) * 0.04);
            ctx.translate(-X(p.x), -cy);
          }
          // Fleet properties (Hedgerow 2 section 2): each lock tints the body in its own material.
          if (e.pm) this.drawMaterial(ctx, e.pm, e.kind, X(p.x), Y(gy), s);
          const crack = crackStage(e.kind, e.hp, maxHpOf(e));
          if (crack) this.drawCracks(ctx, crack, e.kind, X(p.x), Y(gy), s, t);
          if (run || level2) ctx.restore();
        },
      });
    }
    for (const id of [...this.facing.keys()]) if (!alive.has(id)) {
      this.facing.delete(id);
      this.lastX.delete(id);
      this.hitAt.delete(id);
    }
    const h = game.hero;
    this.heroSwung += dt;
    this.heroThrew += dt;
    this.heroCast += dt;
    this.moodCheer += dt;
    this.moodWorry += dt;
    this.moodPlant += dt;
    if (game.towers.length > this.towersSeen && this.towersSeen >= 0) this.moodPlant = 0;
    this.towersSeen = game.towers.length;
    const mood = (this.heroCast < CAST_S && !this.castPie) || this.moodCheer < 1.4 ? "cheer" : this.moodWorry < 1.4 ? "worried" : this.moodPlant < 1.2 ? "plant" : "rest";
    this.levelBeat += dt;
    this.heroMood = this.heroSwung < 0.3 && h.down === 0 ? "swing" : mood;
    const walking = Math.hypot(h.tx - h.x, h.ty - h.y) > 0.03 && h.down === 0;
    if (walking && !this.reducedMotion) {
      if (!this.printFrom || Math.hypot(h.x - this.printFrom.x, h.y - this.printFrom.y) > 0.16) {
        const ang = Math.atan2(h.ty - h.y, h.tx - h.x);
        this.printLeft = !this.printLeft;
        const off = (this.printLeft ? 1 : -1) * 0.05;
        this.prints.push({ x: h.x - Math.sin(ang) * off, y: h.y + 0.2 + Math.cos(ang) * off, a: 0, ang });
        this.printFrom = { x: h.x, y: h.y };
      }
    } else if (!walking) this.printFrom = null;
    for (const fp of this.prints) fp.a += dt;
    this.prints = this.prints.filter((fp) => fp.a < 1);
    for (const fp of this.prints)
      items.push({
        y: fp.y - 0.3,
        draw: () => {
          ctx.save();
          ctx.globalAlpha = 0.62 * (1 - fp.a * fp.a);
          ctx.fillStyle = "#2e1f12";
          ctx.translate(X(fp.x), Y(fp.y));
          ctx.rotate(fp.ang);
          ctx.beginPath();
          ctx.ellipse(0, 0, s * 0.055, s * 0.026, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        },
      });
    // Cath's post between rounds: green when a tower reaches it, amber when nothing does. Plan item 565: a mat on the
    // ground under her feet, drawn before her figure (a full ring drawn over her read as a target on the road).
    const post = postMarker(game, this.heroSelected ? this.postPreview : null);
    if (post) items.push({
      y: post.y + 0.21,
      draw: () => {
        ctx.save();
        ctx.strokeStyle = post.covered ? "rgba(141,255,138,0.95)" : "rgba(255,179,71,0.95)";
        ctx.fillStyle = post.covered ? "rgba(141,255,138,0.22)" : "rgba(255,179,71,0.22)";
        ctx.lineWidth = 2.5;
        ctx.setLineDash(this.heroSelected ? [6, 5] : []);
        ctx.lineDashOffset = -t * 20;
        ctx.beginPath();
        ctx.ellipse(X(post.x), Y(post.y + 0.22), s * 0.4, s * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      },
    });
    // Plan item 713: her cast, staged over 0.8 s: a gold burst opens behind her and fades (under reduced motion a glow
    // that only fades), drawn just before her figure.
    if (this.heroCast < CAST_S && h.down === 0) {
      const k = this.heroCast / CAST_S;
      items.push({
        y: h.y + 0.215,
        draw: () => {
          const cx = X(h.x);
          const cy = Y(h.y + 0.22) - s * this.heroScale() * 0.45;
          const r = s * (this.reducedMotion ? 0.9 : 0.5 + k * 0.9);
          ctx.save();
          ctx.globalAlpha = k < 0.12 ? k / 0.12 : Math.pow(1 - (k - 0.12) / 0.88, 1.4);
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
          g.addColorStop(0, this.castPie ? "rgba(255,236,190,0.95)" : "rgba(255,226,122,0.95)");
          g.addColorStop(0.55, this.castPie ? "rgba(255,190,120,0.45)" : "rgba(242,201,76,0.45)");
          g.addColorStop(1, "rgba(242,201,76,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fill();
          if (!this.reducedMotion) {
            // Eight rays turning out from her.
            ctx.strokeStyle = "rgba(255,214,77,1)";
            ctx.lineWidth = Math.max(2, s * 0.05);
            ctx.lineCap = "round";
            for (let i = 0; i < 8; i++) {
              const a = (i / 8) * Math.PI * 2 + k * 0.6;
              ctx.beginPath();
              ctx.moveTo(cx + Math.cos(a) * r * 0.6, cy + Math.sin(a) * r * 0.6);
              ctx.lineTo(cx + Math.cos(a) * r * 1.05, cy + Math.sin(a) * r * 1.05);
              ctx.stroke();
            }
          }
          ctx.restore();
        },
      });
    }
    // Plan item 132: the site poster (`?keyart`) stands its own Cath in front, so the field leaves hers out.
    const keyart = typeof document !== "undefined" && document.documentElement.dataset.keyart !== undefined;
    if (!hasTwist(level, "nocath") && !this.harvesting && !keyart) items.push({
      y: h.y + 0.22,
      draw: () => {
        drawHero(
          ctx,
          {
            facing: h.facing,
            walking,
            swung: this.heroSwung,
            down: h.down > 0,
            threw: this.heroThrew,
            selected: this.heroSelected,
            mood,
            still: this.reducedMotion,
          },
          X(h.x),
          Y(h.y + 0.22),
          // Plan item 114: she stands a head taller than the towers she leads (she was their height).
          s * this.heroScale(),
          t,
          h.down > 0 || mood === "worried" || (game.goodwill <= game.maxGoodwill / 3 && game.phase === "wave")
            ? this.faceWorried
            : this.cheer > 0 || mood === "cheer"
              ? this.faceCheer
              : this.face,
        );
        // Plan item 492: on the Fleet, where she grows through a run, her level is an inked rosette at her feet.
        if (level.rules === "fleet") this.levelRosette(X(h.x) + s * this.heroScale() * 0.2, Y(h.y + 0.22) - s * 0.02, s, h.level);
      },
    });
    // Plan item 143: the farmfolk, y-sorted with everything else on the field.
    this.shownFolk = this.harvesting || keyart ? [] : this.farm.step(game, dt, this.reducedMotion);
    for (const f of this.shownFolk) items.push({ y: f.y, draw: () => drawFolk(ctx, f, X(f.x), Y(f.y), s, t) });
    if (game.phase !== "wave") this.debris.length = 0;
    for (const d of this.debris) {
      ctx.save();
      ctx.translate(X(d.x), Y(d.y));
      ctx.rotate(d.rot);
      ctx.fillStyle = d.color;
      ctx.globalAlpha = 0.85;
      ctx.fillRect((-d.size * s) / 2, (-d.size * s) / 3, d.size * s, (d.size * s * 2) / 3);
      ctx.restore();
    }
    // Fallen oaks lie across their plots until cleared. Plan item 603: drawn on the ground, under the sorted items
    // (vehicles, Cath, the name plates): drawn after them, a log covered the 'n' of 'Same-Day van' at P l34.
    for (const [c, r] of level.oaks ?? []) {
      if (!oakAt(game, c, r)) continue;
      ctx.fillStyle = "#5a4128";
      ctx.fillRect(X(c) + (X(1) - X(0)) * 0.1, Y(r) + (Y(1) - Y(0)) * 0.38, (X(1) - X(0)) * 0.8, (Y(1) - Y(0)) * 0.24);
      ctx.fillStyle = "#4f7d34";
      ctx.beginPath();
      ctx.arc(X(c) + (X(1) - X(0)) * 0.25, Y(r) + (Y(1) - Y(0)) * 0.5, (X(1) - X(0)) * 0.16, 0, Math.PI * 2);
      ctx.fill();
    }
    items.sort((a, b) => a.y - b.y);
    this.columnChips = [];
    for (const it of items) it.draw();
    this.redrawn = 0;
    this.underSprite = 0;
    const meets = (v: Rect, c: Rect) => v.x < c.x + c.w && v.x + v.w > c.x && v.y < c.y + c.h && v.y + v.h > c.y;
    const last = items.map((_, i) => i);
    for (let i = 0; i < items.length; i++) {
      const v = items[i]!.veh;
      if (!v) continue;
      if (items.slice(i + 1).some((it) => it.cover && meets(v, it.cover))) {
        items[i]!.draw();
        last[i] = items.length;
        this.redrawn++;
      }
    }
    // (tests) a vehicle a tower sprite drawn after its last draw still meets
    for (let i = 0; i < items.length; i++) {
      const v = items[i]!.veh;
      if (v && items.some((it, j) => j > last[i]! && it.cover && meets(v, it.cover))) this.underSprite++;
    }
    for (const chip of this.columnChips) chip();
    // Plan item 706: the pooled gains, each one "+N" that counts up while it keeps paying, then rises and fades.
    this.drawGains(game, dt, X, Y, s);
    // Blackout: the field is dark except where the towers and Cath give light.
    const dark = setPiece(level, "blackout");
    if (dark) {
      const c = (this.darkCanvas ??= document.createElement("canvas"));
      c.width = ctx.canvas.width;
      c.height = ctx.canvas.height;
      const d = c.getContext("2d");
      if (d) {
        d.setTransform(ctx.getTransform());
        d.fillStyle = "rgba(8,10,24,0.82)";
        d.fillRect(-1e4, -1e4, 2e4, 2e4);
        d.globalCompositeOperation = "destination-out";
        const lights: Array<[number, number]> = game.towers.filter((tw) => (tw.out ?? 0) <= 0).map((tw) => [tw.col + 0.5, tw.row + 0.5]);
        if (game.hero.down <= 0) lights.push([game.hero.x, game.hero.y]);
        for (const [lx, ly] of lights) {
          const g = d.createRadialGradient(X(lx), Y(ly), 0, X(lx), Y(ly), dark.light * s);
          g.addColorStop(0, "rgba(0,0,0,1)");
          g.addColorStop(0.75, "rgba(0,0,0,0.9)");
          g.addColorStop(1, "rgba(0,0,0,0)");
          d.fillStyle = g;
          d.beginPath();
          d.arc(X(lx), Y(ly), dark.light * s, 0, Math.PI * 2);
          d.fill();
        }
        d.globalCompositeOperation = "source-over";
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(c, 0, 0);
        ctx.restore();
      }
    }

    // Cath's health and where she's heading.
    if (walking) this.flag(X(h.tx), Y(h.ty + 0.2), s, t);
    if (!hasTwist(level, "nocath")) this.heroBar(game, X(h.x), Y(h.y + 0.22) - s * 0.98, s);

    // Property icons: a row of small roundels over every vehicle that carries one (at least 10 px).
    const icon = Math.max(10, s * 0.17);
    for (const e of game.enemies) {
      if (!e.pm) continue;
      const props = propIconsFor(e.pm);
      if (!props.length || this.lay.inColumn.has(e.id)) continue;
      const p = this.placeEnemy(level, e);
      const k = enemyScale(e.kind);
      const top = Y(p.y + 0.2) - s * (0.5 * k + enemyLift(e.kind) + 0.12) - icon * 0.9;
      const x0 = X(p.x) - ((props.length - 1) * icon * 1.05) / 2;
      props.forEach((pr, i) => drawPropIcon(ctx, pr, x0 + i * icon * 1.05, top, icon));
    }

    // Health bars over sprites.
    for (const e of game.enemies) {
      const max = maxHpOf(e);
      // Health bars only on shells with more than one layer to them (section 8's budget).
      if (e.hp >= max || max <= 1 || !isRevealed(game, e) || this.lay.inColumn.has(e.id)) continue;
      const p = this.placeEnemy(level, e);
      const k = enemyScale(e.kind);
      const top = Y(p.y + 0.2) - s * (0.5 * k + enemyLift(e.kind) + 0.12);
      bar(ctx, X(p.x), top, s * 0.5 * Math.min(1.6, k), Math.max(3, s * 0.06), e.hp / max);
    }

    // Swarms (plan item 10): a queue of more than 12 gets a count badge with its make-up by type.
    // Plan item 45: where the queue has a column, the badge rides its head (the column says how many wait).
    const rode = this.badged;
    rode.clear();
    // Plan item 695: the towers' screen boxes (the cell and the sprite's height over it), for the badges to keep off.
    // Plan item 721: as tall as its sprite draws (the windmill's sails, the mast's tip), not a flat 1.05 cells over its centre.
    this.towerBoxes = game.towers.map((tw) => {
      const r = fieldReach(tw.kind, tw.tier, tw.path);
      const up = Math.max(1.05, r.up) * s;
      const half = Math.max(0.5, r.half) * s;
      return { x: X(tw.col + 0.5) - half, y: Y(tw.row + 0.5) - up, w: half * 2, h: s * 0.5 + up };
    });
    this.badgeBoxes = [];
    // Plan item 700: and the vehicles drawn on the lanes (l27's '181 103 51 9' sat on the lorries it counted).
    this.vehicleBoxes = [];
    for (const e of game.enemies) {
      if (this.lay.inColumn.has(e.id)) continue;
      this.vehicleBoxes.push(this.vehicleBox(level, e, X, Y, s));
    }
    // Plan item 706: the lanes as dots (CSS px, every quarter cell), for the badges to dock off the road.
    this.laneDots = [];
    for (const path of [level.path, level.path2]) {
      if (!path) continue;
      const len = pathLength(path);
      for (let d = 0; d <= len; d += 0.25) {
        const q = pointAt(path, d);
        this.laneDots.push({ x: X(q.x), y: Y(q.y) });
      }
    }
    this.laneR = s * 0.4;
    // and the barns (a badge docked over l34's farmhouse at P hid it)
    this.barnBoxes = (level.barns ?? []).map(([c, r]) => ({ x: X(c), y: Y(r) - s * 0.3, w: s, h: s * 1.3 }));
    // Plan item 706: one badge a lane, docked by its mouth (the depot), counting every pack on that lane: a badge per
    // pack (item 10) put seven pills over l34's late field at P. Its columns keep their own '+N' chips.
    const byLane = new Map<number, Swarm[]>();
    for (const sw of swarms(game.enemies)) byLane.set(sw.lane ?? 0, [...(byLane.get(sw.lane ?? 0) ?? []), sw]);
    for (const [lane, packs] of byLane) {
      const tally = new Map<EnemyKind, number>();
      for (const sw of packs) for (const k of sw.kinds) tally.set(k.kind, (tally.get(k.kind) ?? 0) + k.n);
      const merged: Swarm = {
        count: packs.reduce((n, sw) => n + sw.count, 0),
        dist: packs[0]!.dist,
        ...(lane ? { lane: 1 as const } : {}),
        kinds: [...tally].map(([kind, n]) => ({ kind, n })).sort((p, q) => q.n - p.n),
      };
      const path = lane && level.path2 ? level.path2 : level.path;
      const mouth = pointAt(path, 0.6);
      this.swarmBadge(ctx, merged, X(mouth.x), Y(mouth.y) - s * 0.1, s);
    }

    // Boss moves: a red crackle from the boss to each tower it knocked out.
    for (const z of this.zaps) {
      z.age += dt;
      const k = z.age / z.life;
      ctx.strokeStyle = `rgba(217,58,47,${1 - k})`;
      ctx.lineWidth = Math.max(2, s * 0.05);
      ctx.beginPath();
      ctx.moveTo(X(z.x), Y(z.y));
      for (let i = 1; i <= 6; i++) {
        const f = i / 6;
        const j = i === 6 ? 0 : (this.rand() - 0.5) * 0.3;
        ctx.lineTo(X(z.x + (z.toX - z.x) * f + j), Y(z.y + (z.toY - z.y) * f + j));
      }
      ctx.stroke();
    }
    this.zaps = this.zaps.filter((z) => z.age < z.life);
    // Charging bosses leave speed lines.
    for (const e of game.enemies) {
      if (!e.charge || e.charge <= 0) continue;
      const p = this.placeEnemy(level, e);
      const f = this.facing.get(e.id) ?? 1;
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const yy = Y(p.y) - s * (0.1 + i * 0.15);
        const xx = X(p.x) - f * s * (0.7 + ((t * 6 + i * 0.3) % 1) * 0.3);
        ctx.beginPath();
        ctx.moveTo(xx, yy);
        ctx.lineTo(xx - f * s * 0.35, yy);
        ctx.stroke();
      }
    }

    // Plan item 345: each barn stands in its own farmyard (packed earth, a rail fence, a bale), where the hens peck.
    // Plan item 399: or the act's own building (Saltmarsh's net shed, Rivermead's mill house).
    const barnLook = kitFor(level).barn;
    for (const [c, r] of level.barns ?? [])
      if (barnLook === "barn") drawFarmyard(ctx, X(c), Y(r), X(1) - X(0), c * 7 + r * 13 + level.id);
      else drawKitBarn(ctx, X(c), Y(r), X(1) - X(0), barnLook, c * 7 + r * 13 + level.id, t);
    // Set pieces: floodwater over the plots, and the swing bridge (up and red while it's open).
    const flood = setPiece(level, "flood");
    if (flood && game.wave >= flood.wave) {
      // Plan item 152: the river over its banks: deep water on each plot, a pale wet edge, and ripples that run
      // across it (each plot's on its own beat), so the flood reads as water, not a blue tile.
      const cw = X(1) - X(0);
      const ch = Y(1) - Y(0);
      for (const [c, r] of flood.cells) {
        const x0 = X(c) + 1, y0 = Y(r) + 1, w = cw - 2, h = ch - 2;
        ctx.fillStyle = `rgba(63,128,166,${0.72 + Math.sin(t * 2 + c) * 0.04})`;
        ctx.beginPath();
        ctx.roundRect(x0, y0, w, h, Math.min(w, h) * 0.22);
        ctx.fill();
        ctx.strokeStyle = "rgba(214,236,246,0.55)";
        ctx.lineWidth = Math.max(1, cw * 0.04);
        ctx.stroke();
        ctx.strokeStyle = "rgba(226,243,250,0.6)";
        ctx.lineWidth = Math.max(1, cw * 0.03);
        for (let k = 0; k < 2; k++) {
          const phase = (t * 0.35 + (c * 0.37 + r * 0.61) + k * 0.5) % 1;
          const yy = y0 + h * (0.28 + k * 0.4);
          const xx = x0 + w * (0.12 + phase * 0.5);
          ctx.beginPath();
          ctx.moveTo(xx, yy);
          ctx.quadraticCurveTo(xx + w * 0.09, yy - h * 0.07, xx + w * 0.18, yy);
          ctx.quadraticCurveTo(xx + w * 0.27, yy + h * 0.07, xx + w * 0.36, yy);
          ctx.stroke();
        }
      }
    }
    const bridge = setPiece(level, "bridge");
    if (bridge) {
      const bp = enemyPoint(level, { dist: bridge.dist, lane: bridge.lane });
      const open = bridgeOpen(game);
      ctx.save();
      ctx.translate(X(bp.x), Y(bp.y));
      ctx.fillStyle = "#4f93b8";
      ctx.fillRect(-s * 0.5, -s * 0.5, s, s);
      ctx.fillStyle = open ? "#c4433a" : "#8a5a35";
      ctx.strokeStyle = "#2b2320";
      ctx.lineWidth = 2;
      if (open) {
        ctx.fillRect(-s * 0.48, -s * 0.12, s * 0.96, s * 0.16);
        ctx.strokeRect(-s * 0.48, -s * 0.12, s * 0.96, s * 0.16);
      } else {
        for (let i = 0; i < 5; i++) {
          ctx.fillRect(-s * 0.45 + i * s * 0.18, -s * 0.45, s * 0.16, s * 0.9);
          ctx.strokeRect(-s * 0.45 + i * s * 0.18, -s * 0.45, s * 0.16, s * 0.9);
        }
      }
      ctx.restore();
    }

    // Thorn piles on the lane (Blackthorn path): a heap of cut thorn, smaller as its hits run out.
    for (const pile of game.piles) {
      const pp = enemyPoint(level, { dist: pile.dist, lane: pile.lane });
      drawThornPile(ctx, X(pp.x), Y(pp.y), s, Math.min(1, 0.45 + pile.hits / 20));
    }

    // Call the Neighbours: three farmhands with a hay bale, wobbling as the vans lean on them.
    if (game.barricade) {
      const bp = enemyPoint(level, game.barricade);
      const bx = X(bp.x);
      const by = Y(bp.y);
      const fade = Math.min(1, game.barricade.left / 1.5);
      ctx.globalAlpha = fade;
      ctx.fillStyle = "#d8b45a";
      ctx.strokeStyle = "#2b2320";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(bx - s * 0.42, by - s * 0.1, s * 0.84, s * 0.3, s * 0.1);
      ctx.fill();
      ctx.stroke();
      const shirts = ["#4f7fb0", "#c4433a", "#7fa65a"];
      for (let i = 0; i < 3; i++) {
        const fx = bx + (i - 1) * s * 0.3;
        const fy = by - s * 0.18 + Math.sin(t * 9 + i * 2) * s * 0.02;
        ctx.fillStyle = shirts[i]!;
        ctx.beginPath();
        ctx.roundRect(fx - s * 0.1, fy - s * 0.02, s * 0.2, s * 0.26, s * 0.06);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#f0c9a0";
        ctx.beginPath();
        ctx.arc(fx, fy - s * 0.1, s * 0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // Rally: a golden pulse around every tower.
    if (game.rallyLeft > 0) {
      ctx.strokeStyle = "rgba(242,201,76,0.85)";
      ctx.lineWidth = 3;
      for (const tw of game.towers) {
        ctx.beginPath();
        ctx.arc(X(tw.col + 0.5), Y(tw.row + 0.5), s * (0.5 + 0.08 * Math.sin(t * 10)), 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    this.drawShots(dt, X, Y, s);
    this.drawPies(dt, X, Y, s);
    this.drawParticles(dt, X, Y, s);

    // Pie aim preview.
    if (this.aim) {
      const { x, y, r } = this.aim;
      ctx.fillStyle = "rgba(255,246,214,0.22)";
      ctx.strokeStyle = "rgba(255,246,214,0.95)";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -t * 20;
      ctx.beginPath();
      ctx.arc(X(x), Y(y), r * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
    }

    this.sunGrade(W, H, dayShadowDir(level.id, this.day), daySunRgb(level.id, this.day));
    this.ambient(W, H, s, t);

    // Boss bar.
    const boss = game.enemies.filter((e) => isBig(e.kind)).sort((a, b) => b.dist - a.dist)[0];
    if (boss) {
      const bw = Math.min(W - 32, s * level.cols * 0.9);
      const bx = W / 2;
      const by = Math.max(14, offY - s * 0.05);
      ctx.font = `700 ${Math.max(12, Math.round(s * 0.2))}px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.fillStyle = "#fff";
      ctx.strokeText(ENEMIES[boss.kind].name, bx, by + s * 0.02);
      ctx.fillText(ENEMIES[boss.kind].name, bx, by + s * 0.02);
      bar(ctx, bx, by + s * 0.12, bw, Math.max(6, s * 0.1), boss.hp / maxHpOf(boss), true);
    }

    // Flash (leaks, boss kills).
    if (this.flash > 0) {
      const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.6);
      vg.addColorStop(0, `rgba(${this.flashColor},0)`);
      vg.addColorStop(1, `rgba(${this.flashColor},${Math.min(0.55, this.flash)})`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
      this.flash = Math.max(0, this.flash - dt * 1.4);
    }
    ctx.restore();
  }

  private drawSelection(game: Game, X: (v: number) => number, Y: (v: number) => number, s: number, t: number): void {
    const { ctx } = this;
    this.shownRing = null;
    const rangeRing = (cx: number, cy: number, r: number, tint: string) => {
      this.shownRing = { range: r, px: r * s, cell: s };
      // Plan item 152: in a sea fret the reach is dim and its edge soft (the twist cuts it by a fifth).
      const fret = hasTwist(game.level, "fog");
      ctx.fillStyle = tint;
      ctx.strokeStyle = fret ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.85)";
      ctx.lineWidth = fret ? 3 : 2;
      ctx.shadowColor = fret ? "rgba(255,255,255,0.6)" : "transparent";
      ctx.shadowBlur = fret ? 8 : 0;
      ctx.setLineDash([7, 5]);
      ctx.lineDashOffset = -t * 12;
      ctx.beginPath();
      ctx.arc(cx, cy, r * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";
    };
    this.shownOutlines = [];
    // Plan item 345: the field reads as fields, so the plots' own edges show only while building: with an empty plot
    // picked, every other plot a tower could go on gets a faint stitched outline (a dark under-stroke under a cream dash, 3:1+ on
    // any crop), so the next place to plant is plain without a tile grid the rest of the time.
    if (this.selected && game.phase === "build" && !towerAt(game, this.selected.col, this.selected.row)) {
      const pad = s * 0.1;
      const w = Math.max(2, s * 0.035);
      ctx.save();
      for (let r = 0; r < game.level.rows; r++)
        for (let c = 0; c < game.level.cols; c++) {
          if ((c === this.selected.col && r === this.selected.row) || !isPlot(game.level, c, r) || towerAt(game, c, r)) continue;
          if (isProtected(game.level, c, r) || barnAt(game.level, c, r) || oakAt(game, c, r)) continue;
          const x = X(c) + pad;
          const y = Y(r) + pad;
          const d = s - pad * 2;
          ctx.beginPath();
          ctx.roundRect(x, y, d, d, s * 0.14);
          ctx.setLineDash([]);
          ctx.lineWidth = w + 2;
          ctx.strokeStyle = PLOT_STITCH_UNDER;
          ctx.stroke();
          // Plan item 688: a soft, unbroken chalk line (it was a dashed stitch, which read as a level editor's grid).
          ctx.lineWidth = w;
          ctx.strokeStyle = PLOT_STITCH;
          ctx.stroke();
          this.shownOutlines.push({ col: c, row: r, width: w });
        }
      ctx.restore();
    }
    if (this.selected) {
      const { col, row } = this.selected;
      const tw = towerAt(game, col, row);
      if (tw) {
        const st = towerStats(tw);
        if (st.range > 0) rangeRing(X(col + 0.5), Y(row + 0.5), st.range, st.slow < 1 ? "rgba(140,220,120,0.16)" : "rgba(255,255,255,0.14)");
      } else if (this.preview) {
        const st = towerStats({ kind: this.preview, tier: 1, spec: null, high: plotKind(game.level, col, row) === "high" });
        if (st.range > 0) rangeRing(X(col + 0.5), Y(row + 0.5), st.range, "rgba(255,240,180,0.18)");
      }
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      const pad = s * 0.08;
      const pulse = (Math.sin(t * 5) + 1) * s * 0.015;
      ctx.beginPath();
      ctx.roundRect(X(col) + pad - pulse, Y(row) + pad - pulse, s - pad * 2 + pulse * 2, s - pad * 2 + pulse * 2, s * 0.14);
      ctx.stroke();
    }
    if (this.cursor && !this.selected) {
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 2;
      const pad = s * 0.08;
      ctx.beginPath();
      ctx.roundRect(X(this.cursor.col) + pad, Y(this.cursor.row) + pad, s - pad * 2, s - pad * 2, s * 0.14);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  /** A tower a boss has knocked out: greyed, with a countdown ring and a little cloud of dizziness. */
  private knockedOut(out: number, x: number, y: number, s: number, t: number): void {
    if (out <= 0) return;
    const { ctx } = this;
    ctx.fillStyle = "rgba(40,40,48,0.35)";
    ctx.beginPath();
    ctx.ellipse(x, y + s * 0.05, s * 0.4, s * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#d93a2f";
    ctx.lineWidth = Math.max(2.5, s * 0.05);
    ctx.beginPath();
    ctx.arc(x, y - s * 0.55, s * 0.13, -Math.PI / 2, -Math.PI / 2 + Math.min(1, out / 8) * Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = `800 ${Math.max(10, Math.round(s * 0.16))}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(Math.ceil(out)), x, y - s * 0.55);
    for (let i = 0; i < 3; i++) {
      const a = t * 3 + (i * Math.PI * 2) / 3;
      ctx.fillStyle = "#c9ccd1";
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * s * 0.25, y - s * 0.3 + Math.sin(a) * s * 0.06, s * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Crack stages (M5): dark fractures across a Heavy Plant's shell, and smoke from the last stage. */
  private drawCracks(ctx: CanvasRenderingContext2D, stage: number, kind: EnemyKind, x: number, y: number, s: number, t: number): void {
    const k = enemyScale(kind);
    const w = s * 0.78 * k;
    const h = s * 0.42 * k;
    const cy = y - s * (0.08 + enemyLift(kind)) - h * 0.5;
    ctx.save();
    ctx.strokeStyle = "#161616";
    ctx.lineWidth = Math.max(1.2, s * 0.03);
    ctx.lineCap = "round";
    const lines: [number, number][][] = [
      [[-0.1, -0.4], [0, -0.1], [-0.12, 0.15], [-0.05, 0.4]],
      [[0.2, -0.35], [0.12, -0.05], [0.28, 0.2]],
      [[-0.35, 0], [-0.2, 0.1], [-0.28, 0.32]],
    ];
    for (const l of lines.slice(0, stage)) {
      ctx.beginPath();
      l.forEach(([px, py], i) => (i ? ctx.lineTo(x + px * w, cy + py * h) : ctx.moveTo(x + px * w, cy + py * h)));
      ctx.stroke();
    }
    if (stage >= 3) {
      for (let i = 0; i < 3; i++) {
        const u = (t * 0.9 + i / 3) % 1;
        ctx.globalAlpha = 0.5 * (1 - u);
        ctx.fillStyle = "#6b6b6b";
        ctx.beginPath();
        ctx.arc(x + Math.sin(u * 6 + i) * w * 0.12, cy - h * 0.45 - u * h * 0.9, s * (0.05 + u * 0.06), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /** A vehicle's property materials over its sprite: steel sheen, bubble-wrap gloss, purple mesh, frost. */
  private drawMaterial(ctx: CanvasRenderingContext2D, pm: number, kind: EnemyKind, x: number, y: number, s: number): void {
    const k = enemyScale(kind);
    const w = s * 0.78 * k;
    const h = s * 0.42 * k;
    const top = y - s * (0.08 + enemyLift(kind)) - h;
    ctx.save();
    const layer = (colour: string, alpha: number, dash: number[] = []) => {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = colour;
      ctx.lineWidth = Math.max(1.5, s * 0.045);
      ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.roundRect(x - w / 2, top, w, h, s * 0.08);
      ctx.stroke();
    };
    if (pm & P.plated) layer(PROPERTIES.plated.colour, 0.9, [s * 0.04, s * 0.05]);
    if (pm & P.wrapped) {
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = PROPERTIES.wrapped.colour;
      ctx.beginPath();
      ctx.roundRect(x - w / 2, top, w, h, s * 0.12);
      ctx.fill();
      layer("#ffffff", 0.7);
    }
    if (pm & P.sealed) layer(PROPERTIES.sealed.colour, 0.9, [s * 0.02, s * 0.03]);
    if (pm & P.reefer) {
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = "#e8f8ff";
      ctx.fillRect(x - w / 2, top, w, h * 0.35);
      layer(PROPERTIES.reefer.colour, 0.85);
    }
    if (pm & P.reinforced) layer(PROPERTIES.reinforced.colour, 0.95, [s * 0.06, s * 0.06]);
    ctx.restore();
  }

  /** Plan item 676: shots in flight and particles alive, for the staged battle shots. */
  fxCounts(): { shots: number; parts: number; cues: number; trails: number } {
    // cues: towers still showing their muzzle puff (fired under PUFF seconds ago); trails: shots in flight or fading
    const cues = [...this.fired.values()].filter((t) => t < PUFF).length;
    return { shots: this.shots.filter((sh) => !sh.landed).length, parts: this.parts.length, cues, trails: this.shots.length };
  }

  /** Plan item 45, for tests and shots: vehicles drawn one by one, in columns, and the biggest pooled tower count. */
  /** Layer-pop shard bursts thrown so far (none under reduced motion), for tests. */
  private shardBursts = 0;
  /** Plan item 72: the queue drawn last frame (CSS px from the canvas corner), for the e2e tests; null when nothing waits at the gate. */
  shownQueue: { leads: Rect[]; plates: Rect[]; names: Rect[] } | null = null;
  /** Plan item 157: the lanes (0, 1) whose gate has a depot on screen, which shows the count. */
  depotLanes = new Set<number>();
  /** Plan item 537: the 2D depots' boxes (main.ts places them over the canvas), for the name tag to keep off. */
  depotBoxes: Rect[] = [];
  /** Plan item 695: the towers' boxes this frame, and the swarm badges drawn so far (e2e reads both). */
  towerBoxes: Rect[] = [];
  badgeBoxes: Rect[] = [];
  vehicleBoxes: Rect[] = [];
  /** Plan item 706: the lanes sampled every quarter cell (CSS px), and a lane's half-width, for the badges. */
  private laneDots: Array<{ x: number; y: number }> = [];
  private laneR = 16;
  private barnBoxes: Rect[] = [];
  /** Plan item 403: lanes whose depot stands on the lane's mouth, and how far along the lane its queue starts (cells). */
  depotMouths = new Map<number, number>();
  private queueAge = 0;
  private queueKey = "";
  private queueMemo: GateQueue | null = null;
  /** The next round's queue while the field is between rounds (null mid-round and once the level is over). */
  private nextQueue(game: Game): GateQueue | null {
    if (game.phase === "won" || game.phase === "lost" || !betweenRounds(game)) return null;
    const groups = game.level.waves[game.wave];
    if (!groups) return null;
    const key = `${game.level.id}:${game.wave}`;
    if (key !== this.queueKey) {
      this.queueKey = key;
      // Plan item 497: two at the gate in 2D (four stood as a rigid column of identical sprites); the depot's board and
      // the count plate carry how many follow.
      this.queueMemo = gateQueue(waveSpawns(game, groups, game.wave + 1), isBig, 2);
    }
    return this.queueMemo;
  }
  /** The count plate at the gate: "12 coming" on a paper pill, kept on the canvas. */
  /** Plan item 256: a Hollowell name tag by the queue's lead, on the first side (above, below, beside) that clears
   *  the other leads and plates and stays in the canvas; none if no side does. */
  /** Plan item 529: the driver's face (fleetfaces.ts) as an image for the lane's name tag, once it has loaded. */
  private driverImg(kind: EnemyKind): HTMLImageElement | null {
    if (typeof Image === "undefined") return null;
    let im = this.drivers.get(kind);
    if (!im) {
      im = new Image();
      im.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(driverFace(kind))}`;
      this.drivers.set(kind, im);
    }
    return im.complete && im.naturalWidth > 0 ? im : null;
  }
  private drivers = new Map<EnemyKind, HTMLImageElement>();
  private namePlate(ctx: CanvasRenderingContext2D, name: string, lead: Rect, s: number, avoid: Rect[], behind?: Rect, plots: Rect[] = [], face: HTMLImageElement | null = null): Rect | null {
    const fs = Math.max(13, Math.round(s * 0.19));
    ctx.save();
    ctx.font = `700 ${fs}px ${FONT}`;
    const h = fs * 1.55;
    // Plan item 529: the tag leads with its driver's face, a round mugshot inside its left end.
    const facew = face ? h - 2 : 0;
    const w = ctx.measureText(name).width + fs * 1.2 + facew;
    const g = 3;
    const gs = g + lead.w * 0.25;
    const cx = lead.x + lead.w / 2;
    const cy = lead.y + lead.h / 2;
    const tries: Rect[] = [
      { x: cx - w / 2, y: lead.y - h - g, w, h },
      { x: cx - w / 2, y: lead.y + lead.h + g, w, h },
      // Plan item 326: beside it, clear of the drawn body, which runs past the box (a lorry's cab under the tag at P l34).
      { x: lead.x + lead.w + gs, y: cy - h / 2, w, h },
      { x: lead.x - w - gs, y: cy - h / 2, w, h },
    ];
    if (behind) {
      const far = (c: Rect) => -Math.hypot(c.x + c.w / 2 - behind.x - behind.w / 2, c.y + c.h / 2 - behind.y - behind.h / 2);
      tries.sort((a, b) => far(a) - far(b));
    }
    const hit = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    // Plan item 273: of the sides that clear the queue, the plates and Cath, the one covering least plot (the tag lay on
    // D l34's plot row), ties kept in the order above.
    const cover = (c: Rect) =>
      plots.reduce((a, b) => a + Math.max(0, Math.min(c.x + c.w, b.x + b.w) - Math.max(c.x, b.x)) * Math.max(0, Math.min(c.y + c.h, b.y + b.h) - Math.max(c.y, b.y)), 0);
    // Plan item 548: 10 px inside the canvas, not 2, so a tag never rides the board's rounded frame (D l21's
    // 'Lifestyle influencer' hung over it at x 2-150).
    const m = 10;
    const ok = tries.filter((c) => c.x >= m && c.y >= m && c.x + c.w <= this.cssW - m && c.y + c.h <= this.cssH - m && !avoid.some((b) => hit(c, b)));
    const r = ok.reduce<Rect | undefined>((best, c) => (!best || cover(c) < cover(best) - 1 ? c : best), undefined);
    if (!r) {
      ctx.restore();
      return null;
    }
    ctx.globalAlpha = this.queueAge;
    ctx.fillStyle = "#1e2b34";
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 3);
    ctx.fill();
    ctx.fillStyle = "#ff7a1a";
    ctx.fillRect(r.x + 3, r.y + r.h - 3, r.w - 6, 2);
    // Plan item 512: beside the lead, the gap that clears its drawn body left the tag floating apart from it (over the
    // sea at D l21); a short leader in the tag's ink ties it to its vehicle.
    const lx0 = r.x + r.w <= lead.x ? r.x + r.w : r.x >= lead.x + lead.w ? lead.x + lead.w * 0.85 : NaN;
    const lx1 = r.x + r.w <= lead.x ? lead.x + lead.w * 0.15 : r.x;
    if (!Number.isNaN(lx0) && lx1 - lx0 > 2) {
      ctx.fillStyle = "#1e2b34";
      ctx.fillRect(lx0, r.y + r.h / 2 - 1, lx1 - lx0, 2);
      ctx.beginPath();
      ctx.arc(r.x + r.w <= lead.x ? lx1 : lx0, r.y + r.h / 2, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (face) {
      const d = r.h - 4;
      ctx.save();
      ctx.beginPath();
      ctx.arc(r.x + 2 + d / 2, r.y + 2 + d / 2, d / 2, 0, Math.PI * 2);
      ctx.fillStyle = "#e4d6b8";
      ctx.fill();
      ctx.clip();
      ctx.drawImage(face, r.x + 2, r.y + 2, d, d);
      ctx.restore();
    }
    ctx.fillStyle = "#f4fbfb";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name, r.x + facew + (r.w - facew) / 2, r.y + r.h / 2 - 0.5);
    ctx.restore();
    return r;
  }
  private countPlate(ctx: CanvasRenderingContext2D, count: number, x: number, y: number, s: number, upright: boolean, plots: Rect[] = [], leads: Rect[] = []): Rect {
    const label = `${count} coming`;
    const fs = Math.max(12, Math.round(s * 0.2));
    ctx.save();
    ctx.globalAlpha = this.queueAge;
    ctx.font = `800 ${fs}px ${FONT}`;
    const w = ctx.measureText(label).width + fs * 1.1;
    const h = fs * 1.5;
    const pad = 4;
    // Beside the lane at the queue's tail, never on it: under a lane that runs across, to the roomier side of
    // one that runs up or down.
    // Plan item 259: of those spots (clamped into the canvas) the one that covers least plot, never a queued lead.
    const right = { x: x + s * 0.5, y: y - h / 2 };
    const left = { x: x - s * 0.5 - w, y: y - h / 2 };
    const below = { x: x - w / 2, y: y + s * 0.5 };
    const above = { x: x - w / 2, y: y - s * 0.5 - h };
    const near = upright ? (right.x + w <= this.cssW - pad ? [right, left] : [left, right]).concat(below, above) : [below, above, right, left];
    // and a lane's width further out, where the near spots all sit on plots or the queue
    const far = [
      { x: below.x, y: below.y + s },
      { x: above.x, y: above.y - s },
      { x: right.x + s, y: right.y },
      { x: left.x - s, y: left.y },
    ];
    const order = near.concat(far);
    const clamp = (p: { x: number; y: number }) => ({ x: Math.max(pad, Math.min(this.cssW - w - pad, p.x)), y: Math.max(pad, Math.min(this.cssH - h - pad, p.y)) });
    const cover = (p: { x: number; y: number }, bs: Rect[]) =>
      bs.reduce((a, b) => a + Math.max(0, Math.min(p.x + w, b.x + b.w) - Math.max(p.x, b.x)) * Math.max(0, Math.min(p.y + h, b.y + b.h) - Math.max(p.y, b.y)), 0);
    const cost = (p: { x: number; y: number }) => cover(p, plots) + 50 * cover(p, leads);
    const spots = order.map(clamp);
    const spot = spots.reduce((a, b) => (cost(b) < cost(a) - 1 ? b : a));
    const cx = spot.x;
    const cy = spot.y;
    ctx.fillStyle = "rgba(255,250,238,0.96)";
    ctx.strokeStyle = "rgba(70,48,30,0.85)";
    ctx.lineWidth = Math.max(1.5, s * 0.03);
    ctx.beginPath();
    ctx.roundRect(cx, cy, w, h, h / 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#b03024";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, cx + w / 2, cy + h / 2 + 0.5);
    ctx.restore();
    return { x: cx, y: cy, w, h };
  }
  convoyStats(game?: Game): {
    drawn: number;
    column: number;
    marks: number;
    shards: number;
    cols: Array<{ dist: number; count: number; lane: number; at: number | null; chip: number | null; badged: boolean }>;
    places: Array<{ x: number; y: number }>;
  } {
    let marks = 0;
    for (const g of this.gains) if (g.tower !== undefined) marks = Math.max(marks, g.n);
    // Plan item 657: where each column stands, for the spec that keeps an ambush's overflow at the ambush.
    // Plan item 684: and where its head is drawn and what its chip says.
    const cols = this.lay.columns.map((c) => ({ dist: c.dist, count: c.count, lane: c.lane ?? 0, at: c.at ?? null, chip: this.chipCount.get(c) ?? null, badged: this.badged.has(c) }));
    // Plan item 684: the centre (cells) of every vehicle drawn on the field, columns' heads included.
    const places: Array<{ x: number; y: number }> = [];
    if (game)
      for (const e of game.enemies)
        if (this.lay.slots.has(e.id) || (this.lay.inColumn.get(e.id) === 0 && this.lay.columnOf.get(e.id)?.at !== undefined)) {
          const p = placeOnLane(game.level, e, this.lay);
          places.push({ x: p.x, y: p.y });
        }
    return { drawn: this.lay.slots.size, column: this.lay.inColumn.size, marks, shards: this.shardBursts, cols, places };
  }
  /** Plan item 684: the number each column's chip showed this frame. */
  private chipCount = new Map<ConvoyColumn, number>();
  /** Plan item 45: this frame's convoy layout (convoy.ts), laid out once per draw. */
  private lay: Convoy = noConvoy();
  /** Plan item 707: where each lane's drawn vehicles start, clear of the depot's plate (this frame's). */
  private laneStart: (lane: 1 | undefined) => number = () => 0;
  /** The columns a swarm badge rode last frame (their own +N chip stands down). */
  private badged = new Set<ConvoyColumn>();
  private layOut(game: Game, X: (v: number) => number, Y: (v: number) => number, s: number): Convoy {
    // Plan item 684: each slot is the vehicle's whole drawn body plus a sliver of road (SLOT_LEN, 0.62, let a truck
    // or a lorry overlap the next by a fifth or more). Plan item 707: and at least 7 CSS px of road between two.
    const gap = 7 / Math.max(1, s);
    const level = game.level;
    // Plan item 707: a vehicle is drawn on the lane once its body is clear of the depot's plate (it ran into the
    // depot, depot and queue merging); before that it waits in the depot's column, counted on its chip.
    // The test body is the longest and the widest on the field, along and across the lane (a 0.42-cell disc let a
    // lorry poke 20 px onto the plate at D, CI red on 46fc3312), centred where vehicleBox centres it.
    let len = s * 0.62;
    let wid = s * 0.62;
    for (const e of game.enemies) {
      const top = FLEET_TOP[e.kind];
      const k = s * enemyScale(e.kind);
      len = Math.max(len, top ? top.len * k : s * 0.62 * enemyScale(e.kind));
      wid = Math.max(wid, top ? top.wid * k : s * 0.62 * enemyScale(e.kind));
    }
    const starts = new Map<1 | undefined, number>();
    const start = (lane: 1 | undefined): number => {
      if (!this.depotBoxes.length) return 0;
      const known = starts.get(lane);
      if (known !== undefined) return known;
      let at = DEPOT_CLEAR_MAX;
      for (let d = 0; d < DEPOT_CLEAR_MAX; d += 0.05) {
        const p = enemyPoint(level, { dist: d, ...(lane ? { lane } : {}) });
        const cx = X(p.x);
        const cy = Y(p.y + 0.2) - s * 0.2;
        const vert = runOf(level, { dist: d, lane: lane ?? null }) !== undefined;
        const hw = (vert ? wid : len) / 2;
        const hh = (vert ? len : wid) / 2;
        if (!this.depotBoxes.some((b) => cx + hw > b.x + 1 && cx - hw < b.x + b.w - 1 && cy + hh > b.y + 1 && cy - hh < b.y + b.h - 1)) { at = d; break; }
      }
      starts.set(lane, at);
      return at;
    };
    this.laneStart = start;
    this.lay = layOutField(game.enemies, (k) => Math.max(drawnLen(k as EnemyKind) * ROAD_GAP, drawnLen(k as EnemyKind) + gap), start);
    this.chipCount.clear();
    return this.lay;
  }
  /** The box a vehicle is drawn in (CSS px). Plan item 707: a Fleet rung's is its from-above body, along or across
   *  the lane as it runs; the rest keep a square of their scale. */
  private vehicleBox(level: Level, e: Enemy, X: (v: number) => number, Y: (v: number) => number, s: number): Rect {
    const q = this.placeEnemy(level, e);
    const top = FLEET_TOP[e.kind];
    if (!top) {
      const sc = s * 0.62 * enemyScale(e.kind);
      return { x: X(q.x) - sc / 2, y: Y(q.y + 0.2) - sc, w: sc, h: sc };
    }
    const k = s * enemyScale(e.kind);
    const vert = runOf(level, { dist: this.lay.slots.get(e.id)?.dist ?? e.dist, lane: e.lane ?? null }) !== undefined;
    const w = (vert ? top.wid : top.len) * k;
    const h = (vert ? top.len : top.wid) * k;
    const cy = Y(q.y + 0.2) - k * 0.2;
    return { x: X(q.x) - w / 2, y: cy - h / 2, w, h };
  }
  /** Plan item 707: round a bend the lane's distance between two slots is longer than the gap between their bodies
   *  (one turned across the lane, the next along it), so a vehicle whose body would touch the one ahead's eases back
   *  along the lane until 3 px of road shows, never more than a cell (nor behind the lane's start). */
  private clearBends(game: Game, X: (v: number) => number, Y: (v: number) => number, s: number): void {
    const level = game.level;
    const pad = 3;
    const hit = (a: Rect, b: Rect) => a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;
    // Where two lanes share a road (l34), the second lane's vehicles also keep off the first's.
    const first: Rect[] = [];
    for (const lane of [undefined, 1] as const) {
      const on = game.enemies
        .filter((e) => (e.lane ?? undefined) === lane && this.lay.slots.has(e.id))
        .sort((a, b) => this.lay.slots.get(b.id)!.dist - this.lay.slots.get(a.id)!.dist || a.id - b.id);
      const ahead: Rect[] = [];
      const other = lane ? first : [];
      for (const e of on) {
        const sl = this.lay.slots.get(e.id)!;
        const d0 = sl.dist;
        // Never eased back onto the depot's plate (behind the lane's drawn start).
        const floor = Math.min(d0, Math.max(0, this.laneStart(lane), d0 - 1));
        let box = this.vehicleBox(level, e, X, Y, s);
        while ((ahead.slice(-2).some((b) => hit(box, b)) || other.some((b) => hit(box, b))) && sl.dist > floor) {
          sl.dist = Math.max(floor, sl.dist - 0.04);
          box = this.vehicleBox(level, e, X, Y, s);
        }
        const on = (b: Rect) => box.x < b.x + b.w - 1 && box.x + box.w > b.x + 1 && box.y < b.y + b.h - 1 && box.y + box.h > b.y + 1;
        if (sl.dist <= this.laneStart(lane) + 1e-6 && this.laneStart(lane) > 0 && (ahead.slice(-2).some(on) || other.some(on))) {
          // Eased back to the depot's mouth and still on the one ahead: it waits at the depot, counted on the
          // chip, rather than being drawn over that one (or the plate).
          this.lay.slots.delete(e.id);
          let col = this.lay.columns.find((c) => (c.lane ?? undefined) === lane && c.at === undefined);
          if (!col) {
            col = { ...(lane ? { lane } : {}), dist: e.dist, count: 0 };
            this.lay.columns.push(col);
          }
          this.lay.inColumn.set(e.id, col.count);
          this.lay.columnOf.set(e.id, col);
          col.count++;
          col.dist = Math.min(col.dist, e.dist);
          continue;
        }
        ahead.push(box);
        if (!lane) first.push(box);
      }
    }
  }
  /** Where a vehicle is drawn (convoy.ts placeOnLane). */
  private placeEnemy(level: Level, e: Enemy): { x: number; y: number } {
    return placeOnLane(level, e, this.lay);
  }
  /** The column at a queue's tail: the vehicles past the cap, stacked, fewer as the queue is popped. */
  private drawColumns(game: Game, ctx: CanvasRenderingContext2D, X: (v: number) => number, Y: (v: number) => number, s: number, t: number, col: ConvoyColumn): void {
    {
      const tally = new Map<EnemyKind, number>();
      for (const e of game.enemies) if (this.lay.columnOf.get(e.id) === col) tally.set(e.kind, (tally.get(e.kind) ?? 0) + 1);
      // Plan item 684: one vehicle stands for the column, its head, nose to tail in the file (a stack of up to eight
      // stood 3-5 deep over the queue's leader); behind the gate none is drawn and the chip waits at the depot.
      let head: Enemy | undefined;
      for (const e of game.enemies) if (this.lay.columnOf.get(e.id) === col && this.lay.inColumn.get(e.id) === 0) head = e;
      const p = enemyPoint(game.level, { dist: col.at ?? Math.max(0, col.dist), ...(col.lane ? { lane: col.lane } : {}) });
      const layers = col.at !== undefined && head ? 1 : 0;
      if (layers && head) {
        const heading = runOf(game.level, { dist: col.at!, lane: col.lane ?? null });
        drawEnemy(ctx, { kind: head.kind, facing: this.facing.get(head.id) ?? 1, hit: 9, ghost: !isRevealed(game, head), phase: (head.id % 7) * 0.31, still: true, ...(heading ? { heading } : {}) }, X(p.x), Y(p.y + 0.2), s, t);
      }
      if (tally.size === 0) return;
      // "+N": how many wait in the column, on a paper chip beside it (the swarm badge covers it once it rides here).
      // Plan item 677: drawn after the depth-sorted items (a Radio Mast lower on the field covered half the '+7').
      if (this.badged.has(col)) return;
      this.columnChips.push(() => this.columnChip(ctx, X, Y, s, col, p, layers));
    }
  }
  /** Column "+N" chips waiting for the depth-sorted items to be drawn (plan item 677). */
  private columnChips: Array<() => void> = [];
  private columnChip(ctx: CanvasRenderingContext2D, X: (v: number) => number, Y: (v: number) => number, s: number, col: ConvoyColumn, p: { x: number; y: number }, layers: number): void {
    {
      ctx.save();
      const label = `+${col.count - layers}`;
      this.chipCount.set(col, col.count - layers);
      if (col.count - layers <= 0) {
        ctx.restore();
        return;
      }
      const fs = Math.max(11, s * 0.24);
      ctx.font = `800 ${fs}px ${FONT}`;
      const w = ctx.measureText(label).width + fs * 0.9;
      // Plan item 736: FIELD_MARGIN inside the field's edge (P l27's '+1' and '+9' were cut at the left).
      const cx = Math.max(FIELD_MARGIN, Math.min(this.cssW - w - FIELD_MARGIN, X(p.x) + s * 0.42));
      const cy = Y(p.y + 0.2) - layers * s * 0.08 - fs * 0.7;
      ctx.fillStyle = "rgba(255,250,238,0.95)";
      ctx.strokeStyle = "rgba(70,48,30,0.85)";
      ctx.lineWidth = Math.max(1.5, s * 0.03);
      ctx.beginPath();
      ctx.roundRect(cx, cy, w, fs * 1.4, fs * 0.7);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#c0392b";
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.fillText(label, cx + fs * 0.45, cy + fs * 0.72);
      ctx.restore();
    }
  }
  /** A swarm's badge: its total in bold, then up to three types as small sprites with their counts, on a paper pill. */
  private swarmBadge(ctx: CanvasRenderingContext2D, sw: Swarm, x: number, y: number, s: number): void {
    const h = Math.max(22, s * 0.42);
    const fs = Math.round(h * 0.5);
    const icon = h * 0.82;
    const kinds = sw.kinds.slice(0, SWARM_KINDS);
    ctx.save();
    ctx.font = `800 ${fs}px ${FONT}`;
    const total = `${sw.count}`;
    const tw = ctx.measureText(total).width;
    // One type: the total says it all, so the sprite goes without a count.
    const label = (n: number) => (kinds.length > 1 ? `${n}` : "");
    // Plan item 672: a sprite draws up to 1.3 icons wide (a van's box), so its slot is that wide and the count starts
    // after it; with an icon-wide slot the vans covered their own digits.
    const slot = icon * 1.3;
    let parts = kinds.map((k) => ({ ...k, w: slot + ctx.measureText(label(k.n)).width * 0.8 + 4 }));
    const pad = h * 0.3;
    let w = pad * 2 + tw + 8 + parts.reduce((a, q) => a + q.w + 4, 0);
    // Kept on the field's canvas (plan item 69: at 390 px a queue near the edge ran its badge off the screen).
    let x0 = Math.max(4, Math.min(this.cssW - w - 4, x - w / 2));
    let y0 = y - h;
    // Plan item 682: a depot (a DOM plate over the canvas) hid the badge of the queue at its mouth (l34 at P: the
    // HOLLOWELL plate over '34 ... 3'): the badge steps beside the depot, the side with room, or below it.
    for (const d of this.depotBoxes) {
      if (x0 >= d.x + d.w || x0 + w <= d.x || y0 >= d.y + d.h || y0 + h * 1.3 <= d.y) continue;
      if (d.x + d.w + 4 + w <= this.cssW - 4) x0 = d.x + d.w + 4;
      else if (d.x - w - 4 >= 4) x0 = d.x - w - 4;
      else y0 = d.y + d.h + 4;
    }
    // Plan item 695: a badge over a tower hid it (l34 at P: '34 21 6 3' over the hedge row, '50 28 11 6' over the
    // cannon). Plan item 700: nor on the vehicles it counts. Plan item 706: nor on the road: a packed lane (l34's
    // left lane at P, every spot along it on a lorry) left the badge on the battle. It now docks at the nearest spot
    // in a ring of candidates round the queue that covers no tower, depot, badge or vehicle, preferring one off the
    // lane, with a leader line back to the queue; none clear of vehicles keeps the nearest clear of the towers.
    const ax = x, ay = y;
    {
      const bh = h * 1.3;
      const over = (r: Rect) => (b: Rect) => r.x < b.x + b.w && r.x + r.w > b.x && r.y < b.y + b.h && r.y + r.h > b.y;
      const hard = (bx: number, by: number, bw: number, cars: boolean) => {
        const o = over({ x: bx, y: by, w: bw, h: bh });
        return this.towerBoxes.some(o) || this.depotBoxes.some(o) || this.badgeBoxes.some(o) || this.barnBoxes.some(o) || (cars && this.vehicleBoxes.some(o));
      };
      const road = (bx: number, by: number, bw: number) => {
        let n = 0;
        const R = this.laneR;
        for (const d of this.laneDots) if (d.x > bx - R && d.x < bx + bw + R && d.y > by - R && d.y < by + bh + R) n++;
        return n;
      };
      // a ring of spots round the queue: up and down the lane, then columns either side out to two badge widths
      const ring = (bw: number, sx: number, sy: number) => {
        const clampX = (v: number) => Math.max(4, Math.min(this.cssW - bw - 4, v));
        const tries: Array<[number, number]> = [[sx, sy]];
        for (let k = 1; k <= 10; k++) tries.push([sx, sy - k * h * 0.7], [sx, sy + k * h * 0.7]);
        for (const fx of [-2.1, -1.6, -1.15, -0.66, -0.33, 0.33, 0.66, 1.15, 1.6, 2.1])
          for (let k = -8; k <= 8; k++) tries.push([clampX(sx + fx * bw), sy + k * h * 0.7]);
        return tries.filter(([tx, ty]) => ty >= 4 && ty + bh <= this.cssH - 4 && tx >= 4 && tx + bw <= this.cssW - 4);
      };
      const dist = ([tx, ty]: [number, number]) => Math.hypot(tx - x0, ty - y0);
      // the nearest spot clear of everything, off the road if one is within about five badge heights
      const best = (bw: number, sx: number, sy: number) => {
        const clear = ring(bw, sx, sy).filter((c) => !hard(c[0], c[1], bw, true));
        const offRoad = clear.filter((c) => road(c[0], c[1], bw) === 0 && dist(c) <= Math.max(h * 5, bw * 0.9));
        return offRoad.sort((p, q) => dist(p) - dist(q))[0] ?? clear.sort((p, q) => road(p[0], p[1], bw) - road(q[0], q[1], bw) || dist(p) - dist(q))[0];
      };
      if (hard(x0, y0, w, true) || road(x0, y0, w) > 0) {
        let pick = best(w, x0, y0);
        if (!pick) {
          // Mid-wave the lanes can fill the field round the queue: then the badge drops its sprites to the total and the
          // make-up bar (about a third the width) rather than lie over a vehicle.
          const cw = pad * 2 + tw + h * 0.9;
          const cx = Math.max(4, Math.min(this.cssW - cw - 4, x - cw / 2));
          pick = best(cw, cx, y0);
          if (pick) {
            parts = [];
            w = cw;
          }
        }
        pick ??= ring(w, x0, y0).filter((c) => !hard(c[0], c[1], w, false)).sort((p, q) => dist(p) - dist(q))[0];
        if (pick) [x0, y0] = pick;
      }
      this.badgeBoxes.push({ x: x0, y: y0, w, h: bh });
    }
    x = Math.max(x0 + h * 0.4, Math.min(x0 + w - h * 0.4, x));
    // the pointer still drops toward the queue, from wherever the badge settled
    y = y0 + h;
    ctx.beginPath();
    ctx.roundRect(x0, y0, w, h, h / 2);
    ctx.fillStyle = "rgba(255,247,230,0.95)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    ctx.stroke();
    // Plan item 45: the whole make-up as one stacked bar along the pill's foot, a segment per type in its colour.
    {
      const bx = x0 + h * 0.5;
      const bw = w - h;
      const bh = Math.max(3, h * 0.12);
      const by = y0 + h - bh - Math.max(2, h * 0.08);
      let ax = bx;
      for (const q of sw.kinds) {
        const segW = (bw * q.n) / sw.count;
        ctx.fillStyle = RUNGS[q.kind]?.colour ?? SWARM_TINT[q.kind] ?? "#8a7a66";
        ctx.fillRect(ax, by, Math.max(1, segW - 1), bh);
        ax += segW;
      }
    }
    // A pointer down to the queue.
    ctx.beginPath();
    ctx.moveTo(x - h * 0.22, y0 + h - 1);
    ctx.lineTo(x, y0 + h + h * 0.3);
    ctx.lineTo(x + h * 0.22, y0 + h - 1);
    ctx.fillStyle = "rgba(255,247,230,0.95)";
    ctx.fill();
    ctx.stroke();
    // Plan item 706: docked away from its queue, a thin leader runs from the pointer to a dot on the queue.
    if (Math.hypot(ax - x, ay - (y0 + h + h * 0.3)) > h * 0.9) {
      const lx = Math.max(x0 + h * 0.5, Math.min(x0 + w - h * 0.5, ax));
      const ly = ay < y0 ? y0 : ay > y0 + h ? y0 + h + h * 0.3 : y0 + h / 2;
      ctx.save();
      ctx.lineWidth = Math.max(1.5, h * 0.07);
      ctx.strokeStyle = "rgba(43,35,32,0.75)";
      ctx.setLineDash([h * 0.18, h * 0.14]);
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(ax, ay);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#fff7e6";
      ctx.beginPath();
      ctx.arc(ax, ay, Math.max(3, h * 0.16), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = "#c4433a";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    let cx = x0 + pad;
    ctx.fillText(total, cx, y0 + h / 2 + 1);
    cx += tw + 8;
    ctx.font = `800 ${Math.round(fs * 0.8)}px ${FONT}`;
    for (const q of parts) {
      const k = enemyScale(q.kind);
      const es = (icon * 1.7) / Math.max(1, k * 1.1);
      drawEnemy(ctx, { kind: q.kind, facing: 1, hit: 9, ghost: false, phase: 0 }, cx + slot / 2, y0 + h * 0.86, es, 0);
      ctx.fillStyle = INK;
      ctx.fillText(label(q.n), cx + slot + 2, y0 + h / 2 + 1);
      cx += q.w + 4;
    }
    ctx.restore();
  }

  /**
   * Plan item 468: a hedge's slow reads as brambles. A thorny bed spreads on the lane under the vehicle, and two
   * stems curl up over its body (thorns and a leaf each), swaying a little; the bed's green wash tints the wheels.
   */
  private drawBrambles(id: number, x: number, y: number, s: number, t: number): void {
    const { ctx } = this;
    const sway = this.reducedMotion ? 0 : Math.sin(t * 2.2 + id) * s * 0.015;
    ctx.save();
    ctx.fillStyle = "rgba(70,120,45,0.32)";
    ctx.beginPath();
    ctx.ellipse(x, y, s * 0.36, s * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineCap = "round";
    for (const side of [-1, 1] as const) {
      const x0 = x + side * s * 0.3;
      const x1 = x - side * s * 0.12 + sway;
      const y1 = y - s * 0.3;
      const cx = x0 + side * s * 0.02;
      const cy = y - s * 0.34;
      // A dark under-stroke so the stem reads on a white van and on the green verge alike.
      ctx.strokeStyle = "rgba(30,45,20,0.7)";
      ctx.lineWidth = Math.max(2.5, s * 0.05);
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.quadraticCurveTo(cx, cy, x1, y1);
      ctx.stroke();
      ctx.strokeStyle = "#5f9a3c";
      ctx.lineWidth = Math.max(1.5, s * 0.028);
      ctx.stroke();
      // Thorns along the curve, pointing outward.
      ctx.strokeStyle = "#3d5e26";
      ctx.lineWidth = Math.max(1, s * 0.014);
      for (const u of [0.3, 0.55, 0.8]) {
        const a = 1 - u;
        const px = a * a * x0 + 2 * a * u * cx + u * u * x1;
        const py = a * a * y + 2 * a * u * cy + u * u * y1;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + side * s * 0.035, py - s * 0.03);
        ctx.stroke();
      }
      // A leaf near the tip.
      ctx.fillStyle = "#79b84d";
      ctx.beginPath();
      ctx.ellipse(x1 - side * s * 0.03, y1 + s * 0.02, s * 0.045, s * 0.022, side * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawStatus(e: Game["enemies"][number], x: number, y: number, s: number, t: number): void {
    const { ctx } = this;
    const k = enemyScale(e.kind);
    const top = y - s * (0.45 * k + enemyLift(e.kind));
    if (e.stun > 0) {
      for (let i = 0; i < 3; i++) {
        const a = t * 4 + (i * Math.PI * 2) / 3;
        ctx.fillStyle = "#fff6b0";
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1;
        ctx.beginPath();
        star(ctx, x + Math.cos(a) * s * 0.2, top + Math.sin(a) * s * 0.05, s * 0.05);
        ctx.fill();
        ctx.stroke();
      }
    }
    if (e.slowed && e.stun <= 0) this.drawBrambles(e.id, x, y, s * k, t);
    if (e.stickyLeft && e.stickyLeft > 0) {
      ctx.fillStyle = "rgba(240,180,41,0.85)";
      for (let i = 0; i < 3; i++) {
        const dx = (i - 1) * s * 0.15;
        const ph = (t * 1.2 + i * 0.33) % 1;
        ctx.beginPath();
        ctx.ellipse(x + dx, y - s * 0.1 + ph * s * 0.1, s * 0.025, s * 0.04, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (e.poisonLeft && e.poisonLeft > 0) {
      ctx.fillStyle = "rgba(150,90,200,0.7)";
      for (let i = 0; i < 3; i++) {
        const ph = (t * 0.9 + i / 3) % 1;
        ctx.globalAlpha = 1 - ph;
        ctx.beginPath();
        ctx.arc(x + (i - 1) * s * 0.12, top + s * 0.1 - ph * s * 0.3, s * 0.035, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (e.held) {
      ctx.fillStyle = "rgba(230,220,200,0.6)";
      for (let i = 0; i < 2; i++) {
        const ph = (t * 2 + i * 0.5) % 1;
        ctx.globalAlpha = 1 - ph;
        ctx.beginPath();
        ctx.arc(x + (i ? 1 : -1) * s * (0.2 + ph * 0.15), y - s * 0.03, s * (0.04 + ph * 0.05), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  private flag(x: number, y: number, s: number, t: number): void {
    const { ctx } = this;
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1.5, s * 0.03);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - s * 0.4);
    ctx.stroke();
    ctx.fillStyle = "#6E7C4B";
    ctx.beginPath();
    ctx.moveTo(x, y - s * 0.4);
    ctx.lineTo(x + s * 0.2, y - s * 0.34 + Math.sin(t * 6) * s * 0.02);
    ctx.lineTo(x, y - s * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  /** Plan item 492: her run level as a small scalloped rosette in wheat and ink; a level-up stamps it down (1.7x to
   *  1x over 0.25 s) while six leaves spiral out from her for 0.7 s (the stamp alone under reduced motion). */
  private levelRosette(x: number, y: number, s: number, lv: number): void {
    const { ctx } = this;
    const b = this.levelBeat;
    const r = Math.max(7, s * 0.1);
    if (b < 0.7 && !this.reducedMotion) {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + b * 7;
        const d = r * (1.2 + b * 6);
        ctx.save();
        ctx.globalAlpha = 1 - b / 0.7;
        ctx.translate(x - s * 0.2 + Math.cos(a) * d, y - s * 0.3 + Math.sin(a) * d * 0.6);
        ctx.rotate(a + 1);
        ctx.fillStyle = i % 2 ? "#7fae4a" : "#5f8a34";
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.55, r * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    const k = b < 0.25 && !this.reducedMotion ? 1.7 - (b / 0.25) * 0.7 : 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    ctx.beginPath();
    for (let i = 0; i <= 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const rr = r * (i % 2 ? 0.86 : 1);
      if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = "#e7c36a";
    ctx.fill();
    ctx.lineWidth = Math.max(1.2, r * 0.14);
    ctx.strokeStyle = "#3a2716";
    ctx.stroke();
    ctx.fillStyle = "#3a2716";
    ctx.font = `800 ${Math.round(r * 1.05)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(lv), 0, r * 0.06);
    ctx.restore();
  }

  private heroBar(game: Game, x: number, y: number, s: number): void {
    const h = game.hero;
    const { ctx } = this;
    if (h.down > 0) {
      // A ring that fills as she recovers.
      const frac = 1 - h.down / 9;
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = Math.max(3, s * 0.06);
      ctx.beginPath();
      ctx.arc(x, y + s * 0.05, s * 0.12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "#f2c94c";
      ctx.beginPath();
      ctx.arc(x, y + s * 0.05, s * 0.12, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      ctx.stroke();
      return;
    }
    if (h.hp < h.maxHp) bar(ctx, x, y, s * 0.46, Math.max(3, s * 0.06), h.hp / h.maxHp, false, "#7fc46a");
  }

  private drawShots(dt: number, X: (v: number) => number, Y: (v: number) => number, s: number): void {
    const { ctx } = this;
    for (const sh of this.shots) {
      sh.age += dt;
      const k = Math.min(1, sh.age / sh.life);
      const x = sh.x + (sh.toX - sh.x) * k;
      // Plan item 19: throws arc with the distance (a lob from across the field climbs high); bolts fly flat.
      const dist = Math.hypot(sh.toX - sh.x, sh.toY - sh.y);
      const loft = sh.kind === "silo" ? 0 : sh.kind === "cannon" || sh.kind === "beehive" ? 0.35 + dist * 0.32 : sh.kind === "scarecrow" && sh.spec === 1 ? 0.15 + dist * 0.08 : 0.25 + dist * 0.22;
      const arc = Math.sin(k * Math.PI) * Math.min(1.6, loft);
      const y = sh.y + (sh.toY - sh.y) * k - arc;
      // Plan item 676: a trail behind the shot along its arc, lingering TRAIL seconds after it lands, so a still frame
      // reads who is shooting at what (the silo's beam is its own trail).
      if (sh.kind !== "silo") {
        const fade = sh.age < sh.life ? 1 : 1 - (sh.age - sh.life) / TRAIL;
        const tail = sh.age < sh.life ? Math.max(0, k - 0.6) : Math.min(1, ((sh.age - sh.life) / TRAIL) * 1.2);
        if (fade > 0 && k > tail) {
          const at = (q: number): [number, number] => [X(sh.x + (sh.toX - sh.x) * q), Y(sh.y + (sh.toY - sh.y) * q - Math.sin(q * Math.PI) * Math.min(1.6, loft))];
          ctx.save();
          ctx.lineCap = "round";
          ctx.beginPath();
          for (let i = 0; i <= 8; i++) {
            const [px, py] = at(tail + ((k - tail) * i) / 8);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.globalAlpha = 0.5 * fade;
          ctx.strokeStyle = INK;
          ctx.lineWidth = Math.max(3, s * 0.05);
          ctx.stroke();
          ctx.globalAlpha = 0.9 * fade;
          ctx.strokeStyle = fireTint(sh.kind, sh.spec);
          ctx.lineWidth = Math.max(1.6, s * 0.028);
          ctx.stroke();
          ctx.restore();
        }
      }
      if (sh.age >= sh.life && sh.landed) continue;
      ctx.lineWidth = Math.max(1.4, s * 0.025);
      ctx.strokeStyle = INK;
      switch (sh.kind) {
        case "scarecrow": {
          if (sh.spec === 1) {
            // A crow, wings beating (or the Hawk Post's hawk: bigger and brown).
            const hawk = sh.look === "hawk" ? 1.6 : 1;
            const flap = Math.sin(sh.age * 40) * s * 0.06 * hawk;
            ctx.fillStyle = hawk > 1 ? "#7a4f2a" : "#1d1b22";
            ctx.beginPath();
            ctx.ellipse(X(x), Y(y), s * 0.07 * hawk, s * 0.04 * hawk, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(X(x) - s * 0.1 * hawk, Y(y) - flap);
            ctx.lineTo(X(x), Y(y));
            ctx.lineTo(X(x) + s * 0.1 * hawk, Y(y) - flap);
            ctx.stroke();
          } else {
            const big = sh.spec === 0 ? 1.7 : 1;
            ctx.save();
            ctx.translate(X(x), Y(y));
            ctx.rotate(sh.age * 14);
            ctx.fillStyle = sh.spec === 0 ? "#e98a2b" : "#efe2f0";
            ctx.beginPath();
            ctx.arc(0, 0, s * 0.08 * big, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            if (sh.spec !== 0) {
              ctx.fillStyle = "#8e4a93";
              ctx.beginPath();
              ctx.arc(0, s * 0.03, s * 0.05, 0, Math.PI);
              ctx.fill();
            }
            ctx.fillStyle = "#5f8f3f";
            ctx.beginPath();
            ctx.ellipse(0, -s * 0.09 * big, s * 0.03, s * 0.05, 0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
          break;
        }
        case "cannon": {
          // A sack of seed potatoes; a prize pumpkin (Pumpkin Lobber), a spray of seed (Scatter Shot) or an
          // iron wrecking shot.
          if (sh.look === "scatter" || sh.spec === 1) {
            for (let i = 0; i < 5; i++) {
              ctx.fillStyle = "#e9d8a6";
              ctx.beginPath();
              ctx.arc(X(x + Math.cos(i * 1.3) * 0.12 * k), Y(y + Math.sin(i * 1.3) * 0.12 * k), s * 0.03, 0, Math.PI * 2);
              ctx.fill();
            }
            break;
          }
          const r = sh.look === "pumpkin" || sh.spec === 0 ? 0.11 : sh.look === "wreck" ? 0.09 : 0.07;
          ctx.fillStyle = sh.look === "pumpkin" || sh.spec === 0 ? "#e98a2b" : sh.look === "wreck" ? "#3b3f44" : "#b08a5a";
          ctx.beginPath();
          ctx.arc(X(x), Y(y), s * r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          break;
        }
        case "hedgerow":
          // Tractor Shed: a tractor rams out along the lane (a red block with a wheel).
          ctx.fillStyle = "#c4433a";
          ctx.fillRect(X(x) - s * 0.08, Y(y) - s * 0.05, s * 0.16, s * 0.1);
          ctx.strokeRect(X(x) - s * 0.08, Y(y) - s * 0.05, s * 0.16, s * 0.1);
          ctx.fillStyle = INK;
          ctx.beginPath();
          ctx.arc(X(x) - s * 0.04, Y(y) + s * 0.06, s * 0.04, 0, Math.PI * 2);
          ctx.fill();
          break;
        case "beehive":
          for (let i = 0; i < 5; i++) {
            const bx = x + Math.sin(sh.age * 25 + i * 1.7) * 0.14;
            const by = y + Math.cos(sh.age * 21 + i * 2.1) * 0.14;
            ctx.fillStyle = sh.spec === 0 ? "#d9433a" : sh.look === "pollen" ? "#fff4b8" : "#f2c94c";
            ctx.beginPath();
            ctx.ellipse(X(bx), Y(by), s * 0.035, s * 0.025, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
          break;
        case "pond":
          for (let i = 0; i < 3; i++) {
            ctx.fillStyle = sh.spec === 0 ? "#f4f1ea" : "#a9d4e6";
            ctx.beginPath();
            ctx.arc(X(x + (i - 1) * 0.08), Y(y + Math.sin(i) * 0.05), s * 0.04, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        case "barn":
          ctx.fillStyle = "#e2c06a";
          ctx.save();
          ctx.translate(X(x), Y(y));
          ctx.rotate(sh.age * 10);
          ctx.fillRect(-s * 0.07, -s * 0.05, s * 0.14, s * 0.1);
          ctx.strokeRect(-s * 0.07, -s * 0.05, s * 0.14, s * 0.1);
          ctx.restore();
          break;
        case "silo": {
          ctx.strokeStyle = `rgba(242,201,76,${1 - k})`;
          ctx.lineWidth = Math.max(3, s * (sh.spec === 0 ? 0.12 : 0.08));
          ctx.beginPath();
          ctx.moveTo(X(sh.x), Y(sh.y));
          ctx.lineTo(X(sh.toX), Y(sh.toY));
          ctx.stroke();
          break;
        }
        default:
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(X(x), Y(y), s * 0.05, 0, Math.PI * 2);
          ctx.fill();
      }
      if (sh.age >= sh.life) {
        sh.landed = true;
        // Landing: the target flinches (a flash and a squash) as it's struck.
        this.hitAt.set(sh.enemy, 0);
        const color = sh.kind === "scarecrow" ? (sh.spec === 0 ? "#e98a2b" : "#efe2f0") : sh.kind === "silo" ? "#f2c94c" : sh.kind === "pond" ? "#a9d4e6" : sh.kind === "barn" ? "#e2c06a" : "#f2c94c";
        const n = sh.spec === 0 && (sh.kind === "scarecrow" || sh.kind === "silo") ? 8 : 3;
        for (let i = 0; i < n; i++) this.parts.push(this.particle(sh.toX, sh.toY, color, "dot", 0.05, 0.4));
        if (sh.kind === "scarecrow" && sh.spec === 0) this.ring(sh.toX, sh.toY, "#e98a2b", 0.95);
        if (sh.kind === "cannon") this.ring(sh.toX, sh.toY, sh.look === "pumpkin" || sh.spec === 0 ? "#e98a2b" : "#e9d8a6", sh.look === "pumpkin" ? 1.4 : 1.1);
        if (sh.kind === "silo" && sh.spec === 1) this.ring(sh.toX, sh.toY, "#f2c94c", 1.1);
        if (sh.crit) {
          this.float(sh.toX, sh.toY - 0.4, sh.kind === "scarecrow" ? "CAW!" : "CRIT!", "#ffffff", 1.3);
          this.kick(0.08);
        }
      }
    }
    this.shots = this.shots.filter((sh) => sh.age < sh.life + (sh.kind === "silo" ? 0 : TRAIL));
  }

  private drawPies(dt: number, X: (v: number) => number, Y: (v: number) => number, s: number): void {
    const { ctx } = this;
    for (const p of this.pies) {
      p.age += dt;
      const k = Math.min(1, p.age / p.life);
      if (k < 1) {
        const x = p.fromX + (p.x - p.fromX) * k;
        const y = p.fromY + (p.y - p.fromY) * k - Math.sin(k * Math.PI) * 1.2;
        ctx.save();
        ctx.translate(X(x), Y(y));
        ctx.rotate(p.age * 12);
        ctx.fillStyle = "#e0b26a";
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 0.18, s * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#fff6e0";
        ctx.beginPath();
        ctx.ellipse(0, -s * 0.03, s * 0.13, s * 0.05, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (!p.landed) {
        p.landed = true;
        this.kick(0.35);
        this.flashOnce("255,246,214", 0.3);
        this.decals.push({ x: p.x, y: p.y, r: p.r * 0.6, color: "rgba(255,248,230,0.75)", age: 0, life: 5 });
        for (let i = 0; i < 26; i++) {
          const q = this.particle(p.x, p.y, i % 4 ? "#fff6e0" : "#c4433a", "dot", 0.09, 0.9);
          q.vx *= 1.6;
          this.parts.push(q);
        }
        this.ring(p.x, p.y, "#fff6e0", p.r);
        this.float(p.x, p.y - 0.5, "SPLAT!", "#fff6e0", 1.5);
      }
    }
    this.pies = this.pies.filter((p) => !p.landed);
  }

  private drawParticles(dt: number, X: (v: number) => number, Y: (v: number) => number, s: number): void {
    const { ctx } = this;
    this.floatDrawn = [];
    for (const p of this.parts) {
      p.age += dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      const k = Math.min(1, p.age / p.life);
      ctx.globalAlpha = p.shape === "text" ? Math.min(1, 2.2 * (1 - k)) : 1 - k;
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;
      switch (p.shape) {
        case "dot":
          ctx.beginPath();
          ctx.arc(X(p.x), Y(p.y), p.size * s, 0, Math.PI * 2);
          ctx.fill();
          break;
        case "square":
          ctx.save();
          ctx.translate(X(p.x), Y(p.y));
          ctx.rotate(p.rot);
          ctx.fillRect(-p.size * s * 0.5, -p.size * s * 0.5, p.size * s, p.size * s);
          ctx.strokeStyle = "rgba(43,35,32,0.6)";
          ctx.lineWidth = 1;
          ctx.strokeRect(-p.size * s * 0.5, -p.size * s * 0.5, p.size * s, p.size * s);
          ctx.restore();
          break;
        case "star":
          ctx.beginPath();
          star(ctx, X(p.x), Y(p.y), p.size * s);
          ctx.fill();
          break;
        case "puff": {
          // Plan item 676: a soft round of smoke or dust that swells as it fades, inked lightly like the field.
          const r = p.size * s * (0.6 + k * 0.9);
          ctx.globalAlpha = 0.85 * (1 - k) * (1 - k * 0.3);
          ctx.beginPath();
          ctx.arc(X(p.x), Y(p.y), r, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 0.55 * (1 - k);
          ctx.strokeStyle = INK;
          ctx.lineWidth = Math.max(1.2, s * 0.016);
          ctx.stroke();
          break;
        }
        case "ring":
          ctx.lineWidth = Math.max(2, s * 0.05 * (1 - k));
          ctx.beginPath();
          ctx.arc(X(p.x), Y(p.y), p.size * s * (0.3 + k * 0.7), 0, Math.PI * 2);
          ctx.stroke();
          break;
        case "text": {
          const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.5 : 1.1 - Math.min(0.1, (k - 0.15) * 0.3);
          const size = Math.max(11, Math.round(s * 0.26 * (p.big ?? 1) * pop));
          ctx.font = `800 ${size}px ${FONT}`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.lineWidth = Math.max(3, size * 0.22);
          ctx.strokeStyle = "rgba(43,35,32,0.85)";
          ctx.lineJoin = "round";
          // Plan item 736: kept FIELD_MARGIN inside the field, like the gains.
          const half = ctx.measureText(p.text!).width / 2 + size * 0.15;
          const tx = Math.max(FIELD_MARGIN + half, Math.min(this.cssW - FIELD_MARGIN - half, X(p.x)));
          const ty = Math.max(FIELD_MARGIN + size * 0.55, Math.min(this.cssH - FIELD_MARGIN - size * 0.55, Y(p.y)));
          ctx.strokeText(p.text!, tx, ty);
          ctx.fillText(p.text!, tx, ty);
          this.floatDrawn.push({ x: tx - half, y: ty - size * 0.55, w: half * 2, h: size * 1.1, text: p.text! });
          break;
        }
        default:
          break;
      }
    }
    ctx.globalAlpha = 1;
    this.parts = this.parts.filter((p) => p.age < p.life);
  }

  /**
   * Plan item 440: the field lit by one sun. A warm wash on the act's sun side fading to a cool one on the shadow
   * side (the same direction the cast shadows fall), and a light vignette, so the flat tints read as one lit farm.
   */
  private sunGrade(W: number, H: number, away: { x: number; y: number }, sun: string): void {
    const { ctx } = this;
    const cx = W / 2, cy = H / 2, R = Math.hypot(W, H) / 2;
    const g = ctx.createLinearGradient(cx - away.x * R, cy - away.y * R, cx + away.x * R, cy + away.y * R);
    // the lit side takes the act's own sun (warm in most acts, Saltmarsh's cool sea light)
    g.addColorStop(0, `rgba(${sun},0.4)`);
    g.addColorStop(0.5, `rgba(${sun},0)`);
    g.addColorStop(0.5, "rgba(46,58,96,0)");
    g.addColorStop(1, "rgba(46,58,96,0.3)");
    // soft-light: the wash tints light and shade without flattening the field's own contrast
    ctx.save();
    ctx.globalCompositeOperation = "soft-light";
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // Plan item 485: past noon the evening comes on: a warm multiply that deepens the greens toward dusk
    const warm = dayWarmth(this.day);
    if (warm > 0) {
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = `rgba(255,150,88,${(0.48 * warm).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
    const v = ctx.createRadialGradient(cx, cy, Math.min(W, H) * 0.42, cx, cy, R * 1.05);
    v.addColorStop(0, "rgba(34,26,16,0)");
    v.addColorStop(1, "rgba(34,26,16,0.2)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }

  private ambient(W: number, H: number, s: number, t: number): void {
    if (this.reducedMotion) return;
    const { ctx } = this;
    // Cloud shadows drifting over the field.
    for (let i = 0; i < 3; i++) {
      const x = ((t * (8 + i * 3) + i * 400) % (W + 600)) - 300;
      const y = (H * (0.2 + i * 0.3)) % H;
      const g = ctx.createRadialGradient(x, y, 0, x, y, s * 2.4);
      g.addColorStop(0, "rgba(20,30,40,0.10)");
      g.addColorStop(1, "rgba(20,30,40,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y, s * 2.6, s * 1.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Butterflies.
    for (let i = 0; i < 3; i++) {
      const x = W * (0.5 + 0.45 * Math.sin(t * 0.13 + i * 2.1));
      const y = H * (0.5 + 0.4 * Math.sin(t * 0.17 + i * 1.3));
      const flap = Math.abs(Math.sin(t * 14 + i)) * s * 0.06 + s * 0.01;
      ctx.fillStyle = ["#f6f1e4", "#f2c94c", "#e8748b"][i]!;
      ctx.beginPath();
      ctx.ellipse(x - flap * 0.6, y, flap, s * 0.04, -0.4, 0, Math.PI * 2);
      ctx.ellipse(x + flap * 0.6, y, flap, s * 0.04, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Plan item 568: how much the 2D field's baked ground is saturated, toward the 3D diorama's colour (1.7 put the 2D pond
 * 20 dE from the 3D one, past hedgerow-water's 15). */
const BG_SATURATE = 1.55;


/** The width of a swarm badge's row of types (at most three) and its total, for layout. */
const SWARM_KINDS = 3;

function bar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  w: number,
  h: number,
  frac: number,
  boss = false,
  color?: string,
): void {
  const f = Math.max(0, Math.min(1, frac));
  ctx.fillStyle = "rgba(20,15,12,0.7)";
  ctx.beginPath();
  ctx.roundRect(cx - w / 2 - 1, y - 1, w + 2, h + 2, h);
  ctx.fill();
  ctx.fillStyle = color ?? (boss ? "#d93a2f" : f > 0.6 ? "#7fc46a" : f > 0.3 ? "#f2c94c" : "#e5533d");
  if (f > 0) {
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, y, w * f, h, h);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.fillRect(cx - w / 2 + 2, y + 1, Math.max(0, w * f - 4), Math.max(1, h * 0.3));
}

function svgImage(svg: string): HTMLImageElement {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return img;
}

// Keep theme exports reachable for the level-select art.
export { themeFor };

/**
 * Plan item 345: a barn in its farmyard, drawn over its one cell (the barn's footprint in the rules) with the yard
 * spilling a little into the grass round it: packed earth with wheel ruts, a post-and-rail fence along the yard's
 * open sides, a round bale, and the barn itself (a gambrel roof, a hay-loft door, the big doors braced in white).
 */
export function drawFarmyard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, seed: number): void {
  const r01 = rng(seed);
  const flip = r01() < 0.5;
  ctx.save();
  // The yard: packed earth, a soft edge, two ruts.
  ctx.fillStyle = "rgba(40,30,10,0.16)";
  ctx.beginPath();
  ctx.roundRect(x + w * 0.02, y + w * 0.06, w * 0.96, w * 0.96, w * 0.2);
  ctx.fill();
  ctx.fillStyle = "rgb(168,138,92)";
  ctx.beginPath();
  ctx.roundRect(x + w * 0.02, y + w * 0.04, w * 0.96, w * 0.94, w * 0.2);
  ctx.fill();
  ctx.strokeStyle = "rgba(96,70,40,0.35)";
  ctx.lineWidth = Math.max(1, w * 0.025);
  for (const k of [0.62, 0.74]) {
    ctx.beginPath();
    ctx.moveTo(x + w * 0.05, y + w * (k + 0.12));
    ctx.quadraticCurveTo(x + w * 0.5, y + w * (k - 0.02), x + w * 0.98, y + w * (k + 0.08));
    ctx.stroke();
  }
  // The fence: posts and two rails along the front and one side.
  const fx = flip ? x + w * 0.02 : x + w * 0.98;
  ctx.strokeStyle = "#6b4b2c";
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(1, w * 0.03);
  for (const k of [0.84, 0.95]) {
    ctx.beginPath();
    ctx.moveTo(x + w * 0.02, y + w * (k + 0.02));
    ctx.lineTo(x + w * 0.98, y + w * (k + 0.02));
    ctx.moveTo(fx, y + w * (k - 0.42));
    ctx.lineTo(fx, y + w * (k + 0.02));
    ctx.stroke();
  }
  ctx.lineWidth = Math.max(1.5, w * 0.045);
  for (let i = 0; i <= 4; i++) {
    const px = x + w * (0.02 + i * 0.24);
    ctx.beginPath();
    ctx.moveTo(px, y + w * 0.8);
    ctx.lineTo(px, y + w * 1.0);
    ctx.stroke();
  }
  for (const k of [0.45, 0.65]) {
    ctx.beginPath();
    ctx.moveTo(fx, y + w * k);
    ctx.lineTo(fx, y + w * (k + 0.16));
    ctx.stroke();
  }
  // A round bale in the yard's open corner.
  const bx = flip ? x + w * 0.8 : x + w * 0.2;
  const by = y + w * 0.72;
  ctx.fillStyle = "rgba(60,40,12,0.25)";
  ctx.beginPath();
  ctx.ellipse(bx + w * 0.03, by + w * 0.07, w * 0.11, w * 0.04, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e0bd68";
  ctx.strokeStyle = "rgba(120,86,30,0.9)";
  ctx.lineWidth = Math.max(1, w * 0.02);
  ctx.beginPath();
  ctx.ellipse(bx, by, w * 0.1, w * 0.085, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(bx, by, w * 0.05, w * 0.042, 0, 0, Math.PI * 2);
  ctx.stroke();
  // The barn, set to the back of the yard, its shadow falling right.
  const bw = w * 0.56;
  const left = flip ? x + w * 0.36 : x + w * 0.08;
  const top = y + w * 0.12;
  const wallTop = top + w * 0.2;
  const base = y + w * 0.62;
  // Plan item 370: the barn's cast shadow falls away from the act's sun, like the 3D view's; the contact shadow stays.
  castShadow(ctx, left + bw / 2, base, bw / 2, w * 0.14, w * 0.5, 0.2);
  ctx.fillStyle = "rgba(40,28,10,0.28)";
  ctx.beginPath();
  ctx.ellipse(left + bw * 0.5, base + w * 0.015, bw * 0.56, w * 0.045, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#b5432f";
  ctx.strokeStyle = "#5a2418";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(1, w * 0.022);
  ctx.beginPath();
  ctx.moveTo(left, base);
  ctx.lineTo(left, wallTop);
  ctx.lineTo(left + bw * 0.16, top + w * 0.06);
  ctx.lineTo(left + bw * 0.5, top - w * 0.02);
  ctx.lineTo(left + bw * 0.84, top + w * 0.06);
  ctx.lineTo(left + bw, wallTop);
  ctx.lineTo(left + bw, base);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // The roof's slate edge over the gambrel.
  ctx.strokeStyle = "#4a4540";
  ctx.lineWidth = Math.max(1.5, w * 0.05);
  ctx.beginPath();
  ctx.moveTo(left - w * 0.02, wallTop + w * 0.01);
  ctx.lineTo(left + bw * 0.16, top + w * 0.06);
  ctx.lineTo(left + bw * 0.5, top - w * 0.02);
  ctx.lineTo(left + bw * 0.84, top + w * 0.06);
  ctx.lineTo(left + bw + w * 0.02, wallTop + w * 0.01);
  ctx.stroke();
  // The big doors, braced in white, and the hay-loft door above.
  const dw = bw * 0.46;
  const dx = left + (bw - dw) / 2;
  const dTop = base - w * 0.24;
  ctx.fillStyle = "#8e3424";
  ctx.fillRect(dx, dTop, dw, base - dTop);
  ctx.strokeStyle = "#fbf3e2";
  ctx.lineWidth = Math.max(1, w * 0.02);
  ctx.strokeRect(dx, dTop, dw, base - dTop);
  ctx.beginPath();
  ctx.moveTo(dx, dTop);
  ctx.lineTo(dx + dw, base);
  ctx.moveTo(dx + dw, dTop);
  ctx.lineTo(dx, base);
  ctx.moveTo(dx + dw / 2, dTop);
  ctx.lineTo(dx + dw / 2, base);
  ctx.stroke();
  ctx.fillStyle = "#3c2a1c";
  ctx.fillRect(left + bw * 0.4, top + w * 0.08, bw * 0.2, w * 0.08);
  ctx.strokeRect(left + bw * 0.4, top + w * 0.08, bw * 0.2, w * 0.08);
  // A wisp of hay at the loft door.
  ctx.strokeStyle = "#e7c46a";
  ctx.beginPath();
  ctx.moveTo(left + bw * 0.44, top + w * 0.16);
  ctx.lineTo(left + bw * 0.4, top + w * 0.2);
  ctx.moveTo(left + bw * 0.54, top + w * 0.16);
  ctx.lineTo(left + bw * 0.58, top + w * 0.21);
  ctx.stroke();
  ctx.restore();
}
