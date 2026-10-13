// Hedgerow 3D field shots, one level per act, to judge each act's biome (H1).
// Usage: npm run build:site && npx vite preview --outDir dist-site --port 4180 &  then  LEVELS=1,11,21 node scripts/hedgerow-act-shots.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
const base = process.env.HEDGEROW_URL ?? 'http://localhost:4180/hedgerow/'
const out = process.env.OUT ?? 'e2e/screenshots/hedgerow-acts'
const levels = (process.env.LEVELS ?? '1,11,21,31,41,51,61,71,81,91').split(',')
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] })
for (const lv of levels) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 700 } })
  await page.goto(`${base}?sandbox=1&level=${lv}`)
  await page.waitForTimeout(6000)
  await page.screenshot({ path: `${out}/level-${lv}.png` })
  await page.close()
}
await browser.close()
