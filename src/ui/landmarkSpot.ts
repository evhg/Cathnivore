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
export const LANDMARK_SCALES = [1.25, 1.0, 0.8] as const
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

/** The same choice against measured boxes (tile units round the hex centre): Map.tsx refines with the real pieces. */
export function pickSpot(taken: readonly Box[]): { x: number; y: number; scale: number } | null {
  for (const scale of LANDMARK_SCALES)
    for (const s of SPOTS) {
      const b = boxAt(s, scale)
      if (boxInside(b) && !taken.some((t) => overlaps(b, t))) return { ...s, scale }
    }
  return null
}
