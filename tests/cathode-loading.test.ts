// C14 (docs/design/cathode-combat.md S9.6): the loading screen is a case file. It never shows a district the player
// hasn't reached, carries no control tips, and its percentage never jumps more than 4% a frame.
import { describe, expect, it } from 'vitest'
import { THE_LIST, districtReached, easeLoad, loadingCard } from '../games/cathode/src/ui/frontcopy'

const ALL = ['market', 'clinic', 'plaza', 'tower', 'vault']
const BOSSES = THE_LIST.map((n) => n.job)
// Every prefix of the boss order, plus a few other job sets.
const SAVES: string[][] = [[], ['fishMarket'], ...BOSSES.map((_, i) => BOSSES.slice(0, i + 1)), ['vaneBoss'], ['boardBoss', 'fishMarket']]

describe('loadingCard', () => {
  it('never returns an unvisited district (the spoiler guard)', () => {
    for (const done of SAVES)
      for (const target of [...ALL, undefined, 'nowhere']) {
        const c = loadingCard(done, target)
        expect(districtReached(c.district, done)).toBe(true)
        if (target && districtReached(target, done)) expect(c.district).toBe(target)
      }
    expect(loadingCard([], 'vault').district).toBe('market')
    expect(loadingCard(['crispBoss'], 'clinic').district).toBe('clinic')
    expect(loadingCard(['crispBoss'], 'plaza').district).toBe('market')
  })

  it('never names a target the player has not reached on the list', () => {
    const c = loadingCard([], 'market')
    expect(c.name).toBe('Julian Crisp')
    expect(c.list.map((r) => r.name)).toEqual(['Julian Crisp'])
    expect(c.sealed).toBe(4)
    const later = loadingCard(['crispBoss', 'vaneBoss'], 'plaza')
    expect(later.name).toBe('Councillor Marcus Pell')
    expect(later.list.filter((r) => r.done).length).toBe(2)
  })

  it('has no control tips, and the lore stays under 55 words', () => {
    const tip = /\b(press|click|tap|hold|key|keys|wasd|mouse|button|controls?|aim down|reload|sprint|crouch|tip)\b/i
    for (const done of SAVES)
      for (const target of ALL) {
        const c = loadingCard(done, target, { travel: true })
        for (const text of [c.place, c.name, c.lore, ...c.list.map((r) => r.name)]) expect(text).not.toMatch(tip)
        expect(c.lore.split(/\s+/).length).toBeLessThanOrEqual(55)
      }
  })

  it('strikes through only the names dealt with since the list was last seen', () => {
    const c = loadingCard(['crispBoss', 'vaneBoss'], 'plaza', { seen: 1 })
    expect(c.list.map((r) => r.fresh)).toEqual([false, true, false])
    expect(loadingCard(['crispBoss'], 'clinic').list.some((r) => r.fresh)).toBe(false)
  })
})

describe('easeLoad', () => {
  it('eases toward the share and never moves more than 4% a frame', () => {
    let shown = 0
    const targets = [0.4, 0.4, 0.9, 1, 1]
    let frames = 0
    for (const t of targets)
      for (let i = 0; i < 40; i++) {
        const next = easeLoad(shown, t)
        expect(next - shown).toBeLessThanOrEqual(0.04 + 1e-9)
        expect(next).toBeGreaterThanOrEqual(shown)
        shown = next
        frames++
      }
    expect(shown).toBe(1)
    expect(frames).toBe(200)
  })
})

// The district titles and flavour lines the session still uses (kept from before C14).
describe('loading card title', () => {
  it('names the district and act', async () => {
    const { loadingTitle } = await import('../games/cathode/src/game/zones')
    expect(loadingTitle(undefined)).toContain('Drowned Market')
    expect(loadingTitle('clinic')).toBe('Act 2 · The Candor Clinic')
  })
  it('has a distinct flavour line per district', async () => {
    const { loadingFlavour } = await import('../games/cathode/src/game/zones')
    const lines = [undefined, 'clinic', 'plaza', 'tower', 'vault'].map((d) => loadingFlavour(d))
    expect(new Set(lines).size).toBe(5)
  })
})
