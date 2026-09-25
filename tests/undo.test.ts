import { describe, expect, it } from 'vitest'
import { isIrreversible } from '../src/ui/undo'
import type { Action } from '../src/engine/types'

// SPEC 4.6: "any action that reveals hidden information ... is marked irreversible, and undo cannot go
// back past it." Steak-out is the only card that does this so far (src/content/schemes.ts).
describe('isIrreversible', () => {
  it('flags playing Steak-out', () => {
    const action: Action = { kind: 'scheme', schemeId: 'steak-out' }
    expect(isIrreversible(action)).toBe(true)
  })

  it('does not flag an ordinary Scheme', () => {
    const action: Action = { kind: 'scheme', schemeId: 'grass-roots' }
    expect(isIrreversible(action)).toBe(false)
  })

  it('does not flag non-Scheme actions', () => {
    const action: Action = { kind: 'graft' }
    expect(isIrreversible(action)).toBe(false)
  })
})
