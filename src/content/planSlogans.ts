// Plan item 531: Hollowell's quarterly plan speaks in Graham Pell's voice. Each move carries a slogan off the
// company's own deck (VISION: the corporations glossy and clinical, the contrast being the joke). The plaque's
// tab shows the slogan of the move you look at; the card's id picks one, so a move keeps its line while it rides
// the conveyor and a new card brings a new line.

export type PlanSlot = 'squeeze' | 'expand' | 'scout'

export const PLAN_SLOGANS: Record<PlanSlot, readonly string[]> = {
  squeeze: [
    'Efficiency is a kindness.',
    'We prefer the word consolidation.',
    'Less choice, more value.',
    'Nothing personal. Strictly growth.',
  ],
  expand: [
    'Bringing convenience to {region}.',
    '{region} deserves a better offer.',
    'Opening soon in {region}.',
    'A brighter {region}, by Hollowell.',
  ],
  scout: [
    "Just looking. For now.",
    'Every field is a future site.',
    'We listen to the market.',
    'Exploring local opportunities.',
  ],
}

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

/** The slogan for the move in `slot` holding the card `cardId`; `region` names its first target, if any. */
export function planSlogan(slot: PlanSlot, cardId: string | undefined, region?: string): string {
  if (!cardId) return 'Space available. Enquire within.'
  const lines = PLAN_SLOGANS[slot].filter((l) => region || !l.includes('{region}'))
  const pool = lines.length ? lines : PLAN_SLOGANS.scout
  return pool[hash(`${slot}:${cardId}`) % pool.length]!.replace('{region}', region ?? '')
}
