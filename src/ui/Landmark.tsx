// Plan items 49 and 55: each region's landmark in the board's ink style, in a 24-unit box round its centre. The
// campaign map draws them on its hexes; the board draws them on each tile (Map.tsx, landmarkSpot.ts).
import type { LandmarkKind } from '../content/campaignMapLayout'


// Plan item 49: each region's landmark, drawn in a 24-unit box round its centre in the board's ink style.
const INK = { stroke: 'var(--ink)', strokeWidth: 1.1, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
export function Landmark({ kind }: { kind: LandmarkKind }) {
  switch (kind) {
    case 'cross':
      return (
        <g {...INK}>
          <path d="M-10 11 H10 V7 H-10 Z M-7 7 V3 H7 V7" fill="var(--region-capital)" />
          <path d="M-1.6 3 V-9 H1.6 V3 Z" fill="var(--paper)" />
          <path d="M-5 -6 H5" strokeWidth={2.2} stroke="var(--soil)" />
          <circle cx={0} cy={-11} r={1.8} fill="var(--wheat)" />
        </g>
      )
    case 'mill':
      return (
        <g {...INK}>
          <path d="M-11 10 V-2 L-4 -8 L3 -2 V10 Z" fill="var(--paper)" />
          <path d="M-4 -8 L3 -2 H-11 Z" fill="var(--clay)" />
          <rect x={-7} y={2} width={4} height={8} fill="var(--soil)" />
          <circle cx={6} cy={4} r={6.5} fill="var(--region-crop)" />
          <path d="M6 -2.5 V10.5 M-0.5 4 H12.5 M1.4 -0.6 L10.6 8.6 M10.6 -0.6 L1.4 8.6" strokeWidth={0.9} />
        </g>
      )
    case 'docks':
      return (
        <g {...INK}>
          <path d="M-12 1 H6 V4 H-12 Z" fill="var(--soil)" />
          <path d="M-9 4 V10 M-3 4 V10 M3 4 V10" />
          <path d="M-12 10 Q-6 8 0 10 T12 10" fill="none" stroke="var(--sea)" />
          <path d="M2 -1 H12 L9.5 -5 H4.5 Z" fill="var(--clay)" />
          <path d="M7 -5 V-12 L11 -6 Z" fill="var(--paper)" />
        </g>
      )
    case 'lighthouse':
      return (
        <g {...INK}>
          <path d="M-12 11 Q-4 6 4 9 T12 11 Z" fill="var(--soil)" opacity={0.5} />
          <path d="M-4 9 L-2.6 -6 H2.6 L4 9 Z" fill="var(--paper)" />
          <path d="M-3.6 3 H3.6 M-3 -2 H3" stroke="var(--clay)" strokeWidth={2} />
          <rect x={-3} y={-10} width={6} height={4} fill="var(--wheat)" />
          <path d="M-4 -10 L0 -13 L4 -10 Z" fill="var(--clay)" />
        </g>
      )
    case 'oak':
      return (
        <g {...INK}>
          <path d="M-2 11 L-1.5 1 L1.5 1 L2 11 Z" fill="var(--soil)" />
          <path d="M-10 2 Q-13 -5 -7 -8 Q-6 -13 0 -12 Q6 -13 7 -8 Q13 -5 10 2 Q6 6 0 3 Q-6 6 -10 2 Z" fill="var(--pasture)" />
          <path d="M-12 11 H12" />
        </g>
      )
    case 'barn':
      return (
        <g {...INK}>
          <path d="M-11 10 V-1 L-6 -8 H6 L11 -1 V10 Z" fill="var(--clay)" />
          <path d="M-4 10 V2 H4 V10 M-4 2 L4 10 M4 2 L-4 10" fill="var(--paper)" strokeWidth={0.9} />
          <path d="M-12 -1 L-6 -9 H6 L12 -1" fill="none" stroke="var(--soil)" strokeWidth={1.6} />
        </g>
      )
    case 'fold':
      return (
        <g {...INK}>
          <path d="M-12 10 Q-12 -2 0 -3 Q12 -2 12 10" fill="none" stroke="var(--soil)" strokeWidth={2.4} strokeDasharray="3 1.4" />
          {[[-5, 4], [4, 6], [0, -0]].map(([x, y]) => (
            <g key={`${x}${y}`} transform={`translate(${x} ${y})`}>
              <ellipse rx={4.2} ry={3} fill="var(--paper)" />
              <circle cx={4} cy={-1.4} r={1.6} fill="var(--ink)" stroke="none" />
            </g>
          ))}
        </g>
      )
    case 'gull':
      return (
        <g {...INK}>
          <path d="M-12 11 L-7 -2 L-1 -6 L4 0 L12 11 Z" fill="var(--paper-2, var(--paper))" />
          <path d="M-12 11 Q-4 8 4 10 T12 11" fill="none" stroke="var(--sea)" />
          <path d="M-6 -9 q2 -2 4 0 q2 -2 4 0 M3 -12 q1.6 -1.6 3.2 0 q1.6 -1.6 3.2 0" fill="none" strokeWidth={1} />
        </g>
      )
    case 'fern':
      return (
        <g {...INK}>
          <path d="M-12 11 H12" />
          {[-6, 0, 6].map((x) => (
            <g key={x} transform={`translate(${x} 0)`}>
              <path d="M0 11 Q-1 0 2 -10" fill="none" stroke="var(--soil)" />
              <path d="M0 6 q-5 -1 -6 -4 M0.5 2 q-5 -1 -6 -4 M1 -2 q-4 -1 -5 -4 M0 6 q5 -2 5 -5 M0.5 2 q4 -2 4.5 -5 M1 -2 q3.5 -2 3.5 -4.5" fill="none" stroke="var(--pasture)" strokeWidth={1.4} />
            </g>
          ))}
        </g>
      )
    case 'tarn':
      return (
        <g {...INK}>
          <ellipse cx={0} cy={4} rx={12} ry={6} fill="var(--region-coast)" />
          <path d="M-5 3 Q0 1 5 3" fill="none" stroke="var(--paper)" strokeWidth={0.9} />
          <path d="M-10 4 V-6 M-8 4 V-9 M9 3 V-7 M11 3 V-4" stroke="var(--soil)" strokeWidth={1.2} />
          <path d="M-10 -6 l-1.4 -2.6 M-8 -9 l1.4 -2.4 M9 -7 l1.3 -2.4" stroke="var(--soil)" strokeWidth={1.8} />
        </g>
      )
  }
}

