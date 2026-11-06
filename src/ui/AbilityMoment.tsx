// Plan item 189: each producer's role ability staged on the board as a short moment over its hex.
//   Mara's Injunction: a court notice nails onto the tile and a gavel lands on it.
//   Tomas's Market Day: bunting drops across the tile and a striped awning pops up.
//   Ines's Second Opinion: a Doubt bubble is struck off with a pen stroke and fades.
//   Sol's On Air: radio rings run out across the board from the mast on her home tile.
// Pure SVG inside the map's fitted group; every motion is CSS (`.ab-*` in global.css), cut to fades under reduced motion.
import type { ProducerId, RegionId } from '../engine/types'
import type { GameState } from '../engine/types'

export const ABILITY_MOMENT_MS = 1100

export interface AbilityMomentView {
  producer: ProducerId
  region: RegionId
  /** Bumped per moment so a repeat remounts and replays its animations. */
  key: number
}

/**
 * The producer whose role ability was just used between `prev` and `next`, and the hex it acted on, or null.
 * The engine logs no event for a role, so this reads the flag and the ability's own mark on the board.
 */
export function abilityUsed(prev: GameState, next: GameState): { producer: ProducerId; region: RegionId } | null {
  for (const id of Object.keys(next.producers) as ProducerId[]) {
    const was = prev.producers[id]
    const now = next.producers[id]
    if (!was || !now || was.roleUsedThisRound || !now.roleUsedThisRound) continue
    if (prev.round !== next.round) continue
    const regions = next.config.activeRegions
    let region: RegionId | undefined
    if (id === 'mara') region = next.expandSkip.find((r) => !prev.expandSkip.includes(r))
    else if (id === 'tomas') region = regions.find((r) => (next.regions[r].stalls[id] ?? 0) > (prev.regions[r].stalls[id] ?? 0))
    else if (id === 'ines') region = regions.find((r) => next.regions[r].doubt < prev.regions[r].doubt)
    else {
      // On Air has no target: the rings start from her own Stall (her home first), else the board's first tile.
      const home = regions.find((r) => (next.regions[r].stalls.sol ?? 0) > 0)
      region = home ?? regions[0]
    }
    if (region) return { producer: id, region }
  }
  return null
}

const NAME: Record<ProducerId, string> = { mara: 'injunction', tomas: 'market-day', ines: 'second-opinion', sol: 'on-air' }

export default function AbilityMoment({ view, x, y, r }: { view: AbilityMomentView; x: number; y: number; r: number }) {
  const { producer } = view
  return (
    <g
      className={`ability-moment ab-${producer}`}
      data-moment={`ability-${producer}`}
      data-ability={NAME[producer]}
      data-region={view.region}
      transform={`translate(${x} ${y})`}
      pointerEvents="none"
      aria-hidden="true"
    >
      {producer === 'mara' && <Injunction r={r} />}
      {producer === 'tomas' && <MarketDay r={r} />}
      {producer === 'ines' && <SecondOpinion r={r} />}
      {producer === 'sol' && <OnAir r={r} />}
    </g>
  )
}

const line = { stroke: 'var(--ink)', strokeWidth: 1.4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }

function Injunction({ r }: { r: number }) {
  const w = r * 0.62
  const h = r * 0.78
  return (
    <>
      <g className="ab-notice">
        <rect x={-w / 2 + 2} y={-h / 2 + 3} width={w} height={h} rx={2} fill="var(--ink)" opacity={0.25} />
        <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={2} fill="var(--paper-hi)" {...line} />
        <rect x={-w / 2 + 5} y={-h / 2 + 6} width={w - 10} height={4} fill="var(--ink)" />
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1={-w / 2 + 6} x2={w / 2 - (i === 3 ? 18 : 6)} y1={-h / 2 + 17 + i * 7} y2={-h / 2 + 17 + i * 7} stroke="var(--ink-muted)" strokeWidth={1.2} />
        ))}
        <circle cx={w / 2 - 10} cy={h / 2 - 10} r={6.5} fill="var(--seal)" {...line} strokeWidth={1} />
        <circle cx={0} cy={-h / 2 + 1} r={2.2} fill="var(--clay-deep)" {...line} strokeWidth={0.8} />
      </g>
      <g className="ab-gavel">
        <g transform={`translate(${w * 0.55} ${-h * 0.15}) rotate(-28)`}>
          <rect x={-2.2} y={-2} width={4.4} height={r * 0.55} rx={2} fill="var(--soil)" {...line} strokeWidth={1} />
          <rect x={-11} y={-9} width={22} height={11} rx={2.5} fill="var(--clay-deep)" {...line} />
          <rect x={-12.5} y={-10} width={3} height={13} rx={1} fill="var(--wheat)" {...line} strokeWidth={0.8} />
          <rect x={9.5} y={-10} width={3} height={13} rx={1} fill="var(--wheat)" {...line} strokeWidth={0.8} />
        </g>
      </g>
      <g className="ab-dust">
        {[-1, 1].map((s) => (
          <path key={s} d={`M${s * 8} ${-h * 0.1} q${s * 6} -4 ${s * 12} -2`} fill="none" stroke="var(--ink)" strokeWidth={1.2} />
        ))}
      </g>
    </>
  )
}

