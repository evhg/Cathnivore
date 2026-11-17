// Plan item 476: the Harvest moment's pacing, kept apart from the component so it can be unit-tested.
/** The flight's timing for `n` goods: each good's flight, the stagger between them, and the whole moment (900-1600 ms). */
export function harvestTiming(n: number): { flight: number; step: number; total: number } {
  const step = n > 1 ? Math.min(110, 800 / (n - 1)) : 0
  const flight = Math.max(700, 900 - step * Math.max(0, n - 1))
  return { flight, step, total: Math.round(flight + step * Math.max(0, n - 1)) }
}
