import { describe, expect, it } from 'vitest'
import { ACTION_TERMS, GLOSSARY_TERMS, GLOSSARY_LOOKUP } from '../src/content/terms'

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
})
