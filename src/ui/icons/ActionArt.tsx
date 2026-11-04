import type { ReactNode } from 'react'

// Plan item 83: each action card carries its own small painted picture (a 40x40 tile: a sky-and-ground
// wash and the subject in flat colour with a soft ink line), in place of the 24px glyph from
// ActionIcons.tsx. Same `{ size }` signature, so Game.tsx's ACTION_ICON can map a kind to either.
// Colours come from the theme tokens with fallbacks; decorative (the card's label is the name).
const INK = 'var(--ink-on-fixed-fill, #2B2320)'
const CLAY = 'var(--clay, #B5523B)'
const PASTURE = 'var(--pasture, #5B7F3A)'
const WHEAT = 'var(--wheat, #D9B45A)'
const CREAM = 'var(--art-cream, #F6EEDC)'
const WOOD = 'var(--art-wood, #9A6A3F)'
const WOOD_LO = 'var(--art-wood-lo, #6E4A2B)'
const SEA = 'var(--sea, #4F7F8C)'
const APPLE = 'var(--art-apple, #C8432F)'
const LEAF = 'var(--art-leaf, #6E9A44)'

const LINE = { stroke: INK, strokeWidth: 1.2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }

function Tile({ size = 32, kind, ground = PASTURE, children }: { size?: number; kind: string; ground?: string; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className="action-art" data-art={kind}>
      <rect x="0.75" y="0.75" width="38.5" height="38.5" rx="7" fill={CREAM} stroke={INK} strokeOpacity={0.35} strokeWidth={1} />
      <path d="M1 29 Q 12 25 20 27 T 39 26 L 39 32 Q 39 39 32 39 L 8 39 Q 1 39 1 32 Z" fill={ground} opacity={0.32} />
      {children}
    </svg>
  )
}

function Coin({ x, y, r = 4.2 }: { x: number; y: number; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={WHEAT} {...LINE} />
      <circle cx={x} cy={y} r={r * 0.55} fill="none" stroke={INK} strokeOpacity={0.45} strokeWidth={0.8} />
    </g>
  )
}

/** A crate of apples, one to three of them on top (the count sold), and the coin it earns. */
export function SellArt({ size, count = 2 }: { size?: number; count?: number }) {
  const apples = [
    [15, 19],
    [21, 18],
    [27, 19.5],
  ].slice(0, Math.max(1, Math.min(3, count)))
  return (
    <Tile size={size} kind="sell">
      {apples.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={3.6} fill={APPLE} {...LINE} />
          <path d={`M${x} ${y! - 3.4} q 1 -2 2.6 -2.2`} fill="none" stroke={LEAF} strokeWidth={1.4} strokeLinecap="round" />
        </g>
      ))}
      <path d="M9 21 L31 21 L29.5 31 L10.5 31 Z" fill={WOOD} {...LINE} />
      <path d="M10 24.5 H30 M10.6 27.8 H29.4" stroke={WOOD_LO} strokeWidth={1} />
      <Coin x={31} y={11} />
      <path d="M24.5 11.5 h-4 M22.5 9.5 l-2 2 l2 2" fill="none" stroke={INK} strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />
    </Tile>
  )
}

/** A shopfront with a hanging sign and a stack of coins: buying an Improvement. */
export function InvestArt({ size }: { size?: number }) {
  return (
    <Tile size={size} kind="invest" ground={SEA}>
      <path d="M8 31 V17 L17 11 L26 17 V31 Z" fill={CREAM} {...LINE} />
      <path d="M6.5 18 L17 10 L27.5 18" fill="none" stroke={SEA} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      <rect x="11" y="21" width="5" height="10" fill={WOOD} {...LINE} />
      <rect x="18.5" y="20" width="5" height="4.5" fill="var(--art-glass, #BFD9DE)" {...LINE} />
      <ellipse cx="31" cy="30.5" rx="4.4" ry="1.8" fill={WHEAT} {...LINE} />
      <ellipse cx="31" cy="27.6" rx="4.4" ry="1.8" fill={WHEAT} {...LINE} />
      <ellipse cx="31" cy="24.7" rx="4.4" ry="1.8" fill={WHEAT} {...LINE} />
    </Tile>
  )
}

/** Cath's plan: a pinned paper with a red string between two pins. */
export function SchemeArt({ size }: { size?: number }) {
  return (
    <Tile size={size} kind="scheme" ground={CLAY}>
      <path d="M8 8 L31 9.5 L32 31 L9 30 Z" fill={CREAM} {...LINE} />
      <path d="M12 14 H22 M12 17.5 H19 M12 24 H17" stroke={INK} strokeOpacity={0.45} strokeWidth={1.1} strokeLinecap="round" />
      <path d="M14 21 Q 21 15 27 23" fill="none" stroke={APPLE} strokeWidth={1.4} strokeDasharray="0" />
      <circle cx="14" cy="21" r="1.9" fill={APPLE} {...LINE} />
      <circle cx="27" cy="23" r="1.9" fill={APPLE} {...LINE} />
      <path d="M25 11 l4 4 m0 -4 l-4 4" stroke={CLAY} strokeWidth={1.6} strokeLinecap="round" />
    </Tile>
  )
}

