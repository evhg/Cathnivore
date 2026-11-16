// Plan item 451: a card dragged over a region shows what it will do (ghost pieces and delta chips). The preview
// must equal the resolved move for every region action type, so it can never promise what the rules don't do.
import { describe, expect, it } from 'vitest'
import { createGame } from '../src/engine/state'
import { applyAction, legalActions } from '../src/engine/actions'
import { actionPreview, actionRegion } from '../src/engine/preview'
import { ALL_REGION_IDS } from '../src/content/map'
import type { Action, GameConfig, GameState } from '../src/engine/types'

const CONFIG: GameConfig = { producers: ['mara', 'tomas'], difficulty: 'normal', activeRegions: ALL_REGION_IDS }

/** Each state met on a random game, with its legal actions. */
function* walk(seed: number): Generator<{ state: GameState; actions: Action[] }> {
  let s = createGame(CONFIG, seed)
  let r = seed * 7919
  for (let i = 0; i < 160 && !s.result; i++) {
    const actions = legalActions(s)
    if (actions.length === 0) break
    yield { state: s, actions }
    r = (r * 1103515245 + 12345) % 2147483648
    s = applyAction(s, actions[r % actions.length]!)
  }
}

describe('actionPreview', () => {
  it('equals the resolved move for every region action type, over 12 seeds', () => {
    const kinds = new Set<string>()
    let checked = 0
    for (let seed = 1; seed <= 12; seed++) {
      for (const { state, actions } of walk(seed)) {
        for (const action of actions) {
          const region = actionRegion(action)
          const p = actionPreview(state, action)
          if (!region) {
            expect(p).toBeUndefined()
            continue
          }
          expect(p, JSON.stringify(action)).toBeDefined()
          const after = applyAction(structuredClone(state), action)
          // A move that hands the turn to Hollowell resolves its turn too; the preview is the move alone, so
          // compare only moves that stay in the round (most of them).
          if (after.round !== state.round || after.result) continue
          const me = state.activeProducer
          const b = state.regions[region]
          const a = after.regions[region]
          expect(p!.regionDelta.stalls).toBe((a.stalls[me] ?? 0) - (b.stalls[me] ?? 0))
          expect(p!.regionDelta.outlets).toBe(a.outlets - b.outlets)
          expect(p!.regionDelta.buyouts).toBe(a.buyouts - b.buyouts)
          expect(p!.regionDelta.doubt).toBe(a.doubt - b.doubt)
          expect(p!.regionDelta.liberated).toBe(a.liberated && !b.liberated)
          expect(p!.produce).toBe(after.producers[me].resources.produce - state.producers[me].resources.produce)
          expect(p!.marks).toBe(after.producers[me].resources.marks - state.producers[me].resources.marks)
          expect(p!.goodwill).toBe(after.producers[me].resources.goodwill - state.producers[me].resources.goodwill)
          expect(p!.trust).toBe(after.publicTrust - state.publicTrust)
          kinds.add(action.kind)
          checked++
        }
      }
    }
    expect(checked).toBeGreaterThan(200)
    for (const k of ['openStall', 'supplyOutlets', 'supplyBuyout', 'rebut']) expect(kinds, k).toContain(k)
  })

  it('names every change as a signed chip, and never an empty preview for a move that changes the board', () => {
    for (const { state, actions } of walk(3)) {
      for (const action of actions) {
        const p = actionPreview(state, action)
        if (!p) continue
        for (const c of p.chips) expect(c.text).toMatch(/^([+−]\d+ \w+|Liberated)$/)
        const d = p.regionDelta
        if (d.stalls || d.outlets || d.buyouts || d.doubt) expect(p.chips.length).toBeGreaterThan(0)
      }
    }
  })
})
