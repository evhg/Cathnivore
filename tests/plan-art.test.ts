import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { PlanArt, type PlanKind } from '../src/ui/icons/HollowellArt'

// Plan item 100: each of Hollowell's moves has its own picture.
describe("Hollowell's plan art", () => {
  const kinds: PlanKind[] = ['squeeze', 'expand', 'scout', 'buyout']
  const body = (k: PlanKind) =>
    renderToStaticMarkup(createElement(PlanArt, { kind: k }))
      .replace(/hp-[a-z]+/g, 'hp')
      .replace(/data-plan-art="[a-z]+"/, '')
  it('draws a distinct picture for every kind', () => {
    const seen = new Set(kinds.map(body))
    expect(seen.size).toBe(kinds.length)
  })
  it('marks each picture with its kind and hides it from screen readers', () => {
    for (const k of kinds) {
      const html = renderToStaticMarkup(createElement(PlanArt, { kind: k }))
      expect(html).toContain(`data-plan-art="${k}"`)
      expect(html).toContain('aria-hidden="true"')
    }
  })
})
