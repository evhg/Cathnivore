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

/**
 * Plan item 75: Cath on the desktop Setup reacts to the picks: waiting with a smirk for the first two, delighted
 * by her favourite pair, a wink for any other good pair, and set and determined when Hard is chosen.
 */
export function setupCath(
  picked: readonly ProducerId[],
  difficulty: 'easy' | 'normal' | 'hard',
  names: Record<ProducerId, string>,
): { expression: 'smirk' | 'delighted' | 'determined' | 'wink'; line: string } {
  if (picked.length === 0) return { expression: 'smirk', line: 'Pick two producers who’ll cover each other, love.' }
  if (picked.length === 1) return { expression: 'smirk', line: `${names[picked[0]!].split(' ').slice(-2).join(' ')}. And who stands beside them?` }
  const [a, b] = picked as [ProducerId, ProducerId]
  const line = pairLine(a, b)
  if (difficulty === 'hard') return { expression: 'determined', line: `${line} Hard, though. Eyes open.` }
  return { expression: pairKey(a, b) === 'mara+tomas' ? 'delighted' : 'wink', line }
}
