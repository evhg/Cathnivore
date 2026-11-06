import { describe, expect, it } from 'vitest'
import { BOARD_LANDMARKS, boxAt, clusterBox, DRESSING_BOX, dressingSpot, insideHex, landmarkSpot, overlaps, pickSpot, stallBox } from '../src/ui/landmarkSpot'
import { pieceLayout } from '../src/ui/pieceLayout'
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

// Plan item 144: the event's dressing finds a place clear of every piece, however the stacks push the stalls down.
describe('event dressing spot', () => {
  for (const kind of ['glut', 'festival'] as const)
    for (const hexPx of [40, 60, 110])
      it(`${kind} at ${hexPx} px clears the pieces on crowded tiles`, () => {
        for (let outlets = 0; outlets <= 6; outlets += 2)
          for (let buyouts = 0; buyouts <= 4; buyouts += 2)
            for (let doubt = 0; doubt <= 3; doubt += 3)
              for (let producers = 0; producers <= 3; producers++)
                for (const badge of [false, true]) {
                  const tray = pieceLayout({ outlets, buyouts, doubt, producers, stallCounts: Array(producers).fill(2), scheme: false, labelWidth: 100, badge }, hexPx)
                  const spot = pickSpot(tray.rects)
                  const taken = spot ? [...tray.rects, boxAt(spot, spot.scale)] : tray.rects
                  const d = dressingSpot(kind, taken, { x: 0, y: 92 * (kind === 'glut' ? 0.8 : 0.72) })
                  expect(d, `${outlets}/${buyouts}/${doubt}/${producers}/${badge}`).not.toBeNull()
                  const b = DRESSING_BOX[kind]
                  const box = { x0: d!.x + b.x0 * d!.scale, y0: d!.y + b.y0 * d!.scale, x1: d!.x + b.x1 * d!.scale, y1: d!.y + b.y1 * d!.scale }
                  for (const t of taken) expect(overlaps(box, t, 0)).toBe(false)
                }
      })
})
