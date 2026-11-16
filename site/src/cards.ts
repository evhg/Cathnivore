// Plan item 13: each game card's status line (what is on today, the same for every visitor) and its
// "continue" chip (read from that game's own save, empty for a first visit). Pure: storage, the clock and
// today's Runnel par come in as arguments, so every line is unit-tested (tests/site-cards.test.ts).

import { dayOf, dailyRule } from '../../games/hedgerow/src/dailyrule'

export type GameId = 'cathnivore' | 'runnel' | 'hedgerow' | 'nightshift'

export interface CardLines {
  status: string
  /** Empty when there is nothing to continue. */
  resume: string
}

const CHAPTER_COUNT = 6

function readJson(storage: Pick<Storage, 'getItem'>, key: string): unknown {
  try {
    const raw = storage.getItem(key)
    return raw ? (JSON.parse(raw) as unknown) : null
  } catch {
    return null
  }
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

/** Consecutive solved days ending today (or yesterday, when today is not solved yet). */
export function runnelStreak(results: Record<string, unknown>, today: string): number {
  const prev = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
  let cursor = results[today] ? today : prev(today)
  let streak = 0
  while (results[cursor] && streak < 3650) {
    streak++
    cursor = prev(cursor)
  }
  return streak
}

export function cardLines(storage: Pick<Storage, 'getItem'>, now: Date, runnelPar?: number): Record<GameId, CardLines> {
  const today = now.toISOString().slice(0, 10)

  // Cathnivore: a game in progress, or how far the story has got.
  const cn = obj(readJson(storage, 'cathnivore:save:v1'))
  const camp = obj(readJson(storage, 'cathnivore:campaign:v1'))
  const chapters = Array.isArray(camp.completed) ? new Set(camp.completed.filter((c) => typeof c === 'string')).size : 0
  const inGame = Array.isArray(cn.actions) && cn.actions.length > 0
  const cathnivore: CardLines = {
    status:
      chapters >= CHAPTER_COUNT
        ? 'Story finished · Quick games against the bot'
        : chapters > 0
          ? `Story: chapter ${chapters + 1} of ${CHAPTER_COUNT} next`
          : `${CHAPTER_COUNT} story chapters · Solo or co-op`,
    resume: inGame ? (typeof cn.chapterId === 'string' ? 'Continue your chapter' : 'Continue your game') : '',
  }

  // Runnel: today's par, then today's result or the streak.
  const rn = obj(readJson(storage, 'runnel:v1'))
  const results = obj(rn.results)
  const daily = obj(rn.daily)
  const solved = obj(results[today])
  const streak = runnelStreak(results, today)
  const runnel: CardLines = {
    status: runnelPar ? `Today's Runnel: ${runnelPar} taps par` : "Today's Runnel is ready",
    resume: results[today]
      ? `Solved today${typeof solved.taps === 'number' ? ` in ${solved.taps} taps` : ''}${streak > 1 ? ` · ${streak}-day streak` : ''}`
      : daily[today]
        ? "Finish today's board"
        : streak > 0
          ? `Keep your ${streak}-day streak`
          : '',
  }

  // Hedgerow: today's daily rule; the next story level and the stars so far.
  const hg = obj(readJson(storage, 'hedgerow:v1'))
  const stars = Object.entries(obj(hg.stars)).filter(([, n]) => typeof n === 'number' && n >= 1)
  const starCount = stars.reduce((a, [, n]) => a + Math.min(3, n as number), 0)
  const furthest = stars.reduce((a, [id]) => Math.max(a, Number(id) || 0), 0)
  const day = dayOf(now.getTime())
  const best = obj(hg.daily)[String(day)]
  const hedgerow: CardLines = {
    status: `Today's daily: ${dailyRule(day).name}${typeof best === 'number' ? ` · your best ${best}` : ''}`,
    resume: stars.length > 0 ? `Continue · level ${Math.min(100, furthest + 1)} · ${starCount} stars` : '',
  }

  // NIGHT SHIFT: a checkpoint to go back to, and the jobs done.
  const ns = obj(readJson(storage, 'cathode.save'))
  const jobs = Array.isArray(ns.jobsDone) ? ns.jobsDone.length : 0
  const nightshift: CardLines = {
    status: jobs > 0 ? `${jobs} ${jobs === 1 ? 'job' : 'jobs'} done · Five names on The List` : 'Five names on The List',
    resume: ns.checkpoint ? 'Continue the job' : jobs > 0 ? 'Take the next job' : '',
  }

  return { cathnivore, runnel, hedgerow, nightshift }
}

/** Plan item 452: one game's tag on today's market board. */
export interface TodayTag {
  game: GameId
  /** Today's daily is played (NIGHT SHIFT has no daily: always false). */
  done: boolean
  label: string
}

/** Plan item 452: today's market board: a tag per game, the last seven days (oldest first, any daily played),
 *  the run of days with a daily played ending today (or yesterday while today is still open), and a pennant at 3+. */
export interface TodayBoard {
  tags: TodayTag[]
  week: boolean[]
  streak: number
  pennant: boolean
  /** Anything to remember: false on a first visit (the board stays hidden). */
  any: boolean
}

export function todayBoard(storage: Pick<Storage, 'getItem'>, now: Date): TodayBoard {
  const iso = (t: number) => new Date(t).toISOString().slice(0, 10)
  const rn = obj(obj(readJson(storage, 'runnel:v1')).results)
  const hg = obj(obj(readJson(storage, 'hedgerow:v1')).daily)
  const cn = obj(obj(readJson(storage, 'cathnivore:daily')).results)
  const ns = obj(readJson(storage, 'cathode.save'))
  const played = (t: number): boolean => {
    const d = iso(t)
    return !!rn[d] || typeof hg[String(dayOf(t))] === 'number' || !!cn[d]
  }
  const t0 = Date.parse(`${iso(now.getTime())}T12:00:00Z`)
  const today = iso(t0)
  const solved = obj(rn[today])
  const jobs = Array.isArray(ns.jobsDone) ? Math.min(5, ns.jobsDone.length) : 0
  const tags: TodayTag[] = [
    { game: 'runnel', done: !!rn[today], label: rn[today] ? `Solved${typeof solved.taps === 'number' ? ` in ${solved.taps}` : ''}` : 'Runnel to play' },
    { game: 'hedgerow', done: typeof hg[String(dayOf(t0))] === 'number', label: typeof hg[String(dayOf(t0))] === 'number' ? `Daily: best ${hg[String(dayOf(t0))] as number}` : 'Hedgerow daily to play' },
    { game: 'cathnivore', done: !!cn[today], label: cn[today] ? (obj(cn[today]).won ? 'Market won' : 'Market played') : 'Daily Market to play' },
    { game: 'nightshift', done: false, label: `${jobs} of 5 names crossed off` },
  ]
  const week = Array.from({ length: 7 }, (_, i) => played(t0 - (6 - i) * 86_400_000))
  let cursor = played(t0) ? t0 : t0 - 86_400_000
  let streak = 0
  while (played(cursor) && streak < 3650) {
    streak++
    cursor -= 86_400_000
  }
  return { tags, week, streak, pennant: streak >= 3, any: week.some(Boolean) || jobs > 0 }
}