/** Graft: a trowel beside a seedling, and the coin the hard work earns. */
export function GraftArt({ size }: { size?: number }) {
  return (
    <Tile size={size} kind="graft">
      <path d="M12 30 Q 12 22 12 18" fill="none" stroke={LEAF} strokeWidth={1.8} strokeLinecap="round" />
      <path d="M12 22 Q 6 21 5.5 16 Q 11 16 12 22 Z" fill={LEAF} {...LINE} />
      <path d="M12 19 Q 17 16 18.5 11 Q 12.5 12 12 19 Z" fill={LEAF} {...LINE} />
      <path d="M7 30.5 Q 12 27.5 17 30.5" fill={WOOD_LO} opacity={0.8} />
      <path d="M22 31 L27 20" stroke={WOOD} strokeWidth={2.6} strokeLinecap="round" />
      <path d="M26 21.5 L30.5 11 Q 33.5 13 32 18 Z" fill="var(--art-steel, #A9AEB0)" {...LINE} />
      <Coin x={30} y={30} r={3.6} />
    </Tile>
  )
}

/** A market stall under a striped awning. */
export function OpenStallArt({ size }: { size?: number }) {
  return (
    <Tile size={size} kind="openStall">
      <path d="M10 18 V31 M30 18 V31" stroke={WOOD_LO} strokeWidth={1.8} strokeLinecap="round" />
      <rect x="9" y="24" width="22" height="7" fill={WOOD} {...LINE} />
      <circle cx="14" cy="22.5" r="2.2" fill={APPLE} {...LINE} />
      <circle cx="19" cy="22.6" r="2.2" fill={WHEAT} {...LINE} />
      <circle cx="24" cy="22.5" r="2.2" fill={LEAF} {...LINE} />
      <path d="M7 12 H33 L31 18 H9 Z" fill={CREAM} {...LINE} />
      <path d="M11.3 12 L10.6 18 M18 12 L17.6 18 M24.6 12 L24.8 18 M31 12 L30 15" stroke={CLAY} strokeWidth={3.2} />
      <path d="M7 12 H33 L31 18 H9 Z" fill="none" {...LINE} />
      <path d="M9 18 q 2.75 2.4 5.5 0 q 2.75 2.4 5.5 0 q 2.75 2.4 5.5 0 q 2.75 2.4 5.5 0" fill={CREAM} {...LINE} />
    </Tile>
  )
}

/** Supply: a little delivery van with produce crates, driving a corporation's outlet out. */
export function SupplyArt({ size }: { size?: number }) {
  return (
    <Tile size={size} kind="supply">
      <path d="M5 28 V17 H22 V28 Z" fill={PASTURE} {...LINE} />
      <path d="M22 20 H28.5 L33 24.5 V28 H22 Z" fill={PASTURE} {...LINE} />
      <path d="M24 21.5 H28 L30.6 24.3 H24 Z" fill="var(--art-glass, #BFD9DE)" {...LINE} />
      <rect x="8" y="13" width="6" height="4" fill={WOOD} {...LINE} />
      <rect x="14.5" y="13" width="5.5" height="4" fill={WOOD} {...LINE} />
      <circle cx="10.5" cy="11.6" r="1.7" fill={APPLE} {...LINE} />
      <circle cx="17" cy="11.6" r="1.7" fill={WHEAT} {...LINE} />
      <circle cx="11" cy="29" r="2.9" fill={INK} />
      <circle cx="11" cy="29" r="1.1" fill={CREAM} />
      <circle cx="27.5" cy="29" r="2.9" fill={INK} />
      <circle cx="27.5" cy="29" r="1.1" fill={CREAM} />
      <path d="M2.5 21 H0.5 M3 24 H1" stroke={INK} strokeOpacity={0.5} strokeWidth={1.1} strokeLinecap="round" />
    </Tile>
  )
}

/** Rebut: the Bugle torn in two, a corporation's spin answered. */
export function RebutArt({ size }: { size?: number }) {
  return (
    <Tile size={size} kind="rebut" ground={CLAY}>
      <path d="M7 10 L19 9 L18 15 L20 19 L17.5 24 L19 31 L8 31 Z" fill={CREAM} {...LINE} />
      <path d="M22 9.5 L33 10.5 L32 31 L21 31 L19.5 24 L22 19 L20 15 Z" fill={CREAM} {...LINE} transform="rotate(6 26 20)" />
      <path d="M9.5 13.5 H16 M9.5 17 H15 M9.5 20.5 H14 M9.5 26 H15" stroke={INK} strokeOpacity={0.45} strokeWidth={1.1} strokeLinecap="round" />
      <g transform="rotate(6 26 20)">
        <rect x="23" y="13" width="7" height="5" fill="var(--hollowell, #FF7A1A)" opacity={0.85} />
        <path d="M23 22 H30 M23 25.5 H29" stroke={INK} strokeOpacity={0.45} strokeWidth={1.1} strokeLinecap="round" />
      </g>
    </Tile>
  )
}

/** A producer's role: a rosette with ribbons. */
export function RoleArt({ size }: { size?: number }) {
  return (
    <Tile size={size} kind="role" ground={WHEAT}>
      <path d="M15 22 L11 33 L14.5 31.5 L16.5 34.5 L19.5 24 M25 22 L29 33 L25.5 31.5 L23.5 34.5 L20.5 24" fill={CLAY} {...LINE} />
      <circle cx="20" cy="17" r="9" fill={WHEAT} {...LINE} />
      <circle cx="20" cy="17" r="5.6" fill={CREAM} {...LINE} />
      <path d="M20 13.4 l1.1 2.3 2.5 .3 -1.8 1.7 .5 2.5 -2.3 -1.2 -2.3 1.2 .5 -2.5 -1.8 -1.7 2.5 -.3 Z" fill={CLAY} />
    </Tile>
  )
}
