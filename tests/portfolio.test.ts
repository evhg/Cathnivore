import { describe, expect, it } from 'vitest'
import { APPS, appsHtml, cardHtml } from '../portfolio/src/apps'
import {
  GATE_COOKIE,
  cleared,
  cookieValue,
  gatePage,
  handleGet,
  handlePost,
  hashPassword,
  passwordMatches,
} from '../api/kinetiq'

describe('portfolio cards', () => {
  it('every app has a unique id, and live and private apps have a link', () => {
    expect(new Set(APPS.map((a) => a.id)).size).toBe(APPS.length)
    for (const a of APPS) {
      if (a.status === 'lab') expect(a.href).toBeUndefined()
      else expect(a.href, a.id).toBeTruthy()
      expect(a.tags.length).toBeLessThanOrEqual(3)
    }
  })

  it('Kinetiq goes through the gate, never straight to its own site', () => {
    const k = APPS.find((a) => a.id === 'kinetiq')!
    expect(k.status).toBe('private')
    expect(k.href).toBe('/kinetiq')
    expect(appsHtml()).not.toMatch(/vercel\.app[^"]*kinetiq|kinetiq[^"]*vercel\.app/)
  })

  it('renders links for live apps, an article for lab ones, and escapes text', () => {
    expect(cardHtml({ ...APPS[0]!, name: 'A <b>' })).toContain('A &lt;b&gt;')
    expect(cardHtml({ ...APPS[0]!, status: 'lab', href: undefined })).toContain('<article')
    expect(cardHtml(APPS.find((a) => a.id === 'kicksmash')!)).toContain('rel="noopener" target="_blank"')
  })
})

describe('Kinetiq gate', () => {
  const hash = hashPassword('Open Sesame ')
  const env = { passwordSha256: hash, url: 'https://kinetiq.example' }
  const post = (password: string) =>
    new Request('https://cathnivore.com/kinetiq', {
      method: 'POST',
      body: new URLSearchParams({ password }).toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })

  it('compares the trimmed, lower-cased password', () => {
    expect(passwordMatches('open sesame', hash)).toBe(true)
    expect(passwordMatches('  OPEN SESAME', hash)).toBe(true)
    expect(passwordMatches('open sesam', hash)).toBe(false)
    expect(passwordMatches('', hash)).toBe(false)
  })

  it('serves the page without a cookie and redirects with one', () => {
    const page = handleGet(new Request('https://cathnivore.com/kinetiq'), env)
    expect(page.status).toBe(200)
    expect(page.headers.get('Cache-Control')).toContain('no-store')
    const cookie = `${GATE_COOKIE}=${cookieValue(hash)}`
    const ok = handleGet(new Request('https://cathnivore.com/kinetiq', { headers: { cookie } }), env)
    expect(ok.status).toBe(302)
    expect(ok.headers.get('Location')).toBe(env.url)
  })

  it('a forged or stale cookie does not pass', () => {
    expect(cleared(`${GATE_COOKIE}=deadbeef`, hash)).toBe(false)
    expect(cleared(`${GATE_COOKIE}=${cookieValue(hashPassword('old'))}`, hash)).toBe(false)
    expect(cleared(null, hash)).toBe(false)
  })

  it('the right password sets an HttpOnly cookie and redirects; a wrong one is refused', async () => {
    const ok = await handlePost(post('open sesame'), env)
    expect(ok.status).toBe(303)
    expect(ok.headers.get('Location')).toBe(env.url)
    const set = ok.headers.get('Set-Cookie')!
    expect(set).toContain(`${GATE_COOKIE}=${cookieValue(hash)}`)
    expect(set).toMatch(/HttpOnly; Secure; SameSite=Lax/)
    const bad = await handlePost(post('nope'), env)
    expect(bad.status).toBe(401)
    expect(bad.headers.get('Set-Cookie')).toBeNull()
    expect(await bad.text()).toContain('not right')
  })

  it('refuses to open while it is not configured', async () => {
    expect(handleGet(new Request('https://cathnivore.com/kinetiq'), {}).status).toBe(503)
    expect((await handlePost(post('x'), { passwordSha256: hash, url: 'http://insecure' })).status).toBe(503)
  })

  it('the page has no inline styles or scripts (CSP)', () => {
    const page = gatePage('err <x>')
    expect(page).not.toMatch(/style=|<script/)
    expect(page).toContain('err &lt;x&gt;')
  })
})
