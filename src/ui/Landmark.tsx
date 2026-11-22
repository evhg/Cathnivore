// Plan items 49 and 55: each region's landmark in the board's ink style, in a 24-unit box round its centre. The
// campaign map draws them on its hexes; the board draws them on each tile (Map.tsx, landmarkSpot.ts).
import type { LandmarkKind } from '../content/campaignMapLayout'


// Plan item 634: each landmark is a small diorama: it stands on its own ground plate (a lit top face over a darker
// edge, in ink), so the board reads as hand-built pieces set on the regions, not an icon sheet. Inside the same
// 26-unit box landmarkSpot keeps clear (x and y within 13 of the centre, strokes included).
function Plinth({ top, side, cobbles, water, waves, pans }: { top: string; side: string; cobbles?: boolean; water?: boolean; waves?: boolean; pans?: boolean }) {
  return (
    <g className="lm-plinth">
      <path d="M-12.4 7.6 V9.6 Q-12.4 12.4 0 12.4 Q12.4 12.4 12.4 9.6 V7.6 Z" fill={side} />
      <ellipse cx={0} cy={7.6} rx={12.4} ry={3} fill={top} />
      {cobbles && <path d="M-7 7 h2 M-2 8.6 h2 M3 7.2 h2 M7.4 8.4 h2 M-9.4 8.8 h1.6" strokeWidth={0.7} opacity={0.6} />}
      {water && <path d="M1 8.6 Q4 7.2 7 8.6 T12 8.4" fill="none" stroke="var(--sea)" strokeWidth={1.6} />}
      {waves && <path d="M-9 8.2 q1.5 -1 3 0 M-1 9 q1.5 -1 3 0 M6 7.8 q1.5 -1 3 0" fill="none" stroke="var(--paper)" strokeWidth={0.8} />}
      {pans && <path d="M-11 8 L-7.6 6.4 L-4.6 7.6 L-8 9.4 Z M5.4 8.6 L9 7.2 L11.6 8.2 L8.2 9.8 Z" fill="var(--region-coast)" strokeWidth={0.7} />}
    </g>
  )
}

