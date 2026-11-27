import type { JSX } from 'react'

// Plan item 722: every Improvement card has its own painted picture (what it buys, not its tag's stock scene), drawn in
// the region tiles' ink-and-flat-colour style inside the vignette's 120x60 frame. Each scene's FIRST child is its
// ground band (VignetteMotif washes that band into an invest card's land); the rest is the subject. Colours are fixed
// art colours (the picture is an object, the same in both themes), from the theme tokens with fallbacks, like
// ActionArt.tsx. Keyed by card id; `tests/card-art.test.ts` checks every Improvement has one.

const INK = 'var(--ink-on-fixed-fill, #2B2320)'
const CREAM = 'var(--art-cream, #F6EEDC)'
const PASTURE = 'var(--pasture, #5B7F3A)'
const LEAF = 'var(--art-leaf, #6E9A44)'
const WHEAT = 'var(--wheat, #D9B45A)'
const SEA = 'var(--sea, #3E6E7E)'
const CLAY = 'var(--clay, #B5523B)'
const APPLE = 'var(--art-apple, #C8432F)'
const WOOD = 'var(--art-wood, #9A6A3F)'
const WOOD_LO = 'var(--art-wood-lo, #6E4A2B)'
const STONE = 'var(--art-stone, #A69A88)'
const SLATE = 'var(--art-slate, #5E6670)'
const PLUM = 'var(--p-sol, #6B4E7A)'
const BLUE = 'var(--p-ines, #4E6A8C)'
const WINE = 'var(--p-mara, #8C2F39)'
const ORANGE = 'var(--hollowell, #FF7A1A)'
const CARROT = 'var(--art-carrot, #E0782E)'

const mix = (a: string, pct: number, b: string = CREAM) => `color-mix(in srgb, ${a} ${pct}%, ${b})`
const line = (w = 1.4, o?: number) => ({ fill: 'none', stroke: INK, strokeWidth: w, strokeLinecap: 'round', strokeLinejoin: 'round', opacity: o }) as const
const fill = (f: string, w = 1.3) => ({ fill: f, stroke: INK, strokeWidth: w, strokeLinejoin: 'round', strokeLinecap: 'round' }) as const
const flat = (f: string, o?: number) => ({ fill: f, opacity: o }) as const

/** A ground band from y to the frame's foot, running far past the frame so wide windows stay filled. */
const band = (y: number, f: string, wave = 0) => (
  <path d={wave ? `M-400 ${y} H0 Q30 ${y - wave} 60 ${y} T120 ${y} H520 V70 H-400Z` : `M-400 ${y} H520 V70 H-400Z`} {...fill(f, 1.1)} />
)
/** A far ridge behind the subject. */
const ridge = (y: number, f: string) => <path d={`M-400 ${y} Q-20 ${y - 6} 20 ${y - 3} T70 ${y - 5} T130 ${y - 2} H520 V${y + 12} H-400Z`} {...flat(f, 0.55)} />

const sheep = (x: number, y: number, s = 1, coat = CREAM, face = INK) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M-6 3 v4 M4 3 v4" {...line(1.3)} />
    <path d="M-9 0 q0 -6 6 -6 q3 -3 7 0 q5 0 5 5 q0 5 -6 5 h-7 q-5 0 -5 -4z" {...fill(coat)} />
    <ellipse cx="11" cy="-3" rx="3.2" ry="2.6" {...flat(face)} />
  </g>
)
const crate = (x: number, y: number, w: number, h: number, f = WOOD) => (
  <g>
    <rect x={x} y={y} width={w} height={h} {...fill(f)} />
    <path d={`M${x} ${y + h / 2} H${x + w} M${x + w / 3} ${y} V${y + h} M${x + (2 * w) / 3} ${y} V${y + h}`} {...line(0.9, 0.55)} />
  </g>
)
const fish = (x: number, y: number, f = SLATE, s = 1) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M-6 0 q6 -4 11 0 q-5 4 -11 0z M5 0 l4 -3 v6z" {...fill(f, 1)} />
    <circle cx="-3" cy="-0.6" r="0.7" {...flat(INK)} />
  </g>
)
const waves = (y: number, xs: number[]) => <path d={xs.map((x) => `M${x} ${y + ((x * 7) % 5)} q4 -3 8 0 t8 0`).join(' ')} {...line(1, 0.7)} />

