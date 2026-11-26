import { describe, expect, it } from 'vitest'
import { pieceLayout, rectsOverlap, TILE_R } from '../src/ui/pieceLayout'
import { inHex, markRect, regionGround } from '../src/ui/regionGround'
import { FOLK_COUNT, FOLK_MIN, folkRect, folkScale, regionFolk } from '../src/ui/regionFolk'
import { REGIONS } from '../src/content/map'

// Plan item 717: every region holds 2+ shoppers, none of them, anywhere along its walk, over a piece, a counter, a
// badge, the name plate, a stall or a signboard; busier when freed, sparse when held.
const label = (name: string) => name.length * 8.6 + 16
const trays = (name: string) => [
  pieceLayout({ outlets: 0, buyouts: 0, doubt: 0, producers: 0, scheme: false, labelWidth: label(name) }, 90).rects,
  pieceLayout({ outlets: 1, buyouts: 0, doubt: 0, producers: 1, scheme: false, labelWidth: label(name) }, 90).rects,
  pieceLayout({ outlets: 2, buyouts: 1, doubt: 1, producers: 2, scheme: true, labelWidth: label(name) }, 90).rects,
  pieceLayout({ outlets: 3, buyouts: 2, doubt: 2, producers: 2, scheme: true, labelWidth: label(name), badge: true }, 60).rects,
]
const controls = ['free', 'contested', 'held', undefined] as const

describe('regionFolk', () => {
  for (const def of Object.values(REGIONS)) {
    it(`${def.name}: ${FOLK_MIN}+ shoppers, clear of the pieces, the stalls and each other, on the face`, () => {
      for (const tray of trays(def.name))
        for (const control of controls)
        for (const k of [1, 1.4]) {
          const marks = regionGround(def.id, def.type, tray, control)
          const folk = regionFolk(def.id, tray, marks, control, k)
          expect(folk.length, `${control}`).toBeGreaterThanOrEqual(FOLK_MIN)
          expect(folk.length).toBeLessThanOrEqual(FOLK_COUNT[control ?? 'none'])
          const scenery = marks.filter((m) => m.kind === 'stall' || m.kind === 'hsign').map(markRect)
          const boxes = folk.map(folkRect)
          for (const [i, b] of boxes.entries()) {
            for (const p of tray) expect(rectsOverlap(b, p), `shopper over ${p.kind}`).toBe(false)
            // A walker keeps clear of the ground's stalls too; only a crowded tile's last, standing shopper may mind one.
            if (folk[i]!.x0 !== folk[i]!.x1) for (const p of scenery) expect(rectsOverlap(b, p), 'walker over a stall').toBe(false)
            for (const o of boxes.slice(i + 1)) expect(rectsOverlap(b, o)).toBe(false)
            for (const [x, y] of [[b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1]] as const) expect(inHex(x, y, TILE_R)).toBe(true)
          }
        }
    })
  }

  it('is the same every render, and a freed market is busier than a held one', () => {
    const tray = trays('Oakvale')[1]!
    const g = (c: 'free' | 'held') => regionGround('oakvale', 'crop', tray, c)
    expect(regionFolk('oakvale', tray, g('free'), 'free')).toEqual(regionFolk('oakvale', tray, g('free'), 'free'))
    let free = 0
    let held = 0
    for (const def of Object.values(REGIONS)) {
      free += regionFolk(def.id, tray, regionGround(def.id, def.type, tray, 'free'), 'free').length
      held += regionFolk(def.id, tray, regionGround(def.id, def.type, tray, 'held'), 'held').length
    }
    expect(free).toBeGreaterThan(held)
  })

  it('a phone board draws them bigger, up to 1.4x', () => {
    expect(folkScale(135)).toBe(1)
    expect(folkScale(62)).toBeGreaterThan(1.25)
    expect(folkScale(30)).toBe(1.4)
  })

  it('most shoppers walk', () => {
    let walking = 0
    let all = 0
    for (const def of Object.values(REGIONS)) {
      const tray = trays(def.name)[1]!
      for (const f of regionFolk(def.id, tray, regionGround(def.id, def.type, tray, 'contested'), 'contested')) {
        all++
        if (Math.abs(f.x1 - f.x0) >= 10) walking++
      }
    }
    expect(walking / all).toBeGreaterThan(0.6)
  })
})
