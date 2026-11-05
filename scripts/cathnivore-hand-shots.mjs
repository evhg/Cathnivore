// Plan item 149: the desktop action hand at D (1440x900, 1280x800) and P, light and dark.
//   npm run build && npx vite preview --port 4191 &   then   node scripts/cathnivore-hand-shots.mjs http://localhost:4191 <outdir> <tag>
import { chromium } from '@playwright/test'
const [base, out, tag] = [process.argv[2], process.argv[3], process.argv[4]]
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' })
for (const scheme of (process.env.SCHEMES ?? 'light,dark').split(','))
for (const [n, w, h, touch] of (process.env.SIZES ? JSON.parse(process.env.SIZES) : [['D', 1440, 900, false], ['D2', 1280, 800, false], ['P', 390, 844, true]])) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, hasTouch: touch, colorScheme: scheme })).newPage()
  await p.goto(base + '/?seed=7')
  await p.getByText('Quick Game').click()
  await p.locator('input[inputmode="numeric"]').waitFor({ state: 'attached' })
  const adv = p.getByRole('button', { name: 'Advanced' })
  if ((await adv.isVisible()) && (await adv.getAttribute('aria-expanded')) !== 'true') await adv.click()
  await p.locator('input[inputmode="numeric"]').fill(process.env.SEED ?? '7')
  await p.locator('.setup-start').click()
  await p.locator('.game').waitFor()
  await p.mouse.move(5, 5)
  await p.waitForTimeout(1500)
  console.log(n, scheme, JSON.stringify(await p.evaluate(() => {
    const cards = [...document.querySelectorAll('[data-hand-card]')].map((e) => { const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)] })
    return { cards, scroll: document.scrollingElement.scrollHeight - innerHeight }
  })))
  await p.screenshot({ path: `${out}/${tag}-${n}-${scheme}.png` })
  await p.context().close()
}
await b.close()
