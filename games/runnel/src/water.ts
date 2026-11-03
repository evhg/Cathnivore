// Plan item 61: when the water reaches each tile, and which bank of a ditch the sun is on. Pure, so the timing
// and the light are unit-tested; board.ts draws them.

import type { TimeOfDay } from './sky'

/** Time for water to cross one tile: in by one spoke, through the hub, out by the others. */
export const CASCADE_MS = 110

/**
 * The tiles wet by `t` ms after a turn joins them, from each tile's depth along the river (0 at the spring)
 * and the shallowest newly joined depth: water runs tile by tile, so a longer path takes longer to fill.
 * `settle` is the turn's own animation before the water moves.
 */
export function waterFront(depths: ReadonlyMap<number, number>, t: number, settle = 0): Set<number> {
  let min = Infinity
  for (const d of depths.values()) min = Math.min(min, d)
  const out = new Set<number>()
  for (const [i, d] of depths) if (t >= arrivalMs(d, min, settle)) out.add(i)
  return out
}

/** When the water arrives at a tile `depth` deep, if the first newly joined tile is `minDepth` deep. */
export function arrivalMs(depth: number, minDepth: number, settle = 0): number {
  return settle + Math.max(0, depth - minDepth) * CASCADE_MS
}

/** Where the light comes from at each time of day, as a unit vector in board space (y down). */
const LIGHT: Record<TimeOfDay, [number, number]> = {
  morning: [-0.8, -0.6],
  noon: [-0.2, -0.98],
  golden: [0.85, -0.53],
  dusk: [0.96, -0.28],
}

/**
 * Whether the bank on the `side` (+1 or -1, the spoke's left or right normal) of a spoke pointing at `angleDeg`
 * (board space, after the tile's turn) is sunlit: a ditch's far bank faces the light, its near bank is in shade.
 */
export function bankSunlit(angleDeg: number, side: 1 | -1, time: TimeOfDay): boolean {
  const a = (Math.PI / 180) * angleDeg
  const nx = -Math.sin(a) * side
  const ny = Math.cos(a) * side
  const [lx, ly] = LIGHT[time]
  return nx * lx + ny * ly < 0
}
