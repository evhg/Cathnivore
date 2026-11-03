import type { ReactElement } from 'react'
import type { GroundKind, GroundMark } from './regionGround'

// Plan item 76: the small marks of a region's own ground (regionGround.ts places them), drawn under the pieces
// in quiet ink so the tile reads as a place without competing with the pieces on it. Tile units, centred.

const ink = { stroke: 'var(--ink)', strokeWidth: 1, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
const HEATHER = 'color-mix(in srgb, var(--clay) 55%, var(--sea))'

const ART: Record<GroundKind, ReactElement> = {
  reeds: (
    <g>
      <path d="M-4,7 Q-5,0 -3,-5 M0,7 Q0,-1 1,-7 M4,7 Q5,1 4,-4" fill="none" {...ink} stroke="var(--pasture)" strokeWidth={1.4} />
      <ellipse cx={1} cy={-6} rx={1.2} ry={2.4} fill="var(--soil)" />
    </g>
  ),
  tideLine: <path d="M-17,0 q4,-3 8,0 t8,0 t8,0 t8,0" fill="none" stroke="var(--paper)" strokeWidth={1.6} strokeLinecap="round" />,
  heather: (
    <g fill={HEATHER}>
      <circle cx={-4} cy={1} r={2.2} />
      <circle cx={0} cy={-2} r={2.4} />
      <circle cx={4} cy={1} r={2.1} />
      <path d="M-5,4 h10" {...ink} stroke="var(--pasture)" />
    </g>
  ),
  boulder: <path d="M-6,4 q-1,-6 4,-7 q6,-1 8,4 q1,3 -2,3 z" fill="color-mix(in srgb, var(--ink) 22%, var(--paper))" {...ink} strokeOpacity={0.5} />,
  cobbles: (
    <g fill="none" {...ink} strokeOpacity={0.4}>
      {[[-6, -3], [0, -3], [6, -3], [-3, 3], [3, 3]].map(([x, y]) => (
        <rect key={`${x}${y}`} x={x! - 2.6} y={y! - 2.2} width={5.2} height={4.4} rx={1.6} />
      ))}
    </g>
  ),
  bunting: (
    <g>
      <path d="M-15,-3 Q0,3 15,-3" fill="none" {...ink} strokeOpacity={0.5} />
      {[-10, -4, 2, 8].map((x, i) => (
        <path key={x} d={`M${x},${-1 + Math.abs(x) * -0.05} l3,0.4 l-1.6,4 z`} fill={i % 2 ? 'var(--wheat)' : 'var(--clay)'} />
      ))}
    </g>
  ),
  tree: (
    <g>
      <path d="M0,9 V2" {...ink} stroke="var(--soil)" strokeWidth={1.8} />
      <circle cx={0} cy={-3} r={6.5} fill="var(--pasture)" {...ink} strokeOpacity={0.45} />
      <circle cx={-2} cy={-5} r={2} fill="var(--paper)" opacity={0.25} />
    </g>
  ),
  furrows: <path d="M-13,-4 Q0,-7 13,-4 M-13,0 Q0,-3 13,0 M-13,4 Q0,1 13,4" fill="none" {...ink} stroke="var(--soil)" strokeOpacity={0.45} />,
  sheaf: (
    <g>
      <path d="M0,6 L-3,-5 M0,6 L0,-6 M0,6 L3,-5" fill="none" {...ink} stroke="var(--wheat)" strokeWidth={1.8} />
      <path d="M-2.5,2 h5" {...ink} stroke="var(--soil)" />
    </g>
  ),
  drystone: (
    <g fill="color-mix(in srgb, var(--ink) 18%, var(--paper))" {...ink} strokeOpacity={0.4}>
      {[-12, -6, 0, 6, 12].map((x, i) => (
        <ellipse key={x} cx={x} cy={i % 2 ? -0.6 : 0.6} rx={3.2} ry={2.2} />
      ))}
    </g>
  ),
  gorse: (
    <g>
      <path d="M-6,4 q0,-7 6,-7 q6,0 6,7 z" fill="var(--pasture)" {...ink} strokeOpacity={0.4} />
      {[[-2, -1], [2, 0], [0, -3]].map(([x, y]) => (
        <circle key={`${x}${y}`} cx={x} cy={y} r={1} fill="var(--wheat)" />
      ))}
    </g>
  ),
  pebbles: (
    <g fill="color-mix(in srgb, var(--ink) 14%, var(--paper))" {...ink} strokeOpacity={0.35}>
      <ellipse cx={-4} cy={1} rx={2.4} ry={1.6} />
      <ellipse cx={1} cy={-1} rx={2} ry={1.4} />
      <ellipse cx={5} cy={1.5} rx={1.8} ry={1.2} />
    </g>
  ),
  groyne: <path d="M0,-10 V10 M-1.5,-6 h3 M-1.5,0 h3 M-1.5,6 h3" fill="none" {...ink} stroke="var(--soil)" strokeWidth={1.6} />,
  gull: <path d="M-5,1 q2.5,-3 5,0 q2.5,-3 5,0" fill="none" {...ink} strokeOpacity={0.6} />,
}

/** Plan item 76: the ground's quiet ambient motion: gulls glide, reeds and bunting sway (styles: .amb-*). */
const AMBIENT: Partial<Record<GroundKind, string>> = { gull: 'amb-glide', reeds: 'amb-sway', bunting: 'amb-sway' }

export default function RegionGroundArt({ marks }: { marks: readonly GroundMark[] }) {
  return (
    <g className="region-ground" pointerEvents="none" aria-hidden="true" opacity={0.75} data-marks={marks.length}>
      {marks.map((m, i) => (
        <g key={i} data-kind={m.kind} transform={`translate(${m.x.toFixed(1)},${m.y.toFixed(1)}) rotate(${m.r}) scale(${m.s})`}>
          {AMBIENT[m.kind] ? (
            <g className={AMBIENT[m.kind]} style={{ animationDelay: `${-((i * 1.7) % 6).toFixed(1)}s` }}>
              {ART[m.kind]}
            </g>
          ) : (
            ART[m.kind]
          )}
        </g>
      ))}
    </g>
  )
}
