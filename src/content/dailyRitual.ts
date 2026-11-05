// Plan item 133: the Daily Market as a ritual on the title table. The last result as a receipt pinned to the
// table's front, the streak as bunting (one pennant a day), tomorrow's market as a face-down card with a
// countdown, and Cath's line and face following the streak. Pure: the title reads it from the daily record.

import type { CathExpression } from '../../shared/cath/cath'
import { dailyDateKey, dailyMarket, dailyStreak, type DailyRecord, type DailyResult } from './daily'
import { plural } from './plural'

export type RitualStatus = 'none' | 'first' | 'kept' | 'broken'

export interface DailyRitual {
  /** The latest finished Daily (today's, if played, else the most recent before it). */
  last: { date: string; number: number; result: DailyResult; today: boolean } | null
  streak: number
  /** Pennants on the bunting: the streak, capped so the string stays one line (the rest as "+N"). */
  pennants: number
  more: number
  status: RitualStatus
  line: string | null
  expression: CathExpression
  /** Tomorrow's Daily number, and the ms until it opens (the Daily turns over at 00:00 UTC). */
  next: number
  nextInMs: number
}

export const MAX_PENNANTS = 10
const DAY_MS = 86_400_000

export function dailyRitual(now: Date, rec: DailyRecord): DailyRitual {
  const today = dailyDateKey(now)
  const todayNo = dailyMarket(now).number
  const dates = Object.keys(rec.results).sort()
  const lastDate = dates[dates.length - 1]
  const streak = dailyStreak(today, rec)
  const numberOf = (date: string) => todayNo + Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS)
  const last = lastDate ? { date: lastDate, number: numberOf(lastDate), result: rec.results[lastDate]!, today: lastDate === today } : null
  const nextInMs = Date.parse(`${today}T00:00:00Z`) + DAY_MS - now.getTime()
  let status: RitualStatus = 'none'
  if (!last) status = 'none'
  else if (streak > 0) status = dates.length === 1 ? 'first' : 'kept'
  else status = 'broken'
  const line =
    status === 'first'
      ? `Our first Daily, sold! Same stall tomorrow: #${todayNo + 1}.`
      : status === 'kept'
        ? `${plural(streak, 'day')} running. Let's not take the bunting down now.`
        : status === 'broken'
          ? last!.today || last!.result.won === false
            ? 'Hollowell had that one. Fresh stall today, fresh start.'
            : 'We missed a market and the bunting came down. Fresh start today.'
          : null
  const expression: CathExpression = status === 'broken' ? 'worried' : status === 'kept' ? 'delighted' : status === 'first' ? 'wink' : 'smirk'
  return {
    last,
    streak,
    pennants: Math.min(streak, MAX_PENNANTS),
    more: Math.max(0, streak - MAX_PENNANTS),
    status,
    line,
    expression,
    next: todayNo + 1,
    nextInMs,
  }
}

/** "5h 12m", or "12m" in the last hour: the countdown on tomorrow's card. */
export function countdownText(ms: number): string {
  const m = Math.max(0, Math.ceil(ms / 60_000))
  const h = Math.floor(m / 60)
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`
}
