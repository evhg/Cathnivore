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
