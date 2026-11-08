import AbilityMoment from './AbilityMoment'
import { ABILITY_MOMENT_MS, abilityUsed, type AbilityMomentView } from './abilityUsed'
import { Landmark } from './Landmark'
import { playCues } from '../platform/sound'
import { atTheEdge, gripStage, squeezedLastTurn, type GripStage } from './grip'
import { BADGE, COUNT_FROM, ENEMY_Y, PRODUCER_H, PRODUCER_W, PRODUCER_Y, STACK_H, STACK_W, ORNAMENT_H, pieceLayout } from './pieceLayout'
import { BOARD_LANDMARKS, boxAt, dressingSpot, pickSpot } from './landmarkSpot'
import { regionGround } from './regionGround'
import RegionGroundArt from './RegionGroundArt'
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactElement } from 'react'
import { REGIONS, regionMatchesPressureSlot, regionType } from '../content/map'
import { LAYOUTS, placedLayout, type Layout } from '../content/layouts'
import { loadSettings } from '../platform/settings'
import { resolveRules } from '../engine/rules'
import Portrait from './portraits/Portrait'
import type { ProducerFace } from './portraits/producerFaces'
import type { Flight } from './boardroom'
import type { Faction, GameState, ProducerId, RegionId, RegionType } from '../engine/types'

// SPEC 10.1's Settings screen has a "colour-blind patterns" toggle; Stalls are otherwise the one piece
// type distinguished only by fill hue (oxblood/mustard/slate/plum), with no shape difference between
// producers the way Outlet/Buyout/Doubt already have — so this is what the toggle turns on: each
// producer's initial, stamped on their Stalls.
const PRODUCER_INITIAL: Record<ProducerId, string> = { mara: 'M', tomas: 'T', ines: 'I', sol: 'S' }

// SPEC 10.2/STYLE.md 7: a square SVG hex flower, Kingsmarket in the centre. Pointy-top hexagons; plan item 15
// places them from the game's layout (axial q to the right, r down-right; content/layouts.ts), so the ring is
// the flower and the Long Coast and the Delta draw their own shapes, scaled to fit the same square.
const SIZE = 250 // viewBox half-width; hexes drawn within [-SIZE, SIZE]
export const HEX_R = 92 // circumradius (centre to vertex)
/** Plan item 127: how long a liberation or a Squeeze is staged on its tile. */
const MOMENT_MS = 1100
const RING_DISTANCE = HEX_R * Math.sqrt(3)
/** The painted face's radius on the board (the campaign map scales the board's ground art from it). */
export const BOARD_FACE_R = 92 * 0.96
export const GAP_SCALE = 0.96 // shrink each hex slightly for the 3px paper gap between them (STYLE.md 7)
/* Piles wrap after this many pieces so a heavy board never runs past the hex edge. */
/** Plan item 20: a tile's thickness (its edge shows below the face) and how far its shadow falls. */
const TILE_DEPTH = 7

function hexCenter(id: RegionId, layout: Layout = LAYOUTS.ring): { x: number; y: number } {
  const [q, r] = layout.hexes[id] ?? LAYOUTS.ring.hexes[id] ?? [0, 0]
  return { x: RING_DISTANCE * (q + r / 2), y: HEX_R * 1.5 * r }
}

/** Scales and centres a layout's hexes into the map's square (the ring needs neither). */
interface Fit {
  k: number
  tx: number
  ty: number
}
function layoutFit(layout: Layout, ids: readonly RegionId[]): Fit {
  // The whole ring is the printed board. A campaign chapter that opens only part of it (chapter 1's two
  // hexes) is centred and, when it is that small, drawn a little larger (plan item 33).
  const ringAll = layout.id === 'ring' && ids.length >= Object.keys(layout.hexes).length
  if (ringAll || ids.length === 0) return { k: 1, tx: 0, ty: 0 }
  const cap = layout.id === 'ring' && ids.length <= 3 ? 1.3 : 1
  const pts = ids.map((id) => hexCenter(id, layout))
  const halfW = (HEX_R * Math.sqrt(3)) / 2
  const x0 = Math.min(...pts.map((p) => p.x)) - halfW
  const x1 = Math.max(...pts.map((p) => p.x)) + halfW
  const y0 = Math.min(...pts.map((p) => p.y)) - HEX_R
  const y1 = Math.max(...pts.map((p) => p.y)) + HEX_R
  const k = Math.min(cap, (SIZE * 2) / (x1 - x0), (SIZE * 2 - 24) / (y1 - y0))
  return { k, tx: (-(x0 + x1) / 2) * k, ty: (-(y0 + y1) / 2) * k }
}
const fitPoint = (p: { x: number; y: number }, f: Fit) => ({ x: p.x * f.k + f.tx, y: p.y * f.k + f.ty })

