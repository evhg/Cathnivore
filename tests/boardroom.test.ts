import { describe, expect, it } from 'vitest'
import { boardroomBeat, cathReply, EXECS, execFor, flightsFor, stripDock } from '../src/ui/boardroom'
import type { GameEvent } from '../src/engine/types'

// Plan item 11: who plays each enemy-turn step, with which face, and which bark.
describe('boardroom barks', () => {
  const expandDoubt: GameEvent = { type: 'expand', region: 'highmoor', piece: 'doubt' }
  const expandOutlet: GameEvent = { type: 'expand', region: 'saltmarsh', piece: 'outlet' }
  const squeezeHit: GameEvent = { type: 'squeeze', region: 'oakvale', lostLand: true, stallRemoved: false, trustLoss: 0 }
  const squeezeHeld: GameEvent = { type: 'squeeze', region: 'oakvale', lostLand: false, stallRemoved: false, trustLoss: 0 }
  const candorCard: GameEvent = { type: 'agenda', cardId: 'candor-natural-risk-factor', bonusSkipped: false } as GameEvent
  const hollowellCard: GameEvent = { type: 'agenda', cardId: 'hollowell-farmhouse-range', bonusSkipped: false } as GameEvent

  it('gives Doubt and Candor cards to Vane, Outlets, Buyouts and Squeeze to Pell', () => {
    expect(execFor(expandDoubt)).toBe('vane')
    expect(execFor(candorCard)).toBe('vane')
    expect(execFor(expandOutlet)).toBe('pell')
    expect(execFor(hollowellCard)).toBe('pell')
    expect(execFor(squeezeHit)).toBe('pell')
    expect(EXECS.vane.faction).toBe('candor')
  })

  it('gloats when a Squeeze lands, is rattled when it holds or a region is liberated', () => {
    expect(boardroomBeat(squeezeHit, 0)!.mood).toBe('gloat')
    expect(boardroomBeat(squeezeHeld, 0)!.mood).toBe('rattled')
    expect(boardroomBeat({ type: 'liberated', region: 'highmoor', producer: 'mara' } as GameEvent, 0)!.mood).toBe('rattled')
    expect(boardroomBeat(expandOutlet, 0)!.mood).toBe('smug')
  })

  it('picks the same bark for the same step, fills in the region, and never leaves a placeholder', () => {
    const a = boardroomBeat(expandOutlet, 2)!
    expect(boardroomBeat(expandOutlet, 2)!.bark).toBe(a.bark)
    for (let step = 0; step < 12; step++) {
      for (const e of [expandDoubt, expandOutlet, squeezeHit, squeezeHeld, candorCard, hollowellCard]) {
        const beat = boardroomBeat(e, step)!
        expect(beat.bark).not.toContain('{region}')
        expect(beat.bark.length).toBeGreaterThan(8)
        expect(beat.card.length).toBeGreaterThan(0)
      }
    }
    // Different steps don't all say the same thing.
    const said = new Set(Array.from({ length: 12 }, (_, i) => boardroomBeat(expandOutlet, i)!.bark))
    expect(said.size).toBeGreaterThan(1)
  })

  it('gives Cath a reply to whoever spoke last', () => {
    expect(cathReply('pell', 'r3')).toBeTruthy()
    expect(cathReply('vane', 'r3')).not.toBe(cathReply('pell', 'r3'))
  })
})

// Plan item 11, slice 2: pieces fly out of the HQ of the corporation that owns them.
describe('boardroom flights', () => {
  it('sends an Expand piece from its own HQ to its hex', () => {
    expect(flightsFor({ type: 'expand', region: 'highmoor', piece: 'doubt' })).toEqual([{ faction: 'candor', piece: 'doubt', to: 'highmoor' }])
    expect(flightsFor({ type: 'expand', region: 'oakvale', piece: 'buyout' })).toEqual([{ faction: 'hollowell', piece: 'buyout', to: 'oakvale' }])
  })
  it('sends a Scout Outlet from Hollowell, and its Doubt from Candor', () => {
    expect(flightsFor({ type: 'scout', region: 'rivermead', doubtAdded: false })).toEqual([{ faction: 'hollowell', piece: 'outlet', to: 'rivermead' }])
    expect(flightsFor({ type: 'scout', region: 'rivermead', doubtAdded: true }).map((f) => f.faction)).toEqual(['hollowell', 'candor'])
  })
  it('flies nothing for a Squeeze or an Agenda card', () => {
    expect(flightsFor({ type: 'squeeze', region: 'oakvale', lostLand: true, stallRemoved: false, trustLoss: 0 })).toEqual([])
  })
  it('docks the strip away from the bottom row', () => {
    expect(stripDock('oakvale')).toBe('top')
    expect(stripDock('shingleBay')).toBe('top')
    expect(stripDock('highmoor')).toBe('bottom')
    expect(stripDock(undefined)).toBe('bottom')
  })
})
