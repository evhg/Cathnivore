// Plan item 476: the round's Harvest (SPEC 4.5.1) as data the table can stage. `harvestGains` is the arithmetic the
// engine applies (round.ts calls it); `harvestSources` splits the same gains into single goods, each with the ground
// it rises from, so the animation can never disagree with the engine.
import { hasImprovement } from './producer'
import { PRODUCERS } from '../content/producers'
import type { GameState, ProducerId, RegionId, Resources } from './types'

/** What a producer gains at Harvest: its production tracks, plus Oyster Beds' Goodwill with a Stall in Shingle Bay. */
export function harvestGains(state: GameState, pid: ProducerId): Resources & { oyster: number } {
  const p = state.producers[pid]
  // SPEC 7 "Oyster Beds": at Harvest, also gain 1 Goodwill if the owner has a Stall in Shingle Bay.
  const oyster = hasImprovement(state, pid, 'oyster-beds') && (state.regions.shingleBay.stalls[pid] ?? 0) > 0 ? 1 : 0
  return { produce: p.production.produce, marks: p.production.marks, goodwill: p.production.goodwill + oyster, oyster }
}

export type HarvestUnit = keyof Resources

export interface HarvestGood {
  producer: ProducerId
  unit: HarvestUnit
  /** The ground it rises from: the producer's home region, or Shingle Bay for the oyster bonus. */
  from: RegionId
  /** A bonus on top of the tracks (drawn with a gold rim). */
  bonus: boolean
}

/** Every good the Harvest pays out of `state` (the state the round starts from), in seat order. */
export function harvestSources(state: GameState): HarvestGood[] {
  const out: HarvestGood[] = []
  for (const pid of state.config.producers) {
    const g = harvestGains(state, pid)
    const home = PRODUCERS[pid].home
    for (const unit of ['produce', 'marks', 'goodwill'] as const) {
      const n = Math.max(0, unit === 'goodwill' ? g.goodwill - g.oyster : g[unit])
      for (let i = 0; i < n; i++) out.push({ producer: pid, unit, from: home, bonus: false })
    }
    for (let i = 0; i < g.oyster; i++) out.push({ producer: pid, unit: 'goodwill', from: 'shingleBay', bonus: true })
  }
  return out
}