// eslint-disable-next-line react-refresh/only-export-components -- shared with BoardMiniature (plan item 101)
export function hexPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = []
  for (let i = 0; i < 6; i++) {
    const angle = ((-90 + i * 60) * Math.PI) / 180
    pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`)
  }
  return pts.join(' ')
}

// eslint-disable-next-line react-refresh/only-export-components -- shared with BoardMiniature (plan item 101)
export const REGION_FILL: Record<RegionType, string> = {
  pasture: 'var(--region-pasture)',
  crop: 'var(--region-crop)',
  coast: 'var(--region-coast)',
  capital: 'var(--region-capital)',
}

/** Plan item 11: the enemy turn on the map. Both HQs stand in the corners away from the boardroom strip, and
 * each step's pieces fly out of them to the hex they land on. */
export interface EnemyTurnView {
  step: number
  flights: Flight[]
  hqSide: 'top' | 'bottom'
  active?: Faction
}

interface Props {
  state: GameState
  enemyTurn?: EnemyTurnView
  highlight?: RegionId[]
  /** Plan item 25: the plan card being looked at marks the hexes it will hit (`data-threat="squeeze"`). */
  threat?: { slot: 'squeeze' | 'expand' | 'scout'; regions: RegionId[] }
  onSelect?: (region: RegionId) => void
  /** Plan item 109: with nothing to pick, a tap on a region opens it up close (phones). */
  onInspect?: (region: RegionId) => void
  /** Plan item 109: the region open up close (outlined on the board while its sheet is up). */
  inspected?: RegionId | null
  /** Plan item 80: the producers' faces this moment (a Squeeze worries them, their ability delights them). */
  faces?: Partial<Record<ProducerId, ProducerFace>>
  /** Plan item 98: drawn over the hexes but under the region name plates (the title's vans on their roads). */
  underNames?: ReactElement
  /** Plan item 141: the action being looked at, as a ghost piece on each region it could play into. */
  ghost?: { regions: RegionId[]; sign: '+' | '-' }
}

// STYLE.md 2.3 "shape before colour" / 3.2's "texture pattern at 8% ink" per region type — a second,
// low-opacity fill on top of the flat colour so each region type is still identifiable without colour
// (greyscale, colour blindness). Patterns are defined once in <defs> and referenced by every hex of that
// type, so the SVG isn't repeating the same geometry per region.
const REGION_PATTERN_ID: Record<RegionType, string> = {
  pasture: 'texture-pasture',
  crop: 'texture-crop',
  coast: 'texture-coast',
  capital: 'texture-capital',
}

function RegionTextureDefs() {
  return (
    <defs>
      {/* Plan item 144: the Dry Spell's cracked earth, laid over every region's ground. */}
      <pattern id="ev-cracks" width={46} height={46} patternUnits="userSpaceOnUse">
        <rect width={46} height={46} fill="#e9c36a" opacity={0.26} />
        <path d="M2 10l9 4 4 10 10 3 6 9M15 24l-6 9M25 27l8-6 9 2M31 36l-2 9" fill="none" stroke="var(--ink)" strokeWidth={1.4} opacity={0.5} strokeLinecap="round" />
      </pattern>
      {/* Pasture: short diagonal strokes. STYLE.md 3.2 specifies "8% ink," but a 2026-09-28 gate-8 review
          (2 subagents, phone + desktop) found the region textures were reading as flat, uniform grey in
          the mandated greyscale screenshot at map scale — the plain 8% opacity anti-aliases away on thin
          strokes/small dots at the size a region hex actually renders. STYLE.md 2.1 ("Legibility first")
          and 2.3 ("shape before colour... a subagent checks it") outrank 3.2's literal number when they
          conflict, so ink coverage is raised here (and below) until the greyscale test actually passes,
          not just nominally matches the 8% figure. */}
      <pattern id="texture-pasture" width={10} height={10} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1={0} y1={0} x2={0} y2={10} stroke="var(--ink)" strokeWidth={1.8} opacity={0.16} />
      </pattern>
      {/* Crop: dotted furrow rows. Tile halved and dots enlarged from an earlier pass (2026-09-26); ink
          raised again 2026-09-28 (see the pasture comment above) after the 2026-09-26 pass was found still
          only "faint but visible," not clearly legible. */}
      <pattern id="texture-crop" width={8} height={6} patternUnits="userSpaceOnUse">
        <circle cx={2} cy={3} r={1.6} fill="var(--ink)" opacity={0.2} />
        <circle cx={6} cy={3} r={1.6} fill="var(--ink)" opacity={0.2} />
      </pattern>
      {/* Coast: wave lines. Tile halved and stroke thickened in an earlier pass (2026-09-26); found
          completely invisible in greyscale by 2 independent 2026-09-28 gate-8 subagents (the worst of the
          4 region types — a thin curved stroke has less ink per unit area than pasture's straight line or
          capital's rect outline at the same opacity), so this one gets the largest bump: a smaller, denser
          tile plus a much thicker stroke and higher opacity. */}
      <pattern id="texture-coast" width={7} height={5} patternUnits="userSpaceOnUse">
        <path d="M0,2.5 Q1.75,0 3.5,2.5 T7,2.5" fill="none" stroke="var(--ink)" strokeWidth={2.2} opacity={0.26} />
      </pattern>
      {/* Capital: cobblestone grid. Already the most legible of the 4 in the 2026-09-28 review; bumped
          slightly anyway for consistency with the other 3. */}
      <pattern id="texture-capital" width={12} height={12} patternUnits="userSpaceOnUse">
        <rect x={0} y={0} width={11} height={11} fill="none" stroke="var(--ink)" strokeWidth={1.2} opacity={0.14} />
      </pattern>
      {/* STYLE.md 6: Lost Land is a "cracked hatched tile" — a cross-hatch pattern under the crack lines
          drawn per-region below, replacing the earlier flat opacity tint. */}
      {/* Plan item 20 (the board as a diorama): each tile is a painted board piece. The light falls from the
          top left across the face (a wash over the flat region colour), the tile has a thickness (its edge
          drawn below the face) and it casts a soft shadow onto the table. */}
      {/* Plan item 282: the corporations' pieces are moulded plastic, lit hard from above: a bright top easing into
          a deep base, against the players' flat ink and paper. */}
      <linearGradient id="hollowell-gloss" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--hollowell) 55%, white)' }} />
        <stop offset="0.45" style={{ stopColor: 'var(--hollowell)' }} />
        <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--hollowell) 70%, var(--hollowell-ink))' }} />
      </linearGradient>
      <linearGradient id="candor-gloss" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--candor) 55%, white)' }} />
        <stop offset="0.5" style={{ stopColor: 'var(--candor)' }} />
        <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--candor) 70%, var(--candor-ink))' }} />
      </linearGradient>
      <linearGradient id="tile-light" x1="0.15" y1="0" x2="0.75" y2="1">
        <stop offset="0" stopColor="white" stopOpacity={0.34} />
        <stop offset="0.42" stopColor="white" stopOpacity={0} />
        <stop offset="0.62" stopColor="black" stopOpacity={0} />
        <stop offset="1" stopColor="black" stopOpacity={0.16} />
      </linearGradient>
      <radialGradient id="tile-paint" cx="0.4" cy="0.38" r="0.7">
        <stop offset="0" stopColor="white" stopOpacity={0.14} />
        <stop offset="0.7" stopColor="white" stopOpacity={0} />
        <stop offset="1" stopColor="black" stopOpacity={0.1} />
      </radialGradient>
      <filter id="tile-shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation={7} />
      </filter>
      <pattern id="texture-lostland" width={8} height={8} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1={0} y1={0} x2={0} y2={8} stroke="var(--ink)" strokeWidth={1.4} opacity={0.35} />
        <line x1={4} y1={0} x2={4} y2={8} stroke="var(--ink)" strokeWidth={1.4} opacity={0.35} />
      </pattern>
    </defs>
  )
}

// STYLE.md 6's exact game pieces, drawn as small self-contained SVG groups so `Map` can place one per
// slot in the enemy-piece row / Stall row without repeating their geometry inline.

// Outlet: "little shopfront box with a price tag reading 0.99" (plan item 139: the tag is wordless, its print
// as lines: no size of the piece let '.99' reach 11 px) — a glossy Hollowell square (unchanged
// from before) plus a small hanging price tag, the wit detail STYLE.md 2.5 asks for by name.
export function Outlet({ ornament = true }: { ornament?: boolean }) {
  return (
    <g className="enemy-piece enemy-outlet">
      {/* sawtooth-roofed warehouse: reads apart from Buyout's peak and Doubt's bubble in outline alone */}
      {/* plan item 172: a chunky token, its moulded side showing under the face */}
      {/* plan item 282: a hard, clinical drop shadow (no blur), then the moulded side, the gloss face and its streak */}
      <polygon className="corp-shadow" points="0,12 0,3 3,0 3,3 6,0 6,3 9,0 9,3 12,3 12,12" transform="translate(1.4 1.7)" fill="var(--ink)" opacity={0.3} />
      <polygon points="0,12 0,3 3,0 3,3 6,0 6,3 9,0 9,3 12,3 12,12" transform="translate(0.9 1.1)" fill="var(--hollowell-ink)" stroke="var(--ink)" strokeWidth={1} strokeLinejoin="round" />
      <polygon points="0,12 0,3 3,0 3,3 6,0 6,3 9,0 9,3 12,3 12,12" fill="url(#hollowell-gloss)" stroke="var(--ink)" strokeWidth={1} strokeLinejoin="round" />
      <path className="corp-specular" d="M 1.2,10.5 V 4 L 2.4,3" fill="none" stroke="white" strokeWidth={1} strokeLinecap="round" opacity={0.8} />
      <circle cx={9} cy={5.5} r={1.8} fill="var(--hollowell-highlight)" />
      {ornament && <g transform="translate(7,9) rotate(18)">
        <rect x={0} y={0} width={7} height={5} rx={1} fill="var(--paper)" stroke="var(--ink)" strokeWidth={0.6} />
        <circle cx={1.3} cy={1.3} r={0.5} fill="var(--ink)" />
        {/* plan item 139: printed lines, not '.99' (the text drew at 7 px on a desktop board, under the 11 px floor) */}
        <path d="M 2.6,2.2 h 3.2 M 2.6,3.5 h 2.2" className="tag-print" stroke="var(--ink)" strokeWidth={0.55} strokeLinecap="round" />
      </g>}
    </g>
  )
}

// Buyout: "picket-fence segment with a SOLD sign" — keeps the peaked sign-post silhouette (already
// distinct in outline from Outlet's square, STYLE.md 2.3) and adds the sign itself.
export function Buyout({ ornament = true }: { ornament?: boolean }) {
  return (
    <g className="enemy-piece enemy-buyout">
      <polygon className="corp-shadow" points="6,0 12,4 12,12 0,12 0,4" transform="translate(1.4 1.7)" fill="var(--ink)" opacity={0.3} />
      <polygon points="6,0 12,4 12,12 0,12 0,4" transform="translate(0.9 1.1)" fill="var(--hollowell-ink)" stroke="var(--ink)" strokeWidth={1} strokeLinejoin="round" />
      <polygon points="6,0 12,4 12,12 0,12 0,4" fill="url(#hollowell-gloss)" stroke="var(--ink)" strokeWidth={1} strokeLinejoin="round" />
      <path className="corp-specular" d="M 1.2,10.5 V 4.6 L 5.6,1.6" fill="none" stroke="white" strokeWidth={1} strokeLinecap="round" opacity={0.8} />
      <circle cx={9} cy={5} r={2} fill="var(--hollowell-highlight)" />
      {ornament && <g transform="translate(1,7) rotate(-6)">
        <rect x={0} y={0} width={10} height={4} rx={0.5} fill="var(--paper)" stroke="var(--ink)" strokeWidth={0.6} />
        {/* plan item 139: a lettered stroke, not 'SOLD' (about 6 px on screen); the sign's shape carries it */}
        <path d="M 2,2 h 6" className="tag-print" stroke="var(--hollowell)" strokeWidth={1.1} strokeLinecap="round" />
      </g>}
    </g>
  )
}

// Doubt: "speech bubble with a '?'" — the glossy Candor circle already had the "?", but no tail, so it
// read as a plain dot rather than a speech bubble (STYLE.md 6's literal shape).
export function Doubt() {
  return (
    <g className="enemy-piece enemy-doubt">
      <circle className="corp-shadow" cx={7.4} cy={7.7} r={6} fill="var(--ink)" opacity={0.28} />
      <circle cx={6.9} cy={7.1} r={6} fill="var(--candor-ink)" stroke="var(--ink)" strokeWidth={1} />
      <path d="M 3,10.8 L 6.5,10.8 L 3.5,14 Z" fill="var(--candor)" stroke="var(--ink)" strokeWidth={1} strokeLinejoin="round" />
      <circle cx={6} cy={6} r={6} fill="url(#candor-gloss)" stroke="var(--ink)" strokeWidth={1} />
      <path className="corp-specular" d="M 1.6,6.5 A 4.6,4.6 0 0 1 4.2,1.9" fill="none" stroke="white" strokeWidth={1} strokeLinecap="round" opacity={0.8} />
      <path d="M 3.4,10.4 L 6.2,10.4 L 3.8,12.6 Z" fill="var(--candor)" />
      <circle cx={8} cy={4} r={1.8} fill="var(--candor-highlight)" />
      <text x={6} y={9} textAnchor="middle" className="doubt-mark">
        ?
      </text>
    </g>
  )
}

// Plan item 20: every piece stands on a turned wooden base, a game token with a thickness, so the board
// reads as a diorama. The base sits under the piece's footprint (cx, w wide, at y) and casts a contact shadow.
function TokenBase({ cx, y, w }: { cx: number; y: number; w: number }) {
  const rx = w / 2 + 1.4
  return (
    <g className="token-base" pointerEvents="none">
      <ellipse cx={cx + 0.8} cy={y + 2.6} rx={rx + 0.6} ry={2.6} className="token-shadow" />
      <ellipse cx={cx} cy={y + 1.4} rx={rx} ry={2.5} className="token-side" stroke="var(--ink)" strokeWidth={0.6} />
      <ellipse cx={cx} cy={y} rx={rx} ry={2.5} className="token-top" stroke="var(--ink)" strokeWidth={0.6} />
    </g>
  )
}

// Plan item 63: a stack's count, a dark disc sized by the tray so its number never renders under 11 px.
function CountBadge({ cx, cy, r, n }: { cx: number; cy: number; r: number; n: number }) {
  const fs = r * 1.25
  return (
    <g className="piece-count" pointerEvents="none">
      <circle cx={cx} cy={cy} r={r} fill="var(--ink, #1b1712)" stroke="var(--paper, #f4ead8)" strokeWidth={Math.max(0.8, r * 0.16)} />
      <text x={cx} y={cy + fs * 0.36} textAnchor="middle" fontSize={fs} fontWeight={700} fill="var(--paper, #f4ead8)">
        {n}
      </text>
    </g>
  )
}

/**
 * Plan item 63: one of Hollowell's stacks in its tray slot (x from the slot's left, y in tile units round the
 * centre): the glossy plastic piece on its turned base with up to two copies behind, and one count. Small hexes
 * drop the .99 tag and the SOLD sign (`ornaments`) before the piece shrinks.
 */
/** Plan item 172: each piece kind's outline, so the board reads without colour. */
const SILHOUETTE = { outlets: 'sawtooth', buyouts: 'peak', doubt: 'bubble' } as const

function EnemyStack({ kind, n, scale, ornaments, countR, cy = ENEMY_Y }: { kind: 'outlets' | 'buyouts' | 'doubt'; n: number; scale: number; ornaments: boolean; countR: number; cy?: number }) {
  // The art spans 18 icon units across (the base's lip, copies offset right) and 22.6 down (copies up, the
  // base's shadow below).
  const k = Math.min((STACK_W * scale) / 18, (STACK_H * scale) / 22.6)
  const bottom = cy + (STACK_H * scale) / 2
  const bodyTop = cy - (STACK_H * scale) / 2
  const icon = kind === 'outlets' ? <Outlet ornament={ornaments} /> : kind === 'buyouts' ? <Buyout ornament={ornaments} /> : <Doubt />
  const copies = Math.min(n, 3)
  return (
    <g className={`enemy-stack enemy-stack-${kind}`}>
      <g transform={`translate(${1.4 * k}, ${bottom - 17.4 * k}) scale(${k})`}>
        <TokenBase cx={6} y={12.2} w={12} />
        {/* plan item 172: two or three of a kind stand as a pile, each copy whole and outlined */}
        {Array.from({ length: copies - 1 }).map((_, j) => (
          <g key={j} className="pile-copy" transform={`translate(${(copies - 1 - j) * 2.2}, ${-(copies - 1 - j) * 2.4})`}>
            {icon}
          </g>
        ))}
        {/* keyed by the count, so a piece landing on a stack drops in again */}
        <g key={n}>{icon}</g>
      </g>
      {n >= COUNT_FROM && <CountBadge cx={STACK_W * scale - countR * 0.5} cy={bodyTop - (ornaments ? ORNAMENT_H * scale : 0) + countR * 0.5} r={countR} n={n} />}
    </g>
  )
}

/**
 * Plan item 63: a producer's stalls as a standing painted miniature: their portrait bust on an arched standee
 * over a round base in their colour, casting a shadow, matte against Hollowell's glossy plastic. x from the
 * slot's left, y in tile units round the tile centre. The colour-blind setting stamps their initial on the base.
 */
function ProducerMini({ pid, n, scale: s, countR, clip, showInitial, face, py = PRODUCER_Y }: { pid: ProducerId; n: number; scale: number; countR: number; clip: string; showInitial: boolean; face?: ProducerFace; py?: number }) {
  const colour = `var(--p-${pid})`
  const w = PRODUCER_W * s
  const cx = w / 2
  const top = py - PRODUCER_H * s * 0.6 + s
  const foot = py + PRODUCER_H * s * 0.4 - 4.2 * s
  const hw = 10 * s
  const arch = `M ${cx - hw} ${foot} L ${cx - hw} ${top + hw} A ${hw} ${hw} 0 0 1 ${cx + hw} ${top + hw} L ${cx + hw} ${foot} Z`
  const bustH = hw * 2.5
  // Plan item 172: two or three stalls stand as a pile of standees, the front one stepped left to make room (the
  // copies rise only into the slot's spare top unit, so they never meet Hollowell's row above).
  const copies = Math.min(n, 3)
  const off = 2.6 * s
  const shift = ((copies - 1) * off) / 2
  return (
    <g className="producer-mini stall-pin" data-producer={pid} data-face={face ?? 'neutral'}>
      <ellipse cx={cx + 1.2 * s} cy={foot + 3 * s} rx={12.6 * s} ry={3.4 * s} className="token-shadow" />
      <ellipse cx={cx} cy={foot + 1.8 * s} rx={12 * s} ry={3.6 * s} fill={colour} stroke="var(--ink)" strokeWidth={0.8} />
      <ellipse cx={cx} cy={foot + 1.8 * s} rx={12 * s} ry={3.6 * s} fill="black" opacity={0.28} />
      <ellipse cx={cx} cy={foot} rx={12 * s} ry={3.6 * s} fill={colour} stroke="var(--ink)" strokeWidth={0.8} />
      {Array.from({ length: copies - 1 }).map((_, j) => (
        <path key={j} className="pile-copy" d={arch} transform={`translate(${shift - j * off}, ${-(copies - 1 - j) * 0.5 * s})`} fill={colour} stroke="var(--ink)" strokeWidth={1} />
      ))}
      <g className="stall-piece" key={n} transform={copies > 1 ? `translate(${-shift} 0)` : undefined}>
        <clipPath id={clip}>
          <path d={arch} />
        </clipPath>
        <path d={arch} fill="var(--paper)" />
        <g clipPath={`url(#${clip})`}>
          <svg x={cx - hw} y={top} width={hw * 2} height={bustH} viewBox="14 12 72 90" aria-hidden="true">
            <Portrait character={pid} size={100} expression={face === 'neutral' ? undefined : face} />
          </svg>
          <rect x={cx - hw} y={top + bustH - 0.5} width={hw * 2} height={foot - top - bustH + 1} fill={colour} />
          <path d={`M ${cx - hw} ${top + bustH} h ${hw * 2}`} stroke="var(--ink)" strokeWidth={0.6} opacity={0.5} />
        </g>
        <path d={arch} fill="none" stroke={colour} strokeWidth={1.8 * s} />
        <path d={arch} fill="none" stroke="var(--ink)" strokeWidth={1} />
        {showInitial && (
          <text x={cx} y={foot - 1.6 * s} textAnchor="middle" className="stall-initial" fontSize={7 * s}>
            {PRODUCER_INITIAL[pid]}
          </text>
        )}
      </g>
      {n >= COUNT_FROM && <CountBadge cx={w + 0.35 * countR - countR} cy={top - s + countR} r={countR} n={n} />}
    </g>
  )
}

