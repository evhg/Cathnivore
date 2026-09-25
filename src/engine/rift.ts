import { AGENDA_CARDS } from '../content/agenda'
import { removeBuyout, removeDoubt, removeOutlets } from './pieces'
import type { GameState, RegionId, RegionState } from './types'

type Faction = 'hollowell' | 'candor'

const AGENDA_FACTION_BY_ID = new Map(AGENDA_CARDS.map((c) => [c.id, c.faction]))

function pieceCount(region: RegionState, faction: Faction): number {
  return faction === 'hollowell' ? region.outlets + region.buyouts : region.doubt
}

function totalPieces(state: GameState, faction: Faction): number {
  return state.config.activeRegions.reduce((sum, id) => sum + pieceCount(state.regions[id], faction), 0)
}

// SPEC 4.7 Rift 6: "The AI picks the faction and places whose removal most improves its evaluation." M2's
// real evaluation function (src/ai/evaluation.ts) exists now, but wiring it in here would have `engine/`
// (meant to stay pure, dependency-free of `ai/` — SPEC 9.1/11.2's layering, `ai/` depends on `engine/`, not
// the other way around) import from `ai/`, risking a circular import and inverting that layering for a
// once-per-game, low-stakes event. Keeping the greedy proxy: remove half of whichever faction currently has
// more pieces on the map, since that's the faction doing the players the most harm right now.
function pickFaction(state: GameState): Faction {
  return totalPieces(state, 'hollowell') >= totalPieces(state, 'candor') ? 'hollowell' : 'candor'
}

function removeOnePiece(state: GameState, region: RegionId, faction: Faction): GameState {
  if (faction === 'candor') return removeDoubt(state, region, 1)
  return state.regions[region].outlets > 0 ? removeOutlets(state, region, 1) : removeBuyout(state, region, 1)
}

// Removes half (rounded down) of the faction's pieces, greedily from the regions with the most of them
// first, standing in for "the players choose where."
function removeHalfFactionPieces(state: GameState, faction: Faction): GameState {
  let next = state
  let toRemove = Math.floor(totalPieces(state, faction) / 2)
  while (toRemove > 0) {
    const candidates = next.config.activeRegions.filter((id) => pieceCount(next.regions[id], faction) > 0)
    if (candidates.length === 0) break
    const target = candidates.reduce((best, id) =>
      pieceCount(next.regions[id], faction) > pieceCount(next.regions[best], faction) ? id : best,
    )
    next = removeOnePiece(next, target, faction)
    toRemove--
  }
  return next
}

// SPEC 4.7 Rift 6 "The Split" (happens once): the players choose one faction. Remove all its remaining
// cards from the Agenda deck, and remove half (rounded down) of its pieces from the map. Callers must
// re-check liberation afterwards (removing pieces can liberate a region) — not done here, to avoid a
// circular import with engine/enemy.ts, which already calls this after its own liberation check.
export function checkRiftSplit(state: GameState): GameState {
  if (state.riftSplitDone || state.rift < 6) return state
  const faction = pickFaction(state)
  const next = removeHalfFactionPieces(state, faction)
  const removed = next.agendaDeck.filter((id) => AGENDA_FACTION_BY_ID.get(id) === faction)
  return {
    ...next,
    riftSplitDone: true,
    agendaDeck: next.agendaDeck.filter((id) => AGENDA_FACTION_BY_ID.get(id) !== faction),
    agendaRemoved: [...next.agendaRemoved, ...removed],
    log: [...next.log, { type: 'riftSplit', faction }],
  }
}
