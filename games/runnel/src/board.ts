// Draws a Runnel puzzle as SVG and keeps it in step with the game state. The page's Content Security
// Policy forbids inline style attributes, so every dynamic style goes through the CSSOM
// (`element.style.setProperty`), never through markup.

import { boardSky, type TimeOfDay } from './sky'
import { furrowAngle, groundFor } from './ground'
import { arrivalMs, bankSunlit, CASCADE_MS } from './water'
import { boardHexes, computeFlow, DIRECTIONS, hashString, type Cell, type Flow, type Puzzle } from './engine'

const SVG = 'http://www.w3.org/2000/svg'
const S = 50 // hex circumradius in SVG units
/** Plan item 264: how far a tile's side shows under its face (SVG units). */
const TILE_SIDE = 5
const APOTHEM = (S * Math.sqrt(3)) / 2
const TURN_MS = 150

type Crop = 'wheat' | 'cabbage' | 'carrot' | 'sunflower' | 'pumpkin'
const CROPS: Crop[] = ['wheat', 'cabbage', 'carrot', 'sunflower']
/** Crops by season (from the seed's month when it is a daily date; practice seeds use the default pool). */
const SEASON_CROPS: Record<string, Crop[]> = {
  spring: ['carrot', 'cabbage', 'wheat'],
  summer: ['sunflower', 'wheat', 'carrot'],
  autumn: ['pumpkin', 'wheat', 'cabbage'],
  winter: ['cabbage', 'carrot', 'pumpkin'],
}
function cropsForSeed(seed: string): Crop[] {
  const m = /^\d{4}-(\d{2})-\d{2}$/.exec(seed)
  if (!m) return CROPS
  const month = Number(m[1])
  const season = month >= 3 && month <= 5 ? 'spring' : month <= 8 && month >= 6 ? 'summer' : month >= 9 && month <= 11 ? 'autumn' : 'winter'
  return SEASON_CROPS[season]!
}

export interface BoardHandlers {
  onTurn(index: number, clockwise: boolean): void
  onToggleLock(index: number): void
}

interface CellView {
  root: SVGGElement
  piece: SVGGElement | null
  water: SVGLineElement[] // indexed by solved direction; only real openings are present
  spokeDirs: number[]
  /** Plan item 61: each ditch's two banks, lit or shaded by the sky's light as the tile turns. */
  banks: Array<{ line: SVGLineElement; dir: number; side: 1 | -1 }>
  /** The pending timer that marks `data-wet` when the water actually arrives. */
  wetTimer?: number
  angle: number // accumulated rotation in degrees, so animations always turn the short way
}

function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
  parent?: Element,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG, tag)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v))
  parent?.appendChild(node)
  return node
}

export function cellCentre(q: number, r: number): { x: number; y: number } {
  return { x: S * Math.sqrt(3) * (q + r / 2), y: S * 1.5 * r }
}

function hexPoints(radius: number): string {
  const pts: string[] = []
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 180) * (60 * k + 30)
    pts.push(`${(radius * Math.cos(a)).toFixed(2)},${(radius * Math.sin(a)).toFixed(2)}`)
  }
  return pts.join(' ')
}

function edgePoint(dir: number, distance = APOTHEM): { x: number; y: number } {
  const a = (Math.PI / 180) * 60 * dir
  return { x: distance * Math.cos(a), y: distance * Math.sin(a) }
}

export class Board {
  private readonly svg: SVGSVGElement
  private readonly puzzle: Puzzle
  private readonly handlers: BoardHandlers
  private readonly views: CellView[] = []
  private readonly puddles: SVGGElement
  private flow: Flow
  private readonly reducedMotion: boolean
  private pressTimer = 0
  private pressFired = false
  private focusIndex = -1