export const CARD_ART: Record<string, JSX.Element> = {
  // a shop of its own on the farm: pitched roof, a window of goods, an apple basket at the door
  'farm-shop': (
    <>
      {band(46, mix(PASTURE, 60))}
      {ridge(38, mix(PASTURE, 40))}
      <path d="M30 48 V28 L52 14 L74 28 V48Z" {...fill(mix(CLAY, 70))} />
      <path d="M26 30 L52 11 L78 30" {...fill('none', 2.2)} />
      <rect x="36" y="32" width="14" height="10" {...fill(CREAM)} />
      <circle cx="40" cy="38" r="1.8" {...flat(APPLE)} />
      <circle cx="45" cy="38" r="1.8" {...flat(WHEAT)} />
      <rect x="56" y="32" width="10" height="16" {...fill(WOOD)} />
      <rect x="40" y="20" width="24" height="6" rx="1" {...fill(WHEAT, 1)} />
      <path d="M80 48 q0 -6 7 -6 q7 0 7 6z" {...fill(WOOD)} />
      <circle cx="84" cy="42" r="2.2" {...fill(APPLE, 0.8)} />
      <circle cx="89" cy="41.5" r="2.2" {...fill(APPLE, 0.8)} />
    </>
  ),
  // paddocks of three greens split by fences, the flock on the freshest one
  'rotational-grazing': (
    <>
      {band(34, mix(PASTURE, 45))}
      <path d="M-400 34 H40 L20 70 H-400Z" {...flat(mix(PASTURE, 85))} />
      <path d="M40 34 H80 L100 70 H20Z" {...flat(mix(LEAF, 55))} />
      <path d="M40 34 L20 62 M80 34 L100 62 M-10 34 H130" {...line(1.2)} />
      <path d="M24 56 v-4 M30 47 v-4 M35 40 v-4 M94 56 v-4 M88 47 v-4 M84 40 v-4" {...line(1.2)} />
      {sheep(52, 46, 0.9)}
      {sheep(70, 52, 0.8)}
      {sheep(62, 40, 0.6)}
    </>
  ),
  // a striped butcher's van with its hatch up
  'mobile-butcher': (
    <>
      {band(50, mix(STONE, 55))}
      {ridge(40, mix(PASTURE, 45))}
      <path d="M18 50 V24 H70 L84 34 V50Z" {...fill(CREAM)} />
      <path d="M18 30 H70 M18 36 H70" {...{ ...line(3), stroke: WINE }} />
      <path d="M70 24 L84 34 H70Z" {...fill(mix(SEA, 50))} />
      <path d="M24 22 L64 22 L68 14 L20 14Z" {...fill(WINE)} />
      <path d="M28 14 v8 M38 14 v8 M48 14 v8 M58 14 v8" {...{ ...line(2.2), stroke: CREAM }} />
      <circle cx="30" cy="51" r="5" {...fill(INK)} />
      <circle cx="72" cy="51" r="5" {...fill(INK)} />
      <circle cx="30" cy="51" r="1.8" {...flat(STONE)} />
      <circle cx="72" cy="51" r="1.8" {...flat(STONE)} />
      <path d="M92 30 h12 v8 h-12z M98 38 v10" {...fill(WOOD, 1.1)} />
    </>
  ),
  // a soil core in a glass tube beside the report's bar chart
  'soil-lab-report': (
    <>
      {band(44, mix(WOOD, 55))}
      <path d="M-400 50 H520 M-400 56 H520" {...line(0.9, 0.4)} />
      <rect x="22" y="10" width="40" height="40" rx="2" {...fill(CREAM)} />
      <rect x="34" y="7" width="16" height="6" rx="1.5" {...fill(SLATE)} />
      <path d="M28 44 V36 M36 44 V28 M44 44 V32 M52 44 V22" {...{ ...line(4.2), stroke: PASTURE, strokeLinecap: 'butt' }} />
      <path d="M27 20 H42" {...line(1, 0.6)} />
      <rect x="74" y="12" width="10" height="36" rx="5" {...fill(mix(BLUE, 20))} />
      <rect x="75.5" y="28" width="7" height="6" {...flat(WOOD_LO)} />
      <rect x="75.5" y="34" width="7" height="6" {...flat(WOOD)} />
      <rect x="75.5" y="40" width="7" height="6" rx="2" {...flat(mix(WOOD, 60, STONE))} />
      <path d="M90 50 q4 -12 10 -16 q-2 8 -6 16" {...fill(LEAF, 1)} />
    </>
  ),
  // the round's crate: carrots, a cabbage and leeks, on its way down the lane
  'veg-box-round': (
    <>
      {band(48, mix(PASTURE, 55))}
      <path d="M50 48 L44 70 H84 L74 48Z" {...flat(mix(STONE, 60))} />
      {ridge(40, mix(PASTURE, 35))}
      <path d="M30 26 l-4 -12 M36 26 l2 -14 M42 26 l6 -12" {...{ ...line(2.4), stroke: LEAF }} />
      <path d="M26 30 l6 -14 l4 2z M36 30 l2 -15 l4 1z" {...fill(CARROT, 1)} />
      <circle cx="58" cy="26" r="8" {...fill(LEAF)} />
      <path d="M52 24 q6 4 12 0 M55 20 q3 6 6 0" {...line(0.9, 0.6)} />
      <path d="M72 30 V10 M76 30 V12" {...{ ...line(3.2), stroke: mix(LEAF, 40) }} />
      <path d="M72 12 l-4 -6 M76 12 l4 -6" {...{ ...line(2), stroke: PASTURE }} />
      {crate(20, 28, 64, 18)}
    </>
  ),
  // trestles of oyster bags at low water, an opened shell with its pearl in front
  'oyster-beds': (
    <>
      {band(32, mix(SEA, 65))}
      <path d="M-400 44 H520 V70 H-400Z" {...flat(mix(WHEAT, 45, STONE))} />
      {[10, 34, 58, 82].map((x) => (
        <g key={x}>
          <path d={`M${x} 34 h18 v4 h-18z`} {...fill(mix(SLATE, 60))} />
          <path d={`M${x + 2} 38 v6 M${x + 16} 38 v6`} {...line(1.2)} />
        </g>
      ))}
      {waves(26, [6, 40, 78])}
      <path d="M44 56 q16 -10 32 0 q-16 6 -32 0z" {...fill(mix(STONE, 70))} />
      <path d="M46 54 q14 -16 28 0" {...fill(mix(STONE, 40, CREAM))} />
      <circle cx="60" cy="54" r="3" {...fill(CREAM, 1)} />
    </>
  ),
  // a wooden stand by the road: jars, eggs and an honesty box
  'roadside-stand': (
    <>
      {band(44, mix(PASTURE, 60))}
      <path d="M-400 54 H520 V70 H-400Z" {...flat(mix(SLATE, 45))} />
      <path d="M-400 61 H520" {...{ ...line(1.4, 0.5), stroke: CREAM, strokeDasharray: '6 6' }} />
      <path d="M26 20 L50 12 L94 12 L70 20Z" {...fill(WOOD_LO)} />
      <path d="M30 20 V50 M66 20 V50" {...line(2)} />
      <rect x="26" y="34" width="44" height="5" {...fill(WOOD)} />
      <rect x="31" y="27" width="6" height="7" rx="1" {...fill(WHEAT, 1)} />
      <rect x="39" y="27" width="6" height="7" rx="1" {...fill(APPLE, 1)} />
      <ellipse cx="51" cy="32" rx="2.4" ry="3" {...fill(CREAM, 1)} />
      <ellipse cx="56" cy="32" rx="2.4" ry="3" {...fill(CREAM, 1)} />
      <rect x="60" y="27" width="8" height="7" {...fill(SLATE, 1)} />
      <path d="M62 29 h4" {...{ ...line(1), stroke: CREAM }} />
      <path d="M86 50 V30 M80 30 h14 v8 h-14z" {...fill(CREAM, 1.2)} />
    </>
  ),
  // a shaggy old-breed cow, horns and fringe, on her hill
  'heritage-herd': (
    <>
      {band(44, mix(PASTURE, 65), 6)}
      {ridge(34, mix(PLUM, 30))}
      <path d="M30 44 v8 M38 44 v8 M66 44 v8 M74 44 v8" {...line(2.4)} />
      <path d="M26 28 q2 -6 12 -6 h28 q12 0 12 10 q0 14 -14 14 h-24 q-14 0 -14 -12z" {...fill(CARROT)} />
      <path d="M32 30 l2 6 M44 28 l1 7 M56 28 l1 7 M66 30 l1 6" {...line(1, 0.5)} />
      <path d="M78 26 q8 -2 12 4 q2 10 -6 12 q-8 0 -8 -8z" {...fill(CARROT)} />
      <path d="M80 26 q-4 -8 -10 -6 M90 28 q6 -6 4 -12" {...fill('none', 2.2)} />
      <path d="M80 28 q4 4 10 2" {...{ ...line(2.2), stroke: WOOD_LO }} />
      <path d="M24 30 q-6 4 -4 12" {...line(1.6)} />
    </>
  ),
  // a polytunnel's hoops over rows of seedlings
  polytunnel: (
    <>
      {band(46, mix(WOOD, 50))}
      {ridge(40, mix(PASTURE, 45))}
      <path d="M14 48 V36 Q14 14 56 14 Q98 14 98 36 V48Z" {...fill(mix(CREAM, 60, SEA))} />
      <path d="M28 48 V30 Q30 18 40 16 M56 14 V48 M84 48 V30 Q82 18 72 16" {...line(1, 0.6)} />
      <path d="M22 46 h68" {...line(1, 0.5)} />
      {[24, 34, 44, 64, 74, 84].map((x) => (
        <path key={x} d={`M${x} 46 v-6 m0 2 q-4 -1 -4 -5 m4 3 q4 -1 4 -5`} {...{ ...line(1.4), stroke: PASTURE }} />
      ))}
      <path d="M48 48 V30 H64 V48" {...fill(mix(SEA, 30, CREAM), 1.1)} />
    </>
  ),
  // a tide gauge post marked in feet, the moon that pulls it
  'tide-tables': (
    <>
      {band(38, mix(SEA, 70))}
      {waves(44, [4, 30, 66, 90])}
      <rect x="54" y="8" width="8" height="46" {...fill(CREAM)} />
      <path d="M54 14 h4 M54 20 h8 M54 26 h4 M54 32 h8 M54 38 h4 M54 44 h8" {...line(1.1)} />
      <path d="M54 32 h8 v22 h-8z" {...flat(mix(SEA, 50), 0.6)} />
      <path d="M96 8 a7 7 0 1 0 6 10 a5.5 5.5 0 1 1 -6 -10z" {...fill(CREAM, 1.1)} />
      <path d="M14 18 h22 v20 h-22z" {...fill(CREAM, 1)} />
      <path d="M16 30 q4 -8 8 0 t8 0" {...{ ...line(1.2), stroke: SEA }} />
      <path d="M17 22 h16" {...line(0.8, 0.5)} />
    </>
  ),
  // inked flyers off the press, a roller and its ink
  'letterpress-flyers': (
    <>
      {band(44, mix(WOOD, 60))}
      <path d="M18 46 L24 18 L54 20 L50 48Z" {...fill(CREAM)} />
      <path d="M30 46 L36 14 L66 16 L62 46Z" {...fill(CREAM)} />
      <path d="M40 20 H60 M39 26 H58" {...{ ...line(2.8), stroke: PLUM }} />
      <path d="M39 32 H58 M38 36 H56 M38 40 H54" {...line(1, 0.6)} />
      <ellipse cx="88" cy="44" rx="14" ry="3.5" {...flat(PLUM, 0.8)} />
      <rect x="76" y="30" width="22" height="9" rx="4.5" {...fill(PLUM)} />
      <path d="M98 34 h6 l2 -12" {...line(2)} />
    </>
  ),
  // three neighbours' flocks through one shared gate
  'grazing-co-op': (
    <>
      {band(42, mix(PASTURE, 65), 4)}
      {ridge(34, mix(PASTURE, 40))}
      <path d="M40 46 V26 M80 46 V26" {...line(2.6)} />
      <path d="M40 30 H80 M40 38 H80 M40 30 L80 38" {...{ ...line(1.8), stroke: WOOD_LO }} />
      {sheep(20, 48, 0.9)}
      {sheep(60, 52, 0.9, mix(INK, 30))}
      {sheep(98, 48, 0.9, mix(WHEAT, 55))}
      <path d="M58 14 h14 l3 3 l-3 3 h-14z" {...fill(WHEAT, 1)} />
      <path d="M58 14 V26" {...line(1.4)} />
    </>
  ),
  // a cabinet of labelled seed drawers, one pulled open with a sprouting packet
  'seed-library': (
    <>
      {band(48, mix(WOOD, 45))}
      <rect x="20" y="10" width="50" height="40" {...fill(WOOD)} />
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => (
          <g key={`${r}${c}`}>
            <rect x={23 + c * 15.5} y={13 + r * 12} width="13" height="9" {...fill(mix(WOOD, 60))} />
            <rect x={27 + c * 15.5} y={15.5 + r * 12} width="5" height="2.6" {...flat(CREAM)} />
          </g>
        )),
      )}
      <rect x="78" y="26" width="16" height="22" {...fill(CREAM)} />
      <circle cx="86" cy="36" r="4" {...flat(mix(WHEAT, 70))} />
      <path d="M86 26 V16 M86 20 q-6 -1 -7 -7 M86 18 q6 -1 7 -7" {...{ ...line(1.6), stroke: PASTURE }} />
    </>
  ),
  // shelves of jars and tins for anyone who needs them, a heart on the door
  'community-larder': (
    <>
      {band(50, mix(CLAY, 35))}
      <path d="M18 50 V14 Q18 8 24 8 H66 Q72 8 72 14 V50Z" {...fill(mix(PASTURE, 70))} />
      <rect x="23" y="13" width="44" height="34" {...fill(CREAM, 1.1)} />
      <path d="M23 25 H67 M23 37 H67" {...line(1.4)} />
      {[26, 34, 42, 52, 60].map((x, i) => (
        <rect key={x} x={x} y={17} width="6" height="8" rx="1" {...fill([APPLE, WHEAT, CARROT, LEAF, WINE][i]!, 0.9)} />
      ))}
      {[26, 36, 46, 56].map((x, i) => (
        <rect key={x} x={x} y={30} width="8" height="7" {...fill([SLATE, SEA, STONE, CLAY][i]!, 0.9)} />
      ))}
      <path d="M90 28 c-6 -6 -12 2 0 10 c12 -8 6 -16 0 -10z" {...fill(APPLE)} />
      <path d="M26 41 h10 M42 41 h16" {...line(2, 0.4)} />
    </>
  ),
  // a fish stall on the harbour wall with its licence plate nailed up
  'harbour-stall-licence': (
    <>
      {band(42, mix(STONE, 70))}
      <path d="M-400 50 H520 V70 H-400Z" {...flat(mix(SEA, 70))} />
      {waves(56, [8, 44, 82])}
      <path d="M22 22 H70 L74 28 H18Z" {...fill(SEA)} />
      <path d="M28 22 L26 28 M40 22 V28 M52 22 V28 M64 22 L66 28" {...{ ...line(2), stroke: CREAM }} />
      <path d="M22 28 V42 M70 28 V42" {...line(1.6)} />
      <rect x="20" y="34" width="52" height="6" {...fill(mix(SEA, 25))} />
      {fish(30, 33, SLATE, 0.8)}
      {fish(46, 33, mix(SEA, 50, STONE), 0.8)}
      {fish(61, 33, SLATE, 0.8)}
      <rect x="84" y="16" width="22" height="16" rx="1" {...fill(CREAM)} />
      <path d="M88 21 H102 M88 25 H98" {...line(0.9, 0.6)} />
      <circle cx="102" cy="30" r="3.4" {...fill(WINE, 1)} />
    </>
  ),
  // a painted banner strung over the square, with bunting
  'market-day-banner': (
    <>
      {band(48, mix(STONE, 50))}
      <path d="M12 50 V8 M108 50 V8" {...line(2.4)} />
      <path d="M12 12 Q60 22 108 12 V30 Q60 40 12 30Z" {...fill(PLUM)} />
      <path d="M28 22 Q60 31 92 22" {...{ ...line(3.4), stroke: WHEAT }} />
      <path d="M12 36 Q60 46 108 36" {...line(1)} />
      {[22, 38, 54, 70, 86, 100].map((x, i) => (
        <path key={x} d={`M${x} ${38 + Math.sin((x / 108) * Math.PI) * 6} l3 6 l3 -6z`} {...fill([CLAY, WHEAT, SEA, LEAF, CLAY, WHEAT][i]!, 0.8)} />
      ))}
      <path d="M30 50 v-6 h10 v6 M72 50 v-6 h10 v6" {...fill(CLAY, 1)} />
    </>
  ),
  // a bakelite phone off its hook on this morning's paper
  'press-contact': (
    <>
      {band(42, mix(WOOD, 55))}
      <path d="M16 48 L22 26 L64 28 L60 52Z" {...fill(CREAM)} />
      <path d="M26 31 H56" {...line(3)} />
      <path d="M25 37 H40 M24 41 H40 M23 45 H40" {...line(1, 0.6)} />
      <rect x="44" y="36" width="12" height="10" {...flat(mix(SLATE, 40))} />
      <path d="M66 48 q-2 -14 14 -14 h4 q16 0 14 14z" {...fill(INK)} />
      <circle cx="82" cy="42" r="3.6" {...fill(CREAM, 0.8)} />
      <path d="M64 30 q0 -8 6 -8 l20 0 q6 0 6 8 l-6 2 q-2 -4 -6 -4 h-8 q-4 0 -6 4z" {...fill(INK)} />
      <path d="M96 30 q8 4 4 14 q-4 8 4 10" {...line(1.2)} />
    </>
  ),
  // a pipe along the furrows, its sprinklers throwing arcs of water
  'irrigation-line': (
    <>
      {band(38, mix(WHEAT, 55))}
      {[44, 50, 56].map((y) => (
        <path key={y} d={`M-400 ${y} H520`} {...line(1.2, 0.35)} />
      ))}
      {[14, 30, 46, 62, 78, 94].map((x) => (
        <path key={x} d={`M${x} 44 v-5 m0 2 q-3 -1 -3 -4 m3 2 q3 -1 3 -4`} {...{ ...line(1.3), stroke: PASTURE }} />
      ))}
      <path d="M-400 48 H520" {...{ ...line(3.4), stroke: SLATE }} />
      {[30, 78].map((x) => (
        <g key={x}>
          <path d={`M${x} 48 V36`} {...line(1.6)} />
          <path d={`M${x} 36 q-12 -10 -22 2 M${x} 36 q12 -10 22 2`} {...{ ...line(1.4), stroke: SEA, strokeDasharray: '2 3' }} />
        </g>
      ))}
    </>
  ),
  // a white cold store with frost on the door and a snowflake on its sign
  'cold-store': (
    <>
      {band(48, mix(PASTURE, 50))}
      <path d="M20 48 V18 Q20 14 24 14 H84 Q88 14 88 18 V48Z" {...fill(mix(BLUE, 12))} />
      <path d="M20 22 H88" {...line(1)} />
      <rect x="40" y="26" width="28" height="22" {...fill(mix(BLUE, 30))} />
      <path d="M44 30 V48 M54 30 V48 M64 30 V48" {...line(0.8, 0.4)} />
      <path d="M62 36 h3" {...line(2.2)} />
      <path d="M48 26 h12" {...{ ...line(2.6), stroke: CREAM }} />
      <path d="M100 18 v14 M94 21 l12 8 M94 29 l12 -8" {...{ ...line(2), stroke: BLUE }} />
      <path d="M92 48 h12 v-8 h-12z" {...fill(WOOD, 1)} />
    </>
  ),
  // a satellite over the farm and the forecast it sends to the dish
  'satellite-forecast': (
    <>
      {band(46, mix(PASTURE, 55))}
      <rect x="40" y="12" width="12" height="10" {...fill(SLATE)} />
      <rect x="20" y="13" width="18" height="8" {...fill(BLUE, 1)} />
      <rect x="54" y="13" width="18" height="8" {...fill(BLUE, 1)} />
      <path d="M26 13 v8 M32 13 v8 M60 13 v8 M66 13 v8" {...{ ...line(0.8), stroke: CREAM }} />
      <path d="M46 26 L82 40" {...{ ...line(1.2), strokeDasharray: '2 3' }} />
      <path d="M78 44 q0 -10 10 -12 q2 10 -10 12z" {...fill(CREAM)} />
      <path d="M86 40 l6 8 M82 48 h14" {...line(1.6)} />
      <circle cx="18" cy="38" r="5" {...fill(WHEAT, 1)} />
      <path d="M18 44 q-6 0 -6 -4 q0 -4 6 -4 q2 -4 8 -2 q6 0 6 5 q0 5 -6 5z" {...fill(CREAM, 1)} />
    </>
  ),
  // a pallet of crates ready for the wholesaler and the account book that keeps it
  'wholesale-account': (
    <>
      {band(48, mix(STONE, 55))}
      <rect x="16" y="46" width="52" height="4" {...fill(WOOD_LO)} />
      {crate(16, 32, 25, 14)}
      {crate(43, 32, 25, 14)}
      {crate(28, 18, 25, 14)}
      <path d="M78 48 L80 22 L104 20 L104 46Z" {...fill(WINE)} />
      <path d="M81 24 L102 22 V44 L80 46" {...fill(CREAM, 1)} />
      <path d="M84 28 H98 M84 32 H98 M84 36 H94" {...line(0.9, 0.6)} />
      <path d="M92 40 l3 3 l6 -8" {...{ ...line(1.6), stroke: PASTURE }} />
    </>
  ),
  // kelp fronds rising under the surface from their long lines, buoys on top
  'kelp-beds': (
    <>
      {band(18, mix(SEA, 70))}
      <path d="M-400 30 H520 V70 H-400Z" {...flat(mix(SEA, 85, INK), 0.5)} />
      <path d="M-400 18 H520" {...{ ...line(1.4), stroke: CREAM }} />
      {waves(14, [10, 50, 92])}
      <path d="M-400 24 H520" {...line(1, 0.6)} />
      {[16, 38, 60, 82, 104].map((x, i) => (
        <path key={x} d={`M${x} 24 q${i % 2 ? 5 : -5} 10 0 18 q${i % 2 ? -5 : 5} 8 0 16`} {...{ ...fill('none', 3.6), stroke: i % 2 ? LEAF : mix(PASTURE, 80, WHEAT) }} />
      ))}
      <circle cx="28" cy="17" r="3.6" {...fill(ORANGE, 1.1)} />
      <circle cx="72" cy="17" r="3.6" {...fill(ORANGE, 1.1)} />
    </>
  ),
  // a broadsheet folded to Cath's column, her pen across it
  'op-ed-column': (
    <>
      {band(44, mix(WOOD, 55))}
      <path d="M14 50 L18 10 L90 12 L88 52Z" {...fill(CREAM)} />
      <path d="M22 18 H84" {...line(3.2)} />
      <rect x="22" y="24" width="22" height="24" {...fill(mix(WHEAT, 40), 1.1)} />
      <path d="M25 28 H41 M25 32 H41 M25 36 H38 M25 40 H41 M25 44 H36" {...line(0.9, 0.7)} />
      <path d="M50 26 H82 M50 30 H82 M50 34 H76 M50 38 H82 M50 42 H72 M50 46 H80" {...line(0.8, 0.45)} />
      <path d="M62 56 L104 22 L108 26 L66 58Z" {...fill(WINE)} />
      <path d="M62 56 l-4 4 l6 -1z" {...fill(WHEAT, 1)} />
    </>
  ),
  // a hut on the ridge with a big ear trumpet and its aerial
  'listening-post': (
    <>
      {band(44, mix(PASTURE, 60), 8)}
      <path d="M30 44 V28 H58 V44Z" {...fill(WOOD)} />
      <path d="M26 30 L44 18 L62 30" {...fill(WOOD_LO)} />
      <rect x="36" y="32" width="8" height="6" {...fill(WHEAT, 1)} />
      <path d="M52 18 V4 M48 8 h8 M49 12 h6" {...line(1.4)} />
      <path d="M62 34 L82 24 Q92 18 96 28 Q98 38 86 38 L64 38Z" {...fill(mix(PLUM, 55))} />
      <ellipse cx="91" cy="31" rx="5" ry="8" {...fill(INK)} />
      <path d="M102 22 q4 9 0 18 M108 18 q6 13 0 26" {...line(1.2, 0.7)} />
    </>
  ),
  // a hand press riding a cart on one great wooden wheel
  'wagon-wheel-press': (
    <>
      {band(50, mix(STONE, 45))}
      {ridge(40, mix(PASTURE, 40))}
      <rect x="22" y="32" width="66" height="8" {...fill(WOOD)} />
      <path d="M88 36 L108 30" {...line(2.2)} />
      <path d="M36 32 V14 H64 V32" {...fill(SLATE)} />
      <path d="M40 20 H60 M50 14 V8 M42 8 H58" {...{ ...line(2), stroke: CREAM }} />
      <path d="M42 26 H58" {...line(3)} />
      <circle cx="42" cy="44" r="12" {...fill('none', 2.6)} />
      <path d="M42 32 V56 M30 44 H54 M34 36 L50 52 M50 36 L34 52" {...line(1.4)} />
      <circle cx="42" cy="44" r="2.6" {...fill(WOOD_LO)} />
      <circle cx="78" cy="48" r="6" {...fill(WOOD, 1.6)} />
    </>
  ),
  // the village's compost bays, one steaming, a barrow tipping in
  'compost-exchange': (
    <>
      {band(46, mix(PASTURE, 55))}
      <path d="M14 48 V26 H76 V48 M34 48 V26 M54 48 V26" {...fill('none', 1.6)} />
      <path d="M14 30 H76 M14 36 H76 M14 42 H76" {...{ ...line(1.2), stroke: WOOD }} />
      <path d="M16 48 q8 -14 16 0z M36 48 q8 -18 16 0z M56 48 q8 -12 16 0z" {...fill(WOOD_LO, 1.1)} />
      <path d="M40 22 q-3 -4 0 -8 t0 -8 M48 22 q-3 -4 0 -8" {...line(1.2, 0.45)} />
      <path d="M80 40 L100 34 L104 44 L84 48Z" {...fill(PASTURE)} />
      <circle cx="84" cy="50" r="3.6" {...fill(INK)} />
      <path d="M102 38 L114 46" {...line(2)} />
      <path d="M82 38 q4 -4 10 -3" {...{ ...line(1.8), stroke: LEAF }} />
    </>
  ),
  // a hedge line on the windward side, the flock sheltering in its lee
  'windbreak-hedgerow': (
    <>
      {band(40, mix(PASTURE, 60))}
      <path d="M-400 42 H40 Q42 26 52 28 Q56 18 66 22 Q74 14 84 22 Q96 20 98 30 Q108 28 110 42 H520 V46 H-400Z" {...fill(PASTURE)} />
      <path d="M50 34 q4 -2 6 2 M68 28 q4 -2 6 2 M86 30 q4 -2 6 2" {...line(1, 0.5)} />
      <path d="M4 18 h18 q4 0 4 -3 M2 26 h24 M8 34 h14 q4 0 4 3" {...line(1.2, 0.55)} />
      {sheep(66, 52, 0.8)}
      {sheep(88, 50, 0.7)}
      <path d="M100 44 v10" {...line(2)} />
    </>
  ),
  // a stone smokehouse at the water's edge, smoke curling, fish hung to cure
  'tidal-smokehouse': (
    <>
      {band(46, mix(STONE, 60))}
      <path d="M-400 52 H520 V70 H-400Z" {...flat(mix(SEA, 70))} />
      {waves(58, [10, 50, 90])}
      <path d="M24 48 V24 H64 V48Z" {...fill(STONE)} />
      <path d="M30 28 h6 M42 32 h8 M30 38 h10 M50 42 h8" {...line(0.9, 0.45)} />
      <path d="M20 26 L44 12 L68 26" {...fill(SLATE)} />
      <rect x="54" y="10" width="7" height="10" {...fill(STONE, 1.1)} />
      <path d="M57 8 q-4 -4 0 -8 M62 6 q4 -3 2 -8" {...line(1.6, 0.5)} />
      <rect x="38" y="34" width="12" height="14" {...fill(WOOD_LO)} />
      <path d="M74 22 H104 M76 22 V48 M102 22 V48" {...line(1.6)} />
      {fish(82, 30, mix(WHEAT, 60, WOOD), 0.75)}
      {fish(94, 34, mix(WHEAT, 60, WOOD), 0.75)}
    </>
  ),
  // a phone in the grass, its map pinned where the soil was sampled
  'field-notes-app': (
    <>
      {band(40, mix(PASTURE, 60))}
      <path d="M-400 48 H520" {...line(1, 0.3)} />
      <rect x="40" y="6" width="28" height="48" rx="4" {...fill(INK)} />
      <rect x="43" y="11" width="22" height="36" rx="1" {...flat(mix(LEAF, 45))} />
      <path d="M43 24 q8 4 22 -2 M43 36 q10 -6 22 2" {...{ ...line(1, 0.6), stroke: CREAM }} />
      <path d="M54 30 q-4 -4 -4 -7 a4 4 0 0 1 8 0 q0 3 -4 7z" {...fill(APPLE, 0.9)} />
      <path d="M86 48 q-2 -12 6 -18 q2 10 -6 18 M86 48 q2 -8 -6 -12" {...fill(LEAF, 1)} />
      <path d="M14 48 q2 -6 6 -8" {...{ ...line(1.4), stroke: PASTURE }} />
    </>
  ),
  // the autumn fair: a striped tent, lanterns and a heap of squash
  'late-harvest-fair': (
    <>
      {band(46, mix(WHEAT, 45, WOOD))}
      <path d="M8 6 Q40 18 72 6 Q96 16 116 8" {...line(1)} />
      {[20, 40, 60, 84, 104].map((x, i) => (
        <circle key={x} cx={x} cy={i % 2 ? 13 : 11} r="2.6" {...fill(WHEAT, 0.9)} />
      ))}
      <path d="M22 48 L42 18 L62 48Z" {...fill(CREAM)} />
      <path d="M42 18 L32 48 M42 18 L52 48" {...{ ...line(3.4), stroke: CLAY }} />
      <path d="M42 18 V12 l6 2 l-6 2" {...fill(CLAY, 1)} />
      <path d="M38 48 q4 -8 8 0" {...fill(INK, 0.8)} />
      <ellipse cx="80" cy="44" rx="9" ry="6" {...fill(CARROT)} />
      <ellipse cx="94" cy="46" rx="7" ry="5" {...fill(WHEAT)} />
      <ellipse cx="86" cy="36" rx="6" ry="4.6" {...fill(CARROT)} />
      <path d="M80 38 v-3 M86 32 v-3" {...{ ...line(1.6), stroke: PASTURE }} />
    </>
  ),
  // a larder under snow: hams on hooks, jars and a barrel
  'winter-larder': (
    <>
      {band(48, CREAM)}
      <path d="M14 50 V12 H82 V50" {...fill(WOOD_LO)} />
      <rect x="18" y="16" width="60" height="32" {...flat(mix(WOOD, 45))} />
      <path d="M18 20 H78" {...line(1.6)} />
      {[28, 44].map((x) => (
        <g key={x}>
          <path d={`M${x} 20 v4`} {...line(1)} />
          <path d={`M${x} 24 q-6 4 -4 12 q4 4 8 0 q2 -8 -4 -12z`} {...fill(WINE, 1.1)} />
        </g>
      ))}
      <path d="M54 34 H76" {...line(1.4)} />
      {[56, 63, 70].map((x, i) => (
        <rect key={x} x={x} y="27" width="5" height="7" rx="1" {...fill([APPLE, WHEAT, LEAF][i]!, 0.9)} />
      ))}
      <path d="M92 50 q-4 -8 0 -16 h12 q4 8 0 16z" {...fill(WOOD)} />
      <path d="M90 38 h16 M90 46 h16" {...line(1.2)} />
      <path d="M10 12 Q48 4 86 12" {...{ ...line(3.6), stroke: CREAM }} />
      {[[8, 18], [100, 14], [112, 26], [6, 34]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.4" {...flat(CREAM)} />
      ))}
    </>
  ),
  // a stack of crop crates under a deal tag
  'wholesale-crate-deal': (
    <>
      {band(48, mix(STONE, 50))}
      {crate(12, 34, 28, 14)}
      {crate(42, 34, 28, 14)}
      {crate(27, 20, 28, 14)}
      <circle cx="20" cy="33" r="2.4" {...flat(CARROT)} />
      <circle cx="26" cy="33" r="2.4" {...flat(CARROT)} />
      <circle cx="56" cy="33" r="2.4" {...flat(LEAF)} />
      <circle cx="40" cy="19" r="2.4" {...flat(APPLE)} />
      <path d="M78 14 H100 L108 24 L100 34 H78Z" {...fill(WHEAT)} />
      <circle cx="82" cy="24" r="2" {...fill(CREAM, 1)} />
      <path d="M88 20 H100 M88 26 H98" {...line(1.4)} />
      <path d="M70 26 Q76 30 80 24" {...line(1)} />
    </>
  ),
  // a lighthouse on the point sweeping its beam over the harbour
  'harbour-watch': (
    <>
      {band(38, mix(SEA, 70))}
      {waves(46, [4, 40, 76, 98])}
      <path d="M58 44 L60 26 Q74 20 90 26 L96 44Z" {...fill(mix(STONE, 70))} />
      <path d="M66 44 L69 16 H79 L82 44Z" {...fill(CREAM)} />
      <path d="M67.6 30 H80.4 M68.4 22 H79.6" {...{ ...line(3), stroke: APPLE }} />
      <rect x="68" y="10" width="12" height="6" {...fill(WHEAT, 1.1)} />
      <path d="M66 10 L74 4 L82 10Z" {...fill(INK)} />
      <path d="M68 12 L10 4 V22Z" {...flat(WHEAT, 0.4)} />
      <path d="M14 40 h12 l-2 4 h-8z M20 40 v-8 l6 6" {...fill(CREAM, 1.1)} />
    </>
  ),
  // a mast on the hill with its signal ringing out wide
  'signal-boost': (
    <>
      {band(46, mix(PASTURE, 60), 10)}
      <path d="M54 44 L60 10 L66 44 M56 34 H64 M57.5 24 H62.5 M55 38 L65 30 M56 30 L64 22" {...line(1.4)} />
      <circle cx="60" cy="9" r="3" {...fill(APPLE, 1.1)} />
      <path d="M48 4 q-6 6 0 12 M72 4 q6 6 0 12 M40 0 q-10 10 0 20 M80 0 q10 10 0 20 M32 -2 q-14 12 0 26 M88 -2 q14 12 0 26" {...{ ...line(1.6), stroke: PLUM }} />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={88 + i * 5} y={50 - i * 4} width="3.6" height={4 + i * 4} {...fill(i < 3 ? WHEAT : CREAM, 0.9)} />
      ))}
    </>
  ),
  // an old barn given a great glazed door and warm lights, bunting along its eaves
  'barn-conversion': (
    <>
      {band(48, mix(PASTURE, 55))}
      {ridge(38, mix(PASTURE, 35))}
      <path d="M22 50 V26 L58 8 L94 26 V50Z" {...fill(WINE)} />
      <path d="M22 26 L58 8 L94 26" {...fill('none', 2.4)} />
      <path d="M44 50 V28 Q58 18 72 28 V50Z" {...fill(mix(WHEAT, 70))} />
      <path d="M58 22 V50 M44 38 H72" {...line(1.2)} />
      <path d="M26 30 L58 14 L90 30" {...line(0.8, 0.5)} />
      {[32, 42, 74, 84].map((x, i) => (
        <path key={x} d={`M${x} ${x < 58 ? 30 - (x - 22) * 0.45 : 30 - (94 - x) * 0.45} l2 4 l2 -4z`} {...flat([WHEAT, CREAM, CREAM, WHEAT][i]!)} />
      ))}
      <rect x="28" y="34" width="8" height="8" {...fill(WHEAT, 1)} />
      <rect x="80" y="34" width="8" height="8" {...fill(WHEAT, 1)} />
    </>
  ),
  // a workshop on the quay with a boat up on trestles for mending
  'quayside-workshop': (
    <>
      {band(44, mix(STONE, 65))}
      <path d="M-400 52 H520 V70 H-400Z" {...flat(mix(SEA, 70))} />
      {waves(58, [6, 46, 86])}
      <path d="M10 44 V22 H46 V44Z" {...fill(SEA)} />
      <path d="M6 24 L28 12 L50 24" {...fill(SLATE)} />
      <rect x="18" y="28" width="20" height="16" {...fill(WOOD_LO)} />
      <path d="M22 32 h12 M24 36 l4 -2 l4 2" {...{ ...line(1), stroke: WHEAT }} />
      <path d="M60 30 Q82 40 108 30 L104 38 Q82 44 64 38Z" {...fill(CLAY)} />
      <path d="M62 33 Q82 42 106 33" {...{ ...line(1.4), stroke: CREAM }} />
      <path d="M68 40 l-3 4 M71 40 l3 4 M98 40 l-3 4 M101 40 l3 4" {...line(1.4)} />
    </>
  ),
  // Hollowell's contract: a long scroll, a dotted line and the orange seal
  'wholesome-hollow-contract': (
    <>
      {band(46, mix(WOOD, 50))}
      <path d="M24 12 H84 V48 H24Z" {...fill(CREAM)} />
      <rect x="18" y="8" width="72" height="6" rx="3" {...fill(mix(CREAM, 70, STONE))} />
      <rect x="18" y="46" width="72" height="6" rx="3" {...fill(mix(CREAM, 70, STONE))} />
      <path d="M30 20 H72" {...line(2.4)} />
      <path d="M30 26 H78 M30 30 H76 M30 34 H70" {...line(0.8, 0.5)} />
      <path d="M30 41 H60" {...{ ...line(1), strokeDasharray: '2 2' }} />
      <circle cx="74" cy="40" r="6.5" {...fill(ORANGE)} />
      <path d="M71 40 l2 2 l4 -4" {...{ ...line(1.4), stroke: CREAM }} />
      <path d="M70 46 l-2 8 l4 -2 l2 3 l1 -9" {...fill(ORANGE, 1)} />
      <path d="M96 52 L108 16 L111 17 L100 53Z" {...fill(INK, 1)} />
    </>
  ),
}

export const CARD_ART_SKY: Record<string, string> = {
  'late-harvest-fair': mix(CARROT, 30),
  'winter-larder': mix(BLUE, 22),
  'kelp-beds': mix(SEA, 25),
  'harbour-watch': mix(BLUE, 30),
  'satellite-forecast': mix(BLUE, 20),
}
