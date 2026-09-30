// Hedgerow's engine: a pure, deterministic tower-defence simulation with no DOM. The world advances in
// fixed steps of STEP seconds (30 Hz), so the same build orders always give the same result, in tests, in
// the level bot and in the browser. Distances are in grid cells; the lane is a polyline through cell
// centres. Towers are hitscan: a shot lands the moment it fires, and the renderer draws the flight from the
// `events` list.

export const STEP = 1 / 30;

export type TowerKind =
  | "hedgerow"
  | "scarecrow"
  | "beehive"
  | "stall"
  | "pond"
  | "barn"
  | "silo"
  | "mast"
  | "tent"
  | "court"
  | "hall";
export type EnemyKind =
  | "van"
  | "drone"
  | "boss"
  | "truck"
  | "convoy"
  | "influencer"
  | "blimp"
  | "bulldozer"
  | "megadozer"
  | "phantom"
  | "clinic"
  | "tender"
  | "ship"
  | "lawyer"
  | "swarm"
  | "bus"
  | "board"
  | "director"
  | "hollowcandor"
  | "candor"
  | "remnant";

export interface TowerSpec {
  name: string;
  blurb: string;
  cost: number;
  /** Upgrade cost to reach tier 2 and tier 3. */
  upgrades: [number, number];
  range: [number, number, number];
  /** Damage per shot (0 for the hedgerow). */
  damage: [number, number, number];
  /** Seconds between shots. */
  cooldown: [number, number, number];
  /** Enemies within this many cells of the target also take the damage (0 = single target). */
  splash?: number;
  /** Speed multiplier applied to enemies in range (1 = none). */
  slow: [number, number, number];
  /** Damage multiplier given to other towers in range (the Market Stall). */
  buff?: [number, number, number];
  /** Marks earned at the end of every wave. */
  income?: [number, number, number];
  /** Shots ignore armour (the Grain Silo). */
  pierce?: boolean;
  /** Reveals stealth units in range and marks everything in range: they take this much extra damage (the Radio Mast). */
  reveal?: [number, number, number];
  /** Towers within this range of the tent ignore influencer charm (the Clinic Tent). */
  cleanse?: boolean;
  /** Seconds it freezes a boss in range each time it fires (the Courthouse's Injunction). */
  injunction?: [number, number, number];
  /** Damage multiplier on every tower on the map, wherever it stands (the Union Hall). */
  aura?: [number, number, number];
}