function MarketDay({ r }: { r: number }) {
  const span = r * 1.3
  const flags = 7
  return (
    <>
      <g className="ab-bunting">
        <path d={`M${-span / 2} ${-r * 0.42} Q0 ${-r * 0.24} ${span / 2} ${-r * 0.42}`} fill="none" stroke="var(--ink)" strokeWidth={1.2} />
        {Array.from({ length: flags }, (_, i) => {
          const t = (i + 0.5) / flags
          const fx = -span / 2 + t * span
          const fy = -r * 0.42 + 4 * t * (1 - t) * r * 0.18 * 0.5
          return (
            <path
              key={i}
              d={`M${fx - 5} ${fy} L${fx + 5} ${fy} L${fx} ${fy + 10} Z`}
              fill={i % 2 ? 'var(--bunting)' : 'var(--wheat)'}
              {...line}
              strokeWidth={0.9}
            />
          )
        })}
      </g>
      <g className="ab-awning" transform={`translate(0 ${r * 0.12})`}>
        <rect x={-r * 0.34} y={-2} width={r * 0.68} height={r * 0.3} fill="var(--kraft)" {...line} />
        <path
          d={`M${-r * 0.4} ${-2} L${r * 0.4} ${-2} L${r * 0.34} ${-r * 0.2} L${-r * 0.34} ${-r * 0.2} Z`}
          fill="var(--paper-hi)"
          {...line}
        />
        {[-0.24, -0.08, 0.08, 0.24].map((k) => (
          <path key={k} d={`M${r * k - 4} ${-r * 0.2} L${r * k + 4} ${-r * 0.2} L${r * k + 5} ${-2} L${r * k - 5} ${-2} Z`} fill="var(--bunting)" />
        ))}
        <path d={`M${-r * 0.4} ${-2} L${r * 0.4} ${-2}`} {...line} fill="none" />
      </g>
    </>
  )
}

function SecondOpinion({ r }: { r: number }) {
  const R = r * 0.22
  return (
    <>
      <g className="ab-doubt">
        <circle cx={0} cy={0} r={R} fill="var(--candor)" {...line} />
        <text x={0} y={R * 0.38} textAnchor="middle" className="doubt-mark" style={{ fontSize: R * 1.1 }}>
          ?
        </text>
      </g>
      <path className="ab-strike" d={`M${-R * 1.6} ${R * 1.1} L${R * 1.6} ${-R * 1.1}`} fill="none" stroke="var(--pasture-deep)" strokeWidth={4} strokeLinecap="round" pathLength={1} />
      <g className="ab-check" transform={`translate(${R * 1.9} ${-R * 1.5})`}>
        <circle r={8} fill="var(--paper-hi)" {...line} />
        <path d="M-4 0 L-1 3 L4 -3" fill="none" stroke="var(--pasture-deep)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </>
  )
}

function OnAir({ r }: { r: number }) {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <circle key={i} className="ab-wave" style={{ animationDelay: `${i * 160}ms` }} r={r * 0.9} fill="none" stroke="var(--p-sol)" strokeWidth={3} />
      ))}
      <g className="ab-mast">
        <path d="M0 -26 L-8 6 M0 -26 L8 6 M-5 -6 L5 -6" {...line} fill="none" />
        <circle cx={0} cy={-28} r={4} fill="var(--p-sol)" {...line} strokeWidth={1} />
      </g>
    </>
  )
}
