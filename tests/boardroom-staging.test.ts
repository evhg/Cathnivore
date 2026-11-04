import { describe, expect, it } from 'vitest'
import { createGame } from '../src/engine/state'
import { applyAction, legalActions } from '../src/engine/actions'
import { enemyTurnEvents } from '../src/ui/enemyTurnLog'
import { stagedRegions } from '../src/ui/boardroom'
import type { GameConfig, GameEvent, GameState, RegionId, RegionState } from '../src/engine/types'

// Plan item 92: during the enemy turn the map shows each step's change only once that step plays.
const pieces = (r: RegionState) => r.outlets + r.buyouts + r.doubt + r.lostLand
const total = (regions: Record<RegionId, RegionState>) => Object.values(regions).reduce((n, r) => n + pieces(r), 0)

describe('stagedRegions', () => {
  it('rewinds the steps not yet played, exactly, and shows the end state after the last', () => {
    const base = createGame({ producers: ['mara'], difficulty: 'normal', activeRegions: ['kingsmarket', 'highmoor', 'saltmarsh'] }, 7)
    const before = base.regions
    const h = before.highmoor
    const after = {
      ...before,
      highmoor: { ...h, outlets: h.outlets + 2, doubt: h.doubt + 1, lostLand: h.lostLand + 1 },
    }
    const events: GameEvent[] = [
      { type: 'agenda', cardId: 'h1', bonusSkipped: false },
      { type: 'scout', region: 'highmoor', doubtAdded: true },
      { type: 'expand', region: 'highmoor', piece: 'outlet' },
      { type: 'squeeze', region: 'highmoor', lostLand: true, stallRemoved: false, trustLoss: 0 },
    ]
    expect(stagedRegions(before, after, events, 0).highmoor).toMatchObject({ outlets: h.outlets, doubt: h.doubt, lostLand: h.lostLand })
    expect(stagedRegions(before, after, events, 2).highmoor).toMatchObject({ outlets: h.outlets + 1, doubt: h.doubt + 1, lostLand: h.lostLand })
    expect(stagedRegions(before, after, events, 3).highmoor).toMatchObject({ outlets: h.outlets + 2, lostLand: h.lostLand })
    expect(stagedRegions(before, after, events, 4)).toBe(after)
    // The inputs are never mutated.
    expect(after.highmoor.outlets).toBe(h.outlets + 2)
  })

  it('puts a squeezed-out Stall back until its step plays', () => {
    const base = createGame({ producers: ['mara', 'ines'], difficulty: 'normal', activeRegions: ['kingsmarket', 'highmoor'] }, 3)
    const before = { ...base.regions, highmoor: { ...base.regions.highmoor, stalls: { mara: 2, ines: 1 } } }
    const after = { ...before, highmoor: { ...before.highmoor, stalls: { mara: 1, ines: 1 } } }
    const events: GameEvent[] = [{ type: 'squeeze', region: 'highmoor', lostLand: false, stallRemoved: true, trustLoss: 0 }]
    expect(stagedRegions(before, after, events, 0).highmoor.stalls).toEqual({ mara: 2, ines: 1 })
    expect(stagedRegions(before, after, events, 1).highmoor.stalls).toEqual({ mara: 1, ines: 1 })
  })

  it('over real enemy turns, grows step by step from no more than the start to the end state', () => {
    const config: GameConfig = {
      producers: ['mara'],
      difficulty: 'normal',
      activeRegions: ['kingsmarket', 'brindleHills', 'highmoor', 'saltmarsh', 'rivermead', 'shingleBay', 'oakvale'],
    }
    let turns = 0
    for (const seed of [1, 2, 3, 4, 5]) {
      let state: GameState = createGame(config, seed)
      for (let i = 0; i < 60 && !state.result; i++) {
        const before = state
        const options = legalActions(before)
        const action = options.find((a) => a.kind === 'graft') ?? options[0]!
        state = applyAction(before, action)
        const events = enemyTurnEvents(before, state)
        if (events.length === 0) continue
        turns++
        let last = -1
        for (let shown = 0; shown <= events.length; shown++) {
          const staged = stagedRegions(before.regions, state.regions, events, shown)
          const n = total(staged)
          expect(n).toBeGreaterThanOrEqual(last)
          last = n
          for (const id of Object.keys(staged) as RegionId[]) expect(pieces(staged[id])).toBeLessThanOrEqual(pieces(state.regions[id]))
        }
        expect(last).toBe(total(state.regions))
      }
    }
    expect(turns).toBeGreaterThan(5)
  })
})