export const TOWERS: Record<TowerKind, TowerSpec> = {
  hedgerow: {
    name: "Hedgerow",
    blurb: "Thick, thorny and cheap. Slows everything that passes.",
    cost: 50,
    upgrades: [45, 75],
    range: [1.3, 1.5, 1.7],
    damage: [0, 0, 0],
    cooldown: [1, 1, 1],
    slow: [0.62, 0.5, 0.4],
  },
  scarecrow: {
    name: "Scarecrow",
    blurb: "Throws turnips at the front of the queue.",
    cost: 80,
    upgrades: [70, 110],
    range: [2.4, 2.7, 3.1],
    damage: [8, 13, 20],
    cooldown: [0.8, 0.68, 0.55],
    slow: [1, 1, 1],
  },
  beehive: {
    name: "Beehive",
    blurb: "A swarm that stings everything near its target.",
    cost: 120,
    upgrades: [90, 140],
    range: [2.0, 2.2, 2.5],
    damage: [6, 10, 15],
    cooldown: [1.1, 1, 0.9],
    slow: [1, 1, 1],
    splash: 1.1,
  },
  stall: {
    name: "Market Stall",
    blurb: "Earns Marks after every wave and cheers on the towers beside it.",
    cost: 100,
    upgrades: [80, 120],
    range: [1.6, 1.9, 2.2],
    damage: [0, 0, 0],
    cooldown: [1, 1, 1],
    slow: [1, 1, 1],
    buff: [1.2, 1.3, 1.45],
    income: [12, 20, 30],
  },
  pond: {
    name: "Duck Pond",
    blurb: "Slows every vehicle nearby, and the ducks splash whatever is left.",
    cost: 110,
    upgrades: [85, 130],
    range: [1.8, 2.0, 2.2],
    damage: [4, 7, 11],
    cooldown: [1, 0.9, 0.8],
    slow: [0.75, 0.66, 0.56],
    splash: 0.9,
  },
  barn: {
    name: "Co-op Barn",
    blurb:
      "Farmhands spill out and block the lane: a hard slow, and a few solid whacks.",
    cost: 100,
    upgrades: [80, 120],
    range: [1.4, 1.6, 1.8],
    damage: [4, 7, 11],
    cooldown: [0.9, 0.8, 0.7],
    slow: [0.5, 0.4, 0.32],
  },
  silo: {
    name: "Grain Silo",
    blurb: "A slow, heavy grain-shot that ignores armour. Bulldozers hate it.",
    cost: 150,
    upgrades: [110, 170],
    range: [2.6, 2.9, 3.2],
    damage: [40, 66, 100],
    cooldown: [2.2, 2, 1.8],
    slow: [1, 1, 1],
    pierce: true,
  },
  mast: {
    name: "Radio Mast",
    blurb:
      "Sol's mast. Shows up stealth units in range and marks everything there for extra damage.",
    cost: 90,
    upgrades: [70, 110],
    range: [2.2, 2.5, 2.8],
    damage: [0, 0, 0],
    cooldown: [1, 1, 1],
    slow: [1, 1, 1],
    reveal: [1.2, 1.3, 1.45],
  },
  tent: {
    name: "Clinic Tent",
    blurb:
      "Ines's tent. Towers beside it shake off charm and fire faster, thanks to a great deal of tea.",
    cost: 110,
    upgrades: [80, 120],
    range: [1.8, 2.1, 2.4],
    damage: [0, 0, 0],
    cooldown: [1, 1, 1],
    slow: [1, 1, 1],
    buff: [1.15, 1.25, 1.35],
    cleanse: true,
  },
  court: {
    name: "Courthouse",
    blurb:
      "Mara's courthouse. Serves an Injunction on any boss in range: it stops dead until the paperwork clears.",
    cost: 180,
    upgrades: [120, 180],
    range: [2.2, 2.5, 2.8],
    damage: [0, 0, 0],
    cooldown: [9, 8, 7],
    slow: [1, 1, 1],
    injunction: [2.5, 3.5, 4.5],
  },
  hall: {
    name: "Farmers' Union Hall",
    blurb:
      "Tomas's hall. Every tower on the map hits harder, and Market Day pays out after each wave.",
    cost: 220,
    upgrades: [150, 220],
    range: [0, 0, 0],
    damage: [0, 0, 0],
    cooldown: [1, 1, 1],
    slow: [1, 1, 1],
    aura: [1.1, 1.17, 1.25],
    income: [18, 30, 45],
  },
};

export interface EnemySpec {
  name: string;
  hp: number;
  /** Cells per second. */
  speed: number;
  bounty: number;
  /** Goodwill lost when it reaches the farmhouse. */
  leak: number;
  /** What it breaks into when destroyed. */
  splits?: { kind: EnemyKind; count: number };
  /** Towers within this many cells of it are charmed and stop shooting. */
  charm?: number;
  /** Fraction of non-piercing damage it shrugs off. */
  armor?: number;
  /** Towers cannot target it unless a Radio Mast has it in range. */
  stealth?: boolean;
  /** Other enemies within 1.6 cells regain this many hit points a second. */
  heal?: number;
  /** Towers within this many cells of it fire at half rate (paperwork). */
  jam?: number;
}

