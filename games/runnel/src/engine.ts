// Runnel: a hex irrigation puzzle. Pure, deterministic game logic with no DOM access, so it can be unit
// tested and replayed from a seed.
//
// The board is a hexagon of pointy-top hex cells in axial coordinates (q, r). Each cell holds a channel
// piece: a 6-bit mask with bit d set when the channel opens towards direction d. Directions run clockwise
// on screen, starting east. A puzzle is generated as a random spanning tree rooted at the spring, so every
// channel piece has a solved rotation; the player's rotations are scrambled, and the puzzle is solved when
// water from the spring reaches every cell with no channel leaking onto dry ground.

export interface Hex {
  q: number
  r: number
}

/** Clockwise on screen (y grows downwards), starting east. */
export const DIRECTIONS: readonly Hex[] = [
  { q: 1, r: 0 }, // 0 east
  { q: 0, r: 1 }, // 1 south-east
  { q: -1, r: 1 }, // 2 south-west
  { q: -1, r: 0 }, // 3 west
  { q: 0, r: -1 }, // 4 north-west
  { q: 1, r: -1 }, // 5 north-east
]

export type CellKind = 'spring' | 'channel' | 'field' | 'stone'

export interface Cell {
  q: number
  r: number
  kind: CellKind
  /** The channel mask in its solved orientation (0 for stones). */
  solved: number
  /** Current clockwise rotation, 0-5, applied to `solved`. */
  rot: number
  /** Pinned by the player so taps don't turn it. */
  locked: boolean
  /** A sluice: arrives already in its solved rotation and can never be turned or unpinned. */
  fixed?: boolean
}

export interface Puzzle {
  seed: string
  radius: number
  cells: Cell[]
  /** Taps needed to turn every piece from its scrambled rotation to the generator's solution. */
  par: number
}

export interface Flow {
  /** Indexes of cells water reaches from the spring. */
  wet: Set<number>
  /** Indexes of wet cells with a channel opening onto a stone, the board edge or a blocked neighbour. */
  leaks: Set<number>
  /** For each leaking cell, a mask of the openings that spill. */
  leakMask: Map<number, number>
  /** For each wet cell except the spring, the direction the water came in from. */
  inflow: Map<number, number>
  /** For each wet cell, how many channels the water ran through to get there (the spring is 0). */
  depth: Map<number, number>
  solved: boolean
}

// ---- random numbers ---------------------------------------------------------------------------------

/** 32-bit FNV-1a hash of a string, used to turn a seed string into an RNG seed. */
export function hashString(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32: small, fast and deterministic. Returns floats in [0, 1). */
export function createRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---- masks and geometry -----------------------------------------------------------------------------

export function rotateMask(mask: number, steps: number): number {
  const s = ((steps % 6) + 6) % 6
  return ((mask << s) | (mask >> (6 - s))) & 63
}

export function bitCount(mask: number): number {
  let n = 0
  for (let m = mask; m; m &= m - 1) n++
  return n
}

/** The smallest number of clockwise steps after which the mask looks the same (1, 2, 3 or 6). */
export function rotationalPeriod(mask: number): number {
  for (const p of [1, 2, 3]) if (rotateMask(mask, p) === mask) return p
  return 6
}

export function currentMask(cell: Cell): number {
  return rotateMask(cell.solved, cell.rot)
}

export function hexDistance(a: Hex, b: Hex): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2
}

/** Every cell of a hexagonal board, in row order (top to bottom, left to right). */
export function boardHexes(radius: number): Hex[] {
  const out: Hex[] = []
  for (let r = -radius; r <= radius; r++) {
    for (let q = -radius; q <= radius; q++) {
      if (Math.abs(q + r) <= radius) out.push({ q, r })
    }
  }
  return out
}

function key(q: number, r: number): string {
  return `${q},${r}`
}

/** For each cell, the index of its neighbour in each direction, or -1 off the board. */
export function neighbourTable(cells: readonly Hex[]): number[][] {
  const index = new Map<string, number>()
  cells.forEach((c, i) => index.set(key(c.q, c.r), i))
  return cells.map((c) => DIRECTIONS.map((d) => index.get(key(c.q + d.q, c.r + d.r)) ?? -1))
}

