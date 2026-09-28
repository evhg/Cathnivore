import type { RegionType } from '../../engine/types'

// STYLE.md 8's Pressure card: "a minimal card showing the stage number in Roman numerals and one or two
// region-type icons." The map itself already gives each region type a distinct fill colour (REGION_FILL,
// Map.tsx) and a distinct texture pattern (STYLE.md 2.3/3.2's "shape before colour" test) — this icon
// reuses that exact colour language at icon scale (a small hex, the map's own region silhouette) rather
// than inventing a second, unrelated visual vocabulary for the same 4 types. Same 24px grid, 2px ink
// outline as the other icon sets.
const REGION_FILL: Record<RegionType, string> = {
  pasture: 'var(--region-pasture)',
  crop: 'var(--region-crop)',
  coast: 'var(--region-coast)',
  capital: 'var(--region-capital)',
}
const INK = 'var(--ink, #2B2320)'

export function RegionTypeIcon({ type, size = 16 }: { type: RegionType; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="icon-inline">
      <polygon
        points="12,2 21,7 21,17 12,22 3,17 3,7"
        fill={REGION_FILL[type]}
        stroke={INK}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  )
}

// SPEC/STYLE's Pressure cards use a stage number (1-3) shown as a Roman numeral.
const ROMAN: Record<1 | 2 | 3, string> = { 1: 'I', 2: 'II', 3: 'III' }
export function romanStage(stage: 1 | 2 | 3): string {
  return ROMAN[stage]
}
