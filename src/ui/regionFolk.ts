// Plan item 717: the market's people. Each region holds 2-4 tiny shoppers walking to and fro between its stalls, so the
// board reads as a market, not a sheet of stamps. How many and how warm follows the region's state: busy when freed,
// sparse and grey under Hollowell's hold. Pure and seeded by the region, so a unit test proves the count and that no
// figure, anywhere along its walk, meets a piece, a counter, a badge, the landmark or a stall. Map.tsx draws them.

import { TILE_R, rectsOverlap, type PieceRect } from './pieceLayout'
import { inHex, markRect, rectInHex, rng, type GroundMark } from './regionGround'

export type FolkControl = 'held' | 'contested' | 'free' | undefined

export interface Shopper {
  /** Feet at the walk's two ends, in tile units round the hex centre (x0,y0 is where the shopper starts). */
  x0: number
  y0: number
  x1: number
  y1: number
  /** Scale (1 at the base size) and a colour (an index into the coat palette). */
  s: number
  tone: number
}

/** A shopper's box at scale 1, feet at 0,0: 8 units wide, 17 tall. */
export const FOLK_W = 8
export const FOLK_H = 17
/** How many each state aims for, and the fewest a crowded tile settles for. */
export const FOLK_COUNT: Record<'held' | 'contested' | 'free' | 'none', number> = { free: 4, contested: 3, none: 3, held: 2 }
export const FOLK_MIN = 2
export const FOLK_TONES = 5
const FACE = TILE_R * 0.84
const PAD = 2

/** The box a shopper sweeps along its whole walk (both ends' figures and everything between). */
export function folkRect(f: Shopper): PieceRect {
  const hw = (FOLK_W / 2) * f.s
  const h = FOLK_H * f.s
  return { kind: 'badge', x0: Math.min(f.x0, f.x1) - hw, y0: Math.min(f.y0, f.y1) - h, x1: Math.max(f.x0, f.x1) + hw, y1: Math.max(f.y0, f.y1) + 1 }
}

/** How much bigger a small board draws its shoppers (`hexPx`, a hex's radius in CSS px), so a phone's read as people. */
export function folkScale(hexPx: number): number {
  return Math.min(1.4, Math.max(1, 80 / hexPx))
}

/**
 * The region's shoppers, clear of every box in `taken` (the piece tray, the landmark, the event dressing) and of the
 * ground's stalls and signboards, inside the tile face. Each walks a level-ish stretch; a tile too crowded for a walk
 * keeps a shopper standing, smaller, rather than none.
 */
export function regionFolk(id: string, taken: readonly PieceRect[], marks: readonly GroundMark[], control: FolkControl, k = 1): Shopper[] {
  // The board re-renders on every beat of an enemy turn; a tile's people only change when its pieces or state do.
  const key = `${id}|${control}|${k}|${taken.map((r) => `${r.x0},${r.y0},${r.x1},${r.y1}`).join(';')}|${marks.map((m) => `${m.kind}${m.x},${m.y},${m.s}`).join(';')}`
  const hit = CACHE.get(key)
  if (hit) return hit
  const folk = placeFolk(id, taken, marks, control, k)
  if (CACHE.size > 256) CACHE.clear()
  CACHE.set(key, folk)
  return folk
}
const CACHE = new Map<string, Shopper[]>()

function placeFolk(id: string, taken: readonly PieceRect[], marks: readonly GroundMark[], control: FolkControl, k: number): Shopper[] {
  const rand = rng(`${id}:folk`)
  const want = FOLK_COUNT[control ?? 'none']
  const blocked = [...taken, ...marks.filter((m) => m.kind === 'stall' || m.kind === 'hsign').map(markRect)]
  const stalls = marks.filter((m) => m.kind === 'stall')
  const out: Shopper[] = []
  const boxes: PieceRect[] = []
  const fits = (f: Shopper, against: readonly PieceRect[] = blocked) => {
    const b = folkRect(f)
    if (!rectInHex(b, FACE)) return false
    if (!inHex(f.x0, f.y0, FACE) || !inHex(f.x1, f.y1, FACE)) return false
    if (against.some((p) => rectsOverlap(b, p, PAD))) return false
    return !boxes.some((o) => rectsOverlap(b, o, 0))
  }
  for (let n = 0; n < want; n++) {
    let placed: Shopper | null = null
    for (let attempt = 0; attempt < 240 && !placed; attempt++) {
      // Shrinking as they miss: first a long stroll at full size, then shorter, then standing and smaller.
      const t = attempt / 240
      const s = Math.round(Math.max(0.6, (1.15 - t * 0.6) * k) * 100) / 100
      const reach = attempt < 200 ? (46 - t * 40) * (0.6 + rand() * 0.4) : 0
      // A freed tile's shoppers stop at its stalls: half the walks end in front of one.
      const stall = stalls.length && rand() < 0.5 ? stalls[Math.floor(rand() * stalls.length)]! : null
      const x1 = stall ? stall.x + (rand() - 0.5) * 14 * stall.s : (rand() * 2 - 1) * FACE * 0.8
      const y1 = stall ? stall.y + 12 * stall.s + 2 + FOLK_H * s : (rand() * 2 - 1) * FACE * 0.8
      const dir = rand() < 0.5 ? -1 : 1
      const f: Shopper = { x0: Math.round(x1 + dir * reach), y0: Math.round(y1 + (rand() - 0.5) * 8), x1: Math.round(x1), y1: Math.round(y1), s, tone: Math.floor(rand() * FOLK_TONES) }
      if (fits(f)) placed = f
    }
    // Last, a grid scan for a small standing shopper: a crowded tile still has someone on it, if need be minding one
    // of the ground's own stalls (scenery, not a piece), never over the tray.
    for (const against of [blocked, taken])
    for (let gy = -FACE * 0.8; gy <= FACE * 0.9 && !placed; gy += 4)
      for (let gx = -FACE * 0.8; gx <= FACE * 0.8 && !placed; gx += 4) {
        const f: Shopper = { x0: Math.round(gx), y0: Math.round(gy), x1: Math.round(gx), y1: Math.round(gy), s: 0.55, tone: Math.floor(rand() * FOLK_TONES) }
        if (fits(f, against)) placed = f
      }
    if (!placed) continue
    out.push(placed)
    boxes.push(folkRect(placed))
  }
  return out
}
