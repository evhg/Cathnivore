// Plan item 63: a board tile's piece tray. Fixed slots in tile units round the hex centre (HEX_R 92, pointy top):
// the region's name plate up top, Hollowell's stacks (Outlets, Buyouts, Doubt: one stack each, a single count)
// in a row across the middle with the scheme token at its end, the producers' miniatures along the bottom. Sized
// to the hex as it renders on screen: ornaments (the .99 tag, the SOLD sign) go first, then the pieces shrink, and
// a count never renders under 11 px. Pure, so a unit test proves no two slots overlap; Map.tsx draws from it.

export const TILE_R = 92
/** The tile face less a margin, as landmarkSpot.ts measures it. */
const FACE = TILE_R * 0.96 - 3
/** A count's smallest size on screen, in CSS px. */
export const MIN_COUNT_PX = 11
/** Below this rendered hex radius the stacks drop their ornaments (tags and signs) before anything shrinks. */
export const ORNAMENT_PX = 64

export type PieceKind = 'outlets' | 'buyouts' | 'doubt' | 'scheme' | 'producer' | 'label' | 'badge'

export interface PieceRect {
  kind: PieceKind
  /** Which producer (0 first), for producer slots. */
  i?: number
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface PieceInput {
  outlets: number
  buyouts: number
  doubt: number
  producers: number
  scheme: boolean
  /** The name plate's width in tile units (Map.tsx: 8.6 a letter plus 16). */
  labelWidth: number
  /** A SQUEEZE or EXPAND threat badge under the name plate. */
  badge?: boolean
}

export interface PieceTray {
  rects: PieceRect[]
  /** The pieces' scale (1 at full size). */
  scale: number
  /** Whether the stacks wear their ornaments (the .99 tag, the SOLD sign). */
  ornaments: boolean
  /** A count badge's radius in tile units (its text is 1.25 x this). */
  countR: number
}

/** A stack's body at scale 1, and the gap between slots. */
const STACK_W = 26
const STACK_H = 36
const ORNAMENT_H = 8
const PRODUCER_W = 26
const PRODUCER_H = 40
const GAP = 3
const LABEL_Y = -TILE_R * 0.62
const LABEL_H = 21
/** The threat badge's box under the name plate (Map.tsx draws it 60 x 14). */
export const BADGE = { x0: -31, y0: LABEL_Y + 8, x1: 31, y1: LABEL_Y + 22 }
export const ENEMY_Y = -TILE_R * 0.08
export const PRODUCER_Y = TILE_R * 0.44
export { STACK_W, STACK_H, PRODUCER_W, PRODUCER_H, ORNAMENT_H }

function insideHex(x: number, y: number): boolean {
  const ax = Math.abs(x)
  return ax <= (FACE * Math.sqrt(3)) / 2 + 1e-9 && Math.abs(y) <= FACE - ax / Math.sqrt(3) + 1e-9
}
function rectInside(r: PieceRect): boolean {
  return insideHex(r.x0, r.y0) && insideHex(r.x1, r.y0) && insideHex(r.x0, r.y1) && insideHex(r.x1, r.y1)
}
export function rectsOverlap(a: PieceRect, b: PieceRect, pad = 0): boolean {
  return a.x0 < b.x1 + pad && b.x0 < a.x1 + pad && a.y0 < b.y1 + pad && b.y0 < a.y1 + pad
}

/** A row of `n` slots of width `w` centred on x 0. */
function row(n: number, w: number): number[] {
  const total = n * w + (n - 1) * GAP
  return Array.from({ length: n }, (_, k) => -total / 2 + k * (w + GAP))
}

function place(input: PieceInput, scale: number, ornaments: boolean, countR: number): PieceRect[] {
  const out: PieceRect[] = []
  const lw = input.labelWidth / 2
  out.push({ kind: 'label', x0: -lw, y0: LABEL_Y - 15, x1: lw, y1: LABEL_Y - 15 + LABEL_H })
  if (input.badge) out.push({ kind: 'badge', ...BADGE })
  const stacks = (['outlets', 'buyouts', 'doubt'] as const).filter((k) => input[k] > 0)
  const slots: PieceKind[] = [...stacks, ...(input.scheme ? (['scheme'] as const) : [])]
  // A stack's slot holds its body and its count badge (half over the body's empty top right corner, half outside),
  // plus its ornament above.
  const w = STACK_W * scale + countR * 0.5
  const top = ENEMY_Y - (STACK_H * scale) / 2 - (ornaments ? ORNAMENT_H * scale : 0) - countR * 0.5
  const bottom = ENEMY_Y + (STACK_H * scale) / 2
  row(slots.length, w).forEach((x, k) => out.push({ kind: slots[k]!, x0: x, y0: top, x1: x + w, y1: bottom }))
  const pw = PRODUCER_W * scale + countR * 0.35
  row(input.producers, pw).forEach((x, k) =>
    out.push({ kind: 'producer', i: k, x0: x, y0: PRODUCER_Y - PRODUCER_H * scale * 0.6, x1: x + pw, y1: PRODUCER_Y + PRODUCER_H * scale * 0.4 }),
  )
  return out
}

function fits(rects: PieceRect[]): boolean {
  const pieces = rects.filter((r) => r.kind !== 'label' && r.kind !== 'badge')
  if (!pieces.every(rectInside)) return false
  for (let a = 0; a < rects.length; a++) for (let b = a + 1; b < rects.length; b++) if (rectsOverlap(rects[a]!, rects[b]!)) return false
  return true
}

/**
 * The tray for a tile drawn `hexPx` CSS px from centre to vertex. Tries full size with ornaments (only on a hex
 * big enough to read them), then without, then smaller pieces; the count badge is sized so its text is at least
 * MIN_COUNT_PX on screen whatever the scale.
 */
export function pieceLayout(input: PieceInput, hexPx: number): PieceTray {
  const unitsPerPx = TILE_R / Math.max(1, hexPx)
  const countR = Math.max(4.6, (MIN_COUNT_PX * unitsPerPx) / 1.25)
  const tryOrnaments = hexPx >= ORNAMENT_PX ? [true, false] : [false]
  // A roomy hex (a desktop board) grows its pieces up to 1.3x, so they keep their share of the tile.
  const start = Math.round(Math.min(1.3, Math.max(1, hexPx / 90)) * 20) / 20
  for (let scale = start; scale >= 0.35 - 1e-9; scale = Math.round((scale - 0.05) * 100) / 100)
    for (const ornaments of tryOrnaments) {
      const rects = place(input, scale, ornaments, countR)
      if (fits(rects)) return { rects, scale, ornaments, countR }
    }
  const scale = 0.35
  return { rects: place(input, scale, false, countR), scale, ornaments: false, countR }
}
