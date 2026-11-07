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
  const words = union([...text.querySelectorAll('p.kicker, .title-text, p.lede, .cta-row > *, .hero-meta')], o)
  if (!c || !words) return
  const rail = games.getBoundingClientRect().top - o.top + parseFloat(getComputedStyle(games, '::after').top)
  const ch = c.b - c.t
  // The stall: from left of Cath to right of the words; the roof's hem just over her head.
  const x1 = c.l - 64
  const x2 = words.r + 56
  // Plan item 259: ...and its scallops 14 px clear of the kicker (at 1440 their hem touched its caps).
  const hw = (x2 - x1 + 16) / Math.max(6, Math.round((x2 - x1) / 44))
  // (its sloped top band, 52 px over the hem's top, stays under the page's top edge)
  const roof = Math.max(56 - o.top - window.scrollY, Math.min(c.t + ch * 0.03, words.t - 14 - (hw / 2.4 - 8)))
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
  // The counter: in front of Cath from the left post to just past her, its top at her hips, its foot on the rail.
  const top = c.t + ch * 0.6
  const cr = Math.min(c.r + 70, board.l - 22)
  let f = ''
  f += produce(x1 - 6, cr, top + 2)
  f += `<rect x="${r(x1 - 14)}" y="${r(top)}" width="${r(cr - x1 + 14)}" height="16" rx="4" fill="#d9a15f"/>`
  f += `<rect x="${r(x1 - 14)}" y="${r(top)}" width="${r(cr - x1 + 14)}" height="4" rx="2" fill="#ffe2aa" opacity=".55"/>`
  f += `<rect x="${r(x1 - 8)}" y="${r(top + 15)}" width="${r(cr - x1 + 2)}" height="${r(rail - top - 15)}" fill="#a8693a"/>`
  let planks = ''
  for (let x = x1 + 18; x < cr - 8; x += 26) planks += `M${r(x)} ${r(top + 17)}V${r(rail)}`
  f += `<path d="${planks}" stroke="#6b3f24" stroke-width="2" opacity=".55"/>`
  f += `<rect x="${r(x1 - 8)}" y="${r(top + 15)}" width="${r(cr - x1 + 2)}" height="10" fill="#1a1119" opacity=".3"/>`
  // the chalk price board hung on the counter's front
  const sx = (x1 + cr) / 2
  const sy = top + (rail - top) * 0.52
  f += `<rect x="${r(sx - 66)}" y="${r(sy - 17)}" width="132" height="34" rx="4" fill="#2b3330" stroke="#6b3f24" stroke-width="3"/>`
  f += `<text x="${r(sx)}" y="${r(sy + 6)}" fill="#f4efe2" font-family="Georgia,serif" font-size="17" font-weight="700" text-anchor="middle">FRESH · FREE</text>`
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
}

/** Draw now, after the entrance settles and the fonts land, and on every resize. */
export function mountBooth(): void {
  drawBooth()
  addEventListener('resize', drawBooth)
  void document.fonts?.ready.then(drawBooth)
  // the words and Cath rise in over about 1.5 s; draw again once they rest
  setTimeout(drawBooth, 1800)
  setTimeout(drawBooth, 3200)
}
