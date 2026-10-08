import { REGIONS, regionMatchesPressureSlot } from '../content/map'
import { loadSettings } from '../platform/settings'
import type { GameState, ProducerId, RegionId, RegionType } from '../engine/types'

// SPEC 10.1's Settings screen has a "colour-blind patterns" toggle; Stalls are otherwise the one piece
// type distinguished only by fill hue (oxblood/mustard/slate/plum), with no shape difference between
// producers the way Outlet/Buyout/Doubt already have — so this is what the toggle turns on: each
// producer's initial, stamped on their Stalls.
const PRODUCER_INITIAL: Record<ProducerId, string> = { mara: 'M', tomas: 'T', ines: 'I', sol: 'S' }

// SPEC 10.2/STYLE.md 7: a square SVG hex flower, Kingsmarket in the centre. Pointy-top hexagons so the
// six directions land exactly on "left"/"right"/"top-left" etc. (angle 0 = right, going clockwise).
const HEX_ANGLES: Record<RegionId, number | null> = {
  kingsmarket: null,
  rivermead: 0,
  shingleBay: 60,
  oakvale: 120,
  brindleHills: 180,
  highmoor: 240,
  saltmarsh: 300,
}

const SIZE = 250 // viewBox half-width; hexes drawn within [-SIZE, SIZE]
const HEX_R = 92 // circumradius (centre to vertex)
const RING_DISTANCE = HEX_R * Math.sqrt(3)
const GAP_SCALE = 0.96 // shrink each hex slightly for the 3px paper gap between them (STYLE.md 7)
/* Piles wrap after this many pieces so a heavy board never runs past the hex edge. */
const PIECE_ROW = 6
const pieceXY = (n: number) => `${(n % PIECE_ROW) * 16}, ${Math.floor(n / PIECE_ROW) * 14}`
const PIECE_SCALE = 1.9 // enlarge the enemy-piece cluster in place (see the comment where it's used)

function hexCenter(id: RegionId): { x: number; y: number } {
  const angle = HEX_ANGLES[id]
  if (angle === null) return { x: 0, y: 0 }
  const rad = (angle * Math.PI) / 180
  return { x: RING_DISTANCE * Math.cos(rad), y: RING_DISTANCE * Math.sin(rad) }
}

function hexPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = []
  for (let i = 0; i < 6; i++) {
    const angle = ((-90 + i * 60) * Math.PI) / 180
    pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`)
  }
  return pts.join(' ')
}

const REGION_FILL: Record<RegionType, string> = {
  pasture: 'var(--region-pasture)',
  crop: 'var(--region-crop)',
  coast: 'var(--region-coast)',
  capital: 'var(--region-capital)',
}

interface Props {
  state: GameState
  highlight?: RegionId[]
  onSelect?: (region: RegionId) => void
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
      <pattern id="texture-lostland" width={8} height={8} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1={0} y1={0} x2={0} y2={8} stroke="var(--ink)" strokeWidth={1.4} opacity={0.35} />
        <line x1={4} y1={0} x2={4} y2={8} stroke="var(--ink)" strokeWidth={1.4} opacity={0.35} />
      </pattern>
    </defs>
  )
}

// STYLE.md 6's exact game pieces, drawn as small self-contained SVG groups so `Map` can place one per
// slot in the enemy-piece row / Stall row without repeating their geometry inline.

// Outlet: "little shopfront box with a price tag reading 0.99" — a glossy Hollowell square (unchanged
// from before) plus a small hanging price tag, the wit detail STYLE.md 2.5 asks for by name.
export function Outlet() {
  return (
    <g className="enemy-piece enemy-outlet">
      {/* sawtooth-roofed warehouse: reads apart from Buyout's peak and Doubt's bubble in outline alone */}
      <polygon points="0,12 0,3 3,0 3,3 6,0 6,3 9,0 9,3 12,3 12,12" fill="var(--hollowell)" stroke="var(--ink)" strokeWidth={0.4} strokeLinejoin="round" />
      <circle cx={9} cy={5.5} r={1.8} fill="var(--hollowell-highlight)" />
      <g transform="translate(7,9) rotate(18)">
        <rect x={0} y={0} width={7} height={5} rx={1} fill="var(--paper)" stroke="var(--ink)" strokeWidth={0.6} />
        <circle cx={1.3} cy={1.3} r={0.5} fill="var(--ink)" />
        <text x={4.2} y={4} textAnchor="middle" className="price-tag-text">
          .99
        </text>
      </g>
    </g>
  )
}

// Buyout: "picket-fence segment with a SOLD sign" — keeps the peaked sign-post silhouette (already
// distinct in outline from Outlet's square, STYLE.md 2.3) and adds the sign itself.
export function Buyout() {
  return (
    <g className="enemy-piece enemy-buyout">
      <polygon points="6,0 12,4 12,12 0,12 0,4" fill="var(--hollowell)" />
      <circle cx={9} cy={5} r={2} fill="var(--hollowell-highlight)" />
      <g transform="translate(1,7) rotate(-6)">
        <rect x={0} y={0} width={10} height={4} rx={0.5} fill="var(--paper)" stroke="var(--ink)" strokeWidth={0.6} />
        <text x={5} y={3.1} textAnchor="middle" className="sold-text">
          SOLD
        </text>
      </g>
    </g>
  )
}

// Doubt: "speech bubble with a '?'" — the glossy Candor circle already had the "?", but no tail, so it
// read as a plain dot rather than a speech bubble (STYLE.md 6's literal shape).
export function Doubt() {
  return (
    <g className="enemy-piece enemy-doubt">
      <circle cx={6} cy={6} r={6} fill="var(--candor)" />
      <path d="M 3,10.8 L 6.5,10.8 L 3.5,14 Z" fill="var(--candor)" />
      <circle cx={8} cy={4} r={1.8} fill="var(--candor-highlight)" />
      <text x={6} y={9} textAnchor="middle" className="doubt-mark">
        ?
      </text>
    </g>
  )
}

// Stall: "small awning with scalloped edge, striped in the producer's colour and paper" — was a plain
// rounded rect. Now a two-stripe canvas roof over a scalloped valance, both in the producer's colour.
function Stall({ pid, initial, showInitial }: { pid: ProducerId; initial: string; showInitial: boolean }) {
  const colour = `var(--p-${pid})`
  return (
    <g className="stall-piece">
      <rect x={0} y={0} width={7} height={6} fill={colour} />
      <rect x={7} y={0} width={7} height={6} fill="var(--paper)" />
      <rect x={0} y={0} width={14} height={6} fill="none" stroke="var(--ink)" strokeWidth={1} />
      <path
        d="M 0,6 a 3.5,3 0 0 0 7,0 a 3.5,3 0 0 0 7,0 L 14,10 L 0,10 Z"
        fill={colour}
        stroke="var(--ink)"
        strokeWidth={1}
      />
      {showInitial && (
        <text x={7} y={9} textAnchor="middle" className="stall-initial">
          {initial}
        </text>
      )}
    </g>
  )
}

// Co-op marker: "wax-seal rosette" — was a plain filled circle. Now a ring of six petals around a
// centre disc, the shape a wax seal's pressed rosette actually has. `orbit`/`petalR`/`centreR` scale the
// whole rosette; the map-piece size (used at `x`/`y` region coordinates) needs a bigger radius than the
// legend icon below, which must fit inside a compact fixed viewBox like Outlet/Buyout/Doubt's.
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
function TerrainArt({ type, id }: { type: RegionType; id: string }) {
  // Per-region variation: a stable hash of the id picks a variant so neighbours of one type don't look cloned.
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const flip = h % 2 === 0 ? 1 : -1
  const extra = (h >> 1) % 3
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
          <g key={d}>
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
        <path d="M-12,2 L12,2 L8,10 L-8,10 Z" fill="var(--clay)" {...line} />
        <path d="M0,0 L0,-20 M0,-20 L11,-2 L0,-2 Z" fill="var(--paper)" {...line} />
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
        <path d="M-7,30 L-7,4 L0,-8 L7,4 L7,30 Z" fill="var(--paper)" {...line} />
        <circle cx={0} cy={9} r={4.5} fill="var(--paper)" {...line} />
        <path d="M0,9 L0,6 M0,9 L2,10" {...line} strokeWidth={1.2} />
      </g>
    </g>
  )
}

export default function Map({ state, highlight, onSelect }: Props) {
  const active = state.config.activeRegions
  const squeezeTargets = active.filter((id) => matchesSlot(state, id, 'squeeze'))
  const expandTargets = active.filter((id) => matchesSlot(state, id, 'expand'))
  const highlighted = new Set(highlight ?? [])
  const targeting = highlighted.size > 0
  const colourBlindPatterns = loadSettings().colourBlindPatterns

  return (
    <svg viewBox={`${-SIZE} ${-SIZE + 12} ${SIZE * 2} ${SIZE * 2 - 24}`} className="map" role="img" aria-label="Map of Marrow">
      <RegionTextureDefs />
      {active.map((id) => {
        const def = REGIONS[id]
        const r = state.regions[id]
        const { x, y } = hexCenter(id)
        const stalls = Object.entries(r.stalls).filter(([, n]) => (n ?? 0) > 0) as [ProducerId, number][]
        const dimmed = targeting && !highlighted.has(id)
        const glow = targeting && highlighted.has(id)
        return (
          <g
            key={id}
            className={`region-hex${dimmed ? ' dimmed' : ''}${glow ? ' glow' : ''}${onSelect ? ' region-hex-selectable' : ''}`}
            onClick={onSelect ? () => onSelect(id) : undefined}
            aria-label={def.name}
          >
            <polygon
              points={hexPoints(x, y, HEX_R * GAP_SCALE)}
              fill={REGION_FILL[def.type]}
              stroke="var(--ink)"
              strokeWidth={2}
            />
            <polygon points={hexPoints(x, y, HEX_R * GAP_SCALE)} fill={`url(#${REGION_PATTERN_ID[def.type]})`} />
            <g transform={`translate(${x}, ${y})`} pointerEvents="none" className="terrain-art">
              <TerrainArt type={def.type} id={id} />
            </g>
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
            {squeezeTargets.includes(id) && (
              <g transform={`translate(${x - 30}, ${y - HEX_R * 0.4})`}>
                <rect x={0} y={0} width={60} height={16} rx={8} fill="var(--clay-deep)" />
                <text x={30} y={11} textAnchor="middle" className="badge-text">
                  SQUEEZE
                </text>
              </g>
            )}
            {expandTargets.includes(id) && !squeezeTargets.includes(id) && (
              <g transform={`translate(${x - 28}, ${y - HEX_R * 0.4})`}>
                <rect x={0} y={0} width={56} height={16} rx={8} fill="var(--wheat)" />
                <text x={28} y={11} textAnchor="middle" className="badge-text badge-text-dark">
                  EXPAND
                </text>
              </g>
            )}

            {/* Enemy pieces cluster near the top: Outlets, Buyouts, Doubt. `PIECE_SCALE` enlarges the
                icons themselves (not the map/hex, which SPEC 10.3's desktop column-height budget already
                tightens elsewhere): at the desktop map's 260px CSS width (`global.css`), an unscaled
                12-unit icon renders at ~5px, well under STYLE.md 9's "readable at 16-20px" floor and too
                small to tell Outlet/Buyout/Doubt apart by shape alone in greyscale (SPEC 11.4 gate 8 found
                this via a real screenshot review, confirmed by inspection — not just trusted). Each hex has
                ample empty space around this cluster (confirmed visually), so scaling it up in place is
                safe without widening the map or risking the desktop no-scroll layout. */}
            <g transform={`translate(${x - Math.min(r.outlets + r.buyouts + r.doubt, PIECE_ROW) * 8 * PIECE_SCALE}, ${y - HEX_R * 0.1}) scale(${PIECE_SCALE})`}>
              {/* Each piece's own SVG `transform` attribute positions it (its offset in the row); the
                  animation class goes on an inner <g> instead of that same element, since a CSS
                  `animation`/`transform` would otherwise override the positioning attribute rather than
                  compose with it (SVG2: a CSS transform replaces the presentation attribute, it doesn't
                  add to it). */}
              {Array.from({ length: r.outlets }).map((_, i) => (
                <g key={`o${i}`} transform={`translate(${pieceXY(i)})`}>
                  <Outlet />
                </g>
              ))}
              {Array.from({ length: r.buyouts }).map((_, i) => (
                <g key={`b${i}`} transform={`translate(${pieceXY(r.outlets + i)})`}>
                  <Buyout />
                </g>
              ))}
              {Array.from({ length: r.doubt }).map((_, i) => (
                <g key={`d${i}`} transform={`translate(${pieceXY(r.outlets + r.buyouts + i)})`}>
                  <Doubt />
                </g>
              ))}
            </g>

            {/* Stalls sit along the bottom edge, striped in the producer's colour. */}
            <g transform={`translate(${x - 27}, ${y + HEX_R * 0.5})`}>
              {(() => {
                let slot = 0
                return stalls.flatMap(([pid, n]) =>
                  Array.from({ length: n }).map((_, i) => {
                    const sx = slot * 18
                    slot += 1
                    return (
                      <g key={`${pid}-${i}`} transform={`translate(${sx}, 0)`}>
                        <Stall pid={pid} initial={PRODUCER_INITIAL[pid]} showInitial={colourBlindPatterns} />
                      </g>
                    )
                  }),
                )
              })()}
            </g>

            {r.liberated && (
              <g className="coop-stamp">
                <CoopMarker x={x + HEX_R * 0.55} y={y + HEX_R * 0.55} />
              </g>
            )}
          </g>
        )
      })}
      {/* Region names are drawn in their own pass, after every hex's fill/pattern, so a name near a
          hex's pointy top vertex is never painted over by a neighbouring hex above it (gate 8 found
          Oakvale's and Shingle Bay's labels — the two bottom-row regions in the flower, whose top
          vertex sits against the row above rather than open background — clipped this way). */}
      {active.map((id) => {
        const def = REGIONS[id]
        const { x, y } = hexCenter(id)
        return (
          <g key={`name-${id}`} className="region-sign" pointerEvents="none">
            <rect
              x={x - def.name.length * 4.9 - 6}
              y={y - HEX_R * 0.62 - 12}
              width={def.name.length * 9.8 + 12}
              height={17}
              rx={3}
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
    </svg>
  )
}

function matchesSlot(state: GameState, region: RegionId, slot: 'squeeze' | 'expand'): boolean {
  return regionMatchesPressureSlot(state, region, slot)
}