  constructor(svg: SVGSVGElement, puzzle: Puzzle, handlers: BoardHandlers) {
    this.svg = svg
    this.puzzle = puzzle
    this.handlers = handlers
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
    svg.replaceChildren()
    svg.classList.remove('won')
    this.fitViewBox()

    const defs = el('defs', {}, svg)
    const grain = el('pattern', { id: 'soil-grain', width: 14, height: 14, patternUnits: 'userSpaceOnUse' }, defs)
    el('circle', { cx: 3, cy: 4, r: 0.9, class: 'grain' }, grain)
    el('circle', { cx: 10, cy: 9, r: 0.7, class: 'grain' }, grain)
    el('circle', { cx: 6, cy: 12, r: 0.6, class: 'grain' }, grain)
    // Plan item 50: the dry ground's dressing. A ploughed field's furrows, and a meadow's clover and flowers.
    const furrows = el('pattern', { id: 'ground-furrows', width: 9, height: 9, patternUnits: 'userSpaceOnUse' }, defs)
    el('rect', { x: 0, y: 0, width: 9, height: 3.2, class: 'furrow-line' }, furrows)
    const meadow = el('pattern', { id: 'ground-meadow', width: 26, height: 22, patternUnits: 'userSpaceOnUse' }, defs)
    for (const [cx, cy, k] of [[4, 5, 'clover'], [17, 3, 'flower'], [11, 13, 'clover'], [22, 16, 'clover'], [3, 18, 'flower']] as const)
      el('circle', { cx, cy, r: k === 'flower' ? 1.3 : 1.9, class: `meadow-${k}` }, meadow)

    // A soft plinth under the whole board.
    const shadow = el('g', { class: 'plinth' }, svg)
    for (const c of puzzle.cells) {
      const { x, y } = cellCentre(c.q, c.r)
      el('polygon', { points: hexPoints(S * 1.08), transform: `translate(${x} ${y + 7})` }, shadow)
    }
    // Plan item 186: the board is dug into the valley. Each cell's enlarged hex overlaps its neighbours', so together
    // they make one terrace following the board's outline: a turf lip, then the dug soil apron inside it (its grain
    // the tiles' own), its contact shadow the plinth's. The valley's hedges and furrows stop at its edge.
    const terrace = el('g', { class: 'terrace', 'data-terrace': '' }, svg)
    const lip = el('g', { class: 'terrace-lip' }, terrace)
    const apron = el('g', { class: 'terrace-apron' }, terrace)
    const grainy = el('g', { class: 'terrace-grain' }, terrace)
    for (const c of puzzle.cells) {
      const { x, y } = cellCentre(c.q, c.r)
      el('polygon', { points: hexPoints(S * 1.24), transform: `translate(${x} ${y + 1})` }, lip)
      el('polygon', { points: hexPoints(S * 1.14), transform: `translate(${x} ${y})` }, apron)
      el('polygon', { points: hexPoints(S * 1.14), transform: `translate(${x} ${y})`, fill: 'url(#soil-grain)' }, grainy)
    }

    // Plan item 138: each tile's ditches end inside its own dark rim (they used to run over it into the seam). The
    // clip is in the tile's own frame and doesn't turn with the piece, so it holds at every rotation.
    const tileClip = el('clipPath', { id: 'tile-clip' }, defs)
    el('polygon', { points: hexPoints(S * 0.965 - 2.6) }, tileClip)
    const tiles = el('g', { class: 'tiles' }, svg)
    puzzle.cells.forEach((cell, i) => this.views.push(this.drawCell(tiles, cell, i)))
    this.puddles = el('g', { class: 'puddles' }, svg)
    this.drawSky(svg, defs)
    // drawCell already gave the first playable cell tabindex="0" as the sole initial roving-tabindex
    // stop; track it so the first focus/click elsewhere clears it instead of leaving two.
    this.focusIndex = this.firstPlayable()

    this.flow = computeFlow(puzzle.cells)
    this.applyFlow(this.flow, new Set(), true)
  }

  /** Re-reads the puzzle after a turn and animates the water to match. */
  refresh(turned: number): Flow {
    const view = this.views[turned]
    const cell = this.puzzle.cells[turned]
    if (view?.piece && cell) {
      const target = cell.rot * 60
      // Turn the short way from wherever the piece is drawn now.
      let delta = (((target - view.angle) % 360) + 360) % 360
      if (delta > 180) delta -= 360
      view.angle += delta
      view.piece.style.setProperty('transform', `rotate(${view.angle}deg)`)
      view.root.classList.toggle('locked', cell.locked)
    }
    const next = computeFlow(this.puzzle.cells)
    this.applyFlow(next, new Set([turned]), false)
    this.flow = next
    return next
  }

  setLocked(index: number): void {
    const cell = this.puzzle.cells[index]
    this.views[index]?.root.classList.toggle('locked', !!cell?.locked)
    this.describe(index)
  }

  /** Pulses one tile so the player can spot it. */
  pulse(index: number): void {
    const root = this.views[index]?.root
    if (!root) return
    root.classList.add('tip')
    window.setTimeout(() => root.classList.remove('tip'), 3200)
  }

  celebrate(): void {
    this.svg.classList.add('won')
  }

  focusCell(index: number): void {
    this.views[index]?.root.focus()
  }

