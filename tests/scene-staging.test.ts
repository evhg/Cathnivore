import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { moodOf, sidesFor } from '../src/ui/sceneStaging'
import Figure from '../src/ui/portraits/Figure'
import Backdrop from '../src/ui/scenes/Backdrop'
import { CHARACTERS } from '../src/content/characters'
import { CHAPTERS } from '../src/content/chapters'
import { SCENES as CH1 } from '../src/content/story/fresh-meat'
import { SCENES as CH6 } from '../src/content/story/kingsmarket'

// Plan item 5: the graphic-novel Scene's staging, cast figures and chapter backdrops.
describe('scene staging', () => {
  it('reads a mood off the punctuation', () => {
    expect(moodOf('Go!')).toBe('delighted')
    expect(moodOf('Really?')).toBe('worried')
    expect(moodOf('We wait...')).toBe('determined')
    expect(moodOf('Fine.')).toBeUndefined()
  })
  it('puts Cath on the left and everyone else on the right', () => {
    const sides = sidesFor(CH1.opening)
    expect(sides.get('cath')).toBe('left')
    expect(sides.get('mara')).toBe('right')
    expect(sides.get('pip')).toBe('right')
  })
  it('gives the first speaker the left when Cath is absent', () => {
    const sides = sidesFor(CH6.opening)
    expect(sides.get('ines')).toBe('left')
    expect(sides.get('tomas')).toBe('right')
  })
  it('draws every cast member at half length in every mood', () => {
    for (const id of Object.keys(CHARACTERS).filter((c) => c !== 'cath')) {
      for (const e of [undefined, 'delighted', 'worried', 'determined', 'wink'] as const) {
        const svg = renderToStaticMarkup(createElement(Figure, { character: id, expression: e }))
        expect(svg).toContain('viewBox="40 20 320 480"')
        expect(svg).toContain('fig-head')
      }
    }
  })
  it('paints a distinct backdrop for every chapter', () => {
    const paintings = CHAPTERS.map((c) => renderToStaticMarkup(createElement(Backdrop, { chapterId: c.id })))
    expect(paintings).toHaveLength(6)
    expect(new Set(paintings).size).toBe(6)
  })
})
