// Plan item 243: at D the /games/ hero is one scene, Cath working her stall: two posts and a striped awning frame
// her and the words, the headline and buttons hang on the stall's slate board, and she stands behind a wooden
// counter of produce that rests on the posters' awning rail. Drawn from the hero's measured layout (so it fits any
// desktop width) as two SVG layers: the back (posts, roof, board) behind Cath and the words, the counter in front of
// her. Phones keep their own hero (item 238), so this draws nothing under 1200 px or on a portrait screen.

import { todayBoard, type TodayBoard } from './cards'

const NS = 'http://www.w3.org/2000/svg'
const r = (n: number): string => String(Math.round(n * 10) / 10)

interface Box { l: number; t: number; r: number; b: number }

function union(els: Element[], o: DOMRect): Box | null {
  let box: Box | null = null
  for (const el of els) {
    // a block of text measures by its words, not the column it sits in
    const range = el instanceof HTMLParagraphElement ? document.createRange() : null
    range?.selectNodeContents(el)
    const b = range ? range.getBoundingClientRect() : el.getBoundingClientRect()
    if (!b.width || !b.height) continue
    const x = { l: b.left - o.left, t: b.top - o.top, r: b.right - o.left, b: b.bottom - o.top }
    box = box ? { l: Math.min(box.l, x.l), t: Math.min(box.t, x.t), r: Math.max(box.r, x.r), b: Math.max(box.b, x.b) } : x
  }
  return box
}

function layer(cls: string): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('class', cls)
  svg.setAttribute('aria-hidden', 'true')
  return svg
}

/** The awning's valance across [x1, x2] with its foot at y: a sloped roof band, stripes, a scalloped hem. */
function awning(x1: number, x2: number, y: number): string {
  const w = x2 - x1
  const n = Math.max(6, Math.round(w / 44))
  let o = `<path d="M${r(x1 + 14)} ${r(y - 52)}H${r(x2 - 14)}L${r(x2 + 8)} ${r(y - 22)}H${r(x1 - 8)}Z" fill="#9a3a27"/>`
  for (let i = 0; i < n; i++) {
    const a = x1 - 8 + ((w + 16) / n) * i
    const b = a + (w + 16) / n
    const top = (x: number) => x1 + 14 + ((x - (x1 - 8)) / (w + 16)) * (w - 28)
    o += `<path d="M${r(top(a))} ${r(y - 52)}L${r(top(b))} ${r(y - 52)}L${r(b)} ${r(y - 22)}L${r(a)} ${r(y - 22)}Z" fill="${i % 2 ? '#f3e3c3' : '#c8553d'}"/>`
  }
  // the hem: a band and a row of half-discs, one per stripe
  let hem = `M${r(x1 - 8)} ${r(y - 22)}H${r(x2 + 8)}V${r(y - 8)}`
  const hw = (w + 16) / n
  for (let i = n - 1; i >= 0; i--) hem += `a${r(hw / 2)} ${r(hw / 2.4)} 0 0 1 ${r(-hw)} 0`
  o += `<path d="${hem}Z" fill="#c8553d"/>`
  for (let i = 0; i < n; i += 2) {
    const a = x1 - 8 + hw * i
    o += `<path d="M${r(a)} ${r(y - 22)}h${r(hw)}v14a${r(hw / 2)} ${r(hw / 2.4)} 0 0 1 ${r(-hw)} 0z" fill="#f3e3c3"/>`
  }
  o += `<path d="M${r(x1 - 8)} ${r(y - 22)}H${r(x2 + 8)}" stroke="#7a2a1c" stroke-width="2"/>`
  o += `<path d="M${r(x1 + 14)} ${r(y - 52)}H${r(x2 - 14)}" stroke="#ffe8c4" stroke-opacity=".5" stroke-width="2"/>`
  return o
}

function post(x: number, y1: number, y2: number): string {
  return (
    `<rect x="${r(x - 5)}" y="${r(y1)}" width="10" height="${r(y2 - y1)}" rx="2" fill="#6b3f24"/>` +
    `<rect x="${r(x - 5)}" y="${r(y1)}" width="3.5" height="${r(y2 - y1)}" fill="#d9a15f" opacity=".55"/>`
  )
}

