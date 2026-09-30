// Hedgerow's engine: a pure, deterministic tower-defence simulation with no DOM. The world advances in
// fixed steps of STEP seconds (30 Hz), so the same build orders always give the same result, in tests, in
// the level bot and in the browser. Distances are in grid cells; the lane is a polyline through cell
// centres. Towers are hitscan: a shot lands the moment it fires, and the renderer draws the flight from the
// `events` list.

export const STEP = 1 / 30

export type TowerKind = 'hedgerow' | 'scarecrow' | 'beehive'
export type EnemyKind = 'van' | 'drone'

export interface TowerSpec {
  name: string
  blurb: string
  cost: number
  /** Upgrade cost to reach tier 2 and tier 3. */
  upgrades: [number, number]
  range: [number, number, number]
  /** Damage per shot (0 for the hedgerow). */
  damage: [number, number, number]
  /** Seconds between shots. */
  cooldown: [number, number, number]
  /** Enemies within this many cells of the target also take the damage (0 = single target). */
  splash?: number
  /** Speed multiplier applied to enemies in range (1 = none). */
  slow: [number, number, number]
}

export const TOWERS: Record<TowerKind, TowerSpec> = {
  hedgerow: {
    name: 'Hedgerow',
    blurb: 'Thick, thorny and cheap. Slows everything that passes.',
    cost: 50,
    upgrades: [45, 75],
    range: [1.3, 1.5, 1.7],
    damage: [0, 0, 0],
    cooldown: [1, 1, 1],
    slow: [0.62, 0.5, 0.4],
  },
  scarecrow: {
    name: 'Scarecrow',
    blurb: 'Throws turnips at the front of the queue.',
    cost: 80,
    upgrades: [70, 110],
    range: [2.4, 2.7, 3.1],
    damage: [8, 13, 20],
    cooldown: [0.8, 0.68, 0.55],
    slow: [1, 1, 1],
  },
  beehive: {
    name: 'Beehive',
    blurb: 'A swarm that stings everything near its target.',
    cost: 120,
    upgrades: [90, 140],
    range: [2.0, 2.2, 2.5],
    damage: [6, 10, 15],
    cooldown: [1.1, 1, 0.9],
    slow: [1, 1, 1],
    splash: 1.1,
  },
}

export interface EnemySpec {
  name: string
  hp: number
  /** Cells per second. */
  speed: number
  bounty: number
  /** Goodwill lost when it reaches the farmhouse. */
  leak: number
}

export const ENEMIES: Record<EnemyKind, EnemySpec> = {
  van: { name: 'Delivery van', hp: 98, speed: 0.9, bounty: 9, leak: 1 },
  drone: { name: 'Delivery drone', hp: 35, speed: 1.8, bounty: 6, leak: 1 },
}

export interface WaveGroup {
  enemy: EnemyKind
  count: number
  /** Seconds between spawns in this group. */
  gap: number
  /** Seconds after the wave starts that the group begins. */
  delay: number
}

export interface StoryLine {
  who: 'cath' | 'mara' | 'bea' | 'tomas' | 'narrator'
  expression?: 'smirk' | 'delighted' | 'determined' | 'worried' | 'wink'
  text: string
}

export interface Level {
  id: number
  name: string
  place: string
  cols: number
  rows: number
  /** Cell waypoints; consecutive points share a row or a column. The last one is the farmhouse. */
  path: Array<[number, number]>
  startMarks: number
  goodwill: number
  towers: TowerKind[]
  waves: WaveGroup[][]
  before: StoryLine[]
  after: StoryLine[]
  /** What finishing the level unlocks (a tier, a skin or a lore card). */
  reward: string
}

export interface Tower {
  id: number
  kind: TowerKind
  col: number
  row: number
  tier: 1 | 2 | 3
  cd: number
  spent: number
}

export interface Enemy {
  id: number
  kind: EnemyKind
  dist: number
  hp: number
  slowed: boolean
}

export type GameEvent =
  | { type: 'shot'; kind: TowerKind; tower: number; enemy: number; fromX: number; fromY: number; toX: number; toY: number }
  | { type: 'kill'; x: number; y: number; bounty: number }
  | { type: 'leak'; x: number; y: number }
  | { type: 'wave'; wave: number }

export type Phase = 'build' | 'wave' | 'won' | 'lost'

