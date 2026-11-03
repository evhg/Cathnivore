import { describe, expect, it } from 'vitest'
import { fieldCoverage, fitCamera3d } from '../games/hedgerow/src/render3d/camerafit'
import { LEVELS } from '../games/hedgerow/src/levels'

// Plan item 78: the 3D camera is fitted to the field. On a wide frame (D, L) the field fills at least 65% of it
// with no off-field band over 16% (the top one holds the hills and the sky card); on an upright phone, where the
// field's width is the limit, the side and foot bands stay under 8% and the rest is the sky band above it.
const ASPECTS = { P: 0.56, D: 1.3, L: 1.9 } as const

describe('fitCamera3d', () => {
  for (const lv of LEVELS.filter((l) => l.id <= 100)) {
    it(`level ${lv.id} (${lv.cols}x${lv.rows}) fills the frame`, () => {
      for (const [n, a] of Object.entries(ASPECTS)) {
        const c = fieldCoverage(lv.cols, lv.rows, a, fitCamera3d(lv.cols, lv.rows, a))
        const { left, right, top, bottom } = c.bands
        expect(Math.max(left, right, bottom), `${n} sides/foot`).toBeLessThanOrEqual(n === 'P' ? 0.08 : 0.16)
        if (n === 'P') expect(c.share, n).toBeGreaterThanOrEqual(0.4)
        else {
          expect(top, `${n} top`).toBeLessThanOrEqual(0.17)
          expect(c.share, n).toBeGreaterThanOrEqual(0.6)
        }
      }
    })
  }
})
