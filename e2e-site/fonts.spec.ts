import { expect, test, type Page } from '@playwright/test'

// AAA UI M1 verification (docs/design/aaa-ui.md): on every page a counter is set in that game's figures
// family and the face really loads (document.fonts.check), no faux bold or italic can be synthesised,
// and no page still loads the old shared /fonts files. CATHODE carries no Fraunces or Atkinson at all.

interface FontProbe {
  family: string
  numeric: string
  loaded: boolean
  synthesis: string
  faces: string[]
  sources: string[]
}

async function probe(page: Page, selector: string): Promise<FontProbe> {
  await page.locator(selector).first().waitFor({ state: 'attached', timeout: 150_000 })
  return page.evaluate(async (sel) => {
    const el = document.querySelector(sel)!
    const cs = getComputedStyle(el)
    const first = cs.fontFamily.split(',')[0]!.trim().replace(/^["']|["']$/g, '')
    const text = el.textContent?.trim() || '0'
    await document.fonts.load(`${cs.fontWeight} 16px "${first}"`, text)
    await document.fonts.ready
    const root = getComputedStyle(document.documentElement)
    return {
      family: cs.fontFamily,
      numeric: cs.fontVariantNumeric,
      loaded: document.fonts.check(`${cs.fontWeight} 16px "${first}"`, text),
      synthesis: `${root.getPropertyValue('font-synthesis-weight')} ${root.getPropertyValue('font-synthesis-style')}`,
      faces: [...document.fonts].map((f) => f.family.replace(/^["']|["']$/g, '')),
      sources: performance.getEntriesByType('resource').map((r) => r.name).filter((n) => n.endsWith('.woff2')),
    }
  }, selector)
}

function expectHouseRules(p: FontProbe, figures: string): void {
  expect(p.family.replace(/["']/g, '')).toMatch(new RegExp(`^${figures}`))
  expect(p.loaded, `${figures} should be loaded`).toBe(true)
  expect(p.synthesis).toBe('none none')
  expect(p.sources.filter((s) => new URL(s).pathname.startsWith('/fonts/'))).toEqual([])
  expect(p.sources.filter((s) => /latin-ext|cyrillic|greek|vietnamese/.test(s))).toEqual([])
}

test.describe('AAA UI fonts', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'font loading checks run in Chromium')

  test('landing: meta figures in Site UI, Cath in the voice face', async ({ page }) => {
    await page.goto('/')
    const p = await probe(page, '.card-meta')
    expectHouseRules(p, 'Site UI')
    const voice = await page.locator('.lede').evaluate((el) => [getComputedStyle(el).fontFamily, getComputedStyle(el).fontStyle])
    expect(voice[0]).toMatch(/^"?Site Voice/)
    expect(voice[1]).toBe('italic')
  })

  test('Cathnivore: the HUD counters are Marrow Figures', async ({ page }) => {
    await page.goto('/cathnivore/')
    await page.getByText('Quick Game').click()
    await page.getByRole('button', { name: 'Start' }).click()
    await page.locator('.game').waitFor()
    const p = await probe(page, '.market-board .board-num')
    expectHouseRules(p, 'Marrow Figures')
    expect(p.numeric).toContain('tabular-nums')
  })

  test('Runnel: the taps counter is Runnel Figures', async ({ page }) => {
    await page.goto('/runnel/?nohelp')
    const p = await probe(page, '#hud-taps')
    expectHouseRules(p, 'Runnel Figures')
    expect(p.numeric).toContain('tabular-nums')
  })

  test('Hedgerow: the star bank is Hedgerow UI (Nunito, unslashed zero)', async ({ page }) => {
    await page.goto('/hedgerow/?2d')
    const p = await probe(page, '#bank-stars')
    expectHouseRules(p, 'Hedgerow UI')
  })

  test('CATHODE: the HP readout is Cathode Figures (Cathode Mono digits, plain zero), and no house font is declared', async ({ page }, info) => {
    // One size is enough, and the 3D street boots slowly under swiftshader at 1440x900.
    test.skip(info.project.name !== 'site-phone', 'one WebGL boot per run')
    test.setTimeout(180_000)
    await page.goto('/cathode/?play&shot')
    const p = await probe(page, '.hud-hp-text')
    expectHouseRules(p, 'Cathode Figures')
    expect(p.faces.filter((f) => /Fraunces|Atkinson/.test(f))).toEqual([])
  })
})
