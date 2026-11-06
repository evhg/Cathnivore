import type { TitleSky as Sky } from './tableLight'

// Plan item 206: Marrow's street behind the title's stall, under a sky that follows the player's clock (dawn, day,
// golden hour, evening). Purely decorative (aria-hidden). Colours are tokens (tokens.css `--sky-*`, `--street-*`);
// the sky's state is `[data-sky]` on the title root, so the CSS picks the light, the sun or moon, lit windows and
// the lanterns. Nothing here moves except the lanterns' flicker, which reduced motion stills.

/** A small seeded generator, so the street is the same on every visit. */
function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

interface House {
  x: number
  w: number
  top: number
  roof: 'gable' | 'flat' | 'step'
  chimney: boolean
}

/** One row of houses across the 1440-wide frame, `[minTop, maxTop]` their eaves in the 160-high box. */
function row(seed: number, minW: number, maxW: number, minTop: number, maxTop: number): House[] {
  const r = rng(seed)
  const out: House[] = []
  let x = -20
  while (x < 1460) {
    const w = Math.round(minW + r() * (maxW - minW))
    const top = Math.round(minTop + r() * (maxTop - minTop))
    const k = r()
    out.push({ x, w, top, roof: k < 0.45 ? 'gable' : k < 0.75 ? 'flat' : 'step', chimney: r() < 0.5 })
    x += w + Math.round(r() * 6)
  }
  return out
}

function housePath(h: House): string {
  const { x, w, top } = h
  const b = 160
  if (h.roof === 'gable') return `M${x} ${b}V${top}L${x + w / 2} ${top - w * 0.26}L${x + w} ${top}V${b}Z`
  if (h.roof === 'step') {
    const s = w / 5
    return `M${x} ${b}V${top}H${x + s}V${top - 8}H${x + 2 * s}V${top - 14}H${x + 3 * s}V${top - 8}H${x + 4 * s}V${top}H${x + w}V${b}Z`
  }
  return `M${x} ${b}V${top}H${x + w}V${b}Z`
}

const FAR = row(206, 70, 116, 72, 90)
const NEAR = row(1106, 90, 150, 98, 110)

/** Marrow's clock tower and the market hall's roof, the two shapes that say "a town", on the left of the frame. */
const TOWER = 'M168 160V62H176V48L190 32L204 48V62H212V160Z'
const HALL = 'M1180 160V84L1240 62L1300 84V160Z'

/** The windows of the near row: two floors of them above each shop's awning. */
const WINDOWS = NEAR.flatMap((h, i) => {
  const cols = Math.max(2, Math.floor(h.w / 34))
  const gap = h.w / cols
  const out: { x: number; y: number; lit: boolean }[] = []
  for (let c = 0; c < cols; c++) {
    for (let f = 0; f < 2; f++) {
      const y = h.top + 8 + f * 18
      if (y + 12 > 128) continue
      out.push({ x: Math.round(h.x + c * gap + gap / 2 - 6), y, lit: (i * 7 + c * 3 + f * 5) % 3 === 0 })
    }
  }
  return out
})
const FAR_WINDOWS = FAR.flatMap((h, i) =>
  [0, 1].map((c) => ({ x: Math.round(h.x + h.w * (0.3 + c * 0.4) - 4), y: h.top + 10, lit: (i + c) % 3 !== 0 })),
)

/** The shops' striped awnings at street level, one a house. */
const AWNINGS = NEAR.map((h, i) => ({ x: h.x + 6, w: h.w - 12, tone: i % 3 }))

export default function TitleSky({ sky }: { sky: Sky }) {
  return (
    <div className="title-sky" aria-hidden="true" data-sky-layer={sky}>
      <span className="title-sky-sun" />
      <span className="title-sky-stars" />
      <svg className="title-street" viewBox="0 0 1440 160" preserveAspectRatio="xMidYMax slice" focusable="false">
        <g className="street-far">
          <path d={TOWER} />
          <path d={HALL} />
          {FAR.map((h, i) => (
            <path key={i} d={housePath(h)} />
          ))}
          {FAR.filter((h) => h.chimney).map((h, i) => (
            <rect key={i} x={h.x + h.w * 0.7} y={h.top - 14} width="7" height="16" />
          ))}
        </g>
        <circle className="street-clock" cx="190" cy="74" r="7" />
        <g className="street-far-windows">
          {FAR_WINDOWS.map((w, i) => (
            <rect key={i} className={w.lit ? 'is-lit' : undefined} x={w.x} y={w.y} width="8" height="10" rx="1" />
          ))}
        </g>
        <g className="street-near">
          {NEAR.map((h, i) => (
            <path key={i} d={housePath(h)} />
          ))}
          {NEAR.filter((h) => h.chimney).map((h, i) => (
            <rect key={i} x={h.x + h.w * 0.22} y={h.top - 16} width="9" height="18" />
          ))}
        </g>
        <g className="street-windows">
          {WINDOWS.map((w, i) => (
            <rect key={i} className={w.lit ? 'is-lit' : undefined} x={w.x} y={w.y} width="12" height="12" rx="1.5" />
          ))}
        </g>
        <g className="street-awnings">
          {AWNINGS.map((a, i) => (
            <path key={i} className={`awning a${a.tone}`} d={`M${a.x} 130H${a.x + a.w}L${a.x + a.w + 6} 146H${a.x - 6}Z`} />
          ))}
        </g>
      </svg>
    </div>
  )
}
