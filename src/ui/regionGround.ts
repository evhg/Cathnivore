// Plan item 76: each region's own drawn ground, under the pieces. The washes in Map.tsx's GroundArt are one per
// region type, so Highmoor and Brindle Hills (both pasture) read the same; this gives every region its own
// small marks (Saltmarsh's reeds and tide lines, Highmoor's heather and boulders, Kingsmarket's cobbles...),
// seeded by the region's id so a board looks the same each time, and placed only where the piece tray leaves
// the tile face clear. Pure, so a unit test proves the count, the fit and the clearance; Map.tsx draws from it.

import { TILE_R, rectsOverlap, type PieceRect } from './pieceLayout'
import type { RegionType } from '../engine/types'

export type GroundKind =
  | 'reeds'
  | 'tideLine'
  | 'heather'
  | 'boulder'
  | 'cobbles'
  | 'bunting'
  | 'tree'
  | 'furrows'
  | 'sheaf'
  | 'drystone'
  | 'gorse'
  | 'pebbles'
  | 'groyne'
  | 'gull'

export interface GroundMark {
  kind: GroundKind
  /** Centre in tile units (the hex centre is 0,0; pointy top, radius TILE_R). */
  x: number
  y: number
  /** Scale (1 at the kind's base size) and a turn in degrees. */
  s: number
  r: number
}

/** Each kind's footprint at scale 1, in tile units (width, height). */
export const GROUND_SIZE: Record<GroundKind, [number, number]> = {
  reeds: [12, 14],
  tideLine: [34, 6],
  heather: [12, 8],
  boulder: [12, 8],
  cobbles: [18, 12],
  bunting: [30, 8],
  tree: [16, 18],
  furrows: [26, 12],
  sheaf: [9, 13],
  drystone: [30, 6],
  gorse: [12, 9],
  pebbles: [14, 7],
  groyne: [6, 22],
  gull: [10, 5],
}

/** What each region's ground is made of, most common first; a region not named here takes its type's set. */
const BY_REGION: Partial<Record<string, GroundKind[]>> = {
  saltmarsh: ['reeds', 'tideLine', 'reeds', 'gull'],
  shingleBay: ['pebbles', 'groyne', 'tideLine', 'gull'],
  gullsHead: ['gull', 'pebbles', 'tideLine', 'reeds'],
  highmoor: ['heather', 'boulder', 'heather', 'gorse'],
  brindleHills: ['drystone', 'gorse', 'boulder', 'heather'],
  tarnside: ['reeds', 'boulder', 'heather', 'gorse'],
  rivermead: ['tree', 'sheaf', 'furrows', 'tree'],
  oakvale: ['furrows', 'tree', 'sheaf', 'furrows'],
  fernlea: ['sheaf', 'furrows', 'gorse', 'tree'],
  kingsmarket: ['cobbles', 'bunting', 'cobbles', 'tree'],
}
const BY_TYPE: Record<RegionType, GroundKind[]> = {
  coast: ['reeds', 'tideLine', 'pebbles', 'gull'],
  pasture: ['heather', 'boulder', 'gorse', 'drystone'],
  crop: ['furrows', 'sheaf', 'tree', 'furrows'],
  capital: ['cobbles', 'bunting', 'cobbles', 'tree'],
}

/** How many marks a tile aims for, and the fewest it settles for. */
export const GROUND_TARGET = 9
export const GROUND_MIN = 4
/** The face the marks keep inside, and their clearance from the pieces and each other, in tile units. */
const FACE = TILE_R * 0.86
const PIECE_PAD = 3
const MARK_PAD = 2

/** The kinds a region's ground is drawn from. */
export function groundKinds(id: string, type: RegionType): GroundKind[] {
  return BY_REGION[id] ?? BY_TYPE[type]
}

/** A mark's box in tile units, as a PieceRect so pieceLayout's overlap test reads it. */
export function markRect(m: GroundMark): PieceRect {
  const [w, h] = GROUND_SIZE[m.kind]
  // A turned mark: its box grows to cover the turn (a quarter turn swaps width and height).
  const a = (Math.abs(m.r) * Math.PI) / 180
  const bw = (Math.abs(Math.cos(a)) * w + Math.abs(Math.sin(a)) * h) * m.s
  const bh = (Math.abs(Math.sin(a)) * w + Math.abs(Math.cos(a)) * h) * m.s
  return { kind: 'badge', x0: m.x - bw / 2, y0: m.y - bh / 2, x1: m.x + bw / 2, y1: m.y + bh / 2 }
}

/** Whether a point is inside the pointy-top hex of radius `r` round 0,0. */
export function inHex(x: number, y: number, r: number): boolean {
  return Math.abs(x) <= (Math.sqrt(3) / 2) * r && Math.abs(y) <= r - Math.abs(x) / Math.sqrt(3)
}

function rectInHex(b: PieceRect, r: number): boolean {
  return inHex(b.x0, b.y0, r) && inHex(b.x1, b.y0, r) && inHex(b.x0, b.y1, r) && inHex(b.x1, b.y1, r)
}

/** A small seeded generator (mulberry32) from the region's id, so a tile's ground never changes between renders. */
function rng(id: string): () => number {
  let h = 2166136261
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  let t = h >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let x = Math.imul(t ^ (t >>> 15), 1 | t)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * The region's ground marks, clear of every piece slot in `tray` and of each other, inside the tile face.
 * Kinds come round in the region's order, so the first (its signature) is the most common.
 */
export function regionGround(id: string, type: RegionType, tray: readonly PieceRect[]): GroundMark[] {
  const kinds = groundKinds(id, type)
  const rand = rng(id)
  const marks: GroundMark[] = []
  const boxes: PieceRect[] = []
  // Lines along the ground (tide lines, walls, furrows) lie nearly level; standing things (reeds, trees) upright.
  const lying = new Set<GroundKind>(['tideLine', 'drystone', 'furrows', 'bunting'])
  // Each slot tries its own kind first (so the signature, listed first and twice, leads), shrinking as it misses,
  // then falls back to the next kind: a long tide line may never fit a crowded tile.
  // Plan item 172: a tile crowded with the larger pieces gets a second, smaller pass so it keeps GROUND_MIN marks.
  for (const [k, want] of [[1, GROUND_TARGET], [0.6, GROUND_MIN]] as const)
  for (let slot = 0; slot < GROUND_TARGET * 3 && marks.length < want; slot++) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const kind = kinds[(slot + Math.floor(attempt / 20)) % kinds.length]!
      const s = k * (0.8 + rand() * 0.45) * (1 - (attempt % 20) * 0.015)
      const r = lying.has(kind) ? (rand() - 0.5) * 24 : kind === 'groyne' ? (rand() - 0.5) * 30 : 0
      const m: GroundMark = { kind, x: (rand() * 2 - 1) * FACE * 0.87, y: (rand() * 2 - 1) * FACE, s: Math.round(s * 100) / 100, r: Math.round(r) }
      const b = markRect(m)
      if (!rectInHex(b, FACE)) continue
      if (tray.some((p) => rectsOverlap(b, p, PIECE_PAD))) continue
      if (boxes.some((o) => rectsOverlap(b, o, MARK_PAD))) continue
      marks.push(m)
      boxes.push(b)
      break
    }
  }
  return marks
}
