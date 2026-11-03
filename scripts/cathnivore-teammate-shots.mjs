// Plan item 47: the AI teammate's seat at D and P, between picks (SEL=.teammate-pick-thinking) or on a pick
// (SEL=.teammate-pick[data-teammate-step]). Usage: BASE=http://localhost:4190 TAG=after SEL=... node scripts/cathnivore-teammate-shots.mjs
import { chromium } from '@playwright/test'
const b = await chromium.launch()
for (const [n,o] of [['D',{viewport:{width:1440,height:900}}],['P',{viewport:{width:390,height:844},hasTouch:true,isMobile:true}]]) {
const p = await b.newPage(o)
await p.goto(process.env.BASE+'/cathnivore/?e2eTeammateShow=1')
await p.getByText('Quick Game').click(); await p.getByRole('button',{name:'Start'}).click()
await p.locator('.active-producer').waitFor()
for (let i=0;i<3;i++) await p.getByRole('button',{name:/^Graft:/}).click({force:true})
await p.locator(process.env.SEL).first().waitFor({timeout:15000})
await p.screenshot({path:`e2e/screenshots/critique47/${n}-cath-thinking-${process.env.TAG}.png`})
await p.close() }
await b.close()