/** Produce heaped along the counter's top, from x1 to x2 (deterministic, so a resize redraws the same crates). */
function produce(x1: number, x2: number, y: number): string {
  const veg = ['#d9532e', '#e8793a', '#8fbf4a', '#7a3a6b', '#e8a53a', '#c94a3a', '#9ccf5a']
  let o = ''
  let i = 0
  for (let x = x1 + 14; x < x2 - 10; x += 17, i++) {
    const rr = 8 + ((i * 7) % 4)
    o += `<circle cx="${r(x)}" cy="${r(y - rr * 0.7)}" r="${rr}" fill="${veg[i % veg.length]}"/>`
    o += `<circle cx="${r(x - rr * 0.35)}" cy="${r(y - rr * 1.05)}" r="${r(rr * 0.3)}" fill="#fff" opacity=".28"/>`
    if (i % 3 === 1) o += `<path d="M${r(x)} ${r(y - rr * 1.6)}q3-5 7-4" fill="none" stroke="#4f7a2c" stroke-width="2.4" stroke-linecap="round"/>`
  }
  return o
}

/** A slatted wooden crate w wide with its foot at y, heaped with one kind of produce (`k` picks the colour). */
function crate(x: number, w: number, y: number, k: number): string {
  if (w < 40) return ''
  const veg = ['#d9532e', '#8fbf4a', '#e8a53a', '#7a3a6b', '#c94a3a', '#9ccf5a']
  const h = 46
  const t = y - h
  let o = `<rect x="${r(x)}" y="${r(t)}" width="${r(w)}" height="${h}" rx="3" fill="#b9814a"/>`
  for (let i = 1; i < 3; i++) o += `<rect x="${r(x)}" y="${r(t + (h / 3) * i - 2)}" width="${r(w)}" height="3" fill="#6b3f24" opacity=".5"/>`
  o += `<rect x="${r(x)}" y="${r(t)}" width="${r(w)}" height="4" rx="2" fill="#ffe2aa" opacity=".5"/>`
  o += `<rect x="${r(x + 4)}" y="${r(t + 4)}" width="6" height="${h - 6}" fill="#6b3f24" opacity=".45"/><rect x="${r(x + w - 10)}" y="${r(t + 4)}" width="6" height="${h - 6}" fill="#6b3f24" opacity=".45"/>`
  // the heap: two rows of fruit, the back row higher
  let i = 0
  for (const [dy, inset] of [[-14, 10], [-4, 4]] as const) {
    for (let cx = x + inset + 8; cx <= x + w - inset - 8; cx += 15, i++) {
      const rr = 8 + ((i * 5) % 3)
      o += `<circle cx="${r(cx)}" cy="${r(t + dy + 6)}" r="${rr}" fill="${veg[(k + (i % 2)) % veg.length]}"/>`
      o += `<circle cx="${r(cx - rr * 0.35)}" cy="${r(t + dy + 6 - rr * 0.4)}" r="${r(rr * 0.3)}" fill="#fff" opacity=".28"/>`
    }
  }
  return o
}

/**
 * Plan item 648: one of Bea's crayon drawings pegged to the twine, w wide with its top at y, tilted a little: each of
 * the games' own motif in a child's hand (the board's hexes, the runnel to a field, a windmill, a sun over a stall).
 */
