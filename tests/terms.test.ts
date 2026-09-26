import { describe, expect, it } from 'vitest'
import { ACTION_TERMS, GLOSSARY_TERMS, GLOSSARY_LOOKUP } from '../src/content/terms'
import { DIFFICULTY_SETTINGS } from '../src/content/difficulty'
import { POOL_SIZES } from '../src/engine/pieces'
import { STALL_LOSS_MARGIN } from '../src/engine/enemy'

// SPEC 10.5: "Every game term ... is explained in the rules reference and in a tap or hover tooltip."
// `RulesReference.tsx` and `Tooltip.tsx` both read this one module, so this just guards the shared data
// itself rather than either UI (covered separately by e2e).
describe('terms glossary', () => {
  for (const entry of [...GLOSSARY_TERMS, ...ACTION_TERMS]) {
    it(`${entry.term}: has non-empty body text`, () => {
      expect(entry.term.length).toBeGreaterThan(0)
      expect(entry.body.length).toBeGreaterThan(0)
    })
  }

  it('has no duplicate terms across the two lists', () => {
    const names = [...GLOSSARY_TERMS, ...ACTION_TERMS].map((e) => e.term)
    expect(new Set(names).size).toBe(names.length)
  })

  it('GLOSSARY_LOOKUP resolves every glossary and action term', () => {
    for (const entry of [...GLOSSARY_TERMS, ...ACTION_TERMS]) {
      expect(GLOSSARY_LOOKUP[entry.term]).toBe(entry.body)
    }
  })

  // SPEC 10.5: the rules reference's prose about mechanics must never disagree with the engine/content
  // it describes. Regression for a real drift found in review: "Lost Land" said "8 at Normal" in prose
  // while `DIFFICULTY_SETTINGS.normal.lostLandPool` had moved to 10 across several balance-loop passes,
  // with nothing checking the two against each other (unlike card text, which `rules-text.test.ts` checks
  // against `onBuy`/`effect`). These entries are now built from the same constants, so this just guards
  // that no one re-hardcodes a number that can later drift out from under it.
  function body(term: string): string {
    const found = GLOSSARY_TERMS.find((e) => e.term === term)
    if (!found) throw new Error(`no glossary entry for ${term}`)
    return found.body
  }

  it('Lost Land pool size matches DIFFICULTY_SETTINGS.normal', () => {
    expect(body('Lost Land')).toContain(`${DIFFICULTY_SETTINGS.normal.lostLandPool} at Normal`)
  })

  it('Public Trust starting value matches DIFFICULTY_SETTINGS.normal', () => {
    expect(body('Public Trust')).toContain(`starts at ${DIFFICULTY_SETTINGS.normal.publicTrust}`)
  })

  it('Outlet/Buyout/Doubt pool sizes match engine/pieces.ts POOL_SIZES', () => {
    expect(body('Outlet')).toContain(`pool of ${POOL_SIZES.outlet}`)
    expect(body('Buyout')).toContain(`pool of ${POOL_SIZES.buyout}`)
    expect(body('Doubt')).toContain(`pool of ${POOL_SIZES.doubt}`)
  })

  it('Squeeze stall-loss margin matches engine/enemy.ts STALL_LOSS_MARGIN', () => {
    expect(body('Squeeze')).toContain(`Defence + ${STALL_LOSS_MARGIN}`)
  })
})
