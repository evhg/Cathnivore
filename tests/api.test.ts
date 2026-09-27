import { describe, expect, it } from 'vitest'
import { createGame } from '../src/engine/state'
import { legalActions, applyAction } from '../src/engine/actions'
import { deserialize, isOver, replay, result, serialize, validate } from '../src/engine/api'
import { createRng, nextInt } from '../src/engine/rng'
import { ALL_REGION_IDS } from '../src/content/map'
import { HeuristicBot } from '../src/ai/heuristic'
import type { Action, GameConfig, GameState } from '../src/engine/types'

const FULL_CONFIG: GameConfig = {
  producers: ['mara', 'tomas'],
  difficulty: 'normal',
  activeRegions: ALL_REGION_IDS,
}

function playSomeActions(seed: number, steps: number) {
  let state = createGame(FULL_CONFIG, seed)
  let rng = createRng(seed * 104729 + 1)
  const actions = []
  for (let i = 0; i < steps && !state.result; i++) {
    const legal = legalActions(state)
    const [idx, next] = nextInt(rng, legal.length)
    rng = next
    const action = legal[idx]!
    actions.push(action)
    state = applyAction(state, action)
  }
  return { state, actions }
}

describe('validate', () => {
  it('finds no errors on a fresh game', () => {
    const state = createGame(FULL_CONFIG, 11)
    expect(validate(state)).toEqual([])
  })

  it('finds no errors after a run of random actions', () => {
    const { state } = playSomeActions(11, 60)
    expect(validate(state)).toEqual([])
  })

  // SPEC 4.3/7: the Market always has exactly 4 slots and Cath's Plan exactly 3, empty slots staying null
  // rather than the array shrinking or growing.
  it('flags a Market that is not exactly 4 slots', () => {
    const state = createGame(FULL_CONFIG, 11)
    const broken = { ...state, market: state.market.slice(0, 3) }
    expect(validate(broken).some((e) => e.message.includes('market has'))).toBe(true)
  })

  it("flags a Cath's Plan that is not exactly 3 slots", () => {
    const state = createGame(FULL_CONFIG, 11)
    const broken = { ...state, cathsPlan: [...state.cathsPlan, null] }
    expect(validate(broken).some((e) => e.message.includes('cathsPlan has'))).toBe(true)
  })

  // SPEC 9.1 "slots consistent": the same Improvement or Scheme id showing up twice (deck vs. market vs.
  // a tableau) means a card was duplicated somewhere, not just a count that happens to still add up.
  it('flags a duplicate Improvement id between the deck and the Market', () => {
    const state = createGame(FULL_CONFIG, 11)
    const dupeId = state.market.find((id) => id !== null)!
    const broken = { ...state, improvementDeck: [...state.improvementDeck, dupeId] }
    expect(validate(broken).some((e) => e.message.includes('improvements') && e.message.includes(dupeId))).toBe(true)
  })

  it('flags a duplicate Scheme id between the deck and Cath\'s Plan', () => {
    const state = createGame(FULL_CONFIG, 11)
    const dupeId = state.cathsPlan.find((id) => id !== null)!
    const broken = { ...state, schemeDeck: [...state.schemeDeck, dupeId] }
    expect(validate(broken).some((e) => e.message.includes('schemes') && e.message.includes(dupeId))).toBe(true)
  })

  // SPEC 4.7: the Pressure pipeline's deck + discard + squeeze/expand/scout slots must always total the
  // deck it started with — Scout/Advance move cards between these, never drop or duplicate one.
  it('flags a Pressure deck/discard/pipeline total that has lost a card', () => {
    const state = createGame(FULL_CONFIG, 11)
    const broken = { ...state, pressureDeck: state.pressureDeck.slice(1) }
    expect(validate(broken).some((e) => e.message.includes('pressure deck/discard/pipeline total'))).toBe(true)
  })

  it('flags a duplicate Pressure card id between the deck and the discard pile', () => {
    const state = createGame(FULL_CONFIG, 11)
    const dupe = state.pressureDeck[0]!
    const broken = { ...state, pressureDiscard: [...state.pressureDiscard, dupe] }
    expect(validate(broken).some((e) => e.message.includes('pressure') && e.message.includes(dupe.id))).toBe(true)
  })
})

// Plays a full game to its end screen (round 10 or a liberation/loss result) using HeuristicBot, which
// greedily buys Improvements whenever that scores best — the realistic worst case for serialized size,
// since `state.log`/`state.actionHistory` (SPEC 9.1's engine invariants, `pieces.ts`'s end-screen stats)
// grow for the whole game and never get trimmed, and a full tableau of owned Improvements is the biggest
// per-producer payload. A safety cap guards against a bot bug hanging the test instead of ending the game.
function playFullGame(seed: number) {
  let state = createGame(FULL_CONFIG, seed)
  let rng = createRng(seed * 104729 + 1)
  for (let step = 0; step < 2000 && !state.result; step++) {
    const [action, next] = HeuristicBot.chooseAction(state, rng)
    rng = next
    state = applyAction(state, action)
  }
  return state
}

