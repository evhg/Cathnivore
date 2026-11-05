import { describe, expect, it } from 'vitest'
import { producerMoods } from '../src/ui/producerMood'
import type { GameEvent, RegionId, RegionState } from '../src/engine/types'

// Plan item 80: a role ability delights its producer; a Squeeze worries everyone with a Stall where it lands.
const region = (id: string, stalls: RegionState['stalls']): RegionState =>
  ({ id, stalls, outlets: 0, buyouts: 0, doubt: 0, lostLand: 0, liberated: false }) as unknown as RegionState

describe('producer moods', () => {
  const regions = { a: region('a', { mara: 1 }), b: region('b', { tomas: 1, ines: 0 }) } as unknown as Record<RegionId, RegionState>
  it('a role ability delights its producer', () => {
    const ev = [{ type: 'action', producer: 'sol', action: { kind: 'role' } }] as unknown as GameEvent[]
    expect(producerMoods(ev, regions)).toEqual({ sol: 'delighted' })
  })
  it('a Squeeze worries the producers with a Stall there, and only them', () => {
    const ev = [{ type: 'squeeze', region: 'b', lostLand: false, stallRemoved: true, trustLoss: 0 }] as unknown as GameEvent[]
    expect(producerMoods(ev, regions)).toEqual({ tomas: 'worried' })
  })
  it('later beats win: a Squeeze after an ability leaves the producer worried', () => {
    const ev = [
      { type: 'action', producer: 'mara', action: { kind: 'role' } },
      { type: 'squeeze', region: 'a', lostLand: true, stallRemoved: false, trustLoss: 1 },
    ] as unknown as GameEvent[]
    expect(producerMoods(ev, regions)).toEqual({ mara: 'worried' })
  })
  it('a liberation or a bought Improvement delights its producer (item 155)', () => {
    const ev = [
      { type: 'liberated', region: 'a', producer: 'mara' },
      { type: 'invest', producer: 'tomas', improvementId: 'x' },
    ] as unknown as GameEvent[]
    expect(producerMoods(ev, regions)).toEqual({ mara: 'delighted', tomas: 'delighted' })
  })
  it('other events leave faces alone', () => {
    const ev = [{ type: 'action', producer: 'mara', action: { kind: 'sell', count: 1 } }] as unknown as GameEvent[]
    expect(producerMoods(ev, regions)).toEqual({})
  })
})
