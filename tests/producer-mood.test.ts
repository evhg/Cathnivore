import { describe, expect, it } from 'vitest'
import { producerMoods, producerPoses } from '../src/ui/producerMood'
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

// Plan item 594: the same beats strike a pose: a cheer for a gain, a raised finger for their own ability, a slump
// under a Squeeze on their Stall.
describe('producer poses', () => {
  const regions = { a: region('a', { mara: 1 }), b: region('b', { tomas: 1, ines: 0 }) } as unknown as Record<RegionId, RegionState>
  it('an ability points, a gain cheers, a Squeeze slumps', () => {
    expect(producerPoses([{ type: 'action', producer: 'sol', action: { kind: 'role' } }] as unknown as GameEvent[], regions)).toEqual({ sol: 'point' })
    expect(producerPoses([{ type: 'liberated', region: 'a', producer: 'mara' }, { type: 'invest', producer: 'ines', improvementId: 'x' }] as unknown as GameEvent[], regions)).toEqual({ mara: 'cheer', ines: 'cheer' })
    expect(producerPoses([{ type: 'squeeze', region: 'b', lostLand: false, stallRemoved: true, trustLoss: 0 }] as unknown as GameEvent[], regions)).toEqual({ tomas: 'slump' })
  })
  it('later beats win', () => {
    const ev = [
      { type: 'action', producer: 'mara', action: { kind: 'role' } },
      { type: 'squeeze', region: 'a', lostLand: true, stallRemoved: false, trustLoss: 1 },
    ] as unknown as GameEvent[]
    expect(producerPoses(ev, regions)).toEqual({ mara: 'slump' })
  })
})

describe('every producer draws all three poses (plan item 594)', () => {
  it('a raised arm for a cheer and a point, a slump without one, and the hanging sleeve faded, not removed', async () => {
    const { createElement } = await import('react')
    const { renderToStaticMarkup } = await import('react-dom/server')
    const Figure = (await import('../src/ui/portraits/Figure')).default
    for (const id of ['mara', 'tomas', 'ines', 'sol']) {
      const html = (pose?: 'cheer' | 'point' | 'slump') => renderToStaticMarkup(createElement(Figure, { character: id, pose }))
      const rest = html()
      expect(rest).not.toContain('data-pose')
      for (const pose of ['cheer', 'point'] as const) {
        const h = html(pose)
        expect(h, `${id} ${pose}`).toContain(`data-pose-arm="${pose}"`)
        expect(h.match(/fig-arm-off/g)?.length, `${id} ${pose}: one sleeve swapped`).toBe(1)
        expect(h).not.toBe(rest)
      }
      const slump = html('slump')
      expect(slump).toContain('data-pose="slump"')
      expect(slump).not.toContain('data-pose-arm')
    }
  })
})
