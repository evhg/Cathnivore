// Plan item 491: today in the studio. The hero's numbers row becomes a 24-hour track of the build sessions that ran
// (dist-site/studio.json, written at build time by scripts/studio-log.ts): a notch per session on its lane's row,
// coloured by lane, the four numbers as captions at the track's two ends. A notch opens a card with the session's
// commit subjects, the game it touched and that game's frame: at D a card over the track on hover, focus or click; on a
// phone a swiped row of cards under it, which the notches scroll to. With no JSON (or no sessions) nothing changes and
// the numbers stay as they were.
import type { StudioGame, StudioLog, StudioSession } from './studioLog'

export const GAME_NAMES: Record<StudioGame, string> = {
  cathnivore: 'Cathnivore',
  hedgerow: 'Hedgerow',
  runnel: 'Runnel',
  nightshift: 'NIGHT SHIFT',
  portfolio: 'This site',
}

/** Plan item 626: each game's colour on the track (a token in tokens.css, 3:1 or more on the track: tested). */
export const GAME_COLORS: Record<StudioGame, string> = {
  cathnivore: '--game-cathnivore',
  hedgerow: '--game-hedgerow',
  runnel: '--game-runnel',
  nightshift: '--game-nightshift',
  portfolio: '--game-site',
}

/** A notch's accessible name: its lane, its start, its game and what it changed ('Lane B, 14:05, Hedgerow: ...'). */
export function notchLabel(s: StudioSession, time: string): string {
  const more = s.subjects.length > 1 ? `, and ${s.subjects.length - 1} more ${s.subjects.length === 2 ? 'change' : 'changes'}` : ''
  // A subject that opens with its game's name ('Hedgerow 3D (plan item 621): ...') loses that lead: the label says it.
  const first = (s.subjects[0] ?? 'work in progress').replace(new RegExp(`^${GAME_NAMES[s.game]}\\b[^:]{0,40}:\\s*`, 'i'), '')
  return `Lane ${s.lane}, ${time}, ${GAME_NAMES[s.game]}: ${first}${more}`
}

/** The game's frame, the 640 px cut of the same key art the portfolio's games entry shows (apps.ts). */
export function frameFor(game: StudioGame): string | null {
  return game === 'portfolio' ? null : `/work/games-${game}-640.webp`
}

const HOUR = 3600

/** Left edge and width of a session on a 24 h track ending at `now`, in percent. */
export function notchSpan(s: Pick<StudioSession, 'start' | 'end'>, now: number, hours = 24): { left: number; width: number } {
  const from = now - hours * HOUR
  const left = Math.max(0, Math.min(100, ((s.start - from) / (hours * HOUR)) * 100))
  const right = Math.max(left, Math.min(100, ((s.end - from) / (hours * HOUR)) * 100))
  return { left, width: right - left }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text !== undefined) e.textContent = text
  return e
}

