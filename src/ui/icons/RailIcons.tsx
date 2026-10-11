import type { ReactNode } from 'react'

// AAA UI M4: the phone tab rail (Farm, Market, Cath's Plan, Log) and the Undo key, plus the board's Menu
// glyph. Same 24px grid, flat fill and ink outline as ResourceIcons.tsx; colours come from tokens.
const INK = 'var(--ink, #2B2320)'
const CLAY = 'var(--clay, #B5523B)'
const PASTURE = 'var(--pasture, #5B7F3A)'
const WHEAT = 'var(--wheat, #D9B45A)'
const SURFACE = 'var(--surface, #FBF8F1)'
const MARA = 'var(--p-mara, #8C2F39)'

function Base({ size = 28, children }: { size?: number; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="icon-inline">
      {children}
    </svg>
  )
}

/** A red barn with a wheat door brace. */
export function FarmIcon(props: { size?: number }) {
  return (
    <Base {...props}>
      <path d="M3.5 10.5 L12 4 L20.5 10.5 L20.5 20 L3.5 20 Z" fill={CLAY} stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
      <rect x="9" y="13" width="6" height="7" fill={SURFACE} stroke={INK} strokeWidth={1.3} />
      <path d="M9 13 L15 20 M15 13 L9 20" stroke={INK} strokeWidth={1.1} />
      <path d="M10.2 8.8 h3.6" stroke={SURFACE} strokeWidth={1.6} strokeLinecap="round" />
    </Base>
  )
}

/** A market stall under a scalloped wheat-and-cream awning. */
export function MarketIcon(props: { size?: number }) {
  return (
    <Base {...props}>
      <path d="M4 9 L20 9 L20 20 L4 20 Z" fill={SURFACE} stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
      <path
        d="M3 9 L5 4 L19 4 L21 9 Q19.4 11.2 17.8 9 Q16.2 11.2 14.6 9 Q13 11.2 11.4 9 Q9.8 11.2 8.2 9 Q6.6 11.2 5 9 Q4 10.4 3 9 Z"
        fill={WHEAT}
        stroke={INK}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      <path d="M9.4 4 L8.2 9 M14.6 4 L15.8 9" stroke={INK} strokeWidth={1.1} />
      <rect x="7" y="14" width="10" height="3" rx="1" fill={PASTURE} stroke={INK} strokeWidth={1.2} />
    </Base>
  )
}

/** Cath's Plan: a folded plan with a wax seal in Mara's red. */
export function PlanIcon(props: { size?: number }) {
  return (
    <Base {...props}>
      <path d="M4 5 L10 3.5 L14 5 L20 3.5 L20 19 L14 20.5 L10 19 L4 20.5 Z" fill={SURFACE} stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
      <path d="M10 3.5 L10 19 M14 5 L14 20.5" stroke={INK} strokeWidth={1.1} />
      <path d="M6.5 14 Q9 9.5 12 12 T17.5 8.5" fill="none" stroke={INK} strokeWidth={1.2} strokeDasharray="1.6 1.6" />
      <circle cx="17" cy="15.5" r="2.6" fill={MARA} stroke={INK} strokeWidth={1.2} />
    </Base>
  )
}

/** The Log: a ledger book with a ribbon. */
export function LogIcon(props: { size?: number }) {
  return (
    <Base {...props}>
      <path d="M5 4 L18 4 Q19.5 4 19.5 5.5 L19.5 20 L6.5 20 Q5 20 5 18.5 Z" fill={PASTURE} stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
      <path d="M5 18.5 Q5 17 6.5 17 L19.5 17" fill="none" stroke={INK} strokeWidth={1.3} />
      <rect x="8.5" y="7" width="7.5" height="4.5" rx=".8" fill={SURFACE} stroke={INK} strokeWidth={1.1} />
      <path d="M15 4 L15 9.5 L16.4 8.4 L17.8 9.5 L17.8 4" fill={WHEAT} stroke={INK} strokeWidth={1} strokeLinejoin="round" />
    </Base>
  )
}

/** Undo: a looping arrow. */
export function UndoIcon(props: { size?: number }) {
  return (
    <Base {...props}>
      <path d="M9 7.5 L5 11 L9 14.5" fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 11 L14 11 Q19 11 19 15.5 Q19 19 14.5 19 L11 19" fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" />
    </Base>
  )
}

/** Menu: three ruled lines, like a ledger. */
export function MenuIcon(props: { size?: number }) {
  return (
    <Base {...props}>
      <path d="M5 7 H19 M5 12 H19 M5 17 H19" stroke={INK} strokeWidth={2} strokeLinecap="round" />
    </Base>
  )
}
