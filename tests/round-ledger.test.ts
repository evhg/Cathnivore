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
    expect(r.map((x) => [x.kind, x.delta, x.round])).toEqual([['trust', -2, 3], ['land', -1, 3]])
    expect(receiptsFor(a, { ...a, log: [sq('rivermead', false, 0)] } as GameState, () => ++id)).toEqual([])
  })
})
