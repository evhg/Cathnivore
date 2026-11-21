import type { GameEvent, ProducerId, RegionId, RegionState } from '../engine/types'
import type { ProducerFace } from './portraits/producerFaces'

// Plan item 80: the producers' faces follow the turn's beats. A producer whose role ability fires (or, item 155,
// who liberates a region or buys an Improvement) is delighted;
// one with a Stall in a region a Squeeze lands on is worried. Later events win (the enemy turn's Squeezes come
// after the producers' actions). `regionsBefore` is the board before these events, so a Stall the Squeeze just
// removed still counts.
export function producerMoods(
  events: readonly GameEvent[],
  regionsBefore: Record<RegionId, RegionState>,
): Partial<Record<ProducerId, ProducerFace>> {
  const out: Partial<Record<ProducerId, ProducerFace>> = {}
  for (const e of events) {
    if (e.type === 'action' && e.action.kind === 'role') out[e.producer] = 'delighted'
    // Plan item 155: a gain cheers them too: a region they liberate, an Improvement bought (more income).
    if (e.type === 'liberated' || e.type === 'invest') out[e.producer] = 'delighted'
    if (e.type === 'squeeze') {
      const stalls = regionsBefore[e.region]?.stalls ?? {}
      for (const [p, n] of Object.entries(stalls)) if ((n ?? 0) > 0) out[p as ProducerId] = 'worried'
    }
  }
  return out
}

/** Plan item 594: the pose a producer strikes when a beat of theirs resolves: a cheer for a gain (a region they
 *  liberate, an Improvement bought, a big haul), a raised finger for their own role ability ("a point made"), a slump
 *  when a Squeeze lands on their Stall. Same precedence as the faces: later events win. */
export type ProducerPose = 'cheer' | 'point' | 'slump'
export const PRODUCER_POSES: readonly ProducerPose[] = ['cheer', 'point', 'slump']

export function producerPoses(
  events: readonly GameEvent[],
  regionsBefore: Record<RegionId, RegionState>,
): Partial<Record<ProducerId, ProducerPose>> {
  const out: Partial<Record<ProducerId, ProducerPose>> = {}
  for (const e of events) {
    if (e.type === 'action' && e.action.kind === 'role') out[e.producer] = 'point'
    if (e.type === 'liberated' || e.type === 'invest') out[e.producer] = 'cheer'
    if (e.type === 'squeeze') {
      const stalls = regionsBefore[e.region]?.stalls ?? {}
      for (const [p, n] of Object.entries(stalls)) if ((n ?? 0) > 0) out[p as ProducerId] = 'slump'
    }
  }
  return out
}