const clock = (t: number) => new Date(t * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

function card(s: StudioSession, i: number): HTMLElement {
  const c = el('article', 'studio-card')
  c.id = `studio-card-${i}`
  c.dataset.lane = s.lane
  c.dataset.game = s.game
  const frame = frameFor(s.game)
  const art = el('div', 'studio-frame')
  if (frame) {
    const img = el('img')
    img.src = frame
    img.alt = ''
    img.width = 640
    img.height = 400
    img.loading = 'lazy'
    img.decoding = 'async'
    art.append(img)
  } else {
    art.classList.add('studio-frame-site')
    art.append(el('span', 'studio-frame-word', 'cathnivore.com'))
  }
  const body = el('div', 'studio-card-body')
  const meta = el('p', 'studio-card-meta')
  meta.append(el('span', 'studio-lane', `Lane ${s.lane}`), el('span', '', `${clock(s.start)}${s.end - s.start >= 60 ? `–${clock(s.end)}` : ''}`))
  const h = el('h3', 'studio-card-game', GAME_NAMES[s.game])
  const list = el('ul', 'studio-card-list')
  for (const subject of s.subjects.slice(0, 3)) list.append(el('li', '', subject))
  if (s.subjects.length > 3) list.append(el('li', 'studio-more', `and ${s.subjects.length - 3} more`))
  body.append(meta, h, list)
  c.append(art, body)
  return c
}

export function renderStudio(host: HTMLElement, log: StudioLog, opts: { reduced: boolean; stats?: HTMLElement | null; shipped?: HTMLElement | null; desk: MediaQueryList }): boolean {
  const sessions = log.sessions.filter((s) => s.subjects.length > 0)
  if (sessions.length === 0) return false
  const now = log.generated
  const commits = sessions.reduce((n, s) => n + s.subjects.length, 0)

  host.replaceChildren()
  const head = el('div', 'studio-head')
  const title = el('p', 'studio-title')
  title.append(el('span', 'studio-eyebrow', 'Today in the studio'), el('span', 'studio-sum', `${sessions.length} sessions, ${commits} changes in the last 24 hours`))
  // Plan item 626: a notch is coloured by the game its session worked on; the two rows are the two lanes.
  const legend = el('p', 'studio-legend')
  const shown = (Object.keys(GAME_NAMES) as StudioGame[]).filter((g) => sessions.some((s) => s.game === g))
  for (const g of shown) {
    const key = el('span', 'studio-key', GAME_NAMES[g])
    key.dataset.game = g
    legend.append(key)
  }
  legend.append(el('span', 'studio-key-lanes', 'Rows: lane A, lane B'))
  head.append(title, legend)

  const track = el('div', 'studio-track')
  track.setAttribute('data-studio-track', '')
  track.setAttribute('role', 'group')
  track.setAttribute('aria-label', 'Build sessions in the last 24 hours, oldest first')
  for (const lane of ['A', 'B'] as const) {
    const row = el('div', 'studio-row')
    row.dataset.lane = lane
    track.append(row)
  }
  // Hour marks every three hours, labelled in the viewer's time.
  const ticks = el('div', 'studio-ticks')
  ticks.setAttribute('aria-hidden', 'true')
  const firstMark = Math.ceil((now - 24 * HOUR) / (3 * HOUR)) * 3 * HOUR
  for (let t = firstMark; t <= now; t += 3 * HOUR) {
    const at = notchSpan({ start: t, end: t }, now).left
    // Clear of the track's ends (its first edge and the 'now' mark).
    if (at < 3 || at > 92) continue
    const tick = el('span', 'studio-tick', new Date(t * 1000).toLocaleTimeString([], { hour: 'numeric' }))
    tick.style.setProperty('--at', `${at}%`)
    if (Math.round(t / HOUR) % 6 === 0) tick.dataset.major = ''
    ticks.append(tick)
  }
  const nowMark = el('span', 'studio-now', 'now')
  ticks.append(nowMark)
  track.append(ticks)

  const cards = el('div', 'studio-cards')
  // A scrolled row on a phone, so it takes focus itself (arrow keys scroll it).
  cards.tabIndex = 0
  cards.setAttribute('role', 'region')
  cards.setAttribute('aria-label', "Each session's work")
  const notches: HTMLButtonElement[] = []
  sessions.forEach((s, i) => {
    const { left, width } = notchSpan(s, now)
    const b = el('button', 'notch')
    b.type = 'button'
    b.dataset.lane = s.lane
    b.dataset.game = s.game
    b.dataset.index = String(i)
    b.style.setProperty('--at', `${left}%`)
    b.style.setProperty('--w', `${width}%`)
    b.setAttribute('aria-controls', `studio-card-${i}`)
    b.setAttribute('aria-label', notchLabel(s, clock(s.start)))
    track.querySelector<HTMLElement>(`.studio-row[data-lane="${s.lane}"]`)!.append(b)
    notches.push(b)
    cards.append(card(s, i))
  })

  const stage = el('div', 'studio-stage')
  stage.append(track, cards)
  const foot = el('div', 'studio-foot')
  if (opts.stats) foot.append(opts.stats)
  // Plan item 638: the 'Live: last shipped' line rides in the numbers' row (between its two pairs at D), so it ends
  // above a 900 px fold instead of under it.
  if (opts.shipped) {
    const shipped = opts.shipped
    const home = shipped.parentElement
    const anchor = shipped.nextSibling
    const wide = matchMedia('(min-width: 1280px)')
    const place = () => {
      if (wide.matches) foot.append(shipped)
      else if (home && shipped.parentElement !== home) home.insertBefore(shipped, anchor && anchor.parentNode === home ? anchor : null)
    }
    place()
    wide.addEventListener('change', place)
  }
  host.append(head, stage, foot)
  host.hidden = false
  host.closest('.hero')?.classList.add('has-studio')

  let active = -1
  // While a notch steers the phone's row there, the row's scroll doesn't pick a card of its own.
  let steerUntil = 0
  let closeTimer = 0
  const cardEls = [...cards.children] as HTMLElement[]
  const show = (i: number, from: 'point' | 'strip' | 'notch') => {
    clearTimeout(closeTimer)
    if (i === active && from !== 'notch') return
    active = i
    notches.forEach((n, k) => n.setAttribute('aria-pressed', String(k === i)))
    cardEls.forEach((c, k) => c.classList.toggle('is-active', k === i))
    host.dataset.active = String(i)
    if (i < 0) return
    if (opts.desk.matches) {
      // Over the track, above its notch, kept inside the track.
      const t = track.getBoundingClientRect()
      const n = notches[i]!.getBoundingClientRect()
      const w = cardEls[i]!.offsetWidth || 640
      const x = Math.max(0, Math.min(t.width - w, n.left + n.width / 2 - t.left - w / 2))
      cards.style.setProperty('--x', `${x}px`)
    } else if (from === 'notch') {
      const c = cardEls[i]!
      steerUntil = performance.now() + 900
      cards.scrollTo({ left: c.offsetLeft - (cards.clientWidth - c.offsetWidth) / 2, behavior: opts.reduced ? 'auto' : 'smooth' })
    }
  }
  const hide = () => {
    if (!opts.desk.matches) return
    clearTimeout(closeTimer)
    closeTimer = window.setTimeout(() => show(-1, 'point'), 260)
  }
  notches.forEach((n, i) => {
    n.addEventListener('pointerenter', () => { if (opts.desk.matches) show(i, 'point') })
    n.addEventListener('focus', () => show(i, 'notch'))
    n.addEventListener('click', () => show(i, 'notch'))
    n.addEventListener('pointerleave', hide)
    n.addEventListener('blur', hide)
  })
  cards.addEventListener('pointerenter', () => clearTimeout(closeTimer))
  cards.addEventListener('pointerleave', hide)
  host.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && active >= 0 && opts.desk.matches) show(-1, 'point')
  })

  // On a phone the cards are a swiped row: the card nearest the row's middle lights its notch.
  let raf = 0
  cards.addEventListener('scroll', () => {
    if (opts.desk.matches || performance.now() < steerUntil) return
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(() => {
      const mid = cards.scrollLeft + cards.clientWidth / 2
      let best = 0
      cardEls.forEach((c, k) => {
        if (Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid) < Math.abs(cardEls[best]!.offsetLeft + cardEls[best]!.offsetWidth / 2 - mid)) best = k
      })
      show(best, 'strip')
    })
  }, { passive: true })

  const settle = () => {
    cards.tabIndex = opts.desk.matches ? -1 : 0
    if (opts.desk.matches) show(-1, 'point')
    else {
      // The newest session first in view.
      const last = cardEls.length - 1
      cards.scrollLeft = cards.scrollWidth
      show(last, 'strip')
    }
  }
  settle()
  opts.desk.addEventListener('change', settle)
  return true
}

/** Fetches the build's studio log; null when it's missing, empty or unreadable. */
export async function loadStudio(): Promise<StudioLog | null> {
  try {
    const res = await fetch('/studio.json', { cache: 'no-store' })
    if (!res.ok) return null
    const log = (await res.json()) as StudioLog
    return Array.isArray(log.sessions) && log.sessions.length > 0 && Number.isFinite(log.generated) ? log : null
  } catch {
    return null
  }
}
