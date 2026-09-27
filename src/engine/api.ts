import { createGame } from './state'
import { applyAction, legalActions } from './actions'
import { isLiberated } from './region'
import { POOL_SIZES } from './pieces'
import { DIFFICULTY_SETTINGS } from '../content/difficulty'
import { AGENDA_CARDS } from '../content/agenda'
import { IMPROVEMENTS } from '../content/improvements'
import { SCHEMES } from '../content/schemes'
import type { Action, GameConfig, GameResult, GameState, PendingDecision } from './types'

export { createGame, legalActions, applyAction }

export function isOver(state: GameState): boolean {
  return state.result !== null
}

// SPEC 9.1: who must decide what, right now — a forced choice with legal options (see `types.ts`
// `PendingDecision`), resolved via `applyAction({kind: 'decide', ...})`. `null` when nothing is pending.
export function currentDecision(state: GameState): PendingDecision | null {
  return state.pendingDecisions[0] ?? null
}

export function result(state: GameState): GameResult | null {
  return state.result
}

export function serialize(state: GameState): string {
  return JSON.stringify(state)
}

export function deserialize(json: string): GameState {
  return JSON.parse(json) as GameState
}

// Rebuilds a GameState by replaying an action log from scratch, per SPEC 9.1. Used for save-loading
// (SPEC 11.3 stores {config, seed, actions}, not the state itself) — undo (`Game.tsx`) instead pushes a
// full `GameState` snapshot before each human action and restores it directly, cheaper than a re-replay.
export function replay(config: GameConfig, seed: number, actions: readonly Action[]): GameState {
  let state = createGame(config, seed)
  for (const action of actions) {
    if (state.result) break
    state = applyAction(state, action)
  }
  return state
}

export interface ValidationError {
  message: string
}

// SPEC 9.1: checks invariants — piece counts matching the pools, no negative values, Stall caps
// respected and slots consistent. Returns an empty array when the state is valid.
export function validate(state: GameState): ValidationError[] {
  const errors: ValidationError[] = []
  const push = (message: string) => errors.push({ message })

  let outletsOnMap = 0
  let buyoutsOnMap = 0
  let doubtOnMap = 0
  let lostLandOnMap = 0

  for (const region of Object.values(state.regions)) {
    if (region.outlets < 0) push(`${region.id}: negative outlets`)
    if (region.buyouts < 0) push(`${region.id}: negative buyouts`)
    if (region.doubt < 0) push(`${region.id}: negative doubt`)
    if (region.lostLand < 0) push(`${region.id}: negative lostLand`)
    outletsOnMap += region.outlets
    buyoutsOnMap += region.buyouts
    doubtOnMap += region.doubt
    lostLandOnMap += region.lostLand

    for (const count of Object.values(region.stalls)) {
      if ((count ?? 0) < 0) push(`${region.id}: negative stall count`)
    }
    if (region.liberated !== isLiberated(region)) {
      push(`${region.id}: liberated flag (${region.liberated}) doesn't match its pieces`)
    }
  }

  if (outletsOnMap + state.outletPool !== POOL_SIZES.outlet) {
    push(`outlet pool mismatch: ${outletsOnMap} on map + ${state.outletPool} in pool != ${POOL_SIZES.outlet}`)
  }
  if (buyoutsOnMap + state.buyoutPool !== POOL_SIZES.buyout) {
    push(`buyout pool mismatch: ${buyoutsOnMap} on map + ${state.buyoutPool} in pool != ${POOL_SIZES.buyout}`)
  }
  if (doubtOnMap + state.doubtPool !== POOL_SIZES.doubt) {
    push(`doubt pool mismatch: ${doubtOnMap} on map + ${state.doubtPool} in pool != ${POOL_SIZES.doubt}`)
  }
  const startingLostLandPool = state.config.lostLandPoolOverride ?? DIFFICULTY_SETTINGS[state.config.difficulty].lostLandPool
  if (lostLandOnMap + state.lostLandPool !== startingLostLandPool) {
    push(
      `lostLand pool mismatch: ${lostLandOnMap} on map + ${state.lostLandPool} in pool != ${startingLostLandPool}`,
    )
  }

  const agendaTotal =
    state.agendaDeck.length + state.agendaDiscard.length + state.agendaRemoved.length + (state.currentAgenda ? 1 : 0)
  if (agendaTotal !== AGENDA_CARDS.length) {
    push(`agenda deck/discard/current total mismatch: ${agendaTotal} != ${AGENDA_CARDS.length}`)
  }

  // SPEC 4.3/7: the Market always shows exactly 4 slots (empty ones stay null, SPEC 7's "if the deck is
  // empty, empty spaces stay empty" — the array itself never shrinks or grows).
  if (state.market.length !== 4) push(`market has ${state.market.length} slots, expected 4`)
  // SPEC 4.3/5: Cath's Plan always shows exactly 3 slots, same reasoning as the Market above.
  if (state.cathsPlan.length !== 3) push(`cathsPlan has ${state.cathsPlan.length} slots, expected 3`)

  // SPEC 7/5: Improvements bought stay permanently in a tableau; Schemes played go to the discard pile.
  const marketCount = state.market.filter((id) => id !== null).length
  const ownedImprovements = Object.values(state.producers).reduce((n, p) => n + p.improvements.length, 0)
  // SPEC 7 carry-over rule: a torn-up contract leaves the game entirely (unlike a Scheme's discard pile),
  // so it counts toward the total the same as one still on the deck/market/tableau.
  const improvementTotal =
    state.improvementDeck.length + marketCount + state.improvementDiscard.length + ownedImprovements + state.contractsTornUp
  // SPEC 8.2 ch3's `scriptedMarket` (3x "Wholesome Hollow Contract") adds cards outside the normal 36-card
  // `IMPROVEMENTS` pool, so the expected total grows by however many of those a campaign chapter injected.
  const expectedImprovementTotal = IMPROVEMENTS.length + (state.config.scriptedMarket?.length ?? 0)
  if (improvementTotal !== expectedImprovementTotal) {
    push(`improvement deck/market/tableau total mismatch: ${improvementTotal} != ${expectedImprovementTotal}`)
  }

  const planCount = state.cathsPlan.filter((id) => id !== null).length
  const schemeTotal = state.schemeDeck.length + planCount + state.schemeDiscard.length
  if (schemeTotal !== SCHEMES.length) {
    push(`scheme deck/plan/discard total mismatch: ${schemeTotal} != ${SCHEMES.length}`)
  }

  if (state.publicTrust < 0 || state.publicTrust > 15) push(`publicTrust out of range: ${state.publicTrust}`)
  if (state.rift < 0 || state.rift > 6) push(`rift out of range: ${state.rift}`)
  if (state.actionsLeft < 0 || state.actionsLeft > 3) push(`actionsLeft out of range: ${state.actionsLeft}`)

  for (const producer of Object.values(state.producers)) {
    for (const [key, value] of Object.entries(producer.resources)) {
      if (value < 0) push(`${producer.id}: negative ${key}`)
    }
  }

  return errors
}
