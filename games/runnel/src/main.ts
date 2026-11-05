import '../../../shared/ui/base.css'
import '../../../shared/ui/palette.css'
import { drawShareCard, CARD_W, CARD_H } from './sharecard'
import { postcard, seasonOf, weatherMarkup } from './season'
import { ORCHARD_LEVELS, orchardName, orchardOptions, orchardSeed, recordOrchard, totalDrops, unlockedLevel } from './orchard'
import { gardenPlots, gardenVisitor } from './garden'
import { beaWateringSvg, cropSvg, dropSvg, eventCropSvg, treeSvg, visitorSvg } from './gardenart'
import { creditBoard, eventBoardOf, eventCrops, eventOn } from './events'
import './fonts.css'
import './tokens.css'
import './styles.css'
import '../../../shared/cath/cath.css'
import { cathMarkup, cathMoment, createHost } from './host'
import { Board } from './board'
import { LESSON_DONE, LESSON_STEPS, lessonPuzzle, lessonTap } from './lesson'
import { boardSky, skyArt } from './sky'
import { lightVars, sceneLight, valleyLayers } from './valley'
import { weekBeds, weekStrip } from './weekstrip'
import { SPOTS, featureSvg, firstSpot, weekFeatures } from './weekvalley'
import {
  arcLabel,
  computeFlow,
  dailyNumber,
  dropsFor,
  dailyPuzzle,
  generatePuzzle,
  rotateCell,
  rotateMask,
  tapsToSolve,
  hexDistance,
  utcDateString,
  type Puzzle,
} from './engine'
import { isMuted, playMusic, playTurn, playWater, playWin, setMusicLevel, setMuted } from './sound'
import { boardCode, parseBoardCode } from './code'
import { initWorkshop } from './workshopui'
import { encodeLayout, isWorkshopSeed, parseLayout, workshopPuzzle, workshopSeed } from './workshop'
import { mountWeekChip } from '../../../shared/cath/weekchip'
import { dailyStats, formatTime, load, save, SIZE_RADIUS, type SavedGame, type Size } from './store'

type Mode = 'daily' | 'practice' | 'orchard'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

const ui = {
  board: document.getElementById('board') as unknown as SVGSVGElement,
  tabDaily: $<HTMLButtonElement>('tab-daily'),
  tabPractice: $<HTMLButtonElement>('tab-practice'),
  tabOrchard: $<HTMLButtonElement>('tab-orchard'),
  levels: $<HTMLDivElement>('levels'),
  codebar: $<HTMLFormElement>('codebar'),
  picks: $<HTMLElement>('picks'),
  sizes: $<HTMLDivElement>('sizes'),
  btnBoard: $<HTMLButtonElement>('btn-board'),
  boardSheet: $<HTMLDialogElement>('board-sheet'),
  hudTitle: $<HTMLDivElement>('hud-title'),
  hudTime: $<HTMLElement>('hud-time'),
  hudTaps: $<HTMLElement>('hud-taps'),
  hudPar: $<HTMLElement>('hud-par'),
  progress: $<HTMLDivElement>('progress-fill'),
  hint: $<HTMLParagraphElement>('hint'),
  btnNew: $<HTMLButtonElement>('btn-new'),
  btnTip: $<HTMLButtonElement>('btn-tip'),
  announce: $<HTMLParagraphElement>('announce'),
  dlgHelp: $<HTMLDialogElement>('dlg-help'),
  dlgStats: $<HTMLDialogElement>('dlg-stats'),
  dlgWin: $<HTMLDialogElement>('dlg-win'),
  statGrid: $<HTMLDivElement>('stat-grid'),
  streakCal: $<HTMLDivElement>('streak-cal'),
  winEyebrow: $<HTMLParagraphElement>('win-eyebrow'),
  winTitle: $<HTMLHeadingElement>('win-title'),
  winTime: $<HTMLElement>('win-time'),
  winTaps: $<HTMLElement>('win-taps'),
  winPar: $<HTMLElement>('win-par'),
  winNote: $<HTMLParagraphElement>('win-note'),
  btnShare: $<HTMLButtonElement>('btn-share'),
  btnNext: $<HTMLButtonElement>('btn-next'),
  toast: $<HTMLParagraphElement>('toast'),
}

const host = createHost($<HTMLSpanElement>('host-face'), $<HTMLParagraphElement>('host-line'), document.getElementById('valley-cath'), () => placeValleyCath())
$<HTMLDivElement>('help-cath').innerHTML = cathMarkup('wink', 'face')

const data = load()
let today = utcDateString(new Date())
document.documentElement.dataset.season = seasonOf(today)
let playDay = today // the daily being played: today, or a missed day from the last week
let mode: Mode = 'daily'
let size: Size = 'medium'
let level = 1 // the Orchard level being played
let puzzle: Puzzle
let game: SavedGame
let board: Board
let startedAt = 0 // performance.now() when the clock last resumed, or 0 while paused

// ---- game lifecycle ---------------------------------------------------------------------------------

function newPracticeSeed(): string {
  const r = Math.floor(Math.random() * 1e9).toString(36)
  return `practice-${size}-${Date.now().toString(36)}-${r}`
}

function blankGame(p: Puzzle): SavedGame {
  return {
    seed: p.seed,
    radius: p.radius,
    rots: p.cells.map((c) => c.rot),
    locks: [],
    taps: 0,
    elapsedMs: 0,
    solved: false,
  }
}

function restore(p: Puzzle, saved: SavedGame | undefined): SavedGame {
  if (!saved || saved.seed !== p.seed || saved.rots.length !== p.cells.length) return blankGame(p)
  p.cells.forEach((c, i) => {
    c.rot = saved.rots[i] ?? c.rot
    if (!c.fixed) c.locked = saved.locks.includes(i)
    else c.rot = 0
  })
  return saved
}

function openGame(): void {
  hideStrip()
  document.querySelector('.bea-runner')?.remove()
  renderRail()
  // Leaving the lesson early (a tab, a board code): it comes back on the next visit.
  if (lessonStep >= 0) {
    lessonStep = -1
    markLessonCard(-1)
    document.body.classList.remove('in-lesson')
  }
  pauseClock()
  if (mode === 'daily') {
    puzzle = dailyPuzzle(playDay)
    game = restore(puzzle, data.daily[playDay])
    data.daily[playDay] = game
  } else if (mode === 'orchard') {
    const games = (data.orchardGames ??= {})
    level = Math.min(level, unlockedLevel((data.orchard ??= {})))
    puzzle = generatePuzzle(orchardSeed(level), orchardOptions(level))
    game = restore(puzzle, games[level])
    games[level] = game
  } else {
    const saved = data.practice[size]
    const seed = saved && !saved.solved ? saved.seed : newPracticeSeed()
    puzzle = practicePuzzle(seed, size)
    game = restore(puzzle, saved && saved.seed === seed ? saved : undefined)
    data.practice[size] = game
  }
  save(data)
  board = new Board(ui.board, puzzle, { onTurn, onToggleLock })
  wetCount = computeFlow(puzzle.cells).wet.size
  host.greet(mode !== 'practice', mode === 'daily' ? dailyNumber(playDay) : mode === 'orchard' ? level : Math.floor(Math.random() * 3) + 1)
  if (game.solved) host.react(1, true)
  if (game.solved) board.celebrate()
  render()
  if (!game.solved && game.taps > 0) resumeClock()
}

let wetCount = 0

function onTurn(index: number, clockwise: boolean): void {
  if (game.solved) return
  if (!rotateCell(puzzle.cells, index, clockwise)) {
    if (puzzle.cells[index]?.reservoir) flashHint('Reservoirs take water from any side.')
    else if (puzzle.cells[index]?.fixed) flashHint('That sluice is fixed in place.')
    else if (puzzle.cells[index]?.locked) flashHint('That tile is pinned. Hold it to unpin.')
    return
  }
  game.taps++
  game.rots[index] = puzzle.cells[index]!.rot
  if (!startedAt) resumeClock()
  const wetBefore = wetCount
  const flow = board.refresh(index)
  wetCount = flow.wet.size
  playTurn()
  playMusic()
  const wetFraction = wetCount / Math.max(1, puzzle.cells.filter((c) => c.kind !== 'stone').length)
  setMusicLevel(wetFraction)
  playWater(wetCount - wetBefore, wetFraction)
  if (flow.solved) finish()
  else save(data)
  render()
}

function onToggleLock(index: number): void {
  if (game.solved) return
  const cell = puzzle.cells[index]
  if (!cell || cell.kind === 'stone' || cell.fixed) return
  cell.locked = !cell.locked
  game.locks = puzzle.cells.flatMap((c, i) => (c.locked ? [i] : []))
  board.setLocked(index)
  save(data)
}

