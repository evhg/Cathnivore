// Board codes: a practice board is fully described by its seed and size, so a short code carries it between players.
// `M-lq8x1f-k2j9a` means a medium board; pasting it into Practice plays the very same board.

import type { Size } from './store'

const LETTER: Record<Size, string> = { small: 'S', medium: 'M', large: 'L' }
const SIZE_OF: Record<string, Size> = { S: 'small', M: 'medium', L: 'large' }

/** The shareable code for a practice seed, or null for any other seed (daily, orchard). */
export function boardCode(seed: string): string | null {
  const m = /^practice-(small|medium|large)-([a-z0-9]+)-([a-z0-9]+)$/.exec(seed)
  return m ? `${LETTER[m[1] as Size]}-${m[2]}-${m[3]}` : null
}

/** Reads a pasted code (any case, stray spaces allowed) back into a size and seed, or null if it is not one. */
export function parseBoardCode(text: string): { size: Size; seed: string } | null {
  const m = /^([sml])-([a-z0-9]{1,12})-([a-z0-9]{1,12})$/.exec(text.trim().toLowerCase().replace(/\s+/g, ''))
  if (!m) return null
  const size = SIZE_OF[m[1]!.toUpperCase()]
  return size ? { size, seed: `practice-${size}-${m[2]}-${m[3]}` } : null
}
