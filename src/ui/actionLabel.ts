import { REGIONS } from '../content/map'
import { IMPROVEMENTS_BY_ID } from '../content/improvements'
import { SCHEMES_BY_ID } from '../content/schemes'
import { PRODUCERS } from '../content/producers'
import type { Action, GameState, RegionId } from '../engine/types'

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
      const choice = action.choice === 'trust' ? ': Public Trust +1' : action.choice === 'goodwill' ? ': +2 Goodwill' : ''
      return `Role (${roleName})${target}${choice}`
    }
    case 'decide':
      return `Choose ${RESOURCE_NAME[action.choice]}`
  }
}

// The region an action targets, for SPEC 10.2's targeting mode (tap a glowing region on the map instead
// of picking a per-region button). Actions with no region choice (Sell, Graft, Invest, decide, an
// untargeted Scheme/Role) return undefined and stay a single ordinary button.
export function regionOf(action: Action): RegionId | undefined {
  switch (action.kind) {
    case 'openStall':
    case 'supplyOutlets':
    case 'supplyBuyout':
    case 'rebut':
      return action.region
    case 'scheme':
    case 'role':
      return action.targetRegion
    default:
      return undefined
  }
}

// A key grouping every region-variant of "the same" action together (e.g. "Open Stall" regardless of
// which region), so the UI can offer one button that then highlights the legal regions on the map.
export function actionGroupKey(action: Action): string {
  switch (action.kind) {
    case 'openStall':
      return 'openStall'
    case 'supplyOutlets':
      return `supplyOutlets:${action.count}`
    case 'supplyBuyout':
      return 'supplyBuyout'
    case 'rebut':
      return `rebut:${action.count}`
    case 'scheme':
      return `scheme:${action.schemeId}`
    case 'role':
      return 'role'
    default:
      return `${action.kind}:${JSON.stringify(action)}`
  }
}

// The label for a group button, with no region mentioned (the map highlight supplies that once tapped).
export function actionGroupLabel(action: Action, state: GameState): string {
  switch (action.kind) {
    case 'openStall':
      return 'Open Stall'
    case 'supplyOutlets':
      return `Supply: remove ${action.count} Outlet${action.count > 1 ? 's' : ''}`
    case 'supplyBuyout':
      return 'Supply: remove Buyout'
    case 'rebut':
      return `Rebut: remove ${action.count} Doubt`
    case 'scheme': {
      const card = SCHEMES_BY_ID.get(action.schemeId)
      return `Scheme: ${card?.name ?? action.schemeId}`
    }
    case 'role':
      return `Role (${PRODUCERS[state.activeProducer].roleName})`
    default:
      return actionLabel(action, state)
  }
}
