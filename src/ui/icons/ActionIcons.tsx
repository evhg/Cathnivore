import type { ReactNode } from 'react'

// STYLE.md 5.1: same 24px grid, flat fill, 2px ink outline as ResourceIcons.tsx. One icon per action
// kind, drawn at the start of each action button (Game.tsx's `actionsPanel`).
const INK = 'var(--ink, #2B2320)'
const CLAY = 'var(--clay, #B5523B)'
const PASTURE = 'var(--pasture, #5B7F3A)'
const WHEAT = 'var(--wheat, #D9B45A)'
const PAPER_2 = 'var(--paper-2, #EAE0CF)'
const HOLLOWELL = 'var(--hollowell, #FF7A1A)'
const CANDOR = 'var(--candor, #3FC1D9)'

function Base({ size = 16, children }: { size?: number; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="icon-inline">
      {children}
    </svg>
  )
}

export function SellIcon(props: { size?: number }) {
  return (
    <Base {...props}>
      <circle cx="12" cy="15" r="7" fill={WHEAT} stroke={INK} strokeWidth={1.5} />
      <path d="M12 3 L12 12 M8 8 L12 12 L16 8" fill="none" stroke={INK} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Base>
  )
}

export function InvestIcon(props: { size?: number }) {
  return (
    <Base {...props}>
      <rect x="4" y="5" width="14" height="16" rx="2" fill={PAPER_2} stroke={INK} strokeWidth={1.5} />
      <line x1="7" y1="12" x2="15" y2="12" stroke={INK} strokeWidth={1} opacity={0.5} />
      <line x1="7" y1="15" x2="15" y2="15" stroke={INK} strokeWidth={1} opacity={0.5} />
      <line x1="7" y1="18" x2="12" y2="18" stroke={INK} strokeWidth={1} opacity={0.5} />
      <circle cx="17.5" cy="6.5" r="3.5" fill={WHEAT} stroke={INK} strokeWidth={1.2} />
    </Base>
  )
}

// A folded note "sent" like a paper dart — Cath's Plan cards are "notes from her pocket" (STYLE.md 8),
// and this reads unmistakably apart from Invest's rounded card even in greyscale/silhouette
// (STYLE.md 2.3): a first pass reused Invest's rectangle-plus-ruled-lines shape with only a rotation and
// a missing coin badge to tell them apart, which a zoomed render showed was nowhere near distinct enough.
// A gate-8 review of *this* redraw still found it collapsed into a plain rewind/skip-back chevron at
// true ~18px size — the body was too thin. Widened the dart and shaded one wing darker (folded paper
// catching less light) so it keeps a visible paper-like body instead of two bare strokes.
export function SchemeIcon(props: { size?: number }) {
  return (
    <Base {...props}>
      <path d="M3 12.5 L20 3.5 L13 12.5 L20 21.5 Z" fill={PAPER_2} stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
      <path d="M3 12.5 L20 21.5 L13 12.5 Z" fill={INK} opacity={0.15} />
      <line x1="13" y1="12.5" x2="3" y2="12.5" stroke={INK} strokeWidth={1.2} opacity={0.7} />
    </Base>
  )
}

export function GraftIcon(props: { size?: number }) {
  return (
    <Base {...props}>
      <ellipse cx="12" cy="20" rx="5" ry="2" fill={CLAY} stroke={INK} strokeWidth={1.2} />
      <path d="M12 20 L12 10" stroke={PASTURE} strokeWidth={2} strokeLinecap="round" />
      <path d="M12 12 Q7.5 10.5 6.5 6 Q11 7.5 12 12 Z" fill={PASTURE} stroke={INK} strokeWidth={1.1} />
      <path d="M12 10 Q16.5 8.5 17.5 4 Q13 5.5 12 10 Z" fill={PASTURE} stroke={INK} strokeWidth={1.1} />
    </Base>
  )
}

// STYLE.md 6's Stall piece: "small awning with scalloped edge." A first pass gave the flat canopy strip
// most of the icon's height, so it read as a boxy screen/monitor with only a thin scallop at the very
// bottom — flipped the proportions (a thin canopy strip, a tall scalloped valance) so the awning's
// signature shape is what actually fills the icon.
export function OpenStallIcon(props: { size?: number }) {
  return (
    <Base {...props}>
      <rect x="3" y="4" width="18" height="4" fill={PAPER_2} stroke={INK} strokeWidth={1.5} />
      <path
        d="M3,8 a3.75,4 0 0 0 7.5,0 a3.75,4 0 0 0 7.5,0 L21,20 L3,20 Z"
        fill={CLAY}
        stroke={INK}
        strokeWidth={1.5}
      />
    </Base>
  )
}

// A first pass gave the faded Outlet/Doubt shape no `stroke` at all, on the (wrong) assumption the low
// fill opacity alone would read as "faded" — a gate-8 review found it invisible in practice, leaving
// just a bare X with no box/bubble behind it. The ink outline needs its own (higher) opacity so the
// shape itself stays legible even though its fill is faded.
export function SupplyIcon(props: { size?: number }) {
  return (
    <Base {...props}>
      <rect x="6" y="6" width="12" height="12" rx="2" fill={HOLLOWELL} opacity={0.5} stroke={INK} strokeWidth={1.2} strokeOpacity={0.6} />
      <path d="M6 6 L18 18 M18 6 L6 18" stroke={CLAY} strokeWidth={2.5} strokeLinecap="round" />
    </Base>
  )
}

export function RebutIcon(props: { size?: number }) {
  return (
    <Base {...props}>
      <circle cx="12" cy="11" r="7" fill={CANDOR} opacity={0.5} stroke={INK} strokeWidth={1.2} strokeOpacity={0.6} />
      <path d="M6 5 L18 17 M18 5 L6 17" stroke={CLAY} strokeWidth={2.5} strokeLinecap="round" />
    </Base>
  )
}

export function RoleIcon(props: { size?: number }) {
  return (
    <Base {...props}>
      <path
        d="M12 3 L14.5 9 L21 9.5 L16 13.8 L17.5 20 L12 16.5 L6.5 20 L8 13.8 L3 9.5 L9.5 9 Z"
        fill={WHEAT}
        stroke={INK}
        strokeWidth={1.3}
        strokeLinejoin="round"
      />
    </Base>
  )
}
