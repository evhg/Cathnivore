import { describe, expect, it } from 'vitest'
import { pickExpression, pickRegion } from '../src/ui/teammatePick'

// Plan item 34: the AI teammate's face follows the reason for each pick, and the pick names its hex.
describe('teammate pick', () => {
  it('reads the reason for a face', () => {
    expect(pickExpression({ kind: 'openStall', region: 'saltmarsh' }, 'Liberating Saltmarsh.')).toBe('delighted')
    expect(pickExpression({ kind: 'rebut', region: 'oakvale', count: 1 }, "Clearing Doubt in Oakvale before it's squeezed next round.")).toBe('determined')
    expect(pickExpression({ kind: 'graft' }, 'Grafting to build up resources.')).toBe('smirk')
  })
  it('names the hex a regional pick lands on, and none for the rest', () => {
    expect(pickRegion({ kind: 'openStall', region: 'saltmarsh' })).toBe('saltmarsh')
    expect(pickRegion({ kind: 'graft' })).toBeUndefined()
  })
})