export const ENEMIES: Record<EnemyKind, EnemySpec> = {
  van: { name: "Delivery van", hp: 98, speed: 0.9, bounty: 9, leak: 1 },
  boss: {
    name: "The Acquisition Van",
    hp: 1800,
    speed: 0.55,
    bounty: 150,
    leak: 5,
  },
  drone: { name: "Delivery drone", hp: 35, speed: 1.8, bounty: 6, leak: 1 },
  truck: {
    name: "0.99 price-war truck",
    hp: 150,
    speed: 0.8,
    bounty: 10,
    leak: 2,
    splits: { kind: "drone", count: 2 },
  },
  convoy: {
    name: "Mr Crisp's Price-War Convoy",
    hp: 2700,
    speed: 0.5,
    bounty: 200,
    leak: 6,
    splits: { kind: "truck", count: 3 },
  },
  influencer: {
    name: "Lifestyle influencer",
    hp: 70,
    speed: 1.0,
    bounty: 10,
    leak: 1,
    charm: 1.2,
  },
  blimp: {
    name: "The Brand Ambassador Blimp",
    hp: 3300,
    speed: 0.45,
    bounty: 250,
    leak: 7,
    charm: 1.8,
  },
  bulldozer: {
    name: "Site-clearance bulldozer",
    hp: 260,
    speed: 0.7,
    bounty: 14,
    leak: 3,
    armor: 0.5,
  },
  megadozer: {
    name: "The Mega-Dozer",
    hp: 4200,
    speed: 0.42,
    bounty: 300,
    leak: 8,
    armor: 0.5,
    splits: { kind: "bulldozer", count: 2 },
  },
  phantom: {
    name: "Unbranded courier",
    hp: 90,
    speed: 1.2,
    bounty: 12,
    leak: 1,
    stealth: true,
  },
  tender: {
    name: "Fast tender",
    hp: 190,
    speed: 1.1,
    bounty: 13,
    leak: 2,
    armor: 0.3,
  },
  ship: {
    name: "The Container Ship",
    hp: 5600,
    speed: 0.4,
    bounty: 400,
    leak: 10,
    armor: 0.35,
    splits: { kind: "tender", count: 4 },
  },
  lawyer: {
    name: "Corporate lawyer",
    hp: 170,
    speed: 0.95,
    bounty: 13,
    leak: 2,
    jam: 1.3,
  },
  swarm: {
    name: "The Lawyer Swarm",
    hp: 6000,
    speed: 0.45,
    bounty: 450,
    leak: 10,
    jam: 2,
    splits: { kind: "lawyer", count: 5 },
  },
  bus: {
    name: "Pell's Campaign Bus",
    hp: 7200,
    speed: 0.5,
    bounty: 500,
    leak: 10,
    armor: 0.2,
    splits: { kind: "influencer", count: 6 },
  },
  director: {
    name: "Company director",
    hp: 1500,
    speed: 0.7,
    bounty: 40,
    leak: 3,
    armor: 0.25,
  },
  board: {
    name: "The Board of Directors",
    hp: 8000,
    speed: 0.5,
    bounty: 550,
    leak: 10,
    armor: 0.2,
    splits: { kind: "director", count: 5 },
  },
  hollowcandor: {
    name: "HollowCandor",
    hp: 7000,
    speed: 0.45,
    bounty: 400,
    leak: 10,
    armor: 0.25,
    jam: 1.5,
    splits: { kind: "candor", count: 2 },
  },
  candor: {
    name: "Candor, unmerged",
    hp: 4500,
    speed: 0.6,
    bounty: 300,
    leak: 6,
    armor: 0.15,
    heal: 20,
    splits: { kind: "remnant", count: 3 },
  },
  remnant: {
    name: "Hollow remnant",
    hp: 1400,
    speed: 0.9,
    bounty: 60,
    leak: 3,
    stealth: true,
  },
  clinic: {
    name: "Vane's Clinic-in-a-Box",
    hp: 4800,
    speed: 0.42,
    bounty: 350,
    leak: 9,
    heal: 14,
    splits: { kind: "phantom", count: 3 },
  },
};

export interface WaveGroup {
  enemy: EnemyKind;
  count: number;
  /** Seconds between spawns in this group. */
  gap: number;
  /** Seconds after the wave starts that the group begins. */
  delay: number;
}

export interface StoryLine {
  who: "cath" | "mara" | "bea" | "tomas" | "sol" | "narrator";
  expression?: "smirk" | "delighted" | "determined" | "worried" | "wink";
  text: string;
}

