import { REGIONS } from '../content/map'
import { IMPROVEMENTS_BY_ID } from '../content/improvements'
import { SCHEMES_BY_ID } from '../content/schemes'
import { PRODUCERS } from '../content/producers'
import type { Action, GameState } from '../engine/types'

const RESOURCE_NAME = { produce: 'Produce', marks: 'Marks', goodwill: 'Goodwill' } as const

// A plain-English label for a fully-specified legal Action, used until the real map/card UI (SPEC 10)
// exists. `legalActions` already expands every choice (region, card, track) into its own Action, so one
// button per array entry is enough to drive a whole game.
export function actionLabel(action: Action, state: GameState): string {
  switch (action.kind) {
    case 'openStall':
      return `Open Stall in ${REGIONS[action.region].name}`
    case 'supplyOutlets':
      return `Supply: remove ${action.count} Outlet${action.count > 1 ? 's' : ''} in ${REGIONS[action.region].name}`
    case 'supplyBuyout':
      return `Supply: remove Buyout in ${REGIONS[action.region].name}`
    case 'rebut':
      return `Rebut: remove ${action.count} Doubt in ${REGIONS[action.region].name}`
    case 'invest': {
      const card = IMPROVEMENTS_BY_ID.get(action.improvementId)
      return `Invest: buy ${card?.name ?? action.improvementId} (${card?.cost ?? '?'} Marks)`
    }
    case 'sell':
      return `Sell ${action.count} Produce for ${action.count} Marks`
    case 'scheme': {
      const card = SCHEMES_BY_ID.get(action.schemeId)
      const target = action.targetRegion ? ` in ${REGIONS[action.targetRegion].name}` : ''
      return `Scheme: ${card?.name ?? action.schemeId}${target}`
    }
    case 'graft':
      return 'Graft: +1 Produce, +1 Marks'
    case 'role': {
      const roleName = PRODUCERS[state.activeProducer].roleName
      const target = action.targetRegion ? ` on ${REGIONS[action.targetRegion].name}` : ''
      return `Role (${roleName})${target}`
    }
    case 'decide':
      return `Choose ${RESOURCE_NAME[action.choice]}`
  }
}
