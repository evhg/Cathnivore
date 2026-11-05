// Plan item 63: a board tile's piece tray. Fixed slots in tile units round the hex centre (HEX_R 92, pointy top):
// the region's name plate up top, Hollowell's stacks (Outlets, Buyouts, Doubt: one stack each, a single count)
// in a row across the middle with the scheme token at its end, the producers' miniatures along the bottom. Sized
// to the hex as it renders on screen: ornaments (the .99 tag, the SOLD sign) go first, then the pieces shrink, and
// a count never renders under 11 px. Pure, so a unit test proves no two slots overlap; Map.tsx draws from it.

import { pickSpot } from './landmarkSpot'

export const TILE_R = 92
/** The tile face less a margin, as landmarkSpot.ts measures it. */
const FACE = TILE_R * 0.96 - 3
/** A count's smallest size on screen, in CSS px. */
export const MIN_COUNT_PX = 11
/** Plan item 172: two or three of a kind stand as an offset pile; a number badge only from this many. */
export const COUNT_FROM = 4
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
  /** Plan item 172: each producer's stall count (in slot order); a count badge is kept room for only above 3. */
  stallCounts?: number[]
}

export interface PieceTray {
  rects: PieceRect[]
  /** The pieces' scale (1 at full size). */
  scale: number
  /** Whether the stacks wear their ornaments (the .99 tag, the SOLD sign). */
  ornaments: boolean
  /** A count badge's radius in tile units (its text is 1.25 x this). */
  countR: number
  /** The SQUEEZE/EXPAND badge's scale, so its 10-unit text is MIN_BADGE_PX or more on screen (item 121). */
  badgeK: number
  /** Plan item 172: the centre of Hollowell's row and the producers' baseline (ENEMY_Y and PRODUCER_Y unless a
   *  badge or the larger pieces push the rows down the tile). */
  enemyY: number
  producerY: number
}

/** A stack's body at scale 1, and the gap between slots. */
const STACK_W = 28
const STACK_H = 35
const ORNAMENT_H = 8
const PRODUCER_W = 26
const PRODUCER_H = 40
const GAP = 3
const LABEL_Y = -TILE_R * 0.62
const LABEL_H = 21
/** The threat badge's box under the name plate (Map.tsx draws it 60 x 14). */
/** Plan item 139: 4 units under the plate (was 2: its stroke met the pill on a phone, reading as one piece). */
export const BADGE = { x0: -31, y0: LABEL_Y + 10, x1: 31, y1: LABEL_Y + 24 }
/** Plan item 121: the badge's text on screen at the least (it was about 7 px on a phone). */
export const MIN_BADGE_PX = 11
/** A producer stall's least height on screen while the badge grows (plan item 2's 24 px on a phone). */
const MIN_STALL_PX = 25
/** The badge's box at scale k, grown from its top centre (Map.tsx scales the drawn badge the same way). */
export function badgeBox(k: number): { x0: number; y0: number; x1: number; y1: number } {
  return { x0: BADGE.x0 * k, y0: BADGE.y0, x1: BADGE.x1 * k, y1: BADGE.y0 + (BADGE.y1 - BADGE.y0) * k }
}
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

/** A row of slots of the given widths centred on x 0 (their left edges). */
function row(ws: number[]): number[] {
  const total = ws.reduce((a, w) => a + w, 0) + Math.max(0, ws.length - 1) * GAP
  const out: number[] = []
  let x = -total / 2
  for (const w of ws) { out.push(x); x += w + GAP }
  return out
}

