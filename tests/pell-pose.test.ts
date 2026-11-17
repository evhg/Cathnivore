import { describe, expect, it } from 'vitest'
import { PELL_EVENT_POSE, pellPoseFor } from '../src/ui/portraits/rivalFace'

// Plan item 467: Graham Pell's pose for a batch of table events.
describe('pellPoseFor', () => {
  it('is rattled by a liberation above all', () => {
    expect(pellPoseFor([{ type: 'squeeze', region: 'oakvale', lostLand: true, stallRemoved: false, trustLoss: 0 }, { type: 'liberated', region: 'oakvale', producer: 'mara' }], true)).toBe('rattled')
  })
  it('gloats over a Squeeze', () => {
    expect(pellPoseFor([{ type: 'squeeze', region: 'oakvale', lostLand: false, stallRemoved: false, trustLoss: 1 }], true)).toBe('gloat')
  })
  it('schemes when tomorrow\'s papers move with nothing else to react to', () => {
    expect(pellPoseFor([], true)).toBe('scheme')
  })
  it('is smug at a new Outlet, and indifferent to Candor\'s Doubt', () => {
    expect(pellPoseFor([{ type: 'expand', region: 'oakvale', piece: 'outlet' } as never], false)).toBe('smug')
    expect(pellPoseFor([{ type: 'expand', region: 'oakvale', piece: 'doubt' } as never], false)).toBeNull()
  })
  it('has five distinct poses for the five events', () => {
    expect(new Set(Object.values(PELL_EVENT_POSE)).size).toBe(5)
  })
})
