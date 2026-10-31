// Bea's workshop: a hand-built board. A layout is the solved channel mask of every cell (0 = stone), which
// is small enough to share as a code (`W2-` + one character per cell). A layout is checked with the same
// flow solver the game uses: water from the spring must reach every cell with nothing leaking. The player
// sees it scrambled with a rotation drawn from the layout itself, so the same code is the same puzzle.

import {
  boardHexes,
  computeFlow,
  createRng,
  hashString,
  neighbourTable,
  scramble,
  type Cell,
  type CellKind,
  type Puzzle,
  bitCount,
} from './engine'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
export const WORKSHOP_PREFIX = 'workshop-'

export interface Layout {
  radius: number
  /** Solved mask per cell in `boardHexes(radius)` order; 0 is a stone. */
  masks: number[]
}

export function emptyLayout(radius: number): Layout {
  return { radius, masks: boardHexes(radius).map(() => 0) }
}

export function encodeLayout(l: Layout): string {
  return `W${l.radius}-${l.masks.map((m) => ALPHABET[m & 63]).join('')}`
}

export function parseLayout(text: string): Layout | null {
  const m = /^W([2-4])-([A-Za-z0-9_-]+)$/.exec(text.trim())
  if (!m) return null
  const radius = Number(m[1])
  const masks = [...m[2]!].map((ch) => ALPHABET.indexOf(ch))
  if (masks.length !== boardHexes(radius).length || masks.some((x) => x < 0)) return null
  return { radius, masks }
}

/** Joins or cuts the channel between two neighbouring cells (both ends move together). Stones are skipped. */
export function toggleEdge(l: Layout, a: number, dir: number): boolean {
  const hexes = boardHexes(l.radius)
  const b = neighbourTable(hexes)[a]![dir]!
  if (b < 0) return false
  l.masks[a] = (l.masks[a]! ^ (1 << dir)) & 63
  l.masks[b] = (l.masks[b]! ^ (1 << ((dir + 3) % 6))) & 63
  return true
}

/** Opening a cell to a stone or off the board is impossible here, so a cell is a stone only when its mask is 0. */
export function layoutCells(l: Layout): Cell[] {
  const hexes = boardHexes(l.radius)
  const centre = hexes.findIndex((h) => h.q === 0 && h.r === 0)
  return hexes.map((h, i) => {
    const mask = l.masks[i]!
    if (mask === 0 && i !== centre) return { q: h.q, r: h.r, kind: 'stone' as CellKind, solved: 0, rot: 0, locked: false }
    const kind: CellKind = i === centre ? 'spring' : bitCount(mask) === 1 ? 'field' : 'channel'
    return { q: h.q, r: h.r, kind, solved: mask, rot: 0, locked: false }
  })
}

export interface Check {
  ok: boolean
  /** Plain-words reason when not ok. */
  problem: string
  /** Number of turnable pieces. */
  pieces: number
}

/** Runs the real solver on the layout in its solved rotation. */
export function checkLayout(l: Layout): Check {
  const cells = layoutCells(l)
  const live = cells.filter((c) => c.kind !== 'stone').length
  if (live < 4) return { ok: false, problem: 'Draw some channels from the spring first.', pieces: 0 }
  const flow = computeFlow(cells)
  if (flow.wet.size < live) return { ok: false, problem: `${live - flow.wet.size} tile(s) cannot be reached from the spring.`, pieces: 0 }
  if (flow.leaks.size) return { ok: false, problem: 'A channel opens onto nothing.', pieces: 0 }
  const pieces = cells.filter((c) => c.kind === 'channel').length
  if (pieces < 2) return { ok: false, problem: 'Needs at least two bends or junctions to be a puzzle.', pieces }
  return { ok: true, problem: '', pieces }
}

export function workshopSeed(code: string): string {
  return `${WORKSHOP_PREFIX}${code}`
}

export function isWorkshopSeed(seed: string): boolean {
  return seed.startsWith(WORKSHOP_PREFIX)
}

/** The scrambled puzzle for a checked layout code, or null when the code is not a solvable layout. */
export function workshopPuzzle(seed: string): Puzzle | null {
  if (!isWorkshopSeed(seed)) return null
  const layout = parseLayout(seed.slice(WORKSHOP_PREFIX.length))
  if (!layout || !checkLayout(layout).ok) return null
  const cells = layoutCells(layout)
  const par = scramble(cells, createRng(hashString(seed)))
  return { seed, radius: layout.radius, cells, par }
}
