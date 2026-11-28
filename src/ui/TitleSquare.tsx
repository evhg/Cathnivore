
// Plan item 382: Marrow's market square behind the title's counter, between the bunting and the table, so Cath and
// the board stand in a place, not an empty cream room. Washed facades (ochre, sage, rose, slate, cream) under
// terracotta and slate roofs, the clock tower in the gap between the price-board and Cath, two stalls at the edges
// and a cobbled square at the foot. Lit from the sun's side (the right) in the morning; at evening (the dark theme)
// the same square at dusk with lit windows. A paper haze sits behind the menu, Cath and the board so the square
// stays back. Static (nothing moves); purely decorative (aria-hidden). Colours are tokens (`--square-*`).

import { useEffect, useRef } from 'react'
import { FACADES, GROUND, roofPath, W, WINDOWS } from './titleSquareLayout'

/** Each house's ground floor: a shopfront under a striped awning, the door on the side away from the sun. */
const SHOPS = FACADES.map((f, i) => ({ x: f.x + 10, w: f.w - 20, tone: i % 3 }))

const box = (x: number, y: number, w: number, h: number) => `M${x} ${y}h${w}v${h}h${-w}Z`

/** Every house, window and shop as a few merged path strings, one per paint. */
const L = (() => {
  const walls = ['', '', '', '', '']
  let steps = ''
  let roofs = ''
  let roofs2 = ''
  let chimneys = ''
  let shades = ''
  let cornices = ''
  FACADES.forEach((f, i) => {
    walls[f.tone] += box(f.x, f.top, f.w, GROUND - f.top)
    if (f.roof === 'step') {
      walls[f.tone] += roofPath(f)
      steps += roofPath(f)
    } else if (i % 3 === 1) roofs2 += roofPath(f)
    else roofs += roofPath(f)
    if (f.roof !== 'step' && i % 2 === 0) chimneys += box(f.x + f.w * 0.7, f.top - 46, 12, 34)
    shades += box(f.x, f.top, 10, GROUND - f.top)
    cornices += box(f.x - 3, f.top - 2, f.w + 6, 6) + box(f.x, 438, f.w, 5)
  })
  let shutters = ''
  let glass = ''
  let glassLit = ''
  let mullions = ''
  let sills = ''
  let boxes = ''
  let blooms = ''
  let rails = ''
  const pane = (lit: boolean, d: string) => {
    if (lit) glassLit += d
    else glass += d
  }
  for (const w of WINDOWS) {
    const { x, y } = w
    if (w.style === 'arch') {
      shutters += box(x - 9, y + 2, 7, 28) + box(x + 18, y + 2, 7, 28)
      pane(w.lit, `M${x} ${y + 30}V${y + 8}a8 8 0 0 1 16 0V${y + 30}Z`)
      mullions += `M${x + 8} ${y + 2}v28`
      sills += box(x - 3, y + 30, 22, 3)
    } else if (w.style === 'pair') {
      pane(w.lit, box(x - 2, y + 2, 9, 26) + box(x + 9, y + 2, 9, 26))
      mullions += `M${x - 2} ${y + 12}h9M${x + 9} ${y + 12}h9`
      sills += box(x - 4, y - 2, 24, 3) + box(x - 4, y + 28, 24, 3)
    } else if (w.style === 'french' && w.row === 1) {
      pane(w.lit, box(x - 1, y - 4, 18, 36))
      mullions += `M${x + 8} ${y - 4}v36M${x - 1} ${y + 8}h18`
      rails += `M${x - 6} ${y + 20}h28` + [0, 1, 2, 3, 4].map((k) => `M${x - 5 + k * 6.5} ${y + 20}v12`).join('')
      sills += box(x - 7, y + 32, 30, 3)
    } else {
      if (w.shut) shutters += box(x - 6, y, 28, 28)
      const h = w.style === 'french' ? 24 : 28
      pane(w.lit, box(x, y + 28 - h, 16, h))
      mullions += `M${x + 8} ${y + 28 - h}v${h}M${x} ${y + 12}h16`
      sills += box(x - 3, y + 28, 22, 3)
    }
    if (w.box) {
      boxes += box(x - 3, y + 26, 22, 6)
      blooms += [0, 1, 2, 3].map((k) => `M${x - 1 + k * 6} ${y + 26}a2.6 2.6 0 1 0 0.1 0`).join('')
    }
  }
  let shopfronts = ''
  let shopGlass = ''
  let shopGlassLit = ''
  let doors = ''
  let stripes = ''
  const awnings = ['', '', '']
  SHOPS.forEach((s, i) => {
    shopfronts += box(s.x, 470, s.w, GROUND - 470)
    if (i % 4 === 1) shopGlassLit += box(s.x + 6, 478, s.w * 0.55, 50)
    else shopGlass += box(s.x + 6, 478, s.w * 0.55, 50)
    doors += box(s.x + s.w * 0.66, 480, s.w * 0.26, GROUND - 480)
    awnings[s.tone] += `M${s.x - 4} 446H${s.x + s.w + 4}L${s.x + s.w + 12} 470H${s.x - 12}Z`
    for (let k = 0; k < Math.floor(s.w / 24); k++) stripes += `M${s.x + 8 + k * 24} 447l-4 22`
  })
  // Plan item 746: a hanging sign on every other shop, on a wrought bracket at the house's edge
  let brackets = ''
  const signs = ['', '', '']
  SHOPS.forEach((s, i) => {
    if (i % 2) return
    const bx = s.x + s.w - 4
    brackets += `M${bx} 404h24M${bx + 4} 404l14 -10M${bx + 6} 404v4M${bx + 20} 404v4`
    signs[i % 3] += `M${bx + 3} 408h20v18a10 4 0 0 1 -20 0Z`
  })
  return { walls, steps, roofs, roofs2, chimneys, shades, cornices, shutters, glass, glassLit, mullions, sills, boxes, blooms, rails, shopfronts, shopGlass, shopGlassLit, doors, awnings, stripes, brackets, signs }
})()

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

