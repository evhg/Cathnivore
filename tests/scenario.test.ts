import { describe, expect, it } from 'vitest'
import { createGame } from '../src/engine/api'
import { applyAction, legalActions } from '../src/engine/actions'
import { resolveRules, DEFAULT_RULES } from '../src/engine/rules'
import { runEnemyTurn } from '../src/engine/enemy'
import type { GameConfig } from '../src/engine/types'

// SPEC 8.1's scenario-system building blocks (GameConfig.rulesEnabled/scriptedPressure/winCondition),
// tested directly rather than only indirectly through a specific chapter (tests/chapters.test.ts).

const BASE_CONFIG: GameConfig = {
  producers: ['mara'],
  difficulty: 'normal',
  activeRegions: ['brindleHills', 'highmoor'],
}

describe('rulesEnabled (SPEC 8.1)', () => {
  it('defaults to the full game when absent from config', () => {
    const state = createGame(BASE_CONFIG, 1)
    expect(resolveRules(state)).toEqual(DEFAULT_RULES)
  })

  it('a disabled rule never appears in legalActions, even when it would otherwise be legal', () => {
    const config: GameConfig = {
      ...BASE_CONFIG,
      rulesEnabled: { ...DEFAULT_RULES, sell: false, improvements: false, schemes: false, roles: false, rebut: false },
    }
    const state = createGame(config, 1)
    const kinds = new Set(legalActions(state).map((a) => a.kind))
    for (const forbidden of ['sell', 'invest', 'scheme', 'role', 'rebut'] as const) {
      expect(kinds.has(forbidden)).toBe(false)
    }
    // Open Stall/Supply/Graft, none of which rulesEnabled gates, must still be offered.
    expect(kinds.has('graft')).toBe(true)
  })

  it('disabling agenda/squeeze/expand skips those enemy-turn steps entirely', () => {
    const config: GameConfig = {
      ...BASE_CONFIG,
      producers: ['mara', 'tomas'],
      activeRegions: ['brindleHills', 'oakvale'],
      rulesEnabled: { ...DEFAULT_RULES, agenda: false, squeeze: false, expand: false },
    }
    let state = createGame(config, 1)
    // Force both producers through a full round of Graft so the enemy turn actually runs.
    for (let i = 0; i < 6; i++) {
      const graft = legalActions(state).find((a) => a.kind === 'graft')!
      state = applyAction(state, graft)
    }
    expect(state.currentAgenda).toBeNull()
    expect(state.log.some((e) => e.type === 'agenda')).toBe(false)
    expect(state.log.some((e) => e.type === 'squeeze')).toBe(false)
    expect(state.log.some((e) => e.type === 'expand')).toBe(false)
    // Scout still runs even with everything else off.
    expect(state.log.some((e) => e.type === 'scout')).toBe(true)
  })
})

describe('scriptedPressure and PressureCard.regions (SPEC 8.1)', () => {
  it('uses the scripted deck verbatim instead of the shuffled one', () => {
    const scripted = [{ id: 'only-card', stage: 1 as const, regionTypes: [], regions: ['brindleHills' as const] }]
    const config: GameConfig = { ...BASE_CONFIG, scriptedPressure: scripted }
    const state = createGame(config, 1)
    // The single scripted card is consumed by the setup-time Scout reveal, leaving an empty deck.
    expect(state.pressureDeck).toEqual([])
  })

  it('a region-targeted card matches only its listed regions, regardless of type', () => {
    const config: GameConfig = {
      ...BASE_CONFIG,
      scriptedPressure: [
        { id: 'setup', stage: 1, regionTypes: [], regions: ['brindleHills'] },
        { id: 'r1', stage: 1, regionTypes: [], regions: ['brindleHills'] },
      ],
    }
    let state = createGame(config, 1)
    const before = { brindleHills: state.regions.brindleHills.outlets, highmoor: state.regions.highmoor.outlets }
    state = runEnemyTurn(state)
    // Only brindleHills (the scripted target) gained an Outlet from Scout; highmoor, untargeted, didn't.
    expect(state.regions.brindleHills.outlets).toBe(before.brindleHills + 1)
    expect(state.regions.highmoor.outlets).toBe(before.highmoor)
  })
})

