import { describe, expect, it } from 'vitest'
import { PLAN_SLOGANS, planSlogan } from '../src/content/planSlogans'

// Plan item 531: each move on Hollowell's plaque has a slogan in Pell's voice.
describe('planSlogan', () => {
  it('is stable for a card and names its region where the line takes one', () => {
    expect(planSlogan('expand', 'c12', 'Oakvale')).toBe(planSlogan('expand', 'c12', 'Oakvale'))
    for (let i = 0; i < 40; i++) {
      const line = planSlogan('expand', `c${i}`, 'Oakvale')
      expect(line).not.toContain('{region}')
      if (PLAN_SLOGANS.expand.every((l) => l.includes('{region}'))) expect(line).toContain('Oakvale')
    }
  })
  it('never leaves a placeholder without a region, and has a line for an empty slot', () => {
    for (const slot of ['squeeze', 'expand', 'scout'] as const)
      for (let i = 0; i < 20; i++) {
        const line = planSlogan(slot, `k${i}`)
        expect(line).not.toMatch(/\{|\}/)
        expect(line.length).toBeLessThanOrEqual(40)
      }
    expect(planSlogan('scout', undefined)).toMatch(/\S/)
  })
  it('uses more than one line per move across cards', () => {
    for (const slot of ['squeeze', 'expand', 'scout'] as const)
      expect(new Set(Array.from({ length: 30 }, (_, i) => planSlogan(slot, `id${i}`, 'Highmoor'))).size).toBeGreaterThan(1)
  })
})
