import { describe, expect, it } from 'vitest'
import { ACT_LIGHT } from '../games/hedgerow/src/render3d/palette'
import { ACT_SUN_AZ, shadowDir } from '../games/hedgerow/src/sunlight'
import { drawFarmhouse, drawTower, setShadowSun } from '../games/hedgerow/src/sprites'
import { drawFarmyard } from '../games/hedgerow/src/render'

// Plan item 370: the 2D field's barns, farmhouse and towers cast a short shadow away from the act's sun, the same
// side as the 3D view's key light (item 360). The draw goes into a recording canvas; each cast-shadow polygon is
// the fill in the shadow ink with four or more corners, and its centroid must lie downwind of the object.
function recorder() {
  const polys: Array<{ fill: string; pts: Array<[number, number]> }> = []
  let path: Array<[number, number]> = []
  const gradient = { addColorStop() {} }
  const t: Record<string, unknown> = {}
  const ctx = new Proxy(t, {
    get(o, k) {
      if (k in o) return o[k as string]
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => gradient
      if (k === 'measureText') return () => ({ width: 10 })
      if (k === 'beginPath') return () => void (path = [])
      if (k === 'moveTo' || k === 'lineTo') return (x: number, y: number) => void path.push([x, y])
      if (k === 'fill') return () => void polys.push({ fill: String(o.fillStyle), pts: path })
      return () => {}
    },
    set(o, k, v) {
      o[k as string] = v
      return true
    },
  }) as unknown as CanvasRenderingContext2D
  const shadows = () => polys.filter((p) => p.fill.startsWith('rgba(20,25,10,') && p.pts.length >= 4)
  return { ctx, shadows }
}
const centroid = (pts: Array<[number, number]>) => pts.reduce((a, [x, y]) => [a[0] + x / pts.length, a[1] + y / pts.length], [0, 0])

describe('Hedgerow 2D cast shadows (plan item 370)', () => {
  it("each act's 2D sun is the 3D palette's", () => {
    expect(ACT_SUN_AZ).toEqual(ACT_LIGHT.map((l) => l.sunAz))
  })
  for (const level of [5, 21, 34, 45, 65]) {
    const dir = shadowDir(level)
    const downwind = (pts: Array<[number, number]>, x: number, base: number) => {
      const [cx, cy] = centroid(pts)
      return (cx - x) * dir.x + (cy - base) * dir.y
    }
    it(`level ${level}: the farmhouse, a barn and a tower all cast toward (${dir.x.toFixed(2)}, ${dir.y.toFixed(2)})`, () => {
      setShadowSun(dir)
      const s = 60
      const house = recorder()
      drawFarmhouse(house.ctx, 100, 100, s, 0, 1)
      expect(house.shadows().length).toBe(1)
      expect(downwind(house.shadows()[0]!.pts, 100, 100 + s * 0.34 - s * 0.1)).toBeGreaterThan(s * 0.08)
      const tower = recorder()
      drawTower(tower.ctx, { kind: 'windmill', tier: 2, spec: null, fired: 9, dazed: false, still: true }, 100, 100, s, 0)
      expect(tower.shadows().length).toBe(1)
      expect(downwind(tower.shadows()[0]!.pts, 100, 100 + s * 0.3 - s * 0.06)).toBeGreaterThan(s * 0.08)
      // The barn sits left or right in its yard by seed: compare its shadow under this sun and the opposite one.
      const barnAt = (d: { x: number; y: number }) => {
        setShadowSun(d)
        const r = recorder()
        drawFarmyard(r.ctx, 0, 0, s, 7)
        expect(r.shadows().length).toBe(1)
        return centroid(r.shadows()[0]!.pts)
      }
      const [ax, ay] = barnAt(dir)
      const [bx, by] = barnAt({ x: -dir.x, y: -dir.y })
      expect((ax - bx) * dir.x + (ay - by) * dir.y).toBeGreaterThan(s * 0.1)
    })
  }
})