function finish(): void {
  game.elapsedMs = elapsed()
  pauseClock()
  game.solved = true
  if (mode === 'daily' && !data.results[playDay]) {
    data.results[playDay] = { number: dailyNumber(playDay), timeMs: game.elapsedMs, taps: game.taps, par: puzzle.par }
  }
  renderRail()
  if (mode === 'orchard') recordOrchard((data.orchard ??= {}), level, game.taps, puzzle.par, game.elapsedMs)
  if (mode === 'practice') {
    data.practiceSolved++
    const best = data.bestPractice[size]
    if (best === undefined || game.elapsedMs < best) data.bestPractice[size] = game.elapsedMs
    const wsCode = workshopCode(game.seed)
    if (wsCode) {
      // Plan item 39: a tested board goes on Bea's shelf and can now be shared.
      data.workshopSolved = [wsCode, ...(data.workshopSolved ?? []).filter((c) => c !== wsCode)].slice(0, 50)
      data.picks = [wsCode, ...(data.picks ?? []).filter((c) => c !== wsCode)].slice(0, 8)
    }
    const eb = eventBoardOf(game.seed)
    if (eb) {
      const done = (data.eventDone ??= {})
      const c = creditBoard(done[eb.event.id] ?? [], eb.index)
      done[eb.event.id] = c.done
      if (c.complete && !(data.eventCrops ??= []).includes(eb.event.id)) {
        data.eventCrops.push(eb.event.id)
        ui.toast.textContent = `Bea planted an exclusive ${eb.event.cropName} in your garden!`
      }
    }
  }
  save(data)
  board.celebrate()
  playWin()
  beaRunsOut()
  ui.announce.textContent = 'Solved. Every field is watered.'
  // Plan item 68: the strip waits for the bloom to reach the board's last ring (110 ms a ring, then the bloom).
  const rings = Math.max(0, ...puzzle.cells.map((c) => Math.max(Math.abs(c.q), Math.abs(c.r), Math.abs(c.q + c.r))))
  window.setTimeout(showWin, matchMedia('(prefers-reduced-motion: reduce)').matches ? 200 : Math.max(1400, rings * 110 + 1100))
}

/** Plan item 77: the valley painted for this board (its fields seeded by it) and lit by its time and weather. */
function paintValley(seed: string): void {
  const slot = document.getElementById('valley-paint')
  if (!slot || slot.dataset.seed === seed) return
  const sky = boardSky(seed)
  slot.dataset.seed = seed
  slot.innerHTML = valleyLayers(seed, sky.weather)
  const stage = slot.closest<HTMLElement>('.stage')
  for (const [k, v] of Object.entries(lightVars(sceneLight(sky)))) stage?.style.setProperty(k, v)
}

/** Plan item 70: Cath stands in the valley's bottom-left corner unless the board's tiles reach into it. */
/** Plan item 142: the valley keeps the week. Each daily solved since Monday stands as a feature in the valley's margins
 *  (a missed day is a fallow plot), each at the first spot from its own that meets no tile, Cath or the garden. */
let keepsKey = ''
function placeWeekValley(): void {
  const stage = document.querySelector<HTMLElement>('.stage')
  if (!stage) return
  let layer = document.getElementById('valley-keeps')
  if (!layer) {
    layer = document.createElement('div')
    layer.id = 'valley-keeps'
    layer.className = 'valley-keeps'
    layer.setAttribute('aria-hidden', 'true')
    stage.querySelector('svg.valley')?.after(layer)
  }
  const feats = weekFeatures(today, data.results)
  const key = feats.map((f) => `${f.day}:${f.kind}`).join('|')
  if (key !== keepsKey) {
    keepsKey = key
    layer.replaceChildren(
      ...feats.map((f) => {
        const el = document.createElement('span')
        el.className = 'valley-feature'
        el.dataset.valleyFeature = f.kind
        el.dataset.day = f.day
        el.innerHTML = featureSvg(f.kind)
        return el
      }),
    )
  }
  const st = stage.getBoundingClientRect()
  if (!st.width) return
  const blocks = [...document.querySelectorAll<Element>('#board polygon.tile, #valley-cath:not([hidden]), .bea-garden, .spring-house, .valley-say:not([hidden])')]
    .map((e) => e.getBoundingClientRect())
    .filter((r) => r.width > 0)
  const taken: DOMRect[] = []
  for (const el of layer.querySelectorAll<HTMLElement>('.valley-feature')) {
    const size = el.offsetWidth || 48
    let placed = false
    const start = firstSpot(el.dataset.day ?? '')
    for (let k = 0; k < SPOTS.length && !placed; k++) {
      const [px, py] = SPOTS[(start + k) % SPOTS.length]!
      const x = st.left + (st.width * px) / 100, y = st.top + (st.height * py) / 100
      const box = new DOMRect(x - size / 2, y - size, size, size)
      const meets = (r: DOMRect) => r.left < box.right && box.left < r.right && r.top < box.bottom && box.top < r.bottom
      if (blocks.some(meets) || taken.some(meets)) continue
      taken.push(box)
      el.style.setProperty('--vx', `${px}%`)
      el.style.setProperty('--vy', `${py}%`)
      placed = true
    }
    el.hidden = !placed
  }
}

// The board settles its size after the first layout (fonts, the phone's frame): re-place the keeps when it does.
if (typeof ResizeObserver !== 'undefined') {
  let raf = 0
  const ro = new ResizeObserver(() => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(placeWeekValley)
  })
  const watch = () => {
    const b = document.getElementById('board')
    if (b) ro.observe(b)
    const st = document.querySelector('.stage')
    if (st) ro.observe(st)
  }
  watch()
}

function placeValleyCath(): void {
  placeWeekValley()
  const cath = document.getElementById('valley-cath')
  if (!cath) return
  // Plan item 122: one Cath. On a phone the portrait beside her line is the one (its face follows the water the
  // same way); the corner bust in the valley goes, since no bubble spot fits by it on a phone board.
  if (!matchMedia('(min-width: 1100px) and (min-height: 640px)').matches) {
    cath.hidden = true
    host.aim(null)
    placeValleySay()
    return
  }
  cath.hidden = false
  const r = cath.getBoundingClientRect()
  if (!r.width) return
  const clash = [...document.querySelectorAll<SVGPolygonElement>('#board polygon.tile')].some((t) => {
    const b = t.getBoundingClientRect()
    return b.left < r.right - 12 && r.left + 12 < b.right && b.top < r.bottom - 12 && r.top + 12 < b.bottom
  })
  cath.hidden = clash
  aimValleyCath(cath)
  placeValleySay()
}

/** Plan item 122: her pointing arm aims at the glowing tile: the lesson's target or a tip's pulse, else the
 *  spring. In the lesson she points at it all along; in a daily only once the water is flowing (item 70). */
function aimValleyCath(cath: HTMLElement): void {
  const svg = cath.querySelector('svg')
  const m = svg?.getScreenCTM()
  const target = document.querySelector('.tiles > g.cell.lesson-target, .tiles > g.cell.tip') ?? document.querySelector('.tiles > g.cell.spring')
  if (cath.hidden || !m || !target || !matchMedia('(min-width: 1100px) and (min-height: 640px)').matches) {
    host.aim(null)
    return
  }
  const shoulder = new DOMPoint(266, 300).matrixTransform(m)
  const t = target.getBoundingClientRect()
  const deg = (Math.atan2(t.top + t.height / 2 - shoulder.y, t.left + t.width / 2 - shoulder.x) * 180) / Math.PI
  host.aim(deg, document.body.classList.contains('in-lesson'))
}

/** Plan item 122: one Cath. Where the valley figure stands at full length (D), her line is a bubble near her
 *  head with a tail to her face, and the side portrait goes. It searches the valley within 56 px of her face at a
 *  few widths, preferring above her head, for a spot that meets no tile; if none fits, the portrait keeps the
 *  line and the figure steps out of view, so there is still only one of her. */
