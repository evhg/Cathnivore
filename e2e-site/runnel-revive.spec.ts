import { expect, test } from '@playwright/test'

// Plan item 729: a dry field holds its own crop wilted (leaning, dusty, inked), and the water revives it: the field's
// revive state is set within 100 ms of the joining tap, and the crop stands upright once the water has run. Under
// reduced motion nothing about the crop animates its transform (the pose swaps at once): only its colour fades.

type T = { runnelTest: { nearlySolve: () => void } }
const DRY = '#board .tiles > g.cell.field:not(.reservoir)[data-crop="wilted"]'

/** The crop's lean in degrees, from its computed transform. */
const leanOf = (g: Element) => {
  const t = getComputedStyle(g.querySelector('.field-plot .crop')!).transform
  if (!t || t === 'none') return 0
  const m = new DOMMatrix(t)
  return Math.abs((Math.atan2(m.b, m.a) * 180) / Math.PI)
}

test('a dry field shows its own crop wilted, and the water revives it within 100 ms', async ({ page }) => {
  await page.goto('/runnel/?nohelp&practice')
  await page.waitForSelector('#board .tiles > g.cell')
  await page.evaluate(() => (window as unknown as T).runnelTest.nearlySolve())
  const before = await page.$$eval(DRY, (gs) =>
    gs.map((g) => {
      const c = g.querySelector<SVGGraphicsElement>('.field-plot .crop')!
      const r = c.getBoundingClientRect()
      return { i: [...g.parentElement!.children].indexOf(g), w: r.width, op: Number(getComputedStyle(c).opacity), crop: c.getAttribute('class') }
    }),
  )
  expect(before.length, 'dry fields before the last tap').toBeGreaterThan(0)
  for (const f of before) {
    expect(f.w, `${f.crop} drawn while dry`).toBeGreaterThan(6)
    expect(f.op).toBe(1)
  }
  const leans = await page.$$eval(DRY, (gs, src) => gs.map((g) => new Function('g', `return (${src})(g)`)(g) as number), leanOf.toString())
  expect(Math.max(...leans), 'a wilted crop leans').toBeGreaterThan(5)
  // The tap is dispatched in the page and the fields read in the same task: the revive state is set by the turn's own
  // handler, before anything paints (well inside 100 ms; the solve's celebration then runs in that same handler).
  const set = await page.locator('#board [data-last]').evaluate((g) => {
    const before = document.querySelectorAll('#board .tiles > g.cell.field[data-crop="revived"]').length
    const o = { bubbles: true, button: 0, pointerId: 1, isPrimary: true, pointerType: 'mouse' }
    g.dispatchEvent(new PointerEvent('pointerdown', o))
    g.dispatchEvent(new PointerEvent('pointerup', o))
    return { before, after: document.querySelectorAll('#board .tiles > g.cell.field[data-crop="revived"]').length }
  })
  expect(set.after, 'fields revived by the tap, read in the same task').toBeGreaterThan(set.before)
  await page.waitForTimeout(2500)
  const after = await page.$$eval('#board .tiles > g.cell.field[data-crop="revived"]', (gs, src) => gs.map((g) => new Function('g', `return (${src})(g)`)(g) as number), leanOf.toString())
  expect(after.length).toBeGreaterThan(0)
  expect(Math.max(...after), 'revived crops stand upright').toBeLessThan(4)
})

test('under reduced motion a wilted crop never animates its pose: its colour changes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/runnel/?nohelp&practice')
  await page.waitForSelector('#board .tiles > g.cell')
  await page.evaluate(() => (window as unknown as T).runnelTest.nearlySolve())
  const motion = (g: Element) => {
    const c = g.querySelector('.field-plot .crop')!
    const cs = getComputedStyle(c)
    const part = getComputedStyle(c.querySelector('.stalk, .frond, .vein, .ear, .leaf-outer, .pumpkin')!)
    return { props: cs.transitionProperty, durs: cs.transitionDuration, anim: cs.animationName, colour: part.fill }
  }
  const noTransform = (m: { props: string; durs: string; anim: string }) => {
    const props = m.props.split(',').map((p) => p.trim())
    const durs = m.durs.split(',').map((d) => parseFloat(d))
    return props.every((p, i) => !['transform', 'all', 'scale', 'rotate'].includes(p) || (durs[i % durs.length] ?? 0) <= 0.01) && m.anim === 'none'
  }
  const dry = await page.locator(DRY).first().evaluate(motion)
  expect(noTransform(dry), JSON.stringify(dry)).toBe(true)
  await page.locator('#board [data-last]').click()
  await page.waitForTimeout(600)
  const wet = await page.locator('#board .tiles > g.cell.field.wet[data-crop="revived"]').first().evaluate(motion)
  expect(noTransform(wet), JSON.stringify(wet)).toBe(true)
  const still = await page.locator(DRY).count()
  expect(still, 'every field revived').toBe(0)
})
