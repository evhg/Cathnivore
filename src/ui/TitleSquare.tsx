import { rng } from './seededRng'

// Plan item 382: Marrow's market square behind the title's counter, between the bunting and the table, so Cath and
// the board stand in a place, not an empty cream room. Washed facades (ochre, sage, rose, slate, cream) under
// terracotta and slate roofs, the clock tower in the gap between the price-board and Cath, two stalls at the edges
// and a cobbled square at the foot. Lit from the sun's side (the right) in the morning; at evening (the dark theme)
// the same square at dusk with lit windows. A paper haze sits behind the menu, Cath and the board so the square
// stays back. Static (nothing moves); purely decorative (aria-hidden). Colours are tokens (`--square-*`).

const W = 1440
const GROUND = 548

interface Facade {
  x: number
  w: number
  top: number
  tone: number
  roof: 'gable' | 'step' | 'mansard' | 'hip'
  floors: number
}

/** One row of tall townhouses across the frame; each a different wash from its neighbour. */
function facades(): Facade[] {
  const r = rng(382)
  const out: Facade[] = []
  let x = -14
  let last = -1
  while (x < W + 10) {
    const w = Math.round(118 + r() * 54)
    const top = Math.round(70 + r() * 70)
    let tone = Math.floor(r() * 5)
    if (tone === last) tone = (tone + 2) % 5
    last = tone
    const k = r()
    const roof = k < 0.35 ? 'gable' : k < 0.55 ? 'step' : k < 0.8 ? 'mansard' : 'hip'
    out.push({ x, w, top, tone, roof, floors: 6 })
    x += w + 2
  }
  return out
}

const FACADES = facades()

function roofPath(f: Facade): string {
  const { x, w, top } = f
  if (f.roof === 'gable') return `M${x - 4} ${top}L${x + w / 2} ${top - w * 0.34}L${x + w + 4} ${top}Z`
  if (f.roof === 'hip') return `M${x - 4} ${top}L${x + w * 0.22} ${top - 30}H${x + w * 0.78}L${x + w + 4} ${top}Z`
  if (f.roof === 'mansard') return `M${x - 4} ${top}L${x + 10} ${top - 34}H${x + w - 10}L${x + w + 4} ${top}Z`
  // a Dutch stepped gable: the wall itself climbs, capped in trim
  const s = w / 7
  let d = `M${x} ${top}`
  for (let i = 1; i <= 3; i++) d += `V${top - i * 14}H${x + s * i}`
  d += `V${top - 50}H${x + w - s * 3}`
  for (let i = 3; i >= 1; i--) d += `V${top - i * 14}H${x + w - s * (i - 1)}`
  return d + `V${top}Z`
}

/** Windows: a grid over the upper floors, every third lit at dusk; each with a pair of shutters on the sage houses. */
const WINDOWS = FACADES.flatMap((f, i) => {
  const cols = Math.max(2, Math.round(f.w / 38))
  const gap = f.w / cols
  const out: { x: number; y: number; lit: boolean; shut: boolean }[] = []
  for (let row = 0; row < f.floors; row++) {
    const y = f.top + 22 + row * 56
    if (y + 28 > 430) continue
    for (let c = 0; c < cols; c++) {
      out.push({ x: Math.round(f.x + c * gap + gap / 2 - 8), y, lit: (i * 5 + c * 3 + row * 7) % 4 === 0, shut: f.tone === 1 })
    }
  }
  return out
})

/** Each house's ground floor: a shopfront under a striped awning, the door on the side away from the sun. */
const SHOPS = FACADES.map((f, i) => ({ x: f.x + 10, w: f.w - 20, tone: i % 3 }))

const TOWER_X = 530
/** Cobbles: short staggered strokes in rows that widen toward the viewer. */
const COBBLES = Array.from({ length: 4 }, (_, row) => {
  const y = GROUND + 10 + row * 12 + row * row * 2
  const len = 14 + row * 6
  const step = len + 10
  const off = row % 2 ? step / 2 : 0
  const out: string[] = []
  for (let x = -off; x < W; x += step) out.push(`M${Math.round(x)} ${y}h${len}`)
  return out.join('')
}).join('')