// Plan item 2: a ring just inside each contested hex shows the balance of the region. The green arc is
// the producers' share (stalls), the dashed clay arc the corporations' (Outlets, Buyouts, Doubt). It is a
// full green ring when liberated, and the clay arc turns solid and thick when a Squeeze would cost the
// region Lost Land (damage above its defence). Dash patterns keep it readable in greyscale.
function PressureRing({ x, y, ours, theirs, atRisk, liberated }: { x: number; y: number; ours: number; theirs: number; atRisk: boolean; liberated: boolean }) {
  const total = ours + theirs
  if (total === 0) return null
  const share = liberated ? 100 : Math.round((ours / total) * 100)
  const pts = hexPoints(x, y, HEX_R * GAP_SCALE * 0.9)
  return (
    <g className={`pressure-ring${atRisk ? ' at-risk' : ''}${liberated ? ' freed' : ''}`} pointerEvents="none" data-share={share}>
      {share < 100 && (
        <polygon
          points={pts}
          pathLength={100}
          fill="none"
          stroke="var(--clay-deep)"
          strokeWidth={atRisk ? 5 : 3}
          strokeDasharray={atRisk ? '5 2.5' : '3 2'}
          opacity={atRisk ? 0.9 : 0.6}
        />
      )}
      {share > 0 && (
        <polygon
          points={pts}
          pathLength={100}
          fill="none"
          stroke="var(--pasture)"
          strokeWidth={5}
          strokeDasharray={`${share} ${100 - share}`}
          strokeLinecap="butt"
        />
      )}
    </g>
  )
}

// Co-op marker: "wax-seal rosette" — was a plain filled circle. Now a ring of six petals around a
// centre disc, the shape a wax seal's pressed rosette actually has. `orbit`/`petalR`/`centreR` scale the
// whole rosette; the map-piece size (used at `x`/`y` region coordinates) needs a bigger radius than the
// legend icon below, which must fit inside a compact fixed viewBox like Outlet/Buyout/Doubt's.
// Plan item 28: life on a liberated region. Bunting strung across the top of the hex, a cottage chimney
// with smoke curling up and a bird wheeling over it. The CSS drifts the smoke and the bird; reduced motion
// leaves them still. `seed` staggers each region's timing so the board doesn't move in step.
function LiberatedLife({ x, y, seed }: { x: number; y: number; seed: number }) {
  const R = HEX_R
  const x0 = x - R * 0.56
  const x1 = x + R * 0.56
  const yTop = y - R * 0.6
  const sag = R * 0.14
  const flags = 7
  const colours = ['var(--clay)', 'var(--wheat)', 'var(--sea)', 'var(--pasture)']
  const at = (t: number) => ({ px: x0 + (x1 - x0) * t, py: yTop + 4 * sag * t * (1 - t) })
  const cx = x + R * 0.42
  const cy = y + R * 0.12
  return (
    <g className="liberated-life" pointerEvents="none" data-seed={seed % 4}>
      <path d={`M ${x0},${yTop} Q ${x},${yTop + 2 * sag} ${x1},${yTop}`} fill="none" stroke="var(--ink)" strokeWidth={1.2} opacity={0.7} />
      {Array.from({ length: flags }, (_, i) => {
        const a = at((i + 0.5) / flags - 0.035)
        const b = at((i + 0.5) / flags + 0.035)
        const m = at((i + 0.5) / flags)
        return <path key={i} className="bunting-flag" d={`M ${a.px},${a.py} L ${b.px},${b.py} L ${m.px},${m.py + 11} Z`} fill={colours[(i + seed) % colours.length]} stroke="var(--ink)" strokeWidth={0.8} strokeLinejoin="round" />
      })}
      <g className="life-cottage">
        <path d={`M ${cx - 11},${cy} L ${cx},${cy - 10} L ${cx + 11},${cy} L ${cx + 11},${cy + 10} L ${cx - 11},${cy + 10} Z`} fill="var(--paper)" stroke="var(--ink)" strokeWidth={1.2} strokeLinejoin="round" />
        <path d={`M ${cx - 13},${cy + 1} L ${cx},${cy - 11} L ${cx + 13},${cy + 1}`} fill="none" stroke="var(--clay-deep)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        <rect x={cx + 4} y={cy - 12} width={4} height={8} fill="var(--clay-deep)" stroke="var(--ink)" strokeWidth={0.8} />
        <rect x={cx - 3} y={cy + 3} width={5} height={7} fill="var(--wheat)" stroke="var(--ink)" strokeWidth={0.6} />
      </g>
      {[0, 1, 2].map((i) => (
        <circle key={i} className="life-smoke" data-puff={i} cx={cx + 6} cy={cy - 15 - i * 6} r={2.6 + i * 1.2} fill="var(--paper-hi)" stroke="var(--ink)" strokeWidth={0.6} opacity={0.75 - i * 0.18} />
      ))}
      <path className="life-bird" d={`M ${x - R * 0.3 - 6},${y - R * 0.34} q 3,-4 6,0 q 3,-4 6,0`} fill="none" stroke="var(--ink)" strokeWidth={1.4} strokeLinecap="round" />
    </g>
  )
}