let sayKey = ''
function placeValleySay(): void {
  const app = document.querySelector<HTMLElement>('.app')
  const cath = document.getElementById('valley-cath')
  const say = document.getElementById('valley-say')
  const stage = document.querySelector<HTMLElement>('.stage')
  const text = document.getElementById('host-line')?.textContent ?? ''
  if (!app || !cath || !say || !stage) return
  const off = () => {
    say.hidden = true
    delete app.dataset.valleySay
    sayKey = ''
  }
  // Only the full-length figure at D speaks (the phone's framed bust is a later slice of item 122).
  if (!text || !matchMedia('(min-width: 1100px) and (min-height: 640px)').matches) return off()
  // She steps back into view to try (placeValleyCath hid her if a tile reaches into her corner).
  if (cath.hidden) return off()
  const fig = cath.getBoundingClientRect()
  if (fig.height < 140) return off()
  const st = stage.getBoundingClientRect()
  // The search is costly, so it runs only when her line or the layout changes, not on every tap.
  const board = document.getElementById('board')?.getBoundingClientRect()
  const key = [text, fig.left, fig.top, fig.height, st.width, st.height, board?.left, board?.top, board?.width, puzzle.seed].join('|')
  if (key === sayKey && app.dataset.valleySay !== undefined) return
  sayKey = key
  const face = { left: fig.left + fig.width * 0.3, right: fig.left + fig.width * 0.7, top: fig.top + fig.height * 0.1, bottom: fig.top + fig.height * 0.42 }
  const fx = (face.left + face.right) / 2
  const fy = (face.top + face.bottom) / 2
  // Each tile's hexagon in screen space (its bounding box would rule out the empty corners beside her head).
  const tiles = [...document.querySelectorAll<SVGPolygonElement>('#board polygon.tile')].flatMap((t) => {
    const m = t.getScreenCTM()
    if (!m) return []
    const pts = [...t.points].map((pt) => new DOMPoint(pt.x, pt.y).matrixTransform(m))
    const xs = pts.map((q) => q.x), ys = pts.map((q) => q.y)
    return [{ pts, l: Math.min(...xs), r: Math.max(...xs), t: Math.min(...ys), b: Math.max(...ys) }]
  })
  const inside = (x: number, y: number, poly: DOMPoint[]) => {
    let hit = false
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i]!, b = poly[j]!
      if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) hit = !hit
    }
    return hit
  }
  const pad = 6
  const meets = (l: number, t: number, w: number, h: number) =>
    tiles.some(({ pts, ...b }) => {
      if (b.l > l + w + pad || b.r < l - pad || b.t > t + h + pad || b.b < t - pad) return false
      if (pts.some((q) => q.x > l - pad && q.x < l + w + pad && q.y > t - pad && q.y < t + h + pad)) return true
      for (let x = l - pad; x <= l + w + pad; x += 6) if (inside(x, t - pad, pts) || inside(x, t + h + pad, pts)) return true
      for (let y = t - pad; y <= t + h + pad; y += 6) if (inside(l - pad, y, pts) || inside(l + w + pad, y, pts)) return true
      return false
    })
  say.textContent = text
  say.hidden = false
  app.dataset.valleySay = ''
  let best: { l: number; t: number; w: number; score: number } | null = null
  for (const w of [300, 260, 230, 200, 180, 160, 140]) {
    say.style.setProperty('--say-w', `${w}px`)
    const h = say.offsetHeight
    for (let l = Math.max(st.left + 10, face.left - w - 60); l <= Math.min(st.right - 10 - w, face.right + 60); l += 10) {
      for (let t = Math.max(st.top + 10, face.top - h - 60); t <= Math.min(st.bottom - 10 - h, face.bottom + 40); t += 10) {
        // Never on her own figure, and its nearest edge within 56 px of her face.
        if (l < fig.right - 6 && fig.left + 6 < l + w && t < fig.bottom && fig.top + 4 < t + h) continue
        const gx = Math.max(face.left - (l + w), l - face.right, 0)
        const gy = Math.max(face.top - (t + h), t - face.bottom, 0)
        const gap = Math.hypot(gx, gy)
        if (gap > 56) continue
        // Prefer above her head, close, and wide (fewer lines).
        const score = gap + (t + h <= fig.top + 8 ? 0 : 30) - w * 0.08
        if (best && score >= best.score) continue
        if (meets(l, t, w, h)) continue
        best = { l, t, w, score }
      }
    }
  }
  if (!best) {
    // No room beside her on this board: the line stays in the sidebar, beside the valley, with its tail toward
    // her and without the portrait, so the page still shows one Cath.
    say.hidden = true
    app.dataset.valleySay = 'side'
    return
  }
  say.style.setProperty('--say-w', `${best.w}px`)
  const h = say.offsetHeight
  const box = (say.offsetParent ?? stage).getBoundingClientRect()
  say.style.setProperty('--say-l', `${best.l - box.left}px`)
  say.style.setProperty('--say-t', `${best.t - box.top}px`)
  // The tail runs from inside the bubble, nearest her face, to just short of her face box.
  let ax = Math.min(Math.max(fx, best.l + 20), best.l + best.w - 20)
  let ay = Math.min(Math.max(fy, best.t + 18), best.t + h - 18)
  const gx = Math.max(face.left - (best.l + best.w), best.l - face.right, 0)
  const gy = Math.max(face.top - (best.t + h), best.t - face.bottom, 0)
  if (gx > gy) ax = fx < best.l ? best.l + 2 : best.l + best.w - 2
  else ay = fy < best.t ? best.t + 2 : best.t + h - 2
  const ex = Math.min(Math.max(ax, face.left - 4), face.right + 4)
  const ey = Math.min(Math.max(ay, face.top - 4), face.bottom + 4)
  const len = Math.max(Math.hypot(ex - ax, ey - ay), 12)
  say.style.setProperty('--tail-x', `${ax - best.l}px`)
  say.style.setProperty('--tail-y', `${ay - best.t}px`)
  say.style.setProperty('--tail-len', `${len}px`)
  say.style.setProperty('--tail-a', `${Math.atan2(ey - ay, ex - ax)}rad`)
  app.dataset.valleySay = ''
}

/** Plan item 68: on a solve Bea runs out to her garden with her watering can. */
function beaRunsOut(): void {
  const garden = document.querySelector<HTMLElement>('.bea-garden')
  if (!garden || garden.querySelector('.bea-runner')) return
  // Plan item 106: today's bed pops its sprout as the water arrives (once, on the solve itself).
  garden.dataset.pop = ''
  window.setTimeout(() => delete garden.dataset.pop, 2600)
  const bea = document.createElement('span')
  bea.className = 'bea-runner'
  bea.setAttribute('aria-hidden', 'true')
  bea.innerHTML = beaWateringSvg()
  garden.append(bea)
}

// ---- clock ------------------------------------------------------------------------------------------

function elapsed(): number {
  return game.elapsedMs + (startedAt ? performance.now() - startedAt : 0)
}

function resumeClock(): void {
  if (startedAt || game.solved || document.hidden) return
  startedAt = performance.now()
}

function pauseClock(): void {
  if (!startedAt || !game) return
  game.elapsedMs = elapsed()
  startedAt = 0
  save(data)
}

function checkDailyRollover(): void {
  const now = utcDateString(new Date())
  if (now !== today) {
    today = now
    playDay = now
    document.documentElement.dataset.season = seasonOf(today)
    if (mode === 'daily') openGame()
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseClock()
  else if (game && game.taps > 0) resumeClock()
  // A tab left open past midnight moves on to the new daily when it comes back.
  if (!document.hidden) checkDailyRollover()
})

window.setInterval(() => {
  if (startedAt) ui.hudTime.textContent = formatTime(elapsed())
}, 250)

// A tab left open and visible (never backgrounded) across UTC midnight also needs to roll over,
// since visibilitychange alone never fires in that case. A coarse interval is enough for this.
window.setInterval(() => {
  if (!document.hidden) checkDailyRollover()
}, 30_000)

// ---- rendering --------------------------------------------------------------------------------------

