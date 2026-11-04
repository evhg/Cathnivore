import { describe, expect, it } from 'vitest'
import { actionFamily, familyOptionLabel } from '../src/ui/actionLabel'

// Plan item 83: Supply's removals and Rebut's counts fold into one card each; every other group stands alone.
describe('action families', () => {
  it('folds Supply and Rebut group keys and nothing else', () => {
    expect(actionFamily('supplyOutlets:1')).toBe('supply')
    expect(actionFamily('supplyOutlets:2')).toBe('supply')
    expect(actionFamily('supplyBuyout')).toBe('supply')
    expect(actionFamily('rebut:1')).toBe('rebut')
    expect(actionFamily('rebut:2')).toBe('rebut')
    for (const key of ['openStall', 'role', 'scheme:undercut']) expect(actionFamily(key)).toBeUndefined()
  })
  it('names each option short, for a key inside the card', () => {
    expect(familyOptionLabel('supplyOutlets:1')).toBe('1 Outlet')
    expect(familyOptionLabel('supplyOutlets:2')).toBe('2 Outlets')
    expect(familyOptionLabel('supplyBuyout')).toBe('Buyout')
    expect(familyOptionLabel('rebut:2')).toBe('2 Doubt')
  })
})
