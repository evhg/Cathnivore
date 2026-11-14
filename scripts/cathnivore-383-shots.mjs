// Plan item 383: the phone game's head (tally, Hollowell's portrait and intents, the event line) at 390x844 and 375x667.
// Usage: npm run build && npx vite preview --port 4173 &  then  node scripts/cathnivore-383-shots.mjs <tag>
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const tag = process.argv[2] ?? 'after'
const out = 'e2e/screenshots/c383'
mkdirSync(out, { recursive: true })
const b = await chromium.launch()
for (const vp of [{ width: 390, height: 844 }, { width: 375, height: 667 }]) {
  const p = await b.newPage({ viewport: vp, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })
  await p.goto('http://localhost:4173/')
  await p.getByText('Quick Game').click()
  await p.getByRole('button', { name: 'Start' }).click()
  await p.locator('.market-board .board-label').first().waitFor()
  await p.waitForTimeout(1500)
  await p.screenshot({ path: `${out}/${tag}-${vp.width}.png` })
  await p.screenshot({ path: `${out}/${tag}-${vp.width}-head.png`, clip: { x: 0, y: 0, width: vp.width, height: 180 } })
  await p.close()
}
await b.close()
