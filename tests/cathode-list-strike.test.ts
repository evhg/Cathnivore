import { describe, expect, it } from 'vitest'
import { freshlyStruck, struckJobs } from '../games/cathode/src/ui/frontcopy'

describe('a name crossed off The List (plan item 137)', () => {
  it('strikes the case just closed, once', () => {
    expect(freshlyStruck(['fishMarket', 'crispBoss'], [])).toBe(0)
    expect(freshlyStruck(['fishMarket', 'crispBoss'], struckJobs(['fishMarket', 'crispBoss']))).toBe(-1)
  })
  it('nothing to strike on a fresh save or between bosses', () => {
    expect(freshlyStruck([], [])).toBe(-1)
    expect(freshlyStruck(['fishMarket', 'crispLead'], [])).toBe(-1)
  })
  it('strikes the newest when two closed away from the title', () => {
    expect(freshlyStruck(['crispBoss', 'vaneBoss'], [])).toBe(1)
    expect(freshlyStruck(['crispBoss', 'vaneBoss'], ['crispBoss'])).toBe(1)
  })
  it('remembers only names on the List', () => {
    expect(struckJobs(['fishMarket', 'crispBoss', 'pellBoss'])).toEqual(['crispBoss', 'pellBoss'])
  })
})
