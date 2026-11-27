import AbilityMoment from './AbilityMoment'
import { ABILITY_MOMENT_MS, abilityUsed, type AbilityMomentView } from './abilityUsed'
import { Landmark } from './Landmark'
import { playCues } from '../platform/sound'
import { atTheEdge, gripStage, regionControl, squeezedLastTurn, type GripStage } from './grip'
import { COUNT_FROM, ENEMY_Y, outletStage, type OutletStage, PRODUCER_H, PRODUCER_W, PRODUCER_Y, STACK_H, STACK_W, pieceLayout, type PieceRect } from './pieceLayout'
import { BOARD_LANDMARKS, boxAt, DRESSING_BOX, dressingSpot, LANDMARK_ART_H, landmarkMinScale, pickSpot, scaled } from './landmarkSpot'
import { regionGround } from './regionGround'
import RegionGroundArt from './RegionGroundArt'
import RegionFolk from './RegionFolk'
import { folkScale, regionFolk } from './regionFolk'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactElement } from 'react'
import { REGIONS, SHORT_NAMES, regionMatchesPressureSlot, regionType } from '../content/map'
import { LAYOUTS, placedLayout, type Layout } from '../content/layouts'
import { loadSettings } from '../platform/settings'
import { resolveRules } from '../engine/rules'
import Portrait from './portraits/Portrait'
import PiecePeek from './PiecePeek'
import { doubtLabel } from './doubtPeek'
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

// eslint-disable-next-line react-refresh/only-export-components -- shared with the title's beat (plan item 503)
export function hexCenter(id: RegionId, layout: Layout = LAYOUTS.ring): { x: number; y: number } {
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
  /** Plan item 671: the region plates wear their short names (`SHORT_NAMES`), for a small board. */
  shortNames?: boolean
  /** Plan item 141: the action being looked at, as a ghost piece on each region it could play into. */
  ghost?: { regions: RegionId[]; sign: '+' | '-' }
  /** Plan item 402: the region Cath's suggestion plays into: a chalk ring with her green stake (`lit` when the
   *  suggested card is under the pointer or focus). */
  pick?: { region: RegionId; lit: boolean }
  /** Plan item 451: the region a dragged (or armed) card is over, with what playing it there will do: a ghost
   *  piece on the hex and signed chips above it, from the engine's own preview (`actionPreview`). */
  aim?: { region: RegionId; chips: { text: string; sign: '+' | '-' | '!' }[]; going?: ('o' | 'b' | 'd')[] }
  /** Plan item 451: a card just played into this region lands with a stamp and a puff of paper dust (`key` replays it). */
  stamp?: { region: RegionId; key: number }
  /** Plan item 614: the end screen's play of the game: the region gets a gold rim and a pinned tag, the rest stays lit. */
  featured?: { region: RegionId; round: number }
  /** Plan item 507: the Setup's opening board plays a producer's power over their home region before they're picked. */
  showcase?: AbilityMomentView[]
  /** Plan item 654: the game's own board, where a Doubt opens its one-line card on tap, hover or focus. */
  peekPieces?: boolean
  /** Plan item 451: a card is being aimed (pressed, dragged or armed): the hexes it can't go to darken, not fade. */
  aiming?: boolean
  /** Plan item 451: the pointer entered (a region id) or left (null) a hex it could pick, so an armed card shows
   *  what it will do there before the click. */
  onHoverRegion?: (region: RegionId | null) => void
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
        <rect width={46} height={46} fill="#e9c36a" opacity={0.12} />
        {/* Plan item 525: the drought's cracks a dry brown, not a grey ink crackle over the land */}
        <path d="M2 10l9 4 4 10 10 3 6 9M15 24l-6 9M25 27l8-6 9 2M31 36l-2 9" fill="none" stroke="var(--clay-deep)" strokeWidth={1.3} opacity={0.38} strokeLinecap="round" />
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
          a deep base, against the players' flat ink and paper. Stop colours live in table.css (the CSP allows no inline
          style attribute). */}
      <linearGradient id="hollowell-gloss" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" className="gloss-hollowell-top" />
        <stop offset="0.45" className="gloss-hollowell-mid" />
        <stop offset="1" className="gloss-hollowell-base" />
      </linearGradient>
      <linearGradient id="candor-gloss" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" className="gloss-candor-top" />
        <stop offset="0.5" className="gloss-candor-mid" />
        <stop offset="1" className="gloss-candor-base" />
      </linearGradient>
      <linearGradient id="tile-light" x1="0.15" y1="0" x2="0.75" y2="1">
        <stop offset="0" stopColor="white" stopOpacity={0.18} />
        <stop offset="0.42" stopColor="white" stopOpacity={0} />
        <stop offset="0.62" stopColor="black" stopOpacity={0} />
        <stop offset="1" stopColor="black" stopOpacity={0.16} />
      </linearGradient>
      {/* Plan item 525: Hollowell's hold is shrink-wrap laid over warm land, not a grey sheet under it: a clear film
          that catches the light in one long streak, and an over-lit cold spot where his pieces stand. Stop colours are
          tokens (table.css: the CSP allows no inline style). */}
      <linearGradient id="wrap-film" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" className="wrap-film-hi" />
        <stop offset="0.38" className="wrap-film-clear" />
        <stop offset="0.62" className="wrap-film-clear" />
        <stop offset="1" className="wrap-film-lo" />
      </linearGradient>
      <linearGradient id="wrap-streak" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0" className="wrap-streak-0" />
        <stop offset="0.5" className="wrap-streak-1" />
        <stop offset="1" className="wrap-streak-0" />
      </linearGradient>
      {/* Plan item 733: a colonised region's cold fluorescent wash, strongest under the strip lights at the top */}
      <linearGradient id="corp-wash" x1="0.3" y1="0" x2="0.6" y2="1">
        <stop offset="0" className="corp-wash-top" />
        <stop offset="0.55" className="corp-wash-mid" />
        <stop offset="1" className="corp-wash-base" />
      </linearGradient>
      <radialGradient id="wrap-spot" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" className="wrap-spot-in" />
        <stop offset="1" className="wrap-spot-out" />
      </radialGradient>
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

/** Gate 7 (2026-11-26): one portrait per producer and face on the board, framed as a stall's window shows it
 *  (ProducerMini's old nested svg), for the stalls' <use>s. */
function portraitSymbolId(uid: string, pid: ProducerId, face: ProducerFace | undefined): string {
  return `${uid}-pp-${pid}-${face ?? 'neutral'}`
}
function PortraitSymbols({ uid, keys }: { uid: string; keys: Array<[ProducerId, ProducerFace | undefined]> }) {
  if (keys.length === 0) return null
  return (
    <defs>
      {keys.map(([pid, face]) => (
        // An <svg> in <defs> (a <use> sets its width and height), not a <symbol>: the portrait's gradients then sit in
        // a defs subtree, which every engine renders paint servers from.
        <svg key={`${pid}-${face ?? 'neutral'}`} id={portraitSymbolId(uid, pid, face)} viewBox="14 12 72 90" aria-hidden="true">
          <Portrait character={pid} size={100} expression={face === 'neutral' ? undefined : face} />
        </svg>
      ))}
    </defs>
  )
}

// STYLE.md 6's exact game pieces, drawn as small self-contained SVG groups so `Map` can place one per
// slot in the enemy-piece row / Stall row without repeating their geometry inline.

/**
 * Plan item 525: Hollowell's shrink-wrap over a hex: a clear film (a whisper of tint), one long specular streak across
 * the face and a short second one, creases where it is pulled round the corners, and, when tight, a bright taut
 * edge. It reads in greyscale by its highlights, not by greying the land under it.
 */
function ShrinkWrap({ x, y, tight }: { x: number; y: number; tight: boolean }) {
  const R = HEX_R
  const k = tight ? 1 : 0.55
  return (
    <>
      <polygon className="wrap-film" points={hexPoints(x, y, R * GAP_SCALE * 0.97)} fill="url(#wrap-film)" opacity={tight ? 1 : 0.5} />
      <path
        className="wrap-streak"
        d={`M ${x - R * 0.8},${y + R * 0.1} L ${x - R * 0.06},${y - R * 0.8} L ${x + R * 0.06},${y - R * 0.76} L ${x - R * 0.72},${y + R * 0.22} Z`}
        fill="url(#wrap-streak)"
        opacity={k}
      />
      {/* the streak's hard leading edge: the line that says 'plastic' at a glance, in colour or greyscale */}
      <path className="wrap-glint" d={`M ${x - R * 0.8},${y + R * 0.1} L ${x - R * 0.06},${y - R * 0.8}`} stroke="var(--wrap-shine)" strokeWidth={1.8} strokeLinecap="round" opacity={0.85 * k} />
      <path className="wrap-glint" d={`M ${x + R * 0.28},${y + R * 0.66} L ${x + R * 0.7},${y + R * 0.2}`} stroke="var(--wrap-shine)" strokeWidth={2.2} strokeLinecap="round" opacity={0.75 * k} />
      <path
        className="wrap-crease"
        d={`M ${x - R * 0.86},${y - R * 0.04} l ${R * 0.12},${R * 0.05} M ${x + R * 0.42},${y - R * 0.76} l ${R * 0.06},${R * 0.12} M ${x + R * 0.84},${y + R * 0.1} l ${-R * 0.13},${R * 0.03} M ${x - R * 0.4},${y + R * 0.78} l ${R * 0.04},${-R * 0.12}`}
        stroke="var(--wrap-shine)"
        strokeWidth={1.4}
        strokeLinecap="round"
        fill="none"
        opacity={0.65 * k}
      />
      {tight && <polygon className="wrap-edge" points={hexPoints(x, y, R * GAP_SCALE * 0.94)} fill="none" stroke="var(--wrap-shine)" strokeWidth={1.8} strokeLinejoin="round" opacity={0.7} />}
    </>
  )
}

// Plan item 425: Hollowell's pieces are glossy miniatures standing on the land, not stickers: each is a little
// moulded object (the Outlet a storefront, the Buyout a hoarding on legs, Doubt a speech bubble on a stake) with
// one specular highlight, a moulded side in the faction's deep tone and no ink outline. Each keeps item 172's
// outline (sawtooth roof, peaked board, round bubble), so the board still reads in greyscale. The art stays inside
// 0..12.5 x 0..13.5 so the legend's and close-up's fixed viewBoxes still hold it.

