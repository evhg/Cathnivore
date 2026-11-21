import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { APPS, appsHtml, cardHtml, caseHtml } from '../portfolio/src/apps'
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
    const all = appsHtml() + APPS.map(caseHtml).join('')
    expect(all).not.toMatch(/vercel\.app[^"]*kinetiq|kinetiq[^"]*vercel\.app/)
    expect(caseHtml(k)).toContain('href="/kinetiq"')
  })

  it('every card opens its case study; the case study links out to the product', () => {
    for (const a of APPS) {
      expect(cardHtml(a)).toContain(`href="/work/${a.id}/"`)
      expect(cardHtml(a)).toContain(`data-vt="${a.id}"`)
      expect(caseHtml(a)).toContain(`data-vt="${a.id}"`)
    }
    expect(cardHtml({ ...APPS[0]!, name: 'A <b>' })).toContain('A &lt;b&gt;')
    expect(caseHtml(APPS.find((a) => a.id === 'kicksmash')!)).toContain('href="https://kicksma.sh" rel="noopener" target="_blank"')
    expect(caseHtml(APPS.find((a) => a.id === 'games')!)).not.toContain('target="_blank"')
  })

  it('links each app at its own domain, never an old *.vercel.app deployment', () => {
    expect(APPS.find((a) => a.id === 'jarvis')!.href).toBe('https://jarvis.cathnivore.com')
    expect(APPS.find((a) => a.id === 'dailyritual')!.href).toBe('https://dailyritual.cathnivore.com')
    expect(appsHtml() + APPS.map(caseHtml).join('')).not.toMatch(/vercel\.app/)
  })

  it('every screenshot a card names exists', () => {
    for (const a of APPS) {
      if (a.visual.kind !== 'image') continue
      for (const src of a.visual.src) expect(existsSync(resolve(import.meta.dirname, '../portfolio/public', src.slice(1))), src).toBe(true)
    }
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

describe('plan item 454: the live last-shipped line', () => {
  it('names the release age, the build and the next session (:21 and :51)', async () => {
    const { shippedLine } = await import('../portfolio/src/fx')
    expect(shippedLine(3 * 3600_000, 'abcdef0123', new Date('2026-11-16T15:40:00Z'))).toBe('Live: last shipped 3 h ago, build abcdef0. The next build session starts in 11 min.')
    expect(shippedLine(60_000, undefined, new Date('2026-11-16T15:10:00Z'))).toBe('Live: last shipped just now. The next build session starts in 11 min.')
    expect(shippedLine(60_000, 'not-a-sha', new Date('2026-11-16T15:55:00Z'))).toMatch(/starts in 26 min\.$/)
  })
})

describe('plan item 454: the hero field goes still without a GPU', () => {
  it('knows the software rasterisers', async () => {
    const { softwareRenderer } = await import('../portfolio/src/hero')
    for (const n of ['ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)', 'llvmpipe (LLVM 15.0.7, 256 bits)', 'Microsoft Basic Render Driver']) expect(softwareRenderer(n), n).toBe(true)
    for (const n of ['Apple M3 Max', 'ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)', 'Adreno (TM) 740', 'Apple GPU', '']) expect(softwareRenderer(n), n).toBe(false)
  })
})

// Plan item 491: the studio track's data, from git commits to sessions; subjects only.
describe('studio log', async () => {
  const { studioSessions, shortSubject, gameOf } = await import('../portfolio/src/studioLog')
  const now = 1_800_000_000
  const c = (minsAgo: number, subject: string, session: string, files: string[]) => ({ time: now - minsAgo * 60, subject, session, files })
  const commits = [
    c(50, 'Lane A: take build lock', 's1', ['.build-lock']),
    c(40, 'Cathnivore: the producers talk back. More words here.', 's1', ['src/ui/Game.tsx', 'src/styles/table.css']),
    c(30, 'Lane A: 489 done', 's1', ['docs/plan/two-week-plan.md']),
    c(20, 'Hedgerow: lanterns at dusk', 's2', ['games/hedgerow/src/render.ts']),
    c(15, 'Lane B 05:21 lock', 's2', ['.build-lock-b']),
    c(10, 'Notes only', 's3', ['PROGRESS.md']),
    c(60 * 25, 'Too old', 's4', ['src/a.ts']),
  ]
  const log = studioSessions(commits, now)
  it('groups a session, tells its lane and game, and drops notes-only sessions and the old', () => {
    expect(log.sessions).toHaveLength(2)
    expect(log.sessions[0]).toMatchObject({ lane: 'A', game: 'cathnivore', subjects: ['Cathnivore: the producers talk back'] })
    expect(log.sessions[1]).toMatchObject({ lane: 'B', game: 'hedgerow' })
  })
  it('carries no author, email or session link', () => {
    const json = JSON.stringify(studioSessions([c(5, 'Fix by someone@example.com, see https://claude.ai/code/session_x', 'session_x', ['src/a.ts'])], now))
    expect(json).not.toMatch(/@|https?:|session_x|author|email/i)
    for (const s of log.sessions) expect(Object.keys(s).sort()).toEqual(['end', 'game', 'lane', 'start', 'subjects'])
  })
  it('cuts a subject at its first sentence and 140 characters', () => {
    expect(shortSubject('One thing. Another.')).toBe('One thing')
    expect(shortSubject('x'.repeat(10) + ' ' + 'y '.repeat(100)).length).toBeLessThanOrEqual(140)
    expect(gameOf('games/cathode/src/a.ts')).toBe('nightshift')
    // A short label before a colon keeps its clause.
    expect(shortSubject('Hedgerow 3D: The hens sit low. More.')).toBe('Hedgerow 3D: The hens sit low')
  })
  it("splits a routine that reuses one session into its runs at that lane's locks, and tells an untagged run's lane by the clock", () => {
    const at = (h: number, m: number) => Date.UTC(2027, 0, 15, h, m) / 1000
    const k = (t: number, subject: string, session: string, files: string[]) => ({ time: t, subject, session, files })
    const end = at(12, 0)
    const runs = studioSessions([
      k(at(6, 22), 'Lane B lock 06:22', '', ['.build-lock-b']),
      k(at(6, 40), 'Lane B claims 464', 'b', ['docs/plan/two-week-plan.md']),
      k(at(6, 46), 'NIGHT SHIFT pick: test shots fire', 'b', ['games/cathode/src/game/testfire.ts', 'portfolio/public/work/a.webp', 'portfolio/public/work/b.webp']),
      k(at(7, 22), 'Lane B lock 07:22', '', ['.build-lock-b']),
      k(at(7, 24), 'Runnel: a glint', 'b', ['games/runnel/src/board.ts']),
      k(at(8, 11), 'Hedgerow 3D: hens', 'a2', ['games/hedgerow/src/render3d/hens.ts']),
    ], end)
    expect(runs.sessions.map((s) => [s.lane, s.game])).toEqual([['B', 'nightshift'], ['B', 'runnel'], ['A', 'hedgerow']])
  })
})

// Plan item 626: the studio track's notches wear their game's colour, 3:1 or more on the track, and say what changed.
describe('studio track colours and names', async () => {
  const { GAME_COLORS, notchLabel } = await import('../portfolio/src/studio')
  const { readFileSync } = await import('node:fs')
  const tokens = readFileSync('portfolio/src/tokens.css', 'utf8')
  const hex = (name: string) => tokens.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, 'i'))![1]!
  const lum = (h: string) => {
    const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!
  }
  it('every game colour is 3:1 or more on the track (text at 4% over the darkest ink)', () => {
    const track = '#141319'
    for (const token of Object.values(GAME_COLORS)) {
      const ratio = (lum(hex(token)) + 0.05) / (lum(track) + 0.05)
      expect(ratio, token).toBeGreaterThanOrEqual(3)
    }
  })
  it("names a notch by lane, time, game and its first change", () => {
    const s = { lane: 'B' as const, start: 0, end: 60, game: 'hedgerow' as const, subjects: ['Hedgerow: hens', 'Hedgerow: a fix', 'Hedgerow: more'] }
    expect(notchLabel(s, '14:05')).toBe('Lane B, 14:05, Hedgerow: hens, and 2 more changes')
    expect(notchLabel({ ...s, game: 'runnel', subjects: ["Runnel (plan item 623 done): Bea's garden is a bed"] }, '22:34')).toBe("Lane B, 22:34, Runnel: Bea's garden is a bed")
  })
})
