import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import RivalArt from '../src/ui/portraits/RivalArt'
import { RIVAL_FACES, RIVAL_LINES, rivalFace, rivalLine } from '../src/ui/portraits/rivalFace'

// Plan item 92: Julian Crisp, Hollowell's face, with three faces that mirror Cath's mood.
const draw = (face: (typeof RIVAL_FACES)[number]) => renderToStaticMarkup(createElement(RivalArt, { size: 96, face }))

describe('the rival portrait', () => {
  it('draws three faces that differ', () => {
    const faces = RIVAL_FACES.map(draw)
    RIVAL_FACES.forEach((f, i) => expect(faces[i]).toContain(`data-face="${f}"`))
    const strip = (s: string) => s.replace(/data-face="\w+"/, '').replace(/ra-[^-"]+-/g, 'ra-')
    expect(new Set(faces.map(strip)).size).toBe(3)
  })
  it('has an accessible name', () => {
    expect(draw('smug')).toMatch(/role="img" aria-label="Julian Crisp, Hollowell"/)
  })
  it('mirrors Cath: rattled when she is delighted, irritated when she digs in, smug otherwise', () => {
    expect(rivalFace('delighted')).toBe('rattled')
    expect(rivalFace('wink')).toBe('rattled')
    expect(rivalFace('determined')).toBe('irritated')
    expect(rivalFace('worried')).toBe('smug')
    expect(rivalFace('smirk')).toBe('smug')
    expect(rivalFace(undefined)).toBe('smug')
  })
  it('has short lines for every face', () => {
    for (const f of RIVAL_FACES) {
      expect(RIVAL_LINES[f].length).toBeGreaterThanOrEqual(3)
      for (const l of RIVAL_LINES[f]) expect(l.length).toBeLessThanOrEqual(48)
      expect(rivalLine(f, 7)).toBeTruthy()
    }
  })
})
