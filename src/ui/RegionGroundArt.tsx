import type { ReactElement } from 'react'
import type { GroundKind, GroundMark } from './regionGround'

// Plan item 76: the small marks of a region's own ground (regionGround.ts places them), drawn under the pieces
// in quiet ink so the tile reads as a place without competing with the pieces on it. Tile units, centred.

const ink = { stroke: 'var(--ink)', strokeWidth: 1, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
const HEATHER = 'color-mix(in srgb, var(--clay) 55%, var(--sea))'

const ART: Record<GroundKind, ReactElement> = {
  // Plan item 417: Hollowell's signboard on held ground: a glossy orange board on steel posts, their H on white, a
  // hard highlight (VISION: the corporations glossy and clinical against the players' paper).
  hsign: (
    <g strokeLinejoin="round">
      <ellipse cx={0} cy={10.4} rx={9} ry={1.4} fill="var(--ink)" opacity={0.2} />
      <path d="M-6,1 V10.4 M6,1 V10.4" stroke="var(--ink)" strokeWidth={2.4} strokeLinecap="round" />
      <path d="M-6,1 V10.4 M6,1 V10.4" stroke="var(--corp-chrome)" strokeWidth={1.2} strokeLinecap="round" />
      <rect x={-10.5} y={-10.5} width={21} height={12.5} rx={1.6} fill="var(--hollowell)" stroke="var(--ink)" strokeWidth={1} />
      <rect x={-8.6} y={-8.6} width={8.6} height={8.6} rx={1.2} fill="var(--paper-hi, var(--paper))" />
      <path d="M-6.6,-6.8 V-1.8 M-2,-6.8 V-1.8 M-6.6,-4.3 H-2" stroke="var(--hollowell)" strokeWidth={1.4} strokeLinecap="round" />
      <path d="M1.6,-7 H8.2 M1.6,-4.3 H6.4 M1.6,-1.6 H7.4" stroke="var(--paper-hi, var(--paper))" strokeWidth={1.1} strokeLinecap="round" opacity={0.9} />
      <path d="M-9.6,-9.6 L-3.6,-9.6 L-9.6,-4.6 Z" fill="#fff" opacity={0.4} />
    </g>
  ),
  // Plan item 417: a market stall on freed ground: a striped awning over a laden trestle, in the players' warm paper.
  stall: (
    <g strokeLinejoin="round">
      <ellipse cx={0} cy={8.6} rx={10.5} ry={1.6} fill="var(--ink)" opacity={0.18} />
      <path d="M-8,-2 V8 M8,-2 V8" {...ink} strokeWidth={1.2} />
      <rect x={-9} y={2} width={18} height={4.2} rx={0.8} fill="var(--soil)" {...ink} strokeWidth={0.9} />
      <circle cx={-5} cy={1.2} r={1.9} fill="var(--clay)" stroke="var(--ink)" strokeWidth={0.6} />
      <circle cx={-1} cy={1} r={1.9} fill="var(--wheat)" stroke="var(--ink)" strokeWidth={0.6} />
      <circle cx={3} cy={1.2} r={1.9} fill="var(--pasture)" stroke="var(--ink)" strokeWidth={0.6} />
      <circle cx={6.6} cy={1.4} r={1.6} fill="var(--clay)" stroke="var(--ink)" strokeWidth={0.6} />
      {/* Plan item 717: the awning stirs in the breeze (styles: .awning-stir). */}
      <g className="awning-stir">
        <path d="M-10.5,-3 L-8,-9.5 H8 L10.5,-3 Z" fill="var(--paper-hi, var(--paper))" {...ink} strokeWidth={1} />
        <path d="M-6.3,-9.5 L-7.4,-3 H-4.4 L-3.8,-9.5 Z M-1.3,-9.5 L-1.5,-3 H1.5 L1.3,-9.5 Z M3.8,-9.5 L4.4,-3 H7.4 L6.3,-9.5 Z" fill="var(--clay)" />
        <path d="M-10.5,-3 q1.3,1.8 2.6,0 q1.3,1.8 2.6,0 q1.3,1.8 2.6,0 q1.3,1.8 2.6,0 q1.3,1.8 2.6,0 q1.3,1.8 2.6,0 q1.3,1.8 2.6,0 q1.3,1.8 2.6,0" fill="var(--clay)" {...ink} strokeWidth={0.8} />
      </g>
    </g>
  ),
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
  const ground = marks.filter((m) => m.kind !== 'stall' && m.kind !== 'hsign')
  const stalls = marks.filter((m) => m.kind === 'stall')
  const signs = marks.filter((m) => m.kind === 'hsign')
  return (
    <>
    {ground.length > 0 && <g className="region-ground land-layer" pointerEvents="none" aria-hidden="true" opacity={0.75} data-marks={ground.length}>
      {ground.map((m, i) => (
        <g key={i} data-kind={m.kind} transform={`translate(${m.x.toFixed(1)},${m.y.toFixed(1)}) rotate(${m.r}) scale(${m.s})`}>
          {AMBIENT[m.kind] ? (
            <g className={AMBIENT[m.kind]} data-phase={i % 4}>
              {ART[m.kind]}
            </g>
          ) : (
            ART[m.kind]
          )}
        </g>
      ))}
    </g>}
    {stalls.length > 0 && (
      <g className="free-stalls" pointerEvents="none" aria-hidden="true" data-stalls={stalls.length}>
        {stalls.map((m, i) => (
          <g key={i} className="free-stall" data-kind="stall" transform={`translate(${m.x.toFixed(1)},${m.y.toFixed(1)}) scale(${m.s})`}>
            {ART.stall}
          </g>
        ))}
      </g>
    )}
    {signs.map((m, i) => (
      <g key={`s${i}`} className="held-sign" data-kind="hsign" pointerEvents="none" aria-hidden="true" transform={`translate(${m.x.toFixed(1)},${m.y.toFixed(1)}) scale(${m.s})`}>
        {ART.hsign}
      </g>
    ))}
    </>
  )
}