function render(): void {
  const isDaily = mode === 'daily'
  ui.tabDaily.setAttribute('aria-selected', String(isDaily))
  const isOrchard = mode === 'orchard'
  ui.tabPractice.setAttribute('aria-selected', String(mode === 'practice'))
  ui.tabOrchard.setAttribute('aria-selected', String(isOrchard))
  document.body.dataset.mode = mode
  ui.btnBoard.hidden = mode !== 'practice'
  const sizeName = `${size[0]!.toUpperCase()}${size.slice(1)}`
  $<HTMLSpanElement>('board-chip-label').textContent = sizeName
  ui.btnBoard.setAttribute('aria-label', `Board options: ${sizeName} board`)
  if (mode !== 'practice' && ui.boardSheet.open) ui.boardSheet.close()
  renderPicks()
  ui.levels.hidden = !isOrchard
  if (isOrchard) renderLevels()
  ui.sizes.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.size === size))
  })
  ui.hudTitle.textContent = isDaily
    ? `Daily #${dailyNumber(playDay)} · ${formatDay(playDay)}${arcLabel(playDay) ? ` · ${arcLabel(playDay)}` : ''}`
    : isOrchard
    ? `Orchard ${level} · ${orchardName(level)}`
    : `Practice · ${size[0]!.toUpperCase()}${size.slice(1)}`
  const skySlot = document.getElementById('hud-sky')
  if (skySlot) {
    const art = skyArt(boardSky(puzzle.seed))
    if (skySlot.dataset.art !== art) {
      skySlot.innerHTML = art
      skySlot.dataset.art = art
    }
  }
  paintValley(puzzle.seed)
  ui.hudTime.textContent = formatTime(elapsed())
  ui.hudTaps.textContent = String(game.taps)
  ui.hudPar.textContent = String(puzzle.par)

  const flow = computeFlow(puzzle.cells)
  const playable = puzzle.cells.filter((c) => c.kind !== 'stone').length
  ui.progress.style.setProperty('--progress', String(flow.wet.size / playable))
  ui.progress.classList.toggle('done', flow.solved)
  const wetShare = flow.solved ? 1 : flow.wet.size / playable
  for (const path of document.querySelectorAll<SVGPathElement>('.vl-water, .vl-trickle')) path.style.setProperty('--wet', String(wetShare))
  // Plan item 70: today's seed in Bea's garden sprouts as the stream reaches the fields (a full plant at a solve).
  const crops = document.getElementById('bea-crops')
  crops?.style.setProperty('--wet', String(wetShare))
  crops?.toggleAttribute('data-sprouting', game.taps > 0 || flow.solved)
  // Plan item 106: a solved board waters the garden: its beds go dark and wet (the e2e reads `data-watered`).
  document.querySelector('.bea-garden')?.setAttribute('data-watered', String(flow.solved))
  placeValleyCath()
  if (game.taps > 0) {
    const fields = [...flow.wet].filter((i) => puzzle.cells[i]!.kind === 'field').length
    host.react(flow.wet.size / playable, flow.solved, fields, flow.leaks.size > 0)
  }

  if (game.solved) {
    ui.hint.textContent = isDaily
      ? `Solved in ${formatTime(game.elapsedMs)}. Next puzzle in ${untilTomorrow()}.`
      : `Solved in ${formatTime(game.elapsedMs)}.`
    ui.btnNew.hidden = false
    ui.btnNew.textContent = isDaily ? 'See result' : isOrchard ? 'See result' : 'New puzzle'
  } else {
    const wet = Math.max(0, flow.wet.size - 1)
    ui.hint.textContent =
      game.taps === 0
        ? // Plan item 91: under the lesson its card's "Up next" already names the sky; the hint doesn't repeat it.
          `${document.getElementById('lesson-card')?.hidden === false ? '' : `${boardSky(puzzle.seed).label}. `}Tap a tile to turn it, hold to pin it.`
        : `${wet} of ${playable - 1} fields watered. Hold a tile to pin it.`
    ui.btnNew.hidden = mode !== 'practice'
    ui.btnNew.textContent = 'New puzzle'
  }
  ui.btnTip.hidden = isDaily || game.solved
  ui.btnTip.disabled = !!game.hinted
}

let hintTimer = 0
function flashHint(text: string): void {
  ui.hint.textContent = text
  ui.hint.classList.add('flash')
  window.clearTimeout(hintTimer)
  hintTimer = window.setTimeout(() => {
    ui.hint.classList.remove('flash')
    render()
  }, 1800)
}

function formatDay(day: string): string {
  const d = new Date(`${day}T12:00:00Z`)
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}

function untilTomorrow(): string {
  const now = Date.now()
  const next = Date.parse(`${today}T00:00:00Z`) + 86_400_000
  const mins = Math.max(0, Math.round((next - now) / 60000))
  const h = Math.floor(mins / 60)
  return h ? `${h}h ${mins % 60}m` : `${mins}m`
}

function parNote(taps: number, par: number): string {
  if (taps < par) return `${par - taps} under par. You found a shorter route than the puzzle maker.`
  if (taps === par) return 'Exactly on par. Not a tap wasted.'
  return `${taps - par} over par.`
}

// ---- dialogs ----------------------------------------------------------------------------------------

function showWin(): void {
  $<HTMLDivElement>('win-cath').innerHTML = cathMoment('win', 'bust')
  const isDaily = mode === 'daily'
  const isOrchard = mode === 'orchard'
  ui.winEyebrow.textContent = isDaily
    ? `Daily #${dailyNumber(playDay)}${playDay === today ? '' : ' · catch-up'}`
    : isOrchard
    ? `Orchard ${level} of ${ORCHARD_LEVELS}`
    : `Practice · ${size}`
  ui.winTitle.textContent = 'Every field is watered.'
  ui.winTime.textContent = formatTime(game.elapsedMs)
  ui.winTaps.textContent = String(game.taps)
  ui.winPar.textContent = String(puzzle.par)
  const stats = dailyStats(data, today)
  ui.winNote.textContent = isDaily
    ? `${parNote(game.taps, puzzle.par)} Streak: ${stats.streak} day${stats.streak === 1 ? '' : 's'} (best ${stats.maxStreak}). Next puzzle in ${untilTomorrow()}.`
    : parNote(game.taps, puzzle.par)
  const best = isOrchard ? data.orchard?.[level] : undefined
  if (best) {
    ui.winNote.textContent = ` ${parNote(game.taps, puzzle.par)} Orchard drops: ${totalDrops(data.orchard ?? {})} of ${ORCHARD_LEVELS * 3}.`
    const drops = document.createElement('span')
    drops.className = 'win-drops'
    drops.setAttribute('role', 'img')
    drops.setAttribute('aria-label', `${best.drops} of 3 drops`)
    drops.innerHTML = [1, 2, 3].map((n) => dropSvg(n <= best.drops)).join('')
    ui.winNote.prepend(drops)
  }
  ui.btnNext.textContent = isDaily ? 'Play practice' : isOrchard ? (level >= ORCHARD_LEVELS ? 'Back to daily' : 'Next row') : 'Next puzzle'
  const wsCode = workshopCode(puzzle.seed)
  if (wsCode) {
    ui.winEyebrow.textContent = "Made in Bea's workshop"
    ui.winTitle.textContent = 'Your board works.'
    ui.winNote.textContent = `${parNote(game.taps, puzzle.par)} Its code is ${wsCode}: anyone can paste it to play your board.`
    ui.btnNext.textContent = 'Back to the workshop'
  }
  ui.toast.textContent = ''
  $<HTMLElement>('win-bea').innerHTML = beaDrawing(puzzle.seed, game.taps <= puzzle.par)
  renderCard(stats.streak)
  // Plan item 68: the board keeps the stage. A workshop test keeps its sheet (it carries the board's code);
  // every other win shows the slim strip at the foot, and the full sheet opens from "Your card".
  if (wsCode) {
    if (!ui.dlgWin.open) ui.dlgWin.showModal()
    syncWinPager()
    return
  }
  showStrip(isDaily, stats.streak)
}

const strip = {
  root: $<HTMLElement>('win-strip'),
  cath: $<HTMLDivElement>('strip-cath'),
  eyebrow: $<HTMLParagraphElement>('strip-eyebrow'),
  title: $<HTMLHeadingElement>('strip-title'),
  nums: $<HTMLParagraphElement>('strip-nums'),
  next: $<HTMLButtonElement>('strip-next'),
  toast: $<HTMLParagraphElement>('strip-toast'),
}

/** Plan item 68: the result as a strip under the watered board: time, taps against par, the streak, and three buttons. */
function showStrip(isDaily: boolean, streak: number): void {
  strip.cath.innerHTML = cathMoment('win', 'face')
  strip.eyebrow.textContent = ui.winEyebrow.textContent
  strip.title.textContent = ui.winTitle.textContent
  const taps = `${game.taps} tap${game.taps === 1 ? '' : 's'}`
  strip.nums.textContent = [formatTime(game.elapsedMs), `${taps} · par ${puzzle.par}`, isDaily ? `streak ${streak}` : ''].filter(Boolean).join(' · ')
  strip.next.textContent = ui.btnNext.textContent
  strip.toast.textContent = ui.toast.textContent
  strip.root.hidden = false
  document.body.classList.add('has-win-strip')
  placeStrip()
}

/** At D the strip centres under the board, not the window (the rail sits to its left). */
function placeStrip(): void {
  if (strip.root.hidden) return
  const r = ui.board.getBoundingClientRect()
  strip.root.style.setProperty('--strip-x', r.width ? `${Math.round(r.left + r.width / 2)}px` : '')
  strip.root.style.setProperty('--strip-max', r.width ? `${Math.round(r.width)}px` : '')
}
window.addEventListener('resize', placeStrip)

function hideStrip(): void {
  strip.root.hidden = true
  document.body.classList.remove('has-win-strip')
}

$<HTMLButtonElement>('strip-share').addEventListener('click', () => {
  ui.toast.textContent = ''
  void shareOut(shareText(), cardBlob).then(() => (strip.toast.textContent = ui.toast.textContent))
})
$<HTMLButtonElement>('strip-card').addEventListener('click', () => {
  if (!ui.dlgWin.open) ui.dlgWin.showModal()
  syncWinPager()
})
strip.next.addEventListener('click', () => ui.btnNext.click())

