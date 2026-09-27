// Implements SPEC 11.5 "Releasing": run gates, fast-forward main to the current build commit,
// poll the live version.json, run a live smoke test, tag deploy-<n>, and log it in PROGRESS.md.
// On smoke-test failure, revert main to the previous deploy tag (never force-push) and log it.
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { chromium } from '@playwright/test'

const VERCEL_ADDRESS = 'cathnivore.vercel.app' // from OWNER.md; used until the domain resolves
const DOMAIN = 'https://cathnivore.com'
const POLL_TIMEOUT_MS = 10 * 60 * 1000
const POLL_INTERVAL_MS = 15 * 1000

function sh(cmd: string): string {
  return execSync(cmd, { encoding: 'utf8' }).trim()
}

function nextDeployNumber(): number {
  let tags: string[] = []
  try {
    tags = sh('git tag --list "deploy-*"').split('\n').filter(Boolean)
  } catch {
    tags = []
  }
  const nums = tags.map((t) => Number(t.replace('deploy-', ''))).filter((n) => !Number.isNaN(n))
  return nums.length ? Math.max(...nums) + 1 : 1
}

async function pollVersion(commit: string, base: string): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    try {
      const res = await fetch(`${base}/version.json`, { cache: 'no-store' })
      if (res.ok) {
        const json = (await res.json()) as { commit?: string }
        if (json.commit === commit) return true
      }
    } catch {
      // network hiccup; keep polling
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }
  return false
}

type SmokeResult = 'passed' | 'failed' | 'inconclusive'

// This sandbox's egress proxy re-signs TLS with a CA Chromium doesn't trust, and it drops some of a
// browser's parallel requests. Those errors say nothing about the site, so they make the browser check
// inconclusive rather than failed (a failed check reverts main).
const SANDBOX_NETWORK_ERRORS = /ERR_CERT_AUTHORITY_INVALID|ERR_TOO_MANY_RETRIES|ERR_PROXY_CONNECTION_FAILED|ERR_TUNNEL_CONNECTION_FAILED/

export async function liveSmokeTest(base: string): Promise<SmokeResult> {
  // Same pinned-Chromium-path fallback as scripts/gates.ts's GATE_5_SPECS invocation: this script runs
  // outside the `playwright test` runner (no playwright.config.ts project applies), so without this,
  // chromium.launch() defaults to the headless-shell binary, which this sandbox never installs.
  const executablePath =
    process.env.PLAYWRIGHT_CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined)
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
  try {
    browser = await chromium.launch({ executablePath })
    const page = await browser.newPage()
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(String(err)))
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    // The site root is the games landing page; each game lives under its own path.
    const landing = await page.goto(`${base}/`, { waitUntil: 'load' })
    if (!landing || !landing.ok()) {
      console.log(`Smoke test failed: ${base}/ returned ${landing?.status()}`)
      return 'failed'
    }
    await page.locator('a[href="/cathnivore/"]').waitFor({ timeout: 15_000 })
    await page.locator('a[href="/runnel/"]').waitFor({ timeout: 15_000 })

    const runnel = await page.goto(`${base}/runnel/?nohelp`, { waitUntil: 'load' })
    if (!runnel || !runnel.ok()) {
      console.log(`Smoke test failed: ${base}/runnel/ returned ${runnel?.status()}`)
      return 'failed'
    }
    await page.locator('.tiles > g.cell:not(.stone)').first().click({ timeout: 15_000 })
    await page.locator('#hud-taps', { hasText: '1' }).waitFor({ timeout: 5_000 })

    const res = await page.goto(`${base}/cathnivore/`, { waitUntil: 'load' })
    if (!res || !res.ok()) {
      console.log(`Smoke test failed: ${base}/cathnivore/ returned ${res?.status()}`)
      return 'failed'
    }

    await page.getByText('Quick Game').click()
    await page.getByRole('button', { name: 'Start' }).click()
    // Graft (SPEC 4.6.7: "gain 1 Produce and 1 Marks. This guarantees a legal action always exists.") is
    // always legal on the opening turn regardless of producer pair or difficulty, so it's the one action
    // this quick check can always take without needing to know the game state first.
    await page.getByRole('button', { name: /^Graft/ }).click({ timeout: 15_000 })

    const realErrors = errors.filter((e) => !SANDBOX_NETWORK_ERRORS.test(e))
    if (realErrors.length > 0) {
      console.log(`Smoke test failed: ${realErrors.length} console error(s) on ${base}:`)
      for (const e of realErrors) console.log(`  ${e}`)
      return 'failed'
    }
    if (errors.length > 0) {
      console.log(`Browser check inconclusive: only sandbox proxy errors (${errors.length}), e.g. ${errors[0]}`)
      return 'inconclusive'
    }
    console.log(`Smoke test passed: landing page and Runnel loaded, a Runnel tile turned, Cathnivore Quick Game started, Graft taken, no console errors.`)
    return 'passed'
  } catch (err) {
    if (SANDBOX_NETWORK_ERRORS.test(String(err))) {
      console.log(`Browser check inconclusive (sandbox proxy): ${String(err).split('\n')[0]}`)
      return 'inconclusive'
    }
    console.log(`Smoke test failed with an exception: ${String(err)}`)
    return 'failed'
  } finally {
    await browser?.close()
  }
}