export interface Level {
  id: number;
  name: string;
  place: string;
  cols: number;
  rows: number;
  /** Cell waypoints; consecutive points share a row or a column. The last one is the farmhouse. */
  path: Array<[number, number]>;
  startMarks: number;
  goodwill: number;
  towers: TowerKind[];
  waves: WaveGroup[][];
  before: StoryLine[];
  after: StoryLine[];
  /** What finishing the level unlocks (a tier, a skin or a lore card). */
  reward: string;
}

export interface Tower {
  id: number;
  kind: TowerKind;
  col: number;
  row: number;
  tier: 1 | 2 | 3;
  cd: number;
  spent: number;
}

export interface Enemy {
  id: number;
  kind: EnemyKind;
  dist: number;
  hp: number;
  slowed: boolean;
  /** Seconds left frozen in place (Cath's pie). */
  stun: number;
}

export type GameEvent =
  | {
      type: "shot";
      kind: TowerKind;
      tower: number;
      enemy: number;
      fromX: number;
      fromY: number;
      toX: number;
      toY: number;
    }
  | { type: "kill"; x: number; y: number; bounty: number }
  | { type: "leak"; x: number; y: number }
  | { type: "wave"; wave: number }
  | { type: "pie" };

export type Phase = "build" | "wave" | "won" | "lost";

export interface Game {
  level: Level;
  tick: number;
  phase: Phase;
  marks: number;
  goodwill: number;
  /** Waves sent so far. */
  wave: number;
  waveClock: number;
  spawnQueue: Array<{ at: number; kind: EnemyKind }>;
  enemies: Enemy[];
  towers: Tower[];
  nextId: number;
  pathLength: number;
  events: GameEvent[];
  /** Seconds until Cath's pie is ready again. */
  pieCd: number;
}

export function pathLength(path: Level["path"]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++)
    total +=
      Math.abs(path[i]![0] - path[i - 1]![0]) +
      Math.abs(path[i]![1] - path[i - 1]![1]);
  return total;
}

/** Cell-centre position (in cell units, x to the right) at `dist` cells along the lane. */
export function pointAt(
  path: Level["path"],
  dist: number,
): { x: number; y: number } {
  let left = Math.max(0, dist);
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = path[i - 1]!;
    const [bx, by] = path[i]!;
    const len = Math.abs(bx - ax) + Math.abs(by - ay);
    if (left <= len || i === path.length - 1) {
      const t = len === 0 ? 0 : Math.min(1, left / len);
      return { x: ax + (bx - ax) * t + 0.5, y: ay + (by - ay) * t + 0.5 };
    }
    left -= len;
  }
  const last = path[path.length - 1]!;
  return { x: last[0] + 0.5, y: last[1] + 0.5 };
}

export function laneCells(path: Level["path"]): Set<string> {
  const cells = new Set<string>();
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = path[i - 1]!;
    const [bx, by] = path[i]!;
    const dx = Math.sign(bx - ax);
    const dy = Math.sign(by - ay);
    let x = ax;
    let y = ay;
    cells.add(`${x},${y}`);
    while (x !== bx || y !== by) {
      x += dx;
      y += dy;
      cells.add(`${x},${y}`);
    }
  }
  return cells;
}

export function isPlot(level: Level, col: number, row: number): boolean {
  if (col < 0 || row < 0 || col >= level.cols || row >= level.rows)
    return false;
  return !laneCells(level.path).has(`${col},${row}`);
}

export function newGame(level: Level): Game {
  return {
    level,
    tick: 0,
    phase: "build",
    marks: level.startMarks,
    goodwill: level.goodwill,
    wave: 0,
    waveClock: 0,
    spawnQueue: [],
    enemies: [],
    towers: [],
    nextId: 1,
    pathLength: pathLength(level.path),
    events: [],
    pieCd: 0,
  };
}

export function towerAt(
  game: Game,
  col: number,
  row: number,
): Tower | undefined {
  return game.towers.find((t) => t.col === col && t.row === row);
}

export function sellValue(tower: Tower): number {
  return Math.floor(tower.spent * 0.7);
}

export function upgradeCost(tower: Tower): number | null {
  return tower.tier >= 3 ? null : TOWERS[tower.kind].upgrades[tower.tier - 1]!;
}