function drawing(x: number, y: number, w: number, k: number): string {
  const h = w * 1.2
  const tilt = [-5, 4, -3, 6][k % 4]
  const cx = x + w / 2
  const ink = ['#c8553d', '#3f7fbf', '#5aa36b', '#e0a02e'][k % 4]
  let d = ''
  if (k % 4 === 0) {
    // three hexes, the middle one held (green)
    for (const [hx, hy, f] of [[-0.24, 0.42, 'none'], [0.24, 0.42, 'none'], [0, 0.66, '#8fbf4a']] as const) {
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i + Math.PI / 6
        return `${r(cx + hx * w + Math.cos(a) * w * 0.17)},${r(y + hy * h + Math.sin(a) * w * 0.17)}`
      }).join(' ')
      d += `<polygon points="${pts}" fill="${f}" stroke="${ink}" stroke-width="2.2" stroke-linejoin="round"/>`
    }
  } else if (k % 4 === 1) {
    // the runnel winding down to a green field
    d += `<path d="M${r(x + w * 0.2)} ${r(y + h * 0.2)}q${r(w * 0.5)} ${r(h * 0.12)} ${r(w * 0.1)} ${r(h * 0.3)}t${r(w * 0.35)} ${r(h * 0.25)}" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`
    d += `<rect x="${r(x + w * 0.5)} " y="${r(y + h * 0.74)}" width="${r(w * 0.36)}" height="${r(h * 0.14)}" rx="2" fill="#8fbf4a"/>`
  } else if (k % 4 === 2) {
    // a windmill on a hill
    d += `<path d="M${r(x + w * 0.1)} ${r(y + h * 0.86)}q${r(w * 0.4)} ${r(-h * 0.2)} ${r(w * 0.8)} 0" fill="none" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/>`
    d += `<path d="M${r(cx - w * 0.08)} ${r(y + h * 0.78)}l${r(w * 0.04)} ${r(-h * 0.34)}h${r(w * 0.08)}l${r(w * 0.04)} ${r(h * 0.34)}z" fill="#f3e3c3" stroke="#6b3f24" stroke-width="1.6"/>`
    d += `<path d="M${r(cx - w * 0.28)} ${r(y + h * 0.3)}L${r(cx + w * 0.28)} ${r(y + h * 0.58)}M${r(cx + w * 0.28)} ${r(y + h * 0.3)}L${r(cx - w * 0.28)} ${r(y + h * 0.58)}" stroke="#6b3f24" stroke-width="2.4" stroke-linecap="round"/>`
  } else {
    // a sun over a striped stall
    d += `<circle cx="${r(x + w * 0.74)}" cy="${r(y + h * 0.24)}" r="${r(w * 0.12)}" fill="${ink}"/>`
    d += `<path d="M${r(x + w * 0.16)} ${r(y + h * 0.52)}h${r(w * 0.6)}l${r(-w * 0.06)} ${r(-h * 0.12)}h${r(-w * 0.48)}z" fill="#c8553d"/>`
    d += `<path d="M${r(x + w * 0.22)} ${r(y + h * 0.52)}v${r(h * 0.3)}M${r(x + w * 0.7)} ${r(y + h * 0.52)}v${r(h * 0.3)}M${r(x + w * 0.16)} ${r(y + h * 0.68)}h${r(w * 0.6)}" stroke="#6b3f24" stroke-width="2.2" stroke-linecap="round"/>`
  }
  return (
    `<g class="bea-drawing" transform="rotate(${tilt} ${r(cx)} ${r(y)})">` +
    `<rect x="${r(x + 2)}" y="${r(y + 3)}" width="${r(w)}" height="${r(h)}" fill="#000" opacity=".25"/>` +
    `<rect x="${r(x)}" y="${r(y)}" width="${r(w)}" height="${r(h)}" fill="#f6efdf"/>` +
    d +
    `<rect x="${r(cx - 4)}" y="${r(y - 6)}" width="8" height="14" rx="2" fill="#b9814a"/>` +
    `</g>`
  )
}

