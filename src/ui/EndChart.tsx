import type { EndSummary } from './endSummary'

// Plan item 8: Public Trust and Lost Land round by round, the two tracks that end a game, drawn on one chart
// with each track's losing line marked. Inline SVG, so it scales with its column and themes with the page.
const W = 340
const H = 168
const PAD = { l: 26, r: 12, t: 14, b: 26 }

export default function EndChart({ summary }: { summary: EndSummary }) {
  const { rounds, lostLandLimit, trustStart } = summary
  const last = rounds[rounds.length - 1]
  const maxRound = Math.max(1, last?.round ?? 1)
  const top = Math.max(lostLandLimit, trustStart, ...rounds.map((r) => r.trust))
  const x = (round: number) => PAD.l + (round / maxRound) * (W - PAD.l - PAD.r)
  const y = (v: number) => PAD.t + (1 - v / top) * (H - PAD.t - PAD.b)
  const path = (pick: (r: (typeof rounds)[number]) => number) =>
    rounds.map((r, i) => `${i ? 'L' : 'M'}${x(r.round).toFixed(1)},${y(pick(r)).toFixed(1)}`).join('')
  const label = last
    ? `Public Trust went from ${trustStart} to ${last.trust}; the corporations took ${last.lostLand} of ${lostLandLimit} land over ${last.round} rounds.`
    : 'No rounds were played.'
  return (
    <figure className="end-chart">
      <figcaption>
        <span className="end-chart-key is-trust">Public Trust</span>
        <span className="end-chart-key is-land">Lost Land</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
        {/* Round gridlines and labels. */}
        {rounds.map((r) => (
          <g key={r.round}>
            <line className="end-chart-grid" x1={x(r.round)} x2={x(r.round)} y1={PAD.t} y2={H - PAD.b} />
            {r.round > 0 && (
              <text className="end-chart-tick" x={x(r.round)} y={H - PAD.b + 15} textAnchor="middle">
                {r.round}
              </text>
            )}
          </g>
        ))}
        <line className="end-chart-axis" x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} />
        <text className="end-chart-tick" x={PAD.l - 6} y={y(0) + 4} textAnchor="end">0</text>
        <text className="end-chart-tick" x={PAD.l - 6} y={y(top) + 4} textAnchor="end">{top}</text>
        {/* Lost Land's losing line: the pool runs dry here. Trust's is the axis itself. */}
        <line className="end-chart-limit" x1={PAD.l} x2={W - PAD.r} y1={y(lostLandLimit)} y2={y(lostLandLimit)} />
        <text className="end-chart-limit-label" x={W - PAD.r} y={y(lostLandLimit) - 4} textAnchor="end">
          land lost
        </text>
        <path className="end-chart-line is-land" d={path((r) => r.lostLand)} pathLength={1} />
        <path className="end-chart-line is-trust" d={path((r) => r.trust)} pathLength={1} />
        {last && (
          <>
            <circle className="end-chart-dot is-land" cx={x(last.round)} cy={y(last.lostLand)} r={4} />
            <circle className="end-chart-dot is-trust" cx={x(last.round)} cy={y(last.trust)} r={4} />
          </>
        )}
        <text className="end-chart-tick" x={(PAD.l + W - PAD.r) / 2} y={H - 1} textAnchor="middle">round</text>
      </svg>
    </figure>
  )
}