// ---- generation -------------------------------------------------------------------------------------

export interface GenerateOptions {
  radius: number
  /** Share of cells (excluding the spring and its neighbours) turned into stones. */
  stoneRate?: number
  /** How many turnable pieces become fixed sluices, already in place (default 0). */
  fixedCount?: number
}

/**
 * Builds a puzzle from a seed string. The same seed and options always give the same puzzle.
 * Channels form a random spanning tree over the non-stone cells, rooted at the central spring; pieces
 * are then turned to random rotations, keeping at least three quarters of the turnable pieces wrong.
 */
export function generatePuzzle(seed: string, options: GenerateOptions): Puzzle {
  const { radius } = options
  const stoneRate = options.stoneRate ?? 0.08
  const rng = createRng(hashString(`${seed}|r${radius}`))
  const hexes = boardHexes(radius)
  const neighbours = neighbourTable(hexes)
  const centre = hexes.findIndex((h) => h.q === 0 && h.r === 0)

  const stones = chooseStones(hexes, neighbours, centre, stoneRate, rng)
  const masks = growTree(hexes, neighbours, centre, stones, rng)

  const cells: Cell[] = hexes.map((h, i) => {
    if (stones.has(i)) return { q: h.q, r: h.r, kind: 'stone', solved: 0, rot: 0, locked: false }
    const mask = masks[i] ?? 0
    const kind: CellKind = i === centre ? 'spring' : bitCount(mask) === 1 ? 'field' : 'channel'
    return { q: h.q, r: h.r, kind, solved: mask, rot: 0, locked: false }
  })

  const fixedCount = options.fixedCount ?? 0
  if (fixedCount > 0) {
    const pool = cells.map((_, i) => i).filter((i) => i !== centre && cells[i]!.kind === 'channel')
    shuffle(pool, rng)
    for (const i of pool.slice(0, fixedCount)) {
      cells[i]!.fixed = true
      cells[i]!.locked = true
    }
  }

  const par = scramble(cells, rng)
  return { seed, radius, cells, par }
}

function chooseStones(
  hexes: readonly Hex[],
  neighbours: number[][],
  centre: number,
  rate: number,
  rng: () => number,
): Set<number> {
  const stones = new Set<number>()
  const target = Math.round((hexes.length - 7) * rate)
  const candidates = hexes.map((_, i) => i).filter((i) => hexDistance(hexes[i]!, { q: 0, r: 0 }) >= 2)
  shuffle(candidates, rng)
  for (const i of candidates) {
    if (stones.size >= target) break
    stones.add(i)
    // Keep the playable cells in one connected piece; undo the stone if it splits them.
    if (!allConnected(hexes.length, neighbours, centre, stones)) stones.delete(i)
  }
  return stones
}

function allConnected(n: number, neighbours: number[][], start: number, blocked: Set<number>): boolean {
  const seen = new Set<number>([start])
  const stack = [start]
  while (stack.length) {
    const i = stack.pop()!
    for (const j of neighbours[i]!) {
      if (j >= 0 && !blocked.has(j) && !seen.has(j)) {
        seen.add(j)
        stack.push(j)
      }
    }
  }
  return seen.size === n - blocked.size
}

/** The most openings a generated piece is allowed to have; a fourth opening reads badly on a phone. */
const MAX_OPENINGS = 3
/** How many randomised attempts to make before accepting a tree that has to break the cap somewhere. */
const GROW_TREE_ATTEMPTS = 40

/**
 * Randomised Prim's algorithm from the spring, retried until every cell (the spring included) stays at
 * or under `MAX_OPENINGS`. A bad random order can back the tree into a corner where every frontier cell
 * is already full; when every attempt does, the least-bad attempt is kept (fewest, and least severe,
 * over-cap cells; ties preferring the spring not be the one that goes over) rather than looping forever.
 */
