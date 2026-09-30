import './styles.css'
import '../../../shared/cath/cath.css'
import { cathMarkup, createHost } from './host'
import { Board } from './board'
import {
  computeFlow,
  dailyNumber,
  dropsFor,
  dailyPuzzle,
  generatePuzzle,
  rotateCell,
  utcDateString,
  type Puzzle,
} from './engine'
import { isMuted, playTurn, playWater, playWin, setMuted } from './sound'
import { dailyStats, formatTime, load, save, SIZE_RADIUS, type SavedGame, type Size } from './store'

type Mode = 'daily' | 'practice'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

const ui = {
  board: document.getElementById('board') as unknown as SVGSVGElement,
  tabDaily: $<HTMLButtonElement>('tab-daily'),
  tabPractice: $<HTMLButtonElement>('tab-practice'),
  sizes: $<HTMLDivElement>('sizes'),
  hudTitle: $<HTMLDivElement>('hud-title'),
  hudTime: $<HTMLElement>('hud-time'),
  hudTaps: $<HTMLElement>('hud-taps'),
  hudPar: $<HTMLElement>('hud-par'),
  progress: $<HTMLDivElement>('progress-fill'),
  hint: $<HTMLParagraphElement>('hint'),
  btnNew: $<HTMLButtonElement>('btn-new'),
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

const host = createHost($<HTMLSpanElement>('host-face'), $<HTMLParagraphElement>('host-line'))
$<HTMLDivElement>('help-cath').innerHTML = cathMarkup('wink', 'face')

const data = load()
let today = utcDateString(new Date())
let mode: Mode = 'daily'
let size: Size = 'medium'
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
  pauseClock()
  if (mode === 'daily') {
    puzzle = dailyPuzzle(today)
    game = restore(puzzle, data.daily[today])
    data.daily[today] = game
  } else {
    const saved = data.practice[size]
    const seed = saved && !saved.solved ? saved.seed : newPracticeSeed()
    puzzle = generatePuzzle(seed, { radius: SIZE_RADIUS[size] })
    game = restore(puzzle, saved && saved.seed === seed ? saved : undefined)
    data.practice[size] = game
  }
  save(data)
  board = new Board(ui.board, puzzle, { onTurn, onToggleLock })
  wetCount = computeFlow(puzzle.cells).wet.size
  host.greet(mode === 'daily', mode === 'daily' ? dailyNumber(today) : Math.floor(Math.random() * 3) + 1)
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
  playWater(wetCount - wetBefore, wetCount / Math.max(1, puzzle.cells.filter((c) => c.kind !== 'stone').length))
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
  if (mode === 'daily' && !data.results[today]) {
    data.results[today] = { number: dailyNumber(today), timeMs: game.elapsedMs, taps: game.taps, par: puzzle.par }
  }
  if (mode === 'practice') {
    data.practiceSolved++
    const best = data.bestPractice[size]
    if (best === undefined || game.elapsedMs < best) data.bestPractice[size] = game.elapsedMs
  }
  save(data)
  board.celebrate()
  playWin()
  ui.announce.textContent = 'Solved. Every field is watered.'
  window.setTimeout(showWin, matchMedia('(prefers-reduced-motion: reduce)').matches ? 200 : 1400)
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
  ui.tabPractice.setAttribute('aria-selected', String(!isDaily))
  ui.sizes.hidden = isDaily
  ui.sizes.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.size === size))
  })
  ui.hudTitle.textContent = isDaily
    ? `Daily #${dailyNumber(today)} · ${formatDay(today)}`
    : `Practice · ${size[0]!.toUpperCase()}${size.slice(1)}`
  ui.hudTime.textContent = formatTime(elapsed())
  ui.hudTaps.textContent = String(game.taps)
  ui.hudPar.textContent = String(puzzle.par)

  const flow = computeFlow(puzzle.cells)
  const playable = puzzle.cells.filter((c) => c.kind !== 'stone').length
  ui.progress.style.setProperty('--progress', String(flow.wet.size / playable))
  ui.progress.classList.toggle('done', flow.solved)
  if (game.taps > 0) host.react(flow.wet.size / playable, flow.solved)

  if (game.solved) {
    ui.hint.textContent = isDaily
      ? `Solved in ${formatTime(game.elapsedMs)}. Next puzzle in ${untilTomorrow()}.`
      : `Solved in ${formatTime(game.elapsedMs)}.`
    ui.btnNew.hidden = false
    ui.btnNew.textContent = isDaily ? 'See result' : 'New puzzle'
  } else {
    ui.hint.textContent = 'Tap a tile to turn it. Hold to pin it in place.'
    ui.btnNew.hidden = isDaily
    ui.btnNew.textContent = 'New puzzle'
  }
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
  $<HTMLDivElement>('win-cath').innerHTML = cathMarkup('delighted', 'bust')
  const isDaily = mode === 'daily'
  ui.winEyebrow.textContent = isDaily ? `Daily #${dailyNumber(today)}` : `Practice · ${size}`
  ui.winTitle.textContent = 'Every field is watered.'
  ui.winTime.textContent = formatTime(game.elapsedMs)
  ui.winTaps.textContent = String(game.taps)
  ui.winPar.textContent = String(puzzle.par)
  const stats = dailyStats(data, today)
  ui.winNote.textContent = isDaily
    ? `${parNote(game.taps, puzzle.par)} Streak: ${stats.streak} day${stats.streak === 1 ? '' : 's'}. Next puzzle in ${untilTomorrow()}.`
    : parNote(game.taps, puzzle.par)
  ui.btnNext.textContent = isDaily ? 'Play practice' : 'Next puzzle'
  ui.toast.textContent = ''
  if (!ui.dlgWin.open) ui.dlgWin.showModal()
}

