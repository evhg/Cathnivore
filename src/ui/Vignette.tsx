import { Children, cloneElement, isValidElement, type JSX, type ReactElement, type ReactNode } from 'react'
import { vignetteHash, type VignetteKind } from './vignetteKind'

// Plan item 36: every Market and Plan card carries a small code-drawn scene keyed by its first tag, so a
// player sees their engine as places (a pasture, a jetty, a lab) rather than a list of names. One kit, no
// image files: a sky and ground band in the card's own colour, a motif per tag, and a sun or moon placed
// by the card's id so two cards of one tag don't look stamped out.

const TINT: Record<VignetteKind, string> = {
  pasture: 'var(--pasture)',
  crop: 'var(--wheat)',
  coast: 'var(--sea)',
  community: 'var(--clay)',
  media: 'var(--p-sol)',
  science: 'var(--p-ines)',
  rift: 'var(--hollowell)',
  market: 'var(--wheat)',
  plan: 'var(--p-mara)',
}

const ink = { fill: 'none', stroke: 'var(--ink)', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
const solid = (fill: string) => ({ fill, stroke: 'var(--ink)', strokeWidth: 1.4, strokeLinejoin: 'round' }) as const

const MOTIF: Record<VignetteKind, JSX.Element> = {
  // a fence, a hill and a sheep
  pasture: (
    <>
      <path d="M-400 44 H0 Q30 30 62 40 T120 38 H520 V70 H-400Z" {...solid('color-mix(in srgb, var(--pasture) 70%, var(--paper))')} />
      <path d="M8 50 V40 M22 50 V40 M36 50 V40 M4 43 H40 M4 47 H40" {...ink} />
      <ellipse cx="80" cy="42" rx="11" ry="7" {...solid('var(--paper-hi)')} />
      <circle cx="92" cy="39" r="4" {...solid('var(--ink)')} />
      <path d="M74 48 v5 M86 48 v5" {...ink} />
    </>
  ),
  // furrowed rows to the horizon and a stook of wheat
  crop: (
    <>
      <path d="M-400 36 H520 V70 H-400Z" {...solid('color-mix(in srgb, var(--wheat) 75%, var(--paper))')} />
      <path d="M60 36 L10 60 M60 36 L35 60 M60 36 L60 60 M60 36 L85 60 M60 36 L110 60" {...{ ...ink, strokeWidth: 1.1, opacity: 0.6 }} />
      <path d="M96 52 L100 30 L104 52 M92 50 L100 32 L108 50" {...ink} />
      <ellipse cx="100" cy="30" rx="3" ry="5" {...solid('var(--wheat)')} />
    </>
  ),
  // waves, a jetty and a sailing boat
  coast: (
    <>
      <path d="M-400 38 H520 V70 H-400Z" {...solid('color-mix(in srgb, var(--sea) 70%, var(--paper))')} />
      <path d="M6 46 q6 -4 12 0 t12 0 M50 52 q6 -4 12 0 t12 0 M84 44 q6 -4 12 0 t12 0" {...{ ...ink, strokeWidth: 1.2 }} />
      <path d="M0 36 H34 M8 36 V50 M20 36 V50 M32 36 V50" {...ink} />
      <path d="M64 40 h26 l-4 6 h-18z" {...solid('var(--paper-hi)')} />
      <path d="M77 40 V18 L90 36 H77" {...solid('var(--paper-hi)')} />
    </>
  ),
  // a stall with a striped awning and bunting
  community: (
    <>
      <path d="M-400 46 H520 V70 H-400Z" {...solid('color-mix(in srgb, var(--clay) 45%, var(--paper))')} />
      <path d="M4 12 Q30 22 60 12 T116 12" {...ink} />
      <path d="M14 16 l3 6 l3 -6 M34 19 l3 6 l3 -6 M54 14 l3 6 l3 -6 M78 15 l3 6 l3 -6 M98 18 l3 6 l3 -6" {...solid('var(--clay)')} />
      <path d="M40 30 H82 L86 38 H36Z" {...solid('var(--clay)')} />
      <path d="M46 30 L44 38 M56 30 L55 38 M66 30 L66 38 M76 30 L77 38" {...{ ...ink, stroke: 'var(--paper-hi)', strokeWidth: 2 }} />
      <path d="M40 38 V52 M82 38 V52 M38 46 H84" {...ink} />
    </>
  ),
  // a radio mast sending rings over the rooftops
  media: (
    <>
      <path d="M-400 48 H14 V40 H26 V48 H40 V36 H52 V48 H520 V70 H-400Z" {...solid('color-mix(in srgb, var(--p-sol) 35%, var(--paper))')} />
      <path d="M80 52 L86 16 L92 52 M82 40 H90 M83 30 H89" {...ink} />
      <circle cx="86" cy="14" r="2.5" {...solid('var(--p-sol)')} />
      <path d="M76 8 q-5 6 0 12 M96 8 q5 6 0 12 M71 4 q-9 10 0 20 M101 4 q9 10 0 20" {...{ ...ink, strokeWidth: 1.2 }} />
    </>
  ),
  // a bench with a flask and a seedling under glass
  science: (
    <>
      <path d="M-400 44 H520 V70 H-400Z" {...solid('color-mix(in srgb, var(--p-ines) 35%, var(--paper))')} />
      <path d="M30 22 V30 L20 44 H48 L38 30 V22 Z" {...solid('var(--paper-hi)')} />
      <path d="M24 38 H44 L48 44 H20Z" {...solid('var(--p-ines)')} />
      <path d="M28 22 H40" {...ink} />
      <path d="M70 44 V26 Q80 14 90 26 V44" {...solid('color-mix(in srgb, var(--paper-hi) 60%, transparent)')} />
      <path d="M80 44 V34 M80 36 q-5 -2 -6 -6 M80 34 q5 -2 6 -6" {...{ ...ink, stroke: 'var(--pasture)' }} />
    </>
  ),
  // a crack splitting the ground, with lightning over it
  rift: (
    <>
      <path d="M-400 42 H520 V70 H-400Z" {...solid('color-mix(in srgb, var(--hollowell) 30%, var(--paper))')} />
      <path d="M50 42 L56 48 L50 52 L58 60 H66 L60 52 L66 48 L60 42Z" {...solid('var(--ink)')} />
      <path d="M70 6 L62 22 H70 L64 36 L80 18 H72 L78 6Z" {...solid('var(--hollowell)')} />
    </>
  ),
  // a pair of scales over a crate of coins
  market: (
    <>
      <path d="M-400 48 H520 V70 H-400Z" {...solid('color-mix(in srgb, var(--wheat) 45%, var(--paper))')} />
      <path d="M60 14 V46 M40 20 H80 M52 46 H68" {...ink} />
      <path d="M34 20 L28 32 H52 L46 20" {...ink} />
      <path d="M28 32 Q40 40 52 32Z" {...solid('var(--wheat)')} />
      <path d="M74 20 L68 30 H92 L86 20" {...ink} />
      <path d="M68 30 Q80 38 92 30Z" {...solid('var(--wheat)')} />
      <circle cx="60" cy="12" r="3" {...solid('var(--paper-hi)')} />
    </>
  ),
  // Cath's notebook and pencil on the table
  plan: (
    <>
      <path d="M-400 46 H520 V70 H-400Z" {...solid('color-mix(in srgb, var(--p-mara) 25%, var(--paper))')} />
      <path d="M34 16 H80 V50 H34Z" {...solid('var(--paper-hi)')} />
      <path d="M40 24 H72 M40 30 H74 M40 36 H66 M40 42 H70" {...{ ...ink, strokeWidth: 1, opacity: 0.6 }} />
      <path d="M38 16 V50" {...{ ...ink, stroke: 'var(--p-mara)' }} />
      <path d="M84 48 L100 18 L104 20 L88 50 L84 52Z" {...solid('var(--wheat)')} />
    </>
  ),
}

/** Plan item 320: the motif alone (its ground band and subject, no sky or sun), in the vignette's own 120x60 frame, so
 * an invest card's painted window can show what the card buys rather than one shopfront for every Improvement. */
export function VignetteMotif({ kind }: { kind: VignetteKind }) {
  // its ground band (the first part) washes into the card's own land instead of standing as a hard bar
  const [band, ...rest] = Children.toArray((MOTIF[kind].props as { children: ReactNode }).children)
  return (
    <>
      {isValidElement(band) ? cloneElement(band as ReactElement<{ opacity?: number; stroke?: string }>, { opacity: 0.4, stroke: 'none' }) : band}
      {rest}
    </>
  )
}

export default function Vignette({ kind, seed }: { kind: VignetteKind; seed: string }) {
  const h = vignetteHash(seed)
  const sunX = 14 + (h % 92)
  const sunY = 10 + ((h >> 8) % 10)
  return (
    <svg className="card-vignette" data-vignette={kind} viewBox="0 0 120 60" preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false">
      {/* sky and ground run past the scene's frame, so a wide banner shows it centred on one continuous strip */}
      <rect x="-400" y="-60" width="920" height="180" {...{ fill: `color-mix(in srgb, ${TINT[kind]} 18%, var(--paper-hi))` }} />
      <circle cx={sunX} cy={sunY} r="6" {...{ fill: `color-mix(in srgb, var(--wheat) 60%, var(--paper-hi))`, opacity: 0.9 }} />
      {MOTIF[kind]}
    </svg>
  )
}