export type ActionResult = { ok: true } | { ok: false; reason: string };

export function place(
  game: Game,
  kind: TowerKind,
  col: number,
  row: number,
): ActionResult {
  if (game.phase === "won" || game.phase === "lost")
    return { ok: false, reason: "The level is over." };
  if (!game.level.towers.includes(kind))
    return { ok: false, reason: "Not unlocked yet." };
  if (!isPlot(game.level, col, row))
    return { ok: false, reason: "You can only build beside the lane." };
  if (towerAt(game, col, row))
    return { ok: false, reason: "That plot is taken." };
  const cost = TOWERS[kind].cost;
  if (game.marks < cost) return { ok: false, reason: `Needs ${cost} Marks.` };
  game.marks -= cost;
  game.towers.push({
    id: game.nextId++,
    kind,
    col,
    row,
    tier: 1,
    cd: 0,
    spent: cost,
  });
  return { ok: true };
}

export function upgrade(game: Game, id: number): ActionResult {
  const tower = game.towers.find((t) => t.id === id);
  if (!tower) return { ok: false, reason: "No such tower." };
  const cost = upgradeCost(tower);
  if (cost === null) return { ok: false, reason: "Already fully grown." };
  if (game.marks < cost) return { ok: false, reason: `Needs ${cost} Marks.` };
  game.marks -= cost;
  tower.spent += cost;
  tower.tier = (tower.tier + 1) as 2 | 3;
  return { ok: true };
}

export function sell(game: Game, id: number): ActionResult {
  const i = game.towers.findIndex((t) => t.id === id);
  if (i < 0) return { ok: false, reason: "No such tower." };
  game.marks += sellValue(game.towers[i]!);
  game.towers.splice(i, 1);
  return { ok: true };
}

/** Starts the next wave. Only allowed between waves. */
export function sendWave(game: Game): ActionResult {
  if (game.phase !== "build")
    return { ok: false, reason: "A wave is already on its way." };
  const groups = game.level.waves[game.wave];
  if (!groups) return { ok: false, reason: "No more waves." };
  const queue: Game["spawnQueue"] = [];
  for (const g of groups)
    for (let i = 0; i < g.count; i++)
      queue.push({ at: g.delay + i * g.gap, kind: g.enemy });
  queue.sort((a, b) => a.at - b.at);
  game.spawnQueue = queue;
  game.waveClock = 0;
  game.wave += 1;
  game.phase = "wave";
  game.events.push({ type: "wave", wave: game.wave });
  return { ok: true };
}

/** An influencer's followers are watching it, not the road: towers in its charm range hold fire. */
function jammed(game: Game, t: Tower): boolean {
  for (const e of game.enemies) {
    const r = ENEMIES[e.kind].jam;
    if (!r || e.hp <= 0) continue;
    const p = pointAt(game.level.path, e.dist);
    if (Math.hypot(t.col + 0.5 - p.x, t.row + 0.5 - p.y) <= r) return true;
  }
  return false;
}

function charmed(game: Game, t: Tower): boolean {
  for (const c of game.towers)
    if (
      TOWERS[c.kind].cleanse &&
      Math.hypot(c.col - t.col, c.row - t.row) <=
        TOWERS[c.kind].range[c.tier - 1]!
    )
      return false;
  for (const e of game.enemies) {
    const r = ENEMIES[e.kind].charm;
    if (!r || e.hp <= 0) continue;
    const p = pointAt(game.level.path, e.dist);
    if (Math.hypot(t.col + 0.5 - p.x, t.row + 0.5 - p.y) <= r) return true;
  }
  return false;
}

/** Radio Masts see through stealth: an enemy within a mast's range is revealed and marked. */
export function markMultiplier(game: Game, e: Enemy): number {
  const p = pointAt(game.level.path, e.dist);
  let m = 1;
  for (const t of game.towers) {
    const r = TOWERS[t.kind].reveal;
    if (!r) continue;
    if (
      Math.hypot(t.col + 0.5 - p.x, t.row + 0.5 - p.y) <=
      TOWERS[t.kind].range[t.tier - 1]!
    )
      m = Math.max(m, r[t.tier - 1]!);
  }
  return m;
}

