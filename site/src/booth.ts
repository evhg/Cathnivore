// Plan item 243: at D the /games/ hero is one scene, Cath working her stall: two posts and a striped awning frame
// her and the words, the headline and buttons hang on the stall's slate board, and she stands behind a wooden
// counter of produce that rests on the posters' awning rail. Drawn from the hero's measured layout (so it fits any
// desktop width) as two SVG layers: the back (posts, roof, board) behind Cath and the words, the counter in front of
// her. Phones keep their own hero (item 238), so this draws nothing under 1200 px or on a portrait screen.

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
    back = front = null
    if (hero) delete hero.dataset.booth
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
  f += `<rect x="${r(sx - 66)}" y="${r(sy - 17)}" width="132" height="34" rx="4" fill="#2b3330" stroke="#6b3f24" stroke-width="3"/>`
  f += `<text x="${r(sx)}" y="${r(sy + 6)}" fill="#f4efe2" font-family="Georgia,serif" font-size="17" font-weight="700" text-anchor="middle">FRESH · FREE</text>`
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
  drawnAt = signature()
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
