// SPEC 9.2: "Each AI action shows a one-line reason in the log, built from templates such as 'Clearing
// Doubt in Saltmarsh before it's squeezed next round.'" This builds that template-based reason for the
// action the AI teammate is about to take, using the state *before* the action is applied (so "before
// it's squeezed next round" can actually look at the still-visible Squeeze slot). Called once per
// AI-teammate decision (`aiWorker.ts`), never for a human's own actions or e2e autoplay's synchronous
// HeuristicBot stand-in — this is narration for the real AI teammate specifically, matching SPEC 9.2's
// placement of the sentence right after describing that teammate.
import { REGIONS, regionMatchesPressureSlot } from '../content/map'
import { IMPROVEMENTS_BY_ID } from '../content/improvements'
import { SCHEMES_BY_ID } from '../content/schemes'
import type { Action, GameState, RegionId } from '../engine/types'

function targetedNextRound(state: GameState, region: RegionId): 'squeeze' | 'expand' | null {
  // Liberated regions ignore Scout and Expand (SPEC 4.8), so a targeted-looking match there is stale.
  if (state.regions[region].liberated) return null
  if (regionMatchesPressureSlot(state, region, 'squeeze')) return 'squeeze'
  if (regionMatchesPressureSlot(state, region, 'expand')) return 'expand'
  return null
}

function roleReason(state: GameState, action: Extract<Action, { kind: 'role' }>): string {
  const region = action.targetRegion ? REGIONS[action.targetRegion].name : null
  switch (state.activeProducer) {
    case 'mara':
      return region ? `Filing an Injunction in ${region} to stop the Expand there.` : 'Filing an Injunction.'
    case 'tomas':
      return region ? `Calling a Market Day for a free Stall in ${region}.` : 'Calling a Market Day.'
    case 'ines':
      return region ? `Giving ${region} a Second Opinion to clear a Doubt for free.` : 'Giving a Second Opinion.'
    case 'sol':
      return action.choice === 'goodwill' ? 'Going On Air for extra Goodwill.' : 'Going On Air to raise Public Trust.'
  }
}

export function reasonForAction(state: GameState, action: Action): string {
  switch (action.kind) {
    case 'openStall': {
      const name = REGIONS[action.region].name
      const region = state.regions[action.region]
      const wouldLiberate = region.outlets === 0 && region.buyouts === 0 && region.doubt === 0
      if (wouldLiberate) return `Liberating ${name}.`
      const target = targetedNextRound(state, action.region)
      if (target) return `Reinforcing ${name} before it's ${target === 'squeeze' ? 'squeezed' : 'expanded'} next round.`
      return `Opening a Stall in ${name} to start clearing it.`
    }
    case 'supplyOutlets': {
      const name = REGIONS[action.region].name
      const target = targetedNextRound(state, action.region)
      return target === 'squeeze'
        ? `Clearing Outlets in ${name} before it's squeezed next round.`
        : `Clearing Outlets out of ${name}.`
    }
    case 'supplyBuyout': {
      const name = REGIONS[action.region].name
      const target = targetedNextRound(state, action.region)
      return target === 'squeeze'
        ? `Clearing a Buyout in ${name} before it's squeezed next round.`
        : `Clearing a Buyout out of ${name}.`
    }
    case 'rebut': {
      const name = REGIONS[action.region].name
      const target = targetedNextRound(state, action.region)
      return target === 'squeeze'
        ? `Clearing Doubt in ${name} before it's squeezed next round.`
        : `Clearing Doubt in ${name}.`
    }
    case 'sell':
      return 'Selling Produce to fund the next Improvement.'
    case 'graft':
      return 'Grafting to build up resources.'
    case 'invest': {
      const card = IMPROVEMENTS_BY_ID.get(action.improvementId)
      return `Investing in ${card?.name ?? action.improvementId}.`
    }
    case 'scheme': {
      const card = SCHEMES_BY_ID.get(action.schemeId)
      const target = action.targetRegion ? ` in ${REGIONS[action.targetRegion].name}` : ''
      return `Playing ${card?.name ?? action.schemeId}${target}.`
    }
    case 'role':
      return roleReason(state, action)
    case 'tearUpContract':
      return 'Tearing up a Wholesome Hollow Contract before it costs more.'
    case 'decide':
      return 'Making the required choice.'
  }
}
