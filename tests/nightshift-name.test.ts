import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// C12: the owner never sees the old name. Player-visible text (page copy, landing card, credits, aria labels,
// the save-code error) says NIGHT SHIFT. Code identifiers and doc paths keep "cathode".
const read = (p: string) => readFileSync(p, 'utf8')
const textNodes = (html: string) =>
  html
    .replace(/<(script|style)[\s\S]*?<\/\1>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<path[^>]*>/g, '')

describe('NIGHT SHIFT rename (C12)', () => {
  it('the game page never shows CATHODE', () => {
    const html = textNodes(read('games/cathode/index.html'))
    expect(html).not.toMatch(/cathode/i)
    expect(html).toContain('<title>NIGHT SHIFT</title>')
    expect(html).toContain('NIGHT SHIFT has strong')
  })
  it('the landing card is called NIGHT SHIFT and links to /nightshift/', () => {
    const html = read('site/index.html')
    expect(html).toContain('href="/nightshift/"')
    expect(html).toContain('card-title">NIGHT SHIFT')
    expect(html).not.toMatch(/card-title">CATHODE/)
  })
  it('credits and the save error use the new name', () => {
    expect(read('games/cathode/src/ui/credits.ts')).not.toMatch(/"CATHODE"/)
    expect(read('games/cathode/src/sim/save.ts')).not.toMatch(/not a CATHODE/)
  })
  it('/cathode/ redirects to /nightshift/', () => {
    const v = JSON.parse(read('vercel.json'))
    const r = v.redirects.find((x: { source: string }) => x.source === '/cathode/:path*')
    expect(r.destination).toBe('/nightshift/:path*')
  })
})
