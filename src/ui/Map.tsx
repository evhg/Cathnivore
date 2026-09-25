import { REGIONS } from '../content/map'
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

const SIZE = 300 // viewBox half-width; hexes drawn within [-SIZE, SIZE]
const HEX_R = 92 // circumradius (centre to vertex)
const RING_DISTANCE = HEX_R * Math.sqrt(3)
const GAP_SCALE = 0.96 // shrink each hex slightly for the 3px paper gap between them (STYLE.md 7)

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
      {/* Pasture: short diagonal strokes. */}
      <pattern id="texture-pasture" width={10} height={10} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1={0} y1={0} x2={0} y2={10} stroke="var(--ink)" strokeWidth={1.6} opacity={0.08} />
      </pattern>
      {/* Crop: dotted furrow rows. */}
      <pattern id="texture-crop" width={12} height={8} patternUnits="userSpaceOnUse">
        <circle cx={2} cy={4} r={1.1} fill="var(--ink)" opacity={0.08} />
        <circle cx={8} cy={4} r={1.1} fill="var(--ink)" opacity={0.08} />
      </pattern>
      {/* Coast: wave lines. */}
      <pattern id="texture-coast" width={16} height={8} patternUnits="userSpaceOnUse">
        <path d="M0,4 Q4,0 8,4 T16,4" fill="none" stroke="var(--ink)" strokeWidth={1.2} opacity={0.08} />
      </pattern>
      {/* Capital: cobblestone grid. */}
      <pattern id="texture-capital" width={12} height={12} patternUnits="userSpaceOnUse">
        <rect x={0} y={0} width={11} height={11} fill="none" stroke="var(--ink)" strokeWidth={1} opacity={0.08} />
      </pattern>
    </defs>
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
    <svg viewBox={`${-SIZE} ${-SIZE} ${SIZE * 2} ${SIZE * 2}`} className="map" role="img" aria-label="Map of Marrow">
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
            className={`region-hex${dimmed ? ' dimmed' : ''}${glow ? ' glow' : ''}`}
            onClick={onSelect ? () => onSelect(id) : undefined}
            style={onSelect ? { cursor: 'pointer' } : undefined}
          >
            <polygon
              points={hexPoints(x, y, HEX_R * GAP_SCALE)}
              fill={REGION_FILL[def.type]}
              stroke="var(--ink)"
              strokeWidth={2}
            />
            <polygon points={hexPoints(x, y, HEX_R * GAP_SCALE)} fill={`url(#${REGION_PATTERN_ID[def.type]})`} />
            {r.lostLand > 0 && (
              <polygon
                className="lostland-overlay"
                points={hexPoints(x, y, HEX_R * GAP_SCALE * 0.98)}
                fill="var(--clay)"
                opacity={0.18}
              />
            )}

            <text x={x} y={y - HEX_R * 0.62} textAnchor="middle" className="region-name">
              {def.name}
            </text>

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

            {/* Enemy pieces cluster near the top: Outlets, Buyouts, Doubt. */}
            <g transform={`translate(${x - (r.outlets + r.buyouts + r.doubt) * 8}, ${y - HEX_R * 0.1})`}>
              {/* Each piece's own SVG `transform` attribute positions it (its offset in the row); the
                  animation class goes on an inner <g> instead of that same element, since a CSS
                  `animation`/`transform` would otherwise override the positioning attribute rather than
                  compose with it (SVG2: a CSS transform replaces the presentation attribute, it doesn't
                  add to it). */}
              {Array.from({ length: r.outlets }).map((_, i) => (
                <g key={`o${i}`} transform={`translate(${i * 16}, 0)`}>
                  <g className="enemy-piece">
                    <rect width={12} height={12} rx={2} fill="var(--hollowell)" />
                    <circle cx={9} cy={3} r={2.2} fill="var(--hollowell-highlight)" />
                  </g>
                </g>
              ))}
              {Array.from({ length: r.buyouts }).map((_, i) => (
                <g key={`b${i}`} transform={`translate(${(r.outlets + i) * 16}, 0)`}>
                  <g className="enemy-piece">
                    {/* STYLE.md 6: "picket-fence segment with a SOLD sign" — a peaked sign-post silhouette,
                        deliberately distinct in outline from the Outlet's plain square (STYLE.md 2.3:
                        "shape before colour" — the two share the same glossy Hollowell colour and, before
                        this fix, only differed by a barely-visible corner radius, effectively
                        indistinguishable in greyscale; found by eye on this session's own greyscale
                        screenshot after the gate-8 subagent's pass, which didn't catch it at that
                        resolution). */}
                    <polygon points="6,0 12,4 12,12 0,12 0,4" fill="var(--hollowell)" />
                    <circle cx={9} cy={5} r={2} fill="var(--hollowell-highlight)" />
                  </g>
                </g>
              ))}
              {Array.from({ length: r.doubt }).map((_, i) => (
                <g key={`d${i}`} transform={`translate(${(r.outlets + r.buyouts + i) * 16}, 0)`}>
                  <g className="enemy-piece">
                    <circle cx={6} cy={6} r={6} fill="var(--candor)" />
                    <circle cx={8} cy={4} r={1.8} fill="var(--candor-highlight)" />
                    <text x={6} y={9} textAnchor="middle" className="doubt-mark">
                      ?
                    </text>
                  </g>
                </g>
              ))}
            </g>

            {/* Stalls sit along the bottom edge, striped in the producer's colour. */}
            <g transform={`translate(${x - 27}, ${y + HEX_R * 0.5})`}>
              {stalls.flatMap(([pid, n]) =>
                Array.from({ length: n }).map((_, i) => {
                  const sx = (stalls.findIndex(([p]) => p === pid) + i) * 18
                  return (
                    <g key={`${pid}-${i}`} className="stall-piece">
                      <rect x={sx} y={0} width={14} height={10} rx={2} fill={`var(--p-${pid})`} stroke="var(--ink)" strokeWidth={1} />
                      {colourBlindPatterns && (
                        <text x={sx + 7} y={8} textAnchor="middle" className="stall-initial">
                          {PRODUCER_INITIAL[pid]}
                        </text>
                      )}
                    </g>
                  )
                }),
              )}
            </g>

            {r.liberated && (
              <circle cx={x + HEX_R * 0.55} cy={y + HEX_R * 0.55} r={10} fill="var(--pasture)" stroke="var(--ink)" strokeWidth={1.5} />
            )}
          </g>
        )
      })}
    </svg>
  )
}

function matchesSlot(state: GameState, region: RegionId, slot: 'squeeze' | 'expand'): boolean {
  const card = slot === 'squeeze' ? state.squeeze : state.expand
  if (!card) return false
  const type = REGIONS[region].type
  return card.regionTypes.includes(type)
}