/** A market stall: two posts, a striped scalloped awning, a counter of crates with produce. */
function Stall({ x, flip }: { x: number; flip?: boolean }) {
  const w = 150
  const stripes = Array.from({ length: 6 }, (_, i) => (
    <rect key={i} className={i % 2 ? 'sq-awn-b' : 'sq-awn-a'} x={x + (i * w) / 6} y={404} width={w / 6} height={34} />
  ))
  const scallops = Array.from({ length: 6 }, (_, i) => {
    const sx = x + (i * w) / 6
    return <path key={i} className={i % 2 ? 'sq-awn-b' : 'sq-awn-a'} d={`M${sx} 437h${w / 6}a${w / 12} 9 0 0 1 ${-w / 6} 0Z`} />
  })
  const fruit = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
    <circle key={i} className={`sq-fruit f${i % 3}`} cx={x + 22 + i * 15 + (flip ? 4 : 0)} cy={506 - (i % 2) * 4} r={7} />
  ))
  return (
    <g className="sq-stall">
      <rect className="sq-post" x={x + 4} y={400} width={6} height={GROUND - 400} />
      <rect className="sq-post" x={x + w - 10} y={400} width={6} height={GROUND - 400} />
      <path className="sq-roof" d={`M${x - 8} 406L${x + w / 2} 384L${x + w + 8} 406Z`} />
      {stripes}
      {scallops}
      {fruit}
      <rect className="sq-crate" x={x + 8} y={510} width={w - 16} height={GROUND - 510} rx={2} />
      <path className="sq-crate-line" d={`M${x + 8} 522H${x + w - 8}M${x + 8} 535H${x + w - 8}`} />
    </g>
  )
}