export function isRevealed(game: Game, e: Enemy): boolean {
  return !ENEMIES[e.kind].stealth || markMultiplier(game, e) > 1;
}

export function stepGame(game: Game): void {
  if (game.phase !== "wave") return;
  game.tick += 1;
  game.waveClock += STEP;
  if (game.pieCd > 0) game.pieCd = Math.max(0, game.pieCd - STEP);
  const path = game.level.path;

  while (
    game.spawnQueue.length > 0 &&
    game.spawnQueue[0]!.at <= game.waveClock
  ) {
    const next = game.spawnQueue.shift()!;
    game.enemies.push({
      id: game.nextId++,
      kind: next.kind,
      dist: 0,
      hp: ENEMIES[next.kind].hp,
      slowed: false,
      stun: 0,
    });
  }

  // Hedgerows slow whatever is in range; the strongest one wins, they don't stack.
  for (const enemy of game.enemies) {
    const p = pointAt(path, enemy.dist);
    let factor = 1;
    for (const t of game.towers) {
      const spec = TOWERS[t.kind];
      if (spec.slow[0] >= 1) continue;
      if (
        Math.hypot(t.col + 0.5 - p.x, t.row + 0.5 - p.y) <=
        spec.range[t.tier - 1]!
      ) {
        factor = Math.min(factor, spec.slow[t.tier - 1]!);
      }
    }
    enemy.slowed = factor < 1;
    if (enemy.stun > 0) enemy.stun -= STEP;
    else enemy.dist += ENEMIES[enemy.kind].speed * factor * STEP;
  }

  // Clinic-in-a-Box and friends patch up whatever is beside them.
  for (const h of game.enemies) {
    const heal = ENEMIES[h.kind].heal;
    if (!heal || h.hp <= 0) continue;
    for (const e of game.enemies) {
      if (e === h || e.hp <= 0) continue;
      if (Math.abs(e.dist - h.dist) <= 1.6)
        e.hp = Math.min(ENEMIES[e.kind].hp, e.hp + heal * STEP);
    }
  }

  // Scarecrows fire at the enemy furthest along the lane.
  for (const t of game.towers) {
    const inj = TOWERS[t.kind].injunction;
    if (inj) {
      t.cd -= STEP;
      if (t.cd > 0) continue;
      const range = TOWERS[t.kind].range[t.tier - 1]!;
      let served = false;
      for (const e of game.enemies) {
        if (e.hp <= 0 || ENEMIES[e.kind].hp < 1500) continue;
        const p = pointAt(path, e.dist);
        if (Math.hypot(t.col + 0.5 - p.x, t.row + 0.5 - p.y) <= range) {
          e.stun = Math.max(e.stun, inj[t.tier - 1]!);
          served = true;
        }
      }
      t.cd = served ? TOWERS[t.kind].cooldown[t.tier - 1]! : 0;
      continue;
    }
    if (TOWERS[t.kind].damage[0] === 0) continue;
    t.cd -= STEP;
    if (t.cd > 0 && jammed(game, t)) t.cd += STEP / 2;
    if (t.cd > 0) continue;
    if (charmed(game, t)) {
      t.cd = 0;
      continue;
    }
    const spec = TOWERS[t.kind];
    const range = spec.range[t.tier - 1]!;
    let target: Enemy | undefined;
    for (const e of game.enemies) {
      if (e.hp <= 0 || !isRevealed(game, e)) continue;
      const p = pointAt(path, e.dist);
      if (
        Math.hypot(t.col + 0.5 - p.x, t.row + 0.5 - p.y) <= range &&
        (!target || e.dist > target.dist)
      )
        target = e;
    }
    if (!target) {
      t.cd = 0;
      continue;
    }
    const p = pointAt(path, target.dist);
    let dmg = spec.damage[t.tier - 1]!;
    for (const b of game.towers) {
      const bs = TOWERS[b.kind];
      if (
        bs.buff &&
        Math.hypot(b.col - t.col, b.row - t.row) <= bs.range[b.tier - 1]!
      )
        dmg *= bs.buff[b.tier - 1]!;
      if (bs.aura) dmg *= bs.aura[b.tier - 1]!;
    }
    const hit = (e: Enemy) => {
      const armor = ENEMIES[e.kind].armor ?? 0;
      e.hp -= (spec.pierce ? dmg : dmg * (1 - armor)) * markMultiplier(game, e);
    };
    hit(target);
    if (spec.splash) {
      for (const e of game.enemies) {
        if (e === target || e.hp <= 0) continue;
        const q = pointAt(path, e.dist);
        if (Math.hypot(q.x - p.x, q.y - p.y) <= spec.splash) hit(e);
      }
    }
    t.cd = spec.cooldown[t.tier - 1]!;
    game.events.push({
      type: "shot",
      kind: t.kind,
      tower: t.id,
      enemy: target.id,
      fromX: t.col + 0.5,
      fromY: t.row + 0.5,
      toX: p.x,
      toY: p.y,
    });
  }

  const alive: Enemy[] = [];
  const spawned: Enemy[] = [];
  for (const e of game.enemies) {
    const p = pointAt(path, e.dist);
    if (e.hp <= 0) {
      const bounty = ENEMIES[e.kind].bounty;
      game.marks += bounty;
      const split = ENEMIES[e.kind].splits;
      if (split) {
        for (let i = 0; i < split.count; i++) {
          spawned.push({
            id: game.nextId++,
            kind: split.kind,
            dist: Math.max(0, e.dist - i * 0.35),
            hp: ENEMIES[split.kind].hp,
            slowed: false,
            stun: 0,
          });
        }
      }
      game.events.push({ type: "kill", x: p.x, y: p.y, bounty });
    } else if (e.dist >= game.pathLength) {
      game.goodwill -= ENEMIES[e.kind].leak;
      game.events.push({ type: "leak", x: p.x, y: p.y });
    } else alive.push(e);
  }
  game.enemies = alive.concat(spawned);

  if (game.goodwill <= 0) {
    game.goodwill = 0;
    game.phase = "lost";
  } else if (game.spawnQueue.length === 0 && game.enemies.length === 0) {
    if (game.wave >= game.level.waves.length) game.phase = "won";
    else {
      game.phase = "build";
      game.marks += 20 + game.wave * 5;
      for (const t of game.towers)
        game.marks += TOWERS[t.kind].income?.[t.tier - 1] ?? 0;
    }
  }
}