function CoopMarker({
  x,
  y,
  orbit = 7,
  petalR = 4.5,
  centreR = 6,
}: {
  x: number
  y: number
  orbit?: number
  petalR?: number
  centreR?: number
}) {
  const petals = Array.from({ length: 6 }, (_, i) => {
    const angle = (i * 60 * Math.PI) / 180
    return { cx: x + orbit * Math.cos(angle), cy: y + orbit * Math.sin(angle) }
  })
  return (
    <g>
      {petals.map((p, i) => (
        <circle key={i} cx={p.cx} cy={p.cy} r={petalR} fill="var(--pasture)" stroke="var(--ink)" strokeWidth={0.6} />
      ))}
      <circle cx={x} cy={y} r={centreR} fill="var(--pasture)" stroke="var(--ink)" strokeWidth={0.8} />
    </g>
  )
}

// Same rosette, scaled down to fit the map legend's compact 12x14 viewBox (SPEC 10.5's "?"-next-to-the-
// thing tooltip key, matching Outlet/Buyout/Doubt's own fixed-viewBox legend icons below). The map-piece
// version above is sized for 32px+ regions and overflows a 12x14 box if reused directly, which had been
// clipping the rosette down to an undifferentiated circle (caught by gate 8's greyscale/shape-legibility
// check) — this version keeps the same silhouette at a proportion that actually fits.
export function CoopMarkerIcon() {
  return <CoopMarker x={6} y={7} orbit={2.6} petalR={1.9} centreR={2.3} />
}

// ROADMAP 11: a small painted-terrain vignette per region type, tucked into the hex's upper flanks where
// no piece or label ever sits. Flat fills, 1.5 ink outline (STYLE.md 2), and each is a distinct silhouette
// (bushes, furrows, boat, tower) so it survives the greyscale shape test as well as the texture does.
/** Plan item 20: the painted ground under each tile's landmarks, clipped to the face. Pasture rolls in two
 * hills with tufts, crop is a patchwork of strips, coast has a sand shore and deeper water, the capital a
 * paved square with roofs at its edge. Low contrast, so pieces and labels stay on top. */
export function GroundArt({ type, id, clip }: { type: RegionType; id: string; clip: string }) {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const flip = h % 2 === 0 ? 1 : -1
  const R = HEX_R * GAP_SCALE - 2
  let art: ReactElement
  if (type === 'pasture') {
    art = (
      <g transform={`scale(${flip},1)`}>
        <path d={`M${-R},28 C-50,6 -10,8 20,26 S70,40 ${R},22 L${R},${R} L${-R},${R} Z`} fill="var(--pasture)" opacity={0.22} />
        <path d={`M${-R},58 C-40,38 10,44 40,54 S80,60 ${R},50 L${R},${R} L${-R},${R} Z`} fill="var(--pasture)" opacity={0.22} />
        {[[-52, 18], [-24, 46], [12, 30], [48, 62], [60, 14], [-58, 64], [-6, 70]].map(([x, y]) => (
          <path key={`${x}${y}`} d={`M${x! - 3},${y} l1.5,-5 M${x},${y} l0,-6 M${x! + 3},${y} l-1.5,-5`} stroke="var(--pasture)" strokeWidth={1.3} strokeLinecap="round" opacity={0.6} />
        ))}
        {[[-36, 34], [28, 44], [-14, 58], [56, 36]].map(([x, y]) => (
          <circle key={`f${x}`} cx={x} cy={y} r={1.8} fill="var(--paper)" stroke="var(--clay)" strokeWidth={0.8} opacity={0.8} />
        ))}
      </g>
    )
  } else if (type === 'crop') {
    const strips = [-90, -54, -18, 18, 54, 90]
    art = (
      <g transform={`rotate(${flip * 24})`}>
        {strips.map((x, i) => (
          <rect key={x} x={x - 18} y={-R - 20} width={36} height={2 * R + 40} fill={i % 3 === 0 ? 'var(--pasture)' : i % 3 === 1 ? 'var(--wheat)' : 'var(--clay)'} opacity={i % 3 === 1 ? 0.3 : 0.14} />
        ))}
        {strips.map((x) => (
          <path key={`e${x}`} d={`M${x - 18},${-R - 20} V${R + 20}`} stroke="var(--ink)" strokeWidth={0.8} opacity={0.18} />
        ))}
      </g>
    )
  } else if (type === 'coast') {
    art = (
      <g transform={`scale(${flip},1)`}>
        <path d={`M${-R},${-R} L-34,${-R} C-46,-30 -30,10 -52,40 S-60,70 -40,${R} L${-R},${R} Z`} fill="var(--wheat)" opacity={0.42} />
        <path d={`M-34,${-R} C-46,-30 -30,10 -52,40 S-60,70 -40,${R}`} fill="none" stroke="var(--paper)" strokeWidth={3} opacity={0.75} />
        <path d={`M-24,${-R} C-36,-30 -20,10 -42,40 S-50,70 -30,${R} L${R},${R} L${R},${-R} Z`} fill="var(--sea)" opacity={0.12} />
        <path d={`M10,${-R} C0,-30 20,10 0,40 S-6,70 14,${R} L${R},${R} L${R},${-R} Z`} fill="var(--sea)" opacity={0.12} />
      </g>
    )
  } else {
    art = (
      <g>
        <circle r={58} fill="var(--paper)" opacity={0.34} />
        <circle r={58} fill="none" stroke="var(--ink)" strokeWidth={1} opacity={0.2} strokeDasharray="3 4" />
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <g key={a} transform={`rotate(${a + 30}) translate(0,-74)`}>
            <path d="M-11,6 L-11,-2 L0,-9 L11,-2 L11,6 Z" fill="var(--clay)" opacity={0.3} stroke="var(--ink)" strokeWidth={0.8} strokeOpacity={0.3} />
          </g>
        ))}
      </g>
    )
  }
  return (
    <g className="ground-art" pointerEvents="none" aria-hidden="true">
      <clipPath id={clip}>
        <polygon points={hexPoints(0, 0, R)} />
      </clipPath>
      <g clipPath={`url(#${clip})`}>{art}</g>
    </g>
  )
}

