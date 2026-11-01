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