// Outlet: a sawtooth-roofed chain storefront: an H on its fascia, a striped awning, a dark plate-glass window and
// door. Item 139's wordless price tag hangs off the awning's corner when there is room (`ornament`).
const OUTLET_ROOF = '0.4,4.4 0.4,2.6 3.1,0.6 3.1,2.6 5.9,0.6 5.9,2.6 8.7,0.6 8.7,2.6 11.6,2.6 11.6,4.4'
// Plan item 645: one glossy shape per stage, so a board of Outlets isn't one icon nine times: a region's lone Outlet is
// a pop-up kiosk (a serving hatch on a chrome ledge), two make the storefront, three or more a superstore (full-width
// sliding glass under a lit roundel, skylights in the roof's teeth). The roof's sawtooth (item 172's outline) stays.
export function Outlet({ ornament = true, stage = 2 }: { ornament?: boolean; stage?: OutletStage }) {
  return (
    <g className="enemy-piece enemy-outlet" data-stage={stage}>
      {/* the moulded side, a deep step under the face (no ink line: plan item 413) */}
      <g transform="translate(0.8 0.9)" className="corp-shadow" fill="var(--hollowell-ink)">
        <polygon points={OUTLET_ROOF} />
        <rect x={0.6} y={4} width={10.8} height={8} />
      </g>
      {/* Plan item 733: the moulding's deep edge runs all round the silhouette, so the orange face (about 1.5:1 on the
          light land) stands off its region at 5:1+; in the faction's deep tone, not an ink line (item 413). */}
      <g className="corp-rim" fill="var(--hollowell-ink)" stroke="var(--hollowell-ink)" strokeWidth={1.3} strokeLinejoin="round">
        <polygon points={OUTLET_ROOF} />
        <rect x={0.6} y={4} width={10.8} height={8} />
      </g>
      <polygon points={OUTLET_ROOF} className="corp-face" fill="url(#hollowell-gloss)" />
      {/* the shop's body and its fascia with the H; plan item 525: a chrome rim round the moulding */}
      <rect x={0.6} y={4} width={10.8} height={8} fill="url(#hollowell-gloss)" />
      {/* Plan item 733: a cold specular band raked across the moulded front, the over-lit plastic of a showroom */}
      <polygon className="corp-band" points="0.6,9.6 6.2,4 8.4,4 0.6,11.8" fill="var(--wrap-shine)" opacity={0.2} />
      <rect className="corp-chrome-rim" x={0.6} y={4} width={10.8} height={8} fill="none" stroke="var(--corp-chrome)" strokeWidth={0.45} />
      <rect x={0.6} y={4} width={10.8} height={2.1} fill="var(--hollowell-ink)" />
      {stage === 3 && <circle cx={6} cy={5.05} r={1.15} fill="var(--corp-acrylic)" />}
      <path d="M 5,4.5 v 1.2 M 7,4.5 v 1.2 M 5,5.1 h 2" stroke={stage === 3 ? 'var(--hollowell)' : 'var(--corp-acrylic)'} strokeWidth={0.55} strokeLinecap="round" fill="none" transform={stage === 3 ? 'translate(6 5.1) scale(0.75) translate(-6 -5.1)' : undefined} />
      {/* the striped awning, scalloped along its lip */}
      <polygon points="0,6.1 12,6.1 12.4,7.8 -0.4,7.8" fill="var(--corp-acrylic)" />
      {[0, 2, 4].map((i) => (
        <polygon key={i} points={`${i * 2.4},6.1 ${(i + 1) * 2.4},6.1 ${(i + 1) * 2.56 - 0.4},7.8 ${i * 2.56 - 0.4},7.8`} fill="var(--hollowell)" />
      ))}
      <path d="M -0.4,7.8 q 1.07,1 2.13,0 q 1.07,1 2.13,0 q 1.07,1 2.13,0 q 1.07,1 2.13,0 q 1.07,1 2.13,0 q 1.07,1 2.13,0" fill="var(--hollowell-ink)" opacity={0.55} />
      {stage === 1 ? (
        <g className="outlet-kiosk">
          {/* the pop-up's serving hatch on a chrome ledge */}
          <rect x={1.6} y={8.5} width={8.8} height={2.3} rx={0.3} fill="var(--corp-slate)" />
          <rect x={1.1} y={10.7} width={9.8} height={0.8} rx={0.3} fill="var(--corp-chrome)" />
          <path className="corp-specular" d="M 2.6,10.2 L 4,8.9" stroke="white" strokeWidth={0.7} strokeLinecap="round" opacity={0.7} />
        </g>
      ) : stage === 2 ? (
        <g className="outlet-store">
          {/* plate-glass window and door, one highlight across the glass */}
          <rect x={1.5} y={8.6} width={5.4} height={3.4} rx={0.3} fill="var(--corp-slate)" />
          <rect x={7.7} y={8.6} width={2.8} height={3.4} rx={0.3} fill="var(--corp-slate)" />
          <path className="corp-specular" d="M 2.4,11.4 L 4.4,9.1" stroke="white" strokeWidth={0.7} strokeLinecap="round" opacity={0.7} />
        </g>
      ) : (
        <g className="outlet-superstore">
          {/* full-width sliding glass in three panes, skylights in the roof's teeth */}
          <rect x={1.1} y={8.5} width={9.8} height={3.5} rx={0.3} fill="var(--corp-slate)" />
          <path d="M 4.4,8.5 V 12 M 7.6,8.5 V 12" stroke="var(--corp-chrome)" strokeWidth={0.45} />
          <path className="corp-specular" d="M 1.9,11.5 L 3.6,9" stroke="white" strokeWidth={0.7} strokeLinecap="round" opacity={0.7} />
          <path d="M 5.4,11.5 L 6.8,9.4" stroke="white" strokeWidth={0.5} strokeLinecap="round" opacity={0.45} />
          {[3.1, 5.9, 8.7].map((x) => (
            <path key={x} d={`M ${x - 0.35},1.25 V 2.4`} stroke="var(--corp-acrylic)" strokeWidth={0.55} strokeLinecap="round" opacity={0.9} />
          ))}
        </g>
      )}
      <path d="M 1.2,3.7 L 2.9,2.4" stroke="white" strokeWidth={0.8} strokeLinecap="round" opacity={0.75} />
      {ornament && <g transform="translate(9.6,7.2) rotate(14)">
        <path d="M 0.6,0 v 0.9" stroke="var(--corp-chrome)" strokeWidth={0.35} />
        <rect x={-0.6} y={0.9} width={3} height={2.2} rx={0.5} fill="var(--corp-acrylic)" stroke="var(--corp-chrome)" strokeWidth={0.35} />
        {/* plan item 139: printed lines, not '.99' (the text drew at 7 px on a desktop board, under the 11 px floor) */}
        <path d="M 0,1.8 h 1.6 M 0,2.5 h 1" className="tag-print" stroke="var(--ink)" strokeWidth={0.4} strokeLinecap="round" />
      </g>}
    </g>
  )
}

// Buyout: a peaked hoarding on two chrome legs, Hollowell's H in its gable and a SOLD strip pasted across it.
export function Buyout({ ornament = true }: { ornament?: boolean }) {
  const board = '6,0.3 12,3.4 12,9 0,9 0,3.4'
  return (
    <g className="enemy-piece enemy-buyout">
      <path d="M 2.6,8.5 V 12.4 M 9.4,8.5 V 12.4" stroke="var(--corp-chrome)" strokeWidth={1.1} strokeLinecap="round" />
      <path d="M 2.6,10.6 H 9.4" stroke="var(--corp-chrome)" strokeWidth={0.5} />
      <polygon points={board} transform="translate(0.8 0.9)" className="corp-shadow" fill="var(--hollowell-ink)" />
      <polygon points={board} className="corp-rim" fill="var(--hollowell-ink)" stroke="var(--hollowell-ink)" strokeWidth={1.3} strokeLinejoin="round" />
      <polygon points={board} className="corp-face" fill="url(#hollowell-gloss)" />
      <polygon className="corp-band" points="0,6.8 5.4,1.2 7.6,1.2 0,9" fill="var(--wrap-shine)" opacity={0.2} />
      <circle cx={6} cy={3.3} r={1.45} fill="var(--corp-acrylic)" />
      <path d="M 5.35,2.6 v 1.4 M 6.65,2.6 v 1.4 M 5.35,3.3 h 1.3" stroke="var(--hollowell-ink)" strokeWidth={0.45} strokeLinecap="round" fill="none" />
      {ornament && <g transform="translate(1,5.6) rotate(-6)">
        <rect x={0} y={0} width={10} height={2.4} rx={0.3} fill="var(--corp-acrylic)" />
        {/* plan item 139: a lettered stroke, not 'SOLD' (about 6 px on screen); the sign's shape carries it */}
        <path d="M 2.2,1.2 h 5.6" className="tag-print" stroke="var(--hollowell)" strokeWidth={0.9} strokeLinecap="round" />
      </g>}
      <path className="corp-specular" d="M 1,8 V 4 L 4.6,2" fill="none" stroke="white" strokeWidth={0.8} strokeLinecap="round" opacity={0.75} />
    </g>
  )
}

// Doubt: Candor's speech bubble with its '?', standing on a stake driven into the land.
/**
 * Plan item 654: Candor's Doubt is what Candor actually spreads, a glossy "study" leaflet propped on a chrome easel:
 * a laminated sheet with a dog-eared corner, Candor's cyan masthead, a printed question mark for a headline and grey
 * fine print under it. Mostly paper, so it reads quieter than the producers' stalls; its outline (the dog-eared sheet,
 * `LEAFLET_OUTLINE`) is its own, apart from the Outlet's sawtooth and the Buyout's peak (item 172).
 */
