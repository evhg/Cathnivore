// Plan item 556: the desktop campaign's progress bunting, one pennant per chapter, as pure state so a unit test can
// check that the flags match the campaign's progress: a won chapter's flag is dyed and ticked, the rest plain calico
// with the chapter's number.

export const PENNANT_DYES = ['clay', 'wheat', 'pasture', 'sea', 'clay', 'wheat'] as const
export type PennantDye = (typeof PENNANT_DYES)[number]

export interface Pennant {
  id: string
  /** 1-based chapter number. */
  n: number
  won: boolean
  /** The flag's dye once won; undefined while it is plain calico. */
  dye?: PennantDye
  /** What the flag says to a screen reader (and the pointer's tooltip). */
  label: string
}

export function buntingFlags(chapters: { id: string; title: string }[], completed: readonly string[]): Pennant[] {
  return chapters.map((c, i) => {
    const won = completed.includes(c.id)
    return {
      id: c.id,
      n: i + 1,
      won,
      dye: won ? PENNANT_DYES[i % PENNANT_DYES.length] : undefined,
      label: `Chapter ${i + 1}, ${c.title}: ${won ? 'won' : 'not yet won'}`,
    }
  })
}

export function chaptersWon(chapters: { id: string }[], completed: readonly string[]): number {
  return chapters.filter((c) => completed.includes(c.id)).length
}
