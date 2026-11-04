import type { CathExpression } from '../../../shared/cath/cath'

// Plan item 92: Hollowell's face across the table, Julian Crisp. His mood mirrors Cath's: when her stall is winning
// he's rattled, when she digs in he's irritated, and the rest of the time (a Squeeze landed, an Outlet opened, an
// ordinary round) he's smug.
export type RivalFace = 'smug' | 'irritated' | 'rattled'
export const RIVAL_FACES: readonly RivalFace[] = ['smug', 'irritated', 'rattled']

export function rivalFace(cath?: CathExpression): RivalFace {
  if (cath === 'delighted' || cath === 'wink') return 'rattled'
  if (cath === 'determined') return 'irritated'
  return 'smug'
}

/** His one line for the corporate turn, by face. Short: it sits in a 2-line bubble beside his bust. */
export const RIVAL_LINES: Record<RivalFace, readonly string[]> = {
  smug: ['Hollowell thanks you for your custom.', 'Prices are down. Margins are up. Funny, that.', 'We love a local market. We bought three.'],
  irritated: ['Legal will be in touch.', 'Cute stall. Shame about the permits.', 'Somebody fetch me the quarterly forecast.'],
  rattled: ['This is a temporary dip.', 'Get me the board. No, the other board.', 'Nobody panic. I am not panicking.'],
}

export function rivalLine(face: RivalFace, round: number): string {
  const lines = RIVAL_LINES[face]
  return lines[round % lines.length]!
}