/** Plan item 47: dots under the keepsakes when they page sideways (a phone), one per keepsake. */
function syncWinPager(): void {
  const row = $<HTMLElement>('win-keepsakes')
  const pager = $<HTMLElement>('win-pager')
  const pages = [...row.querySelectorAll<HTMLElement>(':scope > .keep')].filter((k) => k.offsetParent !== null)
  const paged = pages.length > 1 && row.scrollWidth > row.clientWidth + 2
  pager.hidden = !paged
  if (!paged) return
  pager.innerHTML = pages.map(() => '<button type="button" tabindex="-1"></button>').join('')
  const dots = [...pager.querySelectorAll('button')]
  const mark = (): void => {
    const at = Math.round(row.scrollLeft / Math.max(1, row.clientWidth))
    dots.forEach((d, i) => d.setAttribute('aria-current', String(i === at)))
  }
  dots.forEach((d, i) => (d.onclick = () => row.scrollTo({ left: i * row.clientWidth, behavior: 'smooth' })))
  row.onscroll = mark
  mark()
}

/** Plan item 6: the share card (the solved board and the numbers) as an image on the win card. */
let cardBlob: Blob | null = null
/** The workshop code the current share card shows, if it shows one. */
let cardCode: string | null = null
function renderCard(streak: number): void {
  const canvas = document.createElement('canvas')
  canvas.width = CARD_W
  canvas.height = CARD_H
  const ctx = canvas.getContext('2d')
  const img = $<HTMLImageElement>('win-card')
  const save = $<HTMLAnchorElement>('btn-save-card')
  if (!ctx) return
  const wsCode = workshopCode(puzzle.seed)
  const title = wsCode ? `Bea's workshop ${wsCode}` : mode === 'daily' ? `Runnel #${dailyNumber(playDay)}` : mode === 'orchard' ? `Runnel Orchard ${level}` : `Runnel practice`
  cardCode = wsCode
  // Plan item 142: a daily's card carries the week's valley (today's solve included).
  const week = mode === 'daily' ? weekFeatures(today, data.results).map((f) => f.kind) : undefined
  drawShareCard(ctx, puzzle, { title, time: formatTime(game.elapsedMs), taps: game.taps, par: puzzle.par, streak: mode === 'daily' ? streak : undefined, ...(week?.length ? { week } : {}) })
  const url = canvas.toDataURL('image/png')
  img.src = url
  img.alt = `${title}: the solved board, ${formatTime(game.elapsedMs)}, ${game.taps} taps, par ${puzzle.par}.`
  img.hidden = false
  save.href = url
  save.hidden = false
  cardBlob = null
  canvas.toBlob((b) => (cardBlob = b), 'image/png')
}

/** Bea's crayon drawing of the field, different every day; a gold star when you were on par. */
function beaDrawing(seed: string, onPar: boolean): string {
  const season = seasonOf(/^daily-/.test(seed) ? seed.slice(6) : today)
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const rnd = (): number => ((h = (h * 1664525 + 1013904223) >>> 0) / 4294967296)
  const colours = ['#e0524d', '#f2a33a', '#7bbf4a', '#b25fc4', '#f2d13a']
  let rows = ''
  for (let i = 0; i < 4; i++) {
    const y = 62 + i * 13
    rows += `<path d="M10 ${y} q 40 ${(rnd() * 6 - 3).toFixed(1)} 80 0 t 80 0 t 60 0" class="bea-row d${i}" pathLength="1"/>`
    for (let x = 20; x < 210; x += 28 + rnd() * 10) {
      const c = colours[Math.floor(rnd() * colours.length)]
      rows += `<circle cx="${x.toFixed(0)}" cy="${(y - 5).toFixed(0)}" r="${(3 + rnd() * 2).toFixed(1)}" fill="${c}" class="bea-bloom d${i}"/>`
    }
  }
  const star = onPar ? '<path d="M200 12 l3 8 9 0 -7 5 3 9 -8 -5 -8 5 3 -9 -7 -5 9 0z" fill="#f2c94c" class="bea-bloom d5"/>' : ''
  return `<svg viewBox="0 0 240 120" role="img" aria-label="Bea's drawing of the watered field"><circle cx="34" cy="26" r="12" fill="#f6d24a" class="bea-bloom"/><path d="M110 50 l8 -22 8 22" class="bea-row" pathLength="1"/><circle cx="118" cy="22" r="5" class="bea-row" pathLength="1"/>${weatherMarkup(season)}${rows}${star}</svg><figcaption>Drawn by Bea, age 6. ${postcard(season)}</figcaption>`
}

/** Spoiler-free: shows the board's shape (stones, spring, fields) but not a single rotation. */
function shareGrid(): string {
  const rows = new Map<number, { q: number; e: string }[]>()
  for (const c of puzzle.cells) {
    const e = c.kind === 'stone' ? '⬛' : c.kind === 'spring' ? '💧' : '🟩'
    const row = rows.get(c.r) ?? []
    row.push({ q: c.q + c.r / 2, e })
    rows.set(c.r, row)
  }
  return [...rows.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([r, row]) => (r % 2 ? ' ' : '') + row.sort((a, b) => a.q - b.q).map((x) => x.e).join(''))
    .join('\n')
}

function shareText(): string {
  const wsCode = workshopCode(puzzle.seed)
  if (wsCode) return workshopShareText(wsCode, `⏱ ${formatTime(game.elapsedMs)} · ${game.taps} taps (par ${puzzle.par})`)
  const head = mode === 'daily' ? `Runnel #${dailyNumber(playDay)}` : mode === 'orchard' ? `Runnel Orchard ${level}` : `Runnel practice (${size})`
  const drops = '💧'.repeat(dropsFor(game.taps, puzzle.par))
  return `${head} 🌱 Cath's fields, all watered\n⏱ ${formatTime(game.elapsedMs)} · ${game.taps} taps (par ${puzzle.par}) ${drops}\n${shareGrid()}\nhttps://cathnivore.com/runnel/`
}

function workshopShareText(code: string, result?: string): string {
  return `I made a Runnel board in Bea's workshop. Can you water every field?\n${result ? `${result}\n` : ''}Board code: ${code}\nPaste it in Practice, under Board: https://cathnivore.com/runnel/`
}

ui.btnShare.addEventListener('click', () => void shareOut(shareText(), cardBlob))

async function shareOut(text: string, blob: Blob | null): Promise<void> {
  try {
    const file = blob ? new File([blob], 'runnel.png', { type: 'image/png' }) : null
    if (file && navigator.canShare?.({ files: [file] }) && matchMedia('(pointer: coarse)').matches) {
      await navigator.share({ text, files: [file] })
      return
    }
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      await navigator.share({ text })
      return
    }
    await navigator.clipboard.writeText(text)
    ui.toast.textContent = 'Copied to clipboard.'
  } catch {
    ui.toast.textContent = 'Could not share from this browser.'
  }
}

ui.btnNext.addEventListener('click', () => {
  ui.dlgWin.close()
  hideStrip()
  if (workshopCode(puzzle.seed) && game.solved) workshop?.open()
  else if (mode === 'daily') switchMode('practice')
  else if (mode === 'orchard') {
    if (level >= ORCHARD_LEVELS) switchMode('daily')
    else playLevel(level + 1)
  } else newPractice()
})

function renderGarden(): void {
  const plots = gardenPlots(data.results, today)
  const note = $<HTMLParagraphElement>('garden-note')
  const visitor = gardenVisitor(seasonOf(today), plots)
  const base = visitor ? visitor.line : 'Solve a daily and Bea plants a seed.'
  note.textContent = base
  if (visitor) {
    const v = document.createElement('span')
    v.className = 'garden-visitor'
    v.innerHTML = visitorSvg(visitor.visitor)
    note.prepend(v)
  }
  // Plan item 37: on a day the daily is solved, Bea is out with her watering can beside the newest crops.
  const bea: HTMLElement[] = []
  if (data.results[today]) {
    const b = document.createElement('div')
    b.className = 'garden-bea'
    b.innerHTML = beaWateringSvg("Bea, watering today's seedling")
    bea.push(b)
  }
  $<HTMLDivElement>('garden').replaceChildren(
    ...plots.map((p) => {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = `plot ${p.stage}${p.gold ? ' gold' : ''}`
      b.innerHTML = cropSvg(p.crop, p.stage)
      b.setAttribute('aria-label', p.label)
      b.addEventListener('click', (e) => {
        e.preventDefault()
        note.textContent = p.label
      })
      return b
    }),
    ...eventCrops(data.eventCrops ?? []).map((c) => {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'plot ripe gold exclusive'
      b.innerHTML = eventCropSvg(c.crop)
      b.setAttribute('aria-label', c.label)
      b.addEventListener('click', (e) => {
        e.preventDefault()
        note.textContent = c.label
      })
      return b
    }),
    ...bea,
  )
}

/**
 * Plan item 30: on a wide screen the stats sit in a rail beside the board (the streak, dailies solved, the best
 * streak and the last 28 days as a strip), so the board can take the middle of the farm. Hidden by CSS elsewhere.
 */
