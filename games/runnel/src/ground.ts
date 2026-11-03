// Plan item 50: what lies under each dry tile, so the board reads as farmland (meadow, a ploughed field,
// fallow straw) and water is the change, not the only colour. Pure: the seed and the cell pick it, so a board
// always looks the same and neighbours mostly differ.

import { hashString } from './engine'

export type Ground = 'fallow' | 'meadow' | 'field'
export const GROUNDS: Ground[] = ['fallow', 'meadow', 'field']

/** The ground for a cell. Two of three neighbours in a row never share one where the hash allows. */
export function groundFor(seed: string, q: number, r: number): Ground {
  // Base pattern: a three-colouring of the hex grid ((q - r) mod 3 never repeats on an edge neighbour), rotated by
  // the seed so each board starts somewhere new; then a few cells (1 in 6) are swapped by hash for a less
  // regular patchwork.
  const h = hashString(`ground:${seed}`)
  const tri = (((q - r + h) % 3) + 3) % 3
  const k = hashString(`ground:${seed}:${q},${r}`)
  return GROUNDS[k % 6 === 0 ? (tri + 1 + ((k >>> 4) % 2)) % 3 : tri]!
}

/** The angle a field's furrows run at (degrees): a multiple of 60, so the turned hex is the same hex. */
export function furrowAngle(seed: string, q: number, r: number): number {
  return [0, 60, 120][hashString(`furrow:${seed}:${q},${r}`) % 3]!
}
