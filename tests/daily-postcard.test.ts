import { describe, expect, it } from 'vitest'
import { createGame } from '../src/engine/state'
import { applyAction } from '../src/engine/actions'
import { createRng } from '../src/engine/rng'
import { HeuristicBot } from '../src/ai/heuristic'
import { dailyMarket } from '../src/content/daily'
import { LAYOUTS, placedLayout } from '../src/content/layouts'
import { endSummary } from '../src/ui/endSummary'
import { postcardData, postcardVerdict } from '../src/ui/dailyPostcard'
import type { GameState } from '../src/engine/types'

// Plan item 484: the Daily's postcard says what the end screen says, and draws the board the game drew.
function finishedDaily(date: string): { state: GameState; seed: number; number: number } {
  const d = dailyMarket(new Date(`${date}T12:00:00Z`))
  let state = createGame(d.config, d.seed)
  let rng = createRng(d.seed * 104729 + 1)
  for (let step = 0; step < 600 && !state.result; step++) {
    const [action, next] = HeuristicBot.chooseAction(state, rng)
    rng = next
    state = applyAction(state, action)
  }
  expect(state.result).toBeTruthy()
  return { state, seed: d.seed, number: d.number }
}

// Three consecutive days: the ring, the Long Coast and the Delta each come round once.
const DATES = ['2026-11-16', '2026-11-17', '2026-11-18']

describe('the Daily postcard (plan item 484)', () => {
  it("its numbers are the end screen's", () => {
    for (const date of DATES) {
      const { state, seed, number } = finishedDaily(date)
      const summary = endSummary(state, seed)
      const d = postcardData(state, { number, streak: 2, layoutName: 'x' }, summary.grade)
      expect(d.number).toBe(number)
      expect(d.grade).toBe(summary.grade)
      expect(d.won).toBe(state.result!.won)
      expect(d.rounds).toBe(state.result!.round)
      expect(d.rounds).toBe(summary.rounds[summary.rounds.length - 1]!.round)
      expect(d.regions).toBe(state.result!.regionsLiberated)
      expect(d.regions).toBe(d.hexes.filter((h) => h.freed).length)
      expect(Math.max(0, d.trust)).toBe(summary.rounds[summary.rounds.length - 1]!.trust)
      expect(d.verdict).toBe(postcardVerdict(d.won, 2, d.trust))
    }
  })

  it('draws every region of the board, where the board puts it', () => {
    const layouts = new Set<string>()
    for (const date of DATES) {
      const { state } = finishedDaily(date)
      const d = postcardData(state, { number: 1, streak: 0, layoutName: 'x' }, 'B')
      const layout = placedLayout(state.config.layout ?? 'ring', state.config.placement)
      layouts.add(layout.id)
      expect(d.hexes.map((h) => h.id).sort()).toEqual([...state.config.activeRegions].sort())
      for (const h of d.hexes) {
        const [q, r] = layout.hexes[h.id] ?? LAYOUTS.ring.hexes[h.id]!
        expect(h.x).toBeCloseTo(Math.sqrt(3) * (q + r / 2))
        expect(h.y).toBeCloseTo(1.5 * r)
      }
      // no two hexes on one spot
      expect(new Set(d.hexes.map((h) => `${h.x.toFixed(2)},${h.y.toFixed(2)}`)).size).toBe(d.hexes.length)
    }
    expect(layouts.size).toBe(3)
  })
})