/** Plan item 68: the rail's foot: one bed of the garden's newest 8 crops (a fixed height), and the visitor or a nudge. */
function renderRailGarden(): void {
  const all = gardenPlots(data.results, today)
  const plots = all.slice(-8)
  const box = $<HTMLDivElement>('rail-plots')
  box.setAttribute('aria-label', all.length ? `${all.length} crop${all.length === 1 ? '' : 's'} in Bea's garden` : "Bea's garden is bare")
  const cells = plots.map((p) => {
    const i = document.createElement('i')
    i.className = `plot ${p.stage}${p.gold ? ' gold' : ''}`
    i.innerHTML = cropSvg(p.crop, p.stage)
    return i
  })
  for (let n = cells.length; n < 8; n++) {
    const i = document.createElement('i')
    i.className = 'plot bare'
    cells.push(i)
  }
  box.replaceChildren(...cells)
  const visitor = gardenVisitor(seasonOf(today), all)
  const n = all.length
  $<HTMLParagraphElement>('rail-garden-note').textContent = visitor
    ? visitor.line
    : n
    ? `${n} crop${n === 1 ? '' : 's'} so far. Every daily you solve plants another.`
    : 'Solve a daily and Bea plants a seed.'
}

function renderRail(): void {
  renderRailGarden()
  const s = dailyStats(data, today)
  const figs: Array<[string, string]> = [
    [String(s.streak), 'current streak'],
    [String(s.played), 'dailies solved'],
    [String(s.maxStreak), 'best streak'],
  ]
  $<HTMLDivElement>('rail-figures').replaceChildren(
    ...figs.map(([v, label]) => {
      const div = document.createElement('div')
      const b = document.createElement('b')
      b.className = 'num'
      b.textContent = v
      const span = document.createElement('span')
      span.textContent = label
      div.append(b, span)
      return div
    }),
  )
  const cells: HTMLElement[] = []
  for (let i = 27; i >= 0; i--) {
    const day = new Date(Date.parse(`${today}T00:00:00Z`) - i * 86_400_000).toISOString().slice(0, 10)
    const cell = document.createElement('i')
    if (data.results[day] !== undefined) cell.className = 'on'
    if (day === today) cell.classList.add('today')
    cells.push(cell)
  }
  $<HTMLDivElement>('rail-cal').replaceChildren(...cells)
  // Plan item 50: the week's arc in the rail, as small boards (solved ones watered).
  $<HTMLOListElement>('rail-week').replaceChildren(
    ...weekStrip(today, data.results).map(({ day, svg }) => {
      const li = document.createElement('li')
      li.dataset.state = day.state
      li.setAttribute('aria-label', `${day.short}${day.arc ? `, ${day.arc}` : ''}: ${day.state === 'solved' ? 'solved' : day.state === 'today' ? "today's board" : day.state === 'missed' ? 'not played' : 'still to come'}`)
      li.innerHTML = `${svg}<span aria-hidden="true">${day.short}</span>`
      return li
    }),
  )
  // Bea's garden in the farm's corner: the week's seven beds, a solved day's crop at its stage, a mound otherwise.
  const beds = weekBeds(today, data.results).map((b) => {
    const i = document.createElement('i')
    i.className = `bed bed-${b.state}${b.plot?.gold ? ' gold' : ''}${b.day === today ? ' is-today' : ''}`
    i.innerHTML = b.plot ? cropSvg(b.plot.crop, b.plot.stage) : `<svg viewBox="0 0 28 28" aria-hidden="true"><ellipse class="bed-mound" cx="14" cy="22" rx="12" ry="5"/>${b.state === 'today' ? '<path class="bed-marker" d="M14 21V8"/><rect class="bed-packet" x="9" y="4" width="10" height="8" rx="1"/><g class="bed-sprout"><path class="bed-stem" d="M14 21V11"/><path class="bed-leaf" d="M14 16c-4 0-6-3-6-6 4 0 6 3 6 6zM14 13c4 0 6-3 6-6-4 0-6 3-6 6z"/></g>' : ''}</svg>`
    i.title = `${b.short}${b.plot ? `: ${b.plot.label}` : ''}`
    return i
  })
  $<HTMLDivElement>('bea-crops').replaceChildren(...beds)
  $<HTMLDivElement>('bea-crops').classList.remove('bare')
}

function showStats(): void {
  const s = dailyStats(data, today)
  const cells: Array<[string, string]> = [
    [String(s.played), 'dailies solved'],
    [String(s.streak), 'current streak'],
    [String(s.maxStreak), 'best streak'],
    [s.averageMs === null ? '–' : formatTime(s.averageMs), 'average daily time'],
    [String(data.practiceSolved), 'practice solved'],
    [data.bestPractice.large === undefined ? '–' : formatTime(data.bestPractice.large), 'best large time'],
  ]
  ui.statGrid.replaceChildren(
    ...cells.map(([value, label]) => {
      const div = document.createElement('div')
      const b = document.createElement('b')
      b.className = 'num'
      b.textContent = value
      const span = document.createElement('span')
      span.textContent = label
      div.append(b, span)
      return div
    }),
  )
  const cal: HTMLElement[] = []
  for (let i = 27; i >= 0; i--) {
    const day = new Date(Date.parse(`${today}T00:00:00Z`) - i * 86_400_000).toISOString().slice(0, 10)
    const solved = data.results[day] !== undefined
    const missed = !solved && i > 0 && i <= 7
    const cell = document.createElement(missed ? 'button' : 'i')
    if (solved) cell.className = 'on'
    if (day === today) cell.classList.add('today')
    cell.title = `${day}${solved ? ': solved' : ''}`
    if (missed) {
      cell.classList.add('missed')
      cell.setAttribute('aria-label', `Catch up on ${formatDay(day)}`)
      cell.title = `${formatDay(day)}: tap to catch up`
      cell.addEventListener('click', () => {
        playDay = day
        mode = 'daily'
        ui.dlgStats.close()
        openGame()
      })
    }
    cal.push(cell)
  }
  ui.streakCal.replaceChildren(...cal)
  renderGarden()
  const hot = s.streak > 1
  $<HTMLDivElement>('stats-cath').innerHTML = cathMarkup(hot ? 'delighted' : 'wink', 'face')
  $<HTMLParagraphElement>('stats-line').textContent =
    s.played === 0
      ? "Nothing yet. Today's puzzle is waiting, and the fields are thirsty."
      : hot
        ? `${s.streak} days running. The fields have never been so well kept.`
        : 'Come back tomorrow and the streak starts to grow.'
  ui.dlgStats.showModal()
}

// Close a dialog when its backdrop is tapped.
for (const dlg of [ui.dlgHelp, ui.dlgStats, ui.dlgWin]) {
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) dlg.close()
  })
}
ui.dlgHelp.addEventListener('close', () => {
  if (!data.seenHelp) {
    data.seenHelp = true
    save(data)
  }
})

// ---- mode switching ---------------------------------------------------------------------------------

function switchMode(next: Mode): void {
  if (next === mode) return
  pauseClock()
  mode = next
  if (next === 'daily') playDay = today
  openGame()
}

function playLevel(n: number): void {
  pauseClock()
  level = n
  openGame()
}

function renderLevels(): void {
  const results = data.orchard ?? {}
  const open = unlockedLevel(results)
  ui.levels.replaceChildren()
  for (let n = 1; n <= ORCHARD_LEVELS; n++) {
    const b = document.createElement('button')
    b.type = 'button'
    b.dataset.level = String(n)
    const r = results[n]
    // Plan item 37: each level is a tree. Locked: a sapling; open: in leaf; solved: in blossom; a
    // three-drop solve: in fruit. The current tree glows with Cath beside it.
    const state = n > open ? 'locked' : !r ? 'open' : r.drops === 3 ? 'fruit' : 'blossom'
    b.innerHTML = treeSvg(n, state)
    const num = document.createElement('span')
    num.className = 'tree-n'
    num.textContent = String(n)
    b.append(num)
    b.disabled = n > open
    b.classList.toggle('done', !!r)
    b.setAttribute('aria-label', `Orchard ${n}, ${orchardName(n)}${r ? `, ${r.drops} drops` : n > open ? ', locked' : ''}`)
    if (n === level) {
      b.setAttribute('aria-current', 'true')
      const cath = document.createElement('span')
      cath.className = 'tree-cath'
      cath.setAttribute('aria-hidden', 'true')
      cath.innerHTML = cathMarkup('wink', 'face')
      b.append(cath)
    }
    ui.levels.append(b)
  }
}

ui.levels.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-level]')
  if (b && !b.disabled && Number(b.dataset.level) !== level) playLevel(Number(b.dataset.level))
})

function newPractice(): void {
  pauseClock()
  delete data.practice[size]
  openGame()
}

