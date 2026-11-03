import { describe, expect, it } from 'vitest'
import { BOARD_LANDMARKS, boxAt, clusterBox, insideHex, landmarkSpot, overlaps, stallBox } from '../src/ui/landmarkSpot'
import { REGIONS } from '../src/content/map'
import { LAYOUTS } from '../src/content/layouts'

// Plan item 55: every region on every map has a landmark, and it always finds a spot clear of the pieces.
describe('board landmarks', () => {
  it('every region of all three maps has a landmark', () => {
    for (const layout of Object.values(LAYOUTS)) for (const id of Object.keys(layout.hexes)) expect(BOARD_LANDMARKS[id as keyof typeof REGIONS], id).toBeDefined()
    for (const id of Object.keys(REGIONS)) expect(BOARD_LANDMARKS[id as keyof typeof REGIONS], id).toBeDefined()
  })
  for (let kinds = 0; kinds <= 3; kinds++)
    for (let stalls = 0; stalls <= 4; stalls++)
      it(`a spot clear of ${kinds} enemy kinds and ${stalls} stalls`, () => {
        const s = landmarkSpot(kinds, stalls)
        expect(s).not.toBeNull()
        const box = boxAt(s!, s!.scale)
        for (const b of [clusterBox(kinds), stallBox(stalls)]) if (b) expect(overlaps(box, b, 0)).toBe(false)
        for (const [x, y] of [[box.x0, box.y0], [box.x1, box.y0], [box.x0, box.y1], [box.x1, box.y1]] as const) expect(insideHex(x, y)).toBe(true)
      })
})
