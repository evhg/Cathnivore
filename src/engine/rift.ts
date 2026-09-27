import { AGENDA_CARDS } from '../content/agenda'
import { addBuyout, addDoubt, addOutlets, removeBuyout, removeDoubt, removeOutlets } from './pieces'
import type { Faction, FactionPieceKind, GameState, PendingDecision, RegionId, RegionState } from './types'

const AGENDA_FACTION_BY_ID = new Map(AGENDA_CARDS.map((c) => [c.id, c.faction]))

function pieceCount(region: RegionState, faction: Faction): number {
  return faction === 'hollowell' ? region.outlets + region.buyouts : region.doubt
}

function totalPieces(state: GameState, faction: Faction): number {
  return state.config.activeRegions.reduce((sum, id) => sum + pieceCount(state.regions[id], faction), 0)
}

// SPEC 4.6/4.7: Hollowell's pieces are Outlets and Buyouts; Candor's is Doubt. Outlets go first (matching
// Supply's own removal order), falling back to a Buyout only once a region has no Outlets left.
function pieceKindToRemove(region: RegionState, faction: Faction): FactionPieceKind {
  if (faction === 'candor') return 'doubt'
  return region.outlets > 0 ? 'outlet' : 'buyout'
}

function removePiece(state: GameState, region: RegionId, kind: FactionPieceKind): GameState {
  if (kind === 'outlet') return removeOutlets(state, region, 1)
  if (kind === 'buyout') return removeBuyout(state, region, 1)
  return removeDoubt(state, region, 1)
}

function addPiece(state: GameState, region: RegionId, kind: FactionPieceKind): GameState {
  if (kind === 'outlet') return addOutlets(state, region, 1)
  if (kind === 'buyout') return addBuyout(state, region, 1)
  return addDoubt(state, region, 1)
}

function regionWithMostPieces(state: GameState, faction: Faction): RegionId | null {
  const candidates = state.config.activeRegions.filter((id) => pieceCount(state.regions[id], faction) > 0)
  if (candidates.length === 0) return null
  return candidates.reduce((best, id) => (pieceCount(state.regions[id], faction) > pieceCount(state.regions[best], faction) ? id : best))
}

// Greedy proxy for "the faction whose removal most improves its evaluation," used only as the *default*
// pre-filled into the `riftSplitFaction` decision below: remove whichever faction currently has more
// pieces on the map, since that's doing the players the most harm right now. It is never the final word —
// a human or the AI can override it through the same `currentDecision`/`decide` path (SPEC 9.1) as every
// other forced choice, and an AI bot picks among the two `decide` options the same way it picks any other
// action: by evaluating the resulting state (`src/ai/evaluation.ts`), same as SPEC 4.7 describes.
function defaultFaction(state: GameState): Faction {
  return totalPieces(state, 'hollowell') >= totalPieces(state, 'candor') ? 'hollowell' : 'candor'
}

function riftSplitDecisionPending(state: GameState): boolean {
  return state.pendingDecisions.some((d) => d.kind === 'riftSplitFaction' || d.kind === 'riftSplitRemoval')
}

// SPEC 4.7 Rift 6 "The Split" (happens once): "the players choose one faction... Remove all of its
// remaining cards from the Agenda deck, and remove half (rounded down) of that faction's pieces from the
// map, with the players choosing where." SPEC 9.1 names this exact pair of choices as an example forced
// decision ("which faction to split at Rift 6"), so both steps go through `currentDecision`/`decide` — the
// same path a human or the AI uses for every other forced choice — rather than being resolved directly
// here. This only *starts* the chain, the moment Rift first reaches 6 (from either a Scheme or an Agenda
// bonus), by queuing the first decision; `resolveRiftSplitFaction`/`resolveRiftSplitRemoval` below (called
// from `actions.ts`'s `applyDecision`) carry it through to completion. Callers must re-check liberation
// afterwards (removing pieces, here or via a decision, can liberate a region) — not done here, to avoid a
// circular import with engine/enemy.ts, which already calls this after its own liberation check.
export function checkRiftSplit(state: GameState): GameState {
  if (state.riftSplitDone || state.rift < 6 || riftSplitDecisionPending(state)) return state
  return {
    ...state,
    pendingDecisions: [
      ...state.pendingDecisions,
      { id: `riftSplitFaction-${state.round}`, kind: 'riftSplitFaction', options: ['hollowell', 'candor'], applied: defaultFaction(state) },
    ],
  }
}

// Queues the next single-piece `riftSplitRemoval` decision for `faction`, applying its greedy default
// (most pieces first, standing in for "the players choose where" until overridden) immediately — matching
// every other `currentDecision`'s "apply a default, expose it for override" pattern — or, once none remain
// to remove, finishes the Split.
function queueNextRemovalOrFinish(state: GameState, faction: Faction, remaining: number): GameState {
  const target = remaining > 0 ? regionWithMostPieces(state, faction) : null
  if (!target) {
    return { ...state, riftSplitDone: true, log: [...state.log, { type: 'riftSplit', faction }] }
  }
  const options = state.config.activeRegions.filter((id) => pieceCount(state.regions[id], faction) > 0)
  const pieceKind = pieceKindToRemove(state.regions[target], faction)
  const applied = removePiece(state, target, pieceKind)
  return {
    ...applied,
    pendingDecisions: [
      ...applied.pendingDecisions,
      {
        id: `riftSplitRemoval-${faction}-${remaining}-${state.round}`,
        kind: 'riftSplitRemoval',
        faction,
        pieceKind,
        remaining: remaining - 1,
        options,
        applied: target,
      },
    ],
  }
}

// Resolves the `riftSplitFaction` decision (called from `actions.ts`'s `applyDecision`): strips the chosen
// faction's remaining Agenda cards — nothing else can have touched `agendaDeck` meanwhile, since a pending
// decision is the only legal action (SPEC 9.1) — then starts the removal chain for half its current
// pieces, rounded down (SPEC 4.7).
export function resolveRiftSplitFaction(state: GameState, decisionId: string, faction: Faction): GameState {
  const removed = state.agendaDeck.filter((id) => AGENDA_FACTION_BY_ID.get(id) === faction)
  const next: GameState = {
    ...state,
    agendaDeck: state.agendaDeck.filter((id) => AGENDA_FACTION_BY_ID.get(id) !== faction),
    agendaRemoved: [...state.agendaRemoved, ...removed],
    pendingDecisions: state.pendingDecisions.filter((d) => d.id !== decisionId),
  }
  return queueNextRemovalOrFinish(next, faction, Math.floor(totalPieces(next, faction) / 2))
}

// Resolves one `riftSplitRemoval` decision: if the chosen region differs from the greedy default already
// applied, undoes that default removal and removes from the chosen region instead, then queues the next
// removal (or finishes).
export function resolveRiftSplitRemoval(
  state: GameState,
  decision: Extract<PendingDecision, { kind: 'riftSplitRemoval' }>,
  region: RegionId,
): GameState {
  let next: GameState = { ...state, pendingDecisions: state.pendingDecisions.filter((d) => d.id !== decision.id) }
  if (region !== decision.applied) {
    next = addPiece(next, decision.applied, decision.pieceKind)
    next = removePiece(next, region, pieceKindToRemove(next.regions[region], decision.faction))
  }
  return queueNextRemovalOrFinish(next, decision.faction, decision.remaining)
}