export const LEAFLET_OUTLINE = '1.2,0.6 8.6,0.6 11,3 11,12.6 1.2,12.6'
export function Doubt() {
  return (
    <g className="enemy-piece enemy-doubt">
      {/* the easel's back leg and its foot */}
      <path d="M 8.2,5 L 10.9,12.9" stroke="var(--candor-ink)" strokeWidth={1.1} strokeLinecap="round" />
      <path d="M 8.2,5 L 10.9,12.9" stroke="var(--corp-chrome)" strokeWidth={0.45} strokeLinecap="round" opacity={0.8} />
      <g transform="rotate(-5 6 12.6)">
        <polygon className="corp-shadow" points={LEAFLET_OUTLINE} fill="var(--candor-ink)" transform="translate(0.6 0.6)" />
        <polygon className="doubt-sheet" points={LEAFLET_OUTLINE} />
        {/* the masthead: Candor's glossy cyan band, the dog-ear folded down over it */}
        <polygon className="corp-face" points="1.2,0.6 8.6,0.6 11,3 11,4.4 1.2,4.4" fill="url(#candor-gloss)" />
        <circle cx={3} cy={2.5} r={0.9} className="doubt-logo" />
        <path d="M 4.6,2.1 H 7.6 M 4.6,3.1 H 6.6" className="doubt-mast-print" strokeWidth={0.45} strokeLinecap="round" />
        <path d="M 8.6,0.6 L 8.6,3 L 11,3 Z" className="doubt-dogear" />
        {/* the headline, and the fine print under it */}
        <text x={4.7} y={10.4} textAnchor="middle" className="doubt-mark">
          ?
        </text>
        <path d="M 7.4,6.6 H 9.8 M 7.4,7.9 H 9.8 M 7.4,9.2 H 9.4 M 2.4,11.3 H 9.8" className="doubt-print" strokeWidth={0.4} strokeLinecap="round" />
        <path className="corp-specular" d="M 1.9,5.6 V 10.8" fill="none" stroke="white" strokeWidth={0.6} strokeLinecap="round" opacity={0.8} />
      </g>
    </g>
  )
}

// Plan item 413: Hollowell's pieces stand on a moulded acrylic plinth, cold and clinical, not the producers' turned
// wood: a hard drop shadow, a chrome side and a lit top with a specular line, no ink outline.
function CorpBase({ cx, y, w }: { cx: number; y: number; w: number }) {
  // Plan item 554: the plinth's lip 1.4 past the piece (was 2.6), so the moulding fills its slot and stands larger.
  const hw = w / 2 + 1.4
  return (
    <g className="corp-base" pointerEvents="none">
      {/* plan item 425: a soft contact shadow on the land, fainter at its edge (kept inside the plinth's old shadow
          footprint, so a slot's box doesn't grow into its neighbour's) */}
      <ellipse cx={cx + 0.4} cy={y + 2.5} rx={hw + 0.4} ry={1.9} className="corp-base-shadow corp-contact-soft" />
      <ellipse cx={cx + 0.6} cy={y + 2.2} rx={hw - 0.8} ry={1.2} className="corp-base-shadow" />
      <rect x={cx - hw} y={y - 1.4} width={hw * 2} height={3.8} rx={1.2} className="corp-base-side" />
      <rect x={cx - hw} y={y - 2.2} width={hw * 2} height={2.2} rx={1} className="corp-base-top" />
      <path d={`M ${cx - hw + 1.2} ${y - 1.7} h ${hw * 0.9}`} className="corp-base-shine" strokeWidth={0.5} strokeLinecap="round" />
    </g>
  )
}