export interface Game {
  level: Level
  tick: number
  phase: Phase
  marks: number
  goodwill: number
  /** Waves sent so far. */
  wave: number
  waveClock: number
  spawnQueue: Array<{ at: number; kind: EnemyKind }>
  enemies: Enemy[]
  towers: Tower[]
  nextId: number
  pathLength: number
  events: GameEvent[]
}

export function pathLength(path: Level['path']): number {
  let total = 0
  for (let i = 1; i < path.length; i++) total += Math.abs(path[i]![0] - path[i - 1]![0]) + Math.abs(path[i]![1] - path[i - 1]![1])
  return total
}

/** Cell-centre position (in cell units, x to the right) at `dist` cells along the lane. */
export function pointAt(path: Level['path'], dist: number): { x: number; y: number } {
  let left = Math.max(0, dist)
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = path[i - 1]!
    const [bx, by] = path[i]!
    const len = Math.abs(bx - ax) + Math.abs(by - ay)
    if (left <= len || i === path.length - 1) {
      const t = len === 0 ? 0 : Math.min(1, left / len)
      return { x: ax + (bx - ax) * t + 0.5, y: ay + (by - ay) * t + 0.5 }
    }
    left -= len
  }
  const last = path[path.length - 1]!
  return { x: last[0] + 0.5, y: last[1] + 0.5 }
}

export function laneCells(path: Level['path']): Set<string> {
  const cells = new Set<string>()
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = path[i - 1]!
    const [bx, by] = path[i]!
    const dx = Math.sign(bx - ax)
    const dy = Math.sign(by - ay)
    let x = ax
    let y = ay
    cells.add(`${x},${y}`)
    while (x !== bx || y !== by) {
      x += dx
      y += dy
      cells.add(`${x},${y}`)
    }
  }
  return cells
}

export function isPlot(level: Level, col: number, row: number): boolean {
  if (col < 0 || row < 0 || col >= level.cols || row >= level.rows) return false
  return !laneCells(level.path).has(`${col},${row}`)
}

export function newGame(level: Level): Game {
  return {
    level,
    tick: 0,
    phase: 'build',
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
  }
}

export function towerAt(game: Game, col: number, row: number): Tower | undefined {
  return game.towers.find((t) => t.col === col && t.row === row)
}

export function sellValue(tower: Tower): number {
  return Math.floor(tower.spent * 0.7)
}

export function upgradeCost(tower: Tower): number | null {
  return tower.tier >= 3 ? null : TOWERS[tower.kind].upgrades[tower.tier - 1]!
}

export type ActionResult = { ok: true } | { ok: false; reason: string }

export function place(game: Game, kind: TowerKind, col: number, row: number): ActionResult {
  if (game.phase === 'won' || game.phase === 'lost') return { ok: false, reason: 'The level is over.' }
  if (!game.level.towers.includes(kind)) return { ok: false, reason: 'Not unlocked yet.' }
  if (!isPlot(game.level, col, row)) return { ok: false, reason: 'You can only build beside the lane.' }
  if (towerAt(game, col, row)) return { ok: false, reason: 'That plot is taken.' }
  const cost = TOWERS[kind].cost
  if (game.marks < cost) return { ok: false, reason: `Needs ${cost} Marks.` }
  game.marks -= cost
  game.towers.push({ id: game.nextId++, kind, col, row, tier: 1, cd: 0, spent: cost })
  return { ok: true }
}

export function upgrade(game: Game, id: number): ActionResult {
  const tower = game.towers.find((t) => t.id === id)
  if (!tower) return { ok: false, reason: 'No such tower.' }
  const cost = upgradeCost(tower)
  if (cost === null) return { ok: false, reason: 'Already fully grown.' }
  if (game.marks < cost) return { ok: false, reason: `Needs ${cost} Marks.` }
  game.marks -= cost
  tower.spent += cost
  tower.tier = (tower.tier + 1) as 2 | 3
  return { ok: true }
}

export function sell(game: Game, id: number): ActionResult {
  const i = game.towers.findIndex((t) => t.id === id)
  if (i < 0) return { ok: false, reason: 'No such tower.' }
  game.marks += sellValue(game.towers[i]!)
  game.towers.splice(i, 1)
  return { ok: true }
}

