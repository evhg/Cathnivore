// Plan item 23: Cath's arm poses render distinct art, and the default stays the classic clasped pose.
import { describe, expect, it } from 'vitest'
import { CATH_POSES, cathSvg, type CathOutfit } from '../shared/cath/cath'

/** The SVG minus per-call ids, so two renders of the same pose compare equal. */
const art = (svg: string) => svg.replace(/cath\d+-/g, 'ID-')

describe('Cath poses', () => {
  it('has at least six poses besides clasped', () => {
    expect(CATH_POSES.filter((p) => p !== 'clasped').length).toBeGreaterThanOrEqual(6)
  })

  it('renders distinct paths for every pose, in every outfit', () => {
    const outfits: CathOutfit[] = ['field', 'market', 'wax', 'pinny', 'gown', 'trench']
    for (const outfit of outfits) {
      const seen = new Set(CATH_POSES.map((pose) => art(cathSvg({ framing: 'half', outfit, pose }))))
      expect(seen.size).toBe(CATH_POSES.length)
    }
  })

  it('defaults to clasped and only draws clasped hands then', () => {
    expect(art(cathSvg({ framing: 'half' }))).toBe(art(cathSvg({ framing: 'half', pose: 'clasped' })))
    expect(cathSvg({ pose: 'wave' })).toContain('cath-pose-wave')
    expect(cathSvg({ pose: 'clasped' })).not.toContain('cath-arms')
    expect(cathSvg({ pose: 'basket' })).toContain('cath-arms')
  })

  it('keeps the CSP rule: no inline style attributes', () => {
    for (const pose of CATH_POSES) expect(cathSvg({ pose })).not.toMatch(/\sstyle=/)
  })
})
