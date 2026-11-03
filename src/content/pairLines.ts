import type { ProducerId } from '../engine/types'

/**
 * Plan item 54: Cath's one line on the pair you've picked, shown under the two lifted cards on the phone
 * Setup. One line per unordered pair; the order you picked them in doesn't change what she says.
 */
const LINES: Record<string, string> = {
  'mara+tomas': 'Tomas opens the stalls, Mara keeps Hollowell off them. My favourite pair.',
  'ines+mara': 'Mara blocks the spread, Ines clears the Doubt behind it. Slow and sure.',
  'mara+sol': 'Mara holds the line while Sol keeps the town on our side.',
  'ines+tomas': 'Tomas plants stalls, Ines keeps them healthy. A good honest market.',
  'sol+tomas': 'Stalls everywhere and the whole town listening. Loud, love, but it works.',
  'ines+sol': 'Doubt cleared and Trust up: they win hearts, so watch the borders.',
}

export function pairKey(a: ProducerId, b: ProducerId): string {
  return [a, b].sort().join('+')
}

export function pairLine(a: ProducerId, b: ProducerId): string {
  return LINES[pairKey(a, b)] ?? 'Two good hands. Let’s see what they make of it.'
}
