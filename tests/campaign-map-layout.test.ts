import { describe, expect, it } from 'vitest'
import { CHAPTERS } from '../src/content/chapters'
import { MAP_AXIAL } from '../src/content/campaignMap'
import { LANDMARKS, boxesMeet, campaignMapLayout, pinBox, regionCentre, type Box } from '../src/content/campaignMapLayout'
import type { RegionId } from '../src/engine/types'

// Plan item 49: on every map the campaign can show (no chapter won, each prefix of wins, all won), no region
// name crosses another name, a landmark, a pin, a Hollowell post or Cath.
const ids = CHAPTERS.map((c) => c.id)
const points = Array.from({ length: ids.length + 1 }, (_, n) => ids.slice(0, n))

describe('the campaign map layout', () => {
  it('gives every region a landmark', () => {
    for (const id of Object.keys(MAP_AXIAL)) expect(LANDMARKS[id], id).toBeDefined()
  })

  for (const completed of points) {
    it(`keeps labels clear with ${completed.length} chapters won`, () => {
      const m = campaignMapLayout(ids, completed)
      const others: { what: string; box: Box }[] = [
        { what: 'Cath', box: m.cath },
        ...m.landmarks.map((l) => ({ what: `landmark ${l.id}`, box: l.box })),
        ...m.posts.map((p) => ({ what: `post ${p.id}`, box: p.box })),
        ...m.pins.map((p, i) => ({ what: `pin ${i + 1}`, box: pinBox(p) })),
        ...m.bunting.map((b) => ({ what: `bunting ${b.id}`, box: b.box })),
        // Plan item 279: Hollowell's tape hangs where the bunting will, so it gets the same rule.
        ...m.tape.map((b) => ({ what: `bunting ${b.id}`, box: b.box })),
      ]
      for (const n of m.names) {
        // A region's own bunting hangs over its name like a banner, on purpose; anyone else's may not.
        for (const o of others) if (o.what !== `bunting ${n.id}`) expect(boxesMeet(n.box, o.box), `${n.id} vs ${o.what}`).toBe(false)
        for (const n2 of m.names) if (n2.id !== n.id) expect(boxesMeet(n.box, n2.box), `${n.id} vs ${n2.id}`).toBe(false)
      }
      // Plan item 279: the chapter pins stand clear of the (larger) landmarks.
      for (const l of m.landmarks) for (const p of m.pins) expect(boxesMeet(l.box, pinBox(p)), `pin vs landmark ${l.id}`).toBe(false)
      // Cath stands clear of every landmark and post too, and nothing sits on another region's name.
      for (const o of others.slice(1)) expect(boxesMeet(m.cath, o.box), `Cath vs ${o.what}`).toBe(false)
      // Landmarks and posts stay inside their own hex's face (within the inscribed circle).
      for (const l of [...m.landmarks, ...m.posts]) {
        const c = regionCentre(l.id as RegionId)
        for (const [x, y] of [[l.box.x0, l.box.y0], [l.box.x1, l.box.y0], [l.box.x0, l.box.y1], [l.box.x1, l.box.y1]] as const)
          expect(Math.hypot(x - c.x, y - c.y), `${l.id} corner`).toBeLessThan(45)
      }
    })
  }
})
