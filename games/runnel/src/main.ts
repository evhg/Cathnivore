import '../../../shared/ui/base.css'
import '../../../shared/ui/palette.css'
import { postcard, seasonOf, weatherMarkup } from './season'
import { ORCHARD_LEVELS, orchardName, orchardOptions, orchardSeed, recordOrchard, totalDrops, unlockedLevel } from './orchard'
import { gardenPlots, gardenVisitor } from './garden'
import './fonts.css'
import './tokens.css'
import './styles.css'
import '../../../shared/cath/cath.css'
import { cathMarkup, cathMoment, createHost } from './host'
import { Board } from './board'
import {
  computeFlow,
  dailyNumber,
  dropsFor,
  dailyPuzzle,
  generatePuzzle,
  rotateCell,
  tapsToSolve,
  hexDistance,
  utcDateString,
  type Puzzle,
} from './engine'
import { isMuted, playMusic, playTurn, playWater, playWin, setMusicLevel, setMuted } from './sound'
import { boardCode, parseBoardCode } from './code'
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

const host = createHost($<HTMLSpanElement>('host-face'), $<HTMLParagraphElement>('host-line'))
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
    puzzle = generatePuzzle(seed, { radius: SIZE_RADIUS[size] })
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
  if (mode === 'orchard') recordOrchard((data.orchard ??= {}), level, game.taps, puzzle.par, game.elapsedMs)
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
  ui.sizes.hidden = mode !== 'practice'
  ui.codebar.hidden = mode !== 'practice'
  renderPicks()
  ui.levels.hidden = !isOrchard
  if (isOrchard) renderLevels()
  ui.sizes.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.size === size))
  })
  ui.hudTitle.textContent = isDaily
    ? `Daily #${dailyNumber(playDay)} · ${formatDay(playDay)}`
    : isOrchard
    ? `Orchard ${level} · ${orchardName(level)}`
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
    ui.btnNew.textContent = isDaily ? 'See result' : isOrchard ? 'See result' : 'New puzzle'
  } else {
    const wet = Math.max(0, flow.wet.size - 1)
    ui.hint.textContent =
      game.taps === 0
        ? 'Tap a tile to turn it. Hold to pin it in place.'
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
    ? `${parNote(game.taps, puzzle.par)} ${stats.streak > 1 ? '🔥 ' : ''}Streak: ${stats.streak} day${stats.streak === 1 ? '' : 's'} (best ${stats.maxStreak}). Next puzzle in ${untilTomorrow()}.`
    : parNote(game.taps, puzzle.par)
  const best = isOrchard ? data.orchard?.[level] : undefined
  if (best) ui.winNote.textContent = `${'💧'.repeat(best.drops)}${'▫️'.repeat(3 - best.drops)} ${parNote(game.taps, puzzle.par)} Orchard drops: ${totalDrops(data.orchard ?? {})} of ${ORCHARD_LEVELS * 3}.`
  ui.btnNext.textContent = isDaily ? 'Play practice' : isOrchard ? (level >= ORCHARD_LEVELS ? 'Back to daily' : 'Next row') : 'Next puzzle'
  ui.toast.textContent = ''
  $<HTMLElement>('win-bea').innerHTML = beaDrawing(puzzle.seed, game.taps <= puzzle.par)
  if (!ui.dlgWin.open) ui.dlgWin.showModal()
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
  const head = mode === 'daily' ? `Runnel #${dailyNumber(playDay)}` : mode === 'orchard' ? `Runnel Orchard ${level}` : `Runnel practice (${size})`
  const drops = '💧'.repeat(dropsFor(game.taps, puzzle.par))
  return `${head} 🌱 Cath's fields, all watered\n⏱ ${formatTime(game.elapsedMs)} · ${game.taps} taps (par ${puzzle.par}) ${drops}\n${shareGrid()}\nhttps://cathnivore.com/runnel/`
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
  else if (mode === 'orchard') {
    if (level >= ORCHARD_LEVELS) switchMode('daily')
    else playLevel(level + 1)
  } else newPractice()
})

function renderGarden(): void {
  const plots = gardenPlots(data.results, today)
  const note = $<HTMLParagraphElement>('garden-note')
  const visitor = gardenVisitor(seasonOf(today), plots)
  const base = visitor ? `${visitor.glyph} ${visitor.line}` : 'Solve a daily and Bea plants a seed.'
  note.textContent = base
  $<HTMLDivElement>('garden').replaceChildren(
    ...plots.map((p) => {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = `plot ${p.stage}${p.gold ? ' gold' : ''}`
      b.textContent = p.glyph
      b.setAttribute('aria-label', p.label)
      b.addEventListener('click', (e) => {
        e.preventDefault()
        note.textContent = p.label
      })
      return b
    }),
  )
}

function showStats(): void {
  const s = dailyStats(data, today)
  const cells: Array<[string, string]> = [
    [String(s.played), 'dailies solved'],
    [`${s.streak > 1 ? '🔥 ' : ''}${s.streak}`, 'current streak'],
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
    b.textContent = String(n)
    b.disabled = n > open
    b.classList.toggle('done', !!r)
    b.setAttribute('aria-label', `Orchard ${n}${r ? `, ${r.drops} drops` : n > open ? ', locked' : ''}`)
    if (n === level) b.setAttribute('aria-current', 'true')
    ui.levels.append(b)
  }
  const cur = ui.levels.querySelector<HTMLElement>('[aria-current]')
  if (cur) ui.levels.scrollLeft = cur.offsetLeft - (ui.levels.clientWidth - cur.offsetWidth) / 2
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
function playCode(text: string): boolean {
  const parsed = parseBoardCode(text)
  if (!parsed) return false
  pauseClock()
  size = parsed.size
  data.practice[size] = blankGame(generatePuzzle(parsed.seed, { radius: SIZE_RADIUS[size] }))
  openGame()
  return true
}

/** Bea's picks shelf: saved board codes as chips; tap one to play it, the cross removes it. */
function renderPicks(): void {
  const picks = data.picks ?? []
  ui.picks.hidden = mode !== 'practice' || picks.length === 0
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
})
$<HTMLButtonElement>('btn-pick').addEventListener('click', () => {
  const code = boardCode(puzzle.seed)
  if (!code) return
  const picks = (data.picks ?? []).filter((c) => c !== code)
  data.picks = [code, ...picks].slice(0, 8)
  save(data)
  renderPicks()
  ui.toast.textContent = `Saved ${code} to Bea's picks.`
})
$<HTMLButtonElement>('btn-code').addEventListener('click', async () => {
  const code = boardCode(puzzle.seed)
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

// Focus rings on the board only for keyboard players; a tap focuses the tile too, and a ring there
// would look like a selection.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Tab' || e.key.startsWith('Arrow')) document.body.classList.add('keyboard')
})
document.addEventListener('pointerdown', () => document.body.classList.remove('keyboard'))

// ---- start ------------------------------------------------------------------------------------------

const params = new URLSearchParams(location.search)
if (params.get('mode') === 'practice') mode = 'practice'
if (params.get('mode') === 'orchard') {
  mode = 'orchard'
  level = unlockedLevel(data.orchard ?? {})
}
openGame()
if (!data.seenHelp && !params.has('nohelp')) ui.dlgHelp.showModal()
// Screenshot hook: `?shotwin` finishes the board straight away so the win dialog can be shot.
if (params.has('shotwin')) finish()
