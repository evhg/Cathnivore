// Draws a Runnel puzzle as SVG and keeps it in step with the game state. The page's Content Security
// Policy forbids inline style attributes, so every dynamic style goes through the CSSOM
// (`element.style.setProperty`), never through markup.

import { computeFlow, DIRECTIONS, hashString, type Cell, type Flow, type Puzzle } from './engine'

const SVG = 'http://www.w3.org/2000/svg'
const S = 50 // hex circumradius in SVG units
const APOTHEM = (S * Math.sqrt(3)) / 2
const TURN_MS = 150
const CASCADE_MS = 55

type Crop = 'wheat' | 'cabbage' | 'carrot' | 'sunflower'
const CROPS: Crop[] = ['wheat', 'cabbage', 'carrot', 'sunflower']

export interface BoardHandlers {
  onTurn(index: number, clockwise: boolean): void
  onToggleLock(index: number): void
}

interface CellView {
  root: SVGGElement
  piece: SVGGElement | null
  water: SVGLineElement[] // indexed by solved direction; only real openings are present
  spokeDirs: number[]
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

    // A soft plinth under the whole board.
    const shadow = el('g', { class: 'plinth' }, svg)
    for (const c of puzzle.cells) {
      const { x, y } = cellCentre(c.q, c.r)
      el('polygon', { points: hexPoints(S * 1.08), transform: `translate(${x} ${y + 7})` }, shadow)
    }

    const tiles = el('g', { class: 'tiles' }, svg)
    puzzle.cells.forEach((cell, i) => this.views.push(this.drawCell(tiles, cell, i)))
    this.puddles = el('g', { class: 'puddles' }, svg)
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
    const pad = 14
    this.svg.setAttribute(
      'viewBox',
      `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2 + 8}`,
    )
  }

  private drawCell(parent: SVGGElement, cell: Cell, index: number): CellView {
    const { x, y } = cellCentre(cell.q, cell.r)
    const root = el('g', { class: `cell ${cell.kind}`, transform: `translate(${x.toFixed(2)} ${y.toFixed(2)})` }, parent)
    root.style.setProperty('--ring', String(Math.max(Math.abs(cell.q), Math.abs(cell.r), Math.abs(cell.q + cell.r))))
    el('polygon', { class: 'tile', points: hexPoints(S * 0.965) }, root)
    el('polygon', { class: 'tile-grain', points: hexPoints(S * 0.965) }, root)

    const view: CellView = { root, piece: null, water: [], spokeDirs: [], angle: cell.rot * 60 }

    if (cell.kind === 'stone') {
      this.drawStones(root, index)
      return view
    }

    root.setAttribute('tabindex', index === this.firstPlayable() ? '0' : '-1')
    root.setAttribute('role', 'button')
    this.bindInput(root, index)

    const piece = el('g', { class: 'piece' }, root)
    // An invisible disc keeps the piece's bounding box centred on the cell, so CSS can rotate it about
    // its centre with transform-box: fill-box.
    el('circle', { r: S, class: 'bbox' }, piece)
    piece.style.setProperty('transform', `rotate(${view.angle}deg)`)
    view.piece = piece

    const grooves = el('g', { class: 'grooves' }, piece)
    const waters = el('g', { class: 'waters' }, piece)
    const shimmer = el('g', { class: 'shimmers' }, piece)
    for (let d = 0; d < 6; d++) {
      if (!(cell.solved & (1 << d))) continue
      const end = edgePoint(d, APOTHEM + 1.5)
      el('line', { x1: 0, y1: 0, x2: end.x, y2: end.y, class: 'groove' }, grooves)
      const water = el('line', { x1: 0, y1: 0, x2: end.x, y2: end.y, pathLength: 1, class: 'water' }, waters)
      water.dataset.dir = String(d)
      view.water[d] = water
      view.spokeDirs.push(d)
      const sh = el('line', { x1: 0, y1: 0, x2: end.x, y2: end.y, pathLength: 1, class: 'shimmer' }, shimmer)
      sh.dataset.dir = String(d)
    }
    el('circle', { r: S * 0.17, class: 'hub-groove' }, grooves)
    el('circle', { r: S * 0.1, class: 'hub-water' }, waters)

    if (cell.kind === 'spring') this.drawSpring(root)
    if (cell.kind === 'field') this.drawField(root, index)
    el('circle', { class: 'pin', r: 5.5, cx: 0, cy: -S * 0.62 }, root)
    return view
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
    el('circle', { r: S * 0.36, class: 'well-ring' }, g)
    el('circle', { r: S * 0.27, class: 'well-water' }, g)
    el('circle', { r: S * 0.12, class: 'well-ripple' }, g)
    el('circle', { r: S * 0.12, class: 'well-ripple well-ripple-2' }, g)
  }

  private drawField(root: SVGGElement, index: number): void {
    const crop = CROPS[hashString(`${this.puzzle.seed}:${index}`) % CROPS.length]!
    const g = el('g', { class: 'field-plot' }, root)
    el('ellipse', { cx: 0, cy: 6, rx: S * 0.42, ry: S * 0.3, class: 'mound' }, g)
    for (const dx of [-11, 0, 11]) el('line', { x1: dx - 3, y1: -2, x2: dx + 3, y2: 14, class: 'furrow' }, g)
    const plant = el('g', { class: `crop crop-${crop}` }, g)
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
      if (wet && !wasWet) {
        const delay = initial || this.reducedMotion ? 0 : settle + (flow.depth.get(i)! - minNewDepth) * CASCADE_MS
        root.style.setProperty('--delay', `${delay}ms`)
        root.classList.add('wet')
        root.classList.toggle('instant', initial)
      } else if (!wet && wasWet) {
        root.style.setProperty('--delay', '0ms')
        root.classList.remove('wet')
      }
      if (wet) this.setInflow(view, cell, flow.inflow.get(i))
      root.classList.toggle('leaking', flow.leaks.has(i))
      this.describe(i, flow)
    })

    // Puddles where water spills onto dry ground: drawn unrotated, at the spilling edge.
    this.puddles.replaceChildren()
    for (const [i, mask] of flow.leakMask) {
      const cell = this.puzzle.cells[i]!
      const c = cellCentre(cell.q, cell.r)
      for (let d = 0; d < 6; d++) {
        if (!(mask & (1 << d))) continue
        const p = edgePoint(d, APOTHEM * 0.93)
        const g = el('g', { class: 'puddle', transform: `translate(${(c.x + p.x).toFixed(2)} ${(c.y + p.y).toFixed(2)}) rotate(${d * 60})` }, this.puddles)
        g.style.setProperty('--delay', `${settle + 120}ms`)
        el('ellipse', { rx: 9, ry: 13, class: 'puddle-water' }, g)
        el('ellipse', { rx: 4, ry: 6, cx: -1, cy: -2, class: 'puddle-shine' }, g)
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
    const name = cell.kind === 'spring' ? 'Spring' : cell.kind === 'field' ? 'Field' : 'Channel'
    const state = flow.wet.has(index) ? (flow.leaks.has(index) ? 'watered, spilling' : 'watered') : 'dry'
    view.root.setAttribute('aria-label', `${name}, ${state}${cell.locked ? ', pinned' : ''}`)
  }

  get focusedIndex(): number {
    return this.focusIndex
  }
}
