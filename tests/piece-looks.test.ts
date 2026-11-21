import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Buyout, Doubt, Outlet } from '../src/ui/Map'

// Plan item 618: each piece kind on the board has its own look. Hollowell's are glossy plastic (the gloss gradient, a
// specular highlight, a chrome rim, no ink outline) and each keeps its own silhouette (item 172), so who holds a
// region reads at a glance.
const svg = (el: ReturnType<typeof createElement>) => renderToStaticMarkup(createElement('svg', null, el))

describe('board piece looks', () => {
  const looks = { outlet: svg(createElement(Outlet)), buyout: svg(createElement(Buyout)), doubt: svg(createElement(Doubt)) }
  it('Hollowell and Candor pieces are glossy plastic with a specular highlight', () => {
    for (const [k, m] of Object.entries(looks)) {
      expect(m, k).toMatch(/gloss\)/)
      expect(m, k).toContain('corp-specular')
    }
  })
  it('each kind is a distinct piece: its own class and its own outline', () => {
    expect(looks.outlet).toContain('enemy-outlet')
    expect(looks.buyout).toContain('enemy-buyout')
    expect(looks.doubt).toContain('enemy-doubt')
    const outlines = [/0\.4,4\.4 0\.4,2\.6 3\.1,0\.6/, /6,0\.3 12,3\.4 12,9 0,9 0,3\.4/, /<circle[^>]*r="5\.9"/]
    const kinds = Object.values(looks)
    outlines.forEach((re, i) => kinds.forEach((m, j) => expect(re.test(m), `outline ${i} in kind ${j}`).toBe(i === j)))
    expect(new Set(kinds).size).toBe(3)
  })
})
