// Plan item 25: the plan cards' words come from planPreview(), which must agree with the enemy turn's own
// resolvers and never show a bare dash.
import { describe, expect, it } from 'vitest'
import { createGame } from '../src/engine/state'
import { resolveSqueeze, runEnemyTurn } from '../src/engine/enemy'
import { planPreview, SHORT_MAX } from '../src/engine/preview'
import { ALL_REGION_IDS } from '../src/content/map'
import type { GameConfig, GameState } from '../src/engine/types'

const CONFIG: GameConfig = { producers: ['mara', 'tomas'], difficulty: 'normal', activeRegions: ALL_REGION_IDS }

function rounds(seed: number, n: number): GameState[] {
  const out: GameState[] = []
  let s = createGame(CONFIG, seed)
  for (let i = 0; i < n && !s.result; i++) {
    out.push(s)
    s = runEnemyTurn(s)
  }
  return out
}

describe('planPreview', () => {
  it("the phone's short line fits two lines of a narrow card and names a region the card hits", () => {
    // Plan item 47: the full line ran past two lines of a 120 px phone card and was cut off.
    for (let seed = 1; seed <= 20; seed++) {
      for (const s of rounds(seed, 8)) {
        for (const slot of ['squeeze', 'expand', 'scout'] as const) {
          const p = planPreview(s, slot)
          expect(p.short.length, p.short).toBeLessThanOrEqual(SHORT_MAX)
          expect(p.short.trim().length).toBeGreaterThan(3)
          if (p.short !== p.summary) expect(p.regions.length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('never renders a bare dash, over 20 seeds and every round', () => {
    for (let seed = 1; seed <= 20; seed++) {
      for (const s of rounds(seed, 8)) {
        for (const slot of ['squeeze', 'expand', 'scout'] as const) {
          const p = planPreview(s, slot)
          expect(p.summary.trim().length).toBeGreaterThan(3)
          expect(p.summary).not.toMatch(/^[—-]$/)
        }
      }
    }
  })

  it("Squeeze names exactly the regions the resolver hits", () => {
    for (let seed = 1; seed <= 20; seed++) {
      for (const s of rounds(seed, 8)) {
        const hit = resolveSqueeze(s).log.slice(s.log.length).flatMap((e) => (e.type === 'squeeze' ? [e.region] : []))
        expect(planPreview(s, 'squeeze').regions).toEqual(hit)
      }
    }
  })

  it("the Scout card's regions are what it matches as next round's Expand card", () => {
    const [first] = rounds(3, 1)
    const p = planPreview(first!, 'scout')
    if (first!.scout) expect(p.summary).toMatch(/^Expands next round/)
    else expect(p.summary).toBe('Turns up at round end')
  })
})