export function TerrainArt({ type, id }: { type: RegionType; id: string }) {
  // Per-region variation: a stable hash of the id picks a variant so neighbours of one type don't look cloned.
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const flip = h % 2 === 0 ? 1 : -1
  const extra = (h >> 1) % 3
  // Plan item 249: each kind keeps a small idle life (a grazing sheep, wheat in the wind, boats on the swell, the
  // market clock and its pennant). `data-idle` names it; `data-seed` staggers it per region so the board never moves
  // in step. CSS runs it, pauses it when the tab is hidden and stills it under reduced motion.
  const seed = (h >> 3) % 4
  const line = { stroke: 'var(--ink)', strokeWidth: 1.5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  if (type === 'pasture') {
    const bush = (cx: number) => (
      <path
        key={cx}
        d={`M${cx - 13},-10 q-4,-9 5,-11 q3,-8 8,-2 q8,-5 9,4 q6,2 3,9 z`}
        fill="var(--pasture)"
        {...line}
      />
    )
    return (
      <g opacity={0.85}>
        {bush(-40)}
        {bush(38)}
        <g transform={`translate(${-30 * flip},-40) scale(${flip},1)`}>
          <g className="idle-sheep" data-idle="sheep" data-seed={seed}>
            <path d="M-6,3 v5 M-2,4 v4 M3,4 v4 M6,3 v5" {...line} strokeWidth={1.3} />
            <path d="M-9,1 q-2,-6 3,-7 q2,-4 6,-2 q4,-3 7,1 q4,1 2,6 q1,4 -4,4 h-10 q-5,0 -4,-2 z" fill="var(--paper-hi)" {...line} strokeWidth={1.2} />
            <g className="idle-sheep-head">
              <path d="M8,-3 q6,-2 7,3 q0,4 -4,4 q-4,0 -4,-4 z" fill="var(--ink)" />
              <path d="M9,-3 l-2,-2" {...line} strokeWidth={1.2} />
            </g>
          </g>
        </g>
        {extra === 0 && (
          <g transform={`translate(${-6 * flip},-26)`}>
            <path d="M-8,2 h14 v-6 h-4 l-2,-3 h-5 z" fill="var(--paper)" {...line} strokeWidth={1.2} />
            <path d="M-6,2 v4 M4,2 v4" {...line} strokeWidth={1.2} />
          </g>
        )}
      </g>
    )
  }
  if (type === 'crop') {
    return (
      <g fill="none" {...line} opacity={0.75} transform={`scale(${flip},1)`}>
        {extra === 0 && <path d="M-6,-30 q6,-10 12,0 z" fill="var(--clay)" />}
        {[-1, 1].map((d) => (
          <g key={d} className="idle-wheat" data-idle="wheat" data-seed={(seed + (d > 0 ? 2 : 0)) % 4}>
            <path d={`M${d * 24},-4 Q${d * 36},-16 ${d * 52},-28`} />
            <path d={`M${d * 34},0 Q${d * 46},-12 ${d * 62},-22`} />
            <path d={`M${d * 44},4 Q${d * 56},-6 ${d * 70},-14`} />
          </g>
        ))}
      </g>
    )
  }
  if (type === 'coast') {
    const boat = (cx: number, k: number) => (
      <g key={cx} transform={`translate(${cx},-14) scale(${k})`}>
        <g className="idle-boat" data-idle="boat" data-seed={(seed + (k < 1 ? 1 : 0)) % 4}>
          <path d="M-12,2 L12,2 L8,10 L-8,10 Z" fill="var(--clay)" {...line} />
          <path d="M0,0 L0,-20 M0,-20 L11,-2 L0,-2 Z" fill="var(--paper)" {...line} />
        </g>
      </g>
    )
    return (
      <g opacity={0.9}>
        {boat(-42 * flip, 1)}
        {boat(42 * flip, 0.75)}
        {extra === 0 && <path d="M-6,-34 q3,-5 6,0 q3,-5 6,0" fill="none" {...line} strokeWidth={1.2} />}
      </g>
    )
  }
  return (
    <g opacity={0.9}>
      <g transform="translate(0,-38)">
        <path d="M14,30 L14,6" {...line} strokeWidth={1.2} />
        <path className="idle-pennant" data-idle="pennant" data-seed={seed} d="M14,6 L26,9.5 L14,13 Z" fill="var(--clay)" {...line} strokeWidth={1} />
        <path d="M-7,30 L-7,4 L0,-8 L7,4 L7,30 Z" fill="var(--paper)" {...line} />
        <circle cx={0} cy={9} r={4.5} fill="var(--paper)" {...line} />
        <path d="M0,9 L2,10" {...line} strokeWidth={1.2} />
        <path className="idle-clock" data-idle="clock" data-seed={seed} d="M0,9 L0,5.5" {...line} strokeWidth={1.2} />
      </g>
    </g>
  )
}

export default function Map({ state, enemyTurn, highlight, threat, onSelect, onInspect, inspected, faces, underNames, ghost }: Props) {
  const active = state.config.activeRegions
  const layout = placedLayout(state.config.layout ?? 'ring', state.config.placement)
  const fit = layoutFit(layout, active)
  // A slot whose rule is off in this chapter never resolves, so it marks no hex.
  const rules = resolveRules(state)
  const squeezeTargets = rules.squeeze ? active.filter((id) => matchesSlot(state, id, 'squeeze')) : []
  // Plan item 189: a region under Mara's Injunction loses its Expand badge for the round.
  const expandTargets = rules.expand ? active.filter((id) => matchesSlot(state, id, 'expand') && !state.expandSkip.includes(id)) : []
  const highlighted = new Set(highlight ?? [])
  const wilted = squeezedLastTurn(state)
  const targeting = highlighted.size > 0
  const inspect = !onSelect && !targeting ? onInspect : undefined
  const colourBlindPatterns = loadSettings().colourBlindPatterns
  const uid = useId().replace(/:/g, '')

  // Reward choreography (aaa-ui M7): a freshly liberated region gets an anticipation squeeze, a ring and a
  // seed burst; a region that just gained Lost Land flashes and shakes. Tracked by diffing the previous
  // state, so loading a save or the first render plays nothing.
  const seen = useRef<{ lib: Set<RegionId>; lost: Record<string, number>; log: number } | null>(null)
  const [fx, setFx] = useState<Partial<Record<RegionId, 'lib' | 'sq'>>>({})
  // Plan item 63: a Squeeze slams Hollowell's box down on its tile (the stack drops in with a thud).
  const [thud, setThud] = useState<ReadonlySet<RegionId>>(() => new Set())
  // Plan item 249: the tiles' idle life pauses while the tab is hidden (CSS keys on html[data-tab-hidden]).
  useEffect(() => {
    const root = document.documentElement
    const sync = () => { if (document.hidden) root.dataset.tabHidden = ''; else delete root.dataset.tabHidden }
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => { document.removeEventListener('visibilitychange', sync); delete root.dataset.tabHidden }
  }, [])
  useEffect(() => {
    const lib = new Set<RegionId>()
    const lost: Record<string, number> = {}
    for (const id of active) {
      if (state.regions[id].liberated) lib.add(id)
      lost[id] = state.regions[id].lostLand
    }
    const prev = seen.current
    seen.current = { lib, lost, log: state.log.length }
    if (!prev) return
    const squeezed = new Set<RegionId>()
    for (let i = prev.log; i < state.log.length; i++) {
      const e = state.log[i]!
      if (e.type === 'squeeze') squeezed.add(e.region)
    }
    let tt = 0
    if (squeezed.size > 0) {
      setThud(squeezed)
      tt = window.setTimeout(() => setThud(new Set()), 700)
    }
    const next: Partial<Record<RegionId, 'lib' | 'sq'>> = {}
    for (const id of active) {
      if (lib.has(id) && !prev.lib.has(id)) next[id] = 'lib'
      else if ((lost[id] ?? 0) > (prev.lost[id] ?? 0)) next[id] = 'sq'
    }
    if (Object.keys(next).length === 0) return () => window.clearTimeout(tt)
    setFx(next)
    // Plan item 127: a moment lasts about 1.1 s (the ring's 240 ms delay and 900 ms run).
    const t = window.setTimeout(() => setFx({}), MOMENT_MS)
    return () => {
      window.clearTimeout(t)
      window.clearTimeout(tt)
    }
  }, [state, active])
  // Plan item 127: `?e2eMoment` exposes a hook that stages a liberation or a Squeeze on a region, for tests and shots.
  useEffect(() => {
    if (typeof window === 'undefined' || !new URLSearchParams(window.location.search).has('e2eMoment')) return
    const w = window as unknown as { cathnivoreMoment?: (kind: 'liberate' | 'squeeze', region: RegionId) => void }
    let t = 0
    w.cathnivoreMoment = (kind, region) => {
      window.clearTimeout(t)
      setFx({ [region]: kind === 'liberate' ? 'lib' : 'sq' })
      // The rest of the moment, as a real one gets it from the log: its cue, and Cath's reaction (Game listens).
      playCues([kind === 'liberate' ? 'crowd' : 'synthSweep'])
      window.dispatchEvent(new CustomEvent('cathnivore-moment', { detail: { kind, region } }))
      t = window.setTimeout(() => setFx({}), MOMENT_MS)
    }
    return () => {
      window.clearTimeout(t)
      delete w.cathnivoreMoment
    }
  }, [])
  // Plan item 189: a producer's role ability staged over the hex it acted on (diffed, as the engine logs no event).
  const [ability, setAbility] = useState<AbilityMomentView | null>(null)
  const abilityPrev = useRef(state)
  useEffect(() => {
    const prev = abilityPrev.current
    abilityPrev.current = state
    if (prev === state) return
    const used = abilityUsed(prev, state)
    if (!used) return
    setAbility((a) => ({ ...used, key: (a?.key ?? 0) + 1 }))
    playCues([used.producer === 'mara' ? 'woodClack' : used.producer === 'tomas' ? 'awning' : used.producer === 'ines' ? 'paperSlide' : 'synthChime'])
    const t = window.setTimeout(() => setAbility(null), ABILITY_MOMENT_MS)
    return () => window.clearTimeout(t)
  }, [state])
  useEffect(() => {
    if (typeof window === 'undefined' || !new URLSearchParams(window.location.search).has('e2eMoment')) return
    const w = window as unknown as { cathnivoreAbility?: (producer: ProducerId, region: RegionId) => void }
    let t = 0
    w.cathnivoreAbility = (producer, region) => {
      window.clearTimeout(t)
      setAbility((a) => ({ producer, region, key: (a?.key ?? 0) + 1 }))
      t = window.setTimeout(() => setAbility(null), ABILITY_MOMENT_MS)
    }
    return () => {
      window.clearTimeout(t)
      delete w.cathnivoreAbility
    }
  }, [])
  const marketEvent = state.config.marketEvent
  const moment = Object.values(fx).includes('lib') ? 'liberate' : Object.values(fx).includes('sq') ? 'squeeze' : undefined

  const svgRef = useRef<SVGSVGElement>(null)
  // Plan item 63: the hex's radius on screen, so each tile's piece tray is sized to what the player sees.
  const [hexPx, setHexPx] = useState(72)
  useLayoutEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const measure = () => {
      const k = svg.getScreenCTM()?.a ?? 0
      if (!k) return
      setHexPx(Math.round(HEX_R * fit.k * k * 2) / 2)
    }
    measure()
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    ro?.observe(svg)
    return () => ro?.disconnect()
  }, [fit.k])
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    fitPlaques(svg)
    let live = true
    document.fonts?.ready.then(() => live && fitPlaques(svg)).catch(() => {})
    return () => {
      live = false
    }
  }, [active.length])

  return (
    <svg ref={svgRef} data-round={state.round} data-moment={moment} data-event={marketEvent} viewBox={`${-SIZE} ${-SIZE + 12} ${SIZE * 2} ${SIZE * 2 - 24}`} className="map" role={onSelect || inspect ? 'group' : 'img'} aria-label="Map of Marrow">
      <RegionTextureDefs />
      <g transform={fit.k === 1 && fit.tx === 0 && fit.ty === 0 ? undefined : `translate(${fit.tx} ${fit.ty}) scale(${fit.k})`}>
      <g className="tile-shadows" filter="url(#tile-shadow)" pointerEvents="none" aria-hidden="true">
        {active.map((id) => {
          const { x, y } = hexCenter(id, layout)
          return <polygon key={id} points={hexPoints(x + 5, y + TILE_DEPTH + 9, HEX_R * GAP_SCALE)} />
        })}
      </g>
      {/* Every tile's edge goes down before any face, so a nearer tile's face covers the edge of the one
          behind it and the first polygon in each region stays its face. */}
      <g className="tile-edges" pointerEvents="none" aria-hidden="true">
        {active.map((id) => {
          const { x, y } = hexCenter(id, layout)
          const fill = REGION_FILL[regionType(state, id)]
          return (
            <g key={id}>
              <polygon points={hexPoints(x, y + TILE_DEPTH, HEX_R * GAP_SCALE)} fill={fill} stroke="var(--ink)" strokeWidth={2} />
              <polygon points={hexPoints(x, y + TILE_DEPTH, HEX_R * GAP_SCALE)} fill="black" opacity={0.32} />
            </g>
          )
        })}
      </g>
      {active.map((id) => {
        const def = { ...REGIONS[id], type: regionType(state, id) }
        const r = state.regions[id]
        const { x, y } = hexCenter(id, layout)
        const stalls = Object.entries(r.stalls).filter(([, n]) => (n ?? 0) > 0) as [ProducerId, number][]
        const dimmed = targeting && !highlighted.has(id)
        const glow = targeting && highlighted.has(id)
        // Plan item 63: the tile's piece tray (`pieceLayout`), sized to the hex as it renders on screen; the landmark
        // takes the first flank spot clear of its slots.
        const tray = pieceLayout(
          {
            outlets: r.outlets,
            buyouts: r.buyouts,
            doubt: r.doubt,
            producers: stalls.length,
            stallCounts: stalls.map(([, n]) => n),
            scheme: false,
            labelWidth: REGIONS[id].name.length * 8.6 + 16,
            badge: squeezeTargets.includes(id) || expandTargets.includes(id),
          },
          hexPx,
        )
        // Plan item 144: the event's dressing keeps to the hex's foot, but steps aside (and down in size) when the
        // stalls, pushed down the tile by Hollowell's stacks, reach there; it never meets a piece or the landmark.
        const dress =
          marketEvent === 'glut' || marketEvent === 'festival'
            ? (() => {
                const spot = pickSpot(tray.rects)
                const taken = spot ? [...tray.rects, boxAt(spot, spot.scale)] : tray.rects
                return dressingSpot(marketEvent, taken, { x: 0, y: HEX_R * (marketEvent === 'glut' ? 0.8 : 0.72) })
              })()
            : null
        return (
          <g
            key={id}
            data-region={id}
            data-enemy-pieces={r.outlets + r.buyouts + r.doubt + r.lostLand}
            className={`region-hex${dimmed ? ' dimmed' : ''}${glow ? ' glow' : ''}${inspected === id ? ' inspected' : ''}${onSelect ? ' region-hex-selectable' : ''}${fx[id] === 'lib' ? ' fx-liberate' : fx[id] === 'sq' || thud.has(id) ? ' fx-squeeze' : ''}`}
            onClick={onSelect ? () => onSelect(id) : inspect ? () => inspect(id) : undefined}
            // A region you can pick right now is a real control: focusable, and Enter or Space picks it.
            tabIndex={onSelect && glow ? 0 : undefined}
            role={onSelect && glow ? 'button' : 'group'}
            onKeyDown={
              onSelect && glow
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelect(id)
                    }
                  }
                : undefined
            }
            data-tutorial={`region-${id}`}
            data-threat={threat?.regions.includes(id) ? threat.slot : undefined}
            aria-label={def.name}
          >
            <polygon
              points={hexPoints(x, y, HEX_R * GAP_SCALE)}
              fill={REGION_FILL[def.type]}
              stroke="var(--ink)"
              strokeWidth={2}
            />
            <polygon points={hexPoints(x, y, HEX_R * GAP_SCALE)} fill={`url(#${REGION_PATTERN_ID[def.type]})`} />
            <polygon className="tile-paint" points={hexPoints(x, y, HEX_R * GAP_SCALE)} fill="url(#tile-paint)" pointerEvents="none" />
            {/* Plan item 144: the week's market event dresses every region's ground, under the pieces (the band at the
                hex's foot, below the stalls, is free on every tile). */}
            {marketEvent === 'drought' && <polygon className="ev-cracks" points={hexPoints(x, y, HEX_R * GAP_SCALE)} fill="url(#ev-cracks)" pointerEvents="none" />}
            {marketEvent === 'glut' && dress && (
              <g className="ev-heap" transform={`translate(${x + dress.x} ${y + dress.y}) scale(${dress.scale})`} pointerEvents="none">
                <ellipse cx={0} cy={5} rx={22} ry={3.5} fill="var(--ink)" opacity={0.15} />
                <circle cx={-13} cy={0} r={5.5} fill="#7fae4a" stroke="var(--ink)" strokeWidth={1.2} />
                <circle cx={0} cy={0} r={5.5} fill="#e9a23b" stroke="var(--ink)" strokeWidth={1.2} />
                <circle cx={13} cy={0} r={5.5} fill="#9b5aa0" stroke="var(--ink)" strokeWidth={1.2} />
              </g>
            )}
            {marketEvent === 'festival' && dress && (
              <g className="ev-lanterns" transform={`translate(${x + dress.x} ${y + dress.y}) scale(${dress.scale})`} pointerEvents="none">
                <path d="M-30 -5Q0 5 30 -5" fill="none" stroke="var(--ink)" strokeWidth={1.3} />
                {[-20, -7, 7, 20].map((dx, k) => (
                  <ellipse key={dx} cx={dx} cy={3 - 5 * (dx / 30) ** 2} rx={4.6} ry={5.8} fill={['#d9502f', '#e9b83b', '#4f8a3a', '#d9502f'][k]} stroke="var(--ink)" strokeWidth={1} />
                ))}
              </g>
            )}
            {/* Plan item 109: with nothing to pick on a phone, each region has a button of its own (a shape with no
                children, so the pieces' own controls aren't nested in it) that opens it up close. */}
            {inspect && (
              <polygon
                className="region-inspect"
                points={hexPoints(x, y, HEX_R * GAP_SCALE)}
                fill="transparent"
                pointerEvents="none"
                tabIndex={0}
                role="button"
                aria-label={`${def.name}: see it up close`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    inspect(id)
                  }
                }}
              />
            )}
            <polygon className="tile-light" points={hexPoints(x, y, HEX_R * GAP_SCALE - 1)} fill="url(#tile-light)" pointerEvents="none" />
            <polygon
              className="tile-bevel"
              points={hexPoints(x, y, HEX_R * GAP_SCALE - 3.5)}
              fill="none"
              stroke="white"
              strokeOpacity={0.3}
              strokeWidth={2}
              pointerEvents="none"
            />
            <g transform={`translate(${x}, ${y})`} pointerEvents="none">
              <GroundArt type={def.type} id={id} clip={`${uid}-ground-${id}`} />
            </g>
            {/* Plan item 76: the region's own ground, where the pieces and the landmark leave the face clear. */}
            <g transform={`translate(${x}, ${y})`}>
              <RegionGroundArt
                marks={(() => {
                  const spot = pickSpot(tray.rects)
                  const taken = spot ? [...tray.rects, { kind: 'badge' as const, ...boxAt(spot, spot.scale) }] : tray.rects
                  return regionGround(id, def.type, taken)
                })()}
              />
            </g>
            <g transform={`translate(${x}, ${y})`} pointerEvents="none" className="terrain-art">
              <TerrainArt type={def.type} id={id} />
            </g>
            {/* Plan item 55: Hollowell dug in (grip stage 2+) glazes the ground cold; a region the last enemy turn
                Squeezed wilts (greyed, the crops drooping) until the next. */}
            {/* Plan item 267: as a cold band just inside the hex's edge, not a wash over the whole of it, so held land
                keeps its colour (the wash left held hexes hazy beside a freed one). */}
            {gripStage(r) >= 2 && <polygon className="grip-glaze" data-grip-glaze={gripStage(r)} points={hexPoints(x, y, HEX_R * GAP_SCALE * 0.9)} fill="none" stroke="var(--sea)" strokeWidth={HEX_R * 0.12} strokeLinejoin="round" opacity={gripStage(r) >= 3 ? 0.42 : 0.3} pointerEvents="none" />}
            {wilted.has(id) && !r.liberated && <polygon className="grip-wilt" data-wilt="true" points={hexPoints(x, y, HEX_R * GAP_SCALE * 0.97)} fill="var(--ink)" opacity={0.14} pointerEvents="none" />}
            {/* Plan item 55: the region's own landmark (the mill, the light, the market cross...), from the campaign
                map's art, on the first flank of the tile its pieces leave clear. */}
            {(() => {
              const spot = pickSpot(tray.rects)
              if (!spot) return null
              const grip = gripStage(r)
              const edge = atTheEdge(r)
              return (
                <g className="board-landmark" data-landmark={BOARD_LANDMARKS[id]} data-grip={grip} data-edge={edge || undefined} data-cx={x} data-cy={y} transform={`translate(${x + spot.x}, ${y + spot.y}) scale(${spot.scale})`} pointerEvents="none">
                  <Landmark kind={BOARD_LANDMARKS[id]} />
                  <GripProps stage={grip} edge={edge} />
                </g>
              )
            })()}
            {r.liberated && (
              <polygon
                className="liberate-bloom"
                points={hexPoints(x, y, HEX_R * GAP_SCALE * 0.97)}
                fill="var(--pasture)"
                opacity={0.16}
                pointerEvents="none"
              />
            )}
            {r.lostLand > 0 && (
              <g className="lostland-overlay">
                <polygon points={hexPoints(x, y, HEX_R * GAP_SCALE * 0.98)} fill="var(--clay)" opacity={0.18} />
                <polygon points={hexPoints(x, y, HEX_R * GAP_SCALE * 0.98)} fill="url(#texture-lostland)" />
                <path
                  d={`M ${x - HEX_R * 0.4},${y - HEX_R * 0.3} L ${x - HEX_R * 0.1},${y} L ${x - HEX_R * 0.3},${y + HEX_R * 0.35} M ${x - HEX_R * 0.1},${y} L ${x + HEX_R * 0.25},${y + HEX_R * 0.15}`}
                  fill="none"
                  stroke="var(--ink)"
                  strokeWidth={1.5}
                  opacity={0.4}
                />
              </g>
            )}

            {r.outlets > 0 && (
              <g className="plastic-film" pointerEvents="none" key={`film${r.outlets}`}>
                <polygon
                  points={hexPoints(x, y, HEX_R * GAP_SCALE * 0.97)}
                  fill="#dff3ff"
                  opacity={Math.min(0.1 + r.outlets * 0.05, 0.3)}
                />
                <path
                  d={`M ${x - HEX_R * 0.7},${y - HEX_R * 0.2} L ${x - HEX_R * 0.15},${y - HEX_R * 0.75} L ${x + HEX_R * 0.05},${y - HEX_R * 0.7} L ${x - HEX_R * 0.6},${y + HEX_R * 0.05} Z`}
                  fill="#fff"
                  opacity={0.35}
                />
              </g>
            )}
            <PressureRing
              x={x}
              y={y}
              ours={stalls.reduce((a, [, n]) => a + n, 0)}
              theirs={r.outlets + r.buyouts + r.doubt}
              atRisk={!r.liberated && r.outlets + 2 * r.buyouts > stalls.reduce((a, [, n]) => a + n, 0)}
              liberated={r.liberated}
            />
            {squeezeTargets.includes(id) && (
              <g className="threat-badge" transform={`translate(${x}, ${y + BADGE.y0}) scale(${tray.badgeK.toFixed(3)}) translate(-30, 0)`}>
                <rect x={0} y={0} width={60} height={14} rx={7} fill="var(--clay-deep)" />
                <text x={30} y={10.2} textAnchor="middle" className="badge-text">
                  SQUEEZE
                </text>
              </g>
            )}
            {expandTargets.includes(id) && !squeezeTargets.includes(id) && (
              <g className="threat-badge" transform={`translate(${x}, ${y + BADGE.y0}) scale(${tray.badgeK.toFixed(3)}) translate(-28, 0)`}>
                <rect x={0} y={0} width={56} height={14} rx={7} fill="var(--wheat)" />
                <text x={28} y={10.2} textAnchor="middle" className="badge-text badge-text-dark">
                  EXPAND
                </text>
              </g>
            )}

            {/* Plan item 63: the tile's piece tray (`pieceLayout`), sized to the hex as it renders on screen: Hollowell's
                stacks in a row across the middle, the producers' miniatures along the bottom, the name plate and any
                threat badge kept clear. Each piece slides to its slot when the tray changes. */}
            {(() => {
              const s = tray.scale
              const icons = { outlets: ['o', r.outlets], buyouts: ['b', r.buyouts], doubt: ['d', r.doubt] } as const
              return (
                <g className={`piece-tray${thud.has(id) ? ' tray-thud' : ''}`} data-scale={s.toFixed(2)} data-ornaments={tray.ornaments || undefined}>
                  {tray.rects.map((rect) => {
                    if (rect.kind === 'outlets' || rect.kind === 'buyouts' || rect.kind === 'doubt') {
                      const [k, n] = icons[rect.kind]
                      return (
                        <g key={k} className="piece-slot" transform={`translate(${x + rect.x0} ${y})`} data-piece={k} data-count={n} data-silhouette={SILHOUETTE[rect.kind]}>
                          <EnemyStack kind={rect.kind} n={n} scale={s} ornaments={tray.ornaments} countR={tray.countR} cy={tray.enemyY} />
                        </g>
                      )
                    }
                    if (rect.kind === 'producer') {
                      const [pid, n] = stalls[rect.i ?? 0]!
                      return (
                        <g key={pid} className="piece-slot" transform={`translate(${x + rect.x0} ${y})`} data-piece="stall" data-count={n} data-silhouette="standee">
                          <ProducerMini pid={pid} n={n} scale={s} countR={tray.countR} clip={`${uid}-pin-${id}-${pid}`} showInitial={colourBlindPatterns} face={faces?.[pid]} py={tray.producerY} />
                        </g>
                      )
                    }
                    return null
                  })}
                </g>
              )
            })()}

            {fx[id] === 'lib' && (
              <g className="lib-burst" pointerEvents="none">
                {/* Plan item 127: the tile turns from Hollowell's orange to the co-op's green, and bunting drops in. */}
                <polygon className="lib-flip" points={hexPoints(x, y, HEX_R * GAP_SCALE)} />
                <g className="lib-bunting">
                  <path d={`M${x - HEX_R * 0.62} ${y - HEX_R * 0.32} Q${x} ${y - HEX_R * 0.12} ${x + HEX_R * 0.62} ${y - HEX_R * 0.32}`} fill="none" stroke="var(--ink)" strokeWidth={1.5} />
                  {Array.from({ length: 7 }, (_, i) => {
                    const t = (i + 0.5) / 7
                    const bx = x - HEX_R * 0.62 + t * HEX_R * 1.24
                    const by = y - HEX_R * 0.32 + 4 * t * (1 - t) * HEX_R * 0.2
                    return <path key={i} d={`M${bx - 6} ${by} L${bx + 6} ${by} L${bx} ${by + 12} Z`} fill={['var(--clay)', 'var(--wheat)', 'var(--pasture)'][i % 3]} stroke="var(--ink)" strokeWidth={1} />
                  })}
                </g>
                <circle className="lib-ring" cx={x} cy={y} r={HEX_R * 0.5} fill="none" stroke="var(--wheat-hi, #e8c35a)" strokeWidth={4} />
                {Array.from({ length: 12 }, (_, i) => {
                  const a = (i / 12) * Math.PI * 2
                  return (
                    <circle
                      key={i}
                      className="lib-seed"
                      cx={x}
                      cy={y}
                      r={3.5}
                      fill={i % 2 ? 'var(--pasture)' : 'var(--wheat-hi, #e8c35a)'}
                      style={{ ['--dx' as string]: `${Math.cos(a) * HEX_R * 0.95}px`, ['--dy' as string]: `${Math.sin(a) * HEX_R * 0.95}px` }}
                    />
                  )
                })}
              </g>
            )}
            {fx[id] === 'sq' && (
              <g pointerEvents="none">
                <polygon className="sq-flash" points={hexPoints(x, y, HEX_R * GAP_SCALE)} fill="var(--clay)" />
                {/* Plan item 127: Hollowell's glossy stamp, slammed flat with no bounce. */}
                <g transform={`translate(${x} ${y + HEX_R * 0.36}) rotate(-8)`}>
                  {/* The animation's transform would replace a transform on this group, so the place is the parent's. */}
                  <g className="sq-stamp">
                    <rect x={-44} y={-12} width={88} height={24} rx={4} />
                    <text x={0} y={5} textAnchor="middle">SQUEEZED</text>
                  </g>
                </g>
              </g>
            )}
            {r.liberated && <LiberatedLife x={x} y={y} seed={id.length} />}
            {r.liberated && (
              <g className="coop-stamp">
                {/* Liberated means no corporate pieces, so the seal takes their place at the centre. */}
                <CoopMarker x={x} y={y - HEX_R * 0.06} />
              </g>
            )}
          </g>
        )
      })}
      {/* Plan item 15: the Delta's river, drawn along the hex edges it runs between, with a plank bridge where
          it can be crossed. */}
      {(layout.channels ?? []).map(([a, b]) => {
        const p = hexCenter(a, layout)
        const q = hexCenter(b, layout)
        const len = Math.hypot(q.x - p.x, q.y - p.y)
        const dx = (q.x - p.x) / len
        const dy = (q.y - p.y) / len
        const mx = (p.x + q.x) / 2
        const my = (p.y + q.y) / 2
        const h = HEX_R / 2
        const bridged = (layout.bridges ?? []).some(([x, y]) => (x === a && y === b) || (x === b && y === a))
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI
        return (
          <g key={`river-${a}-${b}`} className="map-river" pointerEvents="none">
            <line x1={mx + dy * h} y1={my - dx * h} x2={mx - dy * h} y2={my + dx * h} stroke="var(--ink)" strokeWidth={15} strokeLinecap="round" />
            <line x1={mx + dy * h} y1={my - dx * h} x2={mx - dy * h} y2={my + dx * h} stroke="var(--region-coast)" strokeWidth={11} strokeLinecap="round" />
            {bridged && (
              <g transform={`translate(${mx} ${my}) rotate(${angle})`}>
                <rect x={-17} y={-8} width={34} height={16} rx={2} fill="var(--paper-hi)" stroke="var(--ink)" strokeWidth={2} />
                <path d="M-9 -8V8M0 -8V8M9 -8V8" stroke="var(--ink)" strokeWidth={1.2} />
              </g>
            )}
          </g>
        )
      })}
      {/* Region names are drawn in their own pass, after every hex's fill/pattern, so a name near a
          hex's pointy top vertex is never painted over by a neighbouring hex above it (gate 8 found
          Oakvale's and Shingle Bay's labels — the two bottom-row regions in the flower, whose top
          vertex sits against the row above rather than open background — clipped this way). */}
      {underNames}
      {ghost && (
        <g className="ghost-pieces" pointerEvents="none" aria-hidden="true">
          {ghost.regions.filter((id) => active.includes(id)).map((id) => {
            const { x, y } = hexCenter(id, layout)
            return (
              <g key={id} className="ghost-piece" data-region={id} data-sign={ghost.sign} transform={`translate(${x} ${y - HEX_R * 0.42})`}>
                <circle r={17} />
                <path d={ghost.sign === '+' ? 'M-7 0H7M0-7V7' : 'M-7 0H7'} />
              </g>
            )
          })}
        </g>
      )}
      {active.map((id) => {
        const def = REGIONS[id]
        const { x, y } = hexCenter(id, layout)
        return (
          <g key={`name-${id}`} className="region-sign" data-sign={id} pointerEvents="none">
            {/* AAA UI M4 fix: a sentence-case Fraunces plaque, sized to the set name once the face has
                loaded (see `fitPlaques`); the estimate below is only the first paint. */}
            <rect
              className="region-plaque"
              x={x - def.name.length * 4.3 - 8}
              y={y - HEX_R * 0.62 - 15}
              width={def.name.length * 8.6 + 16}
              height={21}
              rx={4}
              fill="var(--paper)"
              stroke="var(--ink)"
              strokeWidth={1.5}
            />
            <text x={x} y={y - HEX_R * 0.62} textAnchor="middle" className="region-name">
              {def.name}
            </text>
          </g>
        )
      })}
      {ability && active.includes(ability.region) && (() => {
        const { x, y } = hexCenter(ability.region, layout)
        return <AbilityMoment key={ability.key} view={ability} x={x} y={y} r={HEX_R * GAP_SCALE} />
      })()}
      </g>
      {enemyTurn && <EnemyTurnLayer view={enemyTurn} layout={layout} fit={fit} />}
      {!enemyTurn && threat && threat.regions.length > 0 && <ThreatLayer threat={threat} layout={layout} fit={fit} />}
    </svg>
  )
}

