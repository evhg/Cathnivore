import { describe, expect, it } from 'vitest'
import { pieceLayout, rectsOverlap, TILE_R } from '../src/ui/pieceLayout'
import { GROUND_MIN, groundKinds, inHex, markRect, regionGround } from '../src/ui/regionGround'
import { REGIONS } from '../src/content/map'

// Plan item 76: every region's own ground, at least 4 marks, none under the piece tray, all on the tile face.
const label = (name: string) => name.length * 8.6 + 16
const trays = (name: string) => [
  pieceLayout({ outlets: 0, buyouts: 0, doubt: 0, producers: 0, scheme: false, labelWidth: label(name) }, 90).rects,
  pieceLayout({ outlets: 2, buyouts: 1, doubt: 1, producers: 2, scheme: true, labelWidth: label(name) }, 90).rects,
  pieceLayout({ outlets: 3, buyouts: 2, doubt: 2, producers: 2, scheme: true, labelWidth: label(name), badge: true }, 60).rects,
]

describe('regionGround', () => {
  for (const def of Object.values(REGIONS)) {
    it(`${def.name}: at least ${GROUND_MIN} marks, clear of every piece slot and of each other, on the face`, () => {
      for (const tray of trays(def.name)) {
        const marks = regionGround(def.id, def.type, tray)
        expect(marks.length).toBeGreaterThanOrEqual(GROUND_MIN)
        const boxes = marks.map(markRect)
        for (const [i, b] of boxes.entries()) {
          for (const p of tray) expect(rectsOverlap(b, p), `${marks[i]!.kind} under ${p.kind}`).toBe(false)
          for (const o of boxes.slice(i + 1)) expect(rectsOverlap(b, o)).toBe(false)
          for (const [x, y] of [[b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1]] as const) expect(inHex(x, y, TILE_R)).toBe(true)
        }
      }
    })
  }

  it('is the same every render (seeded by the region)', () => {
    const tray = trays('Saltmarsh')[1]!
    expect(regionGround('saltmarsh', 'coast', tray)).toEqual(regionGround('saltmarsh', 'coast', tray))
  })

  it('gives two regions of one type their own ground', () => {
    expect(groundKinds('highmoor', 'pasture')).not.toEqual(groundKinds('brindleHills', 'pasture'))
    expect(groundKinds('saltmarsh', 'coast')).not.toEqual(groundKinds('shingleBay', 'coast'))
    expect(groundKinds('rivermead', 'crop')).not.toEqual(groundKinds('oakvale', 'crop'))
    const a = regionGround('highmoor', 'pasture', [])
    const b = regionGround('brindleHills', 'pasture', [])
    expect(a.map((m) => m.kind)).not.toEqual(b.map((m) => m.kind))
  })

  it("leads with the region's signature kind", () => {
    const kinds = regionGround('saltmarsh', 'coast', []).map((m) => m.kind)
    expect(kinds.filter((k) => k === 'reeds').length).toBeGreaterThanOrEqual(kinds.filter((k) => k === 'gull').length)
  })
})

// Plan item 417: freed land holds a market of its own: 2+ stalls, clear of the pieces and the other marks.
describe('regionGround on freed land', () => {
  for (const def of Object.values(REGIONS)) {
    it(`${def.name}: 2+ stalls when freed, none when not`, () => {
      for (const producers of [0, 1, 2, 3]) {
        const tray = pieceLayout({ outlets: 0, buyouts: 0, doubt: 0, producers, scheme: false, labelWidth: label(def.name) }, 90).rects
        const marks = regionGround(def.id, def.type, tray, 'free')
        expect(marks.filter((m) => m.kind === 'stall').length, `${producers} producers`).toBeGreaterThanOrEqual(2)
        expect(marks.length - marks.filter((m) => m.kind === 'stall').length).toBeGreaterThanOrEqual(GROUND_MIN)
        const boxes = marks.map(markRect)
        for (const [i, b] of boxes.entries()) {
          for (const p of tray) expect(rectsOverlap(b, p)).toBe(false)
          for (const o of boxes.slice(i + 1)) expect(rectsOverlap(b, o)).toBe(false)
        }
        expect(regionGround(def.id, def.type, tray).some((m) => m.kind === 'stall')).toBe(false)
        expect(regionGround(def.id, def.type, tray, 'contested').some((m) => m.kind === 'stall' || m.kind === 'hsign')).toBe(false)
      }
    })
  }
})

// Plan item 550 (replacing item 417's signboard): held land carries no H signboard; the status disc says who holds it.
describe('regionGround on held land', () => {
  for (const def of Object.values(REGIONS)) {
    it(`${def.name}: no signboard when held`, () => {
      const tray = pieceLayout({ outlets: 2, buyouts: 1, doubt: 0, producers: 1, scheme: false, labelWidth: label(def.name) }, 90).rects
      const marks = regionGround(def.id, def.type, tray, 'held')
      expect(marks.filter((m) => m.kind === 'hsign')).toHaveLength(0)
    })
  }
})
