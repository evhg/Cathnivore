// Plan item 50: the week's arc as a strip of small boards (the desktop rail), and Bea's garden as the week's
// beds. Pure data plus SVG strings, so both are unit-tested without a DOM.

import { DIRECTIONS, arcLabel, dailyPuzzle, type Puzzle } from './engine'
import { gardenPlots, type Plot } from './garden'
import type { DailyResult } from './store'

export type DayState = 'solved' | 'missed' | 'today' | 'ahead'

export interface WeekDay {
  day: string
  /** "Mon" .. "Sun". */
  short: string
  state: DayState
  /** The arc's word for the day ("Gentle" .. "Hardest"), or null before the arc began. */
  arc: string | null
}

const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const addDays = (day: string, n: number): string => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)

/** This week, Monday to Sunday, around `today`, each day with what the player did with it. */
export function weekDays(today: string, results: Record<string, DailyResult>): WeekDay[] {
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay()
  const monday = addDays(today, -((dow + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(monday, i)
    const state: DayState = results[day] ? 'solved' : day === today ? 'today' : day < today ? 'missed' : 'ahead'
    return { day, short: SHORT[new Date(`${day}T00:00:00Z`).getUTCDay()]!, state, arc: arcLabel(day) }
  })
}

const R = 10
const hexPts = (cx: number, cy: number, r: number): string =>
  Array.from({ length: 6 }, (_, k) => {
    const a = ((60 * k + 30) * Math.PI) / 180
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`
  }).join(' ')

/** A day's board in little, in its solved shape: watered if the player solved it, dry otherwise. */
export function miniBoardSvg(puzzle: Puzzle, state: DayState): string {
  const pos = (q: number, r: number) => ({ x: R * Math.sqrt(3) * (q + r / 2), y: R * 1.5 * r })
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let tiles = ''
  let lines = ''
  for (const c of puzzle.cells) {
    const { x, y } = pos(c.q, c.r)
    minX = Math.min(minX, x - R)
    maxX = Math.max(maxX, x + R)
    minY = Math.min(minY, y - R)
    maxY = Math.max(maxY, y + R)
    tiles += `<polygon class="wk-tile${c.kind === 'stone' ? ' wk-stone' : ''}" points="${hexPts(x, y, R * 0.92)}"/>`
    if (c.kind === 'stone') continue
    for (let d = 0; d < 6; d++) {
      if (!(c.solved & (1 << d))) continue
      const n = DIRECTIONS[d]!
      const e = pos(c.q + n.q / 2, c.r + n.r / 2)
      lines += `M${x.toFixed(1)} ${y.toFixed(1)}L${e.x.toFixed(1)} ${e.y.toFixed(1)}`
    }
  }
  const vb = `${(minX - 2).toFixed(1)} ${(minY - 2).toFixed(1)} ${(maxX - minX + 4).toFixed(1)} ${(maxY - minY + 4).toFixed(1)}`
  return `<svg class="wk-board" data-state="${state}" viewBox="${vb}" aria-hidden="true">${tiles}<path class="wk-channel" d="${lines}"/></svg>`
}

/** The strip's boards, Monday on: past and today's boards drawn (solved ones watered), days ahead a blank hex. */
export function weekStrip(today: string, results: Record<string, DailyResult>): { day: WeekDay; svg: string }[] {
  return weekDays(today, results).map((day) => ({
    day,
    svg:
      day.state === 'ahead'
        ? `<svg class="wk-board" data-state="ahead" viewBox="-12 -12 24 24" aria-hidden="true"><polygon class="wk-tile" points="${hexPts(0, 0, 10)}"/></svg>`
        : miniBoardSvg(dailyPuzzle(day.day), day.state),
  }))
}

export interface Bed {
  day: string
  short: string
  state: DayState
  /** The crop growing in a solved day's bed, at its stage. */
  plot: Plot | null
}

/** Bea's garden as the week's seven beds: a solved day's crop at its stage, a bare mound otherwise. */
export function weekBeds(today: string, results: Record<string, DailyResult>): Bed[] {
  const plots = new Map(gardenPlots(results, today).map((p) => [p.day, p]))
  return weekDays(today, results).map((d) => ({ day: d.day, short: d.short, state: d.state, plot: plots.get(d.day) ?? null }))
}