const HQ_X = 196
const HQ_Y = 146
/** Where each HQ's door is: the corners on the side away from the strip, Hollowell left and Candor right. */
function hqDoor(faction: Faction, side: 'top' | 'bottom'): { x: number; y: number } {
  return { x: faction === 'hollowell' ? -HQ_X : HQ_X, y: side === 'top' ? -HQ_Y : HQ_Y + 58 }
}

// Hollowell's HQ: a glossy orange office block with a lit window grid and an H on the roof.
function HollowellHQ() {
  return (
    <g className="hq-art">
      <rect x={-19} y={-56} width={38} height={56} rx={2} fill="var(--hollowell)" stroke="var(--ink)" strokeWidth={1.6} />
      <rect x={-19} y={-56} width={9} height={56} fill="var(--hollowell-highlight)" opacity={0.55} />
      {Array.from({ length: 4 }, (_, row) =>
        Array.from({ length: 3 }, (_, col) => (
          <rect key={`${row}-${col}`} x={-13 + col * 9.5} y={-48 + row * 10} width={6} height={6} rx={0.8} fill="var(--wheat-hi, #e8c35a)" opacity={(row + col) % 3 === 0 ? 0.95 : 0.6} />
        )),
      )}
      <rect x={-5} y={-9} width={10} height={9} fill="var(--ink)" />
      <rect x={-12} y={-68} width={24} height={12} rx={2} fill="var(--paper)" stroke="var(--ink)" strokeWidth={1.4} />
      <text x={0} y={-58.5} textAnchor="middle" fontSize={11} className="hq-mark">
        H
      </text>
    </g>
  )
}

