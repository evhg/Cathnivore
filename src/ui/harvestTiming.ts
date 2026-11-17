// Plan item 476: the Harvest moment's pacing, kept apart from the component so it can be unit-tested.
/** The flight's timing for `n` goods: each good's flight, the stagger between them, and the whole moment (900-1600 ms). */
export function harvestTiming(n: number): { flight: number; step: number; total: number } {
  const step = n > 1 ? Math.min(110, 800 / (n - 1)) : 0
  const flight = Math.max(700, 900 - step * Math.max(0, n - 1))
  return { flight, step, total: Math.round(flight + step * Math.max(0, n - 1)) }
}

/** Plan item 476: the sound each good makes as it lands: a crate's wood, a Mark's coin, a rosette's paper. */
export const HARVEST_CUE = { produce: 'woodClack', marks: 'coinOne', goodwill: 'paperFlip' } as const

/** Landings closer than this share one sound, so a big haul chinks rather than buzzes. */
export const HARVEST_CUE_GAP_MS = 90

/**
 * Plan item 476: the producers whose haul this round is big enough to delight them (`min` goods or more), each
 * mapped to the index of its last good, so the bust lights up as the haul is complete.
 */
export function bigHauls(goods: readonly { producer: string }[], min = 3): Map<string, number> {
  const count = new Map<string, number>()
  const last = new Map<string, number>()
  goods.forEach((g, i) => {
    count.set(g.producer, (count.get(g.producer) ?? 0) + 1)
    last.set(g.producer, i)
  })
  const out = new Map<string, number>()
  for (const [p, n] of count) if (n >= min) out.set(p, last.get(p)!)
  return out
}
