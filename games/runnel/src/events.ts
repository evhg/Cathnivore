// Bea's seasonal events: for three weeks each spring and autumn a limited set of five boards is on offer.
// Solve all five and Bea plants an exclusive crop in the garden that stays for good.

import type { Size } from './store'

export interface SeasonEvent {
  /** `spring-2026`: one event per season per year. */
  id: string
  name: string
  crop: string
  cropName: string
  boards: { code: string; size: Size; seed: string }[]
}

const SIZES: Size[] = ['small', 'medium', 'medium', 'large', 'large']
const LETTER: Record<Size, string> = { small: 'S', medium: 'M', large: 'L' }

function build(season: 'spring' | 'autumn', year: string): SeasonEvent {
  const tag = `${season}${year.slice(2)}`
  const boards = SIZES.map((size, i) => ({
    code: `${LETTER[size]}-${tag}-${i + 1}`,
    size,
    seed: `practice-${size}-${tag}-${i + 1}`,
  }))
  return season === 'spring'
    ? { id: `spring-${year}`, name: 'Blossom Fortnight', crop: '🌸', cropName: 'blossom tree', boards }
    : { id: `autumn-${year}`, name: 'Harvest Fortnight', crop: '🎃', cropName: 'giant pumpkin', boards }
}

/** The event running on `date` (YYYY-MM-DD): 1 to 21 April and 1 to 21 October. */
export function eventOn(date: string): SeasonEvent | null {
  const month = date.slice(5, 7)
  const day = Number(date.slice(8, 10))
  if (day < 1 || day > 21) return null
  if (month === '04') return build('spring', date.slice(0, 4))
  if (month === '10') return build('autumn', date.slice(0, 4))
  return null
}

/** The event a seed belongs to, with the board's index, so a solve can be credited. */
export function eventBoardOf(seed: string): { event: SeasonEvent; index: number } | null {
  const m = /^practice-(?:small|medium|large)-(spring|autumn)(\d\d)-([1-5])$/.exec(seed)
  if (!m) return null
  const event = build(m[1] as 'spring' | 'autumn', `20${m[2]}`)
  return { event, index: Number(m[3]) - 1 }
}

/** Marks a board solved. Returns the updated list and whether this solve finished the set. */
export function creditBoard(done: number[], index: number): { done: number[]; complete: boolean } {
  const next = done.includes(index) ? done : [...done, index].sort()
  return { done: next, complete: next.length === SIZES.length }
}

/** Past events whose crop the player has earned, as garden glyphs with a label. */
export function eventCrops(ids: string[]): { glyph: string; label: string }[] {
  return ids.map((id) => {
    const [season, year] = id.split('-')
    const e = build(season === 'spring' ? 'spring' : 'autumn', year ?? '2026')
    return { glyph: e.crop, label: `${e.name} ${year}: Bea's exclusive ${e.cropName}.` }
  })
}
