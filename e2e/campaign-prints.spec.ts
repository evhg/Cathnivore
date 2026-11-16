import { test, expect, type Page } from '@playwright/test'

// Plan item 415: the campaign is a storybook of six places. Each chapter's print (the phone's tabs, the desktop
// rail's postcards) is its own scene: any two differ on over 8% of their pixels at one size, locked ones included
// (each waits at its own hour of the evening, item 279).

async function diff(page: Page, a: Buffer, b: Buffer): Promise<number> {
  return page.evaluate(async ([a64, b64]) => {
    const load = (src: string) => new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src })
    const px = (img: HTMLImageElement) => {
      const c = document.createElement('canvas')
      c.width = 48
      c.height = 32
      const g = c.getContext('2d')!
      g.drawImage(img, 0, 0, 48, 32)
      return g.getImageData(0, 0, 48, 32).data
    }
    const [pa, pb] = [px(await load(`data:image/png;base64,${a64}`)), px(await load(`data:image/png;base64,${b64}`))]
    let n = 0
    for (let i = 0; i < pa.length; i += 4) if (Math.max(Math.abs(pa[i]! - pb[i]!), Math.abs(pa[i + 1]! - pb[i + 1]!), Math.abs(pa[i + 2]! - pb[i + 2]!)) > 40) n++
    return n / (pa.length / 4)
  }, [a.toString('base64'), b.toString('base64')] as const)
}

async function grey(page: Page, a: Buffer): Promise<number[]> {
  return page.evaluate(async (b64) => {
    const img = new Image()
    img.src = `data:image/png;base64,${b64}`
    await img.decode()
    const c = document.createElement('canvas')
    c.width = 16
    c.height = 12
    const g = c.getContext('2d')!
    g.drawImage(img, 0, 0, 16, 12)
    const d = g.getImageData(0, 0, 16, 12).data
    const v: number[] = []
    for (let k = 0; k < d.length; k += 4) v.push(0.299 * d[k]! + 0.587 * d[k + 1]! + 0.114 * d[k + 2]!)
    return v
  }, a.toString('base64'))
}
function corr(a: number[], b: number[]): number {
  const n = a.length
  const ma = a.reduce((s, x) => s + x, 0) / n
  const mb = b.reduce((s, x) => s + x, 0) / n
  let ab = 0, aa = 0, bb = 0
  for (let k = 0; k < n; k++) {
    ab += (a[k]! - ma) * (b[k]! - mb)
    aa += (a[k]! - ma) ** 2
    bb += (b[k]! - mb) ** 2
  }
  return ab / Math.sqrt(aa * bb)
}

test('the six chapter prints are six different scenes', async ({ page }, testInfo) => {
  test.skip(!['phone', 'desktop-chromium'].includes(testInfo.project.name), 'P and D')
  await page.goto('/')
  await page.getByRole('button', { name: /Campaign/ }).first().click()
  await page.getByRole('heading', { name: 'Campaign' }).waitFor()
  const phone = testInfo.project.name === 'phone'
  const prints = page.locator(phone ? '.cmp-tab .cmp-vignette' : '.cmp-card .cmp-vignette')
  await expect(prints).toHaveCount(6)
  const shots: Buffer[] = []
  for (const p of await prints.all()) {
    await p.scrollIntoViewIfNeeded()
    shots.push(await p.screenshot({ animations: 'disabled' }))
  }
  for (let i = 0; i < 6; i++)
    for (let j = i + 1; j < 6; j++) expect(await diff(page, shots[i]!, shots[j]!), `prints ${i + 1} and ${j + 1}`).toBeGreaterThan(0.08)
  // Plan item 435: six compositions, not one scene recoloured: on a 16x12 greyscale thumbnail (structure, not colour)
  // no two prints correlate above 0.7. At P the tab's number and lock badge are hidden for this (they are the tab's,
  // not the print's).
  if (phone) await page.addStyleTag({ content: '.cmp-tab-num, .cmp-tab::after, .cmp-tab::before { visibility: hidden !important; }' })
  const greys: number[][] = []
  for (const p of await prints.all()) greys.push(await grey(page, await p.screenshot({ animations: 'disabled' })))
  for (let i = 0; i < 6; i++)
    for (let j = i + 1; j < 6; j++) expect(corr(greys[i]!, greys[j]!), `prints ${i + 1} and ${j + 1} in greyscale`).toBeLessThan(0.7)
  // One progress mark: the phone's line under the title, or the ledger under the map at D (its words then for screen readers).
  const marks = await page.locator('.cmp-progress-bar:visible, .cmp-progress-text:not(.visually-hidden):visible, [data-ledger]:visible').count()
  expect(marks).toBe(1)
})
