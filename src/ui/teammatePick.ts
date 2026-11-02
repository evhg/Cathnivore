import type { CathExpression } from '../../shared/cath/cath'
import { regionOf } from './actionLabel'
import type { Action, RegionId } from '../engine/types'

// Plan item 34: the AI teammate's pick, shown as a lifted card with its reason before it lands. The face
// they make follows the reason: a liberation delights them, a race against the next Squeeze or Expand sets
// their jaw, a quiet Graft or Sell gets a smirk, and a forced choice after a Squeeze worries them.
export function pickExpression(action: Action, reason: string): CathExpression {
  if (/^Liberating/.test(reason)) return 'delighted'
  if (/squeezed|expanded|Expand there|costs more/.test(reason)) return 'determined'
  if (action.kind === 'decide') return /Squeeze/.test(reason) ? 'worried' : 'smirk'
  if (action.kind === 'graft' || action.kind === 'sell') return 'smirk'
  if (action.kind === 'invest' || action.kind === 'role') return 'wink'
  return 'determined'
}

export function pickRegion(action: Action): RegionId | undefined {
  return regionOf(action)
}
