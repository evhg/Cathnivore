import { describe, expect, it } from 'vitest'
import { LAYOUTS, layoutConfig, layoutNeighbors, layoutTypes, type LayoutId } from '../src/content/layouts'
import { REGIONS } from '../src/content/map'
import { createGame } from '../src/engine/state'
import type { RegionId } from '../src/engine/types'

// Plan item 15, slice 2: three layouts as data. Adjacency comes from the hexes (and the delta's bridges), types
// are dealt by the seed, and the ring with no seeding is exactly the printed board.

const IDS: LayoutId[] = ['ring', 'coast', 'delta']

function connected(ns: Partial<Record<RegionId, RegionId[]>>): boolean {
  const all = Object.keys(ns) as RegionId[]
  const seen = new Set<RegionId>([all[0]!])
  const todo = [all[0]!]
  while (todo.length)
    for (const n of ns[todo.pop()!] ?? []) {
      if (seen.has(n)) continue
      seen.add(n)
      todo.push(n)
    }
  return seen.size === all.length
}

describe('map layouts', () => {
  it('the ring is the printed board', () => {
    const ns = layoutNeighbors(LAYOUTS.ring)
    for (const [id, list] of Object.entries(ns) as [RegionId, RegionId[]][]) expect([...list].sort()).toEqual([...REGIONS[id].neighbors].sort())
    expect(layoutConfig('ring', 3)).toEqual({ activeRegions: expect.arrayContaining(Object.keys(LAYOUTS.ring.hexes)) })
  })
  for (const id of IDS)
    it(`${id}: symmetric, connected, Kingsmarket reachable from 3+ sides, types dealt from the mix`, () => {
      const l = LAYOUTS[id]
      const ns = layoutNeighbors(l)
      for (const [a, list] of Object.entries(ns) as [RegionId, RegionId[]][]) for (const b of list) expect(ns[b]).toContain(a)
      expect(connected(ns)).toBe(true)
      expect(ns.kingsmarket!.length).toBeGreaterThanOrEqual(3)
      const t = layoutTypes(l, 11, true)
      expect(t.kingsmarket).toBe('capital')
      expect(Object.values(t).filter((x) => x !== 'capital').sort()).toEqual([...l.mix].sort())
    })
  it('sizes: the ring and delta 7, the coast 10', () => {
    expect(Object.keys(LAYOUTS.ring.hexes)).toHaveLength(7)
    expect(Object.keys(LAYOUTS.coast.hexes)).toHaveLength(10)
    expect(Object.keys(LAYOUTS.delta.hexes)).toHaveLength(7)
  })
  it('the delta: channels cut the arms apart, the bridge joins Kingsmarket to Shingle Bay', () => {
    const ns = layoutNeighbors(LAYOUTS.delta)
    expect(ns.brindleHills).not.toContain('saltmarsh')
    expect(ns.oakvale).not.toContain('shingleBay')
    expect(ns.kingsmarket).toContain('shingleBay')
  })
  it('the same seed deals the same types; different seeds differ somewhere', () => {
    expect(layoutTypes(LAYOUTS.coast, 42)).toEqual(layoutTypes(LAYOUTS.coast, 42))
    const deals = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) => JSON.stringify(layoutTypes(LAYOUTS.coast, s))))
    expect(deals.size).toBeGreaterThan(1)
  })
  it('a delta game sets up from its own types', () => {
    const cfg = layoutConfig('delta', 5)
    const g = createGame({ producers: ['mara', 'tomas'], difficulty: 'normal', ...cfg }, 5)
    for (const id of cfg.activeRegions) if (cfg.regionTypes![id] === 'coast') expect(g.regions[id].doubt).toBeGreaterThanOrEqual(1)
  })
})

describe('whole games on every layout (plan item 15)', () => {
  for (const id of IDS)
    it(`${id}: Random and Heuristic bots finish games with no invariant failures`, async () => {
      const { applyAction } = await import('../src/engine/actions')
      const { validate } = await import('../src/engine/api')
      const { createRng } = await import('../src/engine/rng')
      const { RandomBot } = await import('../src/ai/random')
      const { HeuristicBot } = await import('../src/ai/heuristic')
      for (const bot of [RandomBot, HeuristicBot])
        for (let seed = 1; seed <= 3; seed++) {
          let state = createGame({ producers: ['mara', 'tomas'], difficulty: 'normal', ...layoutConfig(id, seed, true) }, seed)
          let rng = createRng(seed * 7919 + 3)
          let steps = 0
          for (; steps < 500 && !state.result; steps++) {
            const [action, next] = bot.chooseAction(state, rng)
            rng = next
            state = applyAction(state, action)
            expect(validate(state)).toEqual([])
          }
          expect(state.result, `${id} seed ${seed} finished`).toBeTruthy()
        }
    })
})