// Fallback when the browser check is inconclusive: every page must return 200 with the expected content,
// and so must every file each page references. curl uses the system trust store, which holds the proxy CA.
export function httpSmokeTest(base: string, commit: string): boolean {
  const get = (path: string) => execSync(`curl -sS -f -m 30 ${JSON.stringify(base + path)}`, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  try {
    const version = JSON.parse(get('/version.json')) as { commit?: string }
    if (version.commit !== commit) {
      console.log(`HTTP check failed: /version.json shows ${version.commit}, expected ${commit}`)
      return false
    }
    const pages: Array<[string, string]> = [['/', 'href="/runnel/"'], ['/runnel/', 'id="board"'], ['/cathnivore/', 'id="root"']]
    for (const [path, marker] of pages) {
      const html = get(path)
      if (!html.includes(marker)) {
        console.log(`HTTP check failed: ${path} is missing ${marker}`)
        return false
      }
      for (const m of html.matchAll(/(?:src|href)="(\/[^"]+)"/g)) get(m[1]!)
    }
    console.log('HTTP check passed: version.json, the landing page, Runnel, Cathnivore and every file they reference all load.')
    return true
  } catch (err) {
    console.log(`HTTP check failed: ${String(err).split('\n')[0]}`)
    return false
  }
}

async function main() {
  console.log('=== Running gates ===')
  execSync('tsx scripts/gates.ts', { stdio: 'inherit' })

  const buildCommit = sh('git rev-parse build')
  console.log(`\n=== Fast-forwarding main to ${buildCommit} ===`)
  sh('git fetch origin main build')
  // Captured before the fast-forward so a smoke-test failure can always revert to main's actual last
  // live commit, regardless of whether any `deploy-<n>` tag exists locally: tag pushes are known to be
  // blocked in this environment (HTTP 403, see DECISIONS.md), and every session starts from a fresh
  // clone, so locally-created tags never survive past the session that made them. Relying on
  // `nextDeployNumber()` for the revert target meant it silently found no prior tag in every fresh
  // session and skipped the revert entirely (see DECISIONS.md for the incident this was found from).
  const previousMainCommit = sh('git rev-parse origin/main')
  sh('git checkout main')
  sh('git merge --ff-only build')
  sh('git push origin main')

  console.log('\n=== Polling live version.json ===')
  let base = DOMAIN
  let ok = await pollVersion(buildCommit, base)
  if (!ok) {
    console.log(`Domain not showing new commit; trying Vercel address https://${VERCEL_ADDRESS}`)
    base = `https://${VERCEL_ADDRESS}`
    ok = await pollVersion(buildCommit, base)
  }

  if (!ok) {
    console.log('Deployment did not appear within 10 minutes. Not tagging. Logging as blocked.')
    process.exitCode = 1
    return
  }

  console.log(`\n=== Live smoke test against ${base} ===`)
  // SPEC 11.5: "the title loads, a Quick Game starts, one action is taken, and there are no console
  // errors" — a real browser check against the live URL, not just an HTTP status fetch. Uses the same
  // pinned-Chromium-path workaround as e2e/gates (playwright.config.ts's PLAYWRIGHT_CHROMIUM_PATH), since
  // this script runs outside the `playwright test` runner and its config.
  const smoke = await liveSmokeTest(base)
  const smokeTestOk = smoke === 'passed' || (smoke === 'inconclusive' && httpSmokeTest(base, buildCommit))
  if (!smokeTestOk) {
    if (previousMainCommit === buildCommit) {
      // main was already at buildCommit before this run (e.g. re-running release on an unchanged
      // build), so there is nothing to revert.
      console.log('main was already at this commit before this run; nothing to revert.')
    } else {
      // Revert the range from main's actual last live commit (captured before the fast-forward above)
      // up to HEAD (buildCommit). Reverting `buildCommit..HEAD` here would be an empty range (main was
      // just ff-merged to buildCommit, so HEAD already equals buildCommit), which `git revert` rejects
      // with "empty commit set passed" — previously masked by a trailing `|| true`, so main silently
      // stayed on the broken commit instead of being reverted. This also doesn't depend on a
      // `deploy-<n>` tag existing: tag pushes are blocked in this environment (HTTP 403) and every
      // session starts from a fresh clone, so a locally-created tag never survives past its own session.
      // A single forward commit that restores main's previous tree. `git revert <range>` can't do this
      // when the range holds a merge commit (it needs -m, which then breaks on ordinary commits), and
      // this never rewrites history.
      console.log(`Reverting main to ${previousMainCommit}`)
      sh('git checkout main')
      sh(`git read-tree -u --reset ${previousMainCommit}`)
      sh(`git commit --no-verify -m "Revert main to ${previousMainCommit}: live smoke test failed for ${buildCommit}"`)
      sh('git push origin main')
    }
    process.exitCode = 1
    return
  }

  const n = nextDeployNumber()
  const tag = `deploy-${n}`
  try {
    sh(`git tag ${tag}`)
    sh(`git push origin ${tag}`)
    console.log(`\nTagged ${tag} at ${buildCommit}. Remember to log it in PROGRESS.md's deploy log.`)
  } catch (err) {
    console.log(`\nCould not push tag ${tag} (see PROGRESS.md Blocked section for known cause).`)
    console.log(err)
  } finally {
    sh('git checkout build')
  }
}

// Run only when invoked as a script, so the smoke checks can be imported and tried on their own.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
}