function growTree(
  hexes: readonly Hex[],
  neighbours: number[][],
  centre: number,
  stones: Set<number>,
  rng: () => number,
): number[] {
  let best: number[] | null = null
  let bestScore = Infinity
  for (let attempt = 0; attempt < GROW_TREE_ATTEMPTS; attempt++) {
    const masks = growTreeAttempt(hexes, neighbours, centre, stones, rng)
    const score = masks.reduce(
      (sum, m, i) => sum + Math.max(0, bitCount(m) - MAX_OPENINGS) * (i === centre ? 100 : 1),
      0,
    )
    if (score === 0) return masks
    if (score < bestScore) {
      best = masks
      bestScore = score
    }
  }
  return best!
}

function growTreeAttempt(
  hexes: readonly Hex[],
  neighbours: number[][],
  centre: number,
  stones: Set<number>,
  rng: () => number,
): number[] {
  const masks = new Array<number>(hexes.length).fill(0)
  const inTree = new Set<number>([centre])
  const total = hexes.length - stones.size
  while (inTree.size < total) {
    const good: Array<[number, number]> = []
    const any: Array<[number, number]> = []
    for (const i of inTree) {
      for (let d = 0; d < 6; d++) {
        const j = neighbours[i]![d]!
        if (j < 0 || stones.has(j) || inTree.has(j)) continue
        any.push([i, d])
        if (bitCount(masks[i]!) < MAX_OPENINGS) good.push([i, d])
      }
    }
    // If nothing keeps every cell in cap, prefer overloading a non-spring cell over the spring.
    const nonSpring = any.filter(([i]) => i !== centre)
    const pool = good.length ? good : nonSpring.length ? nonSpring : any
    const [i, d] = pool[Math.floor(rng() * pool.length)]!
    const j = neighbours[i]![d]!
    masks[i] = masks[i]! | (1 << d)
    masks[j] = masks[j]! | (1 << ((d + 3) % 6))
    inTree.add(j)
  }
  return masks
}

/**
 * Turns pieces to random rotations and returns the par (taps back to the generator's solution). Retries
 * until at least three quarters of the turnable pieces are wrong and the board isn't already solved; if
 * no attempt manages that within the budget, the attempt with the most wrong pieces is kept instead of
 * whatever the last random draw happened to produce, so a puzzle is never handed to a player pre-solved
 * (unless it genuinely has no turnable pieces at all, which is already solved by construction).
 */
function scramble(cells: Cell[], rng: () => number): number {
  const turnable = cells.filter((c) => c.kind !== 'stone' && !c.fixed && rotationalPeriod(c.solved) > 1)
  let best: number[] | null = null
  let bestWrong = -1
  for (let attempt = 0; attempt < 50; attempt++) {
    const rotations = turnable.map(() => Math.floor(rng() * 6))
    const wrong = turnable.filter((c, k) => rotateMask(c.solved, rotations[k]!) !== c.solved).length
    turnable.forEach((c, k) => (c.rot = rotations[k]!))
    if (wrong >= Math.ceil(turnable.length * 0.75) && !computeFlow(cells).solved) {
      best = null
      break
    }
    if (wrong > bestWrong) {
      best = rotations
      bestWrong = wrong
    }
  }
  if (best) turnable.forEach((c, k) => (c.rot = best[k]!))
  // Par: fewest clockwise taps from each piece's scrambled rotation back to a solved-looking rotation.
  let par = 0
  for (const c of turnable) par += tapsToSolve(c)
  return par
}

export function tapsToSolve(cell: Cell): number {
  for (let t = 0; t < 6; t++) {
    if (rotateMask(cell.solved, cell.rot + t) === cell.solved) return t
  }
  return 0
}

// ---- play -------------------------------------------------------------------------------------------

const neighbourCache = new WeakMap<readonly Cell[], number[][]>()

function neighboursOf(cells: readonly Cell[]): number[][] {
  let table = neighbourCache.get(cells)
  if (!table) {
    table = neighbourTable(cells)
    neighbourCache.set(cells, table)
  }
  return table
}

