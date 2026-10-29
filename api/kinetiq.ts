// Vercel function behind /kinetiq (vercel.json rewrite): the password gate in front of Kinetiq on the
// portfolio (owner, 2026-10-29). Self-contained on purpose: Vercel runs each api/ file as its own Node
// module, so it imports nothing from the rest of the repo.
//   GET  with a valid cookie   302 to the Kinetiq site
//   GET  without one           the password page
//   POST the right password    sets the cookie, 303 to the Kinetiq site
//   POST a wrong one           the page again with an error, 401
// The repo is public, so neither the password nor the Kinetiq address lives here: Vercel holds
// KINETIQ_PASSWORD_SHA256 (sha256 of the trimmed, lower-cased password, hex) and KINETIQ_URL. The cookie
// is an HMAC keyed by that hash, so changing the password signs everyone out.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export const GATE_COOKIE = 'kq_portfolio'
export const GATE_PATH = '/kinetiq'
export const GATE_MAX_AGE = 30 * 24 * 60 * 60

export interface GateEnv {
  passwordSha256?: string
  url?: string
}

export const hashPassword = (password: string): string =>
  createHash('sha256').update(password.trim().toLowerCase()).digest('hex')

export const cookieValue = (passwordSha256: string): string =>
  createHmac('sha256', passwordSha256).update('kinetiq-portfolio-v1').digest('hex')

function sameHex(a: string, b: string): boolean {
  const x = Buffer.from(a, 'hex')
  const y = Buffer.from(b, 'hex')
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y)
}

export const passwordMatches = (password: string, passwordSha256: string): boolean =>
  sameHex(hashPassword(password), passwordSha256.trim().toLowerCase())

export function readCookie(header: string | null, name: string): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return v.join('=')
  }
  return undefined
}

export function cleared(cookieHeader: string | null, passwordSha256: string): boolean {
  const got = readCookie(cookieHeader, GATE_COOKIE)
  return !!got && sameHex(got, cookieValue(passwordSha256))
}

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** The password page. No scripts and no inline styles (the site CSP); styles come from /gate.css. */
export function gatePage(error?: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="robots" content="noindex, nofollow" />
    <meta name="theme-color" content="#0e0d12" />
    <title>Kinetiq: private</title>
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="/gate.css" />
  </head>
  <body>
    <main class="gate">
      <a class="back" href="/">Cathnivore</a>
      <h1>Kinetiq</h1>
      <p>Kinetiq is shared privately while it is under NDA. Enter the password to continue.</p>
      <form method="post" action="${GATE_PATH}">
        <label for="password">Password</label>
        <input id="password" name="password" type="password" autocomplete="current-password" required autofocus${error ? ' aria-invalid="true" aria-describedby="gate-error"' : ''} />
        ${error ? `<p class="error" id="gate-error" role="alert">${escape(error)}</p>` : ''}
        <button type="submit">Continue</button>
      </form>
    </main>
  </body>
</html>
`
}

const NO_STORE = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow', Vary: 'Cookie' }
const html = (body: string, status: number) =>
  new Response(body, { status, headers: { ...NO_STORE, 'Content-Type': 'text/html; charset=utf-8' } })

function configured(env: GateEnv): env is Required<GateEnv> {
  return !!env.passwordSha256?.trim() && !!env.url && /^https:\/\//.test(env.url)
}

const NOT_SET = 'This page is not set up yet.'

export function handleGet(request: Request, env: GateEnv): Response {
  if (!configured(env)) return html(gatePage(NOT_SET), 503)
  if (cleared(request.headers.get('cookie'), env.passwordSha256)) {
    return new Response(null, { status: 302, headers: { ...NO_STORE, Location: env.url } })
  }
  return html(gatePage(), 200)
}

export async function handlePost(request: Request, env: GateEnv): Promise<Response> {
  if (!configured(env)) return html(gatePage(NOT_SET), 503)
  let password = ''
  try {
    const form = new URLSearchParams(await request.text())
    password = form.get('password') ?? ''
  } catch {
    password = ''
  }
  if (!password || !passwordMatches(password, env.passwordSha256)) {
    await new Promise((r) => setTimeout(r, 400))
    return html(gatePage('That password is not right. Try again.'), 401)
  }
  const cookie = `${GATE_COOKIE}=${cookieValue(env.passwordSha256)}; Path=${GATE_PATH}; Max-Age=${GATE_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`
  return new Response(null, { status: 303, headers: { ...NO_STORE, Location: env.url, 'Set-Cookie': cookie } })
}

const env = (): GateEnv => ({
  passwordSha256: process.env.KINETIQ_PASSWORD_SHA256,
  url: process.env.KINETIQ_URL,
})

export function GET(request: Request): Response {
  return handleGet(request, env())
}

export function POST(request: Request): Promise<Response> {
  return handlePost(request, env())
}