export const PIE_COOLDOWN = 40;
export const PIE_STUN = 3;
export const PIE_FIRST_LEVEL = 3;

export function pieUnlocked(level: Level): boolean {
  return level.id >= PIE_FIRST_LEVEL;
}

/** Cath throws a pie: every enemy on the lane freezes for a few seconds. Bosses only for half as long. */
export function throwPie(game: Game): ActionResult {
  if (!pieUnlocked(game.level))
    return { ok: false, reason: "Cath has not baked one yet." };
  if (game.phase !== "wave")
    return { ok: false, reason: "Save it for a wave." };
  if (game.pieCd > 0)
    return { ok: false, reason: "Still cooling on the windowsill." };
  if (game.enemies.length === 0)
    return { ok: false, reason: "Nothing to throw it at." };
  for (const e of game.enemies)
    e.stun =
      e.kind === "boss" ||
      e.kind === "convoy" ||
      e.kind === "blimp" ||
      e.kind === "megadozer" ||
      e.kind === "clinic" ||
      e.kind === "ship" ||
      e.kind === "swarm" ||
      e.kind === "bus" ||
      e.kind === "board" ||
      e.kind === "hollowcandor"
        ? PIE_STUN / 2
        : PIE_STUN;
  game.pieCd = PIE_COOLDOWN;
  game.events.push({ type: "pie" });
  return { ok: true };
}

export function stars(game: Game): 0 | 1 | 2 | 3 {
  if (game.phase !== "won") return 0;
  const kept = game.goodwill / game.level.goodwill;
  return kept >= 0.9 ? 3 : kept >= 0.5 ? 2 : 1;
}

export function drainEvents(game: Game): GameEvent[] {
  const events = game.events;
  game.events = [];
  return events;
}