/** Plan item 648: a little shelf of preserves on the stall's back, from x1 to x2 with its board at y. */
function shelf(x1: number, x2: number, y: number): string {
  let o = `<rect x="${r(x1)}" y="${r(y)}" width="${r(x2 - x1)}" height="7" rx="2" fill="#a8693a"/><rect x="${r(x1)}" y="${r(y)}" width="${r(x2 - x1)}" height="2.5" fill="#ffe2aa" opacity=".45"/>`
  o += `<path d="M${r(x1 + 10)} ${r(y + 7)}l8 12M${r(x2 - 10)} ${r(y + 7)}l-8 12" stroke="#6b3f24" stroke-width="3" stroke-linecap="round"/>`
  const jam = ['#c94a3a', '#e8a53a', '#7a3a6b', '#8fbf4a']
  let i = 0
  for (let x = x1 + 12; x + 24 <= x2 - 8; x += 32, i++) {
    const h = 26 + ((i * 5) % 3) * 3
    o += `<rect x="${r(x)}" y="${r(y - h)}" width="22" height="${h}" rx="4" fill="${jam[i % jam.length]}" opacity=".95"/>`
    o += `<rect x="${r(x - 1)}" y="${r(y - h - 6)}" width="24" height="7" rx="2" fill="#f3e3c3"/>`
    o += `<rect x="${r(x + 4)}" y="${r(y - h * 0.62)}" width="14" height="${r(h * 0.32)}" rx="1.5" fill="#f6efdf" opacity=".9"/>`
    o += `<rect x="${r(x + 3)}" y="${r(y - h + 4)}" width="3" height="${r(h - 8)}" rx="1.5" fill="#fff" opacity=".3"/>`
  }
  return o
}

let back: SVGSVGElement | null = null
let front: SVGSVGElement | null = null

