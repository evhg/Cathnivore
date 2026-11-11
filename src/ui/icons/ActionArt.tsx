import { useContext, type ReactNode } from 'react'
import { ArtSceneContext, RoleProducerContext } from './artScene'

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
  // Plan item 218: in the desktop hand the tile opens out into a wide window: the same subject, centred, standing
  // in its land (a sky wash, a far ridge and the near ground running the window's width).
  // Plan item 320: the window is full-bleed (`slice`: the land runs to the card's edges at any shape, the card's own
  // frame clips it), and its top-left corner carries the card family's seal, so families tell apart in greyscale.
  if (useContext(ArtSceneContext)) {
    return (
      <svg viewBox="-2 1 44 40" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className="action-art" data-art={kind} data-scene="">
        <rect x="-40" y="-10" width="120" height="60" fill={CREAM} />
        <rect x="-40" y="-10" width="120" height="31.5" fill={SEA} opacity={0.12} />
        <path d="M-40 25 Q -24 18 -12 24 Q -6 19 4 23 T 24 21 T 44 22 T 64 20 T 80 22 L80 50 L-40 50 Z" fill={ground} opacity={0.18} />
        <path d="M-40 30 Q -20 26 -4 28 Q 0 26 8 28.5 T 30 27 T 52 28 T 80 27 L80 50 L-40 50 Z" fill={ground} opacity={0.32} />
        <circle cx="38" cy="9.5" r="3.2" fill={WHEAT} opacity={0.55} />
        {children}
        <FamilySeal kind={kind} />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className="action-art" data-art={kind}>
      <rect x="0.75" y="0.75" width="38.5" height="38.5" rx="7" fill={CREAM} stroke={INK} strokeOpacity={0.35} strokeWidth={1} />
      <path d="M1 29 Q 12 25 20 27 T 39 26 L 39 32 Q 39 39 32 39 L 8 39 Q 1 39 1 32 Z" fill={ground} opacity={0.32} />
      {children}
    </svg>
  )
}