  private fitViewBox(): void {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const c of this.puzzle.cells) {
      const { x, y } = cellCentre(c.q, c.r)
      minX = Math.min(minX, x - APOTHEM)
      maxX = Math.max(maxX, x + APOTHEM)
      minY = Math.min(minY, y - S)
      maxY = Math.max(maxY, y + S)
    }
    // Plan item 47: a board with only a few tiles (the lesson's four) keeps the scale of its full radius and sits
    // centred in the frame, rather than zooming its tiles up and running them into a corner.
    let fullW = 0
    let fullH = 0
    const full = boardHexes(this.puzzle.frameRadius ?? this.puzzle.radius)
    if (this.puzzle.cells.length * 2 < full.length) {
      let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity
      for (const h of full) {
        const { x, y } = cellCentre(h.q, h.r)
        a = Math.min(a, x - APOTHEM)
        b = Math.max(b, x + APOTHEM)
        c = Math.min(c, y - S)
        d = Math.max(d, y + S)
      }
      fullW = b - a
      fullH = d - c
    }
    const w = Math.max(maxX - minX, fullW)
    const h = Math.max(maxY - minY, fullH)
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    // Plan item 77: a framed sparse board (the lesson) keeps a margin, so its tiles clear the spring house and garden.
    const pad = this.puzzle.frameRadius === undefined ? 6 : S * 0.7
    this.svg.setAttribute('viewBox', `${cx - w / 2 - pad} ${cy - h / 2 - pad} ${w + pad * 2} ${h + pad * 2 + 8}`)
  }

  private drawCell(parent: SVGGElement, cell: Cell, index: number): CellView {
    const { x, y } = cellCentre(cell.q, cell.r)
    const ground = cell.kind === 'stone' ? null : groundFor(this.puzzle.seed, cell.q, cell.r)
    const root = el('g', { class: `cell ${cell.kind}${cell.reservoir ? ' reservoir' : ''}${cell.bridge ? ' bridge' : ''}${ground ? ` ground-${ground}` : ''}`, transform: `translate(${x.toFixed(2)} ${y.toFixed(2)})` }, parent)
    root.style.setProperty('--ring', String(Math.max(Math.abs(cell.q), Math.abs(cell.r), Math.abs(cell.q + cell.r))))
    // Plan item 90: each tile a solid piece casting its shadow on the valley, with a lit bevel inside its dark rim.
    el('polygon', { class: 'tile-shadow', points: hexPoints(S * 0.965), transform: 'translate(1.5 4.5)' }, root)
    // Plan item 264: the piece's thickness: its side, a darker band of the same earth under its face.
    el('polygon', { class: 'tile-side', points: hexPoints(S * 0.965), transform: `translate(0 ${TILE_SIDE})` }, root)
    el('polygon', { class: 'tile', points: hexPoints(S * 0.965) }, root)
    el('polygon', { class: 'tile-grain', points: hexPoints(S * 0.965) }, root)
    if (ground === 'field') el('polygon', { class: 'tile-dress', points: hexPoints(S * 0.9), fill: 'url(#ground-furrows)', transform: `rotate(${furrowAngle(this.puzzle.seed, cell.q, cell.r)})` }, root)
    // Plan item 277: a dry field cracks in the sun (three jagged lines from near its middle); water closes them (CSS).
    if (ground === 'field') el('path', { class: 'field-cracks', d: fieldCracks(`${this.puzzle.seed}:${cell.q},${cell.r}`) }, root)
    // ...and once watered it sprouts, in three waves after the water arrives (CSS staggers them from --delay).
    if (ground === 'field') {
      const sp = el('g', { class: 'field-sprouts' }, root)
      fieldSprouts(`${this.puzzle.seed}:${cell.q},${cell.r}`).forEach(([x, y], k) =>
        el('path', { class: `sprout s${(k % 3) + 1}`, d: 'M0 0v-4.5M0 -2.2q-2.6 -2.8 -4.4 -2.4M0 -2.8q2.4 -3 4.2 -2.6', transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})` }, sp),
      )
    }
    else if (ground === 'meadow') el('polygon', { class: 'tile-dress', points: hexPoints(S * 0.9), fill: 'url(#ground-meadow)' }, root)

    el('polygon', { class: 'tile-bevel', points: hexPoints(S * 0.9) }, root)

    const view: CellView = { root, piece: null, water: [], spokeDirs: [], banks: [], angle: cell.rot * 60 }

    if (cell.kind === 'stone') {
      this.drawStones(root, index)
      return view
    }

    root.setAttribute('tabindex', index === this.firstPlayable() ? '0' : '-1')
    root.setAttribute('role', 'button')
    this.bindInput(root, index)

    const piece = el('g', { class: 'piece' }, el('g', { class: 'piece-clip', 'clip-path': 'url(#tile-clip)' }, root))
    // An invisible disc keeps the piece's bounding box centred on the cell, so CSS can rotate it about
    // its centre with transform-box: fill-box.
    el('circle', { r: S, class: 'bbox' }, piece)
    piece.style.setProperty('transform', `rotate(${view.angle}deg)`)
    view.piece = piece

    // Plan item 61: each opening a ditch cut into the ground: a grass or soil lip, banks lit and shaded by the
    // day's light, a dark bed with pebbles, and a stone basin at the hub.
    const cuts = el('g', { class: 'cuts' }, piece)
    const lips = el('g', { class: 'lips' }, piece)
    const grooves = el('g', { class: 'grooves' }, piece)
    const waters = el('g', { class: 'waters' }, piece)
    const shimmer = el('g', { class: 'shimmers' }, piece)
    const seed = hashString(`${this.puzzle.seed}:${cell.q},${cell.r}`)
    for (let d = 0; d < 6; d++) {
      if (!(cell.solved & (1 << d))) continue
      const end = edgePoint(d, APOTHEM + 1.5)
      // Plan item 264: the cut's outer edge, a dark line just past the lip, so the groove reads as carved into the
      // tile (the lip alone was 2.4:1 on the face; this is 3:1 or more in light and dark).
      el('line', { x1: 0, y1: 0, x2: end.x, y2: end.y, class: 'groove-cut' }, cuts)
      el('line', { x1: 0, y1: 0, x2: end.x, y2: end.y, class: 'groove-lip' }, lips)
      el('line', { x1: 0, y1: 0, x2: end.x, y2: end.y, class: 'groove' }, grooves)
      const a = (Math.PI / 180) * 60 * d
      const nx = -Math.sin(a)
      const ny = Math.cos(a)
      for (const side of [1, -1] as const) {
        const o = 4.6 * side
        const line = el('line', { x1: nx * o, y1: ny * o, x2: end.x + nx * o, y2: end.y + ny * o, class: 'bank' }, grooves)
        view.banks.push({ line, dir: d, side })
        // Plan item 97: the cut edge on the shaded side throws a shadow down its wall (hidden on the sunlit side),
        // so the ditch reads as dug into the soil rather than laid on it.
        const c = 7.9 * side
        const cast = el('line', { x1: nx * c, y1: ny * c, x2: end.x + nx * c, y2: end.y + ny * c, class: 'bank-cast' }, grooves)
        view.banks.push({ line: cast, dir: d, side })
        // The shaded wall's foot darkens into the damp bed (the sunlit wall stays lit to the bed).
        const f = 3.6 * side
        const foot = el('line', { x1: nx * f, y1: ny * f, x2: end.x + nx * f, y2: end.y + ny * f, class: 'bank-foot' }, grooves)
        view.banks.push({ line: foot, dir: d, side })
        // A ragged cut edge: spoil from the digging thrown just past the lip, so the edge is not ruled.
        const r = 11.4 * side
        const crumb = el('line', { x1: nx * r, y1: ny * r, x2: end.x + nx * r, y2: end.y + ny * r, class: 'lip-crumb' }, grooves)
        crumb.style.setProperty('stroke-dashoffset', `${((seed >>> (d * 3 + (side > 0 ? 1 : 0))) % 7) * 0.9}`)
      }
      el('line', { x1: 0, y1: 0, x2: end.x, y2: end.y, class: 'groove-bed' }, grooves)
      // Plan item 97: a few small stones lie in the damp bed (on the banks they read as bolts on a plank).
      const h = (seed >>> (d * 4)) & 0xff
      if (h % 3 !== 0) {
        const t = 0.4 + (h / 255) * 0.45
        const o = ((h >> 2) % 3 - 1) * 1.3
        el('circle', { cx: end.x * t + nx * o, cy: end.y * t + ny * o, r: 0.7 + (h % 2) * 0.35, class: 'pebble' }, grooves)
      }
      const water = el('line', { x1: 0, y1: 0, x2: end.x, y2: end.y, pathLength: 1, class: 'water' }, waters)
      water.dataset.dir = String(d)
      view.water[d] = water
      view.spokeDirs.push(d)
      const sh = el('line', { x1: 0, y1: 0, x2: end.x, y2: end.y, pathLength: 1, class: 'shimmer' }, shimmer)
      sh.dataset.dir = String(d)
    }
    el('circle', { r: S * 0.2 + 1.6, class: 'hub-cut' }, cuts)
    el('circle', { r: S * 0.2, class: 'hub-lip' }, lips)
    el('circle', { r: S * 0.17, class: 'hub-groove' }, grooves)
    el('circle', { r: S * 0.155, class: 'hub-basin' }, grooves)
    el('circle', { r: S * 0.1, class: 'hub-bed' }, grooves)
    el('circle', { r: S * 0.1, class: 'hub-water' }, waters)

    if (cell.bridge) this.drawBridge(piece)
    if (cell.kind === 'spring') this.drawSpring(root)
    else this.drawBanks(root, cell, index)
    if (cell.reservoir) this.drawReservoir(root)
    else if (cell.kind === 'field') this.drawField(root, index)
    // Plan item 61: a pinned tile has a wooden stake driven in by its top edge, a twist of twine round it.
    // (The CSS pop-in scales .pin, which would override a transform on it, so a wrapper places it.)
    const pinAt = el('g', { transform: `translate(0 ${(-S * 0.58).toFixed(2)}) scale(1.45)` }, root)
    const pin = el('g', { class: 'pin' }, pinAt)
    el('ellipse', { cx: 1.5, cy: 7.5, rx: 5, ry: 1.8, class: 'pin-shadow' }, pin)
    el('path', { d: 'M -2.6 -8 L 2.6 -8 L 2.6 5 L 0 8.5 L -2.6 5 Z', class: 'pin-stake' }, pin)
    el('rect', { x: -3.2, y: -4.5, width: 6.4, height: 2.4, rx: 1, class: 'pin-twine' }, pin)
    return view
  }

  /**
   * The day's light and weather over the board, clipped to the tiles: a wash for the time of day,
   * drifting cloud shadows, drizzle (which clears into a rainbow when the board is solved) or a breeze
   * that makes the crops sway harder. Purely decorative and never in the way of a tap.
   */
  private drawSky(svg: SVGSVGElement, defs: SVGDefsElement): void {
    // Screenshot hook: `?sky=<time>,<weather>` forces the day's sky.
    const sky = boardSky(this.puzzle.seed)
    svg.dataset.time = sky.time
    // Plan item 50: the whole scene takes the board's light (a sky band over the page and the field).
    document.documentElement.dataset.time = sky.time
    document.documentElement.dataset.weather = sky.weather
    svg.setAttribute('aria-label', `Puzzle board. ${sky.label}`)
    svg.dataset.weather = sky.weather
    const clip = el('clipPath', { id: 'board-clip' }, defs)
    for (const c of this.puzzle.cells) {
      const { x, y } = cellCentre(c.q, c.r)
      el('polygon', { points: hexPoints(S * 0.965), transform: `translate(${x.toFixed(2)} ${y.toFixed(2)})` }, clip)
    }
    const [vx, vy, vw, vh] = (svg.getAttribute('viewBox') ?? '0 0 0 0').split(' ').map(Number) as [number, number, number, number]
    const g = el('g', { class: 'sky', 'clip-path': 'url(#board-clip)', 'aria-hidden': 'true' }, svg)
    el('rect', { class: 'sky-light', x: vx, y: vy, width: vw, height: vh }, g)
    const rng = (k: number) => (hashString(`${this.puzzle.seed}:sky:${k}`) % 1000) / 1000
    if (sky.weather === 'clouds' || sky.weather === 'drizzle') {
      // Plan item 30: each shadow fades out from its middle, so it drifts over the board without an edge.
      const soft = el('radialGradient', { id: 'cloud-soft' }, defs)
      el('stop', { class: 'cloud-stop', offset: '0', 'stop-opacity': '1' }, soft)
      el('stop', { class: 'cloud-stop', offset: '0.55', 'stop-opacity': '0.6' }, soft)
      el('stop', { class: 'cloud-stop', offset: '1', 'stop-opacity': '0' }, soft)
      for (let k = 0; k < 3; k++) {
        const cl = el('ellipse', {
          class: 'cloud',
          cx: (vx + vw * (0.15 + 0.35 * k)).toFixed(1),
          cy: (vy + vh * (0.2 + 0.6 * rng(k))).toFixed(1),
          rx: (vw * (0.22 + 0.1 * rng(k + 10))).toFixed(1),
          ry: (vh * 0.12).toFixed(1),
        }, g)
        cl.style.setProperty('--drift-delay', `${(-rng(k + 20) * 40).toFixed(1)}s`)
      }
    }
    if (sky.weather === 'drizzle') {
      const rain = el('g', { class: 'rain' }, g)
      for (let k = 0; k < 42; k++) {
        const x = vx + vw * rng(k + 30)
        const y = vy + vh * rng(k + 80)
        const d = el('line', { class: 'drop', x1: x.toFixed(1), y1: y.toFixed(1), x2: (x - 4).toFixed(1), y2: (y + 14).toFixed(1) }, rain)
        d.style.setProperty('--fall-delay', `${(-rng(k + 130) * 1.1).toFixed(2)}s`)
      }
      const bow = el('g', { class: 'rainbow' }, svg)
      bow.setAttribute('aria-hidden', 'true')
      const cx = vx + vw / 2
      const base = vy + vh * 0.95
      ;['#e86f5a', '#f0a33c', '#f2d35b', '#7fbf6a', '#5aa6d6', '#8a7fd0'].forEach((colour, k) => {
        const r = vw * 0.46 - k * 7
        const arc = el('path', { d: `M${(cx - r).toFixed(1)} ${base.toFixed(1)} A${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${(cx + r).toFixed(1)} ${base.toFixed(1)}`, class: 'bow-band' }, bow)
        arc.style.setProperty('stroke', colour)
      })
    }
  }

  private firstPlayable(): number {
    return this.puzzle.cells.findIndex((c) => c.kind === 'spring')
  }

  private drawStones(root: SVGGElement, index: number): void {
    const h = hashString(`stone${index}${this.puzzle.seed}`)
    const g = el('g', { class: 'rocks', transform: `rotate(${h % 360})` }, root)
    el('ellipse', { cx: -9, cy: 4, rx: 17, ry: 12, class: 'rock' }, g)
    el('ellipse', { cx: 12, cy: -6, rx: 12, ry: 9, class: 'rock rock-2' }, g)
    el('ellipse', { cx: 6, cy: 15, rx: 7, ry: 5, class: 'rock rock-3' }, g)
  }

  private drawSpring(root: SVGGElement): void {
    const g = el('g', { class: 'spring-well' }, root)
    el('circle', { r: S * 0.46, class: 'well-glow' }, g)
    el('circle', { r: S * 0.46, class: 'well-glow well-glow-2' }, g)
    el('circle', { r: S * 0.36, class: 'well-ring' }, g)
    el('circle', { r: S * 0.27, class: 'well-water' }, g)
    el('circle', { r: S * 0.12, class: 'well-ripple' }, g)
    el('circle', { r: S * 0.12, class: 'well-ripple well-ripple-2' }, g)
  }

  private drawReservoir(root: SVGGElement): void {
    const g = el('g', { class: 'reservoir-pond' }, root)
    el('ellipse', { cx: 0, cy: 2, rx: S * 0.5, ry: S * 0.38, class: 'pond-rim' }, g)
    el('ellipse', { cx: 0, cy: 2, rx: S * 0.4, ry: S * 0.29, class: 'pond-water' }, g)
    el('ellipse', { cx: -6, cy: -1, rx: 9, ry: 3.5, class: 'pond-shine' }, g)
  }

  /**
   * The living landscape: a soak ripple that spreads when the water arrives, and grass tufts in the
   * tile's corners (channels only ever run to edge midpoints, so corners are always free) that stand up
   * green when watered. Fields also get wildflowers that open after the crop has grown.
   */
  private drawBanks(root: SVGGElement, cell: Cell, index: number): void {
    el('polygon', { class: 'soak', points: hexPoints(S * 0.9) }, root)
    const g = el('g', { class: 'banks' }, root)
    const h = hashString(`${this.puzzle.seed}:bank:${index}`)
    const field = cell.kind === 'field' && !cell.reservoir
    // The top corner is left clear for the pin marker.
    const corners = [0, 1, 2, 3, 5]
    const count = field ? 4 : 2 + (h % 2)
    const start = h % corners.length
    for (let k = 0; k < count; k++) {
      const corner = corners[(start + k * (field ? 1 : 2)) % corners.length]!
      const a = (Math.PI / 180) * (60 * corner + 30)
      const r = S * (0.7 + ((h >>> (k + 3)) % 3) * 0.03)
      const x = r * Math.cos(a)
      const y = r * Math.sin(a)
      const flower = field && k % 2 === 1
      const t = el('g', { class: flower ? 'tuft bloom' : 'tuft', transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})` }, g)
      t.style.setProperty('--k', String(k))
      const blades = el('g', { class: 'blades' }, t)
      el('path', { d: 'M0 3 Q-4 -2 -6 -8 M0 3 Q0 -4 1 -10 M0 3 Q3 -2 6 -7', class: 'blade' }, blades)
      if (flower) {
        const head = el('g', { class: 'blossom', transform: 'translate(1 -10)' }, t)
        for (let p = 0; p < 5; p++) {
          const pa = (p * 72 * Math.PI) / 180
          el('circle', { cx: (Math.cos(pa) * 2.6).toFixed(2), cy: (Math.sin(pa) * 2.6).toFixed(2), r: 2.1, class: 'blossom-petal' }, head)
        }
        el('circle', { r: 1.5, class: 'blossom-eye' }, head)
        head.classList.add(`hue-${(h >>> k) % 3}`)
      }
    }
  }

  /** A plank deck over the crossing, so a bridge reads apart from a plain four-way junction. */
  private drawBridge(piece: SVGGElement): void {
    const g = el('g', { class: 'bridge-deck' }, piece)
    el('rect', { x: -S * 0.5, y: -5, width: S, height: 10, rx: 2, class: 'deck-plank' }, g)
    for (const dx of [-14, -5, 5, 14]) el('line', { x1: dx, y1: -5, x2: dx, y2: 5, class: 'deck-seam' }, g)
  }

  private drawField(root: SVGGElement, index: number): void {
    const pool = cropsForSeed(this.puzzle.seed)
    const crop = pool[hashString(`${this.puzzle.seed}:${index}`) % pool.length]!
    const g = el('g', { class: 'field-plot' }, root)
    el('ellipse', { cx: 0, cy: 6, rx: S * 0.42, ry: S * 0.3, class: 'mound' }, g)
    for (const dx of [-11, 0, 11]) el('line', { x1: dx - 3, y1: -2, x2: dx + 3, y2: 14, class: 'furrow' }, g)
    const plant = el('g', { class: `crop crop-${crop}` }, g)
    // Water-arrival sparkle: droplets that burst out of the plot when it turns wet (CSS-driven).
    const spark = el('g', { class: 'spark' }, g)
    for (let k = 0; k < 6; k++) {
      const ang = (k / 6) * Math.PI * 2 + 0.4
      const drop = el('circle', { r: k % 2 ? 2 : 3, cx: 0, cy: -4, class: 'spark-drop' }, spark)
      drop.style.setProperty('--sx', `${(Math.cos(ang) * 24).toFixed(1)}px`)
      drop.style.setProperty('--sy', `${(Math.sin(ang) * 20).toFixed(1)}px`)
    }
    const sway = el('g', { class: 'sway' }, plant)
    switch (crop) {
      case 'wheat':
        for (const dx of [-8, 0, 8]) {
          el('line', { x1: dx * 0.5, y1: 8, x2: dx, y2: -16, class: 'stalk' }, sway)
          el('ellipse', { cx: dx, cy: -20, rx: 3.6, ry: 8, class: 'ear' }, sway)
        }
        break
      case 'cabbage':
        el('circle', { cx: 0, cy: -2, r: 13, class: 'leaf-outer' }, sway)
        el('circle', { cx: 0, cy: -3, r: 8, class: 'leaf-inner' }, sway)
        el('path', { d: 'M-5 -3 Q0 -9 5 -3', class: 'vein' }, sway)
        break
      case 'carrot':
        for (const dx of [-7, 0, 7]) {
          el('path', { d: `M${dx} 4 L${dx - 2.5} 10 L${dx + 2.5} 10 Z`, class: 'root' }, sway)
          el('path', { d: `M${dx} 4 Q${dx - 6} -10 ${dx - 2} -18 M${dx} 4 Q${dx + 5} -8 ${dx + 3} -16`, class: 'frond' }, sway)
        }
        break
      case 'sunflower':
        el('line', { x1: 0, y1: 10, x2: 0, y2: -8, class: 'stalk' }, sway)
        el('path', { d: 'M0 2 Q-9 -2 -10 4 Q-4 6 0 2', class: 'frond-fill' }, sway)
        for (let k = 0; k < 10; k++) {
          const a = (k * 36 * Math.PI) / 180
          el('ellipse', {
            cx: (Math.cos(a) * 8).toFixed(2),
            cy: (-16 + Math.sin(a) * 8).toFixed(2),
            rx: 4,
            ry: 2.4,
            transform: `rotate(${k * 36} ${(Math.cos(a) * 8).toFixed(2)} ${(-16 + Math.sin(a) * 8).toFixed(2)})`,
            class: 'petal',
          }, sway)
        }
        el('circle', { cx: 0, cy: -16, r: 5.5, class: 'seedhead' }, sway)
        break
      case 'pumpkin':
        el('path', { d: 'M0 -4 Q6 -14 12 -12', class: 'frond' }, sway)
        el('ellipse', { cx: -6, cy: 0, rx: 8, ry: 10, class: 'pumpkin-side' }, sway)
        el('ellipse', { cx: 6, cy: 0, rx: 8, ry: 10, class: 'pumpkin-side' }, sway)
        el('ellipse', { cx: 0, cy: 0, rx: 8, ry: 11, class: 'pumpkin' }, sway)
        el('line', { x1: 0, y1: -10, x2: 1, y2: -15, class: 'stalk' }, sway)
        break
    }
    plant.style.setProperty('--sway-delay', `${(hashString(crop + index) % 900) / 1000}s`)
  }

  private bindInput(root: SVGGElement, index: number): void {
    const cancelPress = () => {
      window.clearTimeout(this.pressTimer)
      this.pressTimer = 0
    }
    root.addEventListener('pointerdown', (e) => {
      this.pressFired = false
      cancelPress()
      if (e.button !== 0) return
      this.pressTimer = window.setTimeout(() => {
        this.pressFired = true
        this.handlers.onToggleLock(index)
        if (navigator.vibrate) navigator.vibrate(15)
      }, 420)
    })
    root.addEventListener('pointerup', (e) => {
      if (e.button !== 0) return
      const wasLongPress = this.pressFired
      cancelPress()
      if (!wasLongPress) this.handlers.onTurn(index, !e.shiftKey)
    })
    root.addEventListener('pointerleave', cancelPress)
    root.addEventListener('pointercancel', cancelPress)
    root.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      // A touch long-press (Android fires contextmenu for it) is handled by the pin timer. A right-click
      // never starts that timer, so it turns the piece anticlockwise.
      if (this.pressTimer || this.pressFired) return
      this.handlers.onTurn(index, false)
    })
    root.addEventListener('keydown', (e) => this.onKey(e, index))
    root.addEventListener('focus', () => {
      // Keep the roving tabindex in step with whichever cell actually has DOM focus, however it got
      // there (arrow keys already move it themselves, but a pointer tap or a Tab from outside the
      // board would otherwise leave the old cell as the sole tabindex="0" stop).
      if (this.focusIndex >= 0 && this.focusIndex !== index) {
        this.views[this.focusIndex]?.root.setAttribute('tabindex', '-1')
      }
      root.setAttribute('tabindex', '0')
      this.focusIndex = index
    })
  }

  private onKey(e: KeyboardEvent, index: number): void {
    const moves: Record<string, number> = {
      ArrowRight: 0,
      ArrowLeft: 3,
      ArrowDown: 1,
      ArrowUp: 5,
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      this.handlers.onTurn(index, !e.shiftKey)
      return
    }
    if (e.key === 'l' || e.key === 'L' || e.key === 'p' || e.key === 'P') {
      e.preventDefault()
      this.handlers.onToggleLock(index)
      return
    }
    const dir = moves[e.key]
    if (dir === undefined) return
    e.preventDefault()
    const from = this.puzzle.cells[index]!
    // Up/down alternate between the two diagonal neighbours so the focus doesn't drift sideways.
    const options = e.key === 'ArrowDown' ? [1, 2] : e.key === 'ArrowUp' ? [5, 4] : [dir]
    for (const d of options) {
      const step = DIRECTIONS[d]!
      const target = this.puzzle.cells.findIndex(
        (c) => c.q === from.q + step.q && c.r === from.r + step.r && c.kind !== 'stone',
      )
      if (target >= 0) {
        this.views[index]!.root.setAttribute('tabindex', '-1')
        this.views[target]!.root.setAttribute('tabindex', '0')
        this.views[target]!.root.focus()
        return
      }
    }
  }

  private applyFlow(flow: Flow, turned: Set<number>, initial: boolean): void {
    const prevWet = initial ? new Set<number>() : this.flow.wet
    let minNewDepth = Infinity
    for (const i of flow.wet) if (!prevWet.has(i)) minNewDepth = Math.min(minNewDepth, flow.depth.get(i)!)
    const settle = turned.size && !this.reducedMotion ? TURN_MS : 0

    this.puzzle.cells.forEach((cell, i) => {
      const view = this.views[i]!
      if (cell.kind === 'stone') return
      const wet = flow.wet.has(i)
      const wasWet = prevWet.has(i)
      const root = view.root
      root.classList.toggle('locked', cell.locked)
      root.classList.toggle('fixed', !!cell.fixed)
      if (wet && !wasWet) {
        const delay = initial || this.reducedMotion ? 0 : arrivalMs(flow.depth.get(i)!, minNewDepth, settle)
        root.style.setProperty('--delay', `${delay}ms`)
        root.classList.add('wet')
        root.classList.toggle('instant', initial)
        // `data-wet` marks when the water is really there (tests, and the CSS for the soaked soil).
        clearTimeout(view.wetTimer)
        // Plan item 151: a watered field is tended (its farmer at work, its crop up).
        const mark = () => {
          root.dataset.wet = '1'
          if (cell.kind === 'field') root.dataset.tended = '1'
        }
        if (delay) view.wetTimer = window.setTimeout(mark, delay + 70)
        else mark()
      } else if (!wet && wasWet) {
        root.style.setProperty('--delay', '0ms')
        root.classList.remove('wet')
        clearTimeout(view.wetTimer)
        delete root.dataset.wet
        delete root.dataset.tended
      }
      const time = this.time()
      for (const b of view.banks) b.line.classList.toggle('sun', bankSunlit((b.dir + cell.rot) * 60, b.side, time))
      if (wet) this.setInflow(view, cell, flow.inflow.get(i))
      root.classList.toggle('leaking', flow.leaks.has(i))
      this.describe(i, flow)
    })

    // Puddles where water spills onto dry ground: drawn unrotated, at the spilling edge.
    this.puddles.replaceChildren()
    for (const [i, mask] of flow.leakMask) {
      const cell = this.puzzle.cells[i]!
      const c = cellCentre(cell.q, cell.r)
      // Plan item 97: the spill comes when the front reaches its open end (the tile's arrival plus the out-run),
      // with a splash; a spill already there stays still.
      const fresh = !initial && !this.reducedMotion && !this.flow.leakMask.has(i)
      const depth = flow.depth.get(i)
      const at = fresh && depth !== undefined && Number.isFinite(minNewDepth) ? arrivalMs(depth, minNewDepth, settle) + CASCADE_MS : 0
      for (let d = 0; d < 6; d++) {
        if (!(mask & (1 << d))) continue
        const p = edgePoint(d, APOTHEM * 0.93)
        const g = el('g', { class: fresh ? 'puddle splash' : 'puddle', transform: `translate(${(c.x + p.x).toFixed(2)} ${(c.y + p.y).toFixed(2)}) rotate(${d * 60})` }, this.puddles)
        g.dataset.spill = String(i)
        g.style.setProperty('--delay', `${fresh ? at : 0}ms`)
        el('ellipse', { rx: 9, ry: 13, class: 'puddle-water' }, g)
        el('ellipse', { rx: 4, ry: 6, cx: -1, cy: -2, class: 'puddle-shine' }, g)
        if (fresh) {
          el('ellipse', { rx: 9, ry: 13, class: 'splash-ring' }, g)
          for (const [dx, dy] of [[-7, -9], [6, -11], [9, 4], [-8, 8]] as const) {
            const drop = el('circle', { cx: dx, cy: dy, r: 1.6, class: 'splash-drop' }, g)
            drop.style.setProperty('--dx', `${dx * 0.6}px`)
            drop.style.setProperty('--dy', `${dy * 0.6}px`)
          }
        }
      }
    }
  }

  /** Marks the spoke the water enters by, so its shimmer runs inwards and the others run outwards. */
  private setInflow(view: CellView, cell: Cell, inflow: number | undefined): void {
    const solvedDir = inflow === undefined ? -1 : (((inflow - cell.rot) % 6) + 6) % 6
    for (const d of view.spokeDirs) view.water[d]?.classList.toggle('in', d === solvedDir)
    view.piece?.querySelectorAll<SVGLineElement>('.shimmer').forEach((s) => {
      s.classList.toggle('in', Number(s.dataset.dir) === solvedDir)
    })
  }

  private describe(index: number, flow: Flow = this.flow): void {
    const cell = this.puzzle.cells[index]!
    const view = this.views[index]!
    if (cell.kind === 'stone') return
    const name = cell.reservoir ? 'Reservoir' : cell.bridge ? 'Bridge' : cell.kind === 'spring' ? 'Spring' : cell.kind === 'field' ? 'Field' : 'Channel'
    const state = flow.wet.has(index) ? (flow.leaks.has(index) ? 'watered, spilling' : 'watered') : 'dry'
    view.root.setAttribute('aria-label', `${name}, ${state}${cell.reservoir ? '' : cell.fixed ? ', fixed sluice' : cell.locked ? ', pinned' : ''}`)
  }

  private skyTime: TimeOfDay | null = null
  /** The board's time of day (its light), read once. */
  private time(): TimeOfDay {
    return (this.skyTime ??= boardSky(this.puzzle.seed).time)
  }

  get focusedIndex(): number {
    return this.focusIndex
  }
}

