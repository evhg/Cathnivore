import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// SPEC 11.5: "Pages the App Store needs, served by the site in the STYLE.md look" — static files in
// public/ so Vite copies them verbatim to dist/<path>/index.html.
describe('privacy and support pages', () => {
  const privacy = fs.readFileSync(path.join(__dirname, '../public/privacy/index.html'), 'utf8')
  const support = fs.readFileSync(path.join(__dirname, '../public/support/index.html'), 'utf8')

  it('privacy page says no data is collected or tracked', () => {
    expect(privacy).toMatch(/collects no data/i)
    expect(privacy).toMatch(/does not track/i)
    expect(privacy).toMatch(/saves and campaign progress stay on your device/i)
  })

  it('support page explains how to play and gives the OWNER.md support email', () => {
    expect(support).toMatch(/how to play/i)
    expect(support).toContain('claude@cathnivore.com')
  })

  it('both pages link back to the title screen and to each other', () => {
    for (const page of [privacy, support]) {
      expect(page).toContain('href="/"')
    }
    expect(privacy).toContain('href="/support"')
    expect(support).toContain('href="/privacy"')
  })

  // SPEC 11.5's CSP has no `style-src 'unsafe-inline'` exception; these two pages used to be the reason
  // it was there (an inline `<style>` block each). Guards against a future edit reintroducing one.
  it('neither page has an inline <style> block', () => {
    for (const page of [privacy, support]) {
      expect(page).not.toMatch(/<style/i)
      expect(page).toContain('<link rel="stylesheet" href="/pages.css" />')
    }
  })
})

describe('vercel.json CSP', () => {
  const vercelConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../vercel.json'), 'utf8'))
  const cspRule = vercelConfig.headers.find((h: { source: string }) => h.source === '/(.*)')
  const csp: string = cspRule.headers.find((h: { key: string }) => h.key === 'Content-Security-Policy').value

  it('style-src allows only self, no unsafe-inline', () => {
    expect(csp).toMatch(/style-src 'self'(?!.*unsafe-inline)/)
    expect(csp).not.toContain('unsafe-inline')
  })
})

// SPEC 2: "URL: https://cathnivore.com, with www.cathnivore.com redirecting to it."
describe('vercel.json www redirect', () => {
  const vercelConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../vercel.json'), 'utf8'))

  it('permanently redirects the www host to the apex domain', () => {
    const redirect = vercelConfig.redirects?.find((r: { has?: { type: string; value: string }[] }) =>
      r.has?.some((h) => h.type === 'host' && h.value === 'www.cathnivore.com'),
    )
    expect(redirect).toBeDefined()
    expect(redirect.destination).toBe('https://cathnivore.com/:path*')
    expect(redirect.permanent).toBe(true)
  })
})
