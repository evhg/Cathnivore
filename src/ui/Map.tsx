import { REGIONS } from '../content/map'
import type { GameState, ProducerId, RegionId, RegionType } from '../engine/types'

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

export default function Map({ state, highlight, onSelect }: Props) {
  const active = state.config.activeRegions
  const squeezeTargets = active.filter((id) => matchesSlot(state, id, 'squeeze'))
  const expandTargets = active.filter((id) => matchesSlot(state, id, 'expand'))
  const highlighted = new Set(highlight ?? [])
  const targeting = highlighted.size > 0

  return (
    <svg viewBox={`${-SIZE} ${-SIZE} ${SIZE * 2} ${SIZE * 2}`} className="map" role="img" aria-label="Map of Marrow">
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
            {r.lostLand > 0 && (
              <polygon points={hexPoints(x, y, HEX_R * GAP_SCALE * 0.98)} fill="var(--clay)" opacity={0.18} />
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
              {Array.from({ length: r.outlets }).map((_, i) => (
                <g key={`o${i}`} transform={`translate(${i * 16}, 0)`}>
                  <rect width={12} height={12} rx={2} fill="var(--hollowell)" />
                  <circle cx={9} cy={3} r={2.2} fill="var(--hollowell-highlight)" />
                </g>
              ))}
              {Array.from({ length: r.buyouts }).map((_, i) => (
                <g key={`b${i}`} transform={`translate(${(r.outlets + i) * 16}, 0)`}>
                  <rect width={12} height={12} rx={1} fill="var(--hollowell)" />
                  <circle cx={9} cy={3} r={2.2} fill="var(--hollowell-highlight)" />
                </g>
              ))}
              {Array.from({ length: r.doubt }).map((_, i) => (
                <g key={`d${i}`} transform={`translate(${(r.outlets + r.buyouts + i) * 16}, 0)`}>
                  <circle cx={6} cy={6} r={6} fill="var(--candor)" />
                  <circle cx={8} cy={4} r={1.8} fill="var(--candor-highlight)" />
                </g>
              ))}
            </g>

            {/* Stalls sit along the bottom edge, striped in the producer's colour. */}
            <g transform={`translate(${x - 27}, ${y + HEX_R * 0.5})`}>
              {stalls.flatMap(([pid, n]) =>
                Array.from({ length: n }).map((_, i) => (
                  <rect
                    key={`${pid}-${i}`}
                    x={(stalls.findIndex(([p]) => p === pid) + i) * 18}
                    y={0}
                    width={14}
                    height={10}
                    rx={2}
                    fill={`var(--p-${pid})`}
                    stroke="var(--ink)"
                    strokeWidth={1}
                  />
                )),
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
