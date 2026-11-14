import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// Plan item 366 slice 3: at D the tally is a chalk slate (its words and figures pass AA on it) and Hollowell's papers
// hang from a gantry: an orange beam behind the cards, each card a backlit billboard whose lit face sits 12+ dE2000
// off the paper, with its conveyor as lit pips. A phone keeps its papers as they were.

function lab(rgb: number[]): number[] {
  const c = rgb.map((v) => {
    v /= 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  const X = (c[0]! * 0.4124 + c[1]! * 0.3576 + c[2]! * 0.1805) / 0.95047
  const Y = c[0]! * 0.2126 + c[1]! * 0.7152 + c[2]! * 0.0722
  const Z = (c[0]! * 0.0193 + c[1]! * 0.1192 + c[2]! * 0.9505) / 1.08883
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))]
}

/** CIEDE2000 between two sRGB colours. */
function de2000(p: number[], q: number[]): number {
  const [L1, a1, b1] = lab(p) as [number, number, number]
  const [L2, a2, b2] = lab(q) as [number, number, number]
  const r = Math.PI / 180
  const Cb = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)))
  const a1p = a1 * (1 + G), a2p = a2 * (1 + G)
  const C1 = Math.hypot(a1p, b1), C2 = Math.hypot(a2p, b2)
  const hue = (x: number, y: number) => ((Math.atan2(y, x) / r) + 360) % 360
  const h1 = hue(a1p, b1), h2 = hue(a2p, b2)
  let dh = h2 - h1
  if (C1 * C2 === 0) dh = 0
  else if (dh > 180) dh -= 360
  else if (dh < -180) dh += 360
  const dH = 2 * Math.sqrt(C1 * C2) * Math.sin((dh / 2) * r)
  const Lb = (L1 + L2) / 2, Cbp = (C1 + C2) / 2
  let hb = h1 + h2
  if (C1 * C2 !== 0) hb = Math.abs(h1 - h2) > 180 ? (h1 + h2 + 360) / 2 : (h1 + h2) / 2
  hb %= 360
  const T = 1 - 0.17 * Math.cos((hb - 30) * r) + 0.24 * Math.cos(2 * hb * r) + 0.32 * Math.cos((3 * hb + 6) * r) - 0.2 * Math.cos((4 * hb - 63) * r)
  const dT = 30 * Math.exp(-(((hb - 275) / 25) ** 2))
  const RC = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7))
  const SL = 1 + (0.015 * (Lb - 50) ** 2) / Math.sqrt(20 + (Lb - 50) ** 2)
  const SC = 1 + 0.045 * Cbp, SH = 1 + 0.015 * Cbp * T
  const RT = -Math.sin(2 * dT * r) * RC
  const dL = L2 - L1, dC = C2 - C1
  return Math.sqrt((dL / SL) ** 2 + (dC / SC) ** 2 + (dH / SH) ** 2 + RT * (dC / SC) * (dH / SH))
}

async function start(page: Page) {
  await page.goto('/')
  await page.getByText('Quick Game').click()
  await page.getByRole('button', { name: 'Start' }).click()
  await page.locator('.game').waitFor()
  await page.locator('.plan-strip').waitFor({ state: 'attached' })
}

for (const [w, h] of [
  [1440, 900],
  [1280, 800],
] as const) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`the slate and the gantry at ${w}x${h} ${scheme}`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop-chromium', 'the desktop table')
      await page.setViewportSize({ width: w, height: h })
      await page.emulateMedia({ colorScheme: scheme })
      await start(page)
      const m = await page.evaluate(() => {
        const rgb = (s: string) => s.match(/[\d.]+/g)!.slice(0, 3).map(Number)
        const probe = document.createElement('span')
        probe.style.color = 'var(--paper)'
        document.body.append(probe)
        const paper = rgb(getComputedStyle(probe).color)
        probe.remove()
        const cards = [...document.querySelectorAll<HTMLElement>('.plan-strip-item > button:first-child')].map((el) => {
          const bg = getComputedStyle(el).backgroundImage
          // The face is the last layer: the lit gradient under the specular strip, the rail and the glow.
          const face = bg.slice(bg.lastIndexOf('linear-gradient('))
          return { gradient: bg.includes('gradient('), face: (face.match(/rgba?\([^)]*\)/g) ?? []).map(rgb) }
        })
        const beam = getComputedStyle(document.querySelector('.plan-strip')!, '::before')
        const lit = [...document.querySelectorAll<HTMLElement>('.plan-strip-dial[data-step="3"] i')].map((i) => getComputedStyle(i).boxShadow)
        const labels = [...document.querySelectorAll<HTMLElement>('.market-board .board-label')]
          .filter((l) => l.getBoundingClientRect().width > 2)
          .map((l) => parseFloat(getComputedStyle(l).fontSize))
        return { paper, cards, beam: beam.content !== 'none' && parseFloat(beam.height) >= 12 && beam.backgroundImage.includes('gradient'), lit, labels }
      })
      expect(m.cards).toHaveLength(3)
      for (const c of m.cards) {
        expect(c.gradient).toBe(true)
        expect(c.face.length).toBeGreaterThanOrEqual(2)
        for (const stop of c.face) expect(de2000(stop, m.paper)).toBeGreaterThanOrEqual(12)
      }
      expect(m.beam).toBe(true)
      for (const s of m.lit) expect(s).not.toBe('none')
      expect(m.labels.length).toBe(4)
      for (const s of m.labels) expect(s).toBeGreaterThanOrEqual(12)
      const axe = await new AxeBuilder({ page }).include('.market-board').withRules(['color-contrast']).analyze()
      expect(axe.violations.flatMap((v) => v.nodes.map((n) => n.target.join(' ')))).toEqual([])
    })
  }
}

test('a phone keeps its papers without the gantry', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'the phone')
  await start(page)
  const beam = await page.locator('.plan-strip').evaluate((el) => getComputedStyle(el, '::before').content)
  expect(beam).toBe('none')
})
