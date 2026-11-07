import { describe, expect, it } from 'vitest'
import { receiptCaption, receiptsFor } from '../src/ui/roundLedger'
import type { GameEvent, GameState } from '../src/engine/types'

// Plan item 190: the desktop rail's ledger prints a receipt per change to Trust or the land left, captioned by what
// moved it; a whole Hollowell turn arrives as one step, so the caption names every region it squeezed.
const sq = (region: string, lostLand: boolean, trustLoss: number) =>
  ({ type: 'squeeze', region, lostLand, stallRemoved: false, trustLoss }) as GameEvent

describe('round ledger', () => {
  it('names every region a turn squeezed', () => {
    const ev = [sq('highmoor', true, 0), { type: 'expand', region: 'oakvale', piece: 'outlet' } as GameEvent, sq('saltmarsh', true, 2)]
    expect(receiptCaption(ev, 'land', -2)).toBe('Squeezed in Highmoor and Saltmarsh.')
    expect(receiptCaption(ev, 'trust', -2)).toBe('Squeezed in Saltmarsh.')
  })
  it('credits a liberation for Trust won, and Hollowell for an unexplained loss on its turn', () => {
    expect(receiptCaption([{ type: 'liberated', region: 'oakvale', producer: 'mara' } as GameEvent], 'trust', 1)).toBe('Oakvale liberated.')
    expect(receiptCaption([{ type: 'scout', region: 'oakvale', doubtAdded: true } as GameEvent], 'trust', -1)).toBe("Lost on Hollowell's turn.")
  })
  it('prints one receipt per changed figure and none for a quiet step', () => {
    const a = { publicTrust: 10, lostLandPool: 10, round: 2, log: [] } as unknown as GameState
    const b = { publicTrust: 8, lostLandPool: 9, round: 3, log: [sq('rivermead', true, 2)] } as unknown as GameState
    let id = 0
    const r = receiptsFor(a, b, () => ++id)
    expect(r.map((x) => [x.kind, x.delta, x.round])).toEqual([['trust', -2, 3], ['land', -1, 3], ['round', 0, 2]])
    expect(receiptsFor(a, { ...a, log: [sq('rivermead', false, 0)] } as GameState, () => ++id)).toEqual([])
  })

  // Plan item 244: each move writes its own line with the mover's Marks change and running Marks, in order.
  it('writes a line per move with the Marks it made, and folds Trust a move won into its line', () => {
    const prod = (marks: number) => ({ mara: { resources: { produce: 3, marks, goodwill: 1 } } })
    const sell = { type: 'action', producer: 'mara', action: { kind: 'sell', count: 2 } } as GameEvent
    const supply = { type: 'action', producer: 'mara', action: { kind: 'supplyOutlets', region: 'oakvale', count: 1 } } as GameEvent
    const a = { publicTrust: 10, lostLandPool: 10, round: 1, log: [], producers: prod(2) } as unknown as GameState
    const b = { ...a, log: [sell], producers: prod(4) } as unknown as GameState
    const c = { ...b, publicTrust: 11, log: [sell, supply], producers: prod(3) } as unknown as GameState
    let id = 0
    const [one] = receiptsFor(a, b, () => ++id)
    expect(one).toMatchObject({ kind: 'action', caption: 'Sold 2 Produce', delta: 2, marks: 4 })
    const two = receiptsFor(b, c, () => ++id)
    expect(two).toHaveLength(1)
    expect(two[0]).toMatchObject({ kind: 'action', caption: '1 Outlet supplied, Oakvale', delta: -1, marks: 3, trust: 1 })
  })
  it('writes the Harvest that a round-ending step brings on its own line, so the Marks column meets the mat', () => {
    const prod = (marks: number) => ({ mara: { resources: { produce: 3, marks, goodwill: 1 }, production: { produce: 2, marks: 1, goodwill: 1 } } })
    const sell = { type: 'action', producer: 'mara', action: { kind: 'sell', count: 1 } } as GameEvent
    const a = { publicTrust: 10, lostLandPool: 10, round: 1, log: [], producers: prod(2) } as unknown as GameState
    const b = { ...a, round: 2, log: [sell], producers: prod(4) } as unknown as GameState
    let id = 0
    const r = receiptsFor(a, b, () => ++id)
    expect(r.map((x) => [x.kind, x.delta, x.marks])).toEqual([['action', 1, 3], ['round', 0, undefined], ['harvest', 1, 4]])
  })
})