describe('scriptedMarket and scriptedTrigger (SPEC 8.1/8.2 ch3 twist)', () => {
  const contractConfig: GameConfig = {
    ...BASE_CONFIG,
    rulesEnabled: { ...DEFAULT_RULES, agenda: false, squeeze: false, expand: false },
    // Scout isn't one of `rulesEnabled`'s gates, so without this the real shuffled Pressure deck would
    // still add its own Outlets to brindleHills (a Pasture region) independently of the contract effect
    // under test — scripting every card at highmoor instead keeps brindleHills' Outlet count isolated.
    scriptedPressure: Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, stage: 1 as const, regionTypes: [], regions: ['highmoor' as const] })),
    scriptedMarket: ['wholesome-hollow-contract'],
    scriptedTrigger: { round: 2, effect: 'wholesomeHollowReveal', sceneId: 'twist' },
  }

  it('seeds the given ids into the opening Market ahead of the shuffled draw', () => {
    const state = createGame(contractConfig, 1)
    expect(state.market[0]).toBe('wholesome-hollow-contract')
    expect(state.market.slice(1).every((id) => id !== null)).toBe(true)
  })

  it('does nothing until the configured round, then fires once and logs a trigger event', () => {
    let state = createGame(contractConfig, 1)
    expect(state.wholesomeHollowRevealed).toBe(false)
    // Round 1: Graft through to Cleanup (round becomes 2, the configured trigger round).
    for (let i = 0; i < 3; i++) state = applyAction(state, legalActions(state).find((a) => a.kind === 'graft')!)
    expect(state.round).toBe(2)
    expect(state.wholesomeHollowRevealed).toBe(true)
    expect(state.log.filter((e) => e.type === 'trigger')).toEqual([{ type: 'trigger', effect: 'wholesomeHollowReveal', sceneId: 'twist' }])
    // Round 2 -> 3: the trigger doesn't fire again.
    for (let i = 0; i < 3; i++) state = applyAction(state, legalActions(state).find((a) => a.kind === 'graft')!)
    expect(state.log.filter((e) => e.type === 'trigger')).toHaveLength(1)
  })

  it('adds 1 Outlet to the owner’s home region per owned contract at the start of every round once revealed, until torn up', () => {
    let state = createGame(contractConfig, 1)
    const buy = () => applyAction(state, legalActions(state).find((a) => a.kind === 'invest' && a.improvementId === 'wholesome-hollow-contract')!)
    state = buy()
    for (let i = 0; i < 2; i++) state = applyAction(state, legalActions(state).find((a) => a.kind === 'graft')!)
    expect(state.round).toBe(2)
    const outletsAtReveal = state.regions.brindleHills.outlets
    // One more full round with no Supply: the owned contract should add exactly 1 Outlet at round 3's start.
    for (let i = 0; i < 3; i++) state = applyAction(state, legalActions(state).find((a) => a.kind === 'graft')!)
    expect(state.round).toBe(3)
    expect(state.regions.brindleHills.outlets).toBe(outletsAtReveal + 1)

    const tearUp = legalActions(state).find((a) => a.kind === 'tearUpContract')
    expect(tearUp).toBeDefined()
    const marksBefore = state.producers.mara.resources.marks
    const productionBefore = state.producers.mara.production.marks
    state = applyAction(state, tearUp!)
    expect(state.producers.mara.improvements.includes('wholesome-hollow-contract')).toBe(false)
    expect(state.producers.mara.resources.marks).toBe(marksBefore - 3)
    expect(state.producers.mara.production.marks).toBe(productionBefore - 2)
    expect(legalActions(state).some((a) => a.kind === 'tearUpContract')).toBe(false)

    const outletsAfterTearUp = state.regions.brindleHills.outlets
    for (let i = 0; i < 3; i++) state = applyAction(state, legalActions(state).find((a) => a.kind === 'graft')!)
    expect(state.round).toBe(4)
    // No more owned contracts, so no further Outlets get added.
    expect(state.regions.brindleHills.outlets).toBe(outletsAfterTearUp)
  })
})

describe('winCondition (SPEC 8.1)', () => {
  it('a chapter can win with fewer regions and without Kingsmarket', () => {
    const config: GameConfig = { ...BASE_CONFIG, winCondition: { regionsRequired: 1, requireKingsmarket: false } }
    let state = createGame(config, 1)
    // Clear brindleHills (Mara's home, already has 2 Stalls) of its single starting Outlet to liberate it,
    // then keep playing (win is only checked at the next Cleanup, SPEC 4.5.4) until the result appears.
    for (let i = 0; i < 20 && !state.result; i++) {
      const supply = !state.regions.brindleHills.liberated ? legalActions(state).find((a) => a.kind === 'supplyOutlets') : undefined
      const action = supply ?? legalActions(state).find((a) => a.kind === 'graft')!
      state = applyAction(state, action)
    }
    expect(state.result?.won).toBe(true)
    expect(state.result?.regionsLiberated).toBe(1)
  })
})
