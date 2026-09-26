import { SCHEMES_BY_ID } from '../content/schemes'
import type { Action } from '../engine/types'

// SPEC 4.6: "any action that reveals hidden information ... is marked irreversible, and undo cannot go
// back past it." Only Steak-out (a Scheme) does this so far — it peeks the Pressure deck.
export function isIrreversible(action: Action): boolean {
  return action.kind === 'scheme' && (SCHEMES_BY_ID.get(action.schemeId)?.irreversible ?? false)
}
