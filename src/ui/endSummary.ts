// Plan item 8 (2026-11-01): what the end screen says about the game just played. The engine keeps no per-round
// history, so it is rebuilt by replaying the game's own action log from its seed (the same replay a save load
// uses): a Public Trust and Lost Land reading at the end of every round, the play of the game, and a grade that
// is judged against the difficulty it was played on.
import { applyAction, createGame } from '../engine/api'
import { REGIONS } from '../content/map'
import { PRODUCERS } from '../content/producers'
import { SCHEMES_BY_ID } from '../content/schemes'
import type { GameState, GameEvent } from '../engine/types'

export interface RoundPoint {
  round: number
  trust: number
  /** Land the corporations have taken so far (the pool's start size minus what is left). */
  lostLand: number
}

export interface PlayOfTheGame {
  round: number
  title: string
  line: string
}

export interface EndSummary {
  rounds: RoundPoint[]
  /** Where each loss track ends the game (Trust at 0, Lost Land at the pool's size). */
  lostLandLimit: number
  trustStart: number
  play: PlayOfTheGame | null
  grade: Grade
}

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D'

type Timed = { round: number; event: GameEvent }

/** Replays `final`'s action log from `seed`, reading the two loss tracks at each round's end. */
export function replayRounds(final: GameState, seed: number): { rounds: RoundPoint[]; events: Timed[]; pool: number; trustStart: number } {
  let s = createGame(final.config, seed)
  const pool = s.lostLandPool
  const trustStart = s.publicTrust
  const rounds: RoundPoint[] = [{ round: 0, trust: s.publicTrust, lostLand: 0 }]
  const events: Timed[] = []
  let seen = s.log.length
  for (const action of final.actionHistory) {
    if (s.result) break
    const round = s.round
    try {
      s = applyAction(s, action)
    } catch {
      break // a log that no longer replays (an old save) just ends the chart where it stops
    }
    for (const event of s.log.slice(seen)) events.push({ round, event })
    seen = s.log.length
    if (s.round !== round || s.result) rounds.push({ round, trust: Math.max(0, s.publicTrust), lostLand: pool - s.lostLandPool })
  }
  return { rounds, events, pool, trustStart }
}

/** The single moment worth retelling: taking Kingsmarket, else the last liberation, else the costliest Scheme. */
export function playOfTheGame(events: Timed[]): PlayOfTheGame | null {
  const libs = events.filter((t): t is { round: number; event: Extract<GameEvent, { type: 'liberated' }> } => t.event.type === 'liberated')
  const capital = libs.find((t) => t.event.region === 'kingsmarket')
  const lib = capital ?? libs[libs.length - 1]
  if (lib) {
    const who = PRODUCERS[lib.event.producer].name.split(' ')[0]
    const where = REGIONS[lib.event.region].name
    return {
      round: lib.round,
      title: capital ? `${where} falls` : `${where} liberated`,
      line: capital
        ? `${who} broke the capital in round ${lib.round}. The Kingsmarket stalls opened for the first time in a generation.`
        : `${who} cleared the last Outlet out of ${where} in round ${lib.round}${libs.length > 1 ? `, the ${ordinal(libs.length)} region back in local hands` : ''}.`,
    }
  }
  const schemes = events.filter((t): t is { round: number; event: Extract<GameEvent, { type: 'schemePlayed' }> } => t.event.type === 'schemePlayed')
  const best = schemes.reduce<(typeof schemes)[number] | null>((a, t) => {
    const cost = SCHEMES_BY_ID.get(t.event.schemeId)?.cost ?? 0
    return !a || cost > (SCHEMES_BY_ID.get(a.event.schemeId)?.cost ?? 0) ? t : a
  }, null)
  if (best) {
    const who = PRODUCERS[best.event.producer].name.split(' ')[0]
    const name = SCHEMES_BY_ID.get(best.event.schemeId)?.name ?? 'a Scheme'
    const where = best.event.target ? ` on ${REGIONS[best.event.target].name}` : ''
    return { round: best.round, title: name, line: `${who} played ${name}${where} in round ${best.round}. Marrow noticed.` }
  }
  return null
}

const ordinal = (n: number) => (['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh'][n - 1] ?? `${n}th`)

/**
 * The grade is judged per difficulty: a win on Easy earns what a close loss on Hard does. Points are 10 per region
 * liberated, 30 for the win and 2 per Public Trust left, less 1 per round taken; each difficulty sets its own bar.
 */
export function gradeFor(final: GameState): Grade {
  const r = final.result!
  const pts = r.regionsLiberated * 10 + (r.won ? 30 : 0) + Math.max(0, final.publicTrust) * 2 - r.round
  const bars = GRADE_BARS[final.config.difficulty]
  return pts >= bars[0] ? 'S' : pts >= bars[1] ? 'A' : pts >= bars[2] ? 'B' : pts >= bars[3] ? 'C' : 'D'
}

/** Points needed for S, A, B and C on each difficulty. */
export const GRADE_BARS: Record<GameState['config']['difficulty'], [number, number, number, number]> = {
  easy: [100, 90, 70, 40],
  normal: [92, 80, 60, 32],
  hard: [84, 72, 50, 26],
}

export function endSummary(final: GameState, seed: number): EndSummary {
  const { rounds, events, pool, trustStart } = replayRounds(final, seed)
  return { rounds, lostLandLimit: pool, trustStart, play: playOfTheGame(events), grade: gradeFor(final) }
}