/** Starts the next wave. Only allowed between waves. */
export function sendWave(game: Game): ActionResult {
  if (game.phase !== 'build') return { ok: false, reason: 'A wave is already on its way.' }
  const groups = game.level.waves[game.wave]
  if (!groups) return { ok: false, reason: 'No more waves.' }
  const queue: Game['spawnQueue'] = []
  for (const g of groups) for (let i = 0; i < g.count; i++) queue.push({ at: g.delay + i * g.gap, kind: g.enemy })
  queue.sort((a, b) => a.at - b.at)
  game.spawnQueue = queue
  game.waveClock = 0
  game.wave += 1
  game.phase = 'wave'
  game.events.push({ type: 'wave', wave: game.wave })
  return { ok: true }
}

export function stepGame(game: Game): void {
  if (game.phase !== 'wave') return
  game.tick += 1
  game.waveClock += STEP
  const path = game.level.path

  while (game.spawnQueue.length > 0 && game.spawnQueue[0]!.at <= game.waveClock) {
    const next = game.spawnQueue.shift()!
    game.enemies.push({ id: game.nextId++, kind: next.kind, dist: 0, hp: ENEMIES[next.kind].hp, slowed: false })
  }

  // Hedgerows slow whatever is in range; the strongest one wins, they don't stack.
  for (const enemy of game.enemies) {
    const p = pointAt(path, enemy.dist)
    let factor = 1
    for (const t of game.towers) {
      if (t.kind !== 'hedgerow') continue
      const spec = TOWERS.hedgerow
      if (Math.hypot(t.col + 0.5 - p.x, t.row + 0.5 - p.y) <= spec.range[t.tier - 1]!) {
        factor = Math.min(factor, spec.slow[t.tier - 1]!)
      }
    }
    enemy.slowed = factor < 1
    enemy.dist += ENEMIES[enemy.kind].speed * factor * STEP
  }

  // Scarecrows fire at the enemy furthest along the lane.
  for (const t of game.towers) {
    if (t.kind === 'hedgerow') continue
    t.cd -= STEP
    if (t.cd > 0) continue
    const spec = TOWERS[t.kind]
    const range = spec.range[t.tier - 1]!
    let target: Enemy | undefined
    for (const e of game.enemies) {
      if (e.hp <= 0) continue
      const p = pointAt(path, e.dist)
      if (Math.hypot(t.col + 0.5 - p.x, t.row + 0.5 - p.y) <= range && (!target || e.dist > target.dist)) target = e
    }
    if (!target) {
      t.cd = 0
      continue
    }
    const p = pointAt(path, target.dist)
    const dmg = spec.damage[t.tier - 1]!
    target.hp -= dmg
    if (spec.splash) {
      for (const e of game.enemies) {
        if (e === target || e.hp <= 0) continue
        const q = pointAt(path, e.dist)
        if (Math.hypot(q.x - p.x, q.y - p.y) <= spec.splash) e.hp -= dmg
      }
    }
    t.cd = spec.cooldown[t.tier - 1]!
    game.events.push({ type: 'shot', kind: t.kind, tower: t.id, enemy: target.id, fromX: t.col + 0.5, fromY: t.row + 0.5, toX: p.x, toY: p.y })
  }

  const alive: Enemy[] = []
  for (const e of game.enemies) {
    const p = pointAt(path, e.dist)
    if (e.hp <= 0) {
      const bounty = ENEMIES[e.kind].bounty
      game.marks += bounty
      game.events.push({ type: 'kill', x: p.x, y: p.y, bounty })
    } else if (e.dist >= game.pathLength) {
      game.goodwill -= ENEMIES[e.kind].leak
      game.events.push({ type: 'leak', x: p.x, y: p.y })
    } else alive.push(e)
  }
  game.enemies = alive

  if (game.goodwill <= 0) {
    game.goodwill = 0
    game.phase = 'lost'
  } else if (game.spawnQueue.length === 0 && game.enemies.length === 0) {
    if (game.wave >= game.level.waves.length) game.phase = 'won'
    else {
      game.phase = 'build'
      game.marks += 20 + game.wave * 5
    }
  }
}

export function stars(game: Game): 0 | 1 | 2 | 3 {
  if (game.phase !== 'won') return 0
  const kept = game.goodwill / game.level.goodwill
  return kept >= 0.9 ? 3 : kept >= 0.5 ? 2 : 1
}

export function drainEvents(game: Game): GameEvent[] {
  const events = game.events
  game.events = []
  return events
}