/** Plan item 746: the square's people, in the gaps the menu, Cath and the board leave (D: 360-540, 800-870, the right
 * stall; P: 376-535). Drawn in RegionFolk's (item 717) ink at street scale; each strolls its walk and browses. */
const SQ_FOLK: { x0: number; x1: number; tone: number; s: number; basket?: boolean; hat?: boolean }[] = [
  { x0: 392, x1: 500, tone: 0, s: 3.3, basket: true },
  { x0: 468, x1: 468, tone: 1, s: 3.1, hat: true },
  { x0: 1430, x1: 1396, tone: 2, s: 3.2, basket: true },
  { x0: 1408, x1: 1408, tone: 3, s: 3.0, hat: true },
]

function SquareFolk() {
  return (
    <g className="sq-folk">
      {SQ_FOLK.map((f, i) => {
        const dx = f.x1 - f.x0
        return (
          <g key={i} transform={`translate(${f.x0},${GROUND + 6})`}>
            <g className={dx ? 'sq-walk' : 'sq-stand'} data-pace={i % 3} style={{ ['--wx' as string]: `${dx}px` }}>
              <g transform={`scale(${f.s})`}>
                <g className="sq-face" data-dir={i % 2 ? 'l' : 'r'}>
                  <ellipse cx={0} cy={0} rx={3.8} ry={0.9} className="sq-folk-shadow" />
                  <path className="sq-folk-legs" d="M-1.4,0 L-1.1,-5.2 M1.4,0 L1.1,-5.2" />
                  <path className="sq-folk-coat" data-tone={f.tone} d="M-3.6,-4.6 L-2.5,-11.6 Q0,-13 2.5,-11.6 L3.6,-4.6 Z" />
                  {f.basket && <path className="sq-folk-basket" d="M2.4,-8.6 h3.6 l-0.6,2.8 h-2.4 Z M2.9,-8.6 q1.3,-2.2 2.6,0" />}
                  <circle className="sq-folk-head" data-skin={(f.tone + i) % 3} cx={0} cy={-14.6} r={2.5} />
                  {f.hat && <path className="sq-folk-hat" d="M-3.6,-15.6 h7.2 M-2.1,-15.6 v-1.8 h4.2 v1.8" />}
                </g>
              </g>
            </g>
          </g>
        )
      })}
    </g>
  )
}

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

/** Plan item 746: on a desktop with a mouse the square answers the pointer a little (the houses 5 px, the stalls and
 * people 11 px), so it has depth; none on touch or under reduced motion. Written as one CSS variable per frame. */
function useParallax() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    const mq = window.matchMedia('(min-width: 1024px) and (pointer: fine) and (prefers-reduced-motion: no-preference)')
    if (!el || !mq.matches) return
    let raf = 0
    let px = 0
    const move = (e: PointerEvent) => {
      px = Math.max(-1, Math.min(1, (e.clientX / window.innerWidth) * 2 - 1))
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0
          el.style.setProperty('--sq-px', px.toFixed(3))
        })
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => {
      window.removeEventListener('pointermove', move)
      cancelAnimationFrame(raf)
    }
  }, [])
  return ref
}

