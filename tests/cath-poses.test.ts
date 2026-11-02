// Plan item 23: Cath's arm poses render distinct art, and the default stays the classic clasped pose.
import { describe, expect, it } from 'vitest'
import { CATH_POSES, cathSvg, type CathOutfit } from '../shared/cath/cath'
import { ADJACENT, LINE_POSE, SCREEN_POSE } from '../shared/cath/screenposes'
import { MOMENTS, cathSceneSvg } from '../shared/cath/scene'

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

  it('defaults to clasped and draws her folded hands on their sleeves', () => {
    expect(art(cathSvg({ framing: 'half' }))).toBe(art(cathSvg({ framing: 'half', pose: 'clasped' })))
    expect(cathSvg({ pose: 'wave' })).toContain('cath-pose-wave')
    // Plan item 33: the clasped hands are on the ends of real sleeves now (they were a lone skin oval).
    expect(cathSvg({ pose: 'clasped' })).toContain('cath-arms')
    expect(cathSvg({ pose: 'basket' })).toContain('cath-arms')
  })

  it('keeps the CSP rule: no inline style attributes', () => {
    for (const pose of CATH_POSES) expect(cathSvg({ pose })).not.toMatch(/\sstyle=/)
  })
})

describe('screen poses', () => {
  it('no two adjacent screens share a pose', () => {
    for (const [a, b] of ADJACENT) expect(SCREEN_POSE[a], `${a} vs ${b}`).not.toBe(SCREEN_POSE[b])
  })
  it('every moment and story line uses a real pose', () => {
    for (const m of Object.values(MOMENTS)) expect(CATH_POSES).toContain(m.pose)
    for (const p of Object.values(LINE_POSE)) expect(CATH_POSES).toContain(p)
    expect(cathSceneSvg('win')).toContain('cath-pose-cheer')
  })
})
