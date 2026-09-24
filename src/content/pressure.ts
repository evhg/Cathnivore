import type { PressureCard, RegionType } from '../engine/types'

// SPEC 4.7: Stage I is 3 single-type cards, Stage II is 4 (incl. Capital), Stage III is 3 two-type cards.
const STAGE_I: RegionType[][] = [['pasture'], ['crop'], ['coast']]
const STAGE_II: RegionType[][] = [['pasture'], ['crop'], ['coast'], ['capital']]
const STAGE_III: RegionType[][] = [
  ['pasture', 'crop'],
  ['crop', 'coast'],
  ['coast', 'pasture'],
]

export function unshuffledPressureDeck(): PressureCard[] {
  let n = 0
  const make = (stage: 1 | 2 | 3, types: RegionType[][]): PressureCard[] =>
    types.map((regionTypes) => ({ id: `pressure-${stage}-${n++}`, stage, regionTypes }))
  return [...make(1, STAGE_I), ...make(2, STAGE_II), ...make(3, STAGE_III)]
}
