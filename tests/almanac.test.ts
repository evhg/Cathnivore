import { describe, expect, it } from 'vitest'
import { ALMANAC, almanacSearch } from '../src/content/almanac'
import { ACTION_TERMS, GLOSSARY_TERMS } from '../src/content/terms'
import { IMPROVEMENTS } from '../src/content/improvements'
import { SCHEMES } from '../src/content/schemes'
import { ALL_PRODUCER_IDS, PRODUCERS } from '../src/content/producers'

// Plan item 56: every rules entry has an almanac page with a picture, and search covers every page.
describe('the almanac', () => {
  it('puts every action and glossary term on exactly one page', () => {
    for (const e of [...ACTION_TERMS, ...GLOSSARY_TERMS]) {
      expect(ALMANAC.filter((c) => c.terms.includes(e.term)).map((c) => c.id), e.term).toHaveLength(1)
    }
    const known = new Set([...ACTION_TERMS, ...GLOSSARY_TERMS].map((e) => e.term))
    for (const c of ALMANAC) for (const t of c.terms) expect(known.has(t), `${c.id}: ${t}`).toBe(true)
  })
  it('gives every page an illustration and a note from Cath', () => {
    for (const c of ALMANAC) {
      expect(c.illustration, c.id).toBeTruthy()
      expect(c.note.length, c.id).toBeGreaterThan(20)
    }
    expect(ALMANAC.flatMap((c) => c.galleries).sort()).toEqual(['agenda', 'difficulty', 'improvements', 'producers', 'schemes'])
  })
  it('finds every page, every card and every producer', () => {
    for (const c of ALMANAC) expect(almanacSearch(c.title)[0], c.title).toBe(c.id)
    for (const c of IMPROVEMENTS) expect(almanacSearch(c.name), c.name).toContain('investing')
    for (const c of SCHEMES) expect(almanacSearch(c.name), c.name).toContain('cards')
    for (const id of ALL_PRODUCER_IDS) expect(almanacSearch(PRODUCERS[id].name)).toContain('producers')
  })
  it('lands "Squeeze" on Hollowell’s page', () => {
    expect(almanacSearch('Squeeze')[0]).toBe('hollowell')
    expect(almanacSearch('squeeze')[0]).toBe('hollowell')
    expect(almanacSearch('')).toEqual([])
    expect(almanacSearch('zzzz-nothing')).toEqual([])
  })
})
