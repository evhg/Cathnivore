import { describe, expect, it } from 'vitest'
import { setupCath } from '../src/content/pairLines'
import { PRODUCERS } from '../src/content/producers'
import type { ProducerId } from '../src/engine/types'

const names = Object.fromEntries(Object.entries(PRODUCERS).map(([id, p]) => [id, p.name])) as Record<ProducerId, string>

// Plan item 75: the desktop Setup's Cath reacts to each pick and to the difficulty.
describe('setupCath', () => {
  it('waits for two picks, then speaks to the pair', () => {
    expect(setupCath([], 'normal', names).expression).toBe('smirk')
    expect(setupCath(['ines'], 'normal', names).line).toMatch(/Ines Farrow|Farrow/)
    expect(setupCath(['mara', 'tomas'], 'normal', names)).toEqual({ expression: 'delighted', line: expect.stringMatching(/favourite pair/) })
    expect(setupCath(['sol', 'ines'], 'easy', names).expression).toBe('wink')
  })
  it('steels herself for Hard', () => {
    const c = setupCath(['mara', 'tomas'], 'hard', names)
    expect(c.expression).toBe('determined')
    expect(c.line).toMatch(/Hard/)
  })
  it('says the same of a pair whichever order it was picked in', () => {
    expect(setupCath(['tomas', 'sol'], 'normal', names).line).toBe(setupCath(['sol', 'tomas'], 'normal', names).line)
  })
})
