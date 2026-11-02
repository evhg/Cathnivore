// Plan item 15: the Daily Market. One shared game per UTC day: the date alone picks the seed, the producer
// pair, the map (with its region types dealt by the seed, the ring included) and the market event, so everyone
// playing on a given day plays the same Marrow. A result per day and a streak live in two small storage keys,
// read defensively like Cath's pins.

import { createRng, nextInt } from '../engine/rng'
import type { GameConfig, ProducerId } from '../engine/types'
import type { MarketEventId } from '../engine/marketEvent'
import { ALL_PRODUCER_IDS } from './producers'
import { layoutConfig, type LayoutId } from './layouts'

/** Daily #1 is 2 November 2026, the day the Daily Market opened. */
const DAY_ONE = Date.UTC(2026, 10, 2)
const DAY_MS = 86_400_000

export interface DailyMarket {
  /** YYYY-MM-DD (UTC). */
  date: string
  number: number
  seed: number
  producers: [ProducerId, ProducerId]
  layout: LayoutId
  marketEvent: MarketEventId
  config: GameConfig
}

export function dailyDateKey(now: Date): string {
  return now.toISOString().slice(0, 10)
}

/** FNV-1a over the date key: a stable 31-bit seed per day. */
function hashDate(key: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0) & 0x7fffffff
}

const LAYOUT_ORDER: LayoutId[] = ['ring', 'coast', 'delta']
const EVENTS: MarketEventId[] = ['festival', 'drought', 'glut']

/** Every unordered pair of the four producers. */
function producerPairs(): [ProducerId, ProducerId][] {
  const out: [ProducerId, ProducerId][] = []
  for (let i = 0; i < ALL_PRODUCER_IDS.length; i++)
    for (let j = i + 1; j < ALL_PRODUCER_IDS.length; j++) out.push([ALL_PRODUCER_IDS[i]!, ALL_PRODUCER_IDS[j]!])
  return out
}

export function dailyMarket(now: Date): DailyMarket {
  const date = dailyDateKey(now)
  const day = Math.floor((Date.parse(`${date}T00:00:00Z`) - DAY_ONE) / DAY_MS)
  const seed = hashDate(`cathnivore-daily-${date}`)
  let rng = createRng(seed ^ 0xda11)
  let pick: number
  ;[pick, rng] = nextInt(rng, producerPairs().length)
  const producers = producerPairs()[pick]!
  ;[pick, rng] = nextInt(rng, EVENTS.length)
  const marketEvent = EVENTS[pick]!
  // The map turns over day by day so a week holds every layout; the ring is dealt fresh types too.
  const layout = LAYOUT_ORDER[((day % 3) + 3) % 3]!
  const config: GameConfig = {
    producers: [...producers],
    difficulty: 'normal',
    ...layoutConfig(layout, seed, true),
    marketEvent,
    daily: date,
  }
  return { date, number: day + 1, seed, producers, layout, marketEvent, config }
}

// --- Results and streak -------------------------------------------------------------------------------

export const DAILY_KEY = 'cathnivore:daily'

export interface DailyResult {
  won: boolean
  rounds: number
  regions: number
  trust: number
}

export interface DailyRecord {
  results: Record<string, DailyResult>
}

type Store = Pick<Storage, 'getItem' | 'setItem'>

function storeOr(storage?: Store): Store | null {
  if (storage) return storage
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function dailyRecord(storage?: Store): DailyRecord {
  try {
    const raw = JSON.parse(storeOr(storage)?.getItem(DAILY_KEY) ?? '{}') as Partial<DailyRecord>
    const results: Record<string, DailyResult> = {}
    if (raw && typeof raw.results === 'object' && raw.results) {
      for (const [k, v] of Object.entries(raw.results)) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(k) && v && typeof v === 'object' && typeof (v as DailyResult).won === 'boolean') results[k] = v as DailyResult
      }
    }
    return { results }
  } catch {
    return { results: {} }
  }
}

/** Records the first finished game of a day (replays of the same day never overwrite it). */
export function recordDaily(date: string, result: DailyResult, storage?: Store): boolean {
  const rec = dailyRecord(storage)
  if (rec.results[date]) return false
  // Keep the last 60 days only.
  const keys = Object.keys(rec.results).sort().slice(-59)
  const results: Record<string, DailyResult> = {}
  for (const k of keys) results[k] = rec.results[k]!
  results[date] = result
  try {
    storeOr(storage)?.setItem(DAILY_KEY, JSON.stringify({ results }))
  } catch {
    return false
  }
  return true
}

function prevDay(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) - DAY_MS).toISOString().slice(0, 10)
}

/** Days in a row won, ending today (or yesterday, if today isn't played yet). */
export function dailyStreak(today: string, rec: DailyRecord): number {
  let d = rec.results[today] ? today : prevDay(today)
  let n = 0
  while (rec.results[d]?.won) {
    n++
    d = prevDay(d)
  }
  return n
}

/** The share text: the day, the outcome, the regions as a row of squares, and the streak. */
export function dailyShareText(daily: Pick<DailyMarket, 'number' | 'layout'>, result: DailyResult, streak: number, layoutName: string): string {
  const squares = '🟩'.repeat(result.regions) + '⬜'.repeat(Math.max(0, 5 - result.regions))
  const outcome = result.won ? `Marrow liberated in ${result.rounds} rounds` : `Marrow held out (round ${result.rounds})`
  const streakLine = streak > 0 ? ` · streak ${streak}` : ''
  return `Cathnivore Daily Market #${daily.number} · ${layoutName}\n${squares}\n${outcome}, Trust ${result.trust}${streakLine}\ncathnivore.com/cathnivore/`
}
