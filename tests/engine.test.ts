import { describe, expect, it } from 'vitest'
import { createRng, nextFloat, shuffle } from '../src/engine/rng'
import { createGame } from '../src/engine/state'
import { legalActions, applyAction } from '../src/engine/actions'
import { ALL_REGION_IDS } from '../src/content/map'
import type { GameConfig } from '../src/engine/types'

const FULL_CONFIG: GameConfig = {
  producers: ['mara', 'tomas'],
  difficulty: 'normal',
  activeRegions: ALL_REGION_IDS,
}

describe('rng', () => {
  it('is deterministic for a given seed', () => {
    const a = createRng(42)
    const b = createRng(42)
    const [va] = nextFloat(a)
    const [vb] = nextFloat(b)
    expect(va).toBe(vb)
  })

  it('shuffle is a permutation and deterministic', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const [s1] = shuffle(items, createRng(7))
    const [s2] = shuffle(items, createRng(7))
    expect(s1).toEqual(s2)
    expect([...s1].sort((a, b) => a - b)).toEqual(items)
  })
})

describe('createGame', () => {
  it('sets up Normal per SPEC 4.3', () => {
    const state = createGame(FULL_CONFIG, 1)
    expect(state.publicTrust).toBe(10)
    expect(state.rift).toBe(0)
    expect(state.lostLandPool).toBe(10)
    expect(state.round).toBe(1)
    expect(state.regions.kingsmarket.buyouts).toBe(1)
    expect(state.regions.kingsmarket.doubt).toBe(2)
    // 2 base outlets + at least 1 from the initial Scout resolution if it matched Kingsmarket.
    expect(state.regions.kingsmarket.outlets).toBeGreaterThanOrEqual(2)
    expect(state.regions.brindleHills.stalls.mara).toBe(2)
    expect(state.regions.oakvale.stalls.tomas).toBe(2)
    // Home regions keep their starting Outlet (SPEC 4.3.3).
    expect(state.regions.brindleHills.outlets).toBeGreaterThanOrEqual(1)
  })

  it('is deterministic for a given seed', () => {
    const a = createGame(FULL_CONFIG, 99)
    const b = createGame(FULL_CONFIG, 99)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('every coast region gets a starting Doubt', () => {
    const state = createGame(FULL_CONFIG, 3)
    expect(state.regions.saltmarsh.doubt).toBeGreaterThanOrEqual(1)
    expect(state.regions.shingleBay.doubt).toBeGreaterThanOrEqual(1)
  })

  it('Easy starts with higher Public Trust than Normal and at least as big a Lost Land pool (SPEC 4.9)', () => {
    // SPEC 4.9's table: Easy/Normal/Hard Lost Land pool was originally 10/8/6, but the M4 balance loop
    // tuned Normal's value up (8 -> 11 -> 10 across several iterations, see DECISIONS.md and
    // src/content/difficulty.ts) to fix an under-target Lost Land loss-reason share, leaving Easy and
    // Normal equal at 10 for a while. That left Easy's own SPEC 9.4 win-rate target (70-85%) unmet — a
    // 100-game MCTSBot sim came back at 43.0% — so a later pass widened Easy's pool to 16 (53.0%),
    // then a further pass to 20 (see DECISIONS.md). This test only asserts Easy is never *worse* than
    // Normal, so it doesn't re-drift if the loop moves Normal again without a matching Easy change.
    const easy = createGame({ ...FULL_CONFIG, difficulty: 'easy' }, 1)
    const normal = createGame(FULL_CONFIG, 1)
    expect(easy.publicTrust).toBe(12)
    expect(easy.publicTrust).toBeGreaterThan(normal.publicTrust)
    expect(easy.lostLandPool).toBe(20)
    expect(easy.lostLandPool).toBeGreaterThanOrEqual(normal.lostLandPool)
    // Easy also starts Kingsmarket with 1 fewer Outlet than Normal (1 base, vs. Normal's 2), a pace lever
    // added after a 100-game MCTSBot spot check showed Lost Land had stopped being Easy's bottleneck —
    // see DECISIONS.md. At least 1 from the base setup, possibly +1 more if the initial Scout matched it.
    expect(easy.regions.kingsmarket.outlets).toBeGreaterThanOrEqual(1)
    expect(easy.regions.kingsmarket.outlets).toBeLessThanOrEqual(2)
  })

  it('Hard starts with lower Public Trust, a smaller Lost Land pool, an extra Kingsmarket Outlet and Pasture Doubt (SPEC 4.9)', () => {
    const hard = createGame({ ...FULL_CONFIG, difficulty: 'hard' }, 1)
    expect(hard.publicTrust).toBe(8)
    expect(hard.lostLandPool).toBe(6)
    // 3 base outlets (Normal's 2 + Hard's extra) plus at least 1 from the initial Scout if it matched Kingsmarket.
    expect(hard.regions.kingsmarket.outlets).toBeGreaterThanOrEqual(3)
    expect(hard.regions.highmoor.doubt).toBeGreaterThanOrEqual(1)
    expect(hard.regions.brindleHills.doubt).toBeGreaterThanOrEqual(1)
  })
})

describe('actions', () => {
  it('graft always gains 1 produce and 1 marks', () => {
    const state = createGame(FULL_CONFIG, 5)
    const before = state.producers.mara.resources
    const next = applyAction(state, { kind: 'graft' })
    expect(next.producers.mara.resources.produce).toBe(before.produce + 1)
    expect(next.producers.mara.resources.marks).toBe(before.marks + 1)
    expect(next.actionsLeft).toBe(state.actionsLeft - 1)
  })

  it('graft is always legal (SPEC 4.6.7)', () => {
    const state = createGame(FULL_CONFIG, 5)
    const actions = legalActions(state)
    expect(actions.some((a) => a.kind === 'graft')).toBe(true)
  })

  it('openStall spends 1 Produce and places a Stall', () => {
    const state = createGame(FULL_CONFIG, 5)
    const before = state.producers.mara.resources.produce
    const next = applyAction(state, { kind: 'openStall', region: 'brindleHills' })
    expect(next.producers.mara.resources.produce).toBe(before - 1)
    expect(next.regions.brindleHills.stalls.mara).toBe(3)
  })

  it('throws on an illegal action', () => {
    const state = createGame(FULL_CONFIG, 5)
    expect(() => applyAction(state, { kind: 'supplyBuyout', region: 'kingsmarket' })).toThrow()
  })

  it('never mutates its input state', () => {
    const state = createGame(FULL_CONFIG, 5)
    const before = JSON.stringify(state)
    applyAction(state, { kind: 'graft' })
    expect(JSON.stringify(state)).toBe(before)
  })
})
