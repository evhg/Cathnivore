// STYLE.md 8's "Enemy logos": original marks for the two corporations, glossy (base colour plus a
// highlight, no ink outline — STYLE.md 2's "two materials" rule) rather than the flat ink-outlined
// icons everywhere else. Same 24px grid as the other icon sets for drop-in sizing.

export function HollowellLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="icon-inline">
      <rect x={1} y={1} width={22} height={22} rx={6} fill="var(--hollowell)" />
      <circle cx={17.5} cy={6.5} r={3.4} fill="var(--hollowell-highlight)" />
      {/* the "H", built from two posts and a crossbar rather than a text glyph so it stays a shape */}
      <rect x={5.5} y={5} width={3} height={14} rx={1} fill="var(--paper)" />
      <rect x={15.5} y={5} width={3} height={14} rx={1} fill="var(--paper)" />
      <rect x={7.5} y={10.5} width={9} height={3} fill="var(--paper)" />
      {/* "one cheerful leaf that is clearly plastic" — a rigid, glossy teardrop, not a soft organic one */}
      <path
        d="M 12,3.2 C 14,3.2 14.6,5.4 12,6.6 C 9.4,5.4 10,3.2 12,3.2 Z"
        fill="var(--pasture)"
        stroke="var(--paper)"
        strokeWidth={0.5}
      />
    </svg>
  )
}

export function CandorLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="icon-inline">
      <circle cx={12} cy={12} r={11} fill="var(--candor)" />
      <circle cx={7.5} cy={6.5} r={3.2} fill="var(--candor-highlight)" />
      {/* an open "C": a ring with a wedge cut out, circling a small plus sign */}
      <path
        d="M 16.8,7.2 A 7,7 0 1 0 16.8,16.8"
        fill="none"
        stroke="var(--paper)"
        strokeWidth={3}
        strokeLinecap="round"
      />
      <rect x={10.6} y={9.4} width={2.8} height={5.2} rx={0.6} fill="var(--paper)" />
      <rect x={9.4} y={10.6} width={5.2} height={2.8} rx={0.6} fill="var(--paper)" />
    </svg>
  )
}
