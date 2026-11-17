import { describe, expect, it } from 'vitest'
import { creekRibbons } from '../games/hedgerow/src/render3d/terrain'

// Plan item 469: Saltmarsh's tidal creeks are winding ribbons that hold the sky, broken where a lane crosses.
const sky = { top: '#6fa6c8', bottom: '#dcecee', bank: '#6f6b55' }
const flat = () => 0

describe('Hedgerow 3D tidal creeks (plan item 469)', () => {
  it('lays a meander as a three-strip ribbon, sky down the middle and mud at the banks', () => {
    const geo = creekRibbons([{ x: 0, z: 0, heading: 0, length: 3, width: 0.1, seed: 1 }], flat, () => false, sky)!
    expect(geo).not.toBeNull()
    const pos = geo.getAttribute('position')
    const col = geo.getAttribute('color')
    // Three vertices a cross-section, two quads between sections.
    expect(pos.count % 3).toBe(0)
    expect(geo.index!.count).toBe(((pos.count / 3) - 1) * 12)
    // Middle brighter than the bank (the sky against the mud).
    expect(col.getX(1) + col.getY(1) + col.getZ(1)).toBeGreaterThan(col.getX(0) + col.getY(0) + col.getZ(0) + 0.5)
    // It winds: the heading turns, so the path leaves a straight line.
    let maxOff = 0
    for (let i = 1; i < pos.count; i += 3) maxOff = Math.max(maxOff, Math.abs(pos.getZ(i)))
    expect(maxOff).toBeGreaterThan(0.15)
  })

  it('breaks where skipped and draws nothing when wholly skipped', () => {
    const whole = creekRibbons([{ x: 0, z: 0, heading: 0, length: 3, width: 0.1, seed: 1 }], flat, () => false, sky)!
    const cut = creekRibbons([{ x: 0, z: 0, heading: 0, length: 3, width: 0.1, seed: 1 }], flat, (x) => x > 1 && x < 1.5, sky)!
    expect(cut.index!.count).toBeLessThan(whole.index!.count - 12)
    expect(creekRibbons([{ x: 0, z: 0, heading: 0, length: 3, width: 0.1, seed: 1 }], flat, () => true, sky)).toBeNull()
  })
})

describe('creek faces', () => {
  it('faces up, so the camera above sees it (a down-facing ribbon is culled)', () => {
    const geo = creekRibbons([{ x: 0, z: 0, heading: 0.4, length: 2, width: 0.1, seed: 3 }], flat, () => false, sky)!
    geo.computeVertexNormals()
    const n = geo.getAttribute('normal')
    for (let i = 0; i < n.count; i++) expect(n.getY(i)).toBeGreaterThan(0.9)
  })
})