/** Where the water gets to, which wet cells leak, and whether the puzzle is solved. */
export function computeFlow(cells: readonly Cell[]): Flow {
  const neighbours = neighboursOf(cells)
  const spring = cells.findIndex((c) => c.kind === 'spring')
  const wet = new Set<number>()
  const leaks = new Set<number>()
  const leakMask = new Map<number, number>()
  const inflow = new Map<number, number>()
  const depth = new Map<number, number>()
  if (spring < 0) return { wet, leaks, leakMask, inflow, depth, solved: false }
  const masks = cells.map(currentMask)
  // Breadth-first, so depth is the water's travel distance and animations can cascade outwards.
  const queue = [spring]
  wet.add(spring)
  depth.set(spring, 0)
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head]!
    const mask = masks[i]!
    for (let d = 0; d < 6; d++) {
      if (!(mask & (1 << d))) continue
      const j = neighbours[i]![d]!
      const joined = j >= 0 && cells[j]!.kind !== 'stone' && (masks[j]! & (1 << ((d + 3) % 6))) !== 0
      if (!joined) {
        leaks.add(i)
        leakMask.set(i, (leakMask.get(i) ?? 0) | (1 << d))
        continue
      }
      if (!wet.has(j)) {
        wet.add(j)
        inflow.set(j, (d + 3) % 6)
        depth.set(j, depth.get(i)! + 1)
        queue.push(j)
      }
    }
  }
  const playable = cells.filter((c) => c.kind !== 'stone').length
  return { wet, leaks, leakMask, inflow, depth, solved: wet.size === playable && leaks.size === 0 }
}

/** Turns a cell one step clockwise (or anticlockwise). Returns false when the cell can't turn. */
export function rotateCell(cells: Cell[], index: number, clockwise = true): boolean {
  const cell = cells[index]
  if (!cell || cell.kind === 'stone' || cell.locked || cell.fixed) return false
  cell.rot = (cell.rot + (clockwise ? 1 : 5)) % 6
  return true
}

// ---- daily puzzles ----------------------------------------------------------------------------------

/** Day 1 of the daily puzzle. */
export const DAILY_EPOCH = '2026-09-27'
export const DAILY_RADIUS = 3

export function utcDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function dailyNumber(dateString: string): number {
  const ms = Date.parse(`${dateString}T00:00:00Z`) - Date.parse(`${DAILY_EPOCH}T00:00:00Z`)
  return Math.floor(ms / 86_400_000) + 1
}

/** First daily that can carry sluices, so puzzles already in players' saves don't change. */
export const SLUICE_FROM = '2026-10-01'

/** Sluices are introduced gradually by weekday: none Sun-Tue, then 2 on Wednesday, 3 Friday, 4 Saturday. */
export function sluicesFor(dateString: string): number {
  if (dateString < SLUICE_FROM) return 0
  const day = new Date(`${dateString}T00:00:00Z`).getUTCDay()
  return ({ 3: 2, 5: 3, 6: 4 } as Record<number, number>)[day] ?? 0
}

export function dailyPuzzle(dateString: string): Puzzle {
  return generatePuzzle(`daily-${dateString}`, { radius: DAILY_RADIUS, fixedCount: sluicesFor(dateString) })
}

// ---- helpers ----------------------------------------------------------------------------------------

function shuffle<T>(items: T[], rng: () => number): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = items[i]!
    items[i] = items[j]!
    items[j] = tmp
  }
}

/**
 * Water drops earned for a finished puzzle (1 to 3). Par is the perfect route, which a player can only
 * hit by already knowing the answer, so the top rating allows a little slack (10%, at least 2 taps) and
 * the middle one 50% (at least 4 taps), whatever the puzzle's size.
 */
export function dropsFor(taps: number, par: number): 1 | 2 | 3 {
  if (taps <= par + Math.max(2, Math.ceil(par * 0.1))) return 3
  if (taps <= par + Math.max(4, Math.ceil(par * 0.5))) return 2
  return 1
}
