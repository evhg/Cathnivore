import type { CathExpression } from '../../../shared/cath/cath'
import type { ExecMood } from '../boardroom'
import type { GameEvent } from '../../engine/types'
import type { PellPose } from './ExecPortrait'

// Plan item 92: Hollowell's face across the table, Graham Pell (the boardroom's Hollowell, plan item 11), in his
// three boardroom moods. His mood mirrors Cath's: rattled when her stall is winning, gloating when she is worried
// (a Squeeze landed, land lost), and smug the rest of the time.
export const RIVAL_MOODS: readonly ExecMood[] = ['smug', 'gloat', 'rattled']

export function rivalMood(cath?: CathExpression): ExecMood {
  if (cath === 'delighted' || cath === 'wink') return 'rattled'
  if (cath === 'worried') return 'gloat'
  return 'smug'
}

/** Plan item 467: what the table does to Graham Pell, as a staged test event or a game's own. */
export type PellEvent = 'expand' | 'squeeze' | 'intents' | 'liberate' | 'win'

export const PELL_EVENT_POSE: Record<PellEvent, PellPose> = {
  expand: 'smug',
  squeeze: 'gloat',
  intents: 'scheme',
  liberate: 'rattled',
  win: 'defeated',
}

/**
 * Plan item 467: Pell's pose for a batch of new log events, the most telling first: a liberation rattles him, a
 * Squeeze that lands is his to gloat over, a new Outlet or Buyout leaves him smug; `papersMoved` (tomorrow's
 * papers changed with nothing else to react to) sets him scheming. `null` when nothing concerns him.
 */
export function pellPoseFor(events: readonly GameEvent[], papersMoved: boolean): PellPose | null {
  if (events.some((e) => e.type === 'liberated' || e.type === 'riftSplit')) return 'rattled'
  if (events.some((e) => e.type === 'squeeze')) return 'gloat'
  if (papersMoved) return 'scheme'
  if (events.some((e) => e.type === 'expand' && e.piece !== 'doubt')) return 'smug'
  return null
}