// Candor's HQ: a broadcast mast, a lattice tower under a speech-bubble dish with signal arcs.
function CandorHQ() {
  return (
    <g className="hq-art">
      <path d="M -16,0 L -3,-46 L 3,-46 L 16,0 Z" fill="none" stroke="var(--ink)" strokeWidth={2} strokeLinejoin="round" />
      <path d="M -12,-12 L 9,-12 M -9,-24 L 6,-24 M -6,-35 L 4,-35 M -12,-12 L 6,-24 L -6,-35 M 12,-12 L -6,-24 L 6,-35" stroke="var(--ink)" strokeWidth={1.1} fill="none" />
      <path d="M -6,-50 L -2,-50 L -8,-44 Z" fill="var(--candor)" stroke="var(--ink)" strokeWidth={1.2} strokeLinejoin="round" />
      <circle cx={0} cy={-60} r={12} fill="var(--candor)" stroke="var(--ink)" strokeWidth={1.6} />
      <circle cx={4} cy={-64} r={3.4} fill="var(--candor-highlight)" />
      <text x={0} y={-55} textAnchor="middle" fontSize={11} className="hq-mark">
        C
      </text>
      <path className="hq-signal" d="M 17,-70 A 18 18 0 0 1 17,-50 M 23,-76 A 26 26 0 0 1 23,-44 M -17,-70 A 18 18 0 0 0 -17,-50 M -23,-76 A 26 26 0 0 0 -23,-44" fill="none" stroke="var(--candor)" strokeWidth={2.2} strokeLinecap="round" />
    </g>
  )
}