describe('serialize/deserialize', () => {
  it('round-trips to an identical state', () => {
    const { state } = playSomeActions(21, 40)
    const json = serialize(state)
    expect(deserialize(json)).toEqual(state)
  })

  it('stays under 50KB (SPEC 9.1) for a full 10-round game with a maxed-out Improvement tableau', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const state = playFullGame(seed)
      expect(state.result).not.toBeNull()
      expect(state.round).toBeLessThanOrEqual(10)

      // Sanity-check this is a real worst case, not a trivially short/empty game: HeuristicBot buys
      // Improvements greedily, so a full game should leave a substantial tableau and a long log/history.
      // Threshold lowered from 5 (see DECISIONS.md): converting 4 filler Improvements to pure ongoing-
      // ability cards for SPEC 7's effect-mix target shifted HeuristicBot's per-seed purchase counts
      // (its legal-action list/order changed), and the lowest observed across seeds 1-10 dropped to 4 —
      // still a real, substantial tableau, not a degenerate game.
      const improvementsOwned = Object.values(state.producers).reduce((n, p) => n + p.improvements.length, 0)
      expect(improvementsOwned).toBeGreaterThan(2)
      expect(state.log.length).toBeGreaterThan(50)

      const json = serialize(state)
      expect(json.length).toBeLessThan(50 * 1024)
    }
  })
})

describe('replay', () => {
  it('rebuilds the identical state from config, seed and actions', () => {
    const { state, actions } = playSomeActions(33, 40)
    const rebuilt = replay(FULL_CONFIG, 33, actions)
    expect(serialize(rebuilt)).toBe(serialize(state))
  })

  // A review pass found `replay()` itself is a generic per-kind-agnostic loop (so it can't special-case
  // fail), but no test actually drove a real `{config, seed, actions}` triple through `tearUpContract` or
  // a `decide` action and confirmed replay reproduces the exact same state — the specific "does a real
  // save+reload actually work" property, as opposed to `applyAction()` correctness in isolation (already
  // covered elsewhere for these action kinds). Closes that gap directly rather than leaving it as a
  // documented-but-untested risk.
  it('reproduces the identical state through a tearUpContract action (SPEC 8.2 ch3 carry-over)', () => {
    const config: GameConfig = {
      producers: ['mara'],
      difficulty: 'normal',
      activeRegions: ['brindleHills', 'highmoor'],
      rulesEnabled: { agenda: false, squeeze: false, expand: false, sell: true, improvements: true, schemes: true, roles: true, rebut: true },
      scriptedPressure: Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, stage: 1 as const, regionTypes: [], regions: ['highmoor' as const] })),
      scriptedMarket: ['wholesome-hollow-contract'],
      scriptedTrigger: { round: 2, effect: 'wholesomeHollowReveal', sceneId: 'twist' },
    }
    const seed = 1
    let state = createGame(config, seed)
    const actions: Action[] = []
    const graft = () => {
      const action = legalActions(state).find((a) => a.kind === 'graft')!
      actions.push(action)
      state = applyAction(state, action)
    }
    const buyContract = () => {
      const action = legalActions(state).find((a) => a.kind === 'invest' && a.improvementId === 'wholesome-hollow-contract')!
      actions.push(action)
      state = applyAction(state, action)
    }
    buyContract()
    for (let i = 0; i < 5; i++) graft() // through the round-2 reveal trigger and one more round
    const tearUp = legalActions(state).find((a) => a.kind === 'tearUpContract')!
    actions.push(tearUp)
    state = applyAction(state, tearUp)
    graft() // one more action after the trigger has already fired, to prove `scriptedTriggerFired` replays too

    const rebuilt = replay(config, seed, actions)
    expect(serialize(rebuilt)).toBe(serialize(state))
    expect(rebuilt.wholesomeHollowRevealed).toBe(true)
    expect(rebuilt.producers.mara.improvements.includes('wholesome-hollow-contract')).toBe(false)
  })

  // A `decide` action (SPEC 9.1's `currentDecision`/`PendingDecision` path — e.g. the Kingsmarket-
  // liberation production-bonus choice, or the home-region Squeeze production-loss choice) is the other
  // under-tested action kind the same review flagged. HeuristicBot already resolves `decide` options
  // itself (tests/bots.test.ts), so playing full games with it and keeping the first one whose action list
  // contains a real `decide` is a reliable way to get one without hand-scripting a specific board state.
  it('reproduces the identical state through a decide action', () => {
    let found: { config: GameConfig; seed: number; state: GameState; actions: Action[] } | undefined
    for (let seed = 1; seed <= 15 && !found; seed++) {
      let state = createGame(FULL_CONFIG, seed)
      let rng = createRng(seed * 104729 + 1)
      const actions: Action[] = []
      for (let step = 0; step < 2000 && !state.result; step++) {
        const [action, next] = HeuristicBot.chooseAction(state, rng)
        rng = next
        actions.push(action)
        state = applyAction(state, action)
      }
      if (actions.some((a) => a.kind === 'decide')) found = { config: FULL_CONFIG, seed, state, actions }
    }
    expect(found, 'no decide action found across 15 seeds — widen the seed range').toBeDefined()

    const rebuilt = replay(found!.config, found!.seed, found!.actions)
    expect(serialize(rebuilt)).toBe(serialize(found!.state))
  })
})

describe('isOver/result', () => {
  it('is over only once a result exists', () => {
    const state = createGame(FULL_CONFIG, 1)
    expect(isOver(state)).toBe(false)
    expect(result(state)).toBeNull()
  })
})
