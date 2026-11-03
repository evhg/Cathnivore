// Plan item 55: how far Hollowell has taken a region, as the board draws it. Pure, from the region's own pieces and
// the log, so the stages read the same in every save and replay.
//   0  free of them (or liberated)
//   1  a foothold: a glossy billboard by the landmark
//   2  dug in: the ground glazed cold, a delivery van parked
//   3  owned: the landmark boarded up under a SOLD sign
// Their weight is the Squeeze's own damage (Outlets + 2 x Buyouts) less the Doubt standing against them, so the
// stages fall back as Doubt and stalls push them out.

import type { GameEvent, GameState, RegionId, RegionState } from '../engine/types'

export type GripStage = 0 | 1 | 2 | 3

export function gripWeight(r: Pick<RegionState, 'outlets' | 'buyouts' | 'doubt'>): number {
  return r.outlets + 2 * r.buyouts - r.doubt
}

export function gripStage(r: Pick<RegionState, 'outlets' | 'buyouts' | 'doubt' | 'liberated'>): GripStage {
  if (r.liberated) return 0
  const w = gripWeight(r)
  return w <= 0 ? 0 : w <= 1 ? 1 : w <= 3 ? 2 : 3
}

/**
 * One step from Lost Land: the next Squeeze here would take ground if one more piece arrives (its damage already
 * equals the stalls defending it), so the tile flies a quiet warning flag.
 */
export function atTheEdge(r: Pick<RegionState, 'outlets' | 'buyouts' | 'stalls' | 'liberated'>): boolean {
  if (r.liberated) return false
  const damage = r.outlets + 2 * r.buyouts
  const defence = Object.values(r.stalls).reduce((a, n) => a + (n ?? 0), 0)
  return damage > 0 && damage === defence
}

const ENEMY: ReadonlySet<GameEvent['type']> = new Set(['squeeze', 'expand', 'scout', 'agenda'])

/** The regions the last enemy turn Squeezed (the log's most recent run of enemy events): they wilt until the next. */
export function squeezedLastTurn(state: Pick<GameState, 'log'>): Set<RegionId> {
  const out = new Set<RegionId>()
  let inTurn = false
  for (let i = state.log.length - 1; i >= 0; i--) {
    const e = state.log[i]!
    if (ENEMY.has(e.type)) {
      inTurn = true
      if (e.type === 'squeeze') out.add(e.region)
    } else if (inTurn && e.type === 'action') break
  }
  return out
}
