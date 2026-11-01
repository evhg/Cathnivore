import { describe, expect, it } from 'vitest'
import { createGame } from '../src/engine/state'
import { applyAction } from '../src/engine/actions'
import { createRng } from '../src/engine/rng'
import { ALL_REGION_IDS } from '../src/content/map'
import { HeuristicBot } from '../src/ai/heuristic'
import { endSummary, gradeFor, GRADE_BARS } from '../src/ui/endSummary'
import type { GameConfig, GameState } from '../src/engine/types'

// Plan item 8: the end screen's chart, play of the game and grade, rebuilt from the action log.
const CONFIG: GameConfig = { producers: ['mara', 'tomas'], difficulty: 'normal', activeRegions: ALL_REGION_IDS }

function finished(seed: number): GameState {
  let state = createGame(CONFIG, seed)
  let rng = createRng(seed * 104729 + 1)
  for (let step = 0; step < 400 && !state.result; step++) {
    const [action, next] = HeuristicBot.chooseAction(state, rng)
    rng = next
    state = applyAction(state, action)
  }
  expect(state.result).toBeTruthy()
  return state
}

describe('end summary (plan item 8)', () => {
  it('reads both loss tracks once per round, ending where the game ended', () => {
    for (const seed of [1, 2, 3]) {
      const final = finished(seed)
      const s = endSummary(final, seed)
      expect(s.rounds[0]).toEqual({ round: 0, trust: s.trustStart, lostLand: 0 })
      const last = s.rounds[s.rounds.length - 1]!
      expect(last.round).toBe(final.result!.round)
      expect(last.trust).toBe(Math.max(0, final.publicTrust))
      expect(last.lostLand).toBe(s.lostLandLimit - final.lostLandPool)
      // One reading per round, in order.
      expect(s.rounds.map((r) => r.round)).toEqual(s.rounds.map((_, i) => i))
    }
  })

  it('names a play of the game whenever a region was liberated', () => {
    for (const seed of [1, 2, 3, 4]) {
      const final = finished(seed)
      const s = endSummary(final, seed)
      if (final.result!.regionsLiberated > 0) {
        expect(s.play).toBeTruthy()
        expect(s.play!.title).toMatch(/liberated|falls/)
        expect(s.play!.round).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('grades per difficulty: the same game scores higher on Hard than on Easy', () => {
    const final = finished(1)
    const order = ['D', 'C', 'B', 'A', 'S']
    const on = (difficulty: GameConfig['difficulty']) => order.indexOf(gradeFor({ ...final, config: { ...final.config, difficulty } }))
    expect(on('hard')).toBeGreaterThanOrEqual(on('normal'))
    expect(on('normal')).toBeGreaterThanOrEqual(on('easy'))
    for (const bars of Object.values(GRADE_BARS)) expect([...bars].sort((a, b) => b - a)).toEqual(bars)
  })
})
