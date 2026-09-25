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
})