/** (Re)draw the stall round the hero's current layout; removes it where the hero isn't the wide one. */
export function drawBooth(): void {
  const hero = document.querySelector<HTMLElement>('.stall-hero')
  const cath = document.querySelector('#hero-cath svg')
  const games = document.querySelector<HTMLElement>('.hero-games')
  const text = hero?.querySelector('.hero-text')
  const wide = innerWidth >= 1200 && innerWidth >= innerHeight
  if (!hero || !cath || !games || !text || !wide) {
    back?.remove()
    front?.remove()
    wares?.remove()
    slate?.remove()
    back = front = wares = slate = null
    if (hero) {
      delete hero.dataset.booth
      delete hero.dataset.slate
    }
    return
  }
  const o = hero.getBoundingClientRect()
  const c = union([cath], o)
  const words = union([...text.querySelectorAll('p.kicker, .title-text, p.lede, .cta-row > *, .hero-meta, .today-board')], o)
  if (!c || !words) return
  const rail = games.getBoundingClientRect().top - o.top + parseFloat(getComputedStyle(games, '::after').top)
  const ch = c.b - c.t
  // The stall: from left of Cath to right of the words; the roof's hem just over her head.
  const x1 = c.l - 64
  const x2 = words.r + 56
  // Plan item 259: ...and its scallops 14 px clear of the kicker (at 1440 their hem touched its caps).
  const hw = (x2 - x1 + 16) / Math.max(6, Math.round((x2 - x1) / 44))
  // (its sloped top band, 52 px over the hem's top, stays under the page's top edge)
  // Plan item 352: 40 px of headroom over her head (the hem sat 3% down her figure, on her hair), and the scallops 16 px
  // clear of the kicker.
  const roof = Math.max(56 - o.top - window.scrollY, Math.min(c.t - 40, words.t - 16 - (hw / 2.4 - 8)))
  const board = { l: words.l - 30, t: words.t - 20, r: words.r + 30, b: words.b + 20 }
  let s = ''
  // the stall's back cloth, a dark canvas that also holds the words' contrast
  s += `<rect x="${r(x1)}" y="${r(roof - 22)}" width="${r(x2 - x1)}" height="${r(rail - roof + 22)}" fill="#1a1119" opacity=".42"/>`
  s += post(x1, roof - 24, rail) + post(x2, roof - 24, rail)
  // the slate board on two ropes from the roof
  for (const x of [board.l + 40, board.r - 40]) s += `<path d="M${r(x)} ${r(roof - 8)}V${r(board.t + 4)}" stroke="#c9a66b" stroke-width="2.5"/><circle cx="${r(x)}" cy="${r(board.t + 4)}" r="3.5" fill="#6b3f24"/>`
  s += `<rect x="${r(board.l - 7)}" y="${r(board.t - 7)}" width="${r(board.r - board.l + 14)}" height="${r(board.b - board.t + 14)}" rx="6" fill="#6b3f24"/>`
  s += `<rect x="${r(board.l - 7)}" y="${r(board.t - 7)}" width="${r(board.r - board.l + 14)}" height="4" rx="2" fill="#d9a15f" opacity=".6"/>`
  s += `<rect x="${r(board.l)}" y="${r(board.t)}" width="${r(board.r - board.l)}" height="${r(board.b - board.t)}" rx="3" fill="#232b28"/>`
  // Plan item 648: the stall's back is dressed: Bea's drawings pegged along a twine under the awning, either side of
  // Cath (never behind her), and a shelf of preserves on the stretch between her and the slate, over today's pick.
  {
    const ty = roof + hw / 2.4 + 16
    const dw = Math.max(44, Math.min(62, ch * 0.13))
    // today's pick stands on the counter right of her (its print about 144 x 126 px); where the drawings would reach
    // down to it, they hang only past it
    const printTop = c.t + ch * 0.58 + 4 - 130
    const clear = ty + dw * 1.2 + 6 < printTop
    const gaps: [number, number][] = [
      [x1 + 14, c.l - 6],
      [clear ? c.r + 6 : c.r + 10 + 144 + 14, board.l - 20],
    ]
    s += `<path d="M${r(x1 + 4)} ${r(ty)}Q${r((x1 + board.l) / 2)} ${r(ty + 14)} ${r(board.l - 10)} ${r(ty)}" stroke="#e8d3a8" stroke-width="1.5" fill="none" opacity=".8"/>`
    const sag = (x: number) => {
      const t = (x - x1 - 4) / Math.max(1, board.l - 14 - x1)
      return ty + 28 * t * (1 - t)
    }
    let k = 0
    for (const [a, b] of gaps) {
      const n = Math.floor((b - a + 14) / (dw + 14))
      if (n < 1) continue
      const start = a + (b - a - (n * dw + (n - 1) * 14)) / 2
      for (let i = 0; i < n; i++, k++) {
        const x = start + i * (dw + 14)
        s += drawing(x, sag(x + dw / 2) + 2, dw, k)
      }
    }
    // the shelf stands right of today's pick (its print about 144 px from her right), clear of the drawings over it
    const shelfY = c.t + ch * 0.58 - 66
    const sl = c.r + 10 + 144 + 16
    const sr = board.l - 24
    if (sr - sl >= 80 && shelfY - 40 > ty + dw * 1.2 + 16) s += shelf(sl, Math.min(sr, sl + 200), shelfY)
  }
  s += awning(x1, x2, roof)
  // The counter: from the left post to the slate board, its top at her hips, its foot on the rail.
  // Plan item 326: 58% (was 60%), so the fruit meets her jacket hem and no trouser band shows above it.
  // Plan item 563: she stands in front of it, whole (the counter layer sits behind her), so it runs on to the board
  // and its price board hangs on the stretch beside her.
  const top = c.t + ch * 0.58
  const cr = Math.max(c.r + 70, board.l - 22)
  let f = ''
  f += produce(x1 - 6, cr, top + 2)
  f += `<rect x="${r(x1 - 14)}" y="${r(top)}" width="${r(cr - x1 + 14)}" height="16" rx="4" fill="#d9a15f"/>`
  f += `<rect x="${r(x1 - 14)}" y="${r(top)}" width="${r(cr - x1 + 14)}" height="4" rx="2" fill="#ffe2aa" opacity=".55"/>`
  f += `<rect x="${r(x1 - 8)}" y="${r(top + 15)}" width="${r(cr - x1 + 2)}" height="${r(rail - top - 15)}" fill="#a8693a"/>`
  let planks = ''
  for (let x = x1 + 18; x < cr - 8; x += 26) planks += `M${r(x)} ${r(top + 17)}V${r(rail)}`
  f += `<path d="${planks}" stroke="#6b3f24" stroke-width="2" opacity=".55"/>`
  f += `<rect x="${r(x1 - 8)}" y="${r(top + 15)}" width="${r(cr - x1 + 2)}" height="10" fill="#1a1119" opacity=".3"/>`
  // the chalk price board hung on the counter's front, beside her
  const sx = cr - c.r > 170 ? (c.r + cr) / 2 : (x1 + cr) / 2
  const sy = top + (rail - top) * 0.52
  // Plan item 640: the counter's front carries today's board, a chalk slate of each game's daily (an HTML layer, so
  // each line is a link), in place of the 132 px 'FRESH · FREE' sign; that sign stays only where the slate can't fit.
  // across the front below her (the counter hides her from the hips), past the crates stacked at its left foot
  const slateL = x1 + 112
  const slateR = cr - 10
  const slated = placeSlate(hero, slateL, slateR, top + 24, rail - 8)
  if (!slated) {
    f += `<rect x="${r(sx - 66)}" y="${r(sy - 17)}" width="132" height="34" rx="4" fill="#2b3330" stroke="#6b3f24" stroke-width="3"/>`
    f += `<text x="${r(sx)}" y="${r(sy + 6)}" fill="#f4efe2" font-family="Georgia,serif" font-size="17" font-weight="700" text-anchor="middle">FRESH · FREE</text>`
  }
  // Plan item 470: a string of pennants across the counter's foot, so its front isn't a bare brown panel
  // (a critique read the stall's left half as empty): it sags from post to post under the price board.
  {
    const by = sy + 26
    const bl = x1 - 2
    const br = cr - 6
    const sag = 10
    f += `<path d="M${r(bl)} ${r(by)}Q${r((bl + br) / 2)} ${r(by + sag * 2)} ${r(br)} ${r(by)}" stroke="#e8d3a8" stroke-width="1.5" fill="none" opacity=".85"/>`
    const cols = ['#d9534f', '#f2c14e', '#5aa36b', '#3f7fbf', '#e8d3a8']
    const n = Math.max(5, Math.floor((br - bl) / 26))
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n
      const x = bl + (br - bl) * t
      const y = by + sag * 2 * 2 * t * (1 - t)
      f += `<path d="M${r(x - 8)} ${r(y)}L${r(x + 8)} ${r(y)}L${r(x)} ${r(y + 16)}Z" fill="${cols[i % cols.length]}" opacity=".92"/>`
    }
  }
  // Plan item 563: crates of produce stacked at the counter's foot on her other side, so the stall's front is stocked
  f += crate(x1 - 4, Math.min(c.l + 26, x1 + 104) - x1 + 4, rail, 0)
  f += crate(x1 + 8, Math.min(c.l + 8, x1 + 86) - x1 - 8, rail - 50, 3)
  if (cr - c.r > 300) f += crate(cr - 96, 84, rail, 5)
  // Plan item 631, reworked by item 640: one game stands on the counter beside her, a framed print of today's pick
  // (the daily she names next), a link to it (the posters below are the keyboard's way in, so it stays out of the
  // tab order); the four 70 px tiles only repeated the posters below.
  placeWares(hero, c.r + 10, cr - 2, top + 4)
  if (!back) {
    back = layer('hero-booth')
    hero.prepend(back)
  }
  if (!front) {
    front = layer('hero-counter')
    cath.parentElement!.after(front)
  }
  back.innerHTML = s
  front.innerHTML = f
  hero.dataset.booth = ''
  hero.style.setProperty('--stall-x1', `${r(x1 - 14)}px`)
  drawnAt = signature()
  // Plan item 640: with the slate up, the words' own today board folds into it (its week dots and run are on the
  // slate); the words shorten, so the board drawn round them is drawn again once.
  if ((hero.dataset.slate !== undefined) !== slated) {
    if (slated) hero.dataset.slate = ''
    else delete hero.dataset.slate
    drawBooth()
  }
}

