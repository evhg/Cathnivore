// Saved progress for Runnel: the game in progress for each mode, daily results, and stats. Everything is
// kept in localStorage under one key; any storage failure (private browsing, quota) degrades to an
// in-memory copy so the game still plays.

export type Size = 'small' | 'medium' | 'large'

export const SIZE_RADIUS: Record<Size, number> = { small: 2, medium: 3, large: 4 }

export interface SavedGame {
  /** `daily-YYYY-MM-DD` or `practice-<size>-<random>`. */
  seed: string
  radius: number
  rots: number[]
  locks: number[]
  taps: number
  elapsedMs: number
  solved: boolean
}

export interface DailyResult {
  number: number
  timeMs: number
  taps: number
  par: number
}

export interface SaveData {
  version: 1
  daily: Record<string, SavedGame>
  practice: Partial<Record<Size, SavedGame>>
  results: Record<string, DailyResult>
  bestPractice: Partial<Record<Size, number>>
  practiceSolved: number
  seenHelp: boolean
}

const KEY = 'runnel:v1'

function empty(): SaveData {
  return { version: 1, daily: {}, practice: {}, results: {}, bestPractice: {}, practiceSolved: 0, seenHelp: false }
}

let memory: SaveData | null = null

export function load(): SaveData {
  if (memory) return memory
  let data = empty()
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SaveData>
      if (parsed && parsed.version === 1) data = { ...data, ...parsed }
    }
  } catch {
    // Unreadable or blocked storage: start fresh in memory.
  }
  memory = data
  return data
}

export function save(data: SaveData): void {
  memory = data
  // Keep only the last 14 days of in-progress dailies so the save never grows without limit.
  const days = Object.keys(data.daily).sort()
  for (const day of days.slice(0, Math.max(0, days.length - 14))) delete data.daily[day]
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // Storage full or blocked; the in-memory copy still works for this visit.
  }
}

export interface Stats {
  played: number
  streak: number
  maxStreak: number
  averageMs: number | null
}

function previousDay(day: string): string {
  const t = Date.parse(`${day}T00:00:00Z`) - 86_400_000
  return new Date(t).toISOString().slice(0, 10)
}

/** Daily stats. The streak counts consecutive solved days ending today or yesterday. */
export function dailyStats(data: SaveData, today: string): Stats {
  const days = Object.keys(data.results).sort()
  let maxStreak = 0
  let run = 0
  let prev = ''
  for (const day of days) {
    run = prev && previousDay(day) === prev ? run + 1 : 1
    maxStreak = Math.max(maxStreak, run)
    prev = day
  }
  let streak = 0
  let cursor = data.results[today] ? today : previousDay(today)
  while (data.results[cursor]) {
    streak++
    cursor = previousDay(cursor)
  }
  const times = days.map((d) => data.results[d]!.timeMs)
  const averageMs = times.length ? times.reduce((a, b) => a + b, 0) / times.length : null
  return { played: days.length, streak, maxStreak, averageMs }
}

export function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
