import { chromium } from 'playwright'
const [out, css] = [process.argv[2], process.argv[3] ?? '']
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 3, reducedMotion: 'reduce' })
await p.goto('http://localhost:4186/runnel/?nohelp&sky=noon')
await p.waitForTimeout(1200)
if (css) await p.addStyleTag({ content: css })
await p.screenshot({ path: out, clip: { x: 700, y: 140, width: 330, height: 200 } })
await b.close()
