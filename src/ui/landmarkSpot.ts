// Plan item 55: where a region's landmark stands on its board tile. The tile's middle column holds the pieces
// (Hollowell's stacked cluster near the centre, the producers' stalls along the bottom), so the landmark takes the
// first of four flank spots clear of both, in tile units round the hex centre (HEX_R 92, pointy top).

import type { RegionId } from '../engine/types'
import type { LandmarkKind } from '../content/campaignMapLayout'

/** Every region's landmark on the board, the Long Coast and the Delta's own regions included. */
export const BOARD_LANDMARKS: Record<RegionId, LandmarkKind> = {
  kingsmarket: 'cross',
  rivermead: 'mill',
  shingleBay: 'docks',
  saltmarsh: 'lighthouse',
  oakvale: 'oak',
  brindleHills: 'barn',
  highmoor: 'fold',
  gullsHead: 'gull',
  fernlea: 'fern',
  tarnside: 'tarn',
}

export interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

const R = 92
/** The tile face's circumradius (Map.tsx GAP_SCALE 0.96), less a margin so the art's strokes stay inside. */
const FACE = R * 0.96 - 3
/** Half the landmark art's extent (24-unit box, its strokes and the mill's sails to 13) at scale 1. */
const ART_HALF = 13
/** Sizes tried, largest first: a crowded tile takes a smaller landmark rather than none. */
// Plan item 341: up to 2.4x, so a landmark stands about a quarter of the hex tall, as the campaign map draws it.
export const LANDMARK_SCALES = [2.4, 2.2, 2, 1.8, 1.6, 1.4, 1.25, 1.0, 0.8] as const
/** The art's drawn height at scale 1 (its 24-unit box, the strokes and the ground shadow), in tile units. */
export const LANDMARK_ART_H = 26
const PAD = 2
/** Flank spots round the middle column, best first: low on each side, then the upper flanks, then the sides. */
export const SPOTS: ReadonlyArray<{ x: number; y: number }> = [
  { x: -52, y: 30 },
  { x: 52, y: 30 },
  { x: 60, y: -28 },
  { x: -60, y: -28 },
  { x: -64, y: 2 },
  { x: 64, y: 2 },
  { x: -44, y: 46 },
  { x: 44, y: 46 },
  // Nearer the middle: room for the largest size on a tile with few pieces.
  { x: -46, y: 22 },
  { x: 46, y: 22 },
  { x: 52, y: -26 },
  { x: -52, y: -26 },
]

/**
 * The enemy-piece cluster (Map.tsx: PIECE_SCALE 1.9, a piece every 16 units). Each piece spans its token from
 * x -0.6 to its count badge at 18.4, and from the badge's top (-5.4) to the token's shadow (16).
 */
export function clusterBox(kinds: number): Box | null {
  if (kinds <= 0) return null
  const k = 1.9
  const x0 = -kinds * 8 * k
  const y = -R * 0.14
  return { x0: x0 - 0.6 * k, y0: y - 5.4 * k, x1: x0 + ((kinds - 1) * 16 + 18.4) * k, y1: y + 16 * k }
}

/** The stall row along the bottom (Map.tsx: STALL_SLOT 27 a producer, the pins rising over the stalls). */
export function stallBox(stalls: number): Box | null {
  if (stalls <= 0) return null
  const w = stalls * 27
  return { x0: -w / 2 - 2, y0: R * 0.4 - 26, x1: w / 2 + 2, y1: R * 0.4 + 26 }
}

export function boxAt(p: { x: number; y: number }, scale = 1): Box {
  const h = ART_HALF * scale
  return { x0: p.x - h, y0: p.y - h, x1: p.x + h, y1: p.y + h }
}

export function overlaps(a: Box, b: Box, pad = PAD): boolean {
  return a.x0 < b.x1 + pad && b.x0 < a.x1 + pad && a.y0 < b.y1 + pad && b.y0 < a.y1 + pad
}

/** Inside the tile's pointy-top hexagon (centre 0,0). */
export function insideHex(x: number, y: number): boolean {
  const ax = Math.abs(x)
  return ax <= (FACE * Math.sqrt(3)) / 2 && Math.abs(y) <= FACE - ax / Math.sqrt(3)
}

