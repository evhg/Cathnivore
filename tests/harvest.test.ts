import { describe, expect, it } from 'vitest'
import { createGame } from '../src/engine/state'
import { applyAction } from '../src/engine/actions'
import { createRng } from '../src/engine/rng'
import { ALL_REGION_IDS } from '../src/content/map'
import { HeuristicBot } from '../src/ai/heuristic'
import { PRODUCERS } from '../src/content/producers'
import { harvestGains, harvestSources } from '../src/engine/harvest'
import type { GameConfig, GameState } from '../src/engine/types'

// Plan item 476: the table's Harvest moment draws one good per unit the engine pays (round.ts applies harvestGains),
// so the goods must sum exactly to the gains, each from its producer's home ground (the oyster bonus from Shingle Bay).
const CONFIG: GameConfig = { producers: ['mara', 'tomas'], difficulty: 'normal', activeRegions: ALL_REGION_IDS }

function midGames(): GameState[] {
  const out: GameState[] = []
  for (let seed = 1; seed <= 20; seed++) {
    let state = createGame(CONFIG, seed)
    let rng = createRng(seed * 7919 + 3)
    // a few rounds in, so production tracks have grown
    for (let step = 0; step < 40 + seed * 3 && !state.result; step++) {
      const [action, next] = HeuristicBot.chooseAction(state, rng)
      rng = next
      state = applyAction(state, action)
    }
    out.push(state)
  }
  return out
}

describe('harvest sources (plan item 476)', () => {
  it('the goods sum exactly to each producer\'s harvest gains over 20 seeded games', () => {
    for (const state of midGames()) {
      const goods = harvestSources(state)
      for (const pid of state.config.producers) {
        const g = harvestGains(state, pid)
        for (const unit of ['produce', 'marks', 'goodwill'] as const) {
          expect(goods.filter((x) => x.producer === pid && x.unit === unit).length, `${pid} ${unit}`).toBe(Math.max(0, g[unit]))
        }
        for (const x of goods.filter((x) => x.producer === pid && !x.bonus)) expect(x.from).toBe(PRODUCERS[pid].home)
      }
    }
  })

  it('Oyster Beds\' Goodwill rises from Shingle Bay, as a bonus', () => {
    const s = createGame(CONFIG, 1)
    const state: GameState = {
      ...s,
      producers: { ...s.producers, mara: { ...s.producers.mara, improvements: [...s.producers.mara.improvements, 'oyster-beds'] } },
      regions: { ...s.regions, shingleBay: { ...s.regions.shingleBay, stalls: { ...s.regions.shingleBay.stalls, mara: 1 } } },
    }
    expect(harvestGains(state, 'mara').oyster).toBe(1)
    const bonus = harvestSources(state).filter((x) => x.bonus)
    expect(bonus).toEqual([{ producer: 'mara', unit: 'goodwill', from: 'shingleBay', bonus: true }])
  })
})