const WARES: Record<string, string> = { cathnivore: 'Cathnivore', runnel: 'Runnel', hedgerow: 'Hedgerow', nightshift: 'NIGHT SHIFT' }
let wares: HTMLElement | null = null

/** Today's pick: the first daily not played yet (as her line names it), else the game the hero's button plays. */
function pickGame(): string {
  try {
    const b = todayBoard(localStorage, new Date())
    const next = b.any ? b.tags.find((t) => t.game !== 'nightshift' && !t.done)?.game : undefined
    if (next) return next
  } catch {
    // unreadable storage: the button's game
  }
  const href = document.getElementById('cta-today')?.getAttribute('href') ?? '/runnel/'
  const id = href.replace(/\//g, '')
  return id in WARES ? id : 'runnel'
}

function placeWares(hero: HTMLElement, l: number, rgt: number, foot: number): void {
  if (!wares) {
    wares = document.createElement('div')
    wares.className = 'stall-wares'
    wares.setAttribute('aria-hidden', 'true')
    hero.append(wares)
  }
  const id = pickGame()
  if (wares.dataset.game !== id) {
    wares.dataset.game = id
    const a = document.createElement('a')
    a.className = 'stall-ware'
    a.href = `/${id}/`
    a.tabIndex = -1
    a.dataset.game = id
    a.innerHTML = `<img src="/work/games-${id}-640.webp" alt="" width="640" height="400" decoding="async" loading="lazy"><span><small>Today's pick</small> ${WARES[id]}</span>`
    // pointing at the ware lights its poster below
    const poster = () => document.querySelector<HTMLElement>(`.hero-game-${id}`)
    a.addEventListener('pointerenter', () => poster()?.setAttribute('data-ware-lit', ''))
    a.addEventListener('pointerleave', () => poster()?.removeAttribute('data-ware-lit'))
    wares.replaceChildren(a)
  }
  const w = Math.max(0, rgt - l)
  wares.hidden = w < 160
  wares.style.setProperty('--ware-l', `${r(l)}px`)
  wares.style.setProperty('--ware-w', `${r(w)}px`)
  wares.style.setProperty('--ware-t', `${r(foot)}px`)
}

let slate: HTMLElement | null = null

/** Plan item 640: today's dailies chalked on the counter's front, each line a link to its game (where the daily
 *  waits), a tick once today's is played, and the run in pennants. Returns false (and hides) where it can't fit. */
/** Plan item 674: each daily chalked with its own small sign (no form-list rings): Cathnivore's three hexes, Runnel's
 *  channel, Hedgerow's windmill, NIGHT SHIFT's mask; a gold tick chalked over it once played. */
export const SLATE_ICONS: Record<string, string> = {
  cathnivore: '<path d="M7 3.5l3.5 2v4L7 11.5l-3.5-2v-4zM16.5 3.5l3.5 2v4l-3.5 2-3.5-2v-4zM11.8 11.5l3.5 2v4l-3.5 2-3.5-2v-4z"/>',
  runnel: '<path d="M3 5c4 0 4 4 8 4s3 6 7 6 2.5 4 3 4"/><path d="M3 9.5c3 0 3.5 3.5 6.5 3.5" opacity=".55"/><circle cx="3.5" cy="5" r="1.6"/>',
  hedgerow: '<path d="M12 10.5L9.5 21h5zM12 10.5L6 4.5M12 10.5l6-6M12 10.5l-6 6M12 10.5l6 6"/><circle cx="12" cy="10.5" r="1.4"/>',
  nightshift: '<path d="M3 8.5c3-2 6-2 9 0 3-2 6-2 9 0-.5 5-3.5 7.5-6 7.5-1.6 0-2.3-1.3-3-2.6-.7 1.3-1.4 2.6-3 2.6-2.5 0-5.5-2.5-6-7.5z"/><path d="M6.5 10.5h3M14.5 10.5h3"/>',
}
export const SLATE_TICK = '<path class="slate-tick" d="M12 15.5l3.2 3.5L22 9.5"/>'

function placeSlate(hero: HTMLElement, l: number, rgt: number, t: number, b: number): boolean {
  if (!slate) {
    slate = document.createElement('nav')
    slate.className = 'stall-slate'
    slate.setAttribute('aria-label', "Today's dailies")
    hero.append(slate)
  }
  let board: TodayBoard | null = null
  try {
    board = todayBoard(localStorage, new Date())
  } catch {
    board = null
  }
  const names: Record<string, string> = { cathnivore: 'Daily Market', runnel: "Today's Runnel", hedgerow: 'Hedgerow daily', nightshift: 'NIGHT SHIFT' }
  const order = ['cathnivore', 'runnel', 'hedgerow', 'nightshift']
  const tags = order.map((g) => board?.tags.find((x) => x.game === g) ?? { game: g, done: false, label: '' })
  const note = (x: { game: string; done: boolean; label: string }): string =>
    x.game === 'nightshift' ? (x.label ? x.label.replace(' of ', '/').replace(' names crossed off', ' names') : 'next name') : x.done ? x.label.replace('Daily: best', 'best') : 'to play'
  // the week in seven chalk dots (as the words' board had it), then the run, a gold pennant from three days
  const week = board?.any
    ? `<span class="slate-week" role="img" aria-label="${board.week.filter(Boolean).length} of the last 7 days played">${board.week.map((on) => `<i${on ? ' data-on' : ''}></i>`).join('')}</span>`
    : ''
  const streak = board && board.streak > 0 ? `<span class="slate-streak"${board.pennant ? ' data-pennant' : ''}>${board.streak}-day run</span>` : ''
  const run = week || streak ? `<span class="slate-run">${week}${streak}</span>` : ''
  slate.innerHTML =
    `<span class="slate-head">Today at the market${run}</span>` +
    tags
      .map(
        (x) =>
          `<a href="/${x.game}/" data-game="${x.game}"${x.done ? ' data-done' : ''}><svg class="slate-icon" viewBox="0 0 24 24" aria-hidden="true">${SLATE_ICONS[x.game] ?? ''}${x.done ? SLATE_TICK : ''}</svg><span class="slate-line"><span class="slate-name">${names[x.game]}</span><small${!x.done && x.game !== 'nightshift' ? ' data-todo' : ''}>${note(x)}</small></span></a>`,
      )
      .join('')
  const w = rgt - l
  const h = b - t
  const fits = w >= 300 && h >= 84
  slate.dataset.size = `${Math.round(w)}x${Math.round(h)}`
  slate.hidden = !fits
  slate.style.setProperty('--slate-l', `${r(l)}px`)
  slate.style.setProperty('--slate-t', `${r(t)}px`)
  slate.style.setProperty('--slate-w', `${r(Math.min(w, 460))}px`)
  slate.style.setProperty('--slate-h', `${r(h)}px`)
  return fits
}

/** Where the parts the stall is drawn from stand now (page px), to tell when a drawn stall has gone stale. */
function signature(): string {
  const at = (sel: string): string => {
    const b = document.querySelector(sel)?.getBoundingClientRect()
    return b ? `${Math.round(b.top + window.scrollY)},${Math.round(b.left)},${Math.round(b.height)}` : '-'
  }
  return ['.stall-hero', '.stall-hero p.kicker', '.stall-hero .hero-games', '#hero-cath svg'].map(at).join('|')
}
let drawnAt = ''

/** Draw now, after the entrance settles and the fonts land, and on every resize. */
export function mountBooth(): void {
  drawBooth()
  addEventListener('resize', drawBooth)
  void document.fonts?.ready.then(drawBooth)
  // the words and Cath rise in over about 1.5 s; draw again once they rest
  setTimeout(drawBooth, 1800)
  setTimeout(drawBooth, 3200)
  // ...and for the first 6 s, again whenever what it was drawn from has moved: on a loaded machine the timed draws
  // can run mid-entrance, which left the counter 18 px past the posters' rail and the roof 18 px low (seen at 1920).
  let checks = 0
  const watch = setInterval(() => {
    if (++checks > 20) clearInterval(watch)
    if (drawnAt && signature() !== drawnAt) drawBooth()
  }, 300)
}