ui.tabDaily.addEventListener('click', () => switchMode('daily'))
ui.tabPractice.addEventListener('click', () => switchMode('practice'))
ui.tabOrchard.addEventListener('click', () => {
  if (mode !== 'orchard') level = unlockedLevel(data.orchard ?? {})
  switchMode('orchard')
})
function practicePuzzle(seed: string, forSize: Size): Puzzle {
  return workshopPuzzle(seed) ?? generatePuzzle(isWorkshopSeed(seed) ? newPracticeSeed() : seed, { radius: SIZE_RADIUS[forSize] })
}

function playCode(text: string): boolean {
  const layout = parseLayout(text)
  if (layout) {
    const p = workshopPuzzle(workshopSeed(encodeLayout(layout)))
    if (!p) return false
    pauseClock()
    size = (Object.keys(SIZE_RADIUS) as Size[]).find((k) => SIZE_RADIUS[k] === layout.radius) ?? size
    data.practice[size] = blankGame(p)
    openGame()
    return true
  }
  const parsed = parseBoardCode(text)
  if (!parsed) return false
  pauseClock()
  size = parsed.size
  data.practice[size] = blankGame(generatePuzzle(parsed.seed, { radius: SIZE_RADIUS[size] }))
  openGame()
  return true
}

/** The seasonal event strip: five limited boards while an event runs (?event=spring|autumn previews one). */
function renderEvent(): void {
  const forced = new URLSearchParams(location.search).get('event')
  const ev = eventOn(forced === 'spring' ? `${today.slice(0, 4)}-04-05` : forced === 'autumn' ? `${today.slice(0, 4)}-10-05` : today)
  const el = $<HTMLElement>('season-event')
  el.hidden = !ev
  if (!ev) return
  const done = data.eventDone?.[ev.id] ?? []
  const title = document.createElement('span')
  title.className = 'event-title'
  title.textContent = `${ev.crop} ${ev.name}: solve all 5 for an exclusive ${ev.cropName}${data.eventCrops?.includes(ev.id) ? ' (earned)' : ` (${done.length}/5)`}`
  el.replaceChildren(
    title,
    ...ev.boards.map((b, i) => {
      const chip = document.createElement('span')
      chip.className = `pick${done.includes(i) ? ' done' : ''}`
      const play = document.createElement('button')
      play.type = 'button'
      play.textContent = `${i + 1}${done.includes(i) ? ' ✓' : ''} ${b.size}`
      play.addEventListener('click', () => playCode(b.code))
      chip.append(play)
      return chip
    }),
  )
}

/** Bea's picks shelf: saved board codes as chips; tap one to play it, the cross removes it. */
function renderPicks(): void {
  renderEvent()
  const picks = data.picks ?? []
  ui.picks.hidden = picks.length === 0
  ui.picks.replaceChildren(
    ...picks.map((code) => {
      const chip = document.createElement('span')
      chip.className = 'pick'
      const play = document.createElement('button')
      play.type = 'button'
      play.textContent = code
      play.addEventListener('click', () => playCode(code))
      const del = document.createElement('button')
      del.type = 'button'
      del.className = 'pick-x'
      del.textContent = '×'
      del.setAttribute('aria-label', `Remove ${code}`)
      del.addEventListener('click', () => {
        data.picks = (data.picks ?? []).filter((c) => c !== code)
        save(data)
        renderPicks()
      })
      chip.append(play, del)
      return chip
    }),
  )
}

ui.codebar.addEventListener('submit', (e) => {
  e.preventDefault()
  const input = $<HTMLInputElement>('code-input')
  if (!playCode(input.value)) {
    ui.toast.textContent = 'That is not a board code. It looks like M-abc123-xyz789.'
    return
  }
  input.value = ''
  ui.boardSheet.close()
})
// Plan item 39: Practice's board tools live in one "Board" chip's sheet, so the board keeps the screen.
ui.btnBoard.addEventListener('click', () => ui.boardSheet.showModal())
$<HTMLButtonElement>('board-sheet-close').addEventListener('click', () => ui.boardSheet.close())
ui.boardSheet.addEventListener('click', (e) => {
  // A tap on the backdrop (the dialog box itself, outside its body) closes the sheet.
  if (e.target === ui.boardSheet) ui.boardSheet.close()
  else if ((e.target as HTMLElement).closest('.pick button:not(.pick-x)')) ui.boardSheet.close()
})
$<HTMLButtonElement>('btn-pick').addEventListener('click', () => {
  const code = boardCode(puzzle.seed) ?? workshopCode(puzzle.seed)
  if (!code) return
  const picks = (data.picks ?? []).filter((c) => c !== code)
  data.picks = [code, ...picks].slice(0, 8)
  save(data)
  renderPicks()
  ui.toast.textContent = `Saved ${code} to Bea's picks.`
})
$<HTMLButtonElement>('btn-code').addEventListener('click', async () => {
  const code = boardCode(puzzle.seed) ?? workshopCode(puzzle.seed)
  if (!code) return
  try {
    await navigator.clipboard.writeText(code)
    ui.toast.textContent = `Copied ${code}. Send it to a friend to play the same board.`
  } catch {
    ui.toast.textContent = `Board code: ${code}`
  }
})
ui.sizes.addEventListener('click', (e) => {
  const target = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-size]')
  if (!target) return
  const next = target.dataset.size as Size
  ui.boardSheet.close()
  if (next === size) return
  pauseClock()
  size = next
  openGame()
})
ui.btnTip.addEventListener('click', () => {
  if (mode === 'daily' || game.solved || game.hinted) return
  const spring = puzzle.cells.find((c) => c.kind === 'spring') ?? puzzle.cells[0]!
  let pick = -1
  let best = Infinity
  puzzle.cells.forEach((c, i) => {
    if (c.kind !== 'channel' || c.fixed || c.reservoir || tapsToSolve(c) === 0) return
    const d = hexDistance(c, spring)
    if (d < best) {
      best = d
      pick = i
    }
  })
  if (pick < 0) return
  game.hinted = true
  board.pulse(pick)
  flashHint("Cath: this one's facing the wrong way.")
  save(data)
  render()
})
ui.btnNew.addEventListener('click', () => {
  if (mode === 'daily' || mode === 'orchard') showWin()
  else newPractice()
})
const soundBtn = $<HTMLButtonElement>('btn-sound')
soundBtn.setAttribute('aria-pressed', String(!isMuted()))
soundBtn.addEventListener('click', () => {
  setMuted(!isMuted())
  soundBtn.setAttribute('aria-pressed', String(!isMuted()))
})
$<HTMLButtonElement>('btn-help').addEventListener('click', () => ui.dlgHelp.showModal())
$<HTMLButtonElement>('btn-stats').addEventListener('click', showStats)
$<HTMLButtonElement>('btn-rail-stats').addEventListener('click', showStats)

// Focus rings on the board only for keyboard players; a tap focuses the tile too, and a ring there
// would look like a selection.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Tab' || e.key.startsWith('Arrow')) document.body.classList.add('keyboard')
})
document.addEventListener('pointerdown', () => document.body.classList.remove('keyboard'))

// ---- the first-visit lesson -------------------------------------------------------------------------

/** The lesson's step while it runs, else -1. */
let lessonStep = -1
function startLesson(): void {
  const lp = lessonPuzzle()
  lessonStep = 0
  document.body.classList.add('in-lesson')
  board = new Board(ui.board, lp, {
    onTurn: (index) => {
      const r = lessonTap(lp.cells, lessonStep, index)
      if (!r.accepted) {
        flashHint('Tap the glowing tile.')
        return
      }
      const before = wetCount
      const flow = board.refresh(index)
      wetCount = flow.wet.size
      playTurn()
      playWater(wetCount - before, wetCount / lp.cells.length)
      lessonStep = r.step
      if (r.solved) {
        board.celebrate()
        playWin()
        markLessonTarget(-1)
        markLessonCard(LESSON_STEPS.length)
        host.say('delighted', LESSON_DONE)
        ui.announce.textContent = 'Watered. Here comes today\'s puzzle.'
        // Plan item 134: on to today's daily in about a second (it waited 2.6 s).
        window.setTimeout(endLesson, matchMedia('(prefers-reduced-motion: reduce)').matches ? 600 : 1200)
      } else showLessonStep()
    },
    onToggleLock: () => flashHint('No need to pin anything yet. Tap the glowing tile.'),
  })
  wetCount = computeFlow(lp.cells).wet.size
  showLessonStep()
}
function showLessonStep(): void {
  markLessonCard(lessonStep)
  const s = LESSON_STEPS[lessonStep]
  if (!s) return
  host.say(s.expression, s.ask)
  markLessonTarget(s.target)
}
function markLessonTarget(index: number): void {
  const tiles = ui.board.querySelectorAll<SVGGElement>('.tiles > g.cell')
  tiles.forEach((t, i) => t.classList.toggle('lesson-target', i === index))
  if (index >= 0) tiles[index]?.focus({ preventScroll: true })
  placeValleyCath()
  placeLessonHand()
}

