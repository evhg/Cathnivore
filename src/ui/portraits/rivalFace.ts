import type { CathExpression } from '../../../shared/cath/cath'
import type { ExecMood } from '../boardroom'

// Plan item 92: Hollowell's face across the table, Graham Pell (the boardroom's Hollowell, plan item 11), in his
// three boardroom moods. His mood mirrors Cath's: rattled when her stall is winning, gloating when she is worried
// (a Squeeze landed, land lost), and smug the rest of the time.
export const RIVAL_MOODS: readonly ExecMood[] = ['smug', 'gloat', 'rattled']

export function rivalMood(cath?: CathExpression): ExecMood {
  if (cath === 'delighted' || cath === 'wink') return 'rattled'
  if (cath === 'worried') return 'gloat'
  return 'smug'
}
