import { createGame } from './state'
import { applyAction, legalActions } from './actions'
import { isLiberated } from './region'
import { POOL_SIZES } from './pieces'
import { DIFFICULTY_SETTINGS } from '../content/difficulty'
import { AGENDA_CARDS } from '../content/agenda'
import { IMPROVEMENTS } from '../content/improvements'
import { SCHEMES } from '../content/schemes'
import type { Action, GameConfig, GameResult, GameState } from './types'

export { createGame, legalActions, applyAction }

export function isOver(state: GameState): boolean {
  return state.result !== null
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

// Rebuilds a GameState by replaying an action log from scratch, per SPEC 9.1. Used for undo (replay a
// truncated log) and for save-loading (SPEC 11.3 stores {config, seed, actions}, not the state itself).
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
  const startingLostLandPool = DIFFICULTY_SETTINGS[state.config.difficulty].lostLandPool
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

  // SPEC 7/5: Improvements bought stay permanently in a tableau; Schemes played go to the discard pile.
  const marketCount = state.market.filter((id) => id !== null).length
  const ownedImprovements = Object.values(state.producers).reduce((n, p) => n + p.improvements.length, 0)
  const improvementTotal = state.improvementDeck.length + marketCount + state.improvementDiscard.length + ownedImprovements
  if (improvementTotal !== IMPROVEMENTS.length) {
    push(`improvement deck/market/tableau total mismatch: ${improvementTotal} != ${IMPROVEMENTS.length}`)
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