export default function TitleSquare() {
  return (
    <div className="title-square" aria-hidden="true">
      <svg viewBox={`0 0 ${W} 600`} preserveAspectRatio="xMidYMax slice" focusable="false">
        <defs>
          <radialGradient id="sq-haze-menu" cx="0.21" cy="0.68" r="0.24">
            <stop offset="0" className="sq-haze-in" />
            <stop offset="1" className="sq-haze-out" />
          </radialGradient>
          <radialGradient id="sq-haze-cath" cx="0.495" cy="0.66" r="0.2">
            <stop offset="0" className="sq-haze-in" />
            <stop offset="1" className="sq-haze-out" />
          </radialGradient>
          <radialGradient id="sq-haze-board" cx="0.76" cy="0.62" r="0.28">
            <stop offset="0" className="sq-haze-in" />
            <stop offset="1" className="sq-haze-out" />
          </radialGradient>
          <linearGradient id="sq-sun" x1="1" y1="0" x2="0" y2="0.4">
            <stop offset="0" className="sq-sun-in" />
            <stop offset="1" className="sq-sun-out" />
          </linearGradient>
        </defs>
        <g className="sq-houses">
          {FACADES.map((f, i) => (
            <g key={i}>
              <rect className={`sq-wall w${f.tone}`} x={f.x} y={f.top} width={f.w} height={GROUND - f.top} />
              <path className={f.roof === 'step' ? `sq-wall w${f.tone} sq-step` : i % 3 === 1 ? 'sq-roof2' : 'sq-roof'} d={roofPath(f)} />
              {f.roof !== 'step' && i % 2 === 0 && <rect className="sq-chimney" x={f.x + f.w * 0.7} y={f.top - 46} width={12} height={34} />}
              {/* the sun is to the right: each house's left edge falls into its neighbour's shade */}
              <rect className="sq-shade" x={f.x} y={f.top} width={10} height={GROUND - f.top} />
              <rect className="sq-cornice" x={f.x - 3} y={f.top - 2} width={f.w + 6} height={6} />
              <rect className="sq-cornice" x={f.x} y={438} width={f.w} height={5} />
            </g>
          ))}
        </g>
        <g className="sq-windows">
          {WINDOWS.map((w, i) => (
            <g key={i}>
              {w.shut && <rect className="sq-shutter" x={w.x - 6} y={w.y} width={28} height={28} rx={1} />}
              <rect className={w.lit ? 'sq-glass is-lit' : 'sq-glass'} x={w.x} y={w.y} width={16} height={28} rx={1.5} />
              <path className="sq-mullion" d={`M${w.x + 8} ${w.y}v28M${w.x} ${w.y + 12}h16`} />
              <rect className="sq-sill" x={w.x - 3} y={w.y + 28} width={22} height={3} />
            </g>
          ))}
        </g>
        <g className="sq-shops">
          {SHOPS.map((s, i) => (
            <g key={i}>
              <rect className="sq-shopfront" x={s.x} y={470} width={s.w} height={GROUND - 470} />
              <rect className={i % 4 === 1 ? 'sq-glass is-lit' : 'sq-glass'} x={s.x + 6} y={478} width={s.w * 0.55} height={50} />
              <rect className="sq-door" x={s.x + s.w * 0.66} y={480} width={s.w * 0.26} height={GROUND - 480} rx={2} />
              <path className={`sq-awning t${s.tone}`} d={`M${s.x - 4} 446H${s.x + s.w + 4}L${s.x + s.w + 12} 470H${s.x - 12}Z`} />
              <path className="sq-awning-stripe" d={Array.from({ length: Math.floor(s.w / 24) }, (_, k) => `M${s.x + 8 + k * 24} 447l-4 22`).join('')} />
            </g>
          ))}
        </g>
        {/* Marrow's clock tower, between the price-board and Cath */}
        <g className="sq-tower">
          <rect className="sq-wall w4" x={TOWER_X} y={60} width={64} height={GROUND - 60} />
          <rect className="sq-shade" x={TOWER_X} y={60} width={14} height={GROUND - 60} />
          <path className="sq-roof2" d={`M${TOWER_X - 8} 62L${TOWER_X + 32} -4L${TOWER_X + 72} 62Z`} />
          <rect className="sq-cornice" x={TOWER_X - 6} y={58} width={76} height={7} />
          <circle className="sq-clock" cx={TOWER_X + 32} cy={104} r={21} />
          <path className="sq-clock-hand" d={`M${TOWER_X + 32} 104V90M${TOWER_X + 32} 104l9 5`} />
          <rect className="sq-glass" x={TOWER_X + 22} y={150} width={20} height={44} rx={10} />
          {/* the tower's arched gate, framed in stone, its two leaves open onto the square */}
          <path className="sq-cornice" d={`M${TOWER_X + 10} ${GROUND}V488a22 22 0 0 1 44 0V${GROUND}Z`} />
          <path className="sq-door" d={`M${TOWER_X + 16} ${GROUND}V490a16 16 0 0 1 32 0V${GROUND}Z`} />
          <path className="sq-mullion" d={`M${TOWER_X + 32} 474V${GROUND}`} />
        </g>
        <rect className="sq-cobble" x={0} y={GROUND} width={W} height={600 - GROUND} />
        <path className="sq-cobble-line" d={COBBLES} />
        <Stall x={-30} />
        <Stall x={W - 120} flip />
        {/* low sun from the right; then the paper haze that keeps the square behind the menu, Cath and the board */}
        <rect className="sq-sunwash" x={0} y={0} width={W} height={600} fill="url(#sq-sun)" />
        <rect x={0} y={0} width={W} height={600} fill="url(#sq-haze-menu)" />
        <rect x={0} y={0} width={W} height={600} fill="url(#sq-haze-cath)" />
        <rect x={0} y={0} width={W} height={600} fill="url(#sq-haze-board)" />
      </svg>
    </div>
  )
}
