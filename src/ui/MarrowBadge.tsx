import { MAP_AXIAL, liberatedRegions } from '../content/campaignMap'
import type { RegionId } from '../engine/types'

// Its own module (2026-11-22) so the title's first chunk doesn't carry the whole campaign map (gate 7).
function hexPoints(r: number): string {
  return Array.from({ length: 6 }, (_, k) => {
    const a = ((60 * k + 30) * Math.PI) / 180
    return `${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)}`
  }).join(' ')
}

// The title's Campaign key carries the map's progress (plan item 35): Marrow's seven regions in little,
// freed ones green. Text for screen readers says the same.
export function MarrowBadge({ completed }: { completed: readonly string[] }) {
  const free = liberatedRegions(completed)
  const r = 5.2
  const w = r * Math.sqrt(3)
  return (
    <span className="marrow-badge" data-free={free.size}>
      <svg viewBox="-17 -15 34 30" aria-hidden="true">
        {(Object.keys(MAP_AXIAL) as RegionId[]).map((id) => {
          const [q, rr] = MAP_AXIAL[id]!
          return (
            <polygon
              key={id}
              points={hexPoints(r * 0.92)}
              transform={`translate(${(w * (q + rr / 2)).toFixed(1)} ${(1.5 * r * rr).toFixed(1)})`}
              className={free.has(id) ? 'marrow-badge-hex is-free' : 'marrow-badge-hex'}
            />
          )
        })}
      </svg>
      <span className="sr-only">{`, ${free.size} of 7 regions liberated`}</span>
    </span>
  )
}