/** Plan item 746: the stall-keeper behind the right-hand stall's counter, an apron over her coat. */
function Keeper({ x }: { x: number }) {
  return (
    <g className="sq-keeper" transform={`translate(${x},508) scale(3.2)`}>
      <path className="sq-folk-coat" data-tone={1} d="M-3.8,0 L-2.6,-11.6 Q0,-13 2.6,-11.6 L3.8,0 Z" />
      <path className="sq-apron" d="M-2,-9.6 h4 l0.6,9.6 h-5.2 Z" />
      <circle className="sq-folk-head" data-skin={1} cx={0} cy={-14.6} r={2.5} />
      <path className="sq-folk-hair" d="M-2.7,-14.8 a2.7 2.9 0 0 1 5.4 0 q-1.2,-1.4 -2.7,-1.2 q-1.6,-0.1 -2.7,1.2Z" />
    </g>
  )
}

export default function TitleSquare() {
  const ref = useParallax()
  return (
    <div className="title-square" aria-hidden="true" ref={ref}>
      <svg viewBox={`0 0 ${W} 600`} preserveAspectRatio="xMidYMax slice" focusable="false">
        <defs>
          <radialGradient id="sq-haze-menu" cx="0.21" cy="0.68" r="0.24">
            <stop offset="0" className="sq-haze-in" />
            <stop offset="1" className="sq-haze-out" />
          </radialGradient>
          <radialGradient id="sq-haze-cath" cx="0.495" cy="0.54" r="0.24">
            <stop offset="0" className="sq-haze-in sq-glow-in" />
            <stop offset="1" className="sq-haze-out sq-glow-out" />
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
        {/* the houses, windows and shops, each layer one path per paint (about 40 nodes, not a thousand) */}
        <g className="sq-back">
        {[0, 1, 2, 3, 4].map((t) => (
          <path key={t} className={`sq-wall w${t}`} d={L.walls[t]} />
        ))}
        <path className="sq-step" d={L.steps} />
        <path className="sq-roof" d={L.roofs} />
        <path className="sq-roof2" d={L.roofs2} />
        <path className="sq-chimney" d={L.chimneys} />
        {/* the sun is to the right: each house's left edge falls into its neighbour's shade */}
        <path className="sq-shade" d={L.shades} />
        <path className="sq-cornice" d={L.cornices} />
        <path className="sq-shutter" d={L.shutters} />
        <path className="sq-glass" d={L.glass} />
        <path className="sq-glass is-lit" d={L.glassLit} />
        <path className="sq-mullion" d={L.mullions} />
        <path className="sq-sill" d={L.sills} />
        <path className="sq-rail" d={L.rails} />
        <path className="sq-box" d={L.boxes} />
        <path className="sq-bloom" d={L.blooms} />
        <path className="sq-shopfront" d={L.shopfronts} />
        <path className="sq-glass" d={L.shopGlass} />
        <path className="sq-glass is-lit" d={L.shopGlassLit} />
        <path className="sq-door" d={L.doors} />
        {[0, 1, 2].map((t) => (
          <path key={t} className={`sq-awning t${t}`} d={L.awnings[t]} />
        ))}
        <path className="sq-awning-stripe" d={L.stripes} />
        <path className="sq-bracket" d={L.brackets} />
        {[0, 1, 2].map((t) => (
          <path key={t} className={`sq-sign t${t}`} d={L.signs[t]} />
        ))}
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
        </g>
        <rect className="sq-cobble" x={0} y={GROUND} width={W} height={600 - GROUND} />
        <path className="sq-cobble-line" d={COBBLES} />
        <g className="sq-mid">
          <Keeper x={W - 50} />
          <Stall x={-30} />
          <Stall x={W - 120} flip />
          <SquareFolk />
        </g>
        {/* low sun from the right; then the paper haze that keeps the square behind the menu, Cath and the board */}
        <rect className="sq-sunwash" x={0} y={0} width={W} height={600} fill="url(#sq-sun)" />
        <rect x={0} y={0} width={W} height={600} fill="url(#sq-haze-menu)" />
        <rect x={0} y={0} width={W} height={600} fill="url(#sq-haze-cath)" />
        <rect x={0} y={0} width={W} height={600} fill="url(#sq-haze-board)" />
      </svg>
    </div>
  )
}
