import type { CathExpression } from '../../../shared/cath/cath'

// Plan item 80: the producers with their own art (ProducerArt.tsx), and how Cath's expression names fold into
// their three faces.
export type ProducerFace = 'neutral' | 'delighted' | 'worried'
export const PRODUCER_ART_IDS = ['mara', 'tomas', 'ines', 'sol'] as const

export function producerFace(e?: CathExpression): ProducerFace {
  if (e === 'delighted' || e === 'wink') return 'delighted'
  if (e === 'worried') return 'worried'
  return 'neutral'
}