function shareText(): string {
  const head = mode === 'daily' ? `Runnel #${dailyNumber(today)}` : `Runnel practice (${size})`
  const drops = '💧'.repeat(dropsFor(game.taps, puzzle.par))
  return `${head} 🌱 Cath's fields, all watered\n⏱ ${formatTime(game.elapsedMs)} · ${game.taps} taps (par ${puzzle.par}) ${drops}\nhttps://cathnivore.com/runnel/`
}

ui.btnShare.addEventListener('click', async () => {
  const text = shareText()
  try {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      await navigator.share({ text })
      return
    }
    await navigator.clipboard.writeText(text)
    ui.toast.textContent = 'Copied to clipboard.'
  } catch {
    ui.toast.textContent = 'Could not share from this browser.'
  }
})

ui.btnNext.addEventListener('click', () => {
  ui.dlgWin.close()
  if (mode === 'daily') switchMode('practice')
  else newPractice()
})

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
    const cell = document.createElement('i')
    const solved = data.results[day] !== undefined
    if (solved) cell.className = 'on'
    if (day === today) cell.classList.add('today')
    cell.title = `${day}${solved ? ': solved' : ''}`
    cal.push(cell)
  }
  ui.streakCal.replaceChildren(...cal)
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
  openGame()
}

function newPractice(): void {
  pauseClock()
  delete data.practice[size]
  openGame()
}

ui.tabDaily.addEventListener('click', () => switchMode('daily'))
ui.tabPractice.addEventListener('click', () => switchMode('practice'))
ui.sizes.addEventListener('click', (e) => {
  const target = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-size]')
  if (!target) return
  const next = target.dataset.size as Size
  if (next === size) return
  pauseClock()
  size = next
  openGame()
})
ui.btnNew.addEventListener('click', () => {
  if (mode === 'daily') showWin()
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

// Focus rings on the board only for keyboard players; a tap focuses the tile too, and a ring there
// would look like a selection.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Tab' || e.key.startsWith('Arrow')) document.body.classList.add('keyboard')
})
document.addEventListener('pointerdown', () => document.body.classList.remove('keyboard'))

// ---- start ------------------------------------------------------------------------------------------

const params = new URLSearchParams(location.search)
if (params.get('mode') === 'practice') mode = 'practice'
openGame()
if (!data.seenHelp && !params.has('nohelp')) ui.dlgHelp.showModal()