function boxInside(b: Box): boolean {
  return insideHex(b.x0, b.y0) && insideHex(b.x1, b.y0) && insideHex(b.x0, b.y1) && insideHex(b.x1, b.y1)
}

/** The first flank spot (and the largest size) clear of this tile's pieces and inside the hex, or null. */
export function landmarkSpot(kinds: number, stalls: number): { x: number; y: number; scale: number } | null {
  return pickSpot([clusterBox(kinds), stallBox(stalls)].filter((b): b is Box => !!b))
}

/** Plan item 341: past the named flanks, every point of a grid over the face, outermost first, so a large
 *  landmark finds the free sector the pieces leave wherever it is. */
const GRID: ReadonlyArray<{ x: number; y: number }> = (() => {
  const out: { x: number; y: number }[] = []
  for (let y = -64; y <= 64; y += 8) for (let x = -72; x <= 72; x += 8) if (insideHex(x, y)) out.push({ x, y })
  return out.sort((a, b) => Math.hypot(b.x, b.y) - Math.hypot(a.x, a.y) || a.x - b.x || a.y - b.y)
})()
const CANDIDATES = [...SPOTS, ...GRID]

/** The same choice against measured boxes (tile units round the hex centre): Map.tsx refines with the real pieces.
 *  `minScale` (plan item 341) refuses a landmark drawn smaller than that. */
export function pickSpot(taken: readonly Box[], minScale = 0): { x: number; y: number; scale: number } | null {
  for (const scale of LANDMARK_SCALES) {
    if (scale < minScale - 1e-9) break
    for (const s of CANDIDATES) {
      const b = boxAt(s, scale)
      if (boxInside(b) && !taken.some((t) => overlaps(b, t))) return { ...s, scale }
    }
  }
  return null
}

/** Plan item 341: the smallest landmark scale that reads at a glance on a hex drawn `hexPx` CSS px centre to
 *  vertex: about a quarter of the hex's height, 26 px at least. */
export function landmarkMinScale(hexPx: number): number {
  const pxPerUnit = Math.max(1, hexPx) / R
  const target = Math.max(26, Math.min(58, hexPx * 0.5))
  return target / (LANDMARK_ART_H * pxPerUnit)
}

/** The market event's dressing (Map.tsx, plan item 144) round its anchor at scale 1: the Great Glut's heap and the
 *  Harvest Festival's lantern string. */
export const DRESSING_BOX: Record<'glut' | 'festival', Box> = {
  glut: { x0: -22, y0: -5.5, x1: 22, y1: 6 },
  festival: { x0: -34.6, y0: -6, x1: 34.6, y1: 9 },
}

function scaled(b: Box, p: { x: number; y: number }, k: number): Box {
  return { x0: p.x + b.x0 * k, y0: p.y + b.y0 * k, x1: p.x + b.x1 * k, y1: p.y + b.y1 * k }
}

/**
 * Where the event's dressing goes on a tile: its home at the hex's foot when the pieces leave that clear, else the
 * nearest spot (and the largest size) inside the face and clear of every piece; a crowded tile gets a small
 * dressing tucked into a flank. Null only when nothing fits at all.
 */
export function dressingSpot(
  kind: 'glut' | 'festival',
  taken: readonly Box[],
  home: { x: number; y: number },
): { x: number; y: number; scale: number } | null {
  const box = DRESSING_BOX[kind]
  const clear = (b: Box) => !taken.some((t) => overlaps(b, t, 1))
  if (clear(scaled(box, home, 1))) return { ...home, scale: 1 }
  const tries: { x: number; y: number }[] = []
  for (const dy of [0, -4, 4, -8, -12, -16]) for (const dx of [0, -12, 12, -24, 24]) tries.push({ x: home.x + dx, y: home.y + dy })
  for (const s of SPOTS) tries.push(s)
  for (const k of [1, 0.85, 0.7, 0.55, 0.45])
    for (const p of tries) {
      const b = scaled(box, p, k)
      if (boxInside(b) && clear(b)) return { ...p, scale: k }
    }
  return null
}
