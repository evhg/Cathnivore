import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { COUNTRY, countryTone } from '../games/hedgerow/src/render3d/terrain'
import { ACT_LIGHT } from '../games/hedgerow/src/render3d/palette'

// Plan item 419: the 3D field stands in its act's own country. Beyond the hedge the ground takes the act's three
// country colours in broad patches (it was the field's grass, one flat olive floor), and the key light differs by act.
const rgb = (hex: string) => new THREE.Color(hex).getRGB(new THREE.Color(), THREE.SRGBColorSpace)
const far = (a: string, b: string) => {
  const p = rgb(a)
  const q = rgb(b)
  return Math.max(Math.abs(p.r - q.r), Math.abs(p.g - q.g), Math.abs(p.b - q.b)) * 255
}

describe('Hedgerow 3D country (plan item 419)', () => {
  it('gives every act its own three country grounds, apart from its field grass', () => {
    expect(COUNTRY.length).toBe(10)
    expect(new Set(COUNTRY.map((p) => p.join())).size).toBe(10)
    COUNTRY.forEach((pal, act) => {
      const grass = ACT_LIGHT[act]!.grass[0]
      expect(pal.filter((c) => far(c, grass) > 10).length, `act ${act}`).toBeGreaterThanOrEqual(2)
    })
  })

  it('leaves the field alone and covers the country beyond it in patches of all three', () => {
    expect(countryTone(2, 5, 5, 0, 21).k).toBe(0)
    expect(countryTone(2, -4, 5, 4, 21).k).toBeGreaterThan(0.6)
    for (let act = 0; act < 10; act++) {
      const seen = new Set<string>()
      for (let x = -12; x <= 30; x += 0.5) for (let y = -12; y <= 30; y += 0.5) seen.add(countryTone(act, x, y, 3, act * 10 + 1).color.getHexString())
      expect(seen.size, `act ${act}`).toBe(3)
    }
  })

  it('lights each act with its own key colour', () => {
    expect(new Set(ACT_LIGHT.slice(0, 10).map((l) => l.sun)).size).toBeGreaterThanOrEqual(9)
  })
})
