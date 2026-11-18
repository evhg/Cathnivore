import { chromium } from '@playwright/test'
const css=process.env.CSS??'', tag=process.env.TAG??'x'
const b=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_PATH})
for (const [s,vp] of [['D',{width:1440,height:900}],['d',{width:1280,height:800}]]) {
  const p=await b.newPage({viewport:vp})
  await p.goto(`${process.env.BASE??'http://localhost:4180/cathnivore/'}`); await p.waitForTimeout(1500)
  await p.getByText('Quick Game').click(); await p.waitForTimeout(800)
  await p.getByRole('button',{name:'Start'}).click(); await p.mouse.move(2,2); await p.waitForTimeout(2500)
  if (css) { await p.addStyleTag({content:css}); await p.waitForTimeout(800) }
  const r=await p.evaluate(()=>{
    const u=[...document.querySelectorAll('svg.map .region-hex')].map(g=>g.querySelector('polygon')).map(e=>e.getBoundingClientRect())
    const x0=Math.min(...u.map(r=>r.left)),x1=Math.max(...u.map(r=>r.right)),y0=Math.min(...u.map(r=>r.top)),y1=Math.max(...u.map(r=>r.bottom))
    const m=document.querySelector('.map-wrap').getBoundingClientRect(), A=innerWidth*innerHeight
    const cath=document.querySelector('.table-cath-figure')?.getBoundingClientRect().height||0; const figs=[...document.querySelectorAll('.map-wrap [data-table-producer]:not([data-unseated]) svg.fig')].map(e=>+(e.getBoundingClientRect().height/cath).toFixed(3)); const cb=document.querySelector('.table-cath-figure')?.getBoundingClientRect(); const hitCath=cb?u.some(r=>r.left<cb.right&&cb.left<r.right&&r.top<cb.bottom&&cb.top<r.bottom):null;
    return {figs,hitCath,board:[x0|0,y0|0,x1|0,y1|0], boardPct:+((x1-x0)*(y1-y0)/A*100).toFixed(1), mapPct:+(m.width*m.height/A*100).toFixed(1), scrollH:document.scrollingElement.scrollHeight}
  })
  console.log(s,JSON.stringify(r))
  await p.screenshot({path:`${process.env.OUT??'/tmp/'}m495-${tag}-${s}.png`})
}
await b.close()