// Plan item 320: each card family's seal, a shape of its own (a coin, a house, a pin, a leaf, an awning, a wheel, a
// torn page, a star) in cream on the family's colour (table.css sets `--fam` on the card; these are fallbacks).
const SEAL_FILL: Record<string, string> = {
  sell: 'var(--fam, #3F5F27)',
  invest: 'var(--fam, #4F7F8C)',
  scheme: 'var(--fam, #8E3B28)',
  graft: 'var(--fam, #5B7F3A)',
  openStall: 'var(--fam, #9A6A3F)',
  supply: 'var(--fam, #6E4A2B)',
  rebut: 'var(--fam, #4A3A33)',
  role: 'var(--fam, #B5523B)',
}
const SEAL_GLYPH: Record<string, ReactNode> = {
  sell: <><circle cx="0" cy="0" r="2.2" fill="none" stroke={CREAM} strokeWidth={1} /><circle cx="0" cy="0" r="0.7" fill={CREAM} /></>,
  invest: <path d="M-2.3 2.2 V-0.4 L0 -2.4 L2.3 -0.4 V2.2 Z" fill={CREAM} />,
  scheme: <><circle cx="0" cy="-0.9" r="1.5" fill={CREAM} /><path d="M0 0.4 V2.6" stroke={CREAM} strokeWidth={0.9} strokeLinecap="round" /></>,
  graft: <path d="M-2.2 2.2 Q -2.4 -2.2 2.3 -2.4 Q 2.4 2.2 -2.2 2.2 Z" fill={CREAM} />,
  openStall: <path d="M-2.6 -1.6 H2.6 L2.1 0.2 Q 1.2 1.2 0.4 0.2 Q -0.5 1.2 -1.3 0.2 Q -2.1 1.2 -2.6 0.2 Z M-2 0.8 V2.4 M2 0.8 V2.4" fill={CREAM} stroke={CREAM} strokeWidth={0.6} strokeLinejoin="round" />,
  supply: <><circle cx="0" cy="0" r="2.1" fill="none" stroke={CREAM} strokeWidth={0.9} /><path d="M0 -2.1 V2.1 M-2.1 0 H2.1" stroke={CREAM} strokeWidth={0.7} /></>,
  rebut: <path d="M-2 -2.4 H2 V-0.2 L1 0.6 L1.6 1.4 L0.8 2.4 H-2 Z" fill={CREAM} />,
  role: <path d="M0 -2.6 L0.75 -0.8 L2.5 -0.8 L1.1 0.4 L1.6 2.3 L0 1.2 L-1.6 2.3 L-1.1 0.4 L-2.5 -0.8 L-0.75 -0.8 Z" fill={CREAM} />,
}
function FamilySeal({ kind }: { kind: string }) {
  const glyph = SEAL_GLYPH[kind]
  if (!glyph) return null
  return (
    <g transform="translate(8.6 7.6)" className="action-seal" data-seal={kind}>
      <circle r="4" fill={SEAL_FILL[kind]} stroke={CREAM} strokeWidth={0.9} />
      {glyph}
    </g>
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

function Apple({ x, y, r = 3.4 }: { x: number; y: number; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={APPLE} {...LINE} />
      <path d={`M${x} ${y - r * 0.95} q 1 -2 2.6 -2.2`} fill="none" stroke={LEAF} strokeWidth={1.4} strokeLinecap="round" />
    </g>
  )
}

/** Selling, a picture per size of sale (plan item 320: Sell 1, 2 and 3 never share one): one apple in a trug
 * basket, a crate of them, a barrow piled high; the coin it earns beside each. */
export function SellArt({ size, count = 2 }: { size?: number; count?: number }) {
  const n = Math.max(1, Math.min(3, count))
  if (n === 1) {
    return (
      <Tile size={size} kind="sell">
        <g data-sell="1">
          <path d="M12 22 Q 19 9 26 22" fill="none" stroke={WOOD_LO} strokeWidth={1.6} strokeLinecap="round" />
          <Apple x={19} y={19.5} />
          <path d="M10 22 H28 L25.5 30 Q 19 32 12.5 30 Z" fill={WOOD} {...LINE} />
          <path d="M11.2 25 Q 19 26.6 26.8 25 M12.2 28 Q 19 29.4 25.8 28" fill="none" stroke={WOOD_LO} strokeWidth={0.9} />
          <Coin x={31} y={12} r={3.6} />
        </g>
      </Tile>
    )
  }
  if (n === 3) {
    return (
      <Tile size={size} kind="sell">
        <g data-sell="3">
          <path d="M26 24 L35 30 M26.5 27.5 L35.5 31" stroke={WOOD_LO} strokeWidth={1.6} strokeLinecap="round" />
          <Apple x={10} y={18.2} r={3} />
          <Apple x={15.6} y={17.6} r={3} />
          <Apple x={21.2} y={18} r={3} />
          <Apple x={12.8} y={13.2} r={3} />
          <Apple x={18.4} y={12.8} r={3} />
          <Apple x={15.6} y={8.4} r={2.8} />
          <path d="M5 20 H27 L24 27.5 H8.5 Z" fill={WOOD} {...LINE} />
          <path d="M6.6 23.6 H25.6" stroke={WOOD_LO} strokeWidth={1} />
          <path d="M11 27.5 L9.5 32 M21.5 27.5 L23 31" stroke={WOOD_LO} strokeWidth={1.4} strokeLinecap="round" />
          <circle cx="9.5" cy="31.5" r="2.8" fill={INK} />
          <circle cx="9.5" cy="31.5" r="1" fill={CREAM} />
          <Coin x={32} y={13} />
          <Coin x={30} y={18.5} r={3.4} />
        </g>
      </Tile>
    )
  }
  return (
    <Tile size={size} kind="sell">
      <g data-sell="2">
        <Apple x={16} y={18.6} r={3.6} />
        <Apple x={23} y={18.4} r={3.6} />
        <path d="M9 21 L31 21 L29.5 31 L10.5 31 Z" fill={WOOD} {...LINE} />
        <path d="M10 24.5 H30 M10.6 27.8 H29.4" stroke={WOOD_LO} strokeWidth={1} />
        <Coin x={31} y={11} />
        <path d="M24.5 11.5 h-4 M22.5 9.5 l-2 2 l2 2" fill="none" stroke={INK} strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round" opacity={0.7} />
      </g>
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

/** A producer's role, as the producer's own ability: Mara's injunction nailed to a post with her gavel, Tomas's
 * market-day bunting over a stall, Ines's doctor's bag, Sol's microphone on air. A rosette when no producer is known. */
export function RoleArt({ size }: { size?: number }) {
  const producer = useContext(RoleProducerContext)
  if (producer === 'mara') {
    return (
      <Tile size={size} kind="role" ground={WHEAT}>
        <g data-role-scene="mara">
          <rect x="18.2" y="6" width="3.6" height="29" rx="0.8" fill={WOOD} {...LINE} />
          <path d="M10 10.5 L30 9.5 L30.5 25.5 L10.5 26.5 Z" fill={CREAM} {...LINE} />
          <path d="M13 14 H27 M13 17.2 H25 M13 20.4 H22" stroke={INK} strokeOpacity={0.45} strokeWidth={1} strokeLinecap="round" />
          <circle cx="20" cy="9.9" r="1.1" fill={INK} />
          <circle cx="26.2" cy="22.6" r="2.3" fill={APPLE} {...LINE} />
          <g transform="rotate(-24 27 31)">
            <rect x="24.5" y="30.4" width="13" height="2.4" rx="1.1" fill={WOOD_LO} {...LINE} />
            <rect x="21" y="27.4" width="5.6" height="8.4" rx="1.4" fill={WOOD} {...LINE} />
          </g>
        </g>
      </Tile>
    )
  }
  if (producer === 'tomas') {
    return (
      <Tile size={size} kind="role" ground={PASTURE}>
        <g data-role-scene="tomas">
          <path d="M5 34 V9 M35 34 V9" stroke={WOOD_LO} strokeWidth={1.8} strokeLinecap="round" />
          <path d="M5 10 Q 20 16 35 10" fill="none" stroke={INK} strokeOpacity={0.6} strokeWidth={0.9} />
          <path d="M8 11.2 l2 4.2 2.2 -3.2 Z M14 12.9 l2 4.1 2.2 -3.3 Z M20.5 13.4 l2 4 2.2 -3.6 Z M27 12.4 l1.9 4 2.3 -3.5 Z" fill={APPLE} stroke={INK} strokeWidth={0.7} strokeLinejoin="round" />
          <path d="M11 22 H29 L31 26 H9 Z" fill={CREAM} {...LINE} />
          <path d="M13.5 22 L12.6 26 M18 22 L17.6 26 M22 22 L22.4 26 M26.5 22 L27.4 26" stroke={APPLE} strokeWidth={2.2} />
          <rect x="11" y="26" width="18" height="8" fill={WOOD} {...LINE} />
          <circle cx="15" cy="25.6" r="1.6" fill={APPLE} {...LINE} />
          <circle cx="19.6" cy="25.4" r="1.6" fill={LEAF} {...LINE} />
          <circle cx="24.4" cy="25.6" r="1.6" fill={WHEAT} {...LINE} />
        </g>
      </Tile>
    )
  }
  if (producer === 'ines') {
    return (
      <Tile size={size} kind="role" ground={SEA}>
        <g data-role-scene="ines">
          <path d="M15 17 Q 15 11.5 20 11.5 Q 25 11.5 25 17" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
          <path d="M15 17 Q 15 11.5 20 11.5 Q 25 11.5 25 17" fill="none" stroke={WOOD_LO} strokeWidth={1.2} strokeLinecap="round" />
          <path d="M8 18.5 Q 8 16.5 10 16.5 H30 Q 32 16.5 32 18.5 L33 32 Q 33 34 31 34 H9 Q 7 34 7 32 Z" fill={WOOD_LO} {...LINE} />
          <path d="M7.6 22 H32.4" stroke={INK} strokeOpacity={0.5} strokeWidth={0.9} />
          <rect x="16.5" y="23.5" width="7" height="7" rx="1" fill={CREAM} {...LINE} />
          <path d="M20 24.6 V29.4 M17.6 27 H22.4" stroke={APPLE} strokeWidth={1.8} strokeLinecap="round" />
          <circle cx="31" cy="12" r="2.2" fill="none" stroke={INK} strokeWidth={1.1} />
          <path d="M31 14.2 Q 31 18 28 19" fill="none" stroke={INK} strokeWidth={1.1} strokeLinecap="round" />
        </g>
      </Tile>
    )
  }
  if (producer === 'sol') {
    return (
      <Tile size={size} kind="role" ground={CLAY}>
        <g data-role-scene="sol">
          <path d="M20 26 V33 M14.5 34 H25.5" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
          <path d="M14.5 19 Q 14.5 26.5 20 26.5 Q 25.5 26.5 25.5 19" fill="none" stroke={INK} strokeWidth={1.3} strokeLinecap="round" />
          <rect x="16.2" y="8" width="7.6" height="14" rx="3.8" fill={WOOD_LO} {...LINE} />
          <path d="M16.6 12 H23.4 M16.4 15 H23.6 M16.6 18 H23.4" stroke={CREAM} strokeOpacity={0.55} strokeWidth={0.8} />
          <path d="M10.5 11 Q 8 15 10.5 19 M7 9 Q 3.5 15 7 21 M29.5 11 Q 32 15 29.5 19 M33 9 Q 36.5 15 33 21" fill="none" stroke={APPLE} strokeWidth={1.2} strokeLinecap="round" />
          <circle cx="31.5" cy="30" r="2.6" fill={APPLE} {...LINE} />
          <circle cx="31.5" cy="30" r="1" fill={CREAM} opacity={0.8} />
        </g>
      </Tile>
    )
  }
  return (
    <Tile size={size} kind="role" ground={WHEAT}>
      <path d="M15 22 L11 33 L14.5 31.5 L16.5 34.5 L19.5 24 M25 22 L29 33 L25.5 31.5 L23.5 34.5 L20.5 24" fill={CLAY} {...LINE} />
      <circle cx="20" cy="17" r="9" fill={WHEAT} {...LINE} />
      <circle cx="20" cy="17" r="5.6" fill={CREAM} {...LINE} />
      <path d="M20 13.4 l1.1 2.3 2.5 .3 -1.8 1.7 .5 2.5 -2.3 -1.2 -2.3 1.2 .5 -2.5 -1.8 -1.7 2.5 -.3 Z" fill={CLAY} />
    </Tile>
  )
}
