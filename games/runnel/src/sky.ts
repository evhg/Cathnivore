// Runnel's sky: every board gets a time of day and a weather from its seed, so each daily feels like a
// different morning or evening on the farm. Pure data here; board.ts draws it and styles.css lights it.

import { hashString } from './engine'

export type TimeOfDay = 'morning' | 'noon' | 'golden' | 'dusk'
export type Weather = 'clear' | 'breeze' | 'clouds' | 'drizzle'

export interface Sky {
  time: TimeOfDay
  weather: Weather
  /** Words for screen readers and the hint line, such as "Golden hour, light drizzle". */
  label: string
}

const TIMES: TimeOfDay[] = ['morning', 'noon', 'golden', 'dusk']
// Weighted: clear and breezy days are most common, drizzle is a treat.
const WEATHERS: Weather[] = ['clear', 'clear', 'clear', 'breeze', 'breeze', 'clouds', 'clouds', 'drizzle']

const TIME_WORDS: Record<TimeOfDay, string> = {
  morning: 'Early morning',
  noon: 'Midday',
  golden: 'Golden hour',
  dusk: 'Dusk',
}
const WEATHER_WORDS: Record<Weather, string> = {
  clear: 'clear skies',
  breeze: 'a warm breeze',
  clouds: 'drifting clouds',
  drizzle: 'light drizzle',
}

export function skyFor(seed: string): Sky {
  const h = hashString(`sky:${seed}`)
  const time = TIMES[h % TIMES.length]!
  const weather = WEATHERS[(h >>> 8) % WEATHERS.length]!
  return { time, weather, label: `${TIME_WORDS[time]}, ${WEATHER_WORDS[weather]}` }
}

/** The board's sky, with the `?sky=<time>,<weather>` screenshot hook applied (and its words to match). */
export function boardSky(seed: string, search: string = typeof location === 'undefined' ? '' : location.search): Sky {
  const sky = skyFor(seed)
  const forced = new URLSearchParams(search).get('sky')?.split(',')
  const time = (TIMES as string[]).includes(forced?.[0] ?? '') ? (forced![0] as TimeOfDay) : sky.time
  const weather = (WEATHERS as string[]).includes(forced?.[1] ?? '') ? (forced![1] as Weather) : sky.weather
  return { time, weather, label: `${TIME_WORDS[time]}, ${WEATHER_WORDS[weather]}` }
}

const SKY_FILL: Record<TimeOfDay, [string, string]> = {
  morning: ['#bfe0f2', '#f8e7c4'],
  noon: ['#8ecdf0', '#e3f2f8'],
  golden: ['#f2b56b', '#fbe2a8'],
  dusk: ['#6d5a8c', '#f0a98a'],
}

/**
 * Plan item 70: the day card's little painting of the board's sky at D: the sun (or the moon at dusk) where the
 * hour puts it, over Cath's hills, with the day's weather drawn in (a breeze's streaks, clouds, drizzle).
 */
export function skyArt(sky: Sky): string {
  const [top, low] = SKY_FILL[sky.time]
  const sunX = { morning: 22, noon: 48, golden: 72, dusk: 80 }[sky.time]
  const sunY = { morning: 26, noon: 14, golden: 26, dusk: 22 }[sky.time]
  const body =
    sky.time === 'dusk'
      ? `<circle class="sk-moon" cx="${sunX}" cy="${sunY}" r="6" fill="#fdf3d8"/><circle cx="${sunX + 3}" cy="${sunY - 2}" r="5" fill="${top}"/>`
      : `<circle class="sk-sun" cx="${sunX}" cy="${sunY}" r="7" fill="${sky.time === 'golden' ? '#ffd27a' : '#fff1b8'}"/>`
  const cloud = (x: number, y: number, s: number) =>
    `<g class="sk-cloud" fill="#ffffff" opacity=".9"><ellipse cx="${x}" cy="${y}" rx="${9 * s}" ry="${3.6 * s}"/><ellipse cx="${x + 4 * s}" cy="${y - 2.6 * s}" rx="${5 * s}" ry="${3.4 * s}"/></g>`
  const weather =
    sky.weather === 'clouds'
      ? cloud(34, 18, 1.1) + cloud(70, 12, 0.8)
      : sky.weather === 'drizzle'
        ? cloud(44, 14, 1.3) + `<g class="sk-rain" stroke="#5a8fb8" stroke-width="1.2" stroke-linecap="round">${[34, 42, 50, 58].map((x, i) => `<path d="M${x} ${22 + (i % 2) * 3}l-2 6"/>`).join('')}</g>`
        : sky.weather === 'breeze'
          ? `<g class="sk-breeze" fill="none" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round" opacity=".85"><path d="M10 30q12-4 24 0t20 0"/><path d="M40 22q10-3 20 0t14 0"/></g>`
          : ''
  return `<svg viewBox="0 0 96 56" class="sky-art" data-time="${sky.time}" data-weather="${sky.weather}" aria-hidden="true"><defs><linearGradient id="sk-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${low}"/></linearGradient></defs><rect width="96" height="56" rx="10" fill="url(#sk-g)"/>${body}${weather}<path d="M0 42q20-10 40-4t56-6V56H0z" fill="#8fb36a"/><path d="M0 48q30-8 56-2t40-4V56H0z" fill="#6f9a4e"/><path d="M14 49h10M60 50h12" stroke="#4a7ba8" stroke-width="2" stroke-linecap="round"/></svg>`
}