function place(input: PieceInput, scale: number, ornaments: boolean, countR: number, badgeK = 1): { rects: PieceRect[]; enemyY: number; producerY: number } {
  const out: PieceRect[] = []
  const lw = input.labelWidth / 2
  out.push({ kind: 'label', x0: -lw, y0: LABEL_Y - 15, x1: lw, y1: LABEL_Y - 15 + LABEL_H })
  // A gap under the badge so a count circle's outline doesn't touch it.
  if (input.badge) { const bb = badgeBox(badgeK); out.push({ kind: 'badge', ...bb, y1: bb.y1 + GAP }) }
  const stacks = (['outlets', 'buyouts', 'doubt'] as const).filter((k) => input[k] > 0)
  const slots: PieceKind[] = [...stacks, ...(input.scheme ? (['scheme'] as const) : [])]
  // A stack's slot holds its body, its ornament above and, from COUNT_FROM up, its count badge (half over the
  // body's empty top right corner, half outside). Plan item 172: two or three stand as a pile with no badge.
  const counted = (k: PieceKind) => (k === 'outlets' || k === 'buyouts' || k === 'doubt') && input[k] >= COUNT_FROM
  const ws = slots.map((k) => STACK_W * scale + (counted(k) ? countR * 0.5 : 0))
  // Plan item 172: the row steps down the tile, rather than shrinking, when the plate or a badge sits over it.
  const ceil = out.reduce((a, r) => Math.max(a, r.y1), -Infinity) + GAP
  const highest = (STACK_H * scale) / 2 + (ornaments ? ORNAMENT_H * scale : 0) + (slots.some(counted) ? countR * 0.5 : 0)
  const enemyY = slots.length ? Math.max(ENEMY_Y, ceil + highest) : ENEMY_Y
  const bottom = enemyY + (STACK_H * scale) / 2
  row(ws).forEach((x, k) => {
    const top = enemyY - (STACK_H * scale) / 2 - (ornaments ? ORNAMENT_H * scale : 0) - (counted(slots[k]!) ? countR * 0.5 : 0)
    out.push({ kind: slots[k]!, x0: x, y0: top, x1: x + ws[k]!, y1: bottom })
  })
  const producerY = Math.max(PRODUCER_Y, (slots.length ? bottom : ceil) + GAP + PRODUCER_H * scale * 0.6)
  const pws = Array.from({ length: input.producers }, (_, k) => PRODUCER_W * scale + ((input.stallCounts?.[k] ?? COUNT_FROM) >= COUNT_FROM ? countR * 0.35 : 0))
  row(pws).forEach((x, k) =>
    // The art's base shadow reaches 2.2 units past the slot's foot (ProducerMini), so the slot reaches it too.
    out.push({ kind: 'producer', i: k, x0: x, y0: producerY - PRODUCER_H * scale * 0.6, x1: x + pws[k]!, y1: producerY + PRODUCER_H * scale * 0.4 + 2.4 * scale }),
  )
  return { rects: out, enemyY, producerY }
}

function fits(rects: PieceRect[]): boolean {
  const pieces = rects.filter((r) => r.kind !== 'label' && r.kind !== 'badge')
  if (!pieces.every(rectInside)) return false
  for (let a = 0; a < rects.length; a++) for (let b = a + 1; b < rects.length; b++) if (rectsOverlap(rects[a]!, rects[b]!)) return false
  // Plan item 172: the pieces grow only while the tile's landmark still has a spot (Map.tsx's pickSpot).
  return pickSpot(rects) !== null
}

/**
 * The tray for a tile drawn `hexPx` CSS px from centre to vertex. Tries full size with ornaments (only on a hex
 * big enough to read them), then without, then smaller pieces; the count badge is sized so its text is at least
 * MIN_COUNT_PX on screen whatever the scale.
 */
export function pieceLayout(input: PieceInput, hexPx: number): PieceTray {
  const unitsPerPx = TILE_R / Math.max(1, hexPx)
  const countR = Math.max(4.6, (MIN_COUNT_PX * unitsPerPx) / 1.25)
  const badgeK = Math.max(1, (MIN_BADGE_PX * unitsPerPx) / 10)
  const tryOrnaments = hexPx >= ORNAMENT_PX ? [true, false] : [false]
  // Plan item 172: pieces worth holding. Every hex starts its pieces large (up to 1.7x on a roomy desktop hex)
  // and shrinks them only as far as the tile's pieces need to fit.
  const start = Math.round(Math.min(1.7, Math.max(1.35, hexPx / 52)) * 20) / 20
  // First the badge at a legible size, letting the pieces shrink only while a stall stays MIN_STALL_PX tall on
  // screen (board-scales.spec); then the old order with the badge at its drawn size.
  const stallFloor = Math.max(0.6, (MIN_STALL_PX * unitsPerPx) / PRODUCER_H)
  // The largest badge that fits, each tried with the largest pieces that still fit beside it.
  if (input.badge)
    for (let k = badgeK; k > 1 + 1e-9; k = Math.round((k - 0.05) * 100) / 100)
      for (let scale = start; scale >= stallFloor - 1e-9; scale = Math.round((scale - 0.05) * 100) / 100)
        for (const ornaments of tryOrnaments) {
          const p = place(input, scale, ornaments, countR, k)
          if (fits(p.rects)) return { ...p, scale, ornaments, countR, badgeK: k }
        }
  for (let scale = start; scale >= 0.35 - 1e-9; scale = Math.round((scale - 0.05) * 100) / 100)
    for (const ornaments of tryOrnaments) {
      const p = place(input, scale, ornaments, countR)
      if (fits(p.rects)) return { ...p, scale, ornaments, countR, badgeK: 1 }
    }
  const scale = 0.35
  return { ...place(input, scale, false, countR), scale, ornaments: false, countR, badgeK: 1 }
}
