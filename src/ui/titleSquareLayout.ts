import { rng } from './seededRng'

// Plan item 382's square behind the title (TitleSquare.tsx): the houses and their windows, laid out once from a seed.

export const W = 1440
export const GROUND = 548

export interface Facade {
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

export const FACADES = facades()

export function roofPath(f: Facade): string {
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

/** Plan item 746: each house its own window: a cross-barred sash, an arched one between open shutters with a flower box,
 * a narrow pair under one lintel, or tall French windows behind a balcony rail on the first floor. Neighbours never
 * share a style, so no style is more than about a third of a row. Every third lit at dusk. */
export type WinStyle = 'cross' | 'arch' | 'pair' | 'french'
const STYLES: WinStyle[] = ['cross', 'arch', 'pair', 'french']
/** How many windows a house has (the grid below). */
const windowCount = (f: Facade) => Math.max(2, Math.round(f.w / 38)) * Array.from({ length: f.floors }, (_, row) => f.top + 22 + row * 56).filter((y) => y + 28 <= 430).length
const WIN_STYLE: WinStyle[] = (() => {
  // each house takes the style with the fewest windows so far (never its neighbour's), so the four share the street
  const r = rng(746)
  const used = new Map<WinStyle, number>(STYLES.map((k) => [k, r() * 0.5]))
  const out: WinStyle[] = []
  for (const f of FACADES) {
    const pick = STYLES.filter((k) => k !== out[out.length - 1]).sort((p, q) => used.get(p)! - used.get(q)!)[0]!
    used.set(pick, used.get(pick)! + windowCount(f))
    out.push(pick)
  }
  return out
})()
export const WINDOWS = FACADES.flatMap((f, i) => {
  const cols = Math.max(2, Math.round(f.w / 38))
  const gap = f.w / cols
  const style = WIN_STYLE[i]!
  const out: { x: number; y: number; lit: boolean; shut: boolean; style: WinStyle; row: number; box: boolean }[] = []
  for (let row = 0; row < f.floors; row++) {
    const y = f.top + 22 + row * 56
    if (y + 28 > 430) continue
    for (let c = 0; c < cols; c++) {
      out.push({ x: Math.round(f.x + c * gap + gap / 2 - 8), y, lit: (i * 5 + c * 3 + row * 7) % 4 === 0, shut: f.tone === 1 && style === 'cross', style, row, box: (style === 'arch' || style === 'pair') && (c + row + i) % 3 !== 0 })
    }
  }
  return out
})

