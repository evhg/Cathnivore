import { describe, expect, it } from 'vitest'
import { mugshotSvg } from '../games/cathode/src/ui/busts'

// Plan item 270: the List's withheld prints are four distinct backlit silhouettes, each with its district's prop,
// and the red bar a stamp across the eyes (not a full-width bar).
describe('withheld mugshots', () => {
  const svgs = [0, 1, 2, 3].map((v) => mugshotSvg(null, `NO. ${v + 1}`, true, v))
  it('draws four different silhouettes', () => {
    const heads = svgs.map((s) => s.match(/<g fill="#08090c">([\s\S]*?)<\/g>/)![1])
    expect(new Set(heads).size).toBe(4)
    for (const [i, s] of svgs.entries()) expect(s).toContain(`data-silhouette="${i}"`)
  })
  it('backlights each: a light glow at the head behind a near-black figure, and a rim', () => {
    for (const s of svgs) {
      expect(s).toContain('stop-color="#7f93a8"')
      expect(s).toContain('stroke="#9fbcd8"')
    }
  })
  it('keeps the stamp to the face', () => {
    for (const s of svgs) expect(s).toMatch(/<rect x="62" y="86" width="76"/)
  })
})