/** Plan item 277: a dry field's cracks, seeded by the cell so a board always draws the same: three jagged lines that
 *  start near the tile's middle and run out most of the way to its rim, each with two kinks and a short fork. */
function fieldCracks(key: string): string {
  let h = hashString(`cracks:${key}`) || 1
  const rnd = () => {
    h ^= h << 13
    h ^= h >>> 17
    h ^= h << 5
    return ((h >>> 0) % 1000) / 1000
  }
  let d = ''
  const base = rnd() * Math.PI * 2
  for (let k = 0; k < 3; k++) {
    const a = base + (k * Math.PI * 2) / 3 + (rnd() - 0.5) * 0.8
    let x = Math.cos(a) * S * 0.08
    let y = Math.sin(a) * S * 0.08
    d += `M${x.toFixed(1)} ${y.toFixed(1)}`
    for (let j = 1; j <= 3; j++) {
      const r = S * (0.08 + 0.2 * j)
      const t = a + (rnd() - 0.5) * 0.7
      x = Math.cos(t) * r
      y = Math.sin(t) * r
      d += `L${x.toFixed(1)} ${y.toFixed(1)}`
      if (j === 2) {
        const f = t + (rnd() < 0.5 ? -0.9 : 0.9)
        d += `l${(Math.cos(f) * S * 0.14).toFixed(1)} ${(Math.sin(f) * S * 0.14).toFixed(1)}M${x.toFixed(1)} ${y.toFixed(1)}`
      }
    }
  }
  return d
}

/** Plan item 277: where a watered field's shoots come up: twelve spots spread over the tile (a seeded jittered ring
 *  pattern), which the CSS brings up in three waves. The channel piece draws over any under its groove. */
function fieldSprouts(key: string): Array<[number, number]> {
  let h = hashString(`sprouts:${key}`) || 7
  const rnd = () => {
    h ^= h << 13
    h ^= h >>> 17
    h ^= h << 5
    return ((h >>> 0) % 1000) / 1000
  }
  const out: Array<[number, number]> = []
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2 + rnd() * 0.5
    const r = S * (k % 2 ? 0.34 : 0.62) + (rnd() - 0.5) * S * 0.12
    out.push([Math.cos(a) * r, Math.sin(a) * r + 2])
  }
  return out
}
