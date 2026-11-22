import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Buyout, Doubt, Outlet, ProducerMini } from '../src/ui/Map'
import { outletStage } from '../src/ui/pieceLayout'

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

// Plan item 645: the players' side is wooden market stalls that grow with their engine, and Hollowell's Outlets take one
// glossy shape per stage, so a board of them isn't one icon repeated.
describe('item 645 pieces', () => {
  const stall = (n: number) =>
    svg(createElement(ProducerMini, { pid: 'mara', n, scale: 1, countR: 4, clip: 'c', showInitial: false }))
  it('a producer is a wooden stall: awning in their colour, two posts, a counter, wares; matte, not plastic', () => {
    const m = stall(1)
    expect(m).toContain('stall-awning')
    expect(m).toContain('stall-counter')
    expect(m).toContain('stall-wares')
    expect(m.match(/class="stall-post"/g)).toHaveLength(2)
    expect(m).toContain('var(--p-mara)')
    expect(m).not.toMatch(/gloss\)/)
    expect(m).not.toContain('corp-specular')
  })
  it('a stall grows a crate for each further stall on the region (up to three)', () => {
    for (const n of [1, 2, 3, 5]) expect(stall(n).match(/class="pile-copy"/g)?.length ?? 0, `n=${n}`).toBe(Math.min(n, 3) - 1)
  })
  it('the Outlet takes a distinct shape per stage and keeps its sawtooth outline', () => {
    expect([1, 2, 3, 7].map(outletStage)).toEqual([1, 2, 3, 3])
    const looks = ([1, 2, 3] as const).map((stage) => svg(createElement(Outlet, { stage })))
    expect(new Set(looks).size).toBe(3)
    for (const [i, m] of looks.entries()) {
      expect(m).toMatch(/0\.4,4\.4 0\.4,2\.6 3\.1,0\.6/)
      expect(m).toContain(['outlet-kiosk', 'outlet-store', 'outlet-superstore'][i])
    }
  })
})