// Plan item 63: a stack's count, a dark disc sized by the tray so its number never renders under 11 px.
function CountBadge({ cx, cy, r, n }: { cx: number; cy: number; r: number; n: number }) {
  const fs = r * 1.25
  // Plan item 550: only the producers' stalls carry a count disc now (Hollowell's is the region's status disc).
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
const SILHOUETTE = { outlets: 'sawtooth', buyouts: 'peak', doubt: 'leaflet' } as const

function EnemyStack({ kind, n, scale, ornaments, cy = ENEMY_Y }: { kind: 'outlets' | 'buyouts' | 'doubt'; n: number; scale: number; ornaments: boolean; cy?: number }) {
  // Plan item 554: the art spans 15.6 icon units across (-1.4 to 14.2: the plinth's lip and its contact shadow) and
  // 17.8 down (the piece on its plinth and shadow); item 413 dropped the copies the old 18 x 22.6 box kept room for,
  // so the piece fills the slot now, less 0.2 a side (slice 3; was 0.4) so neighbours keep their 3-unit gap.
  const k = Math.min((STACK_W * scale) / 16, (STACK_H * scale) / 18.6)
  const bottom = cy + (STACK_H * scale) / 2
  const icon = kind === 'outlets' ? <Outlet ornament={ornaments} stage={outletStage(n)} /> : kind === 'buyouts' ? <Buyout ornament={ornaments} /> : <Doubt />
  // Plan item 413: one piece a kind (item 172's pile of copies cluttered every hex); the count says how many.
  return (
    <g className={`enemy-stack enemy-stack-${kind}`}>
      <g transform={`translate(${(STACK_W * scale - 15.6 * k) / 2 + 1.4 * k}, ${bottom - 17.4 * k}) scale(${k})`}>
        <CorpBase cx={6} y={13.4} w={12} />
        {/* keyed by the count, so a piece landing on a stack drops in again */}
        <g key={n}>{icon}</g>
      </g>
      {/* Plan item 550: no count disc on the piece; the region's status disc on its banner counts Hollowell's pieces,
          and the stack names its own count for a hover or a screen reader. */}
      <title>{`${n} ${kind === 'outlets' ? (n === 1 ? 'Outlet' : 'Outlets') : kind === 'buyouts' ? (n === 1 ? 'Buyout' : 'Buyouts') : 'Doubt'}`}</title>
    </g>
  )
}

/**
 * Plan item 63: a producer's stalls as a standing painted miniature, matte against Hollowell's glossy plastic. x from
 * the slot's left, y in tile units round the tile centre. The colour-blind setting stamps their initial on the base.
 * Plan item 645: the miniature is the producer's own wooden market stall, not a portrait card: a cloth awning striped
 * in their colour on two turned posts, the producer standing behind a plank counter, a basket of wares on it, all on
 * their round base. It grows as their engine does: a second stall on the region stacks a crate on the counter, a
 * third a second crate (the `pile-copy` pieces), so a held region reads as a busy stall from across the table.
 */
export function ProducerMini({ pid, n, scale: s, countR, clip, showInitial, face, py = PRODUCER_Y, portrait }: { pid: ProducerId; n: number; scale: number; countR: number; clip: string; showInitial: boolean; face?: ProducerFace; py?: number; portrait?: string }) {
  const colour = `var(--p-${pid})`
  const w = PRODUCER_W * s
  const cx = w / 2
  // Plan item 554: 1.8 units under the slot's top (was 1), so the piece stays inside its slot.
  const top = py - PRODUCER_H * s * 0.6 + 1.8 * s
  const foot = py + PRODUCER_H * s * 0.4 - 4.2 * s
  const hw = 11.4 * s
  // The awning: a ridge under the slot's top, its lip 0.9 a scale past the posts, a scalloped valance under it.
  const lip = top + 6 * s
  const aw = hw + 0.9 * s
  const stripes = 5
  // The posts and the window between them, where the producer stands; the counter across the posts' feet.
  const post = 2.2 * s
  const counter = foot - 8.4 * s
  const winL = cx - hw + post
  const winW = 2 * (hw - post)
  const copies = Math.min(n, 3)
  const plank = 'var(--kraft)'
  return (
    <g className="producer-mini stall-pin" data-producer={pid} data-face={face ?? 'neutral'} data-stalls={copies}>
      {/* Plan item 554: the cast shadow kept inside its slot */}
      <ellipse cx={cx + 0.6 * s} cy={foot + 3 * s} rx={12.4 * s} ry={3.4 * s} className="token-shadow" />
      <ellipse cx={cx} cy={foot + 1.8 * s} rx={12 * s} ry={3.6 * s} fill={colour} stroke="var(--ink)" strokeWidth={0.8} />
      <ellipse cx={cx} cy={foot + 1.8 * s} rx={12 * s} ry={3.6 * s} fill="black" opacity={0.28} />
      <ellipse cx={cx} cy={foot} rx={12 * s} ry={3.6 * s} fill={colour} stroke="var(--ink)" strokeWidth={0.8} />
      <g className="stall-piece" key={n}>
        <clipPath id={clip}>
          <rect x={winL} y={lip - s} width={winW} height={counter - lip + s} />
        </clipPath>
        {/* the stall's back cloth, a shade of their colour, and the producer behind the counter */}
        <rect x={winL} y={lip - s} width={winW} height={counter - lip + s} fill="var(--paper)" />
        <rect x={winL} y={lip - s} width={winW} height={counter - lip + s} fill={colour} opacity={0.22} />
        <g clipPath={`url(#${clip})`}>
          {portrait ? (
            // Gate 7 (2026-11-26): the board draws each producer's face once (`PortraitSymbols`) and every stall
            // shows it through a <use>, not ~90 nodes of portrait per stall (half the title board's DOM).
            <use href={`#${portrait}`} x={winL - 0.6 * s} y={lip - 3.8 * s} width={winW + 1.2 * s} height={(winW + 1.2 * s) * 1.25} />
          ) : (
            <svg x={winL - 0.6 * s} y={lip - 3.8 * s} width={winW + 1.2 * s} height={(winW + 1.2 * s) * 1.25} viewBox="14 12 72 90" aria-hidden="true">
              <Portrait character={pid} size={100} expression={face === 'neutral' ? undefined : face} />
            </svg>
          )}
        </g>
        {/* two turned posts, kraft with a lit edge and a grain line */}
        {[cx - hw, cx + hw - post].map((x, i) => (
          <g key={i} className="stall-post">
            <rect x={x} y={lip - s} width={post} height={foot - lip + 0.4 * s} fill={plank} stroke="var(--ink)" strokeWidth={0.7} />
            <path d={`M ${x + post * (i ? 0.3 : 0.7)} ${lip + s} V ${foot - s}`} stroke="var(--kraft-lo)" strokeWidth={0.35 * s} strokeDasharray={`${4 * s} ${1.5 * s}`} />
          </g>
        ))}
        {/* the awning: stripes of their colour and paper, a darker valance scalloped along its lip */}
        <g className="stall-awning awning-stir">
          <polygon points={`${cx - hw + 1.2 * s},${top} ${cx + hw - 1.2 * s},${top} ${cx + aw},${lip} ${cx - aw},${lip}`} fill="var(--paper)" stroke="var(--ink)" strokeWidth={0.8} strokeLinejoin="round" />
          {Array.from({ length: stripes }, (_, i) =>
            i % 2 ? null : (
              <polygon
                key={i}
                points={`${cx - hw + 1.2 * s + ((2 * hw - 2.4 * s) * i) / stripes},${top} ${cx - hw + 1.2 * s + ((2 * hw - 2.4 * s) * (i + 1)) / stripes},${top} ${cx - aw + (2 * aw * (i + 1)) / stripes},${lip} ${cx - aw + (2 * aw * i) / stripes},${lip}`}
                fill={colour}
              />
            ),
          )}
          <path
            d={`M ${cx - aw} ${lip} ${Array.from({ length: stripes }, () => `q ${aw / stripes} ${2.4 * s} ${(2 * aw) / stripes} 0`).join(' ')} Z`}
            fill={colour}
            stroke="var(--ink)"
            strokeWidth={0.7}
            strokeLinejoin="round"
          />
          <path d={`M ${cx - aw} ${lip} ${Array.from({ length: stripes }, () => `q ${aw / stripes} ${2.4 * s} ${(2 * aw) / stripes} 0`).join(' ')}`} fill="none" stroke="black" strokeWidth={0.9 * s} opacity={0.18} />
          <polygon points={`${cx - hw + 1.2 * s},${top} ${cx + hw - 1.2 * s},${top} ${cx + aw},${lip} ${cx - aw},${lip}`} fill="none" stroke="var(--ink)" strokeWidth={0.8} strokeLinejoin="round" />
          <path d={`M ${cx - hw + 2 * s} ${top + 1 * s} L ${cx - hw + 0.4 * s} ${lip - 1 * s}`} stroke="white" strokeWidth={0.5 * s} strokeLinecap="round" opacity={0.5} />
        </g>
        {/* the plank counter: its top lit, its front a panel in their colour between two boards */}
        <rect className="stall-counter" x={cx - hw - 0.4 * s} y={counter} width={2 * hw + 0.8 * s} height={2.4 * s} rx={0.4 * s} fill={plank} stroke="var(--ink)" strokeWidth={0.8} />
        <path d={`M ${cx - hw + 0.4 * s} ${counter + 0.7 * s} h ${2 * hw - 0.8 * s}`} stroke="var(--paper-hi, #fffaf0)" strokeWidth={0.4 * s} opacity={0.6} />
        <rect x={cx - hw + post} y={counter + 2.4 * s} width={winW} height={foot - counter - 2.8 * s} fill={colour} stroke="var(--ink)" strokeWidth={0.6} />
        <path d={`M ${cx - hw + post} ${counter + 4.6 * s} h ${winW} M ${cx} ${counter + 2.4 * s} V ${foot - 0.4 * s}`} stroke="black" strokeWidth={0.4 * s} opacity={0.22} />
        {/* the wares: a basket of produce, then a crate for each further stall on the region */}
        <g className="stall-wares">
          <path d={`M ${cx - 3.6 * s} ${counter} q ${3.6 * s} ${-0.2 * s} ${7.2 * s} 0 l ${-0.8 * s} ${-2.6 * s} h ${-5.6 * s} Z`} fill="var(--kraft-lo)" stroke="var(--ink)" strokeWidth={0.6} />
          {[
            [-2.3, 'var(--clay)'],
            [0, 'var(--wheat)'],
            [2.3, 'var(--pasture)'],
          ].map(([dx, f], i) => (
            <circle key={i} cx={cx + (dx as number) * s} cy={counter - 3 * s} r={1.5 * s} fill={f as string} stroke="var(--ink)" strokeWidth={0.5} />
          ))}
        </g>
        {Array.from({ length: copies - 1 }).map((_, j) => {
          const x = j === 0 ? cx + hw - 7.2 * s : cx - hw + 1.4 * s
          const y = counter - 4.6 * s
          return (
            <g key={j} className="pile-copy">
              <rect x={x} y={y} width={5.8 * s} height={4.6 * s} fill={plank} stroke="var(--ink)" strokeWidth={0.7} />
              <path d={`M ${x} ${y + 1.6 * s} h ${5.8 * s} M ${x} ${y + 3.1 * s} h ${5.8 * s}`} stroke="var(--kraft-lo)" strokeWidth={0.45 * s} />
              {[1.4, 2.9, 4.4].map((dx, k) => (
                <circle key={k} cx={x + dx * s} cy={y - 0.4 * s} r={1.1 * s} fill={j === 0 ? 'var(--clay)' : 'var(--pasture)'} stroke="var(--ink)" strokeWidth={0.4} />
              ))}
            </g>
          )
        })}
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
/** Plan item 417: the boxes (tile units, round the hex centre) LiberatedLife's bunting and cottage take. */
const LIFE_RECTS: PieceRect[] = [
  { kind: 'badge', x0: -HEX_R * 0.58, y0: -HEX_R * 0.64, x1: HEX_R * 0.58, y1: -HEX_R * 0.6 + HEX_R * 0.14 + 12 },
  { kind: 'badge', x0: HEX_R * 0.42 - 14, y0: HEX_R * 0.12 - 34, x1: HEX_R * 0.42 + 14, y1: HEX_R * 0.12 + 11 },
]

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

export default function Map({ state, enemyTurn, highlight, threat, onSelect, onInspect, inspected, faces, underNames, shortNames, ghost, pick, aim, stamp, featured, aiming, onHoverRegion, showcase, peekPieces }: Props) {
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
  // Plan item 654: the Doubt piece whose one-line card is open (a tap pins it; hover and focus show it while there).
  const [peek, setPeek] = useState<{ region: RegionId; anchor: Element; pinned: boolean } | null>(null)
  const closePeek = useCallback(() => setPeek(null), [])
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
  // Gate 7 (2026-11-19): null until measured. The first pass (before paint) leaves out everything sized from it (the
  // trays, landmarks, ground marks and badges), so the board isn't built twice, once at a guess, before its first paint.
  const [hexPx, setHexPx] = useState<number | null>(null)
  useLayoutEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const measure = () => {
      const k = svg.getScreenCTM?.()?.a ?? 0
      // Unmeasurable (hidden, or no layout as in jsdom): the old 72 px guess until a resize brings a real size.
      if (!k) return setHexPx((v) => v ?? 72)
      setHexPx(Math.round(HEX_R * fit.k * k * 2) / 2)
    }
    measure()
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    ro?.observe(svg)
    return () => ro?.disconnect()
  }, [fit.k])
  // Plan item 667: on a phone a region opened up close draws the board in toward it (CSS `scale` from the region's
  // centre, 220 ms ease-out; a fade under reduced motion), so the tap reads as leaning over the table, not a popup.
  // The origin is worked from the svg's own (untransformed) box and the viewBox's 'meet' fit, so a second region
  // opened while zoomed still finds its centre.
  const zoomCenter = inspected && active.includes(inspected) ? hexCenter(inspected, layout) : null
  const zoomX = zoomCenter ? zoomCenter.x * fit.k + fit.tx : 0
  const zoomY = zoomCenter ? zoomCenter.y * fit.k + fit.ty : 0
  useLayoutEffect(() => {
    const svg = svgRef.current
    if (!svg || !zoomCenter) return
    const w = svg.clientWidth
    const h = svg.clientHeight
    const vw = SIZE * 2
    const vh = SIZE * 2 - 24
    const s = Math.min(w / vw, h / vh)
    if (!s) return
    const ox = (w - vw * s) / 2 + (zoomX + SIZE) * s
    const oy = (h - vh * s) / 2 + (zoomY + SIZE - 12) * s
    svg.style.setProperty('--zoom-x', `${Math.round(ox)}px`)
    svg.style.setProperty('--zoom-y', `${Math.round(oy)}px`)
    // The region slides to the middle of the band the close-up's sheet leaves open at the top (under a quarter of the
    // screen down), so it stays in view above the sheet. The box is read as the zoom's transition starts, still
    // unzoomed (the sheet's scrim covers the board, so a second region can't be opened before this one closes).
    const box = svg.getBoundingClientRect()
    svg.style.setProperty('--zoom-dx', `${Math.round(window.innerWidth / 2 - (box.left + ox))}px`)
    svg.style.setProperty('--zoom-dy', `${Math.round(window.innerHeight * 0.23 - (box.top + oy))}px`)
  }, [zoomCenter, zoomX, zoomY])
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    fitPlaques(svg)
    let live = true
    document.fonts?.ready.then(() => live && fitPlaques(svg)).catch(() => {})
    return () => {
      live = false
    }
    // hexPx: a measured board re-renders each status disc's size and estimated place, so it's fitted again.
  }, [active.length, hexPx, shortNames])

  // every producer with a stall on the board, in the face this moment gives them (a superset of the stalls drawn)
  const portraitKeys = (() => {
    const seen = new Set<ProducerId>()
    for (const id of active) for (const [pid, n] of Object.entries(state.regions[id].stalls)) if ((n ?? 0) > 0) seen.add(pid as ProducerId)
    return [...seen].sort().map((pid): [ProducerId, ProducerFace | undefined] => [pid, faces?.[pid]])
  })()
  const svgProps = {
    'data-zoom': zoomCenter ? inspected ?? undefined : undefined,
    'data-aiming': aiming ? '' : undefined,
    'data-round': state.round,
    'data-moment': moment,
    'data-event': marketEvent,
    viewBox: `${-SIZE} ${-SIZE + 12} ${SIZE * 2} ${SIZE * 2 - 24}`,
    className: 'map',
    role: onSelect || inspect || peekPieces ? 'group' : 'img',
    'aria-label': 'Map of Marrow',
  }
  // Gate 7 (2026-11-26): until the board is measured (the layout effect above, before the first paint) the svg is drawn
  // empty, at its CSS size, so the board is built once at its measured size rather than twice in the page's first task.
  if (hexPx === null) return <svg ref={svgRef} {...svgProps} />
  return (
    <svg ref={svgRef} {...svgProps}>
      <RegionTextureDefs />
      <PortraitSymbols uid={uid} keys={portraitKeys} />
      <g transform={fit.k === 1 && fit.tx === 0 && fit.ty === 0 ? undefined : `translate(${fit.tx} ${fit.ty}) scale(${fit.k})`}>
      {/* Plan item 413: the seven tiles sit on one die-cut board, a printed cardboard plate a little proud of them with
          its own thickness and shadow, so the board reads as one object on the cloth, not loose tiles. The edge layer
          is stroked and the face layer covers the inner strokes, so only the outline is inked. */}
      <g className="board-plate" pointerEvents="none" aria-hidden="true">
        <g className="board-plate-shadow" filter="url(#tile-shadow)">
          {active.map((id) => { const { x, y } = hexCenter(id, layout); return <polygon key={id} points={hexPoints(x + 6, y + TILE_DEPTH + 14, HEX_R * 1.07)} /> })}
        </g>
        <g className="board-plate-side">
          {active.map((id) => { const { x, y } = hexCenter(id, layout); return <polygon key={id} points={hexPoints(x, y + TILE_DEPTH + 5, HEX_R * 1.07)} strokeWidth={2.4} strokeLinejoin="round" /> })}
        </g>
        <g className="board-plate-side-fill">
          {active.map((id) => { const { x, y } = hexCenter(id, layout); return <polygon key={id} points={hexPoints(x, y + TILE_DEPTH + 5, HEX_R * 1.07)} /> })}
        </g>
        <g className="board-plate-edge">
          {active.map((id) => { const { x, y } = hexCenter(id, layout); return <polygon key={id} points={hexPoints(x, y + 2, HEX_R * 1.07)} strokeWidth={2.4} strokeLinejoin="round" /> })}
        </g>
        <g className="board-plate-face">
          {active.map((id) => { const { x, y } = hexCenter(id, layout); return <polygon key={id} points={hexPoints(x, y + 2, HEX_R * 1.07)} /> })}
        </g>
      </g>
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
        const control = regionControl(r)
        const dimmed = targeting && !highlighted.has(id)
        const glow = targeting && highlighted.has(id)
        // Plan item 63: the tile's piece tray (`pieceLayout`), sized to the hex as it renders on screen; the landmark
        // takes the first flank spot clear of its slots.
        const tray = hexPx === null ? null : pieceLayout(
          {
            outlets: r.outlets,
            buyouts: r.buyouts,
            doubt: r.doubt,
            producers: stalls.length,
            stallCounts: stalls.map(([, n]) => n),
            scheme: false,
            labelWidth: REGIONS[id].name.length * 8.6 + 16,
            // Plan item 554: no room kept for a threat badge: item 550 made the target the hex's lit rim (threat-edge),
            // so the badge box only cost a targeted hex's pieces their size.
            badge: false,
          },
          hexPx,
        )
        // The landmark's flank spot, which the dressing and the ground marks also keep clear of.
        const spot = tray ? pickSpot(tray.rects) : null
        // Plan item 144: the event's dressing keeps to the hex's foot, but steps aside (and down in size) when the
        // stalls, pushed down the tile by Hollowell's stacks, reach there; it never meets a piece or the landmark.
        const dress =
          tray && (marketEvent === 'glut' || marketEvent === 'festival')
            ? (() => {
                const taken = spot ? [...tray.rects, boxAt(spot, spot.scale)] : tray.rects
                return dressingSpot(marketEvent, taken, { x: 0, y: HEX_R * (marketEvent === 'glut' ? 0.8 : 0.72) })
              })()
            : null
        // Plan item 76: the region's own ground, where the pieces and the landmark leave the face clear; plan item 417:
        // a freed tile's stalls keep clear of LiberatedLife's cottage and bunting too.
        const ground = (() => {
          if (!tray) return []
          const taken = spot ? [...tray.rects, { kind: 'badge' as const, ...boxAt(spot, spot.scale) }] : tray.rects
          return regionGround(id, def.type, r.liberated ? [...taken, ...LIFE_RECTS] : taken, control)
        })()
        // Plan item 717: the region's shoppers, clear of the pieces, the landmark, the event's dressing and the stalls.
        const folk = (() => {
          if (!tray) return []
          const taken = [...tray.rects]
          if (spot) taken.push({ kind: 'badge', ...boxAt(spot, spot.scale) })
          if (dress && (marketEvent === 'glut' || marketEvent === 'festival')) taken.push({ kind: 'badge', ...scaled(DRESSING_BOX[marketEvent], dress, dress.scale) })
          if (r.liberated) taken.push(...LIFE_RECTS)
          return regionFolk(id, taken, ground, control, folkScale(hexPx ?? 90))
        })()
        return (
          <g
            key={id}
            data-region={id}
            data-enemy-pieces={r.outlets + r.buyouts + r.doubt + r.lostLand}
            className={`region-hex${dimmed ? ' dimmed' : ''}${glow ? ' glow' : ''}${inspected === id ? ' inspected' : ''}${onSelect ? ' region-hex-selectable' : ''}${fx[id] === 'lib' ? ' fx-liberate' : fx[id] === 'sq' || thud.has(id) ? ' fx-squeeze' : ''}`}
            onClick={onSelect ? () => onSelect(id) : inspect ? () => inspect(id) : undefined}
            onPointerEnter={onHoverRegion && onSelect && glow ? (e) => e.pointerType === 'mouse' && onHoverRegion(id) : undefined}
            onPointerLeave={onHoverRegion && onSelect ? () => onHoverRegion(null) : undefined}
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
            data-control={control}
            aria-label={def.name}
          >
            {/* Plan item 417: the land itself shows who holds it. Its ground layers (`land-layer`) the CSS greys toward
                tarmac when Hollowell has dug in, and warms when freed; a change cross-fades. */}
            <polygon
              className="land-layer"
              points={hexPoints(x, y, HEX_R * GAP_SCALE)}
              fill={REGION_FILL[def.type]}
              stroke="var(--ink)"
              strokeWidth={2}
            />
            <polygon className="land-layer" points={hexPoints(x, y, HEX_R * GAP_SCALE)} fill={`url(#${REGION_PATTERN_ID[def.type]})`} />
            <polygon className="tile-paint land-layer" points={hexPoints(x, y, HEX_R * GAP_SCALE)} fill="url(#tile-paint)" pointerEvents="none" />
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
              strokeOpacity={0.22}
              strokeWidth={2}
              pointerEvents="none"
            />
            <g className="land-layer" transform={`translate(${x}, ${y})`} pointerEvents="none">
              <GroundArt type={def.type} id={id} clip={`${uid}-ground-${id}`} />
            </g>
            {/* Plan item 76: the region's own ground, where the pieces and the landmark leave the face clear. */}
            <g transform={`translate(${x}, ${y})`}>
              <RegionGroundArt marks={ground.filter((m) => m.kind !== 'hsign')} />
            </g>
            <g transform={`translate(${x}, ${y})`} pointerEvents="none" className="terrain-art land-layer">
              <TerrainArt type={def.type} id={id} />
            </g>
            <g transform={`translate(${x}, ${y})`}>
              <RegionFolk folk={folk} control={control} seed={id.length} />
            </g>
            {/* Plan item 525: the land keeps its colour; Hollowell's hold sits on it as plastic. Held ground (dug in) is
                wrapped tight, with a cold spot pool over-lighting it; contested ground with his Outlets on it carries a
                looser film (below). */}
            {control === 'held' && (
              <g className="held-sheen shrink-wrap" data-control-sheen="held" data-wrap="tight" pointerEvents="none">
                <ShrinkWrap x={x} y={y} tight />
                <ellipse className="wrap-spot" cx={x + HEX_R * 0.18} cy={y - HEX_R * 0.12} rx={HEX_R * 0.42} ry={HEX_R * 0.3} fill="url(#wrap-spot)" />
              </g>
            )}
            {/* Plan item 417: Hollowell's signboard stands over its tarmac, in full gloss. */}
            {control === 'held' && (
              <g transform={`translate(${x}, ${y})`}>
                <RegionGroundArt marks={ground.filter((m) => m.kind === 'hsign')} />
              </g>
            )}
            {/* Plan item 55: Hollowell dug in (grip stage 2+) glazes the ground cold; a region the last enemy turn
                Squeezed wilts (greyed, the crops drooping) until the next. */}
            {/* Plan item 267: as a cold band just inside the hex's edge, not a wash over the whole of it, so held land
                keeps its colour (the wash left held hexes hazy beside a freed one). */}
            {gripStage(r) >= 2 && <polygon className="grip-glaze" data-grip-glaze={gripStage(r)} points={hexPoints(x, y, HEX_R * GAP_SCALE * 0.9)} fill="none" stroke="var(--wrap-edge)" strokeWidth={gripStage(r) >= 3 ? 2.6 : 1.8} strokeDasharray={gripStage(r) >= 3 ? undefined : '18 6'} strokeLinejoin="round" opacity={0.7} pointerEvents="none" />}
            {wilted.has(id) && !r.liberated && <polygon className="grip-wilt" data-wilt="true" points={hexPoints(x, y, HEX_R * GAP_SCALE * 0.97)} fill="var(--ink)" opacity={0.14} pointerEvents="none" />}
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
                {/* Plan item 413: the hatch and clay tint are a band eaten in from the tile's edge, not a sheet over the
                    whole face: the terrain art reads in the middle, the cracks still run across it. */}
                <path className="lostland-band" fillRule="evenodd" d={`M ${hexPoints(x, y, HEX_R * GAP_SCALE * 0.98)} Z M ${hexPoints(x, y, HEX_R * GAP_SCALE * 0.7)} Z`} fill="var(--clay)" opacity={0.22} />
                <path className="lostland-band" fillRule="evenodd" d={`M ${hexPoints(x, y, HEX_R * GAP_SCALE * 0.98)} Z M ${hexPoints(x, y, HEX_R * GAP_SCALE * 0.7)} Z`} fill="url(#texture-lostland)" />
                <path
                  d={`M ${x - HEX_R * 0.4},${y - HEX_R * 0.3} L ${x - HEX_R * 0.1},${y} L ${x - HEX_R * 0.3},${y + HEX_R * 0.35} M ${x - HEX_R * 0.1},${y} L ${x + HEX_R * 0.25},${y + HEX_R * 0.15}`}
                  fill="none"
                  stroke="var(--ink)"
                  strokeWidth={1.5}
                  opacity={0.4}
                />
              </g>
            )}

            {r.outlets > 0 && control !== 'held' && (
              <g className="plastic-film shrink-wrap" data-wrap="loose" pointerEvents="none" key={`film${r.outlets}`}>
                <ShrinkWrap x={x} y={y} tight={false} />
              </g>
            )}
            {/* Plan item 733: three or more Outlets light a region like a retail park at night: a cold fluorescent
                wash over the land and a lit cyan-white edge, so a colonised region reads at a glance across the table. */}
            {r.outlets >= 3 && !r.liberated && (
              <g className="corp-wash" data-corp-wash={r.outlets} pointerEvents="none">
                <polygon points={hexPoints(x, y, HEX_R * GAP_SCALE * 0.97)} fill="url(#corp-wash)" />
                <polygon className="corp-wash-edge" points={hexPoints(x, y, HEX_R * GAP_SCALE * 0.93)} fill="none" strokeWidth={2.2} strokeLinejoin="round" />
              </g>
            )}
            {/* Plan item 525: freed land peels its wrap off (600-900 ms; a fade under reduced motion). */}
            {fx[id] === 'lib' && (
              <g className="wrap-peel" data-peel="true" pointerEvents="none">
                <ShrinkWrap x={x} y={y} tight />
              </g>
            )}
            {/* Plan item 55: the region's own landmark (the mill, the light, the market cross...), from the campaign
                map's art, on the first flank of the tile its pieces leave clear. Plan item 341: over the plastic film, so a
                held region's landmark keeps its full ink. */}
            {(() => {
              if (!spot || hexPx === null) return null
              const grip = gripStage(r)
              const edge = atTheEdge(r)
              return (
                <g className="board-landmark" data-landmark={BOARD_LANDMARKS[id]} data-full={spot.scale >= landmarkMinScale(hexPx) - 1e-9 || undefined} data-target={Math.round(landmarkMinScale(hexPx) * LANDMARK_ART_H * (hexPx / HEX_R))} data-grip={grip} data-edge={edge || undefined} data-cx={x} data-cy={y} transform={`translate(${x + spot.x}, ${y + spot.y}) scale(${spot.scale})`} pointerEvents="none">
                  <Landmark kind={BOARD_LANDMARKS[id]} />
                  <GripProps stage={grip} edge={edge} />
                </g>
              )
            })()}
            <PressureRing
              x={x}
              y={y}
              ours={stalls.reduce((a, [, n]) => a + n, 0)}
              theirs={r.outlets + r.buyouts + r.doubt}
              atRisk={!r.liberated && r.outlets + 2 * r.buyouts > stalls.reduce((a, [, n]) => a + n, 0)}
              liberated={r.liberated}
            />
            {/* Plan item 550: Hollowell's next target is the hex's lit rim (clay for a Squeeze, Hollowell's orange for an Expand), not a
                tag over the art: the region's landmark stays the largest thing in the hex. Hollowell's orange, dashed like a
                planning line, so it reads apart from the hex's own wheat border. */}
            {tray && (squeezeTargets.includes(id) || expandTargets.includes(id)) && (() => {
              const squeeze = squeezeTargets.includes(id)
              const pts = hexPoints(x, y, HEX_R * GAP_SCALE * 0.985)
              const ink = squeeze ? 'var(--clay-deep)' : 'var(--hollowell)'
              return (
                <g className="threat-edge" data-threat={squeeze ? 'squeeze' : 'expand'} pointerEvents="none">
                  <title>{squeeze ? 'Hollowell squeezes here next' : 'Hollowell expands here next'}</title>
                  <polygon points={pts} fill="none" stroke={ink} strokeWidth={HEX_R * 0.2} strokeLinejoin="round" opacity={0.45} />
                  <polygon points={pts} fill="none" stroke={ink} strokeWidth={HEX_R * 0.07} strokeLinejoin="round" strokeDasharray={`${HEX_R * 0.32} ${HEX_R * 0.14}`} />
                </g>
              )
            })()}

            {/* Plan item 63: the tile's piece tray (`pieceLayout`), sized to the hex as it renders on screen: Hollowell's
                stacks in a row across the middle, the producers' miniatures along the bottom, the name plate and any
                threat badge kept clear. Each piece slides to its slot when the tray changes. */}
            {tray && (() => {
              const s = tray.scale
              const icons = { outlets: ['o', r.outlets], buyouts: ['b', r.buyouts], doubt: ['d', r.doubt] } as const
              return (
                <g className={`piece-tray${thud.has(id) ? ' tray-thud' : ''}`} data-scale={s.toFixed(2)} data-ornaments={tray.ornaments || undefined}>
                  {tray.rects.map((rect) => {
                    if (rect.kind === 'outlets' || rect.kind === 'buyouts' || rect.kind === 'doubt') {
                      const [k, n] = icons[rect.kind]
                      // Plan item 654: a Doubt names itself and opens its card on tap, hover or focus, except while
                      // the region is itself the control (a card being aimed), where a tap must pick the region.
                      const peekable = rect.kind === 'doubt' && Boolean(peekPieces) && !(onSelect && glow)
                      const peekId = `${uid}-peek-${id}`
                      const open = peekable && peek?.region === id
                      return (
                        <g
                          key={k}
                          {...(peekable
                            ? {
                                role: 'button',
                                tabIndex: 0,
                                'aria-label': doubtLabel(n, def.name),
                                'aria-expanded': open,
                                'aria-describedby': open ? peekId : undefined,
                                'data-peekable': '',
                                onClick: (e: React.MouseEvent<SVGGElement>) => {
                                  e.stopPropagation()
                                  const el = e.currentTarget
                                  setPeek((p) => (p?.region === id && p.pinned ? null : { region: id, anchor: el, pinned: true }))
                                },
                                onKeyDown: (e: React.KeyboardEvent<SVGGElement>) => {
                                  if (e.key !== 'Enter' && e.key !== ' ') return
                                  e.preventDefault()
                                  e.stopPropagation()
                                  const el = e.currentTarget
                                  setPeek((p) => (p?.region === id && p.pinned ? null : { region: id, anchor: el, pinned: true }))
                                },
                                onFocus: (e: React.FocusEvent<SVGGElement>) => {
                                  const el = e.currentTarget
                                  setPeek((p) => (p?.region === id ? p : { region: id, anchor: el, pinned: false }))
                                },
                                onBlur: () => setPeek((p) => (p?.region === id ? null : p)),
                                onPointerEnter: (e: React.PointerEvent<SVGGElement>) => {
                                  if (e.pointerType !== 'mouse') return
                                  const el = e.currentTarget
                                  setPeek((p) => (p?.region === id ? p : { region: id, anchor: el, pinned: false }))
                                },
                                onPointerLeave: (e: React.PointerEvent<SVGGElement>) => {
                                  if (e.pointerType === 'mouse') setPeek((p) => (p?.region === id && !p.pinned ? null : p))
                                },
                              }
                            : {})}
                          className="piece-slot"
                          transform={`translate(${x + rect.x0} ${y})`}
                          data-piece={k}
                          data-count={n}
                          data-silhouette={SILHOUETTE[rect.kind]}
                          // Plan item 554 slice 3: a cluster's back piece, standing behind the front row on purpose.
                          data-back={rect.back ? '' : undefined}
                          // Plan item 451: the stack a dragged card will take pieces from lifts and fades in time.
                          data-going={aim?.region === id && aim.going?.includes(k) ? '' : undefined}
                        >
                          <EnemyStack kind={rect.kind} n={n} scale={tray.enemyScale * (rect.kind === 'outlets' ? (tray.outletBoost ?? 1) : 1)} ornaments={tray.ornaments} cy={rect.cy ?? tray.enemyY} />
                          {open && peek && <PiecePeek anchor={peek.anchor} id={peekId} onClose={closePeek} />}
                        </g>
                      )
                    }
                    if (rect.kind === 'producer') {
                      const [pid, n] = stalls[rect.i ?? 0]!
                      return (
                        <g key={pid} className="piece-slot" transform={`translate(${x + rect.x0} ${y})`} data-piece="stall" data-count={n} data-silhouette="standee">
                          <ProducerMini pid={pid} n={n} scale={s} countR={tray.countR} clip={`${uid}-pin-${id}-${pid}`} showInitial={colourBlindPatterns} face={faces?.[pid]} py={tray.producerY} portrait={portraitSymbolId(uid, pid, faces?.[pid])} />
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
      {pick && active.includes(pick.region) && (() => {
        const { x, y } = hexCenter(pick.region, layout)
        return (
          <g className="cath-pick" data-cath-pick={pick.region} data-lit={pick.lit ? '' : undefined} pointerEvents="none" aria-hidden="true" transform={`translate(${x} ${y})`}>
            <circle className="cath-pick-ring" r={HEX_R * 0.7} />
            <g className="cath-pick-stake" transform={`translate(${HEX_R * 0.5} ${HEX_R * 0.42})`}>
              <path className="cath-pick-post" d="M0 0V-24" />
              <path className="cath-pick-leaf" d="M0-24C9-34 20-30 22-22C13-16 4-17 0-24Z" />
            </g>
          </g>
        )
      })()}
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
      {/* Plan item 614: under the region signs, so the rim and its rosette never cover a name. The play of the game
          wins a fair's prize rosette, hung on the region's foot point (slice 4: the paper tag in the face covered
          its producers): the narrow tip of the face holds no pieces, and it fits between the signs of the row below. */}
      {featured && active.includes(featured.region) && (() => {
        const { x, y } = hexCenter(featured.region, layout)
        const ty = HEX_R * 0.98
        const petals = Array.from({ length: 24 }, (_, i) => {
          const a = (i * Math.PI) / 12
          const r = i % 2 ? 19 : 23
          return `${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`
        }).join(' ')
        return (
          <g className="featured-region" data-featured={featured.region} pointerEvents="none" aria-hidden="true" transform={`translate(${x} ${y})`}>
            <polygon className="featured-rim" points={hexPoints(0, 0, HEX_R * GAP_SCALE * 0.97)} />
            <polygon className="featured-rim-hi" points={hexPoints(0, 0, HEX_R * GAP_SCALE * 0.97)} />
            <g className="featured-rosette" transform={`translate(0 ${ty}) rotate(-6)`}>
              <path className="featured-ribbon" d="M -9 8 L -17 44 L -10 39 L -5 46 L 1 10 Z" />
              <path className="featured-ribbon featured-ribbon-b" d="M 9 8 L 17 44 L 10 39 L 5 46 L -1 10 Z" />
              <polygon className="featured-petals" points={petals} />
              <circle className="featured-medal" r={15} />
              <text className="featured-medal-round" y={-6.5} fontSize={6.5} textAnchor="middle" dominantBaseline="central">ROUND</text>
              <text className="featured-medal-n" y={4.5} fontSize={featured.round > 9 ? 12 : 14} textAnchor="middle" dominantBaseline="central">
                {featured.round}
              </text>
            </g>
          </g>
        )
      })()}
      {active.map((id) => {
        const def = REGIONS[id]
        const plate = (shortNames && SHORT_NAMES[id]) || def.name
        const { x, y } = hexCenter(id, layout)
        return (
          <g key={`name-${id}`} className="region-sign" data-sign={id} pointerEvents="none">
            {/* AAA UI M4 fix: a sentence-case Fraunces plaque, sized to the set name once the face has
                loaded (see `fitPlaques`); the estimate below is only the first paint. */}
            <rect
              className="region-plaque"
              x={x - plate.length * 4.3 - 8}
              y={y - HEX_R * 0.62 - 15}
              width={plate.length * 8.6 + 16}
              height={21}
              rx={4}
              fill="var(--paper)"
              stroke="var(--ink)"
              strokeWidth={1.5}
            />
            <text x={x} data-x={x} y={y - HEX_R * 0.62} textAnchor="middle" className="region-name" data-full={plate} data-short={SHORT_NAMES[id] !== plate ? SHORT_NAMES[id] : undefined}>
              {plate}
            </text>
            {/* Plan item 550: one status per region on its banner's end: free (a leaf), or how many Hollowell pieces
                stand there, in Hollowell's colour once it holds the land. `fitPlaques` keeps it on the plaque's end. */}
            {(() => {
              const r = state.regions[id]
              const n = r.outlets + r.buyouts + r.doubt
              const control = regionControl(r)
              const label = `${def.name}: ${control === 'free' ? 'free' : control === 'held' ? 'held by Hollowell' : 'contested'}${control === 'free' ? '' : `, ${n} Hollowell ${n === 1 ? 'piece' : 'pieces'}`}`
              const cy = y - HEX_R * 0.62 - 4.5
              // Plan item 550: at least 28 px across on a desktop and about 23 on a phone, whatever the board's scale
              // (`fitPlaques` flips a disc to its plate's left end where the right would meet the next region's plate).
              const sr = Math.max(13, (11.5 * HEX_R) / Math.max(24, hexPx ?? 72))
              const k = sr / 11
              return (
                <g className="region-status" data-region-status={control} data-count={n} data-cy={cy} data-r={sr.toFixed(1)} role="img" aria-label={label} transform={`translate(${x + plate.length * 4.3 + Math.max(14, sr + 4)} ${cy})`}>
                  <title>{label}</title>
                  <circle r={sr} className="region-status-disc" />
                  <g transform={`scale(${k.toFixed(3)})`}>
                    {control === 'free' ? (
                      <path className="region-status-leaf" d="M-5 4C-5-3 0-7 6-7C6 0 2 5-5 4ZM-5 4L2-2" />
                    ) : (
                      <text y={4.6} textAnchor="middle" className="region-status-count">
                        {n}
                      </text>
                    )}
                  </g>
                </g>
              )
            })()}
          </g>
        )
      })}
      {ability && active.includes(ability.region) && (() => {
        const { x, y } = hexCenter(ability.region, layout)
        return <AbilityMoment key={ability.key} view={ability} x={x} y={y} r={HEX_R * GAP_SCALE} />
      })()}
      {showcase?.filter((m) => active.includes(m.region)).map((m) => {
        const { x, y } = hexCenter(m.region, layout)
        return (
          <g key={`${m.producer}-${m.key}`} className="ability-showcase" data-ability-preview={m.producer} data-played="">
            <AbilityMoment view={m} x={x} y={y} r={HEX_R * GAP_SCALE} />
          </g>
        )
      })}
      {aim && active.includes(aim.region) && (() => {
        const { x, y } = hexCenter(aim.region, layout)
        // Chips keep a readable 13 px on screen whatever the board's scale (units per screen pixel).
        const u = HEX_R / Math.max(24, hexPx ?? 72)
        const fs = 13 * u
        const h = 22 * u
        const gap = 4 * u
        const sign = aim.chips.find((c) => c.sign !== '!')?.sign ?? '+'
        const widths = aim.chips.map((c) => (c.text.length * 7.2 + 16) * u)
        // Two chips to a row, centred over the hex's upper half.
        const rows: number[][] = []
        aim.chips.forEach((_, i) => (i % 2 === 0 ? rows.push([i]) : rows[rows.length - 1]!.push(i)))
        // Over the hex's name plate (never on it), clear of the dragged card, which rides just above the pointer.
        const top = y - HEX_R * 0.62 - 15 - 6 * u - rows.length * (h + gap) + gap
        return (
          <g className="aim-layer" data-aim={aim.region} pointerEvents="none" aria-hidden="true">
            {/* The piece on the hex's lower half: the dragged card covers the upper one. */}
            <g className="ghost-piece aim-piece" data-sign={sign} transform={`translate(${x} ${y + HEX_R * 0.3})`}>
              <circle r={17} />
              <path d={sign === '+' ? 'M-7 0H7M0-7V7' : 'M-7 0H7'} />
            </g>
            {rows.map((row, ri) => {
              const total = row.reduce((t, i) => t + widths[i]!, 0) + gap * (row.length - 1)
              let cx = x - total / 2
              return row.map((i) => {
                const c = aim.chips[i]!
                const w = widths[i]!
                const left = cx
                cx += w + gap
                return (
                  <g key={c.text} className="aim-chip" data-sign={c.sign} transform={`translate(${left} ${top + ri * (h + gap)})`}>
                    <rect width={w} height={h} rx={h / 2} />
                    <text x={w / 2} y={h / 2} fontSize={fs} dominantBaseline="central" textAnchor="middle">
                      {c.text}
                    </text>
                  </g>
                )
              })
            })}
          </g>
        )
      })()}
      {stamp && active.includes(stamp.region) && (() => {
        const { x, y } = hexCenter(stamp.region, layout)
        return (
          <g key={stamp.key} className="play-stamp" data-stamp={stamp.region} pointerEvents="none" aria-hidden="true" transform={`translate(${x} ${y})`}>
            <polygon className="play-stamp-press" points={hexPoints(0, 0, HEX_R * GAP_SCALE * 0.96)} />
            {Array.from({ length: 10 }, (_, i) => {
              // Paper flecks puff out low and to the sides, as from a card slapped on a table.
              const a = Math.PI * (0.05 + (i / 9) * 0.9) + (i % 2 ? 0.12 : -0.12)
              const d = HEX_R * (0.55 + (i % 3) * 0.12)
              return (
                <rect
                  key={i}
                  className="play-dust"
                  x={-3}
                  y={-2}
                  width={i % 3 === 0 ? 7 : 5}
                  height={i % 2 ? 4 : 3}
                  rx={1}
                  transform={`translate(0 ${HEX_R * 0.25})`}
                  style={{ ['--dx' as string]: `${Math.cos(a) * d}px`, ['--dy' as string]: `${-Math.sin(a) * d * 0.45}px`, ['--rot' as string]: `${(i * 67) % 180 - 90}deg` }}
                />
              )
            })}
          </g>
        )
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

/** Plan item 714: the board-unit sizes `svg.map[data-compact='1'|'2'|'3'] .region-name` sets (global.css), largest first. */
const COMPACT_STEPS = [17.5, 16.5, 15.5]
/** A name's font size on screen in px (its rendered height over its line box), or in board units with `units`. */
function namePx(t: SVGTextElement, units = false): number {
  const u = parseFloat(getComputedStyle(t).fontSize) || 0
  if (units) return u
  const m = t.getScreenCTM?.()
  // the board's scale (a CSS transform on a parent shows in the box, not the CTM): a plate as drawn against its width
  const plate = t.closest('.region-sign')?.querySelector('.region-plaque')
  const pw = Number(plate?.getAttribute('width'))
  const box = plate?.getBoundingClientRect()
  const k = box && pw > 0 && box.width > 0 ? box.width / pw : m ? Math.hypot(m.a, m.b) : 0
  return u * k
}

// Sizes each region's plaque to its name as actually set (attributes only: CSP allows no style attributes).
/** Plan item 682: fits the plates, and where a row can't hold its full names with whole discs inside the board (a
 *  phone's middle row: Brindle Hills, Kingsmarket and Rivermead at 390 px, a disc at half size and Rivermead's under
 *  the frame), a name in the tight row gives way to its short one (`SHORT_NAMES`, as the phone title's), one at a time. */
function fitPlaques(svg: SVGSVGElement) {
  const names = Array.from(svg.querySelectorAll<SVGTextElement>('.region-name'))
  const setName = (t: SVGTextElement, v: string | null) => {
    // the React-owned text node keeps its identity (React compares props, never the DOM)
    if (v && t.firstChild && t.firstChild.nodeValue !== v) t.firstChild.nodeValue = v
  }
  for (const t of names) {
    setName(t, t.getAttribute('data-full'))
    t.removeAttribute('data-shortened')
  }
  svg.removeAttribute('data-compact')
  // Plan item 714: a row too tight for its full names first sets every plate a step smaller (`data-compact`, CSS),
  // as long as the names still read at 12 px or more on screen; only then does a name give way to its short one (the
  // phone game read 'Brindle' and 'Kings' while the cards said 'Brindle Hills').
  let compact = 0
  for (let tries = 0; tries < 4 + COMPACT_STEPS.length; tries++) {
    const tight = fitPlaquesOnce(svg)
    if (!tight) return
    const fullRow = names.some((t) => tight.includes(t.closest('.region-sign')!) && t.getAttribute('data-short') && !t.hasAttribute('data-shortened'))
    if (fullRow && compact >= 0 && compact < COMPACT_STEPS.length) {
      // px per board unit, from a name as set now: a step goes on only while the names still read at 12 px
      const units = namePx(names[0]!, true)
      const k = namePx(names[0]!) / (units || 1)
      const step = COMPACT_STEPS[compact]!
      if (step < units && k * step >= 12) {
        svg.setAttribute('data-compact', String(++compact))
        continue
      }
    }
    if (compact > 0) {
      // no step that still reads holds the full names: back to the full size, and short names from there
      svg.removeAttribute('data-compact')
      compact = -1
      continue
    }
    compact = -1
    const row = names.filter((t) => t.closest('.region-sign') && tight.includes(t.closest('.region-sign')!) && t.getAttribute('data-short') && !t.hasAttribute('data-shortened'))
    if (row.length === 0) return
    // the longest of its neighbours' names first, its own last: a short plate in the row's middle (Kings) pulls its
    // disc in over the pieces at the hex's centre
    const others = row.filter((t) => t.closest('.region-sign') !== tight[0])
    const pool = others.length > 0 ? others : row
    const widest = pool.reduce((a, t) => ((t.getAttribute('data-full') ?? '').length > (a.getAttribute('data-full') ?? '').length ? t : a))
    setName(widest, widest.getAttribute('data-short'))
    widest.setAttribute('data-shortened', '')
  }
}

/** Places the plates and discs once; returns the signs of a row too tight for them (a disc shrunk, or a sign pressed
 *  past the board's edge), or null when every sign fits. */
function fitPlaquesOnce(svg: SVGSVGElement): Element[] | null {
  let tight: Element[] | null = null
  const signs: Array<{ sign: Element; text: SVGTextElement; plate: SVGRectElement; status: SVGGElement | null; cx: number; w: number }> = []
  const plates: Array<{ x0: number; x1: number; y0: number; y1: number; sign: Element; disc: number }> = []
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
    // The hex's own centre (`data-x`): a sign slid aside below is placed afresh on every fit.
    const cx = Number(text.getAttribute('data-x') ?? text.getAttribute('x'))
    const y0 = Number(plate.getAttribute('y'))
    const status = sign.querySelector<SVGGElement>('.region-status')
    // Plan item 677: how far its status disc reaches past the plate's right end, where every disc rides by default
    // (Kingsmarket's disc flipped to its left end onto Brindle Hills' right-end disc at D: '2' over '5').
    const sr = status ? Number(status.getAttribute('data-r')) : 0
    const disc = status ? Math.max(0, Math.max(14, sr + 4) + sr - 8) : 0
    plates.push({ x0: cx - w / 2 - 8, x1: cx + w / 2 + 8, y0, y1: y0 + Number(plate.getAttribute('height')), sign, disc })
    signs.push({ sign, text, plate, status, cx, w })
  }
  // Plan item 602: 5 units (was 3): on a phone the middle row read as one run of plates, a disc 2 px off the next name
  const GAP = 5
  // The board's left edge in its own units (the svg's box, wider than the viewBox where the board is height-bound): a
  // disc moved to a plaque's left end must not leave the board, nor one on its right end.
  const screen = svg.getScreenCTM?.()
  // Plan item 677: px to board units from a plate as drawn, not the screen CTM, which misses a CSS transform on the
  // board (the title's leaning board read its right edge 37 units short, and Rivermead's disc shrank onto its left end).
  const ref = signs[0]?.plate
  const refBox = ref?.getBoundingClientRect()
  const refW = Number(ref?.getAttribute('width'))
  const ctm =
    ref && refBox && refBox.width > 0 && refW > 0
      ? { a: refBox.width / refW, e: refBox.left - Number(ref.getAttribute('x')) * (refBox.width / refW) }
      : screen
  // Plan item 622: where the svg draws past its own box (the phone Setup's board, `overflow: visible` on a stage wider
  // than the height-bound board), its parent's box is the edge: Brindle Hills' disc had shrunk to half size against
  // a board edge 37 px inside the stage.
  const host = getComputedStyle(svg).overflow === 'visible' && svg.parentElement ? svg.parentElement : svg
  const box0 = host.getBoundingClientRect()
  // Plan item 682: a frame narrower than the svg (the phone game's board, drawn edge to edge inside an 8 px rim) bounds
  // the signs too: Rivermead's disc stood under the rim.
  const pb = host === svg ? svg.parentElement?.getBoundingClientRect() : undefined
  const box = pb && pb.width > 0 && pb.width < box0.width ? { left: Math.max(box0.left, pb.left), right: Math.min(box0.right, pb.right), width: Math.min(box0.right, pb.right) - Math.max(box0.left, pb.left) } : box0
  const edge0 = ctm && ctm.a > 0 && box.width > 0 ? (box.left - ctm.e) / ctm.a : -Infinity
  // Plan item 667: the phone board runs the screen's full width, so its right edge bounds a sign as the left does
  // (a Delta sign ran 3 px off the screen).
  const edge1 = ctm && ctm.a > 0 && box.width > 0 ? (box.right - ctm.e) / ctm.a : Infinity
  // Plan item 578: the disc's rim stands 4 units clear of the name's last letter (it met the 'r' of Highmoor at D).
  const DISC_CLEAR = 4
  const rowOf = (sign: Element, y0: number, y1: number) => plates.filter((p) => p.sign !== sign && p.y0 < y1 && y0 < p.y1)
  // Plan item 550: the status disc rides the plaque's right end, or its left end where the right would meet the next
  // region's plate (a phone's middle row: Brindle Hills beside Kingsmarket). Where both ends would (Kingsmarket between
  // Brindle Hills and Rivermead on a 375 px phone), the sign slides within the gap its neighbours leave, and the disc
  // shrinks only if even that is too narrow.
  for (const g of signs) {
    if (!g.status) continue
    const r = Number(g.status.getAttribute('data-r'))
    const cy = Number(g.status.getAttribute('data-cy'))
    const own = plates.find((p) => p.sign === g.sign)!
    const row = rowOf(g.sign, Math.min(own.y0, cy - r), Math.max(own.y1, cy + r))
    // Item 578's wider clearance put Brindle Hills' left-end disc past the board's edge on a phone: the board's own
    // box bounds the row as its neighbours do.
    const lo = Math.max(edge0, ...row.filter((p) => p.x1 <= g.cx).map((p) => p.x1 + p.disc)) + GAP
    const hi = Math.min(edge1, ...row.filter((p) => p.x0 >= g.cx).map((p) => p.x0)) - GAP
    let clear = DISC_CLEAR
    const reach = (rr: number) => g.w / 2 + Math.max(14, rr + clear) + rr
    if (g.cx + reach(r) <= hi) continue
    // Plan item 607: every other disc rides its plaque's right end, so where the right end would meet the next plate
    // the sign first slides away from it (as far as the board's edge allows) and keeps its disc on the right; it flips
    // to the left end only where sliding can't make room (Brindle Hills sat apart from every other badge on a phone).
    const slide = hi - (g.cx + reach(r))
    if (g.cx - g.w / 2 - 8 + slide >= lo) {
      g.cx += slide
      own.x0 += slide
      own.x1 += slide
      g.status.setAttribute('data-fit-r', String(r))
      g.status.setAttribute('data-fit-side', 'right')
      g.status.setAttribute('data-fit-clear', String(clear))
      continue
    }
    if (g.cx - reach(r) >= lo) continue
    // where the row is tight (a phone's middle row) the clearance gives way before the disc shrinks
    clear = 1
    // the sign's span with the disc on its right [cx - w/2 - 8, cx + reach], or on its left [cx - reach, cx + w/2 + 8]
    const span = (rr: number) => reach(rr) + g.w / 2 + 8
    let rr = r
    while (rr > 8 && span(rr) > hi - lo) rr -= 0.5
    if (rr < r * 0.9 || span(rr) > hi - lo + 0.01) tight = [g.sign, ...row.map((p) => p.sign)]
    const shift = (a: number, b: number) => Math.max(lo - a, Math.min(0, hi - b))
    const dxR = shift(g.cx - g.w / 2 - 8, g.cx + reach(rr))
    const dxL = shift(g.cx - reach(rr), g.cx + g.w / 2 + 8)
    // (item 607: the right end whenever the row holds it there, as every other disc; the left only as a last resort)
    const fitsR = g.cx - g.w / 2 - 8 + dxR >= lo - 0.01 && g.cx + reach(rr) + dxR <= hi + 0.01
    const left = !fitsR && Math.abs(dxL) < Math.abs(dxR)
    const dx = left ? dxL : dxR
    g.cx += dx
    own.x0 += dx
    own.x1 += dx
    g.status.setAttribute('data-fit-r', rr.toFixed(1))
    g.status.setAttribute('data-fit-side', left ? 'left' : 'right')
    g.status.setAttribute('data-fit-clear', String(clear))
  }
  for (const g of signs) {
    g.text.setAttribute('x', String(g.cx))
    g.plate.setAttribute('x', String(g.cx - g.w / 2 - 8))
    g.plate.setAttribute('width', String(g.w + 16))
  }
  for (const { status, cx, w, sign } of signs) {
    if (!status) continue
    const r0 = Number(status.getAttribute('data-r'))
    const r = Number(status.getAttribute('data-fit-r') ?? r0)
    const fitSide = status.getAttribute('data-fit-side')
    const clear = Number(status.getAttribute('data-fit-clear') ?? DISC_CLEAR)
    status.removeAttribute('data-fit-r')
    status.removeAttribute('data-fit-side')
    status.removeAttribute('data-fit-clear')
    const off = w / 2 + Math.max(14, r + clear)
    const cy = Number(status.getAttribute('data-cy'))
    const meets = (x: number) => plates.some((p) => p.sign !== sign && x - r - GAP < p.x1 + p.disc && p.x0 < x + r + GAP && cy - r < p.y1 && p.y0 < cy + r)
    const left = fitSide ? fitSide === 'left' : meets(cx + off) && !meets(cx - off) && cx - off - r >= edge0 + GAP
    const scale = r < r0 ? ` scale(${(r / r0).toFixed(3)})` : ''
    status.setAttribute('transform', `translate(${left ? cx - off : cx + off} ${cy})${scale}`)
    if (left) status.setAttribute('data-side', 'left')
    else status.removeAttribute('data-side')
  }
  return tight
}

function matchesSlot(state: GameState, region: RegionId, slot: 'squeeze' | 'expand'): boolean {
  return regionMatchesPressureSlot(state, region, slot)
}

/**
 * Plan item 55: Hollowell's props on a landmark, in its own 24-unit box so they stand where it does: boards across
 * the landmark under a SOLD sign (stage 3), and a small warning pennant when the next Squeeze would take ground
 * (item 550 folded the billboard and van away). Each reads by shape, so greyscale tells them apart.
 */
function GripProps({ stage, edge }: { stage: GripStage; edge: boolean }) {
  const ink = { stroke: 'var(--ink)', strokeWidth: 0.9, strokeLinejoin: 'round' as const }
  return (
    <g className="grip-props">
      {/* Plan item 550: the billboard (stage 1) and the delivery van (stage 2) fold into the region's status disc and
          Hollowell's own pieces; only the boards of a region it holds, and the warning pennant, stand on the landmark. */}
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
