// Cath's Week (ROADMAP 231): three goals, one per game, counted from what the saves already hold.
// The first visit of a week stores a baseline of the counts (`cath:week`); a goal is the growth since then.
// Finishing all three pins that week's postcard (`cath:postcards`). Pure rules plus tiny storage helpers.

import type { WardrobeProgress } from './wardrobe'

export interface WeekGoal {
  id: 'runnel' | 'hedgerow' | 'nightshift'
  game: string
  text: string
  need: number
  done: number
  href: string
}

export interface WeekState {
  week: string
  base: WardrobeProgress
}

/** ISO-style week id such as `2026-W44` (UTC, Monday start). */
export function weekId(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const y = t.getUTCFullYear()
  const w = Math.ceil(((t.getTime() - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7)
  return `${y}-W${String(w).padStart(2, '0')}`
}

const POSTCARDS = [
  'Wish you were here: the kettle is on and the water is running.',
  'The hedge held. So did the tea.',
  'Market day: everything fresh, nothing wasted.',
  'Back late, muddy boots, very pleased with myself.',
]

/** One postcard line per week, stable for that week id. */
export function postcardFor(week: string): string {
  let h = 0
  for (const c of week) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return POSTCARDS[h % POSTCARDS.length]!
}

export function weekGoals(now: WardrobeProgress, base: WardrobeProgress): WeekGoal[] {
  const grow = (a: number, b: number): number => Math.max(0, a - b)
  return [
    { id: 'runnel', game: 'Runnel', text: 'Solve 3 dailies', need: 3, done: grow(now.runnelDays, base.runnelDays), href: '/runnel/' },
    { id: 'hedgerow', game: 'Hedgerow', text: 'Clear 3 new levels', need: 3, done: grow(now.hedgerowLevels, base.hedgerowLevels), href: '/hedgerow/' },
    { id: 'nightshift', game: 'NIGHT SHIFT', text: 'Close a case', need: 1, done: grow(now.nightJobs, base.nightJobs), href: '/cathode/' },
  ]
}

export const weekComplete = (goals: WeekGoal[]): boolean => goals.every((g) => g.done >= g.need)

const BASE_KEY = 'cath:week'
const CARDS_KEY = 'cath:postcards'

/** Load the baseline for this week, creating it on the first visit. */
export function loadWeek(
  now: WardrobeProgress,
  today: Date,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
): WeekState {
  const week = weekId(today)
  try {
    const s = JSON.parse(storage.getItem(BASE_KEY) ?? 'null') as WeekState | null
    if (s && s.week === week && s.base) return s
    const fresh = { week, base: now }
    storage.setItem(BASE_KEY, JSON.stringify(fresh))
    return fresh
  } catch {
    return { week, base: now }
  }
}

export function postcards(storage: Pick<Storage, 'getItem'> = localStorage): string[] {
  try {
    const v = JSON.parse(storage.getItem(CARDS_KEY) ?? '[]') as unknown
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/** Pin this week's postcard once; returns the full list. */
export function pinPostcard(week: string, storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage): string[] {
  const have = postcards(storage)
  if (have.includes(week)) return have
  const next = [...have, week].slice(-52)
  try {
    storage.setItem(CARDS_KEY, JSON.stringify(next))
  } catch {
    // Blocked storage: it shows this visit only.
  }
  return next
}