/** Plan item 134: Cath's hand (her jacket's green at the cuff) taps the lesson's glowing tile, so the lesson shows
 *  rather than tells. Its fingertip sits on the tile's centre; it goes when the lesson does. */
const HAND_SVG = '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M30 60c-7-1-12-6-14-12l-4-11c-1-3 1-5 3-5s3 1 4 3l3 6V12c0-3 2-5 4-5s4 2 4 5v14c0-2 2-4 4-4s4 2 4 4v2c0-2 2-4 4-4s4 2 4 4v3c0-2 2-3 4-3s3 2 3 4v12c0 10-6 17-15 17z" fill="#fbe3d2" stroke="#3b2a20" stroke-width="2.4" stroke-linejoin="round"/><path d="M27 54h18l1 10H26z" fill="#5f7a3a" stroke="#3b2a20" stroke-width="2.4" stroke-linejoin="round"/></svg>'
function placeLessonHand(): void {
  const stage = document.querySelector<HTMLElement>('.stage')
  const target = ui.board.querySelector<SVGGElement>('.tiles > g.cell.lesson-target')
  let hand = document.getElementById('lesson-hand')
  if (!stage || !target || lessonStep < 0) {
    hand?.remove()
    return
  }
  if (!hand) {
    hand = document.createElement('span')
    hand.id = 'lesson-hand'
    hand.className = 'lesson-hand'
    hand.setAttribute('aria-hidden', 'true')
    hand.innerHTML = HAND_SVG
    stage.append(hand)
  }
  const st = stage.getBoundingClientRect()
  const t = target.getBoundingClientRect()
  hand.style.setProperty('--hx', `${Math.round(t.left + t.width / 2 - st.left)}px`)
  hand.style.setProperty('--hy', `${Math.round(t.top + t.height / 2 - st.top)}px`)
}
addEventListener('resize', () => placeLessonHand())
const escapeText = (t: string) => t.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)

/** Plan item 77: the lesson card ticks off the taps done and lights the one to do now. */
function markLessonCard(step: number): void {
  const card = document.getElementById('lesson-card')
  if (!card) return
  card.hidden = step < 0
  // Plan item 91: the hint may have been written before the card showed; drop its sky label (Up next carries it).
  const skyLead = `${boardSky(puzzle.seed).label}. `
  if (!card.hidden && ui.hint.textContent?.startsWith(skyLead)) ui.hint.textContent = ui.hint.textContent.slice(skyLead.length)
  // Up next: today's daily, with its sky painted (the HUD already holds both for the board under the lesson).
  const next = document.getElementById('lc-next')
  if (next && step >= 0 && !next.dataset.filled) {
    next.dataset.filled = '1'
    next.innerHTML = `<span class="lc-next-sky">${(document.getElementById('hud-sky')?.innerHTML ?? '').replace(/sk-g/g, 'sk-g-next')}</span><span><small>Up next</small><b>${upNextTitle(ui.hudTitle.textContent ?? '')}</b><span>${escapeText(boardSky(puzzle.seed).label)}</span></span>`
  }
  card.querySelectorAll<HTMLLIElement>('.lc-steps li').forEach((li, i) => {
    li.classList.toggle('done', i < step || step >= LESSON_STEPS.length)
    li.classList.toggle('now', i === step)
    if (i === step) li.setAttribute('aria-current', 'step')
    else li.removeAttribute('aria-current')
  })
}
function endLesson(): void {
  if (lessonStep < 0) return
  flyDailyCard()
  markLessonCard(-1)
  lessonStep = -1
  document.body.classList.remove('in-lesson')
  data.seenHelp = true
  save(data)
  openGame()
}

/** Plan item 134: the lesson hands over to today's daily with its weather card: the Up next card lifts from the
 *  lesson column (or the middle of the screen on a phone, where it isn't shown), flies to the centre and fades as
 *  the daily opens behind it. Under reduced motion it only fades. */
function flyDailyCard(): void {
  const src = document.getElementById('lc-next')
  if (!src?.innerHTML) return
  const r = src.getBoundingClientRect()
  const card = document.createElement('div')
  card.className = 'daily-fly'
  card.setAttribute('aria-hidden', 'true')
  card.innerHTML = src.innerHTML
  const w = r.width || Math.min(300, innerWidth - 64)
  const from = r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: innerWidth / 2, y: innerHeight * 0.6 }
  card.style.setProperty('--w', `${Math.round(w)}px`)
  card.style.setProperty('--fx', `${Math.round(from.x - innerWidth / 2)}px`)
  card.style.setProperty('--fy', `${Math.round(from.y - innerHeight / 2)}px`)
  document.body.append(card)
  window.setTimeout(() => card.remove(), 1300)
}

/** Critique 2026-11-04 (item 126): "Daily #37 · Wed, Nov 4" may wrap only at a dot, never inside the date. */
function upNextTitle(title: string): string {
  // Plan item 138: the daily's number on its own line and the date with its sky under it, so no line ends on a dot.
  const parts = title.split(' · ').map((part) => escapeText(part).replace(/ /g, '&nbsp;'))
  if (parts.length < 2) return parts.join('')
  return `<span class="unt-head">${parts[0]}</span><span class="unt-rest">${parts.slice(1).join(' · ')}</span>`
}

// ---- start ------------------------------------------------------------------------------------------

const params = new URLSearchParams(location.search)
// Plan item 116: `?keyart` is the site poster's frame (scripts/keyart.mjs): the valley and the board alone, no
// header, stats, host line or buttons (styles.css "key art").
if (params.has('keyart')) document.documentElement.dataset.keyart = ''
if (params.get('mode') === 'practice') mode = 'practice'
if (params.get('mode') === 'orchard') {
  mode = 'orchard'
  level = unlockedLevel(data.orchard ?? {})
}
openGame()
// A first visit learns on the board, not from a rules sheet (plan item 22): `?lesson` replays it.
if ((!data.seenHelp && !params.has('nohelp')) || params.has('lesson')) startLesson()
// Screenshot hook: `?shotwin` finishes the board straight away so the win dialog can be shot. It plays as a solve
// on par (with no taps it read '0 taps, 41 under par'); `?shotwin` saves nothing (store.ts `frozen`).
if (params.has('shotwin')) shotWin()
function shotWin(): void {
  if (!game.solved && game.taps === 0) game.taps = puzzle.par
  finish()
}
// Screenshot hook: `?shotsolve` sets every piece to its solution except the first turnable one next to
// the spring, which is left one clockwise tap away (marked `data-last`), so a single tap shows the whole
// river running out across the board and the win. Nothing is saved until that tap.
if (params.has('shotsolve')) shotSolve()
function shotSolve(): void {
  if (game.solved) return
  const spring = puzzle.cells.findIndex((c) => c.kind === 'spring')
  const near = (i: number) => Math.abs(puzzle.cells[i]!.q - puzzle.cells[spring]!.q) + Math.abs(puzzle.cells[i]!.r - puzzle.cells[spring]!.r)
  const last = puzzle.cells
    .map((_, i) => i)
    .filter((i) => {
      const c = puzzle.cells[i]!
      // Not a bridge: turned, its crossing channel can still carry water, so it would not be the dry last tile.
      return c.kind !== 'stone' && c.kind !== 'spring' && !c.fixed && !c.reservoir && !c.bridge && rotateMask(c.solved, 1) !== c.solved
    })
    .sort((a, b) => near(a) - near(b))[0]
  puzzle.cells.forEach((c, i) => {
    c.locked = false
    c.rot = i === last ? 5 : 0
  })
  board = new Board(ui.board, puzzle, { onTurn, onToggleLock })
  wetCount = computeFlow(puzzle.cells).wet.size
  if (last !== undefined) ui.board.querySelectorAll('.tiles > g.cell')[last]?.setAttribute('data-last', '')
}

// Plan item 39's e2e: under webdriver, set the board one tap from solved (the tile is marked `data-last`).
if (navigator.webdriver) (window as unknown as { runnelTest: object }).runnelTest = { nearlySolve: shotSolve }

function workshopCode(seed: string): string | null {
  return isWorkshopSeed(seed) ? seed.slice('workshop-'.length) : null
}

const workshop = initWorkshop({
  play: (code) => playCode(code),
  share: (code) => {
    // Share the card too when the last win card was this board's.
    ui.toast.textContent = ''
    void shareOut(workshopShareText(code), cardCode === code ? cardBlob : null).then(() => {
      const st = document.getElementById('ws-status')
      if (st && ui.toast.textContent) st.textContent = ui.toast.textContent === 'Copied to clipboard.' ? `Copied. Send ${code} to a friend.` : ui.toast.textContent
    })
  },
  picks: () => data.picks ?? [],
  tested: (code) => (data.workshopSolved ?? []).includes(code),
  toast: (t) => (ui.toast.textContent = t),
})

mountWeekChip(document.getElementById('week-slot'), 'Runnel')
