// Plan item 502: the Setup draws the opening table you'll play. One config builder serves both Start and the
// preview, so the board under the map pick is the game `createGame` will deal: Hollowell's opening Outlets,
// Buyouts and Doubt per region (with the first Scout card already resolved), the producers' home stalls and the
// week's market event dressing the ground. Pure, so a unit test proves the preview and the game agree.

import { layoutConfig, type LayoutId } from '../content/layouts'
import { createGame } from '../engine/state'
import type { GameConfig, GameState, ProducerId, RegionId } from '../engine/types'

export interface SetupPicks {
  producers: readonly ProducerId[]
  difficulty: GameConfig['difficulty']
  layout: LayoutId
  marketEvent: NonNullable<GameConfig['marketEvent']>
}

/** The game config Start opens with (Setup.tsx's `start()` calls this too). */
export function setupConfig(picks: SetupPicks, seed: number): GameConfig {
  return { producers: [...picks.producers], difficulty: picks.difficulty, ...layoutConfig(picks.layout, seed), marketEvent: picks.marketEvent }
}

/**
 * The opening board for these picks and seed. With fewer than one producer picked the engine can't deal, so it
 * deals for a stand-in and clears the stalls: the board shows Hollowell's side only until a producer is chosen.
 */
export function openingState(picks: SetupPicks, seed: number): GameState {
  if (picks.producers.length) return createGame(setupConfig(picks, seed), seed)
  const state = createGame(setupConfig({ ...picks, producers: ['mara'] }, seed), seed)
  const regions = { ...state.regions }
  for (const id of Object.keys(regions) as RegionId[]) regions[id] = { ...regions[id], stalls: {} }
  return { ...state, regions }
}

export interface OpeningPieces {
  outlets: number
  buyouts: number
  doubt: number
  stalls: number
}

/** Each active region's pieces on a state, for comparing the preview with a dealt game. */
export function openingPieces(state: GameState): Partial<Record<RegionId, OpeningPieces>> {
  const out: Partial<Record<RegionId, OpeningPieces>> = {}
  for (const id of state.config.activeRegions) {
    const r = state.regions[id]
    out[id] = { outlets: r.outlets, buyouts: r.buyouts, doubt: r.doubt, stalls: Object.values(r.stalls).reduce((a, n) => a + (n ?? 0), 0) }
  }
  return out
}