// Plan item 49: each region's landmark, drawn in a 24-unit box round its centre in the board's ink style.
const INK = { stroke: 'var(--ink)', strokeWidth: 1.4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
export function Landmark({ kind }: { kind: LandmarkKind }) {
  switch (kind) {
    case 'cross':
      // Plan item 634: Kingsmarket's clock square: the clock tower over a cobbled square, a striped stall at its foot.
      return (
        <g {...INK}>
          <Plinth top="var(--wheat)" side="var(--region-capital)" cobbles />
          <path d="M-8 7.5 V-5 H-1 V7.5 Z" fill="var(--paper)" />
          <path d="M-9 -5 L-4.5 -12.5 L0 -5 Z" fill="var(--clay)" />
          <circle cx={-4.5} cy={-1.4} r={2.3} fill="var(--wheat)" />
          <path d="M-4.5 -1.4 V-3 M-4.5 -1.4 H-3.3" strokeWidth={0.8} />
          <path d="M-6 7.5 V4 Q-4.5 2.6 -3 4 V7.5" fill="var(--soil)" strokeWidth={0.9} />
          <path d="M2 7.5 V1.5 M10.5 7.5 V1.5" strokeWidth={1.1} />
          <path d="M1 1.5 L2.6 -2 H9.6 L11.4 1.5 Z" fill="var(--paper)" />
          <path d="M4.2 -2 L3.6 1.5 M6.1 -2 V1.5 M8 -2 L8.6 1.5" stroke="var(--clay)" strokeWidth={1.4} />
          <path d="M2.4 4.6 H10" stroke="var(--soil)" strokeWidth={1.6} />
        </g>
      )
    case 'mill':
      // Plan item 634: Rivermead's watermill: the mill house on its bank, the wheel turning in the race.
      return (
        <g {...INK}>
          <Plinth top="var(--region-crop)" side="var(--soil)" water />
          <path d="M-11 7 V-3 L-5 -9 L1 -3 V7 Z" fill="var(--paper)" />
          <path d="M-12 -2.4 L-5 -10 L2 -2.4" fill="none" stroke="var(--clay)" strokeWidth={2.2} />
          <rect x={-7.4} y={1} width={4} height={6} fill="var(--soil)" />
          <rect x={-9.4} y={-3.6} width={2.6} height={2.6} fill="var(--wheat)" strokeWidth={0.9} />
          <g className="amb-sails">
            <circle cx={6.4} cy={2.4} r={6} fill="var(--paper)" />
            <circle cx={6.4} cy={2.4} r={1.4} fill="var(--soil)" />
            <path d="M6.4 -3.6 V8.4 M0.4 2.4 H12.4 M2.2 -1.8 L10.6 6.6 M10.6 -1.8 L2.2 6.6" strokeWidth={0.9} />
          </g>
        </g>
      )
    case 'docks':
      // Plan item 634: Shingle Bay's pier on its legs over the water, a fishing boat at its end.
      return (
        <g {...INK}>
          <Plinth top="var(--sea)" side="var(--region-coast)" waves />
          <path d="M-12 -1 H8 V2 H-12 Z" fill="var(--soil)" />
          <path d="M-12 -1 L-9.5 -1 M-7 -1 V2 M-2 -1 V2 M3 -1 V2" strokeWidth={0.8} />
          <path d="M-10 2 V8 M-4.5 2 V8.5 M1 2 V8 M6 2 V8" strokeWidth={1.3} />
          <path d="M-11 -1 V-6 M-11 -6 l2 1.2" strokeWidth={1.1} />
          <circle cx={-11} cy={-7} r={1.2} fill="var(--wheat)" />
          <g className="amb-bob">
            <path d="M3 4 H12.5 L10.2 7.4 H5 Z" fill="var(--clay)" />
            <path d="M7.6 4 V-10 L12 -2.4 H7.6 Z" fill="var(--paper)" />
          </g>
        </g>
      )
    case 'lighthouse':
      // Plan item 634: Saltmarsh's striped light on its spit, the salt pans laid out at its foot.
      return (
        <g {...INK}>
          <Plinth top="var(--paper)" side="var(--soil)" pans />
          <path d="M-5 7 L-3.3 -6.5 H1.3 L3 7 Z" fill="var(--paper)" />
          <path d="M-4.6 3.6 H2.6 L2.2 0.6 H-4.2 Z M-3.8 -2.6 H1.8 L1.5 -4.6 H-3.5 Z" fill="var(--clay)" strokeWidth={0.8} />
          <rect className="amb-lamp" x={-3.2} y={-10} width={4.4} height={3.5} fill="var(--wheat)" />
          <path d="M-4.4 -10 L-1 -13 L2.4 -10 Z" fill="var(--clay)" />
          <path d="M-5 -6.5 H3" strokeWidth={1.2} />
          <path d="M4.5 7 V2 L8.5 -0.5 L12 2 V7 Z" fill="var(--paper)" />
          <path d="M3.6 2.4 L8.5 -1.4 L12.8 2.4" fill="none" stroke="var(--clay)" strokeWidth={1.4} />
        </g>
      )
    case 'oak':
      // Plan item 634: Oakvale's orchard: three fruiting trees in a row, a basket at their foot.
      return (
        <g {...INK}>
          <Plinth top="var(--pasture)" side="var(--soil)" />
          {[[-7, -1.5, 5.2], [3, -4.5, 6.6], [9, 0.5, 3.8]].map(([x, y, r]) => (
            <g key={x}>
              <path d={`M${x! - 0.8} 7.6 L${x! - 0.5} ${y! + r! * 0.5} H${x! + 0.5} L${x! + 0.8} 7.6 Z`} fill="var(--soil)" strokeWidth={0.9} />
              <circle cx={x} cy={y} r={r} fill="var(--region-crop)" />
              <circle cx={x! - r! * 0.35} cy={y! - r! * 0.15} r={0.95} fill="var(--clay)" stroke="none" />
              <circle cx={x! + r! * 0.3} cy={y! + r! * 0.3} r={0.95} fill="var(--clay)" stroke="none" />
              <circle cx={x! + r! * 0.1} cy={y! - r! * 0.55} r={0.95} fill="var(--clay)" stroke="none" />
            </g>
          ))}
          <path d="M-3.4 6 H0.6 L0 8.4 H-2.8 Z" fill="var(--wheat)" strokeWidth={0.9} />
        </g>
      )
    case 'barn':
      // Plan item 634: Brindle Hills' barn and silo in their yard, a hay bale by the door.
      return (
        <g {...INK}>
          <Plinth top="var(--wheat)" side="var(--soil)" />
          <path d="M-12 7.5 V-1 L-7 -8 H3 L6 -1 V7.5 Z" fill="var(--clay)" />
          <path d="M-12.6 -0.6 L-7 -8.6 H3.2 L6.6 -0.6" fill="none" stroke="var(--soil)" strokeWidth={1.6} />
          <path d="M-6 7.5 V1.5 H1 V7.5 M-6 1.5 L1 7.5 M1 1.5 L-6 7.5" fill="var(--paper)" strokeWidth={0.9} />
          <path d="M7.4 7.5 V-6 Q10 -10 12.6 -6 V7.5 Z" fill="var(--paper)" />
          <path d="M7.4 -2.5 H12.6 M7.4 1.8 H12.6" strokeWidth={0.8} />
          <ellipse cx={-9.6} cy={7.4} rx={2.4} ry={1.6} fill="var(--wheat)" strokeWidth={0.9} />
        </g>
      )
    case 'fold':
      // Plan item 634: Highmoor's sheepfold: a drystone ring on the moor, its flock inside, the gate open.
      return (
        <g {...INK}>
          <Plinth top="var(--pasture)" side="var(--soil)" />
          <path d="M-11.5 7 Q-12 -4 0 -5 Q12 -4 11.5 7" fill="none" stroke="var(--paper)" strokeWidth={3.4} strokeLinecap="butt" />
          <path d="M-11.5 7 Q-12 -4 0 -5 Q12 -4 11.5 7" fill="none" stroke="var(--soil)" strokeWidth={1} strokeDasharray="2.2 1.2" />
          {[[-5.5, 3.6], [4.5, 4.8], [0, -0.6]].map(([x, y]) => (
            <g key={`${x}${y}`} transform={`translate(${x} ${y})`}>
              <ellipse rx={3.6} ry={2.6} fill="var(--paper)" />
              <circle cx={3.4} cy={-1.2} r={1.4} fill="var(--ink)" stroke="none" />
            </g>
          ))}
          <path d="M-12.5 -9 L-8 -12 L-4.5 -9.6 L-1 -12.6 L3 -9.4" fill="none" stroke="var(--soil)" strokeWidth={1} />
        </g>
      )
    case 'gull':
      return (
        <g {...INK}>
          <path d="M-12 11 L-7 -2 L-1 -6 L4 0 L12 11 Z" fill="var(--paper-2, var(--paper))" />
          <path d="M-12 11 Q-4 8 4 10 T12 11" fill="none" stroke="var(--sea)" />
          <path className="amb-glide" d="M-6 -9 q2 -2 4 0 q2 -2 4 0 M3 -12 q1.6 -1.6 3.2 0 q1.6 -1.6 3.2 0" fill="none" strokeWidth={1} />
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