/** Plan item 25: while a plan card is looked at, Hollowell's HQ stands in its corner with a dotted trail to
 *  each hex the card will hit (drawn in once; static under reduced motion). */
function ThreatLayer({ threat, layout, fit }: { threat: NonNullable<Props['threat']>; layout: Layout; fit: Fit }) {
  const door = hqDoor('hollowell', 'top')
  const x0 = door.x
  const y0 = door.y - 34
  return (
    <g className="threat-layer" pointerEvents="none" data-threat-slot={threat.slot}>
      <g className="hq hq-hollowell threat-hq" transform={`translate(${door.x}, ${door.y}) scale(0.95)`}>
        <ellipse cx={0} cy={1} rx={30} ry={6} fill="var(--ink)" opacity={0.18} />
        <HollowellHQ />
      </g>
      {threat.regions.map((id) => {
        const to = fitPoint(hexCenter(id, layout), fit)
        const x1 = to.x
        const y1 = to.y - HEX_R * 0.14
        const xm = (x0 + x1) / 2
        const ym = Math.max(Math.min(y0, y1) - 40, -200)
        const cx = 2 * xm - (x0 + x1) / 2
        const cy = 2 * ym - (y0 + y1) / 2
        return (
          <g key={id} className="threat-trail-group" data-threat-to={id}>
            <path className="threat-trail" d={`M ${x0},${y0} Q ${cx},${cy} ${x1},${y1}`} pathLength={100} />
            <circle className="threat-land" cx={x1} cy={y1} r={9} />
          </g>
        )
      })}
    </g>
  )
}

function FlightIcon({ piece }: { piece: Flight['piece'] }) {
  return piece === 'outlet' ? <Outlet /> : piece === 'buyout' ? <Buyout /> : <Doubt />
}

function EnemyTurnLayer({ view, layout, fit }: { view: EnemyTurnView; layout: Layout; fit: Fit }) {
  const factions: Faction[] = ['hollowell', 'candor']
  return (
    <g className="enemy-turn-layer" pointerEvents="none" data-hq-side={view.hqSide}>
      {factions.map((f) => {
        const door = hqDoor(f, view.hqSide)
        return (
          <g
            key={`${f}-${view.hqSide}`}
            className={`hq hq-${f}${view.active === f ? ' hq-active' : ''}`}
            transform={`translate(${door.x}, ${door.y}) scale(1.15)`}
            data-hq={f}
          >
            <ellipse cx={0} cy={1} rx={30} ry={6} fill="var(--ink)" opacity={0.18} />
            {f === 'hollowell' ? <HollowellHQ /> : <CandorHQ />}
            <rect x={-50} y={5} width={100} height={18} rx={3} fill="var(--ink-on-fixed-fill)" />
            <text x={0} y={18.5} textAnchor="middle" fontSize={12} className="hq-name">
              {f === 'hollowell' ? 'HOLLOWELL' : 'CANDOR'}
            </text>
          </g>
        )
      })}
      {view.flights.map((flight, i) => {
        const from = hqDoor(flight.faction, view.hqSide)
        const x0 = from.x
        const y0 = from.y - 34
        const to = fitPoint(hexCenter(flight.to, layout), fit)
        const x1 = to.x
        const y1 = to.y - HEX_R * 0.14 + 12
        // The arc's peak sits above the midpoint; the trail is a quadratic through that same peak.
        const xm = (x0 + x1) / 2
        // Kept inside the viewBox (top at -238) so the peak of the arc is never clipped.
        const ym = Math.max(Math.min(y0, y1) - 46, -200)
        const cx = 2 * xm - (x0 + x1) / 2
        const cy = 2 * ym - (y0 + y1) / 2
        const vars = {
          ['--x0' as string]: `${x0}px`,
          ['--y0' as string]: `${y0}px`,
          ['--xm' as string]: `${xm}px`,
          ['--ym' as string]: `${ym}px`,
          ['--x1' as string]: `${x1}px`,
          ['--y1' as string]: `${y1}px`,
          ['--delay' as string]: `${i * 260}ms`,
        }
        return (
          <g key={`${view.step}-${i}`} className={`flight flight-${flight.faction}`} data-flight={flight.piece} data-to={flight.to}>
            <path className="flight-trail" d={`M ${x0},${y0} Q ${cx},${cy} ${x1},${y1}`} style={vars} />
            <circle className="flight-land" cx={x1} cy={y1} r={16} style={vars} />
            <g className="flight-piece" style={vars}>
              <g transform="translate(-6, -7)">
                <FlightIcon piece={flight.piece} />
              </g>
            </g>
          </g>
        )
      })}
    </g>
  )
}

// Sizes each region's plaque to its name as actually set (attributes only: CSP allows no style attributes).
function fitPlaques(svg: SVGSVGElement) {
  for (const sign of Array.from(svg.querySelectorAll('.region-sign'))) {
    const text = sign.querySelector<SVGTextElement>('.region-name')
    const plate = sign.querySelector<SVGRectElement>('.region-plaque')
    if (!text || !plate) continue
    let w = 0
    try {
      w = text.getComputedTextLength()
    } catch {
      continue
    }
    if (!w) continue
    const cx = Number(text.getAttribute('x'))
    plate.setAttribute('x', String(cx - w / 2 - 8))
    plate.setAttribute('width', String(w + 16))
  }
}

function matchesSlot(state: GameState, region: RegionId, slot: 'squeeze' | 'expand'): boolean {
  return regionMatchesPressureSlot(state, region, slot)
}

/**
 * Plan item 55: Hollowell's props on a landmark, in its own 24-unit box so they stand where it does: a glossy
 * billboard (stage 1+), a delivery van (stage 2+), boards across the landmark under a SOLD sign (stage 3), and a
 * small warning pennant when the next Squeeze would take ground. Each reads by shape, so greyscale tells them apart.
 */
function GripProps({ stage, edge }: { stage: GripStage; edge: boolean }) {
  const ink = { stroke: 'var(--ink)', strokeWidth: 0.9, strokeLinejoin: 'round' as const }
  return (
    <g className="grip-props">
      {stage >= 1 && (
        <g className="grip-billboard" data-grip-prop="billboard" {...ink}>
          <path d="M7 -3 V-6 M12 -3 V-6" />
          <rect x={4.5} y={-12.5} width={9} height={6.5} rx={0.8} fill="var(--hollowell)" />
          <path d="M5.5 -10.5 H12.5" stroke="var(--paper)" strokeWidth={1.2} />
          <path d="M5.5 -8 H10" stroke="var(--paper)" strokeWidth={0.8} />
          {/* Plan item 267: glossy plastic (VISION: the corporations are glossy, the players' land hand-made). */}
          <path className="grip-gloss" d="M5.4 -12 L8.4 -12 L5.4 -9 Z" fill="var(--paper-hi, var(--paper))" stroke="none" opacity={0.55} />
        </g>
      )}
      {stage >= 2 && (
        <g className="grip-van" data-grip-prop="van" {...ink}>
          <path d="M-12.5 11 V5 H-5 L-3 8 V11 Z" fill="var(--paper-hi, var(--paper))" />
          <path d="M-12.5 7.5 H-5" stroke="var(--hollowell)" strokeWidth={1.4} />
          <path className="grip-gloss" d="M-11.8 5.7 H-6.2" stroke="var(--paper-hi, var(--paper))" strokeWidth={0.7} strokeLinecap="round" opacity={0.8} />
          <circle cx={-10} cy={11.4} r={1.6} fill="var(--ink)" />
          <circle cx={-5.4} cy={11.4} r={1.6} fill="var(--ink)" />
        </g>
      )}
      {stage >= 3 && (
        <g className="grip-sold" data-grip-prop="sold" {...ink}>
          <path d="M-9 -6 L9 6 M-9 6 L9 -6" stroke="var(--soil)" strokeWidth={3} strokeLinecap="round" />
          <path d="M-9 -6 L9 6 M-9 6 L9 -6" stroke="var(--ink)" strokeWidth={0.6} />
          <rect x={-7} y={-3} width={14} height={6} rx={1} fill="var(--hollowell)" />
          <text x={0} y={1.6} textAnchor="middle" fontSize={4.6} fontWeight={800} fill="var(--paper)" stroke="none">
            SOLD
          </text>
        </g>
      )}
      {edge && (
        <g className="grip-edge" data-grip-prop="edge" {...ink}>
          <path d="M-12 -2 V-13" />
          <path d="M-12 -13 L-5 -11 L-12 -8.6 Z" fill="var(--clay-deep)" />
        </g>
      )}
    </g>
  )
}
