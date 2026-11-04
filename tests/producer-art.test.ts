import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ProducerArt from '../src/ui/portraits/ProducerArt'
import Portrait from '../src/ui/portraits/Portrait'
import { PRODUCER_ART_IDS, producerFace } from '../src/ui/portraits/producerFaces'
import { ALL_PRODUCER_IDS } from '../src/content/producers'

// Plan item 80: every producer is drawn with neutral, delighted and worried faces, and they differ.
const draw = (id: string, expression?: 'delighted' | 'worried') => renderToStaticMarkup(createElement(ProducerArt, { character: id, size: 100, expression }))

describe('producer portraits', () => {
  it('covers every producer', () => {
    expect([...PRODUCER_ART_IDS].sort()).toEqual([...ALL_PRODUCER_IDS].sort())
  })
  it.each(PRODUCER_ART_IDS)('%s has three faces that differ', (id) => {
    const faces = [draw(id), draw(id, 'delighted'), draw(id, 'worried')]
    expect(faces[0]).toContain('data-face="neutral"')
    expect(faces[1]).toContain('data-face="delighted"')
    expect(faces[2]).toContain('data-face="worried"')
    const strip = (s: string) => s.replace(/data-face="\w+"/, '').replace(/pa-[^-"]+-/g, 'pa-')
    expect(new Set(faces.map(strip)).size).toBe(3)
  })
  it('folds Cath\'s expression names into the three faces', () => {
    expect(producerFace('wink')).toBe('delighted')
    expect(producerFace('determined')).toBe('neutral')
    expect(producerFace(undefined)).toBe('neutral')
  })
  it('Portrait draws producers with the new art and the rest of the cast as before', () => {
    expect(renderToStaticMarkup(createElement(Portrait, { character: 'mara' }))).toContain('producer-art')
    expect(renderToStaticMarkup(createElement(Portrait, { character: 'pell' }))).not.toContain('producer-art')
  })
})
