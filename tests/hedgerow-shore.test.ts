import { describe, expect, it } from 'vitest'
import { shoreLine, shoreStrip } from '../games/hedgerow/src/render3d/terrain'

// Plan item 469: Saltmarsh's west coast is a sand beach sloping into the sea with a broken line of surf off it.
const dune = () => 0.2

describe('Hedgerow 3D shore (plan item 469)', () => {
  it('slopes from the dune down past the waterline, with surf just off it, all facing up', () => {
    const s = shoreStrip(-1.7, -1, 0, 6, dune, () => false, 1)!
    expect(s).not.toBeNull()
    const pos = s.sand.getAttribute('position')
    // Five points a cross-section, landward to seaward: x falls and the last one sits under the water.
    expect(pos.count % 5).toBe(0)
    expect(pos.getX(0)).toBeGreaterThan(pos.getX(4))
    expect(pos.getY(0)).toBeCloseTo(0.23, 2)
    expect(pos.getY(4)).toBeLessThan(-0.09)
    expect(pos.getY(3)).toBeGreaterThan(-0.09)
    // The waterline follows the wobbling coast line.
    const line = shoreLine(-1.7, 1)
    expect(pos.getX(3)).toBeCloseTo(line(0), 5)
    for (const g of [s.sand, s.surf!]) {
      const n = g.getAttribute('normal')
      for (let i = 0; i < n.count; i++) expect(n.getY(i)).toBeGreaterThan(0)
    }
    // Surf lies out on the water, seaward of the waterline, and is broken into lengths.
    const f = s.surf!.getAttribute('position')
    for (let i = 0; i < f.count; i++) {
      expect(f.getY(i)).toBeGreaterThan(-0.09)
      expect(f.getX(i)).toBeLessThan(line(f.getZ(i)) + 0.001)
    }
    expect(s.surf!.index!.count).toBeLessThan(((f.count / 3) - 1) * 12)
  })

  it('faces up with the sea to the east too, and breaks where skipped', () => {
    const e = shoreStrip(9.6, 1, 0, 6, dune, () => false, 2)!
    e.sand.computeVertexNormals()
    const n = e.sand.getAttribute('normal')
    for (let i = 0; i < n.count; i++) expect(n.getY(i)).toBeGreaterThan(0)
    const whole = shoreStrip(-1.7, -1, 0, 6, dune, () => false, 1)!
    const cut = shoreStrip(-1.7, -1, 0, 6, dune, (_x, z) => z > 2 && z < 3, 1)!
    expect(cut.sand.index!.count).toBeLessThan(whole.sand.index!.count - 24)
    expect(shoreStrip(-1.7, -1, 0, 6, dune, () => true, 1)).toBeNull()
  })
})
