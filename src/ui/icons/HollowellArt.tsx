import type { ReactNode } from 'react'

// Plan item 100: Hollowell's plan cards get pictures in the corporations' own look, beside the players' painted
// action tiles (ActionArt.tsx): glossy white plastic, Hollowell orange and Candor teal, a faint "H" watermark,
// hard clean lines and no paint wash. Decorative (the card's headline names the move).
const PLASTIC = 'var(--plastic-white, #FFFFFF)'
const PLASTIC_SHADE = 'var(--plastic-shade, #E4ECEE)'
const ORANGE = 'var(--hollowell, #FF7A1A)'
const ORANGE_LO = 'var(--hollowell-lo, #E5620A)'
const TEAL = 'var(--candor, #3FC1D9)'
const TEAL_INK = 'var(--candor-ink, #0B4F5C)'
const INK = 'var(--ink-on-fixed-fill, #2B2320)'

export type PlanKind = 'squeeze' | 'expand' | 'scout' | 'buyout'

const LINE = { stroke: TEAL_INK, strokeWidth: 1, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }

function Panel({ size = 28, kind, children }: { size?: number; kind: PlanKind; children: ReactNode }) {
  const id = `hp-${kind}`
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className="plan-art" data-plan-art={kind}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={PLASTIC} />
          <stop offset="0.55" stopColor={PLASTIC} />
          <stop offset="1" stopColor={PLASTIC_SHADE} />
        </linearGradient>
      </defs>
      <rect x="0.75" y="0.75" width="38.5" height="38.5" rx="9" fill={`url(#${id})`} stroke={TEAL_INK} strokeOpacity={0.45} strokeWidth={1} />
      {/* the logo watermark: an "H" of two posts and a bar, very faint */}
      <g fill={ORANGE} opacity={0.12}>
        <rect x="8" y="7" width="5" height="26" rx="1.5" />
        <rect x="27" y="7" width="5" height="26" rx="1.5" />
        <rect x="11" y="17.5" width="18" height="5" />
      </g>
      {children}
      {/* the gloss: a hard highlight across the top, as on moulded plastic */}
      <path d="M4 9 Q 4 3.5 9.5 3.5 L 30.5 3.5 Q 36 3.5 36 9 Q 20 6 4 9 Z" fill={PLASTIC} opacity={0.75} />
    </svg>
  )
}

/** A stall in a clamp: Squeeze presses a region's producers. */
function SqueezeArt() {
  return (
    <>
      <path d="M13 19 L20 14 L27 19 L27 28 L13 28 Z" fill={PLASTIC_SHADE} {...LINE} />
      <path d="M13 19 L27 19" stroke={TEAL_INK} strokeWidth={1} />
      <rect x="17.5" y="22" width="5" height="6" fill={INK} opacity={0.55} />
      <rect x="5" y="15" width="5" height="16" rx="1.5" fill={ORANGE} {...LINE} />
      <rect x="30" y="15" width="5" height="16" rx="1.5" fill={ORANGE} {...LINE} />
      <path d="M10 23 H12.5 M30 23 H27.5" stroke={TEAL_INK} strokeWidth={2} strokeLinecap="round" />
      <path d="M7.5 33 V35 M32.5 33 V35" stroke={TEAL_INK} strokeWidth={1.2} strokeLinecap="round" />
    </>
  )
}

/** Outlets stamped across a hex: Expand adds Hollowell's shops. */
function ExpandArt() {
  return (
    <>
      <path d="M20 9 L30 14.5 L30 25.5 L20 31 L10 25.5 L10 14.5 Z" fill={PLASTIC_SHADE} {...LINE} />
      {[
        [15, 17],
        [24, 15],
        [19.5, 24],
      ].map(([x, y], i) => (
        <g key={i}>
          <rect x={x! - 3} y={y! - 2} width="6" height="5" fill={ORANGE} {...LINE} />
          <path d={`M${x! - 3.6} ${y! - 2} L${x} ${y! - 4.6} L${x! + 3.6} ${y! - 2}`} fill={ORANGE_LO} {...LINE} />
        </g>
      ))}
      <path d="M31 30 L35 34 M35 30 V34 H31" fill="none" stroke={TEAL_INK} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </>
  )
}

/** A survey drone over the ground: Scout finds the next region to take. */
function ScoutArt() {
  return (
    <>
      <path d="M8 31 L32 31" stroke={TEAL_INK} strokeOpacity={0.4} strokeWidth={1} />
      <path d="M13 31 L20 21 L27 31 Z" fill={TEAL} opacity={0.28} />
      <rect x="14" y="14" width="12" height="7" rx="3" fill={PLASTIC} {...LINE} />
      <circle cx="20" cy="18" r="2.1" fill={TEAL} {...LINE} />
      <path d="M14 15 L8.5 12 M26 15 L31.5 12" stroke={TEAL_INK} strokeWidth={1.2} strokeLinecap="round" />
      <ellipse cx="8" cy="11.5" rx="4" ry="1.3" fill={ORANGE} {...LINE} />
      <ellipse cx="32" cy="11.5" rx="4" ry="1.3" fill={ORANGE} {...LINE} />
    </>
  )
}

/** A SOLD board on a post: a Buyout takes a region outright. */
function BuyoutArt() {
  return (
    <>
      <path d="M20 21 V34" stroke={TEAL_INK} strokeWidth={2} strokeLinecap="round" />
      <rect x="8" y="11" width="24" height="11" rx="2" fill={ORANGE} {...LINE} />
      <path d="M11 16.5 H29" stroke={PLASTIC} strokeWidth={2.6} strokeLinecap="round" strokeDasharray="3.5 2" />
    </>
  )
}

const ART: Record<PlanKind, () => ReactNode> = { squeeze: SqueezeArt, expand: ExpandArt, scout: ScoutArt, buyout: BuyoutArt }

export function PlanArt({ kind, size }: { kind: PlanKind; size?: number }) {
  const Art = ART[kind]
  return (
    <Panel kind={kind} size={size}>
      <Art />
    </Panel>
  )
}
